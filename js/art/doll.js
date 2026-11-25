// Character renderer, built to the character reference bible: a slim doll with a round sphere head and
// two glowing oval eyes, a cream coat with a stand collar, a brown belt with a gold buckle, slim limbs,
// brown boots and a long flowing scarf. Keepers wear long cloaks, Hollows wear hoods and masks, Wardens
// trail huge tattered capes. Same physics rig for everyone. No outlines: shaded forms + rim light.
import { setGrit, drawGrit } from './grit.js';
import { P } from '../physics/body.js';
import { IMG } from './images.js';
import { capsule, hull, ballShade, softDisc, stitches, shade, mix, rgba, LIGHT, TAU } from './paint.js';

const lerp = (a, b, t) => a + (b - a) * t;
const COAT = '#ece6dc', LIMB = '#f2eee7', BOOT = '#6b4a32', BELT = '#5e4230', GOLD = '#d9a441';

function matK(mat) {
  return mat === 'porcelain' ? [0.28, 0.3] : mat === 'metal' ? [0.5, 0.34] : mat === 'glow' ? [0.32, 0.14] : mat === 'shadow' ? [0.3, 0.1] : [0.36, 0.14];
}

export function drawDoll(ctx, b, look, a, o = {}) {
  if (look.grit) setGrit(true, look.gritA || 0.62);
  try { drawDollInner(ctx, b, look, a, o); } finally { setGrit(false); }
  if (look.grit) { ctx.save(); drawGrit(ctx, b, look, a, o.time || 0); ctx.restore(); }
}
function drawDollInner(ctx, b, look, a, o) {
  const s = b.s, f = b.facing;
  const X = i => b.ipx(i, a), Y = i => b.ipy(i, a);
  const fl = o.flash > 0 ? o.flash : 0;
  const tint = (c) => { if (fl) c = mix(c, '#ffffff', fl); if (o.tint) c = mix(c, o.tint[0], o.tint[1]); return c; };
  const skin = tint(look.body);
  const coat = tint(look.coat || (look.mat === 'shadow' ? '#2b2633' : COAT));
  const limb = tint(look.limb || (look.mat === 'shadow' ? '#3a3442' : LIMB));
  const boots = tint(look.bootCol || BOOT);
  const [dk, hi] = matK(look.mat);
  const M = { dark: dk, hi }, MB = { dark: dk * 0.85, hi: hi * 0.4 };
  const far = c => mix(c, '#5a5560', 0.22);
  const rim = look.rim && o.rim !== 0 ? look.rim : null;
  const bulk = look.bulk || 1;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const cx = X(P.CHEST), cy = Y(P.CHEST), px = X(P.PELVIS), py = Y(P.PELVIS), bx = X(P.BELLY), by = Y(P.BELLY);
  let tx = cx - px, ty = cy - py; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  const nx = -ty * f, ny = tx * f;

  // ---------- behind the body
  if (o.cape && look.cape) drawCape(ctx, o.cape, look, a, s, f);
  if (look.pack) drawPack(ctx, cx, cy, px, py, tx, ty, nx, ny, s, f, look);
  if (look.hammer) drawHammer(ctx, cx, cy, px, py, tx, ty, nx, ny, s);
  if (look.gearPick) drawGearPick(ctx, cx, cy, px, py, tx, ty, nx, ny, s, look.gearPick);
  if (look.staff) drawStaff(ctx, X(P.HAND_B), Y(P.HAND_B), s, f, o);

  // ---------- far limbs
  const ar = s * (look.arms || 1) * bulk, lr = s * (look.legs || 1);
  capsule(ctx, cx, cy, X(P.ELB_B), Y(P.ELB_B), 3.3 * ar, 2.8 * ar, far(coat), MB);
  capsule(ctx, X(P.ELB_B), Y(P.ELB_B), X(P.HAND_B), Y(P.HAND_B), 2.8 * ar, 2.4 * ar, far(coat), MB);
  handBall(ctx, X(P.ELB_B), Y(P.ELB_B), X(P.HAND_B), Y(P.HAND_B), 2.9 * ar * (look.gaunt ? 1.4 : 1), far(look.gloves || skin), MB, look.claws);
  if (!look.robe) {
    capsule(ctx, px, py, X(P.KNEE_B), Y(P.KNEE_B), 3.4 * lr, 2.9 * lr, far(limb), MB);
    leg(ctx, X(P.KNEE_B), Y(P.KNEE_B), X(P.FOOT_B), Y(P.FOOT_B), X(P.TOE_B), Y(P.TOE_B), lr, far(limb), far(boots), MB);
  }

  // ---------- coat
  const cw = 7.2 * s * bulk;
  capsule(ctx, X(P.NECK), Y(P.NECK), cx, cy, 2.2 * s, 2.6 * s, skin, M);
  const tn = hull(ctx, [[cx + tx * 1.2 * s, cy + ty * 1.2 * s, cw], [bx, by, cw * 0.86], [px, py, cw * 0.92]], coat, M);
  // coat skirt flaring over the thighs
  const kx = (X(P.KNEE_F) + X(P.KNEE_B)) / 2, ky = (Y(P.KNEE_F) + Y(P.KNEE_B)) / 2;
  const sx0 = lerp(px, kx, look.longCoat ? 0.95 : 0.55), sy0 = lerp(py, ky, look.longCoat ? 0.95 : 0.55);
  const sway = Math.max(-1, Math.min(1, -(o.vx || 0) / 320)) * 3 * s;
  {
    const gr = ctx.createLinearGradient(px - tn.nx * cw, py - tn.ny * cw, px + tn.nx * cw, py + tn.ny * cw);
    gr.addColorStop(0, shade(coat, -dk)); gr.addColorStop(0.55, coat); gr.addColorStop(0.9, shade(coat, hi)); gr.addColorStop(1, shade(coat, hi * 0.4));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(px - tn.nx * cw * 0.95, py - tn.ny * cw * 0.95);
    ctx.lineTo(px + tn.nx * cw * 0.95, py + tn.ny * cw * 0.95);
    ctx.lineTo(sx0 + tn.nx * cw * 1.25 + sway, sy0 + tn.ny * cw * 1.25 + 1 * s);
    ctx.quadraticCurveTo(sx0 + sway, sy0 + 3 * s, sx0 - tn.nx * cw * 1.25 + sway, sy0 - tn.ny * cw * 1.25 + 1 * s);
    ctx.closePath(); ctx.fill();
  }
  if (rim) { ctx.strokeStyle = rgba(rim, 0.45); ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(cx - tn.nx * cw * 0.95, cy - tn.ny * cw * 0.95); ctx.lineTo(px - tn.nx * cw * 0.9, py - tn.ny * cw * 0.9); ctx.stroke(); }
  // front seam of the coat
  ctx.strokeStyle = rgba(shade(coat, -0.4), 0.45); ctx.lineWidth = 0.8 * s;
  ctx.beginPath(); ctx.moveTo(cx + nx * cw * 0.55 + tx * 3 * s, cy + ny * cw * 0.55 + ty * 3 * s); ctx.lineTo(sx0 + nx * cw * 0.6 + sway, sy0 + ny * cw * 0.6); ctx.stroke();
  // warden marks: gold seams
  if (look.marks && look.marks.length) {
    ctx.lineWidth = 1.2 * s;
    look.marks.forEach((mk, m) => {
      const col = mk.col || GOLD, t0 = 0.3 + (m * 0.27) % 0.5;
      const mx = lerp(px, cx, t0), my = lerp(py, cy, t0);
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(mx - nx * cw * 0.8, my - ny * cw * 0.8); ctx.lineTo(mx + tx * 2 * s, my + ty * 2 * s); ctx.lineTo(mx + nx * cw * 0.8, my + ny * cw * 0.8); ctx.stroke();
      if (o.glows) o.glows.push([mx, my, 9 * s, col, 0.2]);
    });
  }
  // ---------- near leg
  if (!look.robe) {
    capsule(ctx, px, py, X(P.KNEE_F), Y(P.KNEE_F), 3.5 * lr, 3.0 * lr, limb, M);
    leg(ctx, X(P.KNEE_F), Y(P.KNEE_F), X(P.FOOT_F), Y(P.FOOT_F), X(P.TOE_F), Y(P.TOE_F), lr, limb, boots, M);
  }
  // ---------- belt with buckle
  if (look.belt !== false && !look.robe) {
    const mx = lerp(px, bx, 0.35), my = lerp(py, by, 0.35);
    const w = cw * 1.02, h2 = 1.9 * s;
    ctx.fillStyle = tint(look.beltCol || BELT);
    ctx.beginPath();
    ctx.moveTo(mx - tn.nx * w + tx * h2, my - tn.ny * w + ty * h2); ctx.lineTo(mx + tn.nx * w + tx * h2, my + tn.ny * w + ty * h2);
    ctx.lineTo(mx + tn.nx * w - tx * h2, my + tn.ny * w - ty * h2); ctx.lineTo(mx - tn.nx * w - tx * h2, my - tn.ny * w - ty * h2); ctx.closePath(); ctx.fill();
    const qx = mx + nx * w * 0.55, qy = my + ny * w * 0.55;
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.roundRect(qx - 2.2 * s, qy - 2.2 * s, 4.4 * s, 4.4 * s, 0.8 * s); ctx.fill();
    ctx.fillStyle = tint(look.beltCol || BELT); ctx.fillRect(qx - 1 * s, qy - 1 * s, 2 * s, 2 * s);
  }
  if (look.apron) drawApron(ctx, cx, cy, px, py, tx, ty, nx, ny, s, look.apron);
  if (look.gearLamp) drawGearLamp(ctx, px, py, tx, ty, nx, ny, s, f, o);
  // the thread of light in the chest (story): a faint stitch
  if (look.thread) {
    const qx = lerp(bx, cx, 0.6) + nx * 2.4 * s, qy = lerp(by, cy, 0.6) + ny * 2.4 * s;
    const pulse = 0.6 + Math.sin((o.time || 0) * 3.2) * 0.25;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    softDisc(ctx, qx, qy, 5.5 * s, look.threadCol || '#9ff3ff', 0.28 * pulse);
    ctx.restore();
    if (o.glows) o.glows.push([qx, qy, 11 * s, look.threadCol || '#9ff3ff', 0.28 * pulse]);
  }
  // long cloaks and robes go over the body
  if (look.robe) drawRobe(ctx, b, a, cx, cy, px, py, tx, ty, nx, ny, s, f, tint(look.robe), o, look.trim);
  if (look.cloakLong) drawLongCloak(ctx, b, a, cx, cy, px, py, tx, ty, nx, ny, s * bulk, f, tint(look.cloakLong), o, look);
  if (look.armor) pauldrons(ctx, cx, cy, tx, ty, nx, ny, s * bulk, tint(look.armor));
  // collar + scarf wrap
  collar(ctx, X(P.NECK), Y(P.NECK), cx, cy, tx, ty, nx, ny, s, look.collar === false ? null : (look.cloakLong ? tint(look.cloakLong) : coat), look.cape && look.cape.style !== 'none' && !look.cloakLong && !look.robe ? tint(look.cape.col) : null, f);

  // ---------- head
  const hx = X(P.HEAD), hy = Y(P.HEAD);
  const ha = Math.atan2(hy - Y(P.NECK), hx - X(P.NECK)) + Math.PI / 2;
  const hr = 11.4 * s * (look.headK || 1);
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(ha); ctx.translate(0, -1.5 * s);
  if (look.hmask) hollowHead(ctx, look, hr, s, f, tint);
  else {
    headBack(ctx, look, hr, s, f, tint);
    sphere(ctx, hr, skin, look.mat, rim, f, s);
    headMid(ctx, look, hr, s, f, tint, o);
    headFront(ctx, look, hr, s, f, o.time || 0, o.glows, hx, hy, ha, tint);
  }
  ctx.restore();

  // ---------- blade, then the near arm
  if (o.blade && look.blade) drawBlade(ctx, b, look, a, o);
  if (look.shield) {
    // an elite's round shield on the off hand
    const sx = X(P.HAND_B) + f * 4 * s, sy = Y(P.HAND_B) - 6 * s;
    ballShade(ctx, sx, sy, 10 * s, '#4a3a34', { dark: 0.4 });
    ctx.strokeStyle = '#8a6a4c'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.arc(sx, sy, 8.5 * s, 0, TAU); ctx.stroke();
    ballShade(ctx, sx, sy, 2.6 * s, '#c9a45c', { dark: 0.4 });
  }
  const sleeve = look.cloakLong ? tint(look.cloakLong) : look.armor ? tint(look.armor) : coat;
  capsule(ctx, cx, cy, X(P.ELB_F), Y(P.ELB_F), 3.5 * ar, 2.9 * ar, sleeve, M);
  capsule(ctx, X(P.ELB_F), Y(P.ELB_F), X(P.HAND_F), Y(P.HAND_F), 2.9 * ar, 2.5 * ar, sleeve, M);
  handBall(ctx, X(P.ELB_F), Y(P.ELB_F), X(P.HAND_F), Y(P.HAND_F), 3.0 * ar * (look.gaunt ? 1.4 : 1), look.gloves ? tint(look.gloves) : skin, M, look.claws);
  if (look.slab) drawSlab(ctx, X(P.ELB_F), Y(P.ELB_F), X(P.HAND_F), Y(P.HAND_F), s * bulk, f, tint(look.slab));
  if (look.tape) { ctx.strokeStyle = '#e8c35a'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(X(P.NECK) - nx * 3 * s, Y(P.NECK) - ny * 3 * s); ctx.quadraticCurveTo(cx + nx * 5 * s, cy + ny * 5 * s, bx + nx * 3 * s, by + ny * 3 * s); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- Hollow masks
// The Hollows wear big pale masks with a single dark eye, drawn from clean closed shapes: a smooth closed
// spline through a few points (mirrored by facing), one outline width, round joins. Kinds: a flame crest
// (husk), a tall cone (lancer), a deep hood with the mask in its shadow (slinger), curved horns (brute).
function smoothClosed(g, pts) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  g.beginPath(); g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
  g.closePath();
}
function polyClosed(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
function hollowHead(g, look, r, s, f, tint) {
  const R = r * 1.12, kind = look.hmask, mc = tint(look.maskCol || '#ecdcc8'), out = rgba('#14101a', 0.55), lw = Math.max(1, 1.1 * s);
  const F = (pts) => pts.map(([x, y]) => [x * R * f, y * R]);
  const fillMask = (draw, col = mc) => {
    draw(); const gr = g.createLinearGradient(-R * f, -R, R * f, R);
    gr.addColorStop(0, shade(col, 0.06)); gr.addColorStop(1, shade(col, -0.2));
    g.fillStyle = gr; g.fill(); g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = out; g.stroke();
  };
  const crest = (tips) => { for (const [bx0, bx1, tx, ty] of tips) fillMask(() => smoothClosed(g, F([[bx0, -0.55], [(bx0 + tx) / 2 - 0.12, (ty - 0.55) / 2], [tx, ty], [(bx1 + tx) / 2 + 0.05, (ty - 0.6) / 2 + 0.1], [bx1, -0.5], [(bx0 + bx1) / 2, -0.35]]))); };
  if (kind === 'hood') {
    const hc = tint(look.hoodCol || '#5e4e78');
    fillMask(() => smoothClosed(g, F([[-1.15, -1.45], [0.25, -1.35], [1.1, -0.55], [1.15, 0.75], [-0.1, 1.2], [-1.2, 0.45]])), hc);
  }
  if (kind === 'crest') crest([[-0.75, -0.25, -1.05, -1.75], [-0.4, 0.1, -0.35, -1.95], [-0.05, 0.45, 0.25, -1.6]]);
  if (kind === 'horns') for (const sd of [-1, 1]) fillMask(() => smoothClosed(g, F([[sd * 0.3, -0.7], [sd * 0.75, -0.95], [sd * 0.95, -1.5], [sd * 0.78, -2.0], [sd * 0.62, -1.45], [sd * 0.45, -1.05], [sd * 0.18, -0.85]])));
  // the mask itself
  const k = kind === 'hood' ? 0.78 : 1, ox = kind === 'hood' ? 0.22 : 0;
  const base = kind === 'cone'
    ? [[-0.35, -1.95], [0.95, 0.35], [0.55, 0.95], [-0.6, 0.85], [-0.88, 0.05]]
    : [[0, -1], [0.85, -0.55], [1.02, 0.1], [0.58, 0.9], [-0.35, 0.98], [-0.97, 0.2], [-0.72, -0.76]];
  const pts = F(base.map(([x, y]) => [ox + x * k, y * k + (kind === 'hood' ? 0.12 : 0)]));
  fillMask(() => (kind === 'cone' ? polyClosed(g, pts) : smoothClosed(g, pts)));
  if (kind === 'hood') {
    // the hood's shadow over the top of the mask
    g.save(); smoothClosed(g, pts); g.clip();
    const sh = g.createLinearGradient(0, -R, 0, R * 0.4); sh.addColorStop(0, rgba('#120e18', 0.75)); sh.addColorStop(1, rgba('#120e18', 0));
    g.fillStyle = sh; g.fillRect(-R * 2, -R * 2, R * 4, R * 3); g.restore();
  }
  // one dark eye on the facing side, a pinpoint of the Hollow's colour in it
  const ex = (ox + 0.42 * k) * R * f, ey = (kind === 'cone' ? 0.1 : 0.02) * R + (kind === 'hood' ? 0.1 * R : 0);
  g.fillStyle = '#0c0a10'; g.beginPath(); g.ellipse(ex, ey, 0.15 * R * k, 0.25 * R * k, 0, 0, TAU); g.fill();
  if (look.eyes) { g.fillStyle = look.eyes; g.beginPath(); g.arc(ex + 0.04 * R * f, ey - 0.07 * R, Math.max(0.8, 0.045 * R), 0, TAU); g.fill(); }
}
// the brute's slab: a great flat shield of hide and board carried on the near forearm
function drawSlab(g, ex, ey, hx, hy, s, f, col) {
  const a = Math.atan2(hy - ey, hx - ex), cx = (ex + hx) / 2 + Math.cos(a) * 3 * s, cy = (ey + hy) / 2 + Math.sin(a) * 3 * s;
  g.save(); g.translate(cx, cy); g.rotate(-0.25 * f);
  const w = 15 * s, h = 22 * s;
  const pts = [[-w * 0.85, -h], [w * 0.7, -h * 0.9], [w, h * 0.35], [w * 0.15, h], [-w, h * 0.55]].map(([x, y]) => [x * f, y]);
  polyClosed(g, pts);
  const gr = g.createLinearGradient(-w * f, -h, w * f, h); gr.addColorStop(0, shade(col, 0.1)); gr.addColorStop(1, shade(col, -0.28));
  g.fillStyle = gr; g.fill(); g.lineJoin = 'round'; g.lineWidth = Math.max(1, 1.2 * s); g.strokeStyle = rgba('#14101a', 0.55); g.stroke();
  g.strokeStyle = rgba('#ffffff', 0.18); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.stroke();
  g.restore();
}

function sphere(g, r, col, mat, rim, f, s) {
  const gr = g.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.08, 0, 0, r * 1.08);
  // matte: broad diffuse falloff, no specular
  gr.addColorStop(0, shade(col, 0.07));
  gr.addColorStop(0.5, col);
  gr.addColorStop(0.88, shade(col, -0.16));
  gr.addColorStop(1, shade(col, -0.26));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  if (rim) { g.strokeStyle = rgba(rim, 0.4); g.lineWidth = 1.1 * s; g.beginPath(); g.arc(0, 0, r * 0.97, f > 0 ? 2.2 : 0.2, f > 0 ? 3.4 : 1.0); g.stroke(); }
}
function eyes(g, look, r, s, f, o, hx, hy, ha) {
  const col = look.eyes || '#9ff3ff';
  const ex = r * 0.38 * f, ey = -r * 0.02;
  if (look.eyeStyle !== 'x') { g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, ex, ey, r * 0.75, col, 0.28); g.restore(); }
  if (look.eyeStyle === 'x') {
    g.strokeStyle = col; g.lineWidth = 1.2 * s;
    for (const dx of [-0.34, 0.27]) { const x = ex + dx * r * f; g.beginPath(); g.moveTo(x - r * 0.1, ey - r * 0.1); g.lineTo(x + r * 0.1, ey + r * 0.1); g.moveTo(x + r * 0.1, ey - r * 0.1); g.lineTo(x - r * 0.1, ey + r * 0.1); g.stroke(); }
    return;
  }
  if (look.eyeStyle === 'slit') {
    for (const dx of [-0.34, 0.3]) { g.fillStyle = col; g.beginPath(); g.ellipse(ex + dx * r * f, ey, r * 0.17, r * 0.07, 0.25 * f * Math.sign(dx), 0, TAU); g.fill(); }
  } else if (look.eyeStyle === 'visor') {
    g.fillStyle = col; g.beginPath(); g.roundRect(ex - r * 0.6, ey - r * 0.14, r * 1.2, r * 0.28, r * 0.14); g.fill();
  } else {
    for (const [dx, k] of [[-0.34, 1.2], [0.27, 1.08]]) {
      const x = ex + dx * r * f;
      g.fillStyle = col; g.beginPath(); g.ellipse(x, ey, r * 0.13 * k, r * 0.24 * k, 0, 0, TAU); g.fill();
      g.fillStyle = rgba('#ffffff', 0.9); g.beginPath(); g.ellipse(x, ey - r * 0.05, r * 0.06 * k, r * 0.12 * k, 0, 0, TAU); g.fill();
    }
  }
  if (o.glows) { const c = Math.cos(ha), sn = Math.sin(ha); o.glows.push([hx + ex * c - (ey - 1.5 * s) * sn, hy + ex * sn + (ey - 1.5 * s) * c, 10 * s, col, 0.45]); }
}
function headBack(g, look, r, s, f, tint) {
  const h = look.head;
  if (h === 'hood') {
    const col = tint(look.hoodCol || '#5f7a4a');
    ballShade(g, -r * 0.08 * f, -r * 0.05, r * 1.22, col, { dark: 0.42, hi: 0.14 });
    g.fillStyle = shade(col, -0.2); g.beginPath(); g.moveTo(-r * 0.9 * f, r * 0.2); g.quadraticCurveTo(-r * 1.7 * f, r * 0.9, -r * 1.25 * f, r * 1.6); g.lineTo(-r * 0.4 * f, r * 0.9); g.fill();
  } else if (h === 'crescent' || h === 'hollowhood') {
    ballShade(g, -r * 0.1 * f, -r * 0.05, r * 1.2, tint(look.hoodCol || '#2a2630'), { dark: 0.4, hi: 0.1 });
  } else if (h === 'ears') {
    for (const sd of [-1, 1]) { ballShade(g, sd * r * 0.72, -r * 0.78, r * 0.42, tint(look.body), { dark: 0.45, hi: 0.15 }); g.fillStyle = rgba('#000000', 0.25); g.beginPath(); g.arc(sd * r * 0.72, -r * 0.78, r * 0.2, 0, TAU); g.fill(); }
  }
}
function headMid(g, look, r, s, f, tint, o) {
  const h = look.head;
  if (h === 'crescent') {
    // a pale half mask over the facing side of the face
    // a clean face plate on the facing side: one closed shape, a soft ramp, one hairline crack
    const R = Math.round, mc = tint(look.maskCol || '#d8c7a8'), mx = R(r * 0.22 * f), mw = R(r * 0.7), mh = R(r * 0.86);
    const mg = g.createLinearGradient(mx - mw, -mh, mx + mw, mh); mg.addColorStop(0, shade(mc, 0.08)); mg.addColorStop(1, shade(mc, -0.28));
    g.beginPath(); g.ellipse(mx, R(r * 0.04), mw, mh, 0, 0, TAU); g.closePath(); g.fillStyle = mg; g.fill();
    g.lineJoin = g.lineCap = 'round'; g.lineWidth = Math.max(1, R(0.9 * s)); g.strokeStyle = rgba('#0c0a0e', 0.45); g.stroke();
    g.strokeStyle = rgba('#0c0a0e', 0.6); g.beginPath(); g.moveTo(mx + R(r * 0.18 * f), R(-mh * 0.95)); g.lineTo(mx + R(r * 0.3 * f), R(-r * 0.42)); g.lineTo(mx + R(r * 0.16 * f), R(-r * 0.24)); g.stroke();
  } else if (h === 'ears') {
    // lighter muzzle
    g.fillStyle = tint(shade(look.body, 0.25)); g.beginPath(); g.ellipse(r * 0.35 * f, r * 0.3, r * 0.42, r * 0.32, 0, 0, TAU); g.fill();
    g.fillStyle = '#141118'; g.beginPath(); g.ellipse(r * 0.55 * f, r * 0.2, r * 0.12, r * 0.08, 0, 0, TAU); g.fill();
  } else if (h === 'mask') {
    g.fillStyle = tint(look.maskCol || '#f4f1ea');
    g.beginPath(); g.arc(0, 0, r * 0.9, 0, TAU); g.fill();
    g.strokeStyle = rgba('#7fb4d8', 0.85); g.lineWidth = 1 * s;
    const cxm = r * 0.05, cym = -r * 0.55;
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(cxm - Math.cos(a) * r * 0.22, cym - Math.sin(a) * r * 0.22); g.lineTo(cxm + Math.cos(a) * r * 0.22, cym + Math.sin(a) * r * 0.22); g.stroke(); }
  }
}
function headFront(g, look, r, s, f, t, glows, hx, hy, ha, tint) {
  const h = look.head, acc = look.accent || GOLD;
  if (h === 'horns') {
    for (const sd of [-1, 1]) {
      const gr = g.createLinearGradient(sd * r * 0.4, -r, sd * r * 1.3, -r * 2.4);
      gr.addColorStop(0, look.hornCol || '#3a3238'); gr.addColorStop(1, shade(look.hornCol || '#3a3238', 0.4));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(sd * r * 0.5, -r * 0.75); g.quadraticCurveTo(sd * r * 1.45, -r * 1.2, sd * r * 1.1, -r * 2.25); g.quadraticCurveTo(sd * r * 0.95, -r * 1.45, sd * r * 0.12, -r * 0.92); g.fill();
    }
  } else if (h === 'crown') {
    const gr = g.createLinearGradient(0, -r * 1.75, 0, -r * 0.9);
    gr.addColorStop(0, shade(acc, 0.35)); gr.addColorStop(1, shade(acc, -0.25));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-r * 0.62, -r * 0.8); g.lineTo(-r * 0.7, -r * 1.42); g.lineTo(-r * 0.32, -r * 1.1); g.lineTo(0, -r * 1.62); g.lineTo(r * 0.32, -r * 1.1); g.lineTo(r * 0.7, -r * 1.42); g.lineTo(r * 0.62, -r * 0.8); g.closePath(); g.fill();
  } else if (h === 'halo') {
    g.strokeStyle = acc; g.lineWidth = 1.6 * s;
    g.beginPath(); g.ellipse(0, -r * 1.5 + Math.sin(t * 2) * 0.8 * s, r * 0.85, r * 0.24, 0, 0, TAU); g.stroke();
    if (glows) glows.push([hx + Math.sin(ha) * r * 1.6, hy - Math.cos(ha) * r * 1.6, 14 * s, acc, 0.35]);
  } else if (h === 'antlers') {
    g.strokeStyle = look.hornCol || '#d9cdb8'; g.lineWidth = 1.9 * s;
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * r * 0.35, -r * 0.85); g.quadraticCurveTo(sd * r * 0.55, -r * 1.55, sd * r * 0.95, -r * 2.05); g.moveTo(sd * r * 0.58, -r * 1.45); g.lineTo(sd * r * 1.35, -r * 1.75); g.moveTo(sd * r * 0.8, -r * 1.85); g.lineTo(sd * r * 0.5, -r * 2.4); g.stroke(); }
  } else if (h === 'tophat') {
    capsule(g, -r * 1.0, -r * 0.88, r * 1.0, -r * 0.88, r * 0.12, r * 0.12, '#26232b', { dark: 0.3, hi: 0.25 });
    const gr = g.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
    gr.addColorStop(0, '#1b191f'); gr.addColorStop(0.35, '#3a3640'); gr.addColorStop(1, '#141217');
    g.fillStyle = gr; g.beginPath(); g.roundRect(-r * 0.6, -r * 1.95, r * 1.2, r * 1.08, [r * 0.12, r * 0.12, 0, 0]); g.fill();
    g.fillStyle = look.hatBand || '#7a4a8f'; g.fillRect(-r * 0.6, -r * 1.12, r * 1.2, r * 0.18);
  } else if (h === 'leaf') {
    g.strokeStyle = '#5c7a4a'; g.lineWidth = 1.1 * s; g.beginPath(); g.moveTo(0, -r * 0.95); g.quadraticCurveTo(r * 0.08, -r * 1.25, r * 0.1, -r * 1.4); g.stroke();
    for (const sd of [-1, 1]) { const gr = g.createLinearGradient(0, -r * 1.7, sd * r * 0.5, -r * 1.2); gr.addColorStop(0, '#a8cf7a'); gr.addColorStop(1, '#5f8a4a'); g.fillStyle = gr; g.beginPath(); g.ellipse(sd * r * 0.24, -r * 1.48, r * 0.32, r * 0.15, sd * 0.5, 0, TAU); g.fill(); }
  } else if (h === 'widehat') {
    const col = tint(look.hatCol || '#6b4a32');
    g.fillStyle = shade(col, -0.25); g.beginPath(); g.ellipse(0, -r * 0.62, r * 1.75, r * 0.36, 0, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.ellipse(0, -r * 0.7, r * 1.7, r * 0.28, 0, 0, TAU); g.fill();
    const gr = g.createLinearGradient(-r * 0.7, 0, r * 0.7, 0); gr.addColorStop(0, shade(col, 0.1)); gr.addColorStop(1, shade(col, -0.3));
    g.fillStyle = gr; g.beginPath(); g.roundRect(-r * 0.68, -r * 1.42, r * 1.36, r * 0.76, [r * 0.4, r * 0.4, 0, 0]); g.fill();
    g.fillStyle = '#3a2c22'; g.fillRect(-r * 0.68, -r * 0.88, r * 1.36, r * 0.16);
  }
}
function collar(g, nx0, ny0, cx, cy, tx, ty, nx, ny, s, coat, scarf, f) {
  if (coat) {
    // stand collar
    const w = 4.6 * s;
    const gr = g.createLinearGradient(cx - nx * w, cy - ny * w, cx + nx * w, cy + ny * w);
    gr.addColorStop(0, shade(coat, -0.3)); gr.addColorStop(0.7, coat); gr.addColorStop(1, shade(coat, 0.12));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(cx - nx * w + tx * 1 * s, cy - ny * w + ty * 1 * s);
    g.lineTo(nx0 - nx * w * 0.7 + tx * 2 * s, ny0 - ny * w * 0.7 + ty * 2 * s);
    g.lineTo(nx0 + nx * w * 0.7 + tx * 2 * s, ny0 + ny * w * 0.7 + ty * 2 * s);
    g.lineTo(cx + nx * w + tx * 1 * s, cy + ny * w + ty * 1 * s);
    g.closePath(); g.fill();
  }
  if (scarf) {
    // the scarf wraps the collar and knots at the back
    const mx = lerp(cx, nx0, 0.55), my = lerp(cy, ny0, 0.55);
    capsule(g, mx - nx * 5.2 * s, my - ny * 5.2 * s, mx + nx * 5.4 * s, my + ny * 5.4 * s, 2.6 * s, 2.6 * s, scarf, { dark: 0.4, hi: 0.18 });
    ballShade(g, mx - nx * 5.6 * s, my - ny * 5.6 * s, 2.4 * s, shade(scarf, -0.1), { dark: 0.4 });
  }
}
function leg(g, kx, ky, fx, fy, tx2, ty2, lr, limb, boots, M) {
  // shin in trousers, then a boot from mid shin to the toe with a lighter cuff
  const mx = lerp(kx, fx, 0.42), my = lerp(ky, fy, 0.42);
  capsule(g, kx, ky, mx, my, 3.0 * lr, 2.8 * lr, limb, M);
  capsule(g, mx, my, fx, fy, 3.25 * lr, 2.9 * lr, boots, M);
  capsule(g, fx, fy, tx2, ty2, 3.0 * lr, 2.6 * lr, boots, M);
  g.strokeStyle = rgba('#000000', 0.35); g.lineWidth = 1.2 * lr;
  g.beginPath(); g.moveTo(fx, fy + 2.6 * lr); g.lineTo(tx2 + (tx2 - fx) * 0.2, ty2 + 2.3 * lr); g.stroke();
  g.strokeStyle = shade(boots, 0.25); g.lineWidth = 1.5 * lr;
  const dx = fx - kx, dy = fy - ky, L = Math.hypot(dx, dy) || 1;
  g.beginPath(); g.moveTo(mx - dy / L * 3.3 * lr, my + dx / L * 3.3 * lr); g.lineTo(mx + dy / L * 3.3 * lr, my - dx / L * 3.3 * lr); g.stroke();
}
function handBall(g, ex, ey, hx, hy, r, col, M, claws) {
  const dx = hx - ex, dy = hy - ey, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  ballShade(g, hx + ux * r * 0.2, hy + uy * r * 0.2, r, col, M);
  if (claws) {
    g.strokeStyle = claws; g.lineWidth = r * 0.3; g.lineCap = 'round';
    for (const k of [-0.5, 0, 0.5]) {
      const a = Math.atan2(uy, ux) + k, x0 = hx + Math.cos(a) * r * 0.7, y0 = hy + Math.sin(a) * r * 0.7;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a) * r * 1.6, y0 + Math.sin(a) * r * 1.6, x0 + Math.cos(a + 0.6) * r * 2.4, y0 + Math.sin(a + 0.6) * r * 2.4); g.stroke();
    }
  }
}
function drawLongCloak(g, b, a, cx, cy, px, py, tx, ty, nx, ny, s, f, col, o, look) {
  // hangs from the shoulders to the knees (or the ground), hem tattered, trimmed for wardens
  const kneeY = Math.max(b.ipy(P.KNEE_F, a), b.ipy(P.KNEE_B, a));
  const footY = Math.max(b.ipy(P.FOOT_F, a), b.ipy(P.FOOT_B, a));
  const bottom = look.cloakToGround ? footY - 2 * s : look.cloakShort ? lerp(py, kneeY, 0.85) : lerp(kneeY, footY, 0.35);
  const sway = Math.max(-1, Math.min(1, -(o.vx || 0) / 260)) * 8 * s;
  const top = [cx + tx * 3 * s, cy + ty * 3 * s];
  const wTop = 9 * s, wBot = 15 * s;
  const bxm = px - nx * 1 * s + sway * 0.4;
  const gr = g.createLinearGradient(bxm - nx * wBot - 0, 0, bxm + nx * wBot, 0);
  gr.addColorStop(0, shade(col, -0.38)); gr.addColorStop(0.5, col); gr.addColorStop(0.82, shade(col, 0.12)); gr.addColorStop(1, shade(col, -0.08));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(top[0] - nx * wTop, top[1] - ny * wTop);
  g.quadraticCurveTo(top[0], top[1] + ty * 3 * s - 4 * s, top[0] + nx * wTop, top[1] + ny * wTop);
  g.quadraticCurveTo(px + nx * 12 * s, py, bxm + nx * wBot + sway, bottom);
  const n = 6;
  const teeth = (look.cloakTeeth || 4) * s;
  for (let i = 1; i <= n; i++) { const u = i / n; g.lineTo(lerp(bxm + nx * wBot + sway, bxm - nx * wBot + sway * 1.4, u), bottom - (i % 2 ? teeth : 0) + Math.sin(u * 7 + (o.time || 0) * 2) * 1.2 * s); }
  g.quadraticCurveTo(px - nx * 12 * s, py, top[0] - nx * wTop, top[1] - ny * wTop);
  g.closePath(); g.fill();
  g.strokeStyle = rgba('#000000', 0.14); g.lineWidth = 1.1 * s;
  for (const k of [-0.35, 0.25]) { g.beginPath(); g.moveTo(top[0] + nx * k * wTop * 2, top[1] + ny * k * wTop * 2); g.quadraticCurveTo(px + nx * k * 14 * s, py, bxm + nx * k * wBot * 1.6 + sway, bottom - 3 * s); g.stroke(); }
  if (look.trim) { g.strokeStyle = look.trim; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(top[0] + nx * wTop, top[1] + ny * wTop); g.quadraticCurveTo(px + nx * 12 * s, py, bxm + nx * wBot + sway, bottom); g.stroke(); }
  if (look.fringe) { g.strokeStyle = shade(col, -0.2); g.lineWidth = 0.9 * s; for (let i = 0; i < 9; i++) { const u = i / 8, x = lerp(bxm + nx * wBot + sway, bxm - nx * wBot + sway * 1.4, u); g.beginPath(); g.moveTo(x, bottom - 2 * s); g.lineTo(x, bottom + 3 * s); g.stroke(); } }
}
function drawRobe(g, b, a, cx, cy, px, py, tx, ty, nx, ny, s, f, col, o, trim) {
  const fy = Math.max(b.ipy(P.FOOT_F, a), b.ipy(P.FOOT_B, a)) + 3 * s;
  const fx = (b.ipx(P.FOOT_F, a) + b.ipx(P.FOOT_B, a)) / 2;
  const sway = Math.max(-1, Math.min(1, -(o.vx || 0) / 260)) * 10 * s;
  const top = [cx + tx * 2 * s, cy + ty * 2 * s];
  const gr = g.createLinearGradient(px - nx * 16 * s, 0, px + nx * 16 * s, 0);
  gr.addColorStop(0, shade(col, -0.35)); gr.addColorStop(0.55, col); gr.addColorStop(0.85, shade(col, 0.14)); gr.addColorStop(1, shade(col, -0.05));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(top[0] - nx * 7 * s, top[1] - ny * 7 * s);
  g.quadraticCurveTo(px - nx * 9 * s, py, fx - 18 * s + sway, fy);
  const n = 8;
  for (let i = 1; i <= n; i++) g.lineTo(lerp(fx - 18 * s + sway, fx + 18 * s + sway * 1.3, i / n), fy - (i % 2 ? 5 * s : 0));
  g.quadraticCurveTo(px + nx * 9 * s, py, top[0] + nx * 7 * s, top[1] + ny * 7 * s);
  g.closePath(); g.fill();
  g.strokeStyle = rgba('#000000', 0.13); g.lineWidth = 1.2 * s;
  for (const k of [-0.5, 0.05, 0.55]) { g.beginPath(); g.moveTo(px + k * 6 * s, py); g.quadraticCurveTo(px + k * 10 * s, (py + fy) / 2, fx + k * 16 * s + sway, fy - 2 * s); g.stroke(); }
  if (trim) { g.strokeStyle = trim; g.lineWidth = 1.3 * s; g.beginPath(); g.moveTo(fx - 18 * s + sway, fy); for (let i = 1; i <= n; i++) g.lineTo(lerp(fx - 18 * s + sway, fx + 18 * s + sway * 1.3, i / n), fy - (i % 2 ? 5 * s : 0)); g.stroke(); }
}
function drawApron(g, cx, cy, px, py, tx, ty, nx, ny, s, col) {
  const top = [cx - tx * 1 * s + nx * 2 * s, cy - ty * 1 * s + ny * 2 * s], bot = [px - tx * 15 * s + nx * 3 * s, py - ty * 15 * s + ny * 3 * s];
  g.fillStyle = col;
  g.beginPath(); g.moveTo(top[0] - nx * 4 * s, top[1] - ny * 4 * s); g.lineTo(top[0] + nx * 5 * s, top[1] + ny * 5 * s); g.lineTo(bot[0] + nx * 8 * s, bot[1] + ny * 8 * s); g.lineTo(bot[0] - nx * 6 * s, bot[1] - ny * 6 * s); g.closePath(); g.fill();
}
function drawPack(g, cx, cy, px, py, tx, ty, nx, ny, s, f, look) {
  const mx = lerp(px, cx, 0.6) - nx * 10 * s, my = lerp(py, cy, 0.6) - ny * 10 * s;
  const col = look.packCol || '#7a5a3c';
  g.save(); g.translate(mx, my); g.rotate(Math.atan2(ty, tx) + Math.PI / 2);
  const gr = g.createLinearGradient(-8 * s, 0, 8 * s, 0); gr.addColorStop(0, shade(col, -0.35)); gr.addColorStop(0.6, col); gr.addColorStop(1, shade(col, 0.1));
  g.fillStyle = gr; g.beginPath(); g.roundRect(-8 * s, -11 * s, 16 * s, 22 * s, 4 * s); g.fill();
  capsule(g, -9 * s, -13 * s, 9 * s, -13 * s, 3.4 * s, 3.4 * s, '#c9b48a', { dark: 0.4, hi: 0.1 });
  g.fillStyle = '#4a4048'; g.beginPath(); g.arc(-6 * s * f, 8 * s, 3.5 * s, 0, TAU); g.fill();
  g.restore();
}
// worn gear: a pick slung across the back, a small lamp hanging at the hip
function drawGearPick(g, cx, cy, px, py, tx, ty, nx, ny, s, kind) {
  const mx = lerp(px, cx, 0.55) - nx * 7 * s, my = lerp(py, cy, 0.55) - ny * 7 * s;
  g.save(); g.translate(mx, my); g.rotate(Math.atan2(ty, tx) + Math.PI / 2 + 0.7);
  capsule(g, 0, 14 * s, 0, -14 * s, 1.4 * s, 1.4 * s, '#7a5a3e', { dark: 0.35 });
  g.fillStyle = kind === 'g_pick_crystal' ? '#8ff7ff' : '#e2b85a';
  g.beginPath(); g.moveTo(-10 * s, -12 * s); g.quadraticCurveTo(0, -20 * s, 10 * s, -12 * s); g.quadraticCurveTo(0, -16 * s, -10 * s, -12 * s); g.fill();
  g.restore();
}
function drawGearLamp(g, px, py, tx, ty, nx, ny, s, f, o) {
  const x = px + nx * 7 * s + tx * 2 * s, y = py + ny * 7 * s + 5 * s;
  g.strokeStyle = '#4a4650'; g.lineWidth = 1 * s; g.beginPath(); g.moveTo(x, y - 4 * s); g.lineTo(x, y); g.stroke();
  g.fillStyle = '#c9a45c'; g.beginPath(); g.roundRect(x - 3 * s, y, 6 * s, 1.6 * s, 0.6 * s); g.fill(); g.beginPath(); g.roundRect(x - 3 * s, y + 6.4 * s, 6 * s, 1.6 * s, 0.6 * s); g.fill();
  g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, x, y + 4 * s, 9 * s, '#ffd28a', 0.45); g.restore();
  g.fillStyle = 'rgba(255,233,192,.9)'; g.fillRect(x - 2.2 * s, y + 1.6 * s, 4.4 * s, 4.8 * s);
  if (o.glows) o.glows.push([x, y + 4 * s, 16 * s, '#ffd28a', 0.4]);
}
function drawHammer(g, cx, cy, px, py, tx, ty, nx, ny, s) {
  const hx0 = cx - nx * 7 * s, hy0 = cy - ny * 7 * s;
  capsule(g, hx0 + tx * 10 * s, hy0 + ty * 10 * s, px - nx * 9 * s - tx * 8 * s, py - ny * 9 * s - ty * 8 * s, 1.6 * s, 1.6 * s, '#6b4a32', { dark: 0.45 });
  g.save(); g.translate(hx0 + tx * 12 * s, hy0 + ty * 12 * s); g.rotate(Math.atan2(ty, tx));
  const hg = g.createLinearGradient(0, -6 * s, 0, 6 * s); hg.addColorStop(0, '#9a9aa6'); hg.addColorStop(0.5, '#5e5e6a'); hg.addColorStop(1, '#2e2e36');
  g.fillStyle = hg; g.beginPath(); g.roundRect(-4 * s, -7 * s, 8 * s, 14 * s, 2 * s); g.fill(); g.restore();
}
function drawStaff(g, hx, hy, s, f, o) {
  g.strokeStyle = '#5a4636'; g.lineWidth = 2 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(hx + f * 1 * s, hy + 26 * s); g.lineTo(hx - f * 2 * s, hy - 40 * s); g.stroke();
  const lx = hx - f * 2 * s, ly = hy - 40 * s;
  g.fillStyle = '#3a3540'; g.beginPath(); g.roundRect(lx + f * 5 * s - 3.5 * s, ly + 4 * s, 7 * s, 9 * s, 2 * s); g.fill();
  g.fillStyle = '#ffd28a'; g.beginPath(); g.roundRect(lx + f * 5 * s - 2.2 * s, ly + 5.5 * s, 4.4 * s, 6 * s, 1.5 * s); g.fill();
  if (o.glows) o.glows.push([lx + f * 5 * s, ly + 8.5 * s, 26 * s, '#ffd28a', 0.55]);
}
function pauldrons(g, cx, cy, tx, ty, nx, ny, s, col) {
  for (const sd of [-1, 1]) {
    const x = cx + nx * sd * 6 * s + tx * 1 * s, y = cy + ny * sd * 6 * s + ty * 1 * s;
    const gr = g.createRadialGradient(x - 1.5 * s, y - 2 * s, 0.5 * s, x, y, 5.5 * s);
    gr.addColorStop(0, shade(col, 0.35)); gr.addColorStop(0.6, col); gr.addColorStop(1, shade(col, -0.5));
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 5.5 * s, 4 * s, Math.atan2(ty, tx), 0, TAU); g.fill();
  }
}

