// ── DOM refs ──────────────────────────────────────────────────────────────────
const elAiCount      = document.getElementById('ai-count');
const elPlayerCount  = document.getElementById('player-count');
const elPileCount    = document.getElementById('pile-count');
const elPileCards    = document.getElementById('pile-cards');
const elPileArea     = document.getElementById('pile-area');
const elPileExpression = document.getElementById('pile-expression');
const elPileCardPrev = document.getElementById('pile-card-prev');
const elPileCardTop  = document.getElementById('pile-card-top');
const elStatus       = document.getElementById('status-msg');
const elSnapHint     = document.getElementById('snap-hint');
const btnFlip        = document.getElementById('btn-flip');
const btnSnap        = document.getElementById('btn-snap');
const elOverlay      = document.getElementById('overlay');
const btnPlayAgain   = document.getElementById('btn-play-again');
const btnCopy        = document.getElementById('btn-copy');
const btnNextLevel      = document.getElementById('btn-next-level');
const btnFooterShare    = document.getElementById('btn-footer-share');
const elChallengeBanner = document.getElementById('challenge-banner');
const elChallengeText   = document.getElementById('challenge-text');
const elAiDeck       = document.getElementById('ai-deck-visual');
const elPlayerDeck   = document.getElementById('player-deck-visual');
const elCpuBar           = document.getElementById('cpu-bar');
const elPlayerBar        = document.getElementById('player-bar');
const elStreakBox         = document.getElementById('snap-streak');
const elStreakCount       = document.getElementById('streak-count');
const elStreakFire        = document.getElementById('streak-fire');
const elCpuSnapCount     = document.getElementById('cpu-snap-count');
const elPlayerSnapCount  = document.getElementById('player-snap-count');
const elLevelNum          = document.getElementById('level-num');
const elLevelProgressFill = document.getElementById('level-progress-fill');
const elLevelProgressNum  = document.getElementById('level-progress-num');
const elStatLast          = document.getElementById('stat-last');
const elStatBest          = document.getElementById('stat-best');
const elStatBestSession   = document.getElementById('stat-best-session');
const elStatHits          = document.getElementById('stat-hits');
const elStatHitsSession   = document.getElementById('stat-hits-session');
const elStatRate          = document.getElementById('stat-rate');
const elStatRateSession   = document.getElementById('stat-rate-session');
const elStatMisses        = document.getElementById('stat-misses');
const elStatMissesSession = document.getElementById('stat-misses-session');
const elCpuTurnTag  = document.getElementById('cpu-turn-tag');
const elYouTurnTag  = document.getElementById('you-turn-tag');
const elSnapFlash   = document.getElementById('snap-flash');
const elCpuLabel    = document.getElementById('cpu-label');
const elYouLabel    = document.getElementById('you-label');

// ── Persistence ───────────────────────────────────────────────────────────────
let level    = 1;
let bestSnap = parseFloat(localStorage.getItem('snap-best') || 'Infinity');

function saveBest() { localStorage.setItem('snap-best', bestSnap); }

// ── State ─────────────────────────────────────────────────────────────────────
let player, ai, pile, state, currentTurn;
let aiFlipTimer, aiSnapTimer, noSnapTimer;
let snapStreak = 0;
let snapWindowOpenTime = 0;
let lastSnapTime = null;
let gameBestSnap     = Infinity;
let totalFlips       = 0;
let gameSetNewBest   = false;
let wonGame          = false;
let playerSnapHits   = 0;
let playerSnapMisses = 0;

// Session stats — accumulate across games, reset on page load
let sessionBestSnap   = Infinity;
let sessionSnapHits   = 0;
let sessionSnapMisses = 0;

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// CPU snap reaction: floor starts at 1000ms at level 1, tapers to player's best by level 4.
// Always at least the player's own best, so difficulty scales for all skill levels.
function getCpuSnapRange() {
  const playerBestMs = Math.round((isFinite(sessionBestSnap) ? sessionBestSnap : 0.8) * 1000);
  const levelFloorMs = level < 4
    ? Math.round(1000 - (level - 1) * (1000 - playerBestMs) / 3)
    : playerBestMs;
  const floorMs = Math.max(playerBestMs, levelFloorMs);
  const upperMult = 1.30 - (level - 1) * 0.03;
  return [floorMs, Math.round(floorMs * upperMult)];
}

