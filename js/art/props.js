// Props, item icons, interface icons and effect frames. Same rules as the characters: shaded forms,
// key light from the upper left, warm emissive accents, no outlines. All functions draw with the base
// of the object at (x, y) unless noted.
import { capsule, ballShade, softDisc, hull, stitches, shade, mix, rgba, rng, TAU, LIGHT } from './paint.js';
import { pattern, texture } from './tex.js';
import { TILES, T } from '../world/tiles.js';

function flame(g, x, y, s, t, k = 1) {
  const fl = Math.sin(t * 11) * 0.08 + Math.sin(t * 23) * 0.05;
  const layers = [['#ff6a2a', 1], ['#ffb347', 0.72], ['#fff1c0', 0.42]];
  g.save(); g.globalCompositeOperation = 'lighter';
  softDisc(g, x, y - 10 * s, 46 * s * k, '#ff9a4a', 0.35);
  for (const [col, w] of layers) {
    const h = 30 * s * k * w * (1 + fl), wd = 11 * s * k * w;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x - wd, y);
    g.bezierCurveTo(x - wd * 1.1, y - h * 0.45, x - wd * 0.2 + Math.sin(t * 7) * 2 * s, y - h * 0.7, x + Math.sin(t * 9) * 3 * s, y - h);
    g.bezierCurveTo(x + wd * 0.4, y - h * 0.65, x + wd * 1.15, y - h * 0.4, x + wd, y);
    g.closePath(); g.fill();
  }
  g.restore();
}
function stoneRing(g, x, y, s, n = 6, w = 24) {
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const sx = x - w * s + u * 2 * w * s, sy = y - 2 * s - Math.sin(u * Math.PI) * 2 * s;
    ballShade(g, sx, sy, (4.5 + (i % 3)) * s, '#6a6268', { dark: 0.5, hi: 0.2 });
  }
}

export function drawCampfire(g, x, y, s = 1, t = 0) {
  g.save();
  softDisc(g, x, y, 34 * s, '#000000', 0.35);
  capsule(g, x - 18 * s, y - 2 * s, x + 14 * s, y - 9 * s, 3.6 * s, 3.2 * s, '#5a4232', { dark: 0.5, hi: 0.15 });
  capsule(g, x + 18 * s, y - 2 * s, x - 13 * s, y - 10 * s, 3.6 * s, 3.2 * s, '#4e392b', { dark: 0.5, hi: 0.15 });
  g.fillStyle = '#ffb347'; g.beginPath(); g.ellipse(x, y - 5 * s, 7 * s, 2 * s, 0, 0, TAU); g.fill();
  stoneRing(g, x, y, s, 7, 26);
  flame(g, x, y - 6 * s, s, t);
  g.restore();
}

