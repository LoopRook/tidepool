// Tideverse, listening: runs a pool and writes verse about what actually happened in it.
// Each event line names a real species from that run; the meter and rhyme rules are verse.js's.
//
//   node verse/pool.js 7 60 3   -> seed 7, 60 days, three stanzas
import { createWorld, step, DAY } from '../src/world.js';
import { makeRng } from '../src/rng.js';
import { fill, render, shuffled, RHYMES, couplet } from './verse.js';

// Stress of every species noun the pool can coin (see src/species.js). Standalone
// nouns are listed whole; compounds are a head plus a root, with the root carrying
// secondary stress (x). A light third syllable may take a beat, as in "Lancelet".
const NOUNS = `Grouper:10 Wallower:10x Hulk:x Bass:x Minnow:10 Goby:10 Sprat:x Tiddler:10
Darter:10 Skipper:10 Flash:x Scud:x Drifter:10 Dawdler:10 Loafer:10 Bumbler:10 Snapper:10
Reefstalker:1x0 Lurker:10 Marauder:010 Ambusher:10x Reaver:10 Gulper:10 Shadowjaw:10x
Grazer:10 Nibbler:10 Weedpicker:1x0 Mossgleaner:1x0 Browser:10 Pipefish:1x Needlefish:10x
Eelet:10 Lancelet:10x Puffer:10 Bobber:10 Roundling:10 Dumpling:10 Watcher:10 Lookout:1x
Gazer:10 Sentinel:10x Shiner:10 Glint:x Sparkler:10 Gloamer:10 Shade:x Skulker:10 Wrasse:x
Blenny:10 Sculpin:10 Tidewalker:1x0`;
const TWO_SYLLABLE_HEADS = 'barrel boulder arrow idle dawdle razor nibble needle ribbon spindle button bobble pebble glimmer shimmer lantern'.split(' ');
const HEADS = TWO_SYLLABLE_HEADS.concat('great bulk pip mote bead speck dart flick zip quill drift loll snap fang hook grim gulp moss weed kelp wrack lance reed puff watch gaze peer wake gleam dusk murk shade gloam reef tide pool shoal brine'.split(' '));
const ROOTS = { belly: 'x0', body: 'x0' }; // every other root is one syllable

const NOUN_STRESS = new Map(NOUNS.split(/\s+/).map((t) => t.split(':')));

export function nameStress(word) {
  if (NOUN_STRESS.has(word)) return NOUN_STRESS.get(word);
  const w = word.toLowerCase().replace('-', '');
  const head = HEADS.filter((h) => w.startsWith(h)).sort((a, b) => b.length - a.length)[0];
  if (!head) return null;
  const root = w.slice(head.length);
  return (TWO_SYLLABLE_HEADS.includes(head) ? '10' : '1') + (ROOTS[root] || 'x');
}

const E = (spec, pos) => spec.trim().split(/\s+/).map((t) => {
  const [w, s, r] = t.split(':');
  return { w: w.replace(/_/g, ' '), s, pos, r: r || null };
});

const BORN = E('appears:01:ears arrives:01:ives emerges:010 begins:01:ins is_born:01:orn hatches:10 wakes:x:akes stirs:x:irs rises:10', 'V');
const GONE = E('dies:x:ies departs:01:arts is_gone:01:on fades:x:ades is_lost:01:ost passes:10 falters:10 vanishes:10x', 'V');
const THRIVE = E('thrive:x:ive gather:10 abound:01:ound flourish:10 crowd:x:owd swarm:x:arm', 'V');
const TAKES = E('takes:x:akes seizes:10 hunts:x catches:10 finds:x:inds devours:01:ours', 'V');
const LAST = E('the_final:010 the_last:01', 'F');
const NEW = E('at_last_the:010 and_now_the:010 and_then_the:010', 'F');
// Names are stressed on their first syllable, so what follows one must start on a beat.
const TAIL = E('late_at_night:101:ight far_from_shore:101:ore down_the_tide:101:ide deep_in_brine:101:ine near_the_sand:101:and near_the_stone:101:one', 'F');
const FALLS = E('falls_before:x01 is_lost_before:0101 goes_down_before:x101', 'F');
const BITE = E('bite:x:ight jaw:x:aw maw:x:aw teeth:x:eeth', 'N');
const ONE = E('a:0 one:x', 'F');

