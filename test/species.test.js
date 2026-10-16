import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import { randomGenome, mutate, express } from '../src/genome.js';
import { SPECIES_THRESHOLD, binomialName, createRegistry } from '../src/species.js';

// Hand-built phenotype covering every DESIGN.md field.
function pheno(over = {}) {
  return {
    radius: 7, maxSpeed: 1.8, turnRate: 0.12, senseRange: 90, hue: 10, saturation: 80,
    lightness: 55, diet: 0.1, finCount: 2, bodyAspect: 1.6, pattern: 'plain', patternHue: 200,
    tailLength: 1, maxEnergy: 100, reproduceAt: 0.7, litterSize: 2, lifespan: 8000, metabolism: 0.05,
    ...over,
  };
}

function randomPheno(rng) {
  return pheno({
    radius: rng.range(3, 14), maxSpeed: rng.range(0.6, 3.2), senseRange: rng.range(30, 170),
    hue: rng.range(0, 360), saturation: rng.range(35, 95), lightness: rng.range(40, 72),
    diet: rng.next(), finCount: rng.int(5), bodyAspect: rng.range(1, 2.4),
    pattern: rng.pick(['plain', 'spots', 'stripes', 'bands']), patternHue: rng.range(0, 360),
    tailLength: rng.range(0.4, 1.6),
  });
}

test('threshold matches the design contract', () => {
  assert.equal(SPECIES_THRESHOLD, 0.12);
});

test('binomialName returns well-formed names', () => {
  const n = binomialName(makeRng(1), pheno());
  assert.deepEqual(Object.keys(n).sort(), ['common', 'epithet', 'genus']);
  assert.match(n.genus, /^[A-Z][a-z]+$/);
  assert.match(n.epithet, /^[a-z]+$/);
  assert.match(n.common, /^[A-Z][A-Za-z-]*( [A-Z][A-Za-z-]*)+$/);
});

test('binomialName is deterministic for a given rng state and phenotype', () => {
  const rng = makeRng(42);
  for (let i = 0; i < 50; i++) {
    const p = randomPheno(rng);
    const seed = rng.int(1e9);
    assert.deepEqual(binomialName(makeRng(seed), p), binomialName(makeRng(seed), p));
  }
});

test('names have variety', () => {
  const rng = makeRng(7);
  const latin = new Set(), common = new Set(), genera = new Set();
  for (let i = 0; i < 200; i++) {
    const n = binomialName(rng, randomPheno(rng));
    latin.add(n.genus + ' ' + n.epithet);
    common.add(n.common);
    genera.add(n.genus);
  }
  assert.ok(latin.size > 120, `only ${latin.size} unique binomials out of 200`);
  assert.ok(common.size > 120, `only ${common.size} unique common names out of 200`);
  assert.ok(genera.size > 60, `only ${genera.size} unique genera`);
});

test('epithets agree in gender with the genus', () => {
  const rng = makeRng(11);
  for (let i = 0; i < 400; i++) {
    const { genus, epithet } = binomialName(rng, randomPheno(rng));
    if (/(pinna|cauda|pteryx|lepis)$/.test(genus)) assert.doesNotMatch(epithet, /(us|um|er)$/, `${genus} ${epithet}`);
    else if (/(soma|stoma)$/.test(genus)) assert.doesNotMatch(epithet, /(a|us|er|is)$/, `${genus} ${epithet}`);
    else assert.doesNotMatch(epithet, /(a|um)$/, `${genus} ${epithet}`);
  }
});

test('names reflect the body plan and colours', () => {
  const rng = makeRng(3);
  let predatorish = 0, red = 0;
  for (let i = 0; i < 100; i++) {
    const n = binomialName(rng, pheno({ diet: 0.95, radius: 12, hue: 5, saturation: 90, lightness: 55 }));
    if (/(odon|gnathus|stoma|Lyco|Carno|Harpag|Sarco|Lami|Ther|Dino)/.test(n.genus) ||
        /(jaw|fang|tooth|maw|Snapper|stalker|Lurker|Marauder|Ambusher|Reaver|Gulper)/.test(n.common)) predatorish++;
    if (/(Crimson|Scarlet|Red|Ruby)/.test(n.common) || /^(rubr|ruber|coccine|sanguine)/.test(n.epithet)) red++;
  }
  assert.ok(predatorish > 85, `predators only sounded predatory ${predatorish}/100 times`);
  assert.ok(red > 30, `red fish named red only ${red}/100 times`);

  const spotted = binomialName(makeRng(5), pheno({ pattern: 'spots' }));
  assert.ok(spotted.common && spotted.epithet);
});

