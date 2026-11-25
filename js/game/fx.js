// Pooled particles, rings, slash ribbons, debris and floating numbers.
// Every effect has a flash/body/dissipation life with varied size, speed and colour over life.
import { Pool, rand, TAU, clamp, lerp, rgba, mix, hash2 } from '../core/util.js';
import { TILE, TILES } from '../world/tiles.js';
import { IMG } from '../art/images.js';

export class FX {
  constructor(game) {
    this.game = game;
    this.parts = new Pool(() => ({}), 1400);
    this.rings = [];
    this.slashes = [];
    this.texts = [];
    this.flashes = [];
    this.reduce = false;
  }
  spawn(o) {
    const p = this.parts.get();
    p.x = o.x; p.y = o.y; p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.life = p.max = o.life || 0.6; p.size = o.size || 3; p.size1 = o.size1 ?? p.size * 0.2;
    p.col = o.col || '#ffffff'; p.col1 = o.col1 || p.col; p.add = !!o.add; p.grav = o.grav || 0; p.drag = o.drag ?? 2;
    p.kind = o.kind || 'dot'; p.rot = o.rot || 0; p.vr = o.vr || 0; p.target = o.target || null; p.bounce = o.bounce || 0;
    p.alpha = o.alpha ?? 1; p.delay = o.delay || 0; p.onArrive = o.onArrive || null;
    return p;
  }
  burst(x, y, o = {}) {
    const n = this.reduce ? Math.ceil((o.n || 10) * 0.5) : o.n || 10;
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + rand(-1, 1) * (o.spread ?? 0.6) : rand(0, TAU);
      const sp = rand(o.speed ? o.speed * 0.35 : 60, o.speed || 260);
      this.spawn({
        x: x + rand(-2, 2), y: y + rand(-2, 2), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.5, 1) * (o.life || 0.6), size: rand(0.6, 1.3) * (o.size || 3), size1: o.size1, col: o.col, col1: o.col1,
        add: o.add, grav: o.grav ?? 0, drag: o.drag ?? 3, kind: o.kind || 'dot', rot: a, bounce: o.bounce,
      });
    }
  }
  sparks(x, y, dir, n = 10, col = '#fff6dc', speed = 900) {
    this.burst(x, y, { n, dir, spread: 0.7, speed, life: 0.28, size: 2.2, col: '#ffffff', col1: col, add: true, kind: 'streak', drag: 6 });
  }
  dust(x, y, n = 6, col = '#d8cfc0', dir = -Math.PI / 2, speed = 120) {
    this.burst(x, y, { n, dir, spread: 1.3, speed, life: 0.7, size: 5, size1: 9, col, add: false, kind: 'soft', drag: 4, grav: -40 });
  }
  ring(x, y, r0, r1, life, col, width = 4, add = true) {
    this.rings.push({ x, y, r0, r1, life, max: life, col, width, add });
  }
  debris(x, y, tile, n = 6) {
    const T = TILES[tile];
    const col = T.k && T.k[0] === '#' ? T.k : '#8a7f78';
    for (let i = 0; i < n; i++) this.spawn({ x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-160, 160), vy: rand(-320, -80), life: rand(0.5, 0.9), size: rand(2.5, 5), size1: 1.5, col, grav: 1800, drag: 0.8, kind: 'chunk', vr: rand(-12, 12), bounce: 0.35 });
  }
  slash(pts, col, width = 1) { if (pts.length > 1) { const life = 0.17 + (width - 1) * 0.12; this.slashes.push({ pts: pts.map(p => [p[0], p[1], p[2], p[3]]), life, max: life, col, width }); } }
  flash(name, x, y, size, rot = 0, life = 0.22) { this.flashes.push({ name, x, y, size, rot, life, max: life }); }
  text(x, y, str, col = '#ffffff', size = 18, life = 1.1) { this.texts.push({ x, y, str, col, size, life, max: life, vy: -34 }); }
  souls(x, y, n, target, col = '#bff6ff', onArrive) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(120, 320);
      this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 3, size: rand(2.5, 4), size1: 2, col: '#ffffff', col1: col, add: true, kind: 'soul', drag: 2.5, target, delay: 0.25 + i * 0.03, onArrive });
    }
  }

  // ambient atmosphere around the camera
  ambient(dt, view, biome, depth) {
    if (this.reduce && Math.random() < 0.5) return;
    const W = view.x1 - view.x0, H = view.y1 - view.y0;
    const rx = () => rand(view.x0 - 40, view.x1 + 40), ry = () => rand(view.y0 - 40, view.y1 + 40);
    const k = biome.parts;
    const rate = dt * (W * H) / 1e6;
    let n = rate * (k === 'snow' ? 60 : k === 'embers' ? 30 : 14);
    if (depth > 0.5) n *= 0.5;
    while (n > 0) {
      if (Math.random() > n) break;
      n -= 1;
      if (k === 'snow' && depth < 0.5) this.spawn({ x: rx(), y: view.y0 - 20, vx: rand(-30, 10), vy: rand(40, 90), life: 8, size: rand(1.2, 3), size1: 1.5, col: '#ffffff', alpha: 0.85, kind: 'drift', drag: 0 });
      else if (k === 'embers') this.spawn({ x: rx(), y: view.y1 + 20, vx: rand(-20, 30), vy: rand(-70, -30), life: 6, size: rand(1.2, 2.6), size1: 0.5, col: '#ffd2a0', col1: '#ff6a2a', add: true, kind: 'drift', drag: 0 });
      else if (k === 'fireflies') this.spawn({ x: rx(), y: ry(), vx: rand(-15, 15), vy: rand(-15, 15), life: rand(3, 6), size: rand(1.5, 2.5), size1: 1.5, col: '#dfffb0', col1: '#8ff7ff', add: true, kind: 'firefly', drag: 0 });
      else if (k === 'spores') this.spawn({ x: rx(), y: ry(), vx: rand(-8, 8), vy: rand(-25, -8), life: rand(4, 7), size: rand(1.2, 2.4), size1: 1, col: '#d9ceff', col1: '#9d8cff', add: true, kind: 'drift', drag: 0 });
      else this.spawn({ x: rx(), y: ry(), vx: rand(-12, 12), vy: rand(-12, 6), life: rand(4, 7), size: rand(1, 2), size1: 1, col: '#fff1d8', alpha: 0.6, add: true, kind: 'drift', drag: 0 });
    }
  }

  update(dt) {
    const W = this.game.world;
    for (const p of this.parts.items) {
      if (!p.alive) continue;
      if (p.delay > 0) { p.delay -= dt; }
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      if (p.kind === 'soul' && p.target && p.delay <= 0) {
        const t = p.target;
        const dx = t.x - p.x, dy = (t.y - 40) - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, (3 - p.life) * 1.2);
        p.vx += (dx / d * 1400 - p.vx) * Math.min(1, dt * 4 * k);
        p.vy += (dy / d * 1400 - p.vy) * Math.min(1, dt * 4 * k);
        if (d < 18) { p.alive = false; if (p.onArrive) p.onArrive(); continue; }
      }
      if (p.kind === 'leaf') { p.vx += Math.sin(p.life * 5 + p.y * 0.05) * 140 * dt; p.vy = Math.min(p.vy, 90); }
      if (p.kind === 'firefly') { p.vx += Math.sin(p.life * 3 + p.x) * 30 * dt; p.vy += Math.cos(p.life * 2.3 + p.y) * 30 * dt; }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vy *= dr;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === 'chunk' && TILES[W.get(Math.floor(p.x / TILE), Math.floor(p.y / TILE))].solid) {
        p.y -= p.vy * dt; p.vy *= -p.bounce; p.vx *= 0.6;
      }
    }
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter(r => r.life > 0);
    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter(f => f.life > 0);
    for (const s of this.slashes) s.life -= dt;
    this.slashes = this.slashes.filter(s => s.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= Math.exp(-1.6 * dt); }
    this.texts = this.texts.filter(t => t.life > 0);
  }

  draw(ctx, additive) {
    ctx.save();
    if (additive) ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts.items) {
      if (!p.alive || p.add !== additive || p.delay > 0) continue;
      const u = 1 - p.life / p.max;
      const sz = lerp(p.size, p.size1, u);
      let a = p.alpha * (u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1);
      if (p.kind === 'drift' || p.kind === 'firefly') a = p.alpha * Math.min(1, u * 4) * Math.min(1, p.life / 1.2) * (p.kind === 'firefly' ? 0.5 + 0.5 * Math.sin(p.life * 6) : 1);
      ctx.globalAlpha = clamp(a, 0, 1);
      const col = p.col1 !== p.col ? mix(p.col, p.col1, Math.min(1, u * 2)) : p.col;
      ctx.fillStyle = col; ctx.strokeStyle = col;
      if (p.kind === 'streak') {
        ctx.lineWidth = sz; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      } else if (p.kind === 'soft') {
        ctx.globalAlpha = clamp(a * 0.45, 0, 1);
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, TAU); ctx.fill();
      } else if (p.kind === 'chunk' || p.kind === 'chip') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + (p.kind === 'chip' ? p.life * 14 : 0)); ctx.fillRect(-sz, -sz * (p.kind === 'chip' ? 0.5 : 1), sz * 2, sz * (p.kind === 'chip' ? 1 : 2)); ctx.restore();
      } else if (p.kind === 'leaf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(p.life * 6 + p.x * 0.1) * 1.2); ctx.beginPath(); ctx.ellipse(0, 0, sz * 1.3, sz * 0.6, 0, 0, TAU); ctx.fill(); ctx.restore();
      } else if (p.kind === 'soul') {
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, TAU); ctx.fill();
        ctx.globalAlpha = clamp(a * 0.35, 0, 1);
        ctx.lineWidth = sz * 1.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      if (r.add !== additive) continue;
      const u = 1 - r.life / r.max;
      const rad = lerp(r.r0, r.r1, 1 - (1 - u) * (1 - u));
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.strokeStyle = r.col; ctx.lineWidth = r.width * (1 - u) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
    }
    if (additive) {
      for (const f of this.flashes) {
        const im = IMG[f.name]; if (!im) continue;
        const u = 1 - f.life / f.max;
        const sc = f.size * (0.6 + u * 0.7) / Math.max(im.width, im.height);
        ctx.save(); ctx.globalAlpha = (1 - u) * (1 - u); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc); ctx.restore();
      }
      // slash ribbons: blade base->tip samples swept through the swing
      for (const s of this.slashes) {
        const u = 1 - s.life / s.max;
        const pts = s.pts;
        ctx.globalAlpha = (1 - u) * 0.85;
        const g = ctx.createLinearGradient(pts[0][2], pts[0][3], pts[pts.length - 1][2], pts[pts.length - 1][3]);
        g.addColorStop(0, rgba(s.col, 0)); g.addColorStop(0.6, rgba(s.col, 0.55)); g.addColorStop(1, rgba('#ffffff', 0.95));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(pts[0][2], pts[0][3]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][2], pts[i][3]);
        for (let i = pts.length - 1; i >= 0; i--) { const k = (s.width > 1 ? 0.2 : 0.45) + u * 0.35; ctx.lineTo(lerp(pts[i][0], pts[i][2], k), lerp(pts[i][1], pts[i][3], k)); }
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (!additive) {
      ctx.textAlign = 'center';
      for (const t of this.texts) {
        // quiet serif marks in the UI's voice: fade in, drift up slowly, fade out; no pop, no drop shadow
        const u = 1 - t.life / t.max;
        ctx.globalAlpha = Math.min(1, u * 8) * (u > 0.55 ? 1 - (u - 0.55) / 0.45 : 1) * 0.92;
        const sz = Math.round(Math.max(11, t.size * 0.9));
        ctx.font = `italic 600 ${sz}px 'Cormorant Garamond', serif`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0.06em';
        const x = Math.round(t.x), y = Math.round(t.y);
        ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(12,10,16,0.45)'; ctx.strokeText(t.str, x, y);
        ctx.fillStyle = mix(t.col, '#efe6d6', 0.35); ctx.fillText(t.str, x, y);
      }
    }
    ctx.restore();
  }
}
export { hash2 };