export function drawShrine(g, x, y, s = 1, t = 0, lit = true) {
  g.save();
  softDisc(g, x, y, 80 * s, '#000000', 0.35);
  // two banner poles
  for (const sd of [-1, 1]) {
    const px = x + sd * 46 * s;
    capsule(g, px, y, px, y - 92 * s, 2.2 * s, 1.8 * s, '#4a3a33', { dark: 0.5, hi: 0.2 });
    ballShade(g, px, y - 94 * s, 3.2 * s, '#c9a45c', { dark: 0.4 });
    // hanging cloth, swaying
    const sw = Math.sin(t * 1.3 + sd) * 3 * s;
    const bx = px - sd * 2 * s;
    const gr = g.createLinearGradient(bx - 9 * s, 0, bx + 9 * s, 0);
    gr.addColorStop(0, '#7a2a26'); gr.addColorStop(0.5, '#c8473d'); gr.addColorStop(1, '#8a302a');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(bx - 9 * s, y - 88 * s); g.lineTo(bx + 9 * s, y - 88 * s);
    g.quadraticCurveTo(bx + 10 * s + sw, y - 60 * s, bx + 8 * s + sw * 1.6, y - 38 * s);
    g.lineTo(bx + sw * 1.8, y - 44 * s); g.lineTo(bx - 8 * s + sw * 1.6, y - 38 * s);
    g.quadraticCurveTo(bx - 10 * s + sw, y - 60 * s, bx - 9 * s, y - 88 * s); g.fill();
    g.strokeStyle = rgba('#f2c86a', 0.8); g.lineWidth = 1.2 * s;
    g.beginPath(); g.arc(bx + sw * 0.6, y - 70 * s, 4 * s, 0, TAU); g.moveTo(bx + sw * 0.6, y - 78 * s); g.lineTo(bx + sw * 0.8, y - 62 * s); g.stroke();
  }
  // carved plinth
  const pw = 34 * s, ph = 26 * s;
  g.fillStyle = pattern(g, 'ruin', '#a39d93');
  g.beginPath(); g.roundRect(x - pw, y - ph, pw * 2, ph, [6 * s, 6 * s, 2 * s, 2 * s]); g.fill();
  const sh = g.createLinearGradient(x - pw, 0, x + pw, 0);
  sh.addColorStop(0, rgba('#ffffff', 0.12)); sh.addColorStop(0.5, rgba('#000000', 0)); sh.addColorStop(1, rgba('#000000', 0.35));
  g.fillStyle = sh; g.beginPath(); g.roundRect(x - pw, y - ph, pw * 2, ph, [6 * s, 6 * s, 2 * s, 2 * s]); g.fill();
  g.fillStyle = shade('#a39d93', 0.12); g.beginPath(); g.roundRect(x - pw - 4 * s, y - ph - 6 * s, pw * 2 + 8 * s, 7 * s, 3 * s); g.fill();
  // glowing glyph of the thread
  g.save(); g.globalCompositeOperation = 'lighter';
  const pul = lit ? 0.6 + Math.sin(t * 2) * 0.2 : 0.15;
  softDisc(g, x, y - ph * 0.5, 24 * s, '#9ff3ff', 0.35 * pul);
  g.strokeStyle = rgba('#bff6ff', 0.85 * pul); g.lineWidth = 1.6 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y - ph + 5 * s); g.lineTo(x, y - 5 * s); g.moveTo(x - 6 * s, y - ph * 0.5 - 4 * s); g.quadraticCurveTo(x, y - ph * 0.5 + 6 * s, x + 6 * s, y - ph * 0.5 - 4 * s); g.stroke();
  g.restore();
  // candles
  for (const cx of [-22, -14, 18]) {
    const hgt = (8 + Math.abs(cx) % 5) * s;
    const bx = x + cx * s, by = y - ph - 6 * s;
    g.fillStyle = '#efe6d2'; g.beginPath(); g.roundRect(bx - 2 * s, by - hgt, 4 * s, hgt, 1.5 * s); g.fill();
    g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, bx, by - hgt - 3 * s, 10 * s, '#ffcf80', 0.6);
    g.fillStyle = '#fff1c0'; g.beginPath(); g.ellipse(bx, by - hgt - 3 * s + Math.sin(t * 9 + cx) * 0.4 * s, 1.4 * s, 3 * s, 0, 0, TAU); g.fill(); g.restore();
  }
  g.restore();
}

