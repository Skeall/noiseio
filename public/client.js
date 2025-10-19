function showWave(on) {
  try { els.wave.classList.toggle('hidden', !on); } catch {}
}

function plop() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); o.type = 'sine'; o.frequency.value = 520;
    const g = audioCtx.createGain(); g.gain.value = 0.18;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); setTimeout(() => o.stop(), 120);
  } catch {}
}

// Landing helpers
function getNickname() {
  try {
    const key = 'noiseio_nick';
    let nick = localStorage.getItem(key);
    if (!nick) {
      nick = prompt('Ton pseudo ?')?.trim() || 'Player';
      localStorage.setItem(key, nick);
    }
    return nick;
  } catch { return 'Player'; }
}

function stopAudioLoop(immediate = false) {
  loopStopRequested = true;
  if (immediate && loopAudioEl) {
    try { loopAudioEl.pause(); } catch {}
  }
  if (immediate) showWave(false);
}

function startAudioLoop() {
  if (!loopAudioSrc || !allowSound) return;
  loopStopRequested = false;
  const playOnce = () => {
    if (loopStopRequested) { showWave(false); return; }
    try { if (loopAudioEl) { loopAudioEl.onended = null; loopAudioEl = null; } } catch {}
    const a = new Audio(loopAudioSrc);
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';
    a.playsInline = true;
    loopAudioEl = a;
    showWave(true);
    a.onended = () => {
      if (loopStopRequested) { showWave(false); return; }
      setTimeout(() => { playOnce(); }, 2000);
    };
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => {
      // Autoplay blocked → show enable sound prompt
      try { els.enableSoundWrap.classList.remove('hidden'); } catch {}
      showWave(false);
    });
  };
  playOnce();
}

// Simple client for NOISE.IO MVP
// Includes debug logs to help diagnose issues quickly

const els = {
  roomInfo: document.getElementById('roomInfo'),
  statusBanner: document.getElementById('statusBanner'),
  home: document.getElementById('home'),
  playNowBtn: document.getElementById('playNowBtn'),
  auth: document.getElementById('auth'),
  lobby: document.getElementById('lobby'),
  round: document.getElementById('round'),
  ended: document.getElementById('ended'),
  nickname: document.getElementById('nickname'),
  createBtn: document.getElementById('createBtn'),
  joinCode: document.getElementById('joinCode'),
  joinBtn: document.getElementById('joinBtn'),
  roomCode: document.getElementById('roomCode'),
  players: document.getElementById('players'),
  secretInput: document.getElementById('secretInput'),
  startRoundBtn: document.getElementById('startRoundBtn'),
  endGameBtn: document.getElementById('endGameBtn'),
  recorderControls: document.getElementById('recorderControls'),
  startRecBtn: document.getElementById('startRecBtn'),
  stopRecBtn: document.getElementById('stopRecBtn'),
  timer: document.getElementById('timer'),
  timeBar: document.getElementById('timeBar'),
  turnLabel: document.getElementById('turnLabel'),
  recorderChip: document.getElementById('recorderChip'),
  recorderView: document.getElementById('recorderView'),
  secretWordDisplay: document.getElementById('secretWordDisplay'),
  recorderWait: document.getElementById('recorderWait'),
  waitingView: document.getElementById('waitingView'),
  waitingMsg: document.getElementById('waitingMsg'),
  guessView: document.getElementById('guessView'),
  chatLog: document.getElementById('chatLog'),
  chatInput: document.getElementById('chatInput'),
  sendChatBtn: document.getElementById('sendChatBtn'),
  chatRow: document.getElementById('chatRow'),
  scores: document.getElementById('scores'),
  replays: document.getElementById('replays'),
  finalBoard: document.getElementById('finalBoard'),
  finalReplays: document.getElementById('finalReplays'),
  newWordBtn: document.getElementById('newWordBtn'),
  newWordInRoundBtn: document.getElementById('newWordInRoundBtn'),
  bottomTabs: document.getElementById('bottomTabs'),
  tabChat: document.getElementById('tabChat'),
  tabScores: document.getElementById('tabScores'),
  panelChat: document.getElementById('panelChat'),
  panelScores: document.getElementById('panelScores'),
  restartBtn: document.getElementById('restartBtn'),
  enableSoundWrap: document.getElementById('enableSoundWrap'),
  enableSoundBtn: document.getElementById('enableSoundBtn'),
  wave: document.getElementById('wave'),
  leaderboardFull: document.getElementById('leaderboardFull'),
  podiumGoldName: document.getElementById('podiumGoldName'),
  podiumGoldScore: document.getElementById('podiumGoldScore'),
  podiumSilverName: document.getElementById('podiumSilverName'),
  podiumSilverScore: document.getElementById('podiumSilverScore'),
  podiumBronzeName: document.getElementById('podiumBronzeName'),
  podiumBronzeScore: document.getElementById('podiumBronzeScore'),
  openJoinBtn: document.getElementById('openJoinBtn'),
  joinRowHome: document.getElementById('joinRowHome'),
  joinCodeHome: document.getElementById('joinCodeHome'),
  joinGoBtn: document.getElementById('joinGoBtn'),
  copyCodeBtn: document.getElementById('copyCodeBtn'),
  leaveBtn: document.getElementById('leaveBtn'),
  launchBtn: document.getElementById('launchBtn'),
  waitingHostMsg: document.getElementById('waitingHostMsg'),
  echoBalance: document.getElementById('echoBalance'),
  echoBalanceHome: document.getElementById('echoBalanceHome'),
  changeAvatarBtn: document.getElementById('changeAvatarBtn'),
  avatarModal: document.getElementById('avatarModal'),
  closeAvatarBtn: document.getElementById('closeAvatarBtn'),
  avatarGrid: document.getElementById('avatarGrid'),
  openAvatarBtn: document.getElementById('openAvatarBtn'),
  avatarChipImg: document.getElementById('avatarChipImg'),
};

