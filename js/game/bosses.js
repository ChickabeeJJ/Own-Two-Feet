// Boss gates: every biome boundary is held by a warden. Three archetypes, each with a stronger variant:
// Warden (giant ragdoll: slam waves, charge, leap), Wraith (flying ragdoll: volleys, dives, summons),
// Golem (a heart wrapped in torn-up world blocks: throws, pound, spin). Tier scales health and adds moves.
import { Audio } from '../core/audio.js';
import { Actor } from './actor.js';
import { P } from '../physics/body.js';
import { TILE, T, TILES, biomeOf } from '../world/tiles.js';
import { Proj, hexRgb } from './enemies.js';
import { drawGlow } from '../world/light.js';
import { clamp, lerp, rand, sign, TAU, rgba, mix, shade } from '../core/util.js';
import { RELICS, Save } from './progress.js';
import { Platform } from '../platform.js';
import { drawGateBanner } from '../art/props.js';
import { drawSprite, img } from '../art/images.js';
import { gateReq } from './content.js';

const ORDINAL = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
const TYPES = {
  meadow: { arch: 'warden', name: 'The Hollow Warden', col: '#ffb36b', body: '#2b2731', head2: '#2b2731', shade: '#1b1820', head: 'horns', cape: '#4a4650' },
  ember: { arch: 'warden', name: 'The Pyre Knight', col: '#ff7a3a', body: '#2e1c1a', head2: '#6a2222', shade: '#24140f', head: 'crown', cape: '#a8341f' },
  glass: { arch: 'wraith', name: 'The Glass Widow', col: '#8ff7ff', body: '#1f4f52', head2: '#2f7f80', shade: '#132529', head: 'halo', cape: '#2b8a86' },
  frost: { arch: 'wraith', name: 'The Still Queen', col: '#dff6ff', body: '#9fb2c8', head2: '#e6edf5', shade: '#3c4960', head: 'crown', cape: '#e4ecf5' },
  hollow: { arch: 'golem', name: 'The Unmade Heart', col: '#c4b5ff', body: '#3b3458', shade: '#28223f' },
};

