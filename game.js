// ── DOM refs ──────────────────────────────────────────────────────────────────
const elAiCount     = document.getElementById('ai-count');
const elPlayerCount = document.getElementById('player-count');
const elPileCount   = document.getElementById('pile-count');
const elPilePrev    = document.getElementById('pile-prev');
const elPileTop     = document.getElementById('pile-top');
const elStatus      = document.getElementById('status-msg');
const btnFlip       = document.getElementById('btn-flip');
const btnSnap       = document.getElementById('btn-snap');
const elOverlay     = document.getElementById('overlay');
const elOverTitle   = document.getElementById('overlay-title');
const elOverBody    = document.getElementById('overlay-body');
const btnPlayAgain  = document.getElementById('btn-play-again');
const elAiDeck      = document.getElementById('ai-deck-visual');
const elPlayerDeck  = document.getElementById('player-deck-visual');
const elCpuBar          = document.getElementById('cpu-bar');
const elPlayerBar       = document.getElementById('player-bar');
const elStreakBox        = document.getElementById('snap-streak');
const elStreakCount      = document.getElementById('streak-count');
const elStreakFire       = document.getElementById('streak-fire');
const elCpuSnapCount    = document.getElementById('cpu-snap-count');
const elPlayerSnapCount = document.getElementById('player-snap-count');

// ── State ─────────────────────────────────────────────────────────────────────
let player, ai, pile, state, currentTurn;
let aiFlipTimer, aiSnapTimer, noSnapTimer;
let snapStreak = 0;

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ── Initialise ────────────────────────────────────────────────────────────────
function initGame() {
  clearTimeout(aiFlipTimer);
  clearTimeout(aiSnapTimer);
  clearTimeout(noSnapTimer);

  player = new Player('You');
  ai     = new Player('CPU');
  pile   = [];

  const deck = new Deck();
  deck.shuffle();
  const [h1, h2] = deck.deal(2);
  player.hand = h1;
  ai.hand     = h2;

  currentTurn = 'player';
  snapStreak   = 0;
  elOverlay.hidden = true;

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
      btnSnap.hidden   = true;
      setStatus(currentTurn === 'player'
        ? "Your turn — flip a card! [Space]"
        : "CPU's turn…");

      if (currentTurn === 'ai') {
        btnFlip.disabled = true;
        aiFlipTimer = setTimeout(doAiFlip, rand(700, 1300));
      }
      break;

    case 'AWAITING_AI':
      btnFlip.disabled = true;
      btnSnap.hidden   = true;
      setStatus("CPU is thinking…");
      aiFlipTimer = setTimeout(doAiFlip, rand(700, 1300));
      break;

    case 'SNAP_WINDOW':
      btnFlip.disabled = true;
      btnSnap.hidden   = false;
      setStatus(`⚡ SNAP! Both cards are ${pile[pile.length - 1].value}s — call it! [Enter]`);
      // AI races to snap
      aiSnapTimer = setTimeout(doAiSnap, rand(700, 2200));
      // Safety timeout: close window if nobody snaps
      noSnapTimer = setTimeout(noSnap, 4000);
      break;

    case 'GAME_OVER': {
      btnFlip.disabled = true;
      btnSnap.hidden   = true;
      clearTimeout(aiFlipTimer);
      clearTimeout(aiSnapTimer);
      clearTimeout(noSnapTimer);
      const won = player.cardCount >= ai.cardCount;
      elOverTitle.textContent = won ? '🏆 You Win!' : '💻 CPU Wins!';
      elOverBody.textContent  =
        `Final cards — You: ${player.cardCount} | CPU: ${ai.cardCount}  ` +
        `Piles won — You: ${player.score} | CPU: ${ai.score}`;
      elOverlay.hidden = false;
      break;
    }
  }
}

// ── Flip logic ────────────────────────────────────────────────────────────────
function doPlayerFlip() {
  if (state !== 'PLAYER_TURN' || currentTurn !== 'player') return;
  btnFlip.disabled = true;
  const card = player.flip();
  if (!card) { transition('GAME_OVER'); return; }
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
  pile.push(card);
  renderPile();
  renderCounts();
  if (checkSnap()) { transition('SNAP_WINDOW'); return; }
  currentTurn = 'player';
  transition('PLAYER_TURN');
}

// ── Snap logic ────────────────────────────────────────────────────────────────
function checkSnap() {
  return pile.length >= 2 &&
    pile[pile.length - 1].value === pile[pile.length - 2].value;
}

function doPlayerSnap() {
  if (state !== 'SNAP_WINDOW') return;
  clearTimeout(aiSnapTimer);
  clearTimeout(noSnapTimer);
  snapStreak++;
  renderStreak();
  awardPile(player);
  renderSnapCounters(player);
  setStatus(`You called SNAP and won the pile! 🎉 (streak: ${snapStreak})`);
  currentTurn = 'player';
  transition('PLAYER_TURN');
}