let ws;
let myId = null;
let roomCode = null;
let snapshot = null;
let isRecorder = false; // whether I am recorder for this round
let mediaRecorder = null;
let chunks = [];

// Avatars assets (from /public/assets/avatars)
const AVATAR_FILES = [
  'skin1.png','skin2.png','skin3.png','skin4.png','skin5.png','skin6.png','skin7.png','skin8.png','skin9.png','skin10.png','skin11.png','skin12.png','skin13.png','skin14.png','skin15.png','skin16.png',
  'skin 6.png' // fallback if alternate naming exists
];

function getAvatar() {
  try {
    const v = localStorage.getItem('noiseio_avatar');
    return v || null;
  } catch { return null; }
}

function setAvatar(file) {
  try { localStorage.setItem('noiseio_avatar', file); myAvatar = file; } catch {}
  try { updateRoomUI(snapshot || { players: [] }); } catch {}
  try { if (els.avatarChipImg) els.avatarChipImg.src = avatarUrl(file); } catch {}
}

function ensureAvatar() {
  myAvatar = getAvatar();
  if (!myAvatar) {
    const pool = AVATAR_FILES.filter(Boolean);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setAvatar(pick);
    console.log('[avatar] assigned random', pick);
  }
  try { if (els.avatarChipImg && myAvatar) els.avatarChipImg.src = avatarUrl(myAvatar); } catch {}
}

function avatarUrl(file) { return `/assets/avatars/${encodeURI(file)}`; }

function renderAvatarGrid() {
  if (!els.avatarGrid) return;
  els.avatarGrid.innerHTML = '';
  const current = myAvatar;
  AVATAR_FILES.forEach(f => {
    const wrap = document.createElement('div'); wrap.className = 'avatar-option';
    const btn = document.createElement('button');
    const img = document.createElement('img'); img.src = avatarUrl(f); img.alt = f;
    btn.appendChild(img);
    if (f === current) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      setAvatar(f);
      try { setStatusBanner('Avatar mis à jour', 'success'); } catch {}
      try { els.avatarModal.classList.add('hidden'); } catch {}
    });
    wrap.appendChild(btn);
    els.avatarGrid.appendChild(wrap);
  });
}

function openAvatarModal() { try { renderAvatarGrid(); els.avatarModal.classList.remove('hidden'); } catch {} }
function closeAvatarModal() { try { els.avatarModal.classList.add('hidden'); } catch {} }

// Échos (virtual currency)
function loadEchoBalance() {
  try { echoBalance = parseInt(localStorage.getItem('noiseio_echos') || '0', 10) || 0; } catch { echoBalance = 0; }
  try { if (els.echoBalance) els.echoBalance.textContent = String(echoBalance); } catch {}
  try { if (els.echoBalanceHome) els.echoBalanceHome.textContent = String(echoBalance); } catch {}
}
function saveEchoBalance() { try { localStorage.setItem('noiseio_echos', String(echoBalance)); } catch {} }
function addEchos(n, reason = '') {
  echoBalance = (echoBalance || 0) + (n || 0);
  saveEchoBalance();
  try { if (els.echoBalance) els.echoBalance.textContent = String(echoBalance); } catch {}
  try { if (els.echoBalanceHome) els.echoBalanceHome.textContent = String(echoBalance); } catch {}
  console.log('[echos] +%d %s → %d', n, reason, echoBalance);
  try { setStatusBanner(`+${n} Échos`, 'success'); setTimeout(clearStatusBanner, 1200); } catch {}
  vibrate(12);
}
let recTimer = null;
let audioCtx = null;
let chosenMime = '';
let roundTimer = null;
let roundStartAt = 0;
let msgCount = 0;
let lastCorrectAnswer = '';
let currentSecretNorm = null;
let guessTimer = null;
let guessStartAt = 0;
let activeTab = 'chat';
let touchStartY = null;
let allowSound = false;
let loopAudioSrc = null;
let loopAudioEl = null;
let loopStopRequested = false;
let currentReplayAudio = null;
let lastPlayersCount = 0;
let myAvatar = null;
let echoBalance = 0;

