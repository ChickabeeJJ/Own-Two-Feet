// A small procedural painting kit for the cinematic plates. Everything is built from many small marks:
// bristle strokes (several thin hairs side by side, each with its own value and opacity), directional
// fills made of hundreds of strokes, ragged silhouettes, fog banks of soft overlapping blots, rim light cut
// from an offset mask, and film grain. Plates are painted once, off screen, a slice at a time.
import { TAU } from '../core/util.js';

export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
const hex = (c) => { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
export function rgbaJ(c, a, R, j = 14) { const [r, g, b] = hex(c), d = R ? (R() - 0.5) * 2 * j : 0; return `rgba(${Math.max(0, Math.min(255, r + d)) | 0},${Math.max(0, Math.min(255, g + d)) | 0},${Math.max(0, Math.min(255, b + d)) | 0},${a})`; }
export function mixHex(a, b, k) { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); }

// a bristle stroke along a polyline: n hairs across the width, tapering at both ends
export function stroke(g, pts, w, col, a, R, o = {}) {
  const hairs = o.hairs || Math.max(3, Math.min(9, Math.round(w / 1.6)));
  const taper = o.taper ?? 1;
  let L = 0; const seg = [];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
  g.lineCap = 'round';
  for (let h = 0; h < hairs; h++) {
    const off = (h / (hairs - 1 || 1) - 0.5) * w, hw = Math.max(0.5, (w / hairs) * (0.9 + R() * 0.8));
    g.strokeStyle = rgbaJ(col, a * (0.45 + R() * 0.55), R, o.jit ?? 16);
    g.lineWidth = hw;
    g.beginPath();
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], pr = pts[Math.max(0, i - 1)];
      const dx = q[0] - pr[0], dy = q[1] - pr[1], dl = Math.hypot(dx, dy) || 1;
      const u = L ? acc / L : 0, tp = taper ? Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) ** 0.35 : 1;
      const x = p[0] - dy / dl * off * tp + (R() - 0.5) * 0.6, y = p[1] + dx / dl * off * tp + (R() - 0.5) * 0.6;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
      if (i < seg.length) acc += seg[i];
    }
    g.stroke();
  }
}
// fill a region (Path2D) with many directional strokes, values wandering around a base colour
export function fillStrokes(g, path, box, col, n, R, o = {}) {
  g.save(); g.clip(path);
  const [x0, y0, x1, y1] = box, ang = o.ang ?? 0, len = o.len || 18, w = o.w || 4;
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), a = ang + (R() - 0.5) * (o.spread ?? 0.5), l = len * (0.5 + R());
    const c = o.cols ? o.cols[Math.floor(R() * o.cols.length)] : col;
    stroke(g, [[x, y], [x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + (R() - 0.5) * 2], [x + Math.cos(a) * l, y + Math.sin(a) * l]], w * (0.6 + R() * 0.8), c, o.a ?? 0.5, R, { hairs: o.hairs || 4, jit: o.jit });
  }
  g.restore();
}
// a ragged closed shape from a list of points: every edge is broken into small irregular steps
export function ragged(pts, amp, R, step = 6) {
  const p = new Path2D(); let first = true;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(d / step));
    const nx = -(b[1] - a[1]) / (d || 1), ny = (b[0] - a[0]) / (d || 1);
    for (let k = 0; k < n; k++) {
      const u = k / n, j = (R() - 0.5) * 2 * amp;
      const x = a[0] + (b[0] - a[0]) * u + nx * j, y = a[1] + (b[1] - a[1]) * u + ny * j;
      if (first) { p.moveTo(x, y); first = false; } else p.lineTo(x, y);
    }
  }
  p.closePath(); return p;
}
// a mountain / ruin ridge silhouette across the width
export function ridge(W, y, amp, freq, R, o = {}) {
  const p = new Path2D(); p.moveTo(0, o.bottom ?? 9999);
  let h = 0, v = 0;
  for (let x = 0; x <= W; x += o.step || 6) {
    v += (R() - 0.5) * amp * 0.25; v *= 0.86; h += v;
    const yy = y + Math.sin(x * freq) * amp * 0.6 + Math.sin(x * freq * 2.7 + 1.3) * amp * 0.25 + h * 0.6 + (R() - 0.5) * amp * 0.08;
    p.lineTo(x, yy);
  }
  p.lineTo(W, o.bottom ?? 9999); p.closePath(); return p;
}
// fog: many soft overlapping blots in a band
export function fog(g, W, y, h, col, a, n, R) {
  for (let i = 0; i < n; i++) {
    const x = R() * W, yy = y + (R() - 0.5) * h, r = h * (0.4 + R() * 0.9), rx = r * (2 + R() * 3);
    const gr = g.createRadialGradient(x, yy, 0, x, yy, r);
    gr.addColorStop(0, rgbaJ(col, a * (0.5 + R() * 0.5), R, 8)); gr.addColorStop(1, rgbaJ(col, 0));
    g.save(); g.translate(x, yy); g.scale(rx / r, 1); g.translate(-x, -yy);
    g.fillStyle = gr; g.beginPath(); g.arc(x, yy, r, 0, TAU); g.fill(); g.restore();
  }
}
// rim light: the lit sliver of a silhouette canvas, cut by an offset copy of itself
export function rimLight(src, dx, dy, col, a = 1) {
  const c = canvas(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.globalAlpha = a; g.fillRect(0, 0, c.width, c.height);
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-out'; g.drawImage(src, dx, dy);
  return c;
}
// film grain / canvas tooth over a plate
export function grain(g, W, H, R, n, a = 0.06) {
  for (let i = 0; i < n; i++) { const v = R() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${a * R()})`; g.fillRect(R() * W, R() * H, 1 + R() * 1.5, 1 + R() * 1.5); }
}
// a soft glow
export function glow(g, x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgbaJ(col, a)); gr.addColorStop(0.4, rgbaJ(col, a * 0.35)); gr.addColorStop(1, rgbaJ(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
// a vignette
export function vignette(g, W, H, a = 0.6) { const gr = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }

// run painting jobs (generators) a few milliseconds per frame, so no frame hitches
export class Painter {
  constructor() { this.jobs = []; this.done = new Map(); }
  add(name, gen) { this.jobs.push({ name, it: gen }); }
  step(budget = 6) {
    const t0 = performance.now();
    while (this.jobs.length && performance.now() - t0 < budget) {
      const j = this.jobs[0], r = j.it.next();
      if (r.done) { this.done.set(j.name, r.value); this.jobs.shift(); }
    }
  }
  get(name) { return this.done.get(name) || null; }
  finish() { while (this.jobs.length) this.step(1e9); }
}
