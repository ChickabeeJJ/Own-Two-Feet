// Procedural animation: turns controller state into muscle targets for the ragdoll.
// Gait is distance-driven (feet don't skate), feet are placed with two-bone IK onto the real terrain,
// and every target is smoothed so transitions blend instead of popping.
import { P, NJ, SH_OFF, JOINTS } from './body.js';
import { wrapAng, clamp, lerp, angLerp, smooth, TAU } from '../core/util.js';

const HALF_PI = Math.PI / 2;

// attack arm keyframes: [t, upperArm, foreArm, wrist], absolute angles in the facing-right frame (0 = forward,
// -PI/2 = up, +PI/2 = down). The elbow only folds one way (foreArm <= upperArm), so a swing reads as a real
// arm: cocked with a bent elbow, snapping straight through the strike, folding again on the follow-through.
// wrist turns the weapon off the line of the forearm, so the blade leads, lags and wraps past the body.
const ATK = {
  // blade: a forehand cut from over the shoulder, a rising backhand, a big overhead finisher
  side: [[0, 1.2, 0.4, -0.6], [0.16, -1.95, -2.85, -0.9], [0.34, -0.7, -0.75, 0.15], [0.5, 0.45, 0.4, 0.55], [0.72, 1.45, 0.6, 1.25], [1, 1.25, 0.45, 0.3]],
  side2: [[0, 1.4, 0.6, 1.0], [0.16, 1.95, 1.0, 1.45], [0.36, 0.25, -0.15, -0.35], [0.56, -1.15, -1.55, -0.5], [0.8, -1.55, -2.25, -0.65], [1, 0.6, -0.2, -0.3]],
  sweep: [[0, 0.8, 0.2, 0], [0.24, -2.15, -2.95, -0.7], [0.46, -0.45, -0.55, 0.25], [0.6, 0.55, 0.5, 0.75], [0.8, 1.4, 0.85, 1.25], [1, 1.3, 0.7, 0.4]],
  cleave: [[0, 1.6, 1.0, 1.2], [0.3, 2.0, 1.25, 1.55], [0.48, -0.35, -0.8, -0.55], [0.66, -1.6, -2.2, -0.55], [1, -0.8, -1.3, -0.3]],
  up: [[0, 0.8, 0.2, 0.3], [0.18, 1.35, 0.7, 1.0], [0.38, -1.25, -1.6, -0.25], [0.62, -1.9, -2.35, -0.35], [1, -1.0, -1.45, 0]],
  down: [[0, -1.4, -2.0, -0.5], [0.18, -1.8, -2.6, -0.8], [0.38, 1.3, 1.28, 0.2], [0.62, 1.55, 1.5, 0.1], [1, 1.3, 1.15, 0]],
  slam: [[0, -1.6, -1.9, -0.3], [0.3, -2.1, -2.8, -0.6], [0.5, 1.1, 0.98, 0.5], [1, 1.25, 1.05, 0.3]],
  // spear: pull back with the elbow cocked, drive straight through, a lunging charge
  thrust: [[0, 0.9, 0.3, -0.3], [0.22, 1.75, 0.85, -0.85], [0.42, 0.15, 0.05, -0.05], [0.7, 0.1, 0.0, 0], [1, 0.9, 0.3, -0.3]],
  thrust2: [[0, 0.9, 0.3, -0.3], [0.22, 1.5, 0.6, -0.6], [0.42, -0.25, -0.3, 0.05], [0.7, -0.2, -0.25, 0.05], [1, 0.8, 0.25, -0.2]],
  lunge: [[0, 1.0, 0.35, -0.4], [0.3, 1.95, 1.05, -1.0], [0.45, 0.02, -0.05, 0], [0.8, 0.0, -0.05, 0], [1, 0.9, 0.3, -0.3]],
  // hammer: hauled over the head, brought down with the whole body; a rising swing
  hsmash: [[0, 1.0, 0.4, 0], [0.38, -2.1, -2.85, -0.5], [0.58, 0.6, 0.5, 0.6], [0.75, 1.2, 1.1, 0.5], [1, 1.0, 0.8, 0.2]],
  hsmash2: [[0, 1.2, 0.8, 0.6], [0.35, 1.9, 1.2, 1.2], [0.58, -1.0, -1.4, -0.4], [0.75, -1.5, -2.0, -0.5], [1, -0.4, -0.8, 0]],
  // daggers: short jabs from a bent elbow, a rising slash, a whirling flurry
  dag1: [[0, 1.3, 0.4, -0.3], [0.3, 0.1, 0.0, 0], [0.6, 0.05, -0.05, 0], [1, 1.1, 0.35, -0.2]],
  dag2: [[0, 1.4, 0.55, 0.4], [0.3, -0.3, -0.65, -0.3], [0.6, -0.5, -0.95, -0.3], [1, 0.9, 0.4, 0]],
  flurry: [[0, -1.5, -2.1, -0.4], [0.18, 0.6, 0.5, 0.5], [0.36, -1.4, -2.0, -0.4], [0.54, 0.7, 0.6, 0.5], [0.72, -1.2, -1.7, -0.4], [0.9, 0.8, 0.7, 0.4], [1, 1.0, 0.6, 0]],
  // sling: windmill and release
  sling: [[0, 1.2, 0.6, 0], [0.25, -1.6, -2.2, 0], [0.42, -2.4, -2.85, 0], [0.55, -0.4, -0.5, 0], [1, 0.9, 0.5, 0]],
  // mining: a short overhead chop with the pommel, not a sweeping slash
  mine: [[0, -1.2, -2.0, -0.4], [0.3, -1.55, -2.5, -0.6], [0.55, 0.35, 0.15, 0.6], [0.72, 0.55, 0.45, 0.5], [1, 0.1, -0.5, 0]],
};
// back-arm keyframes for weapons held in both hands (daggers)
const ATKB = {
  dag1: [[0, 1.6, 1.0], [0.3, 1.9, 1.5], [1, 1.6, 1.0]],
  dag2: [[0, 1.9, 1.5], [0.3, 0.1, -0.1], [0.6, 0.0, -0.2], [1, 1.5, 1.0]],
  flurry: [[0, 0.7, 0.9], [0.18, -1.4, -1.9], [0.36, 0.7, 0.9], [0.54, -1.3, -1.8], [0.72, 0.8, 1.0], [0.9, -1.0, -1.4], [1, 1.5, 1.0]],
};
// two-bone arm IK: absolute [upper, fore] angles (facing frame) that put the hand at (hx, hy) from the shoulder
// (sx, sy). The elbow bends down and back, the only way the joint allows (fore never past upper).
function armIK(sx, sy, hx, hy, f, s) {
  const Lu = 15 * s, Lf = 14 * s;
  const dx = (hx - sx) * f, dy = hy - sy;
  const D = clamp(Math.hypot(dx, dy), 6 * s, (Lu + Lf) * 0.995);
  const a = Math.atan2(dy, dx);
  const c1 = Math.acos(clamp((Lu * Lu + D * D - Lf * Lf) / (2 * Lu * D), -1, 1));
  const up = a + c1;
  const ex = Math.cos(up) * Lu, ey = Math.sin(up) * Lu;
  const tx = Math.cos(a) * D, ty = Math.sin(a) * D;
  return [up, Math.atan2(ty - ey, tx - ex)];
}
function keyArm(kind, t, table = ATK) {
  const K = table[kind] || ATK.side;
  for (let i = 1; i < K.length; i++) {
    if (t <= K[i][0]) {
      const a = K[i - 1], b = K[i];
      const u = smooth((t - a[0]) / (b[0] - a[0]));
      return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3] || 0, b[3] || 0, u)];
    }
  }
  const l = K[K.length - 1];
  return [l[1], l[2], l[3] || 0];
}

