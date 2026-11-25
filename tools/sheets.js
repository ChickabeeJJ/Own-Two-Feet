// Asset sheets: renders the game's real art code onto presentation boards.
import { Body, P } from '../js/physics/body.js';
import { Animator } from '../js/physics/pose.js';
import { Cape, drawShadow } from '../js/physics/skin.js';
import { drawDoll } from '../js/art/doll.js';
import { lookFromSave, newSave } from '../js/game/progress.js';
import { LOOKS } from '../js/game/npcs.js';
import { HUSK_LOOK, BRUTE_LOOK, LANCER_LOOK, SLINGER_LOOK, drawWispSprite } from '../js/game/enemies.js';
import { PrologueArt, WARDEN_INFO } from '../js/art/prologue.js';
import { TYPES, Warden, Wraith, Golem } from '../js/game/bosses.js';
import { drawThreadSprite } from '../js/game/thread.js';
import { drawGlow } from '../js/world/light.js';
import { hexToRgb, rgba, TAU } from '../js/core/util.js';
import * as Props from '../js/art/props.js';
import { drawChest, drawStitch, drawNest } from '../js/game/content.js';
import { texture, grassLip, snowLip } from '../js/art/tex.js';
import { BIOMES, T, TILES } from '../js/world/tiles.js';
import { loadImages, setBase, IMG, drawSprite, TILE_ICON } from '../js/art/images.js';
import { drawPart, drawItemIcon } from '../js/art/itemart.js';
import { Towns } from '../js/game/towns.js';
import { BUILDINGS } from '../js/world/townplan.js';

const fakeWorld = {
  get(tx, ty) { return ty >= 0 ? 3 : 0; },
  wall() { return 0; },
  solid(tx, ty) { return ty >= 0; },
  groundBelow(x, y, max) { return y <= 0 && y + max >= 0 ? 0 : y > 0 ? Math.ceil(y / 32) * 32 : null; },
};

