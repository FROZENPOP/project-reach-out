Read `~/.claude/agents/builder.md` and follow it.

# Task `skeleton` (role: builder, base branch: `main`)

Repo: FROZENPOP/project-reach-out. You are in a git worktree on branch `skeleton`.
Read `ARCHITECTURE.md` first; it is binding. The design mockups are in
`docs/mockups/` (you cannot open the artifact link; the files are the same content).

## Goal

The walking skeleton: one thin path, end to end, on the real stack. A visitor opens
the home page (served from `public/` by Workers static assets, styled by the shared
design system), a QR link `/q/3` is counted in D1 and redirected, and
`GET /api/results` reports the count. Every later task builds on what you leave, so
the shared pieces (tokens, header/footer, API helper, router, test helper) matter
more than volume.

## Reuse, do not write

- `getPlatformProxy` from `wrangler` for a real local D1 in tests. No fake database.
- `node --test` and `node:assert`. No test framework, no other npm packages.
- Google Fonts `<link>` for Inter and Space Grotesk. No font files.
- `package.json`, `wrangler.jsonc`, `.github/workflows/ci.yml`, `public/data/*.json`
  already exist and belong to the architect. Read them. If one needs a change (for
  example `npm run check` rejects a key in `wrangler.jsonc`), post
  `ASK @arch` with the exact error and the change you want. Do not edit them.

## Files you own

`public/index.html`, `public/404.html`, `public/_headers`, `public/css/*`,
`public/js/*`, `src/*`, `migrations/*`, `test/helpers/*`, `test/skeleton/*`.

Out of scope: every other page, every API route not listed below, deployment,
creating Cloudflare resources.

## What to build

1. `migrations/0001_init.sql`: the four tables exactly as in ARCHITECTURE.md.
2. `src/worker/index.js`: default export `{ fetch(request, env, ctx) }`. A small
   router that dispatches to handler modules in `src/worker/routes/`, so the `api`
   task adds routes by adding a module and one line. Shared helpers in
   `src/worker/lib/` (JSON responses, the error shape, body parsing and validation,
   rate limiting, counter increment). Handlers receive the current time as an
   argument (default `new Date()`), so tests can set it.
3. Routes: `GET /q/:n`, `POST /api/count`, `GET /api/results`, as specified in
   ARCHITECTURE.md. For now `/api/results` computes `counters` from D1 and returns
   the rest of the contract shape empty: `experiment: { started: 0, finished: 0,
   pre: null, post: null, actions: null }`, `pulse: { n: 0, mean: null, counts:
   null }`, `answers: []`. Counter values are summed over all days.
4. Rate limiting: every POST calls `env.LIMITER.limit({ key })` with the
   `CF-Connecting-IP` header (or `"unknown"`) and returns 429 `rate_limited` when
   `success` is false. The IP is never stored or logged.
5. `test/helpers/env.js`: `makeEnv()` resolves to `{ env, dispose }` where `env.DB`
   is a fresh local D1 with the migration applied, `env.LIMITER` is a stub that
   allows (and can be switched to deny), and `env.ADMIN_TOKEN` is `"test-token"`;
   and `call(env, method, path, { body, headers, now })` runs the Worker and returns
   the `Response`. Later tasks import this, so document it in a comment at the top.
6. `public/css/site.css`: every token from the ARCHITECTURE.md table as a custom
   property on `:root`, base styles, and the component classes listed there
   (`.btn`, `.btn-ghost`, `.card`, `.panel`, `.eyebrow`, `.scale`, `.alert`), plus
   the focus ring and a `prefers-reduced-motion` rule.
7. `public/js/site.js` (ES module): custom elements `<site-header>` and
   `<site-footer>`, and `export async function api(...)` with `ApiError`, as in
   ARCHITECTURE.md. Header links: The science `/science/`, Game `/game/`, 24-hour
   challenge `/experiment/`, Results `/results/`; the logo links to `/`. The footer
   reads `/data/site.json`. Put the footer's markup building in a pure exported
   function that takes the site object, so it can be tested without a browser; it
   must not use `innerHTML` with data-file text.
