Read `~/.claude/agents/backend.md` and follow it.

# Task `api-hardening` (role: backend, base branch: `main`)

Repo: FROZENPOP/project-reach-out. You are in a git worktree on branch
`api-hardening`. Read `ARCHITECTURE.md` first; it is binding. The `api` task is
merged and passed review; this is the reviewer's list of non-blocking follow-ups.
Read `src/worker/` and `test/api/` before changing anything. Keep the diff small.

## Files you own

`src/*`, `migrations/*`, `test/api/*`, `test/helpers/*`.

## What to change

1. Admin guard by prefix. Today each admin handler calls `requireAdmin` itself,
   so a future admin route that forgets it would ship open. Enforce the check in
   the router for every path under `/api/admin/` (before the handler runs, and
   before any 404 for an unknown admin path), and remove the per-handler calls.
2. Body size cap. `src/worker/lib/body.js` parses a body of any size. Reject a
   request body over 4096 bytes with 413 and `error.code` `too_large`, without
   parsing it (check `Content-Length`, and also stop reading once the limit is
   passed, since the header can be missing or wrong).
3. An answer made only of invisible characters (for example U+200B zero-width
   spaces) is currently accepted as non-empty. Treat text with no visible
   character as empty (400 `invalid_body`).

## Acceptance criteria (one test each, in `test/api/`)

1. A route registered under `/api/admin/` with a handler that does no auth of its
   own answers 401 without the token (register a throwaway route in the test, or
   test the router function directly), and an unknown `/api/admin/nope` path
   answers 401 without the token and 404 with it.
2. The admin tests no longer rely on a hand-written list of routes: they cover
   every route in the router's table whose path starts with `/api/admin/`.
3. A 5000-byte body to each POST route is 413 `too_large` and stores nothing; a
   body with no `Content-Length` header that is over the limit is also 413.
4. An answer of only zero-width spaces is 400; an answer with one visible
   character among them is accepted.
5. The experiment code test checks the literal alphabet
   `ABCDEFGHJKMNPQRSTUVWXYZ23456789` from the brief, not a constant imported from
   the code, over at least 200 generated codes.
6. At exactly 7 days after start, status is `ready` and finish is 200; one
   millisecond later both answer 409 `expired`.
7. A primary-key collision on the first generated code is retried and the start
   still succeeds (inject the code generator or the random source in the test).
8. A CSV cell starting with a tab and one starting with a carriage return are
   both prefixed with a single quote.

ARCHITECTURE.md gains `413 too_large` in the error list; the architect makes that
edit, do not touch the file.

## Merge gate

`npm test` and `npm run check` pass; paste both outputs in the PR body.

Done means: PR open against `main` and `[api-hardening] READY` posted on the
board. You do not merge. Known hook quirk: if Write/Edit is refused for a file
inside your own folders, create it with touch (or write it from the shell) and
carry on.
