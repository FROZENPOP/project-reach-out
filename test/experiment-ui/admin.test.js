import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdmin } from '../../public/admin/client.js';

const memory = () => {
  const m = new Map();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

test('10. admin client: header on every call, never in a URL, cleared on 401, Approve moves row out of Pending', async () => {
  const calls = [];
  const rows = [
    { id: 1, created_at: '2026-11-22T10:00:00Z', text: 'a', status: 'pending' },
    { id: 2, created_at: '2026-11-22T11:00:00Z', text: 'b', status: 'pending' },
  ];
  let reply = (url) => {
    if (url.includes('export.csv')) return new Response('a,b\n', { status: 200 });
    if (url.includes('/answers/')) return Response.json({ ok: true });
    return Response.json(rows);
  };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, auth: init.headers?.Authorization });
    return reply(url);
  };
  const store = memory();
  const admin = createAdmin(store);
  await admin.unlock('s3cret pass');
  assert.equal(admin.state.rows.length, 2);
  await admin.setStatus(1, 'approved');
  assert.deepEqual(admin.state.rows.map((r) => r.id), [2]);
  assert.equal(await (await admin.csv('experiment')).text(), 'a,b\n');
  assert.equal(calls.length, 3);
  for (const c of calls) {
    assert.equal(c.auth, 'Bearer s3cret pass');
    assert.ok(!decodeURIComponent(c.url).includes('s3cret'), c.url);
  }

  reply = () => Response.json({ error: { code: 'unauthorized', message: 'Unauthorized.' } }, { status: 401 });
  await assert.rejects(admin.list('pending'), { status: 401, message: 'That passphrase is not right.' });
  assert.equal(admin.hasToken(), false);
  assert.equal(store.m.size, 0);
  assert.deepEqual(admin.state, { status: 'pending', rows: [] }, 'a failed tab load leaves no old rows');
});
