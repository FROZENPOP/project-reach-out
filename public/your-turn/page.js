import { clip, counterText, submitAnswer } from '/your-turn/logic.js';

const $ = (id) => document.getElementById(id);
const box = $('yt-text');

box.addEventListener('input', () => {
  const clipped = clip(box.value);
  if (clipped !== box.value) box.value = clipped;
  $('yt-count').textContent = counterText(box.value);
});

$('yt-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('yt-error').textContent = '';
  $('yt-submit').disabled = true;
  const result = await submitAnswer({ text: box.value });
  $('yt-submit').disabled = false;
  if (result.error) {
    $('yt-error').textContent = result.error;
    return;
  }
  $('yt-form').hidden = true;
  $('yt-thanks').hidden = false;
  $('yt-next').hidden = false;
  $('yt-thanks-title').focus();
});
