// Things to do in the world, placed deterministically from the seed:
//  - Lost dolls lying where they fell: wake them (E). They thank you and walk home.
//  - Chests: open them (E or strike) for glimmer, blocks and sometimes a new look.
//  - Lost stitches: glowing spools of her thread, often up a ledge or down a cave. Each holds a line of lore.
//  - Hollow nests: thorned mounds that keep birthing Hollows until you break them.
// Every doll, stitch and nest gives a Thread of Light. Gates stay sealed until you carry enough of them.
import { Audio } from '../core/audio.js';
import { Actor } from './actor.js';
import { P } from '../physics/body.js';
import { TILE, T, TILES, gateNear, BIOME_W, townNear } from '../world/tiles.js';
import { ARENA_HALF } from '../world/world.js';
import { hash2, rand, clamp, lerp, sign, TAU, rgba } from '../core/util.js';
import { drawGlow } from '../world/light.js';
import { softDisc, capsule, ballShade, shade } from '../art/paint.js';
import { IMG } from '../art/images.js';
import { lookFromSave, newSave, COSMETICS, Save } from './progress.js';

export const LORE = [
  'She sewed the sky first, so the dolls would have something to look up at.',
  'The first doll was made of a curtain and a button. It never stood. She made the second one better.',
  'Every doll has a thread inside. Hers ran through all of them, like one long stitch.',
  'When she left, she took the needle and left the thread. The thread began to fray.',
  'The Wardens were her needles once. Without her hand they only know how to pierce and hold.',
  'Hollows are dolls whose thread snapped. They remember walking. They hate that they remember.',
  'The keepers light fires because she said she would come back to the brightest one.',
  'She cut the Glass Wood from a broken mirror, so the light would have somewhere to stay.',
  'The Hollow Below is a pocket she forgot to stitch shut.',
  'Embers are the last warm thing she touched. They have not cooled since.',
  'In the Frost Spires the wind stopped to listen for her footsteps. It is still listening.',
  'Some say the world has no edge. Others say she never finished the hem.',
  'A doll back on two feet frightens the Wardens. It means the stitch held.',
  'Every gate holds a piece of her light. Put them back together and you might see her face.',
  'Thread is not a moth. Thread is the last thing she said.',
  'If you are reading this, you were made with care. Keep walking.',
];
export const gateReq = (tier) => 10 + tier * 5;

const near = (a, b, d) => Math.abs(a - b) < d;

