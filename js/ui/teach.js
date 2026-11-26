// Guidance in the open-world style: a teaching card the first time something new matters (a drawn picture,
// a title, two lines, "Got it"), kept in the Guide archive in the menu; and a compass strip across the top
// that always shows what is near and where to go next, each point with its distance.
import { TAU } from '../core/util.js';
import { Body, P } from '../physics/body.js';
import { Animator } from '../physics/pose.js';
import { Cape, drawShadow } from '../physics/skin.js';
import { drawDoll } from '../art/doll.js';
import { HUSK_LOOK } from '../game/enemies.js';
import { drawChest, drawStitch } from '../game/content.js';
import { drawThreadSprite } from '../game/thread.js';
import { IMG, texPattern } from '../art/images.js';
import { drawGlow } from '../world/light.js';

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

// ------------------------------------------------------------ pictures, made from the game's own art
// Each entry's picture is a small scene built from the real sprites and the posed doll and Hollows, on a
// dusk backdrop with a strip of textured ground: nothing drawn as loose lines.
const fakeWorld = {
  get(tx, ty) { return ty >= 0 ? 3 : 0; }, wall() { return 0; }, solid(tx, ty) { return ty >= 0; },
  groundBelow(x, y, max) { return y <= 0 && y + max >= 0 ? 0 : y > 0 ? Math.ceil(y / 32) * 32 : null; },
};
function posed(look, scale, spec) {
  const b = new Body({ scale, x: 0, y: -41 * scale, facing: spec.facing || 1 });
  const an = new Animator(b), dt = 1 / 120, standH = (19 + 18) * 0.93 * scale + 3.6 * scale;
  const cape = look.cape ? new Cape(7, (look.cape.len || 7) * scale) : null;
  for (let i = 0, n = spec.ticks || 160; i < n; i++) {
    const st = Object.assign({ mode: 'ground', x: 0, gy: 0, py: -standH, vx: 0, vy: 0, runMax: 300 }, spec.st);
    if (spec.attack) st.attack = { kind: spec.attack, t: spec.at };
    an.update(dt, st, fakeWorld); b.step(dt, fakeWorld);
    if (cape) cape.step(dt, (b.x[P.NECK] + b.x[P.CHEST]) / 2 - 2 * scale, (b.y[P.NECK] + b.y[P.CHEST]) / 2, -6, 1);
  }
  return { b, cape };
}
function figure(g, look, x, gy, scale, spec = {}) {
  const { b, cape } = posed(look, scale, spec);
  g.save(); g.translate(x, gy);
  drawShadow(g, b.x[P.PELVIS], 0, 18 * scale, 0.8);
  drawDoll(g, b, look, 1, { cape, blade: spec.blade !== false && !!look.blade, glows: [], time: 1.3 });
  g.restore();
}
function spr(g, name, cx, bottom, h) {
  const im = IMG[name]; if (!im) return false;
  const w = im.width * h / im.height; g.drawImage(im, Math.round(cx - w / 2), Math.round(bottom - h), Math.round(w), Math.round(h)); return true;
}
function pic(c, kind, look) {
  const g = c.getContext('2d'), W = 400, H = 180, GY = 148, R = Math.round, t = 1.2;
  g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
  g.clearRect(0, 0, W, H);
  // the backdrop: dusk sky, a soft light, a strip of the meadow's own ground
  const sky = g.createLinearGradient(0, 0, 0, GY); sky.addColorStop(0, '#1b1726'); sky.addColorStop(1, '#3a2f3e');
  g.fillStyle = sky; g.fillRect(0, 0, W, GY);
  drawGlow(g, W / 2, GY - 40, 170, [1, 0.82, 0.66], 0.16);
  const ground = (name = 'meadow_groundA') => { const pt = texPattern(g, name, 0.5); g.fillStyle = pt || '#3a3328'; g.save(); g.translate(0, GY); g.fillRect(0, 0, W, H - GY); g.restore();
    const lip = g.createLinearGradient(0, GY, 0, GY + 10); lip.addColorStop(0, 'rgba(255,240,220,.18)'); lip.addColorStop(1, 'rgba(255,240,220,0)'); g.fillStyle = lip; g.fillRect(0, GY, W, 10);
    const fade = g.createLinearGradient(0, GY, 0, H); fade.addColorStop(0, 'rgba(10,8,14,0)'); fade.addColorStop(1, 'rgba(10,8,14,.55)'); g.fillStyle = fade; g.fillRect(0, GY, W, H - GY); };
  const mote = (x, y, r = 1) => { drawGlow(g, x, y, 22 * r, [0.75, 0.96, 1], 0.5); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(R(x), R(y), 2.2 * r, 0, TAU); g.fill(); };
  const diamond = (x, y, r, col) => { g.beginPath(); g.moveTo(R(x), R(y - r)); g.lineTo(R(x + r), R(y)); g.lineTo(R(x), R(y + r)); g.lineTo(R(x - r), R(y)); g.closePath(); g.fillStyle = col; g.fill(); };
  const label = (txt, x, y, size = 13) => { g.fillStyle = 'rgba(243,236,224,.85)'; g.font = `500 ${size}px 'Cormorant Garamond', serif`; g.textAlign = 'center'; g.fillText(txt, R(x), R(y)); };
  const doll = look || {};
  if (kind === 'lights') {
    ground();
    figure(g, doll, 62, GY, 0.8, { st: { mode: 'sleep' }, ticks: 240, blade: false });
    drawStitch(g, 150, GY - 34, t);
    spr(g, 'req/nest', 238, GY + 4, 46);
    drawChest(g, 330, GY, 0, t);
    // her light rising from each source to Thread: a trail of motes, fading as they climb
    for (const sx of [62, 150, 238, 330]) for (let k = 1; k <= 5; k++) { const u = k / 6, x = sx + (200 - sx) * u, y = (GY - 30) + (40 - (GY - 30)) * u - Math.sin(u * Math.PI) * 18; drawGlow(g, x, y, 7, [0.75, 0.96, 1], 0.35 * (1 - u * 0.4)); }
    drawThreadSprite(g, 200, 38, t);
  } else if (kind === 'gate') {
    ground('meadow_stone');
    for (const x of [140, 260]) { const pt = texPattern(g, 'build_stone', 0.5); g.fillStyle = pt || '#5a5560'; g.fillRect(x - 16, GY - 110, 32, 110); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 8, GY - 110, 8, 110); }
    spr(g, 'props/banner', 200, GY - 4, 92);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const y = GY - 96 + i * 20; g.strokeStyle = 'rgba(255,217,160,.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(156, y); g.quadraticCurveTo(200, y + 8, 244, y); g.stroke(); }
    g.restore();
    label('3 / 10', 200, 26, 18); mote(176, 21, 0.7); 
  } else if (kind === 'marker') {
    ground();
    figure(g, doll, 110, GY, 0.85, { st: { mode: 'ground' }, ticks: 60 });
    drawThreadSprite(g, 150, 70, t);
    const mx = 300, my = GY - 52; drawGlow(g, mx, my, 26, [1, 0.85, 0.63], 0.5);
    diamond(mx, my, 9, '#ffd9a0'); g.fillStyle = 'rgba(255,217,160,.95)'; g.font = "700 10px Manrope, sans-serif"; g.textAlign = 'center'; g.fillText('24 m', mx, my + 22);
    // the compass strip along the top
    g.fillStyle = 'rgba(255,240,220,.28)'; g.fillRect(90, 18, 220, 1);
    for (const [x, col] of [[150, '#e8b070'], [230, '#bff6ff'], [280, '#ffb36b']]) diamond(x, 18, 4, col);
  } else if (kind === 'build') {
    ground('meadow_stone');
    const pt = texPattern(g, 'meadow_groundA', 0.5);
    for (let i = 0; i < 3; i++) { g.fillStyle = pt || '#6a5a48'; g.fillRect(230 + i * 32, GY - 32 * (i + 1), 32, 32 * (i + 1)); }
    figure(g, doll, 120, GY, 0.85, { st: { mode: 'ground' }, ticks: 60, attack: 'mine', at: 0.5 });
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.beginPath(); g.roundRect(231, GY - 31, 30, 30, 5); g.stroke();
    const pk = IMG['icons/b_planks']; if (pk) { g.globalAlpha = 0.6; g.drawImage(pk, 198, GY - 64, 32, 32); g.globalAlpha = 1; }
    g.strokeStyle = 'rgba(191,246,255,.85)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(199, GY - 63, 30, 30, 5); g.stroke();
  } else if (kind === 'craft') {
    ground();
    spr(g, 'req/bench', 80, GY + 2, 50);
    const cx = 230, cy = 82, r = 52;
    const ring = IMG['ui/ring']; if (ring) { const k = 2 * r / Math.max(ring.width, ring.height); g.drawImage(ring, cx - ring.width * k / 2, cy - ring.height * k / 2, ring.width * k, ring.height * k); }
    const pk = IMG['icons/b_planks']; if (pk) g.drawImage(pk, cx - 18, cy - 18, 36, 36);
    [['icons/b_wood', -2.4], ['icons/b_stone', -0.7], ['icons/glimmer', 0.9]].forEach(([n, a]) => { const im = IMG[n]; if (im) g.drawImage(im, cx + Math.cos(a) * 92 - 12, cy + Math.sin(a) * 48 - 12, 24, 24); });
  } else if (kind === 'parry') {
    ground();
    figure(g, doll, 150, GY, 0.95, { st: { mode: 'ground' }, ticks: 60, attack: 'ss1', at: 0.5 });
    figure(g, HUSK_LOOK('#ff6a4a'), 250, GY, 0.95, { st: { mode: 'ground' }, ticks: 60, facing: -1, attack: 'side', at: 0.45 });
    drawGlow(g, 200, GY - 62, 40, [1, 0.92, 0.7], 0.8);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(200, GY - 62, 3, 0, TAU); g.fill();
  } else if (kind === 'mend') {
    ground();
    figure(g, doll, 120, GY, 0.9, { st: { mode: 'ground' }, ticks: 60 });
    drawGlow(g, 120, GY - 50, 50, [1, 0.72, 0.8], 0.35);
    for (let i = 0; i < 5; i++) { const n = i < 3 ? 'icons/vessel' : 'icons/vessel_empty', im = IMG[n]; if (im) g.drawImage(im, 210 + i * 30, 40, 24, 24 * im.height / im.width); }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(210, 82, 144, 4); g.fillStyle = '#ffd9e4'; g.fillRect(210, 82, 108, 4);
  } else if (kind === 'surge') {
    ground();
    const cx = 200, top = GY - 110, Hh = 104;
    drawGlow(g, cx, top + Hh / 2, 90, [1, 0.35, 0.3], 0.4);
    for (const [col, k] of [['#ff7a5a', 1.18], ['#12060a', 0.95]]) for (const sd of [-1, 1]) {
      g.beginPath(); g.moveTo(cx, top);
      for (let i = 1; i <= 12; i++) { const u = i / 12; g.lineTo(cx + sd * Math.sin(u * Math.PI) * 18 * k, top + u * Hh); }
      g.lineTo(cx, top + Hh); g.closePath(); g.fillStyle = col; g.fill();
    }
    figure(g, HUSK_LOOK('#ff6a4a'), 140, GY, 0.8, { st: { mode: 'ground', vx: -80 }, ticks: 60, facing: -1 });
    figure(g, HUSK_LOOK('#ff6a4a'), 262, GY, 0.8, { st: { mode: 'ground', vx: 80 }, ticks: 60 });
  } else if (kind === 'town') {
    ground('town_cobble');
    spr(g, 'town/well', 70, GY + 2, 54);
    spr(g, 'town/inn', 200, GY + 2, 118);
    spr(g, 'town/lamp', 320, GY + 2, 70);
  } else if (kind === 'perk') {
    const cx = 92, cy = 62;
    g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4); g.fillStyle = '#1b1722'; g.fillRect(-15, -15, 30, 30); g.strokeStyle = 'rgba(191,246,255,.9)'; g.lineWidth = 1.5; g.strokeRect(-15, -15, 30, 30); g.restore();
    label('Lv. 3', cx, cy + 5, 14);
    g.fillStyle = 'rgba(255,217,160,.55)'; g.fillRect(118, 59, 210, 7); g.fillStyle = '#16131c'; g.fillRect(119, 60, 208, 5); g.fillStyle = '#efe6d6'; g.fillRect(119, 60, 140, 5);
    [['icons/r_surge', 120], ['icons/r_vessel', 200], ['icons/r_djump', 280]].forEach(([n, x], i) => {
      g.fillStyle = i === 1 ? 'rgba(191,246,255,.12)' : 'rgba(255,255,255,.05)'; g.strokeStyle = i === 1 ? 'rgba(191,246,255,.8)' : 'rgba(255,240,220,.25)'; g.lineWidth = 1.5;
      g.beginPath(); g.roundRect(x - 30, 96, 60, 60, 8); g.fill(); g.stroke();
      const im = IMG[n]; if (im) g.drawImage(im, x - 18, 108, 36, 36);
    });
  }
  // a quiet vignette over everything
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}

export function drawCardPic(c, kind, look) { try { pic(c, kind, look); } catch (e) { console.warn('guide picture', kind, e); } }

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
