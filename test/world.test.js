import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, spawnCreature, findCreatureAt, DAY } from '../src/world.js';
import { randomGenome } from '../src/genome.js';
import { makeRng } from '../src/rng.js';

const run = (w, n) => { for (let i = 0; i < n; i++) step(w); return w; };
const fingerprint = (w) => w.creatures.map((c) => `${c.id}:${c.x.toFixed(3)},${c.y.toFixed(3)}:${c.energy.toFixed(3)}`).join('|');

test('a seed replays exactly', () => {
  const a = run(createWorld({ seed: 11 }), 900);
  const b = run(createWorld({ seed: 11 }), 900);
  assert.equal(fingerprint(a), fingerprint(b));
  assert.equal(a.eventSeq, b.eventSeq);
  assert.notEqual(fingerprint(a), fingerprint(run(createWorld({ seed: 12 }), 900)));
});

test('creatures stay inside the walls', () => {
  const w = run(createWorld({ seed: 3 }), 2000);
  for (const c of w.creatures) {
    assert.ok(c.x >= 0 && c.x <= w.width && c.y >= 0 && c.y <= w.height, `creature ${c.id} escaped`);
  }
});

test('events are numbered in order and the buffer is capped', () => {
  const w = run(createWorld({ seed: 5 }), DAY * 2);
  const seqs = w.events.map((e) => e.seq);
  for (let i = 1; i < seqs.length; i++) assert.ok(seqs[i] > seqs[i - 1]);
  assert.equal(seqs[seqs.length - 1], w.eventSeq);
  assert.ok(w.events.length <= 300);
  for (const e of w.events) assert.ok(Number.isInteger(e.tick) && typeof e.type === 'string');
});

test('life happens: births, deaths with known causes, and grazing', () => {
  const w = run(createWorld({ seed: 2 }), DAY * 3);
  assert.ok(w.stats.births > 0);
  assert.ok(w.stats.deaths > 0);
  assert.ok(w.stats.generationMax >= 1);
  const causes = new Set(['starvation', 'old age', 'eaten']);
  for (const e of w.events) if (e.type === 'death') assert.ok(causes.has(e.cause), e.cause);
  assert.ok(w.creatures.length > 0);
});

test('every pool starts with hunters', () => {
  const w = createWorld({ seed: 9 });
  assert.ok(w.species.all().some((s) => s.pheno.diet > 0.5));
});

test('an empty pool restocks itself, with grazers', () => {
  const w = createWorld({ seed: 4 });
  for (const c of w.creatures) { c.energy = -1; }
  run(w, 2);
  assert.ok(w.creatures.length > 0);
  assert.ok(w.creatures.some((c) => c.pheno.diet <= 0.5));
});

test('spawnCreature and findCreatureAt agree', () => {
  const w = createWorld({ seed: 1, initialCreatures: 0 });
  const c = spawnCreature(w, randomGenome(makeRng(99)), 400, 300);
  assert.equal(findCreatureAt(w, 401, 300), c);
  assert.equal(findCreatureAt(w, 1200, 900), null);
});
