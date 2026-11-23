// Ragdoll look: sleek lit capsules (no outlines), rounded block head, cloth cape, blade.
// Shading = base fill + soft highlight band toward the key light + shadow band + optional rim light.
import { shade, mix, rgba, clamp, lerp, TAU } from '../core/util.js';

const LX = -0.55, LY = -0.83; // key light direction (from upper left)

export const DEFAULT_LOOK = {
  body: '#f2ece1', shade: '#c9bfae', mat: 'cloth', eyes: '#9ff3ff', eyeStyle: 'dots',
  head: 'none', cape: { col: '#b8473f', len: 7, style: 'cape' }, blade: { col: '#e8eef5', glow: '#9ff3ff', len: 30 },
  marks: [], rim: '#ffe2bd', trail: null, scale: 1,
};

export class Cape {
  constructor(n, segLen) {
    this.n = n; this.seg = segLen;
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.ox = new Float32Array(n); this.oy = new Float32Array(n);
    this.ix = new Float32Array(n); this.iy = new Float32Array(n);
    this.init = false;
  }
  step(dt, ax, ay, wind, facing) {
    const n = this.n;
    if (!this.init) { for (let i = 0; i < n; i++) { this.x[i] = this.ox[i] = this.ix[i] = ax - facing * i * this.seg; this.y[i] = this.oy[i] = this.iy[i] = ay + i * 2; } this.init = true; }
    for (let i = 0; i < n; i++) { this.ix[i] = this.x[i]; this.iy[i] = this.y[i]; }
    this.x[0] = ax; this.y[0] = ay;
    const g = 900 * dt * dt;
    for (let i = 1; i < n; i++) {
      const vx = (this.x[i] - this.ox[i]) * 0.965, vy = (this.y[i] - this.oy[i]) * 0.965;
      this.ox[i] = this.x[i]; this.oy[i] = this.y[i];
      // a little stiffness: the cloth flares back from the shoulders instead of hanging flat
      this.x[i] += vx + (wind * 60 - facing * 380) * dt * dt * (i / n);
      this.y[i] += vy + g;
    }
    for (let it = 0; it < 4; it++) {
      this.x[0] = ax; this.y[0] = ay;
      for (let i = 1; i < n; i++) {
        const dx = this.x[i] - this.x[i - 1], dy = this.y[i] - this.y[i - 1];
        const d = Math.hypot(dx, dy) || 1e-5;
        const c = (d - this.seg) / d;
        if (i === 1) { this.x[i] -= dx * c; this.y[i] -= dy * c; }
        else { this.x[i] -= dx * c * 0.5; this.y[i] -= dy * c * 0.5; this.x[i - 1] += dx * c * 0.5; this.y[i - 1] += dy * c * 0.5; }
      }
      // the cape hangs behind the body
      for (let i = 1; i < n; i++) {
        const minBack = -facing * 1.5;
        if ((this.x[i] - ax) * facing > 4 + i * 1.5) this.x[i] = ax + facing * (4 + i * 1.5);
        void minBack;
      }
    }
  }
}

// bodies are drawn by the art module (shaded capsule anatomy, accessories, faces, blades)
export { drawDoll as drawBody, bladeGeom } from '../art/doll.js';

export function drawShadow(ctx, x, y, w, k) {
  if (k <= 0.02) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, w);
  g.addColorStop(0, `rgba(0,0,0,${0.32 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.28, 0, 0, TAU); ctx.fill();
}
export { clamp };
