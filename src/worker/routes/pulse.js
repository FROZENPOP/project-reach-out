import { readJson, intIn } from '../lib/body.js';
import { json } from '../lib/http.js';

// POST /api/pulse { lack, left_out, isolated }
export default async function pulse({ request, env, now }) {
  const body = await readJson(request);
  const values = ['lack', 'left_out', 'isolated'].map((key) => intIn(body, key, 1, 3));
  await env.DB.prepare('INSERT INTO pulse (created_at, lack, left_out, isolated) VALUES (?, ?, ?, ?)')
    .bind(now.toISOString(), ...values)
    .run();
  return json({ ok: true }, 201);
}
