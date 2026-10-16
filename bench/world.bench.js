// Headless ecology run: node bench/world.bench.js [ticks=30000] [seeds=1,2,3]
// Prints a daily-ish log line and a summary per seed, plus a timing check.
import { createWorld, step, DAY } from '../src/world.js';

const ticks = Number(process.argv[2] || 30000);
const seeds = (process.argv[3] || '1,2,3').split(',').map(Number);
const quiet = process.argv.includes('--quiet');

for (const seed of seeds) {
  const w = createWorld({ seed });
  let minPop = Infinity, maxPop = 0, reseeds = 0, maxDiet = 0, predatorDays = 0, speciations = 0, extinctions = 0;
  let lastSeq = 0;
  const t0 = performance.now();
  for (let t = 0; t < ticks; t++) {
    const before = w.creatures.length;
    step(w);
    if (before > 0 && w.tick > 1 && w.creatures.length === 20 && w.events.some((e) => e.tick === w.tick && e.type === 'speciation' && e.parentId == null)) reseeds++;
    for (let i = w.events.length - 1; i >= 0 && w.events[i].seq > lastSeq; i--) {
      if (w.events[i].type === 'speciation') speciations++;
      if (w.events[i].type === 'extinction') extinctions++;
    }
    lastSeq = w.eventSeq;
    if (w.tick > DAY * 2) { minPop = Math.min(minPop, w.creatures.length); maxPop = Math.max(maxPop, w.creatures.length); }
    if (w.tick % DAY === 0) {
      let preds = 0, dsum = 0, rsum = 0;
      for (const c of w.creatures) { if (c.pheno.diet > 0.5) preds++; dsum += c.pheno.diet; rsum += c.pheno.radius; maxDiet = Math.max(maxDiet, c.pheno.diet); }
      if (preds > 0) predatorDays++;
      const n = w.creatures.length || 1;
      if (!quiet) console.log(`seed ${seed} day ${w.tick / DAY}: pop ${w.creatures.length} food ${w.food.length} living sp ${w.species.living().length} preds ${preds} meanDiet ${(dsum / n).toFixed(2)} meanR ${(rsum / n).toFixed(1)} gen ${w.stats.generationMax} kills ${w.stats.predations}`);
    }
  }
  const ms = performance.now() - t0;
  const all = w.species.all();
  console.log(`== seed ${seed}: ${ticks} ticks (${(ticks / DAY).toFixed(0)} days) in ${(ms / 1000).toFixed(1)}s (${(ms / ticks).toFixed(3)} ms/step)`);
  console.log(`   pop range ${minPop}-${maxPop}, species founded ${all.length} (speciation events ${speciations}), extinct ${all.filter((s) => s.extinctTick !== null).length}, living ${w.species.living().length}`);
  console.log(`   births ${w.stats.births} deaths ${w.stats.deaths} predations ${w.stats.predations} generationMax ${w.stats.generationMax} maxDiet ${maxDiet.toFixed(2)} predatorDays ${predatorDays} reseeds~${reseeds}`);
}

// Timing at the design load: ~400 creatures and 700 food.
{
  const w = createWorld({ seed: 99, initialCreatures: 400, maxFood: 700 });
  while (w.food.length < 700) step(w);
  const N = 300;
  const t0 = performance.now();
  let pop = 0;
  for (let i = 0; i < N; i++) { step(w); pop += w.creatures.length; }
  console.log(`timing: ${((performance.now() - t0) / N).toFixed(3)} ms/step at ~${Math.round(pop / N)} creatures, ${w.food.length} food`);
}
