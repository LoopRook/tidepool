import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INPUTS, OUTPUTS, HIDDEN, weightCount, makeBrain, hiddenWeightIndex, outputWeightIndex } from '../src/brain.js';
import { makeRng } from '../src/rng.js';

test('shape constants match the design', () => {
  assert.equal(INPUTS.length, 12);
  assert.equal(INPUTS[0], 'foodAngle');
  assert.equal(INPUTS[11], 'bias');
  assert.deepEqual(OUTPUTS, ['turn', 'thrust', 'bite']);
  assert.equal(weightCount(), HIDDEN * INPUTS.length + OUTPUTS.length * (HIDDEN + 1));
});

test('weight index helpers cover the whole array without overlap', () => {
  const seen = new Set();
  for (let h = 0; h < HIDDEN; h++) for (let i = 0; i < INPUTS.length; i++) seen.add(hiddenWeightIndex(h, i));
  for (let o = 0; o < 3; o++) for (let h = 0; h <= HIDDEN; h++) seen.add(outputWeightIndex(o, h));
  assert.equal(seen.size, weightCount());
  assert.equal(Math.max(...seen), weightCount() - 1);
});

test('outputs stay in range for random weights and inputs', () => {
  const rng = makeRng(3);
  for (let k = 0; k < 200; k++) {
    const w = Array.from({ length: weightCount() }, () => rng.gauss() * 3);
    const b = makeBrain(w);
    const inp = INPUTS.map(() => rng.range(-1, 1));
    const [turn, thrust, bite] = b.think(inp);
    assert.ok(turn >= -1 && turn <= 1);
    assert.ok(thrust >= 0 && thrust <= 1);
    assert.ok(bite >= 0 && bite <= 1);
  }
});

test('zero weights give neutral outputs; output biases are respected', () => {
  const w = new Array(weightCount()).fill(0);
  const inp = new Array(INPUTS.length).fill(0.5);
  assert.deepEqual(makeBrain(w).think(inp), [0, 0.5, 0.5]);
  w[outputWeightIndex(1, HIDDEN)] = 10;
  w[outputWeightIndex(0, HIDDEN)] = -10;
  const out = makeBrain(w).think(inp);
  assert.ok(out[0] < -0.99 && out[1] > 0.99);
});

test('think reuses its output buffer and is deterministic', () => {
  const rng = makeRng(9);
  const w = Array.from({ length: weightCount() }, () => rng.gauss());
  const b = makeBrain(w);
  const inp = INPUTS.map(() => 0.3);
  const a = b.think(inp);
  const first = [...a];
  const c = b.think(inp);
  assert.equal(a, c);
  assert.deepEqual([...c], first);
  assert.deepEqual([...makeBrain(w).think(inp)], first);
});
