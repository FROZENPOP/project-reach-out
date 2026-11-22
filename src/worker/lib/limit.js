import { HttpError } from './http.js';

// Throws 429 rate_limited when the limiter denies. The IP is only the key: never stored or logged.
export async function rateLimit(request, env) {
  const key = request.headers.get('CF-Connecting-IP') || 'unknown';
  const { success } = await env.LIMITER.limit({ key });
  if (!success) throw new HttpError(429, 'rate_limited', 'Too many requests. Try again in a minute.');
}