export class Content {
  constructor(game) {
    this.game = game;
    this.dolls = new Map(); this.chests = new Map(); this.stitches = new Map(); this.nests = new Map();
    this.scanT = 0;
  }
  get sv() { return this.game.save; }
  ok(x) {
    const W = this.game.world;
    if (Math.abs(x) < 26) return false;
    const g = gateNear(x);
    if (Math.abs(x - g.gx) < ARENA_HALF + 12) return false;
    if (W.shrineNear(x) !== null) return false;
    if (townNear(x, 14)) return false;
    if (W.mouthAt && (W.mouthAt(x, W.surface(x), W.surface(x)) || W.mouthAt(x, W.surface(x) + 1, W.surface(x)))) return false;
    return true;
  }
  // deterministic sites in [a, b] tiles
  sites(kind, a, b) {
    const spec = { doll: [36, 21, 1], chest: [52, 31, 2], stitch: [47, 17, 3], nest: [110, 75, 4], brazier: [131, 64, 5], plates: [167, 95, 6], race: [149, 40, 7], camp: [157, 112, 8] }[kind];
    const [step, off, salt] = spec;
    const out = [];
    for (let k = Math.floor((a - off) / step) - 1; k <= Math.ceil((b - off) / step) + 1; k++) {
      const x = k * step + off + Math.floor(hash2(k, salt, this.game.world.seed) * 16);
      if (x < a || x > b || !this.ok(x)) continue;
      if ((kind === 'nest' || kind === 'camp') && Math.abs(x) < 130) continue;   // the first stretch is for learning
      if (kind !== 'doll' && kind !== 'chest' && kind !== 'stitch' && kind !== 'nest' && Math.abs(x) < 45) continue;
      out.push(x);
    }
    return out;
  }
  // a cave floor under the surface, if one is close
  caveSpot(tx) {
    const W = this.game.world, s = W.surface(tx);
    for (let ty = s + 6; ty < s + 40; ty++) if (!W.solid(tx, ty) && !W.solid(tx, ty - 1) && !W.solid(tx, ty - 2) && W.solid(tx, ty + 1)) return ty + 1;
    return null;
  }
  update(dt) {
    const g = this.game, p = g.player;
    if (!p || (g.net && g.net.visiting)) return;
    this.scanT -= dt;
    const ptx = Math.floor(p.x / TILE);
    if (this.scanT <= 0) {
      this.scanT = 0.5;
      const a = ptx - 80, b = ptx + 80;
      for (const x of this.sites('doll', a, b)) if (!this.dolls.has(x) && !this.sv.rescued[x]) this.spawnDoll(x);
      for (const x of this.sites('chest', a, b)) if (!this.chests.has(x)) this.chests.set(x, this.makeChest(x));
      for (const x of this.sites('stitch', a, b)) if (!this.stitches.has(x) && !this.sv.stitches[x]) this.stitches.set(x, this.makeStitch(x));
      for (const x of this.sites('nest', a, b)) if (!this.nests.has(x) && !this.sv.nests[x]) this.spawnNest(x);
      // keep everything standing on the real ground: mining under it, building, or a town or turf pass
      // changing the column moves it with the floor
      const W = g.world;
      for (const [x, c] of this.chests) if (!c.cave) { const ty = W.floorTy(x, Math.round(c.y / TILE)); c.y = ty * TILE; if (c.ent) c.ent.c.y = ty * TILE - 14; }
      for (const [x, n] of this.nests) if (n.ent && n.ent.mode !== 'dead') n.ent.c.y = W.floorTy(x, Math.round((n.ent.c.y + 26) / TILE)) * TILE - 26;
      for (const [x, st] of this.stitches) if (!st.cave && !st.got && st.lift) st.py = W.floorTy(x, Math.round((st.py + st.lift) / TILE)) * TILE - st.lift;
      for (const m of [this.dolls, this.chests, this.stitches, this.nests]) for (const [x, o] of m) if (Math.abs(x - ptx) > 110) { if (o.actor) o.actor.removed = true; if (o.ent) o.ent.removed = true; m.delete(x); }
    }
    // dolls being woken walk away
    for (const [x, d] of this.dolls) {
      if (d.state === 'thanks') {
        d.t -= dt;
        const a = d.actor, ph = 5.2 - d.t;
        a.look_at = { x: p.x, y: p.y - 60 };
        // sit up, rise, stretch, then wave
        if (ph > 1.0 && ph < 2.1) a.scriptPose = { mode: 'getup', getup: clamp((ph - 1.0) / 1.1, 0, 1), strength: 1 };
        if (ph >= 2.1 && a.mode === 'script') {
          // stand on the real ground under the doll (not the height it lay at), then let it move normally
          a.mode = 'ctrl'; a.scriptPose = null;
          const gy = g.world.groundBelow(a.c.x, a.c.y - 70, 420);
          if (gy !== null) a.c.y = gy;
          a.c.vy = 0; a.c.vx = 0; a.c.ground = gy !== null; a.unstick && a.unstick();
          // start from a clean standing skeleton (the lying pose's joint angles must not carry over)
          if (a.anim && a.anim.cur) { a.anim.cur.fill(0); a.anim.rootY = null; a.anim.squash = a.anim.squashV = 0; }
          a.body.reset(a.c.x, a.c.y - a.pelvisH);
          a.doEmote('cheer', 0.9);
        }
        if (ph > 3.1 && !d.waved) { d.waved = true; a.face(sign(p.x - a.c.x) || 1); a.doEmote('wave', 1.6); }
        if (d.t < 0) { d.state = 'leave'; d.t = 3; }
      } else if (d.state === 'leave') {
        d.t -= dt; d.actor.intent.mx = d.dir; d.alpha = clamp(d.t / 1.2, 0, 1);
        if (d.t <= 0) { d.actor.removed = true; this.dolls.delete(x); }
      }
    }
    // stitches are taken by touch
    for (const [x, st] of this.stitches) {
      if (st.got) continue;
      st.t += dt;
      if (Math.abs(p.x - st.px) < 34 && Math.abs((p.y - 50) - st.py) < 60) this.takeStitch(x, st);
    }
    // nests birth hollows while you are near
    for (const [x, n] of this.nests) {
      const e = n.ent;
      if (e.mode === 'dead') continue;
      n.t -= dt;
      if (n.t <= 0 && Math.abs(p.x - e.c.x) < 620 && !g.cinematic && this.sv.tutDone) {
        n.t = 7;
        n.kids = n.kids.filter(k => !k.removed && k.mode !== 'dead');
        if (n.kids.length < 2) {
          const k = g.enemies.spawn('husk', e.c.x + rand(-30, 30), e.c.y + 30, g.world.tierAtX(e.c.x), '#c4b5ff');
          k.knockdown(0.5, 0, -700);
          g.fx.dust(e.c.x, e.c.y + 20, 8, '#3a3044', -Math.PI / 2, 160);
          n.kids.push(k);
        }
      }
    }
  }

