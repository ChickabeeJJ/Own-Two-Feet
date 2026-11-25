// Guidance in the open-world style: a teaching card the first time something new matters (a drawn picture,
// a title, two lines, "Got it"), kept in the Guide archive in the menu; and a compass strip across the top
// that always shows what is near and where to go next, each point with its distance.
import { TAU } from '../core/util.js';

// each card: a title, two short lines, and a picture drawn in clean shapes
export const CARDS = {
  lights: { sec: 'World', title: 'Threads of Light', lines: ['The Warden\u2019s gate is sealed with her thread. Light opens it.', 'Wake sleeping dolls, find glowing stitches, break Hollow nests and help keepers. Each gives Threads of Light.'], pic: 'lights', keys: 'The count is at the top left. Follow Thread, the little light.', touch: 'The count is at the top left. Follow Thread, the little light.' },
  gate: { sec: 'World', title: 'Sealed gates', lines: ['Each gate needs enough Threads of Light to open. The count is on the top left.', 'Follow Thread (the little light) or the diamond marker to the nearest source.'], pic: 'gate' },
  marker: { sec: 'Basics', title: 'Always a way forward', lines: ['The diamond shows where to go next; at the screen edge an arrow points to it.', 'The strip at the top shows the gate, the nearest Thread of Light, shrines and towns.'], pic: 'marker' },
  build: { sec: 'Building', title: 'Build mode', lines: ['Blocks are mined and placed only in build mode. Outside it, Strike only fights.', 'Reach is a square of five blocks around you; the block under the cursor is outlined.'], pic: 'build', keys: 'B for build mode · hold Click to mine · Right-click to place', touch: 'Build button · hold a block to mine · tap open space to place' },
  craft: { sec: 'Building', title: 'Crafting', lines: ['Blocks you mine and things you find become tools, parts and gear.', 'Open the satchel by a workbench, forge or loom to make more.'], pic: 'craft', keys: 'I or Tab opens the satchel', touch: 'Bag button' },
  parry: { sec: 'Combat', title: 'Parry and charge', lines: ['Strike just as a Hollow\u2019s blow lands and you turn it back.', 'Hold Strike to charge a heavy blow that breaks a guard.'], pic: 'parry', keys: 'J or Click · hold to charge', touch: 'Strike · hold to charge' },
  mend: { sec: 'Combat', title: 'Mending', lines: ['Hits fill your breath. With enough breath you can mend a lost vessel.', 'Mend when it is quiet: it takes a moment.'], pic: 'mend', keys: 'Hold H', touch: 'Hold Mend' },
  surge: { sec: 'Combat', title: 'Hollow surges', lines: ['A rift tears open and Hollows pour out in waves.', 'Clear every wave before it closes and it leaves a chest.'], pic: 'surge' },
  town: { sec: 'World', title: 'Towns', lines: ['Shops, a smith to temper your weapon, an inn to rest, a waystone to travel.', 'The notice board has bounties; the yard opens the Rift Trials.'], pic: 'town', keys: 'E to talk, trade and travel', touch: 'The action button talks, trades and travels' },
  perk: { sec: 'Basics', title: 'Levels and perks', lines: ['Everything you do gives experience: the line above your hotbar.', 'Every third level, choose a perk in the menu under Character.'], pic: 'perk', keys: 'Esc, then Character', touch: 'Menu, then Character' },
};

