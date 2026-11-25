// A small kit for the cinematic plates, kept clean: exact closed shapes with integer corners, smooth
// single strokes with round joins, soft gradient shading, smooth ridges, fog banks of soft gradients and
// rim light cut from an offset mask. No grain, no jitter, no sketch marks. Plates are painted once, off
// screen, a slice at a time.
import { TAU } from '../core/util.js';

export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
const hex = (c) => { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
export function rgbaJ(c, a, R, j = 14) { const [r, g, b] = hex(c), d = 0; return `rgba(${Math.max(0, Math.min(255, r + d)) | 0},${Math.max(0, Math.min(255, g + d)) | 0},${Math.max(0, Math.min(255, b + d)) | 0},${a})`; }
export function mixHex(a, b, k) { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); }

// a clean stroke along a polyline: one smooth curve through the midpoints, round caps and joins
export function stroke(g, pts, w, col, a, R, o = {}) {
  if (pts.length < 2) return;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = rgbaJ(col, a * 0.85); g.lineWidth = Math.max(1, Math.round(w * 0.8));
  g.beginPath(); g.moveTo(Math.round(pts[0][0]), Math.round(pts[0][1]));
  for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], Math.round(m[0]), Math.round(m[1])); }
  const e = pts[pts.length - 1]; g.lineTo(Math.round(e[0]), Math.round(e[1])); g.stroke();
}
// shade a region (Path2D) cleanly: one soft gradient along the stroke direction, light to dark, no marks
export function fillStrokes(g, path, box, col, n, R, o = {}) {
  const [x0, y0, x1, y1] = box, ang = o.ang ?? 0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.hypot(x1 - x0, y1 - y0) / 2;
  const dx = Math.cos(ang) * r, dy = Math.sin(ang) * r, a = (o.a ?? 0.5) * 0.7;
  const dark = o.cols ? o.cols[1] || col : mixHex(col, '#000000', 0.35);
  const gr = g.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  gr.addColorStop(0, rgbaJ(mixHex(col, '#ffffff', 0.05), a * 0.5)); gr.addColorStop(0.55, rgbaJ(col, a * 0.6)); gr.addColorStop(1, rgbaJ(dark, a));
  g.save(); g.fillStyle = gr; g.fill(path); g.restore();
}
// a closed shape from a list of points: exact, integer-snapped corners (the amp is ignored: no jitter)
export function ragged(pts, amp, R, step = 6) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(Math.round(x), Math.round(y)) : p.moveTo(Math.round(x), Math.round(y))));
  p.closePath(); return p;
}
// a mountain / ruin ridge silhouette across the width
export function ridge(W, y, amp, freq, R, o = {}) {
  const p = new Path2D(); p.moveTo(0, o.bottom ?? 9999);
  let h = 0, v = 0;
  for (let x = 0; x <= W; x += o.step || 6) {
    v += (R() - 0.5) * amp * 0.12; v *= 0.9; h += v;
    const yy = y + Math.sin(x * freq) * amp * 0.6 + Math.sin(x * freq * 2.7 + 1.3) * amp * 0.25 + h * 0.6;
    p.lineTo(x, Math.round(yy));
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
export function grain() {}
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