// CPU flip delay: 1200–1600ms at level 1, −100ms per level
function getCpuFlipDelay() {
  const lo = Math.max(200, 1200 - (level - 1) * 100);
  const hi = Math.max(600, 1600 - (level - 1) * 100);
  return rand(lo, hi);
}

// ── Initialise ────────────────────────────────────────────────────────────────
function initGame() {
  clearTimeout(aiFlipTimer);
  clearTimeout(aiSnapTimer);
  clearTimeout(noSnapTimer);

  player = new Player('You');
  ai     = new Player('CPU');
  pile   = [];

  const numValues = Math.min(13, 3 + level);
  const deck = new Deck(numValues);
  deck.shuffle();
  const [h1, h2] = deck.deal(2);
  player.hand = h1;
  ai.hand     = h2;

  currentTurn      = 'player';
  snapStreak       = 0;
  lastSnapTime     = null;
  gameBestSnap     = Infinity;
  playerSnapHits   = 0;
  playerSnapMisses = 0;
  totalFlips       = 0;
  gameSetNewBest   = false;
  wonGame          = false;
  elOverlay.hidden = true;

  renderLevel();
  renderSnapStats();
  renderCounts();
  renderPile();
  renderStreak();
  renderSnapCounters();
  transition('PLAYER_TURN');
}

// ── State machine ─────────────────────────────────────────────────────────────
function transition(newState) {
  state = newState;

  switch (state) {
    case 'PLAYER_TURN':
      if (!player.hasCards()) { transition('GAME_OVER'); return; }
      btnFlip.disabled = false;
      btnSnap.classList.remove('snap-active');
      setStatus(currentTurn === 'player'
        ? "Your turn — flip a card! <span class='kbd-hint'>[Space]</span>"
        : "CPU's turn…");

      if (currentTurn === 'ai') {
        btnFlip.disabled = true;
        aiFlipTimer = setTimeout(doAiFlip, getCpuFlipDelay());
      }
      break;

    case 'AWAITING_AI':
      btnFlip.disabled = true;
      btnSnap.classList.remove('snap-active');
      setStatus("CPU is thinking…");
      aiFlipTimer = setTimeout(doAiFlip, getCpuFlipDelay());
      break;

    case 'SNAP_WINDOW':
      btnFlip.disabled = true;
      snapWindowOpenTime = Date.now();
      const [cpuMin, cpuMax] = getCpuSnapRange();
      aiSnapTimer = setTimeout(doAiSnap, rand(cpuMin, cpuMax));
      noSnapTimer = setTimeout(noSnap, 4000);
      break;

    case 'GAME_OVER': {
      btnFlip.disabled = true;
      btnSnap.classList.remove('snap-active');
      clearTimeout(aiFlipTimer);
      clearTimeout(aiSnapTimer);
      clearTimeout(noSnapTimer);
      const won = player.cardCount >= ai.cardCount;
      wonGame = won;
      showGameOverModal(won);
      break;
    }
  }
  renderTurnIndicator();
}

// ── Flip logic ────────────────────────────────────────────────────────────────
function doPlayerFlip() {
  if (state !== 'PLAYER_TURN' || currentTurn !== 'player') return;
  btnFlip.disabled = true;
  const card = player.flip();
  if (!card) { transition('GAME_OVER'); return; }
  totalFlips++;
  pile.push(card);
  renderPile();
  renderCounts();
  if (checkSnap()) { transition('SNAP_WINDOW'); return; }
  currentTurn = 'ai';
  transition('AWAITING_AI');
}

function doAiFlip() {
  if (!ai.hasCards()) { transition('GAME_OVER'); return; }
  const card = ai.flip();
  totalFlips++;
  pile.push(card);
  renderPile();
  renderCounts();
  if (checkSnap()) { transition('SNAP_WINDOW'); return; }
  if (pile.length > 1 && Math.random() < getCpuFalseSnapRate()) {
    setTimeout(doCpuFalseSnap, rand(300, 800));
    return;
  }
  currentTurn = 'player';
  transition('PLAYER_TURN');
}

// ── Snap logic ────────────────────────────────────────────────────────────────
function checkSnap() {
  return pile.length >= 2 &&
    pile[pile.length - 1].value === pile[pile.length - 2].value;
}

function getCpuFalseSnapRate() {
  // 0% at levels 1–3 (player earns wins through skill), 4% from level 4+
  return level >= 4 ? 0.04 : 0;
}

