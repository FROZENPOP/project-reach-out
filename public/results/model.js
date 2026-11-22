// Pure logic for /results/. No DOM, so node --test can import it.
import { ACTIONS, MEASURES } from '../experiment/model.js';

export const MIN_GROUP = 5;

// The same six titles as the home page tiles, by QR number.
export const QR_TITLES = ['Did you know?', 'Take a 30-second challenge', 'How connected are you?', 'Listen', 'Your turn', 'Learn more'];

const round2 = (x) => Math.round(x * 100) / 100;

// A mean on the fixed 1 to 5 axis as a bar height in percent: 1 is 0, 5 is 100.
export const barHeight = (mean) => Math.min(100, Math.max(0, ((mean - 1) / 4) * 100));

export function changeText(before, after) {
  const d = round2(after - before);
  if (d === 0) return 'no change';
  return `${d > 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(2)}`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function experimentModel(exp) {
  const base = {
    headline: `${plural(exp.finished, 'volunteer', 'volunteers')} answered the same three questions before and after 24 hours of connecting on purpose.`,
  };
  if (!exp.pre || !exp.post) {
    return {
      ...base,
      chart: null,
      waiting: `The chart appears when ${MIN_GROUP} volunteers have finished. So far: ${exp.finished} finished, ${exp.started} started.`,
      actions: null,
    };
  }
  const groups = MEASURES.map(([key, label]) => {
    const before = exp.pre[key];
    const after = exp.post[key];
    return {
      key,
      label,
      before,
      after,
      beforePct: barHeight(before),
      afterPct: barHeight(after),
      change: changeText(before, after),
      text: `${before.toFixed(2)} to ${after.toFixed(2)}, ${changeText(before, after)}`,
      note: key === 'stress' ? 'Lower is better.' : '',
    };
  });
  const actions = exp.actions
    ? ACTIONS.map(([id, label]) => ({ id, label, count: exp.actions[id] ?? 0 })).sort((a, b) => b.count - a.count)
    : null;
  return { ...base, chart: groups, waiting: null, actions };
}

export function pulseModel(pulse) {
  const base = { n: pulse.n, text: `${plural(pulse.n, 'student has', 'students have')} answered the three questions.` };
  if (!pulse.counts) {
    return { ...base, bars: null, waiting: `The totals appear when ${MIN_GROUP} students have answered. So far: ${pulse.n}.` };
  }
  const totals = [3, 4, 5, 6, 7, 8, 9].map((total) => ({ total, count: pulse.counts[String(total)] ?? 0 }));
  const max = Math.max(1, ...totals.map((t) => t.count));
  return { ...base, bars: totals.map((t) => ({ ...t, pct: (t.count / max) * 100 })), waiting: null };
}

export function campaignModel(counters) {
  const scans = QR_TITLES.map((title, i) => ({ n: i + 1, title, count: counters[`scan:${i + 1}`] ?? 0 }));
  return {
    totalScans: scans.reduce((sum, s) => sum + s.count, 0),
    scans,
    challenges: counters.challenge_done ?? 0,
    games: counters.game_played ?? 0,
    clips: counters.listen_opened ?? 0,
  };
}

// Answer texts stay plain strings; the page puts them in with textContent.
export const answersModel = (answers) =>
  answers.length ? { empty: false, items: [...answers] } : { empty: true, text: 'No answers yet. Add the first one.' };

export const resultsModel = (data) => ({
  state: 'ok',
  experiment: experimentModel(data.experiment),
  pulse: pulseModel(data.pulse),
  campaign: campaignModel(data.counters),
  answers: answersModel(data.answers),
});

// Loads GET /api/results through the given api(). A failure is the alert state and carries no numbers.
export async function loadResults(api) {
  try {
    return resultsModel(await api('/api/results'));
  } catch (err) {
    return { state: 'error', message: err.message || 'Could not load the results.' };
  }
}
