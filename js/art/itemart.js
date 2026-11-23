// Code-painted art for crafted things: building parts and stations as world tiles, plus icons for every
// item. Same rules as the rest of the art: soft matte shading, light from the upper left, no outlines.
// (Placeholders until hand-painted versions arrive; see art/sheets/requests.png.)
import { T, TILES } from '../world/tiles.js';
import { IMG, TILE_ICON, texPattern } from './images.js';
import { capsule, ballShade, softDisc } from './paint.js';
import { shade, rgba, TAU } from '../core/util.js';

const WOOD = '#9b7653', WOOD_D = '#6e523b', IRON = '#4a4650', BRASS = '#c9a45c';

function woodRect(g, x, y, w, h, col = WOOD, r = 2) {
  g.save();
  g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
  g.fillStyle = texPattern(g, 'build_plank', 0.5) || col; g.fillRect(x, y, w, h);
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, rgba('#ffffff', 0.12)); gr.addColorStop(0.5, rgba('#000000', 0)); gr.addColorStop(1, rgba('#000000', 0.3));
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.restore();
}
function stoneRect(g, x, y, w, h, r = 3) {
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
  g.fillStyle = texPattern(g, 'build_stone', 0.5) || '#7a7680'; g.fillRect(x, y, w, h);
  const gr = g.createLinearGradient(x, y, x + w, y + h);
  gr.addColorStop(0, rgba('#ffffff', 0.1)); gr.addColorStop(1, rgba('#000000', 0.35));
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.restore();
}
function flame(g, x, y, s) {
  g.save(); g.globalCompositeOperation = 'lighter';
  softDisc(g, x, y - 2 * s, 9 * s, '#ffb066', 0.5);
  g.fillStyle = '#ff9a4a';
  g.beginPath(); g.moveTo(x, y - 9 * s); g.quadraticCurveTo(x + 4 * s, y - 2 * s, x, y + 1 * s); g.quadraticCurveTo(x - 4 * s, y - 2 * s, x, y - 9 * s); g.fill();
  g.fillStyle = '#ffe6b0';
  g.beginPath(); g.moveTo(x, y - 5 * s); g.quadraticCurveTo(x + 2 * s, y - 1 * s, x, y + 0.5 * s); g.quadraticCurveTo(x - 2 * s, y - 1 * s, x, y - 5 * s); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- world tiles (32 px cell at x, y)
// nb: neighbour lookup (dx, dy) -> tile id, so parts join up (ladder runs, platform spans, two-high doors)
export function drawPart(g, t, x, y, nb = () => 0) {
  switch (t) {
    case T.LADDER: {
      capsule(g, x + 8, y - 0.5, x + 8, y + 32.5, 2.2, 2.2, WOOD, { dark: 0.3 });
      capsule(g, x + 24, y - 0.5, x + 24, y + 32.5, 2.2, 2.2, WOOD, { dark: 0.3 });
      for (const ry of [7, 17, 27]) capsule(g, x + 8, y + ry, x + 24, y + ry, 1.7, 1.7, shade(WOOD, -0.05), { dark: 0.3 });
      return;
    }
    case T.PLATFORM: {
      woodRect(g, x - 0.5, y, 33, 7, WOOD, 1.5);
      g.fillStyle = rgba('#000000', 0.18); g.fillRect(x, y + 7, 32, 2);
      if (nb(-1, 0) !== T.PLATFORM) { g.fillStyle = WOOD_D; g.beginPath(); g.moveTo(x + 2, y + 7); g.lineTo(x + 9, y + 7); g.lineTo(x + 3, y + 15); g.fill(); }
      if (nb(1, 0) !== T.PLATFORM) { g.fillStyle = WOOD_D; g.beginPath(); g.moveTo(x + 30, y + 7); g.lineTo(x + 23, y + 7); g.lineTo(x + 29, y + 15); g.fill(); }
      return;
    }
    case T.TORCH: {
      const wall = nb(0, 1) === 0;   // nothing under: hangs on a bracket
      capsule(g, x + 16, y + (wall ? 26 : 31), x + 16, y + 14, 1.8, 2.2, WOOD_D, { dark: 0.3 });
      if (wall) { g.fillStyle = IRON; g.fillRect(x + 12, y + 22, 8, 2.5); }
      g.fillStyle = '#3a2c2a'; g.beginPath(); g.roundRect(x + 13, y + 11, 6, 5, 1.5); g.fill();
      flame(g, x + 16, y + 11, 1);
      return;
    }
    case T.DOOR: case T.DOOR_OPEN: {
      const top = nb(0, 1) === T.DOOR || nb(0, 1) === T.DOOR_OPEN;
      // frame
      g.fillStyle = shade(WOOD_D, -0.2);
      g.fillRect(x + 3, y, 3, 32); g.fillRect(x + 26, y, 3, 32);
      if (!(nb(0, -1) === T.DOOR || nb(0, -1) === T.DOOR_OPEN)) g.fillRect(x + 3, y, 26, 3);
      if (t === T.DOOR) {
        woodRect(g, x + 6, y + (top ? 3 : 0), 20, top ? 29 : 32, WOOD, 1);
        g.fillStyle = rgba('#000000', 0.22); for (const lx of [11, 16, 21]) g.fillRect(x + lx, y + (top ? 3 : 0), 1, top ? 29 : 32);
        g.fillStyle = IRON; g.fillRect(x + 6, y + (top ? 9 : 22), 20, 2.5);
        if (!top) { ballShade(g, x + 22, y + 10, 1.8, BRASS); }
      } else {
        g.fillStyle = rgba('#120e14', 0.55); g.fillRect(x + 6, y + (top ? 3 : 0), 20, top ? 29 : 32);
        woodRect(g, x + 6, y + (top ? 3 : 0), 5, top ? 29 : 32, shade(WOOD, -0.1), 1);
      }
      return;
    }
    case T.STEP: {
      woodRect(g, x, y + 16, 32, 16, WOOD, 3);
      g.fillStyle = rgba('#ffffff', 0.18); g.fillRect(x + 2, y + 16, 28, 2);
      return;
    }
    case T.STORE: {
      softDisc(g, x + 16, y + 31, 16, '#000000', 0.25);
      woodRect(g, x + 3, y + 14, 26, 18, WOOD, 3);
      woodRect(g, x + 2, y + 9, 28, 8, shade(WOOD, 0.05), 4);
      g.fillStyle = IRON; g.fillRect(x + 6, y + 9, 2.5, 23); g.fillRect(x + 23.5, y + 9, 2.5, 23);
      g.fillStyle = BRASS; g.beginPath(); g.roundRect(x + 13.5, y + 14, 5, 6, 1.5); g.fill();
      return;
    }
    case T.BENCH: {
      softDisc(g, x + 16, y + 31, 17, '#000000', 0.25);
      capsule(g, x + 6, y + 18, x + 5, y + 32, 2, 2, WOOD_D, { dark: 0.3 });
      capsule(g, x + 26, y + 18, x + 27, y + 32, 2, 2, WOOD_D, { dark: 0.3 });
      woodRect(g, x, y + 13, 32, 6, WOOD, 2);
      // tools on top: a mallet and a saw
      capsule(g, x + 8, y + 12, x + 15, y + 8, 1, 1, WOOD_D, { dark: 0.3 });
      g.fillStyle = IRON; g.beginPath(); g.roundRect(x + 13, y + 5, 6, 4, 1); g.fill();
      g.fillStyle = '#b9c0c8'; g.beginPath(); g.moveTo(x + 19, y + 13); g.lineTo(x + 29, y + 13); g.lineTo(x + 27, y + 9); g.lineTo(x + 21, y + 10); g.fill();
      return;
    }
    case T.FORGE: {
      softDisc(g, x + 16, y + 31, 17, '#000000', 0.3);
      stoneRect(g, x + 1, y + 8, 30, 24, 4);
      g.fillStyle = '#1c1416'; g.beginPath(); g.roundRect(x + 8, y + 16, 16, 11, [6, 6, 1, 1]); g.fill();
      flame(g, x + 16, y + 26, 1.05);
      stoneRect(g, x + 20, y - 2, 8, 11, 2);
      return;
    }
    case T.LOOM: {
      softDisc(g, x + 16, y + 31, 16, '#000000', 0.25);
      capsule(g, x + 5, y + 31, x + 8, y + 3, 1.8, 1.6, WOOD, { dark: 0.3 });
      capsule(g, x + 27, y + 31, x + 24, y + 3, 1.8, 1.6, WOOD, { dark: 0.3 });
      capsule(g, x + 6, y + 6, x + 26, y + 6, 1.7, 1.7, WOOD_D, { dark: 0.3 });
      capsule(g, x + 6, y + 22, x + 26, y + 22, 1.7, 1.7, WOOD_D, { dark: 0.3 });
      const cols = ['#d6c7f0', '#9ff3ff', '#f0b7a6', '#f3e6d0'];
      for (let i = 0; i < 7; i++) { g.strokeStyle = rgba(cols[i % 4], 0.85); g.lineWidth = 1; g.beginPath(); g.moveTo(x + 9 + i * 2.3, y + 7); g.lineTo(x + 9 + i * 2.3, y + 21); g.stroke(); }
      g.fillStyle = rgba('#d6c7f0', 0.6); g.fillRect(x + 9, y + 14, 16, 4);
      return;
    }
  }
}

// ---------------------------------------------------------------- item icons (centre cx, cy, box size s)
function drawSpecial(g, id, cx, cy, s) {
  const k = s / 64;
  g.save(); g.translate(cx, cy); g.scale(k, k);
  softDisc(g, 0, 22, 22, '#000000', 0.25);
  switch (id) {
    case 'i_draught': {
      g.fillStyle = '#e8eef5'; g.beginPath(); g.roundRect(-5, -26, 10, 10, 2); g.fill();
      g.fillStyle = '#a98a62'; g.beginPath(); g.roundRect(-6, -30, 12, 6, 2); g.fill();
      ballShade(g, 0, 2, 19, '#d8e6ee', { dark: 0.2 });
      g.save(); g.beginPath(); g.arc(0, 2, 17, 0, TAU); g.clip();
      const lq = g.createLinearGradient(0, -4, 0, 20); lq.addColorStop(0, '#ff8fb1'); lq.addColorStop(1, '#b03a5e');
      g.fillStyle = lq; g.fillRect(-20, -2, 40, 24); g.restore();
      g.fillStyle = rgba('#ffffff', 0.35); g.beginPath(); g.ellipse(-7, -6, 4, 7, -0.4, 0, TAU); g.fill();
      break;
    }
    case 'i_flare': {
      g.rotate(-0.7);
      capsule(g, 0, 22, 0, -12, 5, 5, '#c0453a', { dark: 0.35 });
      g.fillStyle = '#e8dccb'; g.fillRect(-5, 8, 10, 4);
      flame(g, 0, -16, 1.6);
      break;
    }
    case 'i_charge': {
      ballShade(g, 0, 6, 18, '#3a3440', { dark: 0.4 });
      g.fillStyle = '#a98a62'; for (const yy of [-2, 8]) g.fillRect(-17, yy, 34, 3);
      g.strokeStyle = '#d8c7a8'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, -11); g.quadraticCurveTo(10, -22, 18, -22); g.stroke();
      flame(g, 19, -21, 0.8);
      break;
    }
    case 'g_lamp': {
      g.strokeStyle = IRON; g.lineWidth = 3; g.beginPath(); g.arc(0, -18, 7, Math.PI, TAU); g.stroke();
      g.fillStyle = BRASS; g.beginPath(); g.roundRect(-13, -14, 26, 6, 2); g.fill(); g.beginPath(); g.roundRect(-13, 18, 26, 6, 2); g.fill();
      g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, 0, 4, 22, '#ffd28a', 0.6); g.restore();
      g.fillStyle = rgba('#ffe9c0', 0.85); g.beginPath(); g.roundRect(-10, -8, 20, 26, 3); g.fill();
      g.strokeStyle = IRON; g.lineWidth = 2; for (const xx of [-10, 0, 10]) { g.beginPath(); g.moveTo(xx, -8); g.lineTo(xx, 18); g.stroke(); }
      break;
    }
    case 'g_pick_gilt': case 'g_pick_crystal': {
      const head = id === 'g_pick_gilt' ? '#e2b85a' : '#8ff7ff';
      g.rotate(0.6);
      capsule(g, 0, 28, 0, -16, 3, 3, WOOD, { dark: 0.35 });
      g.fillStyle = head;
      g.beginPath(); g.moveTo(-26, -10); g.quadraticCurveTo(0, -30, 26, -10); g.quadraticCurveTo(0, -20, -26, -10); g.fill();
      g.fillStyle = rgba('#ffffff', 0.3); g.beginPath(); g.moveTo(-20, -14); g.quadraticCurveTo(0, -27, 16, -16); g.quadraticCurveTo(0, -22, -20, -14); g.fill();
      break;
    }
    case 'w_blade': {
      g.rotate(-0.78);
      const bl = g.createLinearGradient(-5, 0, 5, 0); bl.addColorStop(0, '#f4f1ea'); bl.addColorStop(1, '#a9a4b0');
      g.fillStyle = bl; g.beginPath(); g.moveTo(-4.5, 8); g.lineTo(-4.5, -24); g.lineTo(0, -32); g.lineTo(4.5, -24); g.lineTo(4.5, 8); g.closePath(); g.fill();
      g.fillStyle = rgba('#ffffff', 0.5); g.fillRect(-1, -26, 2, 32);
      g.fillStyle = BRASS; g.beginPath(); g.roundRect(-12, 8, 24, 5, 2); g.fill();
      capsule(g, 0, 14, 0, 26, 3, 3, '#5a3a2a', { dark: 0.3 });
      ballShade(g, 0, 29, 4, BRASS, { dark: 0.3 });
      break;
    }
    case 'w_spear': {
      g.rotate(-0.78);
      capsule(g, 0, 32, 0, -14, 2.6, 2.6, WOOD, { dark: 0.35 });
      g.fillStyle = '#e8e4dc'; g.beginPath(); g.moveTo(0, -34); g.lineTo(6, -18); g.lineTo(0, -12); g.lineTo(-6, -18); g.closePath(); g.fill();
      g.fillStyle = rgba('#ffffff', 0.45); g.beginPath(); g.moveTo(0, -32); g.lineTo(2.5, -18); g.lineTo(0, -14); g.closePath(); g.fill();
      g.fillStyle = '#c0453a'; g.fillRect(-3.5, -12, 7, 4);
      break;
    }
    case 'w_hammer': {
      g.rotate(-0.6);
      capsule(g, 0, 32, 0, -8, 3, 3, WOOD, { dark: 0.35 });
      const hd = g.createLinearGradient(0, -26, 0, -6); hd.addColorStop(0, '#9a96a0'); hd.addColorStop(1, '#4e4a56');
      g.fillStyle = hd; g.beginPath(); g.roundRect(-18, -26, 36, 18, 4); g.fill();
      g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(-16, -24, 32, 4);
      g.fillStyle = BRASS; g.fillRect(-4, -26, 8, 18);
      break;
    }
    case 'w_daggers': {
      for (const sd of [-1, 1]) {
        g.save(); g.rotate(sd * 0.55); g.translate(sd * 4, 4);
        g.fillStyle = '#e8e4dc'; g.beginPath(); g.moveTo(-3.5, 0); g.lineTo(0, -26); g.lineTo(3.5, 0); g.closePath(); g.fill();
        g.fillStyle = BRASS; g.fillRect(-8, 0, 16, 3.5);
        capsule(g, 0, 5, 0, 15, 2.5, 2.5, '#5a3a2a', { dark: 0.3 });
        g.restore();
      }
      break;
    }
    case 'w_sling': {
      g.strokeStyle = '#a98a62'; g.lineWidth = 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-20, -24); g.quadraticCurveTo(-14, 4, 0, 12); g.quadraticCurveTo(14, 4, 20, -24); g.stroke();
      g.fillStyle = '#7a5a3e'; g.beginPath(); g.ellipse(0, 12, 10, 6, 0, 0, TAU); g.fill();
      ballShade(g, 0, 8, 7, '#9a96a0', { dark: 0.35 });
      for (const xx of [-20, 20]) ballShade(g, xx, -25, 3.5, '#d8c7a8', { dark: 0.3 });
      break;
    }
    case 'i_infuse_ember': case 'i_infuse_frost': {
      const c = id === 'i_infuse_ember' ? '#ff9b4a' : '#9fdcff', c2 = id === 'i_infuse_ember' ? '#b0401e' : '#3a78b0';
      g.fillStyle = '#e8eef5'; g.beginPath(); g.roundRect(-4, -28, 8, 12, 2); g.fill();
      g.fillStyle = '#a98a62'; g.beginPath(); g.roundRect(-5, -31, 10, 5, 2); g.fill();
      g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, 0, 4, 24, c, 0.4); g.restore();
      g.fillStyle = rgba('#d8e6ee', 0.5); g.beginPath(); g.moveTo(-5, -17); g.lineTo(-16, 18); g.quadraticCurveTo(0, 26, 16, 18); g.lineTo(5, -17); g.closePath(); g.fill();
      const lq = g.createLinearGradient(0, -4, 0, 22); lq.addColorStop(0, c); lq.addColorStop(1, c2);
      g.fillStyle = lq; g.beginPath(); g.moveTo(-10, 0); g.lineTo(-15, 17); g.quadraticCurveTo(0, 24, 15, 17); g.lineTo(10, 0); g.closePath(); g.fill();
      g.fillStyle = rgba('#ffffff', 0.4); g.beginPath(); g.ellipse(-6, 6, 2.5, 6, 0.3, 0, TAU); g.fill();
      break;
    }
    case 'g_charm_thread': case 'g_charm_ember': {
      const c = id === 'g_charm_thread' ? '#9ff3ff' : '#ff9b4a';
      g.strokeStyle = '#d8c7a8'; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, -26); g.quadraticCurveTo(0, -10, 14, -26); g.stroke();
      g.save(); g.globalCompositeOperation = 'lighter'; softDisc(g, 0, 4, 22, c, 0.45); g.restore();
      g.fillStyle = c;
      g.beginPath(); g.moveTo(0, -14); g.lineTo(12, 4); g.lineTo(0, 22); g.lineTo(-12, 4); g.closePath(); g.fill();
      g.fillStyle = rgba('#ffffff', 0.4); g.beginPath(); g.moveTo(0, -10); g.lineTo(6, 2); g.lineTo(0, 4); g.closePath(); g.fill();
      break;
    }
  }
  g.restore();
}

