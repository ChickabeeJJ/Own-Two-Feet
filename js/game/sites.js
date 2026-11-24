// World sites between the shrines: three kinds of puzzle and the Hollow camps.
//  - Braziers: three cold braziers; light them all (Strike or the action key) before the first goes out.
//  - Pressure plates: two plates hold a crystal cage shut; weigh both down at once (stand on one, set a
//    block on the other) and the cage opens.
//  - Thread races: touch the loom-stone and chase the rings Thread lays out before each fades.
//  - Hollow camps: a stockade, a few Hollows and an elite with a name; clear it for the camp's chest.
// Every solved site leaves a chest (glimmer, materials, a Thread of Light). Progress is saved per site.
import { TILE, T, TILES } from '../world/tiles.js';
import { Audio } from '../core/audio.js';
import { drawGlow } from '../world/light.js';
import { drawChest } from './content.js';
import { rgba, TAU, rand, clamp, hash2 } from '../core/util.js';
import { softDisc, ballShade, capsule } from '../art/paint.js';

const ELITE_NAMES = ['Hollow Captain', 'Thorn Warden', 'The Stitchbreaker', 'Ash Sergeant', 'Grey Knot', 'The Unravelled'];

export class Sites {
  constructor(game) {
    this.game = game;
    this.list = new Map();   // key -> site
    this.scanT = 0;
  }
  get sv() { const s = this.game.save; s.puzzles = s.puzzles || {}; s.counters = s.counters || {}; return s; }
  count(k) { const c = this.sv.counters; c[k] = (c[k] || 0) + 1; }
  update(dt) {
    const g = this.game, p = g.player, W = g.world;
    if (!p || !g.content) return;
    const ptx = Math.floor(p.x / TILE);
    if ((this.scanT -= dt) <= 0) {
      this.scanT = 0.5;
      for (const kind of ['brazier', 'plates', 'race', 'camp']) for (const x of g.content.sites(kind, ptx - 80, ptx + 80)) {
        const key = kind + x;
        if (!this.list.has(key)) this.list.set(key, this.make(kind, x));
      }
      for (const [k, s] of this.list) if (Math.abs(s.x / TILE - ptx) > 110) { if (s.units) for (const u of s.units) u.removed = true; this.list.delete(k); }
    }
    for (const s of this.list.values()) this.tick(s, dt);
  }
  make(kind, x) {
    const W = this.game.world, sv = this.sv, key = kind + x;
    const gy = W.surface(x) * TILE;
    const s = { kind, key, tx: x, x: x * TILE + 16, y: gy, solved: !!sv.puzzles[key], chest: null };
    if (s.solved) s.chest = { x: s.x, y: gy, open: !!sv.puzzles[key + 'c'], t: sv.puzzles[key + 'c'] ? 1 : 0, fade: sv.puzzles[key + 'c'] ? 0 : 1 };
    if (kind === 'brazier') s.items = [-7, 0, 7].map(d => ({ tx: x + d, y: W.surface(x + d) * TILE, lit: false }));
    if (kind === 'plates') s.items = [-5, 5].map(d => ({ tx: x + d, y: W.surface(x + d) * TILE, down: false }));
    if (kind === 'race') { s.rings = []; s.i = 0; s.active = false; }
    if (kind === 'camp') { s.units = []; s.spawned = false; s.elite = null; s.name = ELITE_NAMES[Math.floor(hash2(x, 61, W.seed) * ELITE_NAMES.length)]; }
    return s;
  }
  solve(s, quiet) {
    const g = this.game;
    if (s.solved) return;
    s.solved = true; this.sv.puzzles[s.key] = 1;
    s.chest = { x: s.x, y: s.y, open: false, t: 0, fade: 1, pop: 1 };
    this.count(s.kind === 'camp' ? 'camp' : 'solve');
    if (!quiet) {
      Audio.play('chime'); Audio.play('confirm');
      g.fx.ring(s.x, s.y - 20, 6, 120, 0.6, '#ffe3a0', 5);
      g.fx.burst(s.x, s.y - 20, { n: 24, speed: 260, col: '#ffffff', col1: '#ffd9a0', add: true, life: 0.8, size: 2.6, kind: 'mote' });
      g.ui && g.ui.toast(s.kind === 'camp' ? `Camp cleared: ${s.name} is undone` : 'The way opens. A chest appears');
      g.story && g.story.say(s.kind === 'camp' ? 'They guarded something. Look.' : 'There. You worked it out.', 2.4, true);
    }
    g.saveNow && g.saveNow();
  }
  openChest(s) {
    const g = this.game, sv = this.sv, p = g.player, c = s.chest;
    if (!c || c.open) return;
    c.open = true; sv.puzzles[s.key + 'c'] = 1;
    g.levels && g.levels.gain(s.kind === 'camp' ? 140 : 90, g.player.actor.c.x, g.player.actor.c.y - 110, 'solved');
    const gl = 25 + Math.floor(Math.random() * 30) + (s.kind === 'camp' ? 25 : 0);
    sv.glimmer += gl; sv.lights = (sv.lights || 0) + 1;
    const pool = [[T.GOLD, 2], [T.CRYSTAL, 3], ['i_draught', 1], ['i_flare', 2], [T.PLANK, 8], [T.BRICK, 6], ['i_charge', 1]];
    const got = [];
    for (let i = 0; i < 2; i++) { const [id, n] = pool[Math.floor(Math.random() * pool.length)]; p.give(id, n); got.push(n + ' ' + (typeof id === 'number' ? TILES[id].name : id === 'i_draught' ? 'Mending Draught' : id === 'i_flare' ? 'Flares' : 'Blast Charge')); }
    Audio.play('chest'); Audio.play('chime');
    g.fx.burst(c.x, c.y - 20, { n: 22, speed: 260, col: '#ffffff', col1: '#ffd9a0', add: true, life: 0.7, size: 2.4, kind: 'mote' });
    g.ui && g.ui.toast(`Chest: ${gl} glimmer, ${got.join(', ')}, +1 Thread of Light (${sv.lights})`);
    g.saveNow && g.saveNow();
  }
  tick(s, dt) {
    const g = this.game, p = g.player, W = g.world, a = p.actor;
    if (s.chest && s.chest.open) { s.chest.t = Math.min(1, s.chest.t + dt * 3); s.chest.fade = Math.max(0, s.chest.fade - dt / 2.2); }
    if (s.chest && s.chest.pop) s.chest.pop = Math.max(0, s.chest.pop - dt * 2);
    if (s.solved) return;
    if (s.kind === 'brazier') {
      // a blade swung through a cold brazier lights it too
      if (a.attack && a.attack.kind !== 'mine') for (const b of s.items) if (!b.lit && Math.abs(a.c.x - (b.tx * TILE + 16)) < 46 && Math.abs(a.c.y - b.y) < 60) this.light(s, b);
      if (s.timer > 0) {
        s.timer -= dt;
        if (s.items.every(b => b.lit)) this.solve(s);
        else if (s.timer <= 0) { for (const b of s.items) b.lit = false; Audio.play('blip', { pitch: 0.5 }); g.ui && g.ui.toast('The flames gutter out. Light all three faster'); }
      }
    } else if (s.kind === 'plates') {
      for (const pl of s.items) {
        const ptx = pl.tx, ty = Math.floor(pl.y / TILE);
        const onIt = Math.abs(a.c.x - (ptx * TILE + 16)) < 22 && Math.abs(a.c.y - pl.y) < 6 && a.c.ground;
        const weighed = TILES[W.get(ptx, ty - 1)].solid;
        const was = pl.down; pl.down = onIt || weighed;
        if (pl.down && !was) Audio.play('place', { pitch: 0.7 });
      }
      if (s.items.every(pl => pl.down)) this.solve(s);
    } else if (s.kind === 'race' && s.active) {
      s.t -= dt;
      const r = s.rings[s.i];
      if (r && Math.hypot(a.c.x - r.x, (a.c.y - 40) - r.y) < 44) {
        s.i++; s.t = 3.4; Audio.play('soul', { pitch: 1 + s.i * 0.08 });
        g.fx.ring(r.x, r.y, 6, 50, 0.3, '#9ff3ff', 3);
        if (s.i >= s.rings.length) { s.active = false; this.solve(s); }
      } else if (s.t <= 0) { s.active = false; s.i = 0; Audio.play('blip', { pitch: 0.5 }); g.ui && g.ui.toast('The thread slipped away. Try the race again'); }
    } else if (s.kind === 'camp') {
      if (!s.spawned && Math.abs(a.c.x - s.x) < 620) this.spawnCamp(s);
      if (s.spawned && s.units.every(u => u.mode === 'dead' || u.removed)) this.solve(s);
    }
  }
  light(s, b) {
    const g = this.game;
    b.lit = true;
    if (!(s.timer > 0)) s.timer = 22;
    Audio.play('place', { pitch: 1.4 }); Audio.play('chime', { pitch: 1.2 + s.items.filter(q => q.lit).length * 0.15, vol: 0.5 });
    g.fx.burst(b.tx * TILE + 16, b.y - 26, { n: 14, speed: 160, col: '#fff1cf', col1: '#ff9b4a', add: true, life: 0.6, size: 2.4, kind: 'mote' });
  }
  startRace(s) {
    const g = this.game, W = g.world, dir = hash2(s.tx, 63, W.seed) < 0.5 ? -1 : 1;
    s.rings = [];
    for (let i = 1; i <= 7; i++) {
      const tx = s.tx + dir * i * 6;
      const top = W.surface(tx) * TILE;
      s.rings.push({ x: tx * TILE + 16, y: top - 60 - (i % 3) * 34 });
    }
    s.i = 0; s.t = 4.5; s.active = true;
    Audio.play('chime'); g.story && g.story.say('Follow my thread. Quickly.', 2, true);
  }
  spawnCamp(s) {
    const g = this.game, W = g.world;
    s.spawned = true;
    const tier = W.tierAtX(s.x);
    for (const d of [-4, 4]) { const x = s.x + d * TILE; s.units.push(g.enemies.spawn('husk', x, W.surface(Math.floor(x / TILE)) * TILE, tier)); }
    const brute = hash2(s.tx, 64, W.seed) < 0.4;
    const e = g.enemies.spawn(brute ? 'brute' : 'husk', s.x, s.y, tier, '#ff8a6a');
    e.elite = true; e.eliteName = s.name;
    e.hp = e.maxHp = e.maxHp * (brute ? 2.2 : 3.4);
    e.maxPoise = e.poise = e.maxPoise * 2;
    if (!brute) { e.guard = true; e.look = Object.assign({}, e.look, { shield: true }); }
    e.scale *= 1.08;
    s.units.push(e); s.elite = e;
    for (const u of s.units) { u.campX = s.x; if (u.ai) { u.ai.state = 'idle'; u.ai.t = 1; } }
  }
  interactables() {
    const out = [], g = this.game;
    for (const s of this.list.values()) {
      if (s.chest && !s.chest.open) out.push({ x: s.chest.x, y: s.chest.y - 20, r: 70, label: 'Open the chest', verb: 'Open', act: () => this.openChest(s) });
      if (s.solved) continue;
      if (s.kind === 'brazier') for (const b of s.items) if (!b.lit) out.push({ x: b.tx * TILE + 16, y: b.y - 20, r: 56, label: 'Light the brazier', verb: 'Light', act: () => this.light(s, b) });
      if (s.kind === 'race' && !s.active) out.push({ x: s.x, y: s.y - 30, r: 70, label: 'Begin the Thread race', verb: 'Race', act: () => this.startRace(s) });
    }
    return out;
  }
  lights(arr) {
    for (const s of this.list.values()) {
      if (s.kind === 'brazier') for (const b of s.items) if (b.lit || s.solved) arr.push({ x: b.tx * TILE + 16, y: b.y - 30, c: [1, 0.62, 0.32], s: 0.9 });
      if (s.kind === 'race' && s.active) { const r = s.rings[s.i]; if (r) arr.push({ x: r.x, y: r.y, c: [0.6, 0.95, 1], s: 0.7 }); }
    }
  }
  // the nearest unsolved site of a kind (for quest navigation)
  nearest(kind, px) {
    let best = null, bd = 1e9;
    const g = this.game, ptx = Math.floor(px / TILE);
    for (const k of (kind === 'solve' ? ['brazier', 'plates', 'race'] : [kind])) for (const x of g.content.sites(k, ptx - 400, ptx + 400)) {
      if (this.sv.puzzles[k + x]) continue;
      const d = Math.abs(x - ptx);
      if (d < bd) { bd = d; best = { x: x * TILE + 16, y: g.world.surface(x) * TILE - 40, kind: k }; }
    }
    return best;
  }
  draw(ctx, a, layer) {
    const g = this.game, t = g.time;
    if (layer === 'back') {
      for (const s of this.list.values()) {
        if (Math.abs(s.x - g.cam.x) > 1500) continue;
        if (s.kind === 'brazier') for (const b of s.items) drawBrazier(ctx, b.tx * TILE + 16, b.y, b.lit || s.solved, t, s.timer > 0 && !s.solved ? s.timer : 0);
        if (s.kind === 'plates') { for (const pl of s.items) drawPlate(ctx, pl.tx * TILE + 16, pl.y, pl.down || s.solved); if (!s.solved) drawCage(ctx, s.x, s.y, t); }
        if (s.kind === 'race' && !s.solved) drawRaceStone(ctx, s.x, s.y, t, s.active);
        if (s.kind === 'camp') drawCamp(ctx, s.x, s.y, s.tx);
        if (s.chest && s.chest.fade > 0) {
          ctx.save(); ctx.globalAlpha = s.chest.fade;
          const k = 1 + (s.chest.pop || 0) * 0.3;
          ctx.translate(s.chest.x, s.chest.y); ctx.scale(k, k); drawChest(ctx, 0, 0, s.chest.t, t); ctx.restore();
        }
      }
    }
    if (layer === 'front') {
      for (const s of this.list.values()) {
        if (s.kind === 'race' && s.active) s.rings.forEach((r, i) => { if (i >= s.i) drawRing(ctx, r.x, r.y, t, i === s.i ? clamp(s.t / 3.4, 0, 1) : 0.25, i === s.i); });
        if (s.kind === 'camp' && s.elite && s.elite.mode !== 'dead' && !s.elite.removed) drawNamePlate(ctx, s.elite);
      }
    }
  }
}

