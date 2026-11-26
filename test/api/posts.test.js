import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, call } from '../helpers/env.js';
import { handle } from '../../src/worker/index.js';
import { cleanText } from '../../src/worker/lib/body.js';

let env, dispose;
beforeEach(async () => ({ env, dispose } = await makeEnv()));
afterEach(() => dispose());

const all = async (sql) => (await env.DB.prepare(sql).all()).results;
const code = async (res) => (await res.json()).error.code;

test('1. a valid pulse is 201 and stores one row with a UTC ISO timestamp', async () => {
  const now = new Date('2026-11-21T08:30:00.000Z');
  const res = await call(env, 'POST', '/api/pulse', { body: { lack: 1, left_out: 2, isolated: 3 }, now });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { ok: true });
  const rows = await all('SELECT created_at, lack, left_out, isolated FROM pulse');
  assert.deepEqual(rows, [{ created_at: '2026-11-21T08:30:00.000Z', lack: 1, left_out: 2, isolated: 3 }]);
  assert.match(rows[0].created_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
});

test('2. bad pulse values, missing fields and non-JSON are 400 invalid_body and store nothing', async () => {
  const bodies = [
    { lack: 0, left_out: 2, isolated: 2 },
    { lack: 4, left_out: 2, isolated: 2 },
    { lack: 2, left_out: 1.5, isolated: 2 },
    { lack: 2, left_out: '2', isolated: 2 },
    { lack: 2, left_out: 2, isolated: true },
    { lack: 2, left_out: 2 },
    {},
    'not json',
    '[1,2,3]',
  ];
  for (const body of bodies) {
    const res = await call(env, 'POST', '/api/pulse', { body });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(await code(res), 'invalid_body');
  }
  assert.deepEqual(await all('SELECT * FROM pulse'), []);
});

test('3. a valid answer is 201, stored pending, trimmed, control characters removed', async () => {
  const res = await call(env, 'POST', '/api/answers', { body: { text: '  \u0000hi\u0007 there\r\nfriend\t\u001b  ' } });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { ok: true });
  assert.deepEqual(await all('SELECT text, status FROM answers'), [{ text: 'hi there\nfriend', status: 'pending' }]);
  assert.equal(cleanText('\u007fa\u0085b\n'), 'ab');
});

test('4. empty, whitespace-only and 281-character answers are 400; 280 emoji are accepted', async () => {
  for (const text of ['', '   \n\t ', '\u0000\u0001', 'a'.repeat(281), '😀'.repeat(281), 42]) {
    const res = await call(env, 'POST', '/api/answers', { body: { text } });
    assert.equal(res.status, 400, JSON.stringify(text));
    assert.equal(await code(res), 'invalid_body');
  }
  assert.deepEqual(await all('SELECT * FROM answers'), []);

  const emoji = '😀'.repeat(280);
  assert.equal(emoji.length, 560);
  const res = await call(env, 'POST', '/api/answers', { body: { text: emoji } });
  assert.equal(res.status, 201);
  assert.deepEqual(await all('SELECT text FROM answers'), [{ text: emoji }]);
});

test('4b. an answer of only zero-width spaces is 400; one visible character among them is accepted', async () => {
  for (const text of ['​​​', '​ ‍﻿⁠ㅤ']) {
    const res = await call(env, 'POST', '/api/answers', { body: { text } });
    assert.equal(res.status, 400, JSON.stringify(text));
    assert.equal(await code(res), 'invalid_body');
  }
  assert.deepEqual(await all('SELECT * FROM answers'), []);
  const res = await call(env, 'POST', '/api/answers', { body: { text: '​​x​' } });
  assert.equal(res.status, 201);
  assert.equal((await all('SELECT * FROM answers')).length, 1);
});

