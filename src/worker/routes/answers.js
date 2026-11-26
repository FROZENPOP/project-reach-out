import { readJson, textIn } from '../lib/body.js';
import { HttpError, json } from '../lib/http.js';
import { hasBadLanguage, BAD_LANGUAGE } from '../../../public/your-turn/language.js';

// POST /api/answers { text }. Stored pending; never shown until approved.
export default async function answers({ request, env, now }) {
  const text = textIn(await readJson(request), 'text', 280);
  if (hasBadLanguage(text)) throw new HttpError(400, 'bad_language', BAD_LANGUAGE);
  await env.DB.prepare('INSERT INTO answers (created_at, text) VALUES (?, ?)').bind(now.toISOString(), text).run();
  return json({ ok: true }, 201);
}
