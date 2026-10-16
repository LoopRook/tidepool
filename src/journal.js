// The naturalist's notebook: turns simulation events into short journal lines.
// Phrasing is chosen by hashing the event, never by rng, so narrating an event
// cannot change the simulation and the same event always reads the same.
//
// The pool throws off many one-creature "species" that vanish at once, so the
// journal is selective: a new species is announced when it has established
// itself (a few births), and ephemeral forms only get the odd summary line.

// Local copy of world.js's DAY; importing world.js would risk an import cycle.
const TICKS_PER_DAY = 600;
// A daughter species is worth a line once it has this many births or this census peak.
const ESTABLISHED_BORN = 8;
const ESTABLISHED_PEAK = 5;

// Per-world memory (which prey have been taken, records broken, ...).
const memos = new WeakMap();
const orphanMemo = freshMemo();

function freshMemo() {
  return {
    announced: new Set(),     // daughter species already introduced
    preySeen: new Set(),
    predatorSeen: new Set(),
    cannibalSeen: new Set(),
    anyKill: false,
    speciations: 0,           // announced so far
    milestones: new Map(),    // speciesId -> highest milestone narrated
    oldAgeRecord: 0,
    oldAgeRecordTick: -Infinity,
    oldAgeCount: 0,
    maxAgeSeen: 0,
    nextKillMark: 0,          // index into KILL_MARKS
    nextGeneration: 0,        // index into GENERATIONS
    highs: new Map(),         // speciesId -> { pop, tick } recent high-water mark
    ephemeral: 0,             // unremarked extinctions since the last summary
    ephemeralTick: 0,
    restockTick: -1,
    firstsTick: -Infinity,    // last "first kill/loss" line, to keep them from crowding the page
  };
}

function memoFor(world) {
  if (!world || typeof world !== 'object') return orphanMemo;
  let m = memos.get(world);
  if (!m) { m = freshMemo(); memos.set(world, m); }
  return m;
}

