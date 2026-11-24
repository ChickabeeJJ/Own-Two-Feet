// Towns: one in every biome, a safe place on level ground with a cobbled street. A general store, a
// smithy (weapon upgrades), a tailor (looks), an alchemist (draughts, flares, charges, infusions), an inn
// (rest, save, the Well Rested bonus), a notice board with bounties, a waystone to travel between towns
// you have found, and a training yard with the gate to the Rift Trials. Townsfolk walk the street.
// Every prop is drawn in code for now; a painted IMG['town/<name>'] replaces it when it arrives.
import { Audio } from '../core/audio.js';
import { Actor } from './actor.js';
import { TILE, T, TILES, townNear, townCenter, TOWN_HALF, biomeOf, biomeIndexAt } from '../world/tiles.js';
import { BUILDINGS, PROPS, TOWN_NAMES } from '../world/townplan.js';
import { LOOKS } from './npcs.js';
import { WEAPONS, weaponId } from './weapons.js';
import { IMG } from '../art/images.js';
import { softDisc, capsule, ballShade } from '../art/paint.js';
import { drawGlow } from '../world/light.js';
import { rand, clamp, rgba, hash2, TAU, lerp } from '../core/util.js';

const KEEPER = { store: ['wanderer', 'Merchant'], smithy: ['smith', 'Smith'], tailor: ['tailor', 'Tailor'], alchemist: ['sage', 'Alchemist'], inn: ['wanderer', 'Innkeeper'] };
const FOLK_COLS = ['#efe6d6', '#d8c8ae', '#c9b48a', '#eab3b8', '#b8c8d8', '#c0d8b8', '#d8b8e0'];
const BARKS = ['Mind the rift-scars on the road.', 'Fresh bread at the inn!', 'They say a Warden stirs past the gate.', 'Another doll on two feet? Welcome.', 'The smith can make that edge sing.', 'Bounties on the board, if you have the nerve.', 'Lovely evening for it.', 'My cousin crossed the gate. Never wrote back.'];
const STORE = [
  { id: T.PLANK, n: 10, cost: 10 }, { id: T.BRICK, n: 8, cost: 12 }, { id: T.GLASS, n: 6, cost: 14 }, { id: T.LANTERN, n: 2, cost: 16 },
  { id: T.TORCH, n: 6, cost: 10 }, { id: T.LADDER, n: 6, cost: 10 }, { id: T.CRYSTAL, n: 2, cost: 28 }, { id: T.GOLD, n: 2, cost: 34 },
];
const POTIONS = [
  { id: 'i_draught', n: 1, cost: 26 }, { id: 'i_flare', n: 3, cost: 18 }, { id: 'i_charge', n: 2, cost: 30 },
  { id: 'i_infuse_ember', n: 1, cost: 90 }, { id: 'i_infuse_frost', n: 1, cost: 90 },
];
const SELL = { [T.STONE]: 1, [T.DIRT]: 0.5, [T.LOG]: 2, [T.PLANK]: 1, [T.CRYSTAL]: 8, [T.GOLD]: 10, [T.OBSIDIAN]: 14, [T.SAND]: 1, [T.ICE]: 2, [T.EMBER]: 6, [T.MOSS]: 1 };

