// Procedural, seamless 128x128 material textures (4x4 tiles each), grass and snow lips, foliage and bark.
// Built once per (material, colour) and reused as canvas patterns, so terrain reads as real material
// (strata, pebbles, cracks, grain, mortar) instead of flat squares.
import { canvas, periodicFbm, rng, shade, mix, rgba, hexToRgb, TAU } from './paint.js';

const S = 128;
const cache = new Map();

function noiseFill(g, base, seed, contrast = 0.1, scale = 16, grain = 0.03, extra) {
  const img = g.createImageData(S, S);
  const d = img.data;
  const f = periodicFbm(seed, S / scale, 4);
  const [r0, g0, b0] = hexToRgb(base);
  let h = seed * 977;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    let v = 1 + (f(x / scale, y / scale) - 0.5) * 2 * contrast + ((h / 0x7fffffff) - 0.5) * 2 * grain;
    if (extra) v *= extra(x, y);
    const i = (y * S + x) * 4;
    d[i] = r0 * v; d[i + 1] = g0 * v; d[i + 2] = b0 * v; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
// draw a shape at x,y and its wrapped copies so the texture stays seamless
function wrap(fn, x, y, m = 16) {
  for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) {
    const xx = x + ox, yy = y + oy;
    if (xx < -m || yy < -m || xx > S + m || yy > S + m) continue;
    fn(xx, yy);
  }
}
function pebbles(g, base, R, n, size = 1) {
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, rx = (2 + R() * 3.5) * size, ry = rx * (0.55 + R() * 0.3), rot = R() * 0.6 - 0.3;
    const col = shade(base, 0.06 + R() * 0.16);
    wrap((xx, yy) => {
      g.fillStyle = rgba('#000000', 0.22); g.beginPath(); g.ellipse(xx + 0.6, yy + 1.2, rx, ry, rot, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath(); g.ellipse(xx, yy, rx, ry, rot, 0, TAU); g.fill();
      g.fillStyle = rgba('#ffffff', 0.16); g.beginPath(); g.ellipse(xx - rx * 0.25, yy - ry * 0.35, rx * 0.5, ry * 0.35, rot, 0, TAU); g.fill();
    }, x, y);
  }
}
function cracks(g, base, R, n, len = 26, w = 1.2) {
  for (let i = 0; i < n; i++) {
    let x = R() * S, y = R() * S, a = R() * TAU;
    const pts = [[x, y]];
    const segs = 3 + (R() * 4 | 0);
    for (let k = 0; k < segs; k++) { a += (R() - 0.5) * 1.2; x += Math.cos(a) * len / segs; y += Math.sin(a) * len / segs; pts.push([x, y]); }
    wrap((ox, oy) => {
      const dx = ox - pts[0][0], dy = oy - pts[0][1];
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = rgba('#ffffff', 0.12); g.lineWidth = w;
      g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p[0] + dx + 0.8, p[1] + dy + 1) : g.moveTo(p[0] + dx + 0.8, p[1] + dy + 1)); g.stroke();
      g.strokeStyle = shade(base, -0.42); g.lineWidth = w;
      g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p[0] + dx, p[1] + dy) : g.moveTo(p[0] + dx, p[1] + dy)); g.stroke();
    }, pts[0][0], pts[0][1], 40);
  }
}
function facets(g, base, R, n) {
  for (let i = 0; i < n; i++) {
    const cx = R() * S, cy = R() * S, r = 8 + R() * 12, k = 5 + (R() * 3 | 0), rot = R() * TAU;
    const pts = [];
    for (let j = 0; j < k; j++) { const a = rot + j / k * TAU; const rr = r * (0.7 + R() * 0.4); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    const tone = R() < 0.5 ? 0.05 + R() * 0.06 : -0.04 - R() * 0.05;
    wrap((xx, yy) => {
      g.fillStyle = shade(base, tone);
      g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(xx + p[0], yy + p[1]) : g.moveTo(xx + p[0], yy + p[1])); g.closePath(); g.fill();
      // lit upper-left edge of each facet
      g.strokeStyle = rgba('#ffffff', 0.1); g.lineWidth = 1;
      g.beginPath(); g.moveTo(xx + pts[0][0], yy + pts[0][1]); for (let j = 1; j < Math.ceil(k / 2); j++) g.lineTo(xx + pts[j][0], yy + pts[j][1]); g.stroke();
    }, cx, cy, 24);
  }
}