export function drawBladeStone(g, x, y, s = 1, t = 0, withBlade = true) {
  g.save();
  // beam of light from above
  g.save(); g.globalCompositeOperation = 'lighter';
  const bm = g.createLinearGradient(0, y - 260 * s, 0, y);
  bm.addColorStop(0, rgba('#bff6ff', 0)); bm.addColorStop(1, rgba('#bff6ff', withBlade ? 0.22 : 0.05));
  g.fillStyle = bm; g.beginPath(); g.moveTo(x - 10 * s, y - 260 * s); g.lineTo(x + 10 * s, y - 260 * s); g.lineTo(x + 30 * s, y); g.lineTo(x - 30 * s, y); g.fill();
  g.restore();
  softDisc(g, x, y, 50 * s, '#000000', 0.3);
  // mossy boulder
  g.fillStyle = pattern(g, 'moss', '#7a7f8c', '#6f8f5a');
  g.beginPath(); g.moveTo(x - 30 * s, y); g.bezierCurveTo(x - 32 * s, y - 20 * s, x - 14 * s, y - 34 * s, x + 4 * s, y - 32 * s); g.bezierCurveTo(x + 24 * s, y - 30 * s, x + 32 * s, y - 14 * s, x + 30 * s, y); g.closePath(); g.fill();
  const sh = g.createLinearGradient(x - 30 * s, y - 34 * s, x + 30 * s, y);
  sh.addColorStop(0, rgba('#ffffff', 0.15)); sh.addColorStop(0.5, rgba('#000000', 0)); sh.addColorStop(1, rgba('#000000', 0.45));
  g.fillStyle = sh; g.fill();
  if (withBlade) {
    g.save(); g.translate(x + 2 * s, y - 26 * s); g.rotate(0.18);
    const gr = g.createLinearGradient(-3 * s, 0, 3 * s, 0);
    gr.addColorStop(0, '#9fb0c0'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#8a9bab');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-2.6 * s, 6 * s); g.quadraticCurveTo(-3.6 * s, -22 * s, 0, -44 * s); g.quadraticCurveTo(3.6 * s, -22 * s, 2.6 * s, 6 * s); g.fill();
    capsule(g, -8 * s, -45 * s, 8 * s, -45 * s, 1.8 * s, 1.8 * s, '#c9a45c', { dark: 0.45, hi: 0.3 });
    capsule(g, 0, -46 * s, 0, -60 * s, 2 * s, 1.8 * s, '#3a2c2a', { dark: 0.4 });
    ballShade(g, 0, -62 * s, 2.4 * s, '#c9a45c');
    // wrapped crimson ribbon
    g.strokeStyle = '#c8473d'; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(0, -55 * s); g.quadraticCurveTo(10 * s + Math.sin(t * 2) * 3 * s, -50 * s, 14 * s + Math.sin(t * 2) * 5 * s, -40 * s); g.stroke();
    g.restore();
    g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, x, y - 50 * s, 40 * s, '#9ff3ff', 0.25 + Math.sin(t * 2) * 0.08); g.restore();
  }
  // flowers at the foot
  for (const [fx, c] of [[-26, '#f3e6d0'], [-20, '#f0b7a6'], [24, '#d6c7f0']]) {
    g.strokeStyle = '#6f8f5a'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x + fx * s, y); g.lineTo(x + fx * s + 1 * s, y - 9 * s); g.stroke();
    g.fillStyle = c; g.beginPath(); g.arc(x + fx * s + 1 * s, y - 10 * s, 2.4 * s, 0, TAU); g.fill();
  }
  g.restore();
}

export function drawHearth(g, x, y, s = 1, t = 0) {
  g.save();
  softDisc(g, x, y, 40 * s, '#000000', 0.3);
  g.fillStyle = '#7a3f34'; g.beginPath(); g.ellipse(x, y - 1 * s, 30 * s, 4 * s, 0, 0, TAU); g.fill();
  stitches(g, [[x - 26 * s, y - 1 * s], [x + 26 * s, y - 1 * s]], rgba('#f2c86a', 0.6), 0.8 * s, 1.8 * s, 1.8 * s);
  // stone bowl on a short pedestal
  g.fillStyle = pattern(g, 'brick', '#8f8a96');
  g.beginPath(); g.roundRect(x - 8 * s, y - 14 * s, 16 * s, 14 * s, 2 * s); g.fill();
  const gr = g.createLinearGradient(x - 18 * s, 0, x + 18 * s, 0);
  gr.addColorStop(0, '#8b8590'); gr.addColorStop(0.4, '#5e5864'); gr.addColorStop(1, '#2e2a33');
  g.fillStyle = gr; g.beginPath(); g.moveTo(x - 20 * s, y - 22 * s); g.quadraticCurveTo(x - 18 * s, y - 12 * s, x, y - 12 * s); g.quadraticCurveTo(x + 18 * s, y - 12 * s, x + 20 * s, y - 22 * s); g.closePath(); g.fill();
  g.fillStyle = '#2e2a33'; g.beginPath(); g.ellipse(x, y - 22 * s, 20 * s, 4 * s, 0, 0, TAU); g.fill();
  flame(g, x, y - 22 * s, s * 0.8, t);
  g.restore();
}