function doPlayerSnap() {
  if (state === 'GAME_OVER' || pile.length === 0) return;

  if (state === 'SNAP_WINDOW') {
    clearTimeout(aiSnapTimer);
    clearTimeout(noSnapTimer);
    showSnapFlash('snap', elYouLabel);

    const elapsed = (Date.now() - snapWindowOpenTime) / 1000;
    if (elapsed < bestSnap)    { gameSetNewBest = true; bestSnap = elapsed; saveBest(); }
    if (elapsed < gameBestSnap)    { gameBestSnap    = elapsed; }
    if (elapsed < sessionBestSnap) { sessionBestSnap = elapsed; }
    lastSnapTime = elapsed;
    playerSnapHits++;
    sessionSnapHits++;
    renderSnapStats();

    snapStreak++;
    renderStreak();
    awardPile(player);
    renderSnapCounters(player);
    setStatus(`You called SNAP and won the pile! 🎉 (streak: ${snapStreak})`);
    currentTurn = 'player';
    transition('PLAYER_TURN');
  } else {
    clearTimeout(aiFlipTimer);
    clearTimeout(aiSnapTimer);
    clearTimeout(noSnapTimer);
    showSnapFlash('deny', elYouLabel);
    snapStreak = 0;
    playerSnapMisses++;
    sessionSnapMisses++;
    renderStreak();
    renderSnapStats();
    const lost = pile.length;
    awardPile(ai);
    renderSnapCounters(ai);
    setStatus(`False snap! 😬 CPU wins the pile of ${lost} card${lost !== 1 ? 's' : ''}.`);
    currentTurn = 'ai';
    transition('PLAYER_TURN');
  }
}

function doAiSnap() {
  if (state !== 'SNAP_WINDOW') return;
  clearTimeout(noSnapTimer);
  showSnapFlash('snap', elCpuLabel);
  snapStreak = 0;
  renderStreak();
  const pileSize = pile.length;
  awardPile(ai);
  renderSnapCounters(ai);
  setStatus(`CPU called SNAP and won the pile of ${pileSize} cards! 🤖`);
  currentTurn = 'ai';
  transition('PLAYER_TURN');
}

function doCpuFalseSnap() {
  if (state !== 'PLAYER_TURN' && state !== 'AWAITING_AI') return;
  showSnapFlash('deny', elCpuLabel);
  snapStreak = 0;
  renderStreak();
  const won = pile.length;
  awardPile(player);
  renderSnapCounters(player);
  setStatus(`CPU called false snap! 🤖😬 You win the pile of ${won} card${won !== 1 ? 's' : ''}.`);
  currentTurn = 'player';
  transition('PLAYER_TURN');
}

function noSnap() {
  if (state !== 'SNAP_WINDOW') return;
  clearTimeout(aiSnapTimer);
  snapStreak = 0;
  renderStreak();
  btnSnap.classList.remove('snap-active');
  setStatus("No snap called — pile stays. Next player's turn.");
  currentTurn = currentTurn === 'player' ? 'ai' : 'player';
  transition('PLAYER_TURN');
}

function awardPile(winner) {
  const won = pile.splice(0);
  winner.takeCards(won);
  winner.score++;
  renderCounts();
  renderPile();
}

// ── Render helpers ────────────────────────────────────────────────────────────
function renderCard(el, card, animate = true) {
  if (!card) {
    el.className = 'card empty';
    el.innerHTML = '';
    return;
  }
  el.className = `card face-up ${card.color}`;
  if (card.value === 'Joker') {
    el.innerHTML = `
      <span class="corner top-left">🃏</span>
      <span class="center-suit joker-center">🃏</span>
      <span class="corner bottom-right">🃏</span>
    `;
  } else {
    el.innerHTML = `
      <span class="corner top-left">${card.value}<br>${card.symbol}</span>
      <span class="center-suit">${card.symbol}</span>
      <span class="corner bottom-right">${card.value}<br>${card.symbol}</span>
    `;
  }
  if (animate) {
    el.classList.remove('flip-in');
    void el.offsetWidth;
    el.classList.add('flip-in');
  }
}

