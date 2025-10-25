function showWave(on) {
  try { els.wave.classList.toggle('hidden', !on); } catch {}
}

// Robust send that waits for WS to be open before sending
function sendWhenReady(type, payload) {
  if (ws?.readyState === WebSocket.OPEN) { send(type, payload); return; }
  if (!ws || ws.readyState === WebSocket.CLOSED) { connectWS(); }
  try {
    const onOpen = () => { try { ws.removeEventListener('open', onOpen); } catch {}; send(type, payload); };
    ws.addEventListener('open', onOpen, { once: true });
  } catch { setTimeout(() => send(type, payload), 120); }
}

let lobbyMsgCount = 0; // independent counter for lobby chat to avoid TDZ on msgCount
function logLobbyMsg(text) {
  if (!els.chatLogLobby) return;
  const div = document.createElement('div');
  div.className = 'msg';
  div.textContent = text;
  els.chatLogLobby.appendChild(div);
  if ((lobbyMsgCount++ % 2) === 1) div.classList.add('alt');
  try { els.chatLogLobby.scrollTo({ top: els.chatLogLobby.scrollHeight, behavior: 'smooth' }); }
  catch { els.chatLogLobby.scrollTop = els.chatLogLobby.scrollHeight; }
}

// Subtle tick (last 5s)
function playTick() { /* disabled per UX */ }

// Gentle time-up cue
function playTimeUp() {
  try {
    if (!allowSound) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const g = audioCtx.createGain(); g.gain.value = 0.25; g.connect(audioCtx.destination);
    const o = audioCtx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(440, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.25);
    o.connect(g); o.start(); setTimeout(() => { try { o.stop(); } catch {} }, 260);
  } catch {}
}

function getTimerWrap() {
  try { return els.timer.closest('.timer-wrap'); } catch { return null; }
}

function setTimerClasses(remainMs) {
  const wrap = getTimerWrap(); if (!wrap) return;
  const sec = Math.ceil(remainMs / 1000);
  wrap.classList.remove('ok','warn','danger','focus');
  if (sec > 10) wrap.classList.add('ok');
  else if (sec > 5) { wrap.classList.add('warn'); }
  else { wrap.classList.add('danger'); }
  try {
    els.timerBadge.classList.remove('warn','danger');
    if (sec <= 5) els.timerBadge.classList.add('danger');
    else if (sec <= 10) els.timerBadge.classList.add('warn');
    if (els.guesserTimerBadge) {
      els.guesserTimerBadge.classList.remove('warn','danger');
      if (sec <= 5) els.guesserTimerBadge.classList.add('danger');
      else if (sec <= 10) els.guesserTimerBadge.classList.add('warn');
    }
  } catch {}
  // Blink in last 5s
  try {
    if (sec <= 5) els.timer.classList.add('blink'); else els.timer.classList.remove('blink');
  } catch {}
  // Card beat last 5s
  try {
    const card = document.querySelector('#round .card.narrow');
    if (card) { card.classList.remove('card-beat'); }
  } catch {}
}

function updateChronoUI(elapsed, total) {
  const remain = Math.max(0, total - elapsed);
  els.timer.textContent = formatTime(remain);
  try {
    els.timerBadge.textContent = formatTime(remain);
    if (els.guesserTimerBadge) els.guesserTimerBadge.textContent = formatTime(remain);
    if (els.roundTimer) els.roundTimer.textContent = formatTime(remain);
    if (els.guessRoundTimer) els.guessRoundTimer.textContent = formatTime(remain);
  } catch {}
  const pct = Math.max(0, 1 - (elapsed / total));
  els.timeBar.style.width = `${(pct * 100).toFixed(1)}%`;
  setTimerClasses(remain);
  const s = Math.ceil(remain / 1000);
  if (s !== chronoLastSec) {
    chronoLastSec = s;
    // No pulse/halo on the bar to avoid perceived pulsing
    if (s <= 5 && s > 0) { playTick(); /* vibration removed per UX */ }
  }
}

function startChrono(totalMs) {
  try { clearInterval(chronoTimer); } catch {}
  chronoTotalMs = totalMs; chronoStartAt = Date.now(); chronoLastSec = null; tickingActive = true;
  updateChronoUI(0, chronoTotalMs);
  try {
    if (!isRecorder) { els.timerBadge.classList.remove('hidden','warn','danger'); }
    else { els.timerBadge.classList.add('hidden'); }
    if (els.guesserTimer) els.guesserTimer.classList.remove('hidden');
    if (els.guesserTimerBadge) els.guesserTimerBadge.classList.remove('warn','danger');
  } catch {}
  chronoTimer = setInterval(() => {
    const elapsed = Date.now() - chronoStartAt;
    updateChronoUI(elapsed, chronoTotalMs);
    if (elapsed >= chronoTotalMs) {
      clearInterval(chronoTimer); chronoTimer = null; tickingActive = false;
      playTimeUp(); try { document.body.classList.add('timeup'); setTimeout(() => document.body.classList.remove('timeup'), 800); } catch {}
    }
  }, 120);
  console.log('[ui] chrono started', totalMs);
}

function stopChrono() {
  if (chronoTimer) { clearInterval(chronoTimer); chronoTimer = null; }
  tickingActive = false; chronoTotalMs = 0; chronoStartAt = 0; chronoLastSec = null;
  try { els.timer.classList.remove('pulse','blink'); } catch {}
  // Ensure pulse class is not used anymore
  try { els.timer.classList.remove('pulse'); } catch {}
  try { const wrap = getTimerWrap(); if (wrap) wrap.classList.remove('ok','warn','danger','focus','halo'); } catch {}
  try {
    els.timerBadge.classList.add('hidden'); els.timerBadge.classList.remove('warn','danger');
    if (els.guesserTimer) els.guesserTimer.classList.add('hidden');
    if (els.guesserTimerBadge) els.guesserTimerBadge.classList.remove('warn','danger');
  } catch {}
  console.log('[ui] chrono stopped');
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
  try {
    const isRec = document.body.classList.contains('role-recorder');
    const isGuess = document.body.classList.contains('role-guesser');
    if (isRec || isGuess) {
      music.fadeTo(isRec ? 0.0 : 0.1, 800);
    } else {
      music.restore(800);
    }
  } catch {}
}

// Attempt to unlock autoplay on first user gesture and retry playback
function setupAutoplayUnlock() {
  const tryResume = () => {
    try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch {}
    document.removeEventListener('pointerdown', tryResume);
    document.removeEventListener('touchstart', tryResume);
    document.removeEventListener('click', tryResume);
    document.removeEventListener('keydown', tryResume);
    console.log('[audio] autoplay unlocked by user gesture → retry');
    try { startAudioLoop(); } catch {}
  };
  document.addEventListener('pointerdown', tryResume, { once: true });
  document.addEventListener('touchstart', tryResume, { once: true });
  document.addEventListener('click', tryResume, { once: true });
  document.addEventListener('keydown', tryResume, { once: true });
}

