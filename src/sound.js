// The pool's voice. Browser-only (Web Audio); created lazily on the first user
// gesture because browsers refuse to start audio before one.
//
// Each species owns a note of a minor pentatonic scale (from its id) in an octave
// set by body size, so a pool of big slow grazers hums low and a nursery of
// minnows chirps. Births pluck, new species chime, extinctions sigh, hunts thump,
// and a drone breathes with the population.

const SCALE = [0, 3, 5, 7, 10];   // minor pentatonic, semitones
const ROOT = 146.83;              // D3
const MAX_NOTES_PER_SEC = 5;      // at 64x the pool would otherwise hail

const hash = (n) => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; };

export function speciesPitch(id, radius) {
  const degree = SCALE[hash(id) % SCALE.length];
  // radius 3..14 -> octave +1..-1: smaller bodies sing higher
  const octave = Math.round(1 - 2 * Math.min(1, Math.max(0, (radius - 3) / 11)));
  return ROOT * Math.pow(2, (degree + 12 * octave) / 12);
}

export function createSound() {
  let ctx = null, master = null, wet = null, drone = null, droneGain = null;
  let enabled = false;
  let budget = MAX_NOTES_PER_SEC, lastRefill = 0;

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // Underwater space: a dark feedback echo instead of a convolution reverb (no assets).
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.37;
    const fb = ctx.createGain(); fb.gain.value = 0.45;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1400;
    wet = ctx.createGain(); wet.gain.value = 0.35;
    wet.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay); tone.connect(master);
    // Drone: root + fifth through a slow-breathing lowpass.
    droneGain = ctx.createGain(); droneGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 140;
    lfo.connect(lfoAmt); lfoAmt.connect(lp.frequency); lfo.start();
    drone = [ROOT / 2, ROOT * 0.75].map((f) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); return o;
    });
    lp.connect(droneGain); droneGain.connect(master); droneGain.connect(wet);
  }

  function voice(freq, { type = 'triangle', gain = 0.12, attack = 0.005, decay = 1.2, glide = 0, pan = 0, at = 0 } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(g); g.connect(p); p.connect(master); p.connect(wet);
    o.start(t); o.stop(t + decay + 0.05);
  }

  // Rate limiter: a leaky bucket refilled in real time, so speed doesn't matter.
  function allow(cost = 1) {
    const now = ctx.currentTime;
    budget = Math.min(MAX_NOTES_PER_SEC, budget + (now - lastRefill) * MAX_NOTES_PER_SEC);
    lastRefill = now;
    if (budget < cost) return false;
    budget -= cost;
    return true;
  }

  function info(world, id) {
    const s = world.species && world.species.get(id);
    const r = s && s.pheno ? s.pheno.radius : 7;
    return { f: speciesPitch(id || 1, r), pan: ((hash((id || 1) * 7) % 1000) / 1000) * 1.4 - 0.7 };
  }

  return {
    get enabled() { return enabled; },
    toggle() {
      if (!ctx) init();
      enabled = !enabled;
      if (enabled) ctx.resume(); else ctx.suspend();
      return enabled;
    },
    handle(e, world) {
      if (!enabled || ctx.state !== 'running') return;
      switch (e.type) {
        case 'birth': {
          // Most births stay silent; a sparse random-looking subset keeps it musical.
          if (hash(e.seq) % 4 !== 0 || !allow(1)) return;
          const { f, pan } = info(world, e.speciesId);
          voice(f, { pan, gain: 0.09 });
          break;
        }
        case 'speciation': {
          if (!allow(2)) return;
          const { f, pan } = info(world, e.speciesId);
          voice(f, { pan, gain: 0.1, decay: 2 });
          voice(f * 1.5, { pan, gain: 0.08, decay: 2.5, at: 0.18 });
          break;
        }
        case 'extinction': {
          if (!allow(2)) return;
          const { f, pan } = info(world, e.speciesId);
          voice(f / 2, { type: 'sine', pan, gain: 0.14, attack: 0.3, decay: 3.5, glide: 0.75 });
          break;
        }
        case 'predation': {
          if (!allow(1)) return;
          const { pan } = info(world, e.preySpecies);
          voice(70, { type: 'sine', pan, gain: 0.25, decay: 0.35, glide: 0.5 });
          break;
        }
      }
    },
    // Called a few times a second: the drone swells with the population.
    update(world) {
      if (!enabled) return;
      const level = Math.min(1, world.creatures.length / 400) * 0.05;
      droneGain.gain.setTargetAtTime(level, ctx.currentTime, 1.5);
    },
  };
}
