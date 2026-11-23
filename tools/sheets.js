// Asset sheets: renders the game's real art code onto presentation boards.
import { Body, P } from '../js/physics/body.js';
import { Animator } from '../js/physics/pose.js';
import { Cape, drawShadow } from '../js/physics/skin.js';
import { drawDoll } from '../js/art/doll.js';
import { lookFromSave, newSave } from '../js/game/progress.js';
import { LOOKS } from '../js/game/npcs.js';
import { HUSK_LOOK, BRUTE_LOOK, drawWispSprite } from '../js/game/enemies.js';
import { TYPES, Warden, Wraith, Golem } from '../js/game/bosses.js';
import { drawThreadSprite } from '../js/game/thread.js';
import { drawGlow } from '../js/world/light.js';
import { hexToRgb, rgba, TAU } from '../js/core/util.js';
import * as Props from '../js/art/props.js';
import { drawChest, drawStitch, drawNest } from '../js/game/content.js';
import { texture, grassLip, snowLip } from '../js/art/tex.js';
import { BIOMES, T, TILES } from '../js/world/tiles.js';
import { loadImages, setBase, IMG, drawSprite, TILE_ICON } from '../js/art/images.js';

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

  section(g, 60, 600, 'Make it yours · body, material, head, cape, eyes, blade, warden marks');
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

setBase('../assets/');
const loadImg = (src) => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
Promise.all(['meadow', 'glass', 'hollow', 'ember', 'frost', 'shrine'].map(id => loadImg('../art/sheets/scenes/' + id + '.png').then(i => [id, i])))
  .then(list => { window.__scenes = Object.fromEntries(list); return loadImages(); }).then(() => document.fonts.ready).then(() => {
  try { characters(); } catch (e) { console.error('characters', e.stack); }
  try { maps(); } catch (e) { console.error('maps', e.stack); }
  try { assets(); } catch (e) { console.error('assets', e.stack); }
  window.__sheetsDone = true;
});
