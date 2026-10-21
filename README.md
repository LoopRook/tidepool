# Tidepool

**[Play it in your browser →](https://looprook.github.io/tidepool/)**  (press M for sound)

An artificial-life tide pool. Small creatures carry genomes (body plan, colour,
pattern, diet) and tiny neural-net brains. They graze algae under drifting
patches of sunlight or hunt each other, reproduce with mutation, and drift
apart into new species. Each species gets a procedural Latin binomial and a
field-guide common name ("Fierce Fangjaw, *Sarcostoma rapax*"), and a
naturalist's journal narrates the pool's history.

Zero dependencies. Plain JavaScript ES modules.

## Run it

- **Just play:** https://looprook.github.io/tidepool/ , or open `dist/tidepool.html` locally (single self-contained file).
- **Develop:** `node serve.js`, then http://localhost:5173/#seed=7
  (`&warm=20000` fast-forwards a mature pool).
- **Test:** `node --test`
- **Rebuild the single file:** `node build.js`

Controls: drag to pan, scroll to zoom, click a creature to inspect it and watch
its brain think. Space pauses, 1-4 set speed, F follows, S copies a link to this moment, N starts a new seed.

## Layout

| file | what |
|---|---|
| `DESIGN.md` | the contract between modules |
| `src/rng.js` | seeded PRNG, so a seed replays a whole world |
| `src/genome.js`, `src/brain.js` | traits, mutation, phenotype; the 12-input neural net |
| `src/world.js` | the simulation: sensing, eating, predation, reproduction, algae, lights |
| `src/species.js`, `src/journal.js` | speciation, names, the narrated journal |
| `src/render.js`, `src/ui.js`, `src/main.js` | canvas art, side panels, loop and input |
| `src/sound.js`, `src/phylo.js`, `src/tree.js` | the pool's voice; tree-of-life layout and panel |
| `chronicle.js` | headless run that writes a pool's natural history |
| `build.js`, `serve.js` | single-file bundler, dev server |

## Status (2026-10-20)

Playable, with sound (press M), a tree-of-life panel, and `node chronicle.js 7 60`
for a pool's written history.

Ecology: a size trade-off (small mouths waste food) keeps a spread of body sizes,
and speciation runs at a few lasting species per month. Two big hunters seed each
pool. Newborns hatch at under half their adult size and grow up over a day and a
half, so even a pool of giants feeds its hunters; snacks digest faster than full
meals. Hunters last all 150 days on seeds 2, 3, 4 and 6, and to days 115 and 106 on
seeds 1 and 5. `node bench/probe.js 100 1,2,3` prints the vital signs,
`node bench/hunters.js 100 3` the predator-prey detail.

**Share a moment:** press S (or Share) to copy a link like `#seed=7&t=6000&fish=576`.
The sim uses its own exact maths (`src/dmath.js`), so the link replays the same pool,
to the same tick, with the same fish selected, in any browser.

Open: hunters still die out in some pools. `notes/seed5-codex.md` (delegated research)
finds they run short of breeding surplus on tiny prey, not short of catches.
