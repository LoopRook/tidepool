// Runs a pool headless and writes its natural history, in the naturalist's own words.
// node chronicle.js [seed=7] [days=60]   -> chronicles/seed-<seed>.md
import { mkdirSync, writeFileSync } from 'node:fs';
import { createWorld, step, DAY } from './src/world.js';
import { narrate } from './src/journal.js';

const seed = Number(process.argv[2] || 7);
const days = Number(process.argv[3] || 60);
const world = createWorld({ seed });
const lines = [];
let lastSeq = 0;

for (let t = 0; t < days * DAY; t++) {
  step(world);
  // read every new event each tick so the ring buffer never drops one
  for (const e of world.events) {
    if (e.seq <= lastSeq) continue;
    const text = narrate(e, world);
    if (text) lines.push(text);
  }
  lastSeq = world.eventSeq;
}

const sp = world.species.all();
const living = world.species.living();
const biggest = living.slice().sort((a, b) => b.population - a.population)[0];
const name = (s) => `${s.name.common} (*${s.name.genus} ${s.name.epithet}*)`;
const out = [
  `# The pool of seed ${seed}`,
  '',
  `*${days} days, as recorded by the resident naturalist.*`,
  '',
  ...lines.map((l) => `- ${l}`),
  '',
  '## At the close',
  '',
  `${world.creatures.length} creatures alive, ${living.length} of ${sp.length} recorded species surviving, ` +
    `deepest lineage ${world.stats.generationMax} generations.` +
    (biggest ? ` The commonest creature is the ${name(biggest)}, ${biggest.population} strong.` : ''),
  '',
];
mkdirSync('chronicles', { recursive: true });
writeFileSync(`chronicles/seed-${seed}.md`, out.join('\n'));
console.log(`chronicles/seed-${seed}.md: ${lines.length} entries`);
