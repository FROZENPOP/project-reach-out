import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, call, TEST_QR_KEYS as K } from '../helpers/env.js';

let env, dispose;
beforeEach(async () => ({ env, dispose } = await makeEnv()));
afterEach(() => dispose());

test('18. after one request to every route, no table holds the IP or the user agent', async () => {
  const ip = '203.0.113.9';
  const ua = 'Mozilla/5.0 (PrivacyProbe; reach-out-test)';
  const headers = { 'CF-Connecting-IP': ip, 'User-Agent': ua, Authorization: 'Bearer test-token' };
  const t0 = new Date('2026-11-20T12:00:00.000Z');
  const send = async (method, path, body, now = t0) => {
    const res = await call(env, method, path, { body, headers, now });
    assert.ok(res.status < 300 || res.status === 302, `${method} ${path} -> ${res.status}`);
    return res;
  };

  await send('GET', `/q/${K[1]}`);
  await send('POST', '/api/count', { name: 'listen_opened' });
  await send('POST', '/api/pulse', { lack: 2, left_out: 2, isolated: 2 });
  await send('POST', '/api/answers', { text: 'my friends' });
  const { code } = await (await send('POST', '/api/experiment/start', { connected: 3, mood: 3, stress: 3, actions: ['talk_new', 'reach_out'] })).json();
  await send('GET', `/api/experiment/${code}`);
  await send('POST', `/api/experiment/${code}/finish`, { connected: 4, mood: 4, stress: 2 }, new Date(t0.getTime() + 18 * 3600_000));
  await send('GET', '/api/results');
  const [{ id }] = await (await send('GET', '/api/admin/answers')).json();
  await send('POST', `/api/admin/answers/${id}`, { status: 'approved' });
  for (const table of ['experiment', 'pulse', 'answers', 'counters']) await send('GET', `/api/admin/export.csv?table=${table}`);

  const { results: tables } = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all();
  assert.deepEqual(tables.map((t) => t.name).sort(), ['answers', 'counters', 'experiment', 'pulse']);
  let dump = '';
  for (const { name } of tables) {
    const { results } = await env.DB.prepare(`SELECT * FROM "${name}"`).all();
    assert.ok(results.length > 0, `${name} has rows, so the search means something`);
    dump += JSON.stringify(results);
  }
  assert.ok(!dump.includes(ip), 'IP stored');
  assert.ok(!dump.includes('203.0.113'), 'partial IP stored');
  assert.ok(!dump.includes('PrivacyProbe'), 'user agent stored');
  assert.deepEqual(env.LIMITER.keys.every((k) => k === ip), true);
});