export class Bosses {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.arena = null;
    this.cool = 0;
  }
  worldMap() { const g = this.game; return g.net && g.net.visiting ? (g.net.worldBosses || (g.net.worldBosses = {})) : g.save.bosses; }
  defeated(k) { return !!this.worldMap()['g' + k]; }
  // apply an attack to every player it reaches (host player locally, friends over the network)
  hitAll(test, n, x, y, o) {
    const g = this.game;
    // melee blows (not waves or orbs) can be parried
    if (!g.player.dead && test(g.player.actor)) { if (!(o && o.melee && g.player.tryParry(null))) g.player.takeHit(n, x, y, o); }
    if (g.net && g.net.isHost) for (const r of g.net.remotes.values()) if (!r.dead && test(r.actor)) { g.net.hitRemote(r.actor, n, x, y, o); r.actor.takeImpulse(x, y, sign(r.actor.c.x - x) * 500, -300, 0.7); }
  }
  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    if (this.active && g.ui && g.ui.modal && !(g.net && g.net.remotes && g.net.remotes.size)) return;
    this.cool -= dt;
    if (!this.active) {
      if (p.dead || g.cinematic || this.cool > 0) return;
      const gi = g.gateInfo(p.x);
      if (this.defeated(gi.k) || (g.net && g.net.isGuest)) { this.sealSide = 0; return; }
      const need = gateReq(gi.tier), have = g.save.lights || 0;
      const dx = p.x - gi.gxw;
      if (have < need && !(g.net && g.net.visiting)) {
        // sealed: the threads hold the gate shut until you carry enough light
        if (!this.sealSide || Math.abs(dx) > gi.half + 6 * TILE) this.sealSide = sign(dx) || -1;
        const edge = gi.gxw + this.sealSide * (gi.half + 1.5 * TILE);
        const a = p.actor.c;
        if ((a.x - edge) * this.sealSide < 0) { a.x = edge; a.vx = 0; if (!this.sealWarn || g.time - this.sealWarn > 5) { this.sealWarn = g.time; g.story && g.story.say(`Sealed. It needs ${need} threads of light. We have ${have}.`, 3.2, true); g.ui && g.ui.toast(`Gate sealed · ${have}/${need} Threads of Light`); Audio.play('shard', { pitch: 0.5 }); } }
        this.sealed = { x: edge, gy: g.world.surface(gi.gx) * TILE, k: gi.k };
        return;
      }
      this.sealed = null; this.sealSide = 0;
      if (Math.abs(dx) < gi.half - 5 * TILE) this.begin(gi);
      return;
    }
    const B = this.active;
    B.update(dt);
    // arena walls
    const A = this.arena;
    const clampC = (c, w) => { if (c.x < A.x0 + w) { c.x = A.x0 + w; c.vx = Math.max(0, c.vx); } if (c.x > A.x1 - w) { c.x = A.x1 - w; c.vx = Math.min(0, c.vx); } };
    if (!p.dead) clampC(p.actor.c, 14);
    for (const a of B.actors()) if (a.c && a.mode !== 'dead') clampC(a.c, (a.c.w || 30) / 2 + 4);
    if (p.dead && !B.over) this.abort();
    if (g.ui) g.ui.bossBar(B.over ? null : B);
  }
  begin(gi) {
    const g = this.game;
    const guard = biomeOf(gi.guard);
    const spec = TYPES[guard.id];
    const tier = gi.tier;
    const gy = g.world.surface(gi.gx) * TILE;
    this.arena = { x0: gi.gxw - gi.half, x1: gi.gxw + gi.half, k: gi.k, gy };
    const side = sign(gi.gxw - g.player.x) || 1;
    const bx = gi.gxw + side * gi.half * 0.35;
    const ctor = spec.arch === 'warden' ? Warden : spec.arch === 'wraith' ? Wraith : Golem;
    const B = this.active = new ctor(g, this, spec, tier, bx, gy);
    B.title = `${ORDINAL[Math.min(gi.tier, 9)]} Gate` + (tier >= 5 ? ` · Tier ${Math.floor(tier / 5) + 1}` : '');
    if (g.enemies) for (const e of g.enemies.list) e.removed = true;
    const seen = g.save.bossSeen['g' + gi.k];
    g.save.bossSeen['g' + gi.k] = 1;
    if (seen) g.story.bossQuick(B); else g.story.bossIntro(B);
    if (g.net) g.net.announce(B.name, B.title, 'boss', 2.8, { lb: false, snd: 'roar', shake: 0.6 });
    Audio.setScene(guard.id, true);
  }
  abort() {
    const g = this.game;
    if (!this.active) return;
    for (const a of this.active.actors()) a.removed = true;
    this.active = null; this.arena = null; this.cool = 4;
    if (g.ui) g.ui.bossBar(null);
    Audio.setScene(g.biomeAt(g.player.x).id, false);
    g.cam.zoomT = 1;
  }
  victory(B) {
    const g = this.game, sv = g.save;
    B.over = true;
    const k = this.arena.k;
    const n = Object.keys(sv.bosses).length + (sv.coopRelics || 0);
    if (g.net && g.net.visiting) { this.worldMap()['g' + k] = true; sv.coopRelics = (sv.coopRelics || 0) + 1; }
    else sv.bosses['g' + k] = true;
    if (g.net) g.net.bossDown(B);
    let relic = n < 4 ? RELICS[n] : RELICS[4];
    if (relic.id === 'djump') relic = RELICS[4];   // the double jump is yours from the start: a vessel instead
    g.levels && g.levels.gain(400 + n * 250, g.player.actor.c.x, g.player.actor.c.y - 110, 'Warden');
    if (relic.id === 'vessel') { sv.maxHp++; g.player.hp = sv.maxHp; }
    else { sv.abil[relic.id] = true; if (relic.id === 'djump' || relic.id === 'wall') g.player.actor.abil[relic.id] = true; }
    const got = Save.unlockSrc('boss' + Math.min(n, 3));
    sv.marks.push(B.spec.col);
    g.player.refreshLook();
    g.slowmo(0.12, 1.6); g.flash([1, 1, 1], 0.7); g.shake(1); g.hitstop(0.15);
    Audio.play('boom');
    Platform.happytime();
    const c = B.center();
    g.fx.ring(c.x, c.y, 10, 420, 1.2, '#ffffff', 10);
    const souls = 60 + B.tier * 40;
    g.fx.souls(c.x, c.y, 40, g.player.actor.c, B.spec.col, () => { sv.glimmer += Math.round(souls / 40); Audio.play('soul', { pitch: rand(1, 1.4), gap: 0.015 }); if (g.ui) g.ui.glimmerBump(); });
    g.story.bossVictory(B, relic, got);
    setTimeoutGame(g, 3.5, () => {
      for (const a of B.actors()) a.removed = true;
      this.active = null; this.arena = null;
      Audio.setScene(g.biomeAt(g.player.x).id, false);
      g.cam.zoomT = 1;
      g.saveNow();
    });
  }
  actorsList() { return this.active ? this.active.actors() : []; }
  lights(arr) { if (this.active && this.active.lights) this.active.lights(arr); }
  draw(ctx, a, layer) {
    if (layer === 'back') {
      // banners of the warden that holds the nearest gate
      const g = this.game;
      const gi = g.gateInfo(g.cam.x);
      if (Math.abs(gi.gxw - g.cam.x) < 2200) {
        const spec = TYPES[biomeOf(gi.guard).id];
        const gy = g.world.surface(gi.gx) * TILE;
        const down = this.defeated(gi.k);
        ctx.save(); if (down) ctx.globalAlpha = 0.45;
        for (const sd of [-1, 1]) if (!drawSprite(ctx, 'props/banner', gi.gxw + sd * (gi.half - 40), gy - 6, 160, { grade: g.biomeAt(gi.gxw) })) drawGateBanner(ctx, gi.gxw + sd * (gi.half - 40), gy + 1, 1, down ? '#6a6470' : spec.col, g.time + sd);
        ctx.restore();
      }
    }
    if (layer === 'front' && this.sealed && !this.active) {
      const g = this.game, S = this.sealed;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const xx = S.x + Math.sin(g.time * 1.5 + i) * 6;
        ctx.strokeStyle = rgba('#9ff3ff', 0.25 + 0.15 * Math.sin(g.time * 3 + i)); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(xx - 10 + i * 2.5, S.gy); ctx.bezierCurveTo(xx + 14, S.gy - 120, xx - 14, S.gy - 220, xx - 6 + i * 1.5, S.gy - 320); ctx.stroke();
      }
      drawGlow(ctx, S.x, S.gy - 140, 120, [0.6, 0.95, 1], 0.25);
      ctx.restore();
    }
    if (!this.arena || !this.active || this.active.over) return;
    if (layer === 'back' && this.active.drawBack) this.active.drawBack(ctx, a);
    if (layer !== 'front') return;
    const g = this.game, A = this.arena;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const x of [A.x0, A.x1]) {
      const grd = ctx.createLinearGradient(x - 26, 0, x + 26, 0);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, rgba(this.active.spec.col, 0.35 + Math.sin(g.time * 3) * 0.08)); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.fillRect(x - 26, A.gy - 520, 52, 520);
      if ((g.tick % 6) === 0) g.fx.spawn({ x: x + rand(-10, 10), y: A.gy - rand(0, 300), vy: -rand(40, 120), life: 1.2, size: 2.2, col: '#ffffff', col1: this.active.spec.col, add: true });
    }
    ctx.restore();
    if (this.active.drawFront) this.active.drawFront(ctx, a);
  }
}

