import { HttpError } from './http.js';

const invalid = (message) => new HttpError(400, 'invalid_body', message);

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
