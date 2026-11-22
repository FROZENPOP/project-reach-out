# Project Reach Out: architecture

A public website for a HOSA Mental Health Promotion campaign. Topic: how isolation
impacts adolescent brain development (risk factor: social isolation; protective
factor: social connection). Audience: high-school peers, mostly on phones after
scanning one of six QR codes posted around school. Second audience: HOSA judges, who
get seven minutes, no login, and score clarity of the risk/protective factors, peer
education, neatness, and creativity.

Out of scope: accounts, logins for students, email, analytics that identify anyone,
a CMS, a build step, a frontend framework.

## Stack

- Cloudflare Workers with static assets. `public/` is the site; one Worker in
  `src/worker/` handles `/api/*` and `/q/*` only (`run_worker_first`).
- D1 (SQLite) for all stored data. Binding `DB`.
- Workers Rate Limiting binding `LIMITER` on every POST.
- Plain HTML, CSS and browser ES modules. No bundler, no framework, no runtime npm
  dependencies. `wrangler` is the only dev dependency.
- Tests: `node --test`. API tests call the Worker's `fetch(request, env)` directly
  with a real local D1 from `getPlatformProxy()` (see `test/helpers/`).

## Directories and owners

| Path | What | Task |
|---|---|---|
| `public/index.html`, `public/404.html`, `public/css/`, `public/js/site.js`, `public/_headers`, `test/skeleton/`, `test/data/` | Home page, design tokens, shared header/footer, API helper (built by `skeleton`, merged) | architect |
| `src/worker/`, `migrations/`, `test/helpers/`, `test/api/` | Worker and schema | `api` |
| `public/fact/`, `public/challenge/`, `public/pulse/`, `public/listen/`, `public/your-turn/`, `public/posters/`, `public/vendor/` | The five QR landing pages and the printable QR sheet | `qr-pages` |
| `public/science/` | QR 6: the science, with references | `science` |
| `public/game/` | Wire the Brain | `game` |
| `public/experiment/`, `public/results/`, `public/admin/` | 24-hour experiment, results graph, moderation | `experiment-ui` |
| `test/<task>/` | Each task's tests | that task |
| `package.json`, `wrangler.jsonc`, `.github/`, `public/data/*.json`, `docs/`, `ARCHITECTURE.md` | Shared config and canonical content | architect |

`.claude/owners` is the enforced version of this table.

## Pages

| URL | Purpose |
|---|---|
| `/` | Home: the idea in one screen, six QR tiles, the 24-hour experiment |
| `/fact/` | QR 1. One sourced fact, readable in 20 seconds, with a 20-second progress bar |
| `/challenge/` | QR 2. One 30-second challenge and an "I did it" button |
| `/pulse/` | QR 3. Three anonymous questions, then how the school answered |
| `/listen/` | QR 4. Embedded podcast clip (URL from `site.json`), with a "coming soon" state |
| `/your-turn/` | QR 5. Anonymous answer to "What helps you feel connected to other people?" |
| `/science/` | QR 6. The research, in plain words, with APA references |
| `/game/` | Wire the Brain |
| `/experiment/` | Check in, pick actions, get a code; come back with the code to check out |
| `/results/` | Before/after chart, pulse results, campaign counts, approved answers |
| `/posters/` | Printable sheet of the six QR codes |
| `/admin/` | Approve or reject answers, download CSVs. Not linked from the site |

QR codes encode `<origin>/q/<n>`, never the page URL, so pages can move.

## Interfaces

### Shared frontend (`public/js/site.js`, provided by `skeleton`)

- Defines custom elements `<site-header>` and `<site-footer>`. Every page uses both.
  The footer carries the project credit from `/data/site.json`, the "not medical
  advice" line, the 988 line, and a link to `/science/#references`.
- `export async function api(path, { method = 'GET', body, token } = {})` resolves to
  parsed JSON (or `null` for 204) and rejects with `ApiError` (`.status`, `.code`,
  `.message`) for any non-2xx or network failure.
- Every page loads `/css/site.css` and uses its tokens and component classes.

### Data files

- `/data/site.json`: `{ team, school, chapter, consultant, podcast: { title, embed_url, link_url, summary } }`. Empty string means "not provided yet".
- `/data/references.json`: `[{ id, apa, url }]`. The only sources the site may cite.
- `/data/facts.json`: `[{ text, detail, ref }]`, `ref` is a references id.
- `/data/challenges.json`: `[{ text }]`.

### HTTP API (Worker)

JSON in, JSON out. Errors are `{ "error": { "code": "snake_case", "message": "..." } }`
with the right status: 400 `invalid_body`, 401 `unauthorized`, 404 `not_found`,
409 (`too_early`, `already_finished`, `expired`), 413 `too_large` (body over 4096 bytes),
429 `rate_limited`, 500 `internal`.