// game-time timer helper (respects slow-mo and pause)
export function setTimeoutGame(g, t, fn) {
  const h = { t, fn };
  const hook = (dt) => { h.t -= dt; if (h.t <= 0) { g.onTickHooks.splice(g.onTickHooks.indexOf(hook), 1); fn(); } };
  g.onTickHooks.push(hook);
}

function drawPetal(ctx, x, y, ang, hot, t, spec) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2);
  const gr = ctx.createLinearGradient(0, -30, 0, 26);
  gr.addColorStop(0, hot ? '#e6dcff' : '#b8a2f0'); gr.addColorStop(0.5, '#8a6ad8'); gr.addColorStop(1, '#4a3480');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(0, 22); ctx.bezierCurveTo(-22, 6, -18, -26, 0, -32); ctx.bezierCurveTo(18, -26, 22, 6, 0, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 18); ctx.quadraticCurveTo(-3, -6, 0, -28); ctx.stroke();
  ctx.restore();
}
// ---------------------------------------------------------------- base
class BossBase {
  constructor(g, mgr, spec, tier) {
    this.game = g; this.mgr = mgr; this.spec = spec; this.tier = tier;
    this.name = spec.name + (tier >= 5 ? ' Reborn' : '');
    this.state = 'intro'; this.t = 0; this.over = false; this.phase = 1;
    this.pattern = 0;
  }
  get hpK() { return clamp(this.hp / this.maxHp, 0, 1); }
  checkPhase() {
    if (this.phase === 1 && this.hpK < 0.5) {
      this.phase = 2;
      const g = this.game;
      Audio.play('roar'); g.shake(0.6); g.flash(hexRgb(this.spec.col), 0.25);
      this.onPhase2 && this.onPhase2();
    }
  }
  damageScale() { return this.game.net && this.game.net.peers ? 1 + 0.6 * Math.max(0, this.game.net.peers - 1) : 1; }
  onHurt(dmg) {
    this.hp -= dmg / this.damageScale();
    this.checkPhase();
    if (this.hp <= 0 && !this.over) this.die();
  }
  die() {
    this.mgr.victory(this);
  }
}

