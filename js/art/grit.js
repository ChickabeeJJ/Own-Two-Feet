// Gear for the Hollows and wardens, drawn from clean geometry: every shape is a closed path built from the
// skeleton's own proportions (shoulder width, torso length, head radius), integer-snapped, one stroke
// width, round joins. No textures, no random marks: a clean mask with one crack, a smooth hood edge, a
// belt, a cloak with a few clean notches, a breastplate and pauldron with a single lit edge, horns as
// smooth tapered curves, a few even chain links.
import { P } from '../physics/body.js';
import { shade, rgba } from '../core/util.js';

// kept for callers: the old texture pass is gone, so grit never paints noise
export const GRIT = { on: false, a: 0 };
export function gritFill() {}
export function setGrit() {}

const R = Math.round;
function path(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(R(x), R(y)) : g.moveTo(R(x), R(y)))); g.closePath(); }
// a filled shape with a soft two-stop ramp and one lit edge (from pts[a] to pts[b])
function plate(g, pts, col, lit, edge = [0, 1], w = 1) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, shade(col, 0.1)); gr.addColorStop(1, shade(col, -0.32));
  path(g, pts); g.fillStyle = gr; g.fill();
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.lineWidth = w; g.strokeStyle = rgba('#0c0a0e', 0.55); g.stroke();
  const [a, b] = edge;
  g.strokeStyle = rgba(lit, 0.45); g.lineWidth = w;
  g.beginPath(); g.moveTo(R(pts[a][0]), R(pts[a][1])); g.lineTo(R(pts[b][0]), R(pts[b][1])); g.stroke();
}

export function drawGrit(g, b, look, a, t = 0) {
  const s = b.s, f = b.facing, X = i => b.ipx(i, a), Y = i => b.ipy(i, a);
  const kind = look.grit, lit = look.rimGear || '#d8cbb8', w = Math.max(1, R(1.2 * s));
  // the torso frame: chest and pelvis, the axis between them and its normal
  const cx = X(P.CHEST), cy = Y(P.CHEST), px = X(P.PELVIS), py = Y(P.PELVIS), hx = X(P.HEAD), hy = Y(P.HEAD);
  const tx = cx - px, ty = cy - py, L = Math.hypot(tx, ty) || 1, ux = tx / L, uy = ty / L, nx = -uy, ny = ux;
  const at = (k, side) => [px + tx * k + nx * side * f, py + ty * k + ny * side * f];
  g.save();
  if (kind === 'husk' || kind === 'warden') {
    // belt: one clean band across the hips
    const bw = 8 * s, bh = 2.2 * s;
    plate(g, [at(0.12, -bw), at(0.12, bw), at(0.12 - bh / L, bw), at(0.12 - bh / L, -bw)], look.beltGear || '#3a2e28', lit, [0, 1], w);
    // a short cloth tabard: straight sides, one shallow centre split in the hem
    const sk = 8 * s, len = 10 * s, hem = (side, back = 0) => [px - ux * (len - back) + nx * side * f, py - uy * (len - back) + ny * side * f];
    plate(g, [at(0.1, -sk), at(0.1, sk), hem(sk * 1.1), hem(sk * 0.18), hem(0, 3.5 * s), hem(-sk * 0.18), hem(-sk * 1.1)], look.cloakLong || '#302b2c', lit, [0, 1], w);
  }
  if (kind === 'brute' || kind === 'warden') {
    const pc = look.plateCol || '#4e484c';
    // breastplate: a shield shape on the chest with a central ridge
    const cw = 9.5 * s;
    plate(g, [at(0.95, -cw), at(0.95, cw), at(0.55, cw * 0.86), at(0.32, 0), at(0.55, -cw * 0.86)], pc, lit, [0, 1], w);
    g.strokeStyle = rgba(lit, 0.3); g.lineWidth = w; g.beginPath();
    const r0 = at(0.92, 0), r1 = at(0.36, 0); g.moveTo(R(r0[0]), R(r0[1])); g.lineTo(R(r1[0]), R(r1[1])); g.stroke();
    // a pauldron on the near shoulder: a lens shape with one lit edge
    const sx = cx * 0.7 + X(P.ELB_F) * 0.3, sy = cy * 0.7 + Y(P.ELB_F) * 0.3, pw = 8 * s;
    plate(g, [[sx - pw, sy - 1 * s], [sx - pw * 0.4, sy - 5 * s], [sx + pw * 0.4, sy - 5 * s], [sx + pw, sy - 1 * s], [sx + pw * 0.5, sy + 4 * s], [sx - pw * 0.5, sy + 4 * s]], pc, lit, [1, 2], w);
    // three even chain links from the belt
    g.lineWidth = Math.max(1, R(1.3 * s)); g.strokeStyle = '#7a7278';
    const [lx, ly] = at(0.08, 5 * s);
    for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(R(lx), R(ly + 2 * s + k * 4 * s), R(1.6 * s), R(2.2 * s), 0, 0, Math.PI * 2); g.closePath(); g.stroke(); }
  }
  g.restore();
}
