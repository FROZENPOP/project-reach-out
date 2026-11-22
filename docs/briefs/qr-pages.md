Read `~/.claude/agents/frontend.md` and follow it.

# Task `qr-pages` (role: frontend, base branch: `main`)

Repo: FROZENPOP/project-reach-out. You are in a git worktree on branch `qr-pages`.
Read `ARCHITECTURE.md` first; it is binding, including the UI section and the CSP
rule (no inline scripts, no `style=""` attributes). The `skeleton` task is merged:
read `public/css/site.css`, `public/js/site.js` and `public/index.html` and build
with what is there. Mockup for the fact page: `docs/mockups/Fact.dc.html` (you
cannot open the artifact link; read the markup inside `<x-dc>`, its inline styles
are the spec). The other pages follow the same phone layout: header row, one big
thing in the middle, actions pinned at the bottom.

## Goal

The five pages a student lands on after scanning a QR code in a school hallway,
plus the printable sheet of the six codes. Each page is one screen on a phone,
makes sense with no context, takes under a minute, and ends with one next step.

## Reuse, do not write

- `site.css`, `<site-header>`, `<site-footer>`, `api()` and `ApiError`.
- Content is already written and belongs to the architect: `/data/facts.json`,
  `/data/challenges.json`, `/data/references.json`, `/data/site.json`. Do not edit
  them; wrong or missing content is an `ASK @arch`.
- QR drawing: vendor one small, well-known MIT-licensed single-file QR encoder
  into `public/vendor/` with its license text and the exact version and source URL
  in a comment. Do not write an encoder.

## Files you own

`public/fact/*`, `public/challenge/*`, `public/pulse/*`, `public/listen/*`,
`public/your-turn/*`, `public/posters/*`, `public/vendor/*`, `test/qr-pages/*`.

Out of scope: the API (the `api` task builds `/api/pulse` and `/api/answers`; in
your tests stub `fetch` to the contract in ARCHITECTURE.md), the science page,
the results page.

## What to build

