import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCode, formatCode, emptyForm, rate, toggleAction, canSubmit, startBody, chooseView, personalModel, oneAtATime,
} from '../../public/experiment/model.js';
import { api, ApiError } from '../../public/js/site.js';
import { readFile } from 'node:fs/promises';

test('1. code resolver prefers ?code=, normalises case, spaces and dashes, formats ABC-DEF', () => {
  assert.equal(resolveCode('?code=abc-def', 'ZZZZZZ'), 'ABCDEF');
  assert.equal(resolveCode('?code=%20ab%20c-d%20ef', null), 'ABCDEF');
  assert.equal(resolveCode('', 'xyz-234'), 'XYZ234');
  assert.equal(resolveCode('?code=', ' q2w-e3r '), 'Q2WE3R');
  assert.equal(resolveCode('', null), null);
  assert.equal(formatCode('ABCDEF'), 'ABC-DEF');
});

test('2. check-in form: submit needs three ratings and two or three actions; a fourth is refused; exact body', () => {
  let f = emptyForm();
  f = rate(rate(f, 'connected', 2), 'mood', 3);
  f = toggleAction(toggleAction(f, 'talk_new'), 'phone_free');
  assert.equal(canSubmit(f), false, 'two ratings');
  f = rate(f, 'stress', 4);
  assert.equal(canSubmit(f), true);
  f = toggleAction(f, 'reach_out');
  assert.equal(canSubmit(f), true);
  const four = toggleAction(f, 'eat_together');
  assert.deepEqual(four.actions, ['talk_new', 'phone_free', 'reach_out']);
  assert.equal(canSubmit(toggleAction(toggleAction(f, 'reach_out'), 'phone_free')), false, 'one action');
  assert.deepEqual(startBody(f), { connected: 2, mood: 3, stress: 4, actions: ['talk_new', 'phone_free', 'reach_out'] });
});

test('2b. a second submit while one is pending sends nothing, for start and finish alike', async () => {
  const sent = [];
  let release;
  globalThis.fetch = (url) => {
    sent.push(url);
    return new Promise((r) => { release = () => r(Response.json({ code: 'ABCDEF', ready_at: '2026-11-23T10:00:00Z' }, { status: 201 })); });
  };
  const inFlight = oneAtATime();
  let f = rate(rate(rate(emptyForm(), 'connected', 2), 'mood', 3), 'stress', 4);
  f = toggleAction(toggleAction(f, 'talk_new'), 'phone_free');
  const first = inFlight(() => api('/api/experiment/start', { method: 'POST', body: startBody(f) }));
  assert.equal(inFlight.busy(), true);
  assert.equal(await inFlight(() => api('/api/experiment/start', { method: 'POST', body: startBody(f) })), undefined);
  assert.equal(await inFlight(() => api('/api/experiment/ABCDEF/finish', { method: 'POST', body: {} })), undefined);
  assert.equal(sent.length, 1);
  release();
  assert.equal((await first).code, 'ABCDEF');
  assert.equal(inFlight.busy(), false);
  const page = await readFile(new URL('../../public/experiment/experiment.js', import.meta.url), 'utf8');
  assert.equal(page.match(/inFlight\.busy\(\)/g).length, 4, 'both submit handlers and both re-enable sites check the flag');
});

test('3. view chooser maps waiting, ready, done, 404 and 409 expired', () => {
  assert.equal(chooseView({ status: 'waiting' }), 'waiting');
  assert.equal(chooseView({ status: 'ready' }), 'checkout');
  assert.equal(chooseView({ status: 'done' }), 'done');
  assert.equal(chooseView(new ApiError(404, 'not_found', 'x')), 'not-found');
  assert.equal(chooseView(new ApiError(409, 'expired', 'x')), 'expired');
  assert.equal(chooseView(new ApiError(0, 'network', 'x')), 'error');
});

test('4. personal before/after: both values, signed change, stress down is better', () => {
  const m = personalModel({ pre: { connected: 2, mood: 3, stress: 4 }, post: { connected: 4, mood: 3, stress: 2 } });
  assert.deepEqual(m.map((x) => [x.key, x.before, x.after, x.change]), [['connected', 2, 4, 2], ['mood', 3, 3, 0], ['stress', 4, 2, -2]]);
  const stress = m.find((x) => x.key === 'stress');
  assert.equal(stress.betterDirection, 'down');
  assert.equal(stress.better, true);
  assert.equal(m[0].betterDirection, 'up');
  assert.equal(m[0].better, true);
  assert.equal(m[1].better, null);
  const worse = personalModel({ pre: { connected: 3, mood: 3, stress: 2 }, post: { connected: 3, mood: 3, stress: 4 } });
  assert.equal(worse[2].better, false);
});
