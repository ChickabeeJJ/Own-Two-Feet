// Image assets cut from the art sheets (tools/extract_assets.py). Loaded in the background at boot;
// every user of an image has a procedural fallback, so nothing waits on the network.
const BIOMES = ['meadow', 'glass', 'hollow', 'ember', 'frost'];
const TEX = [];
for (const b of BIOMES) for (const k of ['groundA', 'groundB', 'rock', 'detail', 'accent', 'stone', 'ore', 'bark', 'foliage']) TEX.push(`tex/${b}_${k}`);
for (const k of ['plank', 'brick', 'stone', 'plaster', 'obsidian', 'lava', 'sand', 'snow', 'ice']) TEX.push(`tex/build_${k}`);
const PROPS = ['shrine', 'campfire', 'bladestone', 'hearth', 'lantern', 'banner', 'seed'].map(n => 'props/' + n);
const ICONS = ['stone', 'deepstone', 'shadowstone', 'sandstone', 'snow', 'earth', 'wood', 'planks', 'brick', 'ice', 'marble', 'obsidian', 'rootcrystal', 'sunstone', 'emberrock', 'rime', 'lantern', 'brazier'].map(n => 'icons/b_' + n)
  .concat(['vessel', 'vessel_empty', 'glimmer', 'r_djump', 'r_wall', 'r_plunge', 'r_surge', 'r_vessel'].map(n => 'icons/' + n));
const TREES = ['meadow', 'glass', 'hollow', 'ember', 'frost'].map(n => 'trees/' + n);
const REQ = ['cave_mouth', 'nest', 'satchel', 'ladder', 'platform', 'door', 'step', 'chest', 'bench', 'forge', 'loom', 'draught', 'flare', 'charge', 'lamp', 'pick_gilt', 'pick_crystal', 'charm_thread', 'charm_ember'].map(n => 'req/' + n);
const FX = ['slash', 'spark', 'wave', 'souls', 'dust', 'thread'].map(n => 'fx/' + n);

export const IMG = {};
let base = 'assets/';
export function setBase(b) { base = b; }
export function loadImages() {
  const all = [...TEX, ...PROPS, ...ICONS, ...FX, ...TREES, ...REQ];
  return Promise.all(all.map(name => new Promise(res => {
    const im = new Image();
    im.onload = () => { IMG[name] = im; res(); };
    im.onerror = () => res();
    im.src = base + name + '.png';
  })));
}
export const img = name => IMG[name] || null;

// world patterns: one texture covers 2x2 tiles
const pats = new Map();
export function texPattern(g, name, scale = 0.5) {
  const im = IMG['tex/' + name];
  if (!im) return null;
  const key = name + scale;
  let p = pats.get(key);
  if (!p) {
    p = g.createPattern(im, 'repeat');
    if (p && p.setTransform) p.setTransform(new DOMMatrix().scale(scale));
    pats.set(key, p);
  }
  return p;
}
// The sheets were painted on a neutral board; in the world each sprite is graded toward its biome so it
// sits in the light: a little less saturated, slightly softer contrast, washed toward the biome's haze at
// the top and darkened toward the ground at the foot. Cached per sprite and biome.
const graded = new Map();
const filterOK = (() => { try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'saturate(0.5)'; return c.filter === 'saturate(0.5)'; } catch (e) { return false; } })();
export function gradedImg(name, B) {
  const im = IMG[name];
  if (!im || !B) return im || null;
  const key = name + '|' + B.id;
  let c = graded.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d');
  const sat = { meadow: 0.88, glass: 0.92, hollow: 0.85, ember: 0.9, frost: 0.78 }[B.id] ?? 0.88;
  if (filterOK) g.filter = `saturate(${sat}) contrast(0.94) brightness(0.96)`;
  g.drawImage(im, 0, 0);
  g.filter = 'none';
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, 0, 0, c.height);
  gr.addColorStop(0, hexA(B.sunCol, 0.1)); gr.addColorStop(0.55, hexA(B.fog, 0.08)); gr.addColorStop(1, hexA(B.deep || '#000000', 0.28));
  g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  graded.set(key, c);
  return c;
}
function hexA(hex, a) { if (!hex) return `rgba(0,0,0,${a})`; const n = parseInt(String(hex).slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
// draw a sprite with its base centred at (x, y), height h (width follows the aspect); o.grade = biome
export function drawSprite(g, name, x, y, h, o = {}) {
  const im = o.grade ? gradedImg(name, o.grade) : IMG[name];
  if (!im) return false;
  const w = im.width * h / im.height;
  if (o.alpha !== undefined) g.globalAlpha = o.alpha;
  if (o.add) { const c = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; g.drawImage(im, x - w / 2, y - h * (o.anchorY ?? 1), w, h); g.globalCompositeOperation = c; }
  else g.drawImage(im, x - w / 2, y - h * (o.anchorY ?? 1), w, h);
  if (o.alpha !== undefined) g.globalAlpha = 1;
  return true;
}
// tile -> icon name for the hotbar and menus
export const TILE_ICON = {
  1: 'earth', 2: 'earth', 3: 'stone', 4: 'deepstone', 5: 'wood', 7: 'sandstone', 8: 'rootcrystal', 9: 'planks', 10: 'brick', 11: 'rime',
  12: 'lantern', 13: 'ice', 14: 'emberrock', 15: 'stone', 16: 'snow', 17: 'sunstone', 18: 'brazier', 19: 'shadowstone', 23: 'marble', 24: 'obsidian',
};
export function iconURL(tile) { const n = TILE_ICON[tile]; return n ? base + 'icons/b_' + n + '.png' : null; }
export { BIOMES };
