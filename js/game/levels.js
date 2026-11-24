// Levels: experience from everything you do (kills, surges, quests, puzzles, discoveries, wardens), a level-up
// beat, and every third level a choice of one perk out of three. Zones have levels too: the further from the
// first fire, the stronger the Hollows; their level shows on elites, red when they outclass you.
import { Audio } from '../core/audio.js';
import { TILE } from '../world/tiles.js';
import { rand } from '../core/util.js';

export const MAX_LEVEL = 60;
export const PERKS = [
  { id: 'keen_edge', name: 'Keen Edge', desc: 'Your weapons deal 15% more damage.' },
  { id: 'heavy_hand', name: 'Heavy Hand', desc: 'Hits break poise 40% faster: more staggers, more finishers.' },
  { id: 'swift_strike', name: 'Swift Strike', desc: 'Swings come 10% faster.' },
  { id: 'long_reach', name: 'Long Reach', desc: 'Every weapon reaches 12% further.' },
  { id: 'riposte', name: 'Riposte', desc: 'The parry window is half again as long.' },
  { id: 'iron_seam', name: 'Iron Seam', desc: 'One blow in five glances off you.' },
  { id: 'second_wind', name: 'Second Thread', desc: 'Once every two minutes, a killing blow leaves you on one vessel instead.' },
  { id: 'bloodthread', name: 'Bloodthread', desc: 'Hits gather 60% more breath, so you mend more often.' },
  { id: 'overdrive', name: 'Overdrive', desc: 'Combos multiply rewards much faster.' },
  { id: 'fleet', name: 'Fleet', desc: 'Two dashes in the air, and dashes recharge faster.' },
  { id: 'stormstep', name: 'Stormstep', desc: 'Your dash cuts every Hollow you pass through.' },
  { id: 'ember_soul', name: 'Ember Soul', desc: 'Kills burst into flame that burns Hollows nearby.' },
  { id: 'magnet', name: 'Lodestone', desc: '20% more glimmer from everything.' },
  { id: 'scholar', name: 'Scholar', desc: '25% more experience.' },
  { id: 'ward', name: 'Thread Ward', desc: 'Every surge begins with a ward that absorbs one hit.' },
];
export const perkById = (id) => PERKS.find(p => p.id === id);

export class Levels {
  constructor(game) { this.game = game; this.popups = []; }
  get sv() { return this.game.player.sv; }
  need(L) { return Math.round(60 * Math.pow(L, 1.3)); }
  level() { return this.sv.level || 1; }
  // zone level: grows with distance from the first fire, a step per ~100 tiles, plus the gate tier
  zoneLevel(x) {
    const tx = Math.abs(Math.floor(x / TILE));
    const tier = this.game.world.tierAtX ? this.game.world.tierAtX(x) : 0;
    return Math.min(MAX_LEVEL, 1 + Math.floor(tx / 100) + tier * 3);
  }
  killXP(e) {
    const base = { husk: 12, lancer: 17, slinger: 15, brute: 32, wisp: 11 }[e.kind] || (e.isBoss ? 400 : 10);
    const lv = e.lvl || 1, diff = this.level() - lv;
    return base * (1 + (lv - 1) * 0.15) * (diff > 5 ? 0.4 : diff < -2 ? 1.3 : 1) * (e.elite ? 3 : 1);
  }
  dmgMult() { return 1 + (this.level() - 1) * 0.04; }
  gain(xp, x, y, label) {
    const sv = this.sv;
    if (!sv || xp <= 0) return;
    if (this.game.player.perk && this.game.player.perk('scholar')) xp *= 1.25;
    if (this.game.player.wellRested > 0) xp *= 1.5;
    xp = Math.max(1, Math.round(xp));
    sv.xp = (sv.xp || 0) + xp;
    sv.level = sv.level || 1;
    if (x !== undefined && this.game.fx) this.game.fx.text(x + rand(-10, 10), y, `+${xp} XP${label ? ' · ' + label : ''}`, '#bff6ff', label ? 16 : 13);
    while (sv.level < MAX_LEVEL && sv.xp >= this.need(sv.level)) { sv.xp -= this.need(sv.level); this.levelUp(); }
    if (this.game.ui && this.game.ui.xpBar) this.game.ui.xpBar(sv.level, sv.xp / this.need(sv.level), true);
  }
  levelUp() {
    const g = this.game, sv = this.sv, p = g.player, a = p.actor;
    sv.level++;
    // every fourth level: another vessel (up to ten); every third: a perk to choose
    if (sv.level % 4 === 0 && sv.maxHp < 10) { sv.maxHp++; }
    p.hp = sv.maxHp;
    if (sv.level % 3 === 0) sv.perkPicks = (sv.perkPicks || 0) + 1;
    g.slowmo(0.3, 0.45);
    g.fx.ring(a.c.x, a.c.y - 50, 10, 160, 0.7, '#bff6ff', 6);
    g.fx.ring(a.c.x, a.c.y - 50, 4, 100, 0.5, '#ffffff', 4);
    g.fx.burst(a.c.x, a.c.y - 50, { n: 40, speed: 380, col: '#ffffff', col1: '#9ff3ff', add: true, life: 0.9, size: 3, kind: 'streak' });
    g.flash([0.75, 0.95, 1], 0.25);
    Audio.play('confirm'); Audio.play('chime', { pitch: 1.2 }); Audio.play('soul', { pitch: 0.8 });
    if (g.ui && g.ui.levelCard) g.ui.levelCard(sv.level, sv.level % 4 === 0 && sv.maxHp <= 10, sv.level % 3 === 0);
    if (g.story && g.story.say) g.story.say(sv.level % 3 === 0 ? 'You feel stronger. Choose what to become: open the menu, Character.' : 'Stronger. Keep going.', 2.6, true);
    if (g.ui && g.ui.hudVessels) g.ui.hudVessels();
    g.saveNow && g.saveNow();
  }
  // three perks you don't have yet, seeded by the level so the offer doesn't change on reopen
  offer() {
    const sv = this.sv, own = sv.perks || [];
    const left = PERKS.filter(p => !own.includes(p.id));
    let s = (sv.level * 2654435761) >>> 0;
    const out = [];
    while (out.length < 3 && left.length) { s = (s * 1103515245 + 12345) >>> 0; out.push(left.splice(s % left.length, 1)[0]); }
    return out;
  }
  pick(id) {
    const sv = this.sv;
    if (!(sv.perkPicks > 0) || (sv.perks || []).includes(id)) return false;
    sv.perks = sv.perks || []; sv.perks.push(id); sv.perkPicks--;
    if (this.game.guide) this.game.guide.ev('perk');
    this.game.player.refreshLook && this.game.player.refreshLook();
    Audio.play('confirm');
    this.game.saveNow && this.game.saveNow();
    return true;
  }
}
