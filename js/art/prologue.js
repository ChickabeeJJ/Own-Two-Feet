// The opening's painted plates. A dusk vista of the Loom-Cathedral (a ruin of needle spires strung with
// broken threads, in layers of fog), then a portrait of each of the five Wardens. Every plate is painted
// once off screen from thousands of marks (see brush.js), a few milliseconds per frame, then only
// composited: parallax, slow push-ins, embers, ash, crows and the falling seed are drawn live on top.
import { rng, canvas, stroke, fillStrokes, ragged, ridge, fog, rimLight, grain, glow, vignette, rgbaJ, mixHex, Painter } from './brush.js';
import { TAU } from '../core/util.js';

const PW = 1600, PH = 900;          // vista plates
const FW = 1600, FH = 900;          // portraits (16:9; figures are painted centred at x 800)
export const WARDEN_INFO = [
  { name: 'The Hollow Warden', sub: 'the first needle · it keeps the meadow gate', col: '#ffb36b' },
  { name: 'The Glass Widow', sub: 'the second needle · it spins in the glass wood', col: '#8ff7ff' },
  { name: 'The Unmade Heart', sub: 'the third needle · it tore the ground apart to hide', col: '#c4b5ff' },
  { name: 'The Pyre Knight', sub: 'the fourth needle · it burns what it guards', col: '#ff7a3a' },
  { name: 'The Still Queen', sub: 'the fifth needle · nothing moves where she rules', col: '#dff6ff' },
];

