Read `~/.claude/agents/frontend.md` and follow it.

# Task `experiment-ui` (role: frontend, base branch: `main`)

Repo: FROZENPOP/project-reach-out. You are in a git worktree on branch
`experiment-ui`. Read `ARCHITECTURE.md` first; it is binding, including the UI
section and the CSP rule (no inline scripts, no `style=""` attributes). The
`skeleton` and `api` tasks are merged: read `public/css/site.css`,
`public/js/site.js`, `public/index.html` and `src/worker/routes/` and build with
what is there. Mockups: `docs/mockups/Survey.dc.html` (check-in) and
`docs/mockups/Results.dc.html` (you cannot open the artifact link; read the markup
inside `<x-dc>`, its inline styles are the spec for layout, sizes and copy).

## Goal

The campaign's real-world mini experiment and its data graph. A volunteer checks
in with three anonymous ratings, picks two or three ways to connect on purpose
for 24 hours, gets a code, comes back the next day and checks out with the same
three ratings. `/results/` shows the before and after for the whole group, live.
That chart is the team's HOSA project data, so it must be honest about what it
shows. `/admin/` lets the team approve anonymous answers and download the data.

## Reuse, do not write

- `site.css` (the `.scale` picker, `.btn`, `.panel`, `.card`, `.alert`),
  `<site-header>`, `<site-footer>`, `api()` and `ApiError`.
- The API as built by `api`; do not change it. A gap or bug is an `ASK @api` (a
  fact about its code) or `ASK @arch` (a change to the contract).
- Charts are HTML and CSS or inline SVG drawn by your own small functions. No
  chart library.

## Files you own

`public/experiment/*`, `public/results/*`, `public/admin/*`,
`test/experiment-ui/*`.

## What to build

### `/experiment/`

One page that decides what to show from a code: `?code=` in the URL, else the one
remembered in `localStorage`, else none.

- No code: step 1, check in. Three `.scale` pickers, 1 lowest to 5 highest:
  "How connected do you feel to the people around you?", "How is your mood right
  now?", "How stressed do you feel right now?". Above: "Anonymous. No name, no
  account." Below: "By continuing you agree that your anonymous answers can be
  used in our HOSA project." Then step 2, pick two or three: Talk to someone you
  normally do not talk to (`talk_new`); Eat with someone instead of alone
  (`eat_together`); Have a phone-free conversation (`phone_free`); Do an activity
  with a friend or family member (`shared_activity`); Reach out to someone you
  have not talked to in a while (`reach_out`). The button stays disabled until all
  three ratings and two or three actions are chosen; a fourth cannot be chosen.
  Submit sends `POST /api/experiment/start`, stores the code, and shows step 3:
  the code in large type (grouped `ABC-DEF`), "Come back after <local date and
  time of ready_at> to check out", "This phone will remember your code. Take a
  screenshot in case.", and the chosen actions as a checklist the volunteer can
  tick (ticks kept in `localStorage` only).
- Code present: `GET /api/experiment/:code`. `waiting`: the step 3 view. `ready`:
  check out, the same three pickers, "How do you feel now, after your 24 hours?";
  submit sends `.../finish` and shows the volunteer's own before and after for
  the three measures as small paired bars with the numbers, a line that lower
  stress is the better direction, and a button to `/results/`. `done`: "You have
  already checked out. Thank you." and a button to `/results/`. 404: "We could
  not find that code. Check it and try again." with the code field. 409
  `expired`: "This code is more than 7 days old." and a "Start again" button.
- A small "I have a code" link on the check-in view opens a code field. "Start
  over" (on the waiting view) forgets the stored code after a confirm step built
  in the page (no `confirm()` dialog).

### `/results/`

From `GET /api/results`:

- Headline and intro as in the mockup, with the real numbers: "<finished>
  volunteers answered the same three questions before and after 24 hours of
  connecting on purpose."
