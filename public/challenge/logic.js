// Pure logic for /challenge/.
export { pickOther as pickChallenge } from '../fact/shared.js';

export const SECONDS = 30;
// What the countdown shows after `elapsed` milliseconds.
export const remaining = (elapsed) => Math.max(0, SECONDS - Math.floor(elapsed / 1000));
