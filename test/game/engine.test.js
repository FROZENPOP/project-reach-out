import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, advance, tap, view, endLine, EDGES, NEURONS, MOMENT_TEXTS, ROUND_MS, MOMENT_LIFE_MS, MAX_MOMENTS,
} from '../../public/game/engine.js';

const STEP = 50;

// Plays a round in STEP ms frames. onFrame(game) returns the game after any taps.
function play(seed, onFrame = (g) => g) {
  let g = createGame(seed);
  while (!g.finished) g = onFrame(advance(g, STEP));
  return g;
}
const perfect = (g) => g.moments.reduce((acc, m) => tap(acc, m.id), g);
const untilMoment = (g) => { while (g.moments.length === 0) g = advance(g, STEP); return g; };
const touches = (e, lit) => EDGES[e].some((n) => lit.some((l) => EDGES[l].includes(n)));

test('1. same seed and inputs give the same state; another seed gives different moments', () => {
  const script = (g) => (g.time % 1000 === 0 && g.moments[0] ? tap(g, g.moments[0].id) : g);
  assert.deepEqual(play(7, script), play(7, script));
  const texts = (seed) => {
    const seen = [];
    play(seed, (g) => { for (const m of g.moments) if (!seen.includes(m.id + m.text)) seen.push(m.id + m.text); return g; });
    return seen;
  };
  assert.notDeepEqual(texts(7), texts(8));
});

test('2. at most 3 moments, each lives 3.5 s, inside the play area, never overlapping', () => {
  for (const seed of [1, 2, 3, 99]) {
    const born = new Map();
    const lastSeen = new Map();
    play(seed, (g) => {
      const v = view(g);
      assert.ok(v.moments.length <= MAX_MOMENTS);
      for (const m of v.moments) {
        assert.ok(m.x >= 0 && m.y >= 0 && m.x + m.w <= 1 + 1e-9 && m.y + m.h <= 1 + 1e-9, 'inside');
        assert.ok(m.life > 0 && m.life <= MOMENT_LIFE_MS);
        if (!born.has(m.id)) born.set(m.id, g.time - (MOMENT_LIFE_MS - m.life));
        assert.equal(g.time - (MOMENT_LIFE_MS - m.life), born.get(m.id), 'birth time stays fixed');
        lastSeen.set(m.id, g.time);
      }
      for (const a of v.moments) for (const b of v.moments) {
        if (a.id >= b.id) continue;
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        assert.ok(apart, `moments ${a.id} and ${b.id} overlap`);
      }
      return g;
    });
    assert.ok(born.size > 20);
    for (const [id, b] of born) {
      const end = b + MOMENT_LIFE_MS;
      if (end >= ROUND_MS) continue; // still on screen when the round ended
      assert.ok(lastSeen.get(id) < end && lastSeen.get(id) >= end - STEP, `moment ${id} lived 3.5 s`);
    }
  }
});

test('3. tapping a live moment removes it, lights one edge, adds one connection; bad ids change nothing', () => {
  const g = untilMoment(createGame(5));
  const m = g.moments[0];
  const after = tap(g, m.id);
  assert.ok(!after.moments.some((x) => x.id === m.id));
  assert.equal(after.lit.length, g.lit.length + 1);
  assert.equal(after.connections, g.connections + 1);
  assert.deepEqual(tap(g, 9999), g);
  assert.deepEqual(tap(after, m.id), after, 'already caught');
  let expired = g;
  while (expired.moments.some((x) => x.id === m.id)) expired = advance(expired, STEP);
  assert.deepEqual(tap(expired, m.id), expired, 'expired');
});

