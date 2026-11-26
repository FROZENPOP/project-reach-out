import { increment } from '../lib/counter.js';

// Each code opens its flyer; the flyer's button leads on to the matching page.
const PAGES = Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, `/flyer/?n=${n}`]));

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
