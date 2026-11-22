import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const PAGES = ['fact', 'challenge', 'pulse', 'listen', 'your-turn', 'posters'];

test('10. each QR page has one h1, header, footer, site.css, no style= and no inline script', async () => {
  for (const page of PAGES) {
    const html = await readFile(new URL(`../../public/${page}/index.html`, import.meta.url), 'utf8');
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1, `${page}: h1`);
    assert.match(html, /<site-header><\/site-header>/, `${page}: header`);
    assert.match(html, /<site-footer><\/site-footer>/, `${page}: footer`);
    assert.match(html, /<link rel="stylesheet" href="\/css\/site\.css">/, `${page}: site.css`);
    assert.doesNotMatch(html, /\sstyle\s*=/i, `${page}: style=`);
    assert.doesNotMatch(html, /<style[\s>]/i, `${page}: <style>`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${page}: on*=`);
    for (const [, attrs, inner] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
      assert.match(attrs, /\ssrc=/, `${page}: script without src`);
      assert.equal(inner.trim(), '', `${page}: inline script body`);
    }
  }
  const posters = await readFile(new URL('../../public/posters/index.html', import.meta.url), 'utf8');
  assert.match(posters, /<meta name="robots" content="noindex">/);
  const pulse = await readFile(new URL('../../public/pulse/index.html', import.meta.url), 'utf8');
  assert.ok(pulse.includes('No one reads answers one by one. If you need help now, call or text 988 or talk to an adult you trust.'), 'pulse: not-monitored line');
  const challenge = await readFile(new URL('../../public/challenge/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(challenge.match(/<section id="ch-task"[^>]*>/)[0], /aria-live/, 'challenge: countdown not live');
  assert.doesNotMatch(challenge.match(/<p class="ch-timer"[^>]*>/)[0], /aria-live/, 'challenge: timer not live');
});
