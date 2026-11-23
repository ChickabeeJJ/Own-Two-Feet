// Shrines and the people who keep them. Shrines heal, save and become your respawn point.
// Each shrine has a keeper (wanderer, smith, sage or tailor) who can be invited to live at your hearth.
import { Audio } from '../core/audio.js';
import { Actor } from './actor.js';
import { P } from '../physics/body.js';
import { TILE, T, TILES, biomeOf, biomeIndexAt, gateNear } from '../world/tiles.js';
import { clamp, rand, hash2, mulberry, TAU, sign } from '../core/util.js';
import { drawGlow } from '../world/light.js';
import { drawShrine, drawCampfire } from '../art/props.js';
import { upgradeCost, RELICS } from './progress.js';
import { TYPES as BOSS_TYPES } from './bosses.js';

const KINDS = ['wanderer', 'smith', 'sage', 'tailor'];
const NAMES = {
  wanderer: ['Mara', 'Oskel', 'Pip', 'Tamsin', 'Wendell', 'Juniper'],
  smith: ['Brannoch', 'Hilde', 'Ostrav', 'Kettle', 'Ingot'],
  sage: ['Ysolde', 'Old Ferro', 'Amaranth', 'Quill', 'Nennet'],
  tailor: ['Lisle', 'Bobbin', 'Seraphine', 'Pell', 'Velour'],
};
const TITLE = { wanderer: 'a wanderer', smith: 'a smith', sage: 'a sage', tailor: 'a tailor' };
export const LOOKS = {
  wanderer: { body: '#d9b99a', shade: '#b0907a', mat: 'cloth', eyes: '#ffd9a0', eyeStyle: 'dots', head: 'widehat', hatCol: '#5a4636', accent: '#c8473d', pack: true, cape: { col: '#8a5a3c', style: 'scarf', len: 7 }, marks: [], rim: '#ffe2bd', bootCol: '#4a3a33' },
  smith: { body: '#b98a5e', shade: '#8f6745', mat: 'cloth', eyes: '#ffb36b', eyeStyle: 'slit', head: 'none', cape: null, apron: '#3e2c22', hammer: true, gaunt: true, armor: null, bulk: 1.18, arms: 1.22, marks: [], rim: '#ffcf9e', bootCol: '#3a2c2a' },
  sage: { body: '#ece7df', shade: '#c4bdb2', mat: 'porcelain', eyes: '#c4b5ff', eyeStyle: 'slit', head: 'halo', accent: '#f2c86a', cape: { col: '#d8d0c0', style: 'cape', len: 9 }, robe: '#e3dccd', staff: true, marks: [{ col: '#f2c86a' }], rim: '#ffffff' },
  tailor: { body: '#e3b1aa', shade: '#bd8c86', mat: 'cloth', eyes: '#9ff3ff', eyeStyle: 'dots', head: 'tophat', accent: '#d9a441', cape: { col: '#5b3f8f', style: 'scarf', len: 9 }, tape: true, sash: '#5b3f8f', marks: [], rim: '#ffe2bd', bootCol: '#2b2530' },
};
const SHOP = [
  { tile: T.LANTERN, n: 2, cost: 18 }, { tile: T.PLANK, n: 10, cost: 12 }, { tile: T.GLASS, n: 6, cost: 14 },
  { tile: T.BRICK, n: 8, cost: 14 }, { tile: T.MARBLE, n: 6, cost: 22 }, { tile: T.CRYSTAL, n: 2, cost: 30 }, { tile: T.HEARTH, n: 1, cost: 60 },
];

export function shrineKind(sx) {
  const k = Math.round((sx - 20) / 85);
  if (k === 1) return 'wanderer';
  if (k === 3) return 'smith';
  if (k === -1) return 'tailor';
  if (k === 4) return 'sage';
  return KINDS[(hash2(k, 77, 3) * 4) | 0];
}
export function shrineName(sx, kind) {
  const r = mulberry(Math.abs(sx * 7919) + 3);
  const list = NAMES[kind];
  return list[(r() * list.length) | 0];
}