- Before and after chart: three groups (Connectedness, Mood, Stress), two bars
  each on a fixed 1 to 5 axis, before in `--before`, after in `--connect`, the
  two means printed under each group with the change ("2.88 to 3.75, up 0.87").
  Under Stress: "Lower is better." The same numbers are also in a real `<table>`
  for screen readers. When `pre` is `null`: no bars, and "The chart appears when
  5 volunteers have finished. So far: <finished> finished, <started> started."
- Which actions volunteers picked (a ranked list with counts) when available.
- "How connected are students?": the number of pulse answers and, when available,
  the distribution of totals 3 to 9. No category names.
- "The campaign so far": total QR scans and scans per code (with the six titles),
  30-second challenges done, games played, clips opened.
- "What helps you feel connected?": the approved answers as cards, and a link to
  `/your-turn/`. Empty state: "No answers yet. Add the first one."
- "How to read this": volunteers chose to take part, there was no comparison
  group, the ratings are self-reported and cover one day, so this shows what
  happened for this group and cannot prove that connecting caused the change.
- A failed load shows an alert with a "Try again" button; the page never shows
  made-up or leftover numbers.

### `/admin/`

`<meta name="robots" content="noindex">`. A passphrase field (`type="password"`,
kept in `sessionStorage`, sent only as the `Authorization: Bearer` header). After
it works: tabs Pending, Approved, Rejected listing answers with their date; each
row has Approve and Reject buttons that update it in place; four "Download CSV"
buttons (experiment, pulse, answers, counters) that fetch with the header and save
the file. A 401 clears the stored passphrase and says "That passphrase is not
right." A "Lock" button forgets it.

## Acceptance criteria (one test each, in `test/experiment-ui/`)

Put page logic in small pure modules so these run under `node --test` with a
stubbed `fetch`.
1. The code resolver prefers `?code=` over the stored code, normalises case,
   spaces and dashes, and formats for display as `ABC-DEF`.
2. The check-in form model enables submit only with three ratings and two or
   three actions, refuses a fourth action, and builds the exact request body.
3. The view chooser maps `waiting`, `ready`, `done`, 404 and 409 `expired` to the
   five views above.
4. The personal before/after model gives, per measure, both values and the
   signed change, and marks stress going down as the better direction.
5. The chart model maps a mean on the 1 to 5 axis to a bar height in percent
   (1 is 0%, 5 is 100%, 3 is 50%), and produces the change text "up 0.87",
   "down 0.63", "no change" correctly from two-decimal means.
6. With `pre: null` the results model is the "appears when 5 volunteers have
   finished" state and contains no bar data; the pulse model does the same with
   `counts: null`.
7. The campaign model totals the six `scan:<n>` counters, tolerates missing ones
   as zero, and labels each code with its title.
8. The answers model returns the empty state for `[]`, and answers are rendered
   with `textContent` (a test answer containing `<img onerror>` text ends up as
   text in the model, and no module in your folders uses `innerHTML`).
9. A failed results load produces the alert state and no stale numbers.
10. The admin client sends the header on every admin call, never puts the
    passphrase in a URL, clears it on 401, and after Approve moves the row out
    of Pending.
11. Each of the three `index.html` files has one `<h1>`, `<site-header>`,
    `<site-footer>`, loads `/css/site.css`, and has no `style=` attribute and no
    inline script; `/admin/` has the `noindex` meta tag.

## Merge gate

`npm test` and `npm run check` pass; paste both outputs in the PR body. Run
`npx wrangler dev` and go through start, waiting, and (by editing the local D1 row's
`created_at` back 19 hours) check out and results; say in the PR that you did, or
that you could not. Add screenshots at 390 px wide of each experiment view, and
of `/results/` at 390 px and 1280 px both with data and in the under-5 state. If
you cannot capture screenshots, say so plainly and the architect will check the
look.

Done means: PR open against `main`, `scope.sh check experiment-ui <pr>` passes,
and `[experiment-ui] READY` posted on the board. You do not merge.
