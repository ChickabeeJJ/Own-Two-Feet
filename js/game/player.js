// The player: input -> intent, physical blade combat, mining/building, healing, death and respawn.
import { Input } from '../core/input.js';
import { Audio } from '../core/audio.js';
import { Actor, PHYS } from './actor.js';
import { P } from '../physics/body.js';
import { TILE, T, TILES } from '../world/tiles.js';
import { lookFromSave, Save } from './progress.js';
import { Cape } from '../physics/skin.js';
import { clamp, lerp, segPointDist2, rgba, TAU, rand, sign } from '../core/util.js';

const REACH = 6 * TILE;

export class Player {
  constructor(game, sv, x, y) {
    this.game = game;
    this.sv = sv;
    const a = this.actor = new Actor(game, {
      x, y, team: 'player', look: lookFromSave(sv), blade: sv.hasBlade, hp: sv.maxHp,
      abil: { djump: sv.abil.djump, wall: sv.abil.wall, dash: true },
    });
    a.isPlayer = true;
    this.hp = Math.min(sv.hp || sv.maxHp, sv.maxHp);
    this.mine = null;
    this.cursor = null;
    this.buildMode = false;
    this.healT = 0;
    this.dead = false; this.deadT = 0;
    this.lowHp = false;
    this.interact = null;
    this.mouseAim = false;
    this.lastMouse = 0;
    this.hurtCD = 0;
    this.plunging = false;
    this.controlLock = 0;
    this.remoteTag = null;
    a.onStep = () => {
      Audio.play('step', { vol: 0.8, pitch: rand(0.9, 1.1), gap: 0.08 });
      const b = a.body;
      const foot = b.y[P.FOOT_F] > b.y[P.FOOT_B] ? P.FOOT_F : P.FOOT_B;
      if (Math.abs(a.c.vx) > 200) game.fx.dust(b.x[foot], b.y[foot] + 3, 2, '#d8cfc0', -Math.PI / 2 - a.facing * 0.8, 80);
    };
    a.onLand = (vy) => {
      if (vy < 300) return;
      const k = clamp(vy / 1400, 0, 1);
      Audio.play('land', { vol: 0.4 + k * 0.6 });
      game.fx.dust(a.c.x - 10, a.c.y - 2, 3 + (k * 6 | 0), '#d8cfc0', Math.PI + 0.3, 120 + k * 150);
      game.fx.dust(a.c.x + 10, a.c.y - 2, 3 + (k * 6 | 0), '#d8cfc0', -0.3, 120 + k * 150);
      if (k > 0.5) game.shake(k * 0.25);
      if (this.plunging) this.plungeImpact();
    };
    a.onJump = (kind) => {
      Audio.play(kind === 'double' ? 'djump' : 'jump');
      if (kind === 'double') { game.fx.ring(a.c.x, a.c.y - 10, 4, 34, 0.35, '#bff6ff', 3); game.fx.burst(a.c.x, a.c.y - 6, { n: 10, speed: 200, col: '#ffffff', col1: '#9ff3ff', add: true, life: 0.4, size: 2.4, dir: Math.PI / 2, spread: 1.2 }); }
      else game.fx.dust(a.c.x, a.c.y - 2, 4, '#d8cfc0', -Math.PI / 2, 90);
    };
    a.onDash = () => { Audio.play('dash'); game.fx.dust(a.c.x - a.facing * 10, a.c.y - 20, 6, '#e8e0d0', Math.PI * (a.facing > 0 ? 1 : 0), 160); game.pulse(0.6); };
    a.onSplat = (v) => { if (v > 1100) { Audio.play('hit', { vol: 0.5, gap: 0.15 }); game.shake(0.15); } };
  }
  get x() { return this.actor.c.x; }
  get y() { return this.actor.c.y; }
  get maxHp() { return this.sv.maxHp; }
  refreshLook() {
    const a = this.actor;
    a.look = lookFromSave(this.sv);
    a.cape = a.look.cape ? new Cape(7, (a.look.cape.len || 7) * a.scale) : null;
    if (a.cape) a.cape.flare = 640;
    a.blade = !!this.sv.hasBlade;
  }

