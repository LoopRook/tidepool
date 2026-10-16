// Side panels and controls: plain DOM, updated a few times a second by main.js.
import { drawPortrait } from './render.js';
import { express } from './genome.js';
import { INPUTS, OUTPUTS, HIDDEN } from './brain.js';
import { DAY } from './world.js';

const INPUT_LABELS = {
  foodAngle: 'food dir', foodDist: 'food near', preyAngle: 'prey dir', preyDist: 'prey near',
  threatAngle: 'threat dir', threatDist: 'threat near', kinAngle: 'kin dir', kinDist: 'kin near',
  energy: 'energy', wall: 'wall', clock: 'clock', bias: 'bias',
};
const MAX_JOURNAL = 160;
const MAX_EXTINCT_SHOWN = 8;
const ALPHA_STEPS = 10;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

// Size a canvas's backing store for the device pixel ratio; returns the CSS size.
function fitCanvas(canvas, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.max(1, Math.round(w * dpr)), bh = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
const dayNumber = (tick) => Math.floor(tick / DAY) + 1;

function dietTag(diet) {
  if (diet > 0.5) return ['predator', 'predator'];
  if (diet > 0.35) return ['omnivore', 'omnivore'];
  return ['grazer', ''];
}

function latinName(sp) {
  return sp ? `${sp.name.genus} ${sp.name.epithet}` : '';
}

export function createUI(handlers) {
  const $ = (id) => document.getElementById(id);
  const root = document.body;
  const stat = { day: $('stat-day'), tick: $('stat-tick'), pop: $('stat-pop'), species: $('stat-species'), seed: $('stat-seed'), eff: $('stat-eff') };
  const btnPlay = $('btn-play'), btnFollow = $('btn-follow');
  const speedBtns = Array.from($('speed').querySelectorAll('button'));

  btnPlay.addEventListener('click', () => handlers.onPlay());
  btnFollow.addEventListener('click', () => handlers.onFollow());
  $('btn-seed').addEventListener('click', () => handlers.onSeed());
  $('btn-fit').addEventListener('click', () => handlers.onFit());
  for (const b of speedBtns) b.addEventListener('click', () => handlers.onSpeed(Number(b.dataset.speed)));

  // ---------- inspector ----------
  const insp = $('inspector');
  const empty = el('p', 'empty');
  empty.append(el('b', null, 'Nothing selected'), 'Click a creature in the pool to see who it is and what it is thinking.');
  const body = el('div', 'ins-body');
  const head = el('div', 'ins-head');
  const portrait = el('canvas');
  const names = el('div', 'ins-names');
  const nCommon = el('div', 'common'), nLatin = el('div', 'latin'), nMeta = el('div', 'meta');
  names.append(nCommon, nLatin, nMeta);
  head.append(portrait, names);
  const energy = el('div', 'energy');
  const eLbl = el('div', 'lbl'), eVal = el('b');
  eLbl.append(el('span', null, 'Energy'), eVal);
  const eTrack = el('div', 'bar-track'), eFill = el('div', 'bar-fill');
  eTrack.append(eFill);
  energy.append(eLbl, eTrack);
  const grid = el('dl', 'grid');
  const cells = {};
  for (const [k, label] of [['age', 'Age'], ['gen', 'Generation'], ['children', 'Children'], ['kills', 'Kills'], ['size', 'Size'], ['speed', 'Top speed']]) {
    const d = el('div');
    d.append(el('dt', null, label), (cells[k] = el('dd')));
    grid.append(d);
  }
  const brainWrap = el('div', 'brain-wrap');
  const bLbl = el('div', 'lbl');
  bLbl.innerHTML = '<span>Brain</span><span><i class="k-pos">excite</i> &middot; <i class="k-neg">inhibit</i></span>';
  const brainCanvas = el('canvas', 'brain');
  brainWrap.append(bLbl, brainCanvas);
  body.append(head, energy, grid, brainWrap);
  const note = el('div', 'deceased-note');
  const noteText = el('div');
  const noteRow = el('div', 'row');
  const btnKin = el('button', 'btn', 'Select a kin');
  btnKin.type = 'button';
  const btnDismiss = el('button', 'btn', 'Dismiss');
  btnDismiss.type = 'button';
  btnKin.addEventListener('click', () => handlers.onSelectKin());
  btnDismiss.addEventListener('click', () => handlers.onDeselect());
  noteRow.append(btnKin, btnDismiss);
  note.append(noteText, noteRow);
  const insTitle = el('h2', null, 'Inspector');
  const deadTag = el('span', 'tag dead', 'deceased');
  insp.append(insTitle, empty);

  let shownCreature = null;
  let shownDead = false;
  let brainLines = null; // offscreen layer with this creature's (fixed) weights
  let brainW = 0;
  const hidden = new Float64Array(HIDDEN);

  const POS = [242, 184, 103], NEG = [111, 205, 232];
  const lineStyles = [[], []];
  for (let s = 0; s < 2; s++) {
    const c = s ? NEG : POS;
    for (let i = 0; i <= ALPHA_STEPS; i++) lineStyles[s].push(`rgba(${c[0]}, ${c[1]}, ${c[2]}, ${((i / ALPHA_STEPS) * 0.85).toFixed(3)})`);
  }

  function brainLayout(w, h) {
    const NI = INPUTS.length, NO = OUTPUTS.length;
    const top = 9, span = h - 18;
    const col = (n, i) => top + (n === 1 ? span / 2 : (span * i) / (n - 1));
    const hiddenPad = span * 0.12;
    return {
      ix: 70, hx: Math.round(w * 0.55), ox: w - 62,
      iy: (i) => col(NI, i),
      hy: (j) => top + hiddenPad + ((span - hiddenPad * 2) * j) / Math.max(1, HIDDEN - 1),
      oy: (o) => top + span * 0.2 + (span * 0.6 * o) / Math.max(1, NO - 1),
    };
  }

  function buildBrainLines(c, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const off = brainLines || document.createElement('canvas');
    off.width = Math.round(w * dpr); off.height = Math.round(h * dpr);
    const g = off.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const Ly = brainLayout(w, h);
    const wts = c.genome.weights;
    const NI = INPUTS.length, NO = OUTPUTS.length, OUT = HIDDEN * NI;
    if (wts.length < OUT + NO * (HIDDEN + 1)) return off;
    // bucket lines by colour so each bucket is one stroke
    for (let s = 0; s < 2; s++) {
      for (let b = 1; b <= ALPHA_STEPS; b++) {
        g.beginPath();
        let any = false;
        for (let j = 0; j < HIDDEN; j++) {
          for (let i = 0; i < NI; i++) {
            const v = wts[j * NI + i];
            if ((v < 0 ? 1 : 0) !== s || Math.min(ALPHA_STEPS, Math.round((Math.abs(v) / 3) * ALPHA_STEPS)) !== b) continue;
            g.moveTo(Ly.ix + 5, Ly.iy(i)); g.lineTo(Ly.hx - 5, Ly.hy(j)); any = true;
          }
        }
        for (let o = 0; o < NO; o++) {
          for (let j = 0; j < HIDDEN; j++) {
            const v = wts[OUT + o * (HIDDEN + 1) + j];
            if ((v < 0 ? 1 : 0) !== s || Math.min(ALPHA_STEPS, Math.round((Math.abs(v) / 3) * ALPHA_STEPS)) !== b) continue;
            g.moveTo(Ly.hx + 5, Ly.hy(j)); g.lineTo(Ly.ox - 6, Ly.oy(o)); any = true;
          }
        }
        if (!any) continue;
        g.strokeStyle = lineStyles[s][b];
        g.lineWidth = 0.6 + b * 0.16;
        g.stroke();
      }
    }
    return off;
  }

  function nodeFill(a) {
    const m = Math.min(1, Math.abs(a));
    const c = a >= 0 ? POS : NEG;
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(0.12 + 0.88 * m).toFixed(3)})`;
  }

  function drawBrain(c) {
    const w = brainCanvas.clientWidth || 320, h = brainCanvas.clientHeight || 220;
    const ctx = fitCanvas(brainCanvas, w, h);
    if (!brainLines || brainW !== w || shownCreature !== c) {
      brainLines = buildBrainLines(c, w, h);
      brainW = w;
    }
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(brainLines, 0, 0, w, h);
    const Ly = brainLayout(w, h);
    const inp = c.inputs || [];
    const wts = c.genome.weights;
    const NI = INPUTS.length;
    for (let j = 0; j < HIDDEN; j++) {
      let s = 0;
      for (let i = 0; i < NI; i++) s += wts[j * NI + i] * (inp[i] || 0);
      hidden[j] = Math.tanh(s);
    }
    ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = 'middle';
    const ring = 'rgba(200, 235, 228, 0.35)';
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    for (let i = 0; i < NI; i++) {
      const y = Ly.iy(i), a = inp[i] || 0;
      ctx.fillStyle = 'rgba(160, 200, 196, 0.75)';
      ctx.fillText(INPUT_LABELS[INPUTS[i]] || INPUTS[i], Ly.ix - 9, y);
      ctx.beginPath(); ctx.arc(Ly.ix, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0a2229'; ctx.fill();
      ctx.fillStyle = nodeFill(a); ctx.fill();
      ctx.strokeStyle = ring; ctx.stroke();
    }
    for (let j = 0; j < HIDDEN; j++) {
      const y = Ly.hy(j);
      ctx.beginPath(); ctx.arc(Ly.hx, y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0a2229'; ctx.fill();
      ctx.fillStyle = nodeFill(hidden[j]); ctx.fill();
      ctx.strokeStyle = ring; ctx.stroke();
    }
    ctx.textAlign = 'left';
    const out = c.outputs || [];
    for (let o = 0; o < OUTPUTS.length; o++) {
      const y = Ly.oy(o), a = out[o] || 0;
      ctx.beginPath(); ctx.arc(Ly.ox, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#0a2229'; ctx.fill();
      ctx.fillStyle = nodeFill(a); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 230, 190, 0.5)'; ctx.stroke();
      ctx.fillStyle = 'rgba(220, 239, 234, 0.9)';
      ctx.fillText(OUTPUTS[o], Ly.ox + 12, y - 6);
      ctx.fillStyle = 'rgba(160, 200, 196, 0.7)';
      ctx.fillText((a >= 0 && o === 0 ? '+' : '') + a.toFixed(2), Ly.ox + 12, y + 6);
    }
  }

  function showCreature(world, c, dead, death, kinCount) {
    if (!c) {
      if (shownCreature) { insp.replaceChildren(insTitle, empty); insp.classList.remove('deceased'); deadTag.remove(); }
      shownCreature = null;
      return;
    }
    const sp = world.species.get(c.speciesId);
    if (shownCreature !== c) {
      insp.replaceChildren(insTitle, body);
      const pctx = fitCanvas(portrait, 72, 52);
      pctx.clearRect(0, 0, 72, 52);
      drawPortrait(pctx, c.pheno, 36, 26, 60);
      setText(nCommon, sp ? sp.name.common : 'Unknown form');
      setText(nLatin, latinName(sp));
      const [tagText, tagCls] = dietTag(c.pheno.diet);
      nMeta.replaceChildren(el('span', `tag ${tagCls}`, tagText), `species ${sp ? sp.id : '?'} · #${c.id}`);
      shownDead = null;
    }
    if (shownDead !== dead) {
      insp.classList.toggle('deceased', dead);
      if (dead) { body.after(note); insTitle.append(deadTag); } else { note.remove(); deadTag.remove(); }
      shownDead = dead;
    }
    if (dead) {
      const cause = (death && death.cause) || c.causeOfDeath || 'unknown causes';
      let text = cause === 'eaten' ? 'Eaten' : cause === 'starvation' ? 'Starved' : cause === 'old age' ? 'Died of old age' : `Died (${cause})`;
      if (cause === 'eaten' && death && death.killerSpecies != null) {
        const ks = world.species.get(death.killerSpecies);
        if (ks) text += ` by ${/^[AEIOU]/i.test(ks.name.common) ? 'an' : 'a'} ${ks.name.common}`;
      }
      text += ` at ${(c.age / DAY).toFixed(1)} days old.`;
      text += kinCount > 0 ? ` ${kinCount} of its kind still swim${kinCount === 1 ? 's' : ''}.` : ' None of its kind remain.';
      setText(noteText, text);
      btnKin.hidden = kinCount === 0;
    }
    const e = Math.max(0, c.energy / c.pheno.maxEnergy);
    setText(eVal, `${Math.round(e * 100)}%`);
    eFill.style.width = `${Math.min(100, e * 100).toFixed(1)}%`;
    eFill.classList.toggle('low', e < 0.25);
    setText(cells.age, `${(c.age / DAY).toFixed(1)} d`);
    setText(cells.gen, String(c.generation));
    setText(cells.children, String(c.children));
    setText(cells.kills, String(c.kills));
    setText(cells.size, c.pheno.radius.toFixed(1));
    setText(cells.speed, c.pheno.maxSpeed.toFixed(2));
    if (!dead || shownCreature !== c) drawBrain(c);
    shownCreature = c;
  }

  // ---------- field guide ----------
  const guide = $('guide'), guideCount = $('guide-count');
  const rows = new Map(); // species id -> row refs
  const counts = new Map();
  let order = [];
  const more = el('li', 'more');

  function makeRow(sp) {
    const li = el('li');
    li.tabIndex = 0;
    const cv = el('canvas');
    const nm = el('div', 'nm');
    const common = el('div', 'common'), latin = el('div', 'latin');
    nm.append(common, latin);
    const pop = el('div', 'pop'), num = el('span'), sub = el('small');
    pop.append(num, sub);
    li.append(cv, nm, pop);
    const pctx = fitCanvas(cv, 54, 36);
    drawPortrait(pctx, express(sp.representative), 27, 18, 46);
    common.textContent = sp.name.common;
    latin.textContent = latinName(sp);
    const pick = () => { if (!li.classList.contains('extinct')) handlers.onSelectSpecies(sp.id); };
    li.addEventListener('click', pick);
    li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
    return { li, num, sub, n: -1, extinct: null, sub0: '' };
  }

  function updateGuide(world, selectedSpecies) {
    const all = world.species.all();
    const living = [], extinct = [];
    for (const sp of all) {
      const n = counts.get(sp.id) || 0;
      if (n > 0 || sp.extinctTick == null) living.push(sp); else extinct.push(sp);
    }
    living.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || a.id - b.id);
    extinct.sort((a, b) => b.extinctTick - a.extinctTick);
    const shown = living.concat(extinct.slice(0, MAX_EXTINCT_SHOWN));
    setText(guideCount, `${living.length} living · ${extinct.length} extinct`);

    let same = shown.length === order.length;
    for (let i = 0; same && i < shown.length; i++) same = shown[i].id === order[i];
    if (!same) {
      const keep = new Set();
      const frag = document.createDocumentFragment();
      for (const sp of shown) {
        let r = rows.get(sp.id);
        if (!r) { r = makeRow(sp); rows.set(sp.id, r); }
        keep.add(sp.id);
        frag.append(r.li);
      }
      for (const [id, r] of rows) if (!keep.has(id)) { r.li.remove(); rows.delete(id); }
      guide.replaceChildren(frag);
      order = shown.map((s) => s.id);
    }
    const hidden = extinct.length - MAX_EXTINCT_SHOWN;
    if (hidden > 0) { setText(more, `and ${hidden} older extinct species`); guide.append(more); } else more.remove();

    for (const sp of shown) {
      const r = rows.get(sp.id);
      const n = counts.get(sp.id) || 0;
      const isExtinct = n === 0 && sp.extinctTick != null;
      if (r.n !== n) { r.num.textContent = isExtinct ? '†' : String(n); r.n = n; }
      const sub = isExtinct ? `extinct day ${dayNumber(sp.extinctTick)}` : `peak ${Math.max(sp.peakPopulation, n)}`;
      if (r.sub0 !== sub) { r.sub.textContent = sub; r.sub0 = sub; }
      if (r.extinct !== isExtinct) { r.li.classList.toggle('extinct', isExtinct); r.extinct = isExtinct; }
      r.li.classList.toggle('current', sp.id === selectedSpecies);
    }
  }

  // ---------- population chart ----------
  const chart = $('chart');
  const chartStart = $('chart-start'), chartMax = $('chart-max'), chartEnd = $('chart-end');
  const hueStyle = new Map();
  let chartKey = '';
  let baseA = new Float32Array(0), baseB = new Float32Array(0);

  function speciesFill(sp) {
    let s = hueStyle.get(sp.id);
    if (!s) { s = `hsla(${sp.hue.toFixed(0)}, 58%, 56%, 0.88)`; hueStyle.set(sp.id, s); }
    return s;
  }

  function drawChart(world) {
    const hist = world.history || [];
    const w = chart.clientWidth || 300, h = chart.clientHeight || 120;
    const last = hist.length ? hist[hist.length - 1].tick : -1;
    const key = `${hist.length}:${last}:${w}x${h}`;
    if (key === chartKey) return;
    chartKey = key;
    const ctx = fitCanvas(chart, w, h);
    ctx.clearRect(0, 0, w, h);
    if (hist.length < 2) {
      setText(chartStart, ''); setText(chartEnd, ''); setText(chartMax, 'gathering data…');
      return;
    }
    const cols = Math.max(2, Math.min(hist.length, Math.floor(w / 1.5)));
    if (baseA.length < cols) { baseA = new Float32Array(cols); baseB = new Float32Array(cols); }
    const idx = (k) => Math.round((k * (hist.length - 1)) / (cols - 1));
    let peak = 1;
    for (let k = 0; k < cols; k++) peak = Math.max(peak, hist[idx(k)].population);
    const yMax = peak * 1.08;
    const X = (k) => (k * w) / (cols - 1);
    const Y = (v) => h - (v / yMax) * (h - 2);

    ctx.strokeStyle = 'rgba(160, 230, 220, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let g = 1; g <= 3; g++) { const y = Math.round((h * g) / 4) + 0.5; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();

    let lower = baseA, upper = baseB;
    lower.fill(0, 0, cols);
    // stack in founding order so colours stay put as new species arrive on top
    for (const sp of world.species.all()) {
      const key = String(sp.id);
      let present = false;
      for (let k = 0; k < cols; k++) {
        const v = hist[idx(k)].bySpecies[key] || 0;
        upper[k] = lower[k] + v;
        if (v) present = true;
      }
      if (!present) continue;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(upper[0]));
      for (let k = 1; k < cols; k++) ctx.lineTo(X(k), Y(upper[k]));
      for (let k = cols - 1; k >= 0; k--) ctx.lineTo(X(k), Y(lower[k]));
      ctx.closePath();
      ctx.fillStyle = speciesFill(sp);
      ctx.fill();
      const t = lower; lower = upper; upper = t;
    }
    // outline of the total
    ctx.beginPath();
    ctx.moveTo(X(0), Y(hist[idx(0)].population));
    for (let k = 1; k < cols; k++) ctx.lineTo(X(k), Y(hist[idx(k)].population));
    ctx.strokeStyle = 'rgba(240, 250, 246, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    setText(chartStart, `day ${dayNumber(hist[0].tick)}`);
    setText(chartMax, `peak ${peak}`);
    setText(chartEnd, `day ${dayNumber(last)}`);
  }

  // ---------- journal ----------
  const journalEl = $('journal');
  const pending = [];
  const journalEmpty = el('li', 'empty', 'The naturalist is watching. Notable events will be written here.');

  function flushJournal() {
    if (!pending.length) return;
    journalEmpty.remove();
    const frag = document.createDocumentFragment();
    // newest first
    for (let i = pending.length - 1; i >= Math.max(0, pending.length - MAX_JOURNAL); i--) {
      const { text, type } = pending[i];
      const li = el('li', `fresh t-${type}`);
      const m = /^(Day [\d,]+\.)\s*([\s\S]*)$/.exec(text);
      if (m) li.append(el('span', 'day', m[1]), ' ', m[2]); else li.textContent = text;
      frag.append(li);
    }
    pending.length = 0;
    journalEl.prepend(frag);
    while (journalEl.childElementCount > MAX_JOURNAL) journalEl.lastElementChild.remove();
  }

  // ---------- public ----------
  function reset(world) {
    shownCreature = null; brainLines = null;
    insp.replaceChildren(insTitle, empty);
    insp.classList.remove('deceased');
    deadTag.remove();
    rows.clear(); order = []; guide.replaceChildren();
    hueStyle.clear(); chartKey = '';
    pending.length = 0;
    journalEl.replaceChildren(journalEmpty);
    setText(stat.seed, String(world.seed));
  }

  function setControls(state) {
    root.classList.toggle('paused', state.paused);
    btnPlay.title = state.paused ? 'Play (Space)' : 'Pause (Space)';
    btnPlay.setAttribute('aria-label', state.paused ? 'Play' : 'Pause');
    for (const b of speedBtns) b.classList.toggle('on', Number(b.dataset.speed) === state.speed);
    btnFollow.setAttribute('aria-pressed', String(state.follow));
  }

  function update(world, state) {
    counts.clear();
    const cs = world.creatures;
    for (let i = 0; i < cs.length; i++) counts.set(cs[i].speciesId, (counts.get(cs[i].speciesId) || 0) + 1);
    setText(stat.day, String(dayNumber(world.tick)));
    setText(stat.tick, fmtInt(world.tick));
    setText(stat.pop, String(cs.length));
    setText(stat.species, String(counts.size));
    const eff = state.paused ? '' : state.effSpeed < state.speed * 0.85 ? `≈${Math.max(1, Math.round(state.effSpeed))}×` : '';
    setText(stat.eff, eff);
    const sel = state.selected;
    const dead = !!sel && (state.selectedDead || !sel.alive);
    showCreature(world, sel, dead, state.death, sel ? counts.get(sel.speciesId) || 0 : 0);
    updateGuide(world, sel ? sel.speciesId : null);
    drawChart(world);
    flushJournal();
  }

  return {
    reset,
    update,
    setControls,
    journal(text, event) { pending.push({ text, type: event.type }); if (pending.length > MAX_JOURNAL * 2) pending.splice(0, pending.length - MAX_JOURNAL); },
  };
}
