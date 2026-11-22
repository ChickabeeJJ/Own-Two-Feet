// Shared math, noise, RNG and colour helpers.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smooth = t => t * t * (3 - 2 * t);
export const easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const sign = v => (v < 0 ? -1 : 1);
export const hypot = Math.hypot;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[(Math.random() * arr.length) | 0];

// wrap an angle into (-PI, PI]
export function wrapAng(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
export const angLerp = (a, b, t) => a + wrapAng(b - a) * t;

// frame-rate independent exponential approach
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

// critically damped spring (smooth-damp), returns [value, velocity]
export function smoothDamp(cur, target, vel, time, dt) {
  const omega = 2 / Math.max(1e-4, time);
  const x = omega * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel + omega * change) * dt;
  const nv = (vel - omega * temp) * e;
  return [target + (change + temp) * e, nv];
}

// ---------- deterministic hashing / RNG ----------
export function hash2(x, y, seed = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- value / gradient noise ----------
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash2(i, 0, seed) * 2 - 1, b = hash2(i + 1, 0, seed) * 2 - 1;
  return lerp(a, b, fade(f));
}
function grad(ix, iy, seed, dx, dy) {
  const a = hash2(ix, iy, seed) * TAU;
  return Math.cos(a) * dx + Math.sin(a) * dy;
}
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fade(fx), v = fade(fy);
  const n00 = grad(ix, iy, seed, fx, fy);
  const n10 = grad(ix + 1, iy, seed, fx - 1, fy);
  const n01 = grad(ix, iy + 1, seed, fx, fy - 1);
  const n11 = grad(ix + 1, iy + 1, seed, fx - 1, fy - 1);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 1.41;
}
export function fbm1(x, seed, oct = 4) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += noise1(x * f, seed + i * 31) * a; n += a; a *= 0.5; f *= 2; }
  return s / n;
}
export function fbm2(x, y, seed, oct = 4) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += noise2(x * f, y * f, seed + i * 57) * a; n += a; a *= 0.5; f *= 2; }
  return s / n;
}

// ---------- colour ----------
export function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) | (clamp(r | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(b | 0, 0, 255)).toString(16).slice(1);
}
const mixCache = new Map();
export function mix(a, b, t) {
  t = clamp(t, 0, 1);
  const key = a + b + ((t * 64) | 0);
  let v = mixCache.get(key);
  if (v) return v;
  const A = hexToRgb(a), B = hexToRgb(b);
  v = rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
  if (mixCache.size > 4000) mixCache.clear();
  mixCache.set(key, v);
  return v;
}
export function rgba(hex, a) {
  const c = hexToRgb(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
export const shade = (hex, k) => (k < 0 ? mix(hex, '#000000', -k) : mix(hex, '#ffffff', k));

// ---------- geometry ----------
export function segPointDist2(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  const qx = ax + dx * t - px, qy = ay + dy * t - py;
  return qx * qx + qy * qy;
}
export function segSegDist2(ax, ay, bx, by, cx, cy, dx, dy) {
  return Math.min(
    segPointDist2(ax, ay, bx, by, cx, cy), segPointDist2(ax, ay, bx, by, dx, dy),
    segPointDist2(cx, cy, dx, dy, ax, ay), segPointDist2(cx, cy, dx, dy, bx, by));
}

// tiny object pool
export class Pool {
  constructor(make, n) { this.items = []; for (let i = 0; i < n; i++) { const o = make(); o.alive = false; this.items.push(o); } this.i = 0; }
  get() {
    const L = this.items.length;
    for (let k = 0; k < L; k++) {
      const o = this.items[(this.i + k) % L];
      if (!o.alive) { this.i = (this.i + k + 1) % L; o.alive = true; return o; }
    }
    const o = this.items[this.i]; this.i = (this.i + 1) % L; o.alive = true; return o;
  }
}