  // ------------------------------------------------------------ per tick
  update(dt) {
    const g = this.game, a = this.actor, I = a.intent;
    this.hurtCD -= dt;
    this.lowHp = this.hp <= 1 && !this.dead;
    if (this.dead) {
      this.deadT += dt;
      I.mx = 0; I.jump = I.dash = I.attack = false;
      if (this.deadT > 3.2 && this.onRespawn && !this.respawning) { this.respawning = true; this.onRespawn(); }
      a.update(dt);
      return;
    }
    const locked = g.cinematic || (g.ui && g.ui.modal) || this.controlLock > 0;
    if (this.controlLock > 0) this.controlLock -= dt;
    const ax = Input.axis.x;
    if (!locked) {
      I.mx = Math.abs(ax) > 0.2 ? sign(ax) * Math.min(1, Math.abs(ax) * 1.3) : 0;
      I.jump = Input.pressed('jump');
      I.jumpHeld = !!Input.down.jump;
      I.dash = Input.pressed('dash');
      I.up = Input.axis.y < -0.5; I.down = Input.axis.y > 0.5;
    } else { I.mx = 0; I.jump = I.dash = false; I.jumpHeld = false; I.up = I.down = false; }
    // mouse aim
    const m = Input.mouse;
    if (m.moved) { this.lastMouse = g.time; m.moved = false; }
    this.mouseAim = Input.lastDevice === 'kb' && g.time - this.lastMouse < 6 && m.inside;
    const wp = g.screenToWorld(m.x, m.y);
    a.look_at = this.mouseAim ? wp : null;
    if (!locked) {
      this.updateBuild(dt, wp);
      this.updateCombat(dt, wp);
      this.updateHeal(dt);
      this.updateInteract();
      for (let i = 1; i <= 9; i++) if (Input.pressed('slot' + i)) this.select(i - 1);
      if (m.wheel) this.select((this.sv.sel + (m.wheel > 0 ? 1 : -1) + Math.max(1, this.sv.hotbar.length)) % Math.max(1, this.sv.hotbar.length));
      if (Input.pressed('build')) { this.buildMode = !this.buildMode; g.ui && g.ui.toast(this.buildMode ? 'Build mode: Strike to mine, E to place' : 'Build mode off'); }
    }
    a.update(dt);
    // surge: dashing through foes cuts them
    if (this.sv.abil.surge && a.c.dashT > 0) {
      for (const e of g.targets()) {
        if (e.surgeHit === g.tick || Math.abs(e.c.x - a.c.x) > 30 || Math.abs(e.cy - a.cy) > 50) continue;
        e.surgeHit = g.tick;
        if (!e._surgeLast || g.time - e._surgeLast > 0.4) { e._surgeLast = g.time; this.strike(e, a.c.x, a.cy, a.facing, 0, 0.7, 'surge'); }
      }
    }
    // stats
    const far = Math.abs(a.c.x / TILE) | 0;
    if (far > this.sv.stats.far) this.sv.stats.far = far;
  }
  select(i) {
    if (!this.sv.hotbar.length) return;
    this.sv.sel = clamp(i, 0, this.sv.hotbar.length - 1);
    Audio.play('blip', { pitch: 1 + i * 0.05 });
  }
  give(tile, n = 1) {
    const inv = this.sv.inv;
    inv[tile] = (inv[tile] || 0) + n;
    if (!this.sv.hotbar.includes(tile) && TILES[tile].place) {
      if (this.sv.hotbar.length < 9) this.sv.hotbar.push(tile);
    }
    if (this.game.ui) this.game.ui.hotbarDirty = true;
  }
  take(tile, n = 1) {
    const inv = this.sv.inv;
    if ((inv[tile] || 0) < n) return false;
    inv[tile] -= n;
    if (inv[tile] <= 0) {
      delete inv[tile];
      const i = this.sv.hotbar.indexOf(tile);
      if (i >= 0) { this.sv.hotbar.splice(i, 1); this.sv.sel = clamp(this.sv.sel, 0, Math.max(0, this.sv.hotbar.length - 1)); }
    }
    if (this.game.ui) this.game.ui.hotbarDirty = true;
    return true;
  }

