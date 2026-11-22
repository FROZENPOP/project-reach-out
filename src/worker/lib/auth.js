import { HttpError } from './http.js';

const sha256 = async (text) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

// Throws 401 unless the request carries `Authorization: Bearer <ADMIN_TOKEN>`. Always 401 when the secret is unset or empty.
// Both sides are hashed first so the compare is constant time over equal-length inputs.
export async function requireAdmin(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = env.ADMIN_TOKEN || '';
  const [a, b] = await Promise.all([sha256(header), sha256(`Bearer ${token}`)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0 || !token) throw new HttpError(401, 'unauthorized', 'Unauthorized.');
}
