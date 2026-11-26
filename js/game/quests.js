// Side quests: a Workbench starter from Thread, a chain for each kind of keeper, and three daily
// commissions. One quest is tracked: its step shows under the main objective and (if navigation is on)
// a marker points to where it happens. Steps count progress from when they start.
import { TILE, T, TILES } from '../world/tiles.js';
import { Audio } from '../core/audio.js';
import { itemName } from './items.js';
import { shrineKind } from './npcs.js';
import { COSMETICS, Save } from './progress.js';
import { rgba, TAU, clamp, hash2 } from '../core/util.js';
import { drawGlow } from '../world/light.js';

// step types: craft (id n), place (id n), have (id n), deliver (id n, to a keeper kind), kill n, wake n,
// stitch n, solve n (any puzzle), camp n, talk (keeper kind)
export const QUESTS = {
  q_bench: {
    name: 'A place to make things', giver: 'Thread', blurb: 'Thread thinks you should build somewhere to work.',
    steps: [
      { t: 'craft', id: T.PLANK, n: 4, text: 'Make planks from timber in the satchel', hint: 'strike or dig a tree trunk for timber, then open the satchel' },
      { t: 'craft', id: T.BENCH, n: 1, text: 'Craft a Workbench' },
      { t: 'place', id: T.BENCH, n: 1, text: 'Set the Workbench down in the world', hint: 'pick it on the hotbar and place it' },
      { t: 'craft', id: T.LADDER, n: 3, text: 'At the bench: make ladders', hint: 'ladders get you out of any hole' },
      { t: 'craft', id: 'w_spear', n: 1, text: 'At the bench: craft a Spear', hint: 'new weapons are made at the bench' },
    ],
    reward: { glimmer: 60, items: [['i_draught', 2]] },
  },
  q_smith: {
    name: "The Smith's Fire", giver: 'smith', blurb: 'The smith wants a forge of your own, and proof you can use it.',
    steps: [
      { t: 'craft', id: T.FORGE, n: 1, text: 'Build a Forge at your Workbench' },
      { t: 'have', id: T.GOLD, n: 3, text: 'Dig up 3 gilt ore from deep rock', hint: 'gilt shows as gold flecks below the soil' },
      { t: 'camp', n: 1, text: 'Clear a Hollow camp', hint: 'camps have stakes and a banner' },
      { t: 'talk', kind: 'smith', text: 'Tell a smith it is done' },
    ],
    reward: { glimmer: 80, items: [['i_infuse_ember', 1]] },
  },
  q_wanderer: {
    name: 'Lost Along the Road', giver: 'wanderer', blurb: 'The wanderer keeps count of the dolls who fell asleep on the road.',
    steps: [
      { t: 'wake', n: 2, text: 'Wake two lost dolls' },
      { t: 'stitch', n: 1, text: 'Find a lost stitch' },
      { t: 'deliver', id: T.PLANK, n: 10, kind: 'wanderer', text: 'Bring 10 planks to a wanderer' },
    ],
    reward: { glimmer: 90, unlock: 'k_moss' },
  },
  q_sage: {
    name: 'Her Scattered Light', giver: 'sage', blurb: 'The sage hears her light humming in old puzzles.',
    steps: [
      { t: 'solve', n: 1, text: 'Solve a puzzle: braziers, plates or a Thread race' },
      { t: 'kill', n: 8, text: 'Undo 8 Hollows' },
      { t: 'solve', n: 1, text: 'Solve another puzzle' },
      { t: 'talk', kind: 'sage', text: 'Return to a sage' },
    ],
    reward: { glimmer: 60, vessel: 1 },
  },
  q_tailor: {
    name: 'Threads for a Coat', giver: 'tailor', blurb: 'The tailor needs moss and nerve.',
    steps: [
      { t: 'have', id: T.MOSS, n: 6, text: 'Gather 6 mossstone' },
      { t: 'kill', n: 6, text: 'Undo 6 Hollows' },
      { t: 'deliver', id: T.MOSS, n: 6, kind: 'tailor', text: 'Bring the moss to a tailor' },
    ],
    reward: { glimmer: 70, unlock: 'h_hood', unlock2: 'k_ink' },
  },
};
const DAILY = [
  { t: 'kill', n: 6, text: 'Undo 6 Hollows' },
  { t: 'wake', n: 1, text: 'Wake a lost doll' },
  { t: 'camp', n: 1, text: 'Clear a Hollow camp' },
  { t: 'solve', n: 1, text: 'Solve a puzzle' },
  { t: 'mine', n: 25, text: 'Break 25 blocks' },
  { t: 'deliver', id: T.TORCH, n: 4, kind: 'any', text: 'Bring 4 torches to any keeper' },
  { t: 'deliver', id: T.BRICK, n: 6, kind: 'any', text: 'Bring 6 bricks to any keeper' },
];

