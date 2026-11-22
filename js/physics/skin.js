// Ragdoll look: sleek lit capsules (no outlines), rounded block head, cloth cape, blade.
// Shading = base fill + soft highlight band toward the key light + shadow band + optional rim light.
import { P } from './body.js';
import { shade, mix, rgba, clamp, lerp, TAU } from '../core/util.js';

const LX = -0.55, LY = -0.83; // key light direction (from upper left)

export const DEFAULT_LOOK = {
  body: '#f2ece1', shade: '#c9bfae', mat: 'cloth', eyes: '#9ff3ff', eyeStyle: 'dots',
  head: 'none', cape: { col: '#b8473f', len: 7, style: 'cape' }, blade: { col: '#e8eef5', glow: '#9ff3ff', len: 30 },
  marks: [], rim: '#ffe2bd', trail: null, scale: 1,
};

export class Cape {
  constructor(n, segLen) {
    this.n = n; this.seg = segLen;
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.ox = new Float32Array(n); this.oy = new Float32Array(n);
    this.ix = new Float32Array(n); this.iy = new Float32Array(n);
    this.init = false;
  }
  step(dt, ax, ay, wind, facing) {
    const n = this.n;
    if (!this.init) { for (let i = 0; i < n; i++) { this.x[i] = this.ox[i] = this.ix[i] = ax - facing * i * this.seg; this.y[i] = this.oy[i] = this.iy[i] = ay + i * 2; } this.init = true; }
    for (let i = 0; i < n; i++) { this.ix[i] = this.x[i]; this.iy[i] = this.y[i]; }
    this.x[0] = ax; this.y[0] = ay;
    const g = 900 * dt * dt;
    for (let i = 1; i < n; i++) {
      const vx = (this.x[i] - this.ox[i]) * 0.965, vy = (this.y[i] - this.oy[i]) * 0.965;
      this.ox[i] = this.x[i]; this.oy[i] = this.y[i];
      this.x[i] += vx + wind * dt * dt * 60 * (i / n);
      this.y[i] += vy + g;
    }
    for (let it = 0; it < 4; it++) {
      this.x[0] = ax; this.y[0] = ay;
      for (let i = 1; i < n; i++) {
        const dx = this.x[i] - this.x[i - 1], dy = this.y[i] - this.y[i - 1];
        const d = Math.hypot(dx, dy) || 1e-5;
        const c = (d - this.seg) / d;
        if (i === 1) { this.x[i] -= dx * c; this.y[i] -= dy * c; }
        else { this.x[i] -= dx * c * 0.5; this.y[i] -= dy * c * 0.5; this.x[i - 1] += dx * c * 0.5; this.y[i - 1] += dy * c * 0.5; }
      }
      // the cape hangs behind the body
      for (let i = 1; i < n; i++) {
        const minBack = -facing * 1.5;
        if ((this.x[i] - ax) * facing > 4 + i * 1.5) this.x[i] = ax + facing * (4 + i * 1.5);
        void minBack;
      }
    }
  }
}

function limb(ctx, ax, ay, bx, by, w, col, mat, lightK = 1) {
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
  let nx = -dy / l, ny = dx / l;
  if (nx * LX + ny * LY < 0) { nx = -nx; ny = -ny; }
  const gloss = mat === 'porcelain' ? 0.75 : mat === 'metal' ? 0.85 : mat === 'glow' ? 0.25 : mat === 'shadow' ? 0.18 : 0.38;
  // shadow side
  ctx.strokeStyle = rgba('#000000', mat === 'metal' ? 0.32 : 0.2);
  ctx.lineWidth = w * 0.34;
  ctx.beginPath(); ctx.moveTo(ax - nx * w * 0.3, ay - ny * w * 0.3); ctx.lineTo(bx - nx * w * 0.3, by - ny * w * 0.3); ctx.stroke();
  // highlight band
  ctx.strokeStyle = rgba('#ffffff', gloss * 0.55 * lightK);
  ctx.lineWidth = w * (mat === 'porcelain' || mat === 'metal' ? 0.2 : 0.34);
  ctx.beginPath(); ctx.moveTo(ax + nx * w * 0.22, ay + ny * w * 0.22); ctx.lineTo(bx + nx * w * 0.22, by + ny * w * 0.22); ctx.stroke();
}

