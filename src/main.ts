import './style.css';
import { AudioEngine } from './audio';
import { generateChanges, type Change } from './changes';
import { resolveTap, type Point } from './hit';
import { KINDS, patternsOf } from './catalog';
import { COLOR_NAMES } from './palette';
import { ambienceFor, drawCtx, renderItems, renderLighting, renderRoom } from './render';
import { makeRng, randomSeed } from './rng';
import { generateScene, type Box, type Scene } from './room';
import {
  CHANGE_TYPES, LIFE_BACK_EVERY, MAX_LIVES, MUTE_KEY, START_LIVES, WRONG_TAP_PENALTY_MS,
  difficulty, isNewBest, loadBest, roundScore, saveBest, type Best, type ChangeType, type Difficulty,
} from './scoring';

// ---------- DOM ----------
const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const svg = $<SVGSVGElement>('#room');
const gBg = $<SVGGElement>('#bg');
const gItems = $<SVGGElement>('#items');
const gLight = $<SVGGElement>('#light');
const gMarks = $<SVGGElement>('#marks');
const stage = $('#stage');
const overlay = $('#overlay');
const statusEl = $('#status');
const timerFill = $('#timer-fill');
const peekBtn = $<HTMLButtonElement>('#peek');
const muteBtn = $<HTMLButtonElement>('#mute');
const livesEl = $('#lives');
const roundEl = $('#round');
const scoreEl = $('#score');
const bestEl = $('#best');

