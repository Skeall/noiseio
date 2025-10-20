import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// Debug logs are added throughout for easier troubleshooting
// Simple in-memory game state (resets on server restart)
const rooms = new Map(); // code -> room

// Word list (server authoritative)
const WORDS = [
  // Base
  'chat','chien','vache','voiture','téléphone','porte','horloge','tambour','train','pluie',
  'aspirateur','hélicoptère','guitare','moto','oiseau','tonnerre','pizza','serpent','lion','bébé','marteau','râteau','sirène','robot','vent','réveil','cloche','singe','rire','machine à laver',
  'dinosaure','photocopieuse','parapluie','volcan','cheval','chevalier','toilette','feu d’artifice','baleine','viking','zèbre','marteau-piqueur','popcorn','four','monstre','feu de camp','aspirine','friteuse','alien','canard qui parle',
  // Ajouts (sans doublons)
  'poule','mouton','cochon','grenouille','canard','avion','camion','bateau','vélo','tracteur','ambulance','fusée',
  'sifflet','klaxon','éternuer','tousser','bailler','eau','feu','éléphant','abeille','loup','hibou','souris',
  'moto-cross','piano','batterie','trompette','violon','flûte','saxophone','café','soda','soupe','chips','glaçons',
  'orage','océan','forêt','nager','courir','sauter','tomber','dormir','imprimante','ordinateur','micro-ondes','lave-linge','ventilateur','tondeuse','perceuse','mixeur','climatisation',
  'fantôme','zombie','fermeture éclair','escalier','ascenseur','fontaine','balançoire','skateboard',
  'dauphin','hyène','chauve-souris','bébé qui pleure','vieux téléphone','moteur qui cale',
  'lightsaber','t-rex','pacman','mario','pikachu','chewbacca','r2-d2','gollum','yoda','minions'
];

function genCode(len = 4) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeText(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  a = normalizeText(a); b = normalizeText(b);
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (al === 0) return bl; if (bl === 0) return al;
  const dp = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) dp[j] = j;
  for (let i = 1; i <= al; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= bl; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[bl];
}

function closeEnough(guess, target) {
  // Official tolerance: accents/case ignored + Levenshtein <= 2
  // Also accept common truncation (prefix of length >=5)
  const g = normalizeText(guess);
  const t = normalizeText(target);
  if (!g || !t) return false;
  if (g === t) return true;
  if (levenshtein(g, t) <= 2) return true;
  if (g.length >= 5 && (t.startsWith(g) || g.startsWith(t))) return true;
  return false;
}

function makeRoom(code) {
  return {
    code,
    players: new Map(), // id -> { id, name, score, ws, isHost }
    state: 'lobby', // 'lobby' | 'inRound' | 'ended'
    current: null, // { recorderId, secretNorm, secretRaw, phase: 'recording'|'guessing', audioBase64, audioMime, recordTo, guessTo }
    history: [], // [{ recorderId, winnerId, secretNorm, audioBase64, audioMime }]
    turn: [], // array of player ids in order
    turnIndex: 0,
    party: null // { started, players: string[], played: Record<string,number>, totalRounds, roundNumber }
  };
}

function getRoom(code) {
  return rooms.get(code);
}

function broadcast(room, data, exceptId = null) {
  const raw = JSON.stringify(data);
  for (const [id, p] of room.players) {
    if (p.ws.readyState === 1 && id !== exceptId) {
      try { p.ws.send(raw); } catch (e) { console.error('[ws] send error', e); }
    }
  }
}

function send(ws, data) {
  try { ws.send(JSON.stringify(data)); } catch (e) { console.error('[ws] send error', e); }
}

