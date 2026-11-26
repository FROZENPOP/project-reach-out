import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { FLYERS, flyerNumber } from '../../public/flyer/flyer.js';

test('six flyers, each button opens an existing QR page', async () => {
  assert.equal(FLYERS.length, 6);
  for (const f of FLYERS) await access(new URL(`../../public${f.path}index.html`, import.meta.url));
});

test('flyerNumber reads ?n=1..6 and falls back to 1', () => {
  assert.equal(flyerNumber('?n=4'), 4);
  for (const bad of ['', '?n=0', '?n=7', '?n=abc', '?n=2.5']) assert.equal(flyerNumber(bad), 1, bad);
});
