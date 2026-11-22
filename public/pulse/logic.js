// Pure logic for /pulse/.
import { api } from '../js/site.js';
import { formError } from '../fact/shared.js';

export const QUESTIONS = [
  { key: 'lack', text: 'How often do you feel that you lack companionship?' },
  { key: 'left_out', text: 'How often do you feel left out?' },
  { key: 'isolated', text: 'How often do you feel isolated from others?' },
];
export const OPTIONS = [['Hardly ever', 1], ['Some of the time', 2], ['Often', 3]];
const VALUE = new Map(OPTIONS);

// answers: { lack, left_out, isolated } holding option labels. Returns the POST body, or null until all three are answered.
export function buildPulseBody(answers) {
  const body = {};
  for (const { key } of QUESTIONS) {
    const v = VALUE.get(answers?.[key]);
    if (!v) return null;
    body[key] = v;
  }
  return body;
}

export const OFTEN_NOTE = 'Feeling this way is common, and it can change. Talking with a counselor or an adult you trust helps. To talk to someone now, call or text 988.';
export const FEW = 'Not enough answers yet to show the group.';

// The support note when any answer was "Often". Depends only on the visitor's own answers, never on the network.
export const oftenNote = (own) => (QUESTIONS.some(({ key }) => own?.[key] === 3) ? OFTEN_NOTE : null);

// Loads GET /api/results into the view model. On failure: { often, error }, so the support note still shows.
export async function loadResultsView(own) {
  try {
    return resultsView(await api('/api/results'), own);
  } catch (err) {
    return { often: oftenNote(own), error: `Could not load how the group answered. ${err.message}` };
  }
}

// results: GET /api/results; own:the visitor's POST body ({ lack, left_out, isolated }, 1 to 3).
export function resultsView(results, own) {
  const n = results?.pulse?.n ?? 0;
  const total = own.lack + own.left_out + own.isolated;
  const counts = results?.pulse?.counts;
  return {
    thanks: `Thanks. ${n} ${n === 1 ? 'student has' : 'students have'} answered.`,
    total,
    often: oftenNote(own),
    few: counts ? null : FEW,
    bars: counts
      ? [3, 4, 5, 6, 7, 8, 9].map((t) => ({ total: t, count: Number(counts[t] ?? 0), you: t === total }))
      : null,
  };
}

// Sends the answers and never changes `answers`. Resolves { body } on success or { error } with the alert text.
export async function submitPulse(answers) {
  const body = buildPulseBody(answers);
  if (!body) return { error: 'Answer all three questions first.' };
  try {
    await api('/api/pulse', { method: 'POST', body });
    return { body };
  } catch (err) {
    return { error: formError(err) };
  }
}
