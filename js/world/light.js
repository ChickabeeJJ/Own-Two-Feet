// Coloured flood-fill lighting on the tile grid, upsampled smoothly and multiplied over the scene.
// Sky light falls down open columns, spreads sideways; emitters (lanterns, crystals, embers) and
// dynamic lights (the player's soul glow, projectiles) spread with distance falloff.
import { TILE, TILES } from './tiles.js';
import { clamp } from '../core/util.js';

const DECAY_AIR = 0.066, DECAY_SOLID = 0.155;
const glowCache = new Map();
export function glowSprite(col) {
  let c = glowCache.get(col);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, col); rg.addColorStop(0.25, col.replace(/rgb\(([^)]+)\)/, 'rgba($1,0.45)'));
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  glowCache.set(col, c);
  return c;
}
export function drawGlow(ctx, x, y, r, rgb, a) {
  const key = `rgb(${(rgb[0] * 255) | 0},${(rgb[1] * 255) | 0},${(rgb[2] * 255) | 0})`;
  ctx.globalAlpha = a;
  ctx.drawImage(glowSprite(key), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

export class LightMap {
  constructor(world) {
    this.world = world;
    this.cv = document.createElement('canvas');
    this.g = this.cv.getContext('2d');
    this.w = 0; this.h = 0; this.x0 = 0; this.y0 = 0;
    this.sky = new Map(); this.skyV = -1;
    this.emitters = [];
  }
  skyline(tx, from) {
    const W = this.world;
    if (this.skyV !== W.version) { this.sky.clear(); this.skyV = W.version; }
    let e = this.sky.get(tx);
    if (e !== undefined) return e;
    let y = Math.min(from, W.surface(tx) - 50);
    const lim = y + 400;
    while (y < lim) { const t = W.get(tx, y); if (TILES[t].opaque) break; y++; }
    this.sky.set(tx, y);
    if (this.sky.size > 4000) this.sky.clear();
    return y;
  }
  compute(view, dyn, sun, amb, skyAmt) {
    const W = this.world;
    const M = 12;
    const x0 = Math.floor(view.x0 / TILE) - M, y0 = Math.floor(view.y0 / TILE) - M;
    const w = Math.floor(view.x1 / TILE) + M - x0 + 1, h = Math.floor(view.y1 / TILE) + M - y0 + 1;
    if (w !== this.w || h !== this.h) {
      this.w = w; this.h = h;
      this.R = new Float32Array(w * h); this.G = new Float32Array(w * h); this.B = new Float32Array(w * h);
      this.op = new Uint8Array(w * h);
      this.cv.width = w; this.cv.height = h;
      this.img = this.g.createImageData(w, h);
    }
    this.x0 = x0; this.y0 = y0;
    const R = this.R, G = this.G, B = this.B, op = this.op;
    R.fill(0); G.fill(0); B.fill(0);
    this.emitters.length = 0;
    const vx0 = Math.floor(view.x0 / TILE) - 1, vx1 = Math.floor(view.x1 / TILE) + 1;
    const vy0 = Math.floor(view.y0 / TILE) - 1, vy1 = Math.floor(view.y1 / TILE) + 1;
    for (let i = 0; i < w; i++) {
      const tx = x0 + i;
      const sl = this.skyline(tx, y0);
      for (let j = 0; j < h; j++) {
        const ty = y0 + j, k = j * w + i;
        const t = W.get(tx, ty);
        const d = TILES[t];
        op[k] = d.opaque ? 1 : 0;
        if (ty < sl && skyAmt > 0) { R[k] = sun[0] * skyAmt; G[k] = sun[1] * skyAmt; B[k] = sun[2] * skyAmt; }
        if (d.light) {
          const L = d.light;
          if (L[0] > R[k]) R[k] = L[0]; if (L[1] > G[k]) G[k] = L[1]; if (L[2] > B[k]) B[k] = L[2];
          if (tx >= vx0 && tx <= vx1 && ty >= vy0 && ty <= vy1) this.emitters.push(tx, ty, t);
        }
      }
    }
    for (const L of dyn) {
      const i = Math.floor(L.x / TILE) - x0, j = Math.floor(L.y / TILE) - y0;
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const k = j * w + i;
      R[k] = Math.max(R[k], L.c[0] * L.s); G[k] = Math.max(G[k], L.c[1] * L.s); B[k] = Math.max(B[k], L.c[2] * L.s);
    }
    // propagate: two rounds of four sweeps
    for (let round = 0; round < 2; round++) {
      for (let j = 0; j < h; j++) {
        const row = j * w;
        for (let i = 1; i < w; i++) prop(R, G, B, op, row + i, row + i - 1);
        for (let i = w - 2; i >= 0; i--) prop(R, G, B, op, row + i, row + i + 1);
      }
      for (let i = 0; i < w; i++) {
        for (let j = 1; j < h; j++) prop(R, G, B, op, j * w + i, (j - 1) * w + i);
        for (let j = h - 2; j >= 0; j--) prop(R, G, B, op, j * w + i, (j + 1) * w + i);
      }
    }
    // write image (with ambient floor)
    const data = this.img.data;
    for (let k = 0, n = w * h; k < n; k++) {
      data[k * 4] = clamp(R[k] + amb[0], 0, 1) * 255;
      data[k * 4 + 1] = clamp(G[k] + amb[1], 0, 1) * 255;
      data[k * 4 + 2] = clamp(B[k] + amb[2], 0, 1) * 255;
      data[k * 4 + 3] = 255;
    }
    this.g.putImageData(this.img, 0, 0);
  }
  // multiply over everything drawn so far (ctx in world space)
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.cv, this.x0 * TILE, this.y0 * TILE, this.w * TILE, this.h * TILE);
    ctx.restore();
  }
  sample(x, y) {
    const i = Math.floor(x / TILE) - this.x0, j = Math.floor(y / TILE) - this.y0;
    if (!this.R || i < 0 || j < 0 || i >= this.w || j >= this.h) return 1;
    const k = j * this.w + i;
    return Math.max(this.R[k], this.G[k], this.B[k]);
  }
}

function prop(R, G, B, op, k, from) {
  const d = op[k] ? DECAY_SOLID : DECAY_AIR;
  const r = R[from] - d, g = G[from] - d, b = B[from] - d;
  if (r > R[k]) R[k] = r;
  if (g > G[k]) G[k] = g;
  if (b > B[k]) B[k] = b;
}