function startAudioLoop() {
  if (!loopAudioSrc) return;
  loopStopRequested = false;
  const playOnce = () => {
    if (loopStopRequested) { showWave(false); return; }
    try { if (loopAudioEl) { loopAudioEl.onended = null; loopAudioEl = null; } } catch {}
    const a = new Audio(loopAudioSrc);
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';
    a.playsInline = true;
    try { a.muted = false; a.volume = 1.0; } catch {}
    loopAudioEl = a;
    showWave(true);
    a.onended = () => {
      if (loopStopRequested) { showWave(false); return; }
      try {
        const isRec = document.body.classList.contains('role-recorder');
        music.fadeTo(isRec ? 0.0 : 0.1, 1000);
      } catch {}
      setTimeout(playOnce, 2000);
    };
    try { music.duckTo(0.1, 400); } catch {}
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        console.log('[audio] autoplay blocked, installing unlock handler');
        setupAutoplayUnlock();
        try { els.enableSoundWrap?.classList.remove('hidden'); } catch {}
        showWave(false);
      });
    } else {
      try { els.enableSoundWrap?.classList.add('hidden'); } catch {}
    }
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
  shop: document.getElementById('shop'),
  nickname: document.getElementById('nickname'),
  nickHint: document.getElementById('nickHint'),
  createBtn: document.getElementById('createBtn'),
  joinCode: document.getElementById('joinCode'),
  joinBtn: document.getElementById('joinBtn'),
  createGame: document.getElementById('createGame'),
  joinSubmit: document.getElementById('joinSubmit'),
  roomCode: document.getElementById('roomCode'),
  players: document.getElementById('players'),
  playerList: document.getElementById('playerList'),
  secretInput: document.getElementById('secretInput'),
  startRoundBtn: document.getElementById('startRoundBtn'),
  endGameBtn: document.getElementById('endGameBtn'),
  recorderControls: document.getElementById('recorderControls'),
  startRecBtn: document.getElementById('startRecBtn'),
  stopRecBtn: document.getElementById('stopRecBtn'),
  timer: document.getElementById('timer'),
  timeBar: document.getElementById('timeBar'),
  timerBadge: document.getElementById('timerBadge'),
  guesserTimer: document.getElementById('guesserTimer'),
  guesserTimerBadge: document.getElementById('guesserTimerBadge'),
  turnLabel: document.getElementById('turnLabel'),
  recorderChip: document.getElementById('recorderChip'),
  recorderView: document.getElementById('recorderView'),
  secretWordDisplay: document.getElementById('secretWordDisplay'),
  recorderWait: document.getElementById('recorderWait'),
  // SoundMaker UX refresh
  recBanner: document.getElementById('recBanner'),
  yourTurnTitle: document.getElementById('yourTurnTitle'),
  wordCard: document.getElementById('wordCard'),
  wordImage: document.getElementById('wordImage'),
  wordTitle: document.getElementById('wordTitle'),
  newWord: document.getElementById('newWord'),
  recordButton: document.getElementById('recordButton'),
  roundTimer: document.getElementById('roundTimer'),
  guessesArea: document.getElementById('guessesArea'),
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
  // Lobby tabs
  tabPlayers: document.getElementById('tabPlayers'),
  tabMessages: document.getElementById('tabMessages'),
  panelPlayers: document.getElementById('panelPlayers'),
  panelMessages: document.getElementById('panelMessages'),
  tabsPill: document.querySelector('#lobby .tabs-pill'),
  // Lobby chat
  chatLogLobby: document.getElementById('chatLogLobby'),
  chatInputLobby: document.getElementById('chatInputLobby'),
  sendMessageLobby: document.getElementById('sendMessageLobby'),
  emojiBarLobby: document.getElementById('emojiBarLobby'),
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
  // Home avatar (UX refresh)
  homeAvatarBtn: document.getElementById('homeAvatarBtn'),
  homeAvatarImg: document.getElementById('homeAvatarImg'),
  backHomeBtn: document.getElementById('backHomeBtn'),
  openJoinBtn: document.getElementById('openJoinBtn'),
  joinRowHome: document.getElementById('joinRowHome'),
  joinCodeHome: document.getElementById('joinCodeHome'),
  joinGoBtn: document.getElementById('joinGoBtn'),
  copyCodeBtn: document.getElementById('copyCodeBtn'),
  leaveBtn: document.getElementById('leaveBtn'),
  launchBtn: document.getElementById('launchBtn'),
  startGame: document.getElementById('startGame'),
  waitingHostMsg: document.getElementById('waitingHostMsg'),
  echoBalance: document.getElementById('echoBalance'),
  echoBalanceHome: document.getElementById('echoBalanceHome'),
  changeAvatarBtn: document.getElementById('changeAvatarBtn'),
  avatarModal: document.getElementById('avatarModal'),
  closeAvatarBtn: document.getElementById('closeAvatarBtn'),
  avatarGrid: document.getElementById('avatarGrid'),
  openAvatarBtn: document.getElementById('openAvatarBtn'),
  avatarChipImg: document.getElementById('avatarChipImg'),
  greetName: document.getElementById('greetName'),
  recorderBubbles: document.getElementById('recorderBubbles'),
  bubblesLayer: document.getElementById('bubblesLayer'),
  winnerToast: document.getElementById('winnerToast'),
  // Music controls
  musicCtrl: document.getElementById('musicCtrl'),
  musicMuteBtn: document.getElementById('musicMuteBtn'),
  musicBtn: document.getElementById('musicBtn'),
  musicPanel: document.getElementById('musicPanel'),
  musicSlider: document.getElementById('musicSlider'),
  musicValue: document.getElementById('musicValue'),
  // Transition overlay
  transitionOverlay: document.getElementById('transitionOverlay'),
  trTitle: document.getElementById('trTitle'),
  trWordImage: document.getElementById('trWordImage'),
  trWordText: document.getElementById('trWordText'),
  trResultsList: document.getElementById('trResultsList'),
  trCountdown: document.getElementById('trCountdown'),
  trCountdownValue: document.getElementById('trCountdownValue'),
  // Shop UI
  openShopBtn: document.getElementById('openShopBtn'),
  shopBackBtn: document.getElementById('shopBackBtn'),
  shopGrid: document.getElementById('shopGrid'),
  shopTimer: document.getElementById('shopTimer'),
  openChestBtn: document.getElementById('openChestBtn'),
  chestStatus: document.getElementById('chestStatus'),
};

let ws;
let myId = null;
let roomCode = null;
let snapshot = null;
let isRecorder = false; // whether I am recorder for this round
let recorderIdExpected = null; // recorder id announced at round start
let receivedSecretThisRound = false; // guard against stale recorder state
let mediaRecorder = null;
let chunks = [];
let trInterval = null; // transition countdown interval

// Avatars assets (from /public/assets/avatars)
const AVATAR_FILES = [
  'skin1.jpg','skin2.jpg','skin3.jpg','skin4.jpg','skin5.jpg','skin6.jpg','skin7.jpg','skin8.jpg','skin9.jpg','skin10.jpg'
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
  try { if (els.homeAvatarImg) els.homeAvatarImg.src = avatarUrl(file); } catch {}
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
  try { if (els.homeAvatarImg && myAvatar) els.homeAvatarImg.src = avatarUrl(myAvatar); } catch {}
}

function avatarUrl(file) { return `/assets/avatars/${encodeURI(file)}`; }

// End-screen confetti utilities
function startEndConfettiLoop() {
  try { if (endConfettiTo) { clearInterval(endConfettiTo); endConfettiTo = null; } } catch {}
  endConfettiTo = setInterval(() => {
    try { confetti({ particleCount: 60, spread: 60, ticks: 220, origin: { y: 0.15 } }); } catch {}
  }, 1800);
}
function stopEndConfettiLoop() {
  try { if (endConfettiTo) { clearInterval(endConfettiTo); endConfettiTo = null; } } catch {}
}

// Transition overlay utilities
function hideTransitionOverlay() {
  try { if (trInterval) { clearInterval(trInterval); trInterval = null; } } catch {}
  try { if (els.transitionOverlay) els.transitionOverlay.classList.add('hidden'); } catch {}
  try { if (els.trResultsList) els.trResultsList.innerHTML = ''; } catch {}
  try { document.body.classList.remove('overlay-bg'); } catch {}
  try { if (revealAudioEl) { revealAudioEl.pause(); revealAudioEl = null; } } catch {}
  // Restore contextual background volume after overlay
  try {
    const isRec = document.body.classList.contains('role-recorder');
    const isGuess = document.body.classList.contains('role-guesser');
    if (isRec) music.fadeTo(0.0, 800);
    else if (isGuess) music.fadeTo(0.1, 800);
    else music.restore(800);
  } catch {}
}

function showTransitionOverlay(roundResult, seconds = 5) {
  if (!els.transitionOverlay) return;
  try { document.body.classList.add('overlay-bg'); } catch {}
  // Populate title and word card
  let word = (roundResult?.secret || '').toString();
  if (!word) {
    try { const last = (snapshot?.history || [])[snapshot.history.length - 1]; if (last?.word || last?.secretRaw) word = (last.word || last.secretRaw || '').toString(); } catch {}
  }
  const wordUpper = word.toUpperCase();
  try { if (els.trTitle) els.trTitle.textContent = wordUpper; } catch {}
  try { if (els.trWordText) els.trWordText.textContent = wordUpper; } catch {}
  try {
    let src = (roundResult?.image || '').toString();
    if (!src && word) {
      const slug = word.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
      src = `/assets/imagemot/${slug}.jpg`;
    }
    if (els.trWordImage) {
      const img = els.trWordImage;
      img.onerror = () => {
        try {
          const slug = word.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
          const fallback = `/assets/imagemot/${slug}.jpg`;
          if (img.src !== location.origin + fallback) { img.onerror = null; img.src = fallback; }
        } catch {}
      };
      img.src = src;
    }
  } catch {}
  // Play reveal sound mapped to the word with robust fallbacks (assets/sound/*.mp3)
  try {
    const wordRaw = (word || '').toString();
    const slug = wordRaw.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    // Try to infer from image path first (most reliable mapping)
    let imgBase = '';
    try {
      const p = (roundResult?.image || src || '').toString();
      if (p) { const f = p.substring(p.lastIndexOf('/')+1, p.lastIndexOf('.')); if (f) imgBase = decodeURIComponent(f.toLowerCase()); }
    } catch {}
    const rawLower = wordRaw.toLowerCase();
    // Variants: with hyphens, with spaces, without spaces
    const hyphenRaw = rawLower.replace(/\s+/g, '-');
    const noSpaceRaw = rawLower.replace(/\s+/g, '');
    const noSpaceSlug = slug.replace(/-/g, '');
    const candidates = [imgBase, slug, hyphenRaw, rawLower, noSpaceRaw, noSpaceSlug]
      .filter(Boolean)
      .map(base => `/assets/sound/${base}.mp3`);
    if (revealAudioEl) { try { revealAudioEl.pause(); } catch {} }
    const a = new Audio();
    a.preload = 'auto'; a.playsInline = true; a.crossOrigin = 'anonymous';
    try { a.muted = false; a.volume = 1.0; } catch {}
    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) return;
      a.onerror = () => { idx += 1; tryNext(); };
      a.src = candidates[idx];
      // Duck music for reveal priority
      try { music.duckTo(0.1, 400); } catch {}
      const p = a.play();
      try { a.onended = () => { try { music.restore(800); } catch {}; }; } catch {}
      if (p && typeof p.catch === 'function') p.catch(() => {
        try { els.enableSoundWrap?.classList.remove('hidden'); } catch {}
        try { setupAutoplayUnlock(); } catch {}
      });
    };
    revealAudioEl = a;
    tryNext();
  } catch {}
  // Build results list
  try {
    const list = els.trResultsList; if (list) list.innerHTML = '';
    const playersArr = (snapshot?.players || []).slice();
    const winners = Array.isArray(roundResult?.winners) ? roundResult.winners : [];
    const winIds = new Set(winners.map(w => w.id));
    const recorderId = roundResult?.recorderId || (snapshot?.current?.recorderId);
    const losers = playersArr.filter(p => p.id !== recorderId && !winIds.has(p.id));
    const rows = [
      ...winners.map((w, idx) => ({ id: w.id, name: w.name || nameOf(w.id), ok: true, points: w.points || (idx === 0 ? 2 : 1) })),
      ...losers.map(p => ({ id: p.id, name: p.name, ok: false, points: 0 }))
    ];
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'result-row pop-in';
      li.style.animationDelay = `${i * 0.2}s`;
      const av = document.createElement('div'); av.className = 'avatar'; av.style.background = colorForId(r.id); av.textContent = (r.name || '?').slice(0,1).toUpperCase();
      const nick = document.createElement('div'); nick.className = 'name'; nick.textContent = '@' + (r.name || '—');
      const right = document.createElement('div'); right.className = 'points'; right.textContent = (r.ok ? '✅ ' : '❌ ') + (r.points > 0 ? `+${r.points} pt${r.points>1?'s':''}` : '0 pt');
      li.appendChild(av); li.appendChild(nick); li.appendChild(right);
      list?.appendChild(li);
    });
  } catch {}
  // Countdown 5 -> 0
  try { els.trCountdownValue.textContent = String(Math.max(0, Math.round(seconds))); } catch {}
  try { els.transitionOverlay.classList.remove('hidden'); } catch {}
  try { confetti({ spread: 70, particleCount: 120, origin: { y: 0.2 } }); } catch {}
  console.log('[transition] show overlay', roundResult);
  // Audio hook (to be added later)
  console.log('[transition] audio hook for word');
  let remain = Math.max(0, Math.round(seconds));
  trInterval = setInterval(() => {
    remain -= 1;
    try { els.trCountdownValue.textContent = String(Math.max(0, remain)); } catch {}
    if (remain <= 0) { try { clearInterval(trInterval); trInterval = null; } catch {}; }
  }, 1000);
}

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
let recTimer = null; // interval watchdog for 5s cap during recording
let isRecordingNow = false; // flag to avoid duplicate stop UI logic
let guessPhaseStarted = false; // ensure we don't restart 20s guess phase multiple times on recorder side
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
let revealAudioEl = null;
let currentReplayAudio = null;
let lastPlayersCount = 0;
let myAvatar = null;
let echoBalance = 0;
let endConfettiTo = null;
// Immersive chrono state
let chronoTimer = null;
let chronoStartAt = 0;
let chronoTotalMs = 0;
let chronoLastSec = null;
let tickingActive = false;
const AUDIO_VOLUME_TICK = 0.2;

