// Shared frontend: <site-header>, <site-footer> and the api() helper. Load with
// <script type="module" src="/js/site.js"></script> on every page.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// Calls the Worker API. Resolves to parsed JSON (null for 204); rejects with ApiError.
// A network failure is status 0, code 'network'.
export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return null;
  let data;
  try {
    data = await res.json();
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code || 'http_error', data?.error?.message || `Request failed (${res.status}).`);
  }
  if (data === undefined) throw new ApiError(res.status, 'bad_response', 'The server sent an unexpected reply.');
  return data;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Footer markup for a /data/site.json object (or null before it loads). Every site value is escaped.
export function footerHtml(site) {
  const by = [site?.team, site?.school, site?.chapter && `chapter ${site.chapter}`].filter(Boolean).join(', ');
  const credit = `A HOSA Mental Health Promotion project${by ? ` by ${by}` : ''}.`;
  return `<footer class="site-footer">
  <div>
    <span>${escapeHtml(credit)}</span>
    <span>This site shares research. It is not medical advice.</span>
  </div>
  <div>
    <strong>Need to talk to someone now?</strong>
    <span>Call or text 988, the Suicide and Crisis Lifeline (US), any time.</span>
    <a href="/science/#references">References</a>
  </div>
</footer>`;
}

const NAV = [
  ['/science/', 'The science'],
  ['/game/', 'Game'],
  ['/experiment/', '24-hour challenge'],
  ['/results/', 'Results'],
];

// Decorative: the link text names it.
const LOGO = '<img src="/img/logo-128.png" width="40" height="40" alt="">';

// Header markup for the current path (pure, like footerHtml). Static strings only.
export function headerHtml(path = '') {
  const links = NAV.map(([href, label]) => `<a href="${href}"${path.startsWith(href) ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<header class="site-header">
  <a class="site-logo" href="/">${LOGO}Reach Out</a>
  <button class="btn-ghost menu-btn" type="button" aria-expanded="false" aria-controls="site-menu">Menu</button>
  <nav class="site-nav" id="site-menu" aria-label="Main">${links}</nav>
</header>`;
}

// Next aria-expanded value ('true' or 'false') for the phone menu after an action: 'toggle' or 'escape'.
export const nextMenuState = (expanded, action) => (action === 'toggle' && expanded !== 'true' ? 'true' : 'false');

export const ICON_LINK = '<link rel="icon" type="image/png" href="/img/logo-128.png">';

// True when none of the page's <link rel> values is an icon, so site.js should add the logo icon.
export const needsIconLink = (rels) => !rels.some((rel) => /(^|\s)icon(\s|$)/i.test(rel));

if (globalThis.customElements) {
  if (needsIconLink([...document.querySelectorAll('link[rel]')].map((l) => l.rel))) {
    document.head.insertAdjacentHTML('beforeend', ICON_LINK);
  }

  customElements.define('site-header', class extends HTMLElement {
    connectedCallback() {
      this.classList.add('wrap');
      this.innerHTML = headerHtml(location.pathname);
      const header = this.querySelector('.site-header');
      const button = this.querySelector('.menu-btn');
      const set = (action) => {
        const value = nextMenuState(button.getAttribute('aria-expanded'), action);
        button.setAttribute('aria-expanded', value);
        header.classList.toggle('menu-open', value === 'true');
      };
      button.addEventListener('click', () => set('toggle'));
      // On document: Safari does not focus a button on click, so focus may be on <body>.
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || button.getAttribute('aria-expanded') !== 'true') return;
        set('escape');
        button.focus();
      });
    }
  });

  customElements.define('site-footer', class extends HTMLElement {
    async connectedCallback() {
      this.classList.add('wrap');
      this.innerHTML = footerHtml(null); // the 988 line shows even if site.json never loads
      try {
        const res = await fetch('/data/site.json');
        if (res.ok) this.innerHTML = footerHtml(await res.json());
      } catch {
        // Keep the credit-less footer; it still carries every safety line.
      }
    }
  });
}
