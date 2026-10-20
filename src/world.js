// The tide pool simulation: sensing, thinking, swimming, eating, breeding, dying.
// Everything here is deterministic given the seed (all randomness via world.rng).
import { makeRng } from './rng.js';
import { randomGenome, mutate, crossover, distance, express } from './genome.js';
import { makeBrain, INPUTS } from './brain.js';
import { createRegistry, SPECIES_THRESHOLD } from './species.js';

export const DAY = 600;

// Ecology constants. Tuned with bench/world.bench.js; see the report there.
export const ECOLOGY = {
  cell: 64,
  foodEnergy: [7, 12],    // pellet energy range
  lightShare: 0.85,       // fraction of algae that sprouts inside a light
  moveCost: 0.0016,       // * speed^2 * radius
  biteCost: 0.012,        // * bite, per tick
  grazeExponent: 1.5,     // gain = food * (1 - diet)^k * mouth
  mouthBase: 0.4,         // mouth = min(max, base + perRadius * radius)
  mouthPerRadius: 0.08,
  mouthMax: 1.25,
  preyBodyValue: 1.6,     // * prey radius^2
  preyEnergyShare: 0.4,
  digestTicks: 200,       // a predator can't bite again right after a kill
  minBreedAge: 240,
  parentKeeps: 0.45,
  birthLoss: 0.15,
  crossoverChance: 0.15,
  mutationStrength: 0.6,
  starvingFraction: 0.15, // below this energy share, cannibalism is allowed
};

const EVENT_CAP = 300;
const HISTORY_CAP = 800;
const SAMPLE_EVERY = 30;
const MILESTONES = [25, 50, 100, 200];
const TAU = Math.PI * 2;

// Uniform grid rebuilt every tick with a counting sort: no per-tick allocation
// once the item buffer has grown to fit.
class CellGrid {
  constructor(width, height, size) {
    this.size = size;
    this.cols = Math.max(1, Math.ceil(width / size));
    this.rows = Math.max(1, Math.ceil(height / size));
    const n = this.cols * this.rows;
    this.start = new Int32Array(n + 1);
    this.fill = new Int32Array(n);
    this.items = new Int32Array(1024);
    this.cellOf = new Int32Array(1024);
  }
  cx(x) { const c = (x / this.size) | 0; return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c; }
  cy(y) { const c = (y / this.size) | 0; return c < 0 ? 0 : c >= this.rows ? this.rows - 1 : c; }
  build(list) {
    const n = list.length;
    if (n > this.items.length) {
      const cap = Math.max(n, this.items.length * 2);
      this.items = new Int32Array(cap);
      this.cellOf = new Int32Array(cap);
    }
    const { start, fill, items, cellOf, cols } = this;
    start.fill(0);
    for (let i = 0; i < n; i++) {
      const o = list[i];
      const c = this.cy(o.y) * cols + this.cx(o.x);
      cellOf[i] = c;
      start[c + 1]++;
    }
    for (let c = 0; c < fill.length; c++) { start[c + 1] += start[c]; fill[c] = start[c]; }
    for (let i = 0; i < n; i++) items[fill[cellOf[i]]++] = i;
  }
}

function emit(world, ev) {
  world.eventSeq++;
  ev.seq = world.eventSeq;
  ev.tick = world.tick;
  world.events.push(ev);
  if (world.events.length > EVENT_CAP) world.events.shift();
  return ev;
}

function addFood(world, x, y, energy) {
  world.food.push({ x, y, energy });
}

function sproutAlgae(world) {
  const { rng, width, height } = world;
  const [emin, emax] = ECOLOGY.foodEnergy;
  let x, y;
  if (world.lights.length && rng.next() < ECOLOGY.lightShare) {
    const L = world.lights[rng.int(world.lights.length)];
    const a = rng.next() * TAU, d = Math.sqrt(rng.next()) * L.r;
    x = L.x + Math.cos(a) * d;
    y = L.y + Math.sin(a) * d;
    if (x < 2 || x > width - 2 || y < 2 || y > height - 2) return;
  } else {
    x = rng.range(2, width - 2);
    y = rng.range(2, height - 2);
  }
  addFood(world, x, y, rng.range(emin, emax));
}

function makeLights(world) {
  const { rng, width, height } = world;
  const count = 3 + rng.int(2);
  for (let i = 0; i < count; i++) {
    const r = rng.range(110, 190);
    const a = rng.next() * TAU, s = rng.range(0.12, 0.3);
    world.lights.push({
      x: rng.range(r, width - r), y: rng.range(r, height - r), r,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
    });
  }
}