// Background Music Manager (continuous ambience)
function createMusicManager() {
  const sources = {
    lobby: '/assets/music/lobby1.mp3',
    game: '/assets/music/game1.mp3',
  };
  const tracks = { lobby: null, game: null };
  let current = null; // 'lobby' | 'game' | null
  let fadeId = null;
  const LS_MUSIC_BASE = 'noiseio_music_base';
  const LS_MUSIC_MUTED = 'noiseio_music_muted';
  let baseVol = (() => { try { const v = parseFloat(localStorage.getItem(LS_MUSIC_BASE)); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.4; } catch { return 0.4; } })();
  let muted = (() => { try { const s = String(localStorage.getItem(LS_MUSIC_MUTED) || '').toLowerCase(); return s === '1' || s === 'true'; } catch { return false; } })();
  let recorderSilence = false; // force volume to 0 for soundmaker
  let volumeTarget = baseVol; // target for current context

  function ensure(el) {
    if (!el) return;
    el.loop = true; el.preload = 'auto'; el.playsInline = true; el.crossOrigin = 'anonymous';
    try { el.muted = false; } catch {}
  }
  function get(kind) {
    if (!tracks[kind]) { tracks[kind] = new Audio(sources[kind]); ensure(tracks[kind]); }
    return tracks[kind];
  }
  function stopFade() { if (fadeId) { clearInterval(fadeId); fadeId = null; } }
  function fadeTo(el, to, ms = 500) {
    stopFade();
    const from = el.volume;
    const toEff = (muted || recorderSilence) ? 0 : to;
    const start = Date.now();
    if (ms <= 0) { el.volume = toEff; return; }
    fadeId = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / ms);
      const v = from + (toEff - from) * t; el.volume = Math.max(0, Math.min(1, v));
      if (t >= 1) { stopFade(); }
    }, 30);
  }
  function isSilenced() { return muted || recorderSilence; }
  function enforcePolicy() {
    try {
      const keys = Object.keys(tracks);
      for (const k of keys) {
        const el = tracks[k];
        if (!el) continue;
        if (isSilenced()) {
          try { el.muted = true; el.volume = 0.0; el.pause(); } catch {}
        } else {
          try { el.muted = false; } catch {}
          // Only current track should attempt to play
          if (k === current) playIfNeeded(el);
        }
      }
    } catch {}
  }
  function playIfNeeded(el) {
    try {
      if (isSilenced()) { try { el.muted = true; el.pause(); } catch {}; return; }
      el.muted = false;
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => { try { els.enableSoundWrap?.classList.remove('hidden'); setupAutoplayUnlock(); } catch {} });
    } catch {}
  }

  return {
    base() { return baseVol; },
    setBase(v, ms = 0) {
      const vol = Math.min(1, Math.max(0, Number(v) || 0));
      baseVol = vol; volumeTarget = baseVol;
      try { localStorage.setItem(LS_MUSIC_BASE, String(baseVol)); } catch {}
      if (!current) return;
      const el = get(current);
      // Only lower immediately; raising happens via restore()
      if (el.volume > baseVol) fadeTo(el, baseVol, ms);
    },
    isMuted() { return muted; },
    setMuted(v, ms = 200) {
      muted = !!v; try { localStorage.setItem(LS_MUSIC_MUTED, muted ? '1' : '0'); } catch {}
      enforcePolicy();
      if (!current) return; const el = get(current);
      const to = isSilenced() ? 0 : volumeTarget; fadeTo(el, to, ms);
    },
    setRecorderSilence(v, ms = 0) {
      recorderSilence = !!v;
      enforcePolicy();
      if (!current) return; const el = get(current);
      const to = isSilenced() ? 0 : volumeTarget; fadeTo(el, to, ms);
    },
    current() { return current; },
    switchTo(kind) {
      if (current === kind) {
        const el = get(kind); playIfNeeded(el); fadeTo(el, volumeTarget, 700);
        return;
      }
      const next = get(kind);
      const prev = current ? get(current) : null;
      volumeTarget = baseVol;
      if (prev) { fadeTo(prev, 0.0, 700); setTimeout(() => { try { prev.pause(); } catch {} }, 720); }
      next.volume = 0.0; // start at 0
      try { next.muted = isSilenced(); } catch {}
      playIfNeeded(next);
      fadeTo(next, volumeTarget, 700);
      current = kind;
      enforcePolicy();
    },
    fadeTo(vol, ms) {
      volumeTarget = vol; if (!current) return; const el = get(current); fadeTo(el, vol, ms);
    },
    duckTo(vol, ms) { this.fadeTo(vol, ms); },
    duckFrac(frac, ms) { const f = Math.min(1, Math.max(0, Number(frac) || 0)); this.fadeTo(baseVol * f, ms); },
    restore(ms = 800) { this.fadeTo(this.base(), ms); },
  };
}
const music = createMusicManager();
try { /* initial policy */ (function(){
  // On boot, enforce current muted/silence state so iOS doesn't leak sound
  try { music.setMuted(music.isMuted(), 0); } catch {}
})(); } catch {}

// Music control wiring (mute + slider)
try {
  // Ensure mute button exists even if HTML not updated
  if (!els.musicMuteBtn && els.musicCtrl) {
    const wrap = els.musicCtrl.querySelector('.music-buttons') || els.musicCtrl;
    const btn = document.createElement('button');
    btn.id = 'musicMuteBtn'; btn.className = 'music-btn';
    btn.setAttribute('aria-label', 'Couper la musique'); btn.title = 'Couper la musique';
    btn.textContent = '🔊';
    if (wrap.firstChild) wrap.insertBefore(btn, wrap.firstChild); else wrap.appendChild(btn);
    els.musicMuteBtn = btn;
  }
  const applyMuteIcon = () => {
    if (!els.musicMuteBtn) return;
    const m = music.isMuted();
    els.musicMuteBtn.textContent = m ? '🔇' : '🔊';
    try { els.musicMuteBtn.setAttribute('aria-label', m ? 'Activer la musique' : 'Couper la musique'); } catch {}
    try { els.musicMuteBtn.title = m ? 'Activer la musique' : 'Couper la musique'; } catch {}
  };
  // Initialize UI from current music state
  const base = music.base();
  if (els.musicSlider) els.musicSlider.value = String(base);
  if (els.musicValue) els.musicValue.textContent = `${Math.round(base * 100)}%`;
  applyMuteIcon();
  // Toggle panel
  els.musicBtn?.addEventListener('click', () => { els.musicPanel?.classList.toggle('hidden'); });
  // Slider updates base volume
  els.musicSlider?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    music.setBase(v, 200);
    if (els.musicValue) els.musicValue.textContent = `${Math.round(v * 100)}%`;
  });
  // Mute toggle
  els.musicMuteBtn?.addEventListener('click', () => { music.setMuted(!music.isMuted(), 150); applyMuteIcon(); });
} catch {}