function roomSnapshot(room) {
  const players = [...room.players.values()].map(p => ({ id: p.id, name: p.name, score: p.score, isHost: p.isHost }));
  return {
    code: room.code,
    state: room.state,
    players,
    turn: room.turn,
    turnIndex: room.turnIndex,
    current: room.current ? { recorderId: room.current.recorderId } : null,
    party: room.party ? { totalRounds: room.party.totalRounds, roundNumber: room.party.roundNumber } : null,
    history: room.history.map(h => ({
      recorderId: h.recorderId,
      winnerId: h.winnerId,
      audioMime: h.audioMime,
      audioBase64: h.audioBase64,
      secret: h.secretRaw || null,
      secretRaw: h.secretRaw || null,
      word: h.secretRaw || null
    }))
  };
}

function pickRandomWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

function clearTimers(room) {
  try { if (room.current?.recordTo) { clearTimeout(room.current.recordTo); room.current.recordTo = null; } } catch {}
  try { if (room.current?.guessTo) { clearTimeout(room.current.guessTo); room.current.guessTo = null; } } catch {}
}

function scheduleNextRound(room) {
  // Start next round automatically after a short pause
  if (room.state !== 'lobby') return;
  if (!room.turn?.length) return;
  const delay = 1500;
  console.log('[round] scheduling next in', delay, 'ms for room', room.code);
  setTimeout(() => {
    try { startServerRound(room); } catch (e) { console.error('[round] auto start error', e); }
  }, delay);
}

function startPartyIfNeeded(room) {
  if (room.party && room.party.started) return;
  const players = room.turn.slice();
  const played = {};
  players.forEach(id => { played[id] = 0; });
  const totalRounds = players.length * 2;
  room.party = { started: true, players, played, totalRounds, roundNumber: 0 };
  console.log('[party] started for room', room.code, 'players', players.length, 'totalRounds', totalRounds);
}

function pickNextRecorderId(room) {
  if (!room.party?.started) return null;
  const { players, played, totalRounds, roundNumber } = room.party;
  if (roundNumber >= totalRounds) return null;
  let idx = room.turnIndex % players.length;
  for (let i = 0; i < players.length; i++) {
    const id = players[(idx + i) % players.length];
    if (room.players.has(id) && (played[id] || 0) < 2) {
      room.turnIndex = (idx + i) % players.length; // align index
      return id;
    }
  }
  return null;
}

function finishRound(room, { winnerId = null, reason = 'correct' }) {
  if (!room.current) return;
  const cur = room.current;
  const recorder = room.players.get(cur.recorderId);
  const winner = winnerId ? room.players.get(winnerId) : null;
  // Safety guard: if multi-guessers are active (found set exists) and not all guessers have found yet,
  // ignore premature 'correct' finish requests from legacy paths.
  try {
    const implicitCorrect = (!reason && !!winnerId);
    if (reason === 'correct' || implicitCorrect) {
      const totalGuessers = [...room.players.keys()].filter(id => id !== cur.recorderId).length;
      const winnersCount = cur.found instanceof Set ? [...cur.found].filter(id => id !== cur.recorderId).length : 0;
      console.log('[round] guard check finish(correct): winners', winnersCount, '/', totalGuessers, 'room', room.code, 'implicit=', implicitCorrect);
      if (winnersCount < totalGuessers) {
        console.log('[round] ignore finish(correct): not all guessers found yet');
        return;
      }
    }
  } catch {}
  clearTimers(room);
  console.log('[round] finish reason=', reason, 'room', room.code, 'winner=', winner?.name || 'none');
  // scoring already handled live on each correct for multi-guessers; avoid double-scoring here.
  // history entry
  room.history.push({
    recorderId: cur.recorderId,
    winnerId: winnerId,
    secretNorm: cur.secretNorm,
    secretRaw: cur.secretRaw,
    audioBase64: cur.audioBase64,
    audioMime: cur.audioMime
  });
  // move to lobby and next turn
  room.state = 'lobby';
  const prev = room.turnIndex;
  // update party counters
  try {
    if (room.party?.started) {
      room.party.played[cur.recorderId] = (room.party.played[cur.recorderId] || 0) + 1;
    }
  } catch {}
  room.current = null;
  // notify
  if (winner) {
    // For legacy single-winner flow (unused in multi-guessers), we would notify here.
    broadcast(room, { type: 'ding', payload: { winnerId } });
    broadcast(room, { type: 'correct', payload: { winnerId, winner: winner?.name, answer: null } });
  }
  const partyDone = (() => {
    if (!room.party?.started) return false;
    const { players, played, totalRounds } = room.party;
    const roundsPlayed = players.reduce((acc, id) => acc + (played[id] || 0), 0);
    return roundsPlayed >= totalRounds;
  })();
  const nextId = partyDone ? null : pickNextRecorderId(room);
  const payloadEnded = { reason: partyDone ? 'party-complete' : (reason || (winner ? 'correct' : 'timeout')), nextRecorderId: nextId, prevRecorderId: room.turn[prev], history: roomSnapshot(room).history };
  broadcast(room, { type: 'roundEnded', payload: payloadEnded });
  broadcast(room, { type: 'scores', payload: { players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, score: p.score })) } });
  // schedule next or end party
  if (partyDone) {
    console.log('[party] complete for room', room.code);
    setTimeout(() => {
      room.state = 'ended';
      broadcast(room, { type: 'gameEnded', payload: { leaderboard: [...room.players.values()].map(pl => ({ id: pl.id, name: pl.name, score: pl.score })), history: roomSnapshot(room).history } });
    }, 900);
  } else {
    // advance index to next valid slot
    if (typeof nextId === 'string') {
      const idx = room.party.players.indexOf(nextId);
      if (idx >= 0) room.turnIndex = idx;
    }
    scheduleNextRound(room);
  }
}

