// Rift Trials: a sealed arena in a world of its own. Endless waves of Hollows pour from tears at both ends,
// a champion every fifth wave, a boon to choose every third. Fall and you see your run: waves, kills, best
// combo and score, then go again at once or leave. Your gear and level come with you; the world you left is
// saved first and untouched.
import { Audio } from '../core/audio.js';
import { TILE, T } from '../world/tiles.js';
import { rand, clamp, rgba } from '../core/util.js';
import { drawGlow } from '../world/light.js';
import { Platform } from '../platform.js';

const RIFT_SEED = 0x51f7;
const HALF = 24;                  // arena half-width in tiles
const BOONS = [
  { id: 'fury', name: 'Fury', desc: 'A quarter more damage for this run.' },
  { id: 'mend', name: 'Mend', desc: 'Every vessel refilled, now.' },
  { id: 'quick', name: 'Quickstep', desc: 'Run a fifth faster for this run.' },
  { id: 'ember', name: 'Cinder', desc: 'Kills burst into flame for this run.' },
  { id: 'seam', name: 'Seamguard', desc: 'One blow in five glances off you, this run.' },
  { id: 'vigil', name: 'Vigil', desc: 'Two extra vessels for this run.' },
];

export class Rift {
  constructor(game) { this.game = game; this.active = false; this.r = null; }
  get sv() { return this.game.player.sv; }
  // ------------------------------------------------------------ entering and leaving
  // a run in progress is remembered: leaving the page ends it, and the wave reached still counts
  save() { const sv = this.sv; if (!sv || !sv.rift) return; sv.rift.left = this.active && this.r ? this.r.wave : 0; if (sv.rift.left) sv.rift.best = Math.max(sv.rift.best || 0, sv.rift.left); }
  restore() {
    const sv = this.sv; if (!sv || !sv.rift || !sv.rift.left) return;
    const w = sv.rift.left; sv.rift.left = 0;
    this.game.ui && this.game.ui.toast(`Your Rift Trials run ended at wave ${w} when you left. Best: wave ${sv.rift.best || w}`);
  }
  enter() {
    const g = this.game, p = g.player;
    if (this.active || !p || p.dead || (g.net && g.net.active)) return;
    g.saveNow && g.saveNow();
    this.home = { x: p.x, y: p.y };
    this.active = true;
    this.swap(RIFT_SEED, {});
    this.build();
    this.restart();
    Platform.gameplayStart && Platform.gameplayStart();
    g.story.card('Rift Trials', 'how long can you stand?', 'small', 2.6);
    Audio.play('roar', { vol: 0.4, pitch: 0.8 });
  }
  leave() {
    const g = this.game, p = g.player;
    if (!this.active) return;
    this.hideResults();
    this.active = false; this.r = null;
    p.temp = null; p.actor.run = p.baseRun || p.actor.run;
    if (p.tempMax) { this.sv.maxHp -= p.tempMax; p.tempMax = 0; }
    this.swap(this.sv.seed, this.sv.edits);
    const h = this.home || { x: 4 * TILE + 16, y: g.world.surface(4) * TILE };
    p.respawnAt(h.x, h.y);
    g.cam.x = h.x; g.cam.y = h.y - 80;
    if (g.ui && g.ui.surgeHud) g.ui.surgeHud(null);
    g.story.card(g.biomeAt(h.x).name, 'back from the rift', 'small', 2.2);
    g.saveNow && g.saveNow();
  }
  // a clean world switch: actors, projectiles and the per-world caches of every system go
  swap(seed, edits) {
    const g = this.game;
    for (const a of g.actors) a.removed = true;
    g.actors = []; g.projectiles = [];
    if (g.bosses) { g.bosses.active = null; g.bosses.arena = null; }
    if (g.shrines && g.shrines.map) { g.shrines.map.clear(); g.shrines.home = null; }
    const C = g.content; if (C) for (const k of ['dolls', 'chests', 'stitches', 'nests']) if (C[k] && C[k].clear) C[k].clear();
    if (g.sites && g.sites.map && g.sites.map.clear) g.sites.map.clear();
    if (g.trees) g.trees.falling = [];
    if (g.surges) { g.surges.s = null; g.surges.chests = []; g.surges.next = 40; }
    if (g.throwables) g.throwables.list = [];
    if (g.towns && g.towns.reset) g.towns.reset();
    g.setWorld(seed);
    g.world.loadEdits(edits);
    g.player.actor.mode = 'ctrl';
  }
  // the arena: a ruined floor between two walls, three ledges to fight from
  build() {
    const W = this.game.world;
    const gy = W.surface(0);
    this.gy = gy;
    for (let x = -HALF - 3; x <= HALF + 3; x++) {
      for (let y = gy - 16; y < gy; y++) W.set(x, y, T.AIR, 0, true);
      for (let y = gy; y < gy + 4; y++) W.set(x, y, y === gy ? T.RUIN : T.STONE, 0, true);
    }
    for (const side of [-1, 1]) for (let y = gy - 16; y < gy; y++) for (let k = 0; k < 3; k++) W.set(side * (HALF + 1 + k), y, T.RUIN, 0, true);
    for (const [a, b, h] of [[-15, -8, 4], [8, 15, 4], [-3, 3, 7]]) for (let x = a; x <= b; x++) W.set(x, gy - h, T.PLATFORM, 0, true);
    for (const x of [-HALF, HALF]) W.set(x, gy - 6, T.LANTERN, 0, true);
  }
  restart() {
    const g = this.game, p = g.player;
    for (const a of g.actors) if (a.team === 'enemy') a.removed = true;
    g.projectiles = [];
    this.hideResults();
    if (p.tempMax) { this.sv.maxHp -= p.tempMax; p.tempMax = 0; }
    p.temp = {};
    p.baseRun = p.baseRun || p.actor.run; p.actor.run = p.baseRun;
    p.respawnAt(0, this.gy * TILE);
    g.cam.x = p.x; g.cam.y = p.y - 80;
    this.r = { wave: 0, kills: 0, bestCombo: 0, t: 0, breather: 2.2, queue: [], alive: [], spawnT: 0, over: false };
    if (p.combo) p.combo.n = 0;
  }
  // ------------------------------------------------------------ the run
  update(dt) {
    if (!this.restored && this.game.player && this.game.story && this.game.story.stage >= 5) { this.restored = true; this.restore(); }
    if (!this.active || !this.r) return;
    const g = this.game, p = g.player, r = this.r;
    if (r.over || (g.ui && g.ui.modal)) return;
    r.t += dt;
    if (p.combo) r.bestCombo = Math.max(r.bestCombo, p.combo.n);
    if (p.dead) { this.over(); return; }
    r.alive = r.alive.filter(e => !e.removed && e.mode !== 'dead');
    if (r.breather > 0) {
      r.breather -= dt;
      if (r.breather <= 0) this.nextWave();
    } else {
      r.spawnT -= dt;
      if (r.queue.length && r.spawnT <= 0) { r.spawnT = Math.max(0.18, 0.4 - r.wave * 0.01); this.spawnOne(r.queue.shift()); }
      if (!r.queue.length && !r.alive.length) this.waveCleared();
    }
    if (g.ui && g.ui.surgeHud) g.ui.surgeHud(r.breather > 0 ? `Rift trials · wave ${r.wave + 1} coming` : `Rift trials · wave ${r.wave}`, r.breather > 0 ? null : r.alive.length + r.queue.length, r.breather > 0 ? 'warn' : 'wave');
  }
  nextWave() {
    const g = this.game, r = this.r;
    r.wave++;
    const n = 3 + Math.floor(r.wave * 1.3);
    const kinds = [];
    for (let i = 0; i < n; i++) {
      const x = Math.random();
      kinds.push(x < 0.45 ? 'husk' : x < 0.65 ? 'lancer' : x < 0.82 ? 'slinger' : r.wave >= 3 ? 'brute' : 'husk');
    }
    if (r.wave % 5 === 0) kinds.push('champion');
    r.queue = kinds; r.spawnT = 0.2;
    if (g.ui && g.ui.streak) g.ui.streak(r.wave % 5 === 0 ? `Wave ${r.wave} · champion` : `Wave ${r.wave}`, r.kills);
    Audio.play('roar', { vol: 0.35, pitch: 1 + Math.min(0.6, r.wave * 0.03) });
  }
  spawnOne(kind) {
    const g = this.game, r = this.r, E = g.enemies;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (HALF - 2) * TILE, lvl = Math.max(1, (g.save.level || 1) - 1 + Math.floor(r.wave / 2));
    const champ = kind === 'champion';
    const e = E.spawn(champ ? 'brute' : kind, x, this.gy * TILE, Math.min(4, Math.floor(r.wave / 4)), '#ff6a5a', { lvl, rift: true });
    if (champ) { e.elite = true; e.hp *= 3.2; e.maxPoise = e.poise = 140; e.scale = 1.5; e.eliteName = 'Rift Champion'; }
    e.c.vx = -side * rand(200, 420); e.c.vy = -rand(200, 420); e.c.ground = false;
    if (e.ai) { e.ai.state = 'chase'; e.ai.mem = 99; }
    r.alive.push(e);
    g.fx.burst(x, this.gy * TILE - 60, { n: 14, speed: 260, col: '#ffffff', col1: '#ff5a4a', add: true, life: 0.5, size: 2.4, kind: 'streak' });
  }
  onKill() { if (this.r) this.r.kills++; }
  waveCleared() {
    const g = this.game, r = this.r, p = g.player;
    r.breather = 2.6;
    if (g.levels) g.levels.gain(25 + r.wave * 12, p.actor.c.x, p.actor.c.y - 110, `wave ${r.wave}`);
    if (r.wave % 2 === 0 && p.hp < this.sv.maxHp) { p.hp++; g.fx.text(p.actor.c.x, p.actor.c.y - 130, '+1 vessel', '#ffb3c8', 14); }
    if (r.wave % 3 === 0) this.offerBoon();
  }
  offerBoon() {
    const g = this.game, p = g.player;
    const left = BOONS.filter(b => !(p.temp && p.temp[b.id]) || b.id === 'mend');
    const pick = [];
    while (pick.length < 3 && left.length) pick.push(left.splice(Math.floor(Math.random() * left.length), 1)[0]);
    this.r.breather = 1e9;
    g.ui && g.ui.riftBoons && g.ui.riftBoons(pick, (b) => { this.takeBoon(b); this.r.breather = 1.2; });
  }
  takeBoon(b) {
    const g = this.game, p = g.player;
    p.temp = p.temp || {};
    if (b.id === 'mend') p.hp = this.sv.maxHp;
    else p.temp[b.id] = true;
    if (b.id === 'quick') p.actor.run = (p.baseRun || p.actor.run) * 1.2;
    if (b.id === 'vigil') { this.sv.maxHp += 2; p.tempMax = (p.tempMax || 0) + 2; p.hp += 2; }
    Audio.play('confirm');
  }
  over() {
    const g = this.game, r = this.r, sv = this.sv;
    r.over = true;
    const score = r.wave * 100 + r.kills * 10 + r.bestCombo * 5;
    const prev = sv.rift.best || 0, record = r.wave > prev;
    if (record) { sv.rift.best = r.wave; Platform.happytime && Platform.happytime(); }
    sv.rift.bestScore = Math.max(sv.rift.bestScore || 0, score);
    g.saveNow && g.saveNow();
    if (g.ui && g.ui.surgeHud) g.ui.surgeHud(null);
    setTimeout(() => this.showResults({ wave: r.wave, kills: r.kills, combo: r.bestCombo, score, best: sv.rift.best, record }), 1100);
  }
  showResults(o) {
    const g = this.game;
    let el = this.resEl;
    if (!el) { el = this.resEl = document.createElement('div'); el.id = 'rift-res'; document.getElementById('ui').appendChild(el); }
    el.innerHTML = `<div class="rr-card"><em>${o.record ? 'A new best' : 'The rift closes'}</em><h2>Wave ${o.wave}</h2>
      <div class="rr-stats"><span><b>${o.kills}</b>undone</span><span><b>${o.combo}</b>best combo</span><span><b>${o.score}</b>score</span><span><b>${o.best}</b>best wave</span></div>
      <div class="rr-btns"><button class="btn primary again">Again</button><button class="btn leave">Leave</button></div></div>`;
    el.classList.add('on');
    el.querySelector('.again').onclick = () => { Audio.play('confirm'); this.restart(); };
    el.querySelector('.leave').onclick = () => { Audio.play('blip'); this.leave(); };
    document.body.classList.add('modal');
  }
  hideResults() { if (this.resEl) this.resEl.classList.remove('on'); document.body.classList.remove('modal'); }
  // the tears at both ends of the arena
  lights(arr) { if (!this.active) return; for (const s of [-1, 1]) arr.push({ x: s * (HALF - 2) * TILE, y: this.gy * TILE - 70, c: [1, 0.3, 0.3], s: 1.3 }); }
  draw(ctx, a, layer) {
    if (!this.active || layer !== 'back') return;
    const t = this.game.time;
    for (const side of [-1, 1]) {
      const cx = side * (HALF - 2) * TILE, base = this.gy * TILE - 6, H = 130;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, cx, base - H / 2, 110, [1, 0.3, 0.25], 0.5);
      ctx.globalCompositeOperation = 'source-over';
      for (const [k, col] of [[1.2, '#ff7a5a'], [0.95, '#12060a']]) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, base - H);
        for (let i = 1; i <= 12; i++) { const u = i / 12; ctx.lineTo(cx + (Math.sin(u * Math.PI) * 26 * k + Math.sin(i * 2.7 + t * 9) * 3), base - H + u * H); }
        for (let i = 11; i >= 1; i--) { const u = i / 12; ctx.lineTo(cx - (Math.sin(u * Math.PI) * 26 * k + Math.sin(i * 1.9 + t * 8) * 3), base - H + u * H); }
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
}
