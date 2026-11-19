// Tideverse: the pool writes rhymed iambic pentameter, with real constraints.
// Every word carries its stress pattern; a line only stands if its stresses
// fall da-DUM five times, and rhyming lines share a hand-labelled rhyme sound.
//
//   node verse/verse.js 7 3    -> three quatrains (ABAB) for seed 7 (the CLI lives there)
//
// Stress codes: 1 stressed, 0 unstressed, x a content monosyllable (fits either,
// as monosyllables do in English verse). Function words are 0 and never take a beat.
import { makeRng } from './rng.js';

export const METER = '0101010101';

// word:stress:part:rhyme   parts: D det, A adj, S creature (subject), N place or thing,
// V verb, P prep, R adverb, C conj, T the (places take only "the": no "a sand"). Repeats weight the draw ("the" is common).
const LEXICON = `
the:0:D the:0:D the:0:D a:0:D a:0:D each:0:D the:0:T
silver:10:A pale:x:A slow:x:A green:x:A small:x:A gray:x:A cold:x:A quiet:10:A
little:10:A hungry:10:A patient:10:A golden:10:A narrow:10:A shallow:10:A scarlet:10:A
gentle:10:A ancient:10:A striped:x:A restless:10:A hollow:10:A serene:01:A unhurried:010:A
minnow:10:S hunter:10:S shadow:10:S current:10:S ripple:10:S hatchling:10:S glimmer:10:S
school:x:S tide:x:S swell:x:S grazer:10:S
water:10:N algae:10:N morning:10:N surface:10:N
stone:x:N:one bone:x:N:one tide:x:N:ide weed:x:N:eed reed:x:N:eed seed:x:N:eed
sand:x:N:and strand:x:N:and shell:x:N:ell swell:x:N:ell pool:x:N:ool school:x:N:ool
light:x:N:ight night:x:N:ight brine:x:N:ine waterline:101:N:ine deep:x:N:eep
spray:x:N:ay day:x:N:ay bay:x:N:ay shore:x:N:ore floor:x:N:ore
lagoon:01:N:oon moon:x:N:oon dune:x:N:oon afternoon:101:N:oon
glow:x:N:ow flow:x:N:ow undertow:101:N:ow dark:x:N:ark
drifts:x:V turns:x:V:urns returns:01:V:urns waits:x:V:aits awaits:01:V:aits
hides:x:V:ides glides:x:V:ides slides:x:V:ides abides:01:V:ides
feeds:x:V:eeds breeds:x:V:eeds dives:x:V:ives thrives:x:V:ives
sleeps:x:V:eeps creeps:x:V:eeps sways:x:V:ays stays:x:V:ays strays:x:V:ays
bends:x:V:ends descends:01:V:ends ascends:01:V:ends remains:01:V:ains
darts:x:V:arts departs:01:V:arts dies:x:V:ies lies:x:V:ies
wanders:10:V circles:10:V lingers:10:V hovers:10:V flickers:10:V settles:10:V
scatters:10:V listens:10:V gathers:10:V
beneath:01:P below:01:P beside:01:P across:01:P along:01:P around:01:P within:01:P
under:10:P over:10:P in:0:P through:0:P by:0:P past:0:P near:0:P
slowly:10:R softly:10:R gently:10:R alone:01:R:one again:01:R:en away:01:R:ay
apart:01:R:art afar:01:R:ar still:x:R:ill
and:0:C while:0:C as:0:C
`;

export const WORDS = LEXICON.trim().split(/\s+/).map((e) => {
  const [w, s, pos, r] = e.split(':');
  return { w, s, pos, r: r || null };
});

const byPos = {};
for (const e of WORDS) (byPos[e.pos] ||= []).push(e);

// The last slot of each template ends the line and must carry the rhyme.
export const TEMPLATES = [
  'D A S V P T N',   // the silver minnow turns beneath the stone
  'P T A N D S V',   // beneath the quiet weed a hunter waits
  'D S V R P T A N', // the hunter circles slowly through the ...
  'C D A S V P T N',
  'D A S P T N V',
  'R D A S V P T N',
  'D S P T A N V R',
].map((t) => t.split(' '));

function fits(stress, at) {
  for (let i = 0; i < stress.length; i++) {
    const want = METER[at + i];
    if (want === undefined) return false;
    if (stress[i] !== 'x' && stress[i] !== want) return false;
  }
  return true;
}