8. `public/index.html`: the home page from `docs/mockups/Home.dc.html`: same
   sections, order and copy, built with `site.css` classes (the mockup's inline
   styles are the spec, not the implementation). The six tiles link to `/fact/`,
   `/challenge/`, `/pulse/`, `/listen/`, `/your-turn/`, `/science/` (not `/q/n`:
   those are for printed codes only). The two hero buttons link to `/experiment/`
   and `/game/`. The network illustration is inline SVG, `aria-hidden`.
9. `public/404.html`: header, a short "page not found" message, a link home, footer.
10. `public/_headers`: for all paths, a Content-Security-Policy with
    `default-src 'self'`; `script-src 'self'`; `style-src 'self'
    https://fonts.googleapis.com`; `font-src https://fonts.gstatic.com`;
    `img-src 'self' data:`; `connect-src 'self'`; `frame-src
    https://open.spotify.com https://www.youtube-nocookie.com
    https://embed.podcasts.apple.com`; `frame-ancestors 'none'`; `base-uri 'self'`;
    `form-action 'self'`. Also `X-Content-Type-Options: nosniff` and
    `Referrer-Policy: strict-origin-when-cross-origin`. This means no inline scripts
    and no `style=""` attributes anywhere in your pages.

## Acceptance criteria (one test each, in `test/skeleton/`)

1. `GET /q/3` is a 302 to `/pulse/`, and afterwards `counters` has `scan:3` = 1 for
   today (UTC). `GET /q/1`..`/q/6` go to `/fact/`, `/challenge/`, `/pulse/`,
   `/listen/`, `/your-turn/`, `/science/`.
2. `GET /q/9` and `GET /q/abc` are a 302 to `/` and write no counter.
3. `GET /q/1` still returns the 302 when the database write throws.
4. `POST /api/count` with `{ "name": "game_played" }` is 204 and increments the
   counter; two calls on the same day give 2 in one row.
5. `POST /api/count` with an unknown name, a missing name, or a body that is not
   JSON is 400 with `error.code` `invalid_body`.
6. `POST /api/count` is 429 `rate_limited` when the limiter denies, and nothing is
   written.
7. `GET /api/results` returns exactly the contract's keys, with counters summed
   across days, and the header `Cache-Control: public, max-age=30`.
8. An unknown `/api/...` path is 404 `not_found` as JSON. A handler that throws
   gives 500 `internal` as JSON and does not leak the error message.
9. The migration enforces the CHECK constraints (an out-of-range `mood` insert
   fails; an `answers.status` outside the three values fails).
10. `site.css` defines every token in the ARCHITECTURE.md table with the listed
    value.
11. The footer function output contains the team, school and chapter from the site
    object, the 988 line, the "not medical advice" line and a link to
    `/science/#references`, and escapes HTML in the site values.
12. `public/index.html` has exactly one `<h1>`, `<site-header>`, `<site-footer>`,
    links to all six QR pages, `/experiment/` and `/game/`, and contains no
    `style=` attribute and no inline `<script>` body.
13. `api()` rejects with an `ApiError` carrying `status` and `code` for a non-2xx
    JSON error response, and with code `network` when `fetch` throws (test with a
    stubbed global `fetch`).

## Merge gate

`npm test` and `npm run check` both pass. In the PR body: the output of both, and
proof you ran `npx wrangler dev` and saw the home page render and `/q/1` redirect
(curl output is fine). Add screenshots of the home page at 390 px and 1280 px wide
if you can capture them; if you cannot, say so plainly and the architect will check
the look.

Done means: PR open against `main`, `scope.sh check skeleton <pr>` passes, and
`[skeleton] READY` posted on the board. You do not merge.
