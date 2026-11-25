// The opening's plates. A dusk vista of the Loom-Cathedral (needle spires around a rose window, strung with a
// few threads, in bands of fog), then a portrait of each of the five Wardens. Everything is clean vector
// construction: closed paths with integer corners, proportions from a few shared variables, symmetric
// figures mirrored about their centre line, one stroke width per layer with round joins, then soft gradient
// shading, one rim light and glow last. No grain, no jitter, no sketch marks. Plates are painted once off
// screen, a slice at a time, then only composited: parallax, push-ins, embers, crows and the falling seed
// are drawn live on top. A painted plate in assets/cine/<name>.png replaces the built one when present.
import { rng, canvas, rimLight, glow, vignette, rgbaJ, mixHex, Painter } from './brush.js';
import { IMG, CINE_NAMES } from './images.js';
import { TAU } from '../core/util.js';

const PW = 1600, PH = 900;          // vista plates
const FW = 1600, FH = 900;          // portraits (16:9; figures are built centred at x 600 in a 1200 frame)
export const WARDEN_INFO = [
  { name: 'The Hollow Warden', sub: 'the first needle · it keeps the meadow gate', col: '#ffb36b' },
  { name: 'The Glass Widow', sub: 'the second needle · it spins in the glass wood', col: '#8ff7ff' },
  { name: 'The Unmade Heart', sub: 'the third needle · it tore the ground apart to hide', col: '#c4b5ff' },
  { name: 'The Pyre Knight', sub: 'the fourth needle · it burns what it guards', col: '#ff7a3a' },
  { name: 'The Still Queen', sub: 'the fifth needle · nothing moves where she rules', col: '#dff6ff' },
];

// ------------------------------------------------------------ construction kit
const Rn = Math.round;
// a closed polygon, integer-snapped
function poly(pts) { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(Rn(x), Rn(y)) : p.moveTo(Rn(x), Rn(y)))); p.closePath(); return p; }
// mirror a half-outline (listed top to bottom on the left side) about x = cx into a full closed outline
function sym(cx, half) { return [...half, ...half.slice().reverse().map(([x, y]) => [2 * cx - x, y])]; }
function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; }
function fillP(g, p, style, line, lw = 2) {
  g.fillStyle = style; g.fill(p);
  if (line) { g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = line; g.lineWidth = lw; g.stroke(p); }
}
function line(g, pts, col, lw) {
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(Rn(x), Rn(y)) : g.moveTo(Rn(x), Rn(y)))); g.stroke();
}
// metal shading: lit from the upper left, falling to shadow at the lower right
const metalFill = (g, x0, y0, x1, y1, m) => lin(g, x0, y0, x1, y1, [[0, mixHex(m, '#ffffff', 0.16)], [0.45, m], [1, mixHex(m, '#000000', 0.55)]]);
// a smooth ridge line across the width from a sum of sines (no random walk)
function ridgeP(W, y, amp, fq, ph, bottom) {
  const p = new Path2D(); p.moveTo(0, bottom);
  for (let x = 0; x <= W; x += 8) p.lineTo(x, Rn(y + Math.sin(x * fq + ph) * amp * 0.65 + Math.sin(x * fq * 2.3 + ph * 1.7) * amp * 0.25));
  p.lineTo(W, bottom); p.closePath(); return p;
}
// a band of fog: a soft vertical gradient strip
function fogBand(g, W, y, h, col, a) { g.fillStyle = lin(g, 0, y - h, 0, y + h, [[0, rgbaJ(col, 0)], [0.5, rgbaJ(col, a)], [1, rgbaJ(col, 0)]]); g.fillRect(0, Rn(y - h), W, Rn(h * 2)); }
// a long flat cloud: a lens with a dark top and a lit underside edge
function cloud(g, x, y, rx, ry, top, under, a) {
  const p = new Path2D(); p.ellipse(Rn(x), Rn(y), Rn(rx), Rn(ry), 0, 0, TAU);
  g.globalAlpha = a; g.fillStyle = lin(g, 0, y - ry, 0, y + ry, [[0, top], [1, under]]); g.fill(p);
  g.strokeStyle = rgbaJ('#ffb880', 0.35); g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.ellipse(Rn(x), Rn(y), Rn(rx), Rn(ry), 0, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); g.globalAlpha = 1;
}

