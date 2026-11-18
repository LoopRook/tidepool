// Tideverse, listening, offline: runs a pool and writes verse about what happened in it.
// The verse itself lives in src/poolverse.js (the page uses it live).
//
//   node verse/pool.js 7 60 3   -> seed 7, 60 days, three stanzas
import { createWorld, step, DAY } from '../src/world.js';
import { makeRng } from '../src/rng.js';
import { notableEvents, spread, stanza } from '../src/poolverse.js';

export { nameStress, notableEvents } from '../src/poolverse.js';

export function poolEvents(seed, days) {
  const w = createWorld({ seed });
  const raw = [];
  let last = 0;
  for (let t = 0; t < days * DAY; t++) {
    step(w);
    for (const e of w.events) if (e.seq > last) raw.push(e);
    last = w.eventSeq;
  }
  return notableEvents(raw, w);
}

export function poolPoem(seed, days, stanzas = 3, notable = poolEvents(seed, days)) {
  const rng = makeRng(seed ^ 0x7e55);
  const events = spread(notable, stanzas * 4, 0, days);
  const out = [], all = [];
  let told = 0;
  for (let i = 0; i + 3 < events.length || (i < events.length && out.length === 0); i += 4) {
    const ev = events.slice(i, i + 4);
    const { text, told: t, entries } = stanza(ev, rng);
    told += t;
    all.push(...entries);
    const from = Math.floor(ev[0].day), to = Math.floor(ev[ev.length - 1].day);
    out.push(`*Days ${from}–${to}*\n\n` + text);
  }
  return { text: out.join('\n\n'), told, events: events.length, lines: all };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('verse/pool.js')) {
  const seed = Number(process.argv[2] ?? 7);
  const days = Number(process.argv[3] ?? 60);
  const n = Number(process.argv[4] ?? 3);
  const { text, told, events } = poolPoem(seed, days, n);
  console.log(`Tideverse: the pool of seed ${seed}\n\n${text}\n\n(${told} of ${events} lines are about real events)`);
}
