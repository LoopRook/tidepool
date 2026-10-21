// Species registry and procedural naming. A species is just a founder genome;
// newborns join their parent's species unless they have drifted too far.
import { distance } from './genome.js';
import { dpow } from './dmath.js';

export const SPECIES_THRESHOLD = 0.12;

// ---------- Latin adjective helpers (feminine / masculine / neuter) ----------
// Cheap gender agreement: every epithet is stored in all three forms and the
// genus suffix decides which one is used.
const a1 = (stem) => ({ f: stem + 'a', m: stem + 'us', n: stem + 'um' });
const ra = (stem, masc) => ({ f: stem + 'ra', m: masc, n: stem + 'rum' }); // ruber/rubra/rubrum
const is3 = (stem) => ({ f: stem + 'is', m: stem + 'is', n: stem + 'e' }); // viridis/viride
const inv = (w) => ({ f: w, m: w, n: w });

// ---------- Genus: prefix from the most striking body feature ----------
// Each feature carries Latin/Greek combining forms plus English words for the
// common name, so "Veloci-pinna" and "Dart-fin" come from the same choice.
const FEATURES = {
  big: { latin: ['Magno', 'Megalo', 'Grandi', 'Macro', 'Ingenti'], heads: ['Great', 'Barrel', 'Boulder', 'Bulk'], nouns: ['Grouper', 'Wallower', 'Hulk', 'Bass'] },
  small: { latin: ['Micro', 'Parvi', 'Nano', 'Minuti', 'Pusilli'], heads: ['Pip', 'Mote', 'Bead', 'Speck'], nouns: ['Minnow', 'Goby', 'Sprat', 'Tiddler'] },
  fast: { latin: ['Veloci', 'Tachy', 'Celeri', 'Ocy', 'Dromo'], heads: ['Dart', 'Flick', 'Arrow', 'Zip', 'Quill'], nouns: ['Darter', 'Skipper', 'Flash', 'Scud'] },
  slow: { latin: ['Brady', 'Lento', 'Tardi', 'Segni'], heads: ['Drift', 'Loll', 'Idle', 'Dawdle'], nouns: ['Drifter', 'Dawdler', 'Loafer', 'Bumbler'] },
  predator: { latin: ['Lyco', 'Carno', 'Harpago', 'Sarco', 'Lamio', 'Thero', 'Dino'], heads: ['Snap', 'Fang', 'Hook', 'Razor', 'Grim', 'Gulp'], nouns: ['Snapper', 'Reefstalker', 'Lurker', 'Marauder', 'Ambusher', 'Reaver', 'Gulper', 'Shadowjaw'] },
  grazer: { latin: ['Phyco', 'Algi', 'Phyto', 'Herbi', 'Bryo'], heads: ['Moss', 'Weed', 'Kelp', 'Nibble', 'Wrack'], nouns: ['Grazer', 'Nibbler', 'Weedpicker', 'Mossgleaner', 'Browser'] },
  long: { latin: ['Dolicho', 'Longi', 'Steno', 'Tenui', 'Belono'], heads: ['Needle', 'Ribbon', 'Lance', 'Reed', 'Spindle'], nouns: ['Pipefish', 'Needlefish', 'Eelet', 'Lancelet'] },
  round: { latin: ['Brachy', 'Globi', 'Cyclo', 'Orbi', 'Sphaero'], heads: ['Puff', 'Button', 'Bobble', 'Pebble'], nouns: ['Puffer', 'Bobber', 'Roundling', 'Dumpling'] },
  keen: { latin: ['Scopo', 'Oculi', 'Ophthalmo', 'Argo'], heads: ['Watch', 'Gaze', 'Peer', 'Wake'], nouns: ['Watcher', 'Lookout', 'Gazer', 'Sentinel'] },
  bright: { latin: ['Luci', 'Lampro', 'Photo', 'Fulgi'], heads: ['Glimmer', 'Shimmer', 'Lantern', 'Gleam'], nouns: ['Shiner', 'Glint', 'Sparkler'] },
  dark: { latin: ['Scoto', 'Nycto', 'Umbri', 'Melano'], heads: ['Dusk', 'Murk', 'Shade', 'Gloam'], nouns: ['Gloamer', 'Shade', 'Skulker'] },
  sea: { latin: ['Thalasso', 'Hali', 'Pelago', 'Litori', 'Aesto'], heads: ['Reef', 'Tide', 'Pool', 'Shoal', 'Brine'], nouns: ['Wrasse', 'Blenny', 'Sculpin', 'Shiner', 'Tidewalker'] },
};