export function drawLanternPost(g, x, y, s = 1, t = 0) {
  g.save();
  capsule(g, x, y, x, y - 70 * s, 2.6 * s, 2.2 * s, '#4a3a33', { dark: 0.5, hi: 0.2 });
  capsule(g, x - 2 * s, y - 66 * s, x + 16 * s, y - 66 * s, 1.8 * s, 1.8 * s, '#4a3a33', { dark: 0.5, hi: 0.2 });
  g.strokeStyle = '#2d2a30'; g.lineWidth = 1 * s; g.beginPath(); g.moveTo(x + 14 * s, y - 66 * s); g.lineTo(x + 14 * s, y - 58 * s); g.stroke();
  drawLantern(g, x + 14 * s, y - 50 * s, s, t);
  g.restore();
}
export function drawLantern(g, x, y, s = 1, t = 0) {
  g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, x, y, 40 * s, '#ffcf80', 0.32 + Math.sin(t * 7) * 0.04); g.restore();
  g.fillStyle = '#2d2a30'; g.beginPath(); g.moveTo(x - 6 * s, y - 8 * s); g.lineTo(x + 6 * s, y - 8 * s); g.lineTo(x + 3 * s, y - 11 * s); g.lineTo(x - 3 * s, y - 11 * s); g.closePath(); g.fill();
  const gr = g.createRadialGradient(x, y, 1, x, y, 9 * s);
  gr.addColorStop(0, '#fff3d8'); gr.addColorStop(0.5, '#ffcf80'); gr.addColorStop(1, '#c4793a');
  g.fillStyle = gr; g.beginPath(); g.roundRect(x - 5.5 * s, y - 8 * s, 11 * s, 14 * s, 2 * s); g.fill();
  g.strokeStyle = '#2d2a30'; g.lineWidth = 1.2 * s;
  g.beginPath(); g.moveTo(x - 5.5 * s, y - 1 * s); g.lineTo(x + 5.5 * s, y - 1 * s); g.moveTo(x, y - 8 * s); g.lineTo(x, y + 6 * s); g.stroke();
  g.fillStyle = '#2d2a30'; g.fillRect(x - 6.5 * s, y + 6 * s, 13 * s, 2.4 * s);
}

export function drawGateBanner(g, x, y, s = 1, col = '#ffb36b', t = 0) {
  g.save();
  capsule(g, x, y, x, y - 150 * s, 3 * s, 2.4 * s, '#2d2a30', { dark: 0.5, hi: 0.25 });
  capsule(g, x - 22 * s, y - 146 * s, x + 22 * s, y - 146 * s, 2 * s, 2 * s, '#2d2a30', { dark: 0.5, hi: 0.25 });
  for (const sd of [-1, 1]) ballShade(g, x + sd * 23 * s, y - 146 * s, 3 * s, '#c9a45c');
  const sw = Math.sin(t * 1.1) * 4 * s;
  const gr = g.createLinearGradient(x - 20 * s, 0, x + 20 * s, 0);
  gr.addColorStop(0, '#1c1820'); gr.addColorStop(0.5, '#3a3240'); gr.addColorStop(1, '#16131a');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(x - 20 * s, y - 144 * s); g.lineTo(x + 20 * s, y - 144 * s);
  g.quadraticCurveTo(x + 22 * s + sw, y - 90 * s, x + 20 * s + sw * 1.8, y - 44 * s);
  g.lineTo(x + 8 * s + sw * 1.8, y - 56 * s); g.lineTo(x + sw * 2, y - 40 * s); g.lineTo(x - 8 * s + sw * 1.8, y - 56 * s); g.lineTo(x - 20 * s + sw * 1.8, y - 44 * s);
  g.quadraticCurveTo(x - 22 * s + sw, y - 90 * s, x - 20 * s, y - 144 * s); g.fill();
  // the warden's sigil: a horned mask
  const mx = x + sw * 0.6, my = y - 104 * s;
  g.fillStyle = col;
  g.beginPath(); g.moveTo(mx, my - 14 * s); g.bezierCurveTo(mx + 11 * s, my - 13 * s, mx + 10 * s, my + 5 * s, mx + 2 * s, my + 12 * s); g.lineTo(mx, my + 14 * s); g.lineTo(mx - 2 * s, my + 12 * s); g.bezierCurveTo(mx - 10 * s, my + 5 * s, mx - 11 * s, my - 13 * s, mx, my - 14 * s); g.fill();
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(mx + sd * 4 * s, my - 12 * s); g.quadraticCurveTo(mx + sd * 12 * s, my - 20 * s, mx + sd * 10 * s, my - 28 * s); g.quadraticCurveTo(mx + sd * 8 * s, my - 19 * s, mx + sd * 1 * s, my - 13 * s); g.fill(); }
  g.fillStyle = '#1c1820';
  for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(mx + sd * 4 * s, my - 2 * s, 2.2 * s, 3.8 * s, sd * 0.35, 0, TAU); g.fill(); }
  g.restore();
}