export class Shrines {
  constructor(game) {
    this.game = game;
    this.map = new Map();     // sx -> shrine
    this.home = null;         // {x, y, residents: [{kind,name,actor}]}
  }
  get sv() { return this.game.save; }
  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    const ptx = Math.floor(p.x / TILE);
    for (const sx of g.world.shrinesBetween(ptx - 70, ptx + 70)) if (!this.map.has(sx)) this.create(sx);
    for (const [sx, s] of this.map) {
      if (Math.abs(sx - ptx) > 90) { if (s.npc) s.npc.removed = true; this.map.delete(sx); continue; }
      this.tick(s, dt);
    }
    this.syncHome(dt);
  }
  create(sx) {
    const g = this.game;
    const kind = shrineKind(sx), name = shrineName(sx, kind);
    const gy = g.world.surface(sx) * TILE;
    const s = { sx, kind, name, x: sx * TILE + 16, y: gy, npc: null, greeted: false, fire: true };
    const moved = this.sv.residents.some(r => r.sx === sx);
    if (!moved) s.npc = this.spawnNpc(kind, name, s.x + 46, gy, -1);
    this.map.set(sx, s);
  }
  spawnNpc(kind, name, x, y, facing) {
    const g = this.game;
    const a = new Actor(g, { x, y, team: 'npc', look: Object.assign({}, LOOKS[kind]), facing, blade: false });
    a.mode = 'script'; a.scriptPose = { mode: 'sit' };
    a.npcKind = kind; a.npcName = name;
    g.actors.push(a);
    return a;
  }
  tick(s, dt) {
    const g = this.game, p = g.player.actor;
    const a = s.npc;
    // keepers sit by the fire and stand to greet you
    if (a && !a.removed) {
      const d = Math.abs(p.c.x - a.c.x);
      a.look_at = d < 400 ? { x: p.c.x, y: p.c.y - 60 } : null;
      if (d < 230 && a.mode === 'script' && a.scriptPose.mode === 'sit') {
        a.mode = 'getup'; a.getupT = 0.3; a.scriptPose = null;
        if (!s.greeted) {
          s.greeted = true;
          setTimeout(() => { if (a.mode === 'ctrl') { a.doEmote('wave', 1.6); Audio.play('talk', { pitch: 1.2 }); } }, 900);
          if (!this.sv.met[s.sx]) {
            this.sv.met[s.sx] = { kind: s.kind, name: s.name };
            if (g.story) g.story.meet(s.name, TITLE[s.kind]);
          }
        }
      }
      if (a.mode === 'ctrl') {
        a.intent.mx = 0;
        a.face(sign(p.c.x - a.c.x) || 1);
        if (d > 420) { a.mode = 'script'; a.scriptPose = { mode: 'sit' }; }
      }
    }
    if ((g.tick % 5) === 0 && s.fire && Math.abs(p.c.x - s.x) < 1200) {
      g.fx.spawn({ x: s.x + rand(-6, 6), y: s.y - 6, vx: rand(-10, 10), vy: -rand(50, 110), life: rand(0.4, 0.8), size: rand(3, 6), size1: 0.5, col: '#fff1c0', col1: '#ff7a3a', add: true });
      if (Math.random() < 0.3) g.fx.spawn({ x: s.x + rand(-4, 4), y: s.y - 20, vx: rand(-20, 20), vy: -rand(60, 140), life: rand(1, 2), size: 1.4, size1: 0.4, col: '#ffd2a0', add: true, kind: 'drift', alpha: 0.9 });
    }
  }
  // ------------------------------------------------------------ home + residents
  syncHome(dt) {
    const g = this.game, sv = this.sv;
    if (!sv.home) return;
    const p = g.player;
    const near = Math.abs(p.x - sv.home.x) < 2200;
    if (!this.home || this.home.x !== sv.home.x) {
      if (this.home) for (const r of this.home.npcs) r.removed = true;
      this.home = { x: sv.home.x, y: sv.home.y, npcs: [] };
    }
    if (near && !this.home.npcs.length && sv.residents.length) {
      sv.residents.forEach((r, i) => {
        const a = this.spawnNpc(r.kind, r.name, sv.home.x + (i % 2 ? -1 : 1) * (60 + i * 26), sv.home.y, i % 2 ? 1 : -1);
        a.resident = true;
        this.home.npcs.push(a);
      });
    }
    if (!near && this.home.npcs.length) { for (const r of this.home.npcs) r.removed = true; this.home.npcs = []; }
    for (const a of this.home.npcs) {
      const d = Math.abs(p.x - a.c.x);
      a.look_at = d < 400 ? { x: p.x, y: p.y - 60 } : null;
      if (d < 200 && a.mode === 'script') { a.mode = 'getup'; a.getupT = 0.3; a.scriptPose = null; }
      if (a.mode === 'ctrl') { a.intent.mx = 0; a.face(sign(p.x - a.c.x) || 1); if (d > 380) { a.mode = 'script'; a.scriptPose = { mode: 'sit' }; } }
    }
  }
  setHome(tx, ty) {
    const g = this.game;
    this.sv.home = { x: tx * TILE + 16, y: (ty + 1) * TILE };
    this.sv.respawn = { x: this.sv.home.x, y: this.sv.home.y };
    if (g.story) g.story.card('Home', 'a place that remembers you', 'small');
    Audio.play('chime');
    g.saveNow();
  }

  interactables() {
    const g = this.game, out = [];
    for (const s of this.map.values()) {
      out.push({ x: s.x, y: s.y - 30, r: 70, label: 'Rest', act: () => this.rest(s) });
      if (s.npc && !s.npc.removed && s.npc.mode !== 'dead') out.push({ x: s.npc.c.x, y: s.npc.c.y - 30, r: 80, label: 'Talk to ' + s.name, act: () => this.talk(s.kind, s.name, s) });
    }
    if (this.home) {
      for (const a of this.home.npcs) out.push({ x: a.c.x, y: a.c.y - 30, r: 80, label: 'Talk to ' + a.npcName, act: () => this.talk(a.npcKind, a.npcName, null) });
      if (this.sv.home) out.push({ x: this.sv.home.x, y: this.sv.home.y - 30, r: 60, label: 'Rest at home', act: () => this.rest({ x: this.sv.home.x, y: this.sv.home.y, home: true }) });
    }
    return out;
  }
  rest(s) {
    const g = this.game, p = g.player;
    p.hp = this.sv.maxHp;
    this.sv.breath = Math.max(this.sv.breath, 33);
    this.sv.respawn = { x: s.x + (s.home ? 0 : -40), y: s.y };
    Audio.play('heal');
    g.fx.ring(p.x, p.y - 40, 8, 90, 0.7, '#ffd9a0', 4);
    g.ui && g.ui.toast(s.home ? 'Rested at home' : 'Rested. This shrine will remember you.');
    g.saveNow();
  }

  // ------------------------------------------------------------ conversation
  talk(kind, name, shrine) {
    const g = this.game, sv = this.sv, ui = g.ui;
    if (!ui) return;
    const lines = this.lines(kind, shrine);
    const opts = [];
    if (kind === 'wanderer') opts.push({ label: 'Trade', act: () => this.shop(name) });
    if (kind === 'smith') {
      const c = upgradeCost('blade', sv.lvl.blade);
      opts.push({ label: `Hone the blade`, cost: c, act: () => this.buy(c, () => { sv.lvl.blade++; ui.toast(`Blade honed (${sv.lvl.blade})`); Audio.play('clang', { pitch: 0.8 }); }) });
      const h = { glimmer: 45, items: [[T.STONE, 4]] };
      opts.push({ label: 'Forge a Hearth', cost: h, act: () => this.buy(h, () => { g.player.give(T.HEARTH, 1); ui.toast('A hearth. Place it where you want to belong.'); }) });
    }
    if (kind === 'sage') {
      const c = upgradeCost('vessel', sv.lvl.vessel);
      opts.push({ label: 'Grow a vessel', cost: c, act: () => this.buy(c, () => { sv.lvl.vessel++; sv.maxHp++; g.player.hp = sv.maxHp; ui.toast('Another vessel of life'); Audio.play('heal'); }) });
      const b = upgradeCost('breath', sv.lvl.breath);
      if (sv.lvl.breath < 3) opts.push({ label: 'Deepen breath', cost: b, act: () => this.buy(b, () => { sv.lvl.breath++; ui.toast('Healing comes faster'); }) });
    }
    if (kind === 'tailor') opts.push({ label: 'Change my look', act: () => { ui.closeDialog(); ui.openMenu('look'); } });
    if (shrine && sv.home && !sv.residents.some(r => r.sx === shrine.sx) && sv.residents.length < 6) {
      opts.push({ label: 'Come live at my hearth', act: () => {
        sv.residents.push({ kind, name, sx: shrine.sx });
        if (shrine.npc) { shrine.npc.removed = true; shrine.npc = null; }
        if (this.home) { for (const r of this.home.npcs) r.removed = true; this.home.npcs = []; }
        ui.toast(`${name} will wait for you at home`); Audio.play('chime'); g.saveNow();
      } });
    }
    opts.push({ label: 'Farewell', act: () => {} });
    Audio.play('talk');
    ui.dialog(name, lines, opts);
  }
  buy(cost, fn) {
    const g = this.game, sv = this.sv;
    if (sv.glimmer < cost.glimmer) { g.ui.toast('Not enough glimmer'); Audio.play('blip', { pitch: 0.6 }); return false; }
    for (const [t, n] of cost.items || []) if ((sv.inv[t] || 0) < n) { g.ui.toast(`Needs ${n} ${TILES[t].name}`); Audio.play('blip', { pitch: 0.6 }); return false; }
    sv.glimmer -= cost.glimmer;
    for (const [t, n] of cost.items || []) g.player.take(t, n);
    fn(); Audio.play('confirm'); g.saveNow();
    return true;
  }
  shop(name) {
    const g = this.game;
    const items = SHOP.map(s => ({ label: `${TILES[s.tile].name} x${s.n}`, cost: { glimmer: s.cost, items: [] }, tile: s.tile, act: () => this.buy({ glimmer: s.cost, items: [] }, () => g.player.give(s.tile, s.n)) }));
    g.ui.shop(name, items);
  }
  lines(kind, shrine) {
    const g = this.game, sv = this.sv;
    const gi = g.gateInfo(g.player.x);
    const next = gateNear(Math.floor(g.player.x / TILE) + (g.player.actor.facing) * 200);
    const guard = BOSS_TYPES[biomeOf(next.guard).id];
    const first = shrine && !sv.seen['talk' + shrine.sx];
    if (shrine) sv.seen['talk' + shrine.sx] = 1;
    const met = Object.keys(sv.bosses).length;
    const r = Math.random();
    const L = {
      wanderer: first ? [
        'Oh! Another one fell? And you\u2019re standing. Nobody stands anymore.',
        'The Seamstress made us, then left. Her needles hold the gates now. We call them Wardens.',
        'That glow in your chest... that\u2019s her thread. You could take her light back, gate by gate.',
        `The first gate is east. ${guard.name} holds it. Rest here first.`,
      ] : [pickR(r, ['The road goes on forever, you know. That is the nice part.', 'Bring me nothing, buy something. That is how trade works.', `Mind ${guard.name}. It hits like a falling house.`])],
      smith: first ? [
        'Hmph. You swing that blade like it owes you money.',
        'Bring me gilt from the deep veins and glimmer, and I will make it sing.',
        'And if you want a place of your own, I can forge you a hearth.',
      ] : [pickR(r, ['Edge gets dull. Everything does. Come back often.', 'Gilt veins glow faintly in deep stone. Dig.', 'A hearth makes a home. A home makes a person stay.'])],
      sage: first ? [
        'You were not made. You were dropped, and you chose to stand. That is rarer.',
        'This world has no edge. It only has the next gate, and the one after.',
        'Grow your vessels and your breath. You will need both where the light thins.',
      ] : [pickR(r, [`${met} gates have fallen to you. The world is starting to notice.`, 'Breath is what you take from a fight. Spend it to mend.', 'Every warden was once like you. They forgot to keep walking.'])],
      tailor: first ? [
        'Darling. That outfit. We need to talk.',
        'No two of us are alike. That is the only rule I care about.',
        'Bring glimmer and I will make you look like nobody else alive.',
      ] : [pickR(r, ['Cloaks are for drama. Drama is for winning.', 'Each warden you fell leaves a mark on you. Wear it proudly.', 'Change is good. Changing your hat is better.'])],
    };
    return L[kind];
  }
  lights(arr) {
    for (const s of this.map.values()) arr.push({ x: s.x, y: s.y - 20, c: [1, 0.62, 0.32], s: 0.95 + Math.sin(this.game.time * 9) * 0.04 });
    if (this.sv.home) arr.push({ x: this.sv.home.x, y: this.sv.home.y - 20, c: [1, 0.62, 0.32], s: 0.9 });
  }
  draw(ctx, a, layer) {
    if (layer !== 'back') return;
    const g = this.game;
    for (const s of this.map.values()) {
      if (Math.abs(s.x - g.cam.x) > 1400) continue;
      drawShrine(ctx, s.x - 78, s.y + 1, 0.95, g.time, true);
      drawCampfire(ctx, s.x, s.y + 1, 0.95, g.time);
    }
    if (this.sv.home && Math.abs(this.sv.home.x - g.cam.x) < 1400) drawCampfire(ctx, this.sv.home.x + 54, this.sv.home.y + 1, 0.7, g.time + 1);
  }
}
function pickR(r, arr) { return arr[(r * arr.length) | 0]; }
export { RELICS };
