Read `~/.claude/agents/frontend.md` and follow it.

# Task `science` (role: frontend, base branch: `main`)

Repo: FROZENPOP/project-reach-out. You are in a git worktree on branch `science`.
Read `ARCHITECTURE.md` first; it is binding, including the UI section, the content
rules and the CSP rule (no inline scripts, no `style=""` attributes). The
`skeleton` task is merged: read `public/css/site.css`, `public/js/site.js` and
`public/index.html` and build with what is there.

## Goal

`/science/`: the page QR code 6 ("Learn More") opens, and the page HOSA judges
read to decide whether the team understands its topic. It explains, to a ninth
grader in about four minutes, how isolation affects the developing brain, names
the risk factor and the protective factor outright, and shows every source. It
must be accurate before it is impressive: a mental health professional will
review it.

## Reuse, do not write

- `site.css`, `<site-header>`, `<site-footer>`.
- `/data/references.json` is the only source list and belongs to the architect.
  Every claim you write must be one of the claims listed below, in your own plain
  words. Do not add numbers, findings or sources. If you think a claim below is
  wrong or you need another one, `ASK @arch`.

## Files you own

`public/science/*`, `test/science/*`.

## What to build

One page: `index.html`, `science.css`, and a small `science.js` only if needed
(the page must read completely with JavaScript off). In-text citations are APA
style, "(Blakemore & Mills, 2014)", each a link to `#ref-<id>`. The reference
list is static HTML (`<ol>` or `<ul>` with one `<li id="ref-<id>">` per entry,
APA text and its URL as a link), in alphabetical order, containing every entry of
`references.json`, word for word.

Sections, in this order, with a short table of contents of anchor links at the top:

1. **The short version.** Three sentences: the teen brain is still being built;
   other people are part of what builds it; so isolation is a risk and connection
   is protection.
2. **Risk factor and protective factor.** A two-part panel, impossible to miss.
   Risk factor: social isolation and loneliness. Protective factor: social
   connection, meaning supportive relationships with family, friends and trusted
   adults, and feeling that you belong at school (`samhsa2019`, `osg2021`). One
   sentence on what the two terms mean: a risk factor makes a problem more likely,
   a protective factor makes it less likely or softens it (`samhsa2019`).
3. **Your brain is still being built.** The brain keeps developing through the
   teens and into the twenties; the network used for understanding other people is
   among the areas still changing; the teen years may be a sensitive period for
   social learning. Unused connections are trimmed and used ones strengthened
   during these years (`blakemore2014`).
4. **Why friends matter so much right now.** Adolescence brings a stronger need to
   be with people your own age; this is a normal part of development, not a
   distraction (`orben2020`, `blakemore2014`).
5. **What isolation does.** Four findings, each labelled with what kind of study it
   is: after 10 hours alone, adults' brains responded to social pictures the way
   hungry brains respond to food pictures, in a study of 40 adults (`tomova2020`);
   being left out of a game activated a brain area that also responds to the
   distress of physical pain, in a small scan study (`eisenberger2003`); young
   mice isolated for two weeks after weaning developed thinner myelin in the
   prefrontal cortex that did not recover on return to the group, while the same
   isolation later did not have this effect, an animal study (`makinodan2012`);
   researchers reviewing animal work conclude isolation during adolescence has
   effects on brain and behaviour that it does not have at other ages
   (`orben2020`). Explain myelin in one plain sentence.
6. **What it means for mental health.** A review of 63 studies with about 51,000
   children and teens linked loneliness to later depression and anxiety symptoms,
   up to nine years later, and how long loneliness lasted mattered more than how
   intense it was (`loades2020`). Loneliness at school rose in 36 of 37 countries
   from 2012 to 2018, in surveys of about one million 15- and 16-year-olds
   (`twenge2021`). People aged 15 to 24 spend about 70% less time in person with
   friends than in 2003 (`osg2023`). In adults, across 148 studies, people with
   strong relationships were about 50% more likely to be alive at follow-up
   (`holtlunstad2010`).
7. **What we do not know.** Much of the brain evidence is from animals or adults;
   studies of teens mostly show links, not proof of cause; choosing time alone to
   rest is not the same thing as isolation or loneliness.
8. **What you can do.** Small, regular contact counts. Three links: the 30-second
   challenge (`/challenge/`), the 24-hour experiment (`/experiment/`), the game
   (`/game/`).
9. **If you are struggling.** Talk to a counselor or an adult you trust. To talk
   to someone now, call or text 988 (Suicide and Crisis Lifeline, US).
10. **References.** As above. Below it: "This page shares research. It is not
    medical advice." and "[REVIEWED BY: CONSULTANT NAME, TITLE]".

One explanatory figure in section 3 or 5, inline SVG in the site's dots-and-lines
style, with a caption and `role="img"` plus a full `aria-label`: for example the
same small network drawn twice, "used" (lit amber links) and "not used" (dim,
fewer links). No stock images, no emoji.

Reading comfort: the text column is at most about 68 characters wide, body text at
least 17 px on this page, generous spacing between sections, the table of contents
stays usable on a phone.

## Acceptance criteria (one test each, in `test/science/`)

Parse `public/science/index.html` as text in the tests.
1. Every `#ref-<id>` link in the page points at an id that exists in the page,
   and every id in `references.json` has an `<li id="ref-<id>">` whose text
   contains that reference's `apa` string exactly and a link to its `url`.
2. The reference list is in alphabetical order.
3. Sections 3 to 6 each contain at least one in-text citation link, and every
   citation's visible text matches its reference (author names and year).
4. The ten section headings exist in the order above as `<h2>`, there is exactly
   one `<h1>`, and every table-of-contents link resolves.
5. The words "risk factor" and "protective factor" both appear in section 2, with
   "isolation" and "connection".
6. The mouse finding and the adult findings are labelled as animal and adult
   studies (the paragraph that cites `makinodan2012` contains "mice" and "animal";
   the ones citing `tomova2020` and `holtlunstad2010` contain "adults").
7. The page contains "988" and "not medical advice", has `<site-header>` and
   `<site-footer>`, no `style=` attribute and no inline script, and its figure has
   `role="img"` and a non-empty `aria-label`.
8. No number appears in the page text that is not in this brief or in
   `references.json` (write the allowed list in the test).

## Merge gate

`npm test` and `npm run check` pass; paste both outputs in the PR body. Add
screenshots at 390 px and 1280 px wide. If you cannot capture screenshots, say so
plainly and the architect will check the look.

Done means: PR open against `main`, `scope.sh check science <pr>` passes, and
`[science] READY` posted on the board. You do not merge.
