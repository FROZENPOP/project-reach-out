import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, call } from '../helpers/env.js';
import { routes } from '../../src/worker/index.js';

let env, dispose;
beforeEach(async () => ({ env, dispose } = await makeEnv()));
afterEach(() => dispose());

const auth = { Authorization: 'Bearer test-token' };
const admin = (method, path, opts = {}) => call(env, method, path, { ...opts, headers: { ...auth, ...opts.headers } });
const errCode = async (res) => (await res.json()).error.code;
const addAnswer = (i, text, status = 'pending') =>
  env.DB.prepare('INSERT INTO answers (created_at, text, status) VALUES (?, ?, ?)')
    .bind(new Date(Date.UTC(2026, 10, 1) + i * 60_000).toISOString(), text, status).run();

// RFC 4180 parser, written independently of the Worker's writer.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += ch;
  }
  assert.equal(row.length + cell.length, 0, 'CSV must end with CRLF');
  return rows;
}

// Every admin route in the router's own table, as a concrete path (capture groups filled with 1).
const ADMIN_ROUTES = routes
  .filter(([, pattern]) => pattern.source.startsWith(String.raw`^\/api\/admin\/`))
  .map(([method, pattern]) => {
    const path = pattern.source.replaceAll(String.raw`(\d+)`, '1').replace(/^\^|\$$/g, '').replaceAll('\\', '');
    assert.match(path, pattern, `cannot build a sample path for ${pattern}`);
    return [method, path];
  });

