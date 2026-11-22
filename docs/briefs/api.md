Read `~/.claude/agents/backend.md` and follow it.

# Task `api` (role: backend, base branch: `main`)

Repo: FROZENPOP/project-reach-out. You are in a git worktree on branch `api`.
Read `ARCHITECTURE.md` first; it is binding. The `skeleton` task is merged: read
`src/worker/`, `migrations/0001_init.sql` and `test/helpers/env.js` before writing
anything, and follow the patterns you find there.

## Goal

Finish the Worker's HTTP API so the survey, the 24-hour experiment, the anonymous
answers and the admin tools all work against D1, exactly as the "HTTP API" and
"Database" sections of ARCHITECTURE.md say. Users are minors answering
anonymously: correctness of validation and of what is never stored matters more
than anything else here.

## Reuse, do not write

- The router, response helpers, validation helpers, rate limiter and counter code
  from `skeleton` in `src/worker/lib/`. Extend them; do not add parallel versions.
- `makeEnv()` and `call()` from `test/helpers/env.js` for every test.
- Web Crypto (`crypto.getRandomValues`, `crypto.subtle`) for codes and the
  constant-time compare. No npm packages.

## Files you own

`src/*`, `migrations/*`, `test/api/*`, `test/helpers/*`.

Out of scope: anything in `public/`, `wrangler.jsonc`, `package.json`, deployment.
The schema in `0001_init.sql` already has every table; add a new migration only if
you find you need an index, and say why in the PR.

## What to build

Routes, shapes, status codes and experiment rules are in ARCHITECTURE.md. Details
it leaves to you:

- `POST /api/pulse`, `POST /api/answers`, `POST /api/experiment/start`,
  `POST /api/experiment/:code/finish`: rate limited like `/api/count`.
- `POST /api/answers`: trim; remove control characters other than newline; reject
  empty or over 280 characters (count by code point). Store as `pending`.
- Experiment codes: 6 characters from the alphabet in ARCHITECTURE.md, uniform
  (no modulo bias), retried on a primary-key collision. Codes are matched
  case-insensitively and ignoring spaces and dashes. An unknown code is 404
  `not_found`.
- `GET /api/experiment/:code`: `waiting` before `ready_at`, `ready` from `ready_at`
  until 7 days after start, `done` once finished. A code past 7 days and not
  finished answers 409 `expired`.
- `GET /api/results`: replace the skeleton's empty parts with real SQL aggregates.
  Pulse score is `lack + left_out + isolated` (3 to 9). All the thresholds and
  rounding are in ARCHITECTURE.md.
- Admin routes: 401 `unauthorized` for a missing header, a wrong token, and always
  when `env.ADMIN_TOKEN` is unset or empty. Compare in constant time.
  `GET /api/admin/answers` takes `status` (`pending` default, `approved`,
  `rejected`), newest first, at most 200. Admin responses send
  `Cache-Control: no-store`.
- `GET /api/admin/export.csv`: header row then every row of the table, RFC 4180
  quoting, `Content-Disposition: attachment; filename="<table>.csv"`. Students'
  free text ends up in a spreadsheet, so prefix any cell that starts with `=`, `+`,
  `-`, `@`, tab or carriage return with a single quote. An unknown `table` is 400.

## Acceptance criteria (one test each, in `test/api/`)

Pulse and answers
1. A valid pulse is 201 and stores one row with a UTC ISO timestamp.
2. Pulse values outside 1 to 3, non-integers, missing fields or a non-JSON body are
   400 `invalid_body` and store nothing.
3. A valid answer is 201 and stored `pending`, trimmed, control characters removed.
4. An empty answer, a whitespace-only answer and a 281-character answer are 400; a
   280-character answer made of emoji is accepted.
5. Each POST route returns 429 `rate_limited` and stores nothing when the limiter
   denies.

Experiment
6. Start with valid values and 2 or 3 distinct known actions is 201 with a code
   matching `^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$` and `ready_at` exactly 18
   hours after `now`.
7. Start with 1 action, 4 actions, a duplicate action, an unknown action, or a
   scale value outside 1 to 5 is 400.
8. `GET` status is `waiting` at +17h59m, `ready` at +18h, `done` after finish;
   lookup works for a lowercased code with a dash in it; unknown code is 404.
9. Finish before `ready_at` is 409 `too_early`; at +18h it is 200 with `pre` and
   `post` matching what was sent; a second finish is 409 `already_finished`;
   finish at +7d+1m is 409 `expired`.
10. Finish with invalid values is 400 and leaves the row unfinished.

Results
11. With 4 finished experiments `pre`, `post` and `actions` are `null` and
    `finished` is 4; with 5 they are the means of the finished rows only (an
    unfinished sixth row changes `started`, not the means), rounded to 2 decimals;
    `actions` counts each chosen action among finished rows.
12. With 4 pulse rows `mean` and `counts` are `null`; with 5 they are right, and
    `counts` has only the scores that occur.
13. `answers` lists only approved texts, newest first, at most 50.
14. The skeleton's counters test still passes unchanged.

Admin
15. Every admin route is 401 without a header, with a wrong token, with the right
    token when `ADMIN_TOKEN` is empty; and 200 with the right token.
16. Listing by status returns the right rows; approving or rejecting changes the
    status; an unknown id is 404; a status other than the two allowed is 400.
17. Each of the four exports has the right header row and row count; a cell
    containing a comma, a quote and a newline round-trips through a CSV parser you
    write in the test; a cell starting with `=` is prefixed with `'`.

Privacy
18. After one request to every route with `CF-Connecting-IP: 203.0.113.9` and a
    `User-Agent` header, no table contains that IP or that user agent (dump every
    table and search).

## Merge gate

`npm test` and `npm run check` both pass; paste both outputs in the PR body.

Done means: PR open against `main`, `scope.sh check api <pr>` passes, and
`[api] READY` posted on the board. You do not merge.
