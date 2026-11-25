// Enemies: masked husks (ragdolls), brutes (heavy ragdolls with slam waves), wisps (floating casters).
// Plus projectiles shared with bosses. Every attack has a readable wind-up and a physical result.
import { Audio } from '../core/audio.js';
import { Actor } from './actor.js';
import { P } from '../physics/body.js';
import { TILE, T, TILES, SHRINE_EVERY, gateNear } from '../world/tiles.js';
const T_STONE = T.STONE;
import { ARENA_HALF } from '../world/world.js';
import { clamp, lerp, rand, sign, TAU, rgba, hash2 } from '../core/util.js';
import { drawGlow } from '../world/light.js';
import { IMG } from '../art/images.js';

// ---------------------------------------------------------------- projectiles
export class Proj {
  constructor(game, o) {
    this.game = game;
    Object.assign(this, { x: 0, y: 0, vx: 0, vy: 0, r: 8, life: 4, dmg: 1, col: '#ff9b6a', team: 'enemy', kind: 'orb', grav: 0, home: 0, dead: false, t: 0 }, o);
    this.light = { x: this.x, y: this.y, c: [1, 0.6, 0.4], s: 0.55 };
    if (game.net && game.net.isHost) game.net.onProj(o);
  }
  update(dt) {
    const g = this.game;
    this.t += dt; this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.kind === 'wave') {
      this.x += this.vx * dt;
      // a ground wave hugs the floor and dies at walls or drops
      const tx = Math.floor((this.x + sign(this.vx) * 10) / TILE), ty = Math.floor((this.y - 8) / TILE);
      if (g.world.solid(tx, ty) || !g.world.solid(tx, ty + 1)) { this.dead = true; g.fx.dust(this.x, this.y, 5, '#e8dccb', -Math.PI / 2, 100); return; }
      if ((g.tick % 3) === 0) g.fx.spawn({ x: this.x + rand(-6, 6), y: this.y - rand(0, 30), vy: -rand(60, 160), life: 0.4, size: 3, col: '#ffffff', col1: this.col, add: true });
    } else {
      if (this.home && g.player) {
        const p = g.player.actor;
        const dx = p.c.x - this.x, dy = p.cy - this.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(this.vx, this.vy);
        this.vx += (dx / d * sp - this.vx) * this.home * dt; this.vy += (dy / d * sp - this.vy) * this.home * dt;
      }
      this.vy += this.grav * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (g.world.solidAt(this.x, this.y)) {
        this.dead = true;
        g.fx.burst(this.x, this.y, { n: 8, speed: 220, col: '#ffffff', col1: this.col, add: true, life: 0.35, size: 2.4 });
        if (this.kind === 'block' && this.tile) g.fx.debris(this.x, this.y, this.tile, 6);
        return;
      }
    }
    this.light.x = this.x; this.light.y = this.y;
    // hit the player
    const pl = g.player;
    if (pl && !pl.dead && this.team === 'enemy') {
      const a = pl.actor;
      let hit = false;
      if (this.kind === 'wave') hit = Math.abs(a.c.x - this.x) < 20 && a.c.y > this.y - 34 && a.c.y < this.y + 10;
      else {
        const b = a.body;
        for (const i of [P.HEAD, P.CHEST, P.BELLY, P.PELVIS, P.KNEE_F, P.KNEE_B]) if ((b.x[i] - this.x) ** 2 + (b.y[i] - this.y) ** 2 < (this.r + b.r[i]) ** 2) { hit = true; break; }
      }
      if (hit && pl.takeHit(this.dmg, this.x, this.y, { knock: this.kind === 'wave' ? 380 : 300, heavy: this.heavy })) { if (this.kind !== 'wave') { this.dead = true; if (this.tile) g.fx.debris(this.x, this.y, this.tile, 5); } }
    }
    // the player's blade can bat orbs away
    if (this.kind === 'orb' && pl && pl.actor.attack && pl.actor.attack.t > 0.16 && pl.actor.attack.t < 0.66) {
      const s = pl.actor.bladeSeg(1);
      const dx = s.x1 - this.x, dy = s.y1 - this.y;
      if (dx * dx + dy * dy < 30 * 30) { this.dead = true; Audio.play('clang', { pitch: 1.4 }); g.fx.sparks(this.x, this.y, Math.atan2(-dy, -dx), 10, this.col); g.hitstop(0.03); }
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (this.kind === 'wave' && IMG['fx/wave']) {
      const im = IMG['fx/wave'], h = 64, w = im.width * h / im.height;
      ctx.globalAlpha = Math.min(1, this.life * 2);
      ctx.drawImage(im, this.x - w / 2, this.y - h + 6, w, h);
    } else if (this.kind === 'wave') {
      const g = ctx.createLinearGradient(0, this.y - 46, 0, this.y);
      g.addColorStop(0, rgba(this.col, 0)); g.addColorStop(1, rgba(this.col, 0.85));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(this.x - 12, this.y); ctx.quadraticCurveTo(this.x, this.y - 60, this.x + 12, this.y); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(this.x - 2, this.y - 22, 4, 22);
    } else if (this.kind === 'block') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(this.x, this.y); ctx.rotate(this.t * 6);
      ctx.fillStyle = this.colB || '#6a6080'; ctx.beginPath(); ctx.roundRect(-13, -13, 26, 26, 6); ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.15); ctx.fillRect(-11, -11, 22, 4);
    } else {
      drawGlow(ctx, this.x, this.y, this.r * 3.5, hexRgb(this.col), 0.7);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.55, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(this.col, 0.6); ctx.lineWidth = this.r * 0.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05); ctx.stroke();
    }
    ctx.restore();
  }
}
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

