// Seeded PRNG (mulberry32). Every source of randomness in the simulation goes
// through one of these so a seed reproduces a whole world exactly.

export function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  return {
    next,
    // integer in [0, n)
    int: (n) => Math.floor(next() * n),
    // float in [a, b)
    range: (a, b) => a + (b - a) * next(),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    // standard normal via Box-Muller
    gauss() {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let u = 0, v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      const m = Math.sqrt(-2 * Math.log(u));
      spare = m * Math.sin(2 * Math.PI * v);
      return m * Math.cos(2 * Math.PI * v);
    },
    // independent child stream, deterministic given this stream's state
    fork: () => makeRng(Math.floor(next() * 4294967296)),
    get state() { return s; },
  };
}
