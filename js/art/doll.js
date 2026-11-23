// Character renderer. Every body shares the physics rig; looks differ by anatomy weights, materials and
// one big readable accessory. Forms are tapered capsules shaded like cylinders lit from the upper left,
// with rim light from behind. No outlines.
import { P } from '../physics/body.js';
import { capsule, hull, ballShade, softDisc, stitches, shade, mix, rgba, LIGHT, TAU } from './paint.js';

const lerp = (a, b, t) => a + (b - a) * t;

function matK(mat) {
  // [shadow depth, highlight] per material
  return mat === 'porcelain' ? [0.3, 0.3] : mat === 'metal' ? [0.55, 0.34] : mat === 'glow' ? [0.35, 0.12] : mat === 'shadow' ? [0.3, 0.08] : [0.42, 0.14];
}

export function drawDoll(ctx, b, look, a, o = {}) {
  const s = b.s, f = b.facing;
  const X = i => b.ipx(i, a), Y = i => b.ipy(i, a);
  let body = look.body, back = look.shade;
  if (o.flash > 0) { body = mix(body, '#ffffff', o.flash); back = mix(back, '#ffffff', o.flash); }
  if (o.tint) { body = mix(body, o.tint[0], o.tint[1]); back = mix(back, o.tint[0], o.tint[1]); }
  const [dk, hi] = matK(look.mat);
  const M = { dark: dk, hi };
  const MB = { dark: dk * 0.8, hi: hi * 0.5 };
  const rim = look.rim && o.rim !== 0 ? look.rim : null;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // torso axis (for accessories)
  const cx = X(P.CHEST), cy = Y(P.CHEST), px = X(P.PELVIS), py = Y(P.PELVIS), bx = X(P.BELLY), by = Y(P.BELLY);
  let tx = cx - px, ty = cy - py; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;   // up the spine
  const nx = -ty * f, ny = tx * f;   // toward the facing side, perpendicular to the spine
  const bulk = look.bulk || 1;

  // ---------- behind the body
  if (o.cape && look.cape) drawCape(ctx, o.cape, look, a, s, f);
  if (look.pack) drawPack(ctx, cx, cy, px, py, tx, ty, nx, ny, s, f, look);
  if (look.staff) drawStaff(ctx, X(P.HAND_B), Y(P.HAND_B), s, f, look, o);
  if (look.hammer) {
    const hx0 = cx - nx * 6 * s, hy0 = cy - ny * 6 * s;
    capsule(ctx, hx0 + tx * 10 * s - nx * 2 * s, hy0 + ty * 10 * s - ny * 2 * s, px - nx * 9 * s - tx * 8 * s, py - ny * 9 * s - ty * 8 * s, 1.6 * s, 1.6 * s, '#6b4a32', { dark: 0.45 });
    ctx.save(); ctx.translate(hx0 + tx * 12 * s - nx * 2 * s, hy0 + ty * 12 * s - ny * 2 * s); ctx.rotate(Math.atan2(ty, tx));
    const hg = ctx.createLinearGradient(0, -6 * s, 0, 6 * s); hg.addColorStop(0, '#9a9aa6'); hg.addColorStop(0.5, '#5e5e6a'); hg.addColorStop(1, '#2e2e36');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(-4 * s, -7 * s, 8 * s, 14 * s, 2 * s); ctx.fill(); ctx.restore();
  }

  // ---------- far limbs
  const legR = (look.legs || 1) * s, armR = (look.arms || 1) * s * bulk;
  capsule(ctx, X(P.CHEST), Y(P.CHEST), X(P.ELB_B), Y(P.ELB_B), 3.9 * armR, 3.2 * armR, back, MB);
  capsule(ctx, X(P.ELB_B), Y(P.ELB_B), X(P.HAND_B), Y(P.HAND_B), 3.2 * armR, 2.7 * armR, back, MB);
  hand(ctx, X(P.ELB_B), Y(P.ELB_B), X(P.HAND_B), Y(P.HAND_B), 3.4 * armR * (look.gaunt ? 1.35 : 1), look.gaunt ? shade(look.armor || back, -0.1) : back, MB, look.claws);
  if (!look.robe) {
    capsule(ctx, X(P.PELVIS), Y(P.PELVIS), X(P.KNEE_B), Y(P.KNEE_B), 5.1 * legR, 3.9 * legR, back, MB);
    capsule(ctx, X(P.KNEE_B), Y(P.KNEE_B), X(P.FOOT_B), Y(P.FOOT_B), 3.9 * legR, 3.1 * legR, back, MB);
    boot(ctx, X(P.FOOT_B), Y(P.FOOT_B), X(P.TOE_B), Y(P.TOE_B), s, look.bootCol ? shade(look.bootCol, -0.25) : shade(back, -0.12), MB);
  }

  // ---------- torso
  capsule(ctx, X(P.NECK), Y(P.NECK), X(P.CHEST), Y(P.CHEST), 3.1 * s, 3.6 * s, body, M);
  const tn = hull(ctx, [[cx + tx * 1.5 * s, cy + ty * 1.5 * s, 8.4 * s * bulk], [bx, by, 6.6 * s * bulk], [px, py, 7.4 * s * bulk]], body, M);
  if (rim) { ctx.strokeStyle = rgba(rim, 0.5); ctx.lineWidth = 1.3 * s; ctx.beginPath(); ctx.moveTo(cx - tn.nx * 7.8 * s * bulk, cy - tn.ny * 7.8 * s * bulk); ctx.quadraticCurveTo(bx - tn.nx * 6.6 * s * bulk, by - tn.ny * 6.6 * s * bulk, px - tn.nx * 6.8 * s * bulk, py - tn.ny * 6.8 * s * bulk); ctx.stroke(); }
  // side seam of the doll
  if (look.seams !== false && look.mat !== 'metal') stitches(ctx, [[cx - nx * 5.6 * s + tx * 3 * s, cy - ny * 5.6 * s + ty * 3 * s], [bx - nx * 4.8 * s, by - ny * 4.8 * s], [px - nx * 5.2 * s - tx * 2 * s, py - ny * 5.2 * s - ty * 2 * s]], rgba(shade(body, -0.45), 0.55), 0.8 * s, 1.8 * s, 1.8 * s);
  // kintsugi marks from fallen wardens
  if (look.marks && look.marks.length) {
    ctx.lineWidth = 1.3 * s;
    look.marks.forEach((mk, m) => {
      const col = mk.col || '#f2c86a';
      const t0 = 0.25 + (m * 0.29) % 0.55;
      const ax = lerp(px, cx, t0), ay = lerp(py, cy, t0);
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(ax - nx * 6 * s, ay - ny * 6 * s); ctx.lineTo(ax - nx * 1 * s + tx * 2 * s, ay - ny * 1 * s + ty * 2 * s); ctx.lineTo(ax + nx * 2.5 * s - tx * 1.5 * s, ay + ny * 2.5 * s - ty * 1.5 * s); ctx.lineTo(ax + nx * 6 * s, ay + ny * 6 * s); ctx.stroke();
      if (o.glows) o.glows.push([ax, ay, 10 * s, col, 0.22]);
    });
  }
  if (look.mat === 'glow') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(look.eyes, 0.55); ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(bx + nx * 2 * s, by + ny * 2 * s, cx, cy); ctx.stroke();
    ctx.restore();
  }
  if (look.armor) drawArmor(ctx, cx, cy, bx, by, px, py, tx, ty, nx, ny, s * bulk, f, look);
  if (look.sash) drawSash(ctx, bx, by, px, py, tx, ty, nx, ny, s * bulk, f, look.sash, o.vx || 0);
  // the thread of light stitched into the chest
  if (look.thread) {
    const hx = lerp(bx, cx, 0.55) + nx * 2.6 * s, hy = lerp(by, cy, 0.55) + ny * 2.6 * s;
    const pulse = 0.75 + Math.sin((o.time || 0) * 3.2) * 0.25;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    softDisc(ctx, hx, hy, 7 * s, look.threadCol || '#9ff3ff', 0.35 * pulse);
    ctx.strokeStyle = look.threadCol || '#9ff3ff'; ctx.lineWidth = 1.1 * s;
    ctx.beginPath(); ctx.moveTo(hx - 2 * s, hy - 2 * s); ctx.lineTo(hx + 2 * s, hy + 2 * s); ctx.moveTo(hx + 2 * s, hy - 2 * s); ctx.lineTo(hx - 2 * s, hy + 2 * s); ctx.stroke();
    ctx.restore();
    if (o.glows) o.glows.push([hx, hy, 14 * s, look.threadCol || '#9ff3ff', 0.4 * pulse]);
  }

  // ---------- near leg (or robe)
  if (!look.robe) {
    capsule(ctx, X(P.PELVIS), Y(P.PELVIS), X(P.KNEE_F), Y(P.KNEE_F), 5.3 * legR, 4.1 * legR, body, M);
    capsule(ctx, X(P.KNEE_F), Y(P.KNEE_F), X(P.FOOT_F), Y(P.FOOT_F), 4.1 * legR, 3.2 * legR, body, M);
    boot(ctx, X(P.FOOT_F), Y(P.FOOT_F), X(P.TOE_F), Y(P.TOE_F), s, look.bootCol || shade(body, -0.08), M);
  }
  if (look.apron) drawApron(ctx, cx, cy, px, py, tx, ty, nx, ny, s, f, look.apron);
  if (look.cloak) drawCloak(ctx, cx, cy, px, py, tx, ty, nx, ny, s * bulk, f, look.cloak, o);
  if (look.robe) drawRobe(ctx, b, a, cx, cy, px, py, tx, ty, nx, ny, s, f, look.robe, o);
  if (look.armor) drawPlateSkirt(ctx, px, py, tx, ty, nx, ny, s * bulk, f, look.armor);

  // ---------- head
  const hx = X(P.HEAD), hy = Y(P.HEAD);
  const ha = Math.atan2(hy - Y(P.NECK), hx - X(P.NECK)) + Math.PI / 2;
  const hr = 8.6 * s * (look.head === 'mask' ? 0.95 : 1);
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(ha);
  drawHeadBack(ctx, look, hr, s, f);
  if (look.head !== 'mask') {
    const hg = ctx.createRadialGradient(-hr * 0.45 * f * 0 - hr * 0.35, -hr * 0.55, hr * 0.15, 0, 0, hr * 1.45);
    hg.addColorStop(0, shade(body, hi + 0.06)); hg.addColorStop(0.45, body); hg.addColorStop(1, shade(body, -dk));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.roundRect(-hr, -hr * 1.05, hr * 2, hr * 2.1, hr * 0.8); ctx.fill();
    if (rim) { ctx.strokeStyle = rgba(rim, 0.45); ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.arc(0, 0, hr * 0.98, Math.PI * (f > 0 ? 0.6 : -0.1), Math.PI * (f > 0 ? 1.1 : 0.4)); ctx.stroke(); }
    if (look.mat === 'porcelain' || look.mat === 'metal') { ctx.fillStyle = rgba('#ffffff', 0.5); ctx.beginPath(); ctx.ellipse(-hr * 0.4, -hr * 0.55, hr * 0.3, hr * 0.15, -0.5, 0, TAU); ctx.fill(); }
    // doll seam over the crown
    if (look.seams !== false && look.mat !== 'metal') stitches(ctx, [[-hr * 0.55 * f, -hr * 0.98], [-hr * 0.85 * f, -hr * 0.2], [-hr * 0.7 * f, hr * 0.6]], rgba(shade(body, -0.45), 0.5), 0.75 * s, 1.6 * s, 1.6 * s);
    drawFace(ctx, look, hr, s, f, o, hx, hy, ha);
  } else drawMask(ctx, look, hr, s, f, o, hx, hy, ha);
  drawHeadFront(ctx, look, hr, s, f, o.time || 0, o.glows, hx, hy, ha);
  ctx.restore();

  // ---------- blade, then the near arm over it
  if (o.blade && look.blade) drawBlade(ctx, b, look, a, o);
  capsule(ctx, X(P.CHEST), Y(P.CHEST), X(P.ELB_F), Y(P.ELB_F), 4.1 * armR, 3.4 * armR, look.armor ? shade(look.armor, 0.05) : body, M);
  capsule(ctx, X(P.ELB_F), Y(P.ELB_F), X(P.HAND_F), Y(P.HAND_F), 3.4 * armR, 2.8 * armR, body, M);
  if (look.armor) pauldron(ctx, lerp(X(P.CHEST), X(P.ELB_F), 0.28), lerp(Y(P.CHEST), Y(P.ELB_F), 0.28), X(P.ELB_F), Y(P.ELB_F), 4.6 * s * bulk, look.armor);
  hand(ctx, X(P.ELB_F), Y(P.ELB_F), X(P.HAND_F), Y(P.HAND_F), 3.6 * armR * (look.gaunt ? 1.35 : 1), look.gaunt ? (look.armor || body) : body, M, look.claws);
  if (look.tape) { ctx.strokeStyle = '#e8c35a'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(X(P.NECK) - nx * 3 * s, Y(P.NECK) - ny * 3 * s); ctx.quadraticCurveTo(cx + nx * 4 * s, cy + ny * 4 * s, bx + nx * 3 * s, by + ny * 3 * s); ctx.stroke(); }
  ctx.restore();
}