// ---------- storage ----------
const store: Storage | null = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
const readMuted = () => {
  try {
    return store?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

// ---------- options (handy for testing: ?seed=1&type=color&round=8) ----------
const params = new URLSearchParams(location.search);
const forcedType = CHANGE_TYPES.includes(params.get('type') as ChangeType) ? (params.get('type') as ChangeType) : undefined;
const startRound = Math.max(1, Number(params.get('round')) || 1);
const seedParam = params.get('seed');
const gameRng = makeRng(seedParam ? Number(seedParam) : randomSeed());

// ---------- state ----------
type Phase = 'title' | 'memorize' | 'blink' | 'find' | 'peek' | 'result' | 'over';
interface State {
  phase: Phase;
  round: number;
  lives: number;
  score: number;
  streak: number;
  diff: Difficulty;
  before: Scene;
  after: Scene;
  changes: Change[];
  found: Set<Change>;
  peeks: number;
  perfect: boolean;
  deadline: number;
  pausedRemaining: number | null;
  lastTick: number;
  showing: 'before' | 'after';
}
const audio = new AudioEngine(readMuted());
let best: Best | null = loadBest(store);
const S: State = {
  phase: 'title', round: 0, lives: START_LIVES, score: 0, streak: 0, diff: difficulty(1),
  before: { items: [], nextId: 1 }, after: { items: [], nextId: 1 }, changes: [], found: new Set(),
  peeks: 0, perfect: true, deadline: 0, pausedRemaining: null, lastTick: 0, showing: 'before',
};
let token = 0; // bumps on every new game so stale timeouts do nothing

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------- rendering ----------
function showScene(which: 'before' | 'after') {
  S.showing = which;
  const scene = which === 'before' ? S.before : S.after;
  gItems.innerHTML = renderItems(scene);
  gLight.innerHTML = renderLighting(ambienceFor(S.round), scene);
}

function drawHud() {
  livesEl.innerHTML = Array.from({ length: MAX_LIVES }, (_, i) =>
    `<svg viewBox="0 0 24 22" class="${i < S.lives ? 'on' : 'off'}"><path d="M12 21 C5 15 1 11 1 6.5 A5.5 5.5 0 0 1 12 4 A5.5 5.5 0 0 1 23 6.5 C23 11 19 15 12 21z"/></svg>`).join('');
  livesEl.setAttribute('aria-label', `${S.lives} lives`);
  roundEl.textContent = S.round ? String(S.round) : '–';
  scoreEl.textContent = S.score.toLocaleString();
  bestEl.textContent = (best?.score ?? 0).toLocaleString();
}

function drawMute() {
  muteBtn.innerHTML = audio.muted
    ? `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke-width="2"/></svg>`
    : `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke-width="2"/></svg>`;
  muteBtn.setAttribute('aria-pressed', String(audio.muted));
  muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute music and sound' : 'Mute music and sound');
}

function setStatus(html: string) {
  statusEl.innerHTML = html;
}

function setTimer(fraction: number, mode: 'view' | 'find' | 'idle') {
  timerFill.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
  timerFill.dataset.mode = mode;
  timerFill.classList.toggle('low', mode === 'find' && fraction < 0.25);
}

function ringFor(b: Box, cls: string): string {
  const pad = 9;
  return `<rect class="${cls}" x="${b.x - pad}" y="${b.y - pad}" width="${b.w + pad * 2}" height="${b.h + pad * 2}" rx="12"/>`;
}

function markFound(c: Change) {
  gMarks.insertAdjacentHTML('beforeend', c.targets.map((t) => ringFor(t, 'ring found')).join(''));
}

function markMiss(p: Point) {
  const id = `x${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  gMarks.insertAdjacentHTML('beforeend', `<g id="${id}" class="miss" transform="translate(${p.x} ${p.y})"><circle r="16"/><path d="M-7 -7 L7 7 M7 -7 L-7 7"/></g>`);
  setTimeout(() => document.getElementById(id)?.remove(), 900);
}

function overlayCard(html: string) {
  overlay.innerHTML = `<div class="card">${html}</div>`;
  overlay.classList.add('show');
  const btn = overlay.querySelector<HTMLButtonElement>('button.primary');
  btn?.focus({ preventScroll: true });
}

function hideOverlay() {
  overlay.classList.remove('show');
  overlay.innerHTML = '';
}

async function blink(swap: () => void) {
  stage.classList.add('closing');
  audio.blink();
  await wait(190);
  swap();
  gMarks.innerHTML = '';
  await wait(130);
  stage.classList.remove('closing');
  await wait(190);
}

// ---------- flow ----------
function titleScreen() {
  S.phase = 'title';
  S.round = 0;
  gBg.innerHTML = renderRoom(ambienceFor(1));
  S.before = generateScene(makeRng(7), 22);
  showScene('before');
  drawHud();
  setTimer(0, 'idle');
  setStatus('Study the room. Blink. Find what changed.');
  overlayCard(`
    <h1>After<span>image</span></h1>
    <p class="lede">A cozy room. A blink. Something is different.</p>
    <ol class="how">
      <li><b>Study</b> the room while the bar runs down.</li>
      <li>The room <b>blinks</b>. One thing has changed: moved, gone, new, recoloured, swapped or turned.</li>
      <li><b>Tap the change.</b> A wrong tap costs 3 seconds. Run out of time and you lose a heart.</li>
    </ol>
    <p class="small">Later rooms are fuller, faster and subtler, with two or three changes at once.</p>
    <button class="btn primary" data-act="start">Start</button>
    ${best ? `<p class="small">Best: ${best.score.toLocaleString()} points (round ${best.round})</p>` : ''}
  `);
}

function startGame() {
  token++;
  audio.start();
  S.round = startRound - 1;
  S.lives = START_LIVES;
  S.score = 0;
  S.streak = 0;
  hideOverlay();
  void nextRound();
}

async function nextRound() {
  const my = token;
  hideOverlay();
  S.round++;
  S.diff = difficulty(S.round);
  const rng = makeRng(Math.floor(gameRng.next() * 2 ** 31));
  S.before = generateScene(rng, S.diff.itemCount, S.diff.closedSurfaces);
  const res = generateChanges(S.before, rng, S.diff, forcedType);
  S.after = res.after;
  S.changes = res.changes;
  S.found = new Set();
  S.peeks = 0;
  S.perfect = true;
  gMarks.innerHTML = '';
  gBg.innerHTML = renderRoom(ambienceFor(S.round));
  showScene('before');
  drawHud();
  peekBtn.disabled = true;
  S.phase = 'memorize';
  const n = S.changes.length;
  setStatus(`<b>Round ${S.round}.</b> Memorize the room${n > 1 ? ` — <b>${n} things</b> will change` : ''}.`);

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (my !== token) return resolve();
      const f = 1 - (performance.now() - start) / S.diff.viewMs;
      setTimer(f, 'view');
      if (f <= 0) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
  if (my !== token) return;
  S.phase = 'blink';
  await blink(() => showScene('after'));
  if (my !== token) return;
  beginFind();
}

function beginFind() {
  S.phase = 'find';
  S.deadline = performance.now() + S.diff.findMs;
  S.lastTick = Math.ceil(S.diff.findMs / 1000);
  peekBtn.disabled = false;
  updateFindStatus();
  requestAnimationFrame(findLoop);
}

function updateFindStatus() {
  const n = S.changes.length;
  const left = n - S.found.size;
  setStatus(n === 1 ? 'What changed? <b>Tap it.</b>' : `What changed? <b>${left} of ${n}</b> left to find.`);
}

function remaining(): number {
  return S.pausedRemaining ?? Math.max(0, S.deadline - performance.now());
}

function findLoop() {
  if (S.phase !== 'find' && S.phase !== 'peek') return;
  const rem = remaining();
  setTimer(rem / S.diff.findMs, 'find');
  const secs = Math.ceil(rem / 1000);
  if (secs < S.lastTick) {
    S.lastTick = secs;
    if (secs <= 3 && secs > 0) audio.tick();
  }
  if (rem <= 0 && S.phase === 'find') return void timeUp();
  requestAnimationFrame(findLoop);
}

async function peek() {
  if (S.phase !== 'find') return;
  S.phase = 'peek';
  S.peeks++;
  peekBtn.disabled = true;
  setStatus('Looking again…');
  const my = token;
  await blink(() => showScene('before'));
  await wait(Math.max(900, S.diff.viewMs * 0.35));
  if (my !== token) return;
  await blink(() => {
    showScene('after');
  });
  if (my !== token) return;
  for (const c of S.found) markFound(c);
  S.phase = 'find';
  peekBtn.disabled = false;
  updateFindStatus();
  if (remaining() <= 0) timeUp();
}

function svgPoint(e: PointerEvent): { p: Point; scale: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { p: { x: pt.x, y: pt.y }, scale: ctm.a };
}

function onTap(e: PointerEvent) {
  if (S.phase !== 'find') return;
  const hit = svgPoint(e);
  if (!hit) return;
  // ~22 CSS px of forgiveness, whatever the screen size.
  const tolerance = 22 / hit.scale;
  const pending = S.changes.filter((c) => !S.found.has(c));
  const c = resolveTap(hit.p, pending, S.after, tolerance);
  if (c) {
    S.found.add(c);
    markFound(c);
    audio.found();
    if (S.found.size === S.changes.length) void roundWon();
    else updateFindStatus();
  } else {
    markMiss(hit.p);
    audio.wrong();
    S.perfect = false;
    S.deadline -= WRONG_TAP_PENALTY_MS;
    stage.classList.remove('shake');
    void stage.offsetWidth;
    stage.classList.add('shake');
    setStatus(`Not that. <b>−3 s</b>`);
    setTimeout(() => S.phase === 'find' && updateFindStatus(), 900);
  }
}

function changeList(cs: Change[], cls = ''): string {
  return `<ul class="changes ${cls}">${cs.map((c) => `<li><span class="tag">${label(c.type)}</span>${c.description}</li>`).join('')}</ul>`;
}

function label(t: ChangeType): string {
  return { moved: 'Moved', removed: 'Gone', added: 'New', color: 'Colour', pattern: 'Pattern', swapped: 'Swapped', rotated: 'Turned' }[t];
}

async function roundWon() {
  S.phase = 'result';
  peekBtn.disabled = true;
  const rem = remaining();
  const res = roundScore({ round: S.round, found: S.changes.length, remainingMs: rem, peeks: S.peeks, streak: S.streak });
  S.score += res.total;
  S.streak = S.perfect && S.peeks === 0 ? S.streak + 1 : 0;
  let bonusLife = false;
  if (S.round % LIFE_BACK_EVERY === 0 && S.lives < MAX_LIVES) {
    S.lives++;
    bonusLife = true;
  }
  audio.roundClear();
  drawHud();
  setTimer(rem / S.diff.findMs, 'idle');
  setStatus(`<b>+${res.total}</b> points`);
  await wait(650);
  const parts = [`${res.base} found`, res.timeBonus ? `${res.timeBonus} time` : '', res.multiplier !== 1 ? `×${res.multiplier.toFixed(2).replace(/\.?0+$/, '')}` : ''].filter(Boolean);
  overlayCard(`
    <h2>Spotted!</h2>
    ${changeList(S.changes)}
    <p class="points">+${res.total} <small>${parts.join(' · ')}</small></p>
    ${S.streak > 1 ? `<p class="small">Perfect streak: ${S.streak} rooms</p>` : ''}
    ${bonusLife ? `<p class="small heart-back">♥ A heart came back.</p>` : ''}
    <button class="btn primary" data-act="next">Next room</button>
  `);
}

async function timeUp() {
  S.phase = 'result';
  peekBtn.disabled = true;
  S.lives--;
  S.streak = 0;
  audio.lifeLost();
  drawHud();
  setTimer(0, 'idle');
  const missed = S.changes.filter((c) => !S.found.has(c));
  gMarks.insertAdjacentHTML('beforeend', missed.flatMap((c) => c.targets.map((t) => ringFor(t, 'ring missed'))).join(''));
  setStatus('Time! Here is what you missed.');
  await wait(900);
  const over = S.lives <= 0;
  overlayCard(`
    <h2>${over ? 'Out of hearts' : 'Missed it'}</h2>
    ${changeList(missed, 'missed')}
    <div class="row">
      <button class="btn ghost" data-act="compare">Show before</button>
      <button class="btn primary" data-act="${over ? 'over' : 'next'}">${over ? 'See score' : 'Next room'}</button>
    </div>
  `);
  overlay.classList.add('peekable');
}

function toggleCompare(btn: HTMLButtonElement) {
  const toBefore = S.showing === 'after';
  showScene(toBefore ? 'before' : 'after');
  btn.textContent = toBefore ? 'Show after' : 'Show before';
}

function gameOver() {
  S.phase = 'over';
  audio.gameOver();
  const newBest = isNewBest(S.score, best);
  if (newBest) {
    best = { score: S.score, round: S.round };
    saveBest(store, best);
  }
  drawHud();
  setStatus('Game over.');
  overlayCard(`
    <h2>${newBest ? 'New best!' : 'Game over'}</h2>
    <p class="final">${S.score.toLocaleString()}<small>points</small></p>
    <p>You reached <b>round ${S.round}</b>.</p>
    ${best && !newBest ? `<p class="small">Best: ${best.score.toLocaleString()} (round ${best.round})</p>` : ''}
    <button class="btn primary" data-act="start">Play again</button>
  `);
}

// ---------- events ----------
overlay.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'start') startGame();
  else if (act === 'next') {
    overlay.classList.remove('peekable');
    void nextRound();
  } else if (act === 'over') {
    overlay.classList.remove('peekable');
    gameOver();
  } else if (act === 'compare') toggleCompare(btn);
});

svg.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  onTap(e);
});

peekBtn.addEventListener('click', () => void peek());

muteBtn.addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  try {
    store?.setItem(MUTE_KEY, audio.muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  drawMute();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') muteBtn.click();
});

document.addEventListener('visibilitychange', () => {
  const hidden = document.hidden;
  audio.suspend(hidden);
  if (S.phase === 'find' || S.phase === 'peek') {
    if (hidden) S.pausedRemaining = Math.max(0, S.deadline - performance.now());
    else if (S.pausedRemaining !== null) {
      S.deadline = performance.now() + S.pausedRemaining;
      S.pausedRemaining = null;
    }
  }
});

// Expose read-only state for automated browser checks.
(window as unknown as { __afterimage: unknown }).__afterimage = {
  get state() {
    return { phase: S.phase, round: S.round, lives: S.lives, score: S.score, changes: S.changes, found: S.found.size, muted: audio.muted, audio: audio.debugState() };
  },
  /** inspection only: flip the visible room between the two versions */
  show: (which: 'before' | 'after') => showScene(which),
};

/** ?gallery shows every item kind (art QA). */
function gallery() {
  overlay.classList.remove('show');
  gBg.innerHTML = '<rect width="1000" height="800" fill="#f2e2c8"/>';
  const cols = 10;
  gItems.innerHTML = KINDS.map((k, i) => {
    const cx = 50 + (i % cols) * 100, cy = 120 + Math.floor(i / cols) * 130;
    const pats = patternsOf(k);
    const item = { id: 900 + i, kind: k.id, slot: 'table-1', color: COLOR_NAMES[i % COLOR_NAMES.length], pattern: pats[Math.min(1, pats.length - 1)], rot: 0, flip: false, v: i * 7 + 3 };
    const { ctx, defs } = drawCtx(item);
    const sc = Math.min(1, 110 / k.h, 90 / k.w);
    return `<g transform="translate(${cx} ${cy}) scale(${sc.toFixed(2)})" stroke="#4a3426" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${defs ? `<defs>${defs}</defs>` : ''}${k.draw(ctx)}</g><text x="${cx}" y="${cy + 14}" font-size="9" text-anchor="middle" fill="#4a3426">${k.id}</text>`;
  }).join('');
}

drawMute();
if (params.has('gallery')) gallery();
else titleScreen();
