import { api } from '/js/site.js';
import { pickChallenge, remaining, SECONDS } from '/challenge/logic.js';

const $ = (id) => document.getElementById(id);
let challenges = [];
let current = -1;
let timer = 0;

function stopTimer() {
  clearInterval(timer);
  timer = 0;
  $('ch-timer').hidden = true;
  $('ch-start').textContent = 'Start';
}

function show() {
  stopTimer();
  current = pickChallenge(challenges.length, current);
  $('ch-text').textContent = challenges[current].text;
  $('ch-live').textContent = '';
}

function start() {
  stopTimer();
  const t0 = Date.now();
  $('ch-left').textContent = SECONDS;
  $('ch-unit').textContent = 'seconds left';
  $('ch-timer').hidden = false;
  $('ch-start').textContent = 'Start again';
  // Only the start and the end are announced; the ticking number is not in a live region.
  $('ch-live').textContent = `${SECONDS} seconds, go.`;
  timer = setInterval(() => {
    const left = remaining(Date.now() - t0);
    $('ch-left').textContent = left;
    if (left === 0) {
      clearInterval(timer);
      $('ch-unit').textContent = 'seconds. Time is up. Did you do it?';
      $('ch-live').textContent = 'Time is up. Did you do it?';
    }
  }, 250);
}

function done() {
  stopTimer();
  // Quiet ping: a counter must never interrupt a visitor, so a failure is ignored.
  api('/api/count', { method: 'POST', body: { name: 'challenge_done' } }).catch(() => {});
  for (const id of ['ch-task', 'ch-task-actions']) $(id).hidden = true;
  for (const id of ['ch-thanks', 'ch-thanks-actions']) $(id).hidden = false;
  $('ch-thanks-title').focus();
}

$('ch-start').addEventListener('click', start);
$('ch-done').addEventListener('click', done);
$('ch-swap').addEventListener('click', show);

try {
  challenges = await api('/data/challenges.json');
  show();
  $('ch-start').disabled = false;
  $('ch-swap').disabled = false;
} catch (err) {
  $('ch-text').textContent = 'Reach out to someone today.';
  $('ch-error').textContent = `Could not load a challenge. ${err.message}`;
}