export class Quests {
  constructor(game) { this.game = game; this.navOn = true; }
  get sv() { const s = this.game.save; s.quests = s.quests || {}; s.counters = s.counters || {}; return s; }
  // ---------------- counters the steps read
  counter(step) {
    const sv = this.sv, c = sv.counters;
    switch (step.t) {
      case 'craft': return (c['craft:' + step.id] || 0);
      case 'place': return (c['place:' + step.id] || 0);
      case 'have': case 'deliver': return sv.inv[step.id] || 0;
      case 'kill': return sv.stats.kills || 0;
      case 'wake': return Object.keys(sv.rescued || {}).length;
      case 'stitch': return Object.keys(sv.stitches || {}).length;
      case 'solve': return c.solve || 0;
      case 'camp': return c.camp || 0;
      case 'mine': return sv.stats.blocks || 0;
      default: return 0;
    }
  }
  progress(step, base) {
    if (step.t === 'have' || step.t === 'deliver') return Math.min(step.n, this.counter(step));
    if (step.t === 'talk') return 0;
    return Math.min(step.n, this.counter(step) - (base || 0));
  }
  stepDone(step, base) { return step.t !== 'talk' && step.t !== 'deliver' && this.progress(step, base) >= step.n; }
  onCraft(id, n) { const c = this.sv.counters; c['craft:' + id] = (c['craft:' + id] || 0) + n; }
  onPlace(id) { const c = this.sv.counters; c['place:' + id] = (c['place:' + id] || 0) + 1; }

