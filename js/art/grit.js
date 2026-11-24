// Grit: the Hollows and wardens are not clean toys. While grit is on, every limb painted by capsule() and
// hull() is multiplied by a generated grime texture (soot blotches, fibres, scratches, thousands of specks),
// and drawGrit() adds the worn details on top: bandage wraps, a cracked mask with ichor running from it,
// torn cloth that sways, riveted and scratched plates, hanging chains.
import { rgba, TAU, mix, shade } from '../core/util.js';
import { P } from '../physics/body.js';

export const GRIT = { on: false, a: 0.6 };
let tex = null;
const pats = new WeakMap();
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
// a 256 px tile of grime, made once: multiply-ready (white = untouched)
function grimeTex() {
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), R = rnd(9127);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  // soft soot blotches
  for (let i = 0; i < 70; i++) {
    const x = R() * 256, y = R() * 256, r = 6 + R() * 28;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const v = Math.floor(150 + R() * 70);
    gr.addColorStop(0, `rgba(${v - 20},${v - 28},${v - 34},${0.25 + R() * 0.3})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { g.save(); g.translate(ox, oy); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore(); }
  }
  // woven fibres and frayed threads
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = R() * 256, y = R() * 256, a = (R() < 0.5 ? 0.15 : 1.7) + (R() - 0.5) * 0.4, l = 3 + R() * 12;
    g.strokeStyle = `rgba(${70 + R() * 50},${60 + R() * 40},${55 + R() * 35},${0.08 + R() * 0.18})`; g.lineWidth = 0.4 + R() * 0.9;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // scratches and nicks
  for (let i = 0; i < 160; i++) {
    const x = R() * 256, y = R() * 256, a = R() * TAU, l = 4 + R() * 20;
    g.strokeStyle = `rgba(60,48,44,${0.15 + R() * 0.25})`; g.lineWidth = 0.5 + R() * 0.6;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.3) * l * 0.5, y + Math.sin(a + 0.3) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // specks of dirt
  for (let i = 0; i < 5000; i++) {
    const v = Math.floor(80 + R() * 120);
    g.fillStyle = `rgba(${v},${v - 10},${v - 16},${0.08 + R() * 0.3})`;
    g.fillRect(R() * 256, R() * 256, 0.6 + R() * 1.4, 0.6 + R() * 1.4);
  }
  tex = c; return c;
}
export function gritFill(g) {
  if (!GRIT.on) return;
  let p = pats.get(g);
  if (!p) { p = g.createPattern(grimeTex(), 'repeat'); if (p && p.setTransform) p.setTransform(new DOMMatrix().scale(0.5)); pats.set(g, p); }
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = GRIT.a; g.fillStyle = p; g.fill(); g.restore();
}
export function setGrit(on, a = 0.6) { GRIT.on = on; GRIT.a = a; }

// ---------------------------------------------------------------- details over the body
export function drawGrit(g, b, look, a, t = 0) {
  const s = b.s, f = b.facing, X = i => b.ipx(i, a), Y = i => b.ipy(i, a);
  const kind = look.grit;
  const R = rnd((look.seed || 7) * 131);
  // bandage wraps around limbs: bands across the limb, slightly curved, lighter edge
  const wraps = (i0, i1, r, n, col) => {
    const ax = X(i0), ay = Y(i0), bx = X(i1), by = Y(i1), dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let k = 0; k < n; k++) {
      const u = 0.18 + (k / n) * 0.7 + (R() - 0.5) * 0.06, cx = ax + dx * u, cy = ay + dy * u, sk = (R() - 0.5) * 0.5;
      g.strokeStyle = col; g.lineWidth = (1.6 + R() * 1.2) * s;
      g.beginPath(); g.moveTo(cx + nx * r + dx / L * sk * r, cy + ny * r + dy / L * sk * r); g.quadraticCurveTo(cx + dx / L * 1.5 * s, cy + dy / L * 1.5 * s, cx - nx * r - dx / L * sk * r, cy - ny * r - dy / L * sk * r); g.stroke();
      g.strokeStyle = rgba('#a89a88', 0.25); g.lineWidth = 0.6 * s;
      g.beginPath(); g.moveTo(cx + nx * r, cy + ny * r - 0.8 * s); g.lineTo(cx - nx * r, cy - ny * r - 0.8 * s); g.stroke();
    }
  };
  // torn cloth strips hanging from a point, swaying; each ends in a ragged tear
  const tatters = (x, y, n, len, w, col, sway) => {
    for (let k = 0; k < n; k++) {
      const ox = (k - (n - 1) / 2) * w * 0.8, L = len * (0.6 + R() * 0.6), ph = R() * TAU;
      const sw = Math.sin(t * 2.2 + ph) * sway * s - f * 1.5 * s;
      g.fillStyle = shade(col, (R() - 0.5) * 0.2);
      g.beginPath(); g.moveTo(x + ox - w / 2, y);
      g.quadraticCurveTo(x + ox - w / 2 + sw * 0.5, y + L * 0.5, x + ox - w * 0.3 + sw, y + L);
      for (let j = 0; j < 4; j++) g.lineTo(x + ox - w * 0.3 + sw + (j + 0.5) * w * 0.15, y + L - (j % 2 ? 0 : 2.5 * s) - R() * 2 * s);
      g.quadraticCurveTo(x + ox + w / 2 + sw * 0.5, y + L * 0.5, x + ox + w / 2, y);
      g.closePath(); g.fill();
    }
  };
  // an armour plate: bevelled polygon, a lit edge, scratches and rivets
  const plate = (pts, col) => {
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const gr = g.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    gr.addColorStop(0, shade(col, 0.12)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, -0.35));
    g.fillStyle = gr; g.fill(); gritFill(g);
    g.strokeStyle = rgba('#1a1618', 0.6); g.lineWidth = 0.9 * s; g.stroke();
    g.strokeStyle = rgba('#d8cbb8', 0.25); g.lineWidth = 0.7 * s; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.stroke();
    const cx = xs.reduce((p, v) => p + v, 0) / xs.length, cy = ys.reduce((p, v) => p + v, 0) / ys.length;
    for (let k = 0; k < 4; k++) { g.strokeStyle = rgba('#efe4d0', 0.18 + R() * 0.12); g.lineWidth = 0.5 * s; const sx = cx + (R() - 0.5) * 8 * s, sy = cy + (R() - 0.5) * 6 * s; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (R() - 0.5) * 7 * s, sy + (R() - 0.5) * 3 * s); g.stroke(); }
    for (const [x, y] of pts.slice(0, 3)) { g.fillStyle = '#2a2428'; g.beginPath(); g.arc(x + (cx - x) * 0.25, y + (cy - y) * 0.25, 0.9 * s, 0, TAU); g.fill(); g.fillStyle = rgba('#d8cbb8', 0.4); g.beginPath(); g.arc(x + (cx - x) * 0.25 - 0.3 * s, y + (cy - y) * 0.25 - 0.3 * s, 0.4 * s, 0, TAU); g.fill(); }
  };
  const chain = (x, y, n, sway) => {
    let px = x, py = y;
    for (let k = 0; k < n; k++) {
      const ang = Math.PI / 2 + Math.sin(t * 2 + k * 0.6) * sway * 0.15;
      const nx2 = px + Math.cos(ang) * 3.2 * s, ny2 = py + Math.sin(ang) * 3.2 * s;
      g.strokeStyle = k % 2 ? '#6a6268' : '#8a8288'; g.lineWidth = 1.1 * s;
      g.beginPath(); g.ellipse((px + nx2) / 2, (py + ny2) / 2, k % 2 ? 0.9 * s : 2.2 * s, 2.0 * s, ang, 0, TAU); g.stroke();
      px = nx2; py = ny2;
    }
  };
  const hx = X(P.HEAD), hy = Y(P.HEAD);
  if (kind === 'husk' || kind === 'warden') {
    const band = '#4a4038';
    wraps(P.ELB_B, P.HAND_B, 3 * s, 3, band); wraps(P.CHEST, P.ELB_F, 3.4 * s, 2, band); wraps(P.ELB_F, P.HAND_F, 3 * s, 3, band);
    wraps(P.KNEE_B, P.FOOT_B, 3.2 * s, 3, band); wraps(P.KNEE_F, P.FOOT_F, 3.2 * s, 3, band); wraps(P.PELVIS, P.KNEE_F, 3.8 * s, 2, band);
    // torn cloth from the belt and the shoulders
    tatters(X(P.PELVIS), Y(P.PELVIS) - 2 * s, 5, 16 * s, 4 * s, look.cloakLong || '#33303a', 2.2);
    tatters(X(P.CHEST) - f * 3 * s, Y(P.CHEST) - 2 * s, 3, 12 * s, 3.4 * s, look.cape ? look.cape.col : '#3b3640', 1.6);
    // the mask: hairline cracks and ichor running down from them
    g.strokeStyle = rgba('#1a1214', 0.75); g.lineWidth = 0.7 * s;
    for (let k = 0; k < 3; k++) { let x = hx + f * (2 + R() * 3) * s, y = hy - (3 + R() * 4) * s; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (R() - 0.3) * 2.6 * s * f; y += (1 + R() * 2) * s; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = rgba('#120a0e', 0.7);
    const dx = hx + f * 3 * s, dy = hy + 1 * s;
    g.beginPath(); g.moveTo(dx - 0.8 * s, dy); g.quadraticCurveTo(dx - 1.2 * s, dy + 6 * s, dx, dy + 9 * s + Math.sin(t * 1.3) * s); g.quadraticCurveTo(dx + 1.2 * s, dy + 6 * s, dx + 0.8 * s, dy); g.fill();
  }
  if (kind === 'brute' || kind === 'warden') {
    const ax = X(P.CHEST), ay = Y(P.CHEST), px = X(P.PELVIS), py = Y(P.PELVIS);
    const tx = ax - px, ty = ay - py, L = Math.hypot(tx, ty) || 1, nx = -ty / L * f, ny = tx / L * f;
    const ux = tx / L, uy = ty / L, mid = (k) => [px + tx * k, py + ty * k];
    // chest plate in three overlapping bands
    for (let k = 0; k < 3; k++) {
      const [cx, cy] = mid(0.45 + k * 0.2), w = (9 - k) * s, h = 4.2 * s;
      plate([[cx - nx * w + ux * h, cy - ny * w + uy * h], [cx + nx * w + ux * h, cy + ny * w + uy * h], [cx + nx * (w - 1.5 * s) - ux * h, cy + ny * (w - 1.5 * s) - uy * h], [cx - nx * (w - 1.5 * s) - ux * h, cy - ny * (w - 1.5 * s) - uy * h]], look.plateCol || '#5a5258');
    }
    // a heavy pauldron on the near shoulder
    const sx = X(P.ELB_F) * 0.3 + ax * 0.7, sy = Y(P.ELB_F) * 0.3 + ay * 0.7;
    plate([[sx - 7 * s, sy - 4 * s], [sx + 7 * s, sy - 5 * s], [sx + 8 * s, sy + 4 * s], [sx, sy + 7 * s], [sx - 8 * s, sy + 3 * s]], look.plateCol || '#5a5258');
    // chains from the belt
    chain(px - f * 4 * s, py + 1 * s, 7, 1); chain(px + f * 5 * s, py + 2 * s, 5, 1.3);
    wraps(P.ELB_F, P.HAND_F, 3.6 * s, 3, '#5a4436'); wraps(P.ELB_B, P.HAND_B, 3.6 * s, 3, '#5a4436');
  }
}