// Word list for random prompts (50)
const WORDS = [
  'chat','chien','vache','voiture','téléphone','porte','horloge','tambour','train','pluie',
  'aspirateur','hélicoptère','guitare','moto','oiseau','tonnerre','pizza','serpent','lion','bébé','marteau','râteau','sirène','robot','vent','réveil','cloche','singe','rire','machine à laver',
  'dinosaure','photocopieuse','parapluie','volcan','cheval','chevalier','toilette','feu d’artifice','baleine','viking','zèbre','marteau-piqueur','popcorn','four','monstre','feu de camp','aspirine','friteuse','alien','canard qui parle'
];

function normalizeTextLocal(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  a = normalizeTextLocal(a); b = normalizeTextLocal(b);
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (al === 0) return bl; if (bl === 0) return al;
  const dp = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) dp[j] = j;
  for (let i = 1; i <= al; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= bl; j++) {
      const temp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = temp;
    }
  }
  return dp[bl];
}

function pickRandomWord() {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  return w;
}

function pickMime() {
  try {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg'
    ];
    for (const m of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
    }
  } catch (_) {}
  return '';
}

function logMsg(text) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.textContent = text;
  els.chatLog.appendChild(div);
  // Alternate bubble color for readability
  if ((msgCount++ % 2) === 1) div.classList.add('alt');
  // Smooth scroll to latest
  try { els.chatLog.scrollTo({ top: els.chatLog.scrollHeight, behavior: 'smooth' }); }
  catch { els.chatLog.scrollTop = els.chatLog.scrollHeight; }
}

function ding(stronger = false) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const g = audioCtx.createGain();
    g.gain.value = stronger ? 0.35 : 0.22;
    g.connect(audioCtx.destination);
    const o1 = audioCtx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 880;
    const o2 = audioCtx.createOscillator(); o2.type = 'square'; o2.frequency.value = 1320;
    o1.connect(g); o2.connect(g);
    o1.start(); o2.start(audioCtx.currentTime + 0.05);
    setTimeout(() => { o1.stop(); o2.stop(); }, stronger ? 320 : 240);
  } catch (e) { console.warn('ding error', e); }
}

function vibrate(ms = 80) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch {} }

function setStatusBanner(text, kind = 'info') {
  const el = els.statusBanner;
  el.textContent = text || '';
  el.classList.remove('hidden', 'info', 'success', 'danger');
  el.classList.add(kind);
}

function clearStatusBanner() { els.statusBanner.classList.add('hidden'); }

function setTurnLabel(text) { els.turnLabel.textContent = text; }

function updateTimeUI(ms) {
  els.timer.textContent = formatTime(ms);
  const pct = Math.max(0, 1 - (ms / 30000));
  els.timeBar.style.width = `${(pct * 100).toFixed(1)}%`;
}

function startRoundTimer() {
  roundStartAt = Date.now();
  if (roundTimer) clearInterval(roundTimer);
  roundTimer = setInterval(() => {
    const elapsed = Date.now() - roundStartAt;
    updateTimeUI(elapsed);
    if (elapsed >= 30000) {
      // Visual time's up; gameplay remains server-driven
      document.body.classList.add('timeup');
      setStatusBanner("Time's up!", 'danger');
      vibrate(100);
      clearInterval(roundTimer); roundTimer = null;
    }
  }, 150);
  console.log('[ui] round timer started');
}

function stopRoundTimer() {
  if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
  els.timeBar.style.width = '100%';
  els.timer.textContent = '00:00';
  console.log('[ui] round timer stopped');
}

function show(section) {
  els.home?.classList.add('hidden');
  els.auth.classList.add('hidden');
  els.lobby.classList.add('hidden');
  els.round.classList.add('hidden');
  els.ended.classList.add('hidden');
  const target = (section || els.auth);
  target.classList.remove('hidden');
  try { target.classList.add('fade-in'); setTimeout(() => target.classList.remove('fade-in'), 300); } catch {}
  // Tabs visibility handled later when guess view is active for devineurs
  try { els.bottomTabs.classList.add('hidden'); } catch {}
  try { els.wave.classList.add('hidden'); } catch {}
}

function startGuessTimer() {
  stopGuessTimer();
  guessStartAt = Date.now();
  setStatusBanner('Devinez ! (20s)', 'info');
  guessTimer = setInterval(() => {
    const elapsed = Date.now() - guessStartAt;
    // reuse timer bar for 20s
    const remain = Math.max(0, 20000 - elapsed);
    els.timer.textContent = formatTime(20000 - remain);
    const pct = Math.max(0, 1 - (elapsed / 20000));
    els.timeBar.style.width = `${(pct * 100).toFixed(1)}%`;
    if (elapsed >= 20000) {
      clearInterval(guessTimer); guessTimer = null;
      setStatusBanner("Time's up!", 'danger');
      try { document.body.classList.add('timeup'); setTimeout(() => document.body.classList.remove('timeup'), 1000); } catch {}
    }
  }, 150);
  console.log('[ui] guess timer started');
}

function stopGuessTimer() {
  if (guessTimer) { clearInterval(guessTimer); guessTimer = null; }
}

