import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import {
  barHeight, changeText, experimentModel, pulseModel, campaignModel, answersModel, loadResults,
} from '../../public/results/model.js';
import { api } from '../../public/js/site.js';

const DATA = {
  experiment: {
    started: 12, finished: 8,
    pre: { connected: 2.88, mood: 3.13, stress: 3.63 },
    post: { connected: 3.75, mood: 3.63, stress: 3.0 },
    actions: { talk_new: 5, eat_together: 4 },
  },
  pulse: { n: 40, mean: 5.2, counts: { 3: 2, 4: 6 } },
  counters: { 'scan:1': 10, 'scan:3': 5, challenge_done: 4, game_played: 9 },
  answers: ['approved answer text'],
};

test('5. bar height on a fixed 1 to 5 axis and change text from two-decimal means', () => {
  assert.equal(barHeight(1), 0);
  assert.equal(barHeight(5), 100);
  assert.equal(barHeight(3), 50);
  assert.equal(changeText(2.88, 3.75), 'up 0.87');
  assert.equal(changeText(3.63, 3.0), 'down 0.63');
  assert.equal(changeText(3.13, 3.13), 'no change');
  const chart = experimentModel(DATA.experiment).chart;
  assert.equal(chart[0].text, '2.88 to 3.75, up 0.87');
  assert.equal(chart[2].note, 'Lower is better.');
});

test('6. pre null is the under-5 state with no bar data; pulse counts null likewise', () => {
  const m = experimentModel({ started: 7, finished: 3, pre: null, post: null, actions: null });
  assert.equal(m.chart, null);
  assert.equal(m.actions, null);
  assert.equal(m.waiting, 'The chart appears when 5 volunteers have finished. So far: 3 finished, 7 started.');
  assert.doesNotMatch(JSON.stringify(m), /Pct/);
  const p = pulseModel({ n: 4, mean: null, counts: null });
  assert.equal(p.bars, null);
  assert.match(p.waiting, /5 students/);
  assert.equal(pulseModel(DATA.pulse).bars.length, 7);
});

test('7. campaign totals the six scan counters, missing as zero, with titles', () => {
  const c = campaignModel(DATA.counters);
  assert.equal(c.totalScans, 15);
  assert.equal(c.scans.length, 6);
  assert.deepEqual(c.scans.map((s) => s.count), [10, 0, 5, 0, 0, 0]);
  assert.deepEqual(c.scans.map((s) => [s.n, s.title]), [
    [1, 'Did you know?'], [2, 'Take a 30-second challenge'], [3, 'How connected are you?'],
    [4, 'Listen'], [5, 'Your turn'], [6, 'Learn more'],
  ]);
  assert.equal(c.clips, 0);
  assert.equal(campaignModel({}).totalScans, 0);
});

test('8. answers: empty state, text kept as text, no innerHTML in our folders', async () => {
  assert.deepEqual(answersModel([]), { empty: true, text: 'No answers yet. Add the first one.' });
  const evil = '<img src=x onerror=alert(1)>';
  assert.deepEqual(answersModel([evil]).items, [evil]);
  for (const dir of ['experiment', 'results', 'admin']) {
    const url = new URL(`../../public/${dir}/`, import.meta.url);
    for (const f of (await readdir(url)).filter((n) => n.endsWith('.js'))) {
      assert.doesNotMatch(await readFile(new URL(f, url), 'utf8'), /innerHTML|outerHTML|insertAdjacentHTML/, `${dir}/${f}`);
    }
  }
  const page = await readFile(new URL('../../public/results/results.js', import.meta.url), 'utf8');
  assert.match(page, /el\('p', 'card answer', t\)/, 'answers go through el(), which sets textContent');
  assert.match(page, /node\.textContent = text/);
  assert.match(page, /\$\{g\.label\}\. \$\{g\.note\}/, 'the table row carries "Lower is better."');
});

test('9. a failed results load is the alert state with no numbers', async () => {
  globalThis.fetch = async () => Response.json({ error: { code: 'internal', message: 'Something went wrong.' } }, { status: 500 });
  assert.deepEqual(await loadResults(api), { state: 'error', message: 'Something went wrong.' });
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  const n = await loadResults(api);
  assert.equal(n.state, 'error');
  assert.deepEqual(Object.keys(n), ['state', 'message']);
  assert.doesNotMatch(JSON.stringify(n), /\d/);
  globalThis.fetch = async () => Response.json(DATA);
  assert.equal((await loadResults(api)).state, 'ok');
});