// ---------------------------------------------------------------- art
function drawBrazier(g, x, y, lit, t, timer) {
  softDisc(g, x, y, 26, '#000000', 0.3);
  capsule(g, x, y, x, y - 18, 3, 3, '#5a5560', { dark: 0.35 });
  g.fillStyle = '#6e6670'; g.beginPath(); g.moveTo(x - 14, y - 24); g.lineTo(x + 14, y - 24); g.lineTo(x + 9, y - 16); g.lineTo(x - 9, y - 16); g.closePath(); g.fill();
  g.fillStyle = '#3a3440'; g.beginPath(); g.ellipse(x, y - 24, 14, 3.5, 0, 0, TAU); g.fill();
  if (lit) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const fl = 0.85 + Math.sin(t * 11 + x) * 0.15;
    drawGlow(g, x, y - 34, 60 * fl, [1, 0.6, 0.3], 0.5);
    g.fillStyle = '#ff9a4a'; g.beginPath(); g.moveTo(x, y - 46 * fl); g.quadraticCurveTo(x + 9, y - 30, x, y - 24); g.quadraticCurveTo(x - 9, y - 30, x, y - 46 * fl); g.fill();
    g.fillStyle = '#fff1cf'; g.beginPath(); g.moveTo(x, y - 37 * fl); g.quadraticCurveTo(x + 4, y - 29, x, y - 25); g.quadraticCurveTo(x - 4, y - 29, x, y - 37 * fl); g.fill();
    g.restore();
  } else if (timer > 0) {
    g.fillStyle = rgba('#ffd9a0', 0.4 + Math.sin(t * 8) * 0.2); g.beginPath(); g.arc(x, y - 26, 3, 0, TAU); g.fill();
  }
}
function drawPlate(g, x, y, down) {
  g.fillStyle = '#5a5560'; g.beginPath(); g.roundRect(x - 15, y - (down ? 2 : 5), 30, 7, 3); g.fill();
  g.fillStyle = down ? rgba('#9ff3ff', 0.9) : rgba('#9ff3ff', 0.3); g.beginPath(); g.roundRect(x - 9, y - (down ? 1.5 : 4.5), 18, 2, 1); g.fill();
  if (down) { g.save(); g.globalCompositeOperation = 'lighter'; drawGlow(g, x, y - 4, 26, [0.6, 0.95, 1], 0.35); g.restore(); }
}
function drawCage(g, x, y, t) {
  g.save();
  for (let i = -2; i <= 2; i++) {
    const bx = x + i * 9;
    const gr = g.createLinearGradient(bx, y - 52, bx, y);
    gr.addColorStop(0, rgba('#bff6ff', 0.9)); gr.addColorStop(1, rgba('#5aa8b8', 0.6));
    g.fillStyle = gr; g.beginPath(); g.moveTo(bx - 2.5, y); g.lineTo(bx, y - 56 - Math.abs(i) * -4); g.lineTo(bx + 2.5, y); g.fill();
  }
  g.globalCompositeOperation = 'lighter'; drawGlow(g, x, y - 26, 44, [0.6, 0.95, 1], 0.2 + Math.sin(t * 2) * 0.05);
  g.restore();
}
function drawRaceStone(g, x, y, t, active) {
  softDisc(g, x, y, 24, '#000000', 0.3);
  g.fillStyle = '#6e6670'; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x - 7, y - 40); g.quadraticCurveTo(x, y - 48, x + 7, y - 40); g.lineTo(x + 10, y); g.fill();
  g.save(); g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba('#9ff3ff', active ? 0.9 : 0.5 + Math.sin(t * 3) * 0.2); g.lineWidth = 2;
  g.beginPath(); g.arc(x, y - 26, 6, 0, TAU); g.stroke();
  drawGlow(g, x, y - 26, 30, [0.6, 0.95, 1], 0.3);
  g.restore();
}
function drawRing(g, x, y, t, k, cur) {
  g.save(); g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba('#9ff3ff', cur ? 0.35 + 0.6 * k : 0.25); g.lineWidth = cur ? 4 : 2;
  g.beginPath(); g.ellipse(x, y, 16, 30, 0, 0, TAU); g.stroke();
  if (cur) { g.strokeStyle = rgba('#ffffff', 0.8 * k); g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 16, 30, 0, -Math.PI / 2, -Math.PI / 2 + k * TAU); g.stroke(); drawGlow(g, x, y, 50, [0.6, 0.95, 1], 0.3); }
  g.restore();
}
function drawCamp(g, x, y, tx) {
  // a crude stockade of sharpened stakes and a tattered banner
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const sx = x + side * (170 + i * 14), h = 46 + ((tx * 7 + i * 13) % 17);
    capsule(g, sx, y + 4, sx + side * 3, y - h, 4.2, 3.2, '#5b4636', { dark: 0.35 });
    g.fillStyle = '#4a3a2e'; g.beginPath(); g.moveTo(sx - 4 + side * 3, y - h); g.lineTo(sx + side * 3, y - h - 10); g.lineTo(sx + 4 + side * 3, y - h); g.fill();
  }
  capsule(g, x - 120, y, x - 120, y - 96, 2.4, 2.2, '#4a3a2e', { dark: 0.3 });
  g.fillStyle = '#5a2a2e'; g.beginPath(); g.moveTo(x - 118, y - 94); g.lineTo(x - 86, y - 88); g.lineTo(x - 94, y - 76); g.lineTo(x - 84, y - 62); g.lineTo(x - 118, y - 66); g.closePath(); g.fill();
}
function drawNamePlate(g, e) {
  const x = e.c.x, y = e.c.y - (e.c.h + 26) * 1, w = 84;
  g.save();
  g.font = '600 11px Manrope, sans-serif'; g.textAlign = 'center';
  g.fillStyle = rgba('#ffd9a0', 0.95); g.fillText(e.eliteName.toUpperCase(), x, y - 8);
  g.fillStyle = rgba('#000000', 0.5); g.beginPath(); g.roundRect(x - w / 2, y - 2, w, 5, 2.5); g.fill();
  g.fillStyle = '#ff8a6a'; g.beginPath(); g.roundRect(x - w / 2, y - 2, w * clamp(e.hp / e.maxHp, 0, 1), 5, 2.5); g.fill();
  if (e.maxPoise) { g.fillStyle = rgba('#ffe3a0', 0.85); g.fillRect(x - w / 2, y + 5, w * clamp(e.poise / e.maxPoise, 0, 1), 2); }
  g.restore();
}
