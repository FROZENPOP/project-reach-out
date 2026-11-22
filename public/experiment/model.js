// Pure logic for /experiment/. No DOM, so node --test can import it.

export const ACTIONS = [
  ['talk_new', 'Talk to someone you normally do not talk to'],
  ['eat_together', 'Eat with someone instead of alone'],
  ['phone_free', 'Have a phone-free conversation'],
  ['shared_activity', 'Do an activity with a friend or family member'],
  ['reach_out', 'Reach out to someone you have not talked to in a while'],
];
export const actionLabel = (id) => ACTIONS.find(([a]) => a === id)?.[1] ?? id;

export const MEASURES = [
  ['connected', 'Connectedness', 'How connected do you feel to the people around you?'],
  ['mood', 'Mood', 'How is your mood right now?'],
  ['stress', 'Stress', 'How stressed do you feel right now?'],
];

// Uppercases and drops spaces and dashes. Empty input is no code.
export const normalizeCode = (raw) => String(raw ?? '').toUpperCase().replace(/[\s-]/g, '') || null;

// The URL's ?code= wins over the code remembered on this phone.
export const resolveCode = (search, stored) =>
  normalizeCode(new URLSearchParams(search).get('code')) ?? normalizeCode(stored);

export const formatCode = (code) => (code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code);

// Check-in form state: { ratings: { connected, mood, stress }, actions: [ids] }.
export const emptyForm = () => ({ ratings: {}, actions: [] });

export const rate = (form, key, value) => ({ ...form, ratings: { ...form.ratings, [key]: value } });

export const ratingsDone = (ratings) => MEASURES.every(([k]) => Number.isInteger(ratings[k]));

// Toggles an action; a fourth one is refused (form returned unchanged).
export function toggleAction(form, id) {
  if (form.actions.includes(id)) return { ...form, actions: form.actions.filter((a) => a !== id) };
  if (form.actions.length >= 3) return form;
  return { ...form, actions: [...form.actions, id] };
}

export const canSubmit = (form) => ratingsDone(form.ratings) && form.actions.length >= 2 && form.actions.length <= 3;

export const startBody = (form) => ({
  connected: form.ratings.connected,
  mood: form.ratings.mood,
  stress: form.ratings.stress,
  actions: [...form.actions],
});

export const finishBody = (ratings) => ({ connected: ratings.connected, mood: ratings.mood, stress: ratings.stress });

// Maps a GET /api/experiment/:code result, or the ApiError it threw, to a view name.
export function chooseView(result) {
  if (result instanceof Error) {
    if (result.status === 404) return 'not-found';
    if (result.status === 409 && result.code === 'expired') return 'expired';
    if (result.status === 409 && result.code === 'already_finished') return 'done';
    return 'error';
  }
  return { waiting: 'waiting', ready: 'checkout', done: 'done' }[result.status] ?? 'error';
}

const round2 = (x) => Math.round(x * 100) / 100;

// The volunteer's own before and after from POST .../finish { pre, post }.
export const personalModel = ({ pre, post }) =>
  MEASURES.map(([key, label]) => {
    const change = round2(post[key] - pre[key]);
    const betterDirection = key === 'stress' ? 'down' : 'up';
    return {
      key,
      label,
      before: pre[key],
      after: post[key],
      change,
      betterDirection,
      better: change === 0 ? null : (change < 0) === (betterDirection === 'down'),
    };
  });

export const readyText = (readyAt, locale) =>
  new Date(readyAt).toLocaleString(locale, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