  // ------------------------------------------------------------ building
  updateBuild(dt, wp) {
    const g = this.game, a = this.actor, W = g.world;
    const cx = a.c.x, cy = a.c.y - 46;
    let target = null;
    // an enemy close by: clicks strike instead of digging
    this.foeNear = false;
    for (const e of g.targets()) if (e.mode !== 'dead' && e.kind !== 'dummy' && e.kind !== 'nest' && !e.removed && Math.abs(e.c.x - cx) < 110 && Math.abs(e.c.y - a.c.y) < 90) { this.foeNear = true; break; }
    if (this.mouseAim && !this.buildMode) {
      const tx = Math.floor(wp.x / TILE), ty = Math.floor(wp.y / TILE);
      const d = Math.hypot(tx * TILE + 16 - cx, ty * TILE + 16 - cy);
      target = { tx, ty, far: d > REACH, px: wp.x, py: wp.y };
    } else if (this.buildMode || g.touchBuild) {
      if (g.touchBuild && g.touchBuild.tx !== undefined) { const tb = g.touchBuild; target = { tx: tb.tx, ty: tb.ty, far: Math.hypot(tb.tx * TILE + 16 - cx, tb.ty * TILE + 16 - cy) > REACH }; }
      else {
        const f = a.facing;
        let tx = Math.floor((cx + f * 30) / TILE), ty = Math.floor((a.c.y - 20) / TILE);
        if (a.intent.up) ty -= 2; else if (a.intent.down) { ty += 1; tx = Math.floor(cx / TILE) + (W.solid(Math.floor(cx / TILE), ty) ? 0 : f); }
        else if (!W.solid(tx, ty) && W.solid(tx, ty - 1)) ty -= 1;
        target = { tx, ty };
      }
    }
    if (target) {
      const t = W.get(target.tx, target.ty);
      // line of sight: can't dig through a wall to reach a tile behind it
      // reach only faces you can see: the tile must touch open space, and nothing solid may stand
      // between you and it (a neighbour of the target catching the ray is fine)
      const hit = W.raycast(cx, cy, target.tx * TILE + 16, target.ty * TILE + 16);
      const sol = (x, y) => TILES[W.get(x, y)].solid;
      const exposed = !sol(target.tx + 1, target.ty) || !sol(target.tx - 1, target.ty) || !sol(target.tx, target.ty + 1) || !sol(target.tx, target.ty - 1);
      let blocked = (hit && Math.max(Math.abs(hit.tx - target.tx), Math.abs(hit.ty - target.ty)) > 1) || (TILES[t].solid && !exposed);
      target.solid = TILES[t].solid || (t !== T.AIR);
      target.tile = t;
      target.blocked = blocked;
      if (target.far) blocked = true;
      target.blocked = blocked;
      target.canMine = t !== T.AIR && TILES[t].hard < 100 && !blocked;
      const sel = this.sv.hotbar[this.sv.sel];
      const have = sel !== undefined && (this.sv.inv[sel] || 0) > 0;
      // placing onto a solid block puts the new block on the face nearest the pointer
      target.ptx = target.tx; target.pty = target.ty;
      if (t !== T.AIR && have && target.px !== undefined) {
        const lx = target.px / TILE - target.tx - 0.5, ly = target.py / TILE - target.ty - 0.5;
        const [dx, dy] = Math.abs(lx) > Math.abs(ly) ? [Math.sign(lx), 0] : [0, Math.sign(ly) || -1];
        if (W.get(target.tx + dx, target.ty + dy) === T.AIR) { target.ptx = target.tx + dx; target.pty = target.ty + dy; }
      }
      const pt = W.get(target.ptx, target.pty);
      const pdist = Math.hypot(target.ptx * TILE + 16 - cx, target.pty * TILE + 16 - cy);
      const ok = have && pt === T.AIR && pdist <= REACH && this.placeOk(target.ptx, target.pty, sel);
      target.canPlace = ok && !(target.ptx === target.tx && target.pty === target.ty && blocked);
      target.why = !have ? (this.sv.hotbar.length ? 'none left' : 'mine a block first') : pdist > REACH || target.far ? 'too far' : pt !== T.AIR ? '' : !ok ? (TILES[sel].solid && this.bodyIn(target.ptx, target.pty) ? 'someone is standing there' : 'needs a block beside it') : '';
    }
    this.cursor = target;
    // mine: hold left mouse (or Strike in build mode)
    const mineHeld = (this.mouseAim && Input.mouse.l && !this.buildMode && !this.foeNear) || ((this.buildMode || g.touchBuild) && (Input.down.attack || (g.touchBuild && g.touchBuild.mode === 'mine' && g.touchBuild.pid !== null)));
    if (target && target.canMine && mineHeld && this.sv.hasBlade !== false) {
      if (!this.mine || this.mine.tx !== target.tx || this.mine.ty !== target.ty) this.mine = { tx: target.tx, ty: target.ty, t: 0, tile: target.tile };
      const hard = TILES[this.mine.tile].hard * (this.sv.hasBlade ? 1 : 2.2) / (1 + this.sv.lvl.blade * 0.25);
      this.mine.t += dt / Math.max(0.05, hard);
      a.face(sign(target.tx * TILE + 16 - a.c.x) || a.facing);
      if (!a.attack) { a.startAttack(Math.random() < 0.5 ? 'side' : 'side2', 0.26); Audio.play('swing', { vol: 0.35, pitch: 1.3 }); }
      if ((g.tick % 18) === 0) { Audio.play('mine', { pitch: rand(0.8, 1.2) }); g.fx.debris(target.tx * TILE + 16, target.ty * TILE + 16, this.mine.tile, 2); }
      if (this.mine.t >= 1) this.breakTile(target.tx, target.ty);
      this.consumeAttack = true;
    } else this.mine = null;
    // place: right mouse (hold and drag to lay a line), E in build mode, or a touch drag in build mode
    const tb = g.touchBuild;
    const placeHeld = (this.mouseAim && Input.mouse.r && !this.buildMode) || (tb && tb.mode === 'place' && tb.pid !== null);
    const placeP = (this.mouseAim && Input.mouse.rp && !this.buildMode) || (this.buildMode && Input.pressed('interact')) || (tb && tb.tap);
    if (tb) tb.tap = false;
    this.placeCD = Math.max(0, (this.placeCD || 0) - dt);
    if (target && (placeP || (placeHeld && this.placeCD <= 0))) {
      const key = target.ptx + ',' + target.pty;
      if (target.canPlace && (placeP || key !== this.lastPlaced)) {
        this.placeTile(target.ptx, target.pty, this.sv.hotbar[this.sv.sel], Input.keys.has('ShiftLeft') && this.mouseAim ? 1 : 0);
        this.lastPlaced = key; this.placeCD = 0.07;
      } else if (placeP && target.why) { g.ui && g.ui.toast(target.why === 'mine a block first' ? 'Mine a block first: hold Click on one' : 'Can\'t place: ' + target.why); Audio.play('blip', { pitch: 0.6, vol: 0.5 }); }
    }
    if (!placeHeld) this.lastPlaced = null;
  }
  bodyIn(tx, ty) {
    const x0 = tx * TILE, y0 = ty * TILE;
    const hit = (c) => c.x + c.w / 2 > x0 && c.x - c.w / 2 < x0 + TILE && c.y > y0 && c.y - c.h < y0 + TILE;
    if (hit(this.actor.c)) return true;
    for (const e of this.game.actors) if (e.mode !== 'dead' && hit(e.c)) return true;
    return false;
  }
  placeOk(tx, ty, tile) {
    const g = this.game, W = g.world;
    if (!TILES[tile].place) return false;
    // needs something to attach to
    const near = W.get(tx + 1, ty) || W.get(tx - 1, ty) || W.get(tx, ty + 1) || W.get(tx, ty - 1) || W.wall(tx, ty);
    if (!near) return false;
    if (!TILES[tile].solid) return true;
    // don't build inside a body
    const x0 = tx * TILE, y0 = ty * TILE;
    const hit = (c) => c.x + c.w / 2 > x0 && c.x - c.w / 2 < x0 + TILE && c.y > y0 && c.y - c.h < y0 + TILE;
    if (hit(this.actor.c)) return false;
    for (const e of g.actors) if (e.mode !== 'dead' && hit(e.c)) return false;
    return true;
  }
  breakTile(tx, ty) {
    const g = this.game, W = g.world;
    const t = W.get(tx, ty);
    W.set(tx, ty, T.AIR);
    if (g.net) g.net.sendEdit(tx, ty, T.AIR, 0);
    this.mine = null;
    const drop = TILES[t].drop === -1 ? null : TILES[t].drop ?? t;
    if (drop !== null && TILES[drop]) {
      this.give(drop, 1);
      g.fx.souls(tx * TILE + 16, ty * TILE + 16, 1, this.actor.c, TILES[drop].k && TILES[drop].k[0] === '#' ? TILES[drop].k : '#d8cfc0');
      if (g.ui) g.ui.pickup(drop, 1);
    }
    // a cut trunk fells the whole tree: every trunk block (and a mushroom cap) comes down with it
    const tr = t === T.LOG && W.treeAt(tx);
    if (tr && ty < tr.base && ty >= tr.base - 5) {
      let n = 0;
      for (let y = tr.base - 1; y >= tr.base - tr.h; y--) {
        const u = W.get(tx, y);
        if (u === T.LOG || u === T.CAP) { W.set(tx, y, T.AIR); if (g.net) g.net.sendEdit(tx, y, T.AIR, 0); n++; }
      }
      this.give(T.LOG, 2 + n);
      if (g.ui) g.ui.pickup(T.LOG, 2 + n);
      for (let k = 0; k < 4; k++) g.fx.debris(tx * TILE + 16 + rand(-40, 40), (tr.base - tr.h) * TILE + rand(0, 80), T.LEAVES, 6);
      Audio.play('break', { pitch: 0.6 }); g.shake(0.18);
    }
    g.fx.debris(tx * TILE + 16, ty * TILE + 16, t, 7);
    g.fx.dust(tx * TILE + 16, ty * TILE + 16, 4, '#cfc6b8', -Math.PI / 2, 60);
    Audio.play('break', { pitch: t === T.CRYSTAL || t === T.GLASS || t === T.ICE ? 1.8 : rand(0.85, 1.1) });
    if (t === T.CRYSTAL) Audio.play('shard');
    g.shake(0.06);
    this.sv.stats.blocks++;
    if (g.onTileBroken) g.onTileBroken(tx, ty, t);
  }
  placeTile(tx, ty, tile, layer) {
    const g = this.game;
    if (!this.take(tile, 1)) return;
    g.world.set(tx, ty, tile, layer);
    if (g.net) g.net.sendEdit(tx, ty, tile, layer);
    Audio.play('place', { pitch: rand(0.9, 1.1) });
    g.fx.dust(tx * TILE + 16, ty * TILE + 30, 3, '#e0d8c8', -Math.PI / 2, 40);
    this.sv.stats.placed++;
    if (g.onTilePlaced) g.onTilePlaced(tx, ty, tile);
  }

