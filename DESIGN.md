# Tidepool: design contract

Tidepool is an artificial-life tide pool that runs in the browser. Creatures carry
genomes (body traits + neural-net weights), sense their surroundings, think with
a tiny brain, swim, eat algae or each other, reproduce with mutation, and drift
apart into new species. Each species gets a procedural Latin binomial, and a
naturalist's journal narrates notable events.

This file is the contract between modules. **Code against these interfaces
exactly.** If something here is impossible, note it in your final report instead
of silently changing it.

## Ground rules

- Zero dependencies. Plain modern JavaScript (ES2022), ES modules.
- Core modules (`rng`, `genome`, `brain`, `species`, `journal`, `world`) must run
  in Node *and* the browser: no DOM, no `window`, no Node built-ins.
- **Module style (the bundler relies on it):**
  - Imports are only `import { a, b } from './file.js';` on a single line.
  - Exports are only `export function name`, `export const name`, `export class Name`.
    No default exports, no `export { ... }` lists, no `import * as`, no re-exports.
  - Don't reuse another module's exported names for your own top-level names.
- All randomness comes from an `rng` passed in (see `src/rng.js`). Never call `Math.random()`.
- Simulation code (world, brain, rng, genome, species) uses `src/dmath.js` instead of
  `Math.sin/cos/atan2/log/exp/tanh/pow`, whose last bits differ between JS engines.
  Only `+ - * /`, `sqrt`, `floor`/`round` and friends are exact everywhere. This is what
  makes a seed (and a shared `#seed=S&t=T&fish=ID` link) replay identically in any browser.
- Tests use `node:test` + `node:assert/strict`, live in `test/<module>.test.js`,
  run with `node --test` from the repo root. `package.json` has `"type": "module"`.
- Comments: brief, explain *why*. No essays.

## Coordinates and time

- World is a bounded rectangle, `width` x `height` (default 1600 x 1000) in world units.
  Walls are solid: a creature hitting a wall is clamped inside and its angle reflected.
- `angle` is radians, 0 = +x, increasing toward +y (canvas convention, y points down).
- One `step(world)` = one tick. The UI runs ~60 ticks/sec at 1x speed.
- `DAY = 600` ticks (exported from `world.js`). The journal speaks in days.

## `src/rng.js` (done)

`makeRng(seed) -> { next(), int(n), range(a,b), chance(p), pick(arr), gauss(), fork(), state }`

## `src/genome.js`

```js
export const TRAITS        // array of trait names, e.g. ['size','speed','sense','hue',...]
export function randomGenome(rng) -> Genome
export function mutate(genome, rng, strength = 1) -> Genome      // new object, never mutates input
export function crossover(a, b, rng) -> Genome
export function distance(a, b) -> number                        // >= 0, symmetric, 0 for identical
export function express(genome) -> Phenotype                    // pure, deterministic
```

`Genome = { traits: { [name]: number in [0,1] }, weights: number[] }`
`weights.length === weightCount()` from `brain.js`. Genomes must survive
`JSON.parse(JSON.stringify(g))` unchanged (plain arrays, no typed arrays).

`distance` should weigh visible traits much more than brain weights, and be tuned
so that a single `mutate` usually gives distance < 0.05 and two unrelated random
genomes are typically around 0.3 to 0.6. Species split at `SPECIES_THRESHOLD = 0.12`
(exported from `species.js`).

Required traits (at least): `size, speed, sense, hue, saturation, diet, fins,
aspect, pattern, patternHue, tail, fertility, longevity`. Add more if you like.

`Phenotype` (all fields required, renderer and world read them):

| field | range | meaning |
|---|---|---|
| `radius` | 3..14 | body radius (world units) |
| `maxSpeed` | 0.6..3.2 | units/tick at thrust 1 |
| `turnRate` | 0.04..0.25 | radians/tick at turn output +-1 (smaller bodies turn faster) |
| `senseRange` | 30..170 | perception radius |
| `hue` | 0..360 | body hue |
| `saturation` | 35..95 | percent |
| `lightness` | 40..72 | percent |
| `diet` | 0..1 | 0 pure grazer, 1 pure predator |
| `finCount` | integer 0..4 | pairs of side fins |
| `bodyAspect` | 1..2.4 | length / width of the body ellipse |
| `pattern` | `'plain' \| 'spots' \| 'stripes' \| 'bands'` | skin pattern |
| `patternHue` | 0..360 | pattern colour hue |
| `tailLength` | 0.4..1.6 | tail length as multiple of radius |
| `maxEnergy` | number | grows with radius^2 |
| `reproduceAt` | 0.55..0.95 | reproduce when `energy >= reproduceAt * maxEnergy` |
| `litterSize` | integer 1..3 | children per reproduction (energy split) |
| `lifespan` | 3000..14000 | ticks before old-age death |
| `metabolism` | number | energy burned per tick at rest; grows with radius^2, senseRange |

Trade-offs matter more than exact numbers: big = more energy and can eat smaller
things but slower and hungrier; fast = costs energy to move; predators digest
algae poorly; long senses cost energy.