const MAKERS = {
  soil(g, c, R) {
    noiseFill(g, c, 11, 0.09, 18, 0.035, (x, y) => 1 + Math.sin(y / S * TAU * 4 + Math.sin(x / S * TAU) * 1.4) * 0.025);
    pebbles(g, c, R, 16, 0.9);
    // roots
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const x0 = R() * S, y0 = R() * S;
      const pts = []; let x = x0, y = y0, a = Math.PI / 2 + (R() - 0.5);
      for (let k = 0; k < 6; k++) { pts.push([x, y]); a += (R() - 0.5) * 0.8; x += Math.cos(a) * 5; y += Math.sin(a) * 5; }
      wrap((xx, yy) => { g.strokeStyle = rgba(shade(c, -0.45), 0.55); g.lineWidth = 1.2; g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p[0] + xx - x0, p[1] + yy - y0) : g.moveTo(p[0] + xx - x0, p[1] + yy - y0)); g.stroke(); }, x0, y0, 34);
    }
  },
  stone(g, c, R) { noiseFill(g, c, 21, 0.12, 24, 0.03); facets(g, c, R, 14); cracks(g, c, R, 6); pebbles(g, c, R, 5, 0.6); },
  deep(g, c, R) {
    noiseFill(g, c, 31, 0.14, 28, 0.03); facets(g, c, R, 10); cracks(g, c, R, 4, 34, 1.4);
    for (let i = 0; i < 10; i++) { const x = R() * S, y = R() * S; g.fillStyle = rgba('#d8d0ff', 0.35); g.fillRect(x, y, 1.2, 1.2); }
  },
  moss(g, c, R, extra) {
    MAKERS.stone(g, c, R);
    const f = periodicFbm(41, 4, 3);
    const m = extra || '#6f8f5a';
    const img = g.getImageData(0, 0, S, S), d = img.data; const [mr, mg, mb] = hexToRgb(m);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = f(x / 32, y / 32);
      if (v > 0.53) { const k = Math.min(1, (v - 0.53) * 8); const i = (y * S + x) * 4; const s = 0.85 + ((x * 7 + y * 13) % 5) * 0.06; d[i] = d[i] * (1 - k) + mr * s * k; d[i + 1] = d[i + 1] * (1 - k) + mg * s * k; d[i + 2] = d[i + 2] * (1 - k) + mb * s * k; }
    }
    g.putImageData(img, 0, 0);
  },
  sand(g, c, R) { noiseFill(g, c, 51, 0.05, 12, 0.06, (x, y) => 1 + Math.sin((y + Math.sin(x / S * TAU * 2) * 4) / S * TAU * 8) * 0.025); pebbles(g, c, R, 6, 0.5); },
  snow(g, c, R) {
    noiseFill(g, c, 61, 0.05, 20, 0.02);
    for (let i = 0; i < 30; i++) { const x = R() * S, y = R() * S; g.fillStyle = rgba('#ffffff', 0.7); g.fillRect(x, y, 1, 1); }
    for (let i = 0; i < 8; i++) { const x = R() * S, y = R() * S; wrap((xx, yy) => { g.fillStyle = rgba('#a9c2da', 0.18); g.beginPath(); g.ellipse(xx, yy, 10, 4, 0, 0, TAU); g.fill(); }, x, y); }
  },
  ice(g, c, R) {
    noiseFill(g, c, 71, 0.06, 32, 0.01, (x, y) => 0.92 + ((x + y) % 64) / 64 * 0.12);
    g.strokeStyle = rgba('#ffffff', 0.3); g.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) { const x = R() * S, y = R() * S; wrap((xx, yy) => { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + 18, yy - 22); g.stroke(); }, x, y, 30); }
    cracks(g, shade(c, 0.4), R, 3, 30, 0.8);
  },
  plank(g, c, R) {
    const H = 16;
    for (let row = 0; row < S / H; row++) {
      const tone = (R() - 0.5) * 0.12;
      const bc = shade(c, tone);
      g.fillStyle = bc; g.fillRect(0, row * H, S, H);
      // grain
      for (let k = 0; k < 4; k++) {
        const yy = row * H + 2 + R() * (H - 4), amp = 0.6 + R() * 1.2, ph = R() * TAU;
        g.strokeStyle = rgba(shade(bc, -0.3), 0.45); g.lineWidth = 0.8;
        g.beginPath(); for (let x = 0; x <= S; x += 4) { const y = yy + Math.sin(x / S * TAU * 2 + ph) * amp; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      }
      g.fillStyle = rgba('#ffffff', 0.12); g.fillRect(0, row * H, S, 1.5);
      g.fillStyle = rgba('#000000', 0.3); g.fillRect(0, row * H + H - 1.5, S, 1.5);
      // end joints with nails
      const j = (R() * 4 | 0) * 32 + (row % 2 ? 16 : 0);
      g.fillStyle = rgba('#000000', 0.32); g.fillRect(j, row * H, 1.5, H);
      g.fillStyle = '#3a3138'; g.beginPath(); g.arc(j + 4, row * H + 5, 1.1, 0, TAU); g.arc(j - 3, row * H + 11, 1.1, 0, TAU); g.fill();
      if (R() < 0.5) { const kx = R() * S, ky = row * H + H / 2; g.fillStyle = rgba(shade(bc, -0.35), 0.8); g.beginPath(); g.ellipse(kx, ky, 3, 2, 0, 0, TAU); g.fill(); }
    }
  },
  brick(g, c, R) {
    g.fillStyle = shade(c, -0.35); g.fillRect(0, 0, S, S);
    const H = 16, Wb = 32;
    for (let row = 0; row < S / H; row++) for (let col = -1; col < S / Wb + 1; col++) {
      const x = col * Wb + (row % 2 ? Wb / 2 : 0), y = row * H;
      const bc = shade(c, (R() - 0.5) * 0.16);
      g.fillStyle = bc; g.beginPath(); g.roundRect(x + 1.2, y + 1.2, Wb - 2.4, H - 2.4, 2); g.fill();
      g.fillStyle = rgba('#ffffff', 0.14); g.fillRect(x + 2, y + 1.5, Wb - 4, 1.5);
      g.fillStyle = rgba('#000000', 0.2); g.fillRect(x + 2, y + H - 3, Wb - 4, 1.4);
      if (R() < 0.3) { g.fillStyle = shade(bc, -0.2); g.beginPath(); g.arc(x + 4 + R() * 24, y + 4 + R() * 8, 1.5, 0, TAU); g.fill(); }
    }
  },
  ruin(g, c, R) {
    g.fillStyle = shade(c, -0.3); g.fillRect(0, 0, S, S);
    const H = 32, Wb = 64;
    for (let row = 0; row < S / H; row++) for (let col = -1; col < S / Wb + 1; col++) {
      const x = col * Wb + (row % 2 ? Wb / 2 : 0), y = row * H;
      const bc = shade(c, (R() - 0.5) * 0.12);
      g.fillStyle = bc; g.beginPath(); g.roundRect(x + 1.5, y + 1.5, Wb - 3, H - 3, 5); g.fill();
      g.fillStyle = rgba('#ffffff', 0.12); g.fillRect(x + 4, y + 2, Wb - 8, 2);
      g.fillStyle = rgba('#000000', 0.18); g.fillRect(x + 4, y + H - 4, Wb - 8, 2);
      // carved rune on some blocks
      if (R() < 0.25) { g.strokeStyle = rgba(shade(bc, -0.35), 0.8); g.lineWidth = 1.4; const cx = x + Wb / 2, cy = y + H / 2; g.beginPath(); g.arc(cx, cy, 6, 0, TAU); g.moveTo(cx, cy - 9); g.lineTo(cx, cy + 9); g.stroke(); }
    }
    cracks(g, c, R, 4, 22, 1);
  },
  marble(g, c, R) {
    const f = periodicFbm(81, 4, 4);
    noiseFill(g, c, 82, 0.03, 32, 0.01, (x, y) => { const v = Math.abs(Math.sin((x / S + f(x / 32, y / 32) * 1.6) * TAU * 2)); return v < 0.06 ? 0.82 + v * 3 : 1; });
  },
  obsidian(g, c, R) {
    noiseFill(g, c, 91, 0.1, 28, 0.02);
    for (let i = 0; i < 3; i++) { const x = R() * S; wrap((xx) => { const gr = g.createLinearGradient(xx, 0, xx + 30, 0); gr.addColorStop(0, rgba('#b8a8ff', 0)); gr.addColorStop(0.5, rgba('#b8a8ff', 0.16)); gr.addColorStop(1, rgba('#b8a8ff', 0)); g.fillStyle = gr; g.save(); g.translate(xx, 0); g.transform(1, 0, -0.6, 1, 0, 0); g.fillRect(0, 0, 30, S); g.restore(); }, x, 0, 60); }
  },
  ember(g, c, R) {
    noiseFill(g, '#2b1714', 101, 0.16, 20, 0.04); facets(g, '#2b1714', R, 8);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 5; i++) {
      let x = R() * S, y = R() * S, a = R() * TAU; const pts = [[x, y]];
      for (let k = 0; k < 5; k++) { a += (R() - 0.5) * 1.4; x += Math.cos(a) * 8; y += Math.sin(a) * 8; pts.push([x, y]); }
      wrap((ox, oy) => {
        const dx = ox - pts[0][0], dy = oy - pts[0][1];
        for (const [w, col] of [[5, rgba(c, 0.25)], [2.4, c], [1, '#ffe2b8']]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p[0] + dx, p[1] + dy) : g.moveTo(p[0] + dx, p[1] + dy)); g.stroke(); }
      }, pts[0][0], pts[0][1], 50);
    }
  },
  bark(g, c, R) {
    noiseFill(g, c, 111, 0.1, 12, 0.03, (x, y) => 1 + Math.sin(x / S * TAU * 9 + Math.sin(y / S * TAU * 2) * 1.5) * 0.08);
    g.strokeStyle = rgba(shade(c, -0.45), 0.6); g.lineWidth = 1.4;
    for (let i = 0; i < 10; i++) { const x = R() * S, y = R() * S; wrap((xx, yy) => { g.beginPath(); g.moveTo(xx, yy); g.bezierCurveTo(xx + 2, yy + 8, xx - 2, yy + 16, xx + 1, yy + 26); g.stroke(); }, x, y, 30); }
  },
  leaf(g, c, R) {
    g.fillStyle = shade(c, -0.14); g.fillRect(0, 0, S, S);
    const tones = [shade(c, -0.22), shade(c, -0.08), c, shade(c, 0.1), shade(c, 0.2)];
    for (let i = 0; i < 260; i++) {
      const x = R() * S, y = R() * S, r = 3 + R() * 3.5, rot = R() * TAU, t = tones[(R() * tones.length) | 0];
      wrap((xx, yy) => { g.fillStyle = t; g.beginPath(); g.ellipse(xx, yy, r, r * 0.55, rot, 0, TAU); g.fill(); }, x, y, 8);
    }
  },
};

