import { api } from '/js/site.js';
import { QUESTIONS, OPTIONS, resultsView, submitPulse } from '/pulse/logic.js';

const $ = (id) => document.getElementById(id);
const KEY = 'reach-out:pulse';
const answers = {};
let own = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function remembered() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return QUESTIONS.every(({ key }) => [1, 2, 3].includes(saved?.[key])) ? saved : null;
  } catch {
    return null; // storage blocked or unreadable: show the form
  }
}

function buildForm() {
  for (const { key, text } of QUESTIONS) {
    const set = el('fieldset');
    set.append(el('legend', '', text));
    const row = el('div', 'scale scale-3');
    for (const [label] of OPTIONS) {
      const b = el('button', '', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        answers[key] = label;
        for (const other of row.children) other.setAttribute('aria-pressed', String(other === b));
      });
      row.append(b);
    }
    set.append(row);
    $('pulse-questions').append(set);
  }
}

function drawBars(bars) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  const list = $('pulse-bars');
  list.replaceChildren();
  for (const bar of bars) {
    const li = el('li', bar.you ? 'is-you' : '');
    li.append(el('span', 'visually-hidden', `Total ${bar.total}: ${bar.count} ${bar.count === 1 ? 'student' : 'students'}${bar.you ? ' (you)' : ''}`));
    const fill = el('span', 'pulse-bar');
    fill.style.height = `${Math.round((bar.count / max) * 100)}%`;
    const parts = [el('span', 'pulse-you', bar.you ? 'you' : ''), el('span', 'pulse-count', String(bar.count)), fill, el('span', 'pulse-total', String(bar.total))];
    for (const p of parts) p.setAttribute('aria-hidden', 'true');
    li.append(...parts);
    list.append(li);
  }
  $('pulse-chart').hidden = false;
}

async function showResults() {
  $('pulse-form').hidden = true;
  $('pulse-results').hidden = false;
  $('pulse-next').hidden = false;
  $('pulse-results-error').textContent = '';
  $('pulse-retry').hidden = true;
  $('pulse-status').textContent = 'Loading how the group answered…';
  $('pulse-status').hidden = false;
  let results;
  try {
    results = await api('/api/results');
  } catch (err) {
    $('pulse-status').hidden = true;
    $('pulse-results-error').textContent = `Could not load how the group answered. ${err.message}`;
    $('pulse-retry').hidden = false;
    return;
  }
  const view = resultsView(results, own);
  $('pulse-thanks').textContent = view.thanks;
  if (view.often) {
    $('pulse-often').textContent = view.often;
    $('pulse-often').hidden = false;
  }
  if (view.few) {
    $('pulse-status').textContent = view.few;
    return;
  }
  $('pulse-status').hidden = true;
  drawBars(view.bars);
}

buildForm();
$('pulse-retry').addEventListener('click', showResults);

$('pulse-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('pulse-error').textContent = '';
  $('pulse-submit').disabled = true;
  const result = await submitPulse(answers);
  $('pulse-submit').disabled = false;
  if (result.error) {
    $('pulse-error').textContent = result.error;
    return;
  }
  own = result.body;
  try {
    localStorage.setItem(KEY, JSON.stringify(own));
  } catch {
    // Storage blocked: the results still show now; the form comes back on the next visit.
  }
  const loading = showResults();
  $('pulse-thanks').focus();
  await loading;
});

own = remembered();
if (own) showResults();
