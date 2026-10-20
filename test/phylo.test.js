import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutPhylogeny } from '../src/phylo.js';

const sp = (id, parentId, founderTick, peakPopulation = 10, extinctTick = null) =>
  ({ id, parentId, founderTick, peakPopulation, extinctTick, hue: id * 40, name: { common: `S${id}`, genus: 'G', epithet: 'e' } });

test('empty input gives an empty tree', () => {
  const t = layoutPhylogeny([], 0);
  assert.equal(t.rows, 0);
  assert.deepEqual(t.nodes, []);
});

test('every species gets its own row and parents come before children', () => {
  const t = layoutPhylogeny([sp(1, null, 0), sp(2, 1, 100), sp(3, 1, 300), sp(4, 2, 500), sp(5, null, 0)], 1000);
  const rows = t.nodes.map((n) => n.row);
  assert.equal(new Set(rows).size, rows.length);
  for (const n of t.nodes) if (n.parentRow != null) assert.ok(n.parentRow < n.row);
});

test('connectors never cross another bar', () => {
  const list = [sp(1, null, 0), sp(2, 1, 100), sp(3, 1, 300), sp(4, 2, 150), sp(5, 3, 400), sp(6, 1, 50), sp(7, 6, 60)];
  const t = layoutPhylogeny(list, 1000);
  for (const c of t.nodes) {
    if (c.parentRow == null) continue;
    // every bar strictly between parent and child must start after the connector
    for (const o of t.nodes) {
      if (o.row > c.parentRow && o.row < c.row) assert.ok(o.start >= c.start, `S${o.id} crosses connector of S${c.id}`);
    }
  }
});

test('obscure species are dropped but ancestors of notable ones are kept', () => {
  const list = [
    sp(1, null, 0),
    sp(2, 1, 100, 1, 200),   // obscure and extinct, but parent of a notable species
    sp(3, 2, 150),           // living
    sp(4, 1, 300, 2, 350),   // obscure and extinct, no notable descendants
  ];
  const ids = layoutPhylogeny(list, 1000).nodes.map((n) => n.id);
  assert.deepEqual(ids.sort(), [1, 2, 3]);
});

test('bars end at extinction or now', () => {
  const t = layoutPhylogeny([sp(1, null, 0, 10, 400), sp(2, 1, 100)], 900);
  const byId = Object.fromEntries(t.nodes.map((n) => [n.id, n]));
  assert.equal(byId[1].end, 400);
  assert.equal(byId[1].alive, false);
  assert.equal(byId[2].end, 900);
  assert.equal(byId[2].alive, true);
});
