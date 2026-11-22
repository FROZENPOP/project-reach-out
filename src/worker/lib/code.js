// Experiment codes: 6 characters from an alphabet without 0/O, 1/I/L.
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

// Uniform random code: bytes at or above the largest multiple of 31 are rejected, so there is no modulo bias.
export function newCode() {
  const limit = 256 - (256 % ALPHABET.length);
  let code = '';
  while (code.length < 6) {
    for (const byte of crypto.getRandomValues(new Uint8Array(8))) {
      if (byte < limit && code.length < 6) code += ALPHABET[byte % ALPHABET.length];
    }
  }
  return code;
}

// Uppercases and drops spaces and dashes; returns null if the result cannot be a code.
export function normalizeCode(input) {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  return CODE_RE.test(code) ? code : null;
}
