// Actor = tight platformer controller (owns gameplay) + physical ragdoll that follows it through muscles.
// When knocked down the roles swap: the ragdoll owns the motion and the controller follows the pelvis.
import { TILE, TILES } from '../world/tiles.js';
import { Body, P } from '../physics/body.js';
import { Animator } from '../physics/pose.js';
import { Cape, drawBody, drawShadow, bladeGeom } from '../physics/skin.js';
import { clamp, lerp, sign } from '../core/util.js';
const smooth01 = (t) => t * t * (3 - 2 * t);

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
    this.cape = this.look && this.look.cape ? new Cape(7, (this.look.cape.len || 7) * s) : null;
    if (this.cape) this.cape.flare = this.look.cape.flare || (this.look.cape.wide > 10 ? 900 : 640);
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
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const d = TILES[W.get(tx, ty)];
      if (!d.solid) continue;
      if (d.half) { if (y1 > ty * TILE + TILE / 2 + 0.001) return { tx, ty, top: ty * TILE + TILE / 2 }; continue; }
      return { tx, ty, top: ty * TILE };
    }
    return null;
  }
  // a one-way surface whose top lies between two feet heights (platforms, and the top rung of a ladder)
  oneWayTop(x0, x1, yOld, yNew) {
    if (this.dropT > 0 || this.c.climb) return null;
    const W = this.world;
    const ty0 = Math.floor((yOld - 0.5) / TILE) + 1, ty1 = Math.floor(yNew / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      const top = ty * TILE;
      if (yOld > top + 0.5 || yNew < top) continue;
      for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x1 - 0.001) / TILE); tx++) {
        const d = TILES[W.get(tx, ty)];
        if (d.platform || (d.climb && !TILES[W.get(tx, ty - 1)].climb)) return top;
      }
    }
    return null;
  }
  onLadder() {
    const c = this.c, W = this.world, tx = Math.floor(c.x / TILE);
    return TILES[W.get(tx, Math.floor((c.y - 1) / TILE))].climb || TILES[W.get(tx, Math.floor((c.y - c.h * 0.5) / TILE))].climb;
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
      if (c.ground || c.coyote > 0.05 || c.clawing) {
        for (const up of [TILE * 0.5 + 0.5, TILE + 1]) {
          const ty = c.y - up;
          if (this.boxFree(nx, ty) && this.boxFree(c.x, ty)) {
            // settle onto the surface just climbed
            let y = ty; for (let k = 0; k < 8 && this.boxFree(nx, y + 4); k++) y += 4;
            c.y = y; c.x = nx; this.stepped = true; break;
          }
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
      if (sdy > 0) { const top = this.oneWayTop(c.x - c.w / 2, c.x + c.w / 2, c.y, ny); if (top !== null) { c.y = top; return 1; } }
      if (this.boxFree(c.x, ny)) { c.y = ny; continue; }
      const hit = this.overlaps(c.x - c.w / 2, ny - c.h, c.x + c.w / 2, ny);
      if (sdy > 0) { c.y = hit ? hit.top : c.y; return 1; }
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
    if (this.boxFree(c.x, c.y)) return;
    // nearest free spot, searching up first, then sideways and down
    for (let r = 8; r <= 160; r += 8) for (const [dx, dy] of [[0, -r], [r, 0], [-r, 0], [r, -r], [-r, -r], [0, r]]) {
      if (this.boxFree(c.x + dx, c.y + dy)) { c.x += dx; c.y += dy; return; }
    }
  }
  // a body wedged in blocks (a block placed into it, a shove into a wall) twists into strange shapes; after a
  // moment the controller steps out to free space and the ragdoll snaps back into its pose
  checkWedged(dt) {
    if (this.mode !== 'ctrl') { this.wedgedT = 0; return; }
    const b = this.body, W = this.world;
    let inside = 0;
    for (let i = 0; i < b.x.length; i++) { const t = W.get(Math.floor(b.x[i] / TILE), Math.floor(b.y[i] / TILE)); if (TILES[t].solid && !TILES[t].half) inside++; }
    const boxStuck = !this.boxFree(this.c.x, this.c.y);
    this.wedgedT = inside >= 3 || boxStuck ? (this.wedgedT || 0) + dt : 0;
    if (this.wedgedT > 0.25) {
      this.wedgedT = 0;
      this.unstick();
      b.reset(this.c.x, this.c.y - this.pelvisH);
      if (this.cape) this.cape.init = false;
    }
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
    // pushes from hits arrive as a kick: it throws a knocked body, and only nudges (and flinches) a standing one
    if (b.kickX || b.kickY) {
      const kx = b.kickX, ky = b.kickY; b.kickX = b.kickY = 0;
      if (this.mode === 'limp' || this.mode === 'dead') { c.vx += kx; c.vy += ky; if (ky < 0) c.ground = false; }
      else if (this.mode === 'ctrl') { c.vx += clamp(kx * 0.45, -320, 320); this.anim.hit(-sign(kx) || -this.facing, Math.min(1, Math.hypot(kx, ky) / 500)); }
    }
    if (this.mantle) this.updateMantle(dt);
    else if (this.mode === 'ctrl') { if (this.puppet) this.updatePuppet(dt); else this.updateCtrl(dt); }
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
    b.oneWayOff = this.dropT > 0 || !!this.c.climb;
    b.step(dt, this.world);
    this.checkWedged(dt);
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
    const crouch = false;
    if (I.crawl && c.ground && !c.climb) this.setCrawl(true);
    else if (this.crawling && (!I.crawl || !c.ground)) this.setCrawl(false);   // stays down under a ceiling
    // dash
    if (I.dash && A.dash && c.dashCD <= 0 && (c.ground || c.airDash > 0)) {
      if (I.mx) this.face(sign(I.mx));
      c.dashT = PHYS.dashT; c.dashCD = PHYS.dashCD; if (!c.ground) c.airDash--;
      c.vx = this.facing * PHYS.dashV; c.vy = 0;
      this.inv = Math.max(this.inv, 0.12);
      if (this.onDash) this.onDash();
    }
    // ladders: up or down grabs the rungs; jump lets go. Platforms: hold down to drop through
    this.dropT = Math.max(0, (this.dropT || 0) - dt);
    const lad = this.onLadder();
    const below = TILES[this.world.get(Math.floor(c.x / TILE), Math.floor((c.y + 4) / TILE))];
    if (!lad && !(I.down && below.climb)) c.climb = false;
    else if ((I.up && lad) || (I.down && (lad && !c.ground || below.climb))) c.climb = true;
    if (I.down && c.ground && !c.climb && (below.platform)) { this.downT = (this.downT || 0) + dt; if (this.downT > 0.15) { this.dropT = 0.25; c.ground = false; this.downT = 0; } }
    else this.downT = 0;
    if (c.climb && c.dashT <= 0) {
      if (I.jump && !I.up) { c.climb = false; c.vy = -PHYS.jumpV * 0.75; this.jumped('jump'); }
      else {
        c.vy = (I.up ? -1 : I.down ? 1 : 0) * 175;
        c.vx = I.mx * 110;
        // reaching the top rung: step off onto it
        const fty = Math.floor((c.y - 1) / TILE), ftx = Math.floor(c.x / TILE), W = this.world;
        if (I.up && TILES[W.get(ftx, fty)].climb && !TILES[W.get(ftx, fty - 1)].climb && c.y - fty * TILE < 14 && this.boxFree(c.x, fty * TILE)) {
          c.y = fty * TILE; c.vy = 0; c.climb = false; c.ground = true; this.dropT = 0;
        }
        if (I.mx && !this.attack) this.face(sign(I.mx));
        this.climbD = (this.climbD || 0) + Math.abs(c.vy) * dt;
      }
    } else if (c.dashT > 0) {
      c.dashT -= dt;
      c.vx = this.facing * PHYS.dashV; c.vy = 0;
      if (c.dashT <= 0) c.vx = this.facing * this.run * 0.9;
    } else {
      // run
      const target = I.mx * this.run * (this.crawling ? 0.32 : 1);
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
        if (this.crawling) { c.buffer = 0; }
        else if (c.coyote > 0) { c.vy = -PHYS.jumpV; c.coyote = 0; c.buffer = 0; c.ground = false; this.jumped('jump'); }
        else if (c.wallSlide || (A.wall && c.wall && !c.ground)) {
          c.vy = -PHYS.wallJumpY; c.vx = -c.wall * PHYS.wallJumpX; c.wallLock = 0.14; c.buffer = 0; this.face(-c.wall); c.jumps = 0; this.jumped('wall');
        } else if (A.djump && c.jumps < 1) {
          c.vy = -PHYS.djumpV; c.jumps++; c.buffer = 0; this.anim.flip(); this.jumped('double');
        }
      }
      if (!I.jumpHeld && c.vy < -260 && !this.bounced) c.vy *= PHYS.cut;
      if (c.vy >= 0) this.bounced = false;
      // claw-climbing a wall (Hollows): no gravity while hands are on the wall
      if (I.climbWall && c.wall === I.climbWall) { c.vy = -190; c.clawing = true; }
      else { c.clawing = false; c.vy = Math.min(c.vy + PHYS.grav * dt, c.wallSlide ? PHYS.wallSlide : PHYS.maxFall); }
    }
    // ledge mantle: airborne against a wall whose top (2+ blocks up from its foot) is within reach
    if (this.canMantle && !c.ground && !c.climb && I.mx && c.vy > -320 && c.dashT <= 0 && !this.attack && this.wallAt(sign(I.mx))) this.tryMantle(sign(I.mx));
    if (this.mantle) return;
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
      c.ground = (!!this.overlaps(c.x - c.w / 2, c.y, c.x + c.w / 2, c.y + 2) || this.oneWayTop(c.x - c.w / 2, c.x + c.w / 2, c.y - 0.5, c.y + 2) !== null) && c.vy >= 0 && !c.climb;
      // walking down steps: stick to the ground for drops of up to a block instead of falling each step
      if (!c.ground && wasGround && c.vy >= 0 && !c.climb && c.dashT <= 0) {
        for (let d = 4; d <= TILE + 2; d += 4) {
          if (!this.boxFree(c.x, c.y + d)) { const y = c.y + d - 4; let yy = y; while (this.boxFree(c.x, yy + 1) && yy < c.y + d) yy += 1; c.y = yy; c.ground = true; c.vy = 0; break; }
        }
      }
      if (c.ground && !wasGround) this.landed(c.lastVy);
    }
    if (!c.ground && wasGround) c.fallStart = c.y;
    if (c.climb) { c.fallStart = c.y; if (c.ground && I.down) c.ground = false; }
    // drive the animator
    const mode = this.crawling ? 'crawl' : c.climb && !c.ground ? 'climb' : this.sitting && c.ground ? 'sit' : c.dashT > 0 ? 'dash' : c.ground ? (this.emote && !I.mx && !this.attack ? 'emote' : 'ground') : (c.wallSlide || c.clawing) ? 'wall' : 'air';
    this.anim.update(dt, {
      mode, x: c.x, gy: c.y, py: c.y - this.pelvisH, vx: c.vx, vy: c.vy, runMax: this.run, attack: this.attack, blade: !!this.blade,
      look: this.look_at, crouch, emote: this.emote, windup: this.telegraph || 0, accel: clamp((I.mx * this.facing), -1, 1) * (c.ground ? 1 : 0), climbD: this.climbD || 0,
    }, this.world);
  }
  updatePuppet(dt) {
    const c = this.c;
    const mode = c.dashT > 0 ? 'dash' : c.ground ? (this.emote ? 'emote' : 'ground') : 'air';
    if (Math.abs(c.vx) > 30 && !this.attack) this.face(sign(c.vx));
    this.anim.update(dt, { mode, x: c.x, gy: c.y, py: c.y - this.pelvisH, vx: c.vx, vy: c.vy, runMax: this.run, attack: this.attack, blade: !!this.blade, emote: this.emote, windup: this.telegraph || 0 }, this.world);
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
    this.attack = null; this.mantle = null;
    const c = this.c;
    c.vx += vx; c.vy = Math.min(c.vy, 0) + vy; if (vy < 0) c.ground = false;
    c.dashT = 0; c.climb = false;
    if (this.crawling) this.setCrawl(false);
  }
  // knocked down (or dead): an animated fall, not a ragdoll. The controller flies with the knock,
  // bounces once, slides to a stop; the body tumbles in the air and lies on its back on the ground.
  updateLimp(dt) {
    const c = this.c;
    this.limpT -= dt;
    c.vy = Math.min(c.vy + PHYS.grav * dt, PHYS.maxFall);
    if (this.moveX(c.vx * dt)) c.vx *= -0.25;
    const hy = this.moveY(c.vy * dt);
    if (hy === 1) { c.vy = c.vy > 520 ? -c.vy * 0.22 : 0; c.ground = c.vy === 0; }
    else if (hy === -1) c.vy = Math.max(0, c.vy);
    else c.ground = !!this.overlaps(c.x - c.w / 2, c.y, c.x + c.w / 2, c.y + 2) && c.vy >= 0;
    if (c.ground) c.vx *= Math.pow(0.004, dt);
    const lying = c.ground && Math.abs(c.vy) < 60;
    this.anim.update(dt, { mode: lying ? 'down' : 'tumble', x: c.x, gy: c.y, py: c.y - this.pelvisH * 0.7, vx: c.vx, vy: c.vy }, this.world);
    if (this.mode === 'dead') { this.deadT += dt; return; }
    if (this.limpT <= 0 && lying && Math.abs(c.vx) < 40) {
      c.vx = c.vy = 0;
      this.unstick();
      this.mode = 'getup'; this.getupT = 0;
    }
  }
  tryMantle(dir) {
    const c = this.c, W = this.world;
    const tx = Math.floor((c.x + dir * (c.w / 2 + 6)) / TILE);
    for (let ty = Math.floor((c.y - 96) / TILE); ty <= Math.floor((c.y + 8) / TILE); ty++) {
      const top = ty * TILE, rel = c.y - top;
      if (rel < 18 || rel > 92) continue;   // the edge must be above the feet (else you'd just land) and within reach
      if (!W.solid(tx, ty) || W.solid(tx, ty - 1) || W.solid(tx, ty - 2) || W.solid(tx, ty - 3)) continue;
      if (!W.solid(tx, ty + 1)) continue;                 // a wall at least two blocks tall
      const x1 = tx * TILE + TILE / 2 + dir * 6;
      if (!this.boxFree(x1, top) || !this.boxFree(c.x, Math.min(c.y, top))) continue;
      this.mantle = { t: 0, dur: 0.62, x0: c.x, y0: c.y, x1, y1: top, dir };
      c.vx = c.vy = 0; this.attack = null; this.face(dir);
      if (this.onMantle) this.onMantle();
      return true;
    }
    return false;
  }
  updateMantle(dt) {
    const m = this.mantle, c = this.c;
    m.t += dt / m.dur;
    const u = Math.min(1, m.t);
    // rise along the wall first, then roll over the lip
    const up = smooth01(Math.min(1, u / 0.6)), over = smooth01(Math.max(0, (u - 0.5) / 0.5));
    c.y = m.y0 + (m.y1 - m.y0) * up;
    c.x = m.x0 + (m.x1 - m.x0) * over;
    this.anim.update(dt, { mode: 'mantle', mantle: u, x: c.x, gy: c.y, py: c.y - this.pelvisH, vx: 0, vy: 0 }, this.world);
    if (u >= 1) { this.mantle = null; c.ground = true; c.vy = 0; this.anim.slowBlend = 0.32; }
  }
  // crawling: a body one block tall
  setCrawl(on) {
    const c = this.c, s = this.scale;
    if (on === !!this.crawling) return true;
    if (!on) { const h0 = c.h; c.h = 82 * s; if (!this.boxFree(c.x, c.y)) { c.h = h0; return false; } }
    else c.h = 28 * s;
    this.crawling = on;
    return true;
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