export class Towns {
  constructor(game) { this.game = game; this.folk = new Map(); this.cur = null; }
  get sv() { return this.game.player.sv; }
  reset() { for (const list of this.folk.values()) for (const a of list) a.removed = true; this.folk.clear(); this.cur = null; }
  // ------------------------------------------------------------ queries
  townAt(x) { const tn = townNear(Math.floor(x / TILE), 0); return tn && Math.abs(Math.floor(x / TILE) - tn.cx) <= TOWN_HALF ? tn : null; }
  safeAt(x) { const tn = townNear(Math.floor(x / TILE), 6); return !!tn; }
  name(bi) { const B = biomeOf(bi); const loop = Math.floor(Math.abs(bi) / 5); return (TOWN_NAMES[B.id] || 'Haven') + (loop ? ' ' + ['', 'II', 'III', 'IV', 'V'][Math.min(4, loop)] : ''); }
  base(cx) { return this.game.world.col(cx).h; }
  nearUnvisited(x) {
    const tn = townNear(Math.floor(x / TILE), 80);
    return tn && !(this.sv.towns && this.sv.towns[tn.bi]) && Math.abs(Math.floor(x / TILE) - tn.cx) > TOWN_HALF;
  }
  // ------------------------------------------------------------ per frame
  update(dt) {
    const g = this.game, p = g.player;
    if (!p || (g.rift && g.rift.active)) return;
    if (p.wellRested > 0) p.wellRested -= dt;
    const tx = Math.floor(p.x / TILE);
    // townsfolk live while you are near
    const tn = townNear(tx, 120);
    for (const [bi, list] of this.folk) if (!tn || tn.bi !== bi) { for (const a of list) a.removed = true; this.folk.delete(bi); }
    if (tn && !this.folk.has(tn.bi)) this.populate(tn);
    if (tn) for (const a of this.folk.get(tn.bi) || []) this.walk(a, dt);
    // Hollows never cross into a town: any that wander in come apart at the gate
    if (tn) for (const e of g.actors) {
      if (e.team !== 'enemy' || e.isBoss || e.removed || e.mode === 'dead' || e.kind === 'dummy' || (g.story && e === g.story.firstFoe)) continue;
      if (Math.abs(Math.floor(e.c.x / TILE) - tn.cx) <= TOWN_HALF - 1) { e.removed = true; g.fx.burst(e.c.x, e.c.y - 40, { n: 14, speed: 160, col: '#ffffff', col1: '#9ff3ff', add: true, life: 0.6, size: 2.2, kind: 'mote' }); }
    }
    // arriving
    const inT = this.townAt(p.x);
    if (inT && (!this.cur || this.cur.bi !== inT.bi)) this.arrive(inT);
    this.cur = inT;
    document.body.classList.toggle('in-town', !!inT);
  }
  arrive(tn) {
    const g = this.game, sv = this.sv;
    sv.towns = sv.towns || {};
    const first = !sv.towns[tn.bi];
    sv.towns[tn.bi] = { v: 1 };
    g.story && g.story.card(this.name(tn.bi), first ? 'a town · trade, rest, take bounties' : 'safe within the walls', 'small', 3);
    if (first) {
      if (g.levels) g.levels.gain(120, g.player.actor.c.x, g.player.actor.c.y - 120, 'new town');
      if (g.story) g.story.say('A town! No Hollows inside the gates. The inn, the smith, the board, the waystone. Look around.', 4, true);
      Audio.play('chime', { pitch: 0.9 });
      g.saveNow && g.saveNow();
    }
  }
  populate(tn) {
    const g = this.game, list = [], base = this.base(tn.cx);
    for (const B of BUILDINGS) {
      const k = KEEPER[B.kind]; if (!k) continue;
      const a = this.spawn(k[0], k[1], (tn.cx + B.x + B.w / 2) * TILE, base * TILE, { keeper: B.kind });
      list.push(a);
    }
    for (let i = 0; i < 6; i++) {
      const x = tn.cx + (hash2(tn.bi, i, 7) - 0.5) * 90;
      const kind = ['wanderer', 'smith', 'tailor', 'sage'][i % 4];
      const a = this.spawn(kind, ['Townsfolk', 'Carter', 'Lamplighter', 'Baker', 'Child', 'Watch'][i], x * TILE, base * TILE, { folk: true, col: FOLK_COLS[i % FOLK_COLS.length], scale: i === 4 ? 0.72 : 1 });
      a.walkDir = hash2(tn.bi, i, 9) < 0.5 ? -1 : 1; a.walkT = rand(1, 4); a.home = tn.cx;
      list.push(a);
    }
    this.folk.set(tn.bi, list);
  }
  spawn(kind, name, x, y, o = {}) {
    const g = this.game;
    const look = Object.assign({}, LOOKS[kind]);
    if (o.col) { look.body = look.limb = o.col; }
    const a = new Actor(g, { x, y, team: 'npc', look, facing: Math.random() < 0.5 ? -1 : 1, blade: false, scale: o.scale || 1, run: 70 });
    a.npcKind = o.keeper === 'tailor' ? 'tailor' : kind; a.npcName = name; a.townKeeper = o.keeper || null; a.folk = !!o.folk;
    g.actors.push(a);
    return a;
  }
  walk(a, dt) {
    if (a.removed) return;
    const I = a.intent; I.jump = false;
    if (!a.folk) { I.mx = 0; const p = this.game.player; if (Math.abs(p.x - a.c.x) < 140) a.face(Math.sign(p.x - a.c.x) || 1); return; }
    a.walkT -= dt;
    if (a.walkT <= 0) { a.walkT = rand(2, 6); a.walkDir = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1); if (Math.random() < 0.25) this.bark(a); }
    const tx = a.c.x / TILE;
    if (tx < a.home - 44) a.walkDir = 1; else if (tx > a.home + 44) a.walkDir = -1;
    I.mx = a.walkDir * 0.35;
  }
  bark(a) { const g = this.game; if (Math.abs(g.player.x - a.c.x) < 360) g.fx.text(a.c.x, a.c.y - 110 * a.scale, BARKS[Math.floor(Math.random() * BARKS.length)], '#f3ece0', 12); }
  // ------------------------------------------------------------ things to use
  interactables() {
    const g = this.game, p = g.player, tn = this.townAt(p.x);
    if (!tn) return [];
    const base = this.base(tn.cx), out = [], y = base * TILE;
    const at = (x) => (tn.cx + x) * TILE + 16;
    for (const B of BUILDINGS) {
      const cx = (tn.cx + B.x + B.w / 2) * TILE;
      if (B.kind === 'store') out.push({ x: cx, y: y - 40, r: 120, label: 'Trade with the merchant', verb: 'Trade', act: () => this.store(tn) });
      if (B.kind === 'smithy') out.push({ x: cx, y: y - 40, r: 120, label: 'Talk to the smith', verb: 'Talk', act: () => this.smith(tn) });
      if (B.kind === 'alchemist') out.push({ x: cx, y: y - 40, r: 110, label: 'Browse the alchemist', verb: 'Trade', act: () => this.alchemist(tn) });
      if (B.kind === 'tailor') out.push({ x: cx, y: y - 40, r: 110, label: 'Talk to the tailor', verb: 'Talk', act: () => g.ui.openMenu('look') });
      if (B.kind === 'inn') out.push({ x: cx, y: y - 40, r: 150, label: 'Rest at the inn', verb: 'Rest', act: () => this.inn(tn) });
    }
    out.push({ x: at(0), y: y - 50, r: 80, label: 'Touch the waystone', verb: 'Travel', act: () => this.waystone(tn) });
    out.push({ x: at(6), y: y - 50, r: 80, label: 'Read the notice board', verb: 'Bounties', act: () => this.board(tn) });
    out.push({ x: at(-54), y: y - 50, r: 90, label: 'Enter the Rift Trials', verb: 'Rift', act: () => g.rift && g.rift.enter() });
    return out;
  }
  buy(cost, fn) {
    const g = this.game, sv = this.sv;
    if (sv.glimmer < cost) { g.ui.toast('Not enough glimmer'); Audio.play('blip', { pitch: 0.6 }); return false; }
    sv.glimmer -= cost; fn(); Audio.play('confirm'); g.saveNow && g.saveNow(); return true;
  }
  itemName(id) { return typeof id === 'number' ? TILES[id].name : (this.game.items && this.game.items.name ? this.game.items.name(id) : ({ i_draught: 'Mending Draught', i_flare: 'Flare', i_charge: 'Blast Charge', i_infuse_ember: 'Ember infusion', i_infuse_frost: 'Frost infusion' }[id] || id)); }
  store(tn) {
    const g = this.game, sv = this.sv;
    const items = STORE.map(s => ({ label: `${this.itemName(s.id)} x${s.n}`, cost: { glimmer: s.cost, items: [] }, tile: s.id, act: () => this.buy(s.cost, () => g.player.give(s.id, s.n)) }));
    // selling: everything raw you carry, at the merchant's rates
    for (const id in sv.inv) {
      const k = +id, rate = SELL[k];
      if (!rate || !(sv.inv[id] > 0)) continue;
      const n = Math.min(sv.inv[id], 10), gain = Math.max(1, Math.floor(rate * n));
      items.push({ label: `Sell ${TILES[k].name} x${n}`, cost: { glimmer: 0, items: [] }, tile: k, sell: gain, act: () => { if (g.player.take(k, n)) { sv.glimmer += gain; Audio.play('soul', { pitch: 1.2 }); g.ui.glimmerBump && g.ui.glimmerBump(); g.saveNow && g.saveNow(); } } });
    }
    g.ui.shop(`Merchant of ${this.name(tn.bi)}`, items);
  }
  alchemist(tn) {
    const g = this.game;
    g.ui.shop('Alchemist', POTIONS.map(s => ({ label: `${this.itemName(s.id)} x${s.n}`, cost: { glimmer: s.cost, items: [] }, act: () => this.buy(s.cost, () => g.player.give(s.id, s.n)) })));
  }
  smith(tn) {
    const g = this.game, sv = this.sv, wid = weaponId(sv), lv = (sv.wlvl && sv.wlvl[wid]) || 0;
    const W = WEAPONS[wid];
    const lines = [lv >= 5 ? `Your ${W.name} is as fine as I can make it.` : `That ${W.name} could cut truer. Bring me gilt and crystal.`];
    const opts = [];
    if (lv < 5) {
      const gl = 40 + lv * 45, gold = lv + 1, cry = lv;
      opts.push({ label: `Temper the ${W.name} to +${lv + 1} (${gl} glimmer, ${gold} gilt, ${cry} crystal)`, act: () => {
        if (sv.glimmer < gl || (sv.inv[T.GOLD] || 0) < gold || (sv.inv[T.CRYSTAL] || 0) < cry) { g.ui.toast('Not enough to temper it'); Audio.play('blip', { pitch: 0.6 }); return; }
        sv.glimmer -= gl; g.player.take(T.GOLD, gold); if (cry) g.player.take(T.CRYSTAL, cry);
        sv.wlvl = sv.wlvl || {}; sv.wlvl[wid] = lv + 1;
        Audio.play('clang'); Audio.play('confirm'); g.fx.ring(g.player.x, g.player.y - 50, 8, 90, 0.5, '#ffd9a0', 4);
        g.ui.toast(`${W.name} +${lv + 1}: ${Math.round((lv + 1) * 12)}% more damage`); g.saveNow && g.saveNow();
      } });
    }
    opts.push({ label: 'Use the forge here', act: () => g.ui.bag && g.ui.bag.open({ page: 'craft' }) });
    opts.push({ label: 'Farewell', act: () => {} });
    g.ui.dialog('Smith', lines, opts);
  }
  inn(tn) {
    const g = this.game, p = g.player, sv = this.sv, base = this.base(tn.cx);
    p.hp = sv.maxHp; sv.breath = Math.max(sv.breath || 0, 66);
    const B = BUILDINGS.find(b => b.kind === 'inn');
    sv.respawn = { x: (tn.cx + B.x + 2) * TILE, y: base * TILE };
    p.wellRested = 240;
    Audio.play('heal'); g.fx.ring(p.x, p.y - 40, 8, 90, 0.7, '#ffd9a0', 4);
    g.ui.toast('Rested at the inn. Well Rested: half again as much experience for four minutes.');
    g.saveNow && g.saveNow();
  }
  waystone(tn) {
    const g = this.game, sv = this.sv, ui = g.ui;
    const known = Object.keys(sv.towns || {}).map(Number).filter(b => b !== tn.bi).sort((a, b) => a - b);
    if (!known.length) { ui.dialog('Waystone', ['The stone hums. Touch another waystone and you can step between them.'], [{ label: 'Farewell', act: () => {} }]); return; }
    ui.dialog('Waystone', ['The stone hums with every town you have found.'], known.map(b => ({ label: `Travel to ${this.name(b)}`, act: () => this.travel(b) })).concat([{ label: 'Stay', act: () => {} }]));
  }
  travel(bi) {
    const g = this.game, p = g.player, cx = townCenter(bi);
    g.flash([0.8, 0.95, 1], 0.5); Audio.play('chime', { pitch: 0.7 });
    const y = this.base(cx) * TILE;
    p.respawnAt((cx + 2) * TILE + 16, y);
    g.cam.x = p.x; g.cam.y = p.y - 80;
  }
  // bounties: one at a time, three on offer per town and day
  board(tn) {
    const g = this.game, sv = this.sv, ui = g.ui, p = () => g.player;
    const b = sv.bounty;
    if (b && b.have >= b.n) {
      ui.dialog('Notice board', [`Bounty done: ${this.bountyText(b)}. Here is your pay.`], [{ label: `Claim ${b.gl} glimmer and ${b.xp} experience`, act: () => {
        sv.glimmer += b.gl; if (g.levels) g.levels.gain(b.xp, p().x, p().y - 120, 'bounty'); sv.bounty = null; Audio.play('confirm'); g.ui.glimmerBump && g.ui.glimmerBump(); g.saveNow && g.saveNow();
      } }]);
      return;
    }
    if (b) { ui.dialog('Notice board', [`Your bounty: ${this.bountyText(b)} (${b.have}/${b.n}).`], [{ label: 'Drop it', act: () => { sv.bounty = null; } }, { label: 'Farewell', act: () => {} }]); return; }
    const day = Math.floor(Date.now() / 86400000), lvl = sv.level || 1;
    const offers = [0, 1, 2].map(i => {
      const r = hash2(tn.bi * 7 + i, day, 13), kind = ['kills', 'surge', 'brutes'][i];
      const n = kind === 'kills' ? 8 + Math.floor(r * 10) : kind === 'surge' ? 1 : 2 + Math.floor(r * 2);
      return { kind, n, have: 0, gl: Math.round((kind === 'kills' ? 3 * n : kind === 'surge' ? 45 : 22 * n) * (1 + lvl * 0.05)), xp: Math.round((kind === 'kills' ? 12 * n : kind === 'surge' ? 180 : 70 * n) * (1 + lvl * 0.06)), town: tn.bi };
    });
    ui.dialog('Notice board', ['Wanted, by order of the town:'], offers.map(o => ({ label: `${this.bountyText(o)}: ${o.gl} glimmer`, act: () => { sv.bounty = o; g.ui.toast('Bounty taken. Come back to any board when it is done.'); Audio.play('confirm'); } })).concat([{ label: 'Not now', act: () => {} }]));
  }
  bountyText(b) { return b.kind === 'kills' ? `Undo ${b.n} Hollows` : b.kind === 'surge' ? 'Clear a Hollow surge' : `Fell ${b.n} brutes`; }
  onKill(e) { const b = this.sv.bounty; if (!b || b.have >= b.n) return; if (b.kind === 'kills' || (b.kind === 'brutes' && e.kind === 'brute')) this.progress(b); }
  onSurge() { const b = this.sv.bounty; if (b && b.kind === 'surge' && b.have < b.n) this.progress(b); }
  progress(b) { b.have++; if (b.have >= b.n) { this.game.ui.toast('Bounty complete: claim it at a notice board'); Audio.play('chime'); } }
  // ------------------------------------------------------------ light and drawing
  lights(arr) {
    const p = this.game.player; if (!p) return;
    const tn = townNear(Math.floor(p.x / TILE), 80); if (!tn) return;
    const base = this.base(tn.cx);
    for (const pr of PROPS) if (pr.kind === 'lamp') arr.push({ x: (tn.cx + pr.x) * TILE + 16, y: (base - 3) * TILE, c: [1, 0.78, 0.45], s: 0.9 });
    arr.push({ x: tn.cx * TILE + 16, y: (base - 2) * TILE, c: [0.6, 0.9, 1], s: 0.8 });
    for (const B of BUILDINGS) { arr.push({ x: (tn.cx + B.x + B.w / 2) * TILE, y: (base - 3) * TILE, c: [1, 0.78, 0.5], s: 1.25 }); arr.push({ x: (tn.cx + B.x + 1) * TILE, y: (base - B.h + 1) * TILE, c: [1, 0.85, 0.65], s: 0.7 }); }
  }
  draw(ctx, a, layer) {
    if (layer !== 'back') return;
    const g = this.game, p = g.player; if (!p) return;
    const tn = townNear(Math.floor(p.x / TILE), 90); if (!tn) return;
    const base = this.base(tn.cx), gy = base * TILE, t = g.time;
    for (const B of BUILDINGS) this.drawBuilding(ctx, tn, B, gy, t);
    for (const pr of PROPS) this.drawProp(ctx, pr.kind, (tn.cx + pr.x) * TILE + 16, gy, t, tn);
  }
  drawBuilding(ctx, tn, B, gy, t) {
    const x0 = (tn.cx + B.x) * TILE, w = B.w * TILE, top = gy - B.h * TILE;
    const im = IMG['town/' + B.kind];
    if (im) { const h = (B.h + 4) * TILE; ctx.drawImage(im, x0 - TILE, gy - h, w + 2 * TILE, h); return; }
    // warm window light in the glass tiles of the back wall
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let x = 0; x < B.w; x++) for (const y of [B.h - 3, B.h - 4]) {
      if ((x % 3) !== 1 || x === 0 || x === B.w - 1) continue;
      const fl = 0.75 + Math.sin(t * 3 + x * 2 + B.x) * 0.06;
      ctx.fillStyle = rgba('#ffc27a', 0.22 * fl); ctx.fillRect(x0 + x * TILE + 3, gy - (B.h - y) * TILE - TILE + 3, TILE - 6, TILE - 6);
    }
    ctx.restore();
    // a hanging sign over the door
    const sx = x0 + w / 2, sy = top + 30;
    ctx.strokeStyle = '#3a2c2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 12, top + 8); ctx.lineTo(sx - 12, sy); ctx.moveTo(sx + 12, top + 8); ctx.lineTo(sx + 12, sy); ctx.stroke();
    ctx.fillStyle = '#6b4a32'; ctx.beginPath(); ctx.roundRect(sx - 20, sy, 40, 22, 4); ctx.fill();
    ctx.fillStyle = '#e9d9b8'; ctx.font = '600 11px Manrope, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText({ smithy: 'SMITH', store: 'STORE', inn: 'INN', tailor: 'TAILOR', alchemist: 'ALCHEMY', house: '' }[B.kind] || '', sx, sy + 15);
  }
  drawProp(ctx, kind, x, gy, t, tn) {
    const im = IMG['town/' + kind];
    if (im) { const h = { waystone: 110, well: 80, board: 70, stall: 90, lamp: 110, gate: 60, yard: 90 }[kind] || 80; const w = im.width * h / im.height; ctx.drawImage(im, x - w / 2, gy - h, w, h); return; }
    ctx.save();
    if (kind === 'waystone') {
      softDisc(ctx, x, gy, 30, '#000000', 0.3);
      const gr = ctx.createLinearGradient(x - 14, 0, x + 14, 0); gr.addColorStop(0, '#5a5560'); gr.addColorStop(0.5, '#8a8590'); gr.addColorStop(1, '#4a4550');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 14, gy); ctx.lineTo(x - 10, gy - 92); ctx.lineTo(x, gy - 104); ctx.lineTo(x + 10, gy - 92); ctx.lineTo(x + 14, gy); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const p = 0.7 + Math.sin(t * 2.2) * 0.25;
      drawGlow(ctx, x, gy - 60, 40, [0.6, 0.95, 1], 0.45 * p);
      ctx.strokeStyle = rgba('#bff6ff', 0.85 * p); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, gy - 80); ctx.lineTo(x - 5, gy - 66); ctx.lineTo(x + 5, gy - 56); ctx.lineTo(x, gy - 42); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, gy - 61, 9, 0, TAU); ctx.stroke();
    } else if (kind === 'well') {
      softDisc(ctx, x, gy, 30, '#000000', 0.3);
      ctx.fillStyle = '#7d766e'; ctx.beginPath(); ctx.roundRect(x - 22, gy - 22, 44, 22, 4); ctx.fill();
      ctx.fillStyle = '#5e5852'; for (let i = 0; i < 5; i++) ctx.fillRect(x - 22 + i * 9, gy - 22, 1.5, 22);
      ctx.fillStyle = '#5e4230'; ctx.fillRect(x - 20, gy - 60, 4, 40); ctx.fillRect(x + 16, gy - 60, 4, 40);
      ctx.fillStyle = '#8a4a3c'; ctx.beginPath(); ctx.moveTo(x - 30, gy - 56); ctx.lineTo(x, gy - 76); ctx.lineTo(x + 30, gy - 56); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a2c2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, gy - 58); ctx.lineTo(x, gy - 34); ctx.stroke();
      ctx.fillStyle = '#6b4a32'; ctx.fillRect(x - 5, gy - 36, 10, 8);
    } else if (kind === 'board') {
      ctx.fillStyle = '#5e4230'; ctx.fillRect(x - 22, gy - 66, 4, 66); ctx.fillRect(x + 18, gy - 66, 4, 66);
      ctx.fillStyle = '#7a5a3e'; ctx.beginPath(); ctx.roundRect(x - 26, gy - 70, 52, 38, 3); ctx.fill();
      const b = this.sv.bounty;
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(x - 16 + i * 11, gy - 52 + (i % 2) * 4); ctx.rotate((i - 1.5) * 0.08); ctx.fillStyle = i === 1 && b ? '#ffe7b0' : '#e9e0cc'; ctx.fillRect(-5, -9, 10, 13); ctx.restore(); }
      if (b && b.have >= b.n) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, x, gy - 52, 36, [1, 0.85, 0.5], 0.4 + Math.sin(t * 4) * 0.15); }
    } else if (kind === 'stall') {
      ctx.fillStyle = '#5e4230'; ctx.fillRect(x - 26, gy - 56, 3, 56); ctx.fillRect(x + 23, gy - 56, 3, 56);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#e9e0cc' : '#b0453a'; ctx.beginPath(); ctx.moveTo(x - 32 + i * 10.6, gy - 58); ctx.lineTo(x - 32 + (i + 1) * 10.6, gy - 58); ctx.lineTo(x - 32 + (i + 1) * 10.6, gy - 48); ctx.quadraticCurveTo(x - 32 + (i + 0.5) * 10.6, gy - 44, x - 32 + i * 10.6, gy - 48); ctx.fill(); }
      ctx.fillStyle = '#7a5a3e'; ctx.fillRect(x - 24, gy - 24, 48, 6);
      for (const [dx, c] of [[-16, '#e2b85a'], [-4, '#c0453a'], [8, '#8fbf6a'], [18, '#e2b85a']]) ballShade(ctx, x + dx, gy - 28, 4, c, { dark: 0.3 });
      ctx.fillStyle = '#6b4a32'; ctx.fillRect(x - 20, gy - 18, 16, 18); ctx.fillRect(x + 4, gy - 14, 14, 14);
    } else if (kind === 'lamp') {
      ctx.fillStyle = '#2e2a30'; ctx.fillRect(x - 2, gy - 96, 4, 96); ctx.fillRect(x - 2, gy - 96, 16, 3);
      ctx.fillStyle = '#3a3438'; ctx.fillRect(x + 8, gy - 93, 10, 14);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, x + 13, gy - 86, 46, [1, 0.8, 0.5], 0.5 + Math.sin(t * 6 + x) * 0.05);
      ctx.fillStyle = rgba('#ffe2b0', 0.9); ctx.fillRect(x + 10, gy - 91, 6, 9);
    } else if (kind === 'gate') {
      const B = biomeOf(tn.bi);
      ctx.fillStyle = B.accent || '#c9a45c';
      ctx.beginPath(); ctx.moveTo(x - 18, gy - 8 * TILE + 32); ctx.lineTo(x + 18, gy - 8 * TILE + 32); ctx.lineTo(x + 18, gy - 8 * TILE + 92); ctx.lineTo(x, gy - 8 * TILE + 80); ctx.lineTo(x - 18, gy - 8 * TILE + 92); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba('#000000', 0.2); ctx.fillRect(x - 18, gy - 8 * TILE + 32, 36, 6);
      ctx.fillStyle = '#f3ece0'; ctx.font = '600 10px Cormorant Garamond, serif'; ctx.textAlign = 'center';
      ctx.fillText(this.name(tn.bi).toUpperCase().slice(0, 12), x, gy - 8 * TILE + 60);
    } else if (kind === 'yard') {
      // a straw target, a training doll and the rift gate's sign
      ctx.fillStyle = '#5e4230'; ctx.fillRect(x - 30, gy - 40, 3, 40);
      ballShade(ctx, x - 29, gy - 50, 13, '#d8c39a', { dark: 0.3 });
      ctx.strokeStyle = '#b0453a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x - 29, gy - 50, 8, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x - 29, gy - 50, 3, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#3a2c2a'; ctx.fillRect(x + 10, gy - 60, 3, 60);
      ctx.fillStyle = '#2a1418'; ctx.beginPath(); ctx.roundRect(x - 6, gy - 82, 36, 24, 4); ctx.fill();
      ctx.fillStyle = '#ff9a8a'; ctx.font = '700 8px Manrope, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('RIFT', x + 12, gy - 72); ctx.fillText('TRIALS', x + 12, gy - 63);
      ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, x + 12, gy - 70, 30, [1, 0.35, 0.3], 0.35 + Math.sin(t * 5) * 0.1);
    }
    ctx.restore();
  }
}
