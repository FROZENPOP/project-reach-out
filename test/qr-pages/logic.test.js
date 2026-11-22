import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pickOther, shortCitation } from '../../public/fact/logic.js';
import { pickChallenge } from '../../public/challenge/logic.js';
import { buildPulseBody, resultsView, loadResultsView } from '../../public/pulse/logic.js';
import { podcastView } from '../../public/listen/logic.js';
import { validateAnswer, counterText } from '../../public/your-turn/logic.js';
import { qrUrl, qrMatrix, qrSvgParts, QUIET } from '../../public/posters/logic.js';
import qrcode from '../../public/vendor/qrcode.js';

const json = async (path) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));

// Small seeded PRNG (mulberry32) so draws are repeatable.
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

test('1. fact picker never repeats the fact just shown and reaches every fact', async () => {
  const facts = await json('public/data/facts.json');
  const rand = seeded(42);
  const seen = new Set();
  let last = pickOther(facts.length, -1, rand);
  seen.add(last);
  for (let i = 0; i < 2000; i++) {
    const next = pickOther(facts.length, last, rand);
    assert.notEqual(next, last);
    assert.ok(next >= 0 && next < facts.length);
    seen.add(next);
    last = next;
  }
  assert.equal(seen.size, facts.length);
  for (const r of [0, 0.5, 0.999999]) assert.notEqual(pickOther(facts.length, facts.length - 1, () => r), facts.length - 1);
});

test('2. every fact ref exists, and short citations are right', async () => {
  const facts = await json('public/data/facts.json');
  const refs = new Map((await json('public/data/references.json')).map((r) => [r.id, r]));
  for (const f of facts) assert.ok(refs.has(f.ref), f.ref);
  assert.equal(shortCitation(refs.get('tomova2020').apa), 'Tomova et al., 2020');
  assert.equal(shortCitation(refs.get('blakemore2014').apa), 'Blakemore & Mills, 2014');
  assert.equal(shortCitation(refs.get('osg2023').apa), 'Office of the Surgeon General, 2023');
});

test('3. challenge picker never repeats the one just shown', async () => {
  const challenges = await json('public/data/challenges.json');
  const rand = seeded(7);
  let last = 0;
  for (let i = 0; i < 2000; i++) {
    const next = pickChallenge(challenges.length, last, rand);
    assert.notEqual(next, last);
    last = next;
  }
});

test('4. pulse body maps labels to 1, 2, 3 and refuses until all three are answered', () => {
  assert.deepEqual(buildPulseBody({ lack: 'Hardly ever', left_out: 'Some of the time', isolated: 'Often' }), { lack: 1, left_out: 2, isolated: 3 });
  assert.equal(buildPulseBody({}), null);
  assert.equal(buildPulseBody({ lack: 'Often', left_out: 'Often' }), null);
  assert.equal(buildPulseBody({ lack: 'Often', left_out: 'Often', isolated: 'Always' }), null);
});

const realFetch = globalThis.fetch;