function hand(g, ex, ey, hx, hy, r, col, M, claws) {
  const dx = hx - ex, dy = hy - ey, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  ballShade(g, hx + ux * r * 0.25, hy + uy * r * 0.25, r, col, M);
  if (claws) {
    g.strokeStyle = claws; g.lineWidth = r * 0.32; g.lineCap = 'round';
    for (const k of [-0.5, 0, 0.5]) {
      const a = Math.atan2(uy, ux) + k;
      const x0 = hx + Math.cos(a) * r * 0.7, y0 = hy + Math.sin(a) * r * 0.7;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a) * r * 1.6, y0 + Math.sin(a) * r * 1.6, x0 + Math.cos(a + 0.6) * r * 2.4, y0 + Math.sin(a + 0.6) * r * 2.4); g.stroke();
    }
  }
}
function boot(g, ax, ay, bx, by, s, col, M) {
  capsule(g, ax, ay, bx, by, 3.5 * s, 3.1 * s, col, M);
  // sole
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
  g.strokeStyle = rgba('#000000', 0.35); g.lineWidth = 1.4 * s;
  g.beginPath(); g.moveTo(ax - dy / L * 3 * s, ay + dx / L * 3 * s + 1.5 * s); g.lineTo(bx - dy / L * 2.6 * s + dx / L * 2 * s, by + dx / L * 2.6 * s + 1.2 * s); g.stroke();
}
function drawFace(g, look, hr, s, f, o, hx, hy, ha) {
  const ex = hr * 0.42 * f, ey = -hr * 0.08;
  if (look.eyeStyle !== 'none') {
    const col = look.eyes;
    if (look.eyeStyle === 'slit') { g.fillStyle = col; g.beginPath(); g.ellipse(ex, ey, hr * 0.48, 1.3 * s, 0.08 * f, 0, TAU); g.fill(); }
    else if (look.eyeStyle === 'visor') { g.fillStyle = col; g.beginPath(); g.roundRect(-hr * 0.72 + ex * 0.4, ey - 2.4 * s, hr * 1.44, 4.8 * s, 2.4 * s); g.fill(); g.fillStyle = rgba('#ffffff', 0.6); g.fillRect(-hr * 0.5 + ex * 0.4, ey - 1.2 * s, hr * 0.8, 0.9 * s); }
    else {
      for (const [dx, w] of [[-3.3 * s * f, 1.0], [2.4 * s * f, 0.92]]) {
        g.fillStyle = col; g.beginPath(); g.ellipse(ex + dx, ey, 1.55 * s * w, 2.5 * s * w, 0, 0, TAU); g.fill();
        g.fillStyle = rgba('#ffffff', 0.85); g.beginPath(); g.ellipse(ex + dx - 0.4 * s, ey - 0.8 * s, 0.6 * s, 0.8 * s, 0, 0, TAU); g.fill();
      }
    }
    if (o.glows) { const c = Math.cos(ha), sn = Math.sin(ha); o.glows.push([hx + ex * c - ey * sn, hy + ex * sn + ey * c, 9 * s, col, 0.5]); }
  }
  // stitched mouth on dolls
  if (look.mouth !== false && look.seams !== false) stitches(g, [[ex - 2.2 * s * f, hr * 0.42], [ex + 2.4 * s * f, hr * 0.42]], rgba(shade(look.body, -0.5), 0.6), 0.7 * s, 1.1 * s, 1.0 * s);
}
function drawMask(g, look, hr, s, f, o, hx, hy, ha) {
  const mc = look.maskCol || '#ece6da';
  // dark hood behind the mask
  g.fillStyle = shade(look.body, -0.1);
  g.beginPath(); g.ellipse(-hr * 0.2 * f, 0, hr * 1.15, hr * 1.2, 0, 0, TAU); g.fill();
  const gr = g.createLinearGradient(-hr * f, -hr, hr * f, hr);
  gr.addColorStop(0, shade(mc, 0.12)); gr.addColorStop(0.6, mc); gr.addColorStop(1, shade(mc, -0.28));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, -hr * 1.35);
  g.bezierCurveTo(hr * 1.05, -hr * 1.3, hr * 1.0, hr * 0.4, hr * 0.25, hr * 1.15);
  g.lineTo(0, hr * 1.3);
  g.lineTo(-hr * 0.25, hr * 1.15);
  g.bezierCurveTo(-hr * 1.0, hr * 0.4, -hr * 1.05, -hr * 1.3, 0, -hr * 1.35);
  g.fill();
  if (look.maskHorns) {
    g.fillStyle = mc;
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * hr * 0.3, -hr * 1.15); g.quadraticCurveTo(sd * hr * 0.95, -hr * 1.8, sd * hr * 0.75, -hr * 2.5); g.quadraticCurveTo(sd * hr * 0.65, -hr * 1.7, sd * hr * 0.05, -hr * 1.25); g.fill(); }
  }
  // hollow eyes, slanted
  const eyeCol = look.eyes || '#ffb36b';
  for (const sd of [-1, 1]) {
    g.fillStyle = '#100d14';
    g.beginPath(); g.ellipse(hr * 0.12 * f + sd * hr * 0.4, -hr * 0.12, hr * 0.24, hr * 0.42, sd * 0.35, 0, TAU); g.fill();
  }
  g.fillStyle = eyeCol;
  for (const sd of [-1, 1]) { g.beginPath(); g.arc(hr * 0.12 * f + sd * hr * 0.4, -hr * 0.05, hr * 0.09, 0, TAU); g.fill(); }
  // crack
  g.strokeStyle = rgba(shade(mc, -0.5), 0.8); g.lineWidth = 0.8 * s;
  g.beginPath(); g.moveTo(hr * 0.15, -hr * 1.3); g.lineTo(hr * 0.3, -hr * 0.85); g.lineTo(hr * 0.12, -hr * 0.55); g.stroke();
  g.fillStyle = rgba('#ffffff', 0.35); g.beginPath(); g.ellipse(-hr * 0.35, -hr * 0.85, hr * 0.28, hr * 0.12, -0.6, 0, TAU); g.fill();
  if (o.glows) { const c = Math.cos(ha), sn = Math.sin(ha); const ex = hr * 0.12 * f, ey = -hr * 0.05; o.glows.push([hx + ex * c - ey * sn, hy + ex * sn + ey * c, 12 * s, eyeCol, 0.5]); }
}
function drawHeadBack(g, look, hr, s, f) {
  const h = look.head;
  if (h === 'hood') {
    const col = look.hoodCol || '#6b5446';
    capsule(g, -hr * 0.9 * f, -hr * 0.2, -hr * 1.6 * f, hr * 1.2, hr * 0.7, hr * 0.35, shade(col, -0.1), { dark: 0.4, hi: 0.1 });
    ballShade(g, -hr * 0.1 * f, -hr * 0.1, hr * 1.3, col, { dark: 0.45, hi: 0.12 });
  }
  if (h === 'widehat') {
    // brim behind the head shows past it
  }
}
function drawHeadFront(g, look, hr, s, f, t, glows, hx, hy, ha) {
  const h = look.head;
  const acc = look.accent || '#f2c86a';
  if (h === 'horns') {
    for (const sd of [-1, 1]) {
      const gr = g.createLinearGradient(sd * hr * 0.4, -hr, sd * hr * 1.2, -hr * 2.6);
      gr.addColorStop(0, look.hornCol || '#2a2630'); gr.addColorStop(1, shade(look.hornCol || '#2a2630', 0.35));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(sd * hr * 0.55, -hr * 0.8); g.quadraticCurveTo(sd * hr * 1.6, -hr * 1.5, sd * hr * 1.25, -hr * 2.7); g.quadraticCurveTo(sd * hr * 1.0, -hr * 1.7, sd * hr * 0.15, -hr * 1.0); g.fill();
    }
  } else if (h === 'crown') {
    const gr = g.createLinearGradient(0, -hr * 1.8, 0, -hr);
    gr.addColorStop(0, shade(acc, 0.3)); gr.addColorStop(1, shade(acc, -0.25));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-hr * 0.85, -hr * 0.95); g.lineTo(-hr * 0.85, -hr * 1.55); g.lineTo(-hr * 0.42, -hr * 1.22); g.lineTo(0, -hr * 1.85); g.lineTo(hr * 0.42, -hr * 1.22); g.lineTo(hr * 0.85, -hr * 1.55); g.lineTo(hr * 0.85, -hr * 0.95); g.closePath(); g.fill();
    g.fillStyle = '#9ff3ff'; g.beginPath(); g.arc(0, -hr * 1.18, hr * 0.12, 0, TAU); g.fill();
  } else if (h === 'halo') {
    g.strokeStyle = acc; g.lineWidth = 1.6 * s;
    g.beginPath(); g.ellipse(0, -hr * 1.7 + Math.sin(t * 2) * 0.8 * s, hr * 0.95, hr * 0.28, 0, 0, TAU); g.stroke();
    if (glows) glows.push([hx + Math.sin(ha) * hr * 1.7, hy - Math.cos(ha) * hr * 1.7, 14 * s, acc, 0.35]);
  } else if (h === 'antlers') {
    g.strokeStyle = look.hornCol || '#d9cdb8'; g.lineWidth = 2 * s; g.lineCap = 'round';
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * hr * 0.4, -hr); g.quadraticCurveTo(sd * hr * 0.6, -hr * 1.7, sd * hr * 1.0, -hr * 2.3); g.moveTo(sd * hr * 0.62, -hr * 1.6); g.lineTo(sd * hr * 1.45, -hr * 1.95); g.moveTo(sd * hr * 0.85, -hr * 2.05); g.lineTo(sd * hr * 0.55, -hr * 2.65); g.stroke(); }
  } else if (h === 'tophat') {
    capsule(g, -hr * 1.15, -hr * 1.08, hr * 1.15, -hr * 1.08, hr * 0.14, hr * 0.14, '#26232b', { dark: 0.3, hi: 0.25 });
    const gr = g.createLinearGradient(-hr * 0.7, 0, hr * 0.7, 0);
    gr.addColorStop(0, '#1b191f'); gr.addColorStop(0.35, '#3a3640'); gr.addColorStop(1, '#141217');
    g.fillStyle = gr; g.beginPath(); g.roundRect(-hr * 0.72, -hr * 2.3, hr * 1.44, hr * 1.25, [hr * 0.15, hr * 0.15, 0, 0]); g.fill();
    g.fillStyle = acc; g.fillRect(-hr * 0.72, -hr * 1.4, hr * 1.44, hr * 0.22);
  } else if (h === 'leaf') {
    g.strokeStyle = '#5c7a63'; g.lineWidth = 1.1 * s; g.beginPath(); g.moveTo(0, -hr * 1.0); g.quadraticCurveTo(hr * 0.1, -hr * 1.35, hr * 0.15, -hr * 1.5); g.stroke();
    const gr = g.createLinearGradient(-hr * 0.2, -hr * 1.9, hr * 0.6, -hr * 1.2);
    gr.addColorStop(0, '#a8cf96'); gr.addColorStop(1, '#5f8a64');
    g.fillStyle = gr; g.beginPath(); g.ellipse(hr * 0.3 * f, -hr * 1.55, hr * 0.32, hr * 0.62, 0.7 * f, 0, TAU); g.fill();
  } else if (h === 'widehat') {
    const col = look.hatCol || '#5a4636';
    g.fillStyle = shade(col, -0.25); g.beginPath(); g.ellipse(0, -hr * 0.92, hr * 1.9, hr * 0.38, 0, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.ellipse(0, -hr * 1.0, hr * 1.85, hr * 0.32, 0, 0, TAU); g.fill();
    ballShade(g, 0, -hr * 1.25, hr * 0.8, col, { dark: 0.4, hi: 0.18 });
    g.fillStyle = look.accent || '#c8473d'; g.fillRect(-hr * 0.78, -hr * 1.18, hr * 1.56, hr * 0.18);
  } else if (h === 'veil') {
    const col = look.veilCol || '#d9e6f0';
    const gr = g.createLinearGradient(0, -hr, 0, hr * 1.8);
    gr.addColorStop(0, rgba(col, 0.85)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(-hr * 1.1, -hr * 0.6); g.quadraticCurveTo(0, -hr * 1.6, hr * 1.1, -hr * 0.6); g.lineTo(hr * 1.3, hr * 1.8); g.lineTo(-hr * 1.3, hr * 1.8); g.closePath(); g.fill();
  }
}
function drawSash(g, bx, by, px, py, tx, ty, nx, ny, s, f, col, vx) {
  const mx = lerp(px, bx, 0.45), my = lerp(py, by, 0.45);
  const w = 7.2 * s, hgt = 2.6 * s;
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(mx - nx * w + tx * hgt, my - ny * w + ty * hgt); g.lineTo(mx + nx * w + tx * hgt, my + ny * w + ty * hgt);
  g.lineTo(mx + nx * w - tx * hgt, my + ny * w - ty * hgt); g.lineTo(mx - nx * w - tx * hgt, my - ny * w - ty * hgt); g.closePath(); g.fill();
  g.fillStyle = rgba('#ffffff', 0.18); g.fillRect(Math.min(mx - nx * w, mx + nx * w), my - hgt * 0.9, Math.abs(nx * w * 2), 0.9 * s);
  // knot and tails at the back hip
  const kx = mx - nx * w * 0.85, ky = my - ny * w * 0.85;
  g.fillStyle = shade(col, -0.15); g.beginPath(); g.arc(kx, ky, 2.2 * s, 0, TAU); g.fill();
  const sway = Math.max(-1, Math.min(1, -vx / 300)) * 4 * s;
  g.strokeStyle = col; g.lineWidth = 2.2 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(kx, ky); g.quadraticCurveTo(kx - f * 3 * s + sway, ky + 6 * s, kx - f * 4 * s + sway * 1.6, ky + 11 * s); g.stroke();
  g.strokeStyle = shade(col, -0.2); g.lineWidth = 1.8 * s;
  g.beginPath(); g.moveTo(kx, ky); g.quadraticCurveTo(kx - f * 1 * s + sway * 0.6, ky + 5 * s, kx - f * 1.5 * s + sway, ky + 9 * s); g.stroke();
}
function drawCloak(g, cx, cy, px, py, tx, ty, nx, ny, s, f, col, o) {
  // tattered poncho from the shoulders to mid thigh
  const sway = Math.max(-1, Math.min(1, -(o.vx || 0) / 260)) * 6 * s;
  const sh = 10 * s, hw = 12 * s;
  const bxp = px - tx * 12 * s, byp = py - ty * 12 * s;
  const gr = g.createLinearGradient(cx, cy, bxp, byp);
  gr.addColorStop(0, shade(col, 0.08)); gr.addColorStop(1, shade(col, -0.25));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(cx + tx * 3 * s - nx * sh, cy + ty * 3 * s - ny * sh);
  g.quadraticCurveTo(cx + tx * 6 * s, cy + ty * 6 * s, cx + tx * 3 * s + nx * sh, cy + ty * 3 * s + ny * sh);
  const n = 6;
  const L = [bxp + nx * hw + sway, byp + ny * hw], R = [bxp - nx * hw + sway, byp - ny * hw];
  g.lineTo(L[0], L[1]);
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const x = lerp(L[0], R[0], u), y = lerp(L[1], R[1], u);
    const up = i % 2 ? 6 * s : -1 * s;
    g.lineTo(x + tx * up, y + ty * up);
  }
  g.closePath(); g.fill();
  g.strokeStyle = rgba('#ffffff', 0.08); g.lineWidth = 1 * s;
  g.beginPath(); g.moveTo(cx + tx * 3 * s - nx * sh * 0.4, cy + ty * 3 * s - ny * sh * 0.4); g.lineTo(lerp(L[0], R[0], 0.65), lerp(L[1], R[1], 0.65)); g.stroke();
}
function drawRobe(g, b, a, cx, cy, px, py, tx, ty, nx, ny, s, f, col, o) {
  const fy = Math.max(b.ipy(P.FOOT_F, a), b.ipy(P.FOOT_B, a)) + 2 * s;
  const fx = (b.ipx(P.FOOT_F, a) + b.ipx(P.FOOT_B, a)) / 2;
  const sway = Math.max(-1, Math.min(1, -(o.vx || 0) / 260)) * 8 * s;
  const top = [cx + tx * 2 * s, cy + ty * 2 * s];
  const gr = g.createLinearGradient(px - nx * 14 * s, 0, px + nx * 14 * s, 0);
  gr.addColorStop(0, shade(col, -0.35)); gr.addColorStop(0.55, col); gr.addColorStop(0.85, shade(col, 0.12)); gr.addColorStop(1, shade(col, -0.05));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(top[0] - nx * 8 * s, top[1] - ny * 8 * s);
  g.quadraticCurveTo(px - nx * 10 * s, py, fx - 15 * s + sway, fy);
  const n = 7;
  for (let i = 1; i <= n; i++) { const x = lerp(fx - 15 * s + sway, fx + 15 * s + sway, i / n); g.lineTo(x, fy - (i % 2 ? 4 * s : 0)); }
  g.quadraticCurveTo(px + nx * 10 * s, py, top[0] + nx * 8 * s, top[1] + ny * 8 * s);
  g.closePath(); g.fill();
  // folds
  g.strokeStyle = rgba('#000000', 0.15); g.lineWidth = 1.2 * s;
  for (const k of [-0.4, 0.15, 0.6]) { g.beginPath(); g.moveTo(px + k * 8 * s, py); g.quadraticCurveTo(px + k * 10 * s, (py + fy) / 2, fx + k * 14 * s + sway, fy - 2 * s); g.stroke(); }
}
function drawApron(g, cx, cy, px, py, tx, ty, nx, ny, s, f, col) {
  const top = [cx - tx * 1 * s + nx * 2 * s, cy - ty * 1 * s + ny * 2 * s], bot = [px - tx * 16 * s + nx * 3 * s, py - ty * 16 * s + ny * 3 * s];
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(top[0] - nx * 4 * s, top[1] - ny * 4 * s); g.lineTo(top[0] + nx * 5 * s, top[1] + ny * 5 * s);
  g.lineTo(bot[0] + nx * 8 * s, bot[1] + ny * 8 * s); g.lineTo(bot[0] - nx * 6 * s, bot[1] - ny * 6 * s); g.closePath(); g.fill();
  g.fillStyle = rgba('#000000', 0.2); g.fillRect(Math.min(bot[0] - nx * 6 * s, bot[0] + nx * 8 * s), bot[1] - 2 * s, Math.abs(nx * 14 * s), 2 * s);
  g.strokeStyle = shade(col, -0.35); g.lineWidth = 0.9 * s; g.setLineDash([1.6 * s, 1.6 * s]);
  g.beginPath(); g.moveTo(top[0] - nx * 3 * s, top[1] - ny * 3 * s + 2 * s); g.lineTo(bot[0] - nx * 5 * s, bot[1] - ny * 5 * s - 2 * s); g.stroke(); g.setLineDash([]);
}
function drawPack(g, cx, cy, px, py, tx, ty, nx, ny, s, f, look) {
  const mx = lerp(px, cx, 0.6) - nx * 9 * s, my = lerp(py, cy, 0.6) - ny * 9 * s;
  const col = look.packCol || '#7a5a3c';
  g.save(); g.translate(mx, my); g.rotate(Math.atan2(ty, tx) + Math.PI / 2);
  const gr = g.createLinearGradient(-8 * s, 0, 8 * s, 0);
  gr.addColorStop(0, shade(col, -0.35)); gr.addColorStop(0.6, col); gr.addColorStop(1, shade(col, 0.1));
  g.fillStyle = gr; g.beginPath(); g.roundRect(-8 * s, -11 * s, 16 * s, 22 * s, 4 * s); g.fill();
  ballShade(g, 0, -13 * s, 5 * s, '#a8443a', { dark: 0.4 });
  capsule(g, -9 * s, -14 * s, 9 * s, -14 * s, 3.4 * s, 3.4 * s, '#c9b48a', { dark: 0.4, hi: 0.1 });
  g.fillStyle = '#4a4048'; g.beginPath(); g.arc(-6 * s * f, 8 * s, 3.5 * s, 0, TAU); g.fill();
  g.restore();
}
function drawStaff(g, hx, hy, s, f, look, o) {
  g.strokeStyle = '#5a4636'; g.lineWidth = 2 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(hx + f * 1 * s, hy + 26 * s); g.lineTo(hx - f * 2 * s, hy - 40 * s); g.stroke();
  const lx = hx - f * 2 * s, ly = hy - 40 * s;
  g.strokeStyle = '#3a3540'; g.lineWidth = 1 * s; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + f * 5 * s, ly + 4 * s); g.stroke();
  g.fillStyle = '#3a3540'; g.beginPath(); g.roundRect(lx + f * 5 * s - 3.5 * s, ly + 4 * s, 7 * s, 9 * s, 2 * s); g.fill();
  g.fillStyle = '#ffd28a'; g.beginPath(); g.roundRect(lx + f * 5 * s - 2.2 * s, ly + 5.5 * s, 4.4 * s, 6 * s, 1.5 * s); g.fill();
  if (o.glows) o.glows.push([lx + f * 5 * s, ly + 8.5 * s, 26 * s, '#ffd28a', 0.55]);
}
function drawArmor(g, cx, cy, bx, by, px, py, tx, ty, nx, ny, s, f, look) {
  const col = look.armor;
  // breastplate
  const tn = hull(g, [[cx + tx * 1 * s + nx * 0.8 * s, cy + ty * 1 * s + ny * 0.8 * s, 8.8 * s], [bx + nx * 0.6 * s, by + ny * 0.6 * s, 7.2 * s]], col, { dark: 0.55, hi: 0.32 });
  g.strokeStyle = rgba('#ffffff', 0.18); g.lineWidth = 1 * s;
  g.beginPath(); g.moveTo(bx, by); g.lineTo(cx + tx * 4 * s, cy + ty * 4 * s); g.stroke();
  void tn;
}
function drawPlateSkirt(g, px, py, tx, ty, nx, ny, s, f, col) {
  for (let i = 0; i < 3; i++) {
    const ox = (i - 1) * 6 * s;
    const x0 = px + nx * ox, y0 = py + ny * ox;
    capsule(g, x0, y0, x0 - tx * 15 * s + nx * ox * 0.4, y0 - ty * 15 * s + ny * ox * 0.4, 4.4 * s, 3.2 * s, shade(col, -0.05 * i), { dark: 0.55, hi: 0.3 });
  }
}
function pauldron(g, sx, sy, ex, ey, r, col) {
  const a = Math.atan2(ey - sy, ex - sx);
  g.save(); g.translate(sx, sy); g.rotate(a);
  const gr = g.createRadialGradient(-r * 0.3, -r * 0.5, r * 0.1, 0, 0, r * 1.2);
  gr.addColorStop(0, shade(col, 0.35)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, -0.5));
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * 1.15, r * 0.8, 0, 0, TAU); g.fill();
  g.fillStyle = rgba('#ffffff', 0.16); g.beginPath(); g.ellipse(-r * 0.3, -r * 0.3, r * 0.6, r * 0.2, 0, 0, TAU); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- blade