function board(id, W, H, title, sub) {
  const c = document.getElementById(id);
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#15131c'); bg.addColorStop(1, '#0b0a0f');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.75);
  v.addColorStop(0, 'rgba(255,230,200,0.04)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f3ece0'; g.font = '300 54px Cormorant'; g.textAlign = 'left';
  g.fillText(title.toUpperCase().split('').join(String.fromCharCode(8202)), 60, 92);
  g.fillStyle = 'rgba(243,236,224,.55)'; g.font = 'italic 500 22px Cormorant'; g.fillText(sub, 62, 126);
  g.fillStyle = 'rgba(255,240,220,.25)'; g.fillRect(60, 146, W - 120, 1);
  return g;
}
function section(g, x, y, text) {
  g.fillStyle = 'rgba(243,236,224,.6)'; g.font = '600 13px Manrope'; g.textAlign = 'left';
  g.fillText(text.toUpperCase().split('').join(' '), x, y);
}
function label(g, x, y, text, sub) {
  g.textAlign = 'center';
  g.fillStyle = '#f3ece0'; g.font = '500 19px Cormorant'; g.fillText(text, x, y);
  if (sub) { g.fillStyle = 'rgba(243,236,224,.45)'; g.font = '400 11px Manrope'; g.fillText(sub, x, y + 17); }
}
function floorGlow(g, x, y, w) {
  const gr = g.createRadialGradient(x, y, 2, x, y, w);
  gr.addColorStop(0, 'rgba(255,230,200,0.10)'); gr.addColorStop(1, 'rgba(255,230,200,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, w, w * 0.22, 0, 0, TAU); g.fill();
}

// simulate a body into a pose and return it with its cape
function posed(look, scale, spec) {
  const b = new Body({ scale, x: 0, y: -41 * scale, facing: 1 });
  const an = new Animator(b);
  const cape = look.cape ? new Cape(7, (look.cape.len || 7) * scale) : null;
  if (cape) cape.flare = look.cape.flare || (look.cape.wide > 10 ? 900 : 640);
  const dt = 1 / 120;
  const standH = (19 + 18) * 0.93 * scale + 3.6 * scale;
  const n = spec.ticks || 160;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const st = Object.assign({ mode: 'ground', x: 0, gy: 0, py: -standH, vx: 0, vy: 0, runMax: 300 }, spec.st);
    if (spec.attack) st.attack = { kind: spec.attack, t: spec.at0 !== undefined ? spec.at0 + (spec.at1 - spec.at0) * u : spec.at };
    if (spec.limp && i > 20) { b.strength = 0; b.rootK = 0; }
    else an.update(dt, st, fakeWorld);
    if (spec.bodyFx) spec.bodyFx(b, i);
    b.step(dt, fakeWorld);
    if (cape) cape.step(dt, (b.x[P.NECK] + b.x[P.CHEST]) / 2 - 2 * scale, (b.y[P.NECK] + b.y[P.CHEST]) / 2, spec.wind ?? -6 - (spec.st && spec.st.vx || 0) * 0.15, 1);
  }
  return { b, cape };
}
function drawFigure(g, x, y, look, scale, spec, o = {}) {
  const { b, cape } = posed(look, scale, spec);
  g.save(); g.translate(x - (spec.center ? b.x[P.PELVIS] : 0), y);
  floorGlow(g, spec.center ? b.x[P.PELVIS] : 0, 0, 60 * scale);
  drawShadow(g, b.x[P.PELVIS], 0, 22 * scale, 1);
  const glows = [];
  drawDoll(g, b, look, 1, { cape, blade: o.blade !== false && !!look.blade, glows, time: 1.3, vx: spec.st && spec.st.vx || 0 });
  g.globalCompositeOperation = 'lighter';
  for (const q of glows) drawGlow(g, q[0], q[1], q[2], hexToRgb(q[3]).map(v => v / 255), q[4]);
  g.restore();
}

// ---------------------------------------------------------------- characters
function characters() {
  const W = 2400, H = 2060;
  const g = board('characters', W, H, 'Characters', 'one rig, many souls: the doll, the keepers, the hollows and the wardens');
  const sv = newSave(1); sv.hasBlade = true;
  const doll = lookFromSave(sv);
  section(g, 60, 200, 'The Doll · poses driven by the live physics rig');
  const S = 2.5, y1 = 470;
  const poses = [
    ['Idle', '', { ticks: 200 }],
    ['Walk', '', { st: { vx: 140 }, ticks: 170 }],
    ['Run', '', { st: { vx: 320 }, ticks: 150 }],
    ['Jump', '', { st: { mode: 'air', vy: -600 }, ticks: 60 }],
    ['Fall', '', { st: { mode: 'air', vy: 1300 }, ticks: 70 }],
    ['Wind-up', '', { attack: 'side', at: 0.18, ticks: 70 }],
    ['Strike', '', { attack: 'side', at0: 0.2, at1: 0.5, ticks: 40 }],
    ['Dash', '', { st: { mode: 'dash', vx: 700 }, ticks: 50 }],
    ['Knocked down', '', { limp: true, center: true, ticks: 200, bodyFx: (b, i) => { if (i === 21) b.impulseAll(-40, -150); } }],
  ];
  poses.forEach(([n, sub, spec], i) => { const x = 160 + i * 255 + (i === 8 ? 20 : 0); drawFigure(g, x, y1, doll, S, spec); label(g, x, y1 + 50, n, sub); });

  section(g, 60, 600, 'Make it yours · body, material, head, cape, glow, blade, warden marks');
  const variants = [
    ['Linen · Sprout', { color: 'c_bone', mat: 'm_cloth', head: 'h_leaf', cape: 'k_scarf', eyes: 'e_amber', blade: 'b_bone' }, []],
    ['Porcelain · Crown', { color: 'c_bone', mat: 'm_porcelain', head: 'h_crown', cape: 'k_white', eyes: 'e_cyan', blade: 'b_steel' }, ['#ffb36b']],
    ['Bronze · Horns', { color: 'c_gold', mat: 'm_metal', head: 'h_horns', cape: 'k_ink', eyes: 'e_rose', blade: 'b_ember' }, ['#ffb36b', '#8ff7ff']],
    ['Lumen · Halo', { color: 'c_sea', mat: 'm_glow', head: 'h_halo', cape: 'k_sky', eyes: 'e_visor', blade: 'b_glass' }, ['#8ff7ff']],
    ['Umbra · Antlers', { color: 'c_ink', mat: 'm_shadow', head: 'h_antlers', cape: 'k_royal', eyes: 'e_void', blade: 'b_void' }, ['#c4b5ff', '#ff7a3a', '#dff6ff']],
    ['Rosewood · Top hat', { color: 'c_rose', mat: 'm_cloth', head: 'h_tophat', cape: 'k_ember', eyes: 'e_cyan', blade: 'b_steel' }, []],
    ['Moss · Hood', { color: 'c_moss', mat: 'm_cloth', head: 'h_hood', cape: 'k_moss', eyes: 'e_amber', blade: 'b_bone' }, ['#f2c86a']],
    ['Rime · Pale mask', { color: 'c_frost', mat: 'm_porcelain', head: 'h_mask', cape: 'k_sky', eyes: 'e_cyan', blade: 'b_glass' }, ['#dff6ff', '#8ff7ff']],
  ];
  variants.forEach(([n, lk, marks], i) => {
    const s2 = newSave(1); s2.look = lk; s2.marks = marks; s2.hasBlade = true;
    const look = lookFromSave(s2);
    if (lk.head === 'h_mask') look.head = 'mask', look.maskCol = '#f4f1ea';
    const x = 200 + i * 285; drawFigure(g, x, 880, look, 2.4, { ticks: 200 }); label(g, x, 930, n);
  });

  section(g, 60, 1010, 'Keepers of the shrines');
  const keepers = [['Wanderer', 'trades blocks', 'wanderer'], ['Smith', 'hones blades, forges hearths', 'smith'], ['Sage', 'grows vessels', 'sage'], ['Tailor', 'sells looks', 'tailor']];
  keepers.forEach(([n, sub, k], i) => { const x = 170 + i * 250; drawFigure(g, x, 1290, Object.assign({}, LOOKS[k]), 2.4, { ticks: 200 }, { blade: false }); label(g, x, 1340, n, sub); });

  section(g, 1100, 1010, 'Hollows');
  drawFigure(g, 1230, 1290, HUSK_LOOK('#ffb36b'), 2.3, { ticks: 200, st: { windup: 0.0 } }, { blade: false }); label(g, 1230, 1340, 'Husk', 'lunges with claws');
  drawFigure(g, 1490, 1290, BRUTE_LOOK('#ffb36b'), 2.3 * 1.32, { ticks: 200 }, { blade: false }); label(g, 1500, 1340, 'Brute', 'slams, sends ground waves');
  g.save(); g.translate(1760, 1170); g.scale(2, 2); drawWispSprite(g, 0, 0, 1.2, '#c4b5ff', { look: -1 }); g.restore(); label(g, 1760, 1340, 'Wisp', 'lantern moth, casts orbs');
  g.save(); g.translate(1980, 1180); g.scale(2.2, 2.2);
  const tr = []; for (let i = 0; i < 24; i++) tr.push(-60 + i * 2.5, 20 + Math.sin(i * 0.4) * 10);
  drawThreadSprite(g, 0, 0, 1.0, 120, tr); g.restore();
  label(g, 1980, 1340, 'Thread', 'your guide: the last stitch of her light');

  section(g, 60, 1400, 'Wardens · one holds every gate');
  const fakeG = { actors: [], time: 1.4, player: { x: 0 }, world: fakeWorld, tick: 0, net: null };
  const mgr = {};
  const ws = [['meadow', 'The Hollow Warden'], ['ember', 'The Pyre Knight'], ['glass', 'The Glass Widow'], ['frost', 'The Still Queen']];
  ws.forEach(([id, n], i) => {
    const spec = TYPES[id];
    const B = spec.arch === 'warden' ? new Warden(fakeG, mgr, spec, 0, 0, 0) : new Wraith(fakeG, mgr, spec, 0, 0, 0);
    const look = B.a.look;
    const x = 250 + i * 440;
    const sc = spec.arch === 'warden' ? 2.25 * 1.35 : 1.9 * 1.45;
    const pose = spec.arch === 'warden' ? { ticks: 200 } : { st: { mode: 'air', vy: 150 }, ticks: 120, bodyFx: (b) => { for (const k of [7, 8, 9, 10, 11, 12]) b.jointK[k] = 0.15; } };
    drawFigure(g, x, 1960, look, sc, pose);
    label(g, x, 2000, n);
  });
  const G = new Golem(fakeG, mgr, TYPES.hollow, 0, 0, 0);
  G.state = 'float';
  g.save(); g.translate(2040, 1780); g.scale(1.3, 1.3);
  G.c.x = 0; G.c.y = 0; for (const q of G.parts) { q.x = Math.cos(q.a) * 62; q.y = Math.sin(q.a) * 62; }
  G.drawFront(g);
  g.restore();
  label(g, 2040, 2000, 'The Unmade Heart');
}

// ---------------------------------------------------------------- maps (material swatches; in-game captures are composed in tools/sheets.mjs)
function maps() {
  const W = 2400, H = 2060;
  const g = board('maps', W, H, 'World Materials', 'seamless hand-made textures per biome: soil, stone, deepstone, moss, sand and the things you build');
  const cols = [['groundA', 'Surface'], ['groundB', 'Soil'], ['stone', 'Stone'], ['rock', 'Deepstone'], ['detail', 'Moss'], ['accent', 'Ore'], ['bark', 'Bark'], ['foliage', 'Foliage']];
  BIOMES.forEach((B, r) => {
    const y = 190 + r * 140;
    g.textAlign = 'left'; g.fillStyle = '#f3ece0'; g.font = '500 22px Cormorant'; g.fillText(B.name, 60, y + 60);
    cols.forEach(([k, n], i) => {
      const x = 290 + i * 118, im = IMG['tex/' + B.id + '_' + k];
      g.save(); g.beginPath(); g.roundRect(x, y, 104, 104, 12); g.clip(); if (im) g.drawImage(im, x, y, 104, 104); g.restore();
      if (r === 0) { g.fillStyle = 'rgba(243,236,224,.55)'; g.font = '600 11px Manrope'; g.textAlign = 'center'; g.fillText(n.toUpperCase(), x + 52, 178); }
    });
  });
  section(g, 1300, 200, 'Built blocks');
  const built = [['plank', '#9b7653', 'Planks'], ['brick', '#8f8a96', 'Brick'], ['ruin', '#a39d93', 'Old stone'], ['marble', '#e9e4dc', 'Plaster'], ['obsidian', '#2a2440', 'Nightglass'], ['ember', '#ff7a3a', 'Ember rock'], ['sand', '#b9a58c', 'Sand'], ['snow', '#eef4fa', 'Snow'], ['ice', '#a9d8f5', 'Ice']];
  const bmap = { plank: 'plank', brick: 'brick', ruin: 'stone', marble: 'plaster', obsidian: 'obsidian', ember: 'lava', sand: 'sand', snow: 'snow', ice: 'ice' };
  built.forEach(([m, c, n], i) => {
    const x = 1300 + (i % 3) * 140, y = 230 + Math.floor(i / 3) * 170;
    const im = IMG['tex/build_' + bmap[m]];
    g.save(); g.beginPath(); g.roundRect(x, y, 120, 120, 14); g.clip(); g.drawImage(im || texture(m, c), x, y, 120, 120); g.restore();
    g.fillStyle = 'rgba(243,236,224,.6)'; g.font = '600 11px Manrope'; g.textAlign = 'center'; g.fillText(n.toUpperCase(), x + 60, y + 140);
  });
  section(g, 60, 1000, 'In the world · captured from the game');
  const sc = [['meadow', 'The Pale Meadow'], ['glass', 'The Glass Wood'], ['hollow', 'The Hollow Below'], ['ember', 'The Ember Reach'], ['frost', 'The Frost Spires'], ['shrine', 'A shrine and its keeper']];
  sc.forEach(([id, n], i) => {
    const img = window.__scenes && window.__scenes[id];
    const x = 60 + (i % 3) * 770, y = 1030 + Math.floor(i / 3) * 510;
    if (img) { g.save(); g.beginPath(); g.roundRect(x, y, 740, 416, 16); g.clip(); g.drawImage(img, x, y, 740, 416); g.restore(); }
    label(g, x + 370, y + 450, n);
  });
  
}

// ---------------------------------------------------------------- props, items, ui, vfx
function assets() {
  const W = 2400, H = 1400;
  const g = board('assets', W, H, 'Props, Items & Effects', 'everything you find, carry, build and break');
  if (!Props.drawCampfire) return;
  section(g, 60, 200, 'Props');
  const sp = (n, h) => (x, y) => drawSprite(g, 'props/' + n, x, y + 10, h);
  const props = [
    ['Shrine', 'rest · save · respawn', sp('shrine', 180)], ['Campfire', '', sp('campfire', 130)], ['Blade in stone', 'your first weapon', sp('bladestone', 230)],
    ['Hearth', 'makes a home', sp('hearth', 120)], ['Lantern', '', sp('lantern', 180)], ['Gate banner', 'a warden holds this gate', sp('banner', 210)], ['Seed of light', 'how you arrived', sp('seed', 190)],
    ['Chest', 'glimmer, blocks, looks', (x, y) => { g.save(); g.translate(x, y); g.scale(2.4, 2.4); drawChest(g, 0, 0, 0, 1); g.restore(); }],
    ['Lost stitch', 'a line of lore', (x, y) => { g.save(); g.translate(x, y - 70); g.scale(2.2, 2.2); drawStitch(g, 0, 0, 1); g.restore(); }],
    ['Hollow nest', 'break it for light', (x, y) => { g.save(); g.translate(x, y); g.scale(1.4, 1.4); drawNest(g, 0, 0, 1, 0); g.restore(); }],
  ];
  props.forEach(([n, sub, fn], i) => { const x = 140 + i * 228, y = 520; floorGlow(g, x, y, 120); fn(x, y); label(g, x, y + 50, n, sub); });
  section(g, 60, 650, 'Blocks you carry');
  const blocks = [T.DIRT, T.STONE, T.DEEP, T.SAND, T.SNOW, T.LOG, T.PLANK, T.BRICK, T.GLASS, T.MARBLE, T.OBSIDIAN, T.CRYSTAL, T.GOLD, T.EMBER, T.ICE, T.LANTERN, T.HEARTH];
  blocks.forEach((t, i) => { const x = 110 + i * 132, y = 760; const ic = IMG['icons/b_' + TILE_ICON[t]]; if (ic) g.drawImage(ic, x - 32, y - 28, 64, 64 * ic.height / ic.width); else Props.drawBlockIcon(g, x, y, t, 46); g.fillStyle = 'rgba(243,236,224,.55)'; g.font = '600 10px Manrope'; g.textAlign = 'center'; g.fillText(TILES[t].name.toUpperCase(), x, y + 70); });
  section(g, 60, 900, 'Interface');
  const icon = (n) => (x, y) => { const im = IMG['icons/' + n]; if (im) g.drawImage(im, x - 36, y - 36, 72, 72 * im.height / im.width); };
  const ui = [['Vessel', icon('vessel')], ['Empty vessel', icon('vessel_empty')], ['Glimmer', icon('glimmer')], ['Second Wind', icon('r_djump')], ['Grip of Glass', icon('r_wall')], ['Plunge', icon('r_plunge')], ['Ember Surge', icon('r_surge')], ['Stillheart', icon('r_vessel')]];
  ui.forEach(([n, fn], i) => { const x = 130 + i * 200, y = 1000; fn(x, y); label(g, x, y + 70, n); });
  section(g, 60, 1130, 'Effects');
  const fxi = (n) => (x, y) => { const im = IMG['fx/' + n]; if (im) { const h = 150, w = im.width * h / im.height; g.drawImage(im, x - w / 2, y - h / 2, w, h); } };
  const fx = [['Slash', fxi('slash')], ['Hit spark', fxi('spark')], ['Shockwave', fxi('wave')], ['Soul glimmer', fxi('souls')], ['Dust', fxi('dust')], ['Thread trail', fxi('thread')]];
  fx.forEach(([n, fn], i) => { const x = 180 + i * 330, y = 1240; fn(x, y); label(g, x, y + 110, n); });
}

// ---------------------------------------------------------------- requests: art to be hand-painted
function requests() {
  const W = 2400, H = 1720;
  const g = board('requests', W, H, 'Art requests', 'paint these to replace the placeholders: same style as your sheets, transparent PNG, one per slot');
  const slot = (x, y, w, h, name, size, note, draw) => {
    g.save();
    g.fillStyle = 'rgba(255,255,255,.03)'; g.beginPath(); g.roundRect(x, y, w, h, 16); g.fill();
    g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,240,220,.25)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x, y, w, h, 16); g.stroke(); g.setLineDash([]);
    g.restore();
    g.save(); g.beginPath(); g.rect(x, y, w, h - 54); g.clip(); draw(x + w / 2, y + (h - 54) / 2 + 6); g.restore();
    label(g, x + w / 2, y + h - 30, name, size + (note ? ' · ' + note : ''));
  };
  const part = (t, k = 3.2, two) => (cx, cy) => { g.save(); g.translate(cx - 16 * k, cy - (two ? 32 : 16) * k); g.scale(k, k); if (two) { drawPart(g, t, 0, 0, (dx, dy) => (dy === 1 ? t : 0)); drawPart(g, t, 0, 32, (dx, dy) => (dy === -1 ? t : 0)); } else drawPart(g, t, 0, 0, (dx, dy) => (dy === 1 ? 1 : 0)); g.restore(); };
  const icon = (id) => (cx, cy) => drawItemIcon(g, id, cx, cy, 120);
  section(g, 60, 196, 'Characters and world');
  const sv = newSave(3); const doll = lookFromSave(sv); doll.blade = null;
  slot(60, 220, 420, 300, 'Sleeping doll', '256 x 160', 'curled on its side, on moss', (cx, cy) => drawFigure(g, cx - 20, cy + 50, doll, 2.2, { st: { mode: 'sleep' }, ticks: 240 }, { blade: false }));
  slot(500, 220, 420, 300, 'Turf into soil', '128 x 128 per biome', 'seamless, grass top fading into soil', (cx, cy) => {
    const a = IMG['tex/meadow_groundA'], b = IMG['tex/meadow_groundB'];
    if (b) g.drawImage(b, cx - 96, cy - 96, 192, 192);
    if (a) { g.save(); g.beginPath(); g.moveTo(cx - 96, cy - 96); g.lineTo(cx + 96, cy - 96); for (let i = 8; i >= 0; i--) g.lineTo(cx - 96 + i * 24, cy - 40 + Math.sin(i * 2.1) * 14); g.closePath(); g.clip(); g.drawImage(a, cx - 96, cy - 96, 192, 192); g.restore(); }
  });
  slot(940, 220, 420, 300, 'Cave mouth', '256 x 256', 'arched opening edge, any biome', (cx, cy) => {
    g.fillStyle = '#2a2430'; g.beginPath(); g.ellipse(cx, cy + 40, 110, 90, 0, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(243,236,224,.35)'; g.font = 'italic 18px Cormorant'; g.textAlign = 'center'; g.fillText('currently: plain carved tiles', cx, cy + 90);
  });
  slot(1380, 220, 420, 300, 'Hollow nest', '256 x 200', 'thorned mound with a glowing heart', (cx, cy) => { g.save(); g.translate(cx, cy + 60); g.scale(1.6, 1.6); drawNest(g, 0, 0, 1, 0); g.restore(); });
  slot(1820, 220, 520, 300, 'Satchel', '256 x 200', 'open leather bag (UI and on the doll)', (cx, cy) => {
    g.fillStyle = '#6e523b'; g.beginPath(); g.roundRect(cx - 80, cy - 30, 160, 100, [14, 14, 30, 30]); g.fill();
    g.fillStyle = '#8a6a4c'; g.beginPath(); g.moveTo(cx - 80, cy - 30); g.quadraticCurveTo(cx, cy - 90, cx + 80, cy - 30); g.fill();
  });
  section(g, 60, 586, 'Building parts and stations');
  const parts = [[T.LADDER, 'Ladder', '64 x 64 tile'], [T.PLATFORM, 'Platform', '64 x 64 tile'], [T.TORCH, 'Torch', '64 x 64'], [T.DOOR, 'Door', '64 x 128', true], [T.STEP, 'Step', '64 x 64'], [T.STORE, 'Storage chest', '64 x 64'], [T.BENCH, 'Workbench', '64 x 64'], [T.FORGE, 'Forge', '64 x 64'], [T.LOOM, 'Loom', '64 x 64']];
  parts.forEach(([t, n, sz, two], i) => slot(60 + i * 254, 610, 236, 330, n, sz, '', part(t, two ? 2.6 : 3.6, two)));
  section(g, 60, 1006, 'Items and gear');
  const items = [['i_draught', 'Mending draught'], ['i_flare', 'Flare'], ['i_charge', 'Blast charge'], ['g_lamp', "Miner's lamp"], ['g_pick_gilt', 'Gilt pick'], ['g_pick_crystal', 'Crystal pick'], ['g_charm_thread', 'Thread charm'], ['g_charm_ember', 'Ember charm']];
  items.forEach(([id, n], i) => slot(60 + i * 286, 1030, 266, 280, n, '128 x 128 icon', '', icon(id)));
  section(g, 60, 1376, 'Interface');
  slot(60, 1400, 520, 270, 'Item slot frame', '96 x 96, 9-slice', 'empty, hover, selected', (cx, cy) => { for (let i = 0; i < 3; i++) { g.strokeStyle = ['rgba(255,240,220,.25)', 'rgba(255,217,160,.6)', '#9ff3ff'][i]; g.lineWidth = 2; g.beginPath(); g.roundRect(cx - 190 + i * 130, cy - 50, 100, 100, 16); g.stroke(); } });
  slot(600, 1400, 520, 270, 'Crafting ring', '256 x 256', 'the circle the result appears in', (cx, cy) => { g.strokeStyle = 'rgba(255,217,160,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 80, 0, TAU); g.stroke(); g.setLineDash([5, 6]); g.beginPath(); g.arc(cx, cy, 94, 0, TAU); g.stroke(); g.setLineDash([]); });
  slot(1140, 1400, 520, 270, 'Panel backdrop', '9-slice', 'satchel and crafting panels', (cx, cy) => { g.fillStyle = 'rgba(20,17,26,.9)'; g.strokeStyle = 'rgba(255,244,228,.14)'; g.beginPath(); g.roundRect(cx - 200, cy - 80, 400, 160, 18); g.fill(); g.stroke(); });
  slot(1680, 1400, 660, 270, 'Touch buttons', '160 x 160 each', 'Strike, Jump, Dash, Mend, Build, Bag, Talk', (cx, cy) => { for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(255,240,220,.4)'; g.lineWidth = 2; g.beginPath(); g.arc(cx - 240 + i * 120, cy, 46, 0, TAU); g.stroke(); } });
}

// ---------------------------------------------------------------- towns: rough sheet of what to paint
function towns() {
  const W = 2400, H = 1980;
  const g = board('towns', W, H, 'Town requests', 'rough placeholders: paint over these at the sizes shown (front view, transparent PNG, warm and lived-in)');
  const slot = (x, y, w, h, name, size, note, draw) => {
    g.save();
    g.fillStyle = 'rgba(255,255,255,.03)'; g.beginPath(); g.roundRect(x, y, w, h, 16); g.fill();
    g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,240,220,.25)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x, y, w, h, 16); g.stroke(); g.setLineDash([]);
    g.restore();
    g.save(); g.beginPath(); g.rect(x, y, w, h - 54); g.clip(); draw(x + w / 2, y + h - 64); g.restore();
    label(g, x + w / 2, y + h - 30, name, size + (note ? ' · ' + note : ''));
  };
  // a rough facade: plaster or brick wall, timber frame, windows, a gabled roof, the shop sign
  const facade = (B) => (cx, gy) => {
    const k = 0.9, w = B.w * 32 * k, h = B.h * 32 * k, x0 = cx - w / 2;
    const wall = B.wall === T.BRICK ? '#7d6f6a' : B.wall === T.PLANK ? '#8a6a4c' : '#d9d0c2';
    g.fillStyle = wall; g.fillRect(x0, gy - h, w, h);
    g.fillStyle = '#5e4330';
    for (let i = 0; i <= B.w; i += (B.w > 8 ? 4 : B.w - 1)) g.fillRect(x0 + Math.min(i, B.w - 1) * 32 * k, gy - h, 32 * k * 0.3, h);
    g.fillRect(x0, gy - h, w, 6);
    for (let i = 1; i < B.w - 1; i += 3) { g.fillStyle = '#ffd08a'; g.fillRect(x0 + i * 32 * k + 6, gy - h * 0.6, 32 * k - 12, 32 * k * 1.4); g.strokeStyle = '#5e4330'; g.lineWidth = 2; g.strokeRect(x0 + i * 32 * k + 6, gy - h * 0.6, 32 * k - 12, 32 * k * 1.4); }
    g.fillStyle = '#3a2c2a'; g.fillRect(cx - 14, gy - 54, 28, 54);
    g.fillStyle = '#8a4a3c'; g.beginPath(); g.moveTo(x0 - 22, gy - h); g.lineTo(cx, gy - h - Math.min(130, w * 0.45)); g.lineTo(x0 + w + 22, gy - h); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let i = 1; i < 6; i++) { const yy = gy - h - i * Math.min(130, w * 0.45) / 6; g.beginPath(); g.moveTo(x0 - 22 + i * 10, yy); g.lineTo(x0 + w + 22 - i * 10, yy); g.stroke(); }
    if (B.kind !== 'house') { g.fillStyle = '#6b4a32'; g.beginPath(); g.roundRect(cx - 34, gy - h - 6, 68, 22, 4); g.fill(); g.fillStyle = '#e9d9b8'; g.font = '600 11px Manrope'; g.textAlign = 'center'; g.fillText(B.name.toUpperCase(), cx, gy - h + 9); }
  };
  section(g, 60, 196, 'Buildings: painted fronts (they cover the tile building; doors stay open)');
  const kinds = []; for (const B of BUILDINGS) if (!kinds.some(k => k.kind === B.kind && B.kind === 'house')) kinds.push(B);
  const bw = [330, 380, 380, 470, 330, 330];
  let x = 60;
  kinds.slice(0, 6).forEach((B, i) => { const w = bw[i] || 330; slot(x, 220, w, 470, B.name, `${(B.w + 2) * 32 * 2} x ${(B.h + 4) * 32 * 2}`, B.kind === 'inn' ? 'two floors' : '', facade(B)); x += w + 20; });
  section(g, 60, 756, 'Props');
  const fake = { player: { sv: {} }, world: { col: () => ({ h: 0 }) }, time: 1 };
  const T0 = new Towns(fake);
  const props = [['waystone', 'Waystone', '128 x 256', 'glows when you travel'], ['well', 'Well', '160 x 192', ''], ['board', 'Notice board', '160 x 160', 'bounty papers'], ['stall', 'Market stall', '192 x 192', 'awning, crates'], ['lamp', 'Lamp post', '96 x 256', 'lit at night'], ['gate', 'Town gate banner', '96 x 160', 'per biome colour'], ['yard', 'Training yard', '192 x 192', 'target, rift sign']];
  props.forEach(([k, n, sz, note], i) => slot(60 + i * 326, 780, 306, 340, n, sz, note, (cx, gy) => { g.save(); g.translate(cx, gy); g.scale(1.7, 1.7); T0.drawProp(g, k, 0, k === 'gate' ? 150 : 0, 1, { bi: 0 }); g.restore(); }));
  section(g, 60, 1186, 'Tiles (seamless 64 x 64)');
  const tile = (col, lines) => (cx, gy) => { const s = 150; g.fillStyle = col; g.fillRect(cx - s / 2, gy - s, s, s); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; lines(cx - s / 2, gy - s, s); };
  slot(60, 1210, 360, 290, 'Roof tiles', '64 x 64', 'clay shingles', tile('#8a4a3c', (x0, y0, s) => { for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { g.beginPath(); g.arc(x0 + c * 30 + (r % 2) * 15 + 15, y0 + r * 30 + 30, 15, Math.PI, 0); g.stroke(); } }));
  slot(440, 1210, 360, 290, 'Cobbled street', '64 x 64', 'worn stones', tile('#8d857b', (x0, y0, s) => { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.beginPath(); g.roundRect(x0 + c * 37 + (r % 2) * 18 + 3, y0 + r * 37 + 3, 31, 31, 8); g.stroke(); } }));
  slot(820, 1210, 360, 290, 'Timber beam', '64 x 64', 'dark frame wood', tile('#5e4330', (x0, y0, s) => { for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x0, y0 + i * 25 + 12); g.lineTo(x0 + s, y0 + i * 25 + 8); g.stroke(); } }));
  slot(1200, 1210, 360, 290, 'Plaster wall', '64 x 64', 'back wall inside houses', tile('#d9d0c2', () => {}));
  slot(1580, 1210, 360, 290, 'Lit window', '64 x 64', 'warm glass, two variants', tile('#ffd08a', (x0, y0, s) => { g.strokeStyle = '#5e4330'; g.lineWidth = 8; g.strokeRect(x0 + 4, y0 + 4, s - 8, s - 8); g.beginPath(); g.moveTo(x0 + s / 2, y0); g.lineTo(x0 + s / 2, y0 + s); g.moveTo(x0, y0 + s / 2); g.lineTo(x0 + s, y0 + s / 2); g.stroke(); }));
  slot(1960, 1210, 380, 290, 'Shop signs', '128 x 64 each', 'anvil, bag, needle, flask, bed', (cx, gy) => { ['ANVIL', 'BAG', 'NEEDLE', 'FLASK', 'BED'].forEach((t, i) => { g.fillStyle = '#6b4a32'; g.beginPath(); g.roundRect(cx - 170 + i * 70, gy - 120 + (i % 2) * 40, 60, 30, 4); g.fill(); g.fillStyle = '#e9d9b8'; g.font = '600 10px Manrope'; g.textAlign = 'center'; g.fillText(t, cx - 140 + i * 70, gy - 100 + (i % 2) * 40); }); });
  section(g, 60, 1566, 'Townsfolk (front view, 3/4 is fine) and shop icons');
  const folk = [['Merchant', 'wanderer'], ['Smith', 'smith'], ['Tailor', 'tailor'], ['Alchemist', 'sage'], ['Innkeeper', 'wanderer'], ['Child', 'tailor']];
  folk.forEach(([n, k], i) => slot(60 + i * 250, 1590, 230, 340, n, '256 x 384', '', (cx, gy) => drawFigure(g, cx, gy - 10, Object.assign({}, LOOKS[k]), i === 5 ? 1.5 : 2.1, { st: { mode: 'ground' }, ticks: 30 }, { blade: false })));
  slot(1580, 1590, 760, 340, 'Shop UI icons', '96 x 96 each', 'buy, sell, temper, rest, travel, bounty', (cx, gy) => { ['BUY', 'SELL', 'TEMPER', 'REST', 'TRAVEL', 'BOUNTY'].forEach((t, i) => { const x = cx - 300 + i * 120, y = gy - 120; g.strokeStyle = 'rgba(255,240,220,.45)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 42, 0, TAU); g.stroke(); g.fillStyle = 'rgba(243,236,224,.6)'; g.font = '600 11px Manrope'; g.textAlign = 'center'; g.fillText(t, x, y + 4); }); });
}

// ---------------------------------------------------------------- requests 2: cutscene, rigs, weapons, effects
function requests2() {
  const W = 2400, H = 2380;
  const g = board('requests2', W, H, 'Art requests II', 'cutscene plates, enemy and warden rig parts, weapons and effects: the current build shown in each slot, paint over it');
  const slot = (x, y, w, h, name, size, note, draw) => {
    g.save();
    g.fillStyle = 'rgba(255,255,255,.03)'; g.beginPath(); g.roundRect(x, y, w, h, 16); g.fill();
    g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,240,220,.25)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x, y, w, h, 16); g.stroke(); g.setLineDash([]);
    g.restore();
    g.save(); g.beginPath(); g.rect(x + 10, y + 10, w - 20, h - 74); g.clip(); draw(x + w / 2, y + (h - 64) / 2 + 5, w - 20, h - 74); g.restore();
    label(g, x + w / 2, y + h - 34, name, size + (note ? ' · ' + note : ''));
  };
  const note = (x, y, lines) => { g.fillStyle = 'rgba(243,236,224,.55)'; g.font = 'italic 500 19px Cormorant'; g.textAlign = 'left'; lines.forEach((t, i) => g.fillText(t, x, y + i * 24)); };
  const P = new PrologueArt(); P.p.finish();
  const plate = (name) => (cx, cy, w, h) => { const im = P.p.get(name); if (!im) return; const k = Math.min(w / im.width, h / im.height); g.drawImage(im, cx - im.width * k / 2, cy - im.height * k / 2, im.width * k, im.height * k); };
  section(g, 60, 196, 'Cutscene: vista layers (1600 x 900 each, saved as assets/cine/<name>.png)');
  note(60, 226, ['Four layers that slide at different speeds: sky is opaque, the other three are transparent above their shapes. Keep the low sun at the left third and the rose window on the centre line.']);
  [['sky', 'opaque'], ['far', 'transparent, distant ridges'], ['cath', 'transparent, the Loom-Cathedral'], ['near', 'transparent, framing cliffs']].forEach(([n, t], i) => slot(60 + i * 575, 250, 555, 380, 'cine/' + n + '.png', '1600 x 900', t, plate(n)));
  section(g, 60, 696, 'Cutscene: the five Warden portraits (1600 x 900, full plate)');
  note(60, 726, ['One figure, centred, standing on the lower tenth; keep the top 12% and the band at 76 to 84% calm for the lore line and the name card. Clean, sleek, minimal: big readable shapes, one light.']);
  WARDEN_INFO.forEach((wi, i) => slot(60 + i * 460, 750, 440, 330, 'cine/w' + i + '.png', '1600 x 900', wi.name, plate('w' + i)));
  section(g, 60, 1146, 'In-game rigs: separate parts per character (side view facing right, transparent PNG)');
  note(60, 1176, ['Each character is a jointed doll: head, torso, pelvis, upper arm, forearm, hand, thigh, shin, foot. Paint each part on its own, joints as round ends so they rotate cleanly.', 'Name them rig/<character>/<part>.png. Sizes are for a doll 120 px tall (the in-game doll is about 64 px; I scale down).']);
  const rigDiagram = (cx, cy) => {
    const parts = [['head', 0, -96, 22, 22], ['torso', 0, -48, 24, 34], ['pelvis', 0, -6, 20, 10], ['upper arm', -54, -56, 8, 22], ['forearm', -54, -14, 7, 20], ['hand', -54, 14, 7, 7], ['thigh', 54, -14, 9, 24], ['shin', 54, 30, 8, 22], ['foot', 54, 62, 14, 6]];
    for (const [n, dx, dy, rx, ry] of parts) { g.strokeStyle = 'rgba(255,217,160,.6)'; g.lineWidth = 2; g.beginPath(); g.roundRect(cx + dx - rx, cy + dy - ry, rx * 2, ry * 2, Math.min(rx, ry)); g.stroke(); g.fillStyle = 'rgba(243,236,224,.6)'; g.font = '500 12px Manrope'; g.textAlign = 'center'; g.fillText(n, cx + dx + (dx < 0 ? -48 : dx > 0 ? 50 : 52), cy + dy + 4); }
  };
  slot(60, 1226, 440, 400, 'Part layout', 'one PNG per part', 'joint at each end', rigDiagram);
  const eye = '#ff6a4a';
  const rigs = [['Husk', HUSK_LOOK(eye), 2.6], ['Lancer', LANCER_LOOK(eye), 2.6], ['Slinger', SLINGER_LOOK(eye), 2.6], ['Brute', BRUTE_LOOK(eye), 2.2]];
  rigs.forEach(([n, look, sc], i) => slot(520 + i * 330, 1226, 310, 400, n, 'rig/' + n.toLowerCase() + '/', 'parts', (cx, cy) => drawFigure(g, cx, cy + 130, look, sc, { st: { mode: 'ground' }, ticks: 40 }, { blade: true })));
  slot(1860, 1226, 480, 400, 'Wisp', '192 x 192', 'one sprite, 4-frame wing loop', (cx, cy) => { g.save(); g.translate(cx, cy); g.scale(2.4, 2.4); drawWispSprite(g, 0, 0, 1.3, eye); g.restore(); });
  section(g, 60, 1692, 'Weapons and effects (transparent PNG)');
  note(60, 1722, ['Weapons lie flat pointing right, grip at the left, as they are held. Effects are additive glows on black or transparent.']);
  const icon = (id) => (cx, cy) => drawItemIcon(g, id, cx, cy, 150);
  [['w_blade', 'Blade', '256 x 64'], ['w_spear', 'Spear', '384 x 64'], ['w_hammer', 'Greathammer', '256 x 128'], ['w_daggers', 'Twin daggers', '128 x 48 each'], ['w_sling', 'Sling', '128 x 128']].forEach(([id, n, sz], i) => slot(60 + i * 300, 1746, 280, 300, n, sz, 'weapons/' + id.slice(2) + '.png', icon(id)));
  const fxSlot = (draw) => (cx, cy) => { g.save(); g.globalCompositeOperation = 'lighter'; draw(cx, cy); g.restore(); };
  slot(1560, 1746, 380, 300, 'Infusion glows', '256 x 64 each', 'ember, frost', fxSlot((cx, cy) => { [['#ff8a3a', -40], ['#9ff3ff', 40]].forEach(([c, dy]) => { const gr = g.createLinearGradient(cx - 120, 0, cx + 120, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.strokeStyle = gr; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 120, cy + dy); g.lineTo(cx + 120, cy + dy); g.stroke(); }); }));
  slot(1960, 1746, 380, 300, 'Double jump', '192 x 96', 'a ring of light under the feet', fxSlot((cx, cy) => { g.strokeStyle = '#bff6ff'; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy + 30, 80, 20, 0, 0, TAU); g.stroke(); g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy + 30, 50, 12, 0, 0, TAU); g.stroke(); }));
  slot(60, 2066, 560, 270, 'Rift tear', '256 x 384', 'a vertical wound in the air, cyan core', fxSlot((cx, cy) => { const gr = g.createLinearGradient(cx - 30, 0, cx + 30, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, '#9ff3ff'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy - 90); g.quadraticCurveTo(cx + 30, cy, cx, cy + 90); g.quadraticCurveTo(cx - 30, cy, cx, cy - 90); g.closePath(); g.fill(); }));
  slot(640, 2066, 900, 270, 'Level bar frame', '9-slice, 640 x 24', 'thin line, a round badge for the number at its left', (cx, cy) => {
    g.strokeStyle = 'rgba(255,240,220,.4)'; g.lineWidth = 2; g.beginPath(); g.roundRect(cx - 300, cy - 5, 640, 10, 5); g.stroke();
    g.fillStyle = 'rgba(159,214,224,.8)'; g.beginPath(); g.roundRect(cx - 300, cy - 5, 380, 10, 5); g.fill();
    g.fillStyle = '#16131c'; g.strokeStyle = 'rgba(255,217,160,.7)'; g.beginPath(); g.arc(cx - 340, cy, 30, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#f3ece0'; g.font = '500 28px Cormorant'; g.textAlign = 'center'; g.fillText('7', cx - 340, cy + 9);
  });
  slot(1560, 2066, 780, 270, 'Tutorial card frame', '9-slice, 720 x 420', 'the panel that teaches each new thing', (cx, cy) => { g.fillStyle = 'rgba(20,17,26,.92)'; g.strokeStyle = 'rgba(255,217,160,.35)'; g.lineWidth = 2; g.beginPath(); g.roundRect(cx - 220, cy - 90, 440, 180, 14); g.fill(); g.stroke(); g.strokeStyle = 'rgba(255,240,220,.15)'; g.strokeRect(cx - 200, cy - 72, 160, 144); });
}

setBase('../assets/');
const loadImg = (src) => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
Promise.all(['meadow', 'glass', 'hollow', 'ember', 'frost', 'shrine'].map(id => loadImg('../art/sheets/scenes/' + id + '.png').then(i => [id, i])))
  .then(list => { window.__scenes = Object.fromEntries(list); return loadImages(); }).then(() => document.fonts.ready).then(() => {
  try { characters(); } catch (e) { console.error('characters', e.stack); }
  try { maps(); } catch (e) { console.error('maps', e.stack); }
  try { assets(); } catch (e) { console.error('assets', e.stack); }
  try { requests(); } catch (e) { console.error('requests', e.stack); }
  try { towns(); } catch (e) { console.error('towns', e.stack); }
  try { requests2(); } catch (e) { console.error('requests2', e.stack); }
  window.__sheetsDone = true;
});