// Word list for random prompts (aligned with server; no duplicates)
const WORDS = [
  // Base
  'chat','chien','vache','voiture','téléphone','porte','horloge','tambour','train','pluie',
  'aspirateur','hélicoptère','guitare','moto','oiseau','tonnerre','pizza','serpent','lion','bébé','marteau','râteau','sirène','robot','vent','réveil','cloche','singe','rire','machine à laver',
  'dinosaure','photocopieuse','parapluie','volcan','cheval','chevalier','toilette','feu d’artifice','baleine','viking','zèbre','marteau-piqueur','popcorn','four','monstre','feu de camp','aspirine','friteuse','alien','canard qui parle',
  // Ajouts
  'poule','mouton','cochon','grenouille','canard','avion','camion','bateau','vélo','tracteur','ambulance','fusée',
  'sifflet','klaxon','éternuer','tousser','bailler','eau','feu','éléphant','abeille','loup','hibou','souris',
  'moto-cross','piano','batterie','trompette','violon','flûte','saxophone','café','soda','soupe','chips','glaçons',
  'orage','océan','forêt','nager','courir','sauter','tomber','dormir','imprimante','ordinateur','micro-ondes','lave-linge','ventilateur','tondeuse','perceuse','mixeur','climatisation',
  'fantôme','zombie','fermeture éclair','escalier','ascenseur','fontaine','balançoire','skateboard',
  'dauphin','hyène','chauve-souris','bébé qui pleure','vieux téléphone','moteur qui cale',
  'lightsaber','t-rex','pacman','mario','pikachu','chewbacca','r2-d2','gollum','yoda','minions'
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

// Recorder bubbles + winner toast helpers
function randomPastel() {
  const arr = [
    'rgba(165,123,255,0.75)', // violet
    'rgba(76,201,240,0.75)',  // bleu
    'rgba(255,138,101,0.75)', // orange
    'rgba(120,220,160,0.75)', // vert
    'rgba(255,209,102,0.75)', // jaune
    'rgba(238,153,255,0.75)'  // rose
  ];
  return arr[Math.floor(Math.random() * arr.length)];
}

function spawnBubble(text, fromId = '') {
  if (!isRecorder) return; // visible uniquement pour le Sound Maker
  const targets = [els.recorderBubbles, els.bubblesLayer, els.guessesArea].filter(Boolean);
  if (targets.length === 0) return;
  const make = (layer) => {
    try { layer.classList.remove('hidden'); } catch {}
    while (layer.children.length >= 10) { layer.removeChild(layer.firstChild); }
    const b = document.createElement('div');
    b.className = 'bubble anim';
    if (Math.random() < 0.4) b.classList.add('small');
    if (Math.random() > 0.7) b.classList.add('big');
    b.textContent = text;
    const leftPct = 10 + Math.random() * 80;
    b.style.left = `${leftPct.toFixed(1)}%`;
    b.style.background = randomPastel();
    b.style.setProperty('--dx', `${(Math.random() * 80 - 40).toFixed(0)}px`);
    b.style.setProperty('--dur', '5000ms');
    b.style.border = '2px solid rgba(255,255,255,0.7)';
    b.style.backdropFilter = 'blur(8px)';
    b.addEventListener('animationend', () => { try { layer.removeChild(b); } catch {} });
    layer.appendChild(b);
  };
  targets.forEach(make);
  try { plop(); } catch {}
}

function showWinnerToast(winnerId, winnerName) {
  const toast = els.winnerToast; if (!toast) return;
  toast.innerHTML = '';
  const av = document.createElement('div'); av.className = 'avatar'; av.style.background = colorForId(winnerId || winnerName || 'x'); av.textContent = (winnerName || '?').slice(0,1).toUpperCase();
  const txtWrap = document.createElement('div');
  const name = document.createElement('div'); name.className = 'name'; name.textContent = winnerName || '—';
  const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = 'a deviné le mot !';
  txtWrap.appendChild(name); txtWrap.appendChild(sub);
  toast.appendChild(av); toast.appendChild(txtWrap);
  toast.classList.remove('hidden');
  toast.style.opacity = '0';
  toast.style.animation = 'toastIn 320ms ease-out forwards';
  try { confetti({ particleCount: 90, spread: 60, origin: { y: 0.6 } }); } catch {}
  vibrate(40);
  setTimeout(() => {
    try { toast.style.animation = 'toastOut 300ms ease-in forwards'; } catch {}
    setTimeout(() => { try { toast.classList.add('hidden'); } catch {} }, 320);
  }, 2000);
}

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
  try { els.auth?.classList.add('hidden'); } catch {}
  els.lobby?.classList.add('hidden');
  els.round?.classList.add('hidden');
  const leavingEnded = !section || section !== els.ended;
  if (leavingEnded) {
    try { stopEndConfettiLoop(); } catch {}
  }
  els.ended?.classList.add('hidden');
  try { els.shop?.classList.add('hidden'); } catch {}
  const target = (section || els.home);
  target.classList.remove('hidden');
  try { target.classList.add('fade-in'); setTimeout(() => target.classList.remove('fade-in'), 300); } catch {}
  // Tabs visibility handled later when guess view is active for devineurs
  try { els.bottomTabs.classList.add('hidden'); } catch {}
  try { els.wave.classList.add('hidden'); } catch {}
  // Toggle header visibility for Home screen
  try {
    const onHome = (target === els.home);
    document.body.classList.toggle('home-mode', onHome);
  } catch {}
  // Background music routing by screen
  try {
    if (target === els.home || target === els.lobby || target === els.shop) {
      music.switchTo('lobby');
    } else if (target === els.round || target === els.ended) {
      music.switchTo('game');
    }
  } catch {}
}

function startGuessTimer() {
  stopGuessTimer();
  guessStartAt = Date.now();
  setStatusBanner('Devinez ! (20s)', 'info');
  try {
    // Hide legacy badge timer; we use the round-style timer for guessers too
    if (els.guesserTimer) els.guesserTimer.classList.add('hidden');
    if (els.guesserTimerBadge) els.guesserTimerBadge.classList.add('hidden');
    // Ensure our round-style guess timer shows the correct initial text
    if (document.getElementById('guessRoundTimer')) document.getElementById('guessRoundTimer').textContent = '00:20';
  } catch {}
  startChrono(20000);
  // Keep legacy handle to allow stopGuessTimer() to cancel separately if needed
  guessTimer = setInterval(() => {
    const elapsed = Date.now() - guessStartAt;
    if (elapsed >= 20000) { clearInterval(guessTimer); guessTimer = null; }
  }, 300);
  console.log('[ui] guess timer started');
}

function stopGuessTimer() {
  if (guessTimer) { clearInterval(guessTimer); guessTimer = null; }
  stopChrono();
  try { if (els.guesserTimer) els.guesserTimer.classList.add('hidden'); } catch {}
}

