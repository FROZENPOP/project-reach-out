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

const LOGO = '<svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#FFB547" stroke-width="2"><circle cx="6" cy="20" r="3.5"/><circle cx="22" cy="8" r="3.5" fill="#FFB547"/><path d="M9 18 L19 10"/></svg>';

if (globalThis.customElements) {
  customElements.define('site-header', class extends HTMLElement {
    connectedCallback() {
      this.classList.add('wrap');
      // Static markup only; no data-file text.
      this.innerHTML = `<header class="site-header">
  <a class="site-logo" href="/">${LOGO}Reach Out</a>
  <nav class="site-nav" aria-label="Main">${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</nav>
</header>`;
      for (const link of this.querySelectorAll('.site-nav a')) {
        if (location.pathname.startsWith(link.getAttribute('href'))) link.setAttribute('aria-current', 'page');
      }
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
