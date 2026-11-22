// Pure logic for /posters/.
import qrcode from '../vendor/qrcode.js';

export const CODES = [
  [1, 'Did You Know?'],
  [2, 'Take a 30-Second Challenge'],
  [3, 'How Connected Are You?'],
  [4, 'Listen'],
  [5, 'Your Turn'],
  [6, 'Learn More'],
];
export const QUIET = 4; // modules of white border, as the QR spec asks

// What QR code n encodes: <origin>/q/<n>, nothing more.
export const qrUrl = (origin, n) => `${new URL(origin).origin}/q/${n}`;

// The encoder's module matrix (true = dark) at error correction level M.
export function qrMatrix(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

// SVG geometry for a code: viewBox side (matrix plus the quiet zone on each side) and one path of dark squares.
export function qrSvgParts(text) {
  const m = qrMatrix(text);
  let d = '';
  m.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
  }));
  return { size: m.length + 2 * QUIET, path: d };
}