function renderPile() {
  const top  = pile.length > 0 ? pile[pile.length - 1] : null;
  const prev = pile.length > 1 ? pile[pile.length - 2] : null;
  renderCard(elPileCardPrev, prev, false);
  renderCard(elPileCardTop,  top,  true);
  elPileCount.textContent = `Pile: ${pile.length} card${pile.length !== 1 ? 's' : ''}`;
  updatePileVisual();
  updateSnapBtn();
}

let expressionFadeTimer = null;
function updateExpression(newSrc) {
  const img = elPileExpression;
  if (img.src.endsWith(newSrc)) return;
  clearTimeout(expressionFadeTimer);
  img.style.opacity = '0';
  expressionFadeTimer = setTimeout(() => {
    img.src = newSrc;
    img.style.opacity = '1';
  }, 150);
}

function updatePileVisual() {
  const count = pile.length;

  const stage = count < 4 ? 1 : Math.min(Math.floor((count - 4) / 4) + 2, 8);
  updateExpression(`assets/face_stage_${stage}.png`);

  if (count === 0) {
    elPileCards.style.transform = '';
    elPileCardPrev.style.boxShadow = '';
    elPileArea.style.filter = '';
    elPileCount.style.cssText = '';
    return;
  }

  // Depth shadow — layers stack up behind the prev card
  const layers = Math.min(count, 12);
  const shadows = [];
  for (let i = 1; i <= layers; i++) {
    shadows.push(`${i * 2}px ${i * 2}px 0 rgba(106,27,154,0.65)`);
  }
  elPileCardPrev.style.boxShadow = shadows.join(', ');

  // Scale grows from 1.0 → 1.22 as pile approaches 26 cards
  const t = Math.min(count / 26, 1);
  const scale = (1 + t * 0.22).toFixed(3);
  elPileCards.style.transform = `scale(${scale})`;

  // Glow intensifies with pile size
  const glowPx   = Math.round(t * 22);
  const glowAlpha = (t * 0.7).toFixed(2);
  elPileArea.style.filter = `drop-shadow(0 0 ${glowPx}px rgba(233,30,140,${glowAlpha}))`;

  // Pile count text shifts from muted → alarming
  const r = Math.round(123 + t * 110);  // 123 → 233
  const g = Math.round(31  - t * 31);   // 31  → 0
  const b = Math.round(162 - t * 22);   // 162 → 140
  elPileCount.style.color    = `rgb(${r},${g},${b})`;
  elPileCount.style.fontSize = `${(0.8 + t * 0.3).toFixed(2)}rem`;
  elPileCount.style.fontWeight = t > 0.5 ? 'bold' : '';
}

function updateSnapBtn() {
  const visible = state !== 'GAME_OVER' && pile.length > 0;
  btnSnap.hidden = !visible;
  elSnapHint.classList.toggle('hidden', !visible);
}

function renderLevel() {
  elLevelNum.textContent         = level;
  elLevelProgressNum.textContent = level;
  elLevelProgressFill.style.width = `${level * 10}%`;
}

function renderSnapStats() {
  // Game column
  elStatLast.textContent   = lastSnapTime !== null  ? `${lastSnapTime.toFixed(2)}s` : '—';
  elStatBest.textContent   = isFinite(gameBestSnap) ? `${gameBestSnap.toFixed(2)}s` : '—';
  elStatHits.textContent   = playerSnapHits;
  elStatMisses.textContent = playerSnapMisses;
  const gameTotal = playerSnapHits + playerSnapMisses;
  elStatRate.textContent   = gameTotal > 0 ? `${Math.round((playerSnapHits / gameTotal) * 100)}%` : '—';

  // Session column
  elStatBestSession.textContent   = isFinite(sessionBestSnap) ? `${sessionBestSnap.toFixed(2)}s` : '—';
  elStatHitsSession.textContent   = sessionSnapHits;
  elStatMissesSession.textContent = sessionSnapMisses;
  const sessTotal = sessionSnapHits + sessionSnapMisses;
  elStatRateSession.textContent   = sessTotal > 0 ? `${Math.round((sessionSnapHits / sessTotal) * 100)}%` : '—';
}

function renderCounts() {
  elPlayerCount.textContent = player.cardCount;
  elAiCount.textContent     = ai.cardCount;
  updateStack(elPlayerDeck, player.cardCount);
  updateStack(elAiDeck,     ai.cardCount);
  setBar(elPlayerBar, player.cardCount / 52);
  setBar(elCpuBar,    ai.cardCount     / 52);
}

