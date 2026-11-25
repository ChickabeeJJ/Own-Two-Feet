// Hollow surges: every 40-60 seconds of open-world play, a rift tears open near you and Hollows pour out in
// waves. Clear every wave (fast, for a bonus) and the rift leaves a chest; run far enough and it closes.
// Nothing surges during the tutorial, in towns, at a boss gate, in menus or cutscenes.
import { Audio } from '../core/audio.js';
import { TILE, T } from '../world/tiles.js';
import { rand, clamp, rgba, TAU } from '../core/util.js';
import { drawGlow } from '../world/light.js';
import { drawChest } from './content.js';

export class Surges {
  constructor(game) {
    this.game = game;
    this.next = 45;          // seconds of eligible play until the first surge
    this.s = null;           // the active surge
    this.chests = [];
  }
  get sv() { return this.game.player.sv; }
  eligible() {
    const g = this.game, p = g.player;
    if (!p || p.dead || g.cinematic || (g.ui && g.ui.modal)) return false;
    if (!g.story || g.story.stage < 5 || !this.sv.tutDone) return false;
    if (g.bosses && g.bosses.active) return false;
    if (g.net && g.net.isGuest) return false;
    if (g.rift && g.rift.active) return false;
    if (g.towns && g.towns.safeAt && g.towns.safeAt(p.x)) return false;
    if (this.game.world.shrineNear && this.game.world.shrineNear(Math.floor(p.x / TILE)) !== null) return false;
    // surges happen in the open, not deep in the caves where the rift could open inside the rock
    const W = this.game.world, tx = Math.floor(p.x / TILE);
    if (Math.floor(p.y / TILE) > W.surface(tx) + 4) return false;
    return true;
  }
  update(dt) {
    const g = this.game;
    for (const c of this.chests) { if (c.open) { c.t = Math.min(1, c.t + dt * 3); c.fade -= dt / 2.4; } }
    this.chests = this.chests.filter(c => c.fade > 0);
    const s = this.s;
    if (!s) {
      if (this.eligible()) { this.next -= dt; if (this.next <= 0) this.open(); }
      return;
    }
    if (g.ui && g.ui.modal) return;
    s.t += dt;
    const p = g.player;
    // walking away closes the rift
    const far = Math.abs(p.x - s.x) > 1100 || Math.abs(p.y - s.y) > 700;
    s.farT = far ? s.farT + dt : 0;
    if (s.farT > 4 || p.dead) { this.close(false); return; }
    if (s.state === 'warn') {
      if (s.t > 2.2) { s.state = 'wave'; s.wave = 1; this.startWave(); this.game.ui && this.game.ui.teach && this.game.ui.teach('surge'); }
    } else if (s.state === 'wave') {
      // spawn the queue a body at a time, out of the tear
      s.spawnT -= dt;
      if (s.queue.length && s.spawnT <= 0) { s.spawnT = 0.32; this.spawnOne(s.queue.shift()); }
      s.alive = s.alive.filter(e => !e.removed && e.mode !== 'dead');
      const waveT = s.t - s.waveAt;
      // any that cannot reach you after a while come apart (no wave waits forever on a Hollow stuck in a wall)
      if (waveT > 30) for (const e of s.alive) if (Math.hypot(e.c.x - p.x, e.c.y - p.y) > 420) { e.removed = true; g.fx.burst(e.c.x, e.c.y - 40, { n: 10, speed: 140, col: '#ffffff', col1: '#ff6a5a', add: true, life: 0.5, size: 2 }); }
      if (!s.queue.length && (s.alive.length === 0 || (s.alive.length <= 1 && waveT > 8) || waveT > 22)) {
        if (s.wave >= s.waves) { if (s.alive.length === 0) this.clear(); }
        else { s.wave++; this.startWave(); }
      }
    }
    if (this.s !== s) return;   // it just cleared or closed: leave the banner hidden
    if (g.ui && g.ui.surgeHud) g.ui.surgeHud(s.state === 'warn' ? 'A rift is opening' : `Hollow surge · wave ${s.wave}/${s.waves}`, s.state === 'wave' ? s.alive.length + s.queue.length : null, s.state);
  }
  // pick a spot a few blocks to one side with ground under it
  open() {
    const g = this.game, p = g.player, W = g.world;
    let spot = null;
    for (const side of Math.random() < 0.5 ? [-1, 1] : [1, -1]) {
      for (const d of [260, 200, 330, 160]) {
        const x = p.x + side * d, gy = W.groundBelow(x, p.y - 160, 420);
        // standing room, and a clear line from the rift to you (so the Hollows can reach you)
        if (gy === null || Math.abs(gy - p.y) > 220) continue;
        const roomy = !W.solidAt(x, gy - 40) && !W.solidAt(x, gy - 80);
        const clear = !W.raycast(x, gy - 40, p.x, p.y - 40);
        if (roomy && clear) { spot = { x, y: gy }; break; }
      }
      if (spot) break;
    }
    this.next = rand(50, 70);
    if (!spot) { this.next = 6; return; }
    const tier = W.tierAtX ? W.tierAtX(spot.x) : 0;
    const lvl = g.levels ? g.levels.zoneLevel(spot.x) : 1;
    this.s = { x: spot.x, y: spot.y, t: 0, state: 'warn', wave: 0, waves: 2 + Math.min(2, tier + (lvl > 6 ? 1 : 0)), tier, lvl, queue: [], alive: [], spawnT: 0, farT: 0, waveAt: 0, kills: 0 };
    if (g.player.perk && g.player.perk('ward')) g.player.ward = 1;
    Audio.play('roar', { vol: 0.35, pitch: 1.4 }); Audio.play('crack');
    g.shake(0.35);
    if (g.story) g.story.say('A rift! They are coming through. Fight!', 2.4, true);
    if (g.ui && g.ui.toast) g.ui.toast('Hollow surge');
  }
  startWave() {
    const g = this.game, s = this.s;
    s.waveAt = s.t;
    const n = 3 + s.wave + s.tier + (s.lvl > 4 ? 1 : 0);
    const kinds = [];
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      kinds.push(r < 0.5 ? 'husk' : r < 0.7 ? 'lancer' : r < 0.85 ? 'slinger' : s.wave >= 2 ? 'brute' : 'husk');
    }
    if (s.wave === s.waves) kinds.push('brute');   // the last wave brings something big
    s.queue = kinds; s.spawnT = 0.3;
    Audio.play('roar', { vol: 0.3, pitch: 1.2 + s.wave * 0.1 });
    g.fx.ring(s.x, s.y - 70, 10, 160, 0.6, '#ff6a5a', 6);
    if (g.ui && g.ui.streak && s.wave > 1) g.ui.streak(`Wave ${s.wave}`, s.alive.length);
  }
  spawnOne(kind) {
    const g = this.game, s = this.s, E = g.enemies;
    if (!E) return;
    const B = g.biomeAt(s.x);
    const e = E.spawn(kind, s.x + rand(-14, 14), s.y, s.tier, B.accent, { lvl: s.lvl, surge: true });
    e.c.vx = rand(-260, 260); e.c.vy = -rand(260, 520); e.c.ground = false;
    if (e.ai) { e.ai.state = 'chase'; e.ai.mem = 6; }
    s.alive.push(e);
    g.fx.burst(s.x, s.y - 60, { n: 14, speed: 260, col: '#ffffff', col1: '#ff5a4a', add: true, life: 0.5, size: 2.4, kind: 'streak' });
    Audio.play('swing', { pitch: 0.5, vol: 0.4 });
  }
  onKill(e) { if (this.s && e.surge) this.s.kills++; }
  clear() {
    const g = this.game, s = this.s, p = g.player;
    const swift = s.t < 30 + s.waves * 8;
    const xp = (90 + s.waves * 45) * (1 + (s.lvl - 1) * 0.15) * (swift ? 1.5 : 1);
    if (g.levels) g.levels.gain(xp, p.actor.c.x, p.actor.c.y - 120, swift ? 'surge, swift' : 'surge');
    g.slowmo(0.3, 0.5); g.flash([1, 0.9, 0.8], 0.3);
    g.fx.ring(s.x, s.y - 70, 10, 220, 0.7, '#ffd9a0', 6);
    Audio.play('confirm'); Audio.play('chime', { pitch: 0.9 });
    if (g.ui && g.ui.streak) g.ui.streak(swift ? 'Surge cleared · swift' : 'Surge cleared', s.kills);
    if (g.story) g.story.say(swift ? 'Fast. The rift left something behind.' : 'It closed. Look, a chest.', 2.4, true);
    this.chests.push({ x: s.x, y: s.y, open: false, t: 0, fade: 1, tier: s.tier, swift, lvl: s.lvl });
    this.sv.stats.surges = (this.sv.stats.surges || 0) + 1;
    if (g.guide) g.guide.ev('surge');
    if (g.towns) g.towns.onSurge();
    if (g.quests && g.quests.counters) g.quests.counters.surges = (g.quests.counters.surges || 0) + 1;
    this.s = null;
    if (g.ui && g.ui.surgeHud) g.ui.surgeHud(null);
  }
  close(won) {
    const g = this.game;
    if (this.s) { g.fx.ring(this.s.x, this.s.y - 70, 60, 4, 0.5, '#ff6a5a', 4); Audio.play('chime', { pitch: 0.5, vol: 0.5 }); }
    this.s = null;
    this.next = rand(30, 45);
    if (g.ui && g.ui.surgeHud) g.ui.surgeHud(null);
  }
  interactables() {
    return this.chests.filter(c => !c.open).map(c => ({ x: c.x, y: c.y - 20, r: 70, label: 'Open the rift chest', verb: 'Open', act: () => this.openChest(c) }));
  }
  openChest(c) {
    const g = this.game, p = g.player;
    if (c.open) return;
    c.open = true;
    Audio.play('chest'); Audio.play('chime');
    const loot = [[T.CRYSTAL, 2 + c.tier], [T.GOLD, 1 + Math.floor(c.tier / 2)]];
    if (Math.random() < 0.5) loot.push(['i_draught', 1]);
    if (Math.random() < 0.35) loot.push(['i_charge', 1]);
    if (c.swift) loot.push([T.OBSIDIAN, 1]);
    for (const [id, n] of loot) { p.give(id, n); if (g.ui && g.ui.pickup) g.ui.pickup(id, n); }
    const gl = Math.round((14 + c.tier * 8) * (c.swift ? 1.5 : 1) * (p.perk && p.perk('magnet') ? 1.2 : 1));
    g.fx.souls(c.x, c.y - 20, 10, p.actor.c, '#ffe7a8', () => { p.sv.glimmer += Math.ceil(gl / 10); Audio.play('soul', { gap: 0.02, pitch: 1.2 }); g.ui && g.ui.glimmerBump(); });
    g.fx.burst(c.x, c.y - 16, { n: 24, speed: 220, col: '#ffffff', col1: '#ffd9a0', add: true, life: 0.8, size: 2.6, kind: 'mote' });
  }
  lights(arr) {
    const s = this.s;
    if (s) arr.push({ x: s.x, y: s.y - 70, c: [1, 0.35, 0.3], s: s.state === 'warn' ? clamp(s.t / 2.2, 0, 1) * 1.3 : 1.4 + Math.sin(s.t * 9) * 0.15 });
    for (const c of this.chests) if (!c.open) arr.push({ x: c.x, y: c.y - 16, c: [1, 0.85, 0.5], s: 0.5 });
  }
  draw(ctx, a, layer) {
    if (layer !== 'back') return;
    const g = this.game, t = g.time;
    for (const c of this.chests) {
      ctx.save(); ctx.globalAlpha = clamp(c.fade, 0, 1);
      drawChest(ctx, c.x, c.y, c.t, t); ctx.restore();
    }
    const s = this.s;
    if (!s) return;
    // the tear: a jagged vertical wound in the air, black at the core, burning at the edges
    const open = s.state === 'warn' ? clamp(s.t / 2.2, 0, 1) : 1;
    const H = 150 * (0.2 + 0.8 * open), W0 = (8 + 30 * open) * (1 + Math.sin(t * 7) * 0.06);
    const cx = s.x, top = s.y - 10 - H;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, cx, s.y - 10 - H * 0.5, 90 + 60 * open, [1, 0.3, 0.25], 0.45 * open + 0.1);
    ctx.globalCompositeOperation = 'source-over';
    const edge = (side, k) => {
      ctx.beginPath(); ctx.moveTo(cx, top);
      for (let i = 1; i <= 12; i++) {
        const u = i / 12, w = Math.sin(u * Math.PI) * W0 * k;
        const j = Math.sin(i * 2.7 + t * 11 + side) * 4 * open;
        ctx.lineTo(cx + side * (w + j), top + u * H);
      }
      for (let i = 12; i >= 0; i--) { const u = i / 12; ctx.lineTo(cx + Math.sin(i * 1.9 + t * 6) * 2, top + u * H); }
      ctx.closePath();
    };
    for (const side of [-1, 1]) { ctx.fillStyle = '#ff7a5a'; edge(side, 1.18); ctx.fill(); }
    for (const side of [-1, 1]) { ctx.fillStyle = '#12060a'; edge(side, 0.95); ctx.fill(); }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba('#ffd2b0', 0.7); ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) { edge(side, 1.05); ctx.stroke(); }
    // embers rising off it and a crack in the ground beneath
    if ((g.tick % 3) === 0) g.fx.spawn({ x: cx + rand(-W0, W0), y: s.y - 10 - rand(0, H), vx: rand(-20, 20), vy: -rand(40, 110), life: rand(0.6, 1.2), size: rand(1.5, 3), size1: 0.4, col: '#ffd2b0', col1: '#ff4a3a', add: true });
    ctx.strokeStyle = rgba('#ff6a4a', 0.8 * open); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 50 * open, s.y - 1); for (let i = 0; i <= 10; i++) ctx.lineTo(cx - 50 * open + i * 10 * open, s.y - 1 - Math.abs(Math.sin(i * 3.3)) * 3); ctx.stroke();
    ctx.restore();
  }
}
