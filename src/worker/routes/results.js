import { json } from '../lib/http.js';

const MIN_GROUP = 5;
const round2 = (x) => Math.round(x * 100) / 100;

// GET /api/results. Group numbers stay null below five responses.
export default async function results({ env }) {
  const db = env.DB;
  const [counters, [exp], actions, [pulse], scores, answers] = (
    await db.batch([
      db.prepare('SELECT name, SUM(count) AS count FROM counters GROUP BY name'),
      // pre_* means cover finished rows only; post_* are NULL on unfinished rows, so AVG skips them.
      db.prepare(`SELECT COUNT(*) AS started, COUNT(finished_at) AS finished,
        AVG(CASE WHEN finished_at IS NOT NULL THEN pre_connected END) AS pre_connected,
        AVG(CASE WHEN finished_at IS NOT NULL THEN pre_mood END) AS pre_mood,
        AVG(CASE WHEN finished_at IS NOT NULL THEN pre_stress END) AS pre_stress,
        AVG(post_connected) AS post_connected, AVG(post_mood) AS post_mood, AVG(post_stress) AS post_stress
        FROM experiment`),
      db.prepare(`SELECT a.value AS action, COUNT(*) AS count FROM experiment, json_each(experiment.actions) AS a
        WHERE experiment.finished_at IS NOT NULL GROUP BY a.value`),
      db.prepare('SELECT COUNT(*) AS n, AVG(lack + left_out + isolated) AS mean FROM pulse'),
      db.prepare('SELECT lack + left_out + isolated AS score, COUNT(*) AS count FROM pulse GROUP BY score ORDER BY score'),
      db.prepare("SELECT text FROM answers WHERE status = 'approved' ORDER BY created_at DESC, id DESC LIMIT 50"),
    ])
  ).map((r) => r.results);

  const enough = exp.finished >= MIN_GROUP;
  const means = (prefix) => ({
    connected: round2(exp[`${prefix}_connected`]),
    mood: round2(exp[`${prefix}_mood`]),
    stress: round2(exp[`${prefix}_stress`]),
  });
  const pulseShown = pulse.n >= MIN_GROUP;

  return json(
    {
      experiment: {
        started: exp.started,
        finished: exp.finished,
        pre: enough ? means('pre') : null,
        post: enough ? means('post') : null,
        actions: enough ? Object.fromEntries(actions.map((r) => [r.action, r.count])) : null,
      },
      pulse: {
        n: pulse.n,
        mean: pulseShown ? round2(pulse.mean) : null,
        counts: pulseShown ? Object.fromEntries(scores.map((r) => [String(r.score), r.count])) : null,
      },
      counters: Object.fromEntries(counters.map((r) => [r.name, r.count])),
      answers: answers.map((r) => r.text),
    },
    200,
    { 'Cache-Control': 'public, max-age=30' },
  );
}