  // ------------------------------------------------------------ lost dolls
  spawnDoll(x) {
    const g = this.game, W = g.world;
    const inCave = hash2(x, 9, W.seed) < 0.3 ? this.caveSpot(x) : null;
    const ty = inCave ?? W.floorTy(x);
    const sv = newSave(Math.floor(hash2(x, 2, W.seed) * 1e9));
    const colors = COSMETICS.filter(c => c.slot === 'color'), heads = ['h_none', 'h_leaf', 'h_hood', 'h_horns', 'h_tophat', 'h_antlers'], capes = COSMETICS.filter(c => c.slot === 'cape' && c.v);
    sv.look.color = colors[Math.floor(hash2(x, 3, W.seed) * colors.length)].id;
    sv.look.head = heads[Math.floor(hash2(x, 4, W.seed) * heads.length)];
    sv.look.cape = capes[Math.floor(hash2(x, 5, W.seed) * capes.length)].id;
    const look = lookFromSave(sv); look.thread = true; look.threadCol = '#bff6ff';
    const a = new Actor(g, { x: x * TILE + 16, y: ty * TILE, team: 'npc', look, facing: hash2(x, 6, W.seed) < 0.5 ? 1 : -1 });
    a.mode = 'script'; a.scriptPose = { mode: 'sleep', strength: 0.8 }; a.noCrumple = true;
    a.body.reset(a.c.x, a.c.y - 10);
    g.actors.push(a);
    this.dolls.set(x, { actor: a, state: 'lying', cave: inCave !== null, t: 0 });
  }
  wakeDoll(x) {
    const g = this.game, d = this.dolls.get(x);
    if (!d || d.state !== 'lying') return;
    g.levels && g.levels.gain(45, g.player.actor.c.x, g.player.actor.c.y - 110, 'woken');
    const a = d.actor;
    d.state = 'thanks'; d.t = 5.2; d.dir = sign(a.c.x - g.player.x) || 1;
    a.scriptPose = { mode: 'sit', strength: 1 };
    this.sv.rescued[x] = 1;
    this.sv.lights = (this.sv.lights || 0) + 1;
    const n = Object.keys(this.sv.rescued).length;
    Audio.play('chime'); Audio.play('heal');
    g.fx.ring(a.c.x, a.c.y - 30, 6, 90, 0.7, '#9ff3ff', 4);
    g.fx.souls(a.c.x, a.c.y - 30, 8, g.player.actor.c, '#bff6ff', () => { this.sv.glimmer += 2; Audio.play('soul', { gap: 0.02 }); g.ui && g.ui.glimmerBump(); });
    const lines = ['...I can feel my feet.', 'You stood? Then so can I.', 'Thank you. I’ll find the fire.', 'I was dreaming of her hands.', 'Is it morning? It feels like morning.'];
    g.story && g.story.say(lines[n % lines.length], 2.8, true);
    g.ui && g.ui.toast(`Doll woken · +1 Thread of Light (${this.sv.lights})`);
    g.saveNow();
  }