function updateRoomUI(snap) {
  // players list (legacy + new lobby)
  try {
    const was = lastPlayersCount;
    const arr = snap.players.slice().sort((a,b) => (b.isHost?1:0) - (a.isHost?1:0)); // host first
    // Legacy list if present
    if (els.players) {
      els.players.innerHTML = '';
      arr.forEach(p => {
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
        li.appendChild(av); li.appendChild(name); li.appendChild(status);
        els.players.appendChild(li);
      });
    }
    // New lobby list
    if (els.playerList) {
      els.playerList.innerHTML = '';
      arr.forEach(p => {
        const li = document.createElement('li');
        li.className = 'player-item pop-in';
        const avatar = document.createElement('div'); avatar.className = 'pi-avatar';
        if (p.id === myId && myAvatar) {
          const img = document.createElement('img'); img.src = avatarUrl(myAvatar); img.alt = 'avatar'; avatar.appendChild(img);
        } else {
          const circle = document.createElement('div'); circle.className = 'pi-fallback'; circle.style.background = colorForId(p.id); circle.textContent = (p.name || '?').slice(0,1).toUpperCase(); avatar.appendChild(circle);
        }
        const name = document.createElement('div'); name.className = 'pi-name'; name.textContent = p.name || '—';
        const right = document.createElement('div'); right.className = 'pi-right';
        if (p.isHost) { const badge = document.createElement('span'); badge.className = 'badge host'; badge.textContent = 'HÔTE'; right.appendChild(badge); }
        li.appendChild(avatar); li.appendChild(name); li.appendChild(right);
        els.playerList.appendChild(li);
      });
    }
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
    console.log('[ended] renderReplaysInto into', container?.id);
    snap.history.forEach((h, i) => {
      if (!h.audioBase64) return; // skip if no audio
      const src = `data:${h.audioMime || 'audio/webm'};base64,${h.audioBase64}`;
      const word = (h.secret ?? h.word ?? h.secretRaw ?? h.secretNorm ?? '').toString().trim() || '—';
      if (word === '—') { try { console.warn('[replay] missing secret for history item', h); } catch {} }
      const winnerName = nameOf(h.winnerId);
      const missed = !h.winnerId;
      // Image thumb from history image or slug fallback
      let imgSrc = '';
      try {
        if (h.image) imgSrc = h.image;
        if (!imgSrc && word && word !== '—') {
          const slug = word.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
          imgSrc = `/assets/imagemot/${slug}.jpg`;
        }
      } catch {}

      const card = document.createElement('div');
      card.className = 'replay-card';

      const img = document.createElement('img');
      img.className = 'replay-img';
      if (imgSrc) img.src = imgSrc;
      img.alt = word || 'replay';

      const textWrap = document.createElement('div');
      const wordEl = document.createElement('div');
      wordEl.className = 'replay-word';
      wordEl.textContent = word || '—';
      const meta = document.createElement('div');
      meta.className = 'replay-meta';
      meta.textContent = missed
        ? `de ${nameOf(h.recorderId)} — ❌ non trouvé`
        : `de ${nameOf(h.recorderId)} — trouvé par ${winnerName}`;
      textWrap.appendChild(wordEl);
      textWrap.appendChild(meta);

      const controls = document.createElement('div');
      controls.className = 'replay-controls';
      const btn = document.createElement('button');
      btn.className = 'play-btn';
      btn.textContent = '▶';
      controls.appendChild(btn);

      // Build Audio element
      const audio = new Audio(src);
      audio.preload = 'none';
      audio.crossOrigin = 'anonymous';
      audio.playsInline = true;
      audio.addEventListener('play', () => { card.classList.add('playing'); btn.textContent = '⏸'; });
      audio.addEventListener('pause', () => { card.classList.remove('playing'); btn.textContent = '▶'; });
      audio.addEventListener('ended', () => {
        card.classList.remove('playing');
        btn.textContent = '▶';
        currentReplayAudio = null;
      });
      btn.addEventListener('click', () => {
        try {
          if (currentReplayAudio && currentReplayAudio !== audio) {
            currentReplayAudio.pause();
            currentReplayAudio.dispatchEvent(new Event('ended'));
          }
          if (audio.paused) {
            audio.play();
            card.classList.add('playing');
            btn.textContent = '⏸';
            currentReplayAudio = audio;
            vibrate(10);
          } else {
            audio.pause();
            card.classList.remove('playing');
            btn.textContent = '▶';
            currentReplayAudio = null;
          }
        } catch (e) { console.warn('replay play error', e); }
      });

      // Assemble card (img | texts | button)
      card.appendChild(img);
      card.appendChild(textWrap);
      card.appendChild(controls);
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
    const startEl = els.startGame || els.launchBtn;
    if (startEl) startEl.disabled = !(amHost && inLobby);
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
      // Safety: ensure this secret is indeed for me
      if (recorderIdExpected && recorderIdExpected !== myId) {
        console.warn('[secret] ignoring secret not for me', { recorderIdExpected, myId });
        return;
      }
      receivedSecretThisRound = true;
      // Claim recorder role on secret reception
      isRecorder = true;
      try {
        document.body.classList.add('role-recorder');
        document.body.classList.remove('role-guesser');
        // Show recorder UI and hide guesser UI
        els.recorderView?.classList.remove('hidden');
        els.recorderControls?.classList.remove('hidden');
        els.waitingView?.classList.add('hidden');
        els.guessView?.classList.add('hidden');
        els.panelChat?.classList.add('hidden');
        els.bottomTabs?.classList.add('hidden');
        if (els.chatInput) els.chatInput.disabled = true;
        if (els.sendChatBtn) els.sendChatBtn.disabled = true;
        // Show banner now that we truly are recorder
        if (els.recBanner) { els.recBanner.classList.remove('hidden'); els.recBanner.style.display = ''; els.yourTurnTitle.textContent = nameOf(myId) || 'Toi'; }
        // Remove any guesser round-timer
        const t = document.getElementById('guessRoundTimer');
        if (t && t.parentNode) t.parentNode.removeChild(t);
        els.guessRoundTimer = null;
      } catch {}
      // Recorder: silence background music during their turn (override)
      try { music.setRecorderSilence(true, 0); } catch {}
      currentSecretNorm = normalizeTextLocal(payload.word);
      try {
        // Debug: log the received secret payload
        console.log('[secret] received', payload);
        els.secretWordDisplay.textContent = (payload.word || '').toString().toUpperCase();
      } catch {}
      // Update SoundMaker word card
      try {
        if (els.wordTitle) els.wordTitle.textContent = (payload.word || '').toString().toUpperCase();
        if (els.wordImage) {
          // Prefer exact path provided by server to avoid slug mismatches
          let src = (payload.image || '').toString();
          if (!src) {
            // Fallback: best-effort slug if server did not provide image path
            const slug = (payload.word || '')
              .toString()
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .trim()
              .replace(/\s+/g, '-');
            src = `/assets/imagemot/${slug}.jpg`;
            console.log('[secret] no image from server, fallback slug src=', src);
          }
          els.wordImage.classList.remove('fade-in');
          els.wordImage.src = src;
          // fade-in when loaded
          els.wordImage.onload = () => { try { els.wordImage.classList.add('fade-in'); } catch {} };
        }
      } catch {}
      try {
        els.recorderView.classList.remove('hidden');
        if (isRecorder) {
          // Ensure recorder UI is ready to record
          els.recorderControls?.classList.remove('hidden');
          els.recorderWait?.classList.add('hidden');
          els.startRecBtn.disabled = false;
          els.stopRecBtn.disabled = true;
          // Reset guess-phase flag when a new secret arrives for recorder
          guessPhaseStarted = false;
          // Force role + hide duplicate timers immediately
          try {
            document.body.classList.add('role-recorder');
            document.body.classList.remove('role-guesser');
            getTimerWrap()?.classList.add('hidden');
            els.timerBadge?.classList.add('hidden');
            if (els.timerBadge) els.timerBadge.style.display = 'none';
            els.guesserTimer?.classList.add('hidden');
            els.guesserTimerBadge?.classList.add('hidden');
          } catch {}
        }
      } catch {}
      // Update label: we are confirmed recorder now
      try { setTurnLabel('Votre tour 🎤'); } catch {}
      // Prepare bubbles layer immediately for recorder
      try { (els.recorderBubbles || els.bubblesLayer)?.classList.remove('hidden'); console.log('[bubbles] layer visible (secret)'); } catch {}
      return;
    }

    if (type === 'roundStarted') {
      // Hide any transition overlay when new round starts
      hideTransitionOverlay();
      recorderIdExpected = payload.byId;
      // Default to guesser UI for all; only the true recorder will receive 'secret' and switch
      isRecorder = false;
      receivedSecretThisRound = false;
      // Pre-apply role-based audio policy BEFORE showing round (prevents burst on mobile)
      try {
        if (payload.byId === myId) {
          music.setRecorderSilence(true, 0);
        } else {
          music.setRecorderSilence(false, 0);
          music.fadeTo(0.1, 0);
        }
      } catch {}
      els.chatLog.innerHTML = '';
      show(els.round);
      // Reset any previous timers/audio state on new round
      isRecordingNow = false; guessPhaseStarted = false;
      try { if (recTimer) { clearInterval(recTimer); recTimer = null; } } catch {}
      try { if (mediaRecorder && mediaRecorder.state !== 'inactive') { mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t => t.stop()); } } catch {}
      try { stopGuessTimer(); } catch {}
      try { stopAudioLoop(true); } catch {}
      // Keep header timer hidden by default; we'll manage per-role below
      try { document.querySelector('.timer-wrap')?.classList.add('hidden'); } catch {}
      {
        els.recorderControls?.classList.add('hidden');
        els.recorderView.classList.add('hidden');
        // Show proper guesser screen right away
        els.waitingView.classList.add('hidden');
        try { if (els.recBanner) { els.recBanner.classList.add('hidden'); els.recBanner.style.display = 'none'; } } catch {}
        // Forcefully reset any recorder-only UI on non-recorder clients
        try { currentSecretNorm = null; } catch {}
        try { if (els.startRecBtn) els.startRecBtn.disabled = true; } catch {}
        try { if (els.stopRecBtn) els.stopRecBtn.disabled = true; } catch {}
        try { if (els.wordTitle) els.wordTitle.textContent = '—'; } catch {}
        try { if (els.wordImage) { els.wordImage.removeAttribute('src'); els.wordImage.classList.remove('fade-in'); } } catch {}
        // Ensure header timer stays hidden and show chat UI
        try { if (els.guesserTimer) els.guesserTimer.classList.add('hidden'); } catch {}
        try { els.waitingMsg.textContent = ` Attends quelques secondes pendant que ${payload.byName} bruit son mot mystère…`; } catch {}
        els.guessView.classList.remove('hidden');
        try { els.panelChat?.classList.remove('hidden'); els.bottomTabs?.classList.remove('hidden'); } catch {}
        try { els.chatRow?.classList.remove('hidden'); els.chatInput.disabled = false; els.sendChatBtn.disabled = !els.chatInput.value.trim(); } catch {}
        document.body.classList.add('role-guesser');
        document.body.classList.remove('role-recorder');
        // Guessers: keep background music at 10% (recorder already silenced pre-show)
        try { if (payload.byId !== myId) music.fadeTo(0.1, 600); } catch {}
        // Masquer les bulles côté devineurs
        try {
          (els.recorderBubbles || els.bubblesLayer)?.classList.add('hidden');
          console.log('[bubbles] layer hidden (not recorder)');
        } catch {}
        try { document.querySelector('.timer-wrap')?.classList.add('hidden'); } catch {}
        // Insert a round-style timer in guess view to mirror SoundMaker's timer
        try {
          if (!document.getElementById('guessRoundTimer')) {
            const t = document.createElement('div');
            t.id = 'guessRoundTimer';
            t.className = 'round-timer';
            t.textContent = '00:30';
            els.guessRoundTimer = t;
            const container = els.guessView || document.getElementById('guessView');
            if (container) container.insertBefore(t, container.firstChild);
          } else {
            els.guessRoundTimer = document.getElementById('guessRoundTimer');
          }
        } catch {}
      }
      // Guard mismatch: if marked recorder but we don't receive a secret quickly, switch to guesser UI
      try {
        if (isRecorder) {
          setTimeout(() => {
            if (!receivedSecretThisRound) {
              console.warn('[guard] No secret received; switching to guesser UI');
              isRecorder = false;
              try { els.recorderControls?.classList.add('hidden'); els.recorderView?.classList.add('hidden'); } catch {}
          try { music.setRecorderSilence(false, 0); } catch {}
              try { els.waitingView?.classList.add('hidden'); els.guessView?.classList.remove('hidden'); els.panelChat?.classList.remove('hidden'); els.bottomTabs?.classList.remove('hidden'); } catch {}
              try { els.chatRow?.classList.remove('hidden'); els.chatInput.disabled = false; els.sendChatBtn.disabled = !els.chatInput.value.trim(); } catch {}
              try { document.body.classList.remove('role-recorder'); document.body.classList.add('role-guesser'); } catch {}
              try { document.querySelector('.timer-wrap')?.classList.add('hidden'); } catch {}
              // Ensure guess-round timer is present
              try {
                if (!document.getElementById('guessRoundTimer')) {
                  const t = document.createElement('div');
                  t.id = 'guessRoundTimer'; t.className = 'round-timer'; t.textContent = '00:30';
                  const container = els.guessView || document.getElementById('guessView');
                  if (container) container.insertBefore(t, container.firstChild);
                  els.guessRoundTimer = t;
                }
              } catch {}
            }
          }, 1500);
        }
      } catch {}
      try { document.body.classList.remove('timeup'); } catch {}
      stopAudioLoop(true);
      // Update local snapshot to highlight recorder immediately
      if (!snapshot) snapshot = {};
      snapshot.current = { recorderId: payload.byId };
      lastCorrectAnswer = '';
      const roundLabel = (payload.round && payload.total) ? ` · Manche ${payload.round}/${payload.total}` : '';
      setTurnLabel(`C'est au tour de ${payload.byName} 🎤` + roundLabel + ' — Devinez !');
      setStatusBanner('Manche en cours', 'info');
      // Default to chat tab for guessing
      setActiveTab('chat');
      // Immersive 30s window visible à tous: recorder et devineurs (même timer visuel)
      // Devineurs basculeront ensuite sur 20s à la réception de l'audio
      startChrono(30000);
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
        // Force restart of guess timer to ensure visibility
        stopGuessTimer();
        startGuessTimer();
        // Ensure header timer remains hidden for guessers
        try { document.querySelector('.timer-wrap')?.classList.add('hidden'); } catch {}
        // Enable input for guessers
        try { els.chatRow.classList.remove('hidden'); els.chatInput.disabled = false; els.sendChatBtn.disabled = !els.chatInput.value.trim(); } catch {}
        // Prepare audio loop
        loopAudioSrc = src;
        // If autoplay is not allowed yet, reveal enable banner proactively and install unlock handler
        try { if (!allowSound) { els.enableSoundWrap?.classList.remove('hidden'); setupAutoplayUnlock(); } } catch {}
        // Attempt autoplay; if blocked, the catch in startAudioLoop will keep the enable banner visible
        startAudioLoop();
      }
      return;
    }

    if (type === 'chat') {
      if (snapshot?.state === 'lobby' && els.chatLogLobby) {
        logLobbyMsg(`${payload.from}: ${payload.text}`);
      } else {
        logMsg(`${payload.from}: ${payload.text}`);
      }
      // Recorder-only fuzzy hint if guess is very close (client-side guidance only)
      if (isRecorder && currentSecretNorm) {
        const d = levenshtein(payload.text, currentSecretNorm);
        if (d > 0 && d <= 2) {
          logMsg(`🤏 Presque pour ${payload.from}`);
          vibrate(20);
        }
      }
      // Bulles animées visibles uniquement chez le Sound Maker
      try {
        if (isRecorder) {
          console.log('[bubbles] spawn', { from: payload.from, text: payload.text });
          // Safety: ensure layer visible at each spawn
          try { els.bubblesLayer.classList.remove('hidden'); } catch {}
          spawnBubble(payload.text, payload.fromId);
        } else {
          console.log('[bubbles] skip (not recorder)');
        }
      } catch (e) { console.warn('[bubbles] error', e); }
      return;
    }

    if (type === 'ding') {
      ding(true);
      // Do not stop audio here; 'correct' will decide per-client
      return;
    }

    if (type === 'correct') {
      // Stop ticking immediately when a player finds the word
      tickingActive = false;
      logMsg(`✅ ${payload.winner} a trouvé ! Réponse: ${payload.answer}`);
      lastCorrectAnswer = payload.answer || '';
      try { confetti({ spread: 70, ticks: 200, origin: { y: 0.6 } }); } catch {}
      // Toast gagnant pour le Sound Maker
      try { if (isRecorder) { showWinnerToast(payload.winnerId, payload.winner); ding(true); } } catch {}
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
      // Force role reset to prevent stale recorder UI on next rounds
      isRecorder = false;
      receivedSecretThisRound = false;
      try { music.setRecorderSilence(false, 0); } catch {}
      try { els.recorderControls?.classList.add('hidden'); els.recorderView?.classList.add('hidden'); } catch {}
      try { document.body.classList.remove('role-recorder'); document.body.classList.remove('role-guesser'); } catch {}
      try { getTimerWrap()?.classList.add('hidden'); } catch {}
      // Remove guesser round timer
      try {
        const t = document.getElementById('guessRoundTimer');
        if (t && t.parentNode) t.parentNode.removeChild(t);
        els.guessRoundTimer = null;
      } catch {}
      // Show transition overlay with countdown unless party is complete
      try {
        console.log('[transition] roundEnded payload', payload);
        const seconds = Math.max(0, Math.round((payload?.nextInMs ?? 5000) / 1000));
        if (seconds > 0) {
          showTransitionOverlay(payload.roundResult || {}, seconds);
        } else {
          hideTransitionOverlay();
        }
      } catch (e) { console.warn('[transition] show error', e); }
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
      // Masquer overlays
      try { els.bubblesLayer.classList.add('hidden'); els.winnerToast.classList.add('hidden'); } catch {}
      try { document.body.classList.remove('role-recorder'); document.body.classList.remove('role-guesser'); } catch {}
      // Ne pas forcer un screen switch qui pourrait recouvrir l'overlay; on reste sur la vue courante pendant la transition
      try { updateRoomUI(snapshot); } catch {}
      return;
    }

    if (type === 'roundAborted') {
      logMsg('⚠️ Manche annulée: ' + payload.reason);
      try { els.bubblesLayer.classList.add('hidden'); els.winnerToast.classList.add('hidden'); } catch {}
      try { music.setRecorderSilence(false, 0); } catch {}
      show(els.lobby);
      return;
    }

    if (type === 'gameEnded') {
      // Ensure any transition overlay is hidden before showing final results
      try { hideTransitionOverlay(); } catch {}
      try { music.setRecorderSilence(false, 0); } catch {}
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

      // Full leaderboard beyond top 3 (styled items)
      try {
        els.leaderboardFull.innerHTML = '';
        arr.slice(3).forEach((p, idx) => {
          const i = idx + 3;
          const li = document.createElement('li');
          li.className = 'lb-item pop-in';
          const rank = document.createElement('div'); rank.className = 'lb-rank'; rank.textContent = String(i+1);
          const avatar = document.createElement('div'); avatar.className = 'lb-avatar';
          if (p.id === myId && myAvatar) {
            const im = document.createElement('img'); im.src = avatarUrl(myAvatar); im.alt = 'avatar'; avatar.appendChild(im);
          } else {
            avatar.style.background = colorForId(p.id);
            avatar.textContent = (p.name || '?').slice(0,1).toUpperCase();
          }
          const name = document.createElement('div'); name.className = 'lb-name'; name.textContent = '@' + (p.name || '—');
          const score = document.createElement('div'); score.className = 'lb-score'; score.textContent = `${p.score} pts`;
          li.appendChild(rank); li.appendChild(avatar); li.appendChild(name); li.appendChild(score);
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
      stopGuessTimer();
      if (snapshot) snapshot.current = null;
      try { els.bubblesLayer.classList.add('hidden'); els.winnerToast.classList.add('hidden'); } catch {}
      // Slower celebratory transition to end screen + start confetti loop
      setTimeout(() => {
        show(els.ended);
        try { confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); } catch {}
        try { startEndConfettiLoop(); } catch {}
      }, 900);
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

// UI wires (legacy auth screen guarded)
try {
  if (els.createBtn) {
    els.createBtn.addEventListener('click', () => {
      const name = (els.nickname?.value || '').trim() || 'Player';
      console.log('[ux-refresh] legacy create lobby');
      sendWhenReady('createLobby', { name });
    });
  }
  if (els.joinBtn && els.joinCode) {
    els.joinBtn.addEventListener('click', () => {
      const name = (els.nickname?.value || '').trim() || 'Player';
      const code = (els.joinCode.value || '').trim().toUpperCase();
      if (!code) { setStatusBanner('Code introuvable.', 'danger'); return; }
      sendWhenReady('joinLobby', { code, name });
    });
  }
} catch {}

// UX refresh — Home screen wires
try {
  // Nickname: load, validate, persist
  const nickKey = 'noiseio_nick';
  const validateNick = (v) => !!v && v.trim().length >= 3 && v.trim().length <= 15;
  const saveNick = (v) => { const n = v.trim(); try { localStorage.setItem(nickKey, n); } catch {} try { if (els.greetName) els.greetName.textContent = `Salut ${n} 👋`; } catch {} console.log('[ux-refresh] nickname updated → "%s"', n); };
  try {
    const existing = (localStorage.getItem(nickKey) || '').trim();
    if (els.nickname && existing) els.nickname.value = existing;
  } catch {}
  if (els.nickname) {
    els.nickname.addEventListener('input', (e) => {
      const v = e.target.value || '';
      try { if (els.nickHint) els.nickHint.classList.toggle('hidden', validateNick(v)); } catch {}
    });
    els.nickname.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); const v = els.nickname.value || ''; if (validateNick(v)) saveNick(v); else { try { els.nickHint?.classList.remove('hidden'); } catch {} } }
    });
    els.nickname.addEventListener('blur', () => { const v = els.nickname.value || ''; if (validateNick(v)) saveNick(v); });
  }

  // Join: uppercase transform + submit
  const doJoinHome = () => {
    const code = (els.joinCode?.value || '').trim().toUpperCase();
    if (!code) { setStatusBanner('Entrez un code.', 'danger'); vibrate(12); return; }
    const name = (els.nickname?.value || '').trim() || getNickname();
    console.log('[ux-refresh] home: join code=%s', code);
    sendWhenReady('joinLobby', { code, name });
  };
  if (els.joinCode) {
    els.joinCode.addEventListener('input', (e) => { e.target.value = (e.target.value || '').toUpperCase(); });
    els.joinCode.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doJoinHome(); } });
  }
  if (els.joinSubmit) els.joinSubmit.addEventListener('click', doJoinHome);

  // Create game CTA
  if (els.createGame) {
    console.log('[ux-refresh] bind createGame click');
    const createLobbyNow = () => {
      try {
        const name = (els.nickname?.value || '').trim() || getNickname();
        console.log('[ux-refresh] home: create new lobby');
        sendWhenReady('createLobby', { name });
        vibrate(15);
      } catch (e) { console.warn('[ux-refresh] createGame error', e); }
    };
    els.createGame.addEventListener('click', (e) => { e.preventDefault(); createLobbyNow(); });
    // Fallback delegation in case of re-render
    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('#createGame');
      if (t) { e.preventDefault(); createLobbyNow(); }
    });
  }
} catch {}

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

