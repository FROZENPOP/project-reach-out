// Pure logic for /your-turn/.
import { api } from '../js/site.js';
import { formError } from '../fact/shared.js';
import { hasBadLanguage, BAD_LANGUAGE } from './language.js';

export const MAX = 280;
const length = (s) => [...s].length; // code points, so an emoji counts once

export const counterText = (text) => `${length(text)} of ${MAX} characters`;

// The first MAX code points of text.
export const clip = (text) => (length(text) > MAX ? [...text].slice(0, MAX).join('') : text);

// Resolves { ok: true, text } with the trimmed text, or { ok: false, error }.
export function validateAnswer(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { ok: false, error: 'Write an answer first.' };
  if (length(trimmed) > MAX) return { ok: false, error: `Keep it to ${MAX} characters or fewer.` };
  if (hasBadLanguage(trimmed)) return { ok: false, error: BAD_LANGUAGE };
  return { ok: true, text: trimmed };
}

// Sends the answer and never changes `form`. Resolves { ok: true } or { error } with the alert text.
export async function submitAnswer(form) {
  const v = validateAnswer(form.text);
  if (!v.ok) return { error: v.error };
  try {
    await api('/api/answers', { method: 'POST', body: { text: v.text } });
    return { ok: true };
  } catch (err) {
    return { error: formError(err) };
  }
}
