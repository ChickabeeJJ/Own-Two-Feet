// Save data, cosmetics catalog, unlocks, recipes, upgrade costs.
import { T } from '../world/tiles.js';
import { hashStr, mulberry } from '../core/util.js';
import { Platform } from '../platform.js';

export const SAVE_KEY = 'otf_save_v1';

// ---------------- cosmetics ----------------
// each entry: id, name, slot, value, how (unlock hint), cost (glimmer at the Tailor) or src
export const COSMETICS = [
  // body colours
  { id: 'c_bone', slot: 'color', name: 'Bone', v: ['#e9e2d4', '#bfb5a3'], how: 'Born with it' },
  { id: 'c_ash', slot: 'color', name: 'Ash', v: ['#9a97a0', '#76737d'], cost: 60, how: 'Tailor' },
  { id: 'c_ink', slot: 'color', name: 'Ink', v: ['#34303d', '#24212b'], cost: 140, how: 'Tailor' },
  { id: 'c_rose', slot: 'color', name: 'Rosewood', v: ['#e3b1aa', '#bd8c86'], cost: 90, how: 'Tailor' },
  { id: 'c_moss', slot: 'color', name: 'Moss', v: ['#a9c09c', '#829a77'], src: 'meadow', how: 'Walk the Pale Meadow' },
  { id: 'c_sea', slot: 'color', name: 'Seaglass', v: ['#a6dcd4', '#7cb2ab'], src: 'glass', how: 'Reach the Glass Wood' },
  { id: 'c_dusk', slot: 'color', name: 'Dusk', v: ['#a79ad8', '#7f72b1'], src: 'hollow', how: 'Reach the Hollow Below' },
  { id: 'c_ember', slot: 'color', name: 'Cinder', v: ['#e39a70', '#b8724d'], src: 'ember', how: 'Reach the Ember Reach' },
  { id: 'c_frost', slot: 'color', name: 'Rime', v: ['#dbe9f5', '#a9bed2'], src: 'frost', how: 'Reach the Frost Spires' },
  { id: 'c_gold', slot: 'color', name: 'Gilded', v: ['#ecd28f', '#c3a564'], cost: 900, how: 'Tailor (rare)' },
  // materials
  { id: 'm_cloth', slot: 'mat', name: 'Linen', v: 'cloth', how: 'Born with it' },
  { id: 'm_porcelain', slot: 'mat', name: 'Porcelain', v: 'porcelain', src: 'boss0', how: 'Defeat the first warden' },
  { id: 'm_metal', slot: 'mat', name: 'Bronze', v: 'metal', cost: 400, how: 'Tailor' },
  { id: 'm_glow', slot: 'mat', name: 'Lumen', v: 'glow', src: 'boss1', how: 'Defeat the second warden' },
  { id: 'm_shadow', slot: 'mat', name: 'Umbra', v: 'shadow', src: 'boss2', how: 'Defeat the third warden' },
  // heads
  { id: 'h_none', slot: 'head', name: 'Bare', v: 'none', how: 'Born with it' },
  { id: 'h_leaf', slot: 'head', name: 'Sprout', v: 'leaf', how: 'Born with it' },
  { id: 'h_hood', slot: 'head', name: 'Hood', v: 'hood', cost: 80, how: 'Tailor' },
  { id: 'h_mask', slot: 'head', name: 'Pale Mask', v: 'mask', cost: 160, how: 'Tailor' },
  { id: 'h_horns', slot: 'head', name: 'Horns', v: 'horns', cost: 220, how: 'Tailor' },
  { id: 'h_antlers', slot: 'head', name: 'Antlers', v: 'antlers', src: 'glass', how: 'Reach the Glass Wood' },
  { id: 'h_tophat', slot: 'head', name: 'Top Hat', v: 'tophat', cost: 300, how: 'Tailor' },
  { id: 'h_halo', slot: 'head', name: 'Halo', v: 'halo', src: 'boss1', how: 'Defeat the second warden' },
  { id: 'h_crown', slot: 'head', name: 'Crown', v: 'crown', src: 'boss0', how: 'Defeat the first warden' },
  // capes
  { id: 'k_none', slot: 'cape', name: 'None', v: null, how: 'Born with it' },
  { id: 'k_red', slot: 'cape', name: 'Wanderer Red', v: { col: '#b8473f', style: 'cape', len: 7 }, how: 'Born with it' },
  { id: 'k_scarf', slot: 'cape', name: 'Long Scarf', v: { col: '#d9a441', style: 'scarf', len: 8 }, how: 'Born with it' },
  { id: 'k_ink', slot: 'cape', name: 'Ink Cloak', v: { col: '#2d2a36', style: 'cape', len: 8 }, cost: 120, how: 'Tailor' },
  { id: 'k_moss', slot: 'cape', name: 'Moss Cloak', v: { col: '#5f7a63', style: 'cape', len: 7 }, cost: 120, how: 'Tailor' },
  { id: 'k_sky', slot: 'cape', name: 'Sky Scarf', v: { col: '#7fb4d8', style: 'scarf', len: 9 }, src: 'frost', how: 'Reach the Frost Spires' },
  { id: 'k_royal', slot: 'cape', name: 'Royal Mantle', v: { col: '#5b3f8f', style: 'cape', len: 9 }, src: 'boss2', how: 'Defeat the third warden' },
  { id: 'k_ember', slot: 'cape', name: 'Pyre Cloak', v: { col: '#c2502a', style: 'cape', len: 9 }, src: 'ember', how: 'Reach the Ember Reach' },
  { id: 'k_white', slot: 'cape', name: 'Pale Shroud', v: { col: '#e8e2d6', style: 'cape', len: 10 }, cost: 500, how: 'Tailor' },
  // eyes
  { id: 'e_cyan', slot: 'eyes', name: 'Soul Cyan', v: ['#9ff3ff', 'dots'], how: 'Born with it' },
  { id: 'e_amber', slot: 'eyes', name: 'Amber', v: ['#ffc56b', 'dots'], how: 'Born with it' },
  { id: 'e_rose', slot: 'eyes', name: 'Rose Slit', v: ['#ff8fb1', 'slit'], cost: 70, how: 'Tailor' },
  { id: 'e_visor', slot: 'eyes', name: 'Visor', v: ['#b9ffcf', 'visor'], cost: 150, how: 'Tailor' },
  { id: 'e_void', slot: 'eyes', name: 'Void', v: ['#c4b5ff', 'slit'], src: 'hollow', how: 'Reach the Hollow Below' },
  { id: 'e_none', slot: 'eyes', name: 'Blank', v: ['#ffffff', 'none'], how: 'Born with it' },
  // blades
  { id: 'b_steel', slot: 'blade', name: 'Pale Steel', v: { col: '#e8eef5', glow: '#9ff3ff', len: 30 }, how: 'Born with it' },
  { id: 'b_bone', slot: 'blade', name: 'Bone Edge', v: { col: '#efe6d2', glow: '#ffd9a0', len: 28 }, cost: 100, how: 'Tailor' },
  { id: 'b_glass', slot: 'blade', name: 'Glass Edge', v: { col: '#a8fff2', glow: '#8ff7ff', len: 32 }, src: 'boss1', how: 'Defeat the second warden' },
  { id: 'b_ember', slot: 'blade', name: 'Cinder Edge', v: { col: '#ffb27a', glow: '#ff7a3a', len: 32 }, src: 'boss3', how: 'Defeat the fourth warden' },
  { id: 'b_void', slot: 'blade', name: 'Night Edge', v: { col: '#3a3150', glow: '#c4b5ff', len: 34 }, cost: 700, how: 'Tailor' },
];
export const SLOTS = ['color', 'mat', 'head', 'cape', 'eyes', 'blade'];
export const SLOT_NAMES = { color: 'Body', mat: 'Material', head: 'Head', cape: 'Cape', eyes: 'Eyes', blade: 'Blade' };
export const cosmetic = id => COSMETICS.find(c => c.id === id);

