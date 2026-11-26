import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { api, ApiError, footerHtml } from '../../public/js/site.js';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('10. site.css defines every ARCHITECTURE.md token with its value', async () => {
  const css = await read('public/css/site.css');
  const root = css.match(/:root\s*\{([^}]*)\}/)[1];
  const tokens = {
    '--ground': '#0F2615', '--surface': '#173520', '--line': '#2A5434', '--line-strong': '#519759',
    '--text': '#F4F8F2', '--muted': '#B9D0BC', '--connect': '#F1989A', '--signal': '#A8E0AE', '--before': '#6F9476',
  };
  for (const [name, value] of Object.entries(tokens)) {
    const declared = root.match(new RegExp(`(?:^|[;\\s])${name}:([^;]*);`));
    assert.equal(declared?.[1].trim().toUpperCase(), value, name);
  }
});

test('11. footer has team, school, chapter, 988, not-medical-advice, references link, and escapes site values', () => {
  const html = footerHtml({ team: 'Ana & Ben', school: 'North High', chapter: '42', podcast: {} });
  assert.match(html, /Ana &amp; Ben/);
  assert.match(html, /North High/);
  assert.match(html, /chapter 42/);
  assert.match(html, /988/);
  assert.match(html, /not medical advice/);
  assert.match(html, /href="\/science\/#references"/);
  const evil = footerHtml({ team: '<img src=x onerror=alert(1)>', school: '"quoted"', chapter: "it's" });
  assert.doesNotMatch(evil, /<img/);
  assert.match(evil, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(evil, /&quot;quoted&quot;/);
  assert.match(evil, /it&#39;s/);
  assert.match(footerHtml({ team: `<img src=x onerror=1>&"'` }), /&lt;img src=x onerror=1&gt;&amp;&quot;&#39;/);
  assert.match(footerHtml(null), /988/);
});

test('12. index.html: one h1, header, footer, open links, locked tiles for codes 1-5, no inline style or script', async () => {
  const html = await read('public/index.html');
  assert.equal(html.match(/<h1[\s>]/g).length, 1);
  assert.match(html, /<site-header><\/site-header>/);
  assert.match(html, /<site-footer><\/site-footer>/);
  for (const href of ['/science/', '/experiment/', '/game/']) {
    assert.match(html, new RegExp(`href="${href}"`), href);
  }
  for (const href of ['/fact/', '/challenge/', '/pulse/', '/listen/', '/your-turn/', '/posters/']) {
    assert.doesNotMatch(html, new RegExp(`href="${href}`), `${href} must stay locked`);
  }
  assert.equal(html.match(/class="card tile-locked"/g)?.length, 5);
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  for (const [, attrs, inner] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    assert.match(attrs, /\ssrc=/, 'script without src');
    assert.equal(inner.trim(), '', 'inline script body');
  }
});

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test('13. api() rejects with ApiError status+code on a JSON error, and code network when fetch throws', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'Slow down.' } }), {
    status: 429, headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(api('/api/count', { method: 'POST', body: { name: 'game_played' } }), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 429);
    assert.equal(err.code, 'rate_limited');
    assert.equal(err.message, 'Slow down.');
    return true;
  });

  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(api('/api/results'), (err) => err instanceof ApiError && err.code === 'network');

  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await api('/api/count', { method: 'POST', body: {} }), null);
});
