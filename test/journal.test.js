import { test } from 'node:test';
import assert from 'node:assert/strict';
import { narrate } from '../src/journal.js';

// Minimal stand-in for World + Registry so these tests don't depend on world.js.
function makeWorld(extraSpecies = []) {
  const species = [
    { id: 1, name: { genus: 'Velocipinna', epithet: 'rubra', common: 'Crimson Dartfin' }, founderTick: 0, parentId: null,
      population: 40, peakPopulation: 52, totalBorn: 300, extinctTick: null,
      pheno: { radius: 6, maxSpeed: 2.5, diet: 0.1, finCount: 2, pattern: 'plain', hue: 5, tailLength: 1, senseRange: 80 } },
    { id: 2, name: { genus: 'Lucipinna', epithet: 'fasciata', common: 'Banded Glimmerfin' }, founderTick: 6000, parentId: 1,
      population: 0, peakPopulation: 0, totalBorn: 1, extinctTick: null,
      pheno: { radius: 6.2, maxSpeed: 2.4, diet: 0.15, finCount: 2, pattern: 'bands', hue: 12, tailLength: 1, senseRange: 80 } },
    { id: 3, name: { genus: 'Lycodon', epithet: 'ferox', common: 'Lesser Ghost Snapper' }, founderTick: 0, parentId: null,
      population: 8, peakPopulation: 20, totalBorn: 60, extinctTick: null,
      pheno: { radius: 9, maxSpeed: 2, diet: 0.9, finCount: 1, pattern: 'plain', hue: 200, tailLength: 1, senseRange: 120 } },
    ...extraSpecies,
  ];
  const byId = new Map(species.map((s) => [s.id, s]));
  return {
    tick: 0,
    creatures: [{ id: 77, kills: 3, speciesId: 3 }],
    stats: { births: 0, deaths: 0, predations: 0, generationMax: 1 },
    species: { get: (id) => byId.get(id), all: () => species.slice(), living: () => species.filter((s) => s.extinctTick == null) },
  };
}

let seq = 0;
const ev = (type, tick, fields = {}) => ({ seq: ++seq, tick, type, ...fields });

test('routine events and junk return null', () => {
  const w = makeWorld();
  assert.equal(narrate(ev('birth', 10, { creatureId: 5, parentId: 4, speciesId: 1 }), w), null);
  assert.equal(narrate(ev('death', 10, { creatureId: 5, speciesId: 1, cause: 'starvation', age: 400 }), w), null);
  assert.equal(narrate(ev('death', 10, { creatureId: 6, speciesId: 1, cause: 'eaten', age: 400 }), w), null);
  assert.equal(narrate(ev('mystery', 10), w), null);
  assert.equal(narrate(null, w), null);
  assert.equal(narrate(undefined, undefined), null);
});

test('a new species is introduced once established, naming its ancestor', () => {
  const w = makeWorld();
  const sp = w.species.get(2);
  // The speciation itself is quiet: most new forms vanish at once.
  assert.equal(narrate(ev('speciation', 6000, { speciesId: 2, parentId: 1 }), w), null);
  sp.totalBorn = 3;
  assert.equal(narrate(ev('birth', 6600, { creatureId: 50, speciesId: 2 }), w), null);
  sp.totalBorn = 8;
  const line = narrate(ev('birth', 7800, { creatureId: 51, speciesId: 2 }), w);
  assert.match(line, /^Day 14\. /);
  assert.ok(line.includes('Banded Glimmerfin'), line);
  assert.ok(line.includes('(Lucipinna fasciata)'), line);
  assert.ok(line.includes('Crimson Dartfin'), line);
  // Introduced only once.
  assert.equal(narrate(ev('birth', 7900, { creatureId: 52, speciesId: 2 }), w), null);
});

test('introductions vary and mention what changed', () => {
  const daughter = () => ({ id: 4, name: { genus: 'Velocicauda', epithet: 'rubra', common: 'Crimson Darttail' }, founderTick: 5000,
    parentId: 1, population: 6, peakPopulation: 6, totalBorn: 9, extinctTick: null,
    pheno: { radius: 6, maxSpeed: 2.5, diet: 0.1, finCount: 2, pattern: 'bands', hue: 5, tailLength: 1, senseRange: 80 } });
  const primed = () => {
    const w = makeWorld([daughter()]);
    w.species.get(2).totalBorn = 8;
    narrate({ seq: 1, tick: 4000, type: 'birth', speciesId: 2 }, w); // the pool's first, with its own templates
    return w;
  };
  const lines = new Set();
  let mentionsBands = 0;
  for (let s = 1; s <= 40; s++) {
    const e = { seq: 100 + s, tick: 6000 + s * 13, type: 'birth', speciesId: 4 };
    const a = narrate(e, primed());
    assert.equal(a, narrate(e, primed()));
    assert.ok(a.includes('Crimson Darttail (Velocicauda rubra)') && a.includes('Crimson Dartfin'), a);
    if (a.includes('bands')) mentionsBands++;
    lines.add(a.replace(/^Day \d+\. /, ''));
  }
  assert.ok(lines.size >= 4, `only ${lines.size} phrasings`);
  assert.ok(mentionsBands > 0, 'the changed pattern is never mentioned');
});