function driftLights(world) {
  for (const L of world.lights) {
    L.x += L.vx; L.y += L.vy;
    if (L.x < L.r * 0.5) { L.x = L.r * 0.5; L.vx = Math.abs(L.vx); }
    if (L.x > world.width - L.r * 0.5) { L.x = world.width - L.r * 0.5; L.vx = -Math.abs(L.vx); }
    if (L.y < L.r * 0.5) { L.y = L.r * 0.5; L.vy = Math.abs(L.vy); }
    if (L.y > world.height - L.r * 0.5) { L.y = world.height - L.r * 0.5; L.vy = -Math.abs(L.vy); }
  }
}

// Create a creature already assigned to a species (no classification, no events).
function addCreature(world, genome, x, y, speciesId, parent) {
  const pheno = express(genome);
  const rng = world.rng;
  const c = {
    id: world.nextId++,
    genome, pheno,
    brain: makeBrain(genome.weights),
    x: Math.min(world.width - pheno.radius, Math.max(pheno.radius, x)),
    y: Math.min(world.height - pheno.radius, Math.max(pheno.radius, y)),
    angle: rng.next() * TAU,
    speed: 0,
    energy: pheno.maxEnergy * 0.5,
    age: 0,
    generation: parent ? parent.generation + 1 : 0,
    parentId: parent ? parent.id : null,
    speciesId,
    alive: true,
    outputs: [0, 0, 0],
    inputs: new Array(INPUTS.length).fill(0),
    kills: 0,
    children: 0,
    phase: rng.next() * TAU,
    causeOfDeath: null,
    cooldown: 0, // ticks until a predator may bite again
  };
  world.creatures.push(c);
  if (c.generation > world.stats.generationMax) world.stats.generationMax = c.generation;
  return c;
}

export function spawnCreature(world, genome, x, y, parent = null) {
  const reg = world.species;
  let speciesId;
  if (parent) {
    // A drifting population tends to cross the threshold many times at once. If a
    // sister lineage already split off and this child fits it, join that instead
    // of founding yet another near-identical species.
    let target = parent.speciesId;
    const home = reg.get(target);
    if (home && distance(genome, home.representative) >= SPECIES_THRESHOLD) {
      const daughters = world._daughters.get(target);
      if (daughters) {
        for (const id of daughters) {
          const d = reg.get(id);
          if (d && d.extinctTick === null && distance(genome, d.representative) < SPECIES_THRESHOLD) { target = id; break; }
        }
      }
    }
    const res = reg.classify(genome, express(genome), target, world.tick);
    speciesId = res.id;
    if (res.isNew) {
      if (!world._daughters.has(target)) world._daughters.set(target, []);
      world._daughters.get(target).push(speciesId);
      emit(world, { type: 'speciation', speciesId, parentId: target });
    }
  } else {
    // No parent: join the closest living species if it's close enough, else found one.
    let best = null, bestD = SPECIES_THRESHOLD;
    for (const sp of reg.living()) {
      const d = distance(genome, sp.representative);
      if (d < bestD) { bestD = d; best = sp; }
    }
    if (best) {
      speciesId = best.id;
      best.totalBorn++;
    } else {
      const sp = reg.found(genome, express(genome), world.tick, null);
      sp.totalBorn = 1;
      speciesId = sp.id;
      emit(world, { type: 'speciation', speciesId, parentId: null });
    }
  }
  const c = addCreature(world, genome, x, y, speciesId, parent);
  if (parent) {
    parent.children++;
    world.stats.births++;
    emit(world, { type: 'birth', creatureId: c.id, parentId: parent.id, speciesId });
  }
  return c;
}

