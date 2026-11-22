import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const html = await read('public/science/index.html');
const refs = JSON.parse(await read('public/data/references.json'));

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const text = (s) => decode(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const section = (id) => {
  const m = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?</section>`));
  assert.ok(m, `section #${id}`);
  return m[0];
};
const refItems = [...html.matchAll(/<li id="ref-([^"]+)">([\s\S]*?)<\/li>/g)].map(([, id, inner]) => ({ id, inner }));
const citations = [...html.matchAll(/<a href="#ref-([^"]+)">([\s\S]*?)<\/a>/g)].map(([, id, inner]) => ({ id, text: text(inner) }));
const paragraphsCiting = (id) => [...html.matchAll(/<p[\s>][\s\S]*?<\/p>/g)].map(([p]) => p).filter((p) => p.includes(`#ref-${id}"`));

// APA in-text form from the apa string: "A, yr", "A & B, yr", "A et al., yr", or the group author.
function inText(apa) {
  const [, authors, year] = apa.match(/^(.*?)\s\((\d{4})\)/);
  if (!authors.includes(',')) return `${authors.replace(/\.$/, '')}, ${year}`;
  const surnames = authors.split(/\.,\s(?:&\s)?/).map((a) => a.split(',')[0].trim());
  const who = surnames.length === 1 ? surnames[0] : surnames.length === 2 ? `${surnames[0]} & ${surnames[1]}` : `${surnames[0]} et al.`;
  return `${who}, ${year}`;
}

test('1. every #ref- link resolves, and every reference is listed word for word with its URL', () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, target] of html.matchAll(/href="#(ref-[^"]+)"/g)) assert.ok(ids.has(target), `dangling #${target}`);
  for (const ref of refs) {
    const li = refItems.find((r) => r.id === ref.id);
    assert.ok(li, `missing li#ref-${ref.id}`);
    assert.ok(text(li.inner).includes(ref.apa), `apa text for ${ref.id}`);
    assert.ok(li.inner.includes(`href="${ref.url}"`), `url for ${ref.id}`);
  }
  assert.equal(refItems.length, refs.length);
});

test('2. the reference list is in alphabetical order', () => {
  const texts = refItems.map((r) => text(r.inner).toLowerCase());
  assert.deepEqual(texts, [...texts].sort());
});

test('3. sections 3 to 6 cite, and every citation names its reference', () => {
  for (const id of ['brain', 'friends', 'isolation', 'mental-health']) assert.match(section(id), /href="#ref-/, `#${id} has no citation`);
  assert.ok(citations.length > 0);
  for (const c of citations) {
    const ref = refs.find((r) => r.id === c.id);
    assert.ok(ref, `unknown ref ${c.id}`);
    assert.equal(c.text, inText(ref.apa), `citation text for ${c.id}`);
  }
});

test('4. ten h2 sections in order, one h1, every toc link resolves', () => {
  const headings = [...html.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].filter(([, id]) => id !== 'toc-title').map(([, , t]) => text(t));
  assert.deepEqual(headings, [
    'The short version', 'Risk factor and protective factor', 'Your brain is still being built',
    'Why friends matter so much right now', 'What isolation does', 'What it means for mental health',
    'What we do not know', 'What you can do', 'If you are struggling', 'References',
  ]);
  assert.equal(html.match(/<h1[\s>]/g).length, 1);
  const toc = html.match(/<nav class="toc"[\s\S]*?<\/nav>/)[0];
  const links = [...toc.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  assert.equal(links.length, 10);
  for (const id of links) assert.match(html, new RegExp(`<section id="${id}"`), `toc #${id}`);
});

test('5. section 2 names the risk factor and the protective factor', () => {
  const s = text(section('factors')).toLowerCase();
  for (const w of ['risk factor', 'protective factor', 'isolation', 'connection']) assert.ok(s.includes(w), w);
});

test('6. animal and adult findings are labelled', () => {
  const check = (id, words) => {
    const ps = paragraphsCiting(id);
    assert.ok(ps.length > 0, `no paragraph cites ${id}`);
    for (const p of ps) for (const w of words) assert.ok(text(p).toLowerCase().includes(w), `${id} paragraph lacks "${w}"`);
  };
  check('makinodan2012', ['mice', 'animal']);
  check('tomova2020', ['adults']);
  check('holtlunstad2010', ['adults']);
});

test('7. safety lines, shared header and footer, CSP-safe markup, accessible figure', () => {
  assert.ok(html.includes('988'));
  assert.ok(html.includes('not medical advice'));
  assert.match(html, /<site-header><\/site-header>/);
  assert.match(html, /<site-footer><\/site-footer>/);
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  for (const [, attrs, inner] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    assert.match(attrs, /\ssrc=/, 'script without src');
    assert.equal(inner.trim(), '', 'inline script body');
  }
  const svg = html.match(/<figure[\s\S]*?<svg([^>]*)>/);
  assert.ok(svg, 'figure with svg');
  assert.match(svg[1], /role="img"/);
  assert.match(svg[1], /aria-label="[^"]*\S[^"]*"/);
});

test('8. no number in the page text outside the brief and references.json', () => {
  // Numbers the brief allows on this page.
  const brief = ['10', '40', '63', '51,000', '36', '37', '2012', '2018', '15', '16', '24', '70%', '2003', '148', '50%', '988', '30'];
  const tokens = (s) => s.match(/\d[\d,.]*\d%?|\d%?/g) ?? [];
  const allowed = new Set([...brief, ...refs.flatMap((r) => tokens(`${r.apa} ${r.url}`))]);
  const body = text(html.replace(/<head>[\s\S]*?<\/head>/, ''));
  const stray = tokens(body).filter((n) => !allowed.has(n));
  assert.deepEqual(stray, []);
});