function updateRoomUI(snap) {
  // players list (modern)
  try {
    const was = lastPlayersCount;
    els.players.innerHTML = '';
    snap.players.forEach(p => {
      const li = document.createElement('li');
      li.className = 'pop-in';
      let av;
      if (p.id === myId && myAvatar) {
        av = document.createElement('img'); av.className = 'avatar-img'; av.src = avatarUrl(myAvatar); av.alt = 'avatar';
      } else {
        av = document.createElement('div'); av.className = 'avatar'; av.style.background = colorForId(p.id);
        av.textContent = (p.name || '?').slice(0,1).toUpperCase();
      }
      const name = document.createElement('div'); name.className = 'name'; name.textContent = p.name;
      if (p.isHost) { const host = document.createElement('span'); host.className = 'host'; host.textContent = ' (hôte)'; name.appendChild(host); }
      const status = document.createElement('div'); status.className = 'status';
      li.appendChild(av);
      li.appendChild(name);
      li.appendChild(status);
      els.players.appendChild(li);
    });
    lastPlayersCount = snap.players.length;
    if (lastPlayersCount > was) { plop(); vibrate(8); }
  } catch {}

  // scores list
  els.scores.innerHTML = '';
  snap.players
    .slice()
    .sort((a,b) => b.score - a.score)
    .forEach(p => {
      const li = document.createElement('li');
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = colorForId(p.id);
      if (snap.current && p.id === snap.current.recorderId) li.classList.add('recorder');
      const mic = document.createElement('span'); mic.className = 'mic'; mic.textContent = (snap.current && p.id === snap.current.recorderId) ? '🎤' : '';
      const t = document.createElement('span'); t.textContent = `${p.name}: ${p.score}`;
      li.appendChild(dot); li.appendChild(t); li.appendChild(mic);
      els.scores.appendChild(li);
    });

  // replays
  const renderReplaysInto = (container) => {
    container.innerHTML = '';
    snap.history.forEach((h, i) => {
      if (!h.audioBase64) return; // skip if no audio
      const src = `data:${h.audioMime || 'audio/webm'};base64,${h.audioBase64}`;
      const word = (h.secret ?? h.word ?? h.secretRaw ?? h.secretNorm ?? '').toString().trim() || '—';
      if (word === '—') { try { console.warn('[replay] missing secret for history item', h); } catch {} }
      const winnerName = nameOf(h.winnerId);
      const missed = !h.winnerId;

      const card = document.createElement('div');
      card.className = 'replay-card';

      const wordEl = document.createElement('div');
      wordEl.className = 'replay-word';
      wordEl.textContent = `Mot: ${word}`;

      const meta = document.createElement('div');
      meta.className = 'replay-meta';
      meta.textContent = missed
        ? `🔊 par ${nameOf(h.recorderId)} — ❌ non trouvé`
        : `🔊 par ${nameOf(h.recorderId)} — trouvé par ${winnerName}`;

      const controls = document.createElement('div');
      controls.className = 'replay-controls';

      const btn = document.createElement('button');
      btn.className = 'play-btn';
      btn.textContent = '▶';
      btn.setAttribute('aria-label', 'Lecture');

      const prog = document.createElement('div');
      prog.className = 'progress';
      const progFill = document.createElement('div');
      prog.appendChild(progFill);

      const right = document.createElement('div');
      right.className = 'duration';
      right.textContent = '0:00';

      const bars = document.createElement('div');
      bars.className = 'bars';
      bars.innerHTML = '<span></span><span></span><span></span><span></span>';

      // Hidden audio element
      const audio = document.createElement('audio');
      audio.src = src;
      audio.preload = 'metadata';
      audio.style.display = 'none';

      audio.addEventListener('loadedmetadata', () => {
        try { right.textContent = formatTime(Math.round(audio.duration * 1000)); } catch {}
      });
      audio.addEventListener('timeupdate', () => {
        try {
          const dur = audio.duration || 0;
          const pct = dur ? (audio.currentTime / dur) * 100 : 0;
          progFill.style.width = `${pct.toFixed(1)}%`;
        } catch {}
      });
      audio.addEventListener('ended', () => {
        card.classList.remove('playing');
        btn.textContent = '▶';
        currentReplayAudio = null;
      });

      btn.addEventListener('click', () => {
        try {
          // Stop any currently playing replay
          if (currentReplayAudio && currentReplayAudio !== audio) {
            currentReplayAudio.pause();
            currentReplayAudio.dispatchEvent(new Event('ended'));
          }
          if (audio.paused) {
            audio.currentTime = 0;
            audio.play();
            currentReplayAudio = audio;
            card.classList.add('playing');
            btn.textContent = '⏸';
            vibrate(10);
          } else {
            audio.pause();
            card.classList.remove('playing');
            btn.textContent = '▶';
            currentReplayAudio = null;
          }
        } catch (e) { console.warn('replay play error', e); }
      });

      controls.appendChild(btn);
      controls.appendChild(prog);
      controls.appendChild(right);

      card.appendChild(wordEl);
      card.appendChild(meta);
      card.appendChild(controls);
      card.appendChild(bars);
      card.appendChild(audio);

      if (missed) card.classList.add('missed');
      container.appendChild(card);
    });
  };
  try { renderReplaysInto(els.replays); } catch {}
  try { renderReplaysInto(els.finalReplays); } catch {}

  // Recorder chip (round view)
  try {
    const recId = snap.current?.recorderId;
    if (recId) {
      const nm = nameOf(recId) || '—';
      els.recorderChip.textContent = `🎤 ${nm}`;
      els.recorderChip.classList.remove('hidden');
    } else {
      els.recorderChip.classList.add('hidden');
    }
  } catch {}

  // Lobby actions (host vs non-host)
  try {
    const me = snap.players.find(p => p.id === myId);
    const amHost = !!me?.isHost;
    const inLobby = snap.state === 'lobby';
    if (els.launchBtn) els.launchBtn.classList.toggle('hidden', !(amHost && inLobby));
    if (els.waitingHostMsg) els.waitingHostMsg.classList.toggle('hidden', amHost || !inLobby);
  } catch {}
}