function updateStack(containerEl, count) {
  const card = containerEl.querySelector('.stack-card');
  if (count === 0) { card.classList.add('empty'); return; }
  card.classList.remove('empty');
  const layers = Math.max(1, Math.round((count / 52) * 12));
  const shadows = [];
  for (let i = 1; i <= layers; i++) {
    shadows.push(`${i * 2}px ${i * 2}px 0 #6a1b9a`);
  }
  card.style.boxShadow = shadows.join(', ');
}

function setBar(el, ratio) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  el.style.width = `${pct}%`;
  if (pct > 50)      el.style.background = `linear-gradient(90deg, #ab47bc, #ce93d8)`;
  else if (pct > 25) el.style.background = `linear-gradient(90deg, #e91e8c, #f48fb1)`;
  else               el.style.background = `linear-gradient(90deg, #f50057, #ff4081)`;
}

function renderStreak() {
  if (snapStreak === 0) { elStreakBox.classList.add('hidden'); return; }
  elStreakBox.classList.remove('hidden');
  elStreakCount.textContent = `×${snapStreak}`;
  elStreakBox.classList.remove('streak-pop');
  void elStreakBox.offsetWidth;
  elStreakBox.classList.add('streak-pop');
}

function renderSnapCounters(justScored = null) {
  elPlayerSnapCount.textContent = player.score;
  elCpuSnapCount.textContent    = ai.score;
  if (justScored === player) bumpCounter(elPlayerSnapCount);
  if (justScored === ai)     bumpCounter(elCpuSnapCount);
}