  // ---------------- lifecycle
  start(id, quiet) {
    const sv = this.sv, Q = QUESTS[id];
    if (!Q || sv.quests[id]) return;
    sv.quests[id] = { step: 0, base: this.counter(Q.steps[0]), done: false };
    sv.qtrack = id;
    if (!quiet) {
      Audio.play('chime');
      this.game.ui && this.game.ui.card(Q.name, 'new quest · ' + Q.steps[0].text, 'small', 2.8);
    }
  }
  advance(id) {
    const g = this.game, sv = this.sv, Q = QUESTS[id], st = sv.quests[id];
    st.step++;
    if (st.step >= Q.steps.length) { this.complete(id); return; }
    st.base = this.counter(Q.steps[st.step]);
    Audio.play('confirm');
    g.ui && g.ui.toast(`${Q.name}: ${Q.steps[st.step].text}`, 'done');
  }
  complete(id) {
    const g = this.game, sv = this.sv, Q = QUESTS[id], st = sv.quests[id];
    st.done = true;
    g.levels && g.levels.gain(150, g.player.actor.c.x, g.player.actor.c.y - 110, 'quest');
    const r = Q.reward || {};
    const got = [];
    if (r.glimmer) { sv.glimmer += r.glimmer; got.push(r.glimmer + ' glimmer'); }
    for (const [it, n] of r.items || []) { g.player.give(it, n); got.push(n + ' ' + itemName(it)); }
    for (const u of [r.unlock, r.unlock2]) if (u && Save.unlock(u)) { const c = COSMETICS.find(c => c.id === u); got.push(c ? c.name : u); }
    if (r.vessel) { sv.maxHp += r.vessel; g.player.hp = sv.maxHp; got.push('a new vessel of life'); }
    Audio.play('chime'); Audio.play('heal');
    g.ui && g.ui.card('Quest complete', Q.name + ' · ' + got.join(', '), 'small gain', 3.4);
    if (sv.qtrack === id) sv.qtrack = this.nextTrackable();
    g.saveNow && g.saveNow();
  }
  nextTrackable() {
    const sv = this.sv;
    for (const id in sv.quests) if (!sv.quests[id].done) return id;
    return this.dailyActive() ? 'daily' : null;
  }
  // per tick: finish steps whose counts are reached; start the Workbench quest after the first rest
  update(dt) {
    const sv = this.sv, g = this.game;
    if (!g.player || !g.story || g.story.stage < 5) return;
    if (!sv.quests.q_bench && sv.respawn && sv.tutDone) { this.start('q_bench'); g.story.say('You could use a workbench. Let me show you.', 3.2); }
    for (const id in sv.quests) {
      const st = sv.quests[id];
      if (st.done) continue;
      const step = QUESTS[id].steps[st.step];
      if (step && this.stepDone(step, st.base)) this.advance(id);
    }
    this.daily();
  }
  // ---------------- daily commissions
  dayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  daily() {
    const sv = this.sv, day = this.dayKey();
    if (!sv.daily || sv.daily.day !== day) {
      const seed = [...day].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
      const pool = DAILY.slice(), list = [];
      for (let i = 0; i < 3; i++) { const k = Math.floor(hash2(seed, i, 99) * pool.length); const d = pool.splice(k, 1)[0]; list.push(Object.assign({}, d, { base: this.counter(d), done: false })); }
      sv.daily = { day, list, claimed: false };
    }
    for (const d of sv.daily.list) if (!d.done && d.t !== 'deliver' && this.progress(d, d.base) >= d.n) { d.done = true; Audio.play('confirm'); this.game.ui && this.game.ui.toast('Commission done: ' + d.text, 'done'); }
  }
  dailyActive() { const d = this.sv.daily; return d && !d.claimed; }
  // ---------------- keeper dialogue hooks: start a chain, hand things in, finish talk steps, claim commissions
  dialogOpts(kind, name) {
    const g = this.game, sv = this.sv, opts = [];
    const chain = 'q_' + kind;
    if (QUESTS[chain] && !sv.quests[chain]) opts.push({ label: `Ask about ${QUESTS[chain].name}`, close: true, act: () => { this.start(chain); g.ui.toast(QUESTS[chain].blurb); } });
    for (const id in sv.quests) {
      const st = sv.quests[id]; if (st.done) continue;
      const step = QUESTS[id].steps[st.step];
      if (step.t === 'talk' && step.kind === kind) opts.push({ label: `${QUESTS[id].name}: it is done`, close: true, act: () => this.advance(id) });
      if (step.t === 'deliver' && (step.kind === kind || step.kind === 'any')) {
        const have = sv.inv[step.id] || 0;
        if (have >= step.n) opts.push({ label: `Hand over ${step.n} ${itemName(step.id)}`, close: true, act: () => { g.player.take(step.id, step.n); this.advance(id); } });
      }
    }
    const d = sv.daily;
    if (d && !d.claimed) {
      for (const c of d.list) if (!c.done && c.t === 'deliver' && (sv.inv[c.id] || 0) >= c.n) opts.push({ label: `Commission: hand over ${c.n} ${itemName(c.id)}`, close: true, act: () => { g.player.take(c.id, c.n); c.done = true; Audio.play('confirm'); } });
      if (d.list.every(c => c.done)) opts.push({ label: 'Claim the day\'s commissions', close: true, act: () => this.claimDaily() });
    }
    return opts;
  }
  claimDaily() {
    const g = this.game, sv = this.sv;
    sv.daily.claimed = true;
    g.levels && g.levels.gain(200, g.player.actor.c.x, g.player.actor.c.y - 110, 'commissions');
    sv.glimmer += 100;
    const extra = [['i_draught', 2], ['i_flare', 3], ['i_charge', 2]][Math.floor(Math.random() * 3)];
    g.player.give(extra[0], extra[1]);
    const locked = COSMETICS.filter(c => c.cost && !sv.unlocked.includes(c.id));
    let look = '';
    if (locked.length && Math.random() < 0.6) { const c = locked[Math.floor(Math.random() * locked.length)]; Save.unlock(c.id); look = ', ' + c.name; }
    Audio.play('chime');
    g.ui && g.ui.card('Commissions complete', `100 glimmer, ${extra[1]} ${itemName(extra[0])}${look}`, 'small gain', 3);
  }