export const RELICS = [
  { id: 'djump', name: 'Second Wind', desc: 'Jump again in mid-air.', key: 'Jump in the air' },
  { id: 'wall', name: 'Grip of Glass', desc: 'Cling to walls and leap from them.', key: 'Hold toward a wall' },
  { id: 'plunge', name: 'Plunge', desc: 'Strike down in the air to crash into the ground with a shockwave.', key: 'Down + Strike in air' },
  { id: 'surge', name: 'Ember Surge', desc: 'Your dash cuts through foes.', key: 'Dash through enemies' },
  { id: 'vessel', name: 'Stillheart', desc: 'One more vessel of life.', key: '' },
];

export const RECIPES = [
  { out: T.PLANK, n: 4, need: [[T.LOG, 1]] },
  { out: T.BRICK, n: 2, need: [[T.STONE, 2]] },
  { out: T.LANTERN, n: 1, need: [[T.PLANK, 1], [T.CRYSTAL, 1]] },
  { out: T.GLASS, n: 2, need: [[T.SAND, 2]] },
  { out: T.GLASS, n: 1, need: [[T.ICE, 2]] },
  { out: T.MARBLE, n: 2, need: [[T.STONE, 2], [T.SNOW, 1]] },
  { out: T.OBSIDIAN, n: 2, need: [[T.DEEP, 2], [T.CRYSTAL, 1]] },
  { out: T.HEARTH, n: 1, need: [[T.STONE, 6], [T.LOG, 2]] },
];

export function upgradeCost(kind, lvl) {
  if (kind === 'blade') return { glimmer: 40 + lvl * lvl * 45, items: lvl >= 1 ? [[T.GOLD, lvl * 2]] : [] };
  if (kind === 'vessel') return { glimmer: 120 + lvl * 160, items: [[T.CRYSTAL, 3 + lvl * 2]] };
  if (kind === 'breath') return { glimmer: 80 + lvl * 120, items: [] };
  return { glimmer: 999, items: [] };
}

