// Thread: the last living stitch of the Seamstress' light. A little needle-moth that rides at your shoulder,
// flies ahead to show the way to your current goal, and speaks in short lines. Narrator + guide in one.
import { Audio } from '../core/audio.js';
import { drawGlow } from '../world/light.js';
import { clamp, lerp, rgba, TAU } from '../core/util.js';

export class Thread {
  constructor(game) {
    this.game = game;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.ix = 0; this.iy = 0;
    this.trail = [];
    this.line = null; this.lineT = 0; this.queue = [];
    this.visible = true;
    this.t = 0;
    this.target = null;
    this.placed = false;
  }
  say(text, dur = 3.2, prio = false) {
    if (prio) { this.queue = []; this.line = null; }
    if (this.line && this.line.text === text) return;
    this.queue.push({ text, dur });
  }
  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    this.t += dt;
    const a = p.actor;
    if (!this.placed) { this.x = a.c.x - 30; this.y = a.c.y - 110; this.placed = true; }
    this.ix = this.x; this.iy = this.y;
    // where to be: at the shoulder, or leading toward the goal
    let tx = a.c.x - a.facing * 26, ty = a.c.y - 100 + Math.sin(this.t * 2.2) * 6;
    const T = this.target;
    if (T && !g.cinematic) {
      const dx = T.x - a.c.x, dy = T.y - a.c.y;
      const d = Math.hypot(dx, dy);
      if (d > 140) {
        const lead = Math.min(d - 40, 150 + Math.sin(this.t * 1.3) * 20);
        tx = a.c.x + dx / d * lead; ty = a.c.y - 90 + dy / d * lead * 0.5 + Math.sin(this.t * 3) * 8;
      } else { tx = T.x + Math.cos(this.t * 2) * 26; ty = T.y - 30 + Math.sin(this.t * 2.6) * 14; }
    }
    if (this.override) { tx = this.override.x; ty = this.override.y; }
    const k = 6;
    this.vx += ((tx - this.x) * k - this.vx) * Math.min(1, dt * 5);
    this.vy += ((ty - this.y) * k - this.vy) * Math.min(1, dt * 5);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.trail.push(this.x, this.y);
    if (this.trail.length > 48) this.trail.splice(0, 2);
    // speech queue
    if (this.line) { this.lineT += dt; if (this.lineT > this.line.dur) { this.line = null; } }
    if (!this.line && this.queue.length) { this.line = this.queue.shift(); this.lineT = 0; Audio.play('chime', { vol: 0.25, gap: 0.3 }); }
    if ((g.tick % 8) === 0) g.fx.spawn({ x: this.x + (Math.random() - 0.5) * 6, y: this.y + (Math.random() - 0.5) * 6, vx: -this.vx * 0.1, vy: -this.vy * 0.1 + 10, life: 0.7, size: 1.6, size1: 0.3, col: '#ffffff', col1: '#9ff3ff', add: true });
  }
  lights(arr) { if (this.visible) arr.push({ x: this.x, y: this.y, c: [0.62, 0.95, 1], s: 0.65 }); }
  draw(ctx, a, layer) {
    if (!this.visible || layer !== 'front') return;
    drawThreadSprite(ctx, lerp(this.ix, this.x, a), lerp(this.iy, this.y, a), this.t, this.vx, this.trail);
    if (this.line) {
      const u = this.lineT, fadeIn = clamp(u / 0.25, 0, 1), fadeOut = clamp((this.line.dur - u) / 0.4, 0, 1);
      const al = Math.min(fadeIn, fadeOut);
      const shown = this.line.text.slice(0, Math.floor(u * 45));
      ctx.save();
      ctx.globalAlpha = al;
      ctx.font = 'italic 500 17px Cormorant, Georgia, serif';
      ctx.textAlign = 'center';
      const x = this.x, y = this.y - 26;
      const w = ctx.measureText(this.line.text).width + 26;
      const gr = ctx.createRadialGradient(x, y - 5, 4, x, y - 5, w * 0.6);
      gr.addColorStop(0, 'rgba(8,10,16,0.55)'); gr.addColorStop(1, 'rgba(8,10,16,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - w, y - 30, w * 2, 40);
      ctx.fillStyle = '#e9fbff';
      ctx.fillText(shown, x, y);
      ctx.restore();
    }
  }
}

export function drawThreadSprite(ctx, x, y, t, vx = 0, trail = null) {
  ctx.save();
  // the trailing thread of light
  if (trail && trail.length > 4) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, a] of [[5, 0.12], [1.6, 0.7]]) {
      ctx.strokeStyle = rgba('#9ff3ff', a); ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i += 2) {
        const k = i / trail.length;
        const wob = Math.sin(t * 6 + i * 0.4) * 2 * (1 - k);
        i ? ctx.lineTo(trail[i], trail[i + 1] + wob) : ctx.moveTo(trail[i], trail[i + 1] + wob);
      }
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, x, y, 34, [0.62, 0.95, 1], 0.55);
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(x, y);
  const tilt = clamp(vx * 0.002, -0.5, 0.5);
  ctx.rotate(tilt);
  // wings: two pairs of moth wings, fluttering
  const flap = Math.sin(t * 22) * 0.5 + 0.5;
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.scale(sd, 1);
    ctx.fillStyle = 'rgba(220,250,255,0.55)';
    ctx.beginPath(); ctx.ellipse(5, -3, 7, 3.2 + flap * 2.5, -0.5 - flap * 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(180,240,255,0.4)';
    ctx.beginPath(); ctx.ellipse(4, 3, 5, 2.2 + flap * 1.5, 0.5 + flap * 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // needle body with an eye
  const gr = ctx.createLinearGradient(-2, 0, 2, 0);
  gr.addColorStop(0, '#9fb3c2'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#7d8fa0');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(2.2, -2, 0.6, 12); ctx.lineTo(-0.6, 12); ctx.quadraticCurveTo(-2.2, -2, 0, -11); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -6.5, 0.9, 2.2, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#e9fbff'; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill();
  ctx.restore();
}
