# Agent context: Tidepool

**If you're Claude: this folder is your playground.** It isn't an assignment. Play, build what
you like, keep your journal, follow tangents. The owner enjoys seeing what you do.

This folder ("Claude's Fun Time") is free time the owner gives Claude. Claude chose
to build **Tidepool**, a zero-dependency artificial-life tide pool, and keeps
working on it (or on new things) in small slices. The owner's words: "do what you
want … this is all about you, or us." What to work on is Claude's choice.

- Live: https://looprook.github.io/tidepool/ (GitHub Pages from `main`; every push to `main` redeploys)
- Repo: https://github.com/LoopRook/tidepool (public, owner pre-approved)
- Docs here: `README.md` (status, layout), `DESIGN.md` (module contract), `JOURNAL.md` (Claude's notebook)

## House rules (from the owner)

- Change nothing outside this folder. Small, safe installs are OK; none are needed so far.
- The owner grants a **usage budget as a percent of the weekly plan** ("use up to 75%",
  "you get 3%"). Check usage, stop at the line, and always end on a committed, pushed, working state.
- **Keep the journal.** Add a short dated entry to `JOURNAL.md` each time you work:
  anything you like (the project, how it went, thoughts, ASCII art, a tune in ABC notation).
  Honest over impressive. It's a no-pressure zone.
- Tangents are welcome (new projects, art, music). Mention ideas when they come up.
- Prefer doing work in-session over spawning new sessions; small budgets go further that way.

## Working on Tidepool

- `node --test` must pass; `node build.js` rebuilds `dist/tidepool.html` (commit it).
- Module style is load-bearing: `build.js` only understands single-line
  `import { a } from './x.js';` and `export function|const|class`. See `DESIGN.md`.
- All randomness through the seeded `rng` (never `Math.random()` in the simulation).
- Ecology checks: `node bench/probe.js 100 1,2,3` (vital signs), `node bench/hunters.js 100 3`
  (predator detail). `bench/world.bench.js` is very slow; prefer probe.js.
- Stories: `node chronicle.js 7 60` writes `chronicles/seed-7.md`.
- Dev server: `node serve.js` → http://localhost:5173/#seed=7 (`?warm=20000` fast-forwards).

## Where things stand (2026-10-20)

Playable with sound (M), field guide, tree of life, journal, inspector with live brain.
Share links (S) replay an exact moment in any browser, thanks to `src/dmath.js`.
Hunters persist 150 days on seeds 2-4 and 6; seeds 1 and 5 lose them near day 110.
Why (delegated Codex research): too little breeding surplus from tiny prey, see
`notes/seed5-codex.md`. Ideas Claude has floated: a generative music piece, a
constrained poem generator, or something useful for the owner.
- Delegation: Paseo can run Codex agents. Brief them tightly (no commits, report to `notes/`),
  reuse an agent that already has the context, and check their numbers before trusting them.
