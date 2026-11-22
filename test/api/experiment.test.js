import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, call } from '../helpers/env.js';
import { ALPHABET, newCode, normalizeCode } from '../../src/worker/lib/code.js';

let env, dispose;
beforeEach(async () => ({ env, dispose } = await makeEnv()));
afterEach(() => dispose());

const T0 = new Date('2026-11-20T15:00:00.000Z');
const at = (ms) => new Date(T0.getTime() + ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const valid = { connected: 2, mood: 3, stress: 4, actions: ['talk_new', 'phone_free'] };

const start = (body = valid, now = T0) => call(env, 'POST', '/api/experiment/start', { body, now });
const status = (code, now) => call(env, 'GET', `/api/experiment/${code}`, { now });
const finish = (code, body, now) => call(env, 'POST', `/api/experiment/${code}/finish`, { body, now });
const started = async () => (await (await start()).json()).code;
const errCode = async (res) => (await res.json()).error.code;

test('6. start with 2 or 3 distinct actions is 201 with a valid code and ready_at 18 h after now', async () => {
  for (const actions of [['talk_new', 'reach_out'], ['eat_together', 'shared_activity', 'phone_free']]) {
    const res = await start({ ...valid, actions });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.deepEqual(Object.keys(body).sort(), ['code', 'ready_at']);
    assert.match(body.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    assert.equal(body.ready_at, '2026-11-21T09:00:00.000Z');
    const row = await env.DB.prepare('SELECT * FROM experiment WHERE code = ?').bind(body.code).first();
    assert.deepEqual(JSON.parse(row.actions), actions);
    assert.equal(row.created_at, T0.toISOString());
  }
  // Codes use every letter of the alphabet and nothing else.
  const seen = new Set(Array.from({ length: 400 }, newCode).join(''));
  assert.deepEqual([...seen].sort().join(''), [...ALPHABET].sort().join(''));
});

test('7. bad action lists or scale values are 400 and store nothing', async () => {
  const bad = [
    { ...valid, actions: ['talk_new'] },
    { ...valid, actions: ['talk_new', 'eat_together', 'phone_free', 'reach_out'] },
    { ...valid, actions: ['talk_new', 'talk_new'] },
    { ...valid, actions: ['talk_new', 'fly'] },
    { ...valid, actions: 'talk_new,reach_out' },
    { ...valid, actions: undefined },
    { ...valid, connected: 0 },
    { ...valid, mood: 6 },
    { ...valid, stress: 2.5 },
    { ...valid, stress: '3' },
  ];
  for (const body of bad) {
    const res = await start(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(await errCode(res), 'invalid_body');
  }
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM experiment').first()).n, 0);
});

test('8. status is waiting, ready, done; lookup ignores case, spaces and dashes; unknown is 404', async () => {
  const code = await started();
  const s = async (c, now) => (await (await status(c, now)).json());
  assert.deepEqual(await s(code, at(17 * HOUR + 59 * MIN)), {
    status: 'waiting', ready_at: '2026-11-21T09:00:00.000Z', actions: ['talk_new', 'phone_free'],
  });
  assert.equal((await s(code, at(18 * HOUR))).status, 'ready');
  const messy = `${code.slice(0, 3)}-${code.slice(3)}`.toLowerCase();
  assert.equal((await s(messy, at(18 * HOUR))).status, 'ready');
  assert.equal((await s(encodeURIComponent(` ${messy} `), at(18 * HOUR))).status, 'ready');
  assert.equal((await finish(code, { connected: 4, mood: 4, stress: 2 }, at(20 * HOUR))).status, 200);
  assert.equal((await s(code, at(20 * HOUR))).status, 'done');
  assert.equal((await s(code, at(30 * DAY))).status, 'done');

  for (const unknown of [code === 'AAAAAA' ? 'BBBBBB' : 'AAAAAA', 'start', 'ABC', '%E0%A4%A']) {
    const res = await status(unknown, at(18 * HOUR));
    assert.equal(res.status, 404, unknown);
    assert.equal(await errCode(res), 'not_found');
  }
  assert.equal(normalizeCode('ab c-d e2'), 'ABCDE2');
  assert.equal(normalizeCode('abcd0e'), null);

  const old = await started();
  const res = await status(old, at(7 * DAY + MIN));
  assert.equal(res.status, 409);
  assert.equal(await errCode(res), 'expired');
});

test('9. finish: too_early before ready_at, 200 at +18 h, already_finished, expired after 7 days', async () => {
  const post = { connected: 5, mood: 4, stress: 1 };
  const code = await started();
  let res = await finish(code, post, at(18 * HOUR - 1));
  assert.equal(res.status, 409);
  assert.equal(await errCode(res), 'too_early');

  res = await finish(code.toLowerCase(), post, at(18 * HOUR));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { pre: { connected: 2, mood: 3, stress: 4 }, post });

  res = await finish(code, post, at(19 * HOUR));
  assert.equal(res.status, 409);
  assert.equal(await errCode(res), 'already_finished');

  const late = await started();
  res = await finish(late, post, at(7 * DAY + MIN));
  assert.equal(res.status, 409);
  assert.equal(await errCode(res), 'expired');
  assert.equal((await env.DB.prepare('SELECT finished_at FROM experiment WHERE code = ?').bind(late).first()).finished_at, null);

  res = await finish('ZZZZZZ', post, at(18 * HOUR));
  assert.equal(res.status, 404);
});

test('10. finish with invalid values is 400 and leaves the row unfinished', async () => {
  const code = await started();
  for (const body of [{ connected: 6, mood: 3, stress: 3 }, { connected: 3, mood: 3 }, { connected: 3, mood: 3, stress: 'x' }, 'nope']) {
    const res = await finish(code, body, at(18 * HOUR));
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(await errCode(res), 'invalid_body');
  }
  const row = await env.DB.prepare('SELECT finished_at, post_connected, post_mood, post_stress FROM experiment').first();
  assert.deepEqual({ ...row }, { finished_at: null, post_connected: null, post_mood: null, post_stress: null });
  assert.equal((await (await status(code, at(18 * HOUR))).json()).status, 'ready');
});
