// Tile and biome definitions. All art colours live here so the look stays coherent.

export const TILE = 32;
export const CH = 32; // chunk size in tiles (generation / storage)

export const T = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, DEEP: 4, LOG: 5, LEAVES: 6, SAND: 7, CRYSTAL: 8,
  PLANK: 9, BRICK: 10, GLASS: 11, LANTERN: 12, ICE: 13, EMBER: 14, MOSS: 15, SNOW: 16,
  GOLD: 17, HEARTH: 18, RUIN: 19, GATE: 20, SHROOM: 21, CAP: 22, MARBLE: 23, OBSIDIAN: 24,
};

// k: key colour role resolved per biome ('dirt','stone','deep','grass','leaf') or a fixed hex
// solid, opaque (blocks light), hard: seconds to mine with bare blade, light: [r,g,b] 0..1 emission
const D = (o) => Object.assign({ solid: true, opaque: true, hard: 0.5, light: null, drop: null, place: true, fric: 1, natural: true }, o);
export const TILES = [];
TILES[T.AIR] = D({ name: 'Air', solid: false, opaque: false, hard: 0, place: false });
TILES[T.GRASS] = D({ name: 'Grass', k: 'dirt', hard: 0.35, drop: T.DIRT });
TILES[T.DIRT] = D({ name: 'Soil', k: 'dirt', hard: 0.3 });
TILES[T.STONE] = D({ name: 'Stone', k: 'stone', hard: 0.7 });
TILES[T.DEEP] = D({ name: 'Deepstone', k: 'deep', hard: 1.0 });
TILES[T.LOG] = D({ name: 'Timber', k: 'log', solid: false, opaque: false, hard: 0.45 });
TILES[T.LEAVES] = D({ name: 'Leaves', k: 'leaf', solid: false, opaque: false, hard: 0.1, drop: -1 });
TILES[T.SAND] = D({ name: 'Ash Sand', k: '#b9a58c', hard: 0.25 });
TILES[T.CRYSTAL] = D({ name: 'Soul Crystal', k: '#7ef0ff', hard: 0.9, light: [0.35, 0.85, 1.0] });
TILES[T.PLANK] = D({ name: 'Planks', k: '#9b7653', hard: 0.4, natural: false });
TILES[T.BRICK] = D({ name: 'Brick', k: '#8f8a96', hard: 0.8, natural: false });
TILES[T.GLASS] = D({ name: 'Glass', k: '#bfe9ff', opaque: false, hard: 0.2, natural: false });
TILES[T.LANTERN] = D({ name: 'Lantern', k: '#ffd28a', solid: false, opaque: false, hard: 0.1, light: [1.0, 0.78, 0.45], natural: false });
TILES[T.ICE] = D({ name: 'Ice', k: '#a9d8f5', opaque: false, hard: 0.4, fric: 0.08 });
TILES[T.EMBER] = D({ name: 'Ember Rock', k: '#ff7a3a', hard: 0.8, light: [1.0, 0.45, 0.18] });
TILES[T.MOSS] = D({ name: 'Mossstone', k: 'moss', hard: 0.6 });
TILES[T.SNOW] = D({ name: 'Snow', k: '#eef4fa', hard: 0.2, drop: T.SNOW });
TILES[T.GOLD] = D({ name: 'Gilt Vein', k: '#f2c86a', hard: 1.1, light: [0.5, 0.38, 0.12] });
TILES[T.HEARTH] = D({ name: 'Hearth', k: '#ffb066', solid: false, opaque: false, hard: 0.5, light: [1.0, 0.62, 0.32], natural: false });
TILES[T.RUIN] = D({ name: 'Old Stone', k: '#a39d93', hard: 0.9 });
TILES[T.GATE] = D({ name: 'Gate Stone', k: '#2c2a33', hard: 999, place: false });
TILES[T.SHROOM] = D({ name: 'Glowcap', k: '#9d8cff', solid: false, opaque: false, hard: 0.1, light: [0.45, 0.35, 0.95] });
TILES[T.CAP] = D({ name: 'Cap', k: '#7a6ad8', solid: false, opaque: false, hard: 0.2, light: [0.18, 0.14, 0.4] });
TILES[T.MARBLE] = D({ name: 'Marble', k: '#e9e4dc', hard: 0.8, natural: false });
TILES[T.OBSIDIAN] = D({ name: 'Nightglass', k: '#2a2440', hard: 1.2, natural: false });

export const isSolid = t => TILES[t].solid;
export const isOpaque = t => TILES[t].opaque;