// ---------- Genus: suffix from fins / tail / jaws ----------
const SUFFIXES = {
  fins: { latin: [['pinna', 'f'], ['pteryx', 'f'], ['pterus', 'm']], roots: ['fin', 'fin', 'sail', 'wing'] },
  finless: { latin: [['soma', 'n'], ['nectes', 'm']], roots: ['back', 'belly', 'body'] },
  tail: { latin: [['cauda', 'f'], ['urus', 'm']], roots: ['tail', 'whip', 'plume'] },
  jaw: { latin: [['odon', 'm'], ['gnathus', 'm'], ['stoma', 'n']], roots: ['jaw', 'tooth', 'maw', 'fang'] },
  generic: { latin: [['ichthys', 'm'], ['nectes', 'm'], ['lepis', 'f'], ['cephalus', 'm'], ['pinna', 'f']], roots: ['scale', 'gill', 'snout', 'fin'] },
};

// ---------- Epithets: colour, tone, pattern ----------
// Hue bands: [maxHue, latin adjectives, English adjectives, combining form, English combining word]
const HUES = [
  [14, [ra('rub', 'ruber'), a1('coccine'), a1('sanguine')], ['Crimson', 'Scarlet', 'Red', 'Ruby'], 'rubro', 'Red'],
  [38, [a1('auranti'), a1('igne'), a1('cupre')], ['Amber', 'Tangerine', 'Ember', 'Copper'], 'aurantio', 'Amber'],
  [64, [a1('flav'), a1('lute'), a1('aure')], ['Golden', 'Saffron', 'Yellow', 'Gilded'], 'flavo', 'Gold'],
  [95, [a1('chlor'), a1('olivace'), a1('galbin')], ['Lime', 'Olive', 'Chartreuse'], 'chloro', 'Olive'],
  [150, [is3('virid'), a1('smaragdin'), a1('prasin')], ['Green', 'Emerald', 'Jade', 'Verdant'], 'viridi', 'Green'],
  [190, [a1('thalassin'), a1('glauc'), a1('aeruginos')], ['Teal', 'Seaglass', 'Verdigris', 'Lagoon'], 'glauco', 'Teal'],
  [232, [a1('caerule'), a1('cyane'), a1('azure')], ['Azure', 'Cerulean', 'Blue', 'Cornflower'], 'cyano', 'Blue'],
  [262, [a1('cobaltin'), a1('sapphirin'), a1('lazulin')], ['Indigo', 'Cobalt', 'Sapphire', 'Midnight'], 'caeruleo', 'Indigo'],
  [292, [a1('violace'), a1('ianthin'), a1('amethystin')], ['Violet', 'Amethyst', 'Lilac'], 'ianthino', 'Violet'],
  [330, [a1('purpure'), a1('porphyre'), a1('murice')], ['Purple', 'Magenta', 'Orchid', 'Plum'], 'purpureo', 'Purple'],
  [361, [a1('rose'), a1('rhodin'), a1('carne')], ['Rose', 'Blush', 'Pink', 'Coral'], 'roseo', 'Rose'],
];
const TONES = {
  light: [[a1('alb'), a1('pallid'), a1('lacte'), a1('argente')], ['Pale', 'Ghost', 'Silver', 'Pearl', 'Milky'], 'albo', 'White'],
  dark: [[ra('nig', 'niger'), a1('fusc'), ra('at', 'ater'), a1('obscur')], ['Dusky', 'Sooty', 'Black', 'Inky', 'Shadow'], 'nigro', 'Black'],
  grey: [[a1('cinere'), a1('grise'), a1('livid'), a1('plumbe')], ['Ashen', 'Grey', 'Slate', 'Leaden', 'Smoky'], 'griseo', 'Grey'],
};
// Pattern epithets: [latin participle stems, English adjectives, English compound suffixes]
const PATTERNS = {
  spots: [['maculat', 'punctat', 'guttat', 'ocellat', 'stellat'], ['Spotted', 'Speckled', 'Freckled', 'Dappled'], ['spotted', 'speckled', 'flecked']],
  stripes: [['striat', 'lineat', 'vittat', 'virgat'], ['Striped', 'Lined', 'Pinstriped', 'Streaked'], ['striped', 'lined', 'streaked']],
  bands: [['fasciat', 'zonat', 'cinct', 'annulat'], ['Banded', 'Barred', 'Belted', 'Ringed'], ['banded', 'barred', 'belted']],
};
const PLAIN = [[inv('concolor'), inv('simplex'), a1('nud'), is3('lev')], ['Plain', 'Smooth', 'Drab']];
const FIERCE = [[inv('ferox'), inv('vorax'), inv('rapax'), a1('dir')], ['Fierce', 'Ravening', 'Greedy', 'Dire']];