| Route | Body | Success |
|---|---|---|
| `GET /q/:n` | | 302 to the page for QR `n` (1 fact, 2 challenge, 3 pulse, 4 listen, 5 your-turn, 6 science; anything else `/`). Adds one to `scan:<n>`. Redirects even if the write fails |
| `POST /api/count` | `{ name }`, one of `challenge_done`, `game_played`, `listen_opened` | 204 |
| `POST /api/pulse` | `{ lack, left_out, isolated }`, integers 1 to 3 | 201 `{ ok: true }` |
| `POST /api/answers` | `{ text }`, 1 to 280 characters after trim | 201 `{ ok: true }` |
| `POST /api/experiment/start` | `{ connected, mood, stress, actions }`: integers 1 to 5; `actions` is 2 or 3 distinct ids | 201 `{ code, ready_at }` |
| `GET /api/experiment/:code` | | 200 `{ status, ready_at, actions }`, status `waiting`, `ready` or `done` |
| `POST /api/experiment/:code/finish` | `{ connected, mood, stress }` | 200 `{ pre, post }`, each `{ connected, mood, stress }` |
| `GET /api/results` | | 200, shape below. `Cache-Control: public, max-age=30` |
| `GET /api/admin/answers?status=pending` | | 200 `[{ id, created_at, text, status }]` |
| `POST /api/admin/answers/:id` | `{ status }`, `approved` or `rejected` | 200 `{ ok: true }` |
| `GET /api/admin/export.csv?table=` | `experiment`, `pulse`, `answers`, `counters` | 200 `text/csv` |

Action ids: `talk_new`, `eat_together`, `phone_free`, `shared_activity`, `reach_out`.

Experiment rules: `code` is 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`,
made by the server. `ready_at` is 18 hours after start. Finish before `ready_at` is
409 `too_early`; a second finish is 409 `already_finished`; more than 7 days after
start is 409 `expired`. Handlers take the current time as an argument so tests can
set it.

```json
{
  "experiment": {
    "started": 12, "finished": 8,
    "pre":  { "connected": 2.88, "mood": 3.13, "stress": 3.63 },
    "post": { "connected": 3.75, "mood": 3.63, "stress": 3.0 },
    "actions": { "talk_new": 5, "eat_together": 4 }
  },
  "pulse": { "n": 40, "mean": 5.2, "counts": { "3": 2, "4": 6 } },
  "counters": { "scan:1": 10, "challenge_done": 4, "game_played": 9 },
  "answers": ["approved answer text"]
}
```

`pre`, `post` and `actions` cover finished rows only and are `null` while
`finished < 5`. `pulse.mean` and `pulse.counts` are `null` while `n < 5`. Means are
rounded to two decimals. `answers` is the 50 newest approved texts.

Admin routes need `Authorization: Bearer <ADMIN_TOKEN>` (Worker secret), compared in
constant time. The router enforces this for every path under `/api/admin/` before the
handler, the rate limiter or any 404, so a request without the token does no work.

### Database (D1)

```sql
CREATE TABLE counters (name TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (name, day));
CREATE TABLE pulse (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL,
  lack INTEGER NOT NULL CHECK (lack BETWEEN 1 AND 3),
  left_out INTEGER NOT NULL CHECK (left_out BETWEEN 1 AND 3),
  isolated INTEGER NOT NULL CHECK (isolated BETWEEN 1 AND 3));
CREATE TABLE experiment (code TEXT PRIMARY KEY, created_at TEXT NOT NULL, actions TEXT NOT NULL,
  pre_connected INTEGER NOT NULL CHECK (pre_connected BETWEEN 1 AND 5),
  pre_mood INTEGER NOT NULL CHECK (pre_mood BETWEEN 1 AND 5),
  pre_stress INTEGER NOT NULL CHECK (pre_stress BETWEEN 1 AND 5),
  finished_at TEXT,
  post_connected INTEGER CHECK (post_connected BETWEEN 1 AND 5),
  post_mood INTEGER CHECK (post_mood BETWEEN 1 AND 5),
  post_stress INTEGER CHECK (post_stress BETWEEN 1 AND 5));