// ---------------------------------------------------------------- Warden: giant ragdoll
class Warden extends BossBase {
  constructor(g, mgr, spec, tier, x, gy) {
    super(g, mgr, spec, tier);
    this.maxHp = this.hp = Math.round(280 * (1 + tier * 0.65));
    const a = this.a = new Actor(g, {
      x, y: gy, team: 'enemy', scale: 2.25, heavy: 2.4, hp: this.hp, run: 150 + tier * 12, facing: -1, blade: true,
      look: { grit: 'warden', gritA: 0.7, plateCol: '#4a444a', body: spec.head2 || spec.body, limb: spec.body, coat: spec.body, mat: 'cloth', eyes: spec.col, eyeStyle: 'slit', head: spec.head, hornCol: '#2a2430', accent: '#d9a441', belt: false,
        cloakLong: spec.cape, cloakToGround: true, trim: '#c9a45c', gaunt: true, gloves: spec.body, bulk: 1.05,
        cape: { col: shade(spec.cape, -0.15), style: 'cape', len: 12, wide: 13, trim: '#c9a45c' }, blade: { col: '#dcd6cc', glow: spec.col, len: 42, w: 3.8 }, marks: [], rim: spec.col },
    });
    a.isBoss = true; a.noCrumple = true;
    a.mode = 'script'; a.scriptPose = { mode: 'cocoon', strength: 0.5 };
    a.hurt = (dmg, info) => this.hurt(dmg, info);
    g.actors.push(a);
    this.fire = spec.name.includes('Pyre');
  }
  actors() { return [this.a]; }
  center() { return { x: this.a.c.x, y: this.a.cy }; }
  wake() { const a = this.a; a.mode = 'getup'; a.getupT = 0.2; a.scriptPose = null; this.state = 'rise'; this.t = 1.0; }
  hurt(dmg, info) {
    const g = this.game, a = this.a;
    if (this.state === 'intro' || this.state === 'rise' || this.over) return 'armor';
    a.flash = 1;
    const stunned = this.state === 'stunned';
    a.takeImpulse(info.x, info.y, info.dx * 260, (info.dy || -0.2) * 160, stunned ? 0.5 : 0.15);
    this.onHurt(stunned ? dmg * 1.4 : dmg);
    return stunned ? null : (dmg < 12 ? 'armor' : null);
  }
  die() {
    const a = this.a;
    a.mode = 'dead'; a.deadT = -2.5;
    a.body.impulseAll(this.game.player.actor.facing * 300, -500);
    super.die();
  }
  update(dt) {
    const g = this.game, a = this.a, I = a.intent;
    const p = g.player.dead ? null : g.player.actor;
    this.t -= dt;
    I.jump = false; I.mx = 0;
    a.telegraph = 0;
    if (this.over || !p) return;
    const dx = p.c.x - a.c.x, dir = sign(dx);
    const fast = this.phase === 2 ? 0.78 : 1;
    a.look_at = { x: p.c.x, y: p.c.y - 60 };
    switch (this.state) {
      case 'intro': break;
      case 'rise': if (this.t <= 0 && a.mode === 'ctrl') { this.state = 'walk'; this.t = 1.2; } break;
      case 'walk': {
        I.mx = dir * 0.8;
        if (Math.abs(dx) < 170 && this.t <= 0) this.choose(dx);
        else if (this.t <= -1.6) this.choose(dx);
        break;
      }
      case 'slamW': {
        a.telegraph = 1 - this.t / (0.75 * fast);
        if (this.t <= 0) { this.state = 'slam'; this.t = 0.6; a.startAttack('slam', 0.55); Audio.play('swing', { pitch: 0.45 }); this.slammed = false; }
        break;
      }
      case 'slam': {
        if (!this.slammed && a.attack && a.attack.t > 0.5) {
          this.slammed = true;
          const fx = a.c.x + a.facing * 90;
          Audio.play('slam'); g.shake(0.6); g.flash([1, 0.9, 0.8], 0.12);
          g.fx.ring(fx, a.c.y - 4, 10, 200, 0.5, this.spec.col, 7); g.fx.dust(fx, a.c.y - 6, 16, '#e8dccb', -Math.PI / 2, 300);
          const waves = this.phase === 2 || this.tier >= 1 ? 2 : 1;
          for (let w = 0; w < waves; w++) for (const d of [-1, 1]) g.projectiles.push(new Proj(g, { kind: 'wave', x: fx + d * w * 40, y: a.c.y, vx: d * (420 + w * 120), life: 2.4, col: this.spec.col }));
          this.mgr.hitAll(q => Math.abs(q.c.x - fx) < 110 && q.c.y > a.c.y - 120, 1, fx, a.c.y - 40, { knock: 600, lift: 520, heavy: this.tier >= 2 });
          if (this.fire) this.emberRain(5 + this.tier);
        }
        if (this.t <= 0) { this.state = 'walk'; this.t = 0.8 * fast; }
        break;
      }
      case 'chargeW': {
        a.telegraph = 0.6;
        I.mx = 0;
        if (this.t <= 0) { this.state = 'charge'; this.t = 1.6; this.cdir = dir; Audio.play('roar', { pitch: 1.4, vol: 0.6 }); }
        break;
      }
      case 'charge': {
        a.c.vx = this.cdir * (720 + this.tier * 40);
        I.mx = this.cdir; a.face(this.cdir);
        if ((g.tick % 4) === 0) g.fx.dust(a.c.x - this.cdir * 30, a.c.y - 4, 2, '#e8dccb', -Math.PI / 2 - this.cdir * 0.8, 160);
        this.mgr.hitAll(q => Math.abs(q.c.x - a.c.x) < 50 && Math.abs(q.c.y - a.c.y) < 140, 1, a.c.x, a.cy, { knock: 720, lift: 420, heavy: true, melee: true });
        const A = this.mgr.arena;
        const atWall = (this.cdir > 0 && a.c.x > A.x1 - 70) || (this.cdir < 0 && a.c.x < A.x0 + 70);
        if (atWall || this.t <= 0) {
          // slams into the gate wall: staggers, the body takes the blow physically
          Audio.play('slam'); g.shake(0.7);
          a.takeImpulse(a.c.x + this.cdir * 40, a.cy - 40, -this.cdir * 900, -400, 1);
          a.c.vx = -this.cdir * 200;
          this.state = 'stunned'; this.t = 1.5 * (this.phase === 2 ? 0.8 : 1);
          g.fx.ring(a.c.x + this.cdir * 40, a.cy, 10, 160, 0.5, '#ffffff', 6);
          for (let i = 0; i < 4 + this.tier; i++) setTimeoutGame(g, 0.2 + i * 0.12, () => g.projectiles.push(new Proj(g, { kind: 'block', x: a.c.x + rand(-200, 200), y: A.gy - 620, vx: 0, vy: 200, grav: 1400, r: 12, life: 4, tile: T.RUIN, colB: '#a39d93' })));
        }
        break;
      }
      case 'stunned': {
        a.daze = Math.max(a.daze, 0.8);
        if (this.t <= 0) { this.state = 'walk'; this.t = 0.6; }
        break;
      }
      case 'leapW': {
        a.telegraph = 1 - this.t / 0.45;
        if (this.t <= 0) {
          this.state = 'leap'; this.t = 2;
          const tx = p.c.x, T_ = 0.95;
          a.c.vy = -1180; a.c.vx = (tx - a.c.x) / T_; a.c.ground = false; a.bounced = true;
          a.noCrumple = true; this.leapX = tx;
          Audio.play('jump', { pitch: 0.4, vol: 1 });
        }
        break;
      }
      case 'leap': {
        if ((g.tick % 2) === 0) g.fx.spawn({ x: this.leapX + rand(-60, 60), y: this.mgr.arena.gy - 2, vy: -30, life: 0.3, size: 3, col: this.spec.col, add: true });
        if (a.c.ground && this.t < 1.9) {
          Audio.play('boom'); g.shake(0.9); g.hitstop(0.06);
          g.fx.ring(a.c.x, a.c.y - 6, 10, 260, 0.6, this.spec.col, 9); g.fx.dust(a.c.x, a.c.y - 4, 22, '#e8dccb', -Math.PI / 2, 360);
          for (const d of [-1, 1]) g.projectiles.push(new Proj(g, { kind: 'wave', x: a.c.x, y: a.c.y, vx: d * 520, life: 2.2, col: this.spec.col }));
          this.mgr.hitAll(q => Math.abs(q.c.x - a.c.x) < 140 && q.c.y > a.c.y - 160, 1, a.c.x, a.c.y - 30, { knock: 700, lift: 600, heavy: true });
          if (this.fire) this.emberRain(6 + this.tier);
          this.state = 'walk'; this.t = 0.9 * fast; a.c.vx = 0;
        }
        break;
      }
    }
  }
  choose(dx) {
    const fast = this.phase === 2 ? 0.78 : 1;
    const opts = Math.abs(dx) < 220 ? ['slam', 'slam', 'leap', 'charge'] : ['charge', 'leap', 'slam'];
    let pick = opts[(this.pattern++ * 7 + (Math.random() * 3 | 0)) % opts.length];
    if (this.tier === 0 && this.phase === 1 && pick === 'leap' && Math.random() < 0.5) pick = 'slam';
    const a = this.a;
    a.face(sign(dx));
    if (pick === 'slam') { this.state = 'slamW'; this.t = 0.75 * fast; Audio.play('shard', { pitch: 0.4 }); }
    if (pick === 'charge') { this.state = 'chargeW'; this.t = 0.6 * fast; Audio.play('roar', { pitch: 1.2, vol: 0.5 }); }
    if (pick === 'leap') { this.state = 'leapW'; this.t = 0.45 * fast; }
  }
  emberRain(n) {
    const g = this.game, A = this.mgr.arena;
    for (let i = 0; i < n; i++) {
      const x = rand(A.x0 + 60, A.x1 - 60);
      setTimeoutGame(g, 0.3 + i * 0.15, () => g.projectiles.push(new Proj(g, { x, y: A.gy - 640, vx: rand(-30, 30), vy: 120, grav: 900, r: 7, col: '#ff8a3a', life: 4 })));
    }
  }
  lights(arr) { const a = this.a; arr.push({ x: a.body.x[P.HEAD], y: a.body.y[P.HEAD], c: hexRgb(this.spec.col), s: 0.6 }); }
}