function bumpCounter(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function setStatus(msg) { elStatus.innerHTML = msg; }

let snapSuccessFrame = 1;
let snapFailFrame    = 1;
function showSnapFlash(type, targetEl) {
  const rect = targetEl.getBoundingClientRect();
  elSnapFlash.style.left = `${rect.left + rect.width / 2}px`;
  elSnapFlash.style.top  = `${rect.top  + rect.height / 2}px`;
  elSnapFlash.className = '';

  if (type === 'snap') {
    elSnapFlash.innerHTML = `<img class="flash-image" src="assets/snap_success_${snapSuccessFrame}.png" alt="" />`;
    snapSuccessFrame = snapSuccessFrame === 1 ? 2 : 1;
  } else {
    elSnapFlash.innerHTML = `<img class="flash-image" src="assets/snap_fail_${snapFailFrame}.png" alt="" />`;
    snapFailFrame = snapFailFrame === 1 ? 2 : 1;
  }

  void elSnapFlash.offsetWidth;
  elSnapFlash.classList.add(type === 'snap' ? 'flash-snap' : 'flash-deny');
}

function renderTurnIndicator() {
  const playerTurn = state === 'PLAYER_TURN' && currentTurn === 'player';
  const cpuTurn    = state === 'AWAITING_AI' || (state === 'PLAYER_TURN' && currentTurn === 'ai');
  elYouTurnTag.textContent  = playerTurn ? '▶ YOUR TURN' : '';
  elCpuTurnTag.textContent  = cpuTurn    ? '▶ YOUR TURN' : '';
}

// ── Game-over modal ────────────────────────────────────────────────────────────
function showGameOverModal(won) {
  const bannerNum = Math.floor(Math.random() * 5) + 1;
  const bannerEl = document.getElementById('modal-banner');
  bannerEl.src = won ? `assets/win_banner_${bannerNum}.png` : `assets/lose_banner_${bannerNum}.png`;
  bannerEl.alt = won ? 'You won!' : 'You lost!';

  document.getElementById('modal-title').textContent    = won ? 'You Won!'  : 'So Close!';
  document.getElementById('modal-subtitle').textContent = won
    ? 'The CPU never stood a chance 😎'
    : 'The CPU got you this time...';

  // Confetti (win only)
  const confettiContainer = document.getElementById('confetti-container');
  confettiContainer.innerHTML = '';
  if (won) launchConfetti(confettiContainer);

  // Stats pills
  const bestTimeStr = isFinite(gameBestSnap) ? `${gameBestSnap.toFixed(2)}s` : '—';
  document.getElementById('modal-stats').innerHTML = `
    <div class="stat-pill"><span class="stat-pill-value">${playerSnapHits}</span>snaps</div>
    <div class="stat-pill"><span class="stat-pill-value">${totalFlips}</span>cards</div>
    <div class="stat-pill"><span class="stat-pill-value">⚡ ${bestTimeStr}</span>best time</div>
  `;

  // New best badge (win + new record only)
  const badge = document.getElementById('modal-best-badge');
  badge.classList.toggle('hidden', !(won && gameSetNewBest));

  // Level row
  document.getElementById('modal-level-label').textContent = `Level ${level}`;
  const track = document.getElementById('modal-level-track');
  const fill  = document.getElementById('modal-level-fill');
  track.className = won ? 'win' : 'lose';
  fill.className  = won ? 'win' : 'lose';
  fill.style.width = `${level * 10}%`;

  // Share text
  const shareTimeStr = isFinite(gameBestSnap) ? `${gameBestSnap.toFixed(2)}s` : null;
  const shareText = won
    ? `${playerSnapHits} snaps in ${totalFlips} cards ⚡${shareTimeStr ? ` ${shareTimeStr} top reaction speed —` : ''} Can you SNAP faster? playsnap.net`
    : `The CPU beat me at Snap${shareTimeStr ? ` — my best reaction was ${shareTimeStr}` : ''} — think you can do better? 😤 playsnap.net`;
  document.getElementById('modal-share-text').textContent = shareText;

  // Copy button
  btnCopy.textContent = won ? '📋 Copy & Share' : '📋 Challenge a Friend';

  // Win: single "Next Level 🃏" button; Lose: "Rematch! 🔥"
  if (won) {
    btnPlayAgain.hidden      = true;
    btnNextLevel.textContent = 'Next Level 🃏';
    btnNextLevel.className   = 'modal-btn modal-btn-purple';
  } else {
    btnPlayAgain.hidden      = false;
    btnPlayAgain.textContent = 'Rematch! 🔥';
    btnPlayAgain.className   = 'modal-btn modal-btn-coral modal-btn-pulse';
    btnNextLevel.classList.add('hidden');
  }

  // Pop-in animation
  const modal = document.getElementById('modal');
  modal.classList.remove('modal-pop');
  void modal.offsetWidth;
  modal.classList.add('modal-pop');

  elOverlay.hidden = false;
}

function launchConfetti(container) {
  const colors = ['#FF6B8A', '#FFD166', '#7DD4C0', '#6B35A3', '#fff', '#FF8FA3'];
  for (let i = 0; i < 28; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const size = 6 + Math.random() * 6;
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-delay: ${(Math.random() * 1.2).toFixed(2)}s;
      animation-duration: ${(1.4 + Math.random() * 0.8).toFixed(2)}s;
    `;
    container.appendChild(piece);
  }
}

// ── Challenge banner on load ───────────────────────────────────────────────────
function checkChallengeBanner() {
  const params = new URLSearchParams(window.location.search);
  const piles  = params.get('piles');
  const lvl    = params.get('level');
  const best   = params.get('best');
  if (!piles || !lvl) return;
  let msg = `🏆 Challenge: can you win more than ${piles} pile${piles !== '1' ? 's' : ''} at level ${lvl}`;
  if (best) msg += ` with a snap faster than ${best}s`;
  msg += `? Good luck!`;
  elChallengeText.textContent = msg;
  elChallengeBanner.classList.remove('hidden');
}

// ── Event listeners ───────────────────────────────────────────────────────────
btnFlip.addEventListener('click', doPlayerFlip);
btnSnap.addEventListener('click', doPlayerSnap);
btnPlayAgain.addEventListener('click', initGame);
btnNextLevel.addEventListener('click', () => {
  if (wonGame && level < 10) level++;
  initGame();
});
btnFooterShare.addEventListener('click', () => {
  const text = `I'm on level ${level} at PlaySnap — think you can get further? 🃏 playsnap.net`;
  const orig = btnFooterShare.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btnFooterShare.textContent = '✅ Copied!';
    setTimeout(() => { btnFooterShare.textContent = orig; }, 2000);
  });
});
btnCopy.addEventListener('click', () => {
  const text = document.getElementById('modal-share-text').textContent;
  const orig = btnCopy.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btnCopy.textContent = '✅ Copied!';
    setTimeout(() => { btnCopy.textContent = orig; }, 2000);
  });
});

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space') {
    e.preventDefault();
    doPlayerFlip();
  } else if (e.code === 'Enter') {
    e.preventDefault();
    doPlayerSnap();
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
checkChallengeBanner();
initGame();