// ---------------- names / sigils ----------------
const N1 = ['Wren', 'Ivo', 'Mara', 'Sable', 'Tamsin', 'Oro', 'Lio', 'Pell', 'Rue', 'Juno', 'Ash', 'Kestrel', 'Nim', 'Odette', 'Pim', 'Sorrel', 'Tove', 'Vey', 'Wynn', 'Ilse'];
const N2 = ['of the Pale', 'Twice-Born', 'the Unfinished', 'of Small Steps', 'the Stitched', 'of Loose Thread', 'the Wakeful', 'Who Stood', 'of the Seam', 'the Kindled'];
export function genName(seed) { const r = mulberry(seed); return N1[(r() * N1.length) | 0] + ' ' + N2[(r() * N2.length) | 0]; }

export function newSave(seed) {
  seed = seed ?? ((Math.random() * 2 ** 31) | 0);
  return {
    v: 1, seed, born: false, name: genName(seed), sigil: seed ^ 0x5bd1e995,
    pos: null, respawn: null, hp: 5, maxHp: 5, breath: 0, glimmer: 0,
    hasBlade: false, inv: {}, hotbar: [], sel: 0,
    abil: { djump: false, wall: false, plunge: false, surge: false },
    lvl: { blade: 0, vessel: 0, breath: 0 },
    look: { color: 'c_bone', mat: 'm_cloth', head: 'h_none', cape: 'k_red', eyes: 'e_cyan', blade: 'b_steel' },
    unlocked: ['c_bone', 'm_cloth', 'h_none', 'h_leaf', 'k_none', 'k_red', 'k_scarf', 'e_cyan', 'e_amber', 'e_none', 'b_steel'],
    marks: [], bosses: {}, met: {}, home: null, residents: [], seen: {},
    edits: {}, stats: { kills: 0, blocks: 0, placed: 0, deaths: 0, far: 0, time: 0 },
    settings: null, tut: {},
    lights: 0, rescued: {}, chests: {}, stitches: {}, nests: {}, lore: [], requests: [], bossSeen: {}, coopRelics: 0,
  };
}
export function lookFromSave(sv) {
  const g = id => cosmetic(id) || cosmetic('c_bone');
  const col = g(sv.look.color).v, eyes = (cosmetic(sv.look.eyes) || cosmetic('e_cyan')).v;
  const cape = (cosmetic(sv.look.cape) || cosmetic('k_red')).v;
  const blade = (cosmetic(sv.look.blade) || cosmetic('b_steel')).v;
  const mat = (cosmetic(sv.look.mat) || cosmetic('m_cloth')).v;
  return {
    body: mat === 'shadow' ? '#26222e' : col[0], shade: mat === 'shadow' ? '#18151e' : col[1], mat,
    eyes: eyes[0], eyeStyle: eyes[1], head: (cosmetic(sv.look.head) || cosmetic('h_none')).v,
    cape: cape ? Object.assign({}, cape) : null, blade: Object.assign({}, blade),
    marks: (sv.marks || []).map(c => ({ col: c })), rim: '#ffe2bd', accent: '#f2c86a', trailCol: eyes[0] === '#ffffff' ? '#9ff3ff' : eyes[0],
    thread: true, threadCol: '#9ff3ff', bootCol: mat === 'shadow' ? '#1a171f' : '#6b4a32',
    coat: mat === 'shadow' ? '#2b2633' : mat === 'metal' ? '#d8c9a8' : '#ece6dc', hoodCol: '#5f7a4a',
  };
}

export const Save = {
  data: null,
  load() {
    let raw = null;
    try { raw = Platform.getItem(SAVE_KEY); } catch (e) { raw = null; }
    let d = null;
    if (raw) { try { d = JSON.parse(raw); } catch (e) { d = null; } }
    if (!d || d.v !== 1 || typeof d.seed !== 'number') d = newSave();
    // fill any fields added after the save was written
    const base = newSave(d.seed);
    for (const k in base) if (d[k] === undefined) d[k] = base[k];
    for (const k in base.abil) if (d.abil[k] === undefined) d.abil[k] = false;
    for (const k in base.lvl) if (d.lvl[k] === undefined) d.lvl[k] = 0;
    for (const k in base.stats) if (d.stats[k] === undefined) d.stats[k] = 0;
    this.data = d;
    return d;
  },
  write(world) {
    if (!this.data) return;
    if (world) this.data.edits = world.serializeEdits();
    try { Platform.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* storage full or blocked */ }
  },
  wipe() { try { Platform.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } this.data = newSave(); return this.data; },
  unlock(id) { if (!this.data.unlocked.includes(id)) { this.data.unlocked.push(id); return true; } return false; },
  unlockSrc(src) { const got = []; for (const c of COSMETICS) if (c.src === src && this.unlock(c.id)) got.push(c); return got; },
};
export { hashStr };