  // ------------------------------------------------------------ combat
  updateCombat(dt, wp) {
    const g = this.game, a = this.actor;
    const wantAttack = Input.pressed('attack') || (this.mouseAim && Input.mouse.lp && !(this.cursor && this.cursor.canMine && !this.buildMode && !this.foeNear));
    if (this.consumeAttack) { this.consumeAttack = false; if (!Input.pressed('attack')) return this.activeHits(dt); }
    if (wantAttack && this.sv.hasBlade && !this.buildMode && a.mode === 'ctrl' && a.attackCD <= 0) {
      let kind;
      const air = !a.c.ground;
      if (this.mouseAim && Input.mouse.lp) {
        const dx = wp.x - a.c.x, dy = wp.y - (a.c.y - 50);
        const ang = Math.atan2(dy, Math.abs(dx));
        if (Math.abs(dx) > 8) a.face(sign(dx));
        kind = ang < -0.9 ? 'up' : ang > 0.9 && air ? 'down' : null;
      } else kind = a.intent.up ? 'up' : a.intent.down && air ? 'down' : null;
      if (!kind) { kind = a.combo % 2 ? 'side2' : 'side'; a.combo++; }
      if (kind === 'down' && this.sv.abil.plunge && Input.axis.y > 0.5) { this.plunge(); return; }
      a.startAttack(kind, 0.3);
      a.attackCD = 0.34;
      Audio.play('swing', { pitch: rand(0.9, 1.15) });
      this.slashPts = [];
    }
    this.activeHits(dt);
  }
  activeHits(dt) {
    const g = this.game, a = this.actor;
    const at = a.attack;
    if (!at) { a.prevBlade = null; return; }
    const seg = a.bladeSeg(1);
    const prev = a.prevBlade || seg;
    a.prevBlade = seg;
    const active = at.t > 0.16 && at.t < 0.66;
    if (!active) return;
    if (this.slashPts) this.slashPts.push([seg.x0, seg.y0, seg.x1, seg.y1]);
    if (this.slashPts && this.slashPts.length >= 2 && at.t > 0.5 && !at.slashed) {
      at.slashed = true;
      g.fx.slash(this.slashPts, a.look.blade.glow || '#9ff3ff');
    }
    const tipSpeed = Math.hypot(seg.x1 - prev.x1, seg.y1 - prev.y1) / dt;
    for (const e of g.targets()) {
      if (at.hits.has(e.id) || e.mode === 'dead') continue;
      if (Math.abs(e.c.x - a.c.x) > 260 * e.scale || Math.abs(e.cy - a.cy) > 260 * e.scale) continue;
      let hit = false, hx = 0, hy = 0;
      for (let k = 0; k <= 2 && !hit; k++) {
        const u = k / 2;
        const x0 = lerp(prev.x0, seg.x0, u), y0 = lerp(prev.y0, seg.y0, u), x1 = lerp(prev.x1, seg.x1, u), y1 = lerp(prev.y1, seg.y1, u);
        const b = e.body;
        if (b) for (let i = 0; i < 15; i++) {
          const r = b.r[i] + 7;
          if (segPointDist2(x0, y0, x1, y1, b.x[i], b.y[i]) < r * r) { hit = true; hx = b.x[i]; hy = b.y[i]; break; }
        }
        if (!hit && e.hitR) {
          const r = e.hitR + 6;
          if (segPointDist2(x0, y0, x1, y1, e.cx, e.cy) < r * r) { hit = true; hx = e.cx; hy = e.cy; }
        }
      }
      if (!hit) continue;
      at.hits.add(e.id);
      const dirx = at.kind === 'up' ? 0 : at.kind === 'down' ? 0 : a.facing;
      const diry = at.kind === 'up' ? -1 : at.kind === 'down' ? 1 : -0.25;
      this.strike(e, hx, hy, dirx, diry, clamp(0.75 + tipSpeed / 3000, 0.75, 1.35), at.kind);
    }
  }
  strike(e, hx, hy, dirx, diry, mult, kind) {
    const g = this.game, a = this.actor;
    const dmg = Math.round((10 + this.sv.lvl.blade * 4) * mult);
    const res = e.hurt ? e.hurt(dmg, { x: hx, y: hy, dx: dirx, dy: diry, from: this, kind }) : null;
    const armored = res === 'armor';
    // feedback
    g.hitstop(armored ? 0.04 : 0.06);
    g.shake(armored ? 0.12 : 0.18);
    Audio.play(armored ? 'clang' : 'hit', { pitch: rand(0.9, 1.1) });
    g.fx.sparks(hx, hy, Math.atan2(diry, dirx || 0.0001), armored ? 14 : 9, armored ? '#ffe3a0' : '#ffffff');
    g.fx.ring(hx, hy, 4, 26, 0.18, '#ffffff', 3);
    g.fx.flash('fx/spark', hx, hy, armored ? 70 : 90, Math.random() * 0.6, 0.2);
    g.pulse(0.5);
    // recoil and pogo
    if (kind === 'down') { a.c.vy = -680; a.bounced = true; a.c.jumps = 0; a.c.airDash = 1; }
    else if (kind !== 'surge') a.c.vx -= a.facing * (armored ? 260 : 140);
    this.sv.breath = Math.min(100, (this.sv.breath || 0) + (armored ? 6 : 11));
  }
  plunge() {
    const a = this.actor;
    this.plunging = true;
    a.c.vy = 1500; a.c.vx = 0;
    a.startAttack('slam', 0.5);
    Audio.play('dash', { pitch: 0.7 });
  }
  plungeImpact() {
    const g = this.game, a = this.actor;
    this.plunging = false;
    Audio.play('slam');
    g.shake(0.45); g.hitstop(0.05); g.flash([1, 1, 1], 0.15);
    g.fx.ring(a.c.x, a.c.y - 6, 10, 150, 0.45, '#bff6ff', 6);
    g.fx.dust(a.c.x, a.c.y - 4, 14, '#e8e0d0', -Math.PI / 2, 260);
    for (const e of g.targets()) {
      const d = Math.hypot(e.c.x - a.c.x, e.cy - a.cy);
      if (d < 150) this.strike(e, e.cx, e.cy, sign(e.c.x - a.c.x), -0.8, 1.6, 'plunge');
    }
  }
  updateHeal(dt) {
    const a = this.actor;
    const want = Input.down.heal && this.hp < this.sv.maxHp && (this.sv.breath || 0) >= 33 && a.c.ground && a.mode === 'ctrl';
    if (want) {
      this.healT += dt;
      a.intent.mx = 0;
      if ((this.game.tick % 10) === 0) this.game.fx.spawn({ x: a.c.x + rand(-20, 20), y: a.c.y - rand(0, 70), vy: -60, life: 0.6, size: 2.5, col: '#ffffff', col1: '#9ff3ff', add: true });
      if (this.healT > 0.9 - this.sv.lvl.breath * 0.15) {
        this.healT = 0; this.sv.breath -= 33; this.hp++;
        Audio.play('heal'); this.game.fx.ring(a.c.x, a.c.y - 46, 6, 60, 0.5, '#9ff3ff', 4);
      }
    } else this.healT = 0;
  }
  updateInteract() {
    const g = this.game, a = this.actor;
    let best = null, bd = -1;
    for (const s of g.systems) if (s.interactables) for (const it of s.interactables()) {
      // anything in range qualifies; a higher priority wins (resting at a shrine you haven't rested at),
      // otherwise the later one does (a keeper beside the fire is talked to)
      const d = Math.hypot(it.x - a.c.x, it.y - (a.c.y - 30));
      const pr = it.pri || 0;
      if (d < (it.r || 90) && (!best || pr >= bd)) { bd = pr; best = it; }
    }
    this.interact = best;
    if (best && Input.pressed('interact') && !this.buildMode) { Input.consume('interact'); best.act(); }
  }