// ---------------------------------------------------------------- wisp (non-ragdoll flyer)
export class Wisp {
  constructor(game, x, y, tier, col) {
    this.game = game; this.id = 'w' + Math.random().toString(36).slice(2, 8);
    this.team = 'enemy'; this.kind = 'wisp'; this.scale = 1;
    this.c = { x, y, vx: 0, vy: 0, w: 24, h: 24 };
    this.hp = 18 + tier * 8; this.maxHp = this.hp;
    this.hitR = 14; this.mode = 'ctrl'; this.flash = 0; this.cd = rand(1.5, 2.5); this.t = rand(0, 10);
    this.col = col || '#c4b5ff'; this.glows = []; this.removed = false; this.deadT = 0; this.tier = tier;
    this.windup = 0;
  }
  get cx() { return this.c.x; } get cy() { return this.c.y; }
  get x() { return this.c.x; } get y() { return this.c.y; }
  update(dt) {
    const g = this.game, c = this.c;
    this.t += dt; this.flash = Math.max(0, this.flash - dt * 5);
    if (this.mode === 'dead') {
      this.deadT += dt; c.vy += 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      if (this.deadT > 0.6) this.removed = true;
      return;
    }
    // knocked out of the air (sling, heavy hits): drops and flounders for a moment
    if (this.stunT > 0) {
      this.stunT -= dt; c.vy = Math.min(c.vy + 900 * dt, 420); c.vx *= Math.pow(0.1, dt);
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (g.world.solidAt(c.x, c.y + 10)) { c.vy = 0; c.y -= 2; }
      this.windup = 0; return;
    }
    const p = g.player && !g.player.dead ? g.player.actor : null;
    let tx = c.x + Math.sin(this.t * 0.7) * 40, ty = c.y + Math.cos(this.t * 0.9) * 20;
    // underground they keep closer to the ceiling of the tunnel and shoot far less often
    const under = p && p.c.y > (g.world.surface(Math.floor(p.c.x / TILE)) + 4) * TILE;
    if (p && Math.abs(p.c.x - c.x) < 700) {
      const side = sign(c.x - p.c.x) || 1;
      tx = p.c.x + side * 210 + Math.sin(this.t) * 40; ty = p.c.y - 150 + Math.cos(this.t * 1.3) * 30;
      this.cd -= dt;
      if (this.cd < 0.9 && !this.windup) { this.windup = 0.9; Audio.play('shard', { pitch: 0.7, vol: 0.5 }); }
      if (this.windup) {
        this.windup -= dt;
        if (this.windup <= 0) {
          this.windup = 0; this.cd = rand(3.2, 4.4) * (under ? 1.6 : 1) - this.tier * 0.2;
          const dx = p.c.x - c.x, dy = p.cy - c.y, d = Math.hypot(dx, dy) || 1;
          const sp = 230 + this.tier * 25;
          g.projectiles.push(new Proj(g, { x: c.x, y: c.y, vx: dx / d * sp, vy: dy / d * sp, r: 7, col: this.col, life: 4 }));
          Audio.play('shoot');
        }
      }
    }
    c.vx += ((tx - c.x) * 2 - c.vx) * Math.min(1, dt * 2);
    c.vy += ((ty - c.y) * 2 - c.vy) * Math.min(1, dt * 2);
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (g.world.solidAt(c.x, c.y)) { c.y -= 60 * dt * 10; c.vy = -60; }
  }
  hurt(dmg, info) {
    const g = this.game;
    this.hp -= dmg; this.flash = 1;
    this.c.vx += info.dx * 420; this.c.vy += (info.dy || -0.3) * 300;
    if (info.finisher || (info.poise || 0) > 14) this.stunT = 1.2;
    this.windup = 0; this.cd = Math.max(this.cd, 1);
    if (this.hp <= 0) g.enemies.kill(this, info);
  }
  draw(ctx) {
    drawWispSprite(ctx, this.c.x, this.c.y, this.t, this.col, {
      alpha: this.mode === 'dead' ? 1 - this.deadT / 0.6 : 1, flash: this.flash, windup: this.windup, vx: this.c.vx,
      look: this.game.player ? clamp((this.game.player.x - this.c.x) * 0.01, -2, 2) : 0,
    });
    this.glows.length = 0;
  }
  lightsInto(arr) { arr.push({ x: this.c.x, y: this.c.y, c: hexRgb(this.col), s: 0.5 }); }
}