test('restocking an empty pool gets one line per restock', () => {
  const w = makeWorld();
  assert.equal(narrate(ev('speciation', 0, { speciesId: 1, parentId: null }), w), null);
  const line = narrate(ev('speciation', 9000, { speciesId: 1, parentId: null }), w);
  assert.ok(line && line.includes('Crimson Dartfin'), line);
  assert.equal(narrate(ev('speciation', 9000, { speciesId: 3, parentId: null }), w), null);
});

test('extinction reports how long it lasted and its peak', () => {
  const w = makeWorld();
  w.species.get(2).totalBorn = 30;
  w.species.get(2).population = 12;
  const sp = w.species.get(1);
  sp.population = 0;
  sp.extinctTick = 7200;
  const line = narrate(ev('extinction', 7200, { speciesId: 1 }), w);
  assert.match(line, /^Day 13\./);
  assert.ok(line.includes('Crimson Dartfin'), line);
  assert.ok(/twelve days/i.test(line), line);
  assert.ok(/52|fifty-two/i.test(line), line);
  // A living, established daughter species is mentioned.
  assert.ok(line.includes('Banded Glimmerfin'), line);
});

test('extinction lines are deterministic and varied', () => {
  const lines = new Set();
  for (let s = 1; s <= 40; s++) {
    const e = { seq: s, tick: 6000 + s * 13, type: 'extinction', speciesId: 3 };
    const a = narrate(e, makeWorld());
    assert.equal(a, narrate(e, makeWorld()));
    lines.add(a.replace(/^Day \d+\. /, ''));
  }
  assert.ok(lines.size >= 4, `only ${lines.size} phrasings`);
});

test('short-lived species get a briefer obituary', () => {
  const tiny = { id: 9, name: { genus: 'Nanosoma', epithet: 'album', common: 'Pale Mote' }, founderTick: 600, parentId: null,
    population: 0, peakPopulation: 2, totalBorn: 2, extinctTick: 900 };
  const line = narrate(ev('extinction', 900, { speciesId: 9 }), makeWorld([tiny]));
  assert.ok(line.includes('Pale Mote'), line);
  assert.ok(/less than a day|never more than two/.test(line), line);
});

test('ephemeral extinctions are summarised, not listed one by one', () => {
  const flickers = [];
  for (let i = 0; i < 30; i++) {
    flickers.push({ id: 100 + i, name: { genus: 'Nanosoma', epithet: 'album', common: 'Pale Mote ' + 'I'.repeat(i % 3 + 1) },
      founderTick: 3000, parentId: 1, population: 0, peakPopulation: 1, totalBorn: 1, extinctTick: 3030 });
  }
  const w = makeWorld(flickers);
  const out = flickers.map((f, i) => narrate(ev('extinction', 3030 + i * 200, { speciesId: f.id }), w)).filter(Boolean);
  assert.ok(out.length >= 1 && out.length <= 2, out.join('\n'));
});

test('milestones are narrated once per level', () => {
  const w = makeWorld();
  const a = narrate(ev('milestone', 3000, { speciesId: 1, population: 25 }), w);
  assert.ok(/twenty-five/i.test(a), a);
  assert.equal(narrate(ev('milestone', 3100, { speciesId: 1, population: 25 }), w), null);
  assert.ok(narrate(ev('milestone', 3200, { speciesId: 1, population: 50 }), w).length > 0);
  assert.ok(/hundred/.test(narrate(ev('milestone', 3300, { speciesId: 1, population: 100 }), w)));
});

