// The guide: the tutorial never really ends, it lets go gradually. Each lesson waits for the moment it is
// useful (a Hollow winding up: parry; a ledge: mantle; a low gap: crawl), shows a small hint chip and has
// Thread say it once. Each time you do it, the hint comes back less often and smaller; after a few
// successes it never shows again. Alongside, Thread gives live tips about what is happening right now.
import { TILE, TILES, T } from '../world/tiles.js';
import { canCraft, stationsNear, RECIPES } from './items.js';

// keys: what to press on a keyboard; touch: what to do on a phone; need: successes to master it
const LESSONS = [
  { id: 'parry', need: 3, keys: ['J'], touch: 'tap Strike', text: 'Strike just as it swings to parry', line: 'It is winding up. Strike right as it swings and you turn the blow back.',
    when: (G) => G.foeWinding(170) },
  { id: 'mend', need: 3, keys: ['Hold H'], touch: 'hold Mend', text: 'Mend a vessel with your breath', line: 'You are hurt and your breath is full. Mend, now, while it is quiet.',
    when: (G) => { const p = G.p; return p.hp <= p.sv.maxHp - 2 && (p.sv.breath || 0) >= 33 && !G.foeNear(220); } },
  { id: 'charge', need: 3, keys: ['Hold J'], touch: 'hold Strike', text: 'Hold to charge a heavy blow', line: 'Hold the strike to charge it. Heavy blows break their guard.',
    when: (G) => G.foeNear(260, e => e.kind === 'brute' || e.elite || e.staggered) },
  { id: 'launch', need: 2, keys: ['W + J'], touch: 'up + Strike', text: 'Strike upward to launch a Hollow', line: 'Strike upward: it goes flying and you can follow it into the air.', minLevel: 3,
    when: (G) => G.foeNear(110, e => e.kind === 'husk' || e.kind === 'slinger') },
  { id: 'mantle', ok: (G) => !!G.p.actor.mantle,  need: 2, keys: ['Jump', 'hold toward'], touch: 'jump, hold the stick toward it', text: 'Jump at a ledge and hold toward it to climb', line: 'Jump at it and keep pushing. You can pull yourself up.',
    when: (G) => G.ledgeAhead() },
  { id: 'ladder', ok: (G) => !!G.p.actor.c.climb,  need: 2, keys: ['W'], touch: 'push up', text: 'Climb the ladder', line: 'A ladder. Push up to climb.',
    when: (G) => G.onLadderNotClimbing() },
  { id: 'crawl', ok: (G) => G.p.actor.crawling && Math.abs(G.p.actor.c.vx) > 10,  need: 2, keys: ['Hold C'], touch: 'tap Crawl', text: 'Crawl through the low gap', line: 'Too low to walk. Crawl through.',
    when: (G) => G.lowGapAhead() },
  { id: 'digout', ok: (G) => G.p.y < G.y0 - 48,  need: 2, keys: ['Hold Click', 'Right-click'], touch: 'Build: hold a wall, or place a block', text: 'Dig a stair out, or place a block under you', line: 'Stuck down here? Cut a step into the wall, or jump and set a block beneath you.',
    when: (G) => G.inPit() },
  { id: 'flare', need: 2, keys: ['R'], touch: 'tap the flare in your hotbar', text: 'Throw a flare into the dark', line: 'It is dark. Throw a flare ahead of you.',
    when: (G) => G.dark() && (G.p.sv.inv.i_flare || 0) > 0 },
  { id: 'bench', need: 2, keys: ['I'], touch: 'tap Bag', text: 'Open the satchel to craft at the workbench', line: 'A workbench. Open your satchel here and see what you can make.',
    when: (G) => G.benchCraftable() },
  { id: 'track', ok: (G) => !!G.p.sv.qtrack,  need: 1, keys: ['Esc', 'Quests'], touch: 'Menu, Quests', text: 'Track a quest to see where to go', line: 'You have a task but nothing points to it. Track it in the menu.',
    when: (G) => G.untrackedQuest() },
  { id: 'perk', ok: (G) => !(G.p.sv.perkPicks > 0),  need: 1, keys: ['Esc', 'Character'], touch: 'Menu, Character', text: 'Choose a perk', line: 'You have grown. Open the menu and choose what to become.',
    when: (G) => (G.p.sv.perkPicks || 0) > 0 },
  { id: 'surge', need: 2, keys: [], touch: '', text: 'Clear every wave before the rift closes', line: 'Hold your ground! Clear every wave and it leaves a chest.',
    when: (G) => G.g.surges && G.g.surges.s && G.g.surges.s.state === 'wave' },
  { id: 'combo', ok: (G) => G.p.combo && G.p.combo.n >= 10,  need: 2, keys: [], touch: '', text: 'Keep hitting: combos multiply rewards', line: 'Keep the hits coming. The more you chain, the more you gain.',
    when: (G) => G.p.combo && G.p.combo.n >= 4 && G.p.combo.n < 8 },
];

