import { readJson, oneOf, invalid } from '../lib/body.js';
import { toCsv } from '../lib/csv.js';
import { HttpError, json } from '../lib/http.js';

const STATUSES = ['pending', 'approved', 'rejected'];
// Exportable tables with their columns and order. Only these names ever reach SQL.
export const TABLES = {
  experiment: {
    columns: ['code', 'created_at', 'actions', 'pre_connected', 'pre_mood', 'pre_stress', 'finished_at', 'post_connected', 'post_mood', 'post_stress'],
    order: 'created_at, code',
  },
  pulse: { columns: ['id', 'created_at', 'lack', 'left_out', 'isolated'], order: 'id' },
  answers: { columns: ['id', 'created_at', 'text', 'status'], order: 'id' },
  counters: { columns: ['name', 'day', 'count'], order: 'name, day' },
};

// GET /api/admin/answers?status=pending
export async function listAnswers({ request, env }) {
  const status = new URL(request.url).searchParams.get('status') ?? 'pending';
  if (!STATUSES.includes(status)) throw invalid(`status must be one of: ${STATUSES.join(', ')}.`);
  const { results } = await env.DB.prepare(
    'SELECT id, created_at, text, status FROM answers WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT 200',
  ).bind(status).all();
  return json(results);
}

// POST /api/admin/answers/:id { status }
export async function setAnswer({ request, env, params: [id] }) {
  const status = oneOf(await readJson(request), 'status', ['approved', 'rejected']);
  const { meta } = await env.DB.prepare('UPDATE answers SET status = ? WHERE id = ?').bind(status, Number(id)).run();
  if (meta.changes !== 1) throw new HttpError(404, 'not_found', 'No answer with that id.');
  return json({ ok: true });
}

// GET /api/admin/export.csv?table=
export async function exportCsv({ request, env }) {
  const name = new URL(request.url).searchParams.get('table');
  if (!Object.hasOwn(TABLES, name)) throw invalid(`table must be one of: ${Object.keys(TABLES).join(', ')}.`);
  const { columns, order } = TABLES[name];
  const { results } = await env.DB.prepare(`SELECT ${columns.join(', ')} FROM ${name} ORDER BY ${order}`).all();
  return new Response(toCsv(columns, results), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` },
  });
}
