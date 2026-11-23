// Crafted things you use where they stand: doors open and close, storage chests and stations open the satchel.
import { TILE, T, TILES } from '../world/tiles.js';

export class Parts {
  constructor(game) { this.game = game; }
  interactables() {
    const g = this.game, p = g.player, W = g.world, out = [];
    if (!p) return out;
    const tx0 = Math.floor(p.x / TILE), ty0 = Math.floor((p.y - 20) / TILE);
    const seenDoor = new Set();
    for (let dy = -3; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = tx0 + dx, ty = ty0 + dy, t = W.get(tx, ty), d = TILES[t];
      const x = tx * TILE + 16, y = ty * TILE + 16;
      if (d.door) {
        let yb = ty; while (TILES[W.get(tx, yb + 1)].door) yb++;
        if (seenDoor.has(tx + ',' + yb)) continue; seenDoor.add(tx + ',' + yb);
        const open = t === T.DOOR_OPEN;
        out.push({ x, y: yb * TILE, r: 70, label: open ? 'Close the door' : 'Open the door', verb: open ? 'Close' : 'Open', act: () => p.toggleDoor(tx, yb) });
      } else if (t === T.STORE) out.push({ x, y, r: 60, label: 'Open the chest', verb: 'Open', act: () => g.ui.bag.open({ chest: tx + ',' + ty }) });
      else if (d.station) out.push({ x, y, r: 60, label: 'Craft at the ' + d.name.toLowerCase(), verb: 'Craft', act: () => g.ui.bag.open({ page: 'craft' }) });
    }
    return out;
  }
}