// ------------------------------------------------------------ vista
function* paintSky() {
  const c = canvas(PW, PH), g = c.getContext('2d'), R = rng(11);
  g.fillStyle = lin(g, 0, 0, 0, PH, [[0, '#07060f'], [0.35, '#1b1430'], [0.58, '#4a2a3e'], [0.72, '#9a4a3a'], [0.8, '#d8864e'], [1, '#2a1a22']]);
  g.fillRect(0, 0, PW, PH);
  glow(g, PW * 0.36, PH * 0.72, 420, '#ffb070', 0.55); glow(g, PW * 0.36, PH * 0.72, 120, '#fff0d0', 0.6);
  // a sparse field of stars, each a crisp round point
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,240,230,${(0.25 + R() * 0.5).toFixed(2)})`; g.beginPath(); g.arc(Rn(R() * PW), Rn(R() * PH * 0.38), R() < 0.15 ? 1.6 : 1, 0, TAU); g.fill(); }
  yield;
  // four bands of long flat clouds, darker above, warmer toward the sun
  for (let band = 0; band < 4; band++) {
    const y = PH * (0.16 + band * 0.12), lit = band / 4;
    const top = mixHex('#1e1830', '#6a3a40', lit), under = mixHex('#2a2040', '#c06a4a', lit);
    for (let k = 0; k < 4; k++) {
      const x = PW * (((k * 0.29 + band * 0.17) % 1.1) - 0.02), rx = 180 + ((k + band) % 3) * 90, ry = 12 + ((k * 2 + band) % 3) * 5;
      cloud(g, x, y + (k % 2) * 18, rx, ry, top, under, 0.75);
    }
  }
  return c;
}
function* paintFar() {
  const c = canvas(PW, PH), g = c.getContext('2d');
  const layers = [[PH * 0.6, 70, 0.004, 0.4, '#3a2436'], [PH * 0.66, 55, 0.007, 2.1, '#2a1a2a'], [PH * 0.72, 40, 0.011, 4.4, '#1c121e']];
  for (const [y, amp, fq, ph, col] of layers) {
    g.fillStyle = lin(g, 0, y - amp, 0, PH, [[0, mixHex(col, '#c06a4a', 0.12)], [0.4, col], [1, mixHex(col, '#000000', 0.4)]]);
    g.fill(ridgeP(PW, y, amp, fq, ph, PH));
    fogBand(g, PW, y + 24, 40, '#c0786a', 0.14);
    yield;
  }
  // distant spires on the ridge: evenly spaced, heights from a smooth curve
  for (let i = 0; i < 9; i++) {
    const x = PW * (0.08 + i * 0.105), base = PH * 0.67, h = 60 + Math.abs(Math.sin(i * 1.7)) * 110, w = 4 + (i % 3);
    fillP(g, poly([[x - w, base], [x, base - h], [x + w, base]]), '#22162a');
  }
  return c;
}
// the Loom-Cathedral: symmetric about its centre line
function* paintCathedral() {
  const c = canvas(PW, PH), g = c.getContext('2d');
  const cx = Rn(PW * 0.56), base = Rn(PH * 0.86);
  const dark = '#140c16', mid = '#2a1a26', lit = '#8a4a40';
  // the nave: one symmetric mass, lit on the sun side
  const nave = poly(sym(cx, [[cx - 430, base], [cx - 380, base - 250], [cx - 250, base - 330], [cx - 120, base - 360]]));
  fillP(g, nave, lin(g, cx - 430, 0, cx + 430, 0, [[0, mixHex(mid, lit, 0.3)], [0.4, mid], [1, dark]]));
  yield;
  // needle spires, eleven, mirrored: tall in the middle, each with a shoulder step and an eye near the tip
  const spires = [];
  for (let i = -5; i <= 5; i++) { const u = i / 5, k = 1 - u * u; spires.push([cx + u * 380, base - 300, 280 + k * 340, 14 + k * 16]); }
  spires.sort((a, b) => a[3] - b[3]);
  for (const [x, by, h, w] of spires) {
    const tip = by - h, sh = by - h * 0.55;
    const p = poly(sym(x, [[x - 2, tip], [x - w * 0.55, sh], [x - w * 0.7, sh + 8], [x - w, by]]));
    fillP(g, p, lin(g, x - w, 0, x + w, 0, [[0, mixHex(mid, lit, 0.55)], [0.35, mid], [1, dark]]), rgbaJ('#0a060a', 0.8), 2);
    const ey = Rn(tip + h * 0.14);
    g.fillStyle = 'rgba(255,207,154,0.6)'; g.beginPath(); g.ellipse(Rn(x), ey, Math.max(2, Rn(w * 0.16)), Rn(h * 0.04), 0, 0, TAU); g.fill();
    glow(g, x, ey, w * 1.4, '#ffb070', 0.22);
  }
  yield;
  // flying buttresses, mirrored pairs, one width
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const x0 = cx + s * (400 - i * 120), x1 = x0 - s * 80;
    g.strokeStyle = dark; g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, base - 110); g.quadraticCurveTo((x0 + x1) / 2, base - 250, x1, base - 300); g.stroke();
  }
  // the rose window: twelve petals around a hub, crisp tracery
  const rx = cx, ry = base - 230, rr = 70;
  glow(g, rx, ry, 130, '#ff9a5a', 0.3);
  g.fillStyle = '#2a1214'; g.beginPath(); g.arc(rx, ry, rr, 0, TAU); g.fill();
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * TAU, px = rx + Math.cos(a) * rr * 0.58, py = ry + Math.sin(a) * rr * 0.58;
    g.fillStyle = lin(g, rx, ry, px, py, [[0, '#ffd9a0'], [1, '#c0502e']]);
    g.beginPath(); g.ellipse(Rn(px), Rn(py), Rn(rr * 0.3), Rn(rr * 0.12), a, 0, TAU); g.fill();
  }
  g.fillStyle = '#ffe6c0'; g.beginPath(); g.arc(rx, ry, Rn(rr * 0.16), 0, TAU); g.fill();
  g.strokeStyle = dark; g.lineWidth = 6; g.beginPath(); g.arc(rx, ry, rr, 0, TAU); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(rx, ry, Rn(rr * 0.9), 0, TAU); g.stroke();
  yield;
  // threads: a few clean catenaries between mirrored spire pairs
  const byX = spires.slice().sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < 5; i++) {
    const a = byX[i], b = byX[10 - i], ya = a[1] - a[2] * 0.62, sag = 40 + i * 14;
    g.strokeStyle = rgbaJ(i % 2 ? '#ffd9b0' : '#c9a0a0', 0.35); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(Rn(a[0]), Rn(ya)); g.quadraticCurveTo(cx, Rn(ya + sag * 2), Rn(b[0]), Rn(ya)); g.stroke();
  }
  // four banners in mirrored pairs, swallowtail hems
  for (const [u, h] of [[0.4, 110], [0.8, 80]]) for (const s of [-1, 1]) {
    const x = cx + s * u * 380, y = base - 300 - (1 - u * u) * 160, w = 22;
    fillP(g, poly([[x - w / 2, y], [x + w / 2, y], [x + w / 2, y + h], [x, y + h - 16], [x - w / 2, y + h]]), lin(g, 0, y, 0, y + h, [[0, '#7a2a26'], [1, '#3a1214']]));
  }
  yield;
  // the ground at the foot and fog through the nave
  g.fillStyle = '#100a12'; g.fill(ridgeP(PW, base - 6, 10, 0.012, 1.2, PH));
  fogBand(g, PW, base - 110, 70, '#a0605a', 0.2);
  fogBand(g, PW, base - 10, 50, '#6a4050', 0.3);
  return c;
}
function* paintNear() {
  const c = canvas(PW, PH), g = c.getContext('2d');
  // dark cliffs framing the view: smooth closed curves
  const left = new Path2D(); left.moveTo(0, PH); left.lineTo(0, Rn(PH * 0.5)); left.quadraticCurveTo(220, Rn(PH * 0.52), 340, PH * 0.72); left.quadraticCurveTo(380, PH * 0.86, 400, PH); left.closePath();
  const right = new Path2D(); right.moveTo(PW, PH); right.lineTo(PW, Rn(PH * 0.58)); right.quadraticCurveTo(PW - 200, Rn(PH * 0.62), PW - 300, Rn(PH * 0.8)); right.lineTo(PW - 330, PH); right.closePath();
  for (const p of [left, right]) fillP(g, p, lin(g, 0, PH * 0.5, 0, PH, [[0, '#1a1016'], [1, '#050306']]));
  yield;
  // a bare tree on the left cliff: a symmetric fork, three levels deep, round joints
  g.strokeStyle = '#08050a'; g.lineCap = 'round'; g.lineJoin = 'round';
  const br = (x, y, a, l, w, d) => { if (d > 4) return; const x2 = Rn(x + Math.cos(a) * l), y2 = Rn(y + Math.sin(a) * l); g.lineWidth = w; g.beginPath(); g.moveTo(Rn(x), Rn(y)); g.lineTo(x2, y2); g.stroke(); br(x2, y2, a - 0.42, l * 0.7, w * 0.66, d + 1); br(x2, y2, a + 0.42, l * 0.66, w * 0.62, d + 1); };
  br(150, PH * 0.53, -Math.PI / 2 - 0.12, 110, 14, 0);
  // a pole with a standard on the right cliff
  line(g, [[PW - 190, PH * 0.64], [PW - 196, PH * 0.3]], '#08050a', 6);
  fillP(g, poly([[PW - 194, PH * 0.31], [PW - 120, PH * 0.32], [PW - 120, PH * 0.42], [PW - 150, PH * 0.39], [PW - 194, PH * 0.42]]), lin(g, 0, PH * 0.3, 0, PH * 0.42, [[0, '#4a1a1c'], [1, '#2a0e10']]));
  return c;
}

// ------------------------------------------------------------ the five wardens
function backdrop(g, W, H, top, horizon, accent) {
  g.fillStyle = lin(g, 0, 0, 0, H, [[0, top], [0.7, horizon], [1, '#050306']]); g.fillRect(0, 0, W, H);
  glow(g, W * 0.5, H * 0.55, 520, accent, 0.18);
  for (let k = 0; k < 3; k++) cloud(g, W * (0.2 + k * 0.3), H * (0.18 + k * 0.1), 260 + k * 40, 14 + k * 4, mixHex(top, '#000000', 0.2), mixHex(horizon, accent, 0.25), 0.55);
  // the ground and four mirrored ruined pillars, each with one clean diagonal break
  g.fillStyle = '#07040a'; g.fill(ridgeP(W, H * 0.9, 10, 0.006, 0.7, H));
  for (const [u, h] of [[0.08, 120], [0.16, 70]]) for (const s of [-1, 1]) {
    const x = W * (0.5 + s * (0.5 - u)), y = H * 0.9, w = 26;
    fillP(g, poly([[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h + s * 14], [x + w / 2, y]]), '#0c0810');
  }
}
// an armoured body, symmetric: cuirass, gorget, pectoral plates, four abdomen lames with rivets, greaves
// with knee cops. All sizes from the shoulder half-width sh, waist wa, hip and torso height TH.
function knight(f, cx, top, gy, metal, lit, S = 1) {
  const sh = 170 * S, wa = 92 * S, hip = 120 * S, TH = 300 * S, edge = 'rgba(0,0,0,0.7)';
  for (const s of [-1, 1]) {
    const leg = poly([[cx + s * 26 * S, top + TH - 10 * S], [cx + s * 106 * S, top + TH - 10 * S], [cx + s * 96 * S, gy - 90 * S], [cx + s * 112 * S, gy], [cx + s * 30 * S, gy], [cx + s * 36 * S, gy - 90 * S]]);
    fillP(f, leg, metalFill(f, cx + s * 30 * S, top + TH, cx + s * 110 * S, gy, metal), edge, 2);
    const ky = gy - 150 * S, kx = cx + s * 70 * S;
    f.beginPath(); f.ellipse(Rn(kx), Rn(ky), Rn(40 * S), Rn(24 * S), 0, 0, TAU); f.closePath();
    f.fillStyle = metalFill(f, kx - 40 * S, ky - 24 * S, kx + 40 * S, ky + 24 * S, metal); f.fill(); f.strokeStyle = edge; f.lineWidth = 2; f.stroke();
    line(f, [[kx - 30 * S, ky - 12 * S], [kx + 20 * S, ky - 18 * S]], rgbaJ(lit, 0.35), 2);
  }
  const torso = poly(sym(cx, [[cx - sh * 0.9, top], [cx - sh, top + 20 * S], [cx - sh * 0.7, top + 110 * S], [cx - wa, top + 230 * S], [cx - hip, top + TH]]));
  fillP(f, torso, metalFill(f, cx - sh, top, cx + sh, top + TH, metal), edge, 2);
  f.save(); f.clip(torso);
  // four abdomen lames, evenly spaced, each a curved band with a lit upper edge and a pair of rivets
  for (let r = 0; r < 4; r++) {
    const y = top + 170 * S + r * 34 * S, h = 34 * S, bow = 10 * S;
    const band = new Path2D(); band.moveTo(cx - 300, Rn(y)); band.quadraticCurveTo(cx, Rn(y + bow * 2), cx + 300, Rn(y)); band.lineTo(cx + 300, Rn(y + h)); band.quadraticCurveTo(cx, Rn(y + h + bow * 2), cx - 300, Rn(y + h)); band.closePath();
    fillP(f, band, lin(f, 0, y, 0, y + h + bow, [[0, mixHex(metal, '#ffffff', 0.14)], [0.3, metal], [1, mixHex(metal, '#000000', 0.55)]]), edge, 2);
    for (const s of [-1, 1]) { f.fillStyle = '#100c0e'; f.beginPath(); f.arc(Rn(cx + s * wa * 0.7), Rn(y + h * 0.5 + bow), Rn(3 * S), 0, TAU); f.fill(); }
  }
  f.restore();
  // two pectoral plates and the gorget over them
  for (const s of [-1, 1]) {
    const p = poly([[cx, top + 30 * S], [cx + s * sh * 0.76, top + 38 * S], [cx + s * sh * 0.64, top + 120 * S], [cx, top + 152 * S]]);
    fillP(f, p, metalFill(f, cx - sh * 0.7, top, cx + sh * 0.7, top + 150 * S, metal), edge, 2);
  }
  line(f, [[cx, top + 30 * S], [cx, top + 152 * S]], rgbaJ(lit, 0.4), 3);
  const gorget = new Path2D(); gorget.moveTo(Rn(cx - 74 * S), Rn(top + 4 * S)); gorget.quadraticCurveTo(cx, Rn(top + 52 * S), Rn(cx + 74 * S), Rn(top + 4 * S)); gorget.lineTo(Rn(cx + 60 * S), Rn(top - 10 * S)); gorget.quadraticCurveTo(cx, Rn(top + 28 * S), Rn(cx - 60 * S), Rn(top - 10 * S)); gorget.closePath();
  fillP(f, gorget, metalFill(f, cx - 74 * S, top - 10 * S, cx + 74 * S, top + 52 * S, metal), edge, 2);
  return { sh, top };
}
// a long cloak behind the body: smooth sides, a hem with evenly spaced V notches, a few even fold lines
function cloak(g, cx, y0, gy, wTop, wBot, col, notches = 4) {
  const p = new Path2D();
  p.moveTo(Rn(cx - wTop / 2), y0); p.lineTo(Rn(cx + wTop / 2), y0);
  p.quadraticCurveTo(Rn(cx + wBot * 0.42), Rn((y0 + gy) / 2), Rn(cx + wBot / 2), gy);
  const n = notches * 2 + 1, step = wBot / n;
  for (let i = 1; i < n; i++) p.lineTo(Rn(cx + wBot / 2 - i * step), i % 2 ? gy - 36 : gy);
  p.lineTo(Rn(cx - wBot / 2), gy);
  p.quadraticCurveTo(Rn(cx - wBot * 0.42), Rn((y0 + gy) / 2), Rn(cx - wTop / 2), y0); p.closePath();
  fillP(g, p, lin(g, cx - wBot / 2, 0, cx + wBot / 2, 0, [[0, mixHex(col, '#ffffff', 0.06)], [0.5, col], [1, mixHex(col, '#000000', 0.5)]]), 'rgba(0,0,0,0.6)', 2);
  g.save(); g.clip(p);
  for (let i = 1; i < 5; i++) { const u = i / 5 - 0.5; line(g, [[cx + u * wTop, y0 + 20], [cx + u * wBot * 0.92, gy - 40]], rgbaJ('#000000', 0.22), 3); }
  g.restore();
}
// a hanging chain of even links, alternating face and edge
function chain(g, x, y, n, col = '#5a5258') {
  for (let k = 0; k < n; k++) {
    const yy = Rn(y + k * 12);
    g.strokeStyle = k % 2 ? mixHex(col, '#000000', 0.3) : col; g.lineWidth = 3;
    g.beginPath(); g.ellipse(Rn(x), yy, k % 2 ? 2 : 6, 7, 0, 0, TAU); g.closePath(); g.stroke();
  }
}
// a smooth tapered horn: two curves sharing a base and a tip, closed; one lit edge along the outer curve
function horn(g, bx, by, s, col, lit) {
  const tip = [bx + s * 150, by - 200];
  const p = new Path2D(); p.moveTo(Rn(bx - s * 12), Rn(by + 8));
  p.quadraticCurveTo(Rn(bx + s * 200), Rn(by + 6), Rn(tip[0]), Rn(tip[1]));
  p.quadraticCurveTo(Rn(bx + s * 130), Rn(by - 24), Rn(bx + s * 16), Rn(by - 18)); p.closePath();
  fillP(g, p, lin(g, bx, by, tip[0], tip[1], [[0, mixHex(col, '#000000', 0.2)], [1, mixHex(col, '#ffffff', 0.3)]]), 'rgba(0,0,0,0.6)', 2);
  g.strokeStyle = rgbaJ(lit, 0.35); g.lineWidth = 2; g.beginPath(); g.moveTo(Rn(bx + s * 60), Rn(by + 4)); g.quadraticCurveTo(Rn(bx + s * 170), Rn(by - 10), Rn(tip[0]), Rn(tip[1])); g.stroke();
}
// a domed helm with a burning eye slit, symmetric
function helm(f, cx, y0, w, h, metal, col, lit) {
  const p = new Path2D();
  p.moveTo(Rn(cx - w * 0.9), Rn(y0 + h)); p.lineTo(Rn(cx - w), Rn(y0 + h * 0.45));
  p.bezierCurveTo(Rn(cx - w), Rn(y0 + h * 0.08), Rn(cx - w * 0.55), Rn(y0), cx, Rn(y0));
  p.bezierCurveTo(Rn(cx + w * 0.55), Rn(y0), Rn(cx + w), Rn(y0 + h * 0.08), Rn(cx + w), Rn(y0 + h * 0.45));
  p.lineTo(Rn(cx + w * 0.9), Rn(y0 + h)); p.closePath();
  fillP(f, p, metalFill(f, cx - w, y0, cx + w, y0 + h, metal), 'rgba(0,0,0,0.7)', 2);
  line(f, [[cx, y0 + 4], [cx, y0 + h * 0.5]], rgbaJ(lit, 0.4), 3);
  const sy = Rn(y0 + h * 0.55);
  line(f, [[cx - w * 0.58, sy], [cx + w * 0.58, sy]], col, 6);
  glow(f, cx, sy, w * 1.1, col, 0.55);
}
// a tapered limb segment from a to b (widths wa, wb), closed, with a round joint cap at b
function limb(f, a, b, wa, wb, col) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  fillP(f, poly([[a[0] + nx * wa, a[1] + ny * wa], [b[0] + nx * wb, b[1] + ny * wb], [b[0] - nx * wb, b[1] - ny * wb], [a[0] - nx * wa, a[1] - ny * wa]]), metalFill(f, a[0] - wa, a[1] - wa, b[0] + wb, b[1] + wb, col), 'rgba(0,0,0,0.65)', 2);
  f.beginPath(); f.arc(Rn(b[0]), Rn(b[1]), Rn(wb * 1.1), 0, TAU); f.fillStyle = mixHex(col, '#000000', 0.2); f.fill(); f.strokeStyle = 'rgba(0,0,0,0.65)'; f.lineWidth = 2; f.stroke();
}
// draw the figure on its own canvas so it can be rim-lit, then composite
// a painted Warden (assets/cine/w<i>.png, the figure alone) over the built backdrop: large and centred, its
// base sinking into a band of ground mist so the place the card cut it off never shows
const BACKDROP = [['#120a0c', '#5a2e1c'], ['#04101a', '#0e3a44'], ['#0a0614', '#2a1a44'], ['#120604', '#4a1608'], ['#0c1420', '#4a6070']];
function* paintedPortrait(id, im) {
  const info = WARDEN_INFO[id], [top, hor] = BACKDROP[id];
  const c = canvas(FW, FH), g = c.getContext('2d');
  backdrop(g, FW, FH, top, hor, info.col); yield;
  const F = canvas(FW, FH), f = F.getContext('2d');
  const h = Math.round(FH * 0.62), w = Math.round(im.width * h / im.height), x = Math.round(FW / 2 - w / 2), y = Math.round(FH * 0.85) - h;
  if (id === 2) {   // the Unmade Heart's halo, drawn clean where the card's ring was
    const cx = Math.round(FW / 2), cy = Math.round(y + h * 0.27), r = Math.round(h * 0.12);
    f.strokeStyle = rgbaJ(info.col, 0.85); f.lineWidth = 3; f.beginPath(); f.arc(cx, cy, r, 0, TAU); f.stroke();
    f.lineWidth = 2; f.lineCap = 'round'; f.beginPath(); f.moveTo(cx, cy - Math.round(r * 1.6)); f.lineTo(cx, cy + Math.round(r * 0.55)); f.stroke();
    glow(f, cx, cy, h * 0.2, info.col, 0.35);
  }
  f.imageSmoothingQuality = 'high'; f.drawImage(im, x, y, w, h);
  const rim = rimLight(F, 5, 3, mixHex(info.col, '#ffffff', 0.4), 0.6);
  g.drawImage(F, 0, 0);
  g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(rim, 0, 0); g.restore();
  yield;
  // the ground mist the figure stands in
  const mist = g.createLinearGradient(0, FH * 0.72, 0, FH);
  mist.addColorStop(0, rgbaJ(hor, 0)); mist.addColorStop(0.55, rgbaJ(mixHex(hor, '#000000', 0.3), 0.75)); mist.addColorStop(1, rgbaJ('#050306', 1));
  g.fillStyle = mist; g.fillRect(0, Math.round(FH * 0.72), FW, FH);
  vignette(g, FW, FH, 0.7);
  return c;
}
function* portrait(id, fn) {
  // wait a moment for the painted figure if it is on its way (images load in the background)
  if (CINE_NAMES.includes('w' + id)) { const t0 = performance.now(); while (!IMG['cine/w' + id] && performance.now() - t0 < 5000) yield; }
  const im = IMG['cine/w' + id];
  if (im) return yield* paintedPortrait(id, im);
  const R = rng(100 + id * 17), info = WARDEN_INFO[id];
  const c = canvas(FW, FH), g = c.getContext('2d');
  const F = canvas(FW, FH), f = F.getContext('2d');
  // figures are built around x 600 in a 1200-wide frame: centre them and shrink them toward the ground so
  // horns and crowns clear the letterbox and the lore line
  f.setTransform(0.8, 0, 0, 0.8, 800 - 600 * 0.8, 860 - 860 * 0.8);
  yield* fn(g, f, R, info.col);
  f.setTransform(1, 0, 0, 1, 0, 0);
  const rim = rimLight(F, 6, 3, mixHex(info.col, '#ffffff', 0.35), 0.85);
  g.drawImage(F, 0, 0);
  g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(rim, 0, 0); g.restore();
  yield;
  vignette(g, FW, FH, 0.7);
  return c;
}
const W0 = function* (g, f, R, col) {     // the Hollow Warden: horned, plated, cloaked, a cleaver planted at its side
  backdrop(g, FW, FH, '#120a0c', '#5a2e1c', col); yield;
  const cx = 600, gy = 830, metal = '#4a4246', lit = '#e8d2b8';
  cloak(f, cx, 300, gy - 10, 300, 560, '#2a1e1c', 4); yield;
  knight(f, cx, 280, gy, metal, lit); yield;
  // pauldrons: three stacked lens plates each side, drawn bottom first, three spikes rising from the top plate
  for (const s of [-1, 1]) {
    const px = cx + s * 150;
    for (let k = 2; k >= 0; k--) {
      const y = 290 + k * 26, p = new Path2D();
      p.moveTo(Rn(px - 72), y + 40); p.quadraticCurveTo(px, y - 12, Rn(px + 72), y + 40); p.lineTo(Rn(px + 62), y + 56); p.quadraticCurveTo(px, y + 30, Rn(px - 62), y + 56); p.closePath();
      fillP(f, p, metalFill(f, px - 72, y, px + 72, y + 56, metal), 'rgba(0,0,0,0.7)', 2);
    }
    [[-40, 56], [0, 78], [40, 56]].forEach(([dx, h]) => { const x = px + dx; fillP(f, poly([[x - 8, 296], [x + s * 10, 296 - h], [x + 8, 296]]), lin(f, x, 296, x, 296 - h, [[0, '#1c181a'], [1, '#4a4044']]), 'rgba(0,0,0,0.6)', 2); });
  }
  yield;
  for (const s of [-1, 1]) horn(f, cx + s * 50, 178, s, '#2a2226', lit);
  helm(f, cx, 150, 70, 120, metal, col, lit);
  yield;
  // the cleaver, point down at its right side: one notch, a crossguard, grip and pommel
  const bx = cx + 250;
  const blade = poly([[bx - 26, 380], [bx + 30, 372], [bx + 36, 520], [bx + 22, 538], [bx + 36, 556], [bx + 36, gy - 30], [bx + 4, gy + 6], [bx - 30, gy - 40]]);
  fillP(f, blade, lin(f, bx - 30, 0, bx + 36, 0, [[0, '#2a2628'], [0.45, '#6a6468'], [1, '#1a1618']]), 'rgba(0,0,0,0.7)', 2);
  line(f, [[bx - 24, 386], [bx - 28, gy - 46]], rgbaJ(lit, 0.45), 2);
  fillP(f, poly([[bx - 38, 358], [bx + 42, 358], [bx + 42, 376], [bx - 38, 376]]), '#1a1214', 'rgba(0,0,0,0.7)', 2);
  fillP(f, poly([[bx - 7, 300], [bx + 9, 300], [bx + 9, 358], [bx - 7, 358]]), '#2a1e1a');
  f.fillStyle = '#3a3034'; f.beginPath(); f.arc(bx + 1, 296, 11, 0, TAU); f.fill();
  // the arm resting on the pommel
  limb(f, [cx + 150, 330], [cx + 214, 372], 24, 18, metal);
  limb(f, [cx + 214, 372], [bx + 1, 316], 18, 16, metal);
  // two chains hanging from the belt, mirrored
  for (const s of [-1, 1]) chain(f, cx + s * 80, 570, 12);
};
const W1 = function* (g, f, R, col) {     // the Glass Widow: a veiled body on eight long glass legs, a ring of shards
  backdrop(g, FW, FH, '#04101a', '#0e3a44', col); yield;
  const cx = 600, cy = 360, gy = 840;
  // eight legs, mirrored pairs, back pairs first: three tapered glass segments each, diamond joints
  for (let k = 3; k >= 0; k--) for (const s of [-1, 1]) {
    const root = [cx + s * 20, cy + 40], j1 = [cx + s * (120 + k * 30), cy - 110 - (3 - k) * 30], j2 = [cx + s * (260 + k * 66), cy - 170 + k * 70], ft = [cx + s * (300 + k * 80), gy - 10];
    const w = 12 - k * 1.5;
    for (const [a, b, wa, wb] of [[root, j1, w, w * 0.8], [j1, j2, w * 0.8, w * 0.6], [j2, ft, w * 0.6, 2]]) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      const p = poly([[a[0] + nx * wa, a[1] + ny * wa], [b[0] + nx * wb, b[1] + ny * wb], [b[0] - nx * wb, b[1] - ny * wb], [a[0] - nx * wa, a[1] - ny * wa]]);
      fillP(f, p, lin(f, a[0] + nx * wa, a[1] + ny * wa, a[0] - nx * wa, a[1] - ny * wa, [[0, 'rgba(120,220,235,0.85)'], [0.5, 'rgba(14,40,52,0.92)'], [1, 'rgba(4,12,18,0.95)']]), rgbaJ(col, 0.6), 1.5);
    }
    for (const j of [j1, j2]) fillP(f, poly([[j[0], j[1] - 9], [j[0] + 6, j[1]], [j[0], j[1] + 9], [j[0] - 6, j[1]]]), '#dffaff');
  }
  yield;
  // the carapace: a smooth oval with five even ribs and one clean crack
  const body = new Path2D(); body.ellipse(cx, cy + 40, 115, 80, 0, 0, TAU);
  fillP(f, body, lin(f, cx - 115, cy - 40, cx + 115, cy + 120, [[0, '#1a3a44'], [1, '#040c10']]), rgbaJ(col, 0.6), 2);
  f.save(); f.clip(body);
  for (let i = -2; i <= 2; i++) { f.strokeStyle = rgbaJ(col, 0.35); f.lineWidth = 2; f.beginPath(); f.moveTo(cx + i * 36, cy - 40); f.quadraticCurveTo(cx + i * 46, cy + 40, cx + i * 30, cy + 120); f.stroke(); }
  f.restore();
  line(f, [[cx + 40, cy - 30], [cx + 54, cy + 6], [cx + 44, cy + 22]], rgbaJ('#dffaff', 0.7), 1.5);
  // the slender torso and head
  fillP(f, poly(sym(cx, [[cx - 22, cy - 212], [cx - 34, cy - 160], [cx - 40, cy - 40]])), lin(f, cx - 40, 0, cx + 40, 0, [[0, '#1e4450'], [1, '#08161c']]), 'rgba(0,0,0,0.6)', 2);
  f.fillStyle = '#0a141a'; f.beginPath(); f.ellipse(cx, cy - 240, 28, 34, 0, 0, TAU); f.fill();
  // the veil: one translucent bell from the crown to the waist, five even folds, a lit hem
  const veil = new Path2D(); veil.moveTo(cx - 30, cy - 274); veil.quadraticCurveTo(cx - 74, cy - 180, cx - 72, cy - 60); veil.quadraticCurveTo(cx, cy - 44, cx + 72, cy - 60); veil.quadraticCurveTo(cx + 74, cy - 180, cx + 30, cy - 274); veil.quadraticCurveTo(cx, cy - 284, cx - 30, cy - 274); veil.closePath();
  fillP(f, veil, lin(f, 0, cy - 280, 0, cy - 50, [[0, 'rgba(200,244,255,0.34)'], [1, 'rgba(200,244,255,0.08)']]));
  for (let i = -2; i <= 2; i++) line(f, [[cx + i * 10, cy - 270], [cx + i * 26, cy - 56]], 'rgba(220,250,255,0.16)', 1.5);
  f.strokeStyle = rgbaJ(col, 0.6); f.lineWidth = 2; f.beginPath(); f.moveTo(cx - 72, cy - 60); f.quadraticCurveTo(cx, cy - 44, cx + 72, cy - 60); f.stroke();
  // the crown: seven shards, tallest in the middle
  for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.24, h = 42 - Math.abs(k - 3) * 8, bx = cx + Math.cos(a) * 30, by = cy - 262 + Math.sin(a) * 12; fillP(f, poly([[bx - 5, by], [bx + Math.cos(a) * h * 0.4, by - h], [bx + 5, by]]), rgbaJ(col, 0.9)); }
  glow(f, cx, cy - 245, 50, col, 0.5);
  yield;
  // a ring of fourteen shards around her, each a clean kite turned along the ring
  for (let k = 0; k < 14; k++) {
    const a = k / 14 * TAU, x = cx + Math.cos(a) * 470, y = cy - 80 + Math.sin(a) * 260, s = 10 + (k % 3) * 5;
    f.save(); f.translate(Rn(x), Rn(y)); f.rotate(a + Math.PI / 2);
    fillP(f, poly([[0, -s * 1.6], [s * 0.6, 0], [0, s], [-s * 0.6, 0]]), 'rgba(12,42,52,0.9)', rgbaJ(col, 0.7), 1.5);
    f.restore();
  }
};
const W2 = function* (g, f, R, col) {     // the Unmade Heart: three rings of torn stone orbiting a burning core
  backdrop(g, FW, FH, '#0a0614', '#2a1a44', col); yield;
  const cx = 600, cy = 430;
  // sixteen even rays from the core
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, d = i % 2 ? 230 : 310; f.strokeStyle = rgbaJ(i % 2 ? col : '#ffffff', 0.22); f.lineWidth = 1.5; f.beginPath(); f.moveTo(cx, cy); f.quadraticCurveTo(Rn(cx + Math.cos(a + 0.3) * d * 0.5), Rn(cy + Math.sin(a + 0.3) * d * 0.5), Rn(cx + Math.cos(a) * d), Rn(cy + Math.sin(a) * d)); f.stroke(); }
  // the orbits, as clean ellipses, and the stones on them sorted back to front
  const rings = [[330, 110, -0.22, 18, 26], [260, 90, 0.3, 14, 22], [200, 70, -0.05, 10, 18]], stones = [];
  for (const [rx, ry, tilt, n, sz] of rings) {
    f.save(); f.translate(cx, cy); f.rotate(tilt); f.strokeStyle = rgbaJ(col, 0.22); f.lineWidth = 1.5; f.beginPath(); f.ellipse(0, 0, rx, ry, 0, 0, TAU); f.stroke(); f.restore();
    for (let i = 0; i < n; i++) {
      const th = i / n * TAU, ex = Math.cos(th) * rx, ey = Math.sin(th) * ry, z = Math.sin(th);
      stones.push([cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), cy + ex * Math.sin(tilt) + ey * Math.cos(tilt), z, sz * (0.78 + 0.22 * z), th * 0.5 + tilt]);
    }
  }
  stones.sort((a, b) => a[2] - b[2]);
  const drawStone = ([x, y, z, s, r]) => {
    f.save(); f.translate(Rn(x), Rn(y)); f.rotate(r);
    const body = poly([[-s, -s * 0.8], [-s * 0.8, -s], [s * 0.8, -s], [s, -s * 0.8], [s, s * 0.8], [s * 0.8, s], [-s * 0.8, s], [-s, s * 0.8]]);
    fillP(f, body, lin(f, -s, -s, s, s, [[0, mixHex('#3a3030', '#000000', (1 - z) * 0.25)], [1, mixHex('#140e10', '#000000', (1 - z) * 0.3)]]), rgbaJ(col, 0.2 + (z + 1) * 0.22), 1.5);
    fillP(f, poly([[-s * 0.8, -s], [s * 0.8, -s], [s, -s * 0.8], [s, -s * 0.4], [-s, -s * 0.4], [-s, -s * 0.8]]), mixHex('#3a4a2a', '#000000', (1 - z) * 0.3));
    f.restore();
  };
  let n = 0;
  for (const st of stones) { if (st[2] >= 0) break; drawStone(st); n++; }
  yield;
  glow(f, cx, cy, 260, col, 0.55); glow(f, cx, cy, 90, '#ffffff', 0.85);
  for (const st of stones.slice(n)) drawStone(st);
};
const W3 = function* (g, f, R, col) {     // the Pyre Knight: plate cracked through with fire, a greatsword before him
  backdrop(g, FW, FH, '#120604', '#4a1608', col); yield;
  const cx = 600, gy = 840, metal = '#3a2e2e', lit = '#ffd2a8';
  // three soft columns of smoke behind
  for (const [dx, w] of [[-190, 120], [0, 170], [190, 120]]) {
    f.save(); f.translate(cx + dx, 420); f.scale(1, 3);
    const gr = f.createRadialGradient(0, 0, 0, 0, 0, w); gr.addColorStop(0, 'rgba(20,10,10,0.5)'); gr.addColorStop(1, 'rgba(20,10,10,0)');
    f.fillStyle = gr; f.beginPath(); f.arc(0, 0, w, 0, TAU); f.fill(); f.restore();
  }
  cloak(f, cx, 300, gy - 10, 260, 440, '#1e0e0c', 3);
  knight(f, cx, 290, gy, metal, lit); yield;
  // five molten cracks with explicit, mirrored-ish courses: a hot core line inside a glowing line
  const cracks = [[[-70, 330], [-58, 370], [-72, 410], [-56, 452]], [[64, 340], [52, 384], [68, 420]], [[-30, 480], [-16, 520], [-28, 556]], [[34, 470], [20, 508], [36, 548], [24, 584]], [[-60, 640], [-48, 690], [-64, 740]]];
  f.save(); f.globalCompositeOperation = 'lighter';
  for (const c of cracks) { const pts = c.map(([dx, y]) => [cx + dx, y]); line(f, pts, rgbaJ(col, 0.75), 4); line(f, pts, '#fff0c0', 1.5); for (const [x, y] of pts) glow(f, x, y, 16, col, 0.22); }
  f.restore(); yield;
  // the crowned helm: seven points, alternating heights
  helm(f, cx, 160, 62, 110, '#2a2020', col, lit);
  [30, 42, 30, 54, 30, 42, 30].forEach((h, k) => { const x = cx - 54 + k * 18; fillP(f, poly([[x - 7, 168], [x, 168 - h], [x + 7, 168]]), lin(f, x, 168, x, 168 - h, [[0, '#2a2020'], [1, '#5a3a30']]), 'rgba(0,0,0,0.6)', 2); });
  // the greatsword, point down on the centre line, its edges glowing
  const bx = cx;
  const blade = poly(sym(bx, [[bx, gy + 10], [bx - 16, gy - 20], [bx - 22, 360]]).reverse());
  fillP(f, blade, lin(f, bx - 22, 0, bx + 22, 0, [[0, '#2a2222'], [0.5, '#3a2e2e'], [1, '#141010']]));
  f.save(); f.globalCompositeOperation = 'lighter'; f.lineJoin = 'round'; f.strokeStyle = rgbaJ(col, 0.75); f.lineWidth = 3; f.stroke(blade); glow(f, bx, 620, 120, col, 0.25); f.restore();
  fillP(f, poly([[bx - 70, 342], [bx + 70, 342], [bx + 70, 362], [bx - 70, 362]]), '#140e0e', 'rgba(0,0,0,0.7)', 2);
  fillP(f, poly([[bx - 10, 270], [bx + 10, 270], [bx + 10, 342], [bx - 10, 342]]), '#241818');
  // both hands on the pommel
  for (const s of [-1, 1]) { limb(f, [cx + s * 140, 330], [cx + s * 80, 350], 22, 18, metal); limb(f, [cx + s * 80, 350], [bx + s * 14, 300], 18, 15, metal); }
};
const W4 = function* (g, f, R, col) {     // the Still Queen: a crown of ice spires, a gown that freezes into the ground
  backdrop(g, FW, FH, '#0c1420', '#4a6070', col); yield;
  const cx = 600, gy = 840, hemY = gy - 40;
  // the gown: one smooth bell, six even folds converging at the waist
  const gown = new Path2D(); gown.moveTo(cx - 44, 300); gown.bezierCurveTo(cx - 60, 480, cx - 170, 640, cx - 210, hemY); gown.quadraticCurveTo(cx, hemY + 20, cx + 210, hemY); gown.bezierCurveTo(cx + 170, 640, cx + 60, 480, cx + 44, 300); gown.closePath();
  fillP(f, gown, lin(f, cx - 210, 0, cx + 210, 0, [[0, '#3a4c5c'], [0.45, '#22303c'], [1, '#0e161e']]), 'rgba(0,0,0,0.5)', 2);
  f.save(); f.clip(gown);
  for (let i = 0; i < 6; i++) { const u = (i + 0.5) / 6 - 0.5; line(f, [[cx + u * 70, 304], [cx + u * 400, hemY + 10]], i % 2 ? 'rgba(0,0,0,0.25)' : 'rgba(200,230,245,0.14)', 3); }
  f.restore();
  yield;
  // the ice: seventeen spires in a fan along the hem, tallest at the sides, each with one lit edge
  for (let i = -8; i <= 8; i++) {
    const x = cx + i * 32, base = hemY + 10 - Math.abs(i) * 2, h = 30 + Math.abs(i) * 9, w = 9;
    fillP(f, poly([[x - w, base], [x + i * 1.5, base - h], [x + w, base]]), lin(f, x, base, x, base - h, [[0, 'rgba(120,170,200,0.9)'], [1, 'rgba(232,246,255,0.95)']]), 'rgba(0,0,0,0.35)', 1.5);
    line(f, [[x - w * 0.4, base], [x + i * 1.5, base - h * 0.9]], 'rgba(255,255,255,0.5)', 1.5);
  }
  // the bodice: a symmetric shape with four even plates, arms folded across it
  const bod = poly(sym(cx, [[cx - 26, 160], [cx - 40, 190], [cx - 44, 300]]));
  fillP(f, bod, lin(f, cx - 44, 0, cx + 44, 0, [[0, '#3a4a58'], [1, '#141c24']]), 'rgba(0,0,0,0.6)', 2);
  f.save(); f.clip(bod);
  for (let r = 0; r < 4; r++) { const y = 196 + r * 26; line(f, [[cx - 50, y], [cx, y + 8], [cx + 50, y]], 'rgba(0,0,0,0.45)', 2); line(f, [[cx - 50, y + 2], [cx, y + 10], [cx + 50, y + 2]], rgbaJ(col, 0.22), 1.5); }
  f.restore();
  for (const s of [-1, 1]) { limb(f, [cx + s * 40, 192], [cx + s * 54, 258], 10, 9, '#1e2a36'); limb(f, [cx + s * 54, 258], [cx - s * 4, 286], 9, 8, '#1e2a36'); }
  // the face, hidden by a frozen veil, and the crown of thirteen spires
  f.fillStyle = '#e8f2f8'; f.beginPath(); f.ellipse(cx, 130, 24, 30, 0, 0, TAU); f.fill();
  const veil = poly([[cx - 28, 108], [cx + 28, 108], [cx + 36, 176], [cx, 186], [cx - 36, 176]]);
  fillP(f, veil, lin(f, 0, 108, 0, 186, [[0, 'rgba(154,180,196,0.55)'], [1, 'rgba(154,180,196,0.15)']]));
  for (let i = -1; i <= 1; i++) line(f, [[cx + i * 10, 112], [cx + i * 16, 180]], 'rgba(255,255,255,0.3)', 1.5);
  for (let k = 0; k < 13; k++) {
    const a = -Math.PI / 2 + (k - 6) * 0.15, h = 50 + (6 - Math.abs(k - 6)) * 14, bx = cx + Math.cos(a) * 26, by = 104 + Math.sin(a) * 10;
    fillP(f, poly([[bx - 4, by], [bx + Math.cos(a) * h * 0.2, by - h], [bx + 4, by]]), 'rgba(216,240,255,0.9)');
  }
  glow(f, cx, 80, 90, col, 0.35);
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
  // a painted vista plate in assets/cine/<name>.png wins over the built one (Warden portraits are composed
  // by paintedPortrait, so they always come from the painter)
  get(name) { return (name[0] !== 'w' && IMG['cine/' + name]) || this.p.get(name); }
  ready(name) { return !!this.get(name); }
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
    this.cover(ctx, this.get('sky'), W, H, z, -u * 0.01, 0);
    this.cover(ctx, this.get('far'), W, H, z * 1.01, -u * 0.02, 0.01);
    this.cover(ctx, this.get('cath'), W, H, z * 1.03, -u * 0.035, 0.02);
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
    this.cover(ctx, this.get('near'), W, H, z * 1.08, -u * 0.06, 0.03);
    this.embersDraw(ctx, W, H, t, '255,190,140', 0.7);
  }
  warden(ctx, W, H, i, u, t) {
    const im = this.get('w' + i), info = WARDEN_INFO[i];
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