// draw any item's icon centred at (cx, cy) inside an s x s box
export function drawItemIcon(g, id, cx, cy, s) {
  if (typeof id === 'string' && /^\d+$/.test(id)) id = +id;
  if (typeof id !== 'number') { drawSpecial(g, id, cx, cy, s); return; }
  const im = TILE_ICON[id] && IMG['icons/b_' + TILE_ICON[id]];
  if (im) { const h = s * 0.92, w = im.width * h / im.height; g.drawImage(im, cx - w / 2, cy - h / 2, w, h); return; }
  if (TILES[id] && (TILES[id].station || TILES[id].climb || TILES[id].platform || TILES[id].door || TILES[id].half || id === T.TORCH)) {
    const k = s / 40;
    g.save(); g.translate(cx - 16 * k, cy - 16 * k); g.scale(k, k);
    if (id === T.DOOR) { drawPart(g, T.DOOR, 0, -16, (dx, dy) => (dy === 1 ? T.DOOR : 0)); drawPart(g, T.DOOR, 0, 16, (dx, dy) => (dy === -1 ? T.DOOR : 0)); }
    else drawPart(g, id, 0, 0, (dx, dy) => (dy === 1 ? 1 : 0));
    g.restore(); return;
  }
  // plain block fallback: a soft cube in the block's colour
  const k = TILES[id] && TILES[id].k && TILES[id].k[0] === '#' ? TILES[id].k : '#8a7f78';
  g.save(); g.translate(cx, cy);
  const r = s * 0.32;
  g.fillStyle = shade(k, 0.1); g.beginPath(); g.moveTo(0, -r); g.lineTo(r, -r / 2); g.lineTo(0, 0); g.lineTo(-r, -r / 2); g.closePath(); g.fill();
  g.fillStyle = shade(k, -0.15); g.beginPath(); g.moveTo(-r, -r / 2); g.lineTo(0, 0); g.lineTo(0, r); g.lineTo(-r, r / 2); g.closePath(); g.fill();
  g.fillStyle = shade(k, -0.32); g.beginPath(); g.moveTo(r, -r / 2); g.lineTo(0, 0); g.lineTo(0, r); g.lineTo(r, r / 2); g.closePath(); g.fill();
  g.restore();
}
// cached DOM-ready icon (canvas copy) for menus and the hotbar
const cache = new Map();
export function itemIconEl(id, size = 40) {
  const key = id + '|' + size + '|' + (IMG['icons/b_stone'] ? 1 : 0);
  let src = cache.get(key);
  if (!src) {
    const d = Math.min(2, devicePixelRatio || 1);
    src = document.createElement('canvas'); src.width = src.height = Math.round(size * d);
    const g = src.getContext('2d'); g.scale(d, d);
    drawItemIcon(g, id, size / 2, size / 2, size);
    cache.set(key, src);
  }
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height; c.className = 'ticon';
  c.style.width = c.style.height = size + 'px';
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}