export class Animator {
  constructor(body) {
    this.b = body;
    this.phase = 0;
    this.cur = new Float32Array(NJ);
    this.tgt = new Float32Array(NJ);
    this.squash = 0; this.squashV = 0;
    this.spin = 0;
    this.time = 0;
    this.rootY = null;
    this.stepFoot = -1;
    this.onStep = null;      // callback(footIndex) for footstep sfx/dust
    this.lastPhaseHalf = 0;
    this.blendIn = 0;
    for (let k = 0; k < NJ; k++) this.cur[k] = body.jointAngle(k);
  }
  land(v) { this.squashV += clamp(v * 0.05, 0, 90); }
  // a flinch from a hit: dir is the side the blow came from (-1 / 1), k its size 0..1
  hit(dir, k) { this.hitK = Math.min(1, Math.max(this.hitK || 0, k)); this.hitDir = dir; }
  flip() { this.spin = TAU; }

  // st: {mode, x, gy (ground y under controller), vx, vy, runMax, facing, attack, look, wall, dash, crouch, getup, onGround}
  update(dt, st, world) {
    const b = this.b, s = b.s, f = b.facing;
    this.time += dt;
    const L1 = 19 * s, L2 = 18 * s, footR = 3.6 * s;
    const legLen = L1 + L2;
    const tg = this.tgt;
    const speed = Math.abs(st.vx);
    const runK = clamp(speed / (st.runMax || 300), 0, 1.2);
    let torso = -HALF_PI, head = -HALF_PI;
    let rootX = st.x, rootY;
    let fF = null, fB = null;      // foot targets [x, y, toeAngle] in world
    let armF = null, armB = null;  // [upper, fore] absolute, facing frame
    let spine = [0, 0];
    let wristT = 0;                 // weapon turn off the forearm line (attacks only)
    let rate = 26;
    // squash spring (landing absorption)
    this.squashV += (-this.squash * 260 - this.squashV * 22) * dt;
    this.squash = clamp(this.squash + this.squashV * dt, -6 * s, 22 * s);
    const standH = legLen * 0.93 + footR;
    const ground = (x) => {
      const gy = world ? world.groundBelow(x, st.gy - 40 * s, 80 * s) : st.gy;
      return gy === null ? null : gy - footR;
    };

    const mode = st.mode;
    if (mode === 'ground') {
      // distance-driven gait. One cycle = two steps. Each foot spends a duty fraction of the cycle planted
      // (long when walking, short when running so there is a flight phase), then swings: toe-off, heel
      // kick behind, knee drive forward, reach and plant. The pelvis dips at mid-stance and rises in flight.
      const rk = clamp(runK, 0, 1);
      const stride = lerp(14, 46, rk) * s;
      if (speed > 8) this.phase += (speed * dt) / (2 * stride);
      else this.phase = lerp(this.phase, Math.round(this.phase * 2) / 2, 1 - Math.exp(-6 * dt));
      const ph = this.phase;
      const moving = smooth(clamp((speed - 8) / 70, 0, 1));
      const duty = lerp(0.62, 0.4, rk);
      const crouch = st.crouch ? 13 * s : 0;
      // weight shift and breathing when standing still
      const breathe = Math.sin(this.time * 1.9) * 0.7 * s, shift = Math.sin(this.time * 0.55) * 1.6 * s;
      // vertical bob: two dips per cycle (one per foot strike), deeper and springier when running
      const dip = Math.max(0, Math.cos(((ph * 2) % 1) * TAU)) * lerp(1.6, 4.5, rk) * s * moving;
      rootY = st.gy - standH + this.squash + crouch + dip + 1.5 * s + (1 - moving) * (breathe + 0.9 * s) - (rk > 0.6 ? lerp(0, 2.5, rk) * s * moving : 0);
      rootX += shift * (1 - moving) * 0.4;
      torso = -HALF_PI + lerp(0.06, 0.3, rk) * moving + (st.accel || 0) * 0.08 + (st.crouch ? 0.25 : 0) + Math.sin(ph * TAU * 2) * 0.03 * moving;
      const legs = [];
      for (let i = 0; i < 2; i++) {
        const p = ph + (i ? 0.5 : 0);
        const u = ((p % 1) + 1) % 1;
        let ox, lift, toe;
        if (u < duty) {
          // planted: the foot slides back under the body at ground speed; heel rolls to toe at the end
          const t = u / duty;
          ox = stride * (0.5 - t);
          lift = 0;
          toe = t > 0.7 ? -(t - 0.7) / 0.3 * 0.55 * moving : 0;
        } else {
          const t = (u - duty) / (1 - duty);
          // swing: forward travel eases in and out; early in the swing the heel kicks up behind
          ox = stride * (smooth(t) - 0.5) - Math.sin(t * Math.PI) * (1 - t) * stride * 0.35 * rk;
          lift = Math.pow(Math.sin(t * Math.PI), 0.8) * lerp(5, 17, rk) * s + Math.sin(t * Math.PI * 0.9) * (1 - t) * 8 * s * rk;
          toe = lerp(-0.7, 0.25, smooth(t)) * moving;   // toes trail after push-off, then lift for the heel strike
        }
        const idleOx = (i ? -5.5 : 6.5) * s + shift * 0.3;
        ox = lerp(idleOx, ox, moving);
        lift *= moving;
        const fx = rootX + ox * f;
        let gy = ground(fx);
        if (gy === null) gy = st.gy - footR + 6 * s;
        legs.push([fx, gy - lift, toe]);
      }
      fF = legs[0]; fB = legs[1];
      // footstep events at contact
      const half = Math.floor(ph * 2);
      if (half !== this.lastPhaseHalf && moving > 0.5) { this.lastPhaseHalf = half; if (this.onStep) this.onStep(half & 1); }
      // arms pump against the legs: the shoulder swings, the elbow bends more on the forward swing
      const swing = Math.sin(ph * TAU);
      const amp = lerp(0.35, 1.05, rk) * moving;
      const bend = lerp(0.35, 1.5, rk) * moving;
      const idleSway = Math.sin(this.time * 1.3) * 0.05 * (1 - moving);
      const relax = 0.16 * (1 - moving);   // arms hang a little away from the body at rest
      // the blade hand swings less and keeps the blade low and trailing
      const ampF = amp * (st.blade ? 0.55 : 1);
      armF = [HALF_PI - relax + idleSway - swing * ampF + (st.blade ? 0.25 * rk : 0), HALF_PI - relax + idleSway - swing * ampF - bend * (st.blade ? 0.45 : 0.55 + 0.45 * Math.max(0, swing)) - 0.12];
      armB = [HALF_PI + relax * 0.6 + idleSway + swing * amp, HALF_PI + relax * 0.6 + idleSway + swing * amp - bend * (0.55 + 0.45 * Math.max(0, -swing)) - 0.12];
      spine = [Math.sin(this.time * 2.1) * 0.02 * (1 - moving) - 0.05 * moving - swing * 0.05 * rk, 0.06 * rk + swing * 0.04 * rk];
      rate = lerp(20, 34, rk);
      if (st.crouch) { armF = [0.6, -0.3]; armB = [1.2, 0.4]; }
      if (st.windup) {
        // wind-up telegraph: rear back, arms raised
        const w = smooth(clamp(st.windup, 0, 1));
        torso -= 0.4 * w;
        armF = [lerp(armF[0], -1.9, w), lerp(armF[1], -2.5, w)];
        armB = [lerp(armB[0], -1.4, w), lerp(armB[1], -2.2, w)];
        rootY += 4 * s * w;
      }
    } else if (mode === 'air') {
      const vy = st.vy;
      rootY = null;
      const k = clamp(vy / 900, -1, 1);
      // one continuous arc: knees tuck on the way up, arms rise for balance at the apex, legs reach for the
      // ground on the way down; a long fall turns into a flail
      const up = clamp(-vy / 700, 0, 1), fall = clamp((vy - 80) / 800, 0, 1);
      const apex = 1 - Math.max(up, fall);
      // legs: the lead knee drives up on take-off while the other trails, both tuck at the apex, and on
      // the way down they reach for the ground, pedalling a little in a long fall
      const cyc = Math.sin(this.time * 10) * fall * 0.6;
      fF = [rootX + (lerp(lerp(9, 13, up), 6, fall) - apex * 3 + cyc * 6) * s * f, st.py + (lerp(lerp(24, 15, up), 31, fall) - apex * 6 - Math.max(0, cyc) * 5) * s, lerp(lerp(0.4, 0.7, up), -0.15, fall)];
      fB = [rootX + (lerp(lerp(-6, -13, up), -7, fall) + apex * 4 - cyc * 6) * s * f, st.py + (lerp(lerp(28, 31, up), 32, fall) - apex * 7 - Math.max(0, -cyc) * 5) * s, lerp(lerp(0.9, 1.2, up), 0.25, fall)];
      torso = -HALF_PI + 0.06 + up * 0.08 - fall * 0.06 + (st.vx * f) * 0.0003;
      const flail = clamp((vy - 1000) / 600, 0, 1);
      const fl = Math.sin(this.time * 19) * 0.9 * flail, fl2 = Math.cos(this.time * 17) * 0.9 * flail;
      armF = [lerp(lerp(0.6, -0.35, up), -0.5, fall) - apex * 0.35 + fl, lerp(lerp(0.1, -0.9, up), -1.0, fall) - apex * 0.3 + fl];
      armB = [lerp(lerp(2.6, 2.9, up), 3.6, fall) + apex * 0.3 + fl2, lerp(lerp(2.1, 2.3, up), 3.4, fall) + fl2];
      spine = [0.08 * k, 0.04];
      rate = 18;
      if (this.spin > 0) {
        // front flip on double jump: the balance torque spins the whole body
        const sp = Math.min(this.spin, dt * 19);
        this.spin -= sp;
        torso = -HALF_PI + (TAU - this.spin) * 1;
        fF = [rootX + 6 * s * f, st.py + 14 * s, 0.8];
        fB = [rootX - 2 * s * f, st.py + 16 * s, 0.8];
        armF = [0.3, -0.8]; armB = [0.6, -0.4];
        rate = 40;
      }
    } else if (mode === 'wall') {
      rootY = null;
      torso = -HALF_PI + 0.12;
      fF = [rootX + 12 * s * f, st.py + 22 * s, -0.9];
      fB = [rootX + 9 * s * f, st.py + 33 * s, -0.6];
      armF = [-1.25, -1.55]; armB = [0.3, -0.2];
      spine = [0.05, 0.05];
    } else if (mode === 'dash') {
      rootY = null;
      torso = -HALF_PI + 0.95;
      // dash: a long lunge, front foot reaching, back leg stretched with the toe pointed
      fF = [rootX + 17 * s * f, st.py + 21 * s, 0.35];
      fB = [rootX - 23 * s * f, st.py + 25 * s, 1.15];
      armF = [2.2, 2.4]; armB = [2.5, 2.7];
      spine = [0.1, 0.1];
      rate = 40;
    } else if (mode === 'getup') {
      const u = clamp(st.getup, 0, 1);
      const k1 = smooth(clamp(u / 0.55, 0, 1)), k2 = smooth(clamp((u - 0.45) / 0.55, 0, 1));
      const kneelY = st.gy - 22 * s;
      rootY = lerp(lerp(st.gy - 9 * s, kneelY, k1), st.gy - standH, k2);
      torso = -HALF_PI + lerp(1.1, 0.5, k1) * (1 - k2) + 0.05;
      fF = [rootX + lerp(4, 12, k1) * s * f * (1 - k2) + 6 * s * f * k2, (ground(rootX + 10 * s * f) ?? st.gy - footR), 0];
      fB = [rootX - lerp(18, 14, k1) * s * f * (1 - k2) - 5 * s * f * k2, (ground(rootX - 14 * s * f) ?? st.gy - footR) - (1 - k2) * 0, 0.9 * (1 - k2)];
      armF = [lerp(0.1, 0.4, k1) * (1 - k2) + HALF_PI * k2, lerp(0.2, -0.4, k1) * (1 - k2) + (HALF_PI - 0.2) * k2];
      armB = [lerp(0.5, 0.9, k1) * (1 - k2) + (HALF_PI + 0.1) * k2, lerp(0.6, 0.2, k1) * (1 - k2) + (HALF_PI - 0.1) * k2];
      rate = 12;
    } else if (mode === 'tumble') {
      // knocked through the air: thrown back, arms flung out, legs kicking
      rootY = null;
      const k = clamp(Math.abs(st.vx) / 600, 0, 1), up = clamp(-st.vy / 600, 0, 1);
      const fl = Math.sin(this.time * 13) * 0.5, fl2 = Math.cos(this.time * 11) * 0.5;
      torso = -HALF_PI - 0.55 - 0.35 * k + up * 0.2;
      fF = [rootX + (12 + fl * 6) * s * f, st.py + (20 + fl2 * 5) * s, 0.4];
      fB = [rootX + (4 - fl * 5) * s * f, st.py + (26 + fl * 4) * s, 0.6];
      armF = [-1.2 + fl, -1.6 + fl]; armB = [2.6 + fl2, 2.9 + fl2];
      spine = [-0.2, -0.15];
      rate = 16;
    } else if (mode === 'down') {
      // lying on the back where the fall ended
      rootY = st.gy - 6 * s + Math.sin(this.time * 1.6) * 0.4 * s;
      torso = -HALF_PI - 1.42;
      fF = [rootX + 33 * s * f, st.gy - 3.6 * s, 0.25];
      fB = [rootX + 29 * s * f, st.gy - 3.6 * s, 0.4];
      armF = [Math.PI - 0.25, Math.PI - 0.12]; armB = [Math.PI - 0.55, Math.PI - 0.35];
      spine = [0.05, 0.05];
      head = -HALF_PI - 1.2;
      rate = 9;
    } else if (mode === 'mantle') {
      // both hands catch the lip and hang, the feet scrabble on the wall, the arms haul the chest up past the
      // edge and press down, a knee swings onto the ledge, then the doll stands
      rootY = null;
      const u = clamp(st.mantle || 0, 0, 1);
      const e = st.edge || { x: rootX + 14 * s * f, y: st.py - 24 * s };
      const pull = smooth(clamp((u - 0.14) / 0.5, 0, 1)), over = smooth(clamp((u - 0.5) / 0.38, 0, 1)), rise = smooth(clamp((u - 0.8) / 0.2, 0, 1));
      torso = -HALF_PI + 0.08 + 0.62 * pull * (1 - rise);
      const sx = rootX + Math.cos(torso) * 26 * s * f, sy = st.py + Math.sin(torso) * 26 * s;
      const ikF = armIK(sx, sy, e.x - f * 2 * s, e.y + 1, f, s), ikB = armIK(sx, sy, e.x - f * 7 * s, e.y + 1, f, s);
      const rel = smooth(clamp((u - 0.74) / 0.2, 0, 1));    // the hands let go as the doll stands
      armF = [lerp(ikF[0], 1.35, rel), lerp(ikF[1], 1.15, rel)];
      armB = [lerp(ikB[0], 1.5, rel), lerp(ikB[1], 1.3, rel)];
      // feet: against the wall, scrabbling, until a knee comes over the lip
      const wallX = e.x - f * 4 * s, scr = (1 - over) * Math.max(0, 1 - pull * 1.2);
      const kick = Math.sin(u * 34) * 5 * s * scr;
      const top = e.y - footR;
      fF = [lerp(wallX, e.x + f * 7 * s, over), lerp(st.py + 30 * s - kick - pull * 8 * s, top, over), lerp(-0.3, 0, over)];
      fB = [lerp(wallX - f * 2 * s, rootX - f * 3 * s, rise), lerp(st.py + 31 * s + kick, top, rise), lerp(-0.2, 0, rise)];
      spine = [0.18 * pull * (1 - rise), 0.12 * pull];
      head = -HALF_PI + 0.2 * (1 - pull);
      rate = 34;
    } else if (mode === 'crawl') {
      // hands and knees, limbs moving in diagonal pairs with the distance crawled
      const ph = this.phase += (Math.abs(st.vx) * dt) / (22 * s);
      const sw = Math.sin(ph * TAU), cw = Math.cos(ph * TAU);
      const moving = clamp(Math.abs(st.vx) / 40, 0, 1);
      // a step up: the front hands climb onto it first and the body follows, so it reads as a climb
      const up = this.crawlUp = Math.max(0, (this.crawlUp || 0) - dt * 3.2);
      rootY = st.gy - 13 * s + Math.abs(sw) * 1.2 * s * moving + up * 14 * s;
      torso = -HALF_PI + 1.32 - up * 0.55;
      armF = [HALF_PI - 0.35 - sw * 0.35 * moving - up * 1.1, HALF_PI - 0.05 - sw * 0.25 * moving - up * 1.0];
      armB = [HALF_PI - 0.35 + sw * 0.35 * moving - up * 0.7, HALF_PI - 0.05 + sw * 0.25 * moving - up * 0.6];
      // floor right under the knees (searching from above would find the low ceiling you crawl under)
      const fl = (x) => { const gy = world ? world.groundBelow(x, st.gy - 10, 40) : st.gy; return gy === null ? st.gy - footR : gy - footR; };
      const gF = fl(rootX - 16 * s * f), gB = gF;
      fF = [rootX + (-24 + sw * 5 * moving) * s * f, gF + 1 * s - Math.max(0, cw) * 3 * s * moving, 1.45];
      fB = [rootX + (-25 - sw * 5 * moving) * s * f, gB + 1 * s - Math.max(0, -cw) * 3 * s * moving, 1.45];
      spine = [0.12, 0.1];
      head = -0.15;
      rate = 20;
    } else if (mode === 'climb') {
      // hand over hand, foot over foot: one limb pair reaches while the other pulls, driven by distance climbed
      // diagonal pairs: the front hand reaches with the back foot while the other two hold, then they swap.
      // Hands close on the rungs (8 px apart), knees come up under the body; still on the ladder, nothing moves.
      rootY = null;
      const ph = (st.climbD || 0) / (16 * s);
      const u = smooth(clamp(Math.abs(((ph % 2) + 2) % 2 - 1), 0, 1)), v = 1 - u;
      torso = -HALF_PI + 0.16;
      const sx = rootX + Math.cos(torso) * 26 * s * f, sy = st.py + Math.sin(torso) * 26 * s;
      const rung = (y) => Math.round(y / 8) * 8;
      const hx = rootX + f * 10 * s;
      armF = armIK(sx, sy, hx, rung(sy - lerp(4, 20, u) * s), f, s);
      armB = armIK(sx, sy, hx - f * 2 * s, rung(sy - lerp(4, 20, v) * s), f, s);
      fF = [rootX + 8 * s * f, st.py + lerp(31, 17, v) * s, -0.15];
      fB = [rootX + 6 * s * f, st.py + lerp(31, 17, u) * s, -0.15];
      spine = [0.08, 0.05];
      head = -HALF_PI - 0.15;
      rate = 26;
    } else if (mode === 'sit') {
      rootY = st.gy - 9 * s;
      torso = -HALF_PI - 0.12 + Math.sin(this.time * 1.7) * 0.02;
      const gyF = ground(rootX + 30 * s * f) ?? st.gy - footR;
      fF = [rootX + 30 * s * f, gyF, -0.4];
      fB = [rootX + 26 * s * f, gyF, -0.3];
      armF = [0.35, -0.3]; armB = [0.6, -0.1];
      head = -HALF_PI + 0.15;
      rate = 10;
    } else if (mode === 'sleep') {
      // curled on its side, knees drawn up, hands tucked under the head, breathing slowly
      const br = Math.sin(this.time * 1.4);
      rootY = st.gy - 7 * s + br * 0.6 * s;
      torso = -HALF_PI + 1.5 + br * 0.03;
      fF = [rootX + 7 * s * f, st.gy - 3.6 * s, 0.35];
      fB = [rootX + 3 * s * f, st.gy - 3.6 * s, 0.35];
      armF = [0.35, -1.25 + br * 0.04]; armB = [0.6, -1.0];
      spine = [0.28 + br * 0.04, 0.26];
      head = 0.25;
      rate = 8;
    } else if (mode === 'cocoon') {
      rootY = st.gy - 10 * s;
      torso = -HALF_PI + 1.2;
      fF = [rootX + 10 * s * f, st.gy - 16 * s, 0.6];
      fB = [rootX + 8 * s * f, st.gy - 12 * s, 0.6];
      armF = [0.9, -1.6]; armB = [0.9, -1.4];
      spine = [0.4, 0.4];
      rate = 6;
    } else if (mode === 'skydive') {
      // belly down, arms spread, legs trailing: the long fall
      rootY = null;
      const fl = Math.sin(this.time * 7) * 0.25, fl2 = Math.cos(this.time * 5.3) * 0.2;
      torso = -HALF_PI + 1.35 + Math.sin(this.time * 1.7) * 0.12;
      fF = [rootX - 26 * s * f, st.py + 6 * s + Math.sin(this.time * 6) * 3 * s, 1.0];
      fB = [rootX - 30 * s * f, st.py - 4 * s, 1.1];
      armF = [-1.2 + fl, -1.7 + fl]; armB = [-0.6 + fl2, -1.2 + fl2];
      head = -0.2;
      spine = [-0.15, -0.1];
      rate = 14;
    } else if (mode === 'emote') {
      rootY = st.gy - standH;
      const e = st.emote || 'wave';
      fF = [rootX + 6 * s * f, ground(rootX + 6 * s * f) ?? st.gy - footR, 0];
      fB = [rootX - 5 * s * f, ground(rootX - 5 * s * f) ?? st.gy - footR, 0];
      const t = this.time;
      if (e === 'wave') { armF = [-2.6, -2.6 + Math.sin(t * 12) * 0.6]; armB = [HALF_PI + 0.1, HALF_PI - 0.2]; }
      else if (e === 'cheer') { armF = [-2.7 + Math.sin(t * 9) * 0.2, -2.9]; armB = [-2.5 - Math.sin(t * 9) * 0.2, -2.7]; rootY -= Math.abs(Math.sin(t * 9)) * 8 * s; }
      else if (e === 'bow') { torso = -HALF_PI + 1.0; armF = [HALF_PI + 0.3, HALF_PI + 0.3]; armB = [HALF_PI - 0.2, HALF_PI - 0.6]; }
      else if (e === 'point') { armF = [-0.25, -0.3]; armB = [HALF_PI, HALF_PI - 0.3]; }
      else { armF = [-1.2, -2.4]; armB = [-1.0, -2.6]; }
    }

    // attack overlay on the front (blade) arm, with a lean into the strike
    if (st.attack && st.attack.t < 1) {
      const a = st.attack;
      const [ua, fa, wr] = keyArm(a.kind, a.t);
      const w = a.t > 0.75 ? 1 - smooth((a.t - 0.75) / 0.25) : 1;
      armF = armF ? [lerp(armF[0], ua, w), lerp(armF[1], fa, w)] : [ua, fa];
      wristT = wr * w;
      // the body winds back with the arm, then drives forward through the strike (smooth curves, no snap)
      const wind = smooth(clamp(a.t / 0.18, 0, 1)) * (1 - smooth(clamp((a.t - 0.2) / 0.14, 0, 1)));
      const drive = smooth(clamp((a.t - 0.22) / 0.16, 0, 1)) * (1 - smooth(clamp((a.t - 0.6) / 0.3, 0, 1)));
      const base = a.kind === 'up' ? -0.1 : a.kind === 'down' ? 0.25 : a.kind === 'mine' ? 0.3 : 0.24;
      const lean = { sweep: 0.35, cleave: -0.15, lunge: 0.45, hsmash: 0.4, slam: 0.45, thrust: 0.3, thrust2: 0.2, flurry: 0.15 }[a.kind] || 0;
      torso += (-0.16 * wind + (base + lean) * drive) * w;
      // the free arm counter-swings: reaches forward for balance on the wind-up, flings back through the strike
      if (ATKB[a.kind]) { const [ub, fb] = keyArm(a.kind, a.t, ATKB); armB = [ub, fb]; }
      else {
        const bu = lerp(lerp(1.4, 0.35, wind), 2.1, drive), bf = lerp(lerp(0.9, -0.35, wind), 1.45, drive);
        armB = [lerp(armB ? armB[0] : 1.5, bu, 0.85 * w), lerp(armB ? armB[1] : 1.2, bf, 0.85 * w)];
      }
      rate = 60;
      // standing strikes step into the blow: front foot plants forward, back heel lifts, hips drop
      if (mode === 'ground' && fF && fB && speed < 60) {
        const k = Math.sin(clamp(a.t / 0.7, 0, 1) * Math.PI) * w * (a.kind === 'mine' ? 0.5 : 1);
        fF = [fF[0] + f * 12 * s * k, fF[1], fF[2]];
        fB = [fB[0] - f * 6 * s * k, fB[1] - 1.5 * s * k, fB[2] - 0.6 * k];
        if (rootY !== null && rootY !== undefined) rootY += (2 + 4 * drive) * s * k;
      }
    }
    // where the head looks
    if (st.look) {
      const hx = b.x[P.HEAD], hy = b.y[P.HEAD];
      let la = Math.atan2(st.look.y - hy, (st.look.x - hx) * f);
      la = clamp(wrapAng(la + HALF_PI), -0.6, 0.55);
      head = -HALF_PI + la * 0.7 + (torso + HALF_PI) * 0.5;
    } else head = torso * 0.5 - HALF_PI * 0.5;

    // flinch from a hit: lean away, arms jerk up, knees give a little
    if (this.hitK > 0.01 && armF && armB) {
      const h = this.hitK;
      torso -= 0.42 * h;
      armF = [armF[0] - 0.9 * h, armF[1] - 1.1 * h];
      armB = [armB[0] + 0.5 * h, armB[1] + 0.7 * h];
      if (rootY !== null && rootY !== undefined) rootY += 3 * s * h;
      this.hitK = Math.max(0, h - dt * 4.5);
    }
    if (this.slowBlend > 0) { rate *= 0.35; this.slowBlend -= dt; }
    // ---------- convert to joint targets ----------
    const down = torso + Math.PI;   // belly->pelvis direction
    tg[0] = spine[0]; tg[1] = spine[1];
    tg[2] = clamp(wrapAng(head - torso), -0.7, 0.7) * 0.6;
    const arm = (ua, fa, ks, ke) => {
      // the shoulder can't turn all the way round: of the two ways to reach an angle, keep the one on the
      // same side as now (no flip through the dead zone behind the head), then hold it inside the joint's range
      let r = wrapAng(ua - down + SH_OFF);
      const cur = this.cur[ks];
      if (Math.abs(r - TAU - cur) < Math.abs(r - cur)) r -= TAU; else if (Math.abs(r + TAU - cur) < Math.abs(r - cur)) r += TAU;
      tg[ks] = clamp(r, JOINTS[ks][4], JOINTS[ks][5]);
      tg[ke] = clamp(wrapAng(fa - ua), -2.55, 0.02);
    };
    if (armF) arm(armF[0], armF[1], 3, 4);
    if (armB) arm(armB[0], armB[1], 5, 6);
    // pelvis world position used for leg IK
    const pelX = rootX, pelY = rootY !== null && rootY !== undefined ? rootY : b.y[P.PELVIS];
    const leg = (foot, kh, kk, ka) => {
      if (!foot) return;
      let dx = (foot[0] - pelX) * f, dy = foot[1] - pelY;
      let D = Math.hypot(dx, dy);
      const maxD = (L1 + L2) * 0.995;
      if (D > maxD) { dx *= maxD / D; dy *= maxD / D; D = maxD; }
      if (D < 6 * s) D = 6 * s;
      const a = Math.atan2(dy, dx);
      const c1 = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
      const th = a - c1;                       // thigh: knee forward of the line
      const kx = Math.cos(th) * L1, ky = Math.sin(th) * L1;
      const sh = Math.atan2(dy - ky, dx - kx); // shin
      tg[kh] = wrapAng(th - down);
      tg[kk] = wrapAng(sh - th);
      tg[ka] = wrapAng(foot[2] - sh);
    };
    leg(fF, 7, 8, 9);
    leg(fB, 10, 11, 12);

    // smooth targets
    const k = 1 - Math.exp(-rate * dt);
    for (let j = 0; j < NJ; j++) {
      const kj = j === 3 || j === 4 ? Math.max(k, st.attack && st.attack.t < 1 ? 0.7 : k) : k;
      // shoulders blend straight (their range has a gap, so the short way round can cross it)
      this.cur[j] = j === 3 || j === 5 ? lerp(this.cur[j], tg[j], kj) : angLerp(this.cur[j], tg[j], kj);
    }
    b.target.set(this.cur);
    // root + balance
    const ky = 1 - Math.exp(-30 * dt);
    if (rootY !== null && rootY !== undefined) {
      this.rootY = this.rootY === null ? rootY : lerp(this.rootY, rootY, ky);
      b.root.x = rootX; b.root.y = this.rootY;
    } else {
      this.rootY = null;
      b.root.x = rootX; b.root.y = st.py;
    }
    b.torso = torso;
    b.headAng = head;
    this.wrist = lerp(this.wrist || 0, wristT, 1 - Math.exp(-(st.attack && st.attack.t < 1 ? 40 : 14) * dt));
    b.wrist = this.wrist;
    b.mining = !!(st.attack && st.attack.kind === 'mine' && st.attack.t < 1);
    // arm joints stiffen during a swing so the blade really travels
    const atk = st.attack && st.attack.t < 1;
    b.jointK[3] = atk ? 2.4 : 1; b.jointK[4] = atk ? 2.0 : 1;
  }
}
