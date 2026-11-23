Read `~/.claude/agents/frontend.md` and follow it.

# Task `rebrand` (role: frontend, base branch: `main`)

Repo: FROZENPOP/project-reach-out. You are in a git worktree on branch `rebrand`.
Read `ARCHITECTURE.md` first; it is binding, including the CSP rule (no inline
scripts, no `style=""` attributes). Its `UI` section was just rewritten: the team
has a logo (a round badge, pink brain on two greens) and the site moves from navy
and amber to the logo's greens and pink. The new token values, the logo files and
their rules are all in that section. The logo files are already on `main` in
`public/img/` (`logo-512.png`, `logo-128.png`); do not edit them.

Every page takes its colours from the tokens in `public/css/site.css`, so most of
the change is that one block. Keep the diff small; change nothing that is not
listed.

## Files you own

`public/index.html`, `public/404.html`, `public/favicon.svg`, `public/css/*`,
`public/js/*`, `public/science/*`, `public/posters/*`, `test/skeleton/*`,
`test/polish/*`, `test/rebrand/*`.

Out of scope: every other page's files, `public/img/*`, `public/data/*`. Layout,
copy and behaviour stay as they are except where listed.

## What to change

1. Tokens. Set the token block in `site.css` to the table in ARCHITECTURE.md `UI`
   exactly, including `--connect-hover`.
2. Header mark. In `site.js`, replace the inline two-dot SVG with
   `<img src="/img/logo-128.png" width="40" height="40" alt="">` before the
   "Reach Out" text (the link text names it, so the image is decorative). Keep the
   phone menu as it is; check the header row still fits at 360 px.
3. Favicon. Use the logo: the icon helper adds
   `<link rel="icon" type="image/png" href="/img/logo-128.png">` when the page has
   no icon link. Delete `public/favicon.svg`.
4. Home hero. Replace the decorative network SVG (`.hero-art`) with the large logo:
   `<img class="hero-art" src="/img/logo-512.png" width="320" height="320"
   alt="Reach Out Project logo">`, shown at most 320 px wide, smaller on phones
   (about 200 px under 640 px), no sideways scroll at 360 px. Remove CSS that only
   served the old SVG.
5. Other inline SVG colours. Any remaining hex colour in inline SVG under your
   files (the science page figure, anything else `grep` finds) maps to the new
   token values from the table: old `#0F1226`, `#191D3A`, `#2C3260`, `#4A5296`,
   `#B4B9DA`, `#F3F4FB`, `#FFB547` become the new `--ground`, `--surface`,
   `--line`, `--line-strong`, `--muted`, `--text`, `--connect`. In the science
   figure's `aria-label`, "bright amber links" becomes "bright pink links".
6. Posters. Each printed card on `/posters/` gets the logo (`logo-128.png`) small
   above its title, about 0.6 in on paper. The card stays white with black text so
   the codes scan; the QR codes themselves stay black on white.

## Acceptance criteria (one test each, in `test/rebrand/`)

1. `site.css` declares each of the ten tokens with the literal value from
   ARCHITECTURE.md (write the values into the test, do not parse the doc).
2. No file under `public/` other than `public/img/*` and `public/vendor/*`
   contains any of the old hex values `#0F1226 #191D3A #2C3260 #4A5296 #5B64B8
   #7AD7FF #B4B9DA #F3F4FB #FFB547 #FFD08A` (case-insensitive), and no page says
   "amber".
3. The header markup function returns an `<img>` with `src="/img/logo-128.png"`
   and `alt=""`, and the link still reads "Reach Out" and points to `/`.
4. The icon helper's link points to `/img/logo-128.png` with `type="image/png"`;
   `public/favicon.svg` no longer exists; `public/img/logo-128.png` and
   `logo-512.png` exist and start with the PNG signature.
5. `public/index.html` has the hero `<img>` with `src="/img/logo-512.png"`, a
   non-empty `alt`, `width` and `height`; still exactly one `<h1>`; no `style=`
   attribute and no inline script.
6. The posters page puts the logo on every card (test at the level the existing
   qr-pages tests use for the poster cards, or on the markup), and the QR colours
   stay `#000000` on `#FFFFFF`.
7. Existing tests: `test/polish/` test 4 asserts the old favicon; replace it with
   criterion 4 and say so in the PR. Change no other existing test unless it
   asserts something this brief deliberately changes, and name each one in the PR.

## Merge gate

`npm test` and `npm run check` pass; paste both outputs in the PR body. Add
screenshots at 390 px and 1280 px of the home page, the fact page and the results
page, and the posters page in print preview (or the print media emulated). If you
cannot capture screenshots, say so plainly and the architect will check the look.

Done means: PR open against `main` and `[rebrand] READY` posted on the board. You
do not merge. Known hook quirk: if Write/Edit is refused for a file inside your own
folders, create it with touch (or write it from the shell) and carry on.
