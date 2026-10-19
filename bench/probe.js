// Quick ecology probe: node bench/probe.js [days=30] [seeds=1,2]
// Prints every 5 days: population, size quartiles, predators, species counts, speed.
import { createWorld, step, DAY } from '../src/world.js';

const days = Number(process.argv[2] || 30);
const seeds = (process.argv[3] || '1,2').split(',').map(Number);
for (const seed of seeds) {
  const w = createWorld({ seed });
  let a = performance.now();
  for (let d = 1; d <= days; d++) {
    for (let i = 0; i < DAY; i++) step(w);
    if (d % 5) continue;
    const rs = w.creatures.map((c) => c.pheno.radius).sort((x, y) => x - y);
    const q = (f) => (rs[Math.floor(f * (rs.length - 1))] ?? 0).toFixed(1);
    const all = w.species.all();
    const lasting = all.filter((s) => s.peakPopulation >= 5).length;
    const preds = w.creatures.filter((c) => c.pheno.diet > 0.5).length;
    console.log(`seed ${seed} day ${d}: pop ${w.creatures.length} r[${q(0.1)} ${q(0.5)} ${q(0.9)}] preds ${preds} kills ${w.stats.predations} species ${all.length} (lasting ${lasting}, living ${w.species.living().length}) gen ${w.stats.generationMax} ${((performance.now() - a) / (5 * DAY)).toFixed(2)}ms/tick`);
    a = performance.now();
  }
}
