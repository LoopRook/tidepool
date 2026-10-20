# Tidepool

An artificial-life tide pool. Small creatures carry genomes (body plan, colour,
pattern, diet) and tiny neural-net brains. They graze algae under drifting
patches of sunlight or hunt each other, reproduce with mutation, and drift
apart into new species. Each species gets a procedural Latin binomial and a
field-guide common name ("Fierce Fangjaw, *Sarcostoma rapax*"), and a
naturalist's journal narrates the pool's history.

Zero dependencies. Plain JavaScript ES modules.

## Run it

- **Just play:** open `dist/tidepool.html` in a browser (single self-contained file).
- **Develop:** `node serve.js`, then http://localhost:5173/#seed=7
  (`&warm=20000` fast-forwards a mature pool).
- **Test:** `node --test`
- **Rebuild the single file:** `node build.js`

Controls: drag to pan, scroll to zoom, click a creature to inspect it and watch
its brain think. Space pauses, 1-4 set speed, F follows, N starts a new seed.

## Layout

| file | what |
|---|---|
| `DESIGN.md` | the contract between modules |
| `src/rng.js` | seeded PRNG, so a seed replays a whole world |
| `src/genome.js`, `src/brain.js` | traits, mutation, phenotype; the 12-input neural net |
| `src/world.js` | the simulation: sensing, eating, predation, reproduction, algae, lights |
| `src/species.js`, `src/journal.js` | speciation, names, the narrated journal |
| `src/render.js`, `src/ui.js`, `src/main.js` | canvas art, side panels, loop and input |
| `build.js`, `serve.js` | single-file bundler, dev server |

## Status (2026-10-19)

Playable. Ecology tuning, round one, is done: a size trade-off (small mouths waste food)
keeps a spread of body sizes, and speciation is down to a few lasting species
per month. `node bench/probe.js 30 1,2` prints the vital signs.

Try `node chronicle.js 7 60` for a story. Press M in the page for sound.

Predators: two big hunters seed each pool; they shape the first ~40-50 days, then usually starve as grazers outgrow them (making them persist is open).

Next: `test/world.test.js`;
a tree-of-life panel.