function nameOf(id) {
  const p = snapshot?.players?.find(x => x.id === id);
  return p?.name || '';
}

function colorForId(id) {
  const palette = ['#ff8a65','#ffd166','#06d6a0','#4cc9f0','#a57bff','#ff6b6b','#f4a261','#2a9d8f','#90be6d','#f94144'];
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const host = location.hostname;
  const isLocal = (host === 'localhost' || host === '127.0.0.1');
  const targetHost = isLocal ? `${host}:3000` : location.host;
  const url = `${proto}://${targetHost}`;
  ws = new WebSocket(url);
  ws.addEventListener('open', () => {
    console.log('[ws] open', url);
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const { type, payload } = msg;
    // Debug log
    console.log('[ws] msg', type, payload);

    if (type === 'joined') {
      myId = payload.id;
      roomCode = payload.code;
      snapshot = payload.snapshot;
      els.roomCode.textContent = roomCode;
      els.roomInfo.textContent = `Lobby ${roomCode}`;
      // Init local profile
      ensureAvatar();
      loadEchoBalance();
      // Mild celebration animation each end
      try { confetti({ spread: 50, ticks: 160, origin: { y: 0.7 } }); } catch {}
      vibrate(40);
      show(els.lobby);
      updateRoomUI(snapshot);
      // Pop du mot quand le recorder reçoit le secret
      try { if (isRecorder) { els.secretWordDisplay.classList.add('pop'); setTimeout(() => els.secretWordDisplay.classList.remove('pop'), 400); } } catch {}
      return;
    }

    if (type === 'lobbyUpdate' || type === 'state') {
      snapshot = payload;
      updateRoomUI(snapshot);
      clearStatusBanner();
      return;
    }

    if (type === 'secret') {
      // Private message to recorder only
      if (!payload?.word) return;
      currentSecretNorm = normalizeTextLocal(payload.word);
      try { els.secretWordDisplay.textContent = payload.word; } catch {}
      try { els.recorderView.classList.remove('hidden'); } catch {}
      return;
    }

    if (type === 'roundStarted') {
      isRecorder = (payload.byId === myId);
      els.chatLog.innerHTML = '';
      show(els.round);
      if (isRecorder) {
        els.recorderControls.classList.remove('hidden');
        els.recorderView.classList.remove('hidden');
        els.waitingView.classList.add('hidden');
        // Recorder: chat totalement masqué pendant l'enregistrement
        els.guessView.classList.add('hidden');
        els.chatRow.classList.add('hidden');
        els.sendChatBtn.disabled = true;
        try { els.chatInput.disabled = true; } catch {}
        try { els.recorderWait.classList.add('hidden'); } catch {}
        try { els.startRecBtn.disabled = false; els.stopRecBtn.disabled = true; } catch {}
        document.body.classList.add('role-recorder');
        document.body.classList.remove('role-guesser');
      } else {
        els.recorderControls.classList.add('hidden');
        els.recorderView.classList.add('hidden');
        els.waitingView.classList.remove('hidden');
        try { els.waitingMsg.textContent = `🎤 Attends quelques secondes pendant que ${payload.byName} bruit son mot mystère…`; } catch {}
        els.guessView.classList.add('hidden');
        document.body.classList.add('role-guesser');
        document.body.classList.remove('role-recorder');
      }
      try { document.body.classList.remove('timeup'); } catch {}
      stopAudioLoop(true);
      // Update local snapshot to highlight recorder immediately
      if (!snapshot) snapshot = {};
      snapshot.current = { recorderId: payload.byId };
      lastCorrectAnswer = '';
      const roundLabel = (payload.round && payload.total) ? ` · Manche ${payload.round}/${payload.total}` : '';
      setTurnLabel((isRecorder ? 'Votre tour 🎤' : `C'est au tour de ${payload.byName} 🎤`) + roundLabel + (isRecorder ? '' : ' — Devinez !'));
      setStatusBanner('Manche en cours', 'info');
      // Default to chat tab for guessing
      setActiveTab('chat');
      // Do not start timer yet; wait for recording to begin
      els.sendChatBtn.disabled = !els.chatInput.value.trim();
      logMsg(`Manche lancée par ${payload.byName}`);
      return;
    }

    if (type === 'audio') {
      // Another client recorded; we could auto play or just provide replay
      const who = nameOf(payload.fromId) || 'Recorder';
      logMsg(`Audio reçu de ${who}`);
      const src = `data:${payload.mime || 'audio/webm'};base64,${payload.base64}`;
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = src;
      els.chatLog.appendChild(audio);
      // Start 20s guess phase for receivers (recorder won't get this event)
      if (!isRecorder) {
        try { els.waitingView.classList.add('hidden'); els.guessView.classList.remove('hidden'); els.bottomTabs.classList.remove('hidden'); } catch {}
        if (!guessTimer) startGuessTimer();
        // Enable input for guessers
        try { els.chatRow.classList.remove('hidden'); els.chatInput.disabled = false; els.sendChatBtn.disabled = !els.chatInput.value.trim(); } catch {}
        // Prepare audio loop
        loopAudioSrc = src;
        if (!allowSound) { try { els.enableSoundWrap.classList.remove('hidden'); } catch {} }
        else { startAudioLoop(); }
      }
      return;
    }

    if (type === 'chat') {
      logMsg(`${payload.from}: ${payload.text}`);
      // Recorder-only fuzzy hint if guess is very close (client-side guidance only)
      if (isRecorder && currentSecretNorm) {
        const d = levenshtein(payload.text, currentSecretNorm);
        if (d > 0 && d <= 2) {
          logMsg(`🤏 Presque pour ${payload.from}`);
          vibrate(20);
        }
      }
      return;
    }

    if (type === 'ding') {
      ding(true);
      // Do not stop audio here; 'correct' will decide per-client
      return;
    }

    if (type === 'correct') {
      logMsg(`✅ ${payload.winner} a trouvé ! Réponse: ${payload.answer}`);
      lastCorrectAnswer = payload.answer || '';
      try { confetti({ spread: 70, ticks: 200, origin: { y: 0.6 } }); } catch {}
      if (payload.winnerId === myId) {
        document.body.classList.add('flash'); vibrate(120); setTimeout(() => document.body.classList.remove('flash'), 700);
        addEchos(3, 'correct');
        // Winner: stop local guessing
        stopAudioLoop(true);
        stopGuessTimer();
        try { els.chatInput.disabled = true; els.sendChatBtn.disabled = true; } catch {}
      }
      setStatusBanner(`${payload.winner} a trouvé !`, 'success');
      // Non-winners continue to guess; keep timer/audio running
      return;
    }

    if (type === 'scores') {
      // Refresh scores from payload
      snapshot.players = payload.players;
      updateRoomUI(snapshot);
      return;
    }

    if (type === 'roundEnded') {
      logMsg('Manche terminée.');
      snapshot.history = payload.history || snapshot.history;
      // Clear current recorder highlight locally
      if (snapshot) snapshot.current = null;
      // Decide banner message by reason
      const reason = payload?.reason || '';
      if (reason === 'guessing-timeout' || reason === 'recording-timeout') {
        setStatusBanner("Time's up!", 'danger');
      } else if (lastCorrectAnswer) {
        const last = snapshot.history && snapshot.history[snapshot.history.length - 1];
        const winnerName = last ? nameOf(last.winnerId) : '';
        setStatusBanner(`Manche terminée — Gagnant: ${winnerName || '—'} · Mot: ${lastCorrectAnswer}`, 'success');
      } else {
        setStatusBanner('Manche terminée', 'success');
      }
      stopRoundTimer();
      stopGuessTimer();
      // On timeout, stop scheduling but let current loop end naturally
      stopAudioLoop(false);
      try { document.body.classList.remove('role-recorder'); document.body.classList.remove('role-guesser'); } catch {}
      show(els.lobby);
      updateRoomUI(snapshot);
      return;
    }

    if (type === 'roundAborted') {
      logMsg('⚠️ Manche annulée: ' + payload.reason);
      show(els.lobby);
      return;
    }

    if (type === 'gameEnded') {
      // Render leaderboard
      const arr = payload.leaderboard.slice().sort((a,b) => b.score - a.score);
      const [g, s, b3] = [arr[0], arr[1], arr[2]];
      try {
        const pod = document.getElementById('podium');
        if (pod) { pod.classList.remove('cols-1','cols-2'); if (arr.length === 1) pod.classList.add('cols-1'); else if (arr.length === 2) pod.classList.add('cols-2'); }
        if (g) { els.podiumGoldName.textContent = g.name; els.podiumGoldScore.textContent = g.score; }
        if (s) { els.podiumSilverName.textContent = s.name; els.podiumSilverScore.textContent = s.score; }
        if (b3) { els.podiumBronzeName.textContent = b3.name; els.podiumBronzeScore.textContent = b3.score; }
        // Hide places if missing
        document.querySelector('.podium .silver')?.classList.toggle('hidden', !s);
        document.querySelector('.podium .bronze')?.classList.toggle('hidden', !b3);
      } catch {}

      // Full leaderboard beyond top 3
      try {
        els.leaderboardFull.innerHTML = '';
        arr.forEach((p, i) => {
          const li = document.createElement('li');
          li.innerHTML = `<span>${i+1}. ${p.name}</span><span>${p.score}</span>`;
          els.leaderboardFull.appendChild(li);
        });
      } catch {}

      // Échos awards (client-only)
      try {
        addEchos(5, 'participation');
        const top = payload.leaderboard && payload.leaderboard[0];
        if (top && top.id === myId) addEchos(10, 'winner');
      } catch {}

      // replays
      snapshot.history = payload.history || snapshot.history;
      updateRoomUI(snapshot);
      try { document.body.classList.remove('timeup'); } catch {}
      setStatusBanner('Fin de partie !', 'info');
      stopRoundTimer();
      if (snapshot) snapshot.current = null;
      // Slower celebratory transition to end screen
      setTimeout(() => { show(els.ended); try { confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); } catch {} }, 900);
      return;
    }

    if (type === 'error') {
      alert(payload.message || 'Erreur.');
      return;
    }
  });
  ws.addEventListener('close', () => {
    console.log('[ws] close');
  });
}

