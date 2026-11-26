import { HttpError, errorResponse } from './lib/http.js';
import { rateLimit } from './lib/limit.js';
import { requireAdmin } from './lib/auth.js';
import qr, { gate } from './routes/qr.js';
import count from './routes/count.js';
import results from './routes/results.js';
import pulse from './routes/pulse.js';
import answers from './routes/answers.js';
import * as experiment from './routes/experiment.js';
import * as admin from './routes/admin.js';

// [method, path pattern, handler]. Capture groups arrive as `params`.
// A handler gets { request, env, params, now } and returns a Response or throws HttpError.
export const routes = [
  ['GET', /^\/q\/(.*)$/, qr],
  ['GET', /^\/(flyer|fact|challenge|pulse|listen|your-turn)\//, gate],
  ['POST', /^\/api\/count$/, count],
  ['GET', /^\/api\/results$/, results],
  ['POST', /^\/api\/pulse$/, pulse],
  ['POST', /^\/api\/answers$/, answers],
  ['POST', /^\/api\/experiment\/start$/, experiment.start],
  ['GET', /^\/api\/experiment\/([^/]+)$/, experiment.status],
  ['POST', /^\/api\/experiment\/([^/]+)\/finish$/, experiment.finish],
  ['GET', /^\/api\/admin\/answers$/, admin.listAnswers],
  ['POST', /^\/api\/admin\/answers\/(\d+)$/, admin.setAnswer],
  ['GET', /^\/api\/admin\/export\.csv$/, admin.exportCsv],
];

async function route(request, env, now, pathname) {
  try {
    // Every admin path, known or not, is checked here, so no admin handler can ship open.
    if (pathname.startsWith('/api/admin/')) await requireAdmin(request, env);
    for (const [method, pattern, handler] of routes) {
      const match = request.method === method && pathname.match(pattern);
      if (!match) continue;
      if (method === 'POST') await rateLimit(request, env);
      return await handler({ request, env, params: match.slice(1), now });
    }
    return errorResponse(404, 'not_found', 'Not found.');
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err.status, err.code, err.message);
    console.error(err);
    return errorResponse(500, 'internal', 'Something went wrong.');
  }
}

export async function handle(request, env, now = new Date()) {
  const { pathname } = new URL(request.url);
  const res = await route(request, env, now, pathname);
  if (pathname.startsWith('/api/admin/')) res.headers.set('Cache-Control', 'no-store');
  return res;
}

export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
