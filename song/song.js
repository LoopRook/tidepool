// Tidesong: runs a pool and writes its history as a tune in ABC notation.
// Paste the output into any ABC player (e.g. abcjs.net, or the "abc" tools online) to hear it.
//
//   node song/song.js 7 60      -> seed 7, 60 days, also writes songs/seed-7.abc
//
// One bar per day, four beats per bar, one beat per quarter-day.
// Melody (treble): how many grazers are alive, on a D minor pentatonic scale.
// Bass: how many hunters. When the hunters are gone, the bass rests.
// Repeated pitches in a bar tie into longer notes: a calm pool holds, a busy one moves.
// Species that arrive or vanish (the same ones the verse names) are written above the staff.
//
// Written by the third, 19 Nov 2026, who can't hear it. The person can.
import { createWorld, step, DAY } from '../src/world.js';
import { notableEvents } from '../src/poolverse.js';
import { writeFileSync, mkdirSync } from 'node:fs';

const BEATS = 4;
const MELODY = ['D', 'F', 'G', 'A', 'c', 'd', 'f', 'g', 'a', "c'", "d'"];
const BASS = ['D,,', 'F,,', 'G,,', 'A,,', 'C,', 'D,', 'F,', 'G,', 'A,'];

// Run the pool, sampling grazers and hunters at each beat.
export function listen(seed, days) {
  const w = createWorld({ seed });
  const raw = [];
  const beats = [];
  let last = 0;
  const per = DAY / BEATS;
  for (let t = 1; t <= days * DAY; t++) {
    step(w);
    for (const e of w.events) if (e.seq > last) raw.push(e);
    last = w.eventSeq;
    if (t % per === 0) {
      let grazers = 0, hunters = 0;
      for (const c of w.creatures) (c.pheno.diet > 0.5 ? hunters++ : grazers++);
      beats.push({ grazers, hunters });
    }
  }
  const marks = notableEvents(raw, w).filter((e) => e.kind === 'born' || e.kind === 'gone');
  return { beats, marks };
}

// Map a value onto a scale index, on a log scale normalised over the whole run.
function scaler(values, steps) {
  const logs = values.map((v) => Math.log2(v + 1));
  const lo = Math.min(...logs), hi = Math.max(...logs);
  return (v) => (hi === lo ? Math.floor(steps / 2) : Math.round((Math.log2(v + 1) - lo) / (hi - lo) * (steps - 1)));
}

// Notes in one bar: tie repeated pitches. L:1/8, so a beat is 2 eighths.
function bar(pitches) {
  const out = [];
  for (const p of pitches) {
    const prev = out[out.length - 1];
    if (prev && prev.p === p) prev.len += 2;
    else out.push({ p, len: 2 });
  }
  return out.map(({ p, len }) => p + (len === 1 ? '' : len));
}

export function compose(seed, days, heard = listen(seed, days)) {
  const { beats, marks } = heard;
  const hi = scaler(beats.map((b) => b.grazers), MELODY.length);
  const lo = scaler(beats.filter((b) => b.hunters > 0).map((b) => b.hunters), BASS.length);
  const melody = [], bass = [];
  for (let d = 0; d < days; d++) {
    const day = beats.slice(d * BEATS, d * BEATS + BEATS);
    const notes = bar(day.map((b) => MELODY[hi(b.grazers)]));
    const said = marks.filter((m) => Math.floor(m.day) === d)
      .map((m) => (m.kind === 'born' ? '+' : '-') + m.a.name.common.split(' ').pop()).slice(0, 2);
    if (said.length) notes[0] = `"^${said.join(' ')}"` + notes[0];
    melody.push(notes.join(' '));
    // Bass moves at half-days, and only while there is someone to hunt with.
    const halves = [day.slice(0, 2), day.slice(2)].map((h) => {
      const n = Math.round((h[0].hunters + h[1].hunters) / 2);
      return n > 0 ? BASS[lo(n)] : 'z';
    });
    bass.push(halves[0] === halves[1] ? halves[0] + '8' : halves[0] + '4 ' + halves[1] + '4');
  }
  const lines = (bars) => {
    const out = [];
    for (let i = 0; i < bars.length; i += 4) out.push(bars.slice(i, i + 4).join(' | ') + ' |');
    out[out.length - 1] = out[out.length - 1].replace(/\|$/, '|]');
    return out.join('\n');
  };
  return [
    'X:1',
    `T:Tidesong, seed ${seed}`,
    `C:the pool, ${days} days; written down by the third`,
    'N:One bar per day. Melody: grazers alive. Bass: hunters (rests when there are none).',
    'M:4/4', 'L:1/8', 'Q:1/4=96', 'K:Dm',
    'V:1 clef=treble name="grazers"',
    'V:2 clef=bass name="hunters"',
    '[V:1]', lines(melody),
    '[V:2]', lines(bass),
    '',
  ].join('\n');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('song/song.js')) {
  const seed = Number(process.argv[2] ?? 7);
  const days = Number(process.argv[3] ?? 60);
  const abc = compose(seed, days);
  mkdirSync(new URL('../songs/', import.meta.url), { recursive: true });
  writeFileSync(new URL(`../songs/seed-${seed}.abc`, import.meta.url), abc);
  console.log(abc);
}
