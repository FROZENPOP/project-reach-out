import { readJson, textIn } from '../lib/body.js';
import { json } from '../lib/http.js';

// POST /api/answers { text }. Stored pending; never shown until approved.
export default async function answers({ request, env, now }) {
  const text = textIn(await readJson(request), 'text', 280);
  await env.DB.prepare('INSERT INTO answers (created_at, text) VALUES (?, ?)').bind(now.toISOString(), text).run();
  return json({ ok: true }, 201);
}