const speciesEntry = (sp, plural = false, possessive = false) => {
  const noun = sp.name.common.split(' ').pop();
  if (!nameStress(noun)) return [];
  if (possessive) return [{ w: noun + "'s", s: nameStress(noun), pos: 'Z', r: null }];
  if (!plural) return [{ w: noun, s: nameStress(noun), pos: 'Z', r: null }];
  const es = /(s|sh|ch|x|z)$/.test(noun);
  return [{ w: noun + (es ? 'es' : 's'), s: nameStress(noun) + (es ? '0' : ''), pos: 'Z', r: null }];
};

// Line shapes for each kind of event; the search keeps whichever ones scan.
export function shapes(ev) {
  const Z = speciesEntry(ev.a);
  switch (ev.kind) {
    case 'born': return [
      ['T', ...[Z], BORN, 'P', 'T', 'A?', 'N'], ['T', Z, BORN, 'P', 'T', 'N'], [NEW, Z, BORN, 'P', 'T', 'N'],
      ['P', 'T', 'A?', 'N', 'T', Z, BORN], ['P', 'T', 'N', NEW, Z, BORN], [NEW, Z, 'V', 'P', 'T', 'A?', 'N'],
      ['C?', 'T', Z, 'V', 'P', 'T', 'N'], [NEW, Z, BORN, TAIL], ['T', 'A?', Z, BORN, 'R'], ['T', Z, BORN, 'R'],
    ];
    case 'gone': return [
      [LAST, Z, GONE, 'P', 'T', 'A?', 'N'], [LAST, Z, GONE, 'P', 'T', 'N'], ['P', 'T', 'A?', 'N', LAST, Z, GONE],
      ['P', 'T', 'N', LAST, Z, GONE], ['C', LAST, Z, GONE, 'R'], [LAST, Z, GONE, 'R'], ['T', 'A?', Z, GONE, TAIL], ['T', 'A?', Z, GONE, 'R'],
    ];
    case 'thrive': {
      const Zs = speciesEntry(ev.a, true);
      return [
        ['T', Zs, THRIVE, 'P', 'T', 'A?', 'N'], ['T', Zs, THRIVE, 'P', 'T', 'N'], ['P', 'T', 'A?', 'N', 'T', Zs, THRIVE],
        ['P', 'T', 'N', 'T', 'A?', Zs, THRIVE], ['T', 'A?', Zs, THRIVE, 'R'], ['C', 'T', Zs, THRIVE, 'P', 'T', 'N'],
      ];
    }
    case 'hunt': {
      const Y = speciesEntry(ev.b);
      return [
        ['T', Z, TAKES, ONE, Y, 'P', 'T', 'N'], ['T', Z, TAKES, ONE, Y, 'R'], ['T', 'A?', Z, TAKES, ONE, Y, 'R'],
        ['P', 'T', 'N', 'T', Z, TAKES, ONE, Y], ['T', Z, TAKES, 'T', 'A?', Y, 'R'], ['C', 'T', Z, TAKES, ONE, Y, 'R'],
        ['T', Z, TAKES, 'T', Y, 'P', 'T', 'N'], ['T', Z, TAKES, ONE, Y, TAIL], ['T', Z, TAKES, 'T', Y, TAIL],
        ['T', Y, FALLS, 'T', speciesEntry(ev.a, false, true), BITE],
      ];
    }
  }
  return [];
}

// Run a pool and keep the events worth a line: species that lasted being born,
// thriving, hunting each other for the first time, and going extinct.
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