  // ------------------------------------------------------------ chests
  makeChest(x) {
    const W = this.game.world;
    const cave = hash2(x, 7, W.seed) < 0.45 ? this.caveSpot(x) : null;
    const ty = cave ?? W.floorTy(x);
    return { x: x * TILE + 16, y: ty * TILE, cave: cave !== null, open: !!this.sv.chests[x], t: this.sv.chests[x] ? 1 : 0, ent: this.chestTarget(x, ty) };
  }
  chestTarget(x, ty) {
    // a hittable proxy so a blade strike opens it too
    const self = this;
    const e = { id: 'chest' + x, team: 'prop', mode: 'ctrl', scale: 1, hitR: 18, removed: false, glows: [], c: { x: x * TILE + 16, y: ty * TILE - 14, vx: 0, vy: 0, w: 30, h: 26 },
      get cx() { return this.c.x; }, get cy() { return this.c.y; }, update() {}, draw() {}, hurt() { self.openChest(x); return 'armor'; } };
    return e;
  }
  openChest(x) {
    const g = this.game, c = this.chests.get(x);
    if (!c || c.open) return;
    g.levels && g.levels.gain(30, g.player.actor.c.x, g.player.actor.c.y - 110, 'chest');
    c.open = true;
    this.sv.chests[x] = 1;
    const R = () => hash2(x, Math.floor(Math.random() * 1000), 1);
    const gl = 12 + Math.floor(R() * 22) + g.world.tierAtX(c.x) * 10;
    g.fx.souls(c.x, c.y - 20, 10, g.player.actor.c, '#ffe7a8', () => { this.sv.glimmer += Math.ceil(gl / 10); Audio.play('soul', { gap: 0.02, pitch: 1.2 }); g.ui && g.ui.glimmerBump(); });
    const pool = [[T.LANTERN, 2], [T.PLANK, 8], [T.GLASS, 4], [T.CRYSTAL, 2], [T.GOLD, 2], [T.BRICK, 6], [T.MARBLE, 4]];
    const [tile, n] = pool[Math.floor(Math.random() * pool.length)];
    g.player.give(tile, n); g.ui && g.ui.pickup(tile, n);
    let found = null;
    if (Math.random() < 0.3) {
      const locked = COSMETICS.filter(cm => cm.cost && !this.sv.unlocked.includes(cm.id));
      if (locked.length) { found = locked[Math.floor(Math.random() * locked.length)]; Save.unlock(found.id); }
    }
    Audio.play('chime'); Audio.play('break', { pitch: 0.7 });
    g.fx.burst(c.x, c.y - 18, { n: 26, speed: 300, col: '#ffffff', col1: '#ffd98a', add: true, life: 0.7, size: 2.6, dir: -Math.PI / 2, spread: 1.1, grav: 400 });
    g.shake(0.15);
    g.ui && g.ui.toast(found ? `Chest: ${gl} glimmer, ${TILES[tile].name}, and ${found.name}!` : `Chest: ${gl} glimmer and ${n} ${TILES[tile].name}`);
    g.saveNow();
  }

  // ------------------------------------------------------------ stitches
  makeStitch(x) {
    const W = this.game.world;
    const r = hash2(x, 8, W.seed);
    let px = x * TILE + 16, py;
    const cave = r < 0.4 ? this.caveSpot(x) : null;
    if (cave) py = cave * TILE - 40;
    const lift = r < 0.75 ? 150 : 70;   // some hover out of reach: build up or double jump
    if (!cave) py = W.floorTy(x) * TILE - lift;
    return { x, px, py, lift, t: r * 6, got: false, cave: !!cave };
  }
  takeStitch(x, st) {
    const g = this.game, sv = this.sv;
    st.got = true; sv.stitches[x] = 1;
    sv.lights = (sv.lights || 0) + 1;
    const idx = (sv.lore = sv.lore || []).length;
    const line = LORE[idx % LORE.length];
    sv.lore.push(idx % LORE.length);
    Audio.play('chime'); Audio.play('soul', { pitch: 1.4 });
    g.slowmo(0.4, 0.6);
    g.fx.ring(st.px, st.py, 4, 80, 0.6, '#bff6ff', 4);
    g.fx.burst(st.px, st.py, { n: 20, speed: 260, col: '#ffffff', col1: '#9ff3ff', add: true, life: 0.7, size: 2.4 });
    g.ui && g.ui.card('A Lost Stitch', line, 'small gain', 5);
    g.ui && g.ui.toast(`+1 Thread of Light (${sv.lights}) · lore added to your journal`);
    setTimeout(() => this.stitches.delete(x), 1500);
    g.saveNow();
  }