export function drawSeed(g, x, y, s = 1, t = 0, crack = 0) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  softDisc(g, x, y, 90 * s, '#ffd9a0', 0.35);
  softDisc(g, x, y, 40 * s, '#ffffff', 0.5);
  // rays
  g.strokeStyle = rgba('#fff1d8', 0.5); g.lineWidth = 1.5 * s; g.lineCap = 'round';
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + t * 0.4; g.beginPath(); g.moveTo(x + Math.cos(a) * 20 * s, y + Math.sin(a) * 20 * s); g.lineTo(x + Math.cos(a) * (38 + (i % 3) * 10) * s, y + Math.sin(a) * (38 + (i % 3) * 10) * s); g.stroke(); }
  g.globalCompositeOperation = 'source-over';
  // shell
  const gr = g.createRadialGradient(x - 5 * s, y - 6 * s, 2 * s, x, y, 16 * s);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#f6e7cf'); gr.addColorStop(1, '#c9a978');
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 13 * s, 16 * s, 0, 0, TAU); g.fill();
  g.strokeStyle = rgba('#ffffff', 0.9); g.lineWidth = 1.2 * s;
  g.beginPath(); g.moveTo(x - 4 * s, y - 12 * s); g.lineTo(x + 1 * s, y - 4 * s); g.lineTo(x - 2 * s, y + 3 * s); g.lineTo(x + 4 * s, y + 10 * s); g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- items + interface