// Back to home from end screen
try {
  els.backHomeBtn.addEventListener('click', () => {
    console.log('[ui] backHomeBtn clicked');
    vibrate(10);
    show(els.home);
  });
} catch {}

// Avatar modal wiring
try { els.openAvatarBtn.addEventListener('click', () => { openAvatarModal(); vibrate(8); }); } catch {}
try { els.closeAvatarBtn.addEventListener('click', closeAvatarModal); } catch {}
try { els.avatarModal.addEventListener('click', (e) => { if (e.target === els.avatarModal) closeAvatarModal(); }); } catch {}
// Home avatar button opens the same modal
try { if (els.homeAvatarBtn) els.homeAvatarBtn.addEventListener('click', () => { openAvatarModal(); vibrate(8); }); } catch {}

// Lobby tabs behavior
function setLobbyTab(which) {
  const playersActive = which === 'players';
  try {
    els.tabPlayers?.classList.toggle('active', playersActive);
    els.tabMessages?.classList.toggle('active', !playersActive);
    els.panelPlayers?.classList.toggle('active', playersActive);
    els.panelMessages?.classList.toggle('active', !playersActive);
    // Slide indicator
    els.tabsPill?.classList.toggle('ind-messages', !playersActive);
    console.log('[ux-refresh] lobby tab →', which);
  } catch {}
}
try { els.tabPlayers?.addEventListener('click', () => setLobbyTab('players')); } catch {}
try { els.tabMessages?.addEventListener('click', () => setLobbyTab('messages')); } catch {}

