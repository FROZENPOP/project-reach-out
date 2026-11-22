// Wire the Brain: the whole game as pure functions. No DOM, no clock.
// A state is plain data; createGame/advance/tap return a new state and never mutate their input.
// Moment positions are fractions of the play area (0..1 on both axes).

export const ROUND_MS = 60_000;
export const MOMENT_LIFE_MS = 3_500;
export const MAX_MOMENTS = 3;
export const FIRST_SPAWN_MS = 400;
export const SPAWN_START_MS = 1_400;
export const SPAWN_END_MS = 1_000;

// A moment's footprint on the play area. Rows give each on-screen moment its own band,
// so two can never overlap; x is free within the row.
export const MOMENT_W = 0.7;
export const ROWS = 6;
export const MOMENT_H = 1 / ROWS;

// Neurons in the brain SVG's viewBox (342 x 470).
export const NEURONS = [
  [150, 110], [210, 105], [100, 150], [255, 145], [160, 170], [220, 180], [75, 215],
  [130, 230], [195, 240], [270, 225], [105, 290], [165, 300], [235, 295], [180, 355],
];

// Candidate edges: every pair of near neighbours (33 with these positions).
export const EDGES = [];
for (let a = 0; a < NEURONS.length; a++) {
  for (let b = a + 1; b < NEURONS.length; b++) {
    const [ax, ay] = NEURONS[a];
    const [bx, by] = NEURONS[b];
    if (Math.hypot(ax - bx, ay - by) < 100) EDGES.push([a, b]);
  }
}

export const MOMENT_TEXTS = [
  'Sat with someone new at lunch',
  'Called grandma',
  'Phone-free walk with a friend',
  'Asked a classmate how they are',
  'Ate dinner with family',
  'Texted an old friend back',
  'Joined a pickup game',
  'Helped a neighbor out',
  'Said hi in the hallway',
  'Studied with a friend',
  'Thanked a teacher',
  'Played a board game together',
  'Cooked with a parent',
  'Walked the dog with a sibling',
  'Invited someone to sit down',
  'Really listened to a friend',
  'Joined a club meeting',
  'Laughed with a teammate',
  'Shot hoops with a friend',
  'Shared headphones on the bus',
  'Called a cousin',
  'Complimented a friend',
  'Volunteered with a friend',
  'Made plans for the weekend',
  'Wrote a note to someone',
  'Asked someone to join in',
];

// mulberry32: a small seeded generator. Returns [value in [0, 1), next seed].
function rand(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

function pick(game, list) {
  const [r, seed] = rand(game.seed);
  game.seed = seed;
  return list[Math.floor(r * list.length)];
}

export function createGame(seed) {
  return {
    seed: seed >>> 0,
    time: 0,
    nextSpawn: FIRST_SPAWN_MS,
    nextId: 1,
    moments: [], // { id, text, x, y, row, born }
    lit: [],     // indices into EDGES, in the order they lit
    connections: 0,
    pruned: 0,
    finished: false,
  };
}

const clone = (game) => ({ ...game, moments: game.moments.map((m) => ({ ...m })), lit: [...game.lit] });

// The gap between spawns shrinks from SPAWN_START_MS to SPAWN_END_MS over the round.
const spawnGap = (time) => SPAWN_START_MS + (SPAWN_END_MS - SPAWN_START_MS) * Math.min(time / ROUND_MS, 1);

function spawn(game) {
  const used = new Set(game.moments.map((m) => m.row));
  const row = pick(game, [...Array(ROWS).keys()].filter((r) => !used.has(r)));
  const onScreen = new Set(game.moments.map((m) => m.text));
  const text = pick(game, MOMENT_TEXTS.filter((t) => !onScreen.has(t)));
  const [r, seed] = rand(game.seed);
  game.seed = seed;
  game.moments.push({ id: game.nextId++, text, row, x: r * (1 - MOMENT_W), y: row * MOMENT_H, born: game.time });
}

function lightOne(game) {
  const lit = new Set(game.lit);
  const litNeurons = new Set(game.lit.flatMap((e) => EDGES[e]));
  const unlit = EDGES.map((_, i) => i).filter((i) => !lit.has(i));
  if (unlit.length === 0) return;
  const touching = unlit.filter((i) => EDGES[i].some((n) => litNeurons.has(n)));
  game.lit.push(pick(game, touching.length ? touching : unlit));
}

function pruneOne(game) {
  if (game.lit.length === 0) return;
  const victim = pick(game, game.lit);
  game.lit = game.lit.filter((e) => e !== victim);
  game.pruned += 1;
}

// Moves the clock forward by ms, handling every spawn and expiry in time order.
export function advance(game, ms) {
  if (game.finished) return game;
  const g = clone(game);
  const end = Math.min(g.time + Math.max(0, ms), ROUND_MS);
  for (;;) {
    const expiry = g.moments.length ? Math.min(...g.moments.map((m) => m.born + MOMENT_LIFE_MS)) : Infinity;
    const canSpawn = g.moments.length < MAX_MOMENTS;
    const next = Math.min(expiry, canSpawn ? g.nextSpawn : Infinity);
    if (next > end || next >= ROUND_MS) break;
    g.time = Math.max(g.time, next);
    if (expiry === next) {
      g.moments = g.moments.filter((m) => m.born + MOMENT_LIFE_MS > g.time);
      pruneOne(g);
    } else {
      spawn(g);
      g.nextSpawn = g.time + spawnGap(g.time);
    }
  }
  // A full screen delays the next spawn (nextSpawn stays in the past) rather than dropping it.
  g.time = end;
  if (g.time >= ROUND_MS) {
    g.finished = true;
    g.moments = [];
  }
  return g;
}

// Catches the moment with this id, if it is on screen.
export function tap(game, id) {
  if (game.finished || !game.moments.some((m) => m.id === id)) return game;
  const g = clone(game);
  g.moments = g.moments.filter((m) => m.id !== id);
  g.connections += 1;
  lightOne(g);
  return g;
}

// What the page reads each frame.
export function view(game) {
  return {
    timeLeft: ROUND_MS - game.time,
    moments: game.moments.map((m) => ({ id: m.id, text: m.text, x: m.x, y: m.y, w: MOMENT_W, h: MOMENT_H,
      life: m.born + MOMENT_LIFE_MS - game.time })),
    lit: [...game.lit],
    connections: game.connections,
    pruned: game.pruned,
    finished: game.finished,
  };
}

// The end screen's line, by the share of the brain that is lit. Never shaming.
export function endLine(litCount, total = EDGES.length) {
  if (litCount * 3 >= total * 2) return 'Most of your map is glowing. That is what a lot of small moments add up to.';
  if (litCount * 3 >= total) return 'A good part of your map is glowing. Every link came from one small moment.';
  return 'A few links are glowing. Each one started with one small moment, and there is always another round.';
}