test('4. an expired moment prunes one lit edge and adds one to Pruned; with nothing lit, neither changes', () => {
  // Nothing lit: the first moment fades and nothing is counted.
  let g = untilMoment(createGame(11));
  const first = g.moments[0].id;
  while (g.moments.some((m) => m.id === first)) {
    const next = advance(g, STEP);
    if (!next.moments.some((m) => m.id === first)) {
      assert.equal(next.pruned, 0);
      assert.equal(next.lit.length, 0);
    }
    g = next;
  }
  // Light a few, then let one fade.
  g = createGame(11);
  for (let i = 0; i < 3; i++) { g = untilMoment(g); g = tap(g, g.moments[0].id); }
  g = untilMoment(g);
  const id = g.moments[0].id;
  while (g.moments.some((m) => m.id === id)) {
    const next = advance(g, 10);
    const expiredNow = g.moments.filter((m) => !next.moments.some((n) => n.id === m.id)).length;
    if (expiredNow) {
      assert.equal(next.pruned, g.pruned + 1);
      assert.equal(next.lit.length, g.lit.length - 1);
      assert.ok(next.lit.every((e) => g.lit.includes(e)));
    }
    g = next;
  }
});

test('5. lit edges never repeat; each new edge touches the lit network when it can', () => {
  for (let seed = 1; seed <= 20; seed++) {
    play(seed, (g) => {
      if (!g.moments[0] || g.time % 300 !== 0) return g; // catch some, miss some
      const after = tap(g, g.moments[0].id);
      assert.equal(new Set(after.lit).size, after.lit.length, 'no repeats');
      if (g.lit.length === EDGES.length) return after; // criterion 6
      const added = after.lit.filter((e) => !g.lit.includes(e));
      assert.equal(added.length, 1);
      const canTouch = EDGES.some((_, e) => !g.lit.includes(e) && touches(e, g.lit));
      if (g.lit.length && canTouch) assert.ok(touches(added[0], g.lit), 'grows as one web');
      return after;
    });
  }
});

test('6. with every edge lit, a tap still counts and changes no edge', () => {
  let full = null;
  play(3, (g) => {
    if (!full && g.lit.length === EDGES.length && g.moments[0]) full = g;
    return perfect(g);
  });
  assert.ok(full, 'perfect player lit every edge');
  const after = tap(full, full.moments[0].id);
  assert.equal(after.connections, full.connections + 1);
  assert.deepEqual(after.lit, full.lit);
});

test('7. finished at exactly 60 000 ms; taps and time after that change nothing', () => {
  let g = advance(createGame(4), ROUND_MS - 1);
  assert.equal(g.finished, false);
  assert.equal(view(g).timeLeft, 1);
  g = advance(g, 1);
  assert.equal(g.finished, true);
  assert.equal(view(g).timeLeft, 0);
  assert.deepEqual(advance(g, 5000), g);
  for (let id = 0; id < 100; id++) assert.deepEqual(tap(g, id), g);
  assert.equal(advance(createGame(4), ROUND_MS + 999).time, ROUND_MS);
});

test('8. a perfect player ends with 0 pruned and 30+ connections; an idle player with 0 and 0', () => {
  for (const seed of [1, 2, 3]) {
    const best = play(seed, perfect);
    assert.equal(best.pruned, 0);
    assert.ok(best.connections >= 30, `${best.connections} connections`);
    const idle = play(seed);
    assert.equal(idle.connections, 0);
    assert.equal(idle.pruned, 0);
  }
});

test('9. at least 24 moment texts, all different, 2 to 6 words; brain has ~14 neurons and 30+ edges', () => {
  assert.ok(MOMENT_TEXTS.length >= 24);
  assert.equal(new Set(MOMENT_TEXTS).size, MOMENT_TEXTS.length);
  for (const t of MOMENT_TEXTS) {
    const words = t.trim().split(/\s+/).length;
    assert.ok(words >= 2 && words <= 6, t);
  }
  assert.ok(NEURONS.length >= 12 && NEURONS.length <= 16);
  assert.ok(EDGES.length >= 30);
});

test('11. end line has three tiers at 1/3 and 2/3 lit, none shaming', () => {
  const lines = new Set();
  const tier = (lit) => { const l = endLine(lit, 30); lines.add(l); return l; };
  assert.equal(tier(0), tier(9));
  assert.notEqual(tier(9), tier(10));
  assert.equal(tier(10), tier(19));
  assert.notEqual(tier(19), tier(20));
  assert.equal(tier(20), tier(30));
  assert.equal(lines.size, 3);
  for (const l of lines) assert.doesNotMatch(l, /lonely|fail|bad/i);
});