// Lobby chat wiring
try {
  const sendLobby = () => {
    const text = (els.chatInputLobby?.value || '').trim();
    if (!text) return;
    els.chatInputLobby.value = '';
    send('chat', { text });
  };
  els.sendMessageLobby?.addEventListener('click', sendLobby);
  els.chatInputLobby?.addEventListener('input', () => {
    try { els.sendMessageLobby.disabled = !(els.chatInputLobby.value || '').trim(); } catch {}
  });
  els.chatInputLobby?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendLobby(); } });
  els.emojiBarLobby?.addEventListener('click', (e) => {
    const btn = e.target.closest('.emoji');
    if (!btn) return;
    const em = btn.textContent || '';
    els.chatInputLobby.value = (els.chatInputLobby.value || '') + em;
    els.chatInputLobby.focus();
    try { els.sendMessageLobby.disabled = !(els.chatInputLobby.value || '').trim(); } catch {}
  });
} catch {}

// Lobby actions
try { els.copyCodeBtn.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(roomCode || ''); setStatusBanner('✅ Copié !','success'); setTimeout(clearStatusBanner, 1200); vibrate(10); } catch {}
}); } catch {}

try { els.leaveBtn.addEventListener('click', () => { try { ws?.close(); } catch {}; location.reload(); }); } catch {}

try { els.launchBtn.addEventListener('click', () => { send('startRound', {}); vibrate(20); }); } catch {}
try { els.startGame.addEventListener('click', () => { if (els.startGame.disabled) return; send('startRound', {}); vibrate(20); }); } catch {}

// Enable sound
try { els.enableSoundBtn.addEventListener('click', () => { allowSound = true; els.enableSoundWrap.classList.add('hidden'); if (loopAudioSrc) startAudioLoop(); try { const isGame = (!els.round?.classList.contains('hidden')) || (!els.ended?.classList.contains('hidden')); music.switchTo(isGame ? 'game' : 'lobby'); } catch {} vibrate(15); }); } catch {}

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
    try { music.fadeTo(0.0, 300); } catch {}
    try { els.secretWordDisplay.classList.add('pop'); setTimeout(() => els.secretWordDisplay.classList.remove('pop'), 380); } catch {}

    try { if (els.startRecBtn) els.startRecBtn.disabled = true; if (els.stopRecBtn) els.stopRecBtn.disabled = false; } catch {}
    // Mark active and start the 5s watchdog, store into recTimer for proper cleanup
    isRecordingNow = true;
    if (recTimer) { try { clearInterval(recTimer); } catch {} recTimer = null; }
    const startAt = Date.now();
    recTimer = setInterval(() => {
      const elapsed = Date.now() - startAt;
      if (elapsed >= 5000) { console.log('[rec] watchdog stop'); stopRecording(); }
    }, 150);
    setStatusBanner('Enregistrement (5s max)', 'info');
  } catch (e) {
    console.error('record error', e);
    setStatusBanner('Micro bloqué ou indisponible', 'danger');
    alert('Impossible d\'accéder au micro. Vérifiez les autorisations navigateur.');
  }
}

function stopRecording() {
  // Stop media once; further calls are idempotent
  const wasActive = isRecordingNow || (mediaRecorder && mediaRecorder.state !== 'inactive');
  isRecordingNow = false;
  try { if (recTimer) { clearInterval(recTimer); recTimer = null; } } catch {}
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch {}
    try { mediaRecorder.stream.getTracks().forEach(t => t.stop()); } catch {}
  }
  if (!wasActive) { return; }
  console.log('[rec] stopped');
  vibrate(50);
  showWave(false);
  // Disable buttons post-send; will be re-enabled next round/secret
  try { els.startRecBtn.disabled = true; els.stopRecBtn.disabled = true; } catch {}
  // Start 20s guess phase locally (recorder won't receive audio echo)
  if (isRecorder && !guessPhaseStarted) { guessPhaseStarted = true; startGuessTimer(); }
  // Recorder UI: show waiting for guessers and hide controls
  try { if (isRecorder) { els.recorderWait?.classList.remove('hidden'); els.recorderControls?.classList.add('hidden'); } } catch {}
}

try { els.startRecBtn.addEventListener('click', () => {
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
}); } catch {}
try { els.stopRecBtn.addEventListener('click', stopRecording); } catch {}

// Press-and-hold recording on the large round button
try {
  const pressStart = (e) => {
    if (!isRecorder) return; e.preventDefault();
    document.body.classList.add('recording');
    try { els.recordButton?.classList.add('active'); } catch {}
    if (isRecordingNow) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return;
    startRecording();
  };
  const pressEnd = (e) => {
    if (!isRecorder) return; e.preventDefault();
    document.body.classList.remove('recording');
    try { els.recordButton?.classList.remove('active'); } catch {}
    stopRecording();
  };
  els.recordButton?.addEventListener('mousedown', pressStart);
  els.recordButton?.addEventListener('touchstart', pressStart, { passive: false });
  window.addEventListener('mouseup', pressEnd);
  window.addEventListener('touchend', pressEnd, { passive: false });
  window.addEventListener('touchcancel', pressEnd, { passive: false });
} catch {}

