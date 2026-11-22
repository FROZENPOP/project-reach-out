import { readJson, oneOf } from '../lib/body.js';
import { increment } from '../lib/counter.js';
import { noContent } from '../lib/http.js';

const NAMES = ['challenge_done', 'game_played', 'listen_opened'];

// POST /api/count { name }
export default async function count({ request, env, now }) {
  const name = oneOf(await readJson(request), 'name', NAMES);
  await increment(env.DB, name, now);
  return noContent();
}
