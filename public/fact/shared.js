// Pure helpers shared by the QR landing pages (fact, challenge, pulse, your-turn).

// A random index in [0, length) that is never `last` (when there is more than one choice).
export function pickOther(length, last, random = Math.random) {
  if (length <= 1) return 0;
  if (!(last >= 0 && last < length)) return Math.floor(random() * length);
  const i = Math.floor(random() * (length - 1));
  return i >= last ? i + 1 : i;
}

export const TOO_MANY = 'Too many tries. Wait a minute and try again.';

// The alert text for a failed api() call.
export const formError = (err) => (err?.status === 429 ? TOO_MANY : err?.message || 'Something went wrong. Try again.');
