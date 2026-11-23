import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { headerHtml, ICON_LINK } from '../../public/js/site.js';

const root = new URL('../../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

test('1. site.css declares the ten tokens with the values from ARCHITECTURE.md', async () => {
  const css = await read('public/css/site.css');
  const tokens = {
    ground: '#0F2615', surface: '#173520', line: '#2A5434', 'line-strong': '#519759', text: '#F4F8F2',
    muted: '#B9D0BC', connect: '#F1989A', 'connect-hover': '#F7BEBF', signal: '#A8E0AE', before: '#6F9476',
  };
  for (const [name, value] of Object.entries(tokens)) {
    assert.match(css, new RegExp(`--${name}: ${value};`), `--${name}`);
  }
});

test('2. no old palette hex and no "amber" anywhere under public/ outside img/ and vendor/', async () => {
  const old = /#(0F1226|191D3A|2C3260|4A5296|5B64B8|7AD7FF|B4B9DA|F3F4FB|FFB547|FFD08A)\b/i;
  const files = (await readdir(new URL('public/', root), { recursive: true }))
    .map((f) => f.split(path.sep).join('/'))
    .filter((f) => /\.(html|css|js|svg|json)$/.test(f) && !/^(img|vendor)\//.test(f));
  assert.ok(files.length > 20, 'found the site files');
  for (const f of files) {
    const text = await read(`public/${f}`);
    assert.doesNotMatch(text, old, f);
    if (f.endsWith('.html')) assert.doesNotMatch(text, /amber/i, f);
  }
});

test('3. the header link shows the decorative logo, reads "Reach Out" and points to /', () => {
  const link = headerHtml('/').match(/<a class="site-logo"([^>]*)>([\s\S]*?)<\/a>/);
  assert.match(link[1], /href="\/"/);
  const img = link[2].match(/<img [^>]*>/)?.[0];
  assert.ok(img, 'img in the link');
  assert.match(img, /src="\/img\/logo-128\.png"/);
  assert.match(img, /alt=""/);
  assert.equal(link[2].replace(/<[^>]*>/g, '').trim(), 'Reach Out');
});

test('4. icon link is the PNG logo, favicon.svg is gone, both logo files are PNGs', async () => {
  assert.match(ICON_LINK, /href="\/img\/logo-128\.png"/);
  assert.match(ICON_LINK, /type="image\/png"/);
  await assert.rejects(access(new URL('public/favicon.svg', root)));
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (const f of ['logo-128.png', 'logo-512.png']) {
    const bytes = await readFile(new URL(`public/img/${f}`, root));
    assert.ok(bytes.subarray(0, 8).equals(sig), f);
  }
});

test('5. home hero is the large logo with alt and size; one h1, no style= or inline script', async () => {
  const html = await read('public/index.html');
  const img = html.match(/<img [^>]*class="hero-art"[^>]*>/)?.[0];
  assert.ok(img, 'hero img');
  assert.match(img, /src="\/img\/logo-512\.png"/);
  assert.match(img, /alt="[^"]+"/);
  assert.match(img, /width="\d+"/);
  assert.match(img, /height="\d+"/);
  assert.equal(html.match(/<h1[\s>]/g).length, 1);
  assert.doesNotMatch(html, /\sstyle=/);
  assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/);
});

test('6. every poster card gets the logo; QR stays #000000 on #FFFFFF', async () => {
  const js = await read('public/posters/page.js');
  const loop = js.match(/for \(const \[n, title\] of CODES\) \{([\s\S]*?)\n\}/)[1];
  assert.match(loop, /createElement\('img'\)[^\n]*src: '\/img\/logo-128\.png'/);
  assert.match(loop, /heading\.append\(num, h\);/);
  assert.match(loop, /row\.append\(logo, heading\);/);
  assert.match(loop, /card\.append\(row, svg, link\);/);
  assert.match(loop, /bg\.setAttribute\('fill', '#FFFFFF'\)/);
  assert.match(loop, /dark\.setAttribute\('fill', '#000000'\)/);
  const css = await read('public/posters/posters.css');
  const print = css.match(/@media print \{([\s\S]*)\n\}/)[1];
  assert.match(print, /\.poster-logo \{ width: 0\.5in; \}/);
  assert.match(print, /\.poster-qr \{ width: 2\.1in;/);
});
