// Wire the Brain: the page. All rules live in engine.js; this file draws state and feeds it time.
import { api } from '/js/site.js';
import { createGame, advance, tap, view, endLine, EDGES, NEURONS, MOMENT_LIFE_MS } from '/game/engine.js';

const SVG = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const header = document.querySelector('site-header');
const footer = document.querySelector('site-footer');
const screens = { start: $('start'), play: $('play'), end: $('end') };
const board = $('board');
const brain = $('brain');
const live = $('live');

// Draw the brain once: edges under neurons, both indexed like the engine's arrays.
const edgeEls = EDGES.map(([a, b]) => {
  const line = document.createElementNS(SVG, 'line');
  line.setAttribute('class', 'edge');
  line.setAttribute('x1', NEURONS[a][0]); line.setAttribute('y1', NEURONS[a][1]);
  line.setAttribute('x2', NEURONS[b][0]); line.setAttribute('y2', NEURONS[b][1]);
  brain.querySelector('.edges').append(line);
  return line;
});
const neuronEls = NEURONS.map(([x, y], i) => {
  const dot = document.createElementNS(SVG, 'circle');
  dot.setAttribute('class', 'neuron');
  dot.setAttribute('cx', x); dot.setAttribute('cy', y);
  dot.setAttribute('r', [4, 5, 8].includes(i) ? 12 : 9);
  brain.querySelector('.neurons').append(dot);
  return dot;
});

let game = null;
let shownLit = new Set();
let shown = { connections: 0, pruned: 0 };
const buttons = new Map(); // moment id -> <button>
let frame = 0;
let lastTime = null;
// Most game time one frame may play. A longer stall (a frozen or throttled tab with no
// visibilitychange) is dropped, so moments never expire while nobody could see them.
const MAX_FRAME_MS = 250;
let pendingAnnounce = null;
let lastAnnounce = -Infinity;

function show(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  const playing = name === 'play';
  header.hidden = playing;
  footer.hidden = playing;
  document.body.classList.toggle('is-playing', playing);
}

function start() {
  const [seed] = crypto.getRandomValues(new Uint32Array(1));
  game = createGame(seed);
  shownLit = new Set();
  shown = { connections: 0, pruned: 0 };
  for (const el of edgeEls) el.classList.remove('is-lit', 'just-lit', 'just-pruned');
  for (const btn of buttons.values()) btn.remove();
  buttons.clear();
  pendingAnnounce = null;
  live.textContent = '';
  show('play');
  render(view(game));
  board.focus();
  lastTime = null;
  frame = requestAnimationFrame(loop);
}

function loop(now) {
  if (lastTime !== null) game = advance(game, Math.min(now - lastTime, MAX_FRAME_MS));
  lastTime = now;
  const v = view(game);
  render(v);
  if (v.finished) return finish(v);
  frame = requestAnimationFrame(loop);
}

// Pause while the tab is hidden: the clock only moves while someone can see the game.
document.addEventListener('visibilitychange', () => {
  if (!game || game.finished || screens.play.hidden) return;
  cancelAnimationFrame(frame);
  lastTime = null;
  if (!document.hidden) frame = requestAnimationFrame(loop);
});

const clock = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function restartAnimation(el, cls) {
  el.classList.remove('just-lit', 'just-pruned');
  void el.getBoundingClientRect(); // so the same class can play again
  el.classList.add(cls);
}

function render(v) {
  $('timer').textContent = clock(v.timeLeft);
  $('connections').textContent = v.connections;
  $('pruned').textContent = v.pruned;

  const lit = new Set(v.lit);
  edgeEls.forEach((el, i) => {
    if (lit.has(i) && !shownLit.has(i)) { el.classList.add('is-lit'); restartAnimation(el, 'just-lit'); }
    if (!lit.has(i) && shownLit.has(i)) { el.classList.remove('is-lit'); restartAnimation(el, 'just-pruned'); }
  });
  shownLit = lit;
  const litNeurons = new Set(v.lit.flatMap((e) => EDGES[e]));
  neuronEls.forEach((el, i) => el.classList.toggle('is-lit', litNeurons.has(i)));
  brain.setAttribute('aria-label', `A brain made of neurons. ${v.lit.length} of ${EDGES.length} links are lit.`);

  if (v.connections !== shown.connections || v.pruned !== shown.pruned) {
    const what = v.pruned !== shown.pruned ? 'A link was pruned.' : 'Connected.';
    pendingAnnounce = `${what} ${v.connections} connections, ${v.pruned} pruned.`;
    shown = { connections: v.connections, pruned: v.pruned };
  }
  const now = performance.now();
  if (pendingAnnounce && now - lastAnnounce >= 1000) {
    live.textContent = pendingAnnounce;
    pendingAnnounce = null;
    lastAnnounce = now;
  }

  const ids = new Set(v.moments.map((m) => m.id));
  for (const [id, btn] of buttons) if (!ids.has(id)) removeMoment(id, btn);
  for (const m of v.moments) {
    let btn = buttons.get(m.id);
    if (!btn) btn = addMoment(m);
    const share = m.life / MOMENT_LIFE_MS;
    btn.style.opacity = String(0.75 + 0.25 * share);
    btn.classList.toggle('is-fading', m.life < 1200);
    // Reduced motion shows this bar; it steps in sevenths instead of sliding.
    btn.lastChild.firstChild.style.width = `${Math.ceil(share * 7) / 7 * 100}%`;
  }
}

function addMoment(m) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'moment';
  btn.textContent = m.text;
  const bar = document.createElement('span');
  bar.className = 'moment-life';
  bar.setAttribute('aria-hidden', 'true');
  bar.append(document.createElement('span'));
  btn.append(bar);
  btn.style.left = `${m.x * 100}%`;
  btn.style.top = `calc(${m.y * 100}% + 6px)`;
  btn.addEventListener('click', () => {
    if (!game || game.finished) return;
    game = tap(game, m.id);
    render(view(game));
  });
  board.append(btn);
  buttons.set(m.id, btn);
  return btn;
}

// Keep keyboard players in the game: if the focused moment goes, focus the next one (or the board).
function removeMoment(id, btn) {
  if (document.activeElement === btn) {
    const rest = [...buttons.values()].filter((b) => b !== btn);
    const next = rest.find((b) => btn.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) || rest[0];
    (next || board).focus();
  }
  btn.remove();
  buttons.delete(id);
}

function finish(v) {
  const map = brain.cloneNode(true);
  map.removeAttribute('id');
  map.setAttribute('aria-label', `Your brain map: ${v.lit.length} of ${EDGES.length} links lit.`);
  for (const el of map.querySelectorAll('.just-lit, .just-pruned')) el.classList.remove('just-lit', 'just-pruned');
  $('end-map').replaceChildren(map);
  $('end-connections').textContent = v.connections;
  $('end-pruned').textContent = v.pruned;
  $('end-line').textContent = endLine(v.lit.length);
  show('end');
  window.scrollTo(0, 0);
  $('end-title').focus();
  live.textContent = `Round over. ${v.connections} connections, ${v.pruned} pruned.`;
  // The play counter may fail quietly: a counter must never interrupt a visitor (ARCHITECTURE.md).
  api('/api/count', { method: 'POST', body: { name: 'game_played' } }).catch(() => {});
}

$('start-btn').addEventListener('click', start);
$('again-btn').addEventListener('click', start);
