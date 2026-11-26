// Test helper for Worker tests. Real local D1 via wrangler's getPlatformProxy, no fakes.
//
//   import { makeEnv, call } from '../helpers/env.js';
//   const { env, dispose } = await makeEnv();   // fresh, empty D1 with migrations/*.sql applied
//   after(dispose);                             // or t.after(dispose)
//   const res = await call(env, 'POST', '/api/count', { body: { name: 'game_played' } });
//
// env.DB           a fresh local D1 database (one per makeEnv call)
// env.LIMITER      stub: allows by default; set `env.LIMITER.allow = false` to deny.
//                  `env.LIMITER.keys` lists the keys it was called with.
// env.ADMIN_TOKEN  "test-token"
// env.QR_KEYS      JSON of TEST_QR_KEYS: code number -> token
// env.ASSETS       stub: answers 200 "asset:<path>" for any static file
//
// call(env, method, path, { body, headers, now }) runs the Worker and returns the Response.
//   body     object (sent as JSON) or string (sent as is)
//   headers  extra request headers
//   now      Date passed to the handler as the current time (default: new Date())

import { getPlatformProxy } from 'wrangler';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../../src/worker/index.js';

const root = new URL('../../', import.meta.url);

export const TEST_QR_KEYS = { 1: 'k-one', 2: 'k-two', 3: 'k-three', 4: 'k-four', 5: 'k-five', 6: 'k-six' };
const ASSETS = { fetch: async (req) => new Response(`asset:${new URL(req.url).pathname}`) };

export async function makeEnv() {
  const dir = await mkdtemp(join(tmpdir(), 'reach-out-d1-'));
  const proxy = await getPlatformProxy({ configPath: fileURLToPath(new URL('wrangler.jsonc', root)), persist: { path: dir } });
  const DB = proxy.env.DB;
  const migrations = new URL('migrations/', root);
  for (const file of (await readdir(migrations)).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(file, migrations), 'utf8');
    const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
    await DB.batch(statements.map((s) => DB.prepare(s)));
  }
  const LIMITER = {
    allow: true,
    keys: [],
    async limit({ key }) {
      this.keys.push(key);
      return { success: this.allow };
    },
  };
  return {
    env: { DB, LIMITER, ADMIN_TOKEN: 'test-token', QR_KEYS: JSON.stringify(TEST_QR_KEYS), ASSETS },
    async dispose() {
      await proxy.dispose();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export function call(env, method, path, { body, headers = {}, now } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers['Content-Type'] ??= 'application/json';
  }
  return handle(new Request(`http://localhost${path}`, init), env, now);
}