  // ------------------------------------------------------------ nests
  spawnNest(x) {
    const g = this.game, W = g.world;
    const ty = W.floorTy(x);
    const self = this;
    const e = { id: 'nest' + x, team: 'enemy', kind: 'nest', mode: 'ctrl', scale: 1.6, hitR: 30, hp: 140 + W.tierAtX(x * TILE) * 60, removed: false, glows: [], flash: 0,
      c: { x: x * TILE + 16, y: ty * TILE - 26, vx: 0, vy: 0, w: 60, h: 50 },
      get cx() { return this.c.x; }, get cy() { return this.c.y; },
      update(dt) { this.flash = Math.max(0, this.flash - dt * 5); }, draw() {},
      hurt(dmg, info) { this.hp -= dmg; this.flash = 1; if (this.hp <= 0 && this.mode !== 'dead') self.breakNest(x); return null; } };
    g.actors.push(e);
    this.nests.set(x, { ent: e, t: 2, kids: [] });
  }
  breakNest(x) {
    const g = this.game, n = this.nests.get(x);
    if (!n) return;
    g.levels && g.levels.gain(70, g.player.actor.c.x, g.player.actor.c.y - 110, 'nest');
    const e = n.ent;
    e.mode = 'dead'; e.removed = true;
    this.sv.nests[x] = 1;
    this.sv.lights = (this.sv.lights || 0) + 1;
    Audio.play('boom'); g.shake(0.5); g.hitstop(0.08); g.flash([0.8, 0.7, 1], 0.25);
    g.fx.ring(e.c.x, e.c.y, 8, 140, 0.6, '#c4b5ff', 6);
    g.fx.burst(e.c.x, e.c.y, { n: 30, speed: 400, col: '#ffffff', col1: '#9d8cff', add: true, life: 0.7, size: 3 });
    for (let i = 0; i < 4; i++) g.fx.debris(e.c.x + rand(-20, 20), e.c.y, T.OBSIDIAN, 4);
    g.fx.souls(e.c.x, e.c.y, 14, g.player.actor.c, '#c4b5ff', () => { this.sv.glimmer += 3; Audio.play('soul', { gap: 0.02 }); g.ui && g.ui.glimmerBump(); });
    g.story && g.story.say('The nest is quiet now. The Hollows came from somewhere... someone.', 3.4, true);
    g.ui && g.ui.toast(`Nest broken · +1 Thread of Light (${this.sv.lights})`);
    this.nests.delete(x);
    g.saveNow();
  }

