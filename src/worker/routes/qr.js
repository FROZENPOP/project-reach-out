import { increment } from '../lib/counter.js';

// The printed codes encode /q/<token>. QR_KEYS is a Worker secret (never in the repo):
// JSON {"1": token, ..., "6": token}. Holding a token means you scanned that code.
export function qrKeys(env) {
  try {
    return JSON.parse(env.QR_KEYS ?? '{}');
  } catch {
    return {};
  }
}

const codeFor = (env, token) => Object.entries(qrKeys(env)).find(([, key]) => key === token)?.[0] ?? null;

const redirect = (location) => new Response(null, { status: 302, headers: { Location: location } });

// Topic pages a code unlocks. Science (6) stays open to everyone; every flyer is locked.
const LOCKED = { '/fact/': '1', '/challenge/': '2', '/pulse/': '3', '/listen/': '4', '/your-turn/': '5' };

// GET /q/:token. Opens that code's flyer, carrying the token. Always redirects, even when the count fails.
export default async function qr({ env, params: [token], now }) {
  const n = token ? codeFor(env, token) : null;
  if (!n) return redirect('/');
  try {
    await increment(env.DB, `scan:${n}`, now);
  } catch (err) {
    console.error(err);
  }
  return redirect(`/flyer/?n=${n}&k=${encodeURIComponent(token)}`);
}

// GET in a locked folder. A locked page needs ?k= equal to its code's token; without it you land on the
// home page's locked tiles. Other files in these folders (css, js) are served as usual.
export function gate({ request, env }) {
  const url = new URL(request.url);
  const dir = url.pathname.replace(/index\.html$/, '');
  if (dir !== '/flyer/' && !Object.hasOwn(LOCKED, dir)) return env.ASSETS.fetch(request);
  const n = dir === '/flyer/' ? url.searchParams.get('n') : LOCKED[dir];
  const key = n && Object.hasOwn(qrKeys(env), n) ? qrKeys(env)[n] : null;
  if (key && url.searchParams.get('k') === key) return env.ASSETS.fetch(request);
  return redirect('/#codes');
}
