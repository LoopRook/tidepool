// Browser entry: builds the world from #seed=N, runs the loop, handles input.
import { createWorld, step, findCreatureAt } from './world.js';
import { narrate } from './journal.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { createSound } from './sound.js';
import { createTreePanel } from './tree.js';

const TICKS_PER_SEC = 60;
const STEP_BUDGET_MS = 12;   // cap on simulation time per frame so 64x stays responsive
const UI_INTERVAL_MS = 150;  // panels refresh ~6-7 times a second; the canvas every frame
const MAX_SCALE = 14;
const SPEEDS = [1, 4, 16, 64];

const canvas = document.getElementById('pool');
const hint = document.getElementById('hint');
const renderer = createRenderer(canvas);

const state = {
  paused: false,
  speed: 1,
  follow: false,
  selected: null,       // Creature object (kept after it dies so the inspector can show it)
  selectedDead: false,
  death: null,          // { cause, killerSpecies } for the selected creature, from events
  effSpeed: 1,
  wasFollowing: false,  // so picking a kin after a death resumes following
};

let world = null;
let view = { scale: 1, ox: 0, oy: 0 };
let minScale = 0.1;
let zoomTarget = 0;    // follow eases in to this scale; manual zoom cancels it
let fitted = true;      // view still shows the whole pool; refit on resize
let lastSeq = 0;
const fresh = [];
let narrateFailed = false;
const sound = createSound();
const btnSound = document.getElementById('btn-sound');
function toggleSound() {
  const on = sound.toggle();
  btnSound.setAttribute('aria-pressed', String(on));
  btnSound.classList.toggle('on', on);
}
btnSound.addEventListener('click', toggleSound);

const handlers = {
  onPlay: () => setPaused(!state.paused),
  onSpeed: (s) => { state.speed = s; ui.setControls(state); },
  onFollow: () => setFollow(!state.follow),
  onSeed: () => newSeed(),
  onFit: () => fitAll(),
  onSelectSpecies: (id) => {
    let best = null;
    for (const c of world.creatures) {
      if (c.speciesId !== id) continue;
      if (!best || c.pheno.radius > best.pheno.radius || (c.pheno.radius === best.pheno.radius && c.energy > best.energy)) best = c;
    }
    if (best) { select(best); setFollow(true); zoomTarget = Math.max(view.scale, (minScale / 0.6) * 2.5); }
  },
  onSelectKin: () => {
    const dead = state.selected;
    if (!dead) return;
    let best = null, bd = Infinity;
    for (const c of world.creatures) {
      if (c.speciesId !== dead.speciesId || c === dead) continue;
      const d = (c.x - dead.x) ** 2 + (c.y - dead.y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { const refollow = state.wasFollowing; select(best); if (refollow) setFollow(true); }
  },
  onDeselect: () => select(null),
};
const ui = createUI(handlers);
const tree = createTreePanel(document.getElementById('tree'), document.getElementById('tree-caption'), (id) => handlers.onSelectSpecies(id));

function readSeed() {
  const m = /seed=(\d+)/.exec(location.hash);
  return m ? Number(m[1]) >>> 0 : null;
}

function randomSeed() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] % 999999) + 1;
}

function start(seed) {
  world = createWorld({ seed });
  lastSeq = 0;
  state.selected = null; state.selectedDead = false; state.death = null; state.follow = false;
  ui.reset(world);
  tree.reset();
  fitAll();
  drainEvents();
  // ?warm=N fast-forwards N ticks on load (handy for checking a mature pool)
  const warm = Math.min(200000, Number(new URLSearchParams(location.search).get('warm')) || 0);
  for (let i = 0; i < warm; i++) { step(world); drainEvents(); }
  ui.setControls(state);
  ui.update(world, state);
}

function newSeed() {
  location.hash = `seed=${randomSeed()}`; // hashchange restarts the world
}

window.addEventListener('hashchange', () => {
  const s = readSeed();
  if (s != null && (!world || s !== world.seed)) start(s);
});

function fitAll() {
  view = renderer.fitView(world);
  minScale = view.scale * 0.6;
  fitted = true;
}

function setPaused(p) { state.paused = p; ui.setControls(state); }
function setFollow(f) { state.follow = f && !!state.selected && !state.selectedDead; ui.setControls(state); }