function startGuessPhase(room) {
  if (!room.current) return;
  room.current.phase = 'guessing';
  // Track winners in this round for multi-guessers
  room.current.found = new Set();
  room.current.recorderAwarded = false;
  console.log('[phase] guessing start for room', room.code);
  // start 20s guess timeout
  room.current.guessTo = setTimeout(() => {
    console.log('[phase] guessing timeout → end round for room', room.code);
    finishRound(room, { winnerId: null, reason: 'guessing-timeout' });
  }, 20000);
}

function startServerRound(room, overrideRecorderId = null) {
  if (!room.turn?.length) return;
  if (room.state === 'inRound') return;
  startPartyIfNeeded(room);
  const recorderId = overrideRecorderId ?? pickNextRecorderId(room);
  if (!recorderId) {
    // No eligible recorder: end party
    console.log('[party] no eligible recorder, ending party for room', room.code);
    room.state = 'ended';
    broadcast(room, { type: 'gameEnded', payload: { leaderboard: [...room.players.values()].map(pl => ({ id: pl.id, name: pl.name, score: pl.score })), history: roomSnapshot(room).history } });
    return;
  }
  const recorder = room.players.get(recorderId);
  if (!recorder) return;
  const word = pickRandomWord();
  room.state = 'inRound';
  room.current = { recorderId, secretNorm: normalizeText(word), secretRaw: word, audioBase64: null, audioMime: null, phase: 'recording', recordTo: null, guessTo: null };
  try { if (room.party?.started) room.party.roundNumber += 1; } catch {}
  console.log('[round] start (server) room', room.code, 'recorder', recorder.name, 'word(picked)');
  broadcast(room, { type: 'roundStarted', payload: { byId: recorderId, byName: recorder.name, round: room.party?.roundNumber || 1, total: room.party?.totalRounds || room.turn.length } });
  // send secret privately to recorder only
  try { send(recorder.ws, { type: 'secret', payload: { word: word } }); } catch (e) { console.error('[secret] send error', e); }
  // 30s recording phase timeout (if no audio arrives)
  room.current.recordTo = setTimeout(() => {
    if (!room.current) return;
    if (room.current.audioBase64) return; // already recorded
    console.log('[phase] recording timeout for room', room.code);
    // No audio: end round as timeout
    finishRound(room, { winnerId: null, reason: 'recording-timeout' });
  }, 30000);
}

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static('public'));

// Simple version endpoint to verify server build
const SERVER_VERSION = 'multi-guessers-v2';
app.get('/__version', (req, res) => {
  res.json({ version: SERVER_VERSION, time: new Date().toISOString() });
});

