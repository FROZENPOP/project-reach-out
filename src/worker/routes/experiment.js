import { readJson, intIn, invalid } from '../lib/body.js';
import { newCode, normalizeCode } from '../lib/code.js';
import { HttpError, json } from '../lib/http.js';

export const ACTIONS = ['talk_new', 'eat_together', 'phone_free', 'shared_activity', 'reach_out'];
const HOUR = 3600_000;
const READY_AFTER = 18 * HOUR;
const EXPIRES_AFTER = 7 * 24 * HOUR;

const scales = (body) => ({
  connected: intIn(body, 'connected', 1, 5),
  mood: intIn(body, 'mood', 1, 5),
  stress: intIn(body, 'stress', 1, 5),
});

const readyAt = (row) => new Date(Date.parse(row.created_at) + READY_AFTER);
const isExpired = (row, now) => now.getTime() > Date.parse(row.created_at) + EXPIRES_AFTER;
const expired = () => new HttpError(409, 'expired', 'This code is more than 7 days old.');
const alreadyFinished = () => new HttpError(409, 'already_finished', 'This code has already checked out.');

async function find(env, raw) {
  let code = null;
  try {
    code = normalizeCode(decodeURIComponent(raw));
  } catch {
    // Malformed percent-encoding can never be a code: falls through to 404.
  }
  const row = code && (await env.DB.prepare('SELECT * FROM experiment WHERE code = ?').bind(code).first());
  if (!row) throw new HttpError(404, 'not_found', 'No experiment with that code.');
  return row;
}

// POST /api/experiment/start { connected, mood, stress, actions }
export async function start({ request, env, now }) {
  const body = await readJson(request);
  const pre = scales(body);
  const { actions } = body;
  if (
    !Array.isArray(actions) || actions.length < 2 || actions.length > 3 ||
    !actions.every((a) => ACTIONS.includes(a)) || new Set(actions).size !== actions.length
  ) throw invalid(`actions must be 2 or 3 different ids from: ${ACTIONS.join(', ')}.`);

  const insert = env.DB.prepare(
    'INSERT INTO experiment (code, created_at, actions, pre_connected, pre_mood, pre_stress) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (code) DO NOTHING',
  );
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const { meta } = await insert.bind(code, now.toISOString(), JSON.stringify(actions), pre.connected, pre.mood, pre.stress).run();
    if (meta.changes === 1) return json({ code, ready_at: new Date(now.getTime() + READY_AFTER).toISOString() }, 201);
  }
  throw new Error('experiment code collided 5 times');
}

// GET /api/experiment/:code
export async function status({ env, params: [raw], now }) {
  const row = await find(env, raw);
  const ready = readyAt(row);
  let state;
  if (row.finished_at) state = 'done';
  else if (isExpired(row, now)) throw expired();
  else state = now < ready ? 'waiting' : 'ready';
  return json({ status: state, ready_at: ready.toISOString(), actions: JSON.parse(row.actions) });
}

// POST /api/experiment/:code/finish { connected, mood, stress }
export async function finish({ request, env, params: [raw], now }) {
  const row = await find(env, raw);
  if (row.finished_at) throw alreadyFinished();
  if (isExpired(row, now)) throw expired();
  if (now < readyAt(row)) throw new HttpError(409, 'too_early', 'Come back after the ready time.');
  const post = scales(await readJson(request));
  const { meta } = await env.DB.prepare(
    'UPDATE experiment SET finished_at = ?, post_connected = ?, post_mood = ?, post_stress = ? WHERE code = ? AND finished_at IS NULL',
  ).bind(now.toISOString(), post.connected, post.mood, post.stress, row.code).run();
  if (meta.changes !== 1) throw alreadyFinished();
  return json({ pre: { connected: row.pre_connected, mood: row.pre_mood, stress: row.pre_stress }, post });
}