export function createWorld(options = {}) {
  const config = {
    width: 1600, height: 1000, seed: 1, initialCreatures: 60, initialSpecies: 6, initialPredators: 2,
    maxFood: 700, foodRate: 3.5, maxCreatures: 600, ...options,
  };
  const rng = makeRng(config.seed);
  const world = {
    width: config.width, height: config.height, tick: 0, seed: config.seed, rng, config,
    creatures: [], food: [], lights: [],
    species: createRegistry(rng.fork()),
    events: [], eventSeq: 0, history: [],
    stats: { births: 0, deaths: 0, predations: 0, generationMax: 0 },
    nextId: 1,
    // internals: grids, fractional algae accumulator, milestones already announced
    _grid: new CellGrid(config.width, config.height, ECOLOGY.cell),
    _foodGrid: new CellGrid(config.width, config.height, ECOLOGY.cell),
    _foodAcc: 0,
    _milestones: new Map(),
    _daughters: new Map(), // speciesId -> ids of species that split from it
  };
  makeLights(world);
  for (let i = 0; i < config.maxFood * 0.6; i++) sproutAlgae(world);

  const founders = [];
  for (let i = 0; i < config.initialSpecies; i++) {
    const g = randomGenome(rng, i < config.initialPredators ? 'predator' : 'grazer');
    const sp = world.species.found(g, express(g), 0, null);
    founders.push(sp);
  }
  for (let i = 0; i < config.initialCreatures && founders.length; i++) {
    const sp = founders[i % founders.length];
    sp.totalBorn++;
    addCreature(world, mutate(sp.representative, rng, 0.5), rng.range(20, config.width - 20), rng.range(20, config.height - 20), sp.id, null);
  }
  sample(world);
  return world;
}

function reseed(world) {
  const { rng } = world;
  // Restock mostly grazers plus a few hunters: reseeding from whatever survived
  // can refill a hunters-only pool with hunters, which starve and loop forever.
  const living = world.species.living();
  const grazers = living.filter((s) => s.pheno ? s.pheno.diet <= 0.5 : true);
  const hunters = living.filter((s) => s.pheno && s.pheno.diet > 0.5);
  for (let i = 0; i < 20; i++) {
    const pool = i < 3 ? hunters : grazers;
    const g = pool.length ? mutate(pool[i % pool.length].representative, rng, 0.5) : randomGenome(rng, i < 3 ? 'predator' : 'grazer');
    const c = spawnCreature(world, g, rng.range(20, world.width - 20), rng.range(20, world.height - 20));
    c.energy = c.pheno.maxEnergy * 0.7;
  }
}

function sample(world) {
  const bySpecies = {};
  for (const c of world.creatures) bySpecies[c.speciesId] = (bySpecies[c.speciesId] || 0) + 1;
  world.history.push({ tick: world.tick, population: world.creatures.length, food: world.food.length, bySpecies });
  if (world.history.length > HISTORY_CAP) world.history.shift();
}

function census(world) {
  for (const ev of world.species.census(world.creatures, world.tick)) {
    emit(world, { type: ev.type, speciesId: ev.speciesId });
  }
  for (const sp of world.species.living()) {
    let reached = 0;
    for (const m of MILESTONES) if (sp.population >= m) reached = m;
    if (reached > (world._milestones.get(sp.id) || 0)) {
      world._milestones.set(sp.id, reached);
      emit(world, { type: 'milestone', speciesId: sp.id, population: reached });
    }
  }
}

function relAngle(dx, dy, heading) {
  let a = Math.atan2(dy, dx) - heading;
  a -= TAU * Math.floor((a + Math.PI) / TAU);
  return a / Math.PI;
}

function die(world, c, cause) {
  c.alive = false;
  c.causeOfDeath = cause;
  world.stats.deaths++;
  emit(world, { type: 'death', creatureId: c.id, speciesId: c.speciesId, cause, age: c.age });
  // Carcasses feed the algae-eaters; eaten bodies leave only scraps.
  const left = cause === 'eaten' ? 0.25 : 1;
  const r = c.pheno.radius;
  const e = (4 + r * r * 0.12 + Math.max(0, c.energy) * 0.2) * left;
  if (e > 2 && world.food.length < world.config.maxFood + 150) addFood(world, c.x, c.y, e);
}