// a moth with a paper-lantern body and a mask for a face
export function drawWispSprite(ctx, x, y, t, col, o = {}) {
  const a = o.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter';
  const rgb = hexRgb(col);
  drawGlow(ctx, x, y, 50 + (o.windup ? (0.6 - o.windup) * 70 : 0), [0.62, 0.95, 1], 0.4);
  // a cold cyan flame: one closed teardrop whose tip licks back against its motion, a paler inner flame,
  // and a pale hourglass core where the Hollow's mask would be; two sparks above it
  const lean = Math.max(-1, Math.min(1, -(o.vx || 0) / 160)) * 6, fl = Math.sin(t * 9) * 1.5;
  const flame = (k, c0, c1, alpha) => {
    const w = 11 * k, h = 20 * k;
    ctx.beginPath(); ctx.moveTo(Math.round(x + lean * k), Math.round(y - h - 6 * k + fl));
    ctx.bezierCurveTo(x + w * 0.4 + lean * 0.6 * k, y - h * 0.55, x + w, y - h * 0.1, x + w, y + h * 0.18);
    ctx.bezierCurveTo(x + w, y + h * 0.62, x + w * 0.45, y + h * 0.8, x, y + h * 0.8);
    ctx.bezierCurveTo(x - w * 0.45, y + h * 0.8, x - w, y + h * 0.62, x - w, y + h * 0.18);
    ctx.bezierCurveTo(x - w, y - h * 0.15, x - w * 0.2 + lean * 0.6 * k, y - h * 0.45, Math.round(x + lean * k), Math.round(y - h - 6 * k + fl));
    ctx.closePath();
    const gr = ctx.createLinearGradient(x, y - h, x, y + h); gr.addColorStop(0, rgba(c0, alpha * 0.7)); gr.addColorStop(1, rgba(c1, alpha));
    ctx.fillStyle = gr; ctx.fill();
  };
  const cyan = o.flash > 0 ? '#ffffff' : '#9ff3ff';
  flame(1, cyan, '#4fd2e0', 0.85);
  flame(0.62, '#e8fdff', '#9ff3ff', 0.9);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#f4f1ea';
  ctx.beginPath(); ctx.ellipse(x, y - 2, 3.6, 4.2, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y + 6, 3.2, 3.8, 0, 0, TAU); ctx.fill();
  ctx.fillRect(Math.round(x - 1), Math.round(y + 1), 2, 3);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba('#bff6ff', 0.8 * (0.6 + 0.4 * Math.sin(t * 5)));
  for (const [dx, dy] of [[-9, -30], [7, -36]]) { ctx.beginPath(); ctx.moveTo(x + dx, y + dy - 3); ctx.lineTo(x + dx + 1.2, y + dy); ctx.lineTo(x + dx, y + dy + 3); ctx.lineTo(x + dx - 1.2, y + dy); ctx.closePath(); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  if (o.windup) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(col, 0.6); ctx.beginPath(); ctx.ellipse(x, y + 2, 7, 9, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- ragdoll enemies
// The Hollows, after the painted reference: big pale masks with one dark eye (a flame crest, a cone, a
// hood, horns), dark stick limbs, short ponchos with deep jagged hems in muted brown and violet, a scarf.
const HOLLOW_BASE = (eye) => ({ body: '#26212c', limb: '#241f29', coat: '#26212c', mat: 'cloth', eyes: eye, maskCol: '#ecdcc8', blade: null, marks: [], rim: '#8a7462', claws: '#e6dfd2', bootCol: '#1c1820', belt: false, collar: false, cloakShort: true, cloakTeeth: 6, arms: 0.9, legs: 0.92 });
export const HUSK_LOOK = (eye) => ({ ...HOLLOW_BASE(eye), hmask: 'crest', cloakLong: '#7d5747', cape: { col: '#8a5e4e', style: 'scarf', len: 5, wide: 3.6 } });
// a lancer carries a crude spear and charges; a slinger keeps its distance and lobs stones
export const LANCER_LOOK = (eye) => ({ ...HOLLOW_BASE(eye), hmask: 'cone', cloakLong: '#5a4a6a', cape: null, weapon: 'w_spear', weaponLen: 46, blade: { len: 46, w: 2.2, col: '#d8cfc2' } });
export const SLINGER_LOOK = (eye) => ({ ...HOLLOW_BASE(eye), hmask: 'hood', hoodCol: '#5e4e78', cloakLong: '#5a4a6a', cape: { col: '#7d5747', style: 'scarf', len: 5, wide: 3.4 }, weapon: 'w_sling', blade: { len: 14, w: 2, col: '#9a96a0' } });
export const BRUTE_LOOK = (eye) => ({ ...HOLLOW_BASE(eye), hmask: 'horns', headK: 1.3, cloakLong: '#6a4a44', cloakTeeth: 7, slab: '#9a8270', cape: null, bulk: 1.25, arms: 1.1, gaunt: true, gloves: '#2a242e' });

export class Enemies {
  constructor(game) {
    this.game = game;
    this.spawnT = 2;
    this.calm = 22;        // a short breath at the very start, then the Hollows come
  }
  get list() { return this.game.actors.filter(a => a.team === 'enemy' && !a.isBoss && a.kind !== 'nest' && a.kind !== 'dummy'); }
  update(dt) {
    const g = this.game, P0 = g.player;
    if (!P0 || g.cinematic) return;
    // nothing moves against you while you talk, read or rummage in your satchel
    if (g.ui && g.ui.modal && !(g.net && g.net.remotes && g.net.remotes.size)) return;
    if (g.net && g.net.isGuest) return;
    this.calm -= dt;
    for (const e of this.list) {
      if (e.kind === 'wisp') continue;
      if (e.mode === 'dead') { if (e.deadT > 2.2) e.removed = true; continue; }
      this.think(e, dt);
    }
    // despawn far ones
    for (const e of this.list) if (Math.abs(e.c.x - P0.x) > 1900 || Math.abs(e.c.y - P0.y) > 1400) e.removed = true;
    // spawn
    this.spawnT -= dt;
    if (this.spawnT <= 0 && !(g.bosses && g.bosses.active)) {
      this.spawnT = rand(1.8, 3.2);
      this.trySpawn();
    }
  }
  // how many blocks tall the wall right in front of e is (0 = open ground)
  ledgeAhead(e, dir) {
    const c = e.c, W = this.game.world;
    const tx = Math.floor((c.x + dir * (c.w / 2 + 6)) / TILE), ty = Math.floor((c.y - 1) / TILE);
    let k = 0;
    while (k < 7 && W.solid(tx, ty - k)) k++;
    return k;
  }
  trySpawn() {
    const g = this.game, P0 = g.player, W = g.world;
    if (P0.dead || this.calm > 0) return;
    // no ambushes while learning: nothing spawns until the tutorial is over
    if (g.story && g.story.sv && !g.story.sv.tutDone) return;
    const ptx = Math.floor(P0.x / TILE);
    if (Math.abs(ptx) < 30 && g.time < 90) return;
    const tier = g.world.tierAtX(P0.x);
    const zl0 = g.levels ? g.levels.zoneLevel(P0.x) : 1;
    const cap = Math.min(11, 4 + tier * 2 + Math.min(3, Math.floor(zl0 / 3)));
    if (this.list.length >= cap) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const dist = (g.view.x1 - g.view.x0) / 2 + rand(120, 360);
    const x = P0.x + side * dist, tx = Math.floor(x / TILE);
    // safe zones: near shrines, the spawn plateau, boss arenas
    if (Math.abs(tx) < 28 && g.time < 90) return;
    if (g.towns && g.towns.safeAt && g.towns.safeAt(x)) return;
    const gate = gateNear(tx);
    if (Math.abs(tx - gate.gx) < ARENA_HALF + 6) return;
    if (W.shrineNear(tx) !== null) return;
    // find standing room: surface if the player is near the surface, else the nearest cave floor
    let y = null;
    const surf = W.surface(tx);
    const pty = Math.floor(P0.y / TILE);
    if (pty < W.surface(ptx) + 8) y = surf;
    else {
      for (let d = 0; d < 14 && y === null; d++) for (const ty of [pty - d, pty + d]) {
        if (!W.solid(tx, ty) && !W.solid(tx, ty - 1) && !W.solid(tx, ty - 2) && W.solid(tx, ty + 1)) { y = ty + 1; break; }
      }
    }
    if (y === null) return;
    const B = g.biomeAt(x);
    const r = Math.random();
    const wispK = B.id === 'glass' || B.id === 'hollow' ? 0.22 : 0.12;
    const zl = g.levels ? g.levels.zoneLevel(x) : 1;
    if (r < wispK) this.spawnWisp(x, y * TILE - 140, tier, B.accent);
    else if (r < wispK + (tier >= 1 || g.time > 120 ? 0.14 : 0.05)) this.spawn('brute', x, y * TILE, tier, B.accent, { lvl: zl });
    else {
      // a pack: husks with a lancer or a slinger mixed in, spread out a little
      const n = Math.min(cap - this.list.length, 1 + Math.floor(Math.random() * (1.6 + Math.min(2, tier) + Math.min(1, zl0 / 4))));
      for (let i = 0; i < Math.max(1, n); i++) {
        const k = i === 0 ? 'husk' : Math.random() < 0.3 ? 'lancer' : Math.random() < 0.35 ? 'slinger' : 'husk';
        const xx = x + side * i * rand(36, 70), tt = Math.floor(xx / TILE);
        const yy = pty < W.surface(ptx) + 8 ? W.surface(tt) : y;
        this.spawn(k, xx, yy * TILE, tier, B.accent, { lvl: zl });
      }
    }
  }
  spawnWisp(x, y, tier, col) {
    const w = new Wisp(this.game, x, y, tier, col);
    this.game.actors.push(w);
    return w;
  }
  spawn(kind, x, y, tier = 0, eye = '#ffb36b', o = {}) {
    const g = this.game;
    const brute = kind === 'brute', lancer = kind === 'lancer', slinger = kind === 'slinger';
    const lvl = o.lvl || 1, lk = 1 + (lvl - 1) * 0.12;
    const e = new Actor(g, {
      x, y, team: 'enemy', scale: brute ? 1.32 : lancer ? 0.98 : 0.92, heavy: brute ? 1.6 : 1,
      look: brute ? BRUTE_LOOK(eye) : lancer ? LANCER_LOOK(eye) : slinger ? SLINGER_LOOK(eye) : HUSK_LOOK(eye),
      hp: (brute ? 90 : lancer ? 34 : slinger ? 22 : 28) * (1 + tier * 0.55) * lk, run: brute ? 130 : lancer ? 215 : slinger ? 165 : 200, facing: -1,
    });
    e.kind = kind; e.tier = tier; e.noCrumple = true; e.lvl = lvl; e.dmgK = lk;
    if (lancer || slinger) e.blade = true;
    e.maxPoise = e.poise = brute ? 70 : lancer ? 34 : 26;
    e.ai = { state: 'wander', t: rand(0.6, 1.6), dir: Math.random() < 0.5 ? -1 : 1, cd: rand(0, 0.6) };
    e.hurt = (dmg, info) => this.hurt(e, dmg, info);
    e.glowEye = eye;
    Object.assign(e, o);
    g.actors.push(e);
    return e;
  }
  think(e, dt) {
    const g = this.game, ai = e.ai, I = e.intent, c = e.c;
    const p = this.target(e);
    I.jump = false; I.attack = false; I.dash = false; I.climbWall = 0;
    if (e.mode !== 'ctrl') { I.mx = 0; return; }
    ai.t -= dt; ai.cd -= dt;
    // status: burning or bleeding ticks, frost slows, poise refills after a while, stagger wobbles
    if (e.dot) { e.dot.t -= dt; e.dot.acc = (e.dot.acc || 0) + dt; if (e.dot.acc >= e.dot.tick) { e.dot.acc = 0; this.hurt(e, Math.ceil(e.dot.dps * e.dot.tick), { x: e.cx, y: e.cy, dx: 0, dy: 0, dot: true }); g.fx.burst(e.cx, e.cy, { n: 4, speed: 90, col: e.dot.col, col1: '#ffffff', add: true, life: 0.4, size: 2, kind: 'mote' }); } if (e.dot && e.dot.t <= 0) e.dot = null; }
    if (e.slowT > 0) e.slowT -= dt;
    e.run = (e.baseRun || (e.baseRun = e.run)) * (e.slowT > 0 ? 0.5 : 1);
    if (e.poiseT > 0) { e.poiseT -= dt; if (e.poiseT <= 0) e.poise = e.maxPoise; }
    if (ai.state === 'stagger') { I.mx = 0; e.telegraph = 0; if (ai.t <= 0) { e.staggered = false; e.poise = e.maxPoise; ai.state = 'recover'; ai.t = 0.3; } return; }
    const dx = p ? p.c.x - c.x : 1e9, dy = p ? p.c.y - c.y : 1e9;
    const seen = p && Math.abs(dx) < 560 && Math.abs(dy) < 240;
    if (seen) ai.mem = 3; else ai.mem = Math.max(0, (ai.mem || 0) - dt);
    const sees = seen || (p && ai.mem > 0 && Math.abs(dx) < 900);
    const brute = e.kind === 'brute';
    if (e.kind === 'lancer' && this.thinkLancer(e, dt, p, dx, dy, sees)) return;
    if (e.kind === 'slinger' && this.thinkSlinger(e, dt, p, dx, dy, sees)) return;
    e.look_at = sees ? { x: p.c.x, y: p.c.y - 60 } : null;
    switch (ai.state) {
      case 'wander': {
        I.mx = ai.dir * 0.45;
        if (ai.t <= 0) { ai.dir = -ai.dir; ai.t = rand(1.2, 2.6); if (Math.random() < 0.15) { I.mx = 0; ai.state = 'idle'; ai.t = rand(0.4, 1); } }
        if (!this.groundAhead(e, ai.dir) || e.wallAt(ai.dir)) { ai.dir = -ai.dir; ai.t = rand(1.5, 3); }
        if (sees) { ai.state = 'chase'; Audio.play('talk', { pitch: brute ? 0.5 : 0.8, vol: 0.6 }); }
        break;
      }
      case 'idle': I.mx = 0; if (ai.t <= 0) ai.state = 'wander'; if (sees) ai.state = 'chase'; break;
      case 'chase': {
        if (!sees) { ai.state = 'wander'; ai.t = 2; break; }
        const dir = sign(dx);
        I.mx = dir;
        // read the ledge ahead: step up 1, jump 2-3 (holding the jump for full height), husks claw up 4-5
        const ledge = this.ledgeAhead(e, dir);
        I.jumpHeld = true; I.climbWall = 0;
        if (ledge >= 2 && ledge <= 3 && c.ground) I.jump = true;
        else if (ledge >= 4 && ledge <= 5 && !brute) { I.climbWall = dir; if (c.ground) I.jump = true; }
        else if (c.clawing && ledge >= 1) I.climbWall = dir;   // keep hauling up until over the lip
        else if (ledge > 5 || (brute && ledge > 3)) I.mx = 0;
        if (!this.groundAhead(e, dir) && dy >= -10) I.mx = 0;
        const range = brute ? 120 : 84;
        if (Math.abs(dx) < range && Math.abs(dy) < 70 && ai.cd <= 0) {
          ai.state = 'windup'; ai.t = brute ? 0.75 : 0.42; I.mx = 0; e.face(dir);
          Audio.play('shard', { pitch: brute ? 0.45 : 0.6, vol: 0.6 });
          if (brute) g.fx.ring(c.x + dir * 60, c.y - 4, 70, 10, 0.75, '#ff8a6a', 3, true);
        }
        break;
      }
      case 'windup': {
        I.mx = 0;
        if (ai.t <= 0) {
          ai.state = 'strike'; ai.t = brute ? 0.5 : 0.32;
          e.startAttack(brute ? 'slam' : 'side', brute ? 0.5 : 0.32);
          ai.hit = false;
          if (!brute) { c.vx = e.facing * 560; c.vy = -120; }
          Audio.play('swing', { pitch: brute ? 0.6 : 0.85 });
        }
        break;
      }
      case 'strike': {
        I.mx = 0;
        if (brute && !ai.slammed && e.attack && e.attack.t > 0.5) {
          ai.slammed = true;
          const fx = c.x + e.facing * 46;
          Audio.play('slam', { vol: 0.8 }); g.shake(0.3);
          g.fx.ring(fx, c.y - 4, 8, 90, 0.4, '#ffd2a0', 5); g.fx.dust(fx, c.y - 4, 10, '#e8dccb', -Math.PI / 2, 200);
          for (const d of [-1, 1]) g.projectiles.push(new Proj(g, { kind: 'wave', x: fx, y: c.y, vx: d * 380, life: 1.6, col: '#ffb36b' }));
          if (p && Math.abs(p.c.x - fx) < 70 && Math.abs(p.c.y - c.y) < 60) this.hitTarget(p, 1, fx, c.y - 20, { knock: 520, lift: 480 }, e);
        }
        if (!brute && !ai.hit && p) {
          // claws: the actual hands must reach the player's body
          const b = e.body, pb = p.body;
          for (const h of [P.HAND_F, P.HAND_B, P.HEAD]) {
            for (const q of [P.CHEST, P.BELLY, P.HEAD, P.PELVIS]) {
              if ((b.x[h] - pb.x[q]) ** 2 + (b.y[h] - pb.y[q]) ** 2 < 22 * 22) { ai.hit = true; break; }
            }
            if (ai.hit) break;
          }
          if (!ai.hit && Math.abs(dx) < 36 && Math.abs(dy) < 50) ai.hit = true;
          if (ai.hit) this.hitTarget(p, 1, c.x, c.y - 50, undefined, e);
        }
        if (ai.t <= 0) { ai.state = 'recover'; ai.t = brute ? 0.75 : 0.38; ai.slammed = false; ai.cd = brute ? 1.3 : 0.55; }
        break;
      }
      case 'recover': I.mx = 0; if (ai.t <= 0) ai.state = sees ? 'chase' : 'wander'; break;
    }
    // telegraph: body leans back, eyes flare
    e.telegraph = ai.state === 'windup' ? 1 - ai.t / (brute ? 0.75 : 0.42) : 0;
  }
  // lancer: closes to mid range, crouches with the spear levelled (a red line shows the path), then charges
  thinkLancer(e, dt, p, dx, dy, sees) {
    const ai = e.ai, I = e.intent, c = e.c, g = this.game;
    if (ai.state === 'lwind') {
      I.mx = 0; e.telegraph = 1 - ai.t / 0.6;
      if (ai.t <= 0) { ai.state = 'lcharge'; ai.t = 0.34; ai.hit = false; e.startAttack('lunge', 0.4); Audio.play('swing', { pitch: 0.7 }); g.fx.dust(c.x, c.y - 4, 8, '#e8dccb', Math.PI / 2 - e.facing * 1.2, 160); }
      return true;
    }
    if (ai.state === 'lcharge') {
      I.mx = 0; e.telegraph = 0;
      c.vx = e.facing * 880; if ((g.tick % 2) === 0) g.fx.spawn({ x: c.x - e.facing * 20, y: c.y - 40, vx: -e.facing * 60, vy: 0, life: 0.3, size: 5, size1: 1, col: '#ffffff', col1: e.glowEye, add: true, kind: 'streak' });
      if (!ai.hit && p && Math.abs(dx) < 46 && Math.abs(dy) < 60) { ai.hit = true; this.hitTarget(p, Math.round(1 * (e.dmgK || 1)), c.x + e.facing * 30, c.y - 50, { knock: 560, lift: 300 }, e); }
      if (ai.t <= 0 || e.wallAt(e.facing)) { ai.state = 'recover'; ai.t = 0.8; ai.cd = 1.6; c.vx *= 0.2; }
      return true;
    }
    if (ai.state === 'chase' && sees && ai.cd <= 0 && Math.abs(dx) > 110 && Math.abs(dx) < 300 && Math.abs(dy) < 40 && c.ground) {
      ai.state = 'lwind'; ai.t = 0.6; I.mx = 0; e.face(sign(dx));
      Audio.play('shard', { pitch: 0.5, vol: 0.6 });
      g.fx.ring(c.x + e.facing * 150, c.y - 40, 6, 24, 0.6, '#ff6a5a', 2, true);
      return true;
    }
    return false;
  }
  // slinger: stays 200-320 px away, backs off if you close in, and lobs a stone in an arc that lands on you
  thinkSlinger(e, dt, p, dx, dy, sees) {
    const ai = e.ai, I = e.intent, c = e.c, g = this.game;
    if (!sees || !p) return false;
    const ad = Math.abs(dx), dir = sign(dx);
    e.face(dir);
    if (ai.state === 'swind') {
      I.mx = 0; e.telegraph = 1 - ai.t / 0.55;
      if (ai.t <= 0) {
        e.startAttack('sling', 0.4);
        // aim: a lob that lands where the player is (flight time grows with distance)
        const T = clamp(ad / 380, 0.55, 1.1), G = 900;
        const sx = c.x + dir * 14, sy = c.y - 70;
        const vx = (p.c.x - sx) / T, vy = (p.c.y - 40 - sy - 0.5 * G * T * T) / T;
        g.projectiles.push(new Proj(g, { kind: 'block', x: sx, y: sy, vx, vy, grav: G, r: 7, dmg: 1, tile: T_STONE, col: '#d8c7a8', life: 3 }));
        Audio.play('swing', { pitch: 1.3, vol: 0.5 });
        ai.state = 'chase'; ai.cd = rand(1.6, 2.4);
      }
      return true;
    }
    I.jumpHeld = true;
    if (ad < 170) I.mx = -dir * 0.9;                 // too close: back away
    else if (ad > 330) I.mx = dir * 0.8;             // too far: close in
    else I.mx = 0;
    if (I.mx && !this.groundAhead(e, sign(I.mx))) I.mx = 0;
    if (I.mx && e.wallAt(sign(I.mx)) && c.ground) I.jump = true;
    if (ai.cd <= 0 && ad < 420 && Math.abs(dy) < 200 && c.ground) { ai.state = 'swind'; ai.t = 0.55; I.mx = 0; Audio.play('talk', { pitch: 1.1, vol: 0.4 }); }
    e.telegraph = 0;
    return true;
  }
  // nearest living player, local or remote (the host simulates enemies for everyone)
  target(e) {
    const g = this.game;
    let best = g.player.dead ? null : g.player.actor, bd = best ? Math.abs(best.c.x - e.c.x) + Math.abs(best.c.y - e.c.y) * 2 : 1e9;
    if (g.net && g.net.isHost) for (const r of g.net.remotes.values()) {
      if (r.dead) continue;
      const d = Math.abs(r.actor.c.x - e.c.x) + Math.abs(r.actor.c.y - e.c.y) * 2;
      if (d < bd) { bd = d; best = r.actor; }
    }
    return best;
  }
  hitTarget(a, n, x, y, o, from) {
    const g = this.game;
    if (a === g.player.actor && from && g.player.tryParry(from)) return;
    if (a === g.player.actor) g.player.takeHit(n, x, y, o);
    else if (g.net) { g.net.hitRemote(a, n, x, y, o); a.takeImpulse(x, y, sign(a.c.x - x) * 400, -200, 0.6); }
  }
  groundAhead(e, dir) {
    const W = this.game.world, c = e.c;
    const tx = Math.floor((c.x + dir * (c.w / 2 + 10)) / TILE), ty = Math.floor((c.y + 4) / TILE);
    return W.solid(tx, ty) || W.solid(tx, ty + 1);
  }
  hurt(e, dmg, info) {
    const g = this.game;
    if (e.mode === 'dead') return;
    // elites with a guard turn aside blows from the front unless the guard is broken
    if (e.guard && !e.staggered && !info.breaksGuard && !info.dot && sign(info.dx || 0) === -e.facing) {
      e.poise = Math.max(0, (e.poise || 0) - (info.poise || 8) * 0.5);
      if (e.poise <= 0) this.stagger(e, 1.6);
      e.flash = 0.6; return 'armor';
    }
    e.hp -= dmg; e.flash = 1;
    if (info.dot) { if (e.hp <= 0) this.kill(e, info); return; }
    const k = (e.kind === 'brute' || e.elite ? 0.45 : 1) * (info.knock || 1);
    e.takeImpulse(info.x, info.y, info.dx * 700 * k, (info.dy || -0.3) * 500 * k, e.kind === 'brute' ? 0.4 : 0.8);
    e.c.vx += info.dx * 340 * k;
    if (info.dy < 0) e.c.vy = Math.min(e.c.vy, -260 * k);
    // launches and air juggles
    if (info.launch) { e.c.vy = -820; e.c.ground = false; if (e.ai) { e.ai.state = 'recover'; e.ai.t = 1.0; } }
    else if (!e.c.ground && e.mode === 'ctrl') e.c.vy = Math.min(e.c.vy, -300);
    // poise breaks into a stagger
    if (e.poise !== undefined) { e.poise -= info.poise || 8; e.poiseT = 2.2; if (e.poise <= 0 && !e.staggered) this.stagger(e, 1.4); }
    // bleed, burn, frost
    if (info.bleed) e.dot = { t: 2.4, tick: 0.4, dps: 2.5, col: '#ff6a6a' };
    if (info.element === 'ember') e.dot = { t: 3.5, tick: 0.5, dps: 4, col: '#ff9b4a' };
    if (info.element === 'frost') e.slowT = 3;
    if (e.ai && e.ai.state === 'windup' && e.kind !== 'brute') { e.ai.state = 'recover'; e.ai.t = 0.4; }
    if (e.hp <= 0) this.kill(e, info);
  }
  stagger(e, t) {
    e.staggered = true; e.staggerT = t; e.poise = 0;
    if (e.ai) { e.ai.state = 'stagger'; e.ai.t = t; }
    e.attack = null; e.telegraph = 0;
    if (e.anim) e.anim.hit(-e.facing, 1);
    this.game.fx.ring(e.cx, e.c.y - 90 * e.scale, 4, 30, 0.4, '#ffe3a0', 3);
    Audio.play('clang', { pitch: 0.6, vol: 0.6 });
  }
  kill(e, info) {
    const g = this.game;
    if (e.mode === 'dead') return;
    e.mode = 'dead'; e.deadT = 0;
    if (e.kind !== 'wisp') {
      e.attack = null;
      e.body.impulseAll(info.dx * 650 + rand(-80, 80), -520 + (info.dy || 0) * 300);
      e.takeImpulse(info.x, info.y, info.dx * 900, -300, 1);
    } else { e.c.vx = info.dx * 300; e.c.vy = -200; }
    Audio.play('kill');
    g.hitstop(0.09); g.shake(0.3); g.pulse(1);
    g.fx.ring(info.x, info.y, 6, 60, 0.4, '#ffffff', 4);
    g.fx.burst(info.x, info.y, { n: 18, speed: 420, col: '#ffffff', col1: e.glowEye || e.col || '#ffb36b', add: true, life: 0.5, size: 2.6, kind: 'streak' });
    const worth = e.kind === 'brute' ? 9 : e.kind === 'wisp' ? 4 : e.kind === 'lancer' ? 6 : 5;
    const mult = g.player.comboMult ? g.player.comboMult() : 1;
    const n = Math.ceil(worth * (1 + (e.tier || 0) * 0.5) * mult * (g.player.perk && g.player.perk('magnet') ? 1.2 : 1));
    g.fx.souls(info.x, info.y, Math.min(12, n), g.player.actor.c, '#bff6ff', () => { g.player.sv.glimmer += Math.max(1, Math.round(n / Math.min(12, n))); Audio.play('soul', { pitch: rand(0.9, 1.3), gap: 0.02 }); if (g.ui) g.ui.glimmerBump(); });
    // now and then a mote of breath: mending comes from fighting
    if (Math.random() < 0.25 && g.player.addBreath) g.fx.souls(info.x, info.y - 20, 3, g.player.actor.c, '#ffb3c8', () => g.player.addBreath(0.12));
    if (g.player.onKill) g.player.onKill(e, info);
    g.player.sv.stats.kills++;
    if (g.net) g.net.onKill && g.net.onKill(e);
  }
  lights(arr) {
    for (const e of this.list) {
      if (e.kind === 'wisp') { if (e.mode !== 'dead') e.lightsInto(arr); }
    }
  }
  draw(ctx, a, layer) {
    if (layer !== 'front') return;
    // attack tell: an ember glow swells in the chest while a husk or brute winds up (faces stay blank)
    for (const e of this.list) {
      if (e.kind === 'wisp' || e.mode === 'dead') continue;
      const k = e.telegraph || 0;
      if (k < 0.05) continue;
      const b = e.body;
      const hx = b.ipx(P.CHEST, a), hy = b.ipy(P.CHEST, a);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, hx, hy, (8 + k * 30) * e.scale, hexRgb(e.glowEye || '#ffb36b'), k * 0.8);
      ctx.restore();
    }
  }
}
export { hexRgb };
