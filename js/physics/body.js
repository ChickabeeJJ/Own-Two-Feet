// Ragdoll body: XPBD particles with rigid bones, angular joint limits, and angle-space muscles.
//
// Unlike a "pull every point to a pose" ragdoll, muscles here act on *relative joint angles*
// (internal, momentum conserving). Only two forces come from outside the body: a root drive that
// carries the pelvis with the gameplay controller, and a balance torque that keeps the torso upright.
// Both scale with `strength`, so the same body blends continuously from fully animated to fully limp.
import { TILE, TILES } from '../world/tiles.js';
import { wrapAng, clamp, TAU } from '../core/util.js';

export const P = { HEAD: 0, NECK: 1, CHEST: 2, BELLY: 3, PELVIS: 4, ELB_F: 5, HAND_F: 6, ELB_B: 7, HAND_B: 8, KNEE_F: 9, FOOT_F: 10, TOE_F: 11, KNEE_B: 12, FOOT_B: 13, TOE_B: 14 };
const NP = 15;
// [a, b, length]
export const BONES = [
  [1, 0, 10], [2, 1, 6], [3, 2, 14], [4, 3, 12],
  [2, 5, 15], [5, 6, 14], [2, 7, 15], [7, 8, 14],
  [4, 9, 19], [9, 10, 18], [10, 11, 7], [4, 12, 19], [12, 13, 18], [13, 14, 7],
];
// [a, j, b, offset, min, max, stiffness]  (angles for a body facing right; mirrored when facing left)
export const JOINTS = [
  [4, 3, 2, 0, -0.55, 0.55, 0.16],   // 0 lower spine
  [3, 2, 1, 0, -0.45, 0.45, 0.16],   // 1 upper spine
  [2, 1, 0, 0, -0.75, 0.75, 0.12],   // 2 neck
  [3, 2, 5, Math.PI - 1.25, -2.45, 2.55, 0.11], // 3 shoulder front (offset keeps the range clear of +-PI)
  [2, 5, 6, 0, -2.6, 0.05, 0.1],     // 4 elbow front
  [3, 2, 7, Math.PI - 1.25, -2.45, 2.55, 0.09], // 5 shoulder back
  [2, 7, 8, 0, -2.6, 0.05, 0.08],    // 6 elbow back
  [3, 4, 9, 0, -2.4, 0.8, 0.16],     // 7 hip front
  [4, 9, 10, 0, -0.05, 2.7, 0.16],   // 8 knee front
  [9, 10, 11, 0, -2.15, -0.55, 0.12],// 9 ankle front
  [3, 4, 12, 0, -2.4, 0.8, 0.16],    // 10 hip back
  [4, 12, 13, 0, -0.05, 2.7, 0.16],  // 11 knee back
  [12, 13, 14, 0, -2.15, -0.55, 0.12],// 12 ankle back
];
export const NJ = JOINTS.length;
export const SH_OFF = 1.25;
const MASS = [4, 2, 10, 8, 9, 2, 1, 2, 1, 3, 1.5, 0.7, 3, 1.5, 0.7];
const RAD = [8.5, 4.5, 7, 7, 7, 4, 4, 4, 4, 4.5, 3.6, 3.2, 4.5, 3.6, 3.2];
const FRIC = [0.3, 0.3, 0.3, 0.3, 0.35, 0.3, 0.45, 0.3, 0.45, 0.4, 0.8, 0.8, 0.4, 0.8, 0.8];

export const SUB = 4;