const SIZE_SMALL = ['Lesser', 'Dwarf', 'Pygmy', 'Little'];
const SIZE_BIG = ['Greater', 'Giant', 'Great', 'Grand'];

// Used only to break name collisions inside one registry.
const VARIANTS = [
  [is3('boreal'), 'Northern'], [is3('austral'), 'Southern'], [is3('occidental'), 'Western'],
  [is3('oriental'), 'Eastern'], [is3('litoral'), 'Shore'], [a1('profund'), 'Deepwater'],
  [a1('nov'), 'New'], [is3('vadal'), 'Shallows'], [a1('serotin'), 'Late'], [a1('vespertin'), 'Evening'],
];

// ---------- helpers ----------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const VOWELS = 'aeiou';

function weightedPick(rng, entries) {
  let total = 0;
  for (const e of entries) total += e[1];
  let r = rng.next() * total;
  for (const e of entries) {
    r -= e[1];
    if (r <= 0) return e[0];
  }
  return entries[entries.length - 1][0];
}

// Elide the prefix's linking vowel before a vowel-initial suffix: Megalo+odon -> Megalodon.
function joinLatin(prefix, suffix) {
  if (VOWELS.includes(suffix[0]) && VOWELS.includes(prefix[prefix.length - 1])) prefix = prefix.slice(0, -1);
  return prefix + suffix;
}

function joinEnglish(head, root) {
  const h = head.toLowerCase();
  if (h.endsWith(root) || root.startsWith(h)) return head + 'fin';
  return head + (h[h.length - 1] === root[0] ? '-' : '') + root;
}

function hueBand(h) {
  h = ((h % 360) + 360) % 360;
  for (const band of HUES) if (h < band[0]) return band;
  return HUES[HUES.length - 1];
}

// Salience of each body-plan feature, 0..~1; only features that actually stand out are listed.
function bodyFeatures(p) {
  const size = clamp01((p.radius - 3) / 11);
  const speed = clamp01((p.maxSpeed - 0.6) / 2.6);
  const aspect = clamp01((p.bodyAspect - 1) / 1.4);
  const sense = clamp01((p.senseRange - 30) / 140);
  const out = [['sea', 0.12]];
  if (size > 0.58) out.push(['big', (size - 0.45) * 1.6]);
  if (size < 0.36) out.push(['small', (0.5 - size) * 1.6]);
  if (speed > 0.6) out.push(['fast', (speed - 0.45) * 1.6]);
  if (speed < 0.3) out.push(['slow', (0.45 - speed) * 1.4]);
  if (p.diet > 0.55) out.push(['predator', (p.diet - 0.35) * 2.4]);
  if (p.diet < 0.22) out.push(['grazer', (0.35 - p.diet) * 1.5]);
  if (aspect > 0.62) out.push(['long', (aspect - 0.45) * 1.5]);
  if (aspect < 0.22) out.push(['round', (0.4 - aspect) * 1.5]);
  if (sense > 0.72) out.push(['keen', (sense - 0.5) * 1.2]);
  if (p.lightness > 64) out.push(['bright', (p.lightness - 58) / 16]);
  if (p.lightness < 46) out.push(['dark', (52 - p.lightness) / 14]);
  return out;
}