// ------------------------------------------------------------ vista
function* paintSky() {
  const c = canvas(PW, PH), g = c.getContext('2d'), R = rng(11);
  const gr = g.createLinearGradient(0, 0, 0, PH);
  gr.addColorStop(0, '#07060f'); gr.addColorStop(0.35, '#1b1430'); gr.addColorStop(0.58, '#4a2a3e'); gr.addColorStop(0.72, '#9a4a3a'); gr.addColorStop(0.8, '#d8864e'); gr.addColorStop(1, '#2a1a22');
  g.fillStyle = gr; g.fillRect(0, 0, PW, PH);
  glow(g, PW * 0.36, PH * 0.72, 420, '#ffb070', 0.55); glow(g, PW * 0.36, PH * 0.72, 120, '#fff0d0', 0.6);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,240,230,${R() * 0.6})`; const r = R() * 1.3; g.fillRect(R() * PW, R() * PH * 0.4, r, r); }
  yield;
  // cloud masses: long horizontal strokes, lit from the low sun beneath
  for (let band = 0; band < 7; band++) {
    const y = PH * (0.12 + band * 0.085), lit = band / 7;
    const top = mixHex('#2a2040', '#c06a4a', lit), under = mixHex('#120e1c', '#5a3040', lit);
    for (let i = 0; i < 240; i++) {
      const x = R() * PW * 1.1 - 60, yy = y + (R() - 0.5) * 60, l = 60 + R() * 220;
      stroke(g, [[x, yy], [x + l * 0.5, yy - 3 + R() * 6], [x + l, yy + (R() - 0.5) * 8]], 6 + R() * 14, R() < 0.6 ? under : top, 0.14 + R() * 0.18, R, { hairs: 6 });
    }
    // the sun-catching undersides
    for (let i = 0; i < 70; i++) { const x = R() * PW, yy = y + 18 + R() * 16, l = 40 + R() * 140; stroke(g, [[x, yy], [x + l, yy + (R() - 0.5) * 4]], 2 + R() * 4, '#ffb880', 0.08 + R() * 0.14 * lit, R, { hairs: 3 }); }
    yield;
  }
  grain(g, PW, PH, R, 9000, 0.05);
  return c;
}
function* paintFar() {
  const c = canvas(PW, PH), g = c.getContext('2d'), R = rng(23);
  const layers = [[PH * 0.6, 70, 0.004, '#3a2436', 0.9], [PH * 0.66, 55, 0.007, '#2a1a2a', 1], [PH * 0.72, 40, 0.011, '#1c121e', 1]];
  for (const [y, amp, fq, col, a] of layers) {
    const p = ridge(PW, y, amp, fq, R, { bottom: PH });
    g.fillStyle = rgbaJ(col, a); g.fill(p);
    fillStrokes(g, p, [0, y - amp * 2, PW, PH], col, 700, R, { ang: -0.2, len: 30, w: 5, a: 0.4, cols: [col, mixHex(col, '#000000', 0.3), mixHex(col, '#c06a4a', 0.15)] });
    fog(g, PW, y + 20, 50, '#c0786a', 0.12, 40, R);
    yield;
  }
  // distant spires on the ridge
  for (let i = 0; i < 26; i++) {
    const x = R() * PW, base = PH * 0.66 + R() * 20, h = 40 + R() * 140, w = 3 + R() * 6;
    g.fillStyle = rgbaJ('#22162a', 0.9); g.beginPath(); g.moveTo(x - w, base); g.lineTo(x, base - h); g.lineTo(x + w, base); g.fill();
  }
  grain(g, PW, PH, R, 6000, 0.04);
  return c;
}
// the Loom-Cathedral: a ruin of needle spires, a broken rose window, threads strung between the spires
function* paintCathedral() {
  const c = canvas(PW, PH), g = c.getContext('2d'), R = rng(37);
  const cx = PW * 0.56, base = PH * 0.86;
  const dark = '#140c16', mid = '#2a1a26', lit = '#8a4a40';
  // the mass of the nave
  const nave = ragged([[cx - 420, base], [cx - 380, base - 260], [cx - 250, base - 330], [cx - 120, base - 360], [cx + 120, base - 360], [cx + 250, base - 330], [cx + 380, base - 250], [cx + 430, base]], 6, R, 8);
  g.fillStyle = dark; g.fill(nave);
  fillStrokes(g, nave, [cx - 440, base - 380, cx + 440, base], mid, 2200, R, { ang: Math.PI / 2, len: 26, w: 4, a: 0.45, cols: [mid, dark, '#3a2430'] });
  yield;
  // needle spires: tall, tapered, each with an eye near the tip
  const spires = [];
  for (let i = 0; i < 13; i++) {
    const u = i / 12, x = cx - 380 + u * 760 + (R() - 0.5) * 30, h = 260 + Math.sin(u * Math.PI) * 330 + R() * 80, w = 14 + Math.sin(u * Math.PI) * 18 + R() * 8;
    spires.push([x, base - 300, h, w]);
  }
  spires.sort((a, b) => a[3] - b[3]);
  for (const [x, by, h, w] of spires) {
    const tip = by - h, p = ragged([[x - w, by], [x - w * 0.6, by - h * 0.55], [x - 2, tip], [x + 2, tip], [x + w * 0.6, by - h * 0.55], [x + w, by]], 2.2, R, 6);
    g.fillStyle = dark; g.fill(p);
    fillStrokes(g, p, [x - w, tip, x + w, by], mid, 260, R, { ang: Math.PI / 2, len: 30, w: 3, a: 0.5, cols: [mid, '#1e1420', '#3a2430'] });
    // the lit flank (the low sun on the left)
    g.save(); g.clip(p); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 40; k++) { const yy = tip + R() * h, xx = x - w * (1 - (yy - tip) / h * 0.4) * (0.7 + R() * 0.3); stroke(g, [[xx, yy], [xx + 2, yy + 10 + R() * 20]], 2 + R() * 2, lit, 0.15 + R() * 0.2, R, { hairs: 3 }); }
    g.restore();
    // the eye of the needle, with a faint light through it
    const ey = tip + h * 0.14;
    g.fillStyle = '#ffcf9a'; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(x, ey, w * 0.18, h * 0.05, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
    glow(g, x, ey, w * 1.4, '#ffb070', 0.25);
    yield;
  }
  // flying buttresses and the broken rose window
  g.strokeStyle = dark; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const x0 = cx - 400 + i * 160, x1 = x0 + 70; g.lineWidth = 10; g.beginPath(); g.moveTo(x0, base - 120); g.quadraticCurveTo((x0 + x1) / 2, base - 260, x1 + 30, base - 300); g.stroke(); }
  const rx = cx, ry = base - 230, rr = 70;
  g.fillStyle = '#3a1a1a'; g.beginPath(); g.arc(rx, ry, rr, 0, TAU); g.fill();
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; g.strokeStyle = rgbaJ('#ffb070', 0.25 + R() * 0.3, R); g.lineWidth = 2; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Math.cos(a) * rr * (0.4 + R() * 0.6), ry + Math.sin(a) * rr * (0.4 + R() * 0.6)); g.stroke(); }
  glow(g, rx, ry, 120, '#ff9a5a', 0.3);
  g.fillStyle = dark; g.beginPath(); g.moveTo(rx + rr * 0.2, ry - rr); g.lineTo(rx + rr + 10, ry - rr * 0.6); g.lineTo(rx + rr * 0.4, ry + rr * 0.3); g.closePath(); g.fill();   // a bite out of it
  yield;
  // threads: the broken loom, strung spire to spire, some snapped and hanging
  for (let i = 0; i < 46; i++) {
    const a = spires[Math.floor(R() * spires.length)], b = spires[Math.floor(R() * spires.length)];
    if (a === b) continue;
    const ya = a[1] - a[2] * (0.3 + R() * 0.5), yb = b[1] - b[2] * (0.3 + R() * 0.5), sag = 20 + R() * 60, snapped = R() < 0.3;
    g.strokeStyle = rgbaJ(R() < 0.3 ? '#ffd9b0' : '#c9a0a0', 0.18 + R() * 0.25); g.lineWidth = 0.8 + R() * 0.8;
    g.beginPath(); g.moveTo(a[0], ya);
    if (snapped) g.quadraticCurveTo(a[0] + (b[0] - a[0]) * 0.2, ya + sag * 2, a[0] + (b[0] - a[0]) * 0.3, ya + sag * 3);
    else g.quadraticCurveTo((a[0] + b[0]) / 2, (ya + yb) / 2 + sag, b[0], yb);
    g.stroke();
  }
  // tattered banners hanging from the spires
  for (let i = 0; i < 8; i++) {
    const s = spires[Math.floor(R() * spires.length)], x = s[0] + (R() - 0.5) * 6, y = s[1] - s[2] * 0.4, w = 10 + R() * 12, h = 50 + R() * 80;
    const p = ragged([[x - w / 2, y], [x + w / 2, y], [x + w / 2, y + h], [x, y + h * 0.82], [x - w / 2, y + h]], 3, R, 5);
    g.fillStyle = rgbaJ('#5a1c1e', 0.9); g.fill(p);
    fillStrokes(g, p, [x - w, y, x + w, y + h], '#7a2a26', 50, R, { ang: Math.PI / 2, len: 16, w: 2, a: 0.4 });
  }
  yield;
  // rubble at the foot and fog through the nave
  const rub = ridge(PW, base - 10, 18, 0.03, R, { bottom: PH, step: 4 });
  g.fillStyle = '#100a12'; g.fill(rub);
  fog(g, PW, base - 120, 90, '#a0605a', 0.16, 60, R);
  fog(g, PW, base - 20, 60, '#6a4050', 0.25, 50, R);
  grain(g, PW, PH, R, 12000, 0.05);
  return c;
}
function* paintNear() {
  const c = canvas(PW, PH), g = c.getContext('2d'), R = rng(41);
  // dark cliffs framing the view, with dead grass along the lip
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 0 : PW, w = 300 + R() * 120;
    const pts = side < 0 ? [[0, PH], [0, PH * 0.5], [w * 0.4, PH * 0.56], [w * 0.8, PH * 0.7], [w, PH]] : [[PW, PH], [PW, PH * 0.58], [PW - w * 0.5, PH * 0.66], [PW - w, PH * 0.82], [PW - w, PH]];
    const p = ragged(pts, 8, R, 7);
    g.fillStyle = '#08050a'; g.fill(p);
    fillStrokes(g, p, [side < 0 ? 0 : PW - w, PH * 0.45, side < 0 ? w : PW, PH], '#160e14', 600, R, { ang: 0.3 * side, len: 30, w: 5, a: 0.5 });
    for (let i = 0; i < 160; i++) { const u = R(); const [ax, ay] = pts[1 + Math.floor(u * (pts.length - 2))]; const x = ax + (R() - 0.5) * 60, y = ay + (R() - 0.5) * 12; stroke(g, [[x, y], [x + (R() - 0.5) * 8, y - 10 - R() * 24]], 1.2, '#2a1a1a', 0.7, R, { hairs: 2, taper: 1 }); }
    yield;
  }
  // a dead tree on the left cliff and a pole with a torn standard on the right
  g.strokeStyle = '#08050a'; g.lineCap = 'round';
  const br = (x, y, a, l, w, d) => { if (d > 6 || l < 6) return; const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); br(x2, y2, a - 0.3 - R() * 0.3, l * 0.72, w * 0.68, d + 1); if (R() < 0.8) br(x2, y2, a + 0.3 + R() * 0.3, l * 0.66, w * 0.62, d + 1); };
  br(150, PH * 0.53, -Math.PI / 2 - 0.15, 110, 14, 0);
  g.lineWidth = 6; g.beginPath(); g.moveTo(PW - 190, PH * 0.66); g.lineTo(PW - 200, PH * 0.3); g.stroke();
  const ban = ragged([[PW - 198, PH * 0.31], [PW - 120, PH * 0.33], [PW - 128, PH * 0.42], [PW - 150, PH * 0.4], [PW - 170, PH * 0.47], [PW - 196, PH * 0.45]], 4, R, 5);
  g.fillStyle = '#3a1416'; g.fill(ban);
  grain(g, PW, PH, R, 5000, 0.05);
  return c;
}

// ------------------------------------------------------------ the five wardens
function backdrop(g, W, H, top, horizon, accent, R) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, top); gr.addColorStop(0.7, horizon); gr.addColorStop(1, '#050306');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  glow(g, W * 0.5, H * 0.55, 520, accent, 0.18);
  for (let band = 0; band < 6; band++) {
    const y = H * (0.08 + band * 0.11);
    for (let i = 0; i < 110; i++) { const x = R() * W * 1.1 - 50, yy = y + (R() - 0.5) * 50, l = 80 + R() * 220; stroke(g, [[x, yy], [x + l * 0.5, yy + (R() - 0.5) * 8], [x + l, yy + (R() - 0.5) * 10]], 8 + R() * 16, R() < 0.7 ? mixHex(top, '#000000', 0.3) : mixHex(horizon, accent, 0.2), 0.12 + R() * 0.12, R, { hairs: 6 }); }
  }
  // broken ground and ruins
  const gp = ridge(W, H * 0.9, 16, 0.02, R, { bottom: H, step: 5 });
  g.fillStyle = '#07040a'; g.fill(gp);
  for (let i = 0; i < 18; i++) { const x = R() * W, h = 30 + R() * 90, w = 8 + R() * 18; g.fillStyle = '#0c0810'; g.fillRect(x, H * 0.9 - h, w, h); }
}
// overlapping armour plates over a region (rows of scales), each scratched and edge-lit
function plates(g, x0, y0, w, h, rows, col, R, edge) {
  for (let r = 0; r < rows; r++) {
    const y = y0 + (r / rows) * h, n = 3 + Math.floor(R() * 2), pw = w / n;
    for (let k = 0; k < n; k++) {
      const x = x0 + k * pw + (r % 2) * pw * 0.3 - pw * 0.15, ph = h / rows * 1.35;
      const p = ragged([[x, y], [x + pw * 1.05, y + 2], [x + pw * 0.95, y + ph], [x + pw * 0.5, y + ph * 1.12], [x + 0.05 * pw, y + ph]], 1.4, R, 5);
      const gr = g.createLinearGradient(x, y, x + pw, y + ph);
      gr.addColorStop(0, mixHex(col, '#ffffff', 0.08)); gr.addColorStop(0.5, col); gr.addColorStop(1, mixHex(col, '#000000', 0.5));
      g.fillStyle = gr; g.fill(p);
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.4; g.stroke(p);
      for (let s = 0; s < 6; s++) { const sx = x + R() * pw, sy = y + R() * ph; g.strokeStyle = `rgba(230,210,190,${0.08 + R() * 0.14})`; g.lineWidth = 0.6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (R() - 0.5) * 16, sy + (R() - 0.5) * 6); g.stroke(); }
      g.strokeStyle = rgbaJ(edge, 0.35); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 2, y + 2); g.lineTo(x + pw, y + 3); g.stroke();
    }
  }
}
// an armoured body: a real silhouette (broad shoulders, a waist, hips, legs) filled with curved lames, each
// with a lit upper edge and a shadowed lower edge, scratched; a ridge down the middle
function knight(f, cx, top, gy, R, metal, col, scale = 1) {
  const S = scale, sh = 170 * S, wa = 92 * S, hip = 120 * S;
  const torso = ragged([[cx - sh, top + 20 * S], [cx - sh * 0.9, top], [cx + sh * 0.9, top], [cx + sh, top + 20 * S], [cx + sh * 0.7, top + 110 * S], [cx + wa, top + 230 * S], [cx + hip, top + 300 * S], [cx - hip, top + 300 * S], [cx - wa, top + 230 * S], [cx - sh * 0.7, top + 110 * S]], 2, R, 6);
  const legs = [-1, 1].map(s => ragged([[cx + s * 18 * S, top + 290 * S], [cx + s * 110 * S, top + 290 * S], [cx + s * 96 * S, gy - 80 * S], [cx + s * 112 * S, gy], [cx + s * 30 * S, gy], [cx + s * 36 * S, gy - 90 * S]], 2, R, 6));
  for (const P of [...legs, torso]) {
    f.fillStyle = mixHex(metal, '#000000', 0.55); f.fill(P);
    f.save(); f.clip(P);
    const rows = P === torso ? 13 : 11, y0 = P === torso ? top : top + 290 * S, y1 = P === torso ? top + 300 * S : gy;
    for (let r = 0; r < rows; r++) {
      const y = y0 + (r / rows) * (y1 - y0), h = (y1 - y0) / rows, bow = 10 * S + R() * 6 * S;
      const band = new Path2D(); band.moveTo(cx - 400, y); band.quadraticCurveTo(cx, y + bow, cx + 400, y); band.lineTo(cx + 400, y + h * 1.25); band.quadraticCurveTo(cx, y + h * 1.25 + bow, cx - 400, y + h * 1.25); band.closePath();
      const gr = f.createLinearGradient(0, y, 0, y + h * 1.25 + bow);
      gr.addColorStop(0, mixHex(metal, '#ffffff', 0.16)); gr.addColorStop(0.25, metal); gr.addColorStop(1, mixHex(metal, '#000000', 0.6));
      f.fillStyle = gr; f.fill(band);
      f.strokeStyle = 'rgba(0,0,0,0.65)'; f.lineWidth = 1.6; f.stroke(band);
      f.strokeStyle = rgbaJ(col, 0.22); f.lineWidth = 1; f.beginPath(); f.moveTo(cx - 400, y + 1.5); f.quadraticCurveTo(cx, y + bow + 1.5, cx + 400, y + 1.5); f.stroke();
      for (let k = 0; k < 10; k++) { const sx = cx + (R() - 0.5) * 300 * S, sy = y + R() * h; f.strokeStyle = `rgba(230,210,190,${0.06 + R() * 0.12})`; f.lineWidth = 0.6; f.beginPath(); f.moveTo(sx, sy); f.lineTo(sx + (R() - 0.5) * 22, sy + (R() - 0.5) * 6); f.stroke(); }
      for (const rx of [-0.55, 0.55]) { f.fillStyle = '#100c0e'; f.beginPath(); f.arc(cx + rx * sh * 0.8, y + h * 0.5 + bow * 0.6, 2.2 * S, 0, TAU); f.fill(); }
    }
    // a ridge down the middle and dents
    f.strokeStyle = rgbaJ(mixHex(metal, '#ffffff', 0.25), 0.35); f.lineWidth = 3 * S; f.beginPath(); f.moveTo(cx, y0Of(P)); f.lineTo(cx, P === torso ? top + 300 * S : gy); f.stroke();
    fillStrokes(f, P, [cx - 200 * S, top, cx + 200 * S, gy], mixHex(metal, '#000000', 0.3), 260, R, { ang: Math.PI / 2, len: 24, w: 2, a: 0.18 });
    f.restore();
    f.strokeStyle = 'rgba(0,0,0,0.7)'; f.lineWidth = 2.2; f.stroke(P);
  }
  function y0Of(P) { return P === torso ? top : top + 290 * S; }
  return { sh, top };
}
function tatteredCloak(g, x0, y0, x1, y1, wTop, wBot, col, R, n = 1800) {
  const p = ragged([[x0 - wTop / 2, y0], [x0 + wTop / 2, y0], [x1 + wBot / 2, y1], [x1 - wBot / 2, y1]], 10, R, 9);
  g.fillStyle = mixHex(col, '#000000', 0.35); g.fill(p);
  fillStrokes(g, p, [Math.min(x0, x1) - wBot, y0, Math.max(x0, x1) + wBot, y1], col, n, R, { ang: Math.PI / 2, len: 40, w: 5, a: 0.4, cols: [col, mixHex(col, '#000000', 0.4), mixHex(col, '#ffffff', 0.06)] });
  // the torn hem: long strips hanging past the bottom
  for (let i = 0; i < 70; i++) {
    const u = R(), x = x1 - wBot / 2 + u * wBot, l = 20 + R() * 90, w = 4 + R() * 10;
    const sp = ragged([[x - w / 2, y1 - 10], [x + w / 2, y1 - 10], [x + w * 0.2 + (R() - 0.5) * 10, y1 + l], [x - w * 0.3, y1 + l * 0.85]], 2, R, 4);
    g.fillStyle = rgbaJ(mixHex(col, '#000000', 0.2 + R() * 0.3), 0.95); g.fill(sp);
  }
}
function chainLinks(g, x, y, n, ang, R, col = '#5a5258') {
  for (let k = 0; k < n; k++) {
    const a = ang + Math.sin(k * 0.6) * 0.15, xx = x + Math.cos(a) * k * 11, yy = y + Math.sin(a) * k * 11;
    g.strokeStyle = k % 2 ? mixHex(col, '#000000', 0.3) : col; g.lineWidth = 3;
    g.beginPath(); g.ellipse(xx, yy, k % 2 ? 2.5 : 7, 6.5, a, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(230,210,190,0.18)'; g.lineWidth = 1; g.beginPath(); g.ellipse(xx - 1, yy - 1, k % 2 ? 2 : 6, 5.5, a, Math.PI, Math.PI * 1.6); g.stroke();
  }
}
// draw the figure on its own canvas so it can be rim-lit, then composite
function* portrait(id, fn) {
  const R = rng(100 + id * 17), info = WARDEN_INFO[id];
  const c = canvas(FW, FH), g = c.getContext('2d');
  const F = canvas(FW, FH), f = F.getContext('2d');
  // figures are painted around x 600 in a 1200-wide frame: centre them and shrink them toward the ground so
  // horns and crowns clear the letterbox and the lore line
  f.setTransform(0.8, 0, 0, 0.8, 800 - 600 * 0.8, 860 - 860 * 0.8);
  yield* fn(g, f, R, info.col);
  f.setTransform(1, 0, 0, 1, 0, 0);
  const rim = rimLight(F, 7, 3, mixHex(info.col, '#ffffff', 0.35), 0.9);
  g.drawImage(F, 0, 0);
  g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(rim, 0, 0); g.restore();
  yield;
  // embers / motes in the air, grade, vignette, grain
  for (let i = 0; i < 160; i++) { const x = R() * FW, y = R() * FH, r = 0.6 + R() * 2.2; g.fillStyle = rgbaJ(info.col, 0.2 + R() * 0.6); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  vignette(g, FW, FH, 0.75);
  grain(g, FW, FH, R, 14000, 0.06);
  return c;
}
const W0 = function* (g, f, R, col) {     // the Hollow Warden: horned, plated, cloaked, a cleaver planted
  backdrop(g, FW, FH, '#120a0c', '#5a2e1c', col, R); yield;
  const cx = 600, gy = 830;
  tatteredCloak(f, cx, 300, cx - 30, gy - 20, 300, 560, '#2a1e1c', R, 2400); yield;
  knight(f, cx, 280, gy, R, '#4a4246', col); yield;
  // pauldrons with spikes
  for (const s of [-1, 1]) {
    const px = cx + s * 150;
    for (let k = 0; k < 4; k++) { const p = ragged([[px - 70, 300 + k * 26], [px + 70, 296 + k * 26], [px + 60 + s * 10, 340 + k * 26], [px - 60, 344 + k * 26]], 2, R, 6); const gr = f.createLinearGradient(px - 70, 290, px + 70, 360); gr.addColorStop(0, '#5a5056'); gr.addColorStop(1, '#1a1618'); f.fillStyle = gr; f.fill(p); f.strokeStyle = 'rgba(0,0,0,0.6)'; f.lineWidth = 1.5; f.stroke(p); }
    for (let k = 0; k < 4; k++) { const x = px - 50 + k * 34; f.fillStyle = '#1c181a'; f.beginPath(); f.moveTo(x - 7, 300); f.lineTo(x + s * 6, 230 - R() * 30); f.lineTo(x + 7, 300); f.fill(); }
  }
  yield;
  // the helm: a heavy dome with a burning slit
  const hp = ragged([[cx - 62, 270], [cx - 70, 200], [cx - 40, 150], [cx + 40, 150], [cx + 70, 200], [cx + 62, 270]], 3, R, 5);
  const hg = f.createLinearGradient(cx - 70, 150, cx + 70, 270); hg.addColorStop(0, '#5a5056'); hg.addColorStop(0.6, '#2a2428'); hg.addColorStop(1, '#141014');
  f.fillStyle = hg; f.fill(hp); fillStrokes(f, hp, [cx - 70, 150, cx + 70, 270], '#3a3236', 220, R, { ang: Math.PI / 2, len: 14, w: 2, a: 0.4 });
  f.fillStyle = col; f.fillRect(cx - 40, 214, 80, 6); glow(f, cx, 217, 70, col, 0.6);
  // the horns: long ridged sweeps out and up
  for (const s of [-1, 1]) {
    let x = cx + s * 55, y = 175, a = -Math.PI / 2 - s * 0.9, w = 26;
    for (let k = 0; k < 34; k++) {
      const nx = x + Math.cos(a) * 9, ny = y + Math.sin(a) * 9;
      stroke(f, [[x, y], [nx, ny]], w, k % 3 ? '#2a2226' : '#4a4044', 0.95, R, { hairs: 6, taper: 0 });
      x = nx; y = ny; a += s * 0.055; w *= 0.93;
    }
  }
  yield;
  // the cleaver, planted point-down at its side, notched and stained
  const bx = cx + 250;
  const blade = ragged([[bx - 26, 380], [bx + 30, 370], [bx + 36, gy - 30], [bx + 4, gy + 10], [bx - 30, gy - 40]], 4, R, 9);
  const bg2 = f.createLinearGradient(bx - 30, 0, bx + 36, 0); bg2.addColorStop(0, '#2a2628'); bg2.addColorStop(0.5, '#5a5458'); bg2.addColorStop(1, '#1a1618');
  f.fillStyle = bg2; f.fill(blade);
  fillStrokes(f, blade, [bx - 30, 370, bx + 36, gy], '#6a6266', 300, R, { ang: Math.PI / 2, len: 30, w: 2, a: 0.25 });
  f.fillStyle = '#1a1214'; f.fillRect(bx - 34, 360, 76, 16); f.fillRect(bx - 6, 300, 14, 62);
  for (let k = 0; k < 6; k++) { f.fillStyle = 'rgba(60,20,18,0.5)'; f.beginPath(); f.ellipse(bx + (R() - 0.5) * 40, 420 + R() * 300, 3 + R() * 5, 8 + R() * 20, 0, 0, TAU); f.fill(); }
  // the arm resting on the pommel, and chains from the belt
  stroke(f, [[cx + 150, 330], [cx + 210, 360], [bx, 312]], 44, '#2e282a', 0.95, R, { hairs: 9, taper: 0 });
  for (let k = 0; k < 4; k++) chainLinks(f, cx - 110 + k * 70, 560, 9 + Math.floor(R() * 6), Math.PI / 2 + (R() - 0.5) * 0.3, R);
};
const W1 = function* (g, f, R, col) {     // the Glass Widow: a veiled body on long legs of cracked glass, shards in the air
  backdrop(g, FW, FH, '#04101a', '#0e3a44', col, R); yield;
  const cx = 600, cy = 360, gy = 840;
  // legs first (behind), eight, jointed
  for (let i = 0; i < 8; i++) {
    const s = i < 4 ? -1 : 1, k = i % 4, a0 = -0.6 - k * 0.32;
    const j1 = [cx + s * (110 + k * 26 + R() * 30), cy - 90 - (3 - k) * 34 - R() * 40], j2 = [cx + s * (250 + k * 62 + R() * 40), cy - 190 + k * 60 + R() * 40], ft = [cx + s * (300 + k * 70 + R() * 50), gy - R() * 20];
    const segs = [[[cx + s * 20, cy + 40], j1], [j1, j2], [j2, ft]];
    for (const [a, b] of segs) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, w = (12 - k * 1.5) * (b === ft ? 0.7 : 1);
      if (a === j1 || a === j2) { f.fillStyle = '#06121a'; f.beginPath(); f.moveTo(a[0] - 6, a[1]); f.lineTo(a[0] + s * 4, a[1] - 26 - R() * 16); f.lineTo(a[0] + 6, a[1]); f.fill(); }
      const p = new Path2D(); p.moveTo(a[0] + nx * w, a[1] + ny * w); p.lineTo(b[0] + nx * w * 0.5, b[1] + ny * w * 0.5); p.lineTo(b[0] - nx * w * 0.5, b[1] - ny * w * 0.5); p.lineTo(a[0] - nx * w, a[1] - ny * w); p.closePath();
      const gr = f.createLinearGradient(a[0] + nx * w, a[1] + ny * w, a[0] - nx * w, a[1] - ny * w); gr.addColorStop(0, 'rgba(120,220,235,0.85)'); gr.addColorStop(0.5, 'rgba(14,40,52,0.92)'); gr.addColorStop(1, 'rgba(4,12,18,0.95)');
      f.fillStyle = gr; f.fill(p);
      f.strokeStyle = rgbaJ(col, 0.55); f.lineWidth = 1; f.stroke(p);
      // cracks inside the glass
      for (let c = 0; c < 5; c++) { let x = a[0] + dx * R(), y = a[1] + dy * R(); f.strokeStyle = rgbaJ('#dffaff', 0.25 + R() * 0.3); f.lineWidth = 0.6; f.beginPath(); f.moveTo(x, y); for (let q = 0; q < 4; q++) { x += (R() - 0.5) * 14; y += (R() - 0.5) * 14; f.lineTo(x, y); } f.stroke(); }
    }
    yield;
  }
  // the carapace body, ribbed glass, and the veiled upper body rising from it
  const body = ragged([[cx - 110, cy + 20], [cx - 70, cy - 40], [cx + 70, cy - 40], [cx + 120, cy + 30], [cx + 60, cy + 120], [cx - 60, cy + 120]], 4, R, 6);
  f.fillStyle = '#081820'; f.fill(body);
  for (let k = 0; k < 9; k++) { f.strokeStyle = rgbaJ(col, 0.35); f.lineWidth = 2; f.beginPath(); f.moveTo(cx - 100 + k * 25, cy - 30); f.quadraticCurveTo(cx - 90 + k * 25, cy + 40, cx - 60 + k * 15, cy + 110); f.stroke(); }
  const torso = ragged([[cx - 40, cy - 40], [cx - 34, cy - 160], [cx - 22, cy - 210], [cx + 22, cy - 210], [cx + 34, cy - 160], [cx + 40, cy - 40]], 2, R, 5);
  f.fillStyle = '#0c1c24'; f.fill(torso);
  fillStrokes(f, torso, [cx - 40, cy - 210, cx + 40, cy - 40], '#1a3a44', 200, R, { ang: Math.PI / 2, len: 16, w: 2, a: 0.4 });
  f.fillStyle = '#0a141a'; f.beginPath(); f.ellipse(cx, cy - 240, 28, 34, 0, 0, TAU); f.fill();
  // the veil: hundreds of fine threads falling from the crown, translucent
  for (let i = 0; i < 260; i++) { const x = cx - 46 + R() * 92, l = 120 + R() * 220; f.strokeStyle = rgbaJ('#c8f4ff', 0.05 + R() * 0.12); f.lineWidth = 0.7; f.beginPath(); f.moveTo(x, cy - 275); f.quadraticCurveTo(x + (R() - 0.5) * 30, cy - 275 + l * 0.6, x + (R() - 0.5) * 60, cy - 275 + l); f.stroke(); }
  for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.22; f.fillStyle = rgbaJ(col, 0.8); f.beginPath(); f.moveTo(cx + Math.cos(a) * 30, cy - 260 + Math.sin(a) * 30); f.lineTo(cx + Math.cos(a) * 64, cy - 260 + Math.sin(a) * 64); f.lineTo(cx + Math.cos(a + 0.08) * 32, cy - 260 + Math.sin(a + 0.08) * 32); f.fill(); }
  glow(f, cx, cy - 245, 50, col, 0.5);
  yield;
  // shards in the air
  for (let i = 0; i < 180; i++) {
    const a = R() * TAU, d = 160 + R() * 420, x = cx + Math.cos(a) * d, y = cy - 60 + Math.sin(a) * d * 0.6, s = 3 + R() * 14, r = R() * TAU;
    f.save(); f.translate(x, y); f.rotate(r);
    f.fillStyle = rgbaJ('#0c2a34', 0.85); f.beginPath(); f.moveTo(0, -s); f.lineTo(s * 0.5, s * 0.6); f.lineTo(-s * 0.4, s * 0.5); f.closePath(); f.fill();
    f.strokeStyle = rgbaJ(col, 0.4 + R() * 0.5); f.lineWidth = 0.8; f.stroke();
    f.restore();
  }
};
const W2 = function* (g, f, R, col) {     // the Unmade Heart: a shell of torn ground circling a burning core
  backdrop(g, FW, FH, '#0a0614', '#2a1a44', col, R); yield;
  const cx = 600, cy = 430;
  glow(f, cx, cy, 260, col, 0.55); glow(f, cx, cy, 90, '#ffffff', 0.85);
  // threads from the core
  for (let i = 0; i < 90; i++) { const a = R() * TAU, d = 120 + R() * 260; f.strokeStyle = rgbaJ(R() < 0.5 ? col : '#ffffff', 0.08 + R() * 0.22); f.lineWidth = 0.8; f.beginPath(); f.moveTo(cx, cy); f.quadraticCurveTo(cx + Math.cos(a + 0.4) * d * 0.5, cy + Math.sin(a + 0.4) * d * 0.5, cx + Math.cos(a) * d, cy + Math.sin(a) * d); f.stroke(); }
  yield;
  // torn blocks of earth and stone, back to front (smaller and darker behind)
  const blocks = [];
  for (let i = 0; i < 320; i++) { const a = R() * TAU, z = R() * 2 - 1, d = 150 + R() * 180; blocks.push([cx + Math.cos(a) * d * Math.sqrt(1 - z * z * 0.6), cy + Math.sin(a) * d * 0.85, z, R() * TAU]); }
  blocks.sort((a, b) => a[2] - b[2]);
  let n = 0;
  for (const [x, y, z, r] of blocks) {
    const s = 10 + (z + 1) * 14 + R() * 8;
    const top = R() < 0.35 ? '#3a4a2a' : '#3a3030', side = '#1a1416';
    f.save(); f.translate(x, y); f.rotate(r);
    const p = ragged([[-s, -s], [s, -s * 0.9], [s * 0.9, s], [-s * 0.95, s * 0.85]], s * 0.12, R, s * 0.6);
    f.fillStyle = mixHex(side, '#000000', (1 - z) * 0.3); f.fill(p);
    f.fillStyle = top; f.fillRect(-s, -s, s * 2, s * 0.4);
    f.strokeStyle = rgbaJ(col, 0.15 + (z + 1) * 0.25); f.lineWidth = 1.2; f.stroke(p);
    for (let k = 0; k < 3; k++) { f.fillStyle = `rgba(200,180,170,${0.06 + R() * 0.1})`; f.fillRect((R() - 0.5) * s * 1.6, (R() - 0.5) * s * 1.6, 2, 2); }
    f.restore();
    if (++n % 40 === 0) yield;
  }
  // dust falling off the shell
  for (let i = 0; i < 400; i++) { const x = cx + (R() - 0.5) * 700, y = cy + R() * 420; f.fillStyle = `rgba(160,140,170,${R() * 0.3})`; f.fillRect(x, y, 1.5, 1.5 + R() * 4); }
};
const W3 = function* (g, f, R, col) {     // the Pyre Knight: plate cracked through with fire, a smouldering greatsword
  backdrop(g, FW, FH, '#120604', '#4a1608', col, R); yield;
  const cx = 600, gy = 840;
  // smoke rising behind
  for (let i = 0; i < 700; i++) { const x = cx + (R() - 0.5) * 600, y = 100 + R() * 600, l = 40 + R() * 120; stroke(f, [[x, y + l], [x + (R() - 0.5) * 30, y + l * 0.5], [x + (R() - 0.5) * 50, y]], 8 + R() * 18, R() < 0.8 ? '#140a0a' : '#3a1a12', 0.08 + R() * 0.1, R, { hairs: 5 }); if (i % 140 === 0) yield; }
  tatteredCloak(f, cx, 300, cx + 20, gy - 20, 260, 420, '#1e0e0c', R, 1600);
  knight(f, cx, 290, gy, R, '#3a2e2e', col); yield;
  // molten cracks through the plate: branching lines that glow
  f.save(); f.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    let x = cx + (R() - 0.5) * 220, y = 300 + R() * 520;
    for (let k = 0; k < 7; k++) { const nx = x + (R() - 0.5) * 30, ny = y + R() * 24; f.strokeStyle = rgbaJ(k < 2 ? '#fff0c0' : col, 0.6); f.lineWidth = 2.4 - k * 0.25; f.beginPath(); f.moveTo(x, y); f.lineTo(nx, ny); f.stroke(); glow(f, nx, ny, 14, col, 0.25); x = nx; y = ny; }
  }
  f.restore(); yield;
  // crowned helm
  const hp = ragged([[cx - 56, 270], [cx - 62, 200], [cx - 36, 160], [cx + 36, 160], [cx + 62, 200], [cx + 56, 270]], 3, R, 5);
  f.fillStyle = '#241c1c'; f.fill(hp); f.fillStyle = col; f.fillRect(cx - 34, 216, 68, 5); glow(f, cx, 218, 60, col, 0.6);
  for (let k = 0; k < 7; k++) { const x = cx - 54 + k * 18; f.fillStyle = '#2a2020'; f.beginPath(); f.moveTo(x - 6, 166); f.lineTo(x, 120 - (k % 2) * 18 - R() * 10); f.lineTo(x + 6, 166); f.fill(); }
  // the greatsword held point-down before him, glowing along the edge
  const bx = cx;
  const blade = ragged([[bx - 22, 360], [bx + 22, 360], [bx + 16, gy - 20], [bx, gy + 10], [bx - 16, gy - 20]], 2, R, 10);
  f.fillStyle = '#1e1818'; f.fill(blade);
  f.save(); f.globalCompositeOperation = 'lighter'; f.strokeStyle = rgbaJ(col, 0.7); f.lineWidth = 3; f.stroke(blade); glow(f, bx, 620, 120, col, 0.25); f.restore();
  f.fillStyle = '#140e0e'; f.fillRect(bx - 70, 342, 140, 20); f.fillRect(bx - 10, 270, 20, 74);
  for (const s of [-1, 1]) stroke(f, [[cx + s * 130, 330], [cx + s * 70, 330], [bx + s * 14, 300]], 42, '#261e1e', 0.95, R, { hairs: 8, taper: 0 });
  // embers lifting off everything
  f.save(); f.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 260; i++) { const x = cx + (R() - 0.5) * 520, y = 120 + R() * 700; f.fillStyle = rgbaJ(R() < 0.3 ? '#fff0c0' : col, 0.3 + R() * 0.6); f.fillRect(x, y, 1.5 + R() * 2, 1.5 + R() * 4); }
  f.restore();
};
const W4 = function* (g, f, R, col) {     // the Still Queen: a crown of ice spires, a gown that freezes into the ground
  backdrop(g, FW, FH, '#0c1420', '#4a6070', col, R); yield;
  const cx = 600, gy = 840;
  // the gown: a long bell that breaks into a fan of ice shards over the ground
  const gown = ragged([[cx - 50, 300], [cx + 50, 300], [cx + 200, gy - 40], [cx - 200, gy - 40]], 6, R, 8);
  f.fillStyle = '#18222c'; f.fill(gown);
  fillStrokes(f, gown, [cx - 200, 300, cx + 200, gy], '#2a3a48', 1600, R, { ang: Math.PI / 2, len: 50, w: 3, a: 0.35, cols: ['#2a3a48', '#1a2630', '#4a6070'] });
  yield;
  for (let i = 0; i < 120; i++) {
    const a = Math.PI + 0.1 + R() * (Math.PI - 0.2), d = 120 + R() * 260, x = cx + Math.cos(a) * d * 1.4, y = gy - 30 - Math.abs(Math.sin(a)) * d * 0.25, h = 20 + R() * 120, w = 4 + R() * 12;
    f.fillStyle = rgbaJ('#c8e8f5', 0.5 + R() * 0.4); f.beginPath(); f.moveTo(x - w, y); f.lineTo(x + (R() - 0.5) * 20, y - h); f.lineTo(x + w, y); f.closePath(); f.fill();
    f.strokeStyle = rgbaJ('#ffffff', 0.4); f.lineWidth = 0.8; f.beginPath(); f.moveTo(x - w * 0.3, y); f.lineTo(x + (R() - 0.5) * 6, y - h * 0.8); f.stroke();
  }
  yield;
  // the bodice and the long folded arms
  const bod = ragged([[cx - 44, 300], [cx - 40, 190], [cx - 26, 160], [cx + 26, 160], [cx + 40, 190], [cx + 44, 300]], 2, R, 5);
  f.fillStyle = '#1e2a36'; f.fill(bod);
  plates(f, cx - 40, 180, 80, 110, 5, '#3a4a58', R, col);
  for (const s of [-1, 1]) stroke(f, [[cx + s * 40, 190], [cx + s * 56, 260], [cx + s * 10, 300]], 18, '#1a242e', 0.95, R, { hairs: 6, taper: 0 });
  // face hidden by a frozen veil, and the crown of ice spires
  f.fillStyle = '#e8f2f8'; f.beginPath(); f.ellipse(cx, 130, 24, 30, 0, 0, TAU); f.fill();
  for (let i = 0; i < 120; i++) { const x = cx - 30 + R() * 60; f.strokeStyle = rgbaJ('#9ab4c4', 0.1 + R() * 0.15); f.lineWidth = 0.6; f.beginPath(); f.moveTo(x, 110); f.lineTo(x + (R() - 0.5) * 20, 160 + R() * 100); f.stroke(); }
  for (let k = 0; k < 13; k++) { const a = -Math.PI / 2 + (k - 6) * 0.15, h = 50 + (6 - Math.abs(k - 6)) * 14 + R() * 10; const bx = cx + Math.cos(a) * 26, by = 104 + Math.sin(a) * 10; f.fillStyle = rgbaJ('#d8f0ff', 0.85); f.beginPath(); f.moveTo(bx - 4, by); f.lineTo(bx + Math.cos(a) * h * 0.2, by - h); f.lineTo(bx + 4, by); f.fill(); }
  glow(f, cx, 80, 90, col, 0.35);
  // the blizzard
  for (let i = 0; i < 900; i++) { const x = R() * FW, y = R() * FH; f.strokeStyle = `rgba(230,244,255,${0.05 + R() * 0.25})`; f.lineWidth = 0.8 + R(); f.beginPath(); f.moveTo(x, y); f.lineTo(x - 6 - R() * 12, y + 2 + R() * 4); f.stroke(); }
};
const WARDEN_PAINT = [W0, W1, W2, W3, W4];

// ------------------------------------------------------------ the player of plates
export class PrologueArt {
  constructor() {
    this.p = new Painter();
    this.p.add('sky', paintSky()); this.p.add('far', paintFar()); this.p.add('cath', paintCathedral()); this.p.add('near', paintNear());
    WARDEN_PAINT.forEach((fn, i) => this.p.add('w' + i, portrait(i, fn)));
    this.embers = Array.from({ length: 90 }, (_, i) => ({ x: Math.random(), s: 0.04 + Math.random() * 0.08, o: Math.random(), r: 0.6 + Math.random() * 1.8 }));
    this.crows = Array.from({ length: 9 }, () => ({ x: Math.random() * 0.3, y: 0.25 + Math.random() * 0.2, s: 0.05 + Math.random() * 0.04, ph: Math.random() * TAU, z: 0.6 + Math.random() * 0.6 }));
  }
  step(ms) { this.p.step(ms); }
  ready(name) { return !!this.p.get(name); }
  // cover-fit an image into the screen with a zoom and pan
  cover(ctx, im, W, H, zoom, px = 0, py = 0, alpha = 1) {
    if (!im) return;
    const k = Math.max(W / im.width, H / im.height) * zoom, w = im.width * k, h = im.height * k;
    ctx.globalAlpha = alpha; ctx.drawImage(im, (W - w) / 2 + px * W, (H - h) / 2 + py * H, w, h); ctx.globalAlpha = 1;
  }
  embersDraw(ctx, W, H, t, col, a = 1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const e of this.embers) { const y = H * (1 - ((t * e.s + e.o) % 1)), x = W * (e.x + Math.sin(t * 0.7 + e.o * 9) * 0.02); ctx.fillStyle = `rgba(${col},${(0.25 + 0.5 * Math.sin(t * 3 + e.o * 20) ** 2) * a})`; ctx.beginPath(); ctx.arc(x, y, e.r * (W / 1000), 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // the vista: sky, far range, cathedral, near cliffs at different speeds, the seed falling across
  vista(ctx, W, H, u, t) {
    const z = 1.06 + u * 0.1;
    this.cover(ctx, this.p.get('sky'), W, H, z, -u * 0.01, 0);
    this.cover(ctx, this.p.get('far'), W, H, z * 1.01, -u * 0.02, 0.01);
    this.cover(ctx, this.p.get('cath'), W, H, z * 1.03, -u * 0.035, 0.02);
    // the seed of light: a hot point with a long tail, falling toward the nave
    const sx = W * (0.82 - u * 0.3), sy = H * (0.05 + u * 0.5), tail = W * 0.22;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(sx + tail * 0.8, sy - tail * 0.55, sx, sy); gr.addColorStop(0, 'rgba(255,220,170,0)'); gr.addColorStop(1, 'rgba(255,240,210,0.85)');
    ctx.strokeStyle = gr; ctx.lineWidth = Math.max(2, W / 500); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx + tail * 0.8, sy - tail * 0.55); ctx.lineTo(sx, sy); ctx.stroke();
    for (const [r, a] of [[W * 0.09, 0.25], [W * 0.03, 0.6], [W * 0.008, 1]]) { const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, r); g2.addColorStop(0, `rgba(255,246,226,${a})`); g2.addColorStop(1, 'rgba(255,200,140,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill(); }
    ctx.restore();
    // crows wheeling across
    ctx.fillStyle = '#0a060a';
    for (const c of this.crows) {
      const x = W * ((c.x + t * c.s) % 1.2 - 0.1), y = H * c.y + Math.sin(t * 1.3 + c.ph) * H * 0.02, s = W / 320 * c.z, fl = Math.sin(t * 9 + c.ph) * 0.7;
      ctx.beginPath(); ctx.moveTo(x - 6 * s, y - fl * 3 * s); ctx.quadraticCurveTo(x - 2 * s, y - 1 * s, x, y); ctx.quadraticCurveTo(x + 2 * s, y - 1 * s, x + 6 * s, y - fl * 3 * s); ctx.quadraticCurveTo(x + 2 * s, y + 0.6 * s, x, y + 1 * s); ctx.quadraticCurveTo(x - 2 * s, y + 0.6 * s, x - 6 * s, y - fl * 3 * s); ctx.fill();
    }
    this.cover(ctx, this.p.get('near'), W, H, z * 1.08, -u * 0.06, 0.03);
    this.embersDraw(ctx, W, H, t, '255,190,140', 0.7);
  }
  warden(ctx, W, H, i, u, t) {
    const im = this.p.get('w' + i), info = WARDEN_INFO[i];
    this.cover(ctx, im, W, H, 1.04 + u * 0.09, (i % 2 ? 1 : -1) * u * 0.015, -u * 0.01);
    const rgb = info.col.replace('#', '').match(/../g).map(h => parseInt(h, 16)).join(',');
    this.embersDraw(ctx, W, H, t, rgb, 0.5);
    // the name card
    const a = Math.min(1, u * 4) * Math.min(1, (1 - u) * 6);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
    const px = Math.max(0.6, Math.min(1.4, W / 1100));
    ctx.fillStyle = info.col; ctx.fillRect(W / 2 - 60 * px, H * 0.8, 120 * px, 1.5 * px);
    ctx.fillStyle = '#f3ece0'; ctx.font = `300 ${Math.round(40 * px)}px 'Cormorant Garamond', serif`;
    ctx.fillText(info.name.toUpperCase().split('').join(String.fromCharCode(8202)), W / 2, H * 0.8 - 14 * px);
    ctx.fillStyle = 'rgba(243,236,224,.6)'; ctx.font = `italic 400 ${Math.round(17 * px)}px 'Cormorant Garamond', serif`;
    ctx.fillText(info.sub, W / 2, H * 0.8 + 26 * px);
    ctx.restore();
  }
}
