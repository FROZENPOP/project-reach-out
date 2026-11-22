import { HttpError } from './http.js';

export const invalid = (message) => new HttpError(400, 'invalid_body', message);

export const MAX_BODY = 4096;
const tooLarge = () => new HttpError(413, 'too_large', `Body must be at most ${MAX_BODY} bytes.`);

// Reads the body as text, throwing 413 too_large past MAX_BODY bytes. The header is checked first, then the stream
// is cut off at the limit, since Content-Length can be missing or wrong.
async function readText(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) throw tooLarge();
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  return new Blob(chunks).text();
}

// Parses the request body as a JSON object, or throws 400 invalid_body (413 too_large if over MAX_BODY bytes).
export async function readJson(request) {
  const text = await readText(request);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw invalid('Body must be JSON.');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw invalid('Body must be a JSON object.');
  return body;
}

// Returns body[key] if it is one of `values`, or throws 400 invalid_body.
export function oneOf(body, key, values) {
  if (!values.includes(body[key])) throw invalid(`${key} must be one of: ${values.join(', ')}.`);
  return body[key];
}

// Returns body[key] if it is an integer from min to max, or throws 400 invalid_body.
export function intIn(body, key, min, max) {
  const value = body[key];
  if (!Number.isInteger(value) || value < min || value > max) throw invalid(`${key} must be an integer from ${min} to ${max}.`);
  return value;
}

// Removes control characters except newline, then trims. Pure, so tests can import it.
export function cleanText(text) {
  return text.replace(/[^\P{Cc}\n]/gu, '').trim();
}

// Something other than whitespace, controls or default-ignorable characters (zero-width spaces, joiners, fillers).
const VISIBLE = /[^\p{White_Space}\p{Cc}\p{Default_Ignorable_Code_Point}⠀]/u;

// Returns body[key] cleaned with cleanText if it is 1 to `max` code points long with at least one visible character,
// or throws 400 invalid_body.
export function textIn(body, key, max) {
  if (typeof body[key] !== 'string') throw invalid(`${key} must be a string.`);
  const text = cleanText(body[key]);
  const length = [...text].length;
  if (!VISIBLE.test(text) || length > max) throw invalid(`${key} must be 1 to ${max} characters.`);
  return text;
}