// ---------------------------------------------------------------- blade
export function bladeGeom(b, look, a) {
  const s = b.s;
  const ex = b.ipx(P.ELB_F, a), ey = b.ipy(P.ELB_F, a), hx = b.ipx(P.HAND_F, a), hy = b.ipy(P.HAND_F, a);
  // the wrist turns the weapon off the forearm line (mirrored with facing)
  const ang = Math.atan2(hy - ey, hx - ex) + (b.wrist || 0) * (b.facing || 1);
  const L = (look.weaponLen || (look.blade ? look.blade.len : 30)) * s * (b.mining ? 0.55 : 1);   // a short chop when mining: the blade stays at the block's face
  return { x0: hx, y0: hy, x1: hx + Math.cos(ang) * L, y1: hy + Math.sin(ang) * L, ang };
}
// the weapon in hand, by kind; infused weapons glow with their element
// the painted weapons (assets/weapons/<id>.png lie flat, pointing right): the grip sits in the hand, the tip
// lands where the weapon reaches. Blades take the colour of the edge chosen at the tailor.
const GRIP = { w_blade: 0.24, w_spear: 0.26, w_hammer: 0.12, w_daggers: 0.3 };
const tinted = new Map();
function weaponImg(id, col) {
  const im = IMG['weapons/' + id]; if (!im) return null;
  if (!col) return im;
  const key = id + col; let c = tinted.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d');
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.42; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    tinted.set(key, c);
  }
  return c;
}
function paintWeapon(g, im, hx, hy, ang, L, grip, f) {
  const D = L / (1 - grip), H = D * im.height / im.width;
  g.save(); g.translate(hx, hy); g.rotate(ang); if (f < 0) g.scale(1, -1);
  g.drawImage(im, -grip * D, -H / 2, D, H);
  g.restore();
}
export function drawBlade(g, b, look, a, o) {
  const w = look.weapon;
  if (look.infuse && o.glows) { const geo = bladeGeom(b, look, a); o.glows.push([lerp(geo.x0, geo.x1, 0.6), lerp(geo.y0, geo.y1, 0.6), 18 * b.s, look.infuse, 0.35]); }
  const id = w || 'w_blade', im = typeof document !== 'undefined' && GRIP[id] ? weaponImg(id, id === 'w_blade' && look.blade && look.blade.col !== '#e8eef5' ? look.blade.col : null) : null;
  if (im) {
    const s = b.s, f = b.facing || 1;
    if (id === 'w_daggers') {
      for (const [e, h] of [[P.ELB_B, P.HAND_B], [P.ELB_F, P.HAND_F]]) { const d = handDir(b, a, e, h); paintWeapon(g, im, d.hx, d.hy, d.ang, (look.weaponLen || 19) * s, GRIP[id], f); }
      return;
    }
    const d = handDir(b, a, P.ELB_F, P.HAND_F);
    const len = id === 'w_blade' ? bladeGeom(b, look, a) : null;
    const L = len ? Math.hypot(len.x1 - len.x0, len.y1 - len.y0) : (look.weaponLen || (id === 'w_spear' ? 54 : 34)) * s * (b.mining ? 0.55 : 1) * (id === 'w_hammer' ? 1.15 : 1);
    paintWeapon(g, im, d.hx, d.hy, d.ang, L, GRIP[id], f);
    if (id === 'w_blade' && o.glows && look.blade && look.blade.glow) o.glows.push([lerp(d.hx, d.hx + Math.cos(d.ang) * L, 0.6), lerp(d.hy, d.hy + Math.sin(d.ang) * L, 0.6), 16 * s, look.blade.glow, 0.14 + (o.bladeHot || 0) * 0.55]);
    return;
  }
  if (w === 'w_spear') return drawSpear(g, b, look, a);
  if (w === 'w_hammer') return drawHammerW(g, b, look, a);
  if (w === 'w_daggers') { drawDagger(g, b, look, a, P.ELB_B, P.HAND_B); return drawDagger(g, b, look, a, P.ELB_F, P.HAND_F); }
  if (w === 'w_sling') return drawSling(g, b, look, a, o);
  drawSword(g, b, look, a, o);
}
function handDir(b, a, e, h) { const ex = b.ipx(e, a), ey = b.ipy(e, a), hx = b.ipx(h, a), hy = b.ipy(h, a); const ang = Math.atan2(hy - ey, hx - ex) + (h === P.HAND_F ? (b.wrist || 0) * (b.facing || 1) : 0); return { hx, hy, ang, ux: Math.cos(ang), uy: Math.sin(ang) }; }
function drawSpear(g, b, look, a) {
  const s = b.s, d = handDir(b, a, P.ELB_F, P.HAND_F), L = (look.weaponLen || 54) * s * (b.mining ? 0.55 : 1), B = 16 * s;
  capsule(g, d.hx - d.ux * B, d.hy - d.uy * B, d.hx + d.ux * L * 0.86, d.hy + d.uy * L * 0.86, 1.3 * s, 1.3 * s, '#7a5a3e', { dark: 0.35 });
  const tx = d.hx + d.ux * L, ty = d.hy + d.uy * L, nx = -d.uy, ny = d.ux, bx = d.hx + d.ux * L * 0.8, by = d.hy + d.uy * L * 0.8;
  g.fillStyle = '#cfd6de';
  g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + d.ux * 6 * s + nx * 4 * s, by + d.uy * 6 * s + ny * 4 * s, tx, ty); g.quadraticCurveTo(bx + d.ux * 6 * s - nx * 4 * s, by + d.uy * 6 * s - ny * 4 * s, bx, by); g.fill();
  g.strokeStyle = rgba('#ffffff', 0.7); g.lineWidth = 0.7 * s; g.beginPath(); g.moveTo(bx + d.ux * 2 * s, by + d.uy * 2 * s); g.lineTo(tx, ty); g.stroke();
  g.fillStyle = '#c9a45c'; g.beginPath(); g.arc(bx, by, 1.8 * s, 0, TAU); g.fill();
}
function drawHammerW(g, b, look, a) {
  const s = b.s, d = handDir(b, a, P.ELB_F, P.HAND_F), L = (look.weaponLen || 34) * s * (b.mining ? 0.6 : 1);
  capsule(g, d.hx - d.ux * 6 * s, d.hy - d.uy * 6 * s, d.hx + d.ux * L, d.hy + d.uy * L, 1.6 * s, 1.6 * s, '#6e523b', { dark: 0.35 });
  g.save(); g.translate(d.hx + d.ux * L, d.hy + d.uy * L); g.rotate(d.ang + Math.PI / 2);
  const gr = g.createLinearGradient(-9 * s, 0, 9 * s, 0); gr.addColorStop(0, '#5a5560'); gr.addColorStop(0.5, '#8a8590'); gr.addColorStop(1, '#4a4650');
  g.fillStyle = gr; g.beginPath(); g.roundRect(-10 * s, -6 * s, 20 * s, 12 * s, 3 * s); g.fill();
  g.fillStyle = '#c9a45c'; g.fillRect(-10 * s, -1 * s, 20 * s, 2 * s);
  g.restore();
}
function drawDagger(g, b, look, a, e, h) {
  const s = b.s, d = handDir(b, a, e, h), L = (look.weaponLen || 19) * s, nx = -d.uy, ny = d.ux;
  const x0 = d.hx + d.ux * 3 * s, y0 = d.hy + d.uy * 3 * s, tx = d.hx + d.ux * L, ty = d.hy + d.uy * L;
  g.fillStyle = '#d8dee6';
  g.beginPath(); g.moveTo(x0 + nx * 1.8 * s, y0 + ny * 1.8 * s); g.lineTo(tx, ty); g.lineTo(x0 - nx * 1.8 * s, y0 - ny * 1.8 * s); g.closePath(); g.fill();
  capsule(g, x0 + nx * 3.5 * s, y0 + ny * 3.5 * s, x0 - nx * 3.5 * s, y0 - ny * 3.5 * s, 1 * s, 1 * s, '#c9a45c', { dark: 0.4 });
  g.strokeStyle = '#3a2c2a'; g.lineWidth = 1.8 * s; g.beginPath(); g.moveTo(d.hx - d.ux * 4 * s, d.hy - d.uy * 4 * s); g.lineTo(x0, y0); g.stroke();
}
function drawSling(g, b, look, a, o) {
  const s = b.s, d = handDir(b, a, P.ELB_F, P.HAND_F);
  const t = (o.time || 0) * 3, len = 16 * s;
  const px = d.hx + d.ux * len * 0.5 + Math.sin(t) * 2 * s, py = d.hy + d.uy * len * 0.5 + 9 * s;
  g.strokeStyle = '#8a6a4c'; g.lineWidth = 1.2 * s;
  g.beginPath(); g.moveTo(d.hx, d.hy); g.quadraticCurveTo(d.hx + d.ux * 4 * s, py + 2 * s, px, py); g.stroke();
  g.fillStyle = '#6e523b'; g.beginPath(); g.ellipse(px, py, 3.2 * s, 2.2 * s, 0, 0, TAU); g.fill();
  g.fillStyle = '#9a96a0'; g.beginPath(); g.arc(px, py - 1 * s, 1.6 * s, 0, TAU); g.fill();
}
function drawSword(g, b, look, a, o) {
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
  const wide = look.cape.wide || (scarf ? 4.2 : 7.5);
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
  if (look.cape.trim) { g.strokeStyle = look.cape.trim; g.lineWidth = 1.3 * s; g.beginPath(); g.moveTo(R[0][0], R[0][1]); for (let i = 1; i < n; i++) g.lineTo(R[i][0], R[i][1]); g.stroke(); }
}
