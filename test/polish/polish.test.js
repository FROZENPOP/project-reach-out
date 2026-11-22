import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { headerHtml, nextMenuState, needsIconLink } from '../../public/js/site.js';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const TITLE = 'Reach Out: your brain is built to connect';
const DESC = 'How isolation affects the teenage brain, and six small ways to connect. A HOSA Mental Health Promotion project.';

test('1. header markup has a menu button controlling the element that holds the four links', () => {
  const html = headerHtml('/');
  const button = html.match(/<button[^>]*>Menu<\/button>/)?.[0];
  assert.ok(button, 'menu button');
  assert.match(button, /aria-expanded="false"/);
  const id = button.match(/aria-controls="([^"]+)"/)[1];
  const panel = html.match(/<nav[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/nav>/);
  assert.equal(panel?.[1], id, `aria-controls points at the nav`);
  const hrefs = [...panel[2].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ['/science/', '/game/', '/experiment/', '/results/']);
  assert.match(headerHtml('/game/'), /href="\/game\/" aria-current="page"/);
});

test('2. menu state toggles open and closed, and Escape closes it', () => {
  assert.equal(nextMenuState('false', 'toggle'), 'true');
  assert.equal(nextMenuState('true', 'toggle'), 'false');
  assert.equal(nextMenuState('true', 'escape'), 'false');
  assert.equal(nextMenuState('false', 'escape'), 'false');
});

test('3. site.css shows the menu button below 640 px and hides it from 640 px up', async () => {
  const css = await read('public/css/site.css');
  assert.match(css, /@media \(min-width: 640px\) \{\s*\.menu-btn \{ display: none; \}/);
  const below = css.match(/@media \(max-width: 639\.98px\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(below, 'below-640 block');
  assert.match(below, /\.site-nav \{[^}]*display: none/);
  assert.match(below, /\.menu-open \.site-nav \{ display: flex; \}/);
  assert.doesNotMatch(css.replace(/@media[^{]*\{[\s\S]*?\n\}/g, ''), /\.menu-btn \{[^}]*display: none/, 'button hidden outside a media query');
});

test('4. favicon.svg is an svg in --connect, and the icon link is added only when none exists', async () => {
  const svg = (await read('public/favicon.svg')).trim();
  assert.match(svg, /^<svg\s[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>[\s\S]*<\/svg>$/);
  assert.match(svg, /#FFB547/);
  assert.match(svg, /#0F1226/);
  // Well-formed: every non-self-closing tag is closed in order.
  const stack = [];
  for (const [, close, name, self] of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    if (close) assert.equal(stack.pop(), name);
    else if (!self) stack.push(name);
  }
  assert.equal(stack.length, 0);
  assert.equal(needsIconLink([]), true);
  assert.equal(needsIconLink(['stylesheet', 'preconnect']), true);
  assert.equal(needsIconLink(['stylesheet', 'icon']), false);
  assert.equal(needsIconLink(['shortcut icon']), false);
});

test('5. home page names both factors word for word with citations and a link to the research', async () => {
  const html = await read('public/index.html');
  assert.match(html, /<h3>The risk: isolation<\/h3>/);
  assert.match(html, /<h3>The protection: connection<\/h3>/);
  assert.ok(html.includes('Spending a lot of time cut off from other people makes anxiety and depression more likely, and the teenage brain is especially sensitive to it. (<a href="/science/#ref-loades2020">Loades et al., 2020</a>; <a href="/science/#ref-orben2020">Orben et al., 2020</a>)'));
  assert.ok(html.includes('Supportive relationships with friends, family and trusted adults, and feeling that you belong at school, make those problems less likely. (<a href="/science/#ref-samhsa2019">Substance Abuse and Mental Health Services Administration, 2019</a>)'));
  assert.match(html, /<a href="\/science\/">See the research<\/a>/);
  assert.ok(html.indexOf('The risk: isolation') > html.indexOf('</h1>') && html.indexOf('The risk: isolation') < html.indexOf('id="codes-title"'));
  assert.equal(html.match(/<h1[\s>]/g).length, 1);
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  for (const [, attrs, inner] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    assert.match(attrs, /\ssrc=/);
    assert.equal(inner.trim(), '');
  }
});

test('6. home page has the five sharing tags with the exact title and description', async () => {
  const html = await read('public/index.html');
  assert.ok(html.includes(`<meta name="description" content="${DESC}">`));
  assert.ok(html.includes(`<meta property="og:title" content="${TITLE}">`));
  assert.ok(html.includes(`<meta property="og:description" content="${DESC}">`));
  assert.ok(html.includes('<meta property="og:type" content="website">'));
  assert.ok(html.includes('<meta name="twitter:card" content="summary">'));
  assert.doesNotMatch(html, /og:image|twitter:image/);
});
