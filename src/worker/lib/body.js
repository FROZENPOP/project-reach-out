import { HttpError } from './http.js';

export const invalid = (message) => new HttpError(400, 'invalid_body', message);

// Parses the request body as a JSON object, or throws 400 invalid_body.
export async function readJson(request) {
  let body;
  try {
    body = await request.json();
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

// Returns body[key] cleaned with cleanText if it is 1 to `max` code points long, or throws 400 invalid_body.
export function textIn(body, key, max) {
  if (typeof body[key] !== 'string') throw invalid(`${key} must be a string.`);
  const text = cleanText(body[key]);
  const length = [...text].length;
  if (length < 1 || length > max) throw invalid(`${key} must be 1 to ${max} characters.`);
  return text;
}