function send(type, payload) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, payload }));
}

// UI wires
els.createBtn.addEventListener('click', () => {
  const name = els.nickname.value.trim() || 'Player';
  if (!ws || ws.readyState !== WebSocket.OPEN) connectWS();
  setTimeout(() => send('createLobby', { name }), 50);
});

els.joinBtn.addEventListener('click', () => {
  const name = els.nickname.value.trim() || 'Player';
  const code = (els.joinCode.value || '').trim().toUpperCase();
  if (!code) return alert('Entrez un code.');
  if (!ws || ws.readyState !== WebSocket.OPEN) connectWS();
  setTimeout(() => send('joinLobby', { code, name }), 50);
});

// Landing actions
try {
  els.playNowBtn.addEventListener('click', () => {
    const name = getNickname();
    if (!ws || ws.readyState !== WebSocket.OPEN) connectWS();
    setTimeout(() => send('createLobby', { name }), 60);
    vibrate(15);
  });
} catch {}

try {
  els.openJoinBtn.addEventListener('click', () => {
    els.joinRowHome?.classList.remove('hidden');
    try { els.joinCodeHome.focus(); } catch {}
    vibrate(10);
  });
} catch {}

try {
  const doJoin = () => {
    const code = (els.joinCodeHome.value || '').trim().toUpperCase();
    if (!code) return;
    const name = getNickname();
    if (!ws || ws.readyState !== WebSocket.OPEN) connectWS();
    setTimeout(() => send('joinLobby', { code, name }), 60);
    vibrate(12);
  };
  els.joinGoBtn.addEventListener('click', doJoin);
  els.joinCodeHome.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doJoin(); } });
} catch {}