// ---------------------------------------------------------------- Wraith: flying ragdoll
class Wraith extends BossBase {
  constructor(g, mgr, spec, tier, x, gy) {
    super(g, mgr, spec, tier);
    this.maxHp = this.hp = Math.round(240 * (1 + tier * 0.65));
    const a = this.a = new Actor(g, {
      x, y: gy - 60, team: 'enemy', scale: 1.9, heavy: 1.2, hp: this.hp, facing: -1, blade: false,
      look: { grit: 'husk', gritA: 0.45, body: spec.head2 || spec.body, limb: spec.body, coat: spec.cape, mat: 'glow', eyes: spec.col, eyeStyle: 'dots', head: spec.head, accent: spec.name.includes('Still') ? '#e8eef5' : '#bff6ff', belt: false,
        robe: spec.cape, trim: shade(spec.cape, 0.35), claws: spec.col, arms: 1.05,
        cape: { col: shade(spec.cape, -0.1), style: 'cape', len: 13, wide: 14 }, blade: null, marks: [], rim: spec.col },
    });
    a.isBoss = true; a.noCrumple = true;
    a.mode = 'script'; a.scriptPose = { mode: 'cocoon', strength: 0.5 };
    a.hurt = (dmg, info) => this.hurt(dmg, info);
    g.actors.push(a);
    this.frost = spec.name.includes('Still');
    this.home = { x, y: gy - 260 };
  }
  actors() { return [this.a]; }
  center() { return { x: this.a.c.x, y: this.a.cy }; }
  wake() {
    const a = this.a; a.mode = 'fly'; a.scriptPose = null; this.state = 'rise'; this.t = 1.2;
    // legs go slack and trail beneath
    for (const k of [7, 8, 9, 10, 11, 12]) a.body.jointK[k] = 0.15;
  }
  hurt(dmg, info) {
    const a = this.a;
    if (this.state === 'intro' || this.state === 'rise' || this.over) return 'armor';
    a.flash = 1;
    a.takeImpulse(info.x, info.y, info.dx * 400, (info.dy || -0.2) * 300, 0.4);
    a.c.vx += info.dx * 120;
    this.onHurt(this.state === 'tired' ? dmg * 1.4 : dmg);
    return null;
  }
  die() { const a = this.a; a.mode = 'dead'; a.deadT = -2.5; a.body.gravity = 2600; for (let k = 0; k < 13; k++) a.body.jointK[k] = 1; super.die(); }
  onPhase2() { this.summon(); }
  summon() {
    const g = this.game;
    for (const d of [-1, 1]) { const w = g.enemies.spawnWisp(this.a.c.x + d * 120, this.a.c.y - 60, this.tier, this.spec.col); w.bossMinion = true; }
  }
  update(dt) {
    const g = this.game, a = this.a;
    const p = g.player.dead ? null : g.player.actor;
    this.t -= dt;
    if (this.over || !p) return;
    a.body.gravity = 700;
    const A = this.mgr.arena;
    a.look_at = { x: p.c.x, y: p.c.y - 60 };
    const fast = this.phase === 2 ? 0.75 : 1;
    const steer = (tx, ty, k = 3) => { a.c.vx += ((tx - a.c.x) * k - a.c.vx) * Math.min(1, dt * 3); a.c.vy += ((ty - a.c.y) * k - a.c.vy) * Math.min(1, dt * 3); };
    switch (this.state) {
      case 'intro': break;
      case 'rise': steer(this.home.x, this.home.y, 2); if (this.t <= 0) { this.state = 'hover'; this.t = 1.4; } break;
      case 'hover': {
        const side = sign(a.c.x - p.c.x) || 1;
        steer(clamp(p.c.x + side * 260, A.x0 + 80, A.x1 - 80), A.gy - 300 + Math.sin(g.time * 1.4) * 40);
        if (this.t <= 0) this.choose();
        break;
      }
      case 'volleyW': steer(a.c.x, a.c.y, 1); a.telegraph = 1 - this.t / (0.6 * fast); if (this.t <= 0) this.volley(); break;
      case 'diveW': {
        a.c.vx *= 0.9; a.c.vy *= 0.9;
        if (this.t <= 0) {
          const dx = p.c.x - a.c.x, dy = (p.c.y - 40) - a.c.y, d = Math.hypot(dx, dy) || 1;
          const sp = 980 + this.tier * 60;
          this.dv = { x: dx / d * sp, y: dy / d * sp };
          this.state = 'dive'; this.t = 1.1; a.startAttack('down', 0.6);
          Audio.play('dash', { pitch: 0.6 });
        }
        break;
      }
      case 'dive': {
        a.c.vx = this.dv.x; a.c.vy = this.dv.y;
        this.mgr.hitAll(q => Math.hypot(q.c.x - a.c.x, q.cy - a.cy) < 60, 1, a.c.x, a.cy, { knock: 560, lift: 380, melee: true });
        if (a.c.y > A.gy - 90 || this.t <= 0) {
          a.c.vy = -200; this.state = 'tired'; this.t = 1.1;
          g.fx.dust(a.c.x, A.gy - 4, 10, '#e8dccb', -Math.PI / 2, 220); Audio.play('land', { pitch: 0.5 }); g.shake(0.3);
        }
        break;
      }
      case 'tired': steer(a.c.x, A.gy - 140, 1); a.daze = Math.max(a.daze, 0.5); if (this.t <= 0) { this.state = 'hover'; this.t = 0.8 * fast; } break;
      case 'ringW': steer(lerp(A.x0, A.x1, 0.5), A.gy - 320, 2); a.telegraph = 1 - this.t; if (this.t <= 0) this.ring(); break;
    }
    if (this.frost && (g.tick % 240) === 0 && this.state !== 'intro') this.icefall();
  }
  choose() {
    const opts = this.phase === 2 ? ['volley', 'dive', 'ring', 'dive', 'volley'] : ['volley', 'dive', 'volley'];
    const pick = opts[this.pattern++ % opts.length];
    const fast = this.phase === 2 ? 0.75 : 1;
    if (pick === 'volley') { this.state = 'volleyW'; this.t = 0.6 * fast; Audio.play('shard', { pitch: 0.8 }); }
    if (pick === 'dive') { this.state = 'diveW'; this.t = 0.55 * fast; Audio.play('roar', { pitch: 1.8, vol: 0.5 }); }
    if (pick === 'ring') { this.state = 'ringW'; this.t = 1.0; Audio.play('gate'); }
  }
  volley() {
    const g = this.game, a = this.a, p = g.player.actor;
    const n = 5 + this.tier + (this.phase === 2 ? 2 : 0);
    const base = Math.atan2(p.cy - a.cy, p.c.x - a.c.x);
    for (let i = 0; i < n; i++) {
      const ang = base + (i - (n - 1) / 2) * 0.16;
      g.projectiles.push(new Proj(g, { x: a.c.x, y: a.cy, vx: Math.cos(ang) * 340, vy: Math.sin(ang) * 340, r: 8, col: this.spec.col, life: 4 }));
    }
    Audio.play('shoot', { pitch: 0.7 });
    this.state = 'hover'; this.t = 1.3 * (this.phase === 2 ? 0.7 : 1);
  }
  ring() {
    const g = this.game, a = this.a;
    const n = 14 + this.tier * 2;
    for (let i = 0; i < n; i++) {
      const ang = i / n * TAU + g.time;
      g.projectiles.push(new Proj(g, { x: a.c.x, y: a.cy, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, r: 8, col: this.spec.col, life: 5 }));
    }
    g.fx.ring(a.c.x, a.cy, 10, 200, 0.5, this.spec.col, 6);
    Audio.play('shard', { pitch: 0.5 }); g.shake(0.3);
    this.state = 'hover'; this.t = 1.4;
    if (Math.random() < 0.5 && g.enemies.list.filter(e => e.bossMinion).length < 2) this.summon();
  }
  icefall() {
    const g = this.game, A = this.mgr.arena, p = g.player.actor;
    for (let i = 0; i < 3 + this.tier; i++) {
      const x = clamp(p.c.x + rand(-260, 260), A.x0 + 40, A.x1 - 40);
      g.fx.ring(x, A.gy - 4, 30, 6, 0.8, '#dff6ff', 2);
      setTimeoutGame(g, 0.8, () => g.projectiles.push(new Proj(g, { x, y: A.gy - 600, vx: 0, vy: 700, grav: 1200, r: 9, col: '#dff6ff', life: 3 })));
    }
  }
  lights(arr) { const a = this.a; arr.push({ x: a.c.x, y: a.cy, c: hexRgb(this.spec.col), s: 0.8 }); }
}

