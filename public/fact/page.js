import { api } from '/js/site.js';
import { pickOther, shortCitation } from '/fact/logic.js';

const $ = (id) => document.getElementById(id);
let facts = [];
let refs = new Map();
let current = -1;

function show() {
  current = pickOther(facts.length, current);
  const fact = facts[current];
  const ref = refs.get(fact.ref);
  $('fact-text').textContent = fact.text;
  $('fact-detail').textContent = fact.detail;
  const cite = $('fact-cite');
  cite.textContent = ref ? shortCitation(ref.apa) : 'Source';
  cite.href = `/science/#ref-${encodeURIComponent(fact.ref)}`;
  cite.hidden = false;
  const bar = $('fact-bar'); // restart the 20-second bar
  bar.style.animation = 'none';
  void bar.offsetWidth;
  bar.style.animation = '';
}

try {
  const [f, r] = await Promise.all([api('/data/facts.json'), api('/data/references.json')]);
  facts = f;
  refs = new Map(r.map((x) => [x.id, x]));
  show();
  $('fact-next').disabled = false;
  $('fact-next').addEventListener('click', show);
} catch (err) {
  $('fact-text').textContent = 'Did you know?';
  $('fact-error').textContent = `Could not load a fact. ${err.message}`;
}