// ---------- small text helpers ----------
function hashEvent(event, salt) {
  let h = Math.imul((event.seq | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((event.tick | 0) + salt, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

function choose(event, salt, options) {
  return options[hashEvent(event, salt) % options.length];
}

const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dayOf = (tick) => Math.floor((tick || 0) / TICKS_PER_DAY) + 1;
const article = (word) => ('AEIOUaeiou'.includes(word.charAt(0)) ? 'an' : 'a');
const withArticle = (word) => article(word) + ' ' + word;

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function numberWord(n) {
  if (n < 0 || !Number.isInteger(n)) return String(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n === 100) return 'a hundred';
  if (n % 100 === 0 && n < 1000) return ONES[n / 100] + ' hundred';
  return String(n);
}

function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][n % 10];
  return n + s;
}

function duration(ticks) {
  const days = ticks / TICKS_PER_DAY;
  if (days < 1) return 'less than a day';
  const d = Math.round(days);
  return d === 1 ? 'a single day' : numberWord(d) + ' days';
}

// Pluralise the noun of a common name: Dartfin -> Dartfins, Goby -> Gobies,
// Crimson Dartfin II -> Crimson Dartfins II.
function plural(common) {
  const m = /^(.*?)( [IVXLCDM]+)?$/.exec(common);
  const base = m[1], numeral = m[2] || '';
  let out;
  if (/(fish|fry)$/i.test(base)) out = base;
  else if (/[^aeiou]y$/i.test(base)) out = base.slice(0, -1) + 'ies';
  else if (/(s|sh|ch|x)$/i.test(base)) out = base + 'es';
  else out = base + 's';
  return out + numeral;
}

// ---------- species lookups that never throw ----------
function speciesOf(world, id) {
  try {
    const reg = world && world.species;
    if (reg && typeof reg.get === 'function' && id != null) return reg.get(id) || null;
  } catch (e) { /* a broken registry should not take the journal down */ }
  return null;
}

function allSpecies(world) {
  try {
    const reg = world && world.species;
    if (reg && typeof reg.all === 'function') return reg.all() || [];
  } catch (e) { /* see above */ }
  return [];
}

function nameOf(sp) {
  const n = sp && sp.name;
  if (!n || !n.common) return null;
  return { common: n.common, latin: (n.genus || '') + (n.epithet ? ' ' + n.epithet : '') };
}

function latinOf(sp) {
  const n = nameOf(sp);
  return n ? n.latin : 'incertae sedis';
}
function commonOf(sp) {
  const n = nameOf(sp);
  return n ? n.common : 'unrecorded creature';
}
function commonPlural(sp) {
  const n = nameOf(sp);
  return n ? plural(n.common) : 'unrecorded creatures';
}
// "the Banded Glimmerfin (Lucipinna fasciata)"
function full(sp) {
  return nameOf(sp) ? `the ${commonOf(sp)} (${latinOf(sp)})` : 'a form I failed to record';
}
// "the Banded Glimmerfins (Lucipinna fasciata)"
function fullPlural(sp) {
  return nameOf(sp) ? `the ${commonPlural(sp)} (${latinOf(sp)})` : 'some creatures I failed to record';
}

// Originals and daughters that have found their feet; everything else is noise.
function established(sp, memo) {
  if (!sp) return false;
  return sp.parentId == null || memo.announced.has(sp.id)
    || (sp.peakPopulation || 0) >= ESTABLISHED_PEAK || (sp.totalBorn || 0) >= ESTABLISHED_BORN;
}

// Introduced in the journal already (or an original), so it can be named in other lines.
function known(sp, memo) {
  return !!sp && (sp.parentId == null || memo.announced.has(sp.id));
}

function findCreature(world, id) {
  const list = world && world.creatures;
  if (!Array.isArray(list) || id == null) return null;
  for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
  return null;
}

// What sets a daughter species apart from its parent, as a sentence.
function difference(child, parent) {
  const c = child && child.pheno, p = parent && parent.pheno;
  if (!c || !p) return null;
  const options = [];
  if (p.diet < 0.5 && c.diet >= 0.5) options.push([3, 'It has acquired a taste for its neighbours.']);
  if (p.diet >= 0.5 && c.diet < 0.5) options.push([3, 'It has given up hunting for a quieter life among the algae.']);
  const size = c.radius / p.radius;
  if (size > 1.2) options.push([size - 1, 'It is noticeably larger than its forebears.']);
  if (size < 0.83) options.push([1 / size - 1, 'It is smaller and neater than its forebears.']);
  const speed = c.maxSpeed / p.maxSpeed;
  if (speed > 1.25) options.push([speed - 1, 'It is a good deal quicker.']);
  if (speed < 0.8) options.push([1 / speed - 1, 'It is altogether more leisurely.']);
  if (c.finCount > p.finCount) options.push([0.3, 'It has grown an extra pair of fins.']);
  if (c.finCount < p.finCount) options.push([0.3, 'It seems to have mislaid a pair of fins.']);
  if (c.pattern !== p.pattern) {
    const word = { spots: 'spots', stripes: 'stripes', bands: 'bands' };
    let text;
    if (p.pattern === 'plain') text = `It has taken to wearing ${word[c.pattern]}.`;
    else if (c.pattern === 'plain') text = 'It has lost its markings entirely.';
    else text = `It wears ${word[c.pattern]} where its ancestors wore ${word[p.pattern]}.`;
    options.push([0.45, text]);
  }
  const dh = Math.abs(((c.hue - p.hue + 540) % 360) - 180);
  if (dh > 60) options.push([dh / 300, 'It is a different colour altogether.']);
  if (c.tailLength / p.tailLength > 1.3) options.push([0.35, 'It sports a longer, showier tail.']);
  if (c.senseRange / p.senseRange > 1.3) options.push([0.35, 'Its senses are notably keener.']);
  if (!options.length) return null;
  options.sort((a, b) => b[0] - a[0]);
  return options[0][1];
}

// ---------- event narrators ----------
function announce(event, world, memo, D, sp) {
  memo.announced.add(sp.id);
  const parent = speciesOf(world, sp.parentId);
  const first = memo.speciations === 0;
  memo.speciations++;
  const S = full(sp);
  const since = sp.founderTick != null && dayOf(sp.founderTick) < dayOf(event.tick) ? ` since day ${dayOf(sp.founderTick)}` : '';
  if (!parent) {
    return choose(event, 1, [
      `${D} A new form has settled in: ${S}, of no parentage I can trace.`,
      `${D} Added ${S} to the notebook. Its origins are a mystery to me.`,
    ]);
  }
  const diff = difference(sp, parent);
  const extra = diff ? ' ' + diff : '';
  if (first) {
    return choose(event, 2, [
      `${D} The pool's first new species: ${S}, split from ${full(parent)}.${extra}`,
      `${D} It has happened at last. ${capFirst(S)} has branched off from ${full(parent)}.${extra}`,
    ]);
  }
  return choose(event, 3, [
    `${D} A new form has appeared: ${S}, descended from the ${commonOf(parent)}.`,
    `${D} Some of the ${commonPlural(parent)} have drifted far enough from their kin to earn a name of their own: ${S}.`,
    `${D} I am now fairly sure ${S} is its own species, an offshoot of the ${commonOf(parent)}.${extra}`,
    `${D} Entered a new species in the notebook: ${S}, daughter of the ${commonOf(parent)}.${extra}`,
    `${D} ${capFirst(S)} has been breeding true${since}; a new branch off the ${commonOf(parent)}.`,
  ]);
}

function speciation(event, world, memo, D) {
  // Daughter species are introduced once established (see birth). A parentless
  // speciation after tick 0 means the world restocked an empty pool.
  if (event.parentId != null || !(event.tick > 0) || memo.restockTick === event.tick) return null;
  memo.restockTick = event.tick;
  const sp = speciesOf(world, event.speciesId);
  if (sp) memo.announced.add(sp.id);
  return choose(event, 17, [
    `${D} The pool had emptied entirely. New stock has drifted in, ${nameOrStrangers(sp)} among them.`,
    `${D} Nothing was left alive, and then, as if on cue, fresh arrivals: ${nameOrStrangers(sp)} and others.`,
  ]);
}
const nameOrStrangers = (sp) => (sp ? full(sp) : 'strangers');

function extinction(event, world, memo, D) {
  const sp = speciesOf(world, event.speciesId);
  if (!sp) return null;
  const peak = sp.peakPopulation || 0;
  if (!established(sp, memo)) {
    // Fleeting forms get a collective shrug now and then instead of one line each.
    memo.ephemeral++;
    if (memo.ephemeral >= 12 && (event.tick || 0) - memo.ephemeralTick >= TICKS_PER_DAY * 3) {
      const n = memo.ephemeral;
      memo.ephemeral = 0;
      memo.ephemeralTick = event.tick || 0;
      return choose(event, 18, [
        `${D} Another ${numberWord(n)} fleeting forms have come and gone without my managing to sketch one. The latest was ${full(sp)}.`,
        `${D} The pool keeps trying out new shapes and discarding them; ${numberWord(n)} more short-lived offshoots since I last counted.`,
        `${D} Tallied ${numberWord(n)} would-be species that never got going. The pool is a harsh editor.`,
      ]);
    }
    return null;
  }
  const end = sp.extinctTick ?? event.tick ?? 0;
  const lasted = Math.max(0, end - (sp.founderTick || 0));
  const dur = duration(lasted);
  const S = full(sp);
  let line;
  if (peak <= 3) {
    line = choose(event, 4, [
      `${D} ${capFirst(S)} came and went in ${dur}, before I had properly sketched it.`,
      `${D} A brief experiment, ${S}: gone after ${dur}, never more than ${numberWord(peak)}.`,
    ]);
  } else {
    line = choose(event, 5, [
      `${D} The last ${commonOf(sp)} (${latinOf(sp)}) is gone. It lasted ${dur} and never numbered more than ${peak}.`,
      `${D} No ${commonPlural(sp)} left in the pool. ${capFirst(dur)} from first sighting to last; at their height there were ${peak}.`,
      `${D} I have stopped looking for ${S}; it is extinct. A run of ${dur}, peaking at ${peak}.`,
      peak >= 20
        ? `${D} ${capFirst(S)} has died out after ${dur}. ${capFirst(numberWord(peak))} at its peak, which is a respectable showing.`
        : `${D} ${capFirst(S)} has died out after ${dur}. It never managed more than ${numberWord(peak)}.`,
      `${D} Struck ${S} from the list of the living. ${capFirst(dur)}, and at best ${numberWord(peak)} of them.`,
    ]);
  }
  // Extinction with living heirs reads differently.
  const heirs = allSpecies(world).filter((s) => s && s.parentId === sp.id && s.extinctTick == null
    && s.population > 0 && established(s, memo));
  if (heirs.length) {
    const names = heirs.slice(0, 2).map((h) => `the ${commonOf(h)}`).join(' and ');
    line += ` Its line goes on in ${names}${heirs.length > 2 ? ' and others' : ''}.`;
  }
  return line;
}

function milestone(event, world, memo, D) {
  const pop = event.population | 0;
  if (pop <= 0) return null;
  const done = memo.milestones.get(event.speciesId) || 0;
  if (pop <= done) return null;
  memo.milestones.set(event.speciesId, pop);
  const sp = speciesOf(world, event.speciesId);
  const S = fullPlural(sp), Pl = commonPlural(sp), w = numberWord(pop);
  const predator = sp && sp.pheno && sp.pheno.diet > 0.5;
  if (pop >= 100) {
    return choose(event, 6, [
      `${D} ${capFirst(S)} now number ${w}. At this point they are less a species than a weather system.`,
      `${D} Over ${w} ${Pl} today. The pool is starting to look like theirs.`,
      `${D} I counted ${w} ${Pl} before giving up and calling it ${w}.`,
    ]);
  }
  return choose(event, 7, [
    `${D} ${capFirst(S)} now number ${w}, a new high.`,
    `${D} Counted ${w} ${Pl} today; they are doing well for themselves.`,
    predator
      ? `${D} ${capFirst(S)} have reached ${w}. Their prey may have opinions about this.`
      : `${D} ${capFirst(S)} have reached ${w}. The algae may have opinions about this.`,
    `${D} ${capFirst(w)} ${Pl} and counting.`,
  ]);
}

const KILL_MARKS = [10, 20, 35, 50, 75, 100, 150, 200];

function predation(event, world, memo, D) {
  const predSp = event.predatorSpecies, preySp = event.preySpecies;
  const pred = speciesOf(world, predSp), prey = speciesOf(world, preySp);
  const pc = commonOf(pred), yc = commonOf(prey);

  if (!memo.anyKill) {
    memo.anyKill = true;
    if (predSp != null) memo.predatorSeen.add(predSp);
    if (preySp != null) memo.preySeen.add(preySp);
    return choose(event, 8, [
      `${D} The first kill I have witnessed in the pool: ${full(pred)} took ${withArticle(yc)}.`,
      `${D} So it begins. ${capFirst(withArticle(pc))} (${latinOf(pred)}) has eaten ${withArticle(yc)}, and the pool is a little less innocent.`,
    ]);
  }
  // Firsts only count for species already introduced, and at most one every half day;
  // a suppressed first is still marked seen so it doesn't resurface later.
  const quiet = (event.tick || 0) - memo.firstsTick < TICKS_PER_DAY / 2;
  if (predSp != null && predSp === preySp) {
    if (memo.cannibalSeen.has(predSp) || !known(pred, memo)) return null;
    memo.cannibalSeen.add(predSp);
    if (quiet) return null;
    memo.firstsTick = event.tick || 0;
    return choose(event, 9, [
      `${D} ${capFirst(withArticle(pc))} ate one of its own. Hunger makes poor manners.`,
      `${D} Cannibalism among ${fullPlural(pred)}. I will assume times are hard.`,
    ]);
  }
  if (preySp != null && !memo.preySeen.has(preySp) && known(prey, memo)) {
    memo.preySeen.add(preySp);
    if (predSp != null) memo.predatorSeen.add(predSp);
    if (quiet) return null;
    memo.firstsTick = event.tick || 0;
    return choose(event, 10, [
      `${D} ${capFirst(withArticle(pc))} was seen taking ${withArticle(yc)}, the first of that kind I have seen fall to a predator.`,
      `${D} ${capFirst(fullPlural(prey))} have learned the hard way that the ${plural(pc)} are hungry.`,
      `${D} First recorded loss among ${fullPlural(prey)}: one went down to ${withArticle(pc)}.`,
    ]);
  }
  if (predSp != null && !memo.predatorSeen.has(predSp) && known(pred, memo)) {
    memo.predatorSeen.add(predSp);
    if (quiet) return null;
    memo.firstsTick = event.tick || 0;
    return choose(event, 11, [
      `${D} ${capFirst(full(pred))} has made its first recorded kill, ${withArticle(yc)}.`,
      `${D} Noted: the ${plural(pc)} hunt. One was seen making off with ${withArticle(yc)}.`,
    ]);
  }
  // A single prolific hunter is worth a line at round numbers.
  if (memo.nextKillMark >= KILL_MARKS.length) return null;
  const hunter = findCreature(world, event.predatorId);
  const kills = hunter && typeof hunter.kills === 'number' ? hunter.kills : 0;
  if (kills < KILL_MARKS[memo.nextKillMark]) return null;
  while (memo.nextKillMark < KILL_MARKS.length && kills >= KILL_MARKS[memo.nextKillMark]) memo.nextKillMark++;
  return choose(event, 12, [
    `${D} One ${pc} has now made ${numberWord(kills)} kills, the most of any creature I have followed.`,
    `${D} There is ${withArticle(pc)} out there with ${numberWord(kills)} kills to its name. I have started giving it a wide berth, figuratively.`,
  ]);
}

function death(event, world, memo, D) {
  const age = event.age || 0;
  if (age > memo.maxAgeSeen) memo.maxAgeSeen = age;
  const sp = speciesOf(world, event.speciesId);
  if (event.cause === 'old age') {
    const firstOld = memo.oldAgeCount === 0;
    memo.oldAgeCount++;
    // Only genuine records, spaced out a little, so the notebook isn't all obituaries.
    const record = age > memo.oldAgeRecord * 1.03 && age >= 0.85 * memo.maxAgeSeen
      && (event.tick || 0) - memo.oldAgeRecordTick >= TICKS_PER_DAY / 2;
    if (firstOld || record) {
      memo.oldAgeRecord = Math.max(memo.oldAgeRecord, age);
      memo.oldAgeRecordTick = event.tick || 0;
      const c = commonOf(sp), a = duration(age);
      if (firstOld) {
        return choose(event, 13, [
          `${D} ${capFirst(withArticle(c))} died of old age at ${a}, the first in the pool to simply run out of years.`,
          `${D} The first death from old age: ${withArticle(c)} (${latinOf(sp)}), aged ${a}.`,
        ]);
      }
      return choose(event, 14, [
        `${D} The oldest creature I have yet recorded, ${withArticle(c)} of ${a}, died quietly today.`,
        `${D} A venerable ${c} has died at ${a}. Nothing in the pool has lived longer.`,
        `${D} Old age took ${withArticle(c)} today, at a remarkable ${a}.`,
      ]);
    }
  }
  return crashCheck(event, memo, D, sp);
}

// Populations are only updated at census, so checking on deaths is cheap and timely enough.
function crashCheck(event, memo, D, sp) {
  if (!sp || typeof sp.population !== 'number') return null;
  const tick = event.tick || 0;
  const pop = sp.population;
  let hi = memo.highs.get(sp.id);
  if (!hi || pop >= hi.pop) { memo.highs.set(sp.id, { pop, tick }); return null; }
  if (tick - hi.tick > TICKS_PER_DAY * 3) {
    // A stale high decays, so a slow decline isn't reported as a crash.
    hi = { pop: Math.max(pop, Math.round(hi.pop * 0.7)), tick };
    memo.highs.set(sp.id, hi);
  }
  if (hi.pop >= 16 && pop > 0 && pop <= hi.pop * 0.35) {
    memo.highs.set(sp.id, { pop, tick });
    return crashLine(event, sp, hi.pop, pop, tick - hi.tick, D);
  }
  return null;
}

function crashLine(event, sp, from, to, ticks, D) {
  const Pl = commonPlural(sp);
  return choose(event, 15, [
    `${D} The ${Pl} have crashed, from ${from} to ${to} in ${duration(ticks)}.`,
    `${D} Hard times for ${fullPlural(sp)}: barely ${numberWord(to)} remain of the ${numberWord(from)} I counted recently.`,
    `${D} Something has gone wrong for the ${Pl}. ${capFirst(numberWord(to))} left, down from ${from}.`,
  ]);
}

const GENERATIONS = [10, 25, 50, 100, 150, 200, 300, 500, 750, 1000];

function birth(event, world, memo, D) {
  const sp = speciesOf(world, event.speciesId);
  if (sp && sp.parentId != null && !memo.announced.has(sp.id) && established(sp, memo)) {
    return announce(event, world, memo, D, sp);
  }
  const g = world && world.stats ? world.stats.generationMax : undefined;
  if (typeof g !== 'number') return null;
  let reached = 0;
  while (memo.nextGeneration < GENERATIONS.length && g >= GENERATIONS[memo.nextGeneration]) {
    reached = GENERATIONS[memo.nextGeneration++];
  }
  if (!reached) return null;
  return choose(event, 16, [
    `${D} The oldest lineages in the pool now run to ${reached} generations.`,
    `${D} Somewhere in the pool, a ${ordinal(reached)}-generation hatchling. The founders would hardly know it.`,
    `${D} Generation ${reached}. I have long since stopped drawing family trees.`,
  ]);
}

const HANDLERS = { speciation, extinction, milestone, predation, death, birth };

export function narrate(event, world) {
  if (!event || typeof event !== 'object') return null;
  try {
    const memo = memoFor(world);
    const D = `Day ${dayOf(event.tick)}.`;
    if (event.type === 'crash') {
      const sp = speciesOf(world, event.speciesId);
      if (!sp || event.from == null || event.to == null) return null;
      return crashLine(event, sp, event.from, event.to, event.ticks || 0, D);
    }
    const handler = HANDLERS[event.type];
    return handler ? handler(event, world, memo, D) : null;
  } catch (e) {
    // The journal is decoration; it must never break the simulation loop.
    return null;
  }
}