test('5b. a 5000-byte body to every POST route is 413 too_large and stores nothing, with or without Content-Length', async () => {
  const { code: expCode } = await (await call(env, 'POST', '/api/experiment/start', {
    body: { connected: 3, mood: 3, stress: 3, actions: ['talk_new', 'reach_out'] },
  })).json();
  await env.DB.prepare("INSERT INTO answers (created_at, text) VALUES ('2026-11-20T00:00:00.000Z', 'x')").run();
  const before = await all('SELECT * FROM experiment');
  const later = new Date(Date.now() + 19 * 3600_000);
  const headers = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };
  const posts = [
    ['/api/count', { name: 'game_played' }],
    ['/api/pulse', { lack: 1, left_out: 1, isolated: 1 }],
    ['/api/answers', { text: 'hello' }],
    ['/api/experiment/start', { connected: 3, mood: 3, stress: 3, actions: ['talk_new', 'reach_out'] }],
    [`/api/experiment/${expCode}/finish`, { connected: 4, mood: 4, stress: 2 }],
    ['/api/admin/answers/1', { status: 'approved' }],
  ];
  // A valid body padded with spaces to exactly `size` bytes.
  const padded = (body, size) => { const s = JSON.stringify(body); return s + ' '.repeat(size - s.length); };
  const stream = (text) => new ReadableStream({
    start(c) { for (let i = 0; i < text.length; i += 1000) c.enqueue(new TextEncoder().encode(text.slice(i, i + 1000))); c.close(); },
  });
  for (const [path, body] of posts) {
    const big = padded(body, 5000);
    const requests = [
      new Request(`http://localhost${path}`, { method: 'POST', headers: { ...headers, 'Content-Length': '5000' }, body: big }),
      new Request(`http://localhost${path}`, { method: 'POST', headers, body: stream(big), duplex: 'half' }),
    ];
    assert.equal(requests[1].headers.get('Content-Length'), null);
    for (const req of requests) {
      const res = await handle(req, env, later);
      assert.equal(res.status, 413, path);
      assert.equal(await code(res), 'too_large');
    }
  }
  assert.deepEqual(await all('SELECT * FROM counters'), []);
  assert.deepEqual(await all('SELECT * FROM pulse'), []);
  assert.deepEqual(await all('SELECT text, status FROM answers'), [{ text: 'x', status: 'pending' }]);
  assert.deepEqual(await all('SELECT * FROM experiment'), before);

  // Exactly at the limit is read and parsed.
  const res = await call(env, 'POST', '/api/pulse', { body: padded({ lack: 1, left_out: 1, isolated: 1 }, 4096) });
  assert.equal(res.status, 201);
});

test('5. every POST route is 429 rate_limited and stores nothing when the limiter denies', async () => {
  const { code: expCode } = await (await call(env, 'POST', '/api/experiment/start', {
    body: { connected: 3, mood: 3, stress: 3, actions: ['talk_new', 'reach_out'] },
  })).json();
  await env.DB.prepare("INSERT INTO answers (created_at, text) VALUES ('2026-11-20T00:00:00.000Z', 'x')").run();
  const before = await all('SELECT * FROM experiment');

  env.LIMITER.allow = false;
  const later = new Date(Date.now() + 19 * 3600_000);
  const posts = [
    ['/api/count', { name: 'game_played' }],
    ['/api/pulse', { lack: 1, left_out: 1, isolated: 1 }],
    ['/api/answers', { text: 'hello' }],
    ['/api/experiment/start', { connected: 3, mood: 3, stress: 3, actions: ['talk_new', 'reach_out'] }],
    [`/api/experiment/${expCode}/finish`, { connected: 4, mood: 4, stress: 2 }],
    ['/api/admin/answers/1', { status: 'approved' }],
  ];
  for (const [path, body] of posts) {
    const res = await call(env, 'POST', path, { body, now: later, headers: { Authorization: 'Bearer test-token' } });
    assert.equal(res.status, 429, path);
    assert.equal(await code(res), 'rate_limited');
  }
  assert.deepEqual(await all('SELECT * FROM counters'), []);
  assert.deepEqual(await all('SELECT * FROM pulse'), []);
  assert.deepEqual(await all('SELECT text, status FROM answers'), [{ text: 'x', status: 'pending' }]);
  assert.deepEqual(await all('SELECT * FROM experiment'), before);
});

test('4c. answers with swearing or slurs get the normal 201 but are never stored; clean ones save', async () => {
  for (const text of ['honestly this is bullshit', 'F U C K', 'sh1t', 'you @sshole', 'f*ck that', 'kys']) {
    const res = await call(env, 'POST', '/api/answers', { body: { text } });
    assert.equal(res.status, 201, text);
    assert.deepEqual(await res.json(), { ok: true });
  }
  assert.deepEqual(await all('SELECT * FROM answers'), []);
  for (const text of ['Talking with my class after school', 'A peacock-themed group chat', 'Sometimes I want to kill myself, talking helps']) {
    assert.equal((await call(env, 'POST', '/api/answers', { body: { text } })).status, 201, text);
  }
  assert.equal((await all('SELECT * FROM answers')).length, 3);
});