function suffixGroups(p) {
  const tail = clamp01((p.tailLength - 0.4) / 1.2);
  const out = [['generic', 0.35]];
  if (p.finCount >= 3) out.push(['fins', p.finCount / 4]);
  else if (p.finCount >= 1) out.push(['fins', 0.15]);
  else out.push(['finless', 0.7]);
  if (tail > 0.6) out.push(['tail', tail]);
  if (p.diet > 0.5) out.push(['jaw', p.diet * 1.3]);
  return out;
}

// Pick a colour descriptor: [latin adjectives, English adjectives, combo latin, combo English].
function colourOf(rng, hue, sat, light) {
  if (sat < 45) return light >= 64 ? TONES.light : light <= 45 ? TONES.dark : TONES.grey;
  if (light >= 67 && rng.chance(0.5)) return TONES.light;
  if (light <= 44 && rng.chance(0.5)) return TONES.dark;
  const b = hueBand(hue);
  return [b[1], b[2], b[3], b[4]];
}

// Full name with grammatical gender kept, for the registry's collision handling.
function makeName(rng, p) {
  const feature = weightedPick(rng, bodyFeatures(p).map(([k, s]) => [k, dpow(Math.max(s, 0.01), 1.5)]));
  const group = weightedPick(rng, suffixGroups(p).map(([k, s]) => [k, dpow(Math.max(s, 0.01), 1.5)]));
  const F = FEATURES[feature];
  const S = SUFFIXES[group];

  let latinSuffixes = S.latin;
  if (p.finCount === 0) latinSuffixes = latinSuffixes.filter((s) => !s[0].startsWith('pin'));
  const [suffix, gender] = rng.pick(latinSuffixes);
  const genus = joinLatin(rng.pick(F.latin), suffix);

  // Common-name noun: a compound ("Dartfin") or a standalone field-guide noun ("Snapper").
  // Hunters always get a hunter's noun or jaw, whatever feature named the genus.
  let noun;
  const hunter = p.diet > 0.6 && feature !== 'predator';
  const standaloneChance = feature === 'predator' ? 0.6 : 0.35;
  if (rng.chance(standaloneChance)) noun = rng.pick(hunter && rng.chance(0.6) ? FEATURES.predator.nouns : F.nouns);
  else {
    let roots = hunter && group !== 'jaw' && rng.chance(0.6) ? SUFFIXES.jaw.roots : S.roots;
    if (p.finCount === 0) roots = roots.filter((r) => r !== 'fin' && r !== 'sail' && r !== 'wing');
    noun = joinEnglish(rng.pick(F.heads), rng.pick(roots.length ? roots : ['back']));
  }

  // Epithet + matching English adjective, chosen from one theme so they agree.
  let epithetForms, adjective;
  const pat = PATTERNS[p.pattern];
  const r = rng.next();
  if (p.diet > 0.75 && r < 0.14) {
    epithetForms = rng.pick(FIERCE[0]);
    adjective = rng.pick(FIERCE[1]);
  } else if (pat && r < 0.5) {
    epithetForms = a1(rng.pick(pat[0]));
    adjective = rng.pick(pat[1]);
  } else if (pat && r < 0.78) {
    // Pattern colour named in a compound: nigromaculata / "Black-spotted".
    const c = colourOf(rng, p.patternHue, p.saturation, 56);
    epithetForms = a1(c[2] + rng.pick(pat[0]));
    adjective = c[3] + '-' + rng.pick(pat[2]);
  } else if (!pat && r < 0.12) {
    epithetForms = rng.pick(PLAIN[0]);
    adjective = rng.pick(PLAIN[1]);
  } else {
    const c = colourOf(rng, p.hue, p.saturation, p.lightness);
    epithetForms = rng.pick(c[0]);
    adjective = rng.pick(c[1]);
  }

  let sizeWord = '';
  if (p.radius < 5.5 && feature !== 'small' && rng.chance(0.4)) sizeWord = rng.pick(SIZE_SMALL) + ' ';
  else if (p.radius > 11 && feature !== 'big' && rng.chance(0.4)) sizeWord = rng.pick(SIZE_BIG) + ' ';

  return { genus, epithet: epithetForms[gender], common: sizeWord + adjective + ' ' + noun, gender };
}