`/fact/` (QR 1, "Did you know?"). Shows one random fact from `facts.json`: `text`
as the headline, `detail` under it, then the source as a short citation (first
author and year, taken from the reference's `apa`) linking to
`/science/#ref-<id>`. A bar fills over 20 seconds (static and full with reduced
motion). Buttons: "Try a 30-second challenge" (`/challenge/`), "Another fact"
(a different fact, never the one just shown), "See the science behind this"
(`/science/`).

`/challenge/` (QR 2, "Take a 30-second challenge"). Shows one random challenge.
"Start" begins a visible 30-second countdown; "I did it" (available at any time)
sends `POST /api/count` with `challenge_done` and switches to a thank-you state
whose next step is "How connected are you?" (`/pulse/`). "Give me a different
one" swaps the challenge. The count ping may fail quietly (see ARCHITECTURE.md).

`/pulse/` (QR 3, "How connected are you?"). Three questions, each with the options
"Hardly ever" (1), "Some of the time" (2), "Often" (3):
"How often do you feel that you lack companionship?",
"How often do you feel left out?",
"How often do you feel isolated from others?"
Above them: "Anonymous. No name, no account." Below, in small print: the questions
come from a short research scale (Hughes et al., 2004), linking to
`/science/#ref-hughes2004`. Submit sends `POST /api/pulse` (`lack`, `left_out`,
`isolated`), then shows the results view: "Thanks. N students have answered."
and, from `GET /api/results`, a simple bar chart of how many students got each
total from 3 to 9 with the visitor's own total marked "you". If `pulse.counts` is
`null`: "Not enough answers yet to show the group." Never name a category or call
a score good, bad, high or lonely. If any answer was "Often", also show: "Feeling
this way is common, and it can change. Talking with a counselor or an adult you
trust helps. To talk to someone now, call or text 988." Next step: "Take the
24-hour challenge" (`/experiment/`). After a successful submit the device
remembers it (`localStorage`) and shows the results view instead of the form.

`/listen/` (QR 4, "Listen"). Reads `site.json`'s `podcast`. With an `embed_url`
whose host is one of `open.spotify.com`, `www.youtube-nocookie.com`,
`embed.podcasts.apple.com`: the title, an `<iframe>` with a `title` attribute, and
the summary. With only a `link_url` (https): a button to it. With neither: a
"The clip is coming soon" state. Any other embed host is treated as not provided.
When an embed or link is shown, send `listen_opened` once (quiet ping). Next
step: "See the science" (`/science/`).

`/your-turn/` (QR 5, "Your turn"). The question "What helps you feel connected to
other people?", a labelled `<textarea>` limited to 280 characters with a live
count, and the note: "Anonymous. Please do not include names. A team member reads
answers before they appear on the site. This box is not monitored: if you need
help now, call or text 988 or talk to an adult you trust." Submit sends
`POST /api/answers`; on success a thank-you state with the next step "See what
others said" (`/results/`).

`/posters/` (printable). Six cards, one per QR code: the number, the title
("Did You Know?", "Take a 30-Second Challenge", "How Connected Are You?",
"Listen", "Your Turn", "Learn More"), the QR code as SVG, and the plain URL under
it. Each code encodes exactly `<location.origin>/q/<n>`, error correction level M,
with a 4-module quiet zone, dark on white (the card is white even though the site
is dark). A Print button, and a print stylesheet that puts the six cards on one
letter page with no header, footer or button. The page has
`<meta name="robots" content="noindex">`.

Every form: a failed request shows a message in a `role="alert"` element and keeps
what the visitor entered; a 429 says "Too many tries. Wait a minute and try
again."; the submit button is disabled while sending.

## Acceptance criteria (one test each, in `test/qr-pages/`)

Put page logic in small pure modules so these run under `node --test`.
1. The fact picker never returns the fact just shown and, over many seeded draws,
   returns every fact.
2. Every `ref` in `facts.json` exists in `references.json`, and the short citation
   function gives "Tomova et al., 2020", "Blakemore & Mills, 2014" and "Office of
   the Surgeon General, 2023" for those three references.
3. The challenge picker never repeats the one just shown.
4. The pulse body builder maps the three option labels to 1, 2, 3 and refuses to
   build until all three are answered.
5. The pulse results view model: with `counts: null` it is the "not enough
   answers" state; with counts it has seven bars (3 to 9, zero where missing) and
   marks the visitor's total; the "Often" message appears only when at least one
   answer was 3; none of its strings contain "lonely", "high", "low", "good" or
   "bad".
6. The podcast view model returns `embed`, `link` or `soon` for the cases above,
   and rejects an `embed_url` on any other host, on `http:`, and a
   `javascript:` `link_url`.
7. The answer validator trims, rejects empty and over-280 (by code point) text,
   and the counter text is right at 0, 279, 280.
8. The poster URL builder returns `<origin>/q/<n>` for 1 to 6 with no trailing
   slash or query, for origins with and without a port.
9. The vendored encoder, for `https://example.com/q/1` at level M, returns a
   square matrix with the three finder patterns in the right corners, and the
   poster's SVG adds a 4-module quiet zone.
10. Each of the six `index.html` files has one `<h1>`, `<site-header>`,
    `<site-footer>`, loads `/css/site.css`, and has no `style=` attribute and no
    inline script.
11. Each form module, given a `fetch` stub that fails with 429 and then with a
    network error, produces the two alert messages and leaves the entered values
    unchanged.

## Merge gate

`npm test` and `npm run check` pass; paste both outputs in the PR body. Add
screenshots of each page at 390 px wide, the pulse results view, and the posters
page as it prints. If you cannot capture screenshots, say so plainly and the
architect will check the look.

Done means: PR open against `main`, `scope.sh check qr-pages <pr>` passes, and
`[qr-pages] READY` posted on the board. You do not merge.