// draw a body. o: {alpha, flash, look, blade (bool), bladeAng, time, dissolve, glows[]}
export function drawBody(ctx, b, look, a, o = {}) {
  const s = b.s, f = b.facing;
  const X = i => b.ipx(i, a), Y = i => b.ipy(i, a);
  let body = look.body, back = look.shade;
  if (o.flash > 0) { body = mix(body, '#ffffff', o.flash); back = mix(back, '#ffffff', o.flash); }
  if (o.tint) { body = mix(body, o.tint[0], o.tint[1]); back = mix(back, o.tint[0], o.tint[1]); }
  const mat = look.mat;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // cape behind everything
  if (o.cape && look.cape) drawCape(ctx, o.cape, look, a, s, f);
  // back limbs
  limb(ctx, X(P.PELVIS), Y(P.PELVIS), X(P.KNEE_B), Y(P.KNEE_B), 9.5 * s, back, mat, 0.6);
  limb(ctx, X(P.KNEE_B), Y(P.KNEE_B), X(P.FOOT_B), Y(P.FOOT_B), 8 * s, back, mat, 0.6);
  limb(ctx, X(P.FOOT_B), Y(P.FOOT_B), X(P.TOE_B), Y(P.TOE_B), 6.5 * s, back, mat, 0.5);
  limb(ctx, X(P.CHEST), Y(P.CHEST), X(P.ELB_B), Y(P.ELB_B), 8 * s, back, mat, 0.6);
  limb(ctx, X(P.ELB_B), Y(P.ELB_B), X(P.HAND_B), Y(P.HAND_B), 7 * s, back, mat, 0.6);
  // torso
  limb(ctx, X(P.PELVIS), Y(P.PELVIS), X(P.BELLY), Y(P.BELLY), 14 * s, body, mat);
  limb(ctx, X(P.BELLY), Y(P.BELLY), X(P.CHEST), Y(P.CHEST), 15.5 * s, body, mat);
  limb(ctx, X(P.CHEST), Y(P.CHEST), X(P.NECK), Y(P.NECK), 7 * s, body, mat);
  // kintsugi / marks on the torso
  if (look.marks && look.marks.length) {
    ctx.lineWidth = 1.4 * s;
    for (let m = 0; m < look.marks.length; m++) {
      const mk = look.marks[m];
      ctx.strokeStyle = mk.col || '#f2c86a';
      const t0 = 0.2 + (m * 0.27) % 0.6;
      const ax = lerp(X(P.PELVIS), X(P.CHEST), t0), ay = lerp(Y(P.PELVIS), Y(P.CHEST), t0);
      ctx.beginPath(); ctx.moveTo(ax - 6 * s, ay - 2 * s); ctx.lineTo(ax - 1 * s, ay + 1 * s); ctx.lineTo(ax + 3 * s, ay - 3 * s); ctx.lineTo(ax + 6 * s, ay - 1 * s); ctx.stroke();
      if (o.glows) o.glows.push([ax, ay, 10 * s, mk.col || '#f2c86a', 0.25]);
    }
  }
  if (mat === 'glow') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(look.eyes, 0.6); ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(X(P.PELVIS), Y(P.PELVIS)); ctx.lineTo(X(P.BELLY), Y(P.BELLY)); ctx.lineTo(X(P.CHEST), Y(P.CHEST)); ctx.stroke();
    ctx.restore();
  }
  // head
  const hx = X(P.HEAD), hy = Y(P.HEAD);
  const ha = Math.atan2(hy - Y(P.NECK), hx - X(P.NECK)) + Math.PI / 2;
  const hr = 8.6 * s;
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(ha);
  drawHeadBack(ctx, look, hr, s, f, o.time || 0);
  const hg = ctx.createLinearGradient(-hr * f, -hr, hr * f, hr);
  hg.addColorStop(0, shade(body, mat === 'metal' ? 0.35 : 0.14)); hg.addColorStop(0.55, body); hg.addColorStop(1, shade(body, mat === 'metal' ? -0.35 : -0.16));
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.roundRect(-hr, -hr * 1.05, hr * 2, hr * 2.1, hr * 0.78); ctx.fill();
  if (mat === 'porcelain' || mat === 'metal') {
    ctx.fillStyle = rgba('#ffffff', 0.55);
    ctx.beginPath(); ctx.ellipse(-hr * 0.35, -hr * 0.55, hr * 0.32, hr * 0.18, -0.5, 0, TAU); ctx.fill();
  }
  // face
  const eyeX = hr * 0.42 * f, eyeY = -hr * 0.05;
  if (look.eyeStyle !== 'none') {
    ctx.fillStyle = look.eyes;
    if (look.eyeStyle === 'slit') { ctx.beginPath(); ctx.roundRect(eyeX - hr * 0.45, eyeY - 1.2 * s, hr * 0.9, 2.4 * s, 1.2 * s); ctx.fill(); }
    else if (look.eyeStyle === 'visor') { ctx.beginPath(); ctx.roundRect(-hr * 0.7 + eyeX * 0.4, eyeY - 2.6 * s, hr * 1.4, 5.2 * s, 2.6 * s); ctx.fill(); }
    else {
      ctx.beginPath(); ctx.ellipse(eyeX - 3.2 * s * f, eyeY, 1.5 * s, 2.3 * s, 0, 0, TAU); ctx.ellipse(eyeX + 2.4 * s * f, eyeY, 1.4 * s, 2.2 * s, 0, 0, TAU); ctx.fill();
    }
    if (o.glows) {
      const c = Math.cos(ha), sn = Math.sin(ha);
      o.glows.push([hx + eyeX * c - eyeY * sn, hy + eyeX * sn + eyeY * c, 9 * s, look.eyes, 0.55]);
    }
  }
  drawHeadFront(ctx, look, hr, s, f, o.time || 0, o.glows, hx, hy, ha);
  ctx.restore();
  // front leg
  limb(ctx, X(P.PELVIS), Y(P.PELVIS), X(P.KNEE_F), Y(P.KNEE_F), 10 * s, body, mat);
  limb(ctx, X(P.KNEE_F), Y(P.KNEE_F), X(P.FOOT_F), Y(P.FOOT_F), 8.5 * s, body, mat);
  limb(ctx, X(P.FOOT_F), Y(P.FOOT_F), X(P.TOE_F), Y(P.TOE_F), 7 * s, body, mat);
  // blade in the front hand
  if (o.blade) drawBlade(ctx, b, look, a, o);
  // front arm
  limb(ctx, X(P.CHEST), Y(P.CHEST), X(P.ELB_F), Y(P.ELB_F), 8.5 * s, body, mat);
  limb(ctx, X(P.ELB_F), Y(P.ELB_F), X(P.HAND_F), Y(P.HAND_F), 7.5 * s, body, mat);
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(X(P.HAND_F), Y(P.HAND_F), 4.2 * s, 0, TAU); ctx.fill();
  // rim light along the back edge of the torso (cinematic separation from dark backgrounds)
  if (look.rim && o.rim !== 0) {
    ctx.strokeStyle = rgba(look.rim, 0.5 * (o.rim ?? 1)); ctx.lineWidth = 1.6 * s;
    const ox = -f * 6.5 * s;
    ctx.beginPath(); ctx.moveTo(X(P.PELVIS) + ox, Y(P.PELVIS) - 2 * s); ctx.lineTo(X(P.CHEST) + ox * 1.05, Y(P.CHEST)); ctx.stroke();
  }
  ctx.restore();
}

