// JSON responses and the API error shape: { error: { code, message } }.

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export function errorResponse(status, code, message) {
  return json({ error: { code, message } }, status);
}

export function noContent() {
  return new Response(null, { status: 204 });
}