  // ---------------- tracking and navigation
  tracked() {
    const sv = this.sv, id = sv.qtrack;
    if (id === 'daily') { const d = sv.daily; if (!d || d.claimed) return null; const c = d.list.find(c => !c.done); return c ? { name: 'Daily commissions', step: c, base: c.base } : { name: 'Daily commissions', step: { t: 'talk', kind: 'any', text: 'Claim them from any keeper' } }; }
    const st = id && sv.quests[id];
    if (!st || st.done) return null;
    return { id, name: QUESTS[id].name, step: QUESTS[id].steps[st.step], base: st.base };
  }
  trackedText() {
    const tq = this.tracked(); if (!tq) return null;
    const s = tq.step, p = this.progress(s, tq.base);
    const prog = s.t === 'talk' ? '' : s.t === 'deliver' ? ` (${Math.min(this.sv.inv[s.id] || 0, s.n)}/${s.n})` : ` (${p}/${s.n})`;
    return { name: tq.name, text: s.text + prog, hint: s.hint || '' };
  }
  // where the tracked step happens (null when it can be done anywhere)
  target() {
    const g = this.game, tq = this.tracked(); if (!tq) return null;
    const s = tq.step, px = g.player.x;
    if (s.t === 'camp') return g.sites && g.sites.nearest('camp', px);
    if (s.t === 'solve') return g.sites && g.sites.nearest('solve', px);
    if (s.t === 'wake' || s.t === 'stitch') { const a = g.content && g.content.nearestActivity(px); return a && (s.t === 'wake' ? a.kind === 'doll' : a.kind === 'stitch') ? a : a; }
    if (s.t === 'talk' || (s.t === 'deliver' && (this.sv.inv[s.id] || 0) >= s.n)) {
      const ptx = Math.floor(px / TILE); let best = null, bd = 1e9;
      for (const sx of g.world.shrinesBetween(ptx - 500, ptx + 500)) { if (s.kind !== 'any' && shrineKind(sx) !== s.kind) continue; const d = Math.abs(sx - ptx); if (d < bd) { bd = d; best = { x: sx * TILE + 16, y: g.world.surface(sx) * TILE - 40 }; } }
      return best;
    }
    return null;
  }
  // screen-space marker: a chevron on the screen edge pointing at the tracked place, or a small diamond over it
  draw(ctx, a, layer) {
    if (layer !== 'screen' || !this.navOn || this.game.cinematic || (this.game.ui && this.game.ui.modal)) return;
    const g = this.game, T_ = this.target() || (g.story && g.story.navTarget);
    if (!T_) return;
    const c = g.cam, sc = g.baseZoom * c.zoom * g.pxRatio;
    let sx = (T_.x - c.rx) * sc + g.W / 2, sy = (T_.y - c.ry) * sc + g.H / 2;
    const m = 46 * g.pxRatio, on = sx > m && sx < g.W - m && sy > m && sy < g.H - m;
    const dist = Math.round(Math.abs(T_.x - g.player.x) / TILE);
    ctx.save();
    // bright and a little larger than before, with a soft glow, so it reads at a glance
    ctx.fillStyle = '#ffcf6a'; ctx.strokeStyle = rgba('#241a12', 0.8); ctx.lineWidth = 2 * g.pxRatio;
    const halo = (x, y, r) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, x, y, r, [1, 0.86, 0.6], 0.55); ctx.restore(); };
    if (on) {
      const y = sy - 30 * g.pxRatio + Math.sin(g.time * 3) * 4 * g.pxRatio, r = 9.5 * g.pxRatio;
      halo(sx, y, 30 * g.pxRatio);
      ctx.beginPath(); ctx.moveTo(sx, y - r); ctx.lineTo(sx + r, y); ctx.lineTo(sx, y + r); ctx.lineTo(sx - r, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      const cx = g.W / 2, cy = g.H / 2, ang = Math.atan2(sy - cy, sx - cx);
      const ex = clamp(sx, m, g.W - m), ey = clamp(sy, m + 40 * g.pxRatio, g.H - m - 40 * g.pxRatio);
      ctx.translate(ex, ey); ctx.rotate(ang);
      const r = 14.5 * g.pxRatio;
      halo(0, 0, 34 * g.pxRatio);
      ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.6, -r * 0.8); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.6, r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.rotate(-ang);
      ctx.font = `800 ${11.5 * g.pxRatio}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd27a'; ctx.shadowColor = 'rgba(20,14,10,.85)'; ctx.shadowBlur = 4 * g.pxRatio;
      ctx.fillText(dist + ' m', -Math.cos(ang) * 32 * g.pxRatio, -Math.sin(ang) * 32 * g.pxRatio + 4 * g.pxRatio);
    }
    ctx.restore();
  }
}
