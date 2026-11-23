// Thrown consumables. A flare arcs, sticks where it lands and burns a big warm light for twenty seconds;
// a blast charge bounces to rest, fizzes for a moment and breaks the blocks around it (the pieces come back
// to your satchel) and knocks Hollows flying.
import { TILE, T, TILES } from '../world/tiles.js';
import { Audio } from '../core/audio.js';
import { drawGlow } from '../world/light.js';
import { rgba, TAU, rand } from '../core/util.js';

export class Throwables {
  constructor(game) { this.game = game; this.list = []; }
  throw(kind, x, y, vx, vy, o = {}) { this.list.push(Object.assign({ kind, x, y, vx, vy, rest: false, t: 0, life: kind === 'flare' ? 20 : kind === 'shot' ? 1.6 : 1.4, rot: 0, hit: new Set() }, o)); }
  // a sling stone: fast, slight arc, hits the first Hollow (crystal shot passes through)
  updateShot(o, dt) {
    const g = this.game;
    o.vy += 700 * dt;
    const steps = 3;
    for (let k = 0; k < steps && !o.dead; k++) {
      o.x += o.vx * dt / steps; o.y += o.vy * dt / steps;
      if (g.world.solidAt(o.x, o.y)) { o.dead = true; g.fx.debris(o.x, o.y, o.tile || T.STONE, 3); Audio.play('place', { pitch: 1.8, vol: 0.4 }); return; }
      for (const e of g.targets()) {
        if (e.mode === 'dead' || o.hit.has(e.id)) continue;
        const r = (e.hitR || 20) + 8;
        if ((e.cx - o.x) ** 2 + (e.cy - o.y) ** 2 > r * r * 2.2) continue;
        o.hit.add(e.id);
        const dx = Math.sign(o.vx) || 1;
        if (g.player) g.player.strike(e, o.x, o.y, dx, -0.2, 1, 'shot', { W: { dmg: o.dmg, poise: o.poise, knock: 0.8, speed: 1 }, step: {} });
        if (e.kind === 'wisp' && e.mode !== 'dead') { e.stunT = 1.4; e.vy = 260; }   // knocked out of the air
        if (!o.pierce) { o.dead = true; return; }
      }
    }
    o.rot += dt * 20;
  }
  update(dt) {
    const g = this.game, W = g.world;
    for (const o of this.list) {
      o.t += dt;
      if (o.kind === 'shot') { this.updateShot(o, dt); if (o.t > o.life) o.dead = true; continue; }
      if (!o.rest) {
        o.vy += 1500 * dt;
        const nx = o.x + o.vx * dt, ny = o.y + o.vy * dt;
        const hitX = W.solidAt(nx, o.y), hitY = W.solidAt(o.x, ny);
        if (hitX) { o.vx *= o.kind === 'flare' ? 0 : -0.4; } else o.x = nx;
        if (hitY) {
          if (o.kind === 'flare' || Math.abs(o.vy) < 120) { o.rest = true; o.vx = o.vy = 0; if (o.kind === 'flare') Audio.play('place', { pitch: 1.6, vol: 0.5 }); }
          else { o.vy *= -0.35; o.vx *= 0.6; Audio.play('place', { pitch: 1.4, vol: 0.4 }); }
        } else o.y = ny;
        if (hitX && o.kind === 'flare') { o.rest = true; o.vy = 0; }
        o.rot += o.vx * dt * 0.05;
      }
      if (o.kind === 'charge' && o.t >= o.life) { this.blast(o); o.dead = true; }
      if (o.kind === 'flare' && o.t >= o.life) o.dead = true;
      if (o.kind === 'flare' && (g.tick % 6) === 0) g.fx.burst(o.x, o.y - 4, { n: 1, speed: 40, col: '#ffe6b0', col1: '#ff8a3a', add: true, life: 0.5, size: 2, kind: 'mote' });
    }
    this.list = this.list.filter(o => !o.dead);
  }
  blast(o) {
    const g = this.game, W = g.world, p = g.player;
    const cx = Math.floor(o.x / TILE), cy = Math.floor(o.y / TILE);
    const got = {};
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > 4.6) continue;
      const tx = cx + dx, ty = cy + dy, t = W.get(tx, ty);
      if (!t || TILES[t].hard >= 100 || t === T.STORE) continue;
      W.set(tx, ty, T.AIR);
      if (g.net) g.net.sendEdit(tx, ty, T.AIR, 0);
      const drop = TILES[t].drop === -1 ? null : TILES[t].drop ?? t;
      if (drop !== null && TILES[drop] && TILES[drop].place) got[drop] = (got[drop] || 0) + 1;
      if (Math.random() < 0.5) g.fx.debris(tx * TILE + 16, ty * TILE + 16, t, 3);
    }
    for (const id in got) if (p) { p.give(id, got[id]); }
    for (const e of g.targets()) {
      const d = Math.hypot(e.c.x - o.x, (e.c.y - 40) - o.y);
      if (d < 110 && e.hurt) e.hurt(28, { x: o.x, y: o.y, dx: Math.sign(e.c.x - o.x) || 1, dy: -0.8, from: p, kind: 'blast' });
    }
    if (p && Math.hypot(p.x - o.x, p.y - 40 - o.y) < 90) p.actor.takeImpulse && p.actor.takeImpulse(o.x, o.y, Math.sign(p.x - o.x) * 500, -420, 0.5);
    g.fx.burst(o.x, o.y, { n: 40, speed: 520, col: '#ffffff', col1: '#ff9b4a', add: true, life: 0.6, size: 3, kind: 'streak' });
    g.fx.dust(o.x, o.y, 22, '#bfb3a3', -Math.PI / 2, 260);
    g.fx.ring(o.x, o.y, 10, 120, 0.35, '#ffd9a0', 6);
    g.flash([1, 0.85, 0.6], 0.25); g.shake(0.6); g.hitstop(0.05);
    Audio.play('crack'); Audio.play('break', { pitch: 0.5 });
  }
  lights(arr) {
    for (const o of this.list) {
      if (o.kind === 'shot') continue;
      if (o.kind === 'flare') { const k = Math.min(1, (o.life - o.t) / 3); arr.push({ x: o.x, y: o.y - 6, c: [1.0, 0.62, 0.34], s: 1.9 * k + 0.1 }); }
      else arr.push({ x: o.x, y: o.y, c: [1.0, 0.5, 0.25], s: 0.25 + 0.2 * Math.sin(o.t * 30) });
    }
  }
  draw(ctx, a, layer) {
    if (layer !== 'mid') return;
    const g = this.game;
    for (const o of this.list) {
      if (o.kind === 'shot') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(o.pierce ? '#9ff3ff' : '#fff1d8', 0.45); ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(o.x - o.vx * 0.03, o.y - o.vy * 0.03); ctx.lineTo(o.x, o.y); ctx.stroke(); ctx.restore();
        ctx.fillStyle = o.pierce ? '#8ff7ff' : '#9a96a0'; ctx.beginPath(); ctx.arc(o.x, o.y, 3.5, 0, TAU); ctx.fill();
        continue;
      }
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot);
      if (o.kind === 'flare') {
        ctx.fillStyle = '#c0453a'; ctx.beginPath(); ctx.roundRect(-2.5, -2, 5, 14, 2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const fl = 0.8 + Math.sin(g.time * 23 + o.x) * 0.15;
        drawGlow(ctx, o.x, o.y - 4, 70 * fl, [1, 0.6, 0.3], 0.5);
        ctx.fillStyle = rgba('#fff1cf', 0.9); ctx.beginPath(); ctx.arc(o.x, o.y - 4, 3.5 * fl, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = '#3a3440'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = '#a98a62'; ctx.fillRect(-7, -1.5, 14, 3);
        ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, o.x + 3, o.y - 9, 14 + Math.sin(g.time * 40) * 4, [1, 0.6, 0.25], 0.7);
      }
      ctx.restore();
    }
  }
}