test('5. pulse results view: few, seven bars with you marked, the Often note (even when results fail), singular, no labelling words', async () => {
  const few = resultsView({ pulse: { n: 3, mean: null, counts: null } }, { lack: 1, left_out: 1, isolated: 1 });
  assert.equal(few.few, 'Not enough answers yet to show the group.');
  assert.equal(few.bars, null);
  assert.equal(few.often, null);
  assert.equal(few.thanks, 'Thanks. 3 students have answered.');

  const view = resultsView({ pulse: { n: 40, mean: 5.2, counts: { 3: 2, 4: 6, 7: 1 } } }, { lack: 1, left_out: 3, isolated: 1 });
  assert.equal(view.few, null);
  assert.deepEqual(view.bars.map((b) => b.total), [3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(view.bars.map((b) => b.count), [2, 6, 0, 0, 1, 0, 0]);
  assert.deepEqual(view.bars.filter((b) => b.you).map((b) => b.total), [5]);
  assert.match(view.often, /call or text 988/);
  assert.equal(resultsView({ pulse: { n: 40, counts: { 6: 1 } } }, { lack: 2, left_out: 2, isolated: 2 }).often, null);

  assert.equal(resultsView({ pulse: { n: 1, counts: null } }, { lack: 1, left_out: 1, isolated: 1 }).thanks, 'Thanks. 1 student has answered.');
  assert.equal(resultsView({ pulse: { n: 2, counts: null } }, { lack: 1, left_out: 1, isolated: 1 }).thanks, 'Thanks. 2 students have answered.');

  // The support note never depends on the results request.
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  try {
    const failed = await loadResultsView({ lack: 1, left_out: 1, isolated: 3 });
    assert.match(failed.error, /Could not load/);
    assert.match(failed.often, /counselor or an adult you trust.*call or text 988/);
    assert.equal((await loadResultsView({ lack: 2, left_out: 1, isolated: 2 })).often, null);
  } finally {
    globalThis.fetch = realFetch;
  }

  const strings = JSON.stringify([few, view]).toLowerCase();
  for (const word of ['lonely', 'high', 'low', 'good', 'bad']) assert.ok(!strings.includes(word), word);
});

test('6. podcast view: embed, link or soon; bad hosts, http and javascript: are rejected', () => {
  const p = (embed_url, link_url = '') => podcastView({ title: 'Ep 1', summary: 'S', embed_url, link_url });
  assert.equal(p('https://open.spotify.com/embed/episode/abc').kind, 'embed');
  assert.equal(p('https://www.youtube-nocookie.com/embed/xyz').kind, 'embed');
  assert.equal(p('https://embed.podcasts.apple.com/us/podcast/x').kind, 'embed');
  assert.equal(p('', 'https://example.com/ep1').kind, 'link');
  assert.equal(p('', '').kind, 'soon');
  assert.equal(podcastView(undefined).kind, 'soon');
  assert.equal(p('https://evil.example/embed').kind, 'soon');
  assert.equal(p('https://open.spotify.com.evil.example/embed').kind, 'soon');
  assert.equal(p('http://open.spotify.com/embed/episode/abc').kind, 'soon');
  assert.equal(p('https://evil.example/embed', 'https://example.com/ep1').kind, 'link');
  assert.equal(p('', 'javascript:alert(1)').kind, 'soon');
  assert.equal(p('', 'http://example.com/ep1').kind, 'soon');
});

test('7. answer validator trims and bounds by code point; counter at 0, 279, 280', () => {
  assert.deepEqual(validateAnswer('  hi  '), { ok: true, text: 'hi' });
  assert.equal(validateAnswer('   \n ').ok, false);
  assert.equal(validateAnswer('').ok, false);
  assert.equal(validateAnswer('😀'.repeat(280)).ok, true); // 560 UTF-16 units, 280 code points
  assert.equal(validateAnswer('a'.repeat(281)).ok, false);
  assert.equal(validateAnswer(` ${'a'.repeat(280)} `).ok, true);
  assert.equal(counterText(''), '0 of 280 characters');
  assert.equal(counterText('a'.repeat(279)), '279 of 280 characters');
  assert.equal(counterText('😀'.repeat(280)), '280 of 280 characters');
});

test('8. poster URLs are <origin>/q/<n>', () => {
  for (let n = 1; n <= 6; n++) {
    assert.equal(qrUrl('https://reachout.example', n), `https://reachout.example/q/${n}`);
    assert.equal(qrUrl('http://localhost:8787', n), `http://localhost:8787/q/${n}`);
    assert.equal(qrUrl('http://localhost:8787/', n), `http://localhost:8787/q/${n}`);
  }
});

test('9. encoder gives a square matrix with finder patterns; the SVG adds a 4-module quiet zone', () => {
  const m = qrMatrix('https://example.com/q/1');
  const n = m.length;
  assert.ok(n >= 21 && (n - 17) % 4 === 0);
  for (const row of m) assert.equal(row.length, n);
  // A finder pattern is a 7x7 dark ring, a light ring, and a dark 3x3 centre.
  const finder = (r0, c0) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        assert.equal(m[r0 + r][c0 + c], ring !== 2, `finder at ${r0},${c0} cell ${r},${c}`);
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);

  // Error correction level from the format bits next to the top-left finder: XOR 0x5412, top two bits are L 01, M 00, Q 11, H 10.
  const cells = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  const level = (matrix) => ((cells.reduce((a, [r, c]) => (a << 1) | (matrix[r][c] ? 1 : 0), 0) ^ 0x5412) >> 13);
  assert.equal(level(m), 0b00, 'level M');
  const l = qrcode(0, 'L');
  l.addData('https://example.com/q/1');
  l.make();
  const lMatrix = Array.from({ length: l.getModuleCount() }, (_, r) => Array.from({ length: l.getModuleCount() }, (_, c) => l.isDark(r, c)));
  assert.equal(level(lMatrix), 0b01, 'the reader tells level L apart');

  const { size, path } = qrSvgParts('https://example.com/q/1');
  assert.equal(QUIET, 4);
  assert.equal(size, n + 8);
  const xs = [...path.matchAll(/M(\d+) (\d+)/g)].map((p) => [Number(p[1]), Number(p[2])]);
  assert.equal(xs.length, m.flat().filter(Boolean).length);
  assert.equal(Math.min(...xs.flat()), 4);
  assert.equal(Math.max(...xs.flat()), n + 3);
});
