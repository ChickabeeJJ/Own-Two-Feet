/* ============================================================================
   ART BIBLE — Own Two Feet
   Style family: painterly gradient + soft-shaded vector ("lantern-lit storybook").
     No outlines. Form comes from cylindrical gradients, rim light, contact AO and
     material texture. Backgrounds recede through fog; gameplay owns the value extremes.
   Mood: melancholic, warm-in-the-dark, wondrous.
   Qualities: hand-sewn cloth dolls under lantern light; layered paper-thin fog flats
     of an old stage; moss, carved stone, glowing thread.
   Shape language:
     Player (the Doll)  — soft capsules & rounded blocks. Cream body, crimson scarf/sash,
                          a cyan "thread of light" stitched in the chest (accent, brightest).
     Hollows (enemies)  — tall, tattered, triangular hems, pale bone masks, ember eyes.
     Keepers (NPCs)     — rounded with one big readable prop (hat+pack, apron+hammer,
                          robe+staff, top hat+tape).
     World              — heavy eroded organic masses (rounded corners, strata, moss);
                          things you build are crisp and square (order vs nature).
   Palette roles: biome backgrounds desaturated; player accent crimson #c8473d + thread
     cyan #9ff3ff; hazard = ember #ff7a3a; reward = glimmer cyan-white + gilt #f2c86a.
   Light: key light from the upper left in every asset; rim light from behind (biome sun).
   ============================================================================ */
import { mix, shade, rgba, clamp, hexToRgb, TAU } from '../core/util.js';

export const LIGHT = { x: -0.55, y: -0.83 };

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