  // ------------------------------------------------------------ damage / death
  takeHit(n, fromX, fromY, o = {}) {
    const g = this.game, a = this.actor;
    if (this.dead || a.inv > 0 || g.cinematic) return false;
    this.hp -= n;
    a.inv = 1.0; a.flash = 1;
    const dir = sign(a.c.x - fromX) || -a.facing;
    a.c.vx = dir * (o.knock || 420); a.c.vy = -(o.lift || 380); a.c.dashT = 0;
    a.takeImpulse(fromX, fromY ?? a.cy, dir * 500, -260, 0.75);
    Audio.play('hurt');
    g.hitstop(0.12); g.shake(0.5); g.flash([1, 0.25, 0.2], 0.25); g.pulse(1.4);
    g.fx.burst(a.cx, a.cy, { n: 16, speed: 420, col: '#ffffff', col1: '#ff7a6a', add: true, life: 0.45, size: 2.6, kind: 'streak' });
    if (o.heavy) a.knockdown(0.45, dir * 300, -300);
    if (this.hp <= 0) this.die();
    return true;
  }
  die() {
    const g = this.game, a = this.actor;
    this.dead = true; this.deadT = 0;
    a.knockdown(999, (a.c.vx || 0) * 0.5, -300);
    this.sv.stats.deaths++;
    g.slowmo(0.25, 1.2);
    g.flash([1, 1, 1], 0.4);
    if (g.ui) g.ui.deathCard();
  }
  respawnAt(x, y) {
    const a = this.actor;
    this.dead = false; this.deadT = 0; this.respawning = false;
    this.hp = this.sv.maxHp;
    a.mode = 'ctrl'; a.c.x = x; a.c.y = y; a.c.vx = a.c.vy = 0; a.inv = 1.5;
    a.unstick();
    a.body.reset(x, a.c.y - a.pelvisH);
    if (a.cape) a.cape.init = false;
    a.strength = 1; a.daze = 0;
  }

