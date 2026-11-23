// Procedural animation: turns controller state into muscle targets for the ragdoll.
// Gait is distance-driven (feet don't skate), feet are placed with two-bone IK onto the real terrain,
// and every target is smoothed so transitions blend instead of popping.
import { P, NJ, SH_OFF } from './body.js';
import { wrapAng, clamp, lerp, angLerp, smooth, TAU } from '../core/util.js';

const HALF_PI = Math.PI / 2;

// attack arm keyframes: [t, upperArm, foreArm] absolute angles in the facing-right frame (down = +PI/2)
const ATK = {
  side: [[0, -1.5, -2.3], [0.18, -1.85, -2.75], [0.38, -0.05, 0.0], [0.62, 0.85, 0.9], [1, 1.2, 1.0]],
  side2: [[0, 0.8, 1.2], [0.18, 1.05, 1.5], [0.38, -0.9, -0.95], [0.62, -1.75, -1.95], [1, -0.6, -0.8]],
  up: [[0, 0.5, 0.8], [0.18, 0.7, 1.1], [0.38, -1.5, -1.55], [0.62, -2.05, -2.3], [1, -1.0, -1.2]],
  down: [[0, -1.6, -1.9], [0.18, -1.85, -2.2], [0.38, 1.35, 1.4], [0.62, 1.62, 1.66], [1, 1.3, 1.35]],
  slam: [[0, -1.6, -1.6], [0.3, -1.75, -1.85], [0.5, 1.2, 1.3], [1, 1.3, 1.35]],
};
function keyArm(kind, t) {
  const K = ATK[kind] || ATK.side;
  for (let i = 1; i < K.length; i++) {
    if (t <= K[i][0]) {
      const a = K[i - 1], b = K[i];
      const u = smooth((t - a[0]) / (b[0] - a[0]));
      return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
    }
  }
  const l = K[K.length - 1];
  return [l[1], l[2]];
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
      rootY = st.gy - standH + this.squash + crouch + dip + 1.5 * s + (1 - moving) * breathe - (rk > 0.6 ? lerp(0, 2.5, rk) * s * moving : 0);
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
      fF = [rootX + lerp(lerp(9, 11, up), 5, fall) * s * f, st.py + lerp(lerp(24, 18, up), 33, fall) * s, lerp(0.5, -0.1, fall)];
      fB = [rootX + lerp(lerp(-6, -10, up), -4, fall) * s * f, st.py + lerp(lerp(28, 30, up), 31, fall) * s, lerp(0.9, 0.2, fall)];
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
      fF = [rootX + 14 * s * f, st.py + 22 * s, 0.2];
      fB = [rootX - 18 * s * f, st.py + 26 * s, 0.9];
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
    } else if (mode === 'climb') {
      // hand over hand, foot over foot: one limb pair reaches while the other pulls, driven by distance climbed
      rootY = null;
      const ph = (st.climbD || 0) / (34 * s);
      const u = (Math.sin(ph * Math.PI) + 1) / 2, v = 1 - u;
      torso = -HALF_PI + 0.1;
      armF = [lerp(-1.25, -2.0, u), lerp(-1.65, -2.45, u)];
      armB = [lerp(-1.25, -2.0, v), lerp(-1.65, -2.45, v)];
      fF = [rootX + 9 * s * f, st.py + lerp(31, 19, u) * s, -0.2];
      fB = [rootX + 7 * s * f, st.py + lerp(31, 19, v) * s, -0.2];
      spine = [0.06, 0.04];
      rate = 22;
    } else if (mode === 'sit') {
      rootY = st.gy - 9 * s;
      torso = -HALF_PI - 0.12 + Math.sin(this.time * 1.7) * 0.02;
      const gyF = ground(rootX + 30 * s * f) ?? st.gy - footR;
      fF = [rootX + 30 * s * f, gyF, -0.4];
      fB = [rootX + 26 * s * f, gyF, -0.3];
      armF = [0.35, -0.3]; armB = [0.6, -0.1];
      head = -HALF_PI + 0.15;
      rate = 10;
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
      const [ua, fa] = keyArm(a.kind, a.t);
      const w = a.t > 0.75 ? 1 - smooth((a.t - 0.75) / 0.25) : 1;
      armF = armF ? [lerp(armF[0], ua, w), lerp(armF[1], fa, w)] : [ua, fa];
      const strike = a.t > 0.18 && a.t < 0.62 ? 1 : 0;
      torso += (a.kind === 'up' ? -0.1 : a.kind === 'down' ? 0.25 : 0.22) * strike * w;
      armB = [lerp(armB ? armB[0] : 1.5, 2.2, 0.6 * w), lerp(armB ? armB[1] : 1.2, 1.8, 0.6 * w)];
      rate = 60;
    }
    // where the head looks
    if (st.look) {
      const hx = b.x[P.HEAD], hy = b.y[P.HEAD];
      let la = Math.atan2(st.look.y - hy, (st.look.x - hx) * f);
      la = clamp(wrapAng(la + HALF_PI), -0.6, 0.55);
      head = -HALF_PI + la * 0.7 + (torso + HALF_PI) * 0.5;
    } else head = torso * 0.5 - HALF_PI * 0.5;

    // ---------- convert to joint targets ----------
    const down = torso + Math.PI;   // belly->pelvis direction
    tg[0] = spine[0]; tg[1] = spine[1];
    tg[2] = clamp(wrapAng(head - torso), -0.7, 0.7) * 0.6;
    const arm = (ua, fa, ks, ke) => {
      tg[ks] = wrapAng(ua - down + SH_OFF);
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
    for (let j = 0; j < NJ; j++) this.cur[j] = angLerp(this.cur[j], tg[j], j === 3 || j === 4 ? Math.max(k, st.attack && st.attack.t < 1 ? 0.7 : k) : k);
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
    // arm joints stiffen during a swing so the blade really travels
    const atk = st.attack && st.attack.t < 1;
    b.jointK[3] = atk ? 2.4 : 1; b.jointK[4] = atk ? 2.0 : 1;
  }
}