// ---------- biomes ----------
// sky: top, mid, low. fog: atmospheric haze. sun: light colour on open ground. amb: cave ambient.
export const BIOMES = [
  {
    id: 'meadow', name: 'The Pale Meadow', sub: 'where the first step is taken',
    sky: ['#1b2741', '#6c7a9e', '#f1c7a5'], fog: '#c8b5b1', sun: [1.0, 0.95, 0.88], amb: [0.08, 0.08, 0.12], sunCol: '#ffe0b5',
    grass: '#9cbd8c', grassHi: '#dcefc4', dirt: '#594844', stone: '#5e6476', deep: '#383b4b', leaf: '#7da48a', log: '#6b5446', moss: '#5f7a63',
    accent: '#ffd9a0', amp: 7, freq: 0.018, rough: 0.35, trees: 0.12, tree: 'round', parts: 'motes', grade: [1.03, 1.0, 0.97],
    flower: ['#f3e6d0', '#f0b7a6', '#d6c7f0'],
  },
  {
    id: 'glass', name: 'The Glass Wood', sub: 'trees that remember light',
    sky: ['#081a24', '#1d505a', '#80cfc4'], fog: '#56a2a2', sun: [0.82, 1.0, 0.97], amb: [0.05, 0.1, 0.12], sunCol: '#c9fff4',
    grass: '#5aae9e', grassHi: '#b8fff0', dirt: '#2b3842', stone: '#395261', deep: '#1e2b37', leaf: '#6fe0cf', log: '#4a5f6a', moss: '#3f7b74',
    accent: '#8ff7ff', amp: 10, freq: 0.022, rough: 0.45, trees: 0.16, tree: 'crystal', parts: 'fireflies', grade: [0.96, 1.03, 1.04],
    flower: ['#b9fff0', '#8ff7ff', '#e0fff9'],
  },
  {
    id: 'hollow', name: 'The Hollow Below', sub: 'a sky made of stone',
    sky: ['#0b0a1a', '#2a2350', '#5d4e94'], fog: '#3e3668', sun: [0.8, 0.74, 1.0], amb: [0.1, 0.09, 0.18], sunCol: '#c9bcff',
    grass: '#7a6fb2', grassHi: '#c9bcff', dirt: '#352c52', stone: '#40395f', deep: '#231d3b', leaf: '#7b6ad5', log: '#3f3760', moss: '#4b4380',
    accent: '#c4b5ff', amp: 14, freq: 0.03, rough: 0.6, trees: 0.1, tree: 'shroom', parts: 'spores', grade: [0.97, 0.95, 1.06],
    flower: ['#c4b5ff', '#9d8cff', '#e6deff'],
  },
  {
    id: 'ember', name: 'The Ember Reach', sub: 'the ground still burns',
    sky: ['#170809', '#571d1a', '#ee874a'], fog: '#87392a', sun: [1.0, 0.8, 0.62], amb: [0.13, 0.06, 0.05], sunCol: '#ffb36b',
    grass: '#a86b48', grassHi: '#ffbf89', dirt: '#3b2220', stone: '#483333', deep: '#291b1b', leaf: '#5a3a33', log: '#3a2622', moss: '#6a3b2c',
    accent: '#ff9b4a', amp: 12, freq: 0.028, rough: 0.7, trees: 0.07, tree: 'dead', parts: 'embers', grade: [1.07, 0.98, 0.92],
    flower: ['#ffbf89', '#ff9b4a', '#ffd9b0'],
  },
  {
    id: 'frost', name: 'The Frost Spires', sub: 'silence, sharpened',
    sky: ['#34547f', '#98b4d4', '#e7f1fa'], fog: '#cddff0', sun: [0.95, 0.98, 1.0], amb: [0.08, 0.1, 0.14], sunCol: '#ffffff',
    grass: '#e8f0f6', grassHi: '#ffffff', dirt: '#6b7a8e', stone: '#7b89a1', deep: '#4b576f', leaf: '#7f9fae', log: '#4c4a50', moss: '#8fa7b5',
    accent: '#dff6ff', amp: 16, freq: 0.02, rough: 0.55, trees: 0.13, tree: 'pine', parts: 'snow', grade: [0.97, 1.0, 1.05],
    flower: ['#ffffff', '#dff6ff', '#c9e6ff'],
  },
];

export const BIOME_W = 340;   // tiles per biome; each biome ends in a boss gate
export const SHRINE_EVERY = 85;

// biome 0 is centred on the spawn; a boss gate stands on every boundary between two biomes
export function biomeIndexAt(tx) { return Math.floor((tx + BIOME_W / 2) / BIOME_W); }
export function biomeLocal(tx) { return tx + BIOME_W / 2 - biomeIndexAt(tx) * BIOME_W; }
// boundary k sits between biome k-1 and biome k
export function gateNear(tx) {
  const k = Math.round((tx + BIOME_W / 2) / BIOME_W);
  const gx = k * BIOME_W - BIOME_W / 2;
  const tier = k >= 1 ? k - 1 : -k;
  const guard = k >= 1 ? k - 1 : k;     // the biome whose warden holds this gate
  return { k, gx, tier, guard };
}
export function biomeOf(bi) { return BIOMES[((bi % 5) + 5) % 5]; }
// how far (in biomes) from the start: 0 for the first biome either side
export function tierOf(bi) { return bi >= 0 ? bi : -bi - 1; }