// New word button in SoundMaker card
try { els.newWord?.addEventListener('click', () => { if (isRecorder) send('newWord', {}); }); } catch {}

// Initial: ensure local profile and echoes visible on home menu
try { ensureAvatar(); } catch {}
try { loadEchoBalance(); } catch {}
// Set greeting silently using stored nickname (no prompt on landing)
try {
  const nick = (localStorage.getItem('noiseio_nick') || 'Player').toString().trim();
  if (els.greetName) els.greetName.textContent = `Salut ${nick} 👋`;
  console.log('[ui] greet set for', nick);
} catch {}
// Apply home-mode on initial load if home is visible
try { if (els.home && !els.home.classList.contains('hidden')) document.body.classList.add('home-mode'); } catch {}
// Show home (or auth if older flow)
show(els.home || els.auth);
// Ensure WS connection is established on landing for immediate CTA responsiveness
try { if (!ws || ws.readyState !== WebSocket.OPEN) { console.log('[ws] ensure connect on landing'); connectWS(); } } catch {}
try { els.startRoundBtn.disabled = true; } catch {}
try {
  els.secretInput.addEventListener('input', () => {
    els.startRoundBtn.disabled = !els.secretInput.value.trim();
  });
} catch {}

// Random word button (only next recorder should use it, UI gate below)
try { els.newWordBtn.addEventListener('click', () => { send('newWord', {}); }); } catch {}
try { els.newWordInRoundBtn.addEventListener('click', () => { send('newWord', {}); }); } catch {}


// ==========================
// Boutique Dynamique (MVP)
// ==========================

// Raretés, catalogue, et prix indicatifs
const SHOP_RARITIES = {
  common: { key: 'common', label: 'Commun', color: '#78dca0', min: 50, max: 100, cls: 'rarity-common' },
  rare: { key: 'rare', label: 'Rare', color: '#50b4ff', min: 200, max: 300, cls: 'rarity-rare' },
  epic: { key: 'epic', label: 'Épique', color: '#a57bff', min: 380, max: 420, cls: 'rarity-epic' },
  legendary: { key: 'legendary', label: 'Légendaire', color: '#ffd166', min: 600, max: 1000, cls: 'rarity-legendary' },
};

// Catalogue (mappé aux assets d'avatars existants)
const CATALOG = {
  common: ['skin1.jpg','skin2.jpg','skin3.jpg','skin4.jpg','skin5.jpg'],
  rare: ['skin6.jpg','skin7.jpg'],
  epic: ['skin8.jpg','skin9.jpg'],
  legendary: ['skin10.jpg']
};

// Stockage local
const LS_OWNED = 'noiseio_owned_skins';
const LS_DAILY_PREFIX = 'noiseio_shop_';
const LS_CHEST_DAY = 'noiseio_chest_day';

function getOwnedSkins() {
  try { return JSON.parse(localStorage.getItem(LS_OWNED) || '[]'); } catch { return []; }
}
function setOwnedSkins(arr) {
  try { localStorage.setItem(LS_OWNED, JSON.stringify(arr || [])); } catch {}
}
function isOwned(file) { try { return getOwnedSkins().includes(file); } catch { return false; } }
function addOwned(file) {
  const set = new Set(getOwnedSkins()); set.add(file); setOwnedSkins([...set]);
}

// Jour local (clé) et minuit local
function localDayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function msUntilNextMidnightLocal() {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1, 0, 0, 0, 0);
  return Math.max(0, next - d);
}

// RNG déterministe (par jour) pour une rotation stable
function hashString(s) { let h = 2166136261; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619);} return h>>>0; }
function makeRng(seedStr) {
  let s = hashString(seedStr) || 123456789;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2**32; };
}

function pickInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }

// Construire la sélection du jour (4 items uniques), pondérée par rareté
function buildDailyShop() {
  const key = localDayKey();
  const cacheKey = LS_DAILY_PREFIX + key;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}
  const rng = makeRng(key);
  const pool = [];
  const pushWeighted = (rarityKey, files, weight) => { files.forEach(f => { pool.push({ rarity: rarityKey, file: f, w: weight }); }); };
  pushWeighted('common', CATALOG.common, 60);
  pushWeighted('rare', CATALOG.rare, 25);
  pushWeighted('epic', CATALOG.epic, 10);
  pushWeighted('legendary', CATALOG.legendary, 5);
  // Tirage pondéré unique
  const picks = [];
  const pickedFiles = new Set();
  const totalWeight = pool.reduce((a,b)=>a+b.w,0);
  for (let i=0; i<4; i++) {
    let r = rng() * totalWeight;
    let choice = pool[0];
    for (const it of pool) { r -= it.w; if (r <= 0) { choice = it; break; } }
    // éviter doublons
    let safety = 0;
    while (pickedFiles.has(choice.file) && safety++ < 20) {
      choice = pool[pickInt(rng, 0, pool.length-1)];
    }
    pickedFiles.add(choice.file);
    const rar = SHOP_RARITIES[choice.rarity];
    const price = (choice.rarity === 'epic') ? 400 : pickInt(rng, rar.min, rar.max);
    picks.push({ file: choice.file, rarity: choice.rarity, price });
  }
  try { localStorage.setItem(cacheKey, JSON.stringify(picks)); } catch {}
  return picks;
}

// Rendu UI de la boutique
function renderShop() {
  try { loadEchoBalance(); } catch {}
  const items = buildDailyShop();
  els.shopGrid.innerHTML = '';
  items.forEach((it, idx) => {
    const rar = SHOP_RARITIES[it.rarity];
    const card = document.createElement('div'); card.className = `shop-card ${rar.cls}`;
    const imgWrap = document.createElement('div'); imgWrap.className = 'img';
    const halo = document.createElement('div'); halo.className = 'halo'; imgWrap.appendChild(halo);
    const img = document.createElement('img'); img.src = avatarUrl(it.file); img.alt = it.file; imgWrap.appendChild(img);
    const name = document.createElement('div'); name.className = 'name'; name.textContent = it.file.replace(/\.(png|jpg|jpeg)$/i,'');
    const price = document.createElement('div'); price.className = 'price'; price.textContent = `${it.price} Échos`;
    const btn = document.createElement('button'); btn.className = 'buy-btn btn'; btn.textContent = 'Acheter';
    const owned = isOwned(it.file);
    const notEnough = !owned && (echoBalance < it.price);
    if (owned) { btn.textContent = 'Possédé'; btn.disabled = true; card.classList.add('owned'); }
    else if (notEnough) { btn.disabled = true; }
    btn.addEventListener('click', () => {
      // Achat: déduire le solde et marquer comme possédé
      if (isOwned(it.file)) return;
      if (echoBalance < it.price) { setStatusBanner('Pas assez d\'Échos', 'danger'); vibrate(60); return; }
      addEchos(-it.price, 'achat'); // simple déduction
      addOwned(it.file);
      try { confetti({ spread: 70, particleCount: 120, origin: { y: 0.6 } }); } catch {}
      plop(); vibrate(30);
      btn.textContent = 'Possédé'; btn.disabled = true; card.classList.add('owned');
    });
    card.appendChild(imgWrap); card.appendChild(name); card.appendChild(price); card.appendChild(btn);
    els.shopGrid.appendChild(card);
  });
}

// Timer de rotation vers minuit local
let shopTimerItv = null;
function startShopTimer() {
  if (shopTimerItv) clearInterval(shopTimerItv);
  const update = () => {
    const ms = msUntilNextMidnightLocal();
    const h = Math.floor(ms/3600000);
    const m = Math.floor((ms%3600000)/60000);
    const s = Math.floor((ms%60000)/1000);
    els.shopTimer.textContent = `🕒 Nouveau stock dans ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (ms <= 1000) {
      // Invalidate cache et re-render
      try { localStorage.removeItem(LS_DAILY_PREFIX + localDayKey()); } catch {}
      renderShop();
    }
  };
  update();
  shopTimerItv = setInterval(update, 1000);
}

// Coffre gratuit du jour
function chestAvailableToday() {
  try { return localStorage.getItem(LS_CHEST_DAY) !== localDayKey(); } catch { return true; }
}
function markChestOpened() { try { localStorage.setItem(LS_CHEST_DAY, localDayKey()); } catch {} }
function renderChest() {
  const available = chestAvailableToday();
  els.openChestBtn.disabled = !available;
  els.chestStatus.textContent = available ? 'Disponible' : 'Déjà ouvert';
}
try {
  els.openChestBtn.addEventListener('click', () => {
    if (!chestAvailableToday()) return;
    const rng = makeRng('chest-' + localDayKey());
    const reward = pickInt(rng, 10, 30);
    addEchos(reward, 'coffre');
    markChestOpened();
    try { confetti({ spread: 80, particleCount: 150, origin: { y: 0.6 } }); } catch {}
    plop(); vibrate(40);
    renderChest();
  });
} catch {}

// Navigation Boutique
try {
  els.openShopBtn.addEventListener('click', () => {
    renderShop(); startShopTimer(); renderChest();
    show(els.shop);
  });
} catch {}
try {
  els.shopBackBtn.addEventListener('click', () => {
    show(els.home);
  });
} catch {}
