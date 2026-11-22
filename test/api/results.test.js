import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, call } from '../helpers/env.js';

let env, dispose;
beforeEach(async () => ({ env, dispose } = await makeEnv()));
afterEach(() => dispose());

const results = async () => (await (await call(env, 'GET', '/api/results')).json());
const ts = (i) => new Date(Date.UTC(2026, 10, 1) + i * 60_000).toISOString();

// [code, actions, pre c/m/s, post c/m/s or null]
const addExperiment = (code, actions, pre, post) =>
  env.DB.prepare(`INSERT INTO experiment (code, created_at, actions, pre_connected, pre_mood, pre_stress, finished_at, post_connected, post_mood, post_stress)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(code, ts(0), JSON.stringify(actions), ...pre, post ? ts(1200) : null, ...(post ?? [null, null, null]))
    .run();

const addPulse = (...rows) => env.DB.batch(rows.map(([a, b, c], i) =>
  env.DB.prepare('INSERT INTO pulse (created_at, lack, left_out, isolated) VALUES (?, ?, ?, ?)').bind(ts(i), a, b, c)));

test('11. experiment means and action counts are null below 5 finished, then cover finished rows only', async () => {
  await addExperiment('AAAAAA', ['talk_new', 'phone_free'], [1, 1, 5], [2, 3, 4]);
  await addExperiment('BBBBBB', ['talk_new', 'eat_together'], [2, 1, 4], [3, 3, 3]);
  await addExperiment('CCCCCC', ['talk_new', 'phone_free', 'shared_activity'], [3, 2, 4], [4, 4, 2]);
  await addExperiment('DDDDDD', ['eat_together', 'phone_free'], [4, 2, 3], [5, 4, 2]);
  assert.deepEqual((await results()).experiment, { started: 4, finished: 4, pre: null, post: null, actions: null });

  await addExperiment('EEEEEE', ['talk_new', 'shared_activity'], [5, 2, 3], [5, 5, 1]);
  await addExperiment('FFFFFF', ['reach_out', 'talk_new'], [5, 5, 5], null); // unfinished: changes started only
  assert.deepEqual((await results()).experiment, {
    started: 6,
    finished: 5,
    pre: { connected: 3, mood: 1.6, stress: 3.8 },
    post: { connected: 3.8, mood: 3.8, stress: 2.4 },
    actions: { talk_new: 4, phone_free: 3, eat_together: 2, shared_activity: 2 },
  });

  await addExperiment('GGGGGG', ['reach_out', 'eat_together'], [1, 1, 1], [1, 1, 1]);
  const { experiment } = await results();
  assert.deepEqual(experiment.pre, { connected: 2.67, mood: 1.5, stress: 3.33 }); // 16/6, 9/6, 20/6
  assert.deepEqual(experiment.post, { connected: 3.33, mood: 3.33, stress: 2.17 }); // 20/6, 20/6, 13/6
  assert.equal(experiment.actions.reach_out, 1);
});

test('12. pulse mean and counts are null below 5 rows, then right, with only the scores that occur', async () => {
  await addPulse([1, 1, 1], [1, 1, 2], [1, 2, 1], [3, 3, 3]);
  assert.deepEqual((await results()).pulse, { n: 4, mean: null, counts: null });
  await addPulse([2, 2, 2]);
  assert.deepEqual((await results()).pulse, { n: 5, mean: 5.2, counts: { 3: 1, 4: 2, 6: 1, 9: 1 } });
  await addPulse([1, 1, 1]);
  assert.deepEqual((await results()).pulse, { n: 6, mean: 4.83, counts: { 3: 2, 4: 2, 6: 1, 9: 1 } });
});

test('13. answers lists only approved texts, newest first, at most 50', async () => {
  const insert = (i, status) => env.DB.prepare('INSERT INTO answers (created_at, text, status) VALUES (?, ?, ?)').bind(ts(i), `${status} ${i}`, status);
  await env.DB.batch([
    ...Array.from({ length: 55 }, (_, i) => insert(i, 'approved')),
    insert(100, 'pending'),
    insert(101, 'rejected'),
  ]);
  const { answers } = await results();
  assert.equal(answers.length, 50);
  assert.deepEqual(answers, Array.from({ length: 50 }, (_, i) => `approved ${54 - i}`));
});

test('14. counters still sum across days next to the new parts', async () => {
  await call(env, 'GET', '/q/1', { now: new Date('2026-11-20T10:00:00Z') });
  await call(env, 'GET', '/q/1', { now: new Date('2026-11-21T10:00:00Z') });
  await call(env, 'POST', '/api/count', { body: { name: 'challenge_done' } });
  const res = await call(env, 'GET', '/api/results');
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=30');
  assert.deepEqual(await res.json(), {
    experiment: { started: 0, finished: 0, pre: null, post: null, actions: null },
    pulse: { n: 0, mean: null, counts: null },
    counters: { 'scan:1': 2, challenge_done: 1 },
    answers: [],
  });
});
