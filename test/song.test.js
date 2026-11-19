import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compose, listen } from '../song/song.js';

// Length of a bar in eighths (L:1/8), ignoring annotations; a bare note is one eighth.
function eighths(bar) {
  return bar.replace(/"[^"]*"/g, '').trim().split(/\s+/)
    .reduce((sum, n) => sum + Number(n.match(/(\d*)$/)[1] || 1), 0);
}

function bars(abc, voice) {
  const body = abc.split(`[V:${voice}]`)[1].split('[V:')[0];
  return body.replace(/\|\]/g, '|').split('|').map((b) => b.trim()).filter(Boolean);
}

test('every bar of a real pool\'s song is four beats long, in both voices', () => {
  const abc = compose(3, 4);
  for (const v of [1, 2]) {
    const bs = bars(abc, v);
    assert.equal(bs.length, 4);
    for (const b of bs) assert.equal(eighths(b), 8, `voice ${v}: "${b}"`);
  }
  assert.match(abc, /\|\]\s*\[V:2\]/);
});

test('the same seed sings the same song', () => {
  assert.equal(compose(3, 2), compose(3, 2));
});

test('the bass rests when the hunters are gone, and a calm pool holds its note', () => {
  const beats = [];
  for (let i = 0; i < 8; i++) beats.push({ grazers: i < 4 ? 100 : 100 + i * 40, hunters: i < 4 ? 5 : 0 });
  const abc = compose(1, 2, { beats, marks: [{ day: 1.2, kind: 'gone', a: { name: { common: 'Red-striped Snapper' } } }] });
  const [m, b] = [bars(abc, 1), bars(abc, 2)];
  assert.equal(b[1], 'z8');
  assert.notEqual(b[0], 'z8');
  assert.match(m[0], /^\S+8$/);
  assert.match(m[1], /^"\^-Snapper"/);
  for (const bar of [...m, ...b]) assert.equal(eighths(bar), 8);
});

test('listen samples four beats a day', () => {
  assert.equal(listen(2, 1).beats.length, 4);
});