// Favicon fallback route to avoid 404; serves our PNG icon
app.get('/favicon.ico', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'assets', 'ui', 'echos.png'));
  } catch (e) {
    res.status(204).end();
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const client = { id: genId(), name: null, roomCode: null };
  console.log('[ws] connected', client.id);

  ws.on('message', (msgRaw) => {
    let msg;
    try { msg = JSON.parse(msgRaw); } catch (e) { console.warn('[ws] invalid json'); return; }
    const { type, payload } = msg;

    if (type === 'createLobby') {
      const name = (payload?.name || '').trim().slice(0, 24) || 'Player';
      let code;
      do { code = genCode(4); } while (rooms.has(code));
      const room = makeRoom(code);
      rooms.set(code, room);
      const player = { id: client.id, name, score: 0, ws, isHost: true };
      room.players.set(client.id, player);
      room.turn.push(client.id);
      client.name = name; client.roomCode = code;
      console.log('[room] created', code, 'by', name);
      send(ws, { type: 'joined', payload: { code, id: client.id, snapshot: roomSnapshot(room) } });
      broadcast(room, { type: 'lobbyUpdate', payload: roomSnapshot(room) });
      return;
    }

    if (type === 'joinLobby') {
      const name = (payload?.name || '').trim().slice(0, 24) || 'Player';
      const code = (payload?.code || '').toUpperCase();
      const room = getRoom(code);
      if (!room) { send(ws, { type: 'error', payload: { message: 'Lobby introuvable.' } }); return; }
      const player = { id: client.id, name, score: 0, ws, isHost: false };
      room.players.set(client.id, player);
      room.turn.push(client.id);
      client.name = name; client.roomCode = code;
      console.log('[room] join', code, name);
      send(ws, { type: 'joined', payload: { code, id: client.id, snapshot: roomSnapshot(room) } });
      broadcast(room, { type: 'lobbyUpdate', payload: roomSnapshot(room) });
      return;
    }

    // After this point, require membership
    const room = getRoom(client.roomCode);
    if (!room) { send(ws, { type: 'error', payload: { message: 'Pas dans une salle.' } }); return; }

    if (type === 'startRound') {
      const p = room.players.get(client.id);
      if (!p) return;
      if (room.state === 'inRound') { send(ws, { type: 'error', payload: { message: 'Manche déjà en cours.' } }); return; }
      // Server-authoritative start: use current turn, ignore provided secret
      startServerRound(room);
      return;
    }

    if (type === 'newWord') {
      // Recorder can ask for a new word during recording (before audio sent)
      const cur = room.current;
      if (!cur || cur.recorderId !== client.id || cur.phase !== 'recording') return;
      const newW = pickRandomWord();
      cur.secretNorm = normalizeText(newW);
      cur.secretRaw = newW;
      console.log('[round] new word requested by recorder in room', room.code);
      // notify recorder only
      try { send(ws, { type: 'secret', payload: { word: newW } }); } catch (e) { console.error('[secret] send error', e); }
      return;
    }

    if (type === 'audio') {
      if (room.state !== 'inRound' || !room.current || room.current.recorderId !== client.id) return;
      const { data, mime } = payload || {};
      if (!data || typeof data !== 'string') return;
      room.current.audioBase64 = data; // keep last audio for replay
      room.current.audioMime = mime || 'audio/webm';
      console.log('[audio] received for room', room.code, 'size(base64)=', data.length);
      broadcast(room, { type: 'audio', payload: { fromId: client.id, mime: room.current.audioMime, base64: data } }, client.id);
      // Transition to guessing phase server-side
      clearTimers(room);
      startGuessPhase(room);
      return;
    }

    if (type === 'chat') {
      const text = (payload?.text || '').toString().slice(0, 200);
      if (!text) return;
      const player = room.players.get(client.id);
      const norm = normalizeText(text);
      broadcast(room, { type: 'chat', payload: { fromId: client.id, from: player?.name || '???', text } });
      if (room.state === 'inRound' && room.current) {
        const cur = room.current;
        // Recorder cannot "guess"; ignore correctness from recorder
        if (client.id === cur.recorderId) { return; }
        if (norm && closeEnough(text, cur.secretNorm)) {
          // Multi-guessers: mark as found, award points, notify, but do not end the round yet.
          if (!cur.found) { cur.found = new Set(); }
          const isNewWinner = !cur.found.has(client.id);
          if (isNewWinner) {
            cur.found.add(client.id);
            // Scoring: +1 for winner
            try { const w = room.players.get(client.id); if (w) w.score += 1; } catch {}
            // Recorder gets +1 on first correct only
            if (!cur.recorderAwarded) {
              try { const r = room.players.get(cur.recorderId); if (r) r.score += 1; } catch {}
              cur.recorderAwarded = true;
            }
            console.log('[round] correct (multi) room', room.code, 'winner', player?.name);
            // Notify clients of correct
            broadcast(room, { type: 'ding', payload: { winnerId: client.id } });
            broadcast(room, { type: 'correct', payload: { winnerId: client.id, winner: player?.name, answer: null } });
            // Update scores live
            broadcast(room, { type: 'scores', payload: { players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, score: p.score })) } });
            // If all guessers (everyone except recorder) have found, end round
            const totalGuessers = [...room.players.keys()].filter(id => id !== cur.recorderId).length;
            const winnersCount = [...cur.found].filter(id => id !== cur.recorderId).length;
            if (winnersCount >= totalGuessers) {
              clearTimers(room);
              finishRound(room, { winnerId: null, reason: 'all-found' });
            }
          }
        }
      }
      return;
    }

    if (type === 'endGame') {
      const p = room.players.get(client.id);
      if (!p || !p.isHost) { send(ws, { type: 'error', payload: { message: 'Seul l\'hôte peut terminer la partie.' } }); return; }
      clearTimers(room);
      room.state = 'ended';
      broadcast(room, { type: 'gameEnded', payload: { leaderboard: [...room.players.values()].map(pl => ({ id: pl.id, name: pl.name, score: pl.score })), history: roomSnapshot(room).history } });
      return;
    }

    if (type === 'restartParty') {
      const p = room.players.get(client.id);
      if (!p || !p.isHost) { send(ws, { type: 'error', payload: { message: 'Seul l\'hôte peut relancer.' } }); return; }
      clearTimers(room);
      // reset scores and history for new session
      for (const pl of room.players.values()) { pl.score = 0; }
      room.history = [];
      room.state = 'lobby';
      room.turnIndex = 0;
      room.party = null;
      broadcast(room, { type: 'lobbyUpdate', payload: roomSnapshot(room) });
      return;
    }

    if (type === 'getState') {
      send(ws, { type: 'state', payload: roomSnapshot(room) });
      return;
    }
  });

  ws.on('close', () => {
    const code = client.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    const wasRecorder = room.current && room.current.recorderId === client.id;
    room.players.delete(client.id);
    room.turn = room.turn.filter(id => id !== client.id);
    if (room.turnIndex >= room.turn.length) room.turnIndex = 0;
    console.log('[ws] disconnected', client.id, 'from', code);

    if (room.players.size === 0) {
      rooms.delete(code);
      console.log('[room] deleted empty', code);
      return;
    }

    // If a party is ongoing, mark leaver as having completed their rounds to avoid blocking completion
    try {
      if (room.party?.started) {
        room.party.played[client.id] = 2;
        console.log('[party] player left, marking completed rounds for', client.id);
      }
    } catch {}

    if (wasRecorder && room.state === 'inRound') {
      // Abort the round if recorder left
      clearTimers(room);
      room.state = 'lobby';
      room.current = null;
      broadcast(room, { type: 'roundAborted', payload: { reason: 'Le recorder a quitté.' } });
      scheduleNextRound(room);
    }

    broadcast(room, { type: 'lobbyUpdate', payload: roomSnapshot(room) });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