// Restart party (host only)
try {
  els.restartBtn.addEventListener('click', () => {
    vibrate(18);
    setStatusBanner('Nouvelle partie !', 'info');
    send('restartParty', {});
    show(els.lobby);
  });
} catch {}

// Avatar modal wiring
try { els.openAvatarBtn.addEventListener('click', () => { openAvatarModal(); vibrate(8); }); } catch {}
try { els.closeAvatarBtn.addEventListener('click', closeAvatarModal); } catch {}
try { els.avatarModal.addEventListener('click', (e) => { if (e.target === els.avatarModal) closeAvatarModal(); }); } catch {}

// Lobby actions
try { els.copyCodeBtn.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(roomCode || ''); setStatusBanner('✅ Copié !','success'); setTimeout(clearStatusBanner, 1200); vibrate(10); } catch {}
}); } catch {}

try { els.leaveBtn.addEventListener('click', () => { try { ws?.close(); } catch {}; location.reload(); }); } catch {}

try { els.launchBtn.addEventListener('click', () => { send('startRound', {}); vibrate(20); }); } catch {}

// Enable sound
try { els.enableSoundBtn.addEventListener('click', () => { allowSound = true; els.enableSoundWrap.classList.add('hidden'); if (loopAudioSrc) startAudioLoop(); vibrate(15); }); } catch {}

try { els.startRoundBtn.addEventListener('click', () => {
  // Server now picks the secret word and sends it privately
  currentSecretNorm = null;
  send('startRound', {});
}); } catch {}

try {
  els.endGameBtn.addEventListener('click', () => { send('endGame', {}); });
} catch {}

els.sendChatBtn.addEventListener('click', () => {
  if (isRecorder) return; // recorder cannot participate in chat
  const text = els.chatInput.value.trim();
  if (!text) return;
  els.chatInput.value = '';
  els.sendChatBtn.disabled = true;
  send('chat', { text });
});

els.chatInput.addEventListener('input', () => {
  els.sendChatBtn.disabled = !els.chatInput.value.trim();
});

els.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); els.sendChatBtn.click(); }
});

