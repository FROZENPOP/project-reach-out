import { HttpError, errorResponse } from './lib/http.js';
import { rateLimit } from './lib/limit.js';
import qr from './routes/qr.js';
import count from './routes/count.js';
import results from './routes/results.js';

// [method, path pattern, handler]. Capture groups arrive as `params`.
// A handler gets { request, env, params, now } and returns a Response or throws HttpError.
export const routes = [
  ['GET', /^\/q\/(.*)$/, qr],
  ['POST', /^\/api\/count$/, count],
  ['GET', /^\/api\/results$/, results],
];

export async function handle(request, env, now = new Date()) {
  const { pathname } = new URL(request.url);
  try {
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

export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
