// Everything you can carry: blocks (tile ids), building parts and stations (also tiles), consumables and
// gear (string ids). Recipes say where they can be made: anywhere (by hand), or near a Workbench, Forge or
// Loom you craft and place (a shrine's fire counts as a workbench).
import { T, TILES, TILE } from '../world/tiles.js';

export const isTileId = (id) => typeof id === 'number' || /^\d+$/.test(String(id));
export const norm = (id) => (isTileId(id) ? +id : id);

// non-tile items
export const ITEMS = {
  i_draught: { name: 'Mending Draught', cat: 'use', desc: 'Drink to mend one vessel.' },
  i_flare: { name: 'Flare', cat: 'use', desc: 'Throw it: a hot light that burns for twenty seconds and shows the dark.' },
  i_charge: { name: 'Blast Charge', cat: 'use', desc: 'Throw it: after a short fuse it breaks the blocks around it.' },
  g_lamp: { name: "Miner's Lamp", cat: 'gear', slot: 'lamp', desc: 'Hangs at your belt. You carry a wider, warmer light.' },
  g_pick_gilt: { name: 'Gilt Pick', cat: 'gear', slot: 'pick', mine: 1.7, desc: 'Worn on your back. Blocks break 70% faster.' },
  g_pick_crystal: { name: 'Crystal Pick', cat: 'gear', slot: 'pick', mine: 2.6, desc: 'Worn on your back. Blocks break more than twice as fast.' },
  g_charm_thread: { name: 'Thread Charm', cat: 'gear', slot: 'charm', desc: 'Breath gathers twice as fast, so you mend more often.' },
  g_charm_ember: { name: 'Ember Charm', cat: 'gear', slot: 'charm', desc: 'Your dash burns: it cuts any Hollow you pass through.' },
  // weapons (worn in the weapon slot); the blade comes from the stone
  w_blade: { name: 'Blade', cat: 'gear', slot: 'weapon', desc: 'Balanced cuts. Three-step chain; hold Strike for a rising cleave.' },
  w_spear: { name: 'Spear', cat: 'gear', slot: 'weapon', desc: 'Long reach and quick thrusts; hold Strike to lunge.' },
  w_hammer: { name: 'Greathammer', cat: 'gear', slot: 'weapon', desc: 'Slow and crushing. Breaks guards and blocks; hold Strike to shake the ground.' },
  w_daggers: { name: 'Twin daggers', cat: 'gear', slot: 'weapon', desc: 'Very fast five-step chain; Hollows bleed. Hold Strike to whirl.' },
  w_sling: { name: 'Sling', cat: 'gear', slot: 'weapon', desc: 'Ranged: hurls stone from your satchel; crystal shot pierces.' },
  i_infuse_ember: { name: 'Ember infusion', cat: 'use', desc: 'Pour into the weapon you hold: its hits set Hollows burning.' },
  i_infuse_frost: { name: 'Frost infusion', cat: 'use', desc: 'Pour into the weapon you hold: its hits slow Hollows down.' },
};
const PARTS = new Set([T.LADDER, T.PLATFORM, T.TORCH, T.DOOR, T.STEP, T.LANTERN, T.HEARTH, T.GLASS]);
const STATIONS = new Set([T.STORE, T.BENCH, T.FORGE, T.LOOM]);
const TILE_DESC = {
  [T.LADDER]: 'Climb it with up and down. Place them in a column to get out of any hole.',
  [T.PLATFORM]: 'Stand on it from above, jump up through it, hold down to drop through.',
  [T.TORCH]: 'A small flame for walls and caves.',
  [T.DOOR]: 'Two blocks tall. Open and close it with the action key.',
  [T.STEP]: 'A half block: walk up stairs without jumping.',
  [T.STORE]: 'Keeps what you put in it, right where you built it.',
  [T.BENCH]: 'Unlocks doors, chests, lanterns, flares and the other stations.',
  [T.FORGE]: 'Heat: glass, nightglass, picks, lamps and blast charges.',
  [T.LOOM]: 'Fine work: draughts and charms.',
  [T.HEARTH]: 'Makes a home. Your respawn, and where keepers come to live.',
  [T.LANTERN]: 'A bright hanging light.',
};

export function itemName(id) { id = norm(id); return typeof id === 'number' ? (TILES[id] ? TILES[id].name : '?') : (ITEMS[id] ? ITEMS[id].name : id); }
export function itemCat(id) {
  id = norm(id);
  if (typeof id !== 'number') return ITEMS[id] ? ITEMS[id].cat : 'use';
  if (STATIONS.has(id)) return 'station';
  if (PARTS.has(id)) return 'part';
  return 'block';
}
export function itemDesc(id) {
  id = norm(id);
  if (typeof id !== 'number') return ITEMS[id] ? ITEMS[id].desc : '';
  return TILE_DESC[id] || (TILES[id].light ? 'A block that glows.' : 'A building block.');
}
export const placeable = (id) => { id = norm(id); return typeof id === 'number' && TILES[id] && TILES[id].place; };
export const usable = (id) => ITEMS[norm(id)] && ITEMS[norm(id)].cat === 'use';
export const isGear = (id) => ITEMS[norm(id)] && ITEMS[norm(id)].cat === 'gear';
export const onHotbar = (id) => placeable(id) || usable(id);