// The same selection from events someone else already collected (chronicle.js does).
export function notableEvents(raw, w) {
  const byId = new Map(w.species.all().map((s) => [s.id, s]));
  const lasting = (id) => (byId.get(id)?.peakPopulation ?? 0) >= 5;
  const seenHunt = new Set();
  const out = [];
  for (const e of raw) {
    const day = e.tick / DAY;
    if (e.type === 'speciation' && e.parentId !== null && lasting(e.speciesId)) out.push({ day, kind: 'born', a: byId.get(e.speciesId) });
    else if (e.type === 'extinction' && lasting(e.speciesId)) out.push({ day, kind: 'gone', a: byId.get(e.speciesId) });
    else if (e.type === 'milestone' && lasting(e.speciesId)) out.push({ day, kind: 'thrive', a: byId.get(e.speciesId) });
    else if (e.type === 'predation' && e.predatorSpecies !== e.preySpecies && lasting(e.predatorSpecies) && lasting(e.preySpecies)) {
      const key = e.predatorSpecies + ':' + e.preySpecies;
      if (seenHunt.has(key)) continue;
      seenHunt.add(key);
      out.push({ day, kind: 'hunt', a: byId.get(e.predatorSpecies), b: byId.get(e.preySpecies) });
    }
  }
  return out;
}

// Pick n events spread evenly through the run's days (not its event count, which
// bunches up early when every species meets every other for the first time).
function spread(events, n, days) {
  if (events.length <= n) return events;
  const chosen = new Set();
  for (let i = 0; i < n; i++) {
    const target = ((i + 0.5) * days) / n;
    let best = -1;
    for (let j = 0; j < events.length; j++) {
      if (chosen.has(j)) continue;
      if (best < 0 || Math.abs(events[j].day - target) < Math.abs(events[best].day - target)) best = j;
    }
    chosen.add(best);
  }
  return [...chosen].sort((a, b) => a - b).map((j) => events[j]);
}

// Two event lines that rhyme with each other, or null if no shared rhyme scans.
function eventPair(e1, e2, used, rng) {
  for (const rhyme of shuffled(RHYMES, rng)) {
    for (const t1 of shuffled(shapes(e1), rng)) {
      const a = fill(t1, rhyme, null, used, rng);
      if (!a) continue;
      const used2 = new Set([...used, ...a.map((e) => e.w)]);
      for (const t2 of shuffled(shapes(e2), rng)) {
        const b = fill(t2, rhyme, a[a.length - 1].w, used2, rng);
        if (b) return [a, b];
      }
    }
  }
  return null;
}

export function poolPoem(seed, days, stanzas = 3, notable = poolEvents(seed, days)) {
  const rng = makeRng(seed ^ 0x7e55);
  const events = spread(notable, stanzas * 4, days);
  const out = [], all = [];
  let told = 0;
  for (let i = 0; i + 3 < events.length || (i < events.length && out.length === 0); i += 4) {
    const ev = events.slice(i, i + 4);
    const used = new Set();
    const take = (pair) => { for (const l of pair) for (const e of l) used.add(e.w); return pair; };
    // Lines 1 and 3 rhyme, as do 2 and 4; an event that can't scan gives way to the pool's own line.
    const p1 = (ev[2] && eventPair(ev[0], ev[2], used, rng)) || take(couplet(used, rng));
    take(p1);
    const p2 = (ev[3] && eventPair(ev[1], ev[3], used, rng)) || couplet(used, rng);
    take(p2);
    told += [p1, p2].flat().filter((l) => l.some((e) => e.pos === 'Z')).length;
    all.push(p1[0], p2[0], p1[1], p2[1]);
    const lines = [p1[0], p2[0], p1[1], p2[1]].map(render);
    const from = Math.floor(ev[0].day), to = Math.floor(ev[ev.length - 1].day);
    out.push(`*Days ${from}–${to}*\n\n` + lines.map((l, j) => l + (j === 1 ? ';' : j === 3 ? '.' : ',')).join('\n'));
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
