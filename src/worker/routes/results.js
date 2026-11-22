import { json } from '../lib/http.js';

// GET /api/results. Only counters are computed so far; the api task fills the rest.
export default async function results({ env }) {
  const { results: rows } = await env.DB.prepare('SELECT name, SUM(count) AS count FROM counters GROUP BY name').all();
  return json(
    {
      experiment: { started: 0, finished: 0, pre: null, post: null, actions: null },
      pulse: { n: 0, mean: null, counts: null },
      counters: Object.fromEntries(rows.map((r) => [r.name, r.count])),
      answers: [],
    },
    200,
    { 'Cache-Control': 'public, max-age=30' },
  );
}
