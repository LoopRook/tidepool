import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scans } from '../src/verse.js';
import { nameStress, poolPoem } from '../verse/pool.js';

test('species names get the stress a reader would give them', () => {
  assert.equal(nameStress('Gloamer'), '10');
  assert.equal(nameStress('Marauder'), '010');
  assert.equal(nameStress('Driftfang'), '1x');
  assert.equal(nameStress('Weed-dart'), '1x');
  assert.equal(nameStress('Ribbonbelly'), '10x0');
  assert.equal(nameStress('Unheardof'), null);
});

test('a pool poem scans, names real species, and is the same every time', () => {
  const a = poolPoem(3, 15, 1);
  assert.equal(a.lines.length, 4);
  for (const line of a.lines) assert.ok(scans(line), line.map((e) => e.w).join(' '));
  assert.ok(a.told >= 1, 'at least one line is about something that happened');
  assert.equal(poolPoem(3, 15, 1).text, a.text);
});

test('the live verser writes a stanza into a running pool, the same one every time', async () => {
  const { createWorld, step, DAY } = await import('../src/world.js');
  const { makeVerser } = await import('../src/poolverse.js');
  const run = () => {
    const w = createWorld({ seed: 7 });
    const v = makeVerser(7);
    let last = 0;
    for (let t = 0; t < 14 * DAY; t++) {
      step(w);
      for (const e of w.events) {
        if (e.seq <= last) continue;
        const s = v.handle(e, w);
        if (s) return s;
      }
      last = w.eventSeq;
    }
    return null;
  };
  const s = run();
  assert.ok(s, 'a stanza by day 14');
  assert.equal(s.split('\n').length, 4);
  assert.equal(run(), s);
});