export function drawBlockIcon(g, x, y, t, size = 40) {
  const d = TILES[t];
  const k = d.k && d.k[0] === '#' ? d.k : { dirt: '#594844', stone: '#5e6476', deep: '#383b4b', log: '#6b5446', leaf: '#7da48a', moss: '#5f7a63' }[d.k] || '#888';
  const mat = { [T.DIRT]: 'soil', [T.GRASS]: 'soil', [T.STONE]: 'stone', [T.DEEP]: 'deep', [T.SAND]: 'sand', [T.SNOW]: 'snow', [T.LOG]: 'bark', [T.PLANK]: 'plank', [T.BRICK]: 'brick', [T.MARBLE]: 'marble', [T.OBSIDIAN]: 'obsidian', [T.EMBER]: 'ember', [T.ICE]: 'ice', [T.RUIN]: 'ruin', [T.MOSS]: 'moss', [T.GOLD]: 'stone', [T.CRYSTAL]: 'stone' }[t];
  const h = size * 0.5;
  g.save();
  softDisc(g, x, y + size * 0.62, size * 0.7, '#000000', 0.35);
  if (t === T.LANTERN) { drawLantern(g, x, y + 4, size / 22, 0); g.restore(); return; }
  if (t === T.HEARTH) { drawHearth(g, x, y + size * 0.55, size / 46, 1); g.restore(); return; }
  const faces = [
    { pts: [[0, -h], [size * 0.86 * 0.6, -h * 0.5], [0, 0], [-size * 0.86 * 0.6, -h * 0.5]], k: 0.12 },
    { pts: [[-size * 0.86 * 0.6, -h * 0.5], [0, 0], [0, h * 1.15], [-size * 0.86 * 0.6, h * 0.65]], k: -0.08 },
    { pts: [[0, 0], [size * 0.86 * 0.6, -h * 0.5], [size * 0.86 * 0.6, h * 0.65], [0, h * 1.15]], k: -0.3 },
  ];
  for (const f of faces) {
    g.beginPath(); f.pts.forEach((p, i) => i ? g.lineTo(x + p[0], y + p[1]) : g.moveTo(x + p[0], y + p[1])); g.closePath();
    g.save(); g.clip();
    if (mat) { g.translate(x - 64 * size / 90, y - 64 * size / 90); g.scale(size / 90, size / 90); g.drawImage(texture(mat, mat === 'ember' ? '#ff7a3a' : k, mat === 'moss' ? '#6f8f5a' : undefined), 0, 0); g.setTransform(g.getTransform()); }
    else { g.fillStyle = k; g.fillRect(x - size, y - size, size * 2, size * 2); }
    g.restore();
    g.fillStyle = f.k > 0 ? rgba('#ffffff', f.k) : rgba('#000000', -f.k);
    g.beginPath(); f.pts.forEach((p, i) => i ? g.lineTo(x + p[0], y + p[1]) : g.moveTo(x + p[0], y + p[1])); g.closePath(); g.fill();
  }
  if (t === T.GRASS) { g.fillStyle = '#9cbd8c'; g.beginPath(); faces[0].pts.forEach((p, i) => i ? g.lineTo(x + p[0], y + p[1]) : g.moveTo(x + p[0], y + p[1])); g.closePath(); g.fill(); }
  if (t === T.CRYSTAL || t === T.GOLD || t === T.EMBER) {
    const c = t === T.CRYSTAL ? '#7ef0ff' : t === T.GOLD ? '#f2c86a' : '#ff9b4a';
    g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, x, y, size * 0.6, c, 0.4); g.restore();
    if (t !== T.EMBER) for (const [cx, cy, r] of [[-6, 2, 6], [5, 6, 5], [0, -5, 4]]) { g.fillStyle = c; g.beginPath(); g.moveTo(x + cx, y + cy - r * 1.3); g.lineTo(x + cx + r * 0.7, y + cy); g.lineTo(x + cx, y + cy + r); g.lineTo(x + cx - r * 0.7, y + cy); g.closePath(); g.fill(); g.fillStyle = rgba('#ffffff', 0.7); g.beginPath(); g.moveTo(x + cx, y + cy - r * 1.3); g.lineTo(x + cx + r * 0.25, y + cy - r * 0.2); g.lineTo(x + cx, y + cy); g.fill(); }
  }
  if (t === T.GLASS) { g.fillStyle = rgba('#bfe9ff', 0.35); g.fillRect(x - size * 0.5, y - h, size, size * 1.1); g.strokeStyle = rgba('#ffffff', 0.7); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 8, y + 10); g.lineTo(x + 6, y - 8); g.stroke(); }
  g.restore();
}
export function drawVessel(g, x, y, size = 30, full = true) {
  g.save();
  const s = size / 30;
  const path = () => {
    g.beginPath();
    g.moveTo(x, y - 14 * s);
    g.bezierCurveTo(x + 12 * s, y - 14 * s, x + 13 * s, y + 2 * s, x + 3 * s, y + 13 * s);
    g.lineTo(x, y + 15 * s); g.lineTo(x - 3 * s, y + 13 * s);
    g.bezierCurveTo(x - 13 * s, y + 2 * s, x - 12 * s, y - 14 * s, x, y - 14 * s);
    g.closePath();
  };
  if (full) {
    g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, x, y, 30 * s, '#9ff3ff', 0.4); g.restore();
    path();
    const gr = g.createLinearGradient(x - 10 * s, y - 14 * s, x + 10 * s, y + 14 * s);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#dff6f8'); gr.addColorStop(1, '#8fcfd8');
    g.fillStyle = gr; g.fill();
    stitches(g, [[x, y - 12 * s], [x, y + 12 * s]], rgba('#5aa7b4', 0.8), 1 * s, 2 * s, 2 * s);
    g.fillStyle = rgba('#ffffff', 0.8); g.beginPath(); g.ellipse(x - 5 * s, y - 6 * s, 2.5 * s, 4 * s, -0.4, 0, TAU); g.fill();
  } else {
    path(); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.4 * s; g.setLineDash([2.5 * s, 2.5 * s]); g.stroke(); g.setLineDash([]);
  }
  g.restore();
}
export function drawGlimmer(g, x, y, size = 20) {
  const s = size / 20;
  g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, x, y, 26 * s, '#9ff3ff', 0.45); g.restore();
  const facets = [[[0, -12], [8, -2], [0, 0]], [[8, -2], [0, 12], [0, 0]], [[0, 12], [-8, -2], [0, 0]], [[-8, -2], [0, -12], [0, 0]]];
  const cols = ['#ffffff', '#9fe3ee', '#5fb8c8', '#d8fbff'];
  facets.forEach((f, i) => { g.fillStyle = cols[i]; g.beginPath(); f.forEach((p, j) => j ? g.lineTo(x + p[0] * s, y + p[1] * s) : g.moveTo(x + p[0] * s, y + p[1] * s)); g.closePath(); g.fill(); });
}
export function drawRelic(g, x, y, id, size = 40) {
  const s = size / 40;
  g.save();
  g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, x, y, 46 * s, '#f2c86a', 0.25); g.restore();
  const gr = g.createRadialGradient(x - 8 * s, y - 10 * s, 2, x, y, 22 * s);
  gr.addColorStop(0, '#fff1c8'); gr.addColorStop(0.5, '#d9a441'); gr.addColorStop(1, '#7a5520');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, 21 * s, 0, TAU); g.fill();
  g.fillStyle = '#1c1820'; g.beginPath(); g.arc(x, y, 16.5 * s, 0, TAU); g.fill();
  g.strokeStyle = '#bff6ff'; g.fillStyle = '#bff6ff'; g.lineWidth = 2 * s; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  if (id === 'djump') { for (const sd of [-1, 1]) { g.moveTo(x, y + 6 * s); g.quadraticCurveTo(x + sd * 4 * s, y - 6 * s, x + sd * 11 * s, y - 8 * s); g.moveTo(x + sd * 2 * s, y + 2 * s); g.quadraticCurveTo(x + sd * 7 * s, y - 2 * s, x + sd * 10 * s, y - 2 * s); } }
  else if (id === 'wall') { g.moveTo(x + 6 * s, y - 11 * s); g.lineTo(x + 6 * s, y + 11 * s); for (let i = 0; i < 4; i++) { g.moveTo(x + 4 * s, y - 7 * s + i * 4 * s); g.lineTo(x - 6 * s, y - 9 * s + i * 4.5 * s); } }
  else if (id === 'plunge') { g.moveTo(x, y - 11 * s); g.lineTo(x, y + 8 * s); g.moveTo(x - 6 * s, y + 2 * s); g.lineTo(x, y + 9 * s); g.lineTo(x + 6 * s, y + 2 * s); g.moveTo(x - 10 * s, y + 11 * s); g.lineTo(x + 10 * s, y + 11 * s); }
  else if (id === 'surge') { g.moveTo(x - 9 * s, y + 9 * s); g.bezierCurveTo(x - 8 * s, y - 2 * s, x + 2 * s, y - 2 * s, x - 1 * s, y - 12 * s); g.bezierCurveTo(x + 9 * s, y - 4 * s, x + 10 * s, y + 4 * s, x + 4 * s, y + 10 * s); }
  else { g.moveTo(x, y + 10 * s); g.bezierCurveTo(x - 14 * s, y, x - 7 * s, y - 13 * s, x, y - 5 * s); g.bezierCurveTo(x + 7 * s, y - 13 * s, x + 14 * s, y, x, y + 10 * s); }
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- effect frames (for the sheet)
export function drawSlashFrame(g, x, y, s = 1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  const r0 = 34 * s, r1 = 62 * s;
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  gr.addColorStop(0, rgba('#9ff3ff', 0)); gr.addColorStop(0.7, rgba('#9ff3ff', 0.55)); gr.addColorStop(1, rgba('#ffffff', 0.95));
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r1, -2.6, 0.5); g.arc(x + 6 * s, y + 4 * s, r0, 0.5, -2.6, true); g.closePath(); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 2 * s; g.beginPath(); g.arc(x, y, r1 - 1, -2.4, 0.4); g.stroke();
  g.restore();
}
export function drawSparkFrame(g, x, y, s = 1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  softDisc(g, x, y, 40 * s, '#ffffff', 0.5);
  g.fillStyle = '#ffffff';
  g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? 6 * s : 34 * s; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill();
  g.strokeStyle = rgba('#fff1c0', 0.9); g.lineWidth = 2 * s; g.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, r = 30 + (i % 3) * 12; g.beginPath(); g.moveTo(x + Math.cos(a) * 18 * s, y + Math.sin(a) * 18 * s); g.lineTo(x + Math.cos(a) * r * s, y + Math.sin(a) * r * s); g.stroke(); }
  g.restore();
}
export function drawWaveFrame(g, x, y, s = 1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [dx, a] of [[-40, 0.4], [0, 1], [40, 0.4]]) {
    const gr = g.createLinearGradient(0, y - 70 * s, 0, y + 20 * s);
    gr.addColorStop(0, rgba('#ffb36b', 0)); gr.addColorStop(1, rgba('#ffb36b', 0.85 * a));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x + dx * s - 16 * s, y + 20 * s); g.quadraticCurveTo(x + dx * s, y - 70 * s * a, x + dx * s + 16 * s, y + 20 * s); g.fill();
  }
  g.restore();
}
export function drawSoulFrame(g, x, y, s = 1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { const px = x - 60 * s + i * 22 * s, py = y + Math.sin(i * 0.8) * 16 * s; softDisc(g, px, py, 16 * s, '#bff6ff', 0.4); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px, py, 3.4 * s, 0, TAU); g.fill(); g.strokeStyle = rgba('#bff6ff', 0.5); g.lineWidth = 4 * s; g.beginPath(); g.moveTo(px, py); g.lineTo(px - 12 * s, py + 4 * s); g.stroke(); }
  g.restore();
}
export function drawDustFrame(g, x, y, s = 1) {
  const R = rng(5);
  for (let i = 0; i < 9; i++) { const px = x + (R() - 0.5) * 120 * s, py = y + 20 * s - R() * 40 * s, r = (8 + R() * 16) * s; softDisc(g, px, py, r, '#e8dccb', 0.45); }
}

