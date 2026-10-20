// Tree-of-life layout. Pure: species list in, rows out.
//
// Each species is a horizontal bar from its founding to its extinction (or now).
// Daughters sit below their parent, latest-founded first: a connector drops from
// the parent at the daughter's founding time, and every subtree it passes over was
// founded later, so its bars start to the right of the connector. No crossings.

export function isNotable(s) {
  return s.extinctTick == null || (s.peakPopulation || 0) >= 5;
}

export function layoutPhylogeny(species, tick, options = {}) {
  const keepIf = options.filter || isNotable;
  const byId = new Map(species.map((s) => [s.id, s]));
  const keep = new Set();
  for (const s of species) {
    if (!keepIf(s)) continue;
    // keep the whole ancestry so every notable species stays connected
    for (let a = s; a && !keep.has(a.id); a = byId.get(a.parentId)) keep.add(a.id);
  }
  const children = new Map();
  const roots = [];
  for (const s of species) {
    if (!keep.has(s.id)) continue;
    if (s.parentId != null && keep.has(s.parentId)) {
      if (!children.has(s.parentId)) children.set(s.parentId, []);
      children.get(s.parentId).push(s);
    } else roots.push(s);
  }
  roots.sort((a, b) => a.founderTick - b.founderTick || a.id - b.id);

  const nodes = [];
  const rowOf = new Map();
  const place = (s, parentRow) => {
    const row = nodes.length;
    rowOf.set(s.id, row);
    nodes.push({
      id: s.id, row, parentRow,
      start: s.founderTick, end: s.extinctTick ?? tick,
      alive: s.extinctTick == null,
      hue: s.hue, peak: s.peakPopulation || 0, name: s.name,
    });
    const kids = (children.get(s.id) || []).slice().sort((a, b) => b.founderTick - a.founderTick || b.id - a.id);
    for (const k of kids) place(k, row);
  };
  for (const r of roots) place(r, null);
  return { nodes, rows: nodes.length, start: 0, end: Math.max(1, tick) };
}
