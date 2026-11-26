// Bad-language check for Your Turn answers. Shared by the form (public/your-turn/logic.js) and the
// Worker (src/worker/routes/answers.js), so the server enforces the same rule the page shows.
// shortcut: a word list catches common swearing, slurs and their usual disguises, not every insult;
// answers are still read by a team member before they appear anywhere.

export const BAD_LANGUAGE = 'Please keep it kind and school-appropriate. Try saying it without that language.';

// Found anywhere inside a word ("bullshit", "fucking"). Only roots that are not part of everyday words.
const ROOTS = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'slut', 'retard',
  'motherf', 'asshole', 'dumbass', 'jackass', 'asswipe', 'dickhead', 'porn', 'bastard', 'wank'];

// Whole words only, plus common endings ("dicks", "pissed"), so "class", "peacock" and "grape" pass.
const WORDS = ['ass', 'arse', 'damn', 'dick', 'cock', 'prick', 'twat', 'piss', 'tits', 'fag', 'rape',
  'hoe', 'thot', 'douche', 'fck', 'fk', 'stfu', 'wtf', 'kys', 'chink', 'spic', 'kike', 'tranny', 'dyke',
  'wetback', 'gook', 'coon', 'skank'];

// Checked on the cleaned-up text with single spaces.
const PHRASES = ['kill yourself', 'kill urself', 'kill ur self', 'go die'];

// Swap look-alike symbols for letters (sh1t, @ss, $hit) and drop accents (fück).
const LEET = { 0: 'o', 1: 'i', '!': 'i', '|': 'i', 3: 'e', 4: 'a', '@': 'a', 5: 's', $: 's', 7: 't', '+': 't', 8: 'b' };
const clean = (text) => String(text ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[01!|3478@$5+]/g, (c) => LEET[c]);

// Each letter may repeat (fuuuck) or be masked with * (f*ck), except the first.
const pattern = (word) => [...word].map((c, i) => (i === 0 ? `${c}+` : `[${c}*]+`)).join('');
const ROOT_RE = new RegExp(ROOTS.map(pattern).join('|'));
const WORD_RE = new RegExp(`^(?:${WORDS.map(pattern).join('|')})(?:s|es|ed|ing|er|ers|y)?$`);

// Words split on spaces; punctuation inside a word is dropped (f.u.c.k), and runs of single
// letters are joined (f u c k).
function words(text) {
  const out = [];
  let run = '';
  for (const raw of clean(text).split(/\s+/)) {
    const w = raw.replace(/[^a-z*]/g, '');
    if (w.length === 1) { run += w; continue; }
    if (run) out.push(run), (run = '');
    if (w) out.push(w);
  }
  if (run) out.push(run);
  return out;
}

export function hasBadLanguage(text) {
  const spaced = clean(text).replace(/[^a-z*]+/g, ' ').trim();
  if (PHRASES.some((p) => ` ${spaced} `.includes(` ${p} `))) return true;
  return words(text).some((w) => ROOT_RE.test(w) || WORD_RE.test(w));
}