// Scan a line made of lexicon entries: true if it is exact iambic pentameter.
export function scans(entries) {
  let at = 0;
  for (const e of entries) {
    if (!fits(e.s, at)) return false;
    at += e.s.length;
  }
  return at === METER.length;
}

export function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A slot is a part-of-speech code or an explicit list of entries (for event lines).
// A trailing "?" makes a slot optional ("A?" is an adjective or nothing).
const NOTHING = { w: '', s: '', pos: 'F', r: null };
const cands = (slot) => (typeof slot !== 'string' ? slot
  : slot.endsWith('?') ? [NOTHING, ...byPos[slot.slice(0, -1)]] : byPos[slot]);
const spanOf = (slot) => {
  const lens = cands(slot).map((e) => e.s.length);
  return [Math.min(...lens), Math.max(...lens)];
};
const EXEMPT = new Set(['D', 'T', 'P', 'C', 'F', 'Z']); // may repeat within a stanza

// Fill one template so it scans and ends on the given rhyme (avoiding `used` words).
// The rhyme word is placed first, at the end of the line; the rest is a search
// pruned by how many syllables the remaining slots could possibly hold.
export function fill(template, rhyme, avoidEnd, used, rng) {
  const fresh = (e) => EXEMPT.has(e.pos) || !used.has(e.w);
  const lastWord = (w) => w.split(' ').pop(); // "down the tide" ends on "tide"
  const ends = cands(template[template.length - 1]).filter((e) => e.r === rhyme
    && (!avoidEnd || lastWord(e.w) !== lastWord(avoidEnd)) && fresh(e)
    && fits(e.s, METER.length - e.s.length));
  const body = template.slice(0, -1);
  const minRest = [], maxRest = [];
  for (let i = body.length, lo = 0, hi = 0; i >= 0; i--) {
    minRest[i] = lo; maxRest[i] = hi;
    if (i > 0) { const [a, b] = spanOf(body[i - 1]); lo += a; hi += b; }
  }
  for (const end of shuffled(ends, rng)) {
    const goal = METER.length - end.s.length;
    const out = [];
    const go = (slot, at) => {
      if (slot === body.length) return at === goal;
      if (at + minRest[slot] > goal || at + maxRest[slot] < goal) return false;
      for (const e of shuffled(cands(body[slot]), rng)) {
        if (!fresh(e) || (!EXEMPT.has(e.pos) && (out.some((o) => o.w === e.w) || e.w === end.w)) || !fits(e.s, at)) continue;
        out.push(e);
        if (go(slot + 1, at + e.s.length)) return true;
        out.pop();
      }
      return false;
    };
    if (go(0, 0)) return [...out, end];
  }
  return null;
}

export function render(entries) {
  const words = entries.map((e) => e.w).filter(Boolean);
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === 'a' && /^[aeiou]/i.test(words[i + 1])) words[i] = 'an';
  }
  const s = words.join(' ');
  return s[0].toUpperCase() + s.slice(1);
}

export const RHYMES = [...new Set(WORDS.filter((e) => e.r).map((e) => e.r))];

// One rhymed line pair on a random sound; returns [lineA, lineB] as entry arrays.
export function couplet(used, rng, avoid = null) {
  for (const rhyme of shuffled(RHYMES, rng)) {
    if (rhyme === avoid) continue; // ABAB: the B pair must not reuse the A sound
    for (const ta of shuffled(TEMPLATES, rng)) {
      const a = fill(ta, rhyme, null, used, rng);
      if (!a) continue;
      const end = a[a.length - 1].w;
      const used2 = new Set([...used, ...a.map((e) => e.w)]);
      for (const tb of shuffled(TEMPLATES, rng)) {
        const b = fill(tb, rhyme, end, used2, rng);
        if (b) return [a, b];
      }
    }
  }
  throw new Error('no couplet found');
}

// A quatrain rhymed ABAB, as arrays of lexicon entries.
export function quatrain(rng) {
  const used = new Set();
  const take = (lines) => { for (const l of lines) for (const e of l) used.add(e.w); return lines; };
  const [a1, a2] = take(couplet(used, rng));
  const [b1, b2] = take(couplet(used, rng, a1[a1.length - 1].r));
  return [a1, b1, a2, b2];
}

export function poem(seed, stanzas = 1) {
  const rng = makeRng(seed);
  const out = [];
  for (let i = 0; i < stanzas; i++) {
    const lines = quatrain(rng).map(render);
    out.push(lines.map((l, j) => l + (j === 1 ? ';' : j === 3 ? '.' : ',')).join('\n'));
  }
  return out.join('\n\n');
}
