// Image assets cut from the art sheets (tools/extract_assets.py). Loaded in the background at boot;
// every user of an image has a procedural fallback, so nothing waits on the network.
const BIOMES = ['meadow', 'glass', 'hollow', 'ember', 'frost'];
const TEX = [];
for (const b of BIOMES) for (const k of ['groundA', 'groundB', 'rock', 'detail', 'accent', 'stone', 'ore', 'bark', 'foliage']) TEX.push(`tex/${b}_${k}`);
for (const k of ['plank', 'brick', 'stone', 'plaster', 'obsidian', 'lava', 'sand', 'snow', 'ice']) TEX.push(`tex/build_${k}`);
const PROPS = ['shrine', 'campfire', 'bladestone', 'hearth', 'lantern', 'banner', 'seed'].map(n => 'props/' + n);
const ICONS = ['stone', 'deepstone', 'shadowstone', 'sandstone', 'snow', 'earth', 'wood', 'planks', 'brick', 'ice', 'marble', 'obsidian', 'rootcrystal', 'sunstone', 'emberrock', 'rime', 'lantern', 'brazier'].map(n => 'icons/b_' + n)
  .concat(['vessel', 'vessel_empty', 'glimmer', 'r_djump', 'r_wall', 'r_plunge', 'r_surge', 'r_vessel'].map(n => 'icons/' + n));
const FX = ['slash', 'spark', 'wave', 'souls', 'dust', 'thread'].map(n => 'fx/' + n);

export const IMG = {};
let base = 'assets/';
export function setBase(b) { base = b; }
export function loadImages() {
  const all = [...TEX, ...PROPS, ...ICONS, ...FX];
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
// draw a sprite with its base centred at (x, y), height h (width follows the aspect)
export function drawSprite(g, name, x, y, h, o = {}) {
  const im = IMG[name];
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