function sense(world, c, inp, out) {
  const { creatures, food, _grid: grid, _foodGrid: fgrid } = world;
  const p = c.pheno;
  const R = p.senseRange, R2 = R * R;
  const x = c.x, y = c.y;
  const x0 = fgrid.cx(x - R), x1 = fgrid.cx(x + R), y0 = fgrid.cy(y - R), y1 = fgrid.cy(y + R);
  const cols = fgrid.cols;

  let bestF = R2, fx = 0, fy = 0, hasF = false;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const cell = gy * cols + gx;
      for (let k = fgrid.start[cell], e = fgrid.start[cell + 1]; k < e; k++) {
        const f = food[fgrid.items[k]];
        if (f.energy <= 0) continue;
        const dx = f.x - x, dy = f.y - y, d2 = dx * dx + dy * dy;
        if (d2 < bestF) { bestF = d2; fx = dx; fy = dy; hasF = true; }
      }
    }
  }

  const r = p.radius, preyMax = r * 0.8, threatMin = r * 1.25;
  let bestP = R2, px = 0, py = 0, hasP = false;
  let bestT = R2, tx = 0, ty = 0, hasT = false;
  let bestK = R2, kx = 0, ky = 0, kin = null;
  const n = grid.start[grid.start.length - 1];
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const cell = gy * cols + gx;
      for (let k = grid.start[cell], e = grid.start[cell + 1]; k < e; k++) {
        const idx = grid.items[k];
        if (idx >= n) continue;
        const o = creatures[idx];
        if (o === c || !o.alive) continue;
        const dx = o.x - x, dy = o.y - y, d2 = dx * dx + dy * dy;
        if (d2 >= R2) continue;
        const or = o.pheno.radius;
        if (or < preyMax) { if (d2 < bestP) { bestP = d2; px = dx; py = dy; hasP = true; } }
        else if (or > threatMin && o.pheno.diet > 0.5) { if (d2 < bestT) { bestT = d2; tx = dx; ty = dy; hasT = true; } }
        if (o.speciesId === c.speciesId && d2 < bestK) { bestK = d2; kx = dx; ky = dy; kin = o; }
      }
    }
  }

  const h = c.angle;
  inp[0] = hasF ? relAngle(fx, fy, h) : 0;
  inp[1] = hasF ? 1 - Math.sqrt(bestF) / R : 0;
  inp[2] = hasP ? relAngle(px, py, h) : 0;
  inp[3] = hasP ? 1 - Math.sqrt(bestP) / R : 0;
  inp[4] = hasT ? relAngle(tx, ty, h) : 0;
  inp[5] = hasT ? 1 - Math.sqrt(bestT) / R : 0;
  inp[6] = kin ? relAngle(kx, ky, h) : 0;
  inp[7] = kin ? 1 - Math.sqrt(bestK) / R : 0;
  inp[8] = c.energy / p.maxEnergy;
  const wd = Math.min(x, y, world.width - x, world.height - y);
  const w = 1 - wd / R;
  inp[9] = w < 0 ? 0 : w > 1 ? 1 : w;
  inp[10] = Math.sin(c.age * 0.05);
  inp[11] = 1;
  out.kin = kin;
}

function graze(world, c) {
  const { food, _foodGrid: g } = world;
  const r = c.pheno.radius + 2;
  // Small mouths waste part of each pellet; without this, tiny fast breeders always win.
  const mouth = Math.min(ECOLOGY.mouthMax, ECOLOGY.mouthBase + ECOLOGY.mouthPerRadius * c.pheno.radius);
  const eff = Math.pow(1 - c.pheno.diet, ECOLOGY.grazeExponent) * mouth;
  const x0 = g.cx(c.x - r), x1 = g.cx(c.x + r), y0 = g.cy(c.y - r), y1 = g.cy(c.y + r);
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const cell = gy * g.cols + gx;
      for (let k = g.start[cell], e = g.start[cell + 1]; k < e; k++) {
        const f = food[g.items[k]];
        if (f.energy <= 0) continue;
        const dx = f.x - c.x, dy = f.y - c.y;
        if (dx * dx + dy * dy < r * r) {
          c.energy += f.energy * eff;
          f.energy = 0;
        }
      }
    }
  }
}

function hunt(world, c) {
  const { creatures, _grid: g } = world;
  const p = c.pheno;
  const reach = p.radius + 14 * 0.85;
  const starving = c.energy < p.maxEnergy * ECOLOGY.starvingFraction;
  const n = g.start[g.start.length - 1];
  const x0 = g.cx(c.x - reach), x1 = g.cx(c.x + reach), y0 = g.cy(c.y - reach), y1 = g.cy(c.y + reach);
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const cell = gy * g.cols + gx;
      for (let k = g.start[cell], e = g.start[cell + 1]; k < e; k++) {
        const idx = g.items[k];
        if (idx >= n) continue;
        const o = creatures[idx];
        if (o === c || !o.alive) continue;
        const or = o.pheno.radius;
        if (or >= p.radius * 0.85) continue;
        if (o.speciesId === c.speciesId && !starving) continue;
        const dx = o.x - c.x, dy = o.y - c.y, rr = p.radius + or;
        if (dx * dx + dy * dy > rr * rr) continue;
        const gain = (Math.max(0, o.energy) * ECOLOGY.preyEnergyShare + or * or * ECOLOGY.preyBodyValue) * p.diet;
        c.energy += gain;
        c.kills++;
        c.cooldown = ECOLOGY.digestTicks;
        world.stats.predations++;
        emit(world, { type: 'predation', predatorId: c.id, preyId: o.id, predatorSpecies: c.speciesId, preySpecies: o.speciesId });
        die(world, o, 'eaten');
        return; // one kill per bite
      }
    }
  }
}

