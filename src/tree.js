// Tree-of-life panel: draws layoutPhylogeny() on a canvas, with hover captions
// and click-to-follow for living species.
import { layoutPhylogeny } from './phylo.js';

const ROW = 13, PAD = 8, REDRAW_MS = 1000;

export function createTreePanel(canvas, caption, onSelectSpecies) {
  let layout = null, lastDraw = 0, hoverRow = -1, dayTicks = 600;

  const xOf = (t, w) => PAD + (t / layout.end) * (w - PAD * 2);
  const describe = (n) => {
    const a = Math.floor(n.start / dayTicks) + 1, b = Math.floor(n.end / dayTicks) + 1;
    const span = n.alive ? `day ${a} to now` : `day ${a} to ${b}, extinct`;
    return `${n.name.common} (${n.name.genus} ${n.name.epithet}) · ${span} · peak ${n.peak}`;
  };

  function draw() {
    const w = canvas.clientWidth || 300;
    const h = Math.max(ROW * 2, layout.rows * ROW + PAD);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const y = (row) => PAD / 2 + row * ROW + ROW / 2;
    for (const n of layout.nodes) {
      const x0 = xOf(n.start, w), x1 = Math.max(x0 + 2, xOf(n.end, w)), yy = y(n.row);
      const col = `hsla(${n.hue}, 70%, 62%, ${n.alive ? 1 : 0.45})`;
      if (n.parentRow != null) {
        ctx.strokeStyle = `hsla(${n.hue}, 50%, 60%, 0.35)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y(n.parentRow)); ctx.lineTo(x0, yy); ctx.stroke();
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5 + Math.min(3, Math.log2(1 + n.peak) / 2);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
      if (n.alive) { ctx.beginPath(); ctx.arc(x1, yy, 3, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x1 - 2.5, yy - 2.5); ctx.lineTo(x1 + 2.5, yy + 2.5); ctx.moveTo(x1 + 2.5, yy - 2.5); ctx.lineTo(x1 - 2.5, yy + 2.5); ctx.stroke(); }
      if (n.row === hoverRow) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, yy - ROW / 2, w, ROW);
      }
    }
  }

  const rowAt = (e) => {
    const r = canvas.getBoundingClientRect();
    return Math.floor((e.clientY - r.top - PAD / 2) / ROW);
  };
  canvas.addEventListener('mousemove', (e) => {
    if (!layout) return;
    const row = rowAt(e);
    if (row === hoverRow) return;
    hoverRow = row;
    const n = layout.nodes[row];
    caption.textContent = n ? describe(n) : 'Hover a branch to name it; click a living one to follow it.';
    canvas.style.cursor = n && n.alive ? 'pointer' : 'default';
    draw();
  });
  canvas.addEventListener('mouseleave', () => { hoverRow = -1; if (layout) draw(); });
  canvas.addEventListener('click', (e) => {
    const n = layout && layout.nodes[rowAt(e)];
    if (n && n.alive) onSelectSpecies(n.id);
  });

  return {
    update(world, force = false) {
      const now = performance.now();
      if (!force && now - lastDraw < REDRAW_MS) return;
      lastDraw = now;
      layout = layoutPhylogeny(world.species.all(), world.tick);
      draw();
    },
    reset() { hoverRow = -1; lastDraw = 0; caption.textContent = 'Hover a branch to name it; click a living one to follow it.'; },
  };
}
