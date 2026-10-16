// Genome = visible/body traits in [0,1] + brain weights. Phenotype is derived
// deterministically, so the genome is the only thing that needs to be stored.
import { weightCount, hiddenWeightIndex, outputWeightIndex, INPUTS, HIDDEN } from './brain.js';

export const TRAITS = [
  'size', 'speed', 'sense', 'hue', 'saturation', 'lightness', 'diet', 'fins',
  'aspect', 'pattern', 'patternHue', 'tail', 'fertility', 'brood', 'longevity',
];

export const PATTERN_NAMES = ['plain', 'spots', 'stripes', 'bands'];

// How much each trait counts toward species distance. Visible traits dominate.
const TRAIT_WEIGHT = {
  size: 1.6, speed: 1.0, sense: 0.6, hue: 2.4, saturation: 0.8, lightness: 0.8,
  diet: 1.4, fins: 1.0, aspect: 1.0, pattern: 1.0, patternHue: 1.2, tail: 0.8,
  fertility: 0.4, brood: 0.4, longevity: 0.4,
};
const CIRCULAR = { hue: true, patternHue: true };
const TRAIT_SHARE = 0.92; // remaining share comes from brain weights
const WEIGHT_SCALE = 0.6; // mean |dw| that counts as "completely different brain"
const WEIGHT_LIMIT = 5;

let weightTotal = 0;
for (const t of TRAITS) weightTotal += TRAIT_WEIGHT[t];

const IN = {};
INPUTS.forEach((name, i) => { IN[name] = i; });

// Hand-built behavioural prior: turn toward food, chase prey if carnivorous,
// flee threats, steer off walls, keep moving. Noise on top gives variety.
function priorWeights(rng, diet) {
  const w = new Array(weightCount()).fill(0);
  const H = (h, input, v) => { w[hiddenWeightIndex(h, IN[input])] = v; };
  const O = (o, h, v) => { w[outputWeightIndex(o, h)] = v; };
  // h0: food direction -> turn (grazers care more)
  H(0, 'foodAngle', 3); O(0, 0, 2.2 * (1 - 0.6 * diet));
  // h1: prey direction -> turn (carnivores)
  H(1, 'preyAngle', 3); O(0, 1, 2.4 * diet);
  // h2: prey close -> bite
  H(2, 'preyDist', 3); O(2, 2, 4 * diet);
  // h3: threat direction -> turn away; h4 also speeds up when threatened
  H(3, 'threatAngle', -3); O(0, 3, 1.6);
  // h4: cruise thrust, faster under threat, slower as food gets close (less orbiting)
  H(4, 'bias', 1); H(4, 'threatDist', 2); H(4, 'foodDist', -1.2); O(1, 4, 1.6);
  // h5: near a wall -> turn (one consistent direction is enough to escape)
  H(5, 'wall', 3); O(0, 5, 1.4);
  // h6: wandering oscillator
  H(6, 'clock', 1); O(0, 6, 0.5);
  O(2, HIDDEN, -2.5 + 2 * diet); // bite bias: grazers keep their mouths shut
  for (let i = 0; i < w.length; i++) w[i] = clampW(w[i] + rng.gauss() * 0.3);
  return w;
}
function clampW(v) {
  return v > WEIGHT_LIMIT ? WEIGHT_LIMIT : v < -WEIGHT_LIMIT ? -WEIGHT_LIMIT : v;
}

// Reflect into [0,1] so mutations near the edges don't pile up exactly at 0 or 1.
function reflect01(v) {
  if (v < 0) v = -v;
  if (v > 1) v = 2 - v;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function randomGenome(rng) {
  const traits = {};
  for (const t of TRAITS) traits[t] = rng.next();
  // Most founders graze; carnivory has to be earned (or comes from a lucky draw).
  traits.diet = rng.next() * rng.next() * 0.8;
  traits.size = 0.15 + rng.next() * 0.6;
  return { traits, weights: priorWeights(rng, traits.diet) };
}

export function mutate(genome, rng, strength = 1) {
  const traits = {};
  for (const t of TRAITS) {
    let v = genome.traits[t];
    if (rng.next() < 0.4) v += rng.gauss() * 0.05 * strength;
    if (rng.next() < 0.015 * strength) v += rng.gauss() * 0.2; // rare larger jump
    traits[t] = CIRCULAR[t] ? ((v % 1) + 1) % 1 : reflect01(v);
  }
  const src = genome.weights;
  const weights = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    let v = src[i];
    if (rng.next() < 0.08 * strength) v += rng.gauss() * 0.25;
    weights[i] = clampW(v);
  }
  return { traits, weights };
}

export function crossover(a, b, rng) {
  const traits = {};
  for (const t of TRAITS) traits[t] = rng.next() < 0.5 ? a.traits[t] : b.traits[t];
  // Swap whole neurons, not single weights, so useful circuits stay intact.
  const weights = a.weights.slice();
  const ni = INPUTS.length;
  for (let h = 0; h < HIDDEN; h++) {
    if (rng.next() < 0.5) {
      for (let i = 0; i < ni; i++) weights[hiddenWeightIndex(h, i)] = b.weights[hiddenWeightIndex(h, i)];
      for (let o = 0; o < 3; o++) weights[outputWeightIndex(o, h)] = b.weights[outputWeightIndex(o, h)];
    }
  }
  return { traits, weights };
}

export function distance(a, b) {
  let s = 0;
  for (const t of TRAITS) {
    let d = Math.abs(a.traits[t] - b.traits[t]);
    if (CIRCULAR[t]) d = Math.min(d, 1 - d) * 2;
    s += TRAIT_WEIGHT[t] * d;
  }
  const traitPart = s / weightTotal;
  const wa = a.weights, wb = b.weights;
  let ws = 0;
  for (let i = 0; i < wa.length; i++) ws += Math.abs(wa[i] - wb[i]);
  const weightPart = Math.min(1, ws / wa.length / WEIGHT_SCALE);
  return TRAIT_SHARE * traitPart + (1 - TRAIT_SHARE) * weightPart;
}

export function express(genome) {
  const t = genome.traits;
  const radius = 3 + 11 * t.size;
  const sizeN = (radius - 3) / 11;
  const maxSpeed = 0.6 + 2.6 * t.speed;
  const senseRange = 30 + 140 * t.sense;
  // Small bodies turn faster; fins help a bit.
  const turnRate = 0.04 + 0.21 * (1 - sizeN) * (0.7 + 0.3 * t.fins);
  const finCount = Math.min(4, Math.floor(t.fins * 5));
  const r2 = radius * radius;
  return {
    radius,
    maxSpeed,
    turnRate,
    senseRange,
    hue: t.hue * 360,
    saturation: 35 + 60 * t.saturation,
    lightness: 40 + 32 * t.lightness,
    diet: t.diet,
    finCount,
    bodyAspect: 1 + 1.4 * t.aspect,
    pattern: PATTERN_NAMES[Math.min(3, Math.floor(t.pattern * 4))],
    patternHue: t.patternHue * 360,
    tailLength: 0.4 + 1.2 * t.tail,
    maxEnergy: 30 + 3 * r2,
    reproduceAt: 0.95 - 0.4 * t.fertility,
    litterSize: 1 + Math.min(2, Math.floor(t.brood * 3)),
    lifespan: Math.round(3000 + 11000 * t.longevity),
    // Bigger bodies, sharper senses and longer lives all cost upkeep.
    metabolism: (0.01 + 0.008 * radius + 0.0004 * r2 + 0.0003 * senseRange) * (0.85 + 0.3 * t.longevity),
  };
}
