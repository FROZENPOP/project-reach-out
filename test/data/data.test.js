// Guards the hand-edited content files: a typo here would otherwise only show up
// as a missing credit or a broken fact on the live site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (name) => JSON.parse(readFileSync(new URL(`../../public/data/${name}.json`, import.meta.url), 'utf8'));

test('site.json has the expected string fields', () => {
  const site = load('site');
  for (const key of ['team', 'school', 'chapter', 'consultant']) assert.equal(typeof site[key], 'string', key);
  for (const key of ['title', 'embed_url', 'link_url', 'summary']) assert.equal(typeof site.podcast[key], 'string', `podcast.${key}`);
});

test('references have unique ids, APA text and an https url', () => {
  const refs = load('references');
  assert.equal(new Set(refs.map((r) => r.id)).size, refs.length);
  for (const r of refs) {
    assert.match(r.id, /^[a-z0-9]+$/);
    assert.ok(r.apa.length > 20, r.id);
    assert.match(r.url, /^https:\/\//, r.id);
  }
});

test('every fact cites a known reference', () => {
  const ids = new Set(load('references').map((r) => r.id));
  for (const f of load('facts')) {
    assert.ok(f.text && f.detail, 'fact needs text and detail');
    assert.ok(ids.has(f.ref), `unknown ref ${f.ref}`);
  }
});

test('challenges are non-empty strings', () => {
  const challenges = load('challenges');
  assert.ok(challenges.length >= 5);
  for (const c of challenges) assert.ok(typeof c.text === 'string' && c.text.trim().length > 0);
});
