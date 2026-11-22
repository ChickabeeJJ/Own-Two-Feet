// Endless seeded tile world: generation, chunk storage, edits, queries.
import { TILE, CH, T, TILES, BIOME_W, SHRINE_EVERY, biomeIndexAt, biomeLocal, biomeOf, tierOf, gateNear } from './tiles.js';
import { fbm1, fbm2, noise2, hash2, clamp, lerp, smooth } from '../core/util.js';
export { gateNear };

const SPAWN_L = -14, SPAWN_R = 26;

export const ARENA_HALF = 30;

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.chunks = new Map();
    this.edits = new Map();      // chunkKey -> Map(idx -> tile); idx >= 1024 = wall layer
    this.cols = new Map();
    this.listeners = [];
    this.version = 0;
  }
  onChange(fn) { this.listeners.push(fn); }

  // ---------------- terrain shape ----------------
  rawHeight(tx) {
    const s = this.seed;
    const bi = biomeIndexAt(tx);
    const local = biomeLocal(tx);
    const hOf = (b) => {
      const B = biomeOf(b);
      let h = -B.amp * fbm1(tx * B.freq, s + 11, 4) - B.amp * B.rough * 0.6 * fbm1(tx * B.freq * 5, s + 23, 2);
      if (B.id === 'ember') h = lerp(h, Math.round(h / 3) * 3, 0.7);
      if (B.id === 'frost') {
        const p = fbm1(tx * 0.06, s + 7, 2);
        if (p > 0.25) h -= (p - 0.25) * 60;
      }
      if (B.id === 'hollow') h += 6;
      return h;
    };
    let h = hOf(bi);
    const edge = 26;
    if (local < edge) h = lerp(hOf(bi - 1), h, smooth(0.5 + local / edge / 2));
    else if (local > BIOME_W - edge) h = lerp(h, hOf(bi + 1), smooth((local - (BIOME_W - edge)) / edge / 2));
    // a long, gentle rise and fall across the whole world
    h += fbm1(tx * 0.0025, s + 99, 2) * 22;
    return h;
  }
  col(tx) {
    let c = this.cols.get(tx);
    if (c) return c;
    let h = this.rawHeight(tx);
    // spawn plateau
    if (tx > SPAWN_L - 20 && tx < SPAWN_R + 20) {
      const base = this.rawHeight(4) * 0.3;
      const k = tx < SPAWN_L ? smooth((tx - (SPAWN_L - 20)) / 20) : tx > SPAWN_R ? smooth(1 - (tx - SPAWN_R) / 20) : 1;
      h = lerp(h, base + Math.sin(tx * 0.21) * 0.8, k);
    }
    const bi = biomeIndexAt(tx);
    // boss arena on the biome boundary
    const gx = gateNear(tx).gx;
    const da = Math.abs(tx - gx);
    let arena = false;
    if (da < ARENA_HALF + 16) {
      const ah = Math.round(this.rawHeight(gx));
      const k = da < ARENA_HALF ? 1 : smooth(1 - (da - ARENA_HALF) / 16);
      h = lerp(h, ah, k);
      arena = da <= ARENA_HALF + 8;
    }
    // shrines
    const sk = this.shrineNear(tx);
    if (sk !== null) {
      const sh = this.rawHeight(sk);
      const d = Math.abs(tx - sk);
      h = lerp(h, sh, d < 6 ? 1 : smooth(1 - (d - 6) / 8));
    }
    const hi = Math.round(h);
    c = { h: hi, bi, arena, gx, shrine: sk, flat: false };
    this.cols.set(tx, c);
    if (this.cols.size > 30000) this.cols.clear();
    return c;
  }
  surface(tx) { return this.col(tx).h; }
  shrineNear(tx) {
    const k = Math.round((tx - 20) / SHRINE_EVERY);
    const sx = k * SHRINE_EVERY + 20;
    if (Math.abs(tx - sx) > 14) return null;
    if (Math.abs(sx - gateNear(sx).gx) < 50) return null;
    if (sx > SPAWN_L - 30 && sx < SPAWN_R + 30) return null;
    return sx;
  }
  shrinesBetween(a, b) {
    const out = [];
    for (let k = Math.floor((a - 20) / SHRINE_EVERY); k <= Math.ceil((b - 20) / SHRINE_EVERY); k++) {
      const sx = k * SHRINE_EVERY + 20;
      if (sx >= a && sx <= b && this.shrineNear(sx) === sx) out.push(sx);
    }
    return out;
  }

  // ---------------- cell generation ----------------
  treeAt(tx) {
    const c = this.col(tx);
    if (c.arena || c.shrine !== null) return null;
    if (tx > -4 && tx < 12) return null;
    const B = biomeOf(c.bi);
    if (hash2(tx, 7, this.seed) > B.trees) return null;
    // keep trees apart
    for (let d = 1; d <= 3; d++) if (hash2(tx - d, 7, this.seed) < B.trees) return null;
    const l = this.col(tx - 1).h, r = this.col(tx + 1).h;
    if (Math.abs(l - c.h) > 1 || Math.abs(r - c.h) > 1) return null;
    const hgt = 5 + Math.floor(hash2(tx, 9, this.seed) * 5);
    return { kind: B.tree, h: hgt, base: c.h };
  }
  gen(tx, ty) {
    // returns [fg, wall]
    const c = this.col(tx);
    const B = biomeOf(c.bi);
    const s = this.seed;
    const d = ty - c.h;
    if (d < 0) {
      // floating islands in the hollow (and a few in the glass wood)
      if ((B.id === 'hollow' || B.id === 'glass') && d < -7 && d > -46 && !c.arena) {
        const isl = (y) => fbm2(tx * 0.045, y * 0.11, s + 5) - (B.id === 'glass' ? 0.5 : 0.36) + Math.abs(d + 24) * 0.006;
        if (isl(ty) > 0) return [isl(ty - 1) > 0 ? T.STONE : T.GRASS, 0];
      }
      // crystal pillars / ice spikes
      if (!c.arena && c.shrine === null && d > -9) {
        const hp = hash2(tx, 31, s);
        if (B.id === 'glass' && hp < 0.035 && -d <= 2 + hp * 160) return [T.CRYSTAL, 0];
        if (B.id === 'frost' && hp < 0.03 && -d <= 2 + hp * 150) return [T.ICE, 0];
        if (B.id === 'ember' && hp < 0.02 && -d <= 1 + hp * 100) return [T.EMBER, 0];
      }
      return [T.AIR, 0];
    }
    const dirtDepth = 3 + Math.floor(hash2(tx, 3, s) * 3);
    let fg, wall;
    if (d === 0) fg = B.id === 'frost' ? T.SNOW : T.GRASS;
    else if (d < dirtDepth) fg = B.id === 'frost' && d < 2 ? T.SNOW : B.id === 'ember' && d < 2 ? T.SAND : T.DIRT;
    else if (d > 55 + fbm1(tx * 0.05, s + 3) * 8) fg = T.DEEP;
    else fg = T.STONE;
    wall = d >= 2 ? (fg === T.DEEP ? T.DEEP : d < dirtDepth + 2 ? T.DIRT : T.STONE) : 0;
    if (c.arena && d < 14) {
      if (d === 0) fg = T.RUIN;
      return [fg, wall];
    }
    // caves
    const calm = (tx > SPAWN_L - 10 && tx < SPAWN_R + 10) ? 10 : 4;
    if (d > calm) {
      const depthK = Math.min(d, 220);
      const worm = Math.abs(noise2(tx * 0.04, ty * 0.065, s + 41));
      const blob = fbm2(tx * 0.022, ty * 0.034, s + 43, 3);
      if (worm < 0.075 + depthK * 0.0003 || blob > 0.36 - depthK * 0.0009) return [T.AIR, wall || T.STONE];
    }
    if (fg === T.STONE || fg === T.DEEP) {
      const o = hash2(tx, ty, s + 77);
      const vein = noise2(tx * 0.12, ty * 0.12, s + 13);
      if (vein > 0.5 + Math.max(0, 0.15 - d * 0.004) && o < 0.45) fg = T.CRYSTAL;
      else if (d > 26 && vein < -0.5 && o < 0.4) fg = T.GOLD;
      else if (B.id === 'ember' && o < 0.035) fg = T.EMBER;
      else if (B.id === 'frost' && d < 20 && o < 0.05) fg = T.ICE;
      else if ((B.id === 'meadow' || B.id === 'glass') && noise2(tx * 0.08, ty * 0.08, s + 17) > 0.45) fg = T.MOSS;
    }
    return [fg, wall];
  }
  stampTrees(cx, cy, fg) {
    const x0 = cx * CH, y0 = cy * CH;
    for (let tx = x0 - 6; tx < x0 + CH + 6; tx++) {
      const tr = this.treeAt(tx);
      if (!tr) continue;
      const put = (x, y, t, force) => {
        const lx = x - x0, ly = y - y0;
        if (lx < 0 || ly < 0 || lx >= CH || ly >= CH) return;
        const i = ly * CH + lx;
        if (force || fg[i] === T.AIR) fg[i] = t;
      };
      const top = tr.base - tr.h;
      if (tr.kind === 'shroom') {
        for (let y = tr.base - 1; y > top; y--) put(tx, y, T.LOG);
        const r = 3 + (tr.h > 7 ? 1 : 0);
        for (let x = -r; x <= r; x++) { put(tx + x, top, T.CAP); if (Math.abs(x) < r) put(tx + x, top - 1, T.CAP); }
        put(tx, tr.base - 1, T.SHROOM, true);
      } else if (tr.kind === 'dead') {
        for (let y = tr.base - 1; y > top; y--) put(tx, y, T.LOG);
        const by = top + 2;
        put(tx - 1, by, T.LOG); put(tx - 2, by - 1, T.LOG); put(tx + 1, by + 1, T.LOG); put(tx + 2, by, T.LOG);
      } else if (tr.kind === 'pine') {
        for (let y = tr.base - 1; y > top - 1; y--) put(tx, y, T.LOG);
        for (let k = 0; k < tr.h - 1; k++) {
          const w = Math.floor((tr.h - 1 - k) * 0.45) + (k % 2 ? 0 : 1);
          for (let x = -w; x <= w; x++) put(tx + x, top + k, T.LEAVES);
        }
        put(tx, top - 1, T.LEAVES);
      } else {
        for (let y = tr.base - 1; y > top; y--) put(tx, y, T.LOG);
        const r = tr.kind === 'crystal' ? 2 : 2.6;
        for (let y = -3; y <= 2; y++) for (let x = -3; x <= 3; x++) {
          const dd = Math.hypot(x, y * 1.15);
          if (dd <= r + hash2(tx + x, top + y, this.seed) * 0.9) put(tx + x, top + y, T.LEAVES);
        }
        if (tr.kind === 'crystal' && hash2(tx, 5, this.seed) < 0.5) put(tx, top - 3, T.CRYSTAL);
      }
    }
  }
  stampStructures(cx, cy, fg, wall) {
    const x0 = cx * CH, y0 = cy * CH;
    const put = (x, y, t, layer = fg) => {
      const lx = x - x0, ly = y - y0;
      if (lx < 0 || ly < 0 || lx >= CH || ly >= CH) return;
      layer[ly * CH + lx] = t;
    };
    // boss gate arches on both arena edges
    {
      const gx = gateNear(x0 + CH / 2).gx;
      if (gx < x0 - 50 || gx > x0 + CH + 50) return this.stampShrines(x0, y0, put, wall);
      const gy = this.col(gx).h;
      for (const side of [-1, 1]) {
        const px = gx + side * (ARENA_HALF + 2);
        for (let y = gy - 1; y >= gy - 8; y--) for (let x = px - 2; x <= px + 2; x++) put(x, y, T.RUIN, wall);
        for (let x = px - 3; x <= px + 3; x++) { put(x, gy - 9, T.RUIN); if (Math.abs(x - px) < 3) put(x, gy - 10, T.RUIN); }
        put(px, gy - 8, T.LANTERN);
      }
      // broken colonnade inside the arena
      for (let k = -2; k <= 2; k++) {
        if (k === 0) continue;
        const px = gx + k * 11, hh = 2 + Math.floor(hash2(px, 1, this.seed) * 4);
        for (let y = gy - 1; y >= gy - hh; y--) put(px, y, T.RUIN, wall);
      }
    }
    this.stampShrines(x0, y0, put, wall);
  }
  stampShrines(x0, y0, put, wall) {
    // shrines: a little stone dais with a lantern post
    for (const sx of this.shrinesBetween(x0 - 8, x0 + CH + 8)) {
      const sy = this.col(sx).h;
      for (let x = sx - 4; x <= sx + 4; x++) put(x, sy, T.RUIN);
      for (const ox of [-3, 3]) { put(sx + ox, sy - 1, T.RUIN, wall); put(sx + ox, sy - 2, T.RUIN, wall); put(sx + ox, sy - 3, T.LANTERN); }
    }
  }
  generateChunk(cx, cy) {
    const fg = new Uint8Array(CH * CH), wall = new Uint8Array(CH * CH);
    const x0 = cx * CH, y0 = cy * CH;
    for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
      const r = this.gen(x0 + lx, y0 + ly);
      fg[ly * CH + lx] = r[0]; wall[ly * CH + lx] = r[1];
    }
    this.stampTrees(cx, cy, fg);
    this.stampStructures(cx, cy, fg, wall);
    const ed = this.edits.get(cx + ',' + cy);
    if (ed) for (const [i, t] of ed) { if (i >= 1024) wall[i - 1024] = t; else fg[i] = t; }
    return { fg, wall, cx, cy, used: 0 };
  }
  chunk(cx, cy) {
    if (this._lc && this._lcx === cx && this._lcy === cy) return this._lc;
    const k = cx + ',' + cy;
    let c = this.chunks.get(k);
    if (!c) { c = this.generateChunk(cx, cy); this.chunks.set(k, c); }
    this._lc = c; this._lcx = cx; this._lcy = cy;
    return c;
  }
  get(tx, ty) {
    const cx = Math.floor(tx / CH), cy = Math.floor(ty / CH);
    const c = this.chunk(cx, cy);
    return c.fg[(ty - cy * CH) * CH + (tx - cx * CH)];
  }
  wall(tx, ty) {
    const cx = Math.floor(tx / CH), cy = Math.floor(ty / CH);
    const c = this.chunk(cx, cy);
    return c.wall[(ty - cy * CH) * CH + (tx - cx * CH)];
  }
  solid(tx, ty) { return TILES[this.get(tx, ty)].solid; }
  solidAt(x, y) { return this.solid(Math.floor(x / TILE), Math.floor(y / TILE)); }
  set(tx, ty, t, layer = 0, silent = false) {
    const cx = Math.floor(tx / CH), cy = Math.floor(ty / CH);
    const c = this.chunk(cx, cy);
    const i = (ty - cy * CH) * CH + (tx - cx * CH);
    const arr = layer ? c.wall : c.fg;
    if (arr[i] === t) return false;
    arr[i] = t;
    const k = cx + ',' + cy;
    let ed = this.edits.get(k);
    if (!ed) { ed = new Map(); this.edits.set(k, ed); }
    ed.set(i + (layer ? 1024 : 0), t);
    this.version++;
    for (const fn of this.listeners) fn(tx, ty, t, layer, silent);
    return true;
  }
  // drop chunks far from the focus; edits survive, so they regenerate identically
  trim(fx, fy) {
    if (this.chunks.size < 260) return;
    const fcx = fx / TILE / CH, fcy = fy / TILE / CH;
    for (const [k, c] of this.chunks) if (Math.abs(c.cx - fcx) > 9 || Math.abs(c.cy - fcy) > 7) this.chunks.delete(k);
    this._lc = null;
  }
  biomeAtX(x) { return biomeIndexAt(Math.floor(x / TILE)); }

  // tile ray cast (DDA). returns {tx,ty,x,y,nx,ny,t} or null
  raycast(x0, y0, x1, y1, pred = (t) => TILES[t].solid) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / len, uy = dy / len;
    let tx = Math.floor(x0 / TILE), ty = Math.floor(y0 / TILE);
    const sx = ux > 0 ? 1 : -1, sy = uy > 0 ? 1 : -1;
    const tdx = Math.abs(TILE / (ux || 1e-9)), tdy = Math.abs(TILE / (uy || 1e-9));
    let tmx = ux > 0 ? ((tx + 1) * TILE - x0) / ux : (x0 - tx * TILE) / -(ux || -1e-9);
    let tmy = uy > 0 ? ((ty + 1) * TILE - y0) / uy : (y0 - ty * TILE) / -(uy || -1e-9);
    if (!isFinite(tmx)) tmx = 1e9; if (!isFinite(tmy)) tmy = 1e9;
    let t = 0, nx = 0, ny = 0;
    for (let n = 0; n < 200 && t <= len; n++) {
      const tile = this.get(tx, ty);
      if (pred(tile)) return { tx, ty, x: x0 + ux * t, y: y0 + uy * t, nx, ny, t, tile };
      if (tmx < tmy) { t = tmx; tmx += tdx; tx += sx; nx = -sx; ny = 0; }
      else { t = tmy; tmy += tdy; ty += sy; nx = 0; ny = -sy; }
    }
    return null;
  }
  // first solid tile at or below world point (x,y), within maxDist px; returns y of its top
  groundBelow(x, y, maxDist = 200) {
    const tx = Math.floor(x / TILE);
    let ty = Math.floor(y / TILE);
    const end = Math.floor((y + maxDist) / TILE);
    for (; ty <= end; ty++) if (this.solid(tx, ty)) return ty * TILE;
    return null;
  }

  serializeEdits() {
    const o = {};
    for (const [k, m] of this.edits) {
      if (!m.size) continue;
      const parts = [];
      for (const [i, t] of m) parts.push(i.toString(36) + '.' + t.toString(36));
      o[k] = parts.join(',');
    }
    return o;
  }
  loadEdits(o) {
    this.edits.clear(); this.chunks.clear(); this._lc = null; this.cols.clear();
    if (!o) return;
    for (const k in o) {
      const m = new Map();
      for (const p of String(o[k]).split(',')) {
        const [a, b] = p.split('.');
        if (a !== undefined && b !== undefined) m.set(parseInt(a, 36), parseInt(b, 36));
      }
      this.edits.set(k, m);
    }
    this.version++;
  }
  tierAtX(x) { return tierOf(this.biomeAtX(x)); }
}
