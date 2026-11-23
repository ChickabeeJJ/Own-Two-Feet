// Actor = tight platformer controller (owns gameplay) + physical ragdoll that follows it through muscles.
// When knocked down the roles swap: the ragdoll owns the motion and the controller follows the pelvis.
import { TILE, TILES } from '../world/tiles.js';
import { Body, P } from '../physics/body.js';
import { Animator } from '../physics/pose.js';
import { Cape, drawBody, drawShadow, bladeGeom } from '../physics/skin.js';
import { clamp, lerp, sign } from '../core/util.js';

export const PHYS = {
  grav: 2600, maxFall: 1500, run: 300, accG: 3400, decG: 4200, accA: 2300, jumpV: 770, djumpV: 700, cut: 0.42,
  coyote: 0.1, buffer: 0.13, dashV: 780, dashT: 0.15, dashCD: 0.4, wallSlide: 150, wallJumpX: 340, wallJumpY: 720,
};

let NEXT_ID = 1;

export class Actor {
  constructor(game, o) {
    this.id = o.id || NEXT_ID++;
    this.game = game;
    this.kind = o.kind || 'rag';
    this.team = o.team || 'neutral';
    const s = this.scale = o.scale || 1;
    this.look = o.look;
    this.c = { x: o.x, y: o.y, vx: 0, vy: 0, w: 18 * s, h: 82 * s, ground: false, wall: 0, coyote: 0, buffer: 0, jumps: 0, dashT: 0, dashCD: 0, airDash: 1, wallSlide: false, wallLock: 0, lastVy: 0, fallStart: o.y };
    this.facing = o.facing || 1;
    this.body = new Body({ scale: s, x: o.x, y: o.y - 41 * s, facing: this.facing, heavy: o.heavy || 1 });
    this.anim = new Animator(this.body);
    this.cape = this.look && this.look.cape ? new Cape(this.look.cape.style === 'scarf' ? 7 : 7, (this.look.cape.len || 7) * s) : null;
    this.mode = o.mode || 'ctrl';     // ctrl | limp | getup | dead | script
    this.scriptPose = null;           // for 'script': {mode:'sit'|'cocoon'|'emote', ...}
    this.intent = { mx: 0, jump: false, jumpHeld: false, dash: false, attack: false, down: false, up: false };
    this.abil = Object.assign({ djump: false, dash: true, wall: false }, o.abil || {});
    this.run = (o.run || PHYS.run) * (o.runK || 1);
    this.hp = this.maxHp = o.hp || 5;
    this.inv = 0; this.flash = 0;
    this.limpT = 0; this.getupT = 0;
    this.attack = null; this.attackCD = 0; this.combo = 0;
    this.daze = 0;
    this.strength = 1;
    this.alive = true;
    this.removed = false;
    this.deadT = 0;
    this.look_at = null;
    this.blade = !!o.blade;
    this.trail = [];
    this.glows = [];
    this.onLand = null; this.onStep = null;
    this.anim.onStep = (i) => this.onStep && this.onStep(i);
    this.prevBlade = null;
    this.emote = null; this.emoteT = 0;
    this.lastHit = null;
  }
  get world() { return this.game.world; }
  get x() { return this.c.x; }
  get y() { return this.c.y; }
  get cx() { return this.c.x; }
  get cy() { return this.c.y - this.c.h * 0.5; }
  get pelvisH() { return (19 + 18) * 0.93 * this.scale + 3.6 * this.scale; }