export function bladeGeom(b, look, a) {
  const s = b.s;
  const ex = b.ipx(P.ELB_F, a), ey = b.ipy(P.ELB_F, a), hx = b.ipx(P.HAND_F, a), hy = b.ipy(P.HAND_F, a);
  const ang = Math.atan2(hy - ey, hx - ex);
  const L = (look.blade ? look.blade.len : 30) * s;
  return { x0: hx, y0: hy, x1: hx + Math.cos(ang) * L, y1: hy + Math.sin(ang) * L, ang };
}
function drawBlade(ctx, b, look, a, o) {
  const s = b.s;
  const g = bladeGeom(b, look, a);
  const bl = look.blade || DEFAULT_LOOK.blade;
  const nx = -Math.sin(g.ang), ny = Math.cos(g.ang);
  const L = Math.hypot(g.x1 - g.x0, g.y1 - g.y0);
  const ux = (g.x1 - g.x0) / L, uy = (g.y1 - g.y0) / L;
  const w = 2.6 * s;
  // guard
  ctx.strokeStyle = shade(bl.col, -0.45); ctx.lineWidth = 2.4 * s;
  ctx.beginPath(); ctx.moveTo(g.x0 + ux * 3 * s + nx * 5 * s, g.y0 + uy * 3 * s + ny * 5 * s); ctx.lineTo(g.x0 + ux * 3 * s - nx * 5 * s, g.y0 + uy * 3 * s - ny * 5 * s); ctx.stroke();
  // leaf-shaped blade
  ctx.fillStyle = bl.col;
  ctx.beginPath();
  ctx.moveTo(g.x0 + ux * 3 * s, g.y0 + uy * 3 * s);
  ctx.quadraticCurveTo(g.x0 + ux * L * 0.5 + nx * w * 1.6, g.y0 + uy * L * 0.5 + ny * w * 1.6, g.x1, g.y1);
  ctx.quadraticCurveTo(g.x0 + ux * L * 0.5 - nx * w * 1.6, g.y0 + uy * L * 0.5 - ny * w * 1.6, g.x0 + ux * 3 * s, g.y0 + uy * 3 * s);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = 0.9 * s;
  ctx.beginPath(); ctx.moveTo(g.x0 + ux * 5 * s + nx * w * 0.5, g.y0 + uy * 5 * s + ny * w * 0.5); ctx.lineTo(g.x1 - ux * 3 * s, g.y1 - uy * 3 * s); ctx.stroke();
  if (o.glows && bl.glow) o.glows.push([lerp(g.x0, g.x1, 0.6), lerp(g.y0, g.y1, 0.6), 16 * s, bl.glow, 0.18 + (o.bladeHot || 0) * 0.6]);
}