function reproduce(world, c, kin) {
  const { rng } = world;
  const p = c.pheno;
  const pool = c.energy * (1 - ECOLOGY.parentKeeps) * (1 - ECOLOGY.birthLoss);
  c.energy *= ECOLOGY.parentKeeps;
  const each = pool / p.litterSize;
  for (let i = 0; i < p.litterSize; i++) {
    let g = c.genome;
    if (kin && kin.alive && rng.next() < ECOLOGY.crossoverChance) g = crossover(g, kin.genome, rng);
    g = mutate(g, rng, ECOLOGY.mutationStrength);
    const a = c.angle + Math.PI + rng.range(-1, 1);
    const d = p.radius * 1.5;
    const child = spawnCreature(world, g, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, c);
    child.energy = Math.min(child.pheno.maxEnergy, each);
    child.angle = a;
  }
}

const senseOut = { kin: null };

export function step(world) {
  world.tick++;
  const { creatures, config } = world;
  driftLights(world);

  world._foodAcc += config.foodRate;
  while (world._foodAcc >= 1) {
    world._foodAcc -= 1;
    if (world.food.length < config.maxFood) sproutAlgae(world);
  }

  world._grid.build(creatures);
  world._foodGrid.build(world.food);

  const n = creatures.length;
  for (let i = 0; i < n; i++) {
    const c = creatures[i];
    if (!c.alive) continue;
    const p = c.pheno;
    sense(world, c, c.inputs, senseOut);
    const o = c.brain.think(c.inputs);
    const turn = o[0], thrust = o[1], bite = o[2];
    c.outputs[0] = turn; c.outputs[1] = thrust; c.outputs[2] = bite;

    c.angle += turn * p.turnRate;
    c.speed += (thrust * p.maxSpeed - c.speed) * 0.3;
    c.x += Math.cos(c.angle) * c.speed;
    c.y += Math.sin(c.angle) * c.speed;
    const r = p.radius;
    if (c.x < r) { c.x = r; c.angle = Math.PI - c.angle; }
    else if (c.x > world.width - r) { c.x = world.width - r; c.angle = Math.PI - c.angle; }
    if (c.y < r) { c.y = r; c.angle = -c.angle; }
    else if (c.y > world.height - r) { c.y = world.height - r; c.angle = -c.angle; }
    if (c.angle > Math.PI || c.angle < -Math.PI) c.angle -= TAU * Math.floor((c.angle + Math.PI) / TAU);

    c.energy -= p.metabolism + ECOLOGY.moveCost * c.speed * c.speed * r + ECOLOGY.biteCost * bite;
    if (p.diet < 0.999) graze(world, c);
    if (c.cooldown > 0) c.cooldown--;
    else if (bite > 0.5 && p.diet > 0.35) hunt(world, c);
    if (c.energy > p.maxEnergy) c.energy = p.maxEnergy;

    c.age++;
    if (c.energy <= 0) { die(world, c, 'starvation'); continue; }
    if (c.age > p.lifespan) { die(world, c, 'old age'); continue; }
    if (c.age > ECOLOGY.minBreedAge && c.energy >= p.reproduceAt * p.maxEnergy && creatures.length < config.maxCreatures) {
      reproduce(world, c, senseOut.kin);
    }
  }

  // Compact dead creatures and eaten food in place.
  let w = 0;
  for (let i = 0; i < creatures.length; i++) if (creatures[i].alive) creatures[w++] = creatures[i];
  creatures.length = w;
  const food = world.food;
  w = 0;
  for (let i = 0; i < food.length; i++) if (food[i].energy > 0) food[w++] = food[i];
  food.length = w;

  if (creatures.length === 0) reseed(world);
  if (world.tick % SAMPLE_EVERY === 0) {
    census(world);
    sample(world);
  }
}

export function findCreatureAt(world, x, y, slop = 6) {
  let best = null, bestD = Infinity;
  for (const c of world.creatures) {
    const dx = c.x - x, dy = c.y - y;
    const d = Math.sqrt(dx * dx + dy * dy) - c.pheno.radius;
    if (d <= slop && d < bestD) { bestD = d; best = c; }
  }
  return best;
}
