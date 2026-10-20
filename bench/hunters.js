// Hunter vital signs: node bench/hunters.js [days=100] [seed=1] [every=5]
// Grazer vs hunter sizes, hunter diet and energy, and how hunters die.
import { createWorld, step, DAY } from '../src/world.js';

const days = Number(process.argv[2] || 100), seed = Number(process.argv[3] || 1), every = Number(process.argv[4] || 5);
const w = createWorld({ seed });
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0).toFixed(2);
let seen = 0;
for (let d = 1; d <= days; d++) {
  const deaths = { starvation: 0, 'old age': 0, eaten: 0 };
  for (let i = 0; i < DAY * every && d <= days; i++) {
    step(w);
    for (const e of w.events) {
      if (e.seq <= seen) continue;
      seen = e.seq;
      if (e.type === 'death' && w.species.get(e.speciesId)?.pheno.diet > 0.5) deaths[e.cause]++;
    }
  }
  d += every - 1;
  const H = w.creatures.filter((c) => c.pheno.diet > 0.5), G = w.creatures.filter((c) => c.pheno.diet <= 0.5);
  console.log(`day ${d}: grazers ${G.length} r ${med(G.map((c) => c.pheno.radius))} | hunters ${H.length} r ${med(H.map((c) => c.pheno.radius))} diet ${med(H.map((c) => c.pheno.diet))} e ${med(H.map((c) => c.energy / c.pheno.maxEnergy))} | hunter deaths ${JSON.stringify(deaths)} kills ${w.stats.predations}`);
}