function drawCape(ctx, c, look, a, s, f) {
  const n = c.n;
  const X = i => c.ix[i] + (c.x[i] - c.ix[i]) * a, Y = i => c.iy[i] + (c.y[i] - c.iy[i]) * a;
  const col = look.cape.col;
  const wide = look.cape.style === 'scarf' ? 3.2 : 6.5;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const j = Math.min(i + 1, n - 1), k = Math.max(i - 1, 0);
    let dx = X(j) - X(k), dy = Y(j) - Y(k);
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    const w = (wide - (wide - 2.4) * (i / (n - 1))) * s * (look.cape.style === 'scarf' ? 1 : 1 + i * 0.05);
    L.push([X(i) + nx * w, Y(i) + ny * w]); R.push([X(i) - nx * w, Y(i) - ny * w]);
  }
  const g = ctx.createLinearGradient(X(0), Y(0), X(n - 1), Y(n - 1));
  g.addColorStop(0, shade(col, -0.25)); g.addColorStop(0.4, col); g.addColorStop(1, shade(col, -0.1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  // ragged hem
  const tip = n - 1;
  ctx.lineTo(X(tip) + (R[tip][0] - L[tip][0]) * 0.3, Y(tip) + (R[tip][1] - L[tip][1]) * 0.3 + 3 * s);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.14); ctx.lineWidth = 1.4 * s;
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]); ctx.stroke();
}