// ---------------------------------------------------------------- tree samples for the sheet (matches in-game canopy rendering)
export function drawTreeSample(g, x, y, B) {
  const kind = B.tree;
  const log = kind === 'crystal' ? '#5d7d88' : kind === 'shroom' ? '#cfc6ee' : B.log;
  if (kind === 'shroom') {
    capsule(g, x, y, x, y - 150, 9, 6, log, { dark: 0.4, hi: 0.15 });
    g.fillStyle = shade(B.leaf, -0.2); g.beginPath(); g.ellipse(x, y - 150, 80, 22, 0, 0, TAU); g.fill();
    const gr = g.createLinearGradient(0, y - 200, 0, y - 150); gr.addColorStop(0, shade(B.leaf, 0.25)); gr.addColorStop(1, B.leaf);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y - 154, 78, 44, 0, Math.PI, TAU); g.fill();
    g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, x, y - 140, 90, B.accent, 0.25); for (let i = 0; i < 8; i++) { g.fillStyle = rgba('#e6deff', 0.7); g.beginPath(); g.arc(x - 60 + i * 17, y - 165 + (i % 2) * 10, 2.5, 0, TAU); g.fill(); } g.restore();
    return;
  }
  // trunk with bark texture and root flare
  g.save();
  g.beginPath(); g.moveTo(x - 7, y - 150); g.lineTo(x + 7, y - 150); g.quadraticCurveTo(x + 8, y - 20, x + 18, y); g.lineTo(x - 18, y); g.quadraticCurveTo(x - 8, y - 20, x - 7, y - 150); g.closePath();
  g.fillStyle = pattern(g, 'bark', log); g.fill();
  const sh = g.createLinearGradient(x - 14, 0, x + 14, 0); sh.addColorStop(0, rgba('#ffffff', 0.1)); sh.addColorStop(1, rgba('#000000', 0.45));
  g.fillStyle = sh; g.fill();
  g.restore();
  if (kind === 'dead') {
    g.strokeStyle = log; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y - 110); g.quadraticCurveTo(x - 30, y - 130, x - 50, y - 170); g.moveTo(x, y - 140); g.quadraticCurveTo(x + 25, y - 160, x + 40, y - 200); g.stroke();
    return;
  }
  const col = kind === 'crystal' ? '#6fdccb' : B.leaf;
  const blobs = kind === 'pine' ? [[0, -250, 22], [-16, -220, 26], [16, -220, 26], [0, -215, 26], [-26, -185, 30], [26, -185, 30], [0, -180, 32], [-34, -150, 30], [34, -150, 30], [0, -150, 34]]
    : [[-40, -170, 34], [40, -175, 34], [0, -200, 40], [-20, -150, 34], [24, -150, 34], [-55, -140, 26], [58, -142, 26], [0, -160, 38]];
  const off = document.createElement('canvas'); off.width = 240; off.height = 200;
  const o = off.getContext('2d');
  const ox = 120, oy = 270;   // canopy space: tree base at (ox, oy)
  o.fillStyle = shade(col, -0.25);
  for (const [bx, by, r] of blobs) { o.beginPath(); o.arc(ox + bx, oy + by + 8, r, 0, TAU); o.fill(); }
  o.fillStyle = pattern(o, 'leaf', col);
  for (const [bx, by, r] of blobs) { o.beginPath(); o.arc(ox + bx, oy + by, r, 0, TAU); o.fill(); }
  o.globalCompositeOperation = 'source-atop';
  const lg = o.createLinearGradient(0, oy - 260, 0, oy - 110);
  lg.addColorStop(0, rgba(kind === 'pine' ? '#ffffff' : '#fff4d0', kind === 'pine' ? 0.45 : 0.28)); lg.addColorStop(1, rgba('#000000', 0.3));
  o.fillStyle = lg; o.fillRect(0, 0, 240, 200);
  g.drawImage(off, x - ox, y - oy);
}
