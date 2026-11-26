// Felling trees. A blade hit on a trunk sends chips flying and shakes the crown; after a few hits the trunk
// gives: its logs go to the satchel and the painted tree topples around its foot, lands with a thump,
// sheds leaves and fades. The heavier the weapon, the fewer hits it takes.
import { TILE, T } from '../world/tiles.js';
import { Audio } from '../core/audio.js';
import { clamp, rand, TAU, rgba } from '../core/util.js';
import { WEAPONS } from './weapons.js';

const LEAF = { round: ['#8fbf6a', '#5f8f4a'], crystal: ['#a8f0ff', '#5fb8d0'], shroom: ['#c9a8ff', '#7a5fb0'], dead: ['#c98a5a', '#7a4a32'], pine: ['#dfeef5', '#8fb0b8'] };

export class Trees {
  constructor(game) { this.game = game; this.hits = new Map(); this.falling = []; }
  // called each frame of a swing's hit window with the blade segment
  bladeHit(seg, at, facing, W) {
    const g = this.game, R = g.wr;
    if (!R || !R.treeSprite || at.kind === 'mine') return;
    const tx0 = Math.floor(Math.min(seg.x0, seg.x1) / TILE) - 1, tx1 = Math.floor(Math.max(seg.x0, seg.x1) / TILE) + 1;
    for (let tx = tx0; tx <= tx1; tx++) {
      if (at.hits.has('tree' + tx)) continue;
      const S = R.treeSprite(tx);
      if (!S) continue;
      const trunkTop = (S.tr.base - Math.min(S.tr.h, 4)) * TILE, trunkBot = S.tr.base * TILE;
      const cx = S.bx;
      // does the blade cross the trunk?
      let hit = false, hy = 0;
      for (let k = 0; k <= 4 && !hit; k++) {
        const u = k / 4, x = seg.x0 + (seg.x1 - seg.x0) * u, y = seg.y0 + (seg.y1 - seg.y0) * u;
        if (Math.abs(x - cx) < 13 && y > trunkTop && y < trunkBot) { hit = true; hy = y; }
      }
      if (!hit) continue;
      at.hits.add('tree' + tx);
      this.chop(tx, S, hy, facing, W);
    }
  }
  chop(tx, S, hy, dir, W) {
    const g = this.game;
    const need = W === WEAPONS.w_hammer ? 2 : W === WEAPONS.w_daggers ? 5 : 3;
    const n = (this.hits.get(tx) || 0) + 1;
    this.hits.set(tx, n);
    const x = S.bx - dir * 8;
    g.fx.debris(x, hy, T.LOG, 5);
    g.fx.burst(x, hy, { n: 6, speed: 180, col: '#e8d2b0', col1: '#a07a52', life: 0.5, size: 2.2, kind: 'chip', dir: -dir });
    const lc = LEAF[S.tr.kind] || LEAF.round;
    g.fx.burst(S.bx, S.by - S.h * 0.7, { n: 4, speed: 60, col: lc[0], col1: lc[1], life: 1.4, size: 3, kind: 'leaf', grav: 60 });
    Audio.play('hit', { pitch: 0.55, vol: 0.6 }); Audio.play('place', { pitch: 0.7, vol: 0.5 });
    g.shake(0.12); g.hitstop(0.03);
    if (g.wr.treeLean) g.wr.treeLean.set(tx, (g.wr.treeLean.get(tx) || 0) + dir * 0.09);
    if (n >= need) this.fell(tx, S, dir);
  }
  fell(tx, S, dir, unsupported) {
    const g = this.game, Wd = g.world, p = g.player;
    this.hits.delete(tx);
    let logs = 0;
    const top = S.tr.base - Math.min(S.tr.h, 4);
    for (let y = S.tr.base - 1; y >= top; y--) {
      if (Wd.get(tx, y) !== T.LOG) continue;
      Wd.set(tx, y, T.AIR); if (g.net) g.net.sendEdit(tx, y, T.AIR, 0);
      logs++;
    }
    if (S.tr.kind === 'shroom' && Wd.get(tx, S.tr.base - S.tr.h) === T.CAP) Wd.set(tx, S.tr.base - S.tr.h, T.AIR);
    const got = logs + 1 + (S.tr.h > 7 ? 1 : 0);
    if (p) { p.give(T.LOG, got); g.fx.text(S.bx, S.by - 70, '+' + got + ' Timber', '#ffd9a0', 18); }
    if (g.save && g.save.stats) g.save.stats.trees = (g.save.stats.trees || 0) + 1;
    if (g.quests && g.quests.counters) g.quests.counters.trees = (g.quests.counters.trees || 0) + 1;
    this.falling.push({ ...S, tx, dir: dir || 1, ang: 0, av: 0.35, landed: 0, fade: 1 });
    Audio.play('crack'); Audio.play('break', { pitch: 0.6, vol: 0.7 });
  }
  update(dt) {
    const g = this.game;
    // a tree whose footing is dug away (or never there: a block mined from under it) topples by itself
    if ((this.footT = (this.footT || 0) - dt) <= 0 && g.player && g.wr && g.wr.treeSprite) {
      this.footT = 0.25;
      const ptx = Math.floor(g.player.x / TILE), Wd = g.world;
      for (let tx = ptx - 40; tx <= ptx + 40; tx++) {
        const S = g.wr.treeSprite(tx);
        if (!S || Wd.solid(tx, S.tr.base)) continue;
        this.fell(tx, S, (tx * 7919) % 2 ? 1 : -1, true);
      }
    }
    for (const f of this.falling) {
      if (!f.landed) {
        // a slow start, then gravity takes the crown
        f.av += (1.4 + Math.sin(f.ang) * 5.5) * dt;
        f.ang += f.av * dt;
        // it comes to rest on the ground, or on whatever rises in its way
        const r = f.h * 0.72, cx = f.bx + f.dir * Math.sin(f.ang) * r, cy = f.by - 4 - Math.cos(f.ang) * r;
        const blocked = f.ang > 0.5 && g.world.solidAt(cx, cy + 10);
        if (f.ang >= 1.48 || blocked) {
          f.ang = Math.min(f.ang, 1.48); f.landed = 1e-6;
          const len = f.h * 0.85;
          for (let i = 0; i < 6; i++) g.fx.dust(f.bx + f.dir * len * (0.25 + i * 0.13), f.by - 4, 5, '#d8ccb8', -Math.PI / 2, 120);
          const lc = LEAF[f.tr.kind] || LEAF.round;
          g.fx.burst(f.bx + f.dir * len * 0.75, f.by - 20, { n: 26, speed: 160, col: lc[0], col1: lc[1], life: 1.6, size: 3.2, kind: 'leaf', grav: 70 });
          g.shake(0.35); Audio.play('land', { pitch: 0.5, vol: 0.9 }); Audio.play('break', { pitch: 0.45, vol: 0.5 });
        }
      } else {
        f.landed += dt;
        if (f.landed > 0.8) f.fade -= dt * 1.4;
      }
    }
    this.falling = this.falling.filter(f => f.fade > 0);
  }
  draw(ctx, a, layer) {
    if (layer !== 'back' || !this.falling.length) return;
    for (const f of this.falling) {
      ctx.save();
      ctx.globalAlpha = clamp(f.fade, 0, 1);
      // a small bounce as it lands
      const bounce = f.landed ? Math.sin(Math.min(1, f.landed * 5) * Math.PI) * 0.05 * Math.max(0, 1 - f.landed * 2) : 0;
      ctx.translate(f.bx, f.by - 4);
      ctx.rotate(f.dir * (f.ang - bounce));
      ctx.drawImage(f.im, -f.ax * f.w, -f.h, f.w, f.h);
      ctx.restore();
    }
  }
}