export function binomialName(rng, pheno) {
  const { genus, epithet, common } = makeName(rng, pheno);
  return { genus, epithet, common };
}

function roman(n) {
  const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of table) while (n >= v) { s += r; n -= v; }
  return s;
}

export function createRegistry(rng) {
  // A private stream so naming never perturbs the caller's simulation randomness.
  const nameRng = rng.fork();
  const list = [];
  const byId = new Map();
  const usedLatin = new Set();
  const usedCommon = new Set();
  let nextId = 1;

  const taken = (n) => usedLatin.has(n.genus + ' ' + n.epithet) || usedCommon.has(n.common);

  function uniqueName(pheno) {
    let first = null;
    for (let i = 0; i < 4; i++) {
      const n = makeName(nameRng, pheno);
      if (!first) first = n;
      if (!taken(n)) return n;
    }
    // Reroll failed: try a geographic-sounding variety, then Roman numerals.
    const start = nameRng.int(VARIANTS.length);
    for (let i = 0; i < VARIANTS.length; i++) {
      const [forms, eng] = VARIANTS[(start + i) % VARIANTS.length];
      const n = { genus: first.genus, epithet: first.epithet + ' ' + forms[first.gender], common: eng + ' ' + first.common };
      if (!taken(n)) return n;
    }
    for (let k = 2; ; k++) {
      const n = { genus: first.genus, epithet: first.epithet + ' ' + roman(k), common: first.common + ' ' + roman(k) };
      if (!taken(n)) return n;
    }
  }

  function found(genome, pheno, tick, parentId = null) {
    const n = uniqueName(pheno);
    usedLatin.add(n.genus + ' ' + n.epithet);
    usedCommon.add(n.common);
    const sp = {
      id: nextId++,
      name: { genus: n.genus, epithet: n.epithet, common: n.common },
      hue: pheno.hue,
      founderTick: tick,
      parentId: parentId ?? null,
      representative: genome,
      pheno, // founder phenotype, handy for portraits and the journal
      population: 0,
      peakPopulation: 0,
      peakTick: tick,
      totalBorn: 0,
      extinctTick: null,
    };
    list.push(sp);
    byId.set(sp.id, sp);
    return sp;
  }

  function classify(genome, pheno, parentSpeciesId, tick) {
    const parent = parentSpeciesId == null ? undefined : byId.get(parentSpeciesId);
    if (parent && distance(genome, parent.representative) < SPECIES_THRESHOLD) {
      parent.totalBorn++;
      return { id: parent.id, isNew: false };
    }
    const sp = found(genome, pheno, tick, parent ? parent.id : null);
    sp.totalBorn = 1;
    return { id: sp.id, isNew: true };
  }

  function census(creatures, tick) {
    const counts = new Map();
    for (const c of creatures) {
      if (c && c.alive !== false) counts.set(c.speciesId, (counts.get(c.speciesId) || 0) + 1);
    }
    const events = [];
    for (const sp of list) {
      const n = counts.get(sp.id) || 0;
      if (sp.extinctTick !== null) {
        // A reseed can bring a lost species back; let it live again rather than miscount.
        if (n === 0) continue;
        sp.extinctTick = null;
      }
      sp.population = n;
      if (n > sp.peakPopulation) { sp.peakPopulation = n; sp.peakTick = tick; }
      if (n === 0 && tick - sp.founderTick >= 1) {
        sp.extinctTick = tick;
        events.push({ type: 'extinction', tick, speciesId: sp.id });
      }
    }
    return events;
  }

  return {
    found,
    classify,
    census,
    get: (id) => byId.get(id),
    all: () => list.slice(),
    // Population 0 without extinction only happens for a species founded on a census tick,
    // which DESIGN.md counts as living ("not yet censused since founding").
    living: () => list.filter((sp) => sp.extinctTick === null),
  };
}