function select(c) {
  state.selected = c;
  state.selectedDead = false;
  state.death = null;
  if (!c) state.follow = false;
  ui.setControls(state);
  ui.update(world, state);
}

// The world keeps a ring buffer of recent events; pick up everything newer than we've seen.
function drainEvents() {
  const seq = world.eventSeq || 0;
  if (seq === lastSeq) return;
  const evs = world.events;
  fresh.length = 0;
  for (let i = 0; i < evs.length; i++) if (evs[i].seq > lastSeq) fresh.push(evs[i]);
  if (fresh.length > 1) fresh.sort((a, b) => a.seq - b.seq);
  lastSeq = seq;
  const sel = state.selected;
  for (let i = 0; i < fresh.length; i++) {
    const e = fresh[i];
    if (sel && !state.selectedDead) {
      if (e.type === 'predation' && e.preyId === sel.id) state.death = { cause: 'eaten', killerSpecies: e.predatorSpecies };
      else if (e.type === 'death' && e.creatureId === sel.id) state.death = { cause: e.cause, killerSpecies: state.death ? state.death.killerSpecies : null };
    }
    let text = null;
    try {
      text = narrate(e, world);
    } catch (err) {
      if (!narrateFailed) { console.error('narrate failed', err); narrateFailed = true; }
    }
    if (text) ui.journal(text, e);
    sound.handle(e, world);
  }
}

function clampView() {
  // keep the view centre over the pool so it can't be lost off-screen
  const w = renderer.width / view.scale, h = renderer.height / view.scale;
  const cx = Math.min(world.width, Math.max(0, view.ox + w / 2));
  const cy = Math.min(world.height, Math.max(0, view.oy + h / 2));
  view.ox = cx - w / 2;
  view.oy = cy - h / 2;
}

function zoomAt(sx, sy, factor) {
  zoomTarget = 0;
  const s = Math.min(MAX_SCALE, Math.max(minScale, view.scale * factor));
  const p = renderer.screenToWorld(view, sx, sy);
  view.scale = s;
  view.ox = p.x - sx / s;
  view.oy = p.y - sy / s;
  fitted = false;
  clampView();
}

// ---------- main loop ----------

let acc = 0, lastFrame = 0, lastUi = 0;
let effTicks = 0, effStart = 0;

function frame(now) {
  const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 1 / 60;
  lastFrame = now;

  if (!state.paused) {
    acc += dt * TICKS_PER_SEC * state.speed;
    const t0 = performance.now();
    while (acc >= 1) {
      step(world);
      drainEvents();
      acc -= 1;
      effTicks++;
      if (performance.now() - t0 > STEP_BUDGET_MS) { acc = Math.min(acc, 1); break; }
    }
  }
  if (now - effStart > 1000) {
    state.effSpeed = (effTicks / ((now - effStart) / 1000)) / TICKS_PER_SEC;
    effTicks = 0; effStart = now;
  }

  const sel = state.selected;
  if (sel && !state.selectedDead && (!sel.alive || state.death)) {
    state.selectedDead = true;
    state.wasFollowing = state.follow;
    if (state.follow) { state.follow = false; ui.setControls(state); }
  }
  if (state.follow && sel && !state.selectedDead) {
    const k = Math.min(1, dt * 5);
    if (zoomTarget > view.scale * 1.001) {
      const cx = view.ox + renderer.width / (2 * view.scale), cy = view.oy + renderer.height / (2 * view.scale);
      view.scale += (zoomTarget - view.scale) * k;
      view.ox = cx - renderer.width / (2 * view.scale);
      view.oy = cy - renderer.height / (2 * view.scale);
    } else zoomTarget = 0;
    const tx = sel.x - renderer.width / (2 * view.scale), ty = sel.y - renderer.height / (2 * view.scale);
    view.ox += (tx - view.ox) * k;
    view.oy += (ty - view.oy) * k;
    fitted = false;
  }

  renderer.draw(world, view, sel ? sel.id : null);

  if (now - lastUi > UI_INTERVAL_MS) {
    // creatures are removed from the list when they die; catch it even if `alive` wasn't cleared
    if (sel && !state.selectedDead && !world.creatures.includes(sel)) state.selectedDead = true;
    ui.update(world, state);
    sound.update(world);
    tree.update(world);
    lastUi = now;
  }
  requestAnimationFrame(frame);
}

