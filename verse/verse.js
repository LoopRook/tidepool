// Tideverse CLI: node verse/verse.js [seed=7] [stanzas=2]. The verse lives in src/verse.js.
import { poem } from '../src/verse.js';

const seed = Number(process.argv[2] ?? 7);
const n = Number(process.argv[3] ?? 2);
console.log(`Tideverse, seed ${seed}\n\n${poem(seed, n)}`);
