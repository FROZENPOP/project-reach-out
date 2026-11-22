Read `~/.claude/agents/frontend.md` and follow it.

# Task `polish` (role: frontend, base branch: `main`)

Repo: FROZENPOP/project-reach-out. You are in a git worktree on branch `polish`.
Read `ARCHITECTURE.md` first; it is binding, including the UI section and the CSP
rule (no inline scripts, no `style=""` attributes). Every page of the site is
merged. This task fixes four things in the shared shell that showed up once the
pages existed. Read `public/js/site.js`, `public/css/site.css`,
`public/css/home.css` and `public/index.html` first, and open two or three other
pages (`public/fact/`, `public/game/`, `public/results/`) to see how they use the
header. Keep the diff small; do not restyle anything that is not listed.

## Files you own

`public/index.html`, `public/404.html`, `public/css/*`, `public/js/*`,
`public/favicon.svg`, `test/skeleton/*`, `test/polish/*`.

Out of scope: every other page's own files. Your changes must not require edits
to them.

## What to change

1. Phone header. Below 640 px the four header links wrap onto two lines and push
   each QR page's content down. Below 640 px the header becomes one row: the logo
   on the left and a "Menu" button on the right (a real `<button>` with
   `aria-expanded` and `aria-controls`) that opens the same four links as a panel
   under the row. Escape closes it and returns focus to the button; choosing a
   link navigates normally. From 640 px up the header stays as it is now, with no
   button.
2. Favicon. Every page logs a 404 for `/favicon.ico`. Add `public/favicon.svg`
   (the logo mark: two dots joined by a line, `--connect` on `--ground`) and have
   `site.js` add `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` to
   the document head if the page has no icon link.
3. Home page, risk and protective factor. HOSA judges score whether the
   campaign's risk and protective factors are "exceptionally clear", and the home
   page never names them. Add a two-part panel between the hero and the "Six
   codes" section, using existing tokens and the `.panel` or `.card` classes:
   - "The risk: isolation" with the line "Spending a lot of time cut off from
     other people makes anxiety and depression more likely, and the teenage
     brain is especially sensitive to it."
   - "The protection: connection" with the line "Supportive relationships with
     friends, family and trusted adults, and feeling that you belong at school,
     make those problems less likely."
   - Each line ends with its citation as a link, APA style: the risk line cites
     "(Loades et al., 2020; Orben et al., 2020)" linking to
     `/science/#ref-loades2020` and `/science/#ref-orben2020`; the protection
     line cites "(Substance Abuse and Mental Health Services Administration,
     2019)" linking to `/science/#ref-samhsa2019`.
   - Under both, a link "See the research" to `/science/`.
4. Home page sharing tags. Add to `public/index.html` only: a
   `<meta name="description">`, `og:title`, `og:description`, `og:type` and
   `twitter:card` (`summary`). Title "Reach Out: your brain is built to
   connect". Description "How isolation affects the teenage brain, and six small
   ways to connect. A HOSA Mental Health Promotion project." No image tag.

## Acceptance criteria (one test each, in `test/polish/`)

1. The header's markup function (pure, as the footer's is) returns a menu button
   with `aria-expanded="false"` and `aria-controls` pointing at the id of the
   element that holds the four links, and the four links still point to
   `/science/`, `/game/`, `/experiment/`, `/results/`.
2. The menu state function toggles open and closed, and closes on Escape,
   returning the right `aria-expanded` value each time.
3. `site.css` hides the menu button from 640 px up and shows it below (assert on
   the media query text), and the existing token test still passes unchanged.
4. `public/favicon.svg` exists, is valid XML with an `<svg>` root, and contains
   `#FFB547`; the icon-link helper adds one link when none exists and none when
   one does (test the pure decision, not the DOM).
5. `public/index.html` contains both factor headings and both lines word for
   word, the "See the research" link to `/science/`, still has exactly one
   `<h1>`, and has no `style=` attribute and no inline script.
6. `public/index.html` has the five meta tags with the exact title and
   description above.
7. Every existing test in `test/skeleton/` still passes; change one only if it
   asserts something this brief deliberately changes, and say which in the PR.

## Merge gate

`npm test` and `npm run check` pass; paste both outputs in the PR body. Add
screenshots at 390 px wide of the home page, the fact page and the game start
screen with the menu closed and open, and of the home page at 1280 px. If you
cannot capture screenshots, say so plainly and the architect will check the look.

Done means: PR open against `main` and `[polish] READY` posted on the board. You
do not merge. Known hook quirk: if Write/Edit is refused for a file inside your
own folders, create it with touch (or write it from the shell) and carry on.
