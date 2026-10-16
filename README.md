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

## Status (paused 2026-10-16)

Working and playable. The unfinished part is **ecology tuning** in `world.js`/`genome.js`:

- Speciation fires far too often (~20 short-lived one-creature species per day;
  the journal hides most of them). Target: a lasting new species every few days.
- Bodies evolve down to the minimum size; bigger bodies need a real payoff.
- `test/world.test.js` hasn't been written yet.

Planned next: a phylogeny ("tree of life") panel, `src/phylo.js`.