// ---------------------------------------------------------------- Golem: heart + torn-up blocks
export class Golem extends BossBase {
  constructor(g, mgr, spec, tier, x, gy) {
    super(g, mgr, spec, tier);
    this.maxHp = this.hp = Math.round(300 * (1 + tier * 0.65));
    this.core = {
      id: 'golem', team: 'enemy', kind: 'golem', isBoss: true, scale: 2, hitR: 34, mode: 'ctrl', removed: false, glows: [], flash: 0,
      c: { x, y: gy - 150, vx: 0, vy: 0, w: 70, h: 70 },
      get cx() { return this.c.x; }, get cy() { return this.c.y; }, get x() { return this.c.x; }, get y() { return this.c.y; },
      update: () => {}, draw: () => {}, hurt: (dmg, info) => this.hurt(dmg, info),
    };
    this.core.body = null;
    g.actors.push(this.core);
    this.parts = [];
    for (let i = 0; i < 10; i++) this.parts.push({ a: i / 10 * TAU, r: 70, x: x, y: gy, state: 'orbit', t: 0, tile: [T.RUIN, T.STONE, T.DEEP][i % 3] });
    this.orbitR = 62; this.spin = 1; this.y0 = gy;
    this.c = this.core.c;
  }
  actors() { return [this.core]; }
  center() { return { x: this.c.x, y: this.c.y }; }
  wake() { this.state = 'rise'; this.t = 1.0; }
  hurt(dmg, info) {
    const g = this.game;
    if (this.state === 'intro' || this.state === 'rise' || this.over) return 'armor';
    const shielded = this.state !== 'stunned' && this.parts.filter(p => p.state === 'orbit').length > 6 && this.orbitR < 90;
    this.core.flash = 1;
    this.c.vx += info.dx * 160;
    this.onHurt(shielded ? dmg * 0.35 : this.state === 'stunned' ? dmg * 1.5 : dmg);
    return shielded ? 'armor' : null;
  }
  die() { this.core.mode = 'dead'; for (const p of this.parts) { p.state = 'fall'; p.vx = rand(-300, 300); p.vy = rand(-500, -100); } super.die(); }
  update(dt) {
    const g = this.game, c = this.c, A = this.mgr.arena;
    const p = g.player.dead ? null : g.player.actor;
    this.t -= dt; this.core.flash = Math.max(0, this.core.flash - dt * 5);
    const fast = this.phase === 2 ? 0.75 : 1;
    // parts
    for (const q of this.parts) {
      if (q.state === 'orbit') {
        q.a += dt * this.spin * (this.phase === 2 ? 1.6 : 1);
        const tx = c.x + Math.cos(q.a) * this.orbitR, ty = c.y + Math.sin(q.a) * this.orbitR;
        q.x = lerp(q.x, tx, 1 - Math.exp(-10 * dt)); q.y = lerp(q.y, ty, 1 - Math.exp(-10 * dt));
        if (this.orbitR > 100) this.mgr.hitAll(o => Math.hypot(o.c.x - q.x, o.cy - q.y) < 30, 1, q.x, q.y);
      } else if (q.state === 'gone') { q.t -= dt; if (q.t <= 0) { q.state = 'orbit'; q.x = c.x; q.y = c.y; } }
      else if (q.state === 'fall') { q.vy += 1800 * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.y > this.y0 - 14) { q.y = this.y0 - 14; q.vx *= 0.5; q.vy *= -0.3; } }
    }
    if (this.over || !p) return;
    switch (this.state) {
      case 'intro': c.y = lerp(c.y, this.y0 - 40, 1 - Math.exp(-2 * dt)); break;
      case 'rise': c.y = lerp(c.y, this.y0 - 220, 1 - Math.exp(-3 * dt)); if (this.t <= 0) { this.state = 'float'; this.t = 1.2; } break;
      case 'float': {
        const tx = clamp(p.c.x + Math.sin(g.time * 0.7) * 200, A.x0 + 120, A.x1 - 120);
        c.vx += ((tx - c.x) * 1.5 - c.vx) * Math.min(1, dt * 2);
        c.x += c.vx * dt;
        c.y = lerp(c.y, this.y0 - 230 + Math.sin(g.time * 1.3) * 20, 1 - Math.exp(-3 * dt));
        this.orbitR = lerp(this.orbitR, 62, 1 - Math.exp(-3 * dt));
        if (this.t <= 0) this.choose();
        break;
      }
      case 'throwW': if (this.t <= 0) this.throwBlocks(); break;
      case 'poundUp': c.y = lerp(c.y, this.y0 - 420, 1 - Math.exp(-4 * dt)); c.x = lerp(c.x, p.c.x, 1 - Math.exp(-3 * dt)); if (this.t <= 0) { this.state = 'pound'; this.vy = 0; } break;
      case 'pound': {
        this.vy = (this.vy || 0) + 3400 * dt; c.y += this.vy * dt;
        if (c.y >= this.y0 - 60) {
          c.y = this.y0 - 60;
          Audio.play('boom'); g.shake(0.9); g.hitstop(0.06);
          g.fx.ring(c.x, this.y0 - 6, 10, 260, 0.6, this.spec.col, 9); g.fx.dust(c.x, this.y0 - 4, 22, '#d9ceff', -Math.PI / 2, 360);
          for (const d of [-1, 1]) g.projectiles.push(new Proj(g, { kind: 'wave', x: c.x + d * 40, y: this.y0, vx: d * 480, life: 2.4, col: this.spec.col }));
          this.mgr.hitAll(q => Math.abs(q.c.x - c.x) < 120 && q.c.y > this.y0 - 140, 1, c.x, this.y0 - 40, { knock: 640, lift: 560, heavy: true });
          this.state = 'stunned'; this.t = 1.7 * fast;
        }
        break;
      }
      case 'stunned': this.orbitR = lerp(this.orbitR, 30, 1 - Math.exp(-6 * dt)); if (this.t <= 0) { this.state = 'rise'; this.t = 0.8; } break;
      case 'spin': this.orbitR = lerp(this.orbitR, 150, 1 - Math.exp(-3 * dt)); c.x = lerp(c.x, p.c.x, 1 - Math.exp(-0.8 * dt)); if (this.t <= 0) { this.state = 'float'; this.t = 1; } break;
    }
  }
  choose() {
    const opts = this.phase === 2 ? ['throw', 'pound', 'spin', 'throw', 'pound'] : ['throw', 'pound', 'throw'];
    const pick = opts[this.pattern++ % opts.length];
    if (pick === 'throw') { this.state = 'throwW'; this.t = 0.6; Audio.play('crack'); }
    if (pick === 'pound') { this.state = 'poundUp'; this.t = 0.9 * (this.phase === 2 ? 0.75 : 1); Audio.play('roar', { pitch: 0.7, vol: 0.6 }); }
    if (pick === 'spin') { this.state = 'spin'; this.t = 3; Audio.play('gate'); }
  }
  throwBlocks() {
    const g = this.game, p = g.player.actor;
    const n = 3 + Math.min(4, this.tier) + (this.phase === 2 ? 2 : 0);
    let k = 0;
    for (const q of this.parts) {
      if (q.state !== 'orbit' || k >= n) continue;
      const delay = k * 0.14; k++;
      setTimeoutGame(g, delay, () => {
        if (this.over) return;
        q.state = 'gone'; q.t = 3;
        const dx = p.c.x + rand(-40, 40) - q.x, dy = p.cy - q.y, d = Math.hypot(dx, dy) || 1;
        g.projectiles.push(new Proj(g, { kind: 'block', x: q.x, y: q.y, vx: dx / d * 620, vy: dy / d * 620 - 120, grav: 500, r: 13, life: 3, tile: q.tile, colB: TILES[q.tile].k[0] === '#' ? TILES[q.tile].k : '#5a5470' }));
        Audio.play('swing', { pitch: 0.5 });
      });
    }
    this.state = 'float'; this.t = 1.6 * (this.phase === 2 ? 0.7 : 1);
  }
  drawFront(ctx) {
    const g = this.game, c = this.c;
    ctx.save();
    // petals: each is a throwable piece of the heart
    for (const q of this.parts) {
      if (q.state === 'gone') continue;
      const ang = Math.atan2(q.y - c.y, q.x - c.x);
      drawPetal(ctx, q.x, q.y, ang, this.state === 'throwW' ? 1 : 0, g.time, this.spec);
    }
    if (this.core.mode !== 'dead') {
      const pulse = 1 + Math.sin(g.time * 4) * 0.05;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, c.x, c.y, 120 * pulse, hexRgb(this.spec.col), 0.55);
      ctx.globalCompositeOperation = 'source-over';
      // the porcelain heart of the flower
      const gr = ctx.createRadialGradient(c.x - 8, c.y - 10, 2, c.x, c.y, 30);
      gr.addColorStop(0, this.core.flash > 0 ? '#ffffff' : '#fbf8f2'); gr.addColorStop(0.7, '#e6ded2'); gr.addColorStop(1, '#b9ad9e');
      ctx.fillStyle = '#2a2240'; ctx.beginPath(); ctx.arc(c.x, c.y, 34 * pulse, 0, TAU); ctx.fill();
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(c.x, c.y - 2, 25, 27, 0, 0, TAU); ctx.fill();
      // a blank porcelain heart; it glows from within when stunned (the opening to strike)
      if (this.state === 'stunned') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(this.spec.col, 0.5); ctx.beginPath(); ctx.ellipse(c.x, c.y - 2, 18, 20, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    }
    ctx.restore();
  }
  lights(arr) { arr.push({ x: this.c.x, y: this.c.y, c: hexRgb(this.spec.col), s: 0.9 }); }
}
export { TYPES, Warden, Wraith };