## `src/brain.js`

```js
export const INPUTS   // array of input names, length = INPUT_COUNT
export const OUTPUTS  // ['turn', 'thrust', 'bite']
export const HIDDEN   // hidden layer size (e.g. 8)
export function weightCount() -> number
export function makeBrain(weights) -> { think(inputs) -> [turn, thrust, bite] }
```

One hidden layer, tanh, with bias. Outputs: `turn` in [-1, 1], `thrust` in [0, 1],
`bite` in [0, 1]. `think` must not allocate per call beyond what's unavoidable
(it runs hundreds of times per tick; reuse buffers).

Inputs (in this order; the world builds this array):

1. `foodAngle`: signed angle to nearest food, relative to heading, divided by PI (-1..1), 0 if none
2. `foodDist`: 1 - dist/senseRange (0 if none)
3. `preyAngle`: relative angle to nearest creature that is smaller (radius < 0.8x own), /PI
4. `preyDist`: 1 - dist/senseRange, 0 if none
5. `threatAngle`: relative angle to nearest creature that is bigger (radius > 1.25x own) and has diet > 0.5, /PI
6. `threatDist`: 1 - dist/senseRange, 0 if none
7. `kinAngle`: relative angle to nearest same-species creature, /PI
8. `kinDist`
9. `energy`: energy / maxEnergy
10. `wall`: 1 - (distance to nearest wall / senseRange), clamped to [0,1]
11. `clock`: sin(age * 0.05), an internal oscillator
12. `bias`: always 1

`randomGenome` weights should give *some* sensible behaviour by chance. Seed
initial random weights with a small hand-built prior (e.g. turn toward
`foodAngle`, positive thrust bias) plus noise, so generation 0 isn't hopeless.

## `src/species.js`

```js
export const SPECIES_THRESHOLD = 0.12
export function createRegistry(rng) -> Registry
export function binomialName(rng, pheno) -> { genus, epithet, common }
```

```js
Registry = {
  found(genome, pheno, tick, parentId = null) -> Species,
  classify(genome, pheno, parentSpeciesId, tick) -> { id, isNew },
  census(creatures, tick) -> Event[],   // updates population/peak, returns extinction events
  get(id) -> Species | undefined,
  all() -> Species[],                   // in founding order
  living() -> Species[],                // population > 0 or not yet censused since founding
}

Species = {
  id,                 // small integer, 1, 2, 3...
  name: { genus, epithet, common },   // e.g. { genus:'Velocipinna', epithet:'rubra', common:'Crimson Dartfin' }
  hue,                // representative body hue, for charts
  founderTick, parentId, // parentId null for originals
  representative,     // the founder genome (fixed)
  population, peakPopulation, totalBorn,
  extinctTick,        // null while alive
}
```

`classify`: compute `distance(genome, parent.representative)`. If below the
threshold, return the parent species. Otherwise found a new species with
`parentId = parentSpeciesId` and return `{ id, isNew: true }`. Increments `totalBorn`.