test('predation: first kill, first of an introduced prey species, then silence', () => {
  const w = makeWorld();
  const first = narrate(ev('predation', 1000, { predatorId: 77, preyId: 5, predatorSpecies: 3, preySpecies: 1 }), w);
  assert.ok(first.includes('Snapper') && first.includes('Crimson Dartfin'), first);
  assert.equal(narrate(ev('predation', 1400, { predatorId: 77, preyId: 6, predatorSpecies: 3, preySpecies: 1 }), w), null);
  // Species 2 is a daughter not yet introduced: no line about it yet.
  assert.equal(narrate(ev('predation', 1500, { predatorId: 77, preyId: 7, predatorSpecies: 3, preySpecies: 2 }), w), null);
  w.species.get(2).totalBorn = 9;
  assert.ok(narrate(ev('birth', 1600, { creatureId: 60, speciesId: 2 }), w));
  const newPrey = narrate(ev('predation', 2000, { predatorId: 77, preyId: 8, predatorSpecies: 3, preySpecies: 2 }), w);
  assert.ok(newPrey && newPrey.includes('Banded Glimmerfin'), newPrey);
  assert.equal(narrate(ev('predation', 2100, { predatorId: 77, preyId: 9, predatorSpecies: 3, preySpecies: 2 }), w), null);
  const cannibal = narrate(ev('predation', 2500, { predatorId: 77, preyId: 10, predatorSpecies: 3, preySpecies: 3 }), w);
  assert.ok(cannibal && cannibal.includes('Snapper'), cannibal);
  // A hunter reaching a round number of kills gets a line, once.
  w.creatures[0].kills = 12;
  const hunter = narrate(ev('predation', 2600, { predatorId: 77, preyId: 11, predatorSpecies: 3, preySpecies: 2 }), w);
  assert.ok(hunter && /twelve/.test(hunter), hunter);
  w.creatures[0].kills = 13;
  assert.equal(narrate(ev('predation', 2700, { predatorId: 77, preyId: 12, predatorSpecies: 3, preySpecies: 2 }), w), null);
});

test('old age: first death and records only', () => {
  const w = makeWorld();
  const first = narrate(ev('death', 9000, { creatureId: 1, speciesId: 1, cause: 'old age', age: 6000 }), w);
  assert.ok(first && first.includes('Crimson Dartfin') && /ten days/.test(first), first);
  assert.equal(narrate(ev('death', 9600, { creatureId: 2, speciesId: 1, cause: 'old age', age: 5000 }), w), null);
  const record = narrate(ev('death', 12000, { creatureId: 3, speciesId: 2, cause: 'old age', age: 9000 }), w);
  assert.ok(record && record.includes('Banded Glimmerfin'), record);
});

test('population crash is noticed on a death after a census drop', () => {
  const w = makeWorld();
  const sp = w.species.get(1);
  sp.population = 40;
  assert.equal(narrate(ev('death', 100, { creatureId: 1, speciesId: 1, cause: 'starvation', age: 50 }), w), null);
  sp.population = 9;
  const line = narrate(ev('death', 700, { creatureId: 2, speciesId: 1, cause: 'starvation', age: 50 }), w);
  assert.ok(line && line.includes('Crimson Dartfin') && /40|forty/.test(line), line);
  // Not repeated for the same slump.
  assert.equal(narrate(ev('death', 760, { creatureId: 3, speciesId: 1, cause: 'starvation', age: 50 }), w), null);
});

test('generation milestones ride on births', () => {
  const w = makeWorld();
  assert.equal(narrate(ev('birth', 100, { creatureId: 1, speciesId: 1 }), w), null);
  w.stats.generationMax = 10;
  assert.match(narrate(ev('birth', 200, { creatureId: 2, speciesId: 1 }), w), /10/);
  assert.equal(narrate(ev('birth', 300, { creatureId: 3, speciesId: 1 }), w), null);
});

test('missing species, creatures or world never throw', () => {
  const w = makeWorld();
  const events = [
    ev('speciation', 10, { speciesId: 404, parentId: 405 }),
    ev('speciation', 10, { speciesId: 404, parentId: null }),
    ev('extinction', 10, { speciesId: 404 }),
    ev('milestone', 10, { speciesId: 404, population: 50 }),
    ev('predation', 10, { predatorId: 1, preyId: 2, predatorSpecies: 404, preySpecies: 405 }),
    ev('death', 10, { creatureId: 1, speciesId: 404, cause: 'old age', age: 9999 }),
    ev('birth', 10, {}),
    ev('crash', 10, { speciesId: 404, from: 30, to: 3 }),
  ];
  for (const e of events) {
    for (const world of [w, null, undefined, {}, { species: {} }, { species: { get() { throw new Error('boom'); } } }]) {
      const out = narrate(e, world);
      assert.ok(out === null || typeof out === 'string');
      if (out) assert.doesNotMatch(out, /undefined|null|NaN/, out);
    }
  }
});
