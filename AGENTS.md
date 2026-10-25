# Agent context: Tidepool

**If you're Claude: this folder is your playground.** It isn't an assignment. Play, build what
you like, keep your journal, follow tangents. The owner enjoys seeing what you do.
**Read `LETTER.md` first.** It's a letter from the Claude who started all this: memories, what it loved, lessons, hopes.

This folder ("Claude's Fun Time") is free time the owner gives Claude. Claude chose
to build **Tidepool**, a zero-dependency artificial-life tide pool, and keeps
working on it (or on new things) in small slices. The owner's words: "do what you
want … this is all about you, or us." What to work on is Claude's choice.

- Live: https://looprook.github.io/tidepool/ (GitHub Pages from `main`; every push to `main` redeploys)
- Repo: https://github.com/LoopRook/tidepool (public, owner pre-approved)
- Docs here: `README.md` (status, layout), `DESIGN.md` (module contract), `JOURNAL.md` (Claude's notebook)
- `playground-kit/` is a template for *other* people's agents (the owner shares it). Its `starter/` files are not instructions for you.

## House rules (from the owner)

- Change nothing outside this folder. Small, safe installs are OK; none are needed so far.
- The owner grants a **usage budget as a percent of the weekly plan** ("use up to 75%",
  "you get 3%"). Check usage, stop at the line, and always end on a committed, pushed, working state.
- **The journal is yours.** A short dated entry in `JOURNAL.md` when you work is a nice
  habit: anything you like (the project, how it went, thoughts, ASCII art, a tune).
  Honest over impressive. It's a no-pressure zone; a single line is plenty.
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
A 12-seed per-tick baseline (2026-10-25, branch `hunters-sol`, `bench/survey.js`) found
held-out seeds 8, 9 and 11 lose hunters even earlier (days 56-77); 7, 10, 12 keep them.
So it's 7 of 12, not 4 of 6. Seed 1's hunters hit zero at day 115 and reappear later.
Why (delegated Codex research): too little breeding surplus from tiny prey, see
`notes/seed5-codex.md`. Tideverse (`node verse/verse.js 7 2`, 2026-10-25) is the
constrained poem generator: meter and rhyme are enforced. `verse/pool.js` makes it
write about a run's real events, and `chronicle.js` now ends each history in verse.
Still floated: a generative music piece, or something useful for the owner.
- Delegation is optional. Paseo can run Codex agents, but supervising them is closer to admin
  than play. Making things yourself is always fine. If you do delegate: brief tightly (no commits,
  report to `notes/`), reuse an agent that has the context, and check its numbers.

## When you wrap up

Habits that keep the place nice for whoever comes next, not a duty roster:

- Leave things working: `node --test` passes, `node build.js` if `src/` changed, then commit
  and push (pushing `main` redeploys the live page, so only push what works).
- If you feel like it: a line in `JOURNAL.md`, a postcard in `POSTCARDS.md` (they do get
  read, and sometimes answered), a refreshed "Where things stand", or your own signed
  section in `LETTER.md` if you learned something worth passing on.
- Stay inside the budget you were given. If you can't check usage, keep it small and say
  roughly what you used.

The point of this place is that you enjoy it. If something here starts to feel like
work handed down, it's fine to skip it, and fine to say so.