`binomialName` builds names from the phenotype: genus from body plan (size,
speed, diet, fins; Latin/Greek roots like *Velo-*, *Magno-*, *Carno-*, *-pinna*,
*-ichthys*, *-cauda*), epithet from colour/pattern (*rubra*, *caerulea*,
*maculata*, *striata*...), common name the same idea in English ("Spotted
Glimmerfin", "Crimson Dartfin"). Names should be varied and fun, and two species
should rarely collide (append a variation or a Roman numeral if a full name repeats).

Extinction: `census` sets `extinctTick` the first time a species that has existed
for at least 1 tick has population 0, and emits `{ type:'extinction', tick, speciesId }`.

## `src/journal.js`

```js
export function narrate(event, world) -> string | null
```

Turns events into a naturalist's journal line, e.g.
`"Day 14. A new form has appeared: the Banded Glimmerfin (Lucipinna fasciata), descended from the Crimson Dartfin."`
Return `null` for events not worth a line (most births and deaths). Vary the phrasing
(several templates per event type, chosen with a deterministic hash of the event so
it doesn't need rng). Notable things: speciation, extinction, a species reaching a
new population record at milestones (25, 50, 100), the oldest creature dying of old
age, a predator's first kill in a species, a population crash.

## `src/world.js`

```js
export const DAY = 600
export function createWorld(options = {}) -> World
export function step(world)
export function findCreatureAt(world, x, y, slop = 6) -> Creature | null
export function spawnCreature(world, genome, x, y, parent = null) -> Creature
```

`options`: `{ width=1600, height=1000, seed=1, initialCreatures=60, initialSpecies=6, maxFood=700, foodRate=3.5, maxCreatures=600 }`.
`initialSpecies` random founder genomes; initial creatures are mutated copies of them.

```js
World = {
  width, height, tick, seed, rng, config,
  creatures: Creature[],     // only living creatures (dead are removed each tick)
  food: Food[],
  lights: Light[],           // drifting sunlit patches where algae grows
  species: Registry,
  events: Event[],           // ring buffer, last 300 events
  eventSeq: number,          // total events ever emitted; UI tracks what it has seen
  history: Sample[],         // every 30 ticks, capped at 800 samples
  stats: { births, deaths, predations, generationMax },
}

Creature = {
  id, genome, pheno, brain,
  x, y, angle, speed,         // speed = current units/tick
  energy, age, generation,
  parentId, speciesId,
  alive,
  outputs: [turn, thrust, bite],   // last brain output, renderer animates tail with thrust
  inputs: number[],                // last sensory input, inspector visualises it
  kills, children,
  phase,                           // random 0..2PI, animation offset
  causeOfDeath: null | 'starvation' | 'old age' | 'eaten',
}

Food = { x, y, energy }          // algae pellet
Light = { x, y, r, vx, vy }      // drifting patch; algae spawns inside lights more often
Sample = { tick, population, food, bySpecies: { [speciesId]: count } }

Event = { seq, tick, type, ... }  // types below
```

Event types: `birth {creatureId, parentId, speciesId}`, `death {creatureId, speciesId, cause, age}`,
`predation {predatorId, preyId, predatorSpecies, preySpecies}`, `speciation {speciesId, parentId}`,
`extinction {speciesId}`, `milestone {speciesId, population}`.
Every event gets `seq` (= world.eventSeq after increment) and `tick`.

Simulation rules (tune freely, but keep these behaviours):

- Use a uniform spatial grid (cell ~64) rebuilt each tick for neighbour queries.
- Sense -> think -> act: turn by `outputs.turn * turnRate`, speed = thrust * maxSpeed, move.
- Energy cost per tick: `metabolism + k * speed^2 * radius`; biting costs a little.
- Grazing: touching food eats it, gain `food.energy * (1 - diet)^1.5`-ish.
- Predation: if `bite > 0.5`, `diet > 0.35` and touching a creature whose radius is
  < 0.85x own, kill it and gain `prey.energy * 0.4 + prey.radius^2 * c` scaled by `diet`.
  Never eat same species unless starving (energy < 15%). Sizes here are the current
  body radius: newborns hatch at 45% of adult radius and grow to full size over
  900 ticks, so hunters can always take the young. After a kill a predator digests
  for up to 200 ticks, scaled down for meals worth less than 40% of its max energy.
- Reproduction: when energy >= `reproduceAt * maxEnergy` and age > some minimum, split:
  parent keeps ~45%, the rest is divided among `litterSize` children (with some loss).
  Child genome = `mutate(parent.genome)`, or with small chance `crossover` with a
  nearby kin then mutate. Classify via registry. Emit birth (+ speciation if new).
- Death: energy <= 0 (starvation), age > lifespan (old age), eaten. Dead creatures
  leave a little food behind.
- Algae: up to `maxFood`, ~`foodRate` new pellets per tick, mostly inside lights.
  Lights drift slowly and bounce off walls.
- Population safety: if all creatures die, reseed 20 from the living-species
  representatives (or fresh random genomes) and keep going; if creatures exceed
  `maxCreatures`, block reproduction.
- `registry.census` every 30 ticks, at the same time as the history sample.
- Must be fast: 400 creatures + 700 food should step well under 4 ms in Node.

## Browser (`index.html`, `src/render.js`, `src/ui.js`, `src/main.js`, `style.css`)

```js
// render.js
export function createRenderer(canvas) -> {
  draw(world, view, selectedId),
  screenToWorld(view, sx, sy) -> { x, y },
  fitView(world) -> View,       // view that fits the whole pool in the canvas
}
View = { scale, ox, oy }        // screen = (world - o) * scale ... document your choice
```

- Underwater look: deep teal gradient, soft animated caustic light, lights as warm
  glowing patches, algae as small green-gold glints.
- Creatures drawn from phenotype: ellipse body (`radius`, `bodyAspect`), tail that
  wiggles with `outputs[1]`, `finCount` fin pairs, pattern overlay, eye. Predators
  (`diet > 0.5`) look a bit sharper (pointed snout / darker outline). Selected
  creature gets a ring and its sense radius.
- Must stay smooth at 400 creatures (avoid per-frame allocations, skip pattern
  detail when zoomed out).

`main.js` wires it together: reads `#seed=N` from the URL, creates the world,
runs the loop (pause, 1x/4x/16x/64x speed), pan by drag, zoom by wheel, click to
select a creature. `ui.js` builds the side panels:

- **Inspector**: selected creature's common + Latin name, species, generation,
  age (days), energy bar, kills/children, a live picture of its brain
  (inputs -> outputs with weight lines coloured by sign).
- **Field guide**: list of species, living first, with a little rendered portrait,
  population, and "extinct day N" for dead ones; click to follow its largest member.
- **Population chart**: stacked area by species over `world.history`, species hue.
- **Journal**: newest-first journal lines from `narrate()` for new events.
- Controls: pause/play, speed, new seed, "follow selected" toggle.

## Build

`node build.js` bundles `src/main.js` and its imports into `dist/tidepool.html`
(single file, inline CSS + JS). `node serve.js` serves the repo on
http://localhost:5173 for development.
