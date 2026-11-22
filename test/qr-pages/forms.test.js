import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { submitPulse } from '../../public/pulse/logic.js';
import { submitAnswer } from '../../public/your-turn/logic.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const rateLimited = async () => new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'Slow down.' } }), {
  status: 429, headers: { 'Content-Type': 'application/json' },
});
const offline = async () => { throw new TypeError('Failed to fetch'); };

const FORMS = [
  ['pulse', submitPulse, { lack: 'Hardly ever', left_out: 'Often', isolated: 'Some of the time' }, '/api/pulse', { lack: 1, left_out: 3, isolated: 2 }],
  ['your-turn', submitAnswer, { text: '  Lunch with my team.  ' }, '/api/answers', { text: 'Lunch with my team.' }],
];

test('11. each form shows the 429 and network alerts and keeps what was entered', async () => {
  for (const [name, submit, values, path, body] of FORMS) {
    const before = structuredClone(values);

    globalThis.fetch = rateLimited;
    assert.deepEqual(await submit(values), { error: 'Too many tries. Wait a minute and try again.' }, name);
    assert.deepEqual(values, before, `${name}: values after 429`);

    globalThis.fetch = offline;
    assert.deepEqual(await submit(values), { error: 'Could not reach the server. Check your connection and try again.' }, name);
    assert.deepEqual(values, before, `${name}: values after network error`);

    // Stub of the ARCHITECTURE.md contract: 201 { ok: true } (the api task builds the real route).
    let sent;
    globalThis.fetch = async (url, init) => {
      sent = { url, method: init.method, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    };
    assert.equal((await submit(values)).error, undefined, name);
    assert.deepEqual(sent, { url: path, method: 'POST', body }, name);
  }
});
