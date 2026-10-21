// Deterministic maths for the simulation. JavaScript only promises exact results for
// + - * / and sqrt; Math.sin, cos, atan2, log, exp and tanh may differ in the last bit
// between engines, and a chaotic pool turns one bit into a different world. These
// use nothing but exact operations, so a seed replays identically in every browser.
// Accurate to ~1e-15, plenty for fish.

const PI = Math.PI, TAU = 2 * Math.PI, HALF_PI = Math.PI / 2;
const LN2 = 0.6931471805599453;

// Taylor series on [-pi/4, pi/4]; terms up to x^17 leave error below 1e-16.
function sinCore(x) {
  const x2 = x * x;
  let t = x, s = x;
  for (let k = 2; k <= 16; k += 2) { t *= -x2 / (k * (k + 1)); s += t; }
  return s;
}
function cosCore(x) {
  const x2 = x * x;
  let t = 1, s = 1;
  for (let k = 1; k <= 15; k += 2) { t *= -x2 / (k * (k + 1)); s += t; }
  return s;
}

// Reduce to [-pi, pi], then to an octant around 0, +-pi/2 or pi.
function octant(x) {
  x -= TAU * Math.round(x / TAU);
  const q = Math.round(x / HALF_PI); // -2..2
  return [q, x - q * HALF_PI];
}

export function dsin(x) {
  const [q, r] = octant(x);
  switch (q) {
    case 0: return sinCore(r);
    case 1: return cosCore(r);
    case -1: return -cosCore(r);
    default: return -sinCore(r); // +-2: sin(r +- pi) = -sin r
  }
}

export function dcos(x) {
  const [q, r] = octant(x);
  switch (q) {
    case 0: return cosCore(r);
    case 1: return -sinCore(r);
    case -1: return sinCore(r);
    default: return -cosCore(r);
  }
}

// atan on [0, 1]: halve the angle once (|z| <= tan(pi/8) ~ 0.414), then the series.
function atanUnit(x) {
  const z = x / (1 + Math.sqrt(1 + x * x));
  const z2 = z * z;
  let t = z, s = z;
  for (let k = 3; k <= 41; k += 2) { t *= -z2; s += t / k; }
  return 2 * s;
}

export function datan2(y, x) {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x), ay = Math.abs(y);
  let a = ay <= ax ? atanUnit(ay / ax) : HALF_PI - atanUnit(ax / ay);
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}

export function dlog(x) {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  if (x === Infinity) return Infinity;
  // x = m * 2^e with m in [0.75, 1.5); scaling by 2 is exact.
  let e = 0;
  while (x >= 1.5) { x *= 0.5; e++; }
  while (x < 0.75) { x *= 2; e--; }
  // log m = 2 atanh(z), z = (m - 1) / (m + 1), |z| <= 0.2
  const z = (x - 1) / (x + 1), z2 = z * z;
  let t = z, s = z;
  for (let k = 3; k <= 31; k += 2) { t *= z2; s += t / k; }
  return 2 * s + e * LN2;
}

export function dexp(x) {
  if (x > 709) return Infinity;
  if (x < -745) return 0;
  const k = Math.round(x / LN2);
  const r = x - k * LN2; // |r| <= ~0.35
  let t = 1, s = 1;
  for (let n = 1; n <= 20; n++) { t *= r / n; s += t; }
  // times 2^k, one exact doubling or halving at a time (|k| stays small here)
  for (let p = k; p > 0; p--) s *= 2;
  for (let p = k; p < 0; p++) s *= 0.5;
  return s;
}

export function dtanh(x) {
  if (x > 20) return 1;
  if (x < -20) return -1;
  const e = dexp(2 * x);
  return (e - 1) / (e + 1);
}

// x^y for x >= 0
export function dpow(x, y) {
  if (x === 0) return y > 0 ? 0 : y === 0 ? 1 : Infinity;
  if (y === 1) return x;
  if (y === 1.5) return x * Math.sqrt(x);
  return dexp(y * dlog(x));
}
