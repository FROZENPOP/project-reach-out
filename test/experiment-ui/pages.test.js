import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('11. each index.html: one h1, header, footer, site.css, no style= or inline script; admin is noindex', async () => {
  for (const page of ['experiment', 'results', 'admin']) {
    const html = await read(`public/${page}/index.html`);
    assert.equal(html.match(/<h1[\s>]/g).length, 1, page);
    assert.match(html, /<site-header><\/site-header>/, page);
    assert.match(html, /<site-footer><\/site-footer>/, page);
    assert.match(html, /<link rel="stylesheet" href="\/css\/site.css">/, page);
    assert.doesNotMatch(html, /\sstyle\s*=/i, page);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, page);
    for (const [, attrs, inner] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
      assert.match(attrs, /\ssrc=/, `${page}: script without src`);
      assert.equal(inner.trim(), '', `${page}: inline script body`);
    }
    assert.equal(/<meta name="robots" content="noindex">/.test(html), page === 'admin', page);
  }
});