function doAiSnap() {
  if (state !== 'SNAP_WINDOW') return;
  clearTimeout(noSnapTimer);
  snapStreak = 0;
  renderStreak();
  const pileSize = pile.length;
  awardPile(ai);
  renderSnapCounters(ai);
  setStatus(`CPU called SNAP and won the pile of ${pileSize} cards! 🤖`);
  currentTurn = 'ai';
  transition('PLAYER_TURN');
}

function noSnap() {
  if (state !== 'SNAP_WINDOW') return;
  clearTimeout(aiSnapTimer);
  snapStreak = 0;
  renderStreak();
  btnSnap.hidden = true;
  setStatus("No snap called — pile stays. Next player's turn.");
  currentTurn = currentTurn === 'player' ? 'ai' : 'player';
  transition('PLAYER_TURN');
}

function awardPile(winner) {
  const won = pile.splice(0);   // take all, reset pile
  winner.takeCards(won);
  winner.score++;
  renderCounts();
  renderPile();
}

// ── Render helpers ────────────────────────────────────────────────────────────
function renderCard(el, card) {
  if (!card) {
    el.className = 'card empty';
    el.innerHTML = '';
    return;
  }
  el.className = `card face-up ${card.color}`;
  el.innerHTML = `
    <span class="corner top-left">${card.value}<br>${card.symbol}</span>
    <span class="center-suit">${card.symbol}</span>
    <span class="corner bottom-right">${card.value}<br>${card.symbol}</span>
  `;
  // Trigger flip-in animation
  el.classList.remove('flip-in');
  void el.offsetWidth; // reflow
  el.classList.add('flip-in');
}

function renderPile() {
  const top  = pile.length > 0 ? pile[pile.length - 1] : null;
  const prev = pile.length > 1 ? pile[pile.length - 2] : null;
  renderCard(elPileTop,  top);
  renderCard(elPilePrev, prev);
  elPileCount.textContent = `Pile: ${pile.length} card${pile.length !== 1 ? 's' : ''}`;
}

function renderCounts() {
  elPlayerCount.textContent = player.cardCount;
  elAiCount.textContent     = ai.cardCount;

  updateStack(elPlayerDeck, player.cardCount);
  updateStack(elAiDeck,     ai.cardCount);

  // Health bars — percentage of the 52-card total each player holds
  const total = player.cardCount + ai.cardCount + pile.length || 52;
  setBar(elPlayerBar, player.cardCount / 52);
  setBar(elCpuBar,    ai.cardCount    / 52);
}

function updateStack(containerEl, count) {
  const card = containerEl.querySelector('.stack-card');
  if (count === 0) {
    card.classList.add('empty');
    return;
  }
  card.classList.remove('empty');
  // Scale 1–52 onto 1–12 visual layers
  const layers = Math.max(1, Math.round((count / 52) * 12));
  const shadows = [];
  for (let i = 1; i <= layers; i++) {
    const offset = i * 2;
    shadows.push(`${offset}px ${offset}px 0 #6a1b9a`);
  }
  card.style.boxShadow = shadows.join(', ');
}

function setBar(el, ratio) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  el.style.width = `${pct}%`;
  // Colour: purple → pink → hot pink as health drops
  if (pct > 50)      el.style.background = `linear-gradient(90deg, #ab47bc, #ce93d8)`;
  else if (pct > 25) el.style.background = `linear-gradient(90deg, #e91e8c, #f48fb1)`;
  else               el.style.background = `linear-gradient(90deg, #f50057, #ff4081)`;
}

function renderStreak() {
  if (snapStreak === 0) {
    elStreakBox.classList.add('hidden');
    return;
  }
  elStreakBox.classList.remove('hidden');
  elStreakCount.textContent = `×${snapStreak}`;
  // Escalating fire emoji
  elStreakFire.textContent = snapStreak >= 5 ? '🔥🔥🔥' : snapStreak >= 3 ? '🔥🔥' : '🔥';
  // Pop animation
  elStreakBox.classList.remove('streak-pop');
  void elStreakBox.offsetWidth;
  elStreakBox.classList.add('streak-pop');
}

function renderSnapCounters(justScored = null) {
  elPlayerSnapCount.textContent = player.score;
  elCpuSnapCount.textContent    = ai.score;
  // Pop animation on the counter that just changed
  if (justScored === player) bumpCounter(elPlayerSnapCount);
  if (justScored === ai)     bumpCounter(elCpuSnapCount);
}

function bumpCounter(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function setStatus(msg) {
  elStatus.textContent = msg;
}

// ── Event listeners ───────────────────────────────────────────────────────────
btnFlip.addEventListener('click', doPlayerFlip);
btnSnap.addEventListener('click', doPlayerSnap);
btnPlayAgain.addEventListener('click', initGame);

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space') {
    e.preventDefault();
    doPlayerFlip();
  } else if (e.code === 'Enter') {
    e.preventDefault();
    if (!btnSnap.hidden) doPlayerSnap();
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
initGame();