  // ------------------------------------------------------------ collision helpers
  overlaps(x0, y0, x1, y1) {
    const W = this.world;
    const tx0 = Math.floor(x0 / TILE), tx1 = Math.floor((x1 - 0.001) / TILE);
    const ty0 = Math.floor(y0 / TILE), ty1 = Math.floor((y1 - 0.001) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (TILES[W.get(tx, ty)].solid) return { tx, ty };
    return null;
  }
  boxFree(x, y) { const c = this.c; return !this.overlaps(x - c.w / 2, y - c.h, x + c.w / 2, y); }
  moveX(dx) {
    const c = this.c;
    if (!dx) return false;
    const steps = Math.ceil(Math.abs(dx) / 12);
    const sdx = dx / steps;
    for (let i = 0; i < steps; i++) {
      const nx = c.x + sdx;
      if (this.boxFree(nx, c.y)) { c.x = nx; continue; }
      // step up one tile when walking on the ground
      if (c.ground || c.coyote > 0.05) {
        for (const up of [TILE * 0.5, TILE + 1]) {
          const ty = Math.ceil((c.y - up) / TILE) * TILE;
          if (c.y - ty <= TILE + 1 && this.boxFree(nx, ty) && this.boxFree(c.x, ty)) { c.y = ty; c.x = nx; this.stepped = true; break; }
        }
        if (c.x === nx) continue;
      }
      // snap flush against the wall
      const hit = this.overlaps(nx - c.w / 2, c.y - c.h, nx + c.w / 2, c.y);
      if (hit) c.x = sdx > 0 ? hit.tx * TILE - c.w / 2 - 0.01 : (hit.tx + 1) * TILE + c.w / 2 + 0.01;
      if (!this.boxFree(c.x, c.y)) c.x -= sdx;
      c.vx = 0;
      return true;
    }
    return false;
  }
  moveY(dy) {
    const c = this.c;
    const steps = Math.ceil(Math.abs(dy) / 12) || 1;
    const sdy = dy / steps;
    for (let i = 0; i < steps; i++) {
      const ny = c.y + sdy;
      if (this.boxFree(c.x, ny)) { c.y = ny; continue; }
      const hit = this.overlaps(c.x - c.w / 2, ny - c.h, c.x + c.w / 2, ny);
      if (sdy > 0) { c.y = hit ? hit.ty * TILE : c.y; return 1; }
      c.y = hit ? (hit.ty + 1) * TILE + c.h + 0.01 : c.y; return -1;
    }
    return 0;
  }
  wallAt(dir) {
    const c = this.c;
    const x = c.x + dir * (c.w / 2 + 2);
    return !!this.overlaps(x - 1, c.y - c.h * 0.8, x + 1, c.y - c.h * 0.25);
  }
  unstick() {
    const c = this.c;
    for (let k = 0; k < 12 && !this.boxFree(c.x, c.y); k++) c.y -= 8;
  }

  // ------------------------------------------------------------ simulation
  face(f) {
    if (f === this.facing || !f) return;
    this.facing = f;
    if (this.mode === 'ctrl' || this.mode === 'script') this.body.flip();
  }
  update(dt) {
    const c = this.c, b = this.body;
    this.inv = Math.max(0, this.inv - dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.attackCD -= dt;
    this.stepped = false;
    if (this.mode === 'ctrl') { if (this.puppet) this.updatePuppet(dt); else this.updateCtrl(dt); }
    else if (this.mode === 'limp' || this.mode === 'dead') this.updateLimp(dt);
    else if (this.mode === 'getup') this.updateGetup(dt);
    else if (this.mode === 'script') this.updateScript(dt);
    else if (this.mode === 'fly') this.updateFly(dt);
    // muscles
    let sTarget = 1;
    if (this.mode === 'limp' || this.mode === 'dead') sTarget = 0;
    if (this.mode === 'getup') sTarget = lerp(0.35, 1, this.getupT);
    if (this.scriptPose && this.scriptPose.strength !== undefined) sTarget = this.scriptPose.strength;
    this.daze = Math.max(0, this.daze - dt * 2.2);
    const st = sTarget * (1 - this.daze * 0.85);
    this.strength = st < this.strength ? lerp(this.strength, st, 1 - Math.exp(-40 * dt)) : lerp(this.strength, st, 1 - Math.exp(-6 * dt));
    b.strength = this.strength;
    b.rootK = this.mode === 'limp' || this.mode === 'dead' ? 0 : 1;
    b.balanceK = 1;
    b.step(dt, this.world);
    if (this.mode === 'limp' && b.lastHitSpeed > 900 && this.onSplat) this.onSplat(b.lastHitSpeed);
    // cape
    if (this.cape) {
      const ax = lerp(b.x[P.NECK], b.x[P.CHEST], 0.4) - this.facing * 2 * this.scale, ay = lerp(b.y[P.NECK], b.y[P.CHEST], 0.4);
      this.cape.step(dt, ax, ay, (this.game.wind || 0) * 20 - c.vx * 0.15, this.facing);
    }
    // attack progress
    if (this.attack) {
      this.attack.t += dt / this.attack.dur;
      if (this.attack.t >= 1) this.attack = null;
    }
    if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.emote = null; }
    // dash after-images
    if (c.dashT > 0 && (this.game.tick & 1) === 0) this.trail.push({ t: 0.25, pts: Array.from(b.x).map((v, i) => [v, b.y[i]]) });
    for (const tr of this.trail) tr.t -= dt;
    while (this.trail.length && this.trail[0].t <= 0) this.trail.shift();
  }
  updateCtrl(dt) {
    const c = this.c, I = this.intent, A = this.abil;
    const wasGround = c.ground;
    c.coyote = c.ground ? PHYS.coyote : c.coyote - dt;
    c.buffer = I.jump ? PHYS.buffer : c.buffer - dt;
    c.dashCD -= dt;
    if (c.ground) { c.jumps = 0; c.airDash = 1; }
    const crouch = I.down && c.ground && !this.attack;
    // dash
    if (I.dash && A.dash && c.dashCD <= 0 && (c.ground || c.airDash > 0)) {
      if (I.mx) this.face(sign(I.mx));
      c.dashT = PHYS.dashT; c.dashCD = PHYS.dashCD; if (!c.ground) c.airDash--;
      c.vx = this.facing * PHYS.dashV; c.vy = 0;
      this.inv = Math.max(this.inv, 0.12);
      if (this.onDash) this.onDash();
    }
    if (c.dashT > 0) {
      c.dashT -= dt;
      c.vx = this.facing * PHYS.dashV; c.vy = 0;
      if (c.dashT <= 0) c.vx = this.facing * this.run * 0.9;
    } else {
      // run
      const target = I.mx * this.run * (crouch ? 0.35 : 1);
      const same = Math.sign(target) === Math.sign(c.vx) && Math.abs(target) >= Math.abs(c.vx);
      const acc = c.ground ? (same ? PHYS.accG : PHYS.decG) : PHYS.accA;
      if (c.wallLock > 0) c.wallLock -= dt;
      else c.vx += clamp(target - c.vx, -acc * dt, acc * dt);
      if (I.mx && !this.attack) this.face(sign(I.mx));
      // wall slide
      c.wall = this.wallAt(1) ? 1 : this.wallAt(-1) ? -1 : 0;
      c.wallSlide = A.wall && !c.ground && c.wall !== 0 && I.mx === c.wall && c.vy > 0;
      // jumping
      if (c.buffer > 0) {
        if (c.coyote > 0) { c.vy = -PHYS.jumpV; c.coyote = 0; c.buffer = 0; c.ground = false; this.jumped('jump'); }
        else if (c.wallSlide || (A.wall && c.wall && !c.ground)) {
          c.vy = -PHYS.wallJumpY; c.vx = -c.wall * PHYS.wallJumpX; c.wallLock = 0.14; c.buffer = 0; this.face(-c.wall); c.jumps = 0; this.jumped('wall');
        } else if (A.djump && c.jumps < 1) {
          c.vy = -PHYS.djumpV; c.jumps++; c.buffer = 0; this.anim.flip(); this.jumped('double');
        }
      }
      if (!I.jumpHeld && c.vy < -260 && !this.bounced) c.vy *= PHYS.cut;
      if (c.vy >= 0) this.bounced = false;
      c.vy = Math.min(c.vy + PHYS.grav * dt, c.wallSlide ? PHYS.wallSlide : PHYS.maxFall);
    }
    // integrate + collide
    this.moveX(c.vx * dt);
    c.lastVy = c.vy;
    const hitY = this.moveY(c.vy * dt);
    if (hitY === 1) {
      if (!wasGround) this.landed(c.lastVy);
      c.vy = 0; c.ground = true;
    } else if (hitY === -1) { c.vy = Math.max(0, c.vy); c.ground = false; }
    else {
      // still grounded? probe just below
      c.ground = !!this.overlaps(c.x - c.w / 2, c.y, c.x + c.w / 2, c.y + 2) && c.vy >= 0;
      if (c.ground && !wasGround) this.landed(c.lastVy);
    }
    if (!c.ground && wasGround) c.fallStart = c.y;
    // drive the animator
    const mode = c.dashT > 0 ? 'dash' : c.ground ? (this.emote && !I.mx && !this.attack ? 'emote' : 'ground') : c.wallSlide ? 'wall' : 'air';
    this.anim.update(dt, {
      mode, x: c.x, gy: c.y, py: c.y - this.pelvisH, vx: c.vx, vy: c.vy, runMax: this.run, attack: this.attack,
      look: this.look_at, crouch, emote: this.emote, windup: this.telegraph || 0, accel: clamp((I.mx * this.facing), -1, 1) * (c.ground ? 1 : 0),
    }, this.world);
  }
  updatePuppet(dt) {
    const c = this.c;
    const mode = c.dashT > 0 ? 'dash' : c.ground ? (this.emote ? 'emote' : 'ground') : 'air';
    if (Math.abs(c.vx) > 30 && !this.attack) this.face(sign(c.vx));
    this.anim.update(dt, { mode, x: c.x, gy: c.y, py: c.y - this.pelvisH, vx: c.vx, vy: c.vy, runMax: this.run, attack: this.attack, emote: this.emote, windup: this.telegraph || 0 }, this.world);
  }
  jumped(kind) { if (this.onJump) this.onJump(kind); }
  landed(vy) {
    this.anim.land(vy);
    if (this.onLand) this.onLand(vy);
    // a hard landing folds the body: insane-but-real crumple
    if (vy > 1450 && this.c.dashT <= 0 && this.mode === 'ctrl' && !this.noCrumple) {
      this.knockdown(0.35, 0, -200);
    }
  }
  knockdown(time, vx = 0, vy = 0) {
    if (this.mode === 'dead') return;
    this.mode = 'limp';
    this.limpT = time;
    this.attack = null;
    this.body.impulseAll(vx, vy);
    this.c.dashT = 0;
  }
  updateLimp(dt) {
    const b = this.body, c = this.c;
    this.limpT -= dt;
    // controller rides along with the pelvis
    c.x = b.x[P.PELVIS]; c.y = b.y[P.PELVIS] + this.pelvisH * 0.6;
    c.vx = b.vx[P.PELVIS]; c.vy = b.vy[P.PELVIS];
    if (this.mode === 'dead') { this.deadT += dt; return; }
    if (this.limpT <= 0 && b.restSpeed() < 160) {
      // stand back up from wherever the body came to rest
      const gy = this.world.groundBelow(b.x[P.PELVIS], b.y[P.PELVIS] - 6, 160);
      c.x = b.x[P.PELVIS];
      c.y = gy === null ? b.y[P.PELVIS] + 20 : gy;
      this.unstick();
      c.vx = c.vy = 0;
      this.mode = 'getup'; this.getupT = 0;
      // face the way the body ended up
      const hx = b.x[P.HEAD] - b.x[P.PELVIS];
      if (Math.abs(hx) > 4 && sign(hx) !== this.facing) this.facing = sign(hx), this.body.facing = this.facing;
    }
  }
  updateGetup(dt) {
    const c = this.c;
    this.getupT = Math.min(1, this.getupT + dt / 0.8);
    c.vy = Math.min(c.vy + PHYS.grav * dt, PHYS.maxFall);
    const hitY = this.moveY(c.vy * dt);
    if (hitY === 1) c.vy = 0;
    this.anim.update(dt, { mode: 'getup', x: c.x, gy: c.y, py: c.y - this.pelvisH, vx: 0, vy: 0, getup: this.getupT }, this.world);
    if (this.getupT >= 1) { this.mode = 'ctrl'; c.ground = true; }
  }
  updateScript(dt) {
    const c = this.c, sp = this.scriptPose || { mode: 'sit' };
    if (sp.mode === 'skydive') {
      c.vx = sp.vx || 0; c.vy = sp.vy || 0;
      this.moveX(c.vx * dt);
      if (this.moveY(c.vy * dt) === 1) sp.landed = true;
      if (c.vx > 30) this.face(1); else if (c.vx < -30) this.face(-1);
      this.anim.update(dt, { mode: 'skydive', x: c.x, gy: c.y, py: c.y - this.pelvisH, vx: c.vx, vy: c.vy }, this.world);
      return;
    }
    c.vy = Math.min(c.vy + PHYS.grav * dt, PHYS.maxFall);
    const hitY = this.moveY(c.vy * dt);
    if (hitY === 1) { c.vy = 0; c.ground = true; }
    this.anim.update(dt, { mode: sp.mode, x: c.x, gy: c.y, py: c.y - this.pelvisH, vx: 0, vy: 0, emote: sp.emote, getup: sp.getup, look: this.look_at }, this.world);
  }
  updateFly(dt) {
    const c = this.c;
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (c.vx > 20) this.face(1); else if (c.vx < -20) this.face(-1);
    this.anim.update(dt, { mode: 'air', x: c.x, gy: c.y, py: c.y - this.pelvisH, vx: c.vx, vy: 200 + c.vy * 0.2, attack: this.attack, look: this.look_at }, this.world);
  }
  // take control back from a limp body without standing up yet (scripted wake-ups)
  scriptFromLimp(pose) {
    const b = this.body, c = this.c;
    const gy = this.world.groundBelow(b.x[P.PELVIS], b.y[P.PELVIS] - 6, 160);
    c.x = b.x[P.PELVIS]; c.y = gy === null ? b.y[P.PELVIS] + 20 : gy;
    this.unstick(); c.vx = c.vy = 0;
    const hx = b.x[P.HEAD] - b.x[P.PELVIS];
    if (Math.abs(hx) > 4 && sign(hx) !== this.facing) { this.facing = sign(hx); b.facing = this.facing; }
    this.mode = 'script'; this.scriptPose = pose;
  }
  doEmote(e, t = 1.6) {
    if (this.mode !== 'ctrl' || !this.c.ground) return;
    this.emote = e; this.emoteT = t;
  }

  // ------------------------------------------------------------ combat helpers
  startAttack(kind, dur = 0.3) {
    this.attack = { kind, t: 0, dur, hits: new Set() };
    this.prevBlade = null;
  }
  bladeSeg(a = 1) { return bladeGeom(this.body, this.look, a); }
  // apply a physical hit to the nearest body part
  takeImpulse(x, y, dvx, dvy, daze = 0.5) {
    const b = this.body;
    let best = 0, bd = 1e18;
    for (let i = 0; i < 15; i++) { const d = (b.x[i] - x) ** 2 + (b.y[i] - y) ** 2; if (d < bd) { bd = d; best = i; } }
    b.impulse(best, dvx, dvy);
    // neighbours share some of it so the body bends instead of a single point snapping
    b.impulseAll(dvx * 0.25, dvy * 0.25);
    this.daze = Math.max(this.daze, daze);
    return best;
  }
  nearestPart(x, y) {
    const b = this.body;
    let bd = 1e18;
    for (let i = 0; i < 15; i++) { const d = (b.x[i] - x) ** 2 + (b.y[i] - y) ** 2 - b.r[i] * b.r[i]; if (d < bd) bd = d; }
    return bd;
  }

  draw(ctx, a, opts = {}) {
    const b = this.body;
    if (this.mode === 'dead' && this.deadT > 2.2) return;
    const alpha = this.mode === 'dead' ? clamp(1 - (this.deadT - 1.4) / 0.8, 0, 1) : (opts.alpha ?? 1);
    // ground shadow
    const px = b.ipx(P.PELVIS, a), py = b.ipy(P.PELVIS, a);
    const gy = this.world.groundBelow(px, py, 220);
    if (gy !== null) drawShadow(ctx, px, gy, 22 * this.scale, clamp(1 - (gy - py - 30 * this.scale) / 180, 0, 1) * alpha);
    // dash after-images
    if (this.trail.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const tr of this.trail) {
        ctx.strokeStyle = this.look.trailCol || this.look.eyes; ctx.globalAlpha = (tr.t / 0.25) * 0.28 * alpha; ctx.lineWidth = 7 * this.scale;
        const q = tr.pts;
        ctx.beginPath();
        ctx.moveTo(q[4][0], q[4][1]); ctx.lineTo(q[3][0], q[3][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.lineTo(q[0][0], q[0][1]);
        ctx.moveTo(q[4][0], q[4][1]); ctx.lineTo(q[9][0], q[9][1]); ctx.lineTo(q[10][0], q[10][1]);
        ctx.moveTo(q[4][0], q[4][1]); ctx.lineTo(q[12][0], q[12][1]); ctx.lineTo(q[13][0], q[13][1]);
        ctx.stroke();
      }
      ctx.restore();
    }
    this.glows.length = 0;
    drawBody(ctx, b, this.look, a, {
      alpha, flash: this.flash, cape: this.cape, blade: this.blade, glows: this.glows, time: this.game.time,
      bladeHot: this.attack ? 1 - this.attack.t : 0, tint: opts.tint, rim: opts.rim, vx: this.c.vx,
    });
  }
}
