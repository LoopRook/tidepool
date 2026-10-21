import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dsin, dcos, datan2, dlog, dexp, dtanh, dpow } from '../src/dmath.js';
import { makeRng } from '../src/rng.js';

const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

test('deterministic maths agrees with Math to ~1e-14', () => {
  const rng = makeRng(42);
  for (let i = 0; i < 5000; i++) {
    const x = rng.range(-60, 60), y = rng.range(-5, 5), u = rng.next() + 1e-9;
    close(dsin(x), Math.sin(x), 1e-14, `sin ${x}`);
    close(dcos(x), Math.cos(x), 1e-14, `cos ${x}`);
    close(datan2(y, x), Math.atan2(y, x), 1e-14, `atan2 ${y},${x}`);
    close(dlog(u * 1e3), Math.log(u * 1e3), 1e-14, `log ${u}`);
    close(dexp(y * 8), Math.exp(y * 8), 1e-14, `exp ${y}`);
    close(dtanh(y * 3), Math.tanh(y * 3), 1e-14, `tanh ${y}`);
    close(dpow(u, 1.5), Math.pow(u, 1.5), 1e-14, `pow ${u}`);
    close(dpow(u, 0.7), Math.pow(u, 0.7), 1e-14, `pow ${u}`);
  }
});

test('deterministic maths handles the edges', () => {
  assert.equal(datan2(0, 0), 0);
  close(datan2(1, 0), Math.PI / 2, 1e-15, 'atan2 up');
  close(datan2(0, -1), Math.PI, 1e-15, 'atan2 left');
  assert.equal(dlog(0), -Infinity);
  assert.equal(dlog(1), 0);
  assert.equal(dtanh(50), 1);
  assert.equal(dtanh(-50), -1);
  assert.equal(dpow(0, 1.5), 0);
  assert.equal(dexp(0), 1);
});