export class Body {
  constructor(o = {}) {
    const s = this.s = o.scale || 1;
    this.facing = o.facing || 1;
    this.x = new Float32Array(NP); this.y = new Float32Array(NP);
    this.vx = new Float32Array(NP); this.vy = new Float32Array(NP);
    this.px = new Float32Array(NP); this.py = new Float32Array(NP);   // substep previous
    this.ix = new Float32Array(NP); this.iy = new Float32Array(NP);   // tick previous (render interp)
    this.w = new Float32Array(NP); this.r = new Float32Array(NP);
    this.contact = new Uint8Array(NP);
    this.massTotal = 0;
    const heavy = o.heavy || 1;
    for (let i = 0; i < NP; i++) {
      const m = MASS[i] * s * s * heavy;
      this.w[i] = 1 / m; this.r[i] = RAD[i] * s; this.massTotal += m;
    }
    this.len = BONES.map(b => b[2] * s);
    this.target = new Float32Array(NJ);         // muscle targets (facing-right frame)
    this.jointK = new Float32Array(NJ).fill(1); // per joint strength multipliers (pose can relax limbs)
    this.strength = 1;     // 0 limp .. 1 fully driven
    this.rootK = 1;        // root drive gain
    this.balanceK = 1;
    this.root = { x: o.x || 0, y: o.y || 0 };
    this.torso = -Math.PI / 2;   // target absolute angle pelvis->chest (facing-right frame)
    this.headAng = -Math.PI / 2;
    this.headK = 0.5;
    this.gravity = 2600;
    this.drag = 0;
    this.groundFric = 1;
    this.limitsOn = true;
    this.collide = true;
    this.lastHitSpeed = 0;   // fastest impact against terrain this tick (px/s)
    this.reset(o.x || 0, o.y || 0);
  }
  // place in a standing T-ish pose with pelvis at (x,y)
  reset(x, y) {
    const s = this.s, f = this.facing;
    const pts = [
      [0, -42], [0, -32], [0, -26], [0, -12], [0, 0],
      [2, -12], [6, 1], [-2, -12], [-5, 1],
      [3, 18], [1, 36], [8, 37], [-3, 18], [-4, 36], [3, 37],
    ];
    for (let i = 0; i < NP; i++) {
      this.x[i] = this.ix[i] = this.px[i] = x + pts[i][0] * s * f;
      this.y[i] = this.iy[i] = this.py[i] = y + pts[i][1] * s;
      this.vx[i] = this.vy[i] = 0;
    }
    this.root.x = x; this.root.y = y;
  }
  get cx() { return this.x[P.PELVIS]; }
  get cy() { return this.y[P.PELVIS]; }
  com() {
    let mx = 0, my = 0, vx = 0, vy = 0, M = 0;
    for (let i = 0; i < NP; i++) { const m = 1 / this.w[i]; mx += this.x[i] * m; my += this.y[i] * m; vx += this.vx[i] * m; vy += this.vy[i] * m; M += m; }
    return { x: mx / M, y: my / M, vx: vx / M, vy: vy / M };
  }
  impulse(i, dvx, dvy) { this.vx[i] += dvx; this.vy[i] += dvy; }
  impulseAll(dvx, dvy, k = 1) { for (let i = 0; i < NP; i++) { this.vx[i] += dvx * k; this.vy[i] += dvy * k; } }
  translate(dx, dy) { for (let i = 0; i < NP; i++) { this.x[i] += dx; this.y[i] += dy; this.ix[i] += dx; this.iy[i] += dy; this.px[i] += dx; this.py[i] += dy; } }
  // mirror the body horizontally about the pelvis (an instant, readable turn)
  flip() {
    const cx = this.x[P.PELVIS], icx = this.ix[P.PELVIS], vcx = this.vx[P.PELVIS];
    for (let i = 0; i < NP; i++) {
      this.x[i] = 2 * cx - this.x[i]; this.px[i] = 2 * cx - this.px[i];
      this.ix[i] = 2 * icx - this.ix[i]; this.vx[i] = 2 * vcx - this.vx[i];
    }
    this.facing = -this.facing;
  }
  boneAng(a, b) { return Math.atan2(this.y[b] - this.y[a], this.x[b] - this.x[a]); }
  // current relative joint angle (facing-right frame)
  jointAngle(k) {
    const [a, j, b, off] = JOINTS[k];
    const th = wrapAng(Math.atan2(this.y[b] - this.y[j], this.x[b] - this.x[j]) - Math.atan2(this.y[j] - this.y[a], this.x[j] - this.x[a]) - off * this.facing);
    return th * this.facing;
  }

