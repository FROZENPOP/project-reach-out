import { increment } from '../lib/counter.js';

const PAGES = { 1: '/fact/', 2: '/challenge/', 3: '/pulse/', 4: '/listen/', 5: '/your-turn/', 6: '/science/' };

// GET /q/:n. Always redirects, even when the count fails.
export default async function qr({ env, params: [n], now }) {
  const page = Object.hasOwn(PAGES, n) ? PAGES[n] : null;
  if (page) {
    try {
      await increment(env.DB, `scan:${n}`, now);
    } catch (err) {
      console.error(err);
    }
  }
  return new Response(null, { status: 302, headers: { Location: page || '/' } });
}