function drawHeadBack(ctx, look, hr, s, f, t) {
  const h = look.head;
  if (h === 'hood') {
    ctx.fillStyle = look.hoodCol || shade(look.cape ? look.cape.col : '#555', -0.15);
    ctx.beginPath(); ctx.roundRect(-hr * 1.25, -hr * 1.35, hr * 2.5, hr * 2.5, hr); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-hr * 0.9 * f, -hr * 0.9); ctx.quadraticCurveTo(-hr * 2.2 * f, -hr * 0.2, -hr * 1.9 * f, hr * 0.9); ctx.lineTo(-hr * 0.8 * f, hr * 0.6); ctx.fill();
  }
}
function drawHeadFront(ctx, look, hr, s, f, t, glows, hx, hy, ha) {
  const h = look.head;
  const acc = look.accent || '#f2c86a';
  if (h === 'horns') {
    ctx.fillStyle = look.hornCol || '#2a2630';
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sd * hr * 0.55, -hr * 0.85); ctx.quadraticCurveTo(sd * hr * 1.5, -hr * 1.6, sd * hr * 1.2, -hr * 2.6); ctx.quadraticCurveTo(sd * hr * 1.0, -hr * 1.7, sd * hr * 0.2, -hr * 1.0); ctx.fill();
    }
  } else if (h === 'crown') {
    ctx.fillStyle = acc;
    ctx.beginPath(); ctx.moveTo(-hr * 0.8, -hr * 1.0); ctx.lineTo(-hr * 0.8, -hr * 1.55); ctx.lineTo(-hr * 0.4, -hr * 1.25); ctx.lineTo(0, -hr * 1.75); ctx.lineTo(hr * 0.4, -hr * 1.25); ctx.lineTo(hr * 0.8, -hr * 1.55); ctx.lineTo(hr * 0.8, -hr * 1.0); ctx.closePath(); ctx.fill();
  } else if (h === 'halo') {
    ctx.strokeStyle = acc; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.ellipse(0, -hr * 1.7 + Math.sin(t * 2) * 0.8 * s, hr * 0.9, hr * 0.28, 0, 0, TAU); ctx.stroke();
    if (glows) glows.push([hx + Math.sin(ha) * hr * 1.7, hy - Math.cos(ha) * hr * 1.7, 14 * s, acc, 0.35]);
  } else if (h === 'antlers') {
    ctx.strokeStyle = look.hornCol || '#d9cdb8'; ctx.lineWidth = 1.8 * s;
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sd * hr * 0.4, -hr); ctx.lineTo(sd * hr * 0.9, -hr * 2.2); ctx.moveTo(sd * hr * 0.7, -hr * 1.6); ctx.lineTo(sd * hr * 1.5, -hr * 2.0); ctx.moveTo(sd * hr * 0.85, -hr * 2.0); ctx.lineTo(sd * hr * 0.5, -hr * 2.6); ctx.stroke();
    }
  } else if (h === 'mask') {
    ctx.fillStyle = look.maskCol || '#f4f1ea';
    ctx.beginPath(); ctx.roundRect(-hr * 0.95, -hr * 1.1, hr * 1.9, hr * 1.8, [hr * 0.9, hr * 0.9, hr * 0.5, hr * 0.5]); ctx.fill();
    ctx.fillStyle = '#121016';
    ctx.beginPath(); ctx.ellipse(hr * 0.15 * f - hr * 0.38, -hr * 0.1, hr * 0.22, hr * 0.36, 0, 0, TAU); ctx.ellipse(hr * 0.15 * f + hr * 0.38, -hr * 0.1, hr * 0.22, hr * 0.36, 0, 0, TAU); ctx.fill();
    if (look.maskHorns) { ctx.fillStyle = look.maskCol || '#f4f1ea'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * hr * 0.3, -hr * 0.95); ctx.lineTo(sd * hr * 0.75, -hr * 2.1); ctx.lineTo(sd * hr * 0.85, -hr * 0.8); ctx.fill(); } }
  } else if (h === 'tophat') {
    ctx.fillStyle = '#26232b';
    ctx.fillRect(-hr * 1.1, -hr * 1.12, hr * 2.2, hr * 0.25);
    ctx.fillRect(-hr * 0.7, -hr * 2.2, hr * 1.4, hr * 1.1);
    ctx.fillStyle = acc; ctx.fillRect(-hr * 0.7, -hr * 1.35, hr * 1.4, hr * 0.2);
  } else if (h === 'leaf') {
    ctx.fillStyle = '#7da48a';
    ctx.beginPath(); ctx.ellipse(hr * 0.2, -hr * 1.35, hr * 0.35, hr * 0.7, 0.5 * f, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5c7a63'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(0, -hr * 1.0); ctx.lineTo(hr * 0.1, -hr * 1.3); ctx.stroke();
  }
}

export function drawShadow(ctx, x, y, w, k) {
  if (k <= 0.02) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, w);
  g.addColorStop(0, `rgba(0,0,0,${0.32 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.28, 0, 0, TAU); ctx.fill();
}
export { clamp };
