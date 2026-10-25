import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS, METER, scans, quatrain, poem } from '../verse/verse.js';
import { makeRng } from '../src/rng.js';

test('the lexicon is well formed', () => {
  for (const e of WORDS) {
    assert.match(e.s, /^(x|[01]+)$/, e.w);
    if (e.s.length > 1) assert.ok(e.s.includes('1'), `${e.w} has no stressed syllable`);
  }
});

test('every line is iambic pentameter and the quatrain rhymes ABAB', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const [a1, b1, a2, b2] = quatrain(makeRng(seed));
    for (const line of [a1, b1, a2, b2]) {
      assert.ok(scans(line), line.map((e) => e.w).join(' '));
      assert.equal(line.reduce((n, e) => n + e.s.length, 0), METER.length);
    }
    const end = (l) => l[l.length - 1];
    assert.equal(end(a1).r, end(a2).r);
    assert.equal(end(b1).r, end(b2).r);
    assert.notEqual(end(a1).w, end(a2).w);
    assert.notEqual(end(b1).w, end(b2).w);
  }
});

test('the same seed writes the same poem', () => {
  assert.equal(poem(7, 2), poem(7, 2));
  assert.notEqual(poem(7, 2), poem(8, 2));
});
