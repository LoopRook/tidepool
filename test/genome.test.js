import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAITS, randomGenome, mutate, crossover, distance, express } from '../src/genome.js';
import { weightCount, makeBrain, INPUTS } from '../src/brain.js';
import { makeRng } from '../src/rng.js';

const REQUIRED = ['size', 'speed', 'sense', 'hue', 'saturation', 'diet', 'fins', 'aspect',
  'pattern', 'patternHue', 'tail', 'fertility', 'longevity'];

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
}

test('random genomes have every required trait in [0,1] and the right weight count', () => {
  const rng = makeRng(1);
  for (const t of REQUIRED) assert.ok(TRAITS.includes(t), t);
  for (let i = 0; i < 50; i++) {
    const g = randomGenome(rng);
    for (const t of TRAITS) assert.ok(g.traits[t] >= 0 && g.traits[t] <= 1, t);
    assert.equal(g.weights.length, weightCount());
    assert.ok(Array.isArray(g.weights));
  }
});

test('genomes survive a JSON round trip unchanged', () => {
  const rng = makeRng(2);
  const g = mutate(randomGenome(rng), rng);
  assert.deepEqual(JSON.parse(JSON.stringify(g)), g);
});

test('mutate and crossover never modify their inputs and stay in range', () => {
  const rng = makeRng(3);
  const a = randomGenome(rng), b = randomGenome(rng);
  const snapA = JSON.stringify(a), snapB = JSON.stringify(b);
  let g = a;
  for (let i = 0; i < 300; i++) g = mutate(g, rng, 2);
  const c = crossover(a, b, rng);
  assert.equal(JSON.stringify(a), snapA);
  assert.equal(JSON.stringify(b), snapB);
  for (const x of [g, c]) {
    for (const t of TRAITS) assert.ok(x.traits[t] >= 0 && x.traits[t] <= 1);
    assert.equal(x.weights.length, weightCount());
  }
  for (const t of TRAITS) assert.ok(c.traits[t] === a.traits[t] || c.traits[t] === b.traits[t]);
});

test('distance: zero for identical, symmetric, non-negative', () => {
  const rng = makeRng(4);
  const a = randomGenome(rng), b = randomGenome(rng);
  assert.equal(distance(a, a), 0);
  assert.equal(distance(a, JSON.parse(JSON.stringify(a))), 0);
  assert.equal(distance(a, b), distance(b, a));
  assert.ok(distance(a, b) > 0);
});

test('distance calibration: single mutations small, unrelated genomes 0.3-0.6', () => {
  const rng = makeRng(5);
  const single = [], unrelated = [];
  for (let i = 0; i < 1000; i++) {
    const g = randomGenome(rng);
    single.push(distance(g, mutate(g, rng)));
    unrelated.push(distance(g, randomGenome(rng)));
  }
  const smallFrac = single.filter((d) => d < 0.05).length / single.length;
  assert.ok(smallFrac > 0.9, `only ${smallFrac} of single mutations < 0.05`);
  assert.ok(median(single) < 0.035, `single median ${median(single)}`);
  const mu = median(unrelated);
  assert.ok(mu > 0.3 && mu < 0.6, `unrelated median ${mu}`);
  // unrelated founders should essentially always be distinct species
  assert.ok(unrelated.filter((d) => d > 0.12).length / unrelated.length > 0.98);
});

test('express gives phenotypes inside the documented ranges', () => {
  const rng = makeRng(6);
  const extremes = [0, 1].map((v) => ({ traits: Object.fromEntries(TRAITS.map((t) => [t, v])), weights: [] }));
  const genomes = [...extremes];
  for (let i = 0; i < 300; i++) genomes.push(mutate(randomGenome(rng), rng, 3));
  const inRange = (v, a, b) => v >= a - 1e-9 && v <= b + 1e-9;
  for (const g of genomes) {
    const p = express(g);
    assert.ok(inRange(p.radius, 3, 14));
    assert.ok(inRange(p.maxSpeed, 0.6, 3.2));
    assert.ok(inRange(p.turnRate, 0.04, 0.25));
    assert.ok(inRange(p.senseRange, 30, 170));
    assert.ok(inRange(p.hue, 0, 360));
    assert.ok(inRange(p.saturation, 35, 95));
    assert.ok(inRange(p.lightness, 40, 72));
    assert.ok(inRange(p.diet, 0, 1));
    assert.ok(Number.isInteger(p.finCount) && inRange(p.finCount, 0, 4));
    assert.ok(inRange(p.bodyAspect, 1, 2.4));
    assert.ok(['plain', 'spots', 'stripes', 'bands'].includes(p.pattern));
    assert.ok(inRange(p.patternHue, 0, 360));
    assert.ok(inRange(p.tailLength, 0.4, 1.6));
    assert.ok(p.maxEnergy > 0);
    assert.ok(inRange(p.reproduceAt, 0.55, 0.95));
    assert.ok(Number.isInteger(p.litterSize) && inRange(p.litterSize, 1, 3));
    assert.ok(inRange(p.lifespan, 3000, 14000));
    assert.ok(p.metabolism > 0);
  }
  // trade-offs: bigger is hungrier, and turns slower
  const small = express(extremes[0]), big = express({ traits: { ...extremes[0].traits, size: 1 }, weights: [] });
  assert.ok(big.maxEnergy > small.maxEnergy && big.metabolism > small.metabolism && big.turnRate < small.turnRate);
  assert.deepEqual(express(genomes[5]), express(JSON.parse(JSON.stringify(genomes[5]))));
});

test('random brains usually steer toward food (behavioural prior)', () => {
  const rng = makeRng(7);
  let correct = 0, moving = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const brain = makeBrain(randomGenome(rng).weights);
    const inp = new Array(INPUTS.length).fill(0);
    inp[INPUTS.indexOf('bias')] = 1;
    inp[INPUTS.indexOf('energy')] = 0.5;
    const side = rng.chance(0.5) ? 1 : -1;
    inp[0] = 0.3 * side; inp[1] = 0.5;
    const [turn, thrust] = brain.think(inp);
    if (Math.sign(turn) === side) correct++;
    if (thrust > 0.3) moving++;
  }
  assert.ok(correct / N > 0.85, `turned toward food ${correct}/${N}`);
  assert.ok(moving / N > 0.8, `moving ${moving}/${N}`);
});