export const STATION_NAMES = { hand: 'By hand', bench: 'Workbench', forge: 'Forge', loom: 'Loom' };
// station: null = anywhere
export const RECIPES = [
  // by hand
  { out: T.PLANK, n: 4, need: [[T.LOG, 1]], st: null },
  { out: T.LADDER, n: 3, need: [[T.PLANK, 2]], st: null },
  { out: T.PLATFORM, n: 4, need: [[T.PLANK, 2]], st: null },
  { out: T.TORCH, n: 3, need: [[T.PLANK, 1], [T.CRYSTAL, 1]], st: null },
  { out: T.STEP, n: 4, need: [[T.PLANK, 2]], st: null },
  { out: T.BRICK, n: 2, need: [[T.STONE, 2]], st: null },
  { out: T.BENCH, n: 1, need: [[T.PLANK, 6]], st: null },
  // workbench
  { out: T.DOOR, n: 1, need: [[T.PLANK, 6]], st: 'bench' },
  { out: T.STORE, n: 1, need: [[T.PLANK, 8], [T.STONE, 2]], st: 'bench' },
  { out: T.LANTERN, n: 1, need: [[T.PLANK, 1], [T.CRYSTAL, 2]], st: 'bench' },
  { out: T.HEARTH, n: 1, need: [[T.STONE, 6], [T.LOG, 2]], st: 'bench' },
  { out: T.MARBLE, n: 2, need: [[T.STONE, 2], [T.SNOW, 1]], st: 'bench' },
  { out: 'i_flare', n: 3, need: [[T.PLANK, 1], [T.CRYSTAL, 1], [T.DIRT, 2]], st: 'bench' },
  { out: T.FORGE, n: 1, need: [[T.STONE, 12], [T.LOG, 4]], st: 'bench' },
  { out: T.LOOM, n: 1, need: [[T.PLANK, 8], [T.CRYSTAL, 3]], st: 'bench' },
  { out: 'w_spear', n: 1, need: [[T.PLANK, 4], [T.STONE, 3], [T.CRYSTAL, 1]], st: 'bench' },
  { out: 'w_sling', n: 1, need: [[T.PLANK, 2], [T.MOSS, 2], [T.DIRT, 4]], st: 'bench' },
  { out: 'w_daggers', n: 1, need: [[T.GOLD, 3], [T.PLANK, 2], [T.CRYSTAL, 1]], st: 'bench' },
  { out: 'w_hammer', n: 1, need: [[T.STONE, 14], [T.PLANK, 4], [T.GOLD, 2]], st: 'bench' },
  // forge
  { out: T.GLASS, n: 2, need: [[T.SAND, 2]], st: 'forge' },
  { out: T.GLASS, n: 1, need: [[T.ICE, 2]], st: 'forge' },
  { out: T.OBSIDIAN, n: 2, need: [[T.DEEP, 2], [T.CRYSTAL, 1]], st: 'forge' },
  { out: 'i_charge', n: 2, need: [[T.SAND, 3], [T.CRYSTAL, 1], [T.STONE, 2]], st: 'forge' },
  { out: 'g_lamp', n: 1, need: [[T.GOLD, 2], [T.GLASS, 1], [T.CRYSTAL, 2]], st: 'forge' },
  { out: 'g_pick_gilt', n: 1, need: [[T.GOLD, 5], [T.PLANK, 2]], st: 'forge' },
  { out: 'g_pick_crystal', n: 1, need: [[T.CRYSTAL, 8], [T.GOLD, 3], [T.OBSIDIAN, 2]], st: 'forge' },
  { out: 'i_infuse_ember', n: 1, need: [[T.EMBER, 3], [T.GOLD, 2]], st: 'forge' },
  { out: 'i_infuse_frost', n: 1, need: [[T.ICE, 3], [T.CRYSTAL, 2], [T.GOLD, 1]], st: 'forge' },
  // loom
  { out: 'i_draught', n: 1, need: [[T.MOSS, 2], [T.CRYSTAL, 1]], st: 'loom' },
  { out: 'g_charm_thread', n: 1, need: [[T.CRYSTAL, 5], [T.GOLD, 2]], st: 'loom' },
  { out: 'g_charm_ember', n: 1, need: [[T.EMBER, 4], [T.GOLD, 2]], st: 'loom' },
];

// which stations are close enough to use (4 tiles); a shrine counts as a workbench
export function stationsNear(game) {
  const out = { hand: true, bench: false, forge: false, loom: false };
  const p = game.player; if (!p) return out;
  const W = game.world, tx = Math.floor(p.x / TILE), ty = Math.floor((p.y - 20) / TILE);
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const st = TILES[W.get(tx + dx, ty + dy)].station;
    if (st && st !== 'store') out[st] = true;
  }
  const sh = W.shrineNear ? W.shrineNear(tx) : null;
  if (sh !== null && Math.abs(sh - tx) <= 5) out.bench = true;
  return out;
}
export function canCraft(sv, r, near) {
  if (r.st && !near[r.st]) return false;
  return r.need.every(([id, n]) => (sv.inv[id] || 0) >= n);
}
