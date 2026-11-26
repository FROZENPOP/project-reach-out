import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, call } from '../helpers/env.js';
import { routes } from '../../src/worker/index.js';

let env, dispose;
beforeEach(async () => ({ env, dispose } = await makeEnv()));
afterEach(() => dispose());

const today = () => new Date().toISOString().slice(0, 10);
const rows = async () => (await env.DB.prepare('SELECT name, day, count FROM counters ORDER BY name, day').all()).results;
const quietly = async (fn) => {
  const original = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = original; }
};

test('1. /q/3 redirects to flyer 3 and counts scan:3 today; /q/1..6 map to their flyers', async () => {
  const res = await call(env, 'GET', '/q/3');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('Location'), '/flyer/?n=3');
  assert.deepEqual(await rows(), [{ name: 'scan:3', day: today(), count: 1 }]);
  for (const i of [0, 1, 2, 3, 4, 5]) {
    const page = `/flyer/?n=${i + 1}`;
    const r = await call(env, 'GET', `/q/${i + 1}`);
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('Location'), page);
  }
});

test('2. /q/9 and /q/abc redirect to / and write nothing', async () => {
  for (const path of ['/q/9', '/q/abc']) {
    const res = await call(env, 'GET', path);
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), '/');
  }
  assert.deepEqual(await rows(), []);
});

test('3. /q/1 still redirects when the database write throws', async () => {
  const broken = { ...env, DB: { prepare() { throw new Error('db down'); } } };
  const res = await quietly(() => call(broken, 'GET', '/q/1'));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('Location'), '/flyer/?n=1');
});

test('4. POST /api/count is 204 and two calls on one day give 2 in one row', async () => {
  const now = new Date('2026-11-20T23:59:00Z');
  for (let i = 0; i < 2; i++) {
    const res = await call(env, 'POST', '/api/count', { body: { name: 'game_played' }, now });
    assert.equal(res.status, 204);
  }
  assert.deepEqual(await rows(), [{ name: 'game_played', day: '2026-11-20', count: 2 }]);
});

test('5. POST /api/count rejects unknown name, missing name and non-JSON with invalid_body', async () => {
  for (const body of [{ name: 'hacked' }, {}, 'not json', '[]', 'null']) {
    const res = await call(env, 'POST', '/api/count', { body });
    assert.equal(res.status, 400, `body ${JSON.stringify(body)}`);
    assert.equal((await res.json()).error.code, 'invalid_body');
  }
  assert.deepEqual(await rows(), []);
});

test('6. POST /api/count is 429 rate_limited when the limiter denies, and writes nothing', async () => {
  env.LIMITER.allow = false;
  const res = await call(env, 'POST', '/api/count', { body: { name: 'game_played' }, headers: { 'CF-Connecting-IP': '203.0.113.5' } });
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error.code, 'rate_limited');
  assert.deepEqual(env.LIMITER.keys, ['203.0.113.5']);
  assert.deepEqual(await rows(), []);
  env.LIMITER.allow = true;
  await call(env, 'POST', '/api/count', { body: { name: 'game_played' } });
  assert.deepEqual(env.LIMITER.keys, ['203.0.113.5', 'unknown']);
});

test('7. GET /api/results has exactly the contract keys, sums counters across days, and caches 30 s', async () => {
  await call(env, 'GET', '/q/1', { now: new Date('2026-11-20T10:00:00Z') });
  await call(env, 'GET', '/q/1', { now: new Date('2026-11-21T10:00:00Z') });
  await call(env, 'POST', '/api/count', { body: { name: 'challenge_done' } });
  const res = await call(env, 'GET', '/api/results');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=30');
  assert.deepEqual(await res.json(), {
    experiment: { started: 0, finished: 0, pre: null, post: null, actions: null },
    pulse: { n: 0, mean: null, counts: null },
    counters: { 'scan:1': 2, challenge_done: 1 },
    answers: [],
  });
});

test('8. unknown /api path is 404 not_found JSON; a throwing handler is 500 internal without the message', async () => {
  const res = await call(env, 'GET', '/api/nope');
  assert.equal(res.status, 404);
  assert.match(res.headers.get('Content-Type'), /application\/json/);
  assert.equal((await res.json()).error.code, 'not_found');

  routes.push(['GET', /^\/api\/boom$/, () => { throw new Error('secret detail'); }]);
  try {
    const boom = await quietly(() => call(env, 'GET', '/api/boom'));
    assert.equal(boom.status, 500);
    const text = await boom.text();
    assert.equal(JSON.parse(text).error.code, 'internal');
    assert.doesNotMatch(text, /secret detail/);
  } finally {
    routes.pop();
  }
});

test('9. the migration enforces CHECK constraints', async () => {
  const now = new Date().toISOString();
  const exp = (mood) => env.DB.prepare(
    'INSERT INTO experiment (code, created_at, actions, pre_connected, pre_mood, pre_stress) VALUES (?, ?, ?, 3, ?, 3)',
  ).bind(`C${mood}`, now, '[]', mood).run();
  await exp(5);
  await assert.rejects(exp(6));
  await assert.rejects(exp(0));
  const ans = (status) => env.DB.prepare('INSERT INTO answers (created_at, text, status) VALUES (?, ?, ?)').bind(now, 'hi', status).run();
  await ans('approved');
  await assert.rejects(ans('deleted'));
});