  // ------------------------------------------------------------ simulation
  step(dt, world) {
    const h = dt / SUB;
    for (let i = 0; i < NP; i++) { this.ix[i] = this.x[i]; this.iy[i] = this.y[i]; }
    this.contact.fill(0);
    this.lastHitSpeed = 0;
    for (let n = 0; n < SUB; n++) this.substep(h, world);
  }
  substep(h, world) {
    const { x, y, vx, vy, px, py, w } = this;
    const g = this.gravity, dragK = 1 - this.drag * h;
    for (let i = 0; i < NP; i++) {
      vy[i] += g * h;
      if (dragK !== 1) { vx[i] *= dragK; vy[i] *= dragK; }
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx[i] * h; y[i] += vy[i] * h;
    }
    const s = this.strength;
    // bones (twice for rigidity)
    for (let it = 0; it < 2; it++) {
      for (let k = 0; k < BONES.length; k++) {
        const a = BONES[k][0], b = BONES[k][1];
        let dx = x[b] - x[a], dy = y[b] - y[a];
        const d = Math.hypot(dx, dy) || 1e-6;
        const C = d - this.len[k];
        const wa = w[a], wb = w[b], ws = wa + wb;
        const corr = C / ws / d;
        x[a] += dx * corr * wa; y[a] += dy * corr * wa;
        x[b] -= dx * corr * wb; y[b] -= dy * corr * wb;
      }
    }
    const f = this.facing;
    // joint limits + muscles
    for (let k = 0; k < NJ; k++) {
      const J = JOINTS[k];
      const a = J[0], j = J[1], b = J[2];
      const ux = x[j] - x[a], uy = y[j] - y[a], vxx = x[b] - x[j], vyy = y[b] - y[j];
      const lu = ux * ux + uy * uy || 1e-6, lv = vxx * vxx + vyy * vyy || 1e-6;
      const th = wrapAng(Math.atan2(vyy, vxx) - Math.atan2(uy, ux) - J[3] * f);
      // gradients of theta
      const gax = -uy / lu, gay = ux / lu;            // d/da = +perp(u)/|u|^2 ... (sign folded below)
      const gbx = -vyy / lv, gby = vxx / lv;          // d/db = perp(v)/|v|^2
      // d/da = perp(u)/|u|^2 with perp(u)=(-uy,ux) ; d/dj = -(d/da + d/db)
      const W = w[a] * (gax * gax + gay * gay) + w[b] * (gbx * gbx + gby * gby) + w[j] * ((gax + gbx) ** 2 + (gay + gby) ** 2);
      if (W < 1e-12) continue;
      let C = 0, frac = 0;
      // limit (in the facing frame)
      const lo = f > 0 ? J[4] : -J[5], hi = f > 0 ? J[5] : -J[4];
      if (this.limitsOn) {
        if (th < lo) { C = th - lo; frac = 1; }
        else if (th > hi) { C = th - hi; frac = 1; }
      }
      if (!frac && s > 0.001) {
        const tgt = this.target[k] * f;
        C = wrapAng(th - tgt);
        frac = J[6] * s * this.jointK[k];
      }
      if (!frac) continue;
      const dl = -C / W * frac;
      x[a] += w[a] * gax * dl; y[a] += w[a] * gay * dl;
      x[b] += w[b] * gbx * dl; y[b] += w[b] * gby * dl;
      x[j] -= w[j] * (gax + gbx) * dl; y[j] -= w[j] * (gay + gby) * dl;
    }
    if (s > 0.001) {
      // balance: torso orientation (external torque)
      this.orient(P.PELVIS, P.CHEST, f > 0 ? this.torso : Math.PI - this.torso, 0.22 * s * this.balanceK);
      this.orient(P.NECK, P.HEAD, f > 0 ? this.headAng : Math.PI - this.headAng, 0.12 * s * this.headK);
      // root drive: pelvis follows the controller
      const rk = 0.3 * s * this.rootK;
      if (rk > 0) {
        const p = P.PELVIS;
        x[p] += (this.root.x - x[p]) * rk; y[p] += (this.root.y - y[p]) * rk;
        // the chest is carried a little too, so the drive never feels like a puppet string at the hips
        const c = P.CHEST;
        const tcx = this.root.x + Math.cos(f > 0 ? this.torso : Math.PI - this.torso) * 26 * this.s;
        const tcy = this.root.y + Math.sin(f > 0 ? this.torso : Math.PI - this.torso) * 26 * this.s;
        x[c] += (tcx - x[c]) * rk * 0.35; y[c] += (tcy - y[c]) * rk * 0.35;
      }
    }
    if (this.collide && world) this.collideWorld(world, h);
    // velocities + internal damping
    let mvx = 0, mvy = 0, M = 0;
    const inv = 1 / h;
    for (let i = 0; i < NP; i++) {
      let nvx = (x[i] - px[i]) * inv, nvy = (y[i] - py[i]) * inv;
      const sp = nvx * nvx + nvy * nvy;
      if (sp > 9e6) { const k = 3000 / Math.sqrt(sp); nvx *= k; nvy *= k; }
      vx[i] = nvx; vy[i] = nvy;
      const m = 1 / w[i]; mvx += nvx * m; mvy += nvy * m; M += m;
    }
    const damp = (0.035 * s + 0.004);
    mvx /= M; mvy /= M;
    for (let i = 0; i < NP; i++) { vx[i] -= (vx[i] - mvx) * damp; vy[i] -= (vy[i] - mvy) * damp; }
  }
  orient(a, b, target, k) {
    if (k <= 0) return;
    const { x, y, w } = this;
    const dx = x[b] - x[a], dy = y[b] - y[a];
    const l2 = dx * dx + dy * dy || 1e-6;
    const C = wrapAng(Math.atan2(dy, dx) - target);
    const gbx = -dy / l2, gby = dx / l2;
    const W = (w[a] + w[b]) * (gbx * gbx + gby * gby);
    const dl = -C / W * k;
    x[b] += w[b] * gbx * dl; y[b] += w[b] * gby * dl;
    x[a] -= w[a] * gbx * dl; y[a] -= w[a] * gby * dl;
  }
  collideWorld(world, h) {
    const { x, y, px, py, r } = this;
    for (let i = 0; i < NP; i++) {
      const R = r[i];
      const tx0 = Math.floor((x[i] - R) / TILE), tx1 = Math.floor((x[i] + R) / TILE);
      const ty0 = Math.floor((y[i] - R) / TILE), ty1 = Math.floor((y[i] + R) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const t = world.get(tx, ty);
        const D = TILES[t];
        if (!D.solid) {
          // one-way tops (platforms, the top rung of a ladder) only catch a particle coming down onto them
          if (this.oneWayOff || !(D.platform || (D.climb && !TILES[world.get(tx, ty - 1)].climb))) continue;
          const top = ty * TILE;
          if (py[i] + R <= top + 3 && y[i] + R > top && x[i] > tx * TILE - R * 0.5 && x[i] < tx * TILE + TILE + R * 0.5) { y[i] = top - R; this.contact[i] = 1; }
          continue;
        }
        const bx0 = tx * TILE, by0 = ty * TILE + (D.half ? TILE / 2 : 0), bx1 = bx0 + TILE, by1 = ty * TILE + TILE;
        const qx = clamp(x[i], bx0, bx1), qy = clamp(y[i], by0, by1);
        let nx = x[i] - qx, ny = y[i] - qy;
        let d = Math.hypot(nx, ny);
        let pen;
        if (d < 1e-6) {
          // centre inside the tile: push out along the shallowest axis
          const l = x[i] - bx0, rr = bx1 - x[i], u = y[i] - by0, dd = by1 - y[i];
          const m = Math.min(l, rr, u, dd);
          if (m === u) { nx = 0; ny = -1; pen = u + R; }
          else if (m === dd) { nx = 0; ny = 1; pen = dd + R; }
          else if (m === l) { nx = -1; ny = 0; pen = l + R; }
          else { nx = 1; ny = 0; pen = rr + R; }
        } else {
          if (d >= R) continue;
          nx /= d; ny /= d; pen = R - d;
        }
        x[i] += nx * pen; y[i] += ny * pen;
        // impact speed along the normal (for landing / splat feedback)
        const vn = -((x[i] - px[i]) * nx + (y[i] - py[i]) * ny) / h;
        const vin = -(this.vx[i] * nx + this.vy[i] * ny);
        if (vin > this.lastHitSpeed) this.lastHitSpeed = vin;
        // friction: remove part of the tangential motion this substep
        const tdx = x[i] - px[i], tdy = y[i] - py[i];
        const tn = tdx * nx + tdy * ny;
        const tx_ = tdx - tn * nx, ty_ = tdy - tn * ny;
        const fr = FRIC[i] * TILES[t].fric * this.groundFric;
        x[i] -= tx_ * fr; y[i] -= ty_ * fr;
        if (ny < -0.5) this.contact[i] = 1;
        else if (!this.contact[i]) this.contact[i] = 2;
        void vn;
      }
    }
  }
  // interpolated point for rendering
  ipx(i, a) { return this.ix[i] + (this.x[i] - this.ix[i]) * a; }
  ipy(i, a) { return this.iy[i] + (this.y[i] - this.iy[i]) * a; }
  speed() { const c = this.com(); return Math.hypot(c.vx, c.vy); }
  restSpeed() {
    let m = 0;
    for (let i = 0; i < NP; i++) m = Math.max(m, Math.abs(this.vx[i]) + Math.abs(this.vy[i]));
    return m;
  }
  bounds() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < NP; i++) { x0 = Math.min(x0, this.x[i] - this.r[i]); x1 = Math.max(x1, this.x[i] + this.r[i]); y0 = Math.min(y0, this.y[i] - this.r[i]); y1 = Math.max(y1, this.y[i] + this.r[i]); }
    return { x0, y0, x1, y1 };
  }
}
export { NP };
export const TAU_ = TAU;
