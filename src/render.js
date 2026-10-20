// Canvas renderer for the pool.
// View = { scale, ox, oy }: screen (CSS px) = (world - o) * scale, so (ox, oy) is
// the world point at the canvas's top-left corner.

import { bodyRadius } from './world.js';

const TAU = Math.PI * 2;
const looks = new WeakMap(); // pheno -> cached colours and geometry
const SHADOW = 'rgba(0, 14, 20, 0.26)';
const SNOW_COUNT = 150;
const NO_DASH = [];
const SPRITE_MAX_PX = 30; // above this on-screen radius, draw vectors (few creatures are that big)

function hsla(h, s, l, a) {
  return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a})`;
}

// Tiny deterministic PRNG so pattern spots and backdrop texture are stable.
function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Everything about a creature's look that doesn't change frame to frame,
// computed once per phenotype so the draw loop builds no strings.
function lookFor(p) {
  let L = looks.get(p);
  if (L) return L;
  const sa = Math.sqrt(p.bodyAspect);
  const r = p.radius, rx = r * sa, ry = r / sa;
  const h = p.hue, s = p.saturation, l = p.lightness;
  const predator = p.diet > 0.5;
  const ph = p.patternHue;
  const rand = lcg(Math.floor(h * 977 + ph * 131 + r * 7919 + p.bodyAspect * 104729));
  const spots = [];
  if (p.pattern === 'spots') {
    const n = 3 + Math.floor(rand() * 4);
    for (let i = 0, tries = 0; i < n && tries < 60; tries++) {
      const u = (rand() * 2 - 1) * 0.75, v = (rand() * 2 - 1) * 0.7;
      if (u * u + v * v > 0.6) continue;
      spots.push(u * rx, v * ry, (0.13 + rand() * 0.12) * r);
      i++;
    }
  }
  const patL = l > 56 ? l - 28 : l + 20;
  L = {
    r, rx, ry, predator,
    tl: p.tailLength * r,
    fins: p.finCount,
    pattern: p.pattern,
    spots: new Float32Array(spots),
    bars: p.pattern === 'stripes' ? 3 + Math.floor(rand() * 3) : 2,
    front: predator ? rx * 1.32 : rx,
    // energy-level variants: well fed, hungry, starving (desaturated, dimmer)
    body: [hsla(h, s, l, 1), hsla(h, s * 0.7, l * 0.93, 1), hsla(h, s * 0.42, l * 0.84, 1)],
    sheen: hsla(h, s * 0.75, Math.min(90, l + 18), 0.42),
    rim: predator ? hsla(h, Math.min(95, s + 5), l * 0.32, 0.95) : hsla(h, s * 0.8, l * 0.55, 0.55),
    pat: hsla(ph, Math.min(95, s + 8), patL, 0.82),
    fin: hsla((h * 0.5 + ph * 0.5 + (Math.abs(h - ph) > 180 ? 180 : 0)) % 360, s * 0.85, Math.min(82, l + 10), 0.5),
    tail: hsla(h, s * 0.9, l * 0.86, 0.88),
    pupil: predator ? '#2a0606' : '#071318',
    spr: [null, null, null], // cached body sprites per energy level
  };
  looks.set(p, L);
  return L;
}

function bodyPath(ctx, L) {
  const rx = L.rx, ry = L.ry;
  ctx.beginPath();
  if (L.predator) {
    // pointed snout: the front half tapers to a tip ahead of the ellipse
    ctx.moveTo(rx * 1.32, 0);
    ctx.bezierCurveTo(rx * 1.0, ry * 0.5, rx * 0.55, ry * 1.02, -rx * 0.1, ry);
    ctx.bezierCurveTo(-rx * 0.7, ry * 0.98, -rx, ry * 0.55, -rx, 0);
    ctx.bezierCurveTo(-rx, -ry * 0.55, -rx * 0.7, -ry * 0.98, -rx * 0.1, -ry);
    ctx.bezierCurveTo(rx * 0.55, -ry * 1.02, rx * 1.0, -ry * 0.5, rx * 1.32, 0);
    ctx.closePath();
  } else {
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  }
}

// Forked tail in the creature's own frame; swing bends it sideways. Always drawn
// live (it's the animated part), body and fins can come from a cached sprite.
function drawTail(ctx, L, swing) {
  const rx = L.rx, ry = L.ry;
  const tl = L.tl, bx = -rx * 0.8;
  const tipX = bx - tl * Math.cos(swing * 0.6), tipY = Math.sin(swing) * tl * 0.9;
  const midX = bx - tl * 0.5, midY = tipY * 0.35;
  const w = ry * 0.6 + tl * 0.32;
  ctx.fillStyle = L.tail;
  ctx.beginPath();
  ctx.moveTo(bx, -ry * 0.36);
  ctx.quadraticCurveTo(midX, midY - ry * 0.14, tipX, tipY - w);
  ctx.lineTo(tipX + tl * 0.22, tipY);
  ctx.lineTo(tipX, tipY + w);
  ctx.quadraticCurveTo(midX, midY + ry * 0.14, bx, ry * 0.36);
  ctx.closePath();
  ctx.fill();
}

// Tail + body in the creature's frame (+x = heading). detail: 1 = silhouette, 2 = full.
// px = world units per screen pixel, for hairline widths.
function drawLocal(ctx, L, swing, flap, level, detail, px) {
  drawTail(ctx, L, swing);
  drawBody(ctx, L, flap, level, detail, px);
}

function drawBody(ctx, L, flap, level, detail, px) {
  const rx = L.rx, ry = L.ry, r = L.r;

  if (detail > 1 && L.fins > 0) {
    ctx.fillStyle = L.fin;
    ctx.beginPath();
    const n = L.fins;
    for (let i = 0; i < n; i++) {
      const fx = rx * (0.35 - (0.95 * i) / Math.max(1, n - 0.5));
      const len = r * (0.62 - i * 0.07);
      const a = 0.8 + flap * (0.28 + i * 0.05);
      const ca = Math.cos(a), sn = Math.sin(a);
      for (let sgn = -1; sgn <= 1; sgn += 2) {
        const ax = fx, ay = sgn * ry * 0.72;
        const cx = ax - ca * len * 0.5, cy = ay + sgn * sn * len * 0.5;
        const rot = sgn * (Math.PI - a);
        ctx.moveTo(cx + Math.cos(rot) * len * 0.5, cy + Math.sin(rot) * len * 0.5);
        ctx.ellipse(cx, cy, len * 0.5, len * 0.2, rot, 0, TAU);
      }
    }
    ctx.fill();
  }

  bodyPath(ctx, L);
  ctx.fillStyle = L.body[level];
  ctx.fill();

  if (detail > 1) {
    if (L.pattern !== 'plain') {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = L.pat;
      ctx.beginPath();
      if (L.pattern === 'spots') {
        const sp = L.spots;
        for (let i = 0; i < sp.length; i += 3) {
          ctx.moveTo(sp[i] + sp[i + 2], sp[i + 1]);
          ctx.arc(sp[i], sp[i + 1], sp[i + 2], 0, TAU);
        }
      } else if (L.pattern === 'stripes') {
        const n = L.bars, step = (rx * 1.7) / n, bw = Math.max(step * 0.28, px);
        for (let i = 0; i < n; i++) ctx.rect(rx * 0.75 - step * (i + 0.5) - bw / 2, -ry, bw, ry * 2);
      } else {
        // bands: two broad saddles across the back
        ctx.rect(rx * 0.12, -ry, rx * 0.34, ry * 2);
        ctx.rect(-rx * 0.62, -ry, rx * 0.3, ry * 2);
      }
      ctx.fill();
      ctx.restore();
    }
    // dorsal sheen gives the body some volume
    ctx.fillStyle = L.sheen;
    ctx.beginPath();
    ctx.ellipse(rx * 0.06, -ry * 0.12, rx * 0.58, ry * 0.32, 0, 0, TAU);
    ctx.fill();
    bodyPath(ctx, L);
  }

  ctx.lineWidth = L.predator ? Math.max(px * 1.3, r * 0.09) : Math.max(px, r * 0.06);
  ctx.strokeStyle = L.rim;
  ctx.stroke();

  if (detail > 1) {
    const ex = L.predator ? rx * 0.74 : rx * 0.58, ey = ry * 0.44;
    const er = Math.max(px * 0.9, r * 0.17);
    ctx.fillStyle = '#eef6f2';
    ctx.beginPath();
    ctx.moveTo(ex + er, ey); ctx.arc(ex, ey, er, 0, TAU);
    ctx.moveTo(ex + er, -ey); ctx.arc(ex, -ey, er, 0, TAU);
    ctx.fill();
    ctx.fillStyle = L.pupil;
    ctx.beginPath();
    const pr = er * 0.58, po = er * 0.3;
    ctx.moveTo(ex + po + pr, ey); ctx.arc(ex + po, ey, pr, 0, TAU);
    ctx.moveTo(ex + po + pr, -ey); ctx.arc(ex + po, -ey, pr, 0, TAU);
    ctx.fill();
  }
}

// Body + fins + pattern + eyes pre-rendered at `res` device px per world unit.
// Path filling and clipping per creature is what costs at 400 creatures; a rotated
// drawImage is nearly free, so only the tail is drawn as a live path.
function spriteFor(L, level, res) {
  let sp = L.spr[level];
  if (sp && sp.res === res) return sp;
  const pad = 2 / res;
  const x0 = -L.rx - L.r * 0.35 - pad, x1 = L.front + pad;
  const hh = Math.max(L.ry, L.ry * 0.72 + L.r * 0.78) + pad;
  const w = Math.max(1, Math.ceil((x1 - x0) * res)), h = Math.max(1, Math.ceil(hh * 2 * res));
  if (!sp) { sp = { c: makeCanvas(w, h), res: 0, x: 0, y: 0, w: 0, h: 0 }; L.spr[level] = sp; }
  else { sp.c.width = w; sp.c.height = h; } // resizing also clears it
  const g = sp.c.getContext('2d');
  g.setTransform(res, 0, 0, res, -x0 * res, hh * res);
  drawBody(g, L, 0, level, L.r * res >= 5 ? 2 : 1, 1 / res);
  sp.res = res; sp.x = x0; sp.y = -hh; sp.w = w / res; sp.h = h / res;
  return sp;
}

// Field-guide picture: the creature facing right, fitted into a size x size box centred on (x, y).
export function drawPortrait(ctx, pheno, x, y, size) {
  const L = lookFor(pheno);
  const back = L.rx * 0.8 + L.tl * 1.05;
  const halfH = Math.max(L.ry + (L.fins > 0 ? L.r * 0.62 : 0), L.ry * 0.6 + L.tl * 0.32 + L.tl * 0.1);
  const k = (size * 0.92) / Math.max(L.front + back, halfH * 2);
  ctx.save();
  ctx.translate(x + ((back - L.front) / 2) * k, y);
  ctx.scale(k, k);
  drawLocal(ctx, L, 0.22, 0.25, 0, 2, 1 / k);
  ctx.restore();
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Soft radial sprite drawn with additive blending; avoids creating gradients per frame.
function glowSprite(size, stops) {
  const c = makeCanvas(size, size), g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

// Tileable caustic network: integer frequencies + periodic warps keep the tile seamless.
function causticTile(n) {
  const c = makeCanvas(n, n), g = c.getContext('2d');
  const img = g.createImageData(n, n), d = img.data;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n, b = (TAU * j) / n;
      const w1 = 0.6 * Math.sin(a + 2 * b) + 0.4 * Math.cos(2 * a - b);
      const w2 = 0.5 * Math.cos(a - 2 * b + 1) + 0.4 * Math.sin(3 * b + a);
      const f = Math.sin(2 * a + w1 * 2) + Math.sin(2 * b + w2 * 2) + Math.sin(a + b + w1 + w2 + 0.7);
      const v = Math.exp(-f * f * 3.2);
      const k = (j * n + i) * 4;
      d[k] = 200; d[k + 1] = 255; d[k + 2] = 238; d[k + 3] = Math.round(255 * v * v);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Static pool floor, rendered once per world size at reduced resolution.
function makeBackdrop(W, H) {
  const k = Math.min(1, 1100 / Math.max(W, H));
  const c = makeCanvas(Math.round(W * k), Math.round(H * k)), g = c.getContext('2d');
  g.scale(k, k);
  const base = g.createRadialGradient(W * 0.45, H * 0.4, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.62);
  base.addColorStop(0, '#1d6a6c');
  base.addColorStop(0.45, '#124d58');
  base.addColorStop(1, '#06283a');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  // mottled floor: soft sand patches and darker weed beds
  const rand = lcg(7);
  for (let i = 0; i < 46; i++) {
    const x = rand() * W, y = rand() * H, r = 40 + rand() * 170;
    const light = rand() < 0.45;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, light ? 'rgba(120, 170, 140, 0.10)' : 'rgba(2, 24, 30, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // pebbles, very faint, so the floor reads as a floor when zoomed in
  for (let i = 0; i < 260; i++) {
    const x = rand() * W, y = rand() * H, r = 1.5 + rand() * 4;
    g.fillStyle = rand() < 0.5 ? 'rgba(160, 200, 180, 0.05)' : 'rgba(0, 20, 25, 0.12)';
    g.beginPath(); g.ellipse(x, y, r * 1.3, r, rand() * 3, 0, TAU); g.fill();
  }
  // shaded walls: the pool gets darker toward its rocky rim
  const edge = Math.min(W, H) * 0.16;
  const sides = [[0, 0, edge, 0, 0, 0, edge, H], [W, 0, W - edge, 0, W - edge, 0, edge, H],
    [0, 0, 0, edge, 0, 0, W, edge], [0, H, 0, H - edge, 0, H - edge, W, edge]];
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of sides) {
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, 'rgba(1, 14, 22, 0.75)');
    grad.addColorStop(0.35, 'rgba(1, 14, 22, 0.25)');
    grad.addColorStop(1, 'rgba(1, 14, 22, 0)');
    g.fillStyle = grad;
    g.fillRect(rx, ry, rw, rh);
  }
  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let dpr = 1, cw = 1, ch = 1; // CSS size
  let backdrop = null, bdW = 0, bdH = 0;
  let vignette = null;
  let lastNow = 0, waterT = 0, creatureT = 0, lastTick = -1;
  const caustic = causticTile(256);
  let causticPat = null;
  const lightSprite = glowSprite(128, [[0, 'rgba(255, 214, 140, 1)'], [0.3, 'rgba(255, 178, 96, 0.62)'], [0.65, 'rgba(236, 140, 80, 0.16)'], [1, 'rgba(236, 140, 80, 0)']]);
  const glint = glowSprite(32, [[0, 'rgba(255, 252, 210, 1)'], [0.2, 'rgba(226, 238, 128, 0.95)'], [0.5, 'rgba(150, 206, 84, 0.32)'], [1, 'rgba(120, 190, 70, 0)']]);
  const snow = new Float32Array(SNOW_COUNT * 4); // x, y, size, alpha-ish depth
  let snowW = 0, snowH = 0;
  const dash = [4, 6];
  const ghost = { x: 0, y: 0, r: 0, until: 0 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (w === cw && h === ch && canvas.width === Math.round(w * dpr)) return false;
    cw = w; ch = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    v.addColorStop(0, 'rgba(0, 8, 14, 0)');
    v.addColorStop(1, 'rgba(0, 8, 14, 0.42)');
    vignette = v;
    return true;
  }

  function ensureWorldAssets(world) {
    if (!backdrop || bdW !== world.width || bdH !== world.height) {
      bdW = world.width; bdH = world.height;
      backdrop = makeBackdrop(bdW, bdH);
    }
    if (!causticPat) causticPat = ctx.createPattern(caustic, 'repeat');
    if (snowW !== world.width || snowH !== world.height) {
      snowW = world.width; snowH = world.height;
      const rand = lcg(99);
      for (let i = 0; i < SNOW_COUNT; i++) {
        snow[i * 4] = rand() * snowW;
        snow[i * 4 + 1] = rand() * snowH;
        snow[i * 4 + 2] = 0.6 + rand() * 1.6;
        snow[i * 4 + 3] = rand();
      }
    }
  }

  function screenToWorld(view, sx, sy) {
    return { x: sx / view.scale + view.ox, y: sy / view.scale + view.oy };
  }

  function fitView(world) {
    resize();
    const scale = Math.min(cw / world.width, ch / world.height) * 0.97;
    return { scale, ox: world.width / 2 - cw / (2 * scale), oy: world.height / 2 - ch / (2 * scale) };
  }

  function drawCaustics(S, ex, ey, x0, y0, x1, y1, t) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = causticPat;
    for (let layer = 0; layer < 2; layer++) {
      const k = layer === 0 ? 3.4 : 2.3; // world units per texel
      const offX = layer === 0 ? t * 7 : -t * 5 + 90;
      const offY = layer === 0 ? t * 4 : t * 6.5 + 40;
      ctx.globalAlpha = layer === 0 ? 0.06 : 0.045;
      // the pattern is anchored to the transform origin, so shifting the origin scrolls it
      ctx.setTransform(S * k, 0, 0, S * k, ex + offX * S, ey + offY * S);
      ctx.fillRect((x0 - offX) / k, (y0 - offY) / k, (x1 - x0) / k, (y1 - y0) / k);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function draw(world, view, selectedId) {
    resize();
    ensureWorldAssets(world);
    const now = performance.now();
    const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
    lastNow = now;
    waterT += dt;
    // creatures only animate while the simulation advances, so pause freezes them
    if (world.tick !== lastTick) { creatureT += dt; lastTick = world.tick; }

    const W = world.width, H = world.height;
    const scale = view.scale, S = scale * dpr;
    const ex = -view.ox * S, ey = -view.oy * S;
    const px = 1 / scale;
    // sprite resolution snapped to powers of two so zooming rarely re-renders them
    const res = Math.min(32, Math.max(0.25, 2 ** Math.ceil(Math.log2(S))));
    // visible world rect (with margin) for culling
    const vx0 = view.ox - 30, vy0 = view.oy - 30;
    const vx1 = view.ox + cw / scale + 30, vy1 = view.oy + ch / scale + 30;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020d12';
    ctx.fillRect(0, 0, cw, ch);

    ctx.setTransform(S, 0, 0, S, ex, ey);
    // rocky rim around the pool
    ctx.fillStyle = '#0a1d22';
    ctx.fillRect(-14, -14, W + 28, H + 28);
    ctx.drawImage(backdrop, 0, 0, W, H);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    // sunlit patches: warm additive glows
    ctx.globalCompositeOperation = 'lighter';
    const lights = world.lights || [];
    for (let i = 0; i < lights.length; i++) {
      const lt = lights[i];
      const rr = lt.r * 1.5 * (1 + 0.04 * Math.sin(waterT * 0.7 + i * 1.9));
      ctx.globalAlpha = 0.26 + 0.05 * Math.sin(waterT * 0.5 + i);
      ctx.drawImage(lightSprite, lt.x - rr, lt.y - rr, rr * 2, rr * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const cx0 = Math.max(0, vx0), cy0 = Math.max(0, vy0), cx1 = Math.min(W, vx1), cy1 = Math.min(H, vy1);
    if (cx1 > cx0 && cy1 > cy0) drawCaustics(S, ex, ey, cx0, cy0, cx1, cy1, waterT);
    ctx.setTransform(S, 0, 0, S, ex, ey);

    // algae glints
    ctx.globalCompositeOperation = 'lighter';
    const food = world.food;
    const gs = Math.max(5.5, 4.5 * px), gh = gs / 2;
    for (let i = 0; i < food.length; i++) {
      const f = food[i];
      if (f.x < vx0 || f.x > vx1 || f.y < vy0 || f.y > vy1) continue;
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(waterT * 2.3 + f.x * 0.37 + f.y * 0.61);
      ctx.drawImage(glint, f.x - gh, f.y - gh, gs, gs);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const creatures = world.creatures;
    let sel = null;

    // soft shadows on the floor, one path for all of them
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i];
      if (c.x < vx0 || c.x > vx1 || c.y < vy0 || c.y > vy1) continue;
      const L = lookFor(c.pheno);
      const g = bodyRadius(c) / L.r; // the young are drawn small and grow
      if (L.r * g * scale < 1.8) continue;
      const off = L.r * g * 0.45;
      const sx = c.x + off, sy = c.y + off * 1.4;
      ctx.moveTo(sx + Math.cos(c.angle) * L.rx * g, sy + Math.sin(c.angle) * L.rx * g);
      ctx.ellipse(sx, sy, L.rx * g, L.ry * g, c.angle, 0, TAU);
    }
    ctx.fill();

    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i];
      if (c.id === selectedId) sel = c;
      if (c.x < vx0 || c.x > vx1 || c.y < vy0 || c.y > vy1) continue;
      const p = c.pheno;
      const L = lookFor(p);
      const e = c.energy / p.maxEnergy;
      const level = e > 0.4 ? 0 : e > 0.18 ? 1 : 2;
      const g = bodyRadius(c) / L.r;
      const onScreen = L.r * g * scale;
      if (onScreen < 1.3) {
        ctx.fillStyle = L.body[level];
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(L.r * g, 1.2 * px), 0, TAU);
        ctx.fill();
        continue;
      }
      const out = c.outputs;
      const thrust = out ? out[1] : 0.5, turn = out ? out[0] : 0;
      const swing = Math.sin(c.phase + creatureT * 7.5) * (0.1 + 0.5 * thrust) - turn * 0.35;
      const flap = Math.sin(c.phase * 1.7 + creatureT * 4.2);
      const cs = Math.cos(c.angle) * S * g, sn = Math.sin(c.angle) * S * g;
      ctx.setTransform(cs, sn, -sn, cs, c.x * S + ex, c.y * S + ey);
      if (onScreen > SPRITE_MAX_PX) {
        drawLocal(ctx, L, swing, flap, level, 2, px);
      } else {
        if (onScreen >= 1.8) drawTail(ctx, L, swing);
        const sp = spriteFor(L, level, res);
        ctx.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h);
      }
    }
    ctx.setTransform(S, 0, 0, S, ex, ey);

    // marine snow drifting above everything, for depth
    const drift = dt * 4;
    ctx.fillStyle = 'rgba(214, 238, 232, 0.16)';
    ctx.beginPath();
    for (let i = 0; i < SNOW_COUNT; i++) {
      const o = i * 4;
      let x = snow[o] + drift * (0.6 + snow[o + 3]) + Math.sin(waterT * 0.3 + i) * 0.05;
      let y = snow[o + 1] + drift * 0.45 * (0.5 + snow[o + 3]);
      if (x > W) x -= W;
      if (y > H) y -= H;
      snow[o] = x; snow[o + 1] = y;
      if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
      const s = Math.max(snow[o + 2], 0.9 * px);
      ctx.rect(x, y, s, s);
    }
    ctx.fill();
    ctx.restore(); // pool clip

    ctx.setTransform(S, 0, 0, S, ex, ey);
    if (sel) {
      const L = lookFor(sel.pheno);
      ghost.x = sel.x; ghost.y = sel.y; ghost.r = L.rx; ghost.until = now + 2200;
      const pulse = 1 + 0.06 * Math.sin(waterT * 3);
      ctx.lineWidth = 1.5 * px;
      ctx.strokeStyle = 'rgba(255, 238, 196, 0.9)';
      ctx.beginPath();
      ctx.arc(sel.x, sel.y, (L.front + 5 * px + 3) * pulse, 0, TAU);
      ctx.stroke();
      dash[0] = 4 * px; dash[1] = 6 * px;
      ctx.setLineDash(dash);
      ctx.lineWidth = px;
      ctx.strokeStyle = 'rgba(170, 236, 224, 0.32)';
      ctx.beginPath();
      ctx.arc(sel.x, sel.y, sel.pheno.senseRange, 0, TAU);
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
    } else if (selectedId != null && now < ghost.until) {
      // selected creature just died: let its ring fade where it was
      const a = (ghost.until - now) / 2200;
      ctx.lineWidth = 1.5 * px;
      ctx.strokeStyle = `rgba(255, 170, 150, ${(0.8 * a).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, ghost.r + 8 * px + (1 - a) * 10, 0, TAU);
      ctx.stroke();
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, cw, ch);
  }

  resize();
  return {
    draw,
    screenToWorld,
    fitView,
    get width() { return cw; },
    get height() { return ch; },
  };
}