export class Guide {
  constructor(game) { this.game = game; this.cur = null; this.curT = 0; this.cool = 6; this.tipCool = {}; this.idleT = 0; this.lastX = 0; }
  get sv() { const s = this.game.player.sv; return s.guide || (s.guide = {}); }
  get p() { return this.game.player; }
  get g() { return this.game; }
  // something the player just did (successes are counted against the lesson that teaches it)
  ev(name) {
    const st = this.sv[name] || (this.sv[name] = { ok: 0, seen: 0, last: -1e9 });
    st.ok++;
    if (this.cur && this.cur.id === name) this.end(true);
  }
  mastered(L) { const st = this.sv[L.id]; return st && st.ok >= L.need; }
  update(dt) {
    const g = this.game, p = g.player;
    if (!p || p.dead || g.cinematic || !g.story || g.story.stage < 5 || !p.sv.tutDone) { if (this.cur) this.end(false); return; }
    if (g.ui && g.ui.modal) return;
    // idle (for tips and for the objective panel)
    if (Math.abs(p.x - this.lastX) > 8) { this.idleT = 0; this.lastX = p.x; } else this.idleT += dt;
    this.terse = (p.sv.level || 1) >= 8 && this.idleT < 15;
    if (this.cur) {
      this.curT += dt;
      if (this.cur.ok && this.cur.ok(this)) this.ev(this.cur.id);
      else if (this.curT > 7 || (!this.cur.when(this) && this.curT > 1.2)) this.end(false);
    } else {
      this.cool -= dt;
      if (this.cool <= 0) {
        for (const L of LESSONS) {
          if (this.mastered(L) || (L.minLevel && (p.sv.level || 1) < L.minLevel)) continue;
          const st = this.sv[L.id] || (this.sv[L.id] = { ok: 0, seen: 0, last: -1e9 });
          // the more you have done it, the longer before it is shown again
          if (g.time - st.last < 25 * (1 + st.ok * 2 + st.seen * 0.5)) continue;
          if (!L.when(this)) continue;
          this.show(L, st); break;
        }
      }
    }
    this.tips(dt);
  }
  show(L, st) {
    const g = this.game;
    this.cur = L; this.curT = 0; this.y0 = this.game.player.y;
    st.seen++; st.last = g.time;
    const compact = st.ok >= 1;
    if (g.ui && g.ui.guideChip) g.ui.guideChip(L, g.touch, compact);
    if (st.seen <= 2 && g.story) g.story.say(L.line, 3, false);
  }
  end(success) {
    const g = this.game;
    if (g.ui && g.ui.guideChip) g.ui.guideChip(null, false, false, success);
    this.cur = null; this.cool = success ? 4 : 8;
  }
  // ------------------------------------------------------------ live tips: what is happening right now
  tip(id, cd, text) {
    const g = this.game;
    if (g.time - (this.tipCool[id] || -1e9) < cd) return false;
    this.tipCool[id] = g.time;
    if (g.story) g.story.say(text, 3, false);
    return true;
  }
  tips(dt) {
    const g = this.game, p = g.player, sv = p.sv;
    this.tipT = (this.tipT || 0) - dt;
    if (this.tipT > 0 || (g.story && g.story.thread && g.story.thread.line)) return;
    this.tipT = 1.5;
    const near = this.foesNear(260);
    if (p.hp <= 1 && near.length) { if (this.tip('lowhp', 35, (sv.breath || 0) >= 33 ? 'Get clear and mend! You have the breath for it.' : 'Get out of there! Hit them to gather breath, then mend.')) return; }
    if (near.length >= 4) { if (this.tip('crowd', 60, 'Too many at once. Dash through them, fight from a ledge, keep moving.')) return; }
    const zl = g.levels ? g.levels.zoneLevel(p.x) : 1, lv = sv.level || 1;
    if (zl >= lv + 4) { if (this.tip('outclass', 150, `Careful: Hollows here are level ${zl}. You are ${lv}.`)) return; }
    if (zl + 5 <= lv) { if (this.tip('under', 240, 'Nothing here can hurt you much any more. The real fights are further on.')) return; }
    if (this.idleT > 20) { const o = g.story && g.story.objectiveText ? g.story.objectiveText() : null; if (this.tip('idle', 50, o ? `Not sure where to go? ${o}. I will show you.` : 'Not sure where to go? Follow me.')) return; }
    if (this.forgeHint()) { if (this.tip('forge', 200, 'You carry enough ore to forge something. Find a forge, or build one at a workbench.')) return; }
    if (g.towns && g.towns.nearUnvisited && g.towns.nearUnvisited(p.x)) { if (this.tip('town', 300, 'A town ahead. Shops, an inn, bounties. Worth a stop.')) return; }
  }
  // ------------------------------------------------------------ the conditions lessons wait for
  foesNear(r, pred) { const p = this.p.actor.c; return this.game.targets().filter(e => e.mode !== 'dead' && !e.removed && Math.abs(e.c.x - p.x) < r && Math.abs(e.c.y - p.y) < 160 && (!pred || pred(e))); }
  foeNear(r, pred) { return this.foesNear(r, pred).length > 0; }
  foeWinding(r) { return this.foeNear(r, e => e.telegraph > 0.15); }
  ledgeAhead() {
    const a = this.p.actor, c = a.c, W = this.game.world;
    if (!c.ground || a.mantle || a.crawling) return false;
    const dir = a.facing, tx = Math.floor((c.x + dir * 24) / TILE), ty = Math.floor((c.y - 1) / TILE);
    return W.solid(tx, ty) && W.solid(tx, ty - 1) && !W.solid(tx, ty - 2) && !W.solid(tx, ty - 3) && Math.abs(c.vx) > 40;
  }
  onLadderNotClimbing() { const a = this.p.actor; return a.onLadder && a.onLadder() && !a.c.climb; }
  lowGapAhead() {
    const a = this.p.actor, c = a.c, W = this.game.world;
    if (a.crawling || !c.ground) return false;
    const tx = Math.floor((c.x + a.facing * 26) / TILE), ty = Math.floor((c.y - 1) / TILE);
    return !W.solid(tx, ty) && W.solid(tx, ty - 1) && Math.abs(c.vx) > 20;
  }
  inPit() {
    const a = this.p.actor, c = a.c, W = this.game.world;
    if (!c.ground) { this.pitT = 0; return false; }
    const tx = Math.floor(c.x / TILE), ty = Math.floor((c.y - 1) / TILE);
    const wall = (d) => W.solid(tx + d, ty) && W.solid(tx + d, ty - 1) && W.solid(tx + d, ty - 2);
    const pit = (wall(-1) || wall(-2)) && (wall(1) || wall(2)) && !W.solid(tx, ty - 1);
    this.pitT = pit ? (this.pitT || 0) + 1 / 60 : 0;
    return this.pitT > 3;
  }
  dark() { const p = this.p, W = this.game.world; return Math.floor(p.y / TILE) > W.surface(Math.floor(p.x / TILE)) + 12; }
  benchCraftable() {
    const g = this.game, near = stationsNear(g);
    if (!near.bench) return false;
    return RECIPES.some(r => r.st === 'bench' && canCraft(this.p.sv, r, near));
  }
  untrackedQuest() {
    const sv = this.p.sv;
    if (sv.qtrack) return false;
    return Object.values(sv.quests || {}).some(q => q && !q.done);
  }
  forgeHint() {
    const inv = this.p.sv.inv;
    return (inv[T.GOLD] || 0) >= 5 && !(this.p.sv.equip && this.p.sv.equip.pick);
  }
}
