// QR campaign flyers: /flyer/?n=1 … ?n=6. /q/<n> redirects here.
export const FLYERS = [
  { eyebrow: 'Brain fact', title: 'Did you know?', path: '/fact/', btn: 'See the full fact', card: [
    ['', 'Social interaction helps the developing brain build stronger connections for communication, emotional regulation and problem-solving.'],
    ['small', 'Positive interactions support learning and healthy brain development.'] ] },
  { eyebrow: '30-second challenge', title: 'Take 30 seconds.', path: '/challenge/', btn: 'Get another challenge', card: [
    ['big', 'Text someone you haven’t talked to recently and ask how they’re doing.'],
    ['small', 'That’s it. Do it now, before you put your phone away.'] ] },
  { eyebrow: 'Quick check-in', title: 'How connected are you?', path: '/pulse/', btn: 'Answer 3 questions', card: [
    ['', 'Three quick questions about connection. No name, no account, totally anonymous.'],
    ['small', 'Then see how the rest of the school answered.'] ] },
  { eyebrow: 'Our podcast', title: 'Listen.', path: '/listen/', btn: 'Play the clip', card: [
    ['', 'A short clip from the Project Reach Out podcast on isolation, connection and the teenage brain.'],
    ['small', 'Grab your headphones. It only takes a minute.'] ] },
  { eyebrow: 'Your turn', title: 'Your turn.', path: '/your-turn/', btn: 'Share my answer', card: [
    ['big', 'What helps you feel connected to other people?'],
    ['small', 'Answer anonymously. Approved answers show up on our results page.'] ] },
  { eyebrow: 'Learn more', title: 'The science.', path: '/science/', btn: 'Read the science', card: [
    ['', 'Your brain is still being built during your teen years, and other people are part of what builds it.'],
    ['small', 'That’s why isolation is a risk, and connection is protection.'] ] },
];

// ?n= outside 1..6 falls back to flyer 1.
export const flyerNumber = (search) => {
  const n = Number(new URLSearchParams(search).get('n'));
  return Number.isInteger(n) && n >= 1 && n <= FLYERS.length ? n : 1;
};

if (typeof document !== 'undefined') {
  const n = flyerNumber(location.search);
  const f = FLYERS[n - 1];
  const $ = (id) => document.getElementById(id);
  const p = (cls, text) => Object.assign(document.createElement('p'), { className: cls, textContent: text });
  document.title = `${f.title} | Reach Out`;
  $('count').textContent = `QR ${n} of 6`;
  $('dots').replaceChildren(...FLYERS.map((_, i) => Object.assign(document.createElement('span'), { className: i === n - 1 ? 'on' : '' })));
  $('eyebrow').textContent = `Code #${n} · ${f.eyebrow}`;
  $('title').textContent = f.title;
  $('title').classList.toggle('long', f.title.length > 16);
  $('card').replaceChildren(...f.card.map(([cls, text]) => p(cls, text)));
  $('btn').textContent = `${f.btn} →`;
  $('btn').href = f.path;
  $('hunt').textContent = `You found code #${n}. Find all 6 around Creekside!`;
}