test('15. every admin route in the router is 401 without a header, with a wrong token, or when ADMIN_TOKEN is empty; passes with the right token', async () => {
  assert.ok(ADMIN_ROUTES.length >= 3, 'router table has the admin routes');
  await addAnswer(0, 'hi');
  const cases = [
    [{}, env.ADMIN_TOKEN],
    [{ Authorization: 'Bearer wrong-token' }, env.ADMIN_TOKEN],
    [{ Authorization: 'test-token' }, env.ADMIN_TOKEN],
    [{ Authorization: 'Bearer test-tokenX' }, env.ADMIN_TOKEN],
    [{ Authorization: 'Bearer ' }, ''],
    [{ Authorization: 'Bearer test-token' }, ''],
    [{ Authorization: 'Bearer undefined' }, undefined],
  ];
  for (const [method, path] of ADMIN_ROUTES) {
    const body = method === 'POST' ? { status: 'approved' } : undefined;
    for (const [headers, token] of cases) {
      const res = await call({ ...env, ADMIN_TOKEN: token }, method, path, { body, headers });
      assert.equal(res.status, 401, `${method} ${path} ${JSON.stringify(headers)} token=${token}`);
      assert.equal(await errCode(res), 'unauthorized');
      assert.equal(res.headers.get('Cache-Control'), 'no-store');
    }
    const ok = await admin(method, path, { body });
    assert.notEqual(ok.status, 401, `${method} ${path}`);
    assert.equal(ok.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal((await admin('GET', '/api/admin/export.csv?table=answers')).status, 200);
  assert.equal((await admin('POST', '/api/admin/answers/1', { body: { status: 'approved' } })).status, 200);
});

test('15b. the router guards /api/admin/ itself: a handler with no auth is 401 without the token; an unknown admin path is 401, then 404', async (t) => {
  let ran = 0;
  routes.push(['GET', /^\/api\/admin\/throwaway$/, () => { ran++; return new Response('open'); }]);
  t.after(() => routes.pop());

  let res = await call(env, 'GET', '/api/admin/throwaway');
  assert.equal(res.status, 401);
  assert.equal(await errCode(res), 'unauthorized');
  assert.equal(ran, 0, 'handler must not run without the token');
  assert.equal((await admin('GET', '/api/admin/throwaway')).status, 200);
  assert.equal(ran, 1);

  for (const method of ['GET', 'POST']) {
    res = await call(env, method, '/api/admin/nope');
    assert.equal(res.status, 401, method);
    assert.equal(await errCode(res), 'unauthorized');
    res = await admin(method, '/api/admin/nope');
    assert.equal(res.status, 404, method);
    assert.equal(await errCode(res), 'not_found');
  }
});

test('16. list by status, approve and reject, unknown id 404, bad status 400', async () => {
  await addAnswer(0, 'first');
  await addAnswer(1, 'second');
  await addAnswer(2, 'third');
  await addAnswer(-1, 'old approved', 'approved');
  const list = async (query = '') => (await (await admin('GET', `/api/admin/answers${query}`)).json());

  const pending = await list();
  assert.deepEqual(pending.map((a) => a.text), ['third', 'second', 'first']);
  assert.deepEqual(Object.keys(pending[0]).sort(), ['created_at', 'id', 'status', 'text']);
  assert.deepEqual(await list('?status=pending'), pending);

  const [third, second] = pending;
  assert.deepEqual(await (await admin('POST', `/api/admin/answers/${third.id}`, { body: { status: 'approved' } })).json(), { ok: true });
  assert.equal((await admin('POST', `/api/admin/answers/${second.id}`, { body: { status: 'rejected' } })).status, 200);
  assert.deepEqual((await list('?status=approved')).map((a) => a.text), ['third', 'old approved']);
  assert.deepEqual((await list('?status=rejected')).map((a) => [a.text, a.status]), [['second', 'rejected']]);
  assert.deepEqual((await list()).map((a) => a.text), ['first']);

  let res = await admin('POST', '/api/admin/answers/999', { body: { status: 'approved' } });
  assert.equal(res.status, 404);
  assert.equal(await errCode(res), 'not_found');

  for (const body of [{ status: 'pending' }, { status: 'deleted' }, {}, 'x']) {
    res = await admin('POST', `/api/admin/answers/${third.id}`, { body });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(await errCode(res), 'invalid_body');
  }
  res = await admin('GET', '/api/admin/answers?status=deleted');
  assert.equal(res.status, 400);

  for (let i = 0; i < 205; i++) await addAnswer(10 + i, `bulk ${i}`);
  const capped = await list();
  assert.equal(capped.length, 200);
  assert.equal(capped[0].text, 'bulk 204');
});

test('17. each export has the right header and row count; quoting round-trips; formulas are defused', async () => {
  await call(env, 'GET', '/q/2');
  await call(env, 'POST', '/api/pulse', { body: { lack: 1, left_out: 2, isolated: 3 } });
  await call(env, 'POST', '/api/pulse', { body: { lack: 3, left_out: 3, isolated: 3 } });
  await call(env, 'POST', '/api/experiment/start', { body: { connected: 3, mood: 3, stress: 3, actions: ['talk_new', 'reach_out'] } });
  const tricky = 'Hi, "friend"\nsecond line';
  await addAnswer(0, tricky);
  await addAnswer(1, '=HYPERLINK("http://x")');
  await addAnswer(2, '+1');
  await addAnswer(3, '@sum');
  await addAnswer(4, '-2');

  const expected = {
    experiment: [['code', 'created_at', 'actions', 'pre_connected', 'pre_mood', 'pre_stress', 'finished_at', 'post_connected', 'post_mood', 'post_stress'], 1],
    pulse: [['id', 'created_at', 'lack', 'left_out', 'isolated'], 2],
    answers: [['id', 'created_at', 'text', 'status'], 5],
    counters: [['name', 'day', 'count'], 1],
  };
  for (const [table, [header, count]] of Object.entries(expected)) {
    const res = await admin('GET', `/api/admin/export.csv?table=${table}`);
    assert.equal(res.status, 200, table);
    assert.match(res.headers.get('Content-Type'), /^text\/csv/);
    assert.equal(res.headers.get('Content-Disposition'), `attachment; filename="${table}.csv"`);
    const rows = parseCsv(await res.text());
    assert.deepEqual(rows[0], header);
    assert.equal(rows.length - 1, count, table);
    assert.ok(rows.every((r) => r.length === header.length));
  }

  const rows = parseCsv(await (await admin('GET', '/api/admin/export.csv?table=answers')).text());
  assert.deepEqual(rows.slice(1).map((r) => r[2]), [tricky, '\'=HYPERLINK("http://x")', "'+1", "'@sum", "'-2"]);
  const exp = parseCsv(await (await admin('GET', '/api/admin/export.csv?table=experiment')).text());
  assert.equal(exp[1][2], '["talk_new","reach_out"]');
  assert.equal(exp[1][6], '');

  for (const q of ['?table=sqlite_master', '?table=answers;DROP TABLE answers', '?table=', '']) {
    const res = await admin('GET', `/api/admin/export.csv${q}`);
    assert.equal(res.status, 400, q);
    assert.equal(await errCode(res), 'invalid_body');
  }
});

test('17b. CSV cells starting with a tab or a carriage return get one leading single quote', async () => {
  await addAnswer(0, '\t=1+1');
  await addAnswer(1, '\rcmd');
  const rows = parseCsv(await (await admin('GET', '/api/admin/export.csv?table=answers')).text());
  assert.deepEqual(rows.slice(1).map((r) => r[2]), ["'\t=1+1", "'\rcmd"]);
});
