import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasBadLanguage } from '../../public/your-turn/language.js';
import { validateAnswer } from '../../public/your-turn/logic.js';

test('bad-language check catches disguises and lets everyday words through', () => {
  const bad = ['this is bullshit', 'F U C K this', 'f.u.c.k', 'f*ck', 'sh1t', '$hit', 'fück', 'what the fuuuuck',
    '@ss', 'B!TCH', 'dicks', 'Damn it', 'go kill yourself', 'kys'];
  for (const t of bad) assert.ok(hasBadLanguage(t), `should catch: ${t}`);
  const ok = ['My friends help me feel connected', 'I love class and assume the best', 'a peacock eating grapes',
    'assistant coach', 'Dickens is great', 'this hit hard', 'grass and shells', 'my therapist',
    'I feel like I want to kill myself sometimes', 'passing notes in class', ''];
  for (const t of ok) assert.ok(!hasBadLanguage(t), `false alarm: ${t}`);
});

test('the form shows no warning: bad language goes to the server, which drops it', () => {
  assert.deepEqual(validateAnswer('this is sh!t'), { ok: true, text: 'this is sh!t' });
});