function pic(c, kind) {
  const g = c.getContext('2d'), W = c.width, H = c.height, cx = W / 2, cy = H / 2;
  const R = Math.round;
  g.clearRect(0, 0, W, H);
  const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const mote = (x, y, s = 1) => { glow(x, y, 22 * s, '191,246,255', 0.7); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(R(x), R(y), R(4 * s), 0, TAU); g.fill(); };
  const line = (pts, col, w = 2) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(R(x), R(y)) : g.moveTo(R(x), R(y)))); g.stroke(); };
  const shape = (pts, fill, stroke) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(R(x), R(y)) : g.moveTo(R(x), R(y)))); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke(); } };
  const diamond = (x, y, r, col) => shape([[x, y - r], [x + r, y], [x, y + r], [x - r, y]], col, 'rgba(36,26,18,.6)');
  const ground = () => { g.fillStyle = '#2a2430'; g.fillRect(0, R(H * 0.78), W, H); line([[0, H * 0.78], [W, H * 0.78]], 'rgba(255,240,220,.18)', 2); };
  // the four sources of light, each a small clean pictogram
  const doll = (x, y) => { g.fillStyle = '#efe6d6'; g.beginPath(); g.ellipse(R(x), R(y - 6), 16, 6, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(R(x + 18), R(y - 9), 6, 0, TAU); g.fill(); };
  const stitch = (x, y) => { line([[x - 10, y - 30], [x + 10, y - 10]], '#ffd9a0', 3); line([[x + 10, y - 30], [x - 10, y - 10]], '#ffd9a0', 3); glow(x, y - 20, 18, '255,217,160', 0.4); };
  const nest = (x, y) => { shape([[x - 20, y], [x - 12, y - 16], [x, y - 22], [x + 12, y - 16], [x + 20, y]], '#3a2e36', 'rgba(0,0,0,.5)'); glow(x, y - 10, 12, '255,106,74', 0.8); };
  const chest = (x, y) => { shape([[x - 16, y], [x - 16, y - 18], [x + 16, y - 18], [x + 16, y]], '#7a5a3e', 'rgba(0,0,0,.5)'); line([[x - 16, y - 12], [x + 16, y - 12]], '#d9a441', 2); };
  if (kind === 'lights') {
    ground();
    const xs = [W * 0.17, W * 0.39, W * 0.61, W * 0.83], gy = H * 0.78;
    [doll, stitch, nest, chest].forEach((f, i) => { f(xs[i], gy); line([[xs[i], gy - 34], [cx, H * 0.24]], 'rgba(191,246,255,.25)', 1.5); });
    mote(cx, H * 0.22, 1.3);
  } else if (kind === 'gate') {
    ground();
    const gy = H * 0.78;
    shape([[cx - 50, gy], [cx - 50, gy - 90], [cx - 30, gy - 110], [cx + 30, gy - 110], [cx + 50, gy - 90], [cx + 50, gy]], '#3a3442', 'rgba(0,0,0,.5)');
    for (let i = -2; i <= 2; i++) line([[cx + i * 16, gy - 100], [cx + i * 16, gy]], 'rgba(255,217,160,.7)', 2);
    g.fillStyle = '#f3ece0'; g.font = '600 18px "Cormorant Garamond", serif'; g.textAlign = 'center'; g.fillText('3 / 10', cx, gy - 120);
    mote(cx - 120, gy - 50); mote(cx + 120, gy - 64, 0.8);
  } else if (kind === 'marker') {
    ground();
    diamond(cx + 70, H * 0.42, 10, '#ffd9a0');
    g.fillStyle = 'rgba(255,217,160,.8)'; g.font = '700 11px Manrope, sans-serif'; g.textAlign = 'center'; g.fillText('24 m', cx + 70, H * 0.42 + 26);
    shape([[W - 18, cy], [W - 34, cy - 12], [W - 30, cy], [W - 34, cy + 12]], '#ffd9a0');
    g.fillStyle = 'rgba(20,17,26,.8)'; g.fillRect(R(W * 0.2), 12, R(W * 0.6), 18);
    for (const [u, col] of [[0.3, '#ffd9a0'], [0.55, '#bff6ff'], [0.72, '#e8b070']]) diamond(W * (0.2 + 0.6 * u), 21, 5, col);
    g.fillStyle = '#efe6d6'; g.beginPath(); g.arc(R(cx - 60), R(H * 0.78 - 26), 8, 0, TAU); g.fill();
  } else if (kind === 'surge') {
    ground();
    const gy = H * 0.78;
    g.fillStyle = 'rgba(159,243,255,.85)'; g.beginPath(); g.moveTo(cx, gy - 110); g.quadraticCurveTo(cx + 22, gy - 60, cx, gy - 10); g.quadraticCurveTo(cx - 22, gy - 60, cx, gy - 110); g.closePath(); g.fill();
    glow(cx, gy - 60, 70, '159,243,255', 0.35);
    for (const d of [-1, 1]) for (let k = 1; k <= 2; k++) { const x = cx + d * (40 + k * 34); g.fillStyle = '#1c1820'; g.beginPath(); g.arc(R(x), R(gy - 40), 9, 0, TAU); g.fill(); g.fillRect(R(x - 7), R(gy - 32), 14, 30); }
  } else if (kind === 'town') {
    ground();
    const gy = H * 0.78;
    for (const [x, w, h] of [[cx - 90, 70, 60], [cx, 90, 80], [cx + 92, 64, 56]]) {
      shape([[x - w / 2, gy], [x - w / 2, gy - h], [x + w / 2, gy - h], [x + w / 2, gy]], '#e6dccb', 'rgba(0,0,0,.35)');
      shape([[x - w / 2 - 8, gy - h], [x, gy - h - 30], [x + w / 2 + 8, gy - h]], '#a44a3c', 'rgba(0,0,0,.35)');
      g.fillStyle = '#ffd08a'; g.fillRect(R(x - 8), R(gy - h * 0.6), 16, 16); g.fillStyle = '#3a2c2a'; g.fillRect(R(x - 6), R(gy - 22), 12, 22);
    }
  } else if (kind === 'perk') {
    g.fillStyle = '#15121b'; g.strokeStyle = 'rgba(255,217,160,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(R(W * 0.22), R(cy), 20, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#f3ece0'; g.font = '500 22px "Cormorant Garamond", serif'; g.textAlign = 'center'; g.fillText('3', R(W * 0.22), R(cy + 7));
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(R(W * 0.3), R(cy - 2), R(W * 0.55), 4);
    g.fillStyle = '#9fd6e0'; g.fillRect(R(W * 0.3), R(cy - 2), R(W * 0.36), 4);
    for (let i = 0; i < 3; i++) { const x = W * (0.38 + i * 0.2), y = cy + 46; shape([[x - 22, y - 16], [x + 22, y - 16], [x + 22, y + 16], [x - 22, y + 16]], i === 1 ? 'rgba(191,246,255,.18)' : 'rgba(255,255,255,.06)', i === 1 ? 'rgba(191,246,255,.8)' : 'rgba(255,240,220,.3)'); }
  } else if (kind === 'build') {
    const s0 = 30, x0 = R(cx - s0 * 3), y0 = R(H * 0.78 - s0 * 2);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) shape([[x0 + i * s0, y0 + j * s0], [x0 + i * s0 + s0, y0 + j * s0], [x0 + i * s0 + s0, y0 + j * s0 + s0], [x0 + i * s0, y0 + j * s0 + s0]], j ? '#5a4a3e' : '#7a6a5a', 'rgba(0,0,0,.35)');
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.strokeRect(x0 + 3 * s0 + 1, y0 + 1, s0 - 2, s0 - 2);
    g.globalAlpha = 0.55; shape([[x0 + 4 * s0, y0 - s0], [x0 + 5 * s0, y0 - s0], [x0 + 5 * s0, y0], [x0 + 4 * s0, y0]], '#9b7653', 'rgba(191,246,255,.9)'); g.globalAlpha = 1;
  } else if (kind === 'parry') {
    line([[cx - 90, cy + 40], [cx + 10, cy - 30]], '#d8dde6', 5); line([[cx + 90, cy + 40], [cx - 10, cy - 30]], '#4a4450', 5);
    glow(cx, cy - 22, 46, '255,230,170', 0.8); g.fillStyle = '#fff'; g.beginPath(); g.arc(R(cx), R(cy - 22), 4, 0, TAU); g.fill();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; line([[cx + Math.cos(a) * 12, cy - 22 + Math.sin(a) * 12], [cx + Math.cos(a) * 26, cy - 22 + Math.sin(a) * 26]], 'rgba(255,230,170,.8)', 2); }
  } else if (kind === 'mend') {
    for (let i = 0; i < 5; i++) { const x = cx - 80 + i * 40, y = cy; shape([[x, y - 18], [x + 11, y - 4], [x, y + 18], [x - 11, y - 4]], i < 3 ? '#bff6ff' : 'rgba(255,255,255,.12)', 'rgba(36,26,18,.5)'); }
    glow(cx + 40, cy, 34, '191,246,255', 0.5);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(R(cx - 100), R(cy + 40), 200, 5); g.fillStyle = '#ffd9e4'; g.fillRect(R(cx - 100), R(cy + 40), 150, 5);
  } else if (kind === 'craft') {
    g.strokeStyle = 'rgba(255,217,160,.75)'; g.lineWidth = 2; g.beginPath(); g.arc(R(cx), R(cy), 46, 0, TAU); g.stroke();
    shape([[cx - 18, cy + 18], [cx - 18, cy - 4], [cx, cy - 14], [cx + 18, cy - 4], [cx + 18, cy + 18]], '#9b7653', 'rgba(0,0,0,.4)');
    for (const [a, col] of [[-2.5, '#8f8a96'], [-0.6, '#7a5a3e'], [1.3, '#d9a441']]) { const x = cx + Math.cos(a) * 84, y = cy + Math.sin(a) * 50; shape([[x - 10, y - 10], [x + 10, y - 10], [x + 10, y + 10], [x - 10, y + 10]], col, 'rgba(0,0,0,.4)'); line([[x - Math.cos(a) * 16, y - Math.sin(a) * 10], [cx + Math.cos(a) * 52, cy + Math.sin(a) * 30]], 'rgba(255,240,220,.3)', 1.5); }
  }
}

export function drawCardPic(c, kind) { try { pic(c, kind); } catch (e) {} }

// compass strip: points of interest placed by their offset from you, a few hundred metres either side
export function compassHTML(pois, range) {
  let out = '<div class="cs-line"></div><div class="cs-me"></div>';
  for (const p of pois) {
    const u = Math.max(-1, Math.min(1, p.dx / range)), edge = Math.abs(p.dx) > range;
    const x = (50 + u * 47).toFixed(1);
    out += `<div class="cs-poi ${p.cls}${edge ? ' edge' : ''}${p.main ? ' main' : ''}" style="left:${x}%" title="${p.name}"><i></i><span>${p.label}</span></div>`;
  }
  return out;
}