  // ------------------------------------------------------------ draw
  draw(ctx, al) {
    const a = this.actor;
    a.draw(ctx, al, { alpha: a.inv > 0 && !this.dead && (this.game.tick >> 3) % 2 ? 0.55 : 1 });
  }
  // build cursor: a ghost of the chosen block where it will go, cracks on a block being mined, a soft red
  // frame (and a reason on click) when an action isn't possible, and the reach ring while building
  drawCursor(ctx) {
    const c = this.cursor, g = this.game;
    if (!c || this.dead || g.cinematic) return;
    if (!(this.mouseAim || this.buildMode || g.touchBuild)) return;
    const a = this.actor, ccx = a.c.x, ccy = a.c.y - 46;
    // far away the cursor stays quiet; just past reach it shows (dimmed) so you learn the range
    if (c.far && Math.hypot(c.tx * TILE + 16 - ccx, c.ty * TILE + 16 - ccy) > REACH + 2 * TILE) return;
    ctx.save();
    if (this.buildMode || g.touchBuild) {
      ctx.strokeStyle = rgba('#ffffff', 0.12); ctx.lineWidth = 1.5; ctx.setLineDash([3, 7]);
      ctx.beginPath(); ctx.arc(ccx, ccy, REACH, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    const x = c.tx * TILE, y = c.ty * TILE;
    const sel = this.sv.hotbar[this.sv.sel];
    const mining = c.tile !== T.AIR && c.tile !== undefined;
    if (c.canMine || mining) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = c.canMine ? rgba('#ffffff', this.foeNear && this.mouseAim ? 0.25 : 0.7) : rgba('#ff8f7a', 0.55);
      ctx.beginPath(); ctx.roundRect(x + 1, y + 1, TILE - 2, TILE - 2, 5); ctx.stroke();
    }
    // ghost block
    if (sel !== undefined && (c.ptx !== c.tx || c.pty !== c.ty || !mining) && (this.sv.inv[sel] || 0) > 0) {
      const px = c.ptx * TILE, py = c.pty * TILE;
      ctx.globalAlpha = c.canPlace ? 0.55 + Math.sin(g.time * 6) * 0.08 : 0.22;
      try { g.wr.drawTile(ctx, c.ptx, c.pty, sel, px, py); } catch (e) {}
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = c.canPlace ? rgba('#bff6ff', 0.75) : rgba('#ff8f7a', 0.6);
      ctx.setLineDash(c.canPlace ? [] : [4, 4]);
      ctx.beginPath(); ctx.roundRect(px + 1, py + 1, TILE - 2, TILE - 2, 5); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this.mine && this.mine.tx === c.tx && this.mine.ty === c.ty) {
      const p = clamp(this.mine.t, 0, 1);
      ctx.fillStyle = rgba('#000000', 0.25 * p); ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(20,16,22,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath();
      const cx = x + 16, cy = y + 16;
      const n = 3 + Math.floor(p * 5);
      for (let i = 0; i < n; i++) {
        const ang = i * 2.39996 + c.tx, len = 6 + p * 14;
        ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * len * 0.6, cy + Math.sin(ang) * len * 0.6);
        ctx.lineTo(cx + Math.cos(ang + 0.3) * len, cy + Math.sin(ang + 0.3) * len);
      }
      ctx.stroke();
      // progress arc
      ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, 20, -Math.PI / 2, -Math.PI / 2 + p * TAU); ctx.stroke();
    }
    ctx.restore();
  }
}
export { REACH, PHYS, TAU };