export function bladeGeom(b, look, a) {
  const s = b.s;
  const ex = b.ipx(P.ELB_F, a), ey = b.ipy(P.ELB_F, a), hx = b.ipx(P.HAND_F, a), hy = b.ipy(P.HAND_F, a);
  const ang = Math.atan2(hy - ey, hx - ex);
  const L = (look.blade ? look.blade.len : 30) * s;
  return { x0: hx, y0: hy, x1: hx + Math.cos(ang) * L, y1: hy + Math.sin(ang) * L, ang };
}
export function drawBlade(g, b, look, a, o) {
  const s = b.s;
  const geo = bladeGeom(b, look, a);
  const bl = look.blade;
  const ux = Math.cos(geo.ang), uy = Math.sin(geo.ang), nx = -uy, ny = ux;
  const L = Math.hypot(geo.x1 - geo.x0, geo.y1 - geo.y0);
  const w = (bl.w || 2.6) * s;
  const x0 = geo.x0 + ux * 4 * s, y0 = geo.y0 + uy * 4 * s;
  // grip + pommel behind the hand
  g.strokeStyle = '#3a2c2a'; g.lineWidth = 2.2 * s; g.beginPath(); g.moveTo(geo.x0 - ux * 5 * s, geo.y0 - uy * 5 * s); g.lineTo(x0, y0); g.stroke();
  ballShade(g, geo.x0 - ux * 6 * s, geo.y0 - uy * 6 * s, 1.8 * s, '#c9a45c', { dark: 0.4 });
  // blade body: steel with a bright edge and a darker fuller
  const gr = g.createLinearGradient(x0 - nx * w * 1.6, y0 - ny * w * 1.6, x0 + nx * w * 1.6, y0 + ny * w * 1.6);
  gr.addColorStop(0, shade(bl.col, -0.35)); gr.addColorStop(0.45, bl.col); gr.addColorStop(0.55, shade(bl.col, 0.3)); gr.addColorStop(1, shade(bl.col, -0.15));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(x0 - nx * w * 0.9, y0 - ny * w * 0.9);
  g.quadraticCurveTo(x0 + ux * L * 0.55 - nx * w * 1.45, y0 + uy * L * 0.55 - ny * w * 1.45, geo.x1, geo.y1);
  g.quadraticCurveTo(x0 + ux * L * 0.55 + nx * w * 1.45, y0 + uy * L * 0.55 + ny * w * 1.45, x0 + nx * w * 0.9, y0 + ny * w * 0.9);
  g.closePath(); g.fill();
  g.strokeStyle = rgba('#ffffff', 0.85); g.lineWidth = 0.8 * s;
  g.beginPath(); g.moveTo(x0 + ux * 3 * s + nx * w * 0.9, y0 + uy * 3 * s + ny * w * 0.9); g.quadraticCurveTo(x0 + ux * L * 0.55 + nx * w * 1.3, y0 + uy * L * 0.55 + ny * w * 1.3, geo.x1, geo.y1); g.stroke();
  g.strokeStyle = rgba(shade(bl.col, -0.5), 0.5); g.lineWidth = 0.8 * s;
  g.beginPath(); g.moveTo(x0 + ux * 3 * s, y0 + uy * 3 * s); g.lineTo(x0 + ux * L * 0.6, y0 + uy * L * 0.6); g.stroke();
  // cross guard
  capsule(g, x0 + nx * 5.5 * s, y0 + ny * 5.5 * s, x0 - nx * 5.5 * s, y0 - ny * 5.5 * s, 1.4 * s, 1.4 * s, '#c9a45c', { dark: 0.45, hi: 0.3 });
  if (o.glows && bl.glow) o.glows.push([lerp(x0, geo.x1, 0.6), lerp(y0, geo.y1, 0.6), 16 * s, bl.glow, 0.14 + (o.bladeHot || 0) * 0.55]);
}