test('registry makes every full name unique, even for identical phenotypes', () => {
  const reg = createRegistry(makeRng(9));
  const rng = makeRng(10);
  const same = pheno({ hue: 120, pattern: 'bands' });
  for (let i = 0; i < 60; i++) reg.found({ traits: {}, weights: [] }, same, i);
  for (let i = 0; i < 200; i++) reg.found({ traits: {}, weights: [] }, randomPheno(rng), i);
  const all = reg.all();
  const latin = new Set(all.map((s) => s.name.genus + ' ' + s.name.epithet));
  const common = new Set(all.map((s) => s.name.common));
  assert.equal(latin.size, all.length);
  assert.equal(common.size, all.length);
});

test('registry naming is deterministic per seed', () => {
  const names = (seed) => {
    const reg = createRegistry(makeRng(seed));
    const rng = makeRng(1);
    for (let i = 0; i < 20; i++) reg.found({ traits: {}, weights: [] }, randomPheno(rng), 0);
    return reg.all().map((s) => s.name.common);
  };
  assert.deepEqual(names(4), names(4));
  assert.notDeepEqual(names(4), names(5));
});

test('found builds a complete Species record', () => {
  const reg = createRegistry(makeRng(1));
  const g = randomGenome(makeRng(2));
  const p = express(g);
  const sp = reg.found(g, p, 120);
  assert.equal(sp.id, 1);
  assert.equal(sp.hue, p.hue);
  assert.equal(sp.founderTick, 120);
  assert.equal(sp.parentId, null);
  assert.equal(sp.representative, g);
  assert.equal(sp.population, 0);
  assert.equal(sp.peakPopulation, 0);
  assert.equal(sp.totalBorn, 0);
  assert.equal(sp.extinctTick, null);
  assert.equal(reg.get(1), sp);
  assert.equal(reg.found(g, p, 130, 1).id, 2);
  assert.equal(reg.get(2).parentId, 1);
});

test('classify keeps close relatives and splits distant ones', () => {
  const rng = makeRng(21);
  const reg = createRegistry(rng.fork());
  const g = randomGenome(rng);
  const sp = reg.found(g, express(g), 0);
  const child = mutate(g, rng, 0.2);
  assert.deepEqual(reg.classify(child, express(child), sp.id, 10), { id: sp.id, isNew: false });
  assert.equal(sp.totalBorn, 1);

  const stranger = randomGenome(rng);
  const res = reg.classify(stranger, express(stranger), sp.id, 20);
  assert.equal(res.isNew, true);
  const daughter = reg.get(res.id);
  assert.equal(daughter.parentId, sp.id);
  assert.equal(daughter.founderTick, 20);
  assert.equal(daughter.totalBorn, 1);
  assert.deepEqual(reg.all().map((s) => s.id), [1, 2]);

  // Unknown parent: still founds a species rather than throwing.
  const orphan = reg.classify(stranger, express(stranger), 999, 30);
  assert.equal(orphan.isNew, true);
  assert.equal(reg.get(orphan.id).parentId, null);
});

test('census tracks population, peak and extinction', () => {
  const reg = createRegistry(makeRng(1));
  const rng = makeRng(2);
  const a = reg.found(randomGenome(rng), randomPheno(rng), 0);
  const b = reg.found(randomGenome(rng), randomPheno(rng), 0);
  const c = reg.found(randomGenome(rng), randomPheno(rng), 30);
  assert.equal(reg.living().length, 3);

  const crowd = (n, id) => Array.from({ length: n }, () => ({ speciesId: id, alive: true }));
  assert.deepEqual(reg.census([...crowd(5, a.id), ...crowd(2, b.id)], 30), []);
  assert.equal(a.population, 5);
  assert.equal(b.peakPopulation, 2);
  // c was founded this very tick and not yet counted: not extinct, still living.
  assert.equal(c.extinctTick, null);
  assert.deepEqual(reg.living().map((s) => s.id), [a.id, b.id, c.id]);

  const ev = reg.census(crowd(3, a.id), 60);
  assert.deepEqual(ev.map((e) => e.speciesId).sort(), [b.id, c.id]);
  assert.ok(ev.every((e) => e.type === 'extinction' && e.tick === 60));
  assert.equal(b.extinctTick, 60);
  assert.equal(a.population, 3);
  assert.equal(a.peakPopulation, 5);
  assert.deepEqual(reg.living().map((s) => s.id), [a.id]);
  // Extinction is reported only once.
  assert.deepEqual(reg.census(crowd(3, a.id), 90), []);
});