// ---------------------------------------------------------------- periodic value noise (seamless)
export function makePeriodicNoise(seed, period) {
  const P = period;
  const h = (x, y) => {
    x = ((x % P) + P) % P; y = ((y % P) + P) % P;
    let n = (x * 374761393 + y * 668265263 + seed * 362437) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
export function periodicFbm(seed, period, oct = 4) {
  const ns = [];
  for (let i = 0; i < oct; i++) ns.push(makePeriodicNoise(seed + i * 31, period << i));
  return (x, y) => { let v = 0, a = 0.5, n = 0; for (let i = 0; i < oct; i++) { v += ns[i](x * (1 << i), y * (1 << i)) * a; n += a; a *= 0.5; } return v / n; };
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- shaded forms
// tapered capsule from A (radius ra) to B (radius rb), shaded like a cylinder lit from LIGHT
export function capsule(g, ax, ay, bx, by, ra, rb, base, o = {}) {
  let dx = bx - ax, dy = by - ay;
  const L = Math.hypot(dx, dy) || 0.001;
  const ux = dx / L, uy = dy / L;
  let nx = -uy, ny = ux;
  if (nx * LIGHT.x + ny * LIGHT.y < 0) { nx = -nx; ny = -ny; }
  const ang = Math.atan2(uy, ux);
  g.beginPath();
  g.arc(bx, by, rb, ang - Math.PI / 2, ang + Math.PI / 2);
  g.arc(ax, ay, ra, ang + Math.PI / 2, ang + Math.PI * 1.5);
  g.closePath();
  const r = Math.max(ra, rb);
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const gr = g.createLinearGradient(mx - nx * r, my - ny * r, mx + nx * r, my + ny * r);
  // matte cloth / clay: soft diffuse ramp, the lit edge only slightly brighter, no sheen band
  const dark = Math.min(o.dark ?? 0.34, 0.36), hi = Math.min(o.hi ?? 0.05, 0.06);
  gr.addColorStop(0, shade(base, -dark));
  gr.addColorStop(0.35, shade(base, -dark * 0.4));
  gr.addColorStop(0.7, base);
  gr.addColorStop(1, shade(base, hi));
  g.fillStyle = gr;
  g.fill();
  if (o.rim) {
    // thin back-light on the shadow side
    g.strokeStyle = rgba(o.rim, o.rimA ?? 0.45); g.lineWidth = Math.max(0.8, r * 0.16);
    g.beginPath(); g.moveTo(ax - nx * ra * 0.92, ay - ny * ra * 0.92); g.lineTo(bx - nx * rb * 0.92, by - ny * rb * 0.92); g.stroke();
  }
}
// smooth hull around a polyline of [x, y, r] nodes, filled with a cylinder gradient across the axis
export function hull(g, nodes, base, o = {}) {
  const n = nodes.length;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const p = nodes[Math.max(0, i - 1)], q = nodes[Math.min(n - 1, i + 1)];
    let dx = q[0] - p[0], dy = q[1] - p[1];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    left.push([nodes[i][0] - dy * nodes[i][2], nodes[i][1] + dx * nodes[i][2]]);
    right.push([nodes[i][0] + dy * nodes[i][2], nodes[i][1] - dx * nodes[i][2]]);
  }
  g.beginPath();
  g.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) { const a = left[i - 1], b = left[i]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
  g.lineTo(left[n - 1][0], left[n - 1][1]);
  const e = nodes[n - 1], ea = Math.atan2(e[1] - nodes[n - 2][1], e[0] - nodes[n - 2][0]);
  g.arc(e[0], e[1], e[2], ea + Math.PI / 2, ea - Math.PI / 2, true);
  for (let i = n - 1; i > 0; i--) { const a = right[i], b = right[i - 1]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
  g.lineTo(right[0][0], right[0][1]);
  const s = nodes[0], sa = Math.atan2(nodes[1][1] - s[1], nodes[1][0] - s[0]);
  g.arc(s[0], s[1], s[2], sa - Math.PI / 2, sa + Math.PI / 2, true);
  g.closePath();
  // gradient across the main axis
  const a = nodes[0], b = nodes[n - 1];
  let ax = b[0] - a[0], ay = b[1] - a[1];
  const AL = Math.hypot(ax, ay) || 1;
  let nx = -ay / AL, ny = ax / AL;
  if (nx * LIGHT.x + ny * LIGHT.y < 0) { nx = -nx; ny = -ny; }
  const r = Math.max(...nodes.map(q => q[2]));
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const gr = g.createLinearGradient(mx - nx * r, my - ny * r, mx + nx * r, my + ny * r);
  const dark = Math.min(o.dark ?? 0.32, 0.36), hi = Math.min(o.hi ?? 0.05, 0.06);
  gr.addColorStop(0, shade(base, -dark)); gr.addColorStop(0.35, shade(base, -dark * 0.4)); gr.addColorStop(0.7, base);
  gr.addColorStop(1, shade(base, hi));
  g.fillStyle = o.fill || gr;
  g.fill();
  return { nx, ny };
}
export function softDisc(g, x, y, r, col, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
export function ballShade(g, x, y, r, base, o = {}) {
  const gr = g.createRadialGradient(x + LIGHT.x * r * 0.45, y + LIGHT.y * r * 0.45, r * 0.1, x, y, r);
  gr.addColorStop(0, shade(base, Math.min(o.hi ?? 0.07, 0.08))); gr.addColorStop(0.55, base); gr.addColorStop(1, shade(base, -Math.min(o.dark ?? 0.32, 0.36)));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
export function stitches(g, pts, col, w = 1, len = 2.4, gap = 2.2) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const L = Math.hypot(bx - ax, by - ay); const ux = (bx - ax) / L, uy = (by - ay) / L;
    for (let d = gap * 0.5; d < L; d += len + gap) {
      const e = Math.min(L, d + len);
      g.beginPath(); g.moveTo(ax + ux * d - uy * 0.9 * w, ay + uy * d + ux * 0.9 * w); g.lineTo(ax + ux * e + uy * 0.9 * w, ay + uy * e - ux * 0.9 * w); g.stroke();
    }
  }
}
export { mix, shade, rgba, clamp, hexToRgb, TAU };