// Keyboard-safe behavior: keep chat row visible when focusing input
try {
  els.chatInput.addEventListener('focus', () => {
    setTimeout(() => {
      try { els.chatRow.scrollIntoView({ block: 'end', behavior: 'smooth' }); } catch {}
      try { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } catch {}
    }, 80);
  });
} catch {}

// Swipe up to send gesture
try {
  const area = els.chatRow;
  area.addEventListener('touchstart', (e) => { touchStartY = e.touches?.[0]?.clientY ?? null; });
  area.addEventListener('touchend', (e) => {
    if (touchStartY == null) return;
    const endY = e.changedTouches?.[0]?.clientY ?? touchStartY;
    const dy = touchStartY - endY;
    touchStartY = null;
    if (dy > 60 && els.chatInput.value.trim()) { vibrate(20); els.sendChatBtn.click(); }
  });
} catch {}

// Tabs toggling
function setActiveTab(tab) {
  activeTab = tab;
  const chatActive = tab === 'chat';
  try {
    els.tabChat.classList.toggle('active', chatActive);
    els.tabScores.classList.toggle('active', !chatActive);
    els.panelChat.classList.toggle('active', chatActive);
    els.panelScores.classList.toggle('active', !chatActive);
  } catch {}
}
try { els.tabChat.addEventListener('click', () => setActiveTab('chat')); } catch {}
try { els.tabScores.addEventListener('click', () => setActiveTab('scores')); } catch {}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}

async function startRecording() {
  try {
    console.log('[rec] requesting microphone...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('[rec] microphone granted');
    chunks = [];
    chosenMime = pickMime();
    const opts = chosenMime ? { mimeType: chosenMime } : undefined;
    mediaRecorder = new MediaRecorder(stream, opts);
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      console.log('[rec] onstop, assembling blob');
      const blob = new Blob(chunks, { type: chosenMime || 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result; // data:...;base64,XXXX
        const idx = dataUrl.indexOf(',');
        const base64 = dataUrl.slice(idx + 1);
        const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
        console.log('[rec] sending audio to server, mime=', mime, 'size=', base64?.length || 0);
        send('audio', { data: base64, mime });
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorder.start();
    console.log('[rec] started');
    vibrate(30);
    showWave(true);
    try { els.secretWordDisplay.classList.add('pop'); setTimeout(() => els.secretWordDisplay.classList.remove('pop'), 380); } catch {}

    els.startRecBtn.disabled = true;
    els.stopRecBtn.disabled = false;

    const startAt = Date.now();
    recTimer = setInterval(() => {
      const elapsed = Date.now() - startAt;
      els.timer.textContent = formatTime(elapsed);
      const pct = Math.max(0, 1 - (elapsed / 5000));
      els.timeBar.style.width = `${(pct * 100).toFixed(1)}%`;
      if (elapsed >= 5000) stopRecording();
    }, 150);
    setStatusBanner('Enregistrement (5s max)', 'info');
  } catch (e) {
    console.error('record error', e);
    setStatusBanner('Micro bloqué ou indisponible', 'danger');
    alert('Impossible d\'accéder au micro. Vérifiez les autorisations navigateur.');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  if (recTimer) { clearInterval(recTimer); recTimer = null; }
  els.timeBar.style.width = '100%';
  els.startRecBtn.disabled = true; // pas de 2e chance
  els.stopRecBtn.disabled = true;
  console.log('[rec] stopped');
  vibrate(50);
  showWave(false);
  // Start 20s guess phase locally (recorder won't receive audio echo)
  if (isRecorder) startGuessTimer();
  // Recorder UI: show waiting for guessers and hide controls
  try { if (isRecorder) { els.recorderWait.classList.remove('hidden'); els.recorderControls.classList.add('hidden'); } } catch {}
}

els.startRecBtn.addEventListener('click', () => {
  try { console.log('[ui] startRecBtn clicked'); } catch {}
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatusBanner('Enregistrement non supporté (getUserMedia indisponible)', 'danger');
    alert('Votre navigateur ne permet pas l\'accès au micro. Essayez Chrome/Edge/Firefox/Safari récent.');
    return;
  }
  if (!window.MediaRecorder) {
    setStatusBanner('Enregistrement non supporté (MediaRecorder indisponible)', 'danger');
    alert('Votre navigateur ne supporte pas MediaRecorder. Essayez un navigateur plus récent.');
    return;
  }
  startRecording();
});
els.stopRecBtn.addEventListener('click', stopRecording);

// Initial: ensure local profile and echoes visible on home menu
try { ensureAvatar(); } catch {}
try { loadEchoBalance(); } catch {}
// Show home (or auth if older flow)
show(els.home || els.auth);
try { els.startRoundBtn.disabled = true; } catch {}
try {
  els.secretInput.addEventListener('input', () => {
    els.startRoundBtn.disabled = !els.secretInput.value.trim();
  });
} catch {}

// Random word button (only next recorder should use it, UI gate below)
try { els.newWordBtn.addEventListener('click', () => { send('newWord', {}); }); } catch {}
try { els.newWordInRoundBtn.addEventListener('click', () => { send('newWord', {}); }); } catch {}

