import { readJson, textIn } from '../lib/body.js';
import { json } from '../lib/http.js';
import { hasBadLanguage } from '../../../public/your-turn/language.js';

// POST /api/answers { text }. Stored pending; never shown until approved. Answers that fail the word check are dropped.
export default async function answers({ request, env, now }) {
  const text = textIn(await readJson(request), 'text', 280);
  // Bad language gets the same reply as a saved answer but is never stored, so there is nothing to retry against.
  if (hasBadLanguage(text)) return json({ ok: true }, 201);
  await env.DB.prepare('INSERT INTO answers (created_at, text) VALUES (?, ?)').bind(now.toISOString(), text).run();
  return json({ ok: true }, 201);
}
