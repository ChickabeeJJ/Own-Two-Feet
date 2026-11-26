// The plan of a town, in tiles relative to its centre. Shared by the world (which stamps the buildings in
// tiles: back walls you walk in front of, solid roofs you can stand on, a cobbled street) and the towns
// system (props, townsfolk, shops). Buildings are drawn from tiles until painted facades arrive
// (IMG['town/<kind>'] covers the building's box when present).
import { T } from './tiles.js';

export const BUILDINGS = [
  { kind: 'house', name: 'House', x: -47, w: 7, h: 6, wall: T.MARBLE },
  { kind: 'smithy', name: 'Smithy', x: -38, w: 9, h: 6, wall: T.BRICK, station: T.FORGE, sx: 2 },
  { kind: 'store', name: 'General Store', x: -26, w: 9, h: 6, wall: T.PLANK, station: T.BENCH, sx: 6 },
  { kind: 'inn', name: 'The Inn', x: 12, w: 12, h: 9, wall: T.MARBLE, upper: true },
  { kind: 'tailor', name: 'Tailor', x: 27, w: 7, h: 6, wall: T.PLANK, station: T.LOOM, sx: 1 },
  { kind: 'alchemist', name: 'Alchemist', x: 37, w: 7, h: 6, wall: T.BRICK },
  { kind: 'house', name: 'House', x: 46, w: 5, h: 5, wall: T.MARBLE },
];
// plaza props (x relative to the centre)
export const PROPS = [
  { kind: 'gate', x: -50 }, { kind: 'gate', x: 50 },
  { kind: 'stall', x: -15 }, { kind: 'well', x: -8 }, { kind: 'waystone', x: 0 }, { kind: 'board', x: 6 },
  { kind: 'yard', x: -54 },
  { kind: 'lamp', x: -41 }, { kind: 'lamp', x: -20 }, { kind: 'lamp', x: -3 }, { kind: 'lamp', x: 9 }, { kind: 'lamp', x: 25 }, { kind: 'lamp', x: 44 },
];
export const TOWN_NAMES = { meadow: 'Hearthmere', glass: 'Glassford', hollow: 'Lantern Hollow', ember: 'Cinderwatch', frost: 'Rimehold' };

// stamp a town into a chunk. put(x, y, tile, layer) clips to the chunk; base = the street's tile row.
export function stampTownTiles(cx, base, put, wall) {
  // the cobbled street, the whole width, and the ground under it
  for (let x = cx - 52; x <= cx + 52; x++) put(x, base, T.ROAD, undefined, true);
  // the buildings themselves are the painted fronts (towns.drawBuilding): here only the room they stand in
  // is kept open (no back walls, roofs or frames of tiles behind the art) and each one's station is set down
  for (const B of BUILDINGS) {
    const x0 = cx + B.x, x1 = x0 + B.w - 1, top = base - B.h;
    for (let x = x0; x <= x1; x++) for (let y = top - 4; y < base; y++) { put(x, y, T.AIR); put(x, y, 0, wall); }
    if (B.station) put(x0 + (B.sx || 2), base - 1, B.station, undefined, true);
  }
}