CREATE TABLE answers (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')));
```

Timestamps are ISO 8601 UTC. `day` is `YYYY-MM-DD` UTC. `actions` is a JSON array.

## Rules for builders

Privacy and safety (the users are minors):
- Store nothing that identifies a person: no IP, user agent, cookie, name or email.
  The IP is used only as the rate-limiter key and is never written or logged.
- Free-text answers are never shown until a team member approves them.
- No page diagnoses or labels a student. Survey results are shown as "how you
  answered" next to the group, with no category names.
- Every page keeps the footer's 988 line. Forms that collect feelings or free text
  say the box is not monitored and point to 988 and a trusted adult.
- Group numbers are hidden below five responses.

Content:
- Every factual claim cites an id from `/data/references.json`. Do not add a claim
  those sources do not support, and do not invent statistics. Need another source?
  `ASK @arch`.
- Animal findings are labelled as animal findings. Small studies are not stated as
  settled fact.
- Placeholders the team must fill are written in square brackets and capitals.
- Write for a ninth grader: short sentences, no jargon without a plain explanation.

Code:
- Files `kebab-case`; JS `camelCase`; JSON and SQL fields `snake_case`.
- The site's Content-Security-Policy (`public/_headers`) allows scripts and styles
  from the site itself only. No inline `<script>`, no `style=""` attributes, no
  `on*=""` attributes in any page; use classes from `site.css` or a page stylesheet
  next to the page, and set dynamic styles from JS through `element.style`.
- Text from the API or a data file goes into the page with `textContent`, never
  `innerHTML`. The one exception is the shared footer in `site.js`: a tested pure
  function that escapes every site value and returns markup.
- Validate every request body at the Worker; the browser's checks are for comfort.
- All SQL uses bound parameters.
- A failed request shows a visible message in an element with `role="alert"` and
  keeps what the user typed. No silent catch. The one exception is the `POST /api/count`
  ping: it may fail quietly, with a comment saying so, because a counter must never
  interrupt a visitor. The footer's `/data/site.json` load may also fail quietly: the
  safety lines render regardless, and `test/data/` catches a broken file in CI.
- The Worker logs unexpected errors with `console.error` and returns 500 `internal`.
  No other console output is left in.
- One test for each acceptance criterion in the brief. Logic that can be a pure
  function is one, in its own module, so `node --test` can import it.
- No secrets in the repo. `ADMIN_TOKEN` is a Worker secret, `.dev.vars` locally.
- Third-party code is a single vendored file in `public/vendor/` with its license.
- `npm test` and `npm run check` exit non-zero on failure.

Merge gate for every task: `npm test` and `npm run check` pass, and for UI tasks the
PR shows each new screen at 390 px and 1280 px wide.

## UI

Stack: hand-written HTML and CSS, custom elements for the header and footer, no
component library. Mockups (home, fact, game, check-in, results):
https://claude.ai/artifact/JmjS4rXPn1qhA8MJbqmwF4, and the same five files are in
`docs/mockups/*.dc.html` (read the markup inside `<x-dc>`; the inline styles are the
spec for layout, sizes and copy). There is no separate design-system
artifact; the tokens below are the design system and `public/css/site.css` is their
only implementation.

Direction: "the network lights up". A dark, quiet ground stands for a brain alone;
amber is connection. Things that are connected, chosen or done glow amber; things
that are not yet are dim indigo outlines. Flat fills, thin lines, dots joined by
lines as the one recurring motif. No gradients, no drop shadows, no emoji, no stock
photos.

| Token | Value | Use |
|---|---|---|
| `--ground` | `#0F1226` | page background |
| `--surface` | `#191D3A` | cards, panels |
| `--line` | `#2C3260` | borders, dim links |
| `--line-strong` | `#4A5296` | control outlines |
| `--text` | `#F3F4FB` | text |
| `--muted` | `#B4B9DA` | secondary text |
| `--connect` | `#FFB547` | primary action, selected, connected (text on it is `--ground`) |
| `--signal` | `#7AD7FF` | eyebrow labels, timers, focus ring |
| `--before` | `#5B64B8` | "before" series in charts |

Type: Space Grotesk 700 for headings and numbers, Inter 400/500/600 for the rest
(Google Fonts, `system-ui` fallback). Body 16 px minimum, line-height 1.55.
Radii: 12 px controls, 16 px cards, 24 px panels, 999 px buttons. Spacing in steps
of 4 px. Content width 1120 px.

Components in `site.css`: `.btn` (amber pill), `.btn-ghost` (outlined pill), `.card`,
`.panel`, `.eyebrow`, `.scale` (five-button 1 to 5 picker; the chosen one is amber
and has `aria-pressed="true"`), `.alert`.

Requirements: phone first, usable at 360 px wide with no sideways scroll; touch
targets at least 44 px; visible focus ring (3 px `--signal`); WCAG AA contrast;
everything works with a keyboard; `prefers-reduced-motion` turns off movement and
the game still plays; real `<button>`, `<a>`, `<label>`, `<fieldset>`.

Flow: a QR page always ends with one next step (fact to challenge, challenge to
pulse, pulse to experiment, listen to science, your-turn to results, science to
game). Home and the header reach everything. The experiment is three steps on one
page: check in, pick two or three actions, get a code; a return visit with the code
(remembered in `localStorage`, or typed) goes to check out, then to results.