// ---------------------------------------------------------------- cape
function drawCape(g, c, look, a, s, f) {
  const n = c.n;
  const X = i => c.ix[i] + (c.x[i] - c.ix[i]) * a, Y = i => c.iy[i] + (c.y[i] - c.iy[i]) * a;
  const col = look.cape.col;
  const scarf = look.cape.style === 'scarf';
  const wide = scarf ? 3.2 : 7;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const j = Math.min(i + 1, n - 1), k = Math.max(i - 1, 0);
    const dx = X(j) - X(k), dy = Y(j) - Y(k);
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    const w = (wide - (wide - (scarf ? 2.2 : 3.4)) * (i / (n - 1)) + (scarf ? 0 : i * 0.35)) * s;
    L.push([X(i) + nx * w, Y(i) + ny * w]); R.push([X(i) - nx * w, Y(i) - ny * w]);
  }
  // body of the cloth with fold bands
  const gr = g.createLinearGradient(L[0][0], L[0][1], R[0][0], R[0][1]);
  gr.addColorStop(0, shade(col, -0.32)); gr.addColorStop(0.35, col); gr.addColorStop(0.55, shade(col, 0.12)); gr.addColorStop(0.75, shade(col, -0.1)); gr.addColorStop(1, shade(col, -0.3));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) g.quadraticCurveTo(L[i - 1][0], L[i - 1][1], (L[i - 1][0] + L[i][0]) / 2, (L[i - 1][1] + L[i][1]) / 2);
  g.lineTo(L[n - 1][0], L[n - 1][1]);
  // tattered hem
  const tip = n - 1;
  const hx = (L[tip][0] + R[tip][0]) / 2, hy = (L[tip][1] + R[tip][1]) / 2;
  g.lineTo(lerp(L[tip][0], hx, 0.5) + 2 * s, lerp(L[tip][1], hy, 0.5) - 3 * s);
  g.lineTo(hx + (X(tip) - X(tip - 1)) * 0.6, hy + (Y(tip) - Y(tip - 1)) * 0.6);
  g.lineTo(lerp(R[tip][0], hx, 0.5) - 1 * s, lerp(R[tip][1], hy, 0.5) - 2 * s);
  g.lineTo(R[tip][0], R[tip][1]);
  for (let i = n - 1; i > 0; i--) g.quadraticCurveTo(R[i][0], R[i][1], (R[i][0] + R[i - 1][0]) / 2, (R[i][1] + R[i - 1][1]) / 2);
  g.lineTo(R[0][0], R[0][1]);
  g.closePath(); g.fill();
  // inner lining shows on the lower edge
  g.strokeStyle = rgba(shade(col, -0.45), 0.6); g.lineWidth = 1.2 * s;
  g.beginPath(); g.moveTo(R[0][0], R[0][1]); for (let i = 1; i < n; i++) g.lineTo(R[i][0], R[i][1]); g.stroke();
  g.strokeStyle = rgba('#ffffff', 0.16); g.lineWidth = 1 * s;
  g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]); g.stroke();
  // wrap around the neck
  if (scarf || look.cape.wrap !== false) capsule(g, X(0) - f * 4 * s, Y(0) - 1 * s, X(0) + f * 6 * s, Y(0) + 1 * s, 3 * s, 3 * s, col, { dark: 0.4, hi: 0.2 });
}
