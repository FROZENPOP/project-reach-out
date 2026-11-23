import { CODES, qrUrl, qrSvgParts } from '/posters/logic.js';

const NS = 'http://www.w3.org/2000/svg';
const grid = document.getElementById('poster-grid');

for (const [n, title] of CODES) {
  const url = qrUrl(location.origin, n);
  const { size, path } = qrSvgParts(url);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'poster-qr');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `QR code for ${url}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', size);
  bg.setAttribute('height', size);
  bg.setAttribute('fill', '#FFFFFF');
  const dark = document.createElementNS(NS, 'path');
  dark.setAttribute('d', path);
  dark.setAttribute('fill', '#000000');
  svg.append(bg, dark);

  const card = document.createElement('article');
  card.className = 'poster-card';
  const logo = Object.assign(document.createElement('img'), { className: 'poster-logo', src: '/img/logo-128.png', width: 128, height: 128, alt: '' });
  const num = Object.assign(document.createElement('p'), { className: 'poster-num', textContent: String(n).padStart(2, '0') });
  const h = Object.assign(document.createElement('h2'), { className: 'poster-title', textContent: title });
  const link = Object.assign(document.createElement('p'), { className: 'poster-url', textContent: url });
  card.append(logo, num, h, svg, link);
  grid.append(card);
}

document.getElementById('poster-print').addEventListener('click', () => window.print());