// ---------- input ----------

const pointers = new Map();
let drag = null;   // { x, y, moved }
let pinch = null;  // { dist, x, y }

function local(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function dismissHint() { hint.classList.add('gone'); }

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  const p = local(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 1) {
    drag = { x: p.x, y: p.y, moved: false };
  } else if (pointers.size === 2) {
    const [a, b] = pointers.values();
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (drag) drag.moved = true; // two fingers never count as a click
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = local(e);
  if (!pointers.has(e.pointerId)) {
    if (e.pointerType === 'mouse' && world) {
      const w = renderer.screenToWorld(view, p.x, p.y);
      canvas.classList.toggle('over', !!findCreatureAt(world, w.x, w.y, Math.max(6, 8 / view.scale)));
    }
    return;
  }
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, p);
  if (pinch && pointers.size >= 2) {
    const [a, b] = pointers.values();
    const dist = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    view.ox -= (cx - pinch.x) / view.scale;
    view.oy -= (cy - pinch.y) / view.scale;
    if (pinch.dist > 0) zoomAt(cx, cy, dist / pinch.dist);
    pinch = { dist, x: cx, y: cy };
    return;
  }
  if (!drag) return;
  if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) > 4) {
    drag.moved = true;
    canvas.classList.add('dragging');
    dismissHint();
    if (state.follow) setFollow(false);
  }
  if (drag.moved) {
    view.ox -= (p.x - prev.x) / view.scale;
    view.oy -= (p.y - prev.y) / view.scale;
    fitted = false;
    clampView();
  }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size > 0) return;
  canvas.classList.remove('dragging');
  if (drag && !drag.moved && e.type === 'pointerup') {
    const p = local(e);
    const w = renderer.screenToWorld(view, p.x, p.y);
    select(findCreatureAt(world, w.x, w.y, Math.max(6, 8 / view.scale)));
    dismissHint();
  }
  drag = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = local(e);
  const unit = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.0015;
  zoomAt(p.x, p.y, Math.exp(-e.deltaY * unit));
  dismissHint();
}, { passive: false });

const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

window.addEventListener('keydown', (e) => {
  if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === ' ' || k === 'Spacebar') {
    // Space always pauses, even when a control button has focus
    e.preventDefault();
    if (!e.repeat) setPaused(!state.paused);
  } else if (k === 'Escape') {
    select(null);
  } else if (k >= '1' && k <= '4') {
    handlers.onSpeed(SPEEDS[Number(k) - 1]);
  } else if (k === 'm' || k === 'M') {
    toggleSound();
  } else if (k === 'f' || k === 'F') {
    setFollow(!state.follow);
  } else if (k === 'n' || k === 'N') {
    newSeed();
  } else if (k === '0') {
    fitAll();
  } else if (k === '+' || k === '=') {
    zoomAt(renderer.width / 2, renderer.height / 2, 1.25);
  } else if (k === '-' || k === '_') {
    zoomAt(renderer.width / 2, renderer.height / 2, 0.8);
  }
});
window.addEventListener('keyup', (e) => {
  if ((e.key === ' ' || e.key === 'Spacebar') && !isTyping(e.target)) e.preventDefault();
});

// Keep the same world point centred when the canvas changes size.
let lastW = 0, lastH = 0;
new ResizeObserver(() => {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!world || !w || !h) return;
  if (fitted) {
    view = renderer.fitView(world);
    minScale = view.scale * 0.6;
  } else if (lastW) {
    view.ox += (lastW - w) / (2 * view.scale);
    view.oy += (lastH - h) / (2 * view.scale);
  }
  lastW = w; lastH = h;
}).observe(canvas);

if (matchMedia('(pointer: coarse)').matches) hint.textContent = 'Drag to pan · pinch to zoom · tap a creature';
setTimeout(dismissHint, 12000);

// ---------- boot ----------

let seed = readSeed();
if (seed == null) {
  seed = randomSeed();
  history.replaceState(null, '', `#seed=${seed}`);
}
start(seed);
requestAnimationFrame(frame);
// console handle for poking at the running pool
window.tidepool = { get world() { return world; }, state, step: (n = 1) => { for (let i = 0; i < n; i++) { step(world); drainEvents(); } } };