export function texture(mat, color, extra) {
  const key = mat + color + (extra || '');
  let c = cache.get(key);
  if (c) return c;
  c = canvas(S, S);
  const g = c.getContext('2d');
  const R = rng(mat.length * 7919 + 17);
  (MAKERS[mat] || MAKERS.stone)(g, color, R, extra);
  cache.set(key, c);
  return c;
}
const patCache = new Map();
export function pattern(g, mat, color, extra) {
  const key = mat + color + (extra || '');
  let p = patCache.get(key);
  if (!p) { p = g.createPattern(texture(mat, color, extra), 'repeat'); patCache.set(key, p); }
  return p;
}

// grass lip: a 128x26 strip laid on the top edge of exposed grass tiles (6px rise above the tile)
export function grassLip(grass, hi, seed = 1) {
  const key = 'lip' + grass + hi;
  let c = cache.get(key);
  if (c) return c;
  c = canvas(S, 26);
  const g = c.getContext('2d');
  const R = rng(seed * 13 + 5);
  const top = 7;
  // body of turf with a wavy lower edge
  g.fillStyle = shade(grass, -0.18);
  g.beginPath(); g.moveTo(0, top);
  for (let x = 0; x <= S; x += 4) g.lineTo(x, top + 9 + Math.sin(x / S * TAU * 4) * 1.6 + Math.sin(x / S * TAU * 9) * 1.2);
  g.lineTo(S, top); g.closePath(); g.fill();
  g.fillStyle = grass;
  g.beginPath(); g.moveTo(0, top);
  for (let x = 0; x <= S; x += 4) g.lineTo(x, top + 6 + Math.sin(x / S * TAU * 4 + 1) * 1.4 + Math.sin(x / S * TAU * 11) * 1.0);
  g.lineTo(S, top); g.closePath(); g.fill();
  // little hanging tufts
  for (let i = 0; i < 9; i++) { const x = R() * S, len = 3 + R() * 5; g.fillStyle = shade(grass, -0.1); g.beginPath(); g.moveTo(x - 2, top + 6); g.lineTo(x + 2, top + 6); g.lineTo(x + 0.5, top + 6 + len); g.closePath(); g.fill(); }
  // short static blades along the rim (animated tall grass is drawn live on top)
  for (let i = 0; i < 70; i++) {
    const x = (i / 70) * S + R() * 2, h = 2 + R() * 6, lean = (R() - 0.5) * 3;
    g.fillStyle = R() < 0.35 ? hi : shade(grass, (R() - 0.5) * 0.2);
    g.beginPath(); g.moveTo(x - 1.2, top + 1.5); g.lineTo(x + 1.2, top + 1.5); g.lineTo(x + lean, top + 1.5 - h); g.closePath(); g.fill();
  }
  g.fillStyle = rgba(hi, 0.65); g.fillRect(0, top, S, 1.5);
  cache.set(key, c);
  return c;
}
export function snowLip() {
  let c = cache.get('snowlip');
  if (c) return c;
  c = canvas(S, 22);
  const g = c.getContext('2d');
  const R = rng(77);
  g.fillStyle = '#c9d9e8';
  g.beginPath(); g.moveTo(0, 18); for (let x = 0; x <= S; x += 8) g.quadraticCurveTo(x + 4, 22 + R() * 2, x + 8, 17 + R() * 3); g.lineTo(S, 6); g.lineTo(0, 6); g.closePath(); g.fill();
  g.fillStyle = '#f4f8fc';
  g.beginPath(); g.moveTo(0, 14); for (let x = 0; x <= S; x += 8) g.quadraticCurveTo(x + 4, 17 + R() * 2, x + 8, 13 + R() * 3); g.lineTo(S, 4); for (let x = S; x >= 0; x -= 16) g.quadraticCurveTo(x - 8, 1 + R() * 2, x - 16, 4); g.closePath(); g.fill();
  g.fillStyle = rgba('#ffffff', 0.9); g.fillRect(0, 4, S, 1.4);
  cache.set('snowlip', c);
  return c;
}
export { S as TEX };
