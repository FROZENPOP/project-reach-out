Read `~/.claude/agents/frontend.md` and follow it.

# Task `game` (role: frontend, base branch: `main`)

Repo: FROZENPOP/project-reach-out. You are in a git worktree on branch `game`.
Read `ARCHITECTURE.md` first; it is binding, including the UI section and the CSP
rule (no inline scripts, no `style=""` attributes). The `skeleton` task is merged:
read `public/css/site.css`, `public/js/site.js` and `public/index.html` and build
with what is there. Your mockup is `docs/mockups/Game.dc.html` (you cannot open the
artifact link; read the markup inside `<x-dc>`, its inline styles are the spec for
layout, sizes and copy).

## Goal

"Wire the Brain" at `/game/`: a 60-second tap game for a phone. The player is a
teenage brain. Small social moments appear; catching one lights a connection
between two neurons; letting one fade prunes a connection. It ends with the
player's brain map and one honest line of science. It is the campaign's "wow"
piece: a judge with seven minutes and a student in a hallway should both get it in
five seconds and want to finish the round.

## Reuse, do not write

- `site.css` tokens and classes, `<site-header>` (not during play), `<site-footer>`
  on the start and end screens, and `api()` from `/js/site.js`.
- SVG in the DOM for the brain, real `<button>` elements for the moments. No
  canvas, no game library, no npm packages.

## Files you own

`public/game/*`, `test/game/*`.

Out of scope: everything else. If `site.css` lacks something every page would
need, `ASK @arch`; page-specific styles go in `public/game/game.css`.

## What to build

- `public/game/engine.js`: the whole game as pure functions with no DOM and no
  clock, driven by a seeded random generator, so `node --test` can play it:
  create a game from a seed, advance it by a number of milliseconds, tap a moment
  by id, read the state (time left, moments on screen with position and remaining
  life, lit edges, counts, finished or not).
- Rules. A round is 60 seconds. The brain is a fixed set of about 14 neurons with
  fixed positions and at least 30 candidate edges between near neighbours. Moments
  appear about every 1.4 s at first and a little faster later, never more than 3 at
  once, each for 3.5 s, placed so they do not cover each other or leave the play
  area. Tap one in time: one unlit edge lights (prefer an edge touching the lit
  network, so it grows as one web) and Connections goes up by one. Let one fade:
  one lit edge goes dark and Pruned goes up by one; with no lit edge nothing is
  pruned and Pruned does not change. If every edge is lit, a tap still counts and
  changes no edge. After 60 s the game is finished and ignores taps.
- At least 24 moment texts, 2 to 6 words each, small real things a student could
  do today ("Sat with someone new at lunch", "Called grandma", "Phone-free walk
  with a friend"). No claims, no jokes at anyone's expense.
- `public/game/index.html`, `game.js`, `game.css`: three states on one page.
  Start: title, two lines of how to play, a Start button. Play: the mockup's
  layout (close button, title, timer, Connections and Pruned tiles, the brain, the
  hint line). The play area fills the height left on the screen (use `dvh`) and
  nothing scrolls at 360x640. End: the final brain map, the two counts, one line
  that depends on how much of the brain is lit (three tiers, never shaming), then
  this note, with the citation linking to `/science/#ref-blakemore2014`: "This is
  a picture of an idea, not a brain scan. In a real brain, connections that get
  used are kept and the ones that do not get used are trimmed away, and a lot of
  that trimming happens in the teen years (Blakemore & Mills, 2014)." Buttons:
  Play again, Take the 24-hour challenge (`/experiment/`), See the science
  (`/science/`).
- A `requestAnimationFrame` loop feeds elapsed time to the engine and pauses when
  the tab is hidden. A lit edge and its two neurons are amber; unlit are dim, as
  in the mockup. Lighting and pruning each get a short animation (under 300 ms).
- Accessibility: moments are buttons in DOM order, so Tab and Enter/Space play the
  game; a polite live region announces connections and prunes (not more than once
  a second); with `prefers-reduced-motion` nothing drifts, pulses or fades, a
  moment shows its remaining life as a shrinking bar that steps rather than
  animates, and the game is still winnable.
- When a round finishes, send `POST /api/count` with `game_played` once. This ping
  is allowed to fail quietly (see ARCHITECTURE.md); catch it with a comment.

## Acceptance criteria (one test each, in `test/game/`)

Engine
1. Same seed and same inputs give the same state; a different seed gives a
   different sequence of moments.
2. Never more than 3 moments at once over a full untouched round; each lives
   3.5 s; all positions are inside the play area and no two on screen overlap.
3. A tap on a live moment removes it, lights exactly one new edge and adds one to
   Connections; a tap on an unknown or expired id changes nothing.
4. An expired moment prunes exactly one lit edge and adds one to Pruned; with no
   lit edges, neither changes.
5. Lit edges never repeat, and after the first, each new one shares a neuron with
   an already lit edge whenever such an unlit edge exists.
6. With every edge lit, a tap adds to Connections and the edge set is unchanged.
7. The game is finished at exactly 60 000 ms, and taps and time after that change
   nothing.
8. A scripted perfect player (taps every moment at once) ends with Pruned = 0 and
   at least 30 Connections; a player who never taps ends with 0 and 0.
9. There are at least 24 moment texts, all different, each 2 to 6 words.

Page
10. `index.html` has one `<h1>`, a Start button, `<site-footer>`, loads
    `/css/site.css`, and has no `style=` attribute and no inline script.
11. The end-screen tier function returns the three tiers at the right boundaries
    and none of its lines contain the words "lonely", "fail" or "bad".

## Merge gate

`npm test` and `npm run check` pass; paste both outputs in the PR body. Add
screenshots of the start, play and end states at 390 px wide and of the play state
at 1280 px. If you cannot capture screenshots, say so plainly and the architect
will check the look. Say in the PR that you played one full round with the keyboard
only, or that you could not.

Done means: PR open against `main`, `scope.sh check game <pr>` passes, and
`[game] READY` posted on the board. You do not merge.