  // ------------------------------------------------------------ queries for goals and Thread
  // the stretch of world the player can actually walk: out to the nearest gate on each side that is still
  // sealed (a gate whose warden fell stays open)
  reach(px) {
    const g = this.game, ptx = Math.floor(px / TILE);
    const kL = Math.floor((ptx + BIOME_W / 2) / BIOME_W), kR = kL + 1;   // boundary k sits at k*W - W/2
    let l = kL, r = kR;
    const open = (k) => g.bosses && g.bosses.defeated(k);
    for (let i = 0; i < 3 && open(l); i++) l--;
    for (let i = 0; i < 3 && open(r); i++) r++;
    return [l * BIOME_W - BIOME_W / 2 + ARENA_HALF + 2, r * BIOME_W - BIOME_W / 2 - ARENA_HALF - 2];
  }
  // where Thread leads for light: the nearest unfinished doll, stitch or nest that can be reached. Loaded
  // ones report their real position (a stitch may hang high or sit in a cave); others the ground above them.
  nearestActivity(px) {
    const [a, b] = this.reach(px);
    let best = null, bd = 1e9;
    const consider = (x, y, kind) => { const d = Math.abs(x - px); if (d < bd) { bd = d; best = { x, y, kind }; } };
    for (const kind of ['doll', 'stitch', 'nest']) for (const x of this.sites(kind, a, b)) {
      if (kind === 'doll') { if (this.sv.rescued[x]) continue; const d = this.dolls.get(x); if (d && d.state !== 'lying') continue; consider(d ? d.actor.c.x : x * TILE + 16, d ? d.actor.c.y - 40 : this.game.world.surface(x) * TILE - 40, kind); }
      else if (kind === 'stitch') { if (this.sv.stitches[x]) continue; const s = this.stitches.get(x); if (s && s.got) continue; consider(s ? s.px : x * TILE + 16, s ? s.py : this.game.world.surface(x) * TILE - 40, kind); }
      else { if (this.sv.nests[x]) continue; const n = this.nests.get(x); if (n && n.ent.mode === 'dead') continue; consider(n ? n.ent.c.x : x * TILE + 16, n ? n.ent.c.y : this.game.world.surface(x) * TILE - 40, kind); }
    }
    return best;
  }
  interactables() {
    const out = [];
    for (const [x, d] of this.dolls) if (d.state === 'lying') out.push({ x: d.actor.c.x, y: d.actor.c.y - 20, r: 80, label: 'Wake the doll', verb: 'Wake', act: () => this.wakeDoll(x) });
    for (const [x, c] of this.chests) if (!c.open) out.push({ x: c.x, y: c.y - 20, r: 70, label: 'Open the chest', verb: 'Open', act: () => this.openChest(x) });
    return out;
  }
  targets() { const out = []; for (const c of this.chests.values()) if (!c.open) out.push(c.ent); return out; }
  lights(arr) {
    for (const s of this.stitches.values()) if (!s.got) arr.push({ x: s.px, y: s.py, c: [0.6, 0.95, 1], s: 0.85 });
    for (const n of this.nests.values()) arr.push({ x: n.ent.c.x, y: n.ent.c.y, c: [0.55, 0.4, 0.9], s: 0.7 });
    for (const c of this.chests.values()) if (!c.open) arr.push({ x: c.x, y: c.y - 16, c: [1, 0.85, 0.5], s: 0.45 });
  }
  draw(ctx, a, layer) {
    const g = this.game, t = g.time;
    if (layer === 'back') {
      for (const n of this.nests.values()) drawNest(ctx, n.ent.c.x, n.ent.c.y + 26, t, n.ent.flash);
      // an opened chest lingers a moment, then fades away
      for (const c of this.chests.values()) {
        if (c.open) { c.t = Math.min(1, c.t + 0.05); if (c.openT == null) c.openT = t; }
        const fade = c.open ? 1 - clamp((t - c.openT - 2.2) / 0.9, 0, 1) : 1;
        if (fade <= 0) continue;
        ctx.save(); ctx.globalAlpha *= fade;
        if (fade < 1) { ctx.translate(c.x, c.y); ctx.scale(1, 0.85 + 0.15 * fade); ctx.translate(-c.x, -c.y); }
        drawChest(ctx, c.x, c.y, c.t, t); ctx.restore();
        if (fade < 1 && !c.puffed) { c.puffed = true; g.fx.dust(c.x, c.y - 6, 10, '#e8dccb', -Math.PI / 2, 90); g.fx.burst(c.x, c.y - 14, { n: 10, speed: 70, col: '#fff1d0', col1: '#ffd9a0', add: true, life: 0.8, size: 2, kind: 'mote' }); }
      }
    }
    if (layer === 'front') {
      for (const s of this.stitches.values()) if (!s.got) drawStitch(ctx, s.px, s.py + Math.sin(t * 2 + s.t) * 5, t + s.t);
      // sleeping dolls glint so you notice them
      for (const d of this.dolls.values()) if (d.state === 'lying') {
        const b = d.actor.body, cx = b.x[P.CHEST], cy = b.y[P.CHEST];
        const br = 0.5 + Math.sin(t * 1.4) * 0.5;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, cx, cy, 26 + br * 14, [0.62, 0.95, 1], 0.25 + br * 0.2);
        // breath motes drift up from the sleeper
        for (let i = 0; i < 3; i++) { const u = ((t * 0.35 + i / 3) % 1); ctx.fillStyle = rgba('#dff6ff', 0.5 * Math.sin(u * Math.PI)); ctx.beginPath(); ctx.arc(b.x[P.HEAD] + Math.sin(u * 6 + i) * 5, b.y[P.HEAD] - 10 - u * 34, 1.6 + u * 1.6, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
    }
  }
}

// a soft hollow of moss where a doll fell asleep
export function drawMossBed(g, x, y, k) {
  g.save(); g.globalAlpha = k;
  softDisc(g, x, y + 2, 46, '#000000', 0.3);
  const cols = ['#5f7a4a', '#6f8f5a', '#7fa36b', '#4f6a42'];
  for (let i = 0; i < 9; i++) {
    const u = i / 8 - 0.5, bx = x + u * 70, by = y + 2 - Math.cos(u * Math.PI) * 4;
    ballShade(g, bx, by, 7 + (i % 3) * 2.5, cols[i % 4], { dark: 0.3 });
  }
  for (let i = 0; i < 4; i++) { g.fillStyle = ['#f3e6d0', '#d6c7f0', '#f0b7a6', '#f3e6d0'][i]; g.beginPath(); g.arc(x - 26 + i * 17, y - 4 - (i % 2) * 3, 2.2, 0, TAU); g.fill(); }
  g.restore();
}
export function drawChest(g, x, y, open, t) {
  const im = IMG['req/chest'];
  if (im) {
    // the painted chest, split at the lid seam: the lid swings back on its hinge and light spills out
    const w = 42, h = w * im.height / im.width, cut = 0.42, lidH = h * cut, bodyH = h - lidH;
    const sy = im.height * cut;
    g.save();
    softDisc(g, x, y, 32, '#000000', 0.35);
    if (open > 0) {
      g.fillStyle = '#1a120c'; g.beginPath(); g.roundRect(x - w / 2 + 3, y - bodyH - 3, w - 6, 6, 2); g.fill();
      g.save(); g.globalCompositeOperation = 'lighter';
      softDisc(g, x, y - bodyH, 46, '#ffd98a', 0.55 * (1 - open * 0.5));
      const gr = g.createLinearGradient(0, y - bodyH - 60, 0, y - bodyH);
      gr.addColorStop(0, rgba('#ffe7b0', 0)); gr.addColorStop(1, rgba('#ffe7b0', 0.35 * (1 - open * 0.4)));
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - 10, y - bodyH - 60); g.lineTo(x + 10, y - bodyH - 60); g.lineTo(x + w / 2 - 4, y - bodyH); g.lineTo(x - w / 2 + 4, y - bodyH); g.closePath(); g.fill();
      g.restore();
    }
    g.drawImage(im, 0, sy, im.width, im.height - sy, x - w / 2, y - bodyH, w, bodyH);
    g.save(); g.translate(x - w / 2, y - bodyH); g.rotate(-open * 1.75);
    g.drawImage(im, 0, 0, im.width, sy, 0, -lidH, w, lidH);
    g.restore();
    if (!open) { g.globalCompositeOperation = 'lighter'; softDisc(g, x, y - bodyH, 24, '#ffd98a', 0.12 + Math.sin(t * 2.5) * 0.07); }
    g.restore();
    return;
  }
  g.save();
  softDisc(g, x, y, 30, '#000000', 0.35);
  const w = 30, h = 20;
  const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  gr.addColorStop(0, '#5e4230'); gr.addColorStop(0.5, '#8a6142'); gr.addColorStop(1, '#4a3424');
  g.fillStyle = gr; g.beginPath(); g.roundRect(x - w / 2, y - h, w, h, 3); g.fill();
  g.fillStyle = '#d9a441'; g.fillRect(x - w / 2, y - h + 6, w, 2.5); g.fillRect(x - 9, y - h, 2.5, h); g.fillRect(x + 6.5, y - h, 2.5, h);
  // lid opening on a hinge at the back
  g.save(); g.translate(x - w / 2, y - h); g.rotate(-open * 1.9);
  const lg = g.createLinearGradient(0, -12, 0, 0); lg.addColorStop(0, '#a07450'); lg.addColorStop(1, '#5e4230');
  g.fillStyle = lg; g.beginPath(); g.roundRect(0, -11, w, 11, [8, 8, 1, 1]); g.fill();
  g.fillStyle = '#d9a441'; g.fillRect(w / 2 - 2.5, -6, 5, 6);
  g.restore();
  if (open > 0) { g.globalCompositeOperation = 'lighter'; softDisc(g, x, y - h, 40, '#ffd98a', 0.5 * (1 - open * 0.6)); }
  else { g.globalCompositeOperation = 'lighter'; softDisc(g, x, y - h / 2, 22, '#ffd98a', 0.15 + Math.sin(t * 2.5) * 0.08); }
  g.restore();
}
export function drawStitch(g, x, y, t) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  softDisc(g, x, y, 46, '#9ff3ff', 0.35 + Math.sin(t * 3) * 0.08);
  g.globalCompositeOperation = 'source-over';
  // a spool wound with her thread
  g.translate(x, y); g.rotate(Math.sin(t) * 0.2);
  capsule(g, -9, -8, 9, -8, 2.2, 2.2, '#c9a45c', { dark: 0.4, hi: 0.3 });
  capsule(g, -9, 8, 9, 8, 2.2, 2.2, '#c9a45c', { dark: 0.4, hi: 0.3 });
  const gr = g.createLinearGradient(-6, 0, 6, 0); gr.addColorStop(0, '#5fb8c8'); gr.addColorStop(0.5, '#e9fbff'); gr.addColorStop(1, '#5fb8c8');
  g.fillStyle = gr; g.beginPath(); g.roundRect(-6, -7, 12, 14, 2); g.fill();
  g.strokeStyle = '#bff6ff'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(6, 2); g.bezierCurveTo(14, 6, 10, 16, 18 + Math.sin(t * 4) * 3, 20); g.stroke();
  g.restore();
}
export function drawNest(g, x, y, t, flash) {
  const im = IMG['req/nest'];
  if (im) {
    g.save();
    softDisc(g, x, y, 62, '#000000', 0.4);
    const p = 0.6 + Math.sin(t * 3) * 0.25, br = 1 + Math.sin(t * 3) * 0.02, w = 120 * br, h = w * im.height / im.width;
    if (flash > 0) g.filter = 'brightness(1.8)';
    g.drawImage(im, x - w / 2, y - h + 6, w, h);
    g.filter = 'none';
    g.globalCompositeOperation = 'lighter';
    softDisc(g, x, y - h * 0.42, 40, '#9d8cff', 0.45 * p);
    g.restore();
    return;
  }
  g.save();
  softDisc(g, x, y, 60, '#000000', 0.4);
  // thorned mound
  g.fillStyle = flash > 0 ? '#5a4e6a' : '#241e2c';
  g.beginPath(); g.moveTo(x - 44, y);
  for (let i = 0; i <= 10; i++) { const u = i / 10, xx = x - 44 + u * 88, h = Math.sin(u * Math.PI) * 46; g.lineTo(xx, y - h - (i % 2 ? 14 : 0)); }
  g.lineTo(x + 44, y); g.closePath(); g.fill();
  g.strokeStyle = '#3a3044'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const a = -Math.PI * (0.15 + i * 0.14); g.beginPath(); g.moveTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26); g.lineTo(x + Math.cos(a) * 52, y + Math.sin(a) * 52); g.stroke(); }
  // pulsing heart inside
  g.globalCompositeOperation = 'lighter';
  const p = 0.6 + Math.sin(t * 3) * 0.25;
  softDisc(g, x, y - 20, 34, '#9d8cff', 0.5 * p);
  g.fillStyle = rgba('#e6deff', 0.8 * p); g.beginPath(); g.ellipse(x, y - 20, 5, 8, 0, 0, TAU); g.fill();
  g.restore();
}
