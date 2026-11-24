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
      // the blade in the stone (tile 12) stands on a level shelf
      const db = Math.abs(tx - 12);
      if (db <= 4) h = lerp(h, base + Math.sin(12 * 0.21) * 0.8, db <= 2 ? 1 : 0.5);
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
    if (this.mouthAt(tx, c.h, c.h) || this.mouthAt(tx, c.h + 1, c.h)) return null;
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
    // thick, uneven topsoil: the soil/stone line rolls with the land (4-9 tiles), with pockets of soil
    // reaching down into the rock and thin darker strata in the stone below
    const dirtDepth = 4 + Math.floor((fbm1(tx * 0.045, s + 61) * 0.5 + 0.5) * 5 + hash2(tx, 3, s) * 1.2);
    const pocket = d >= dirtDepth && d < dirtDepth + 4 && fbm2(tx * 0.11, ty * 0.16, s + 63, 2) > 0.28;
    let fg, wall;
    if (d === 0) fg = B.id === 'frost' ? T.SNOW : T.GRASS;
    else if (d < dirtDepth || pocket) fg = B.id === 'frost' && d < 2 ? T.SNOW : T.DIRT;
    else if (d > 55 + fbm1(tx * 0.05, s + 3) * 8) fg = T.DEEP;
    else fg = Math.abs(((d + fbm1(tx * 0.03, s + 67) * 6) % 13) - 6.5) < 0.55 ? T.DEEP : T.STONE;
    wall = d >= 2 ? (fg === T.DEEP ? T.DEEP : d < dirtDepth + 2 ? T.DIRT : T.STONE) : 0;
    if (c.arena && d < 14) {
      if (d === 0) fg = T.RUIN;
      return [fg, wall];
    }
    // cave mouths and ravines open from the surface, so the caves can be walked into
    if (this.mouthAt(tx, ty, c.h)) return [T.AIR, d >= 2 ? (wall || T.STONE) : 0];
    // caves
    const calm = (tx > SPAWN_L - 10 && tx < SPAWN_R + 10) ? 10 : 4;
    // roomier chambers in the first stretch underground
    if (d > 5 && d < 16 && calm < 10 && fbm2(tx * 0.028, ty * 0.06, s + 71, 2) > 0.4) return [T.AIR, wall || T.STONE];
    if (d > calm) {
      const depthK = Math.min(d, 220);
      const worm = Math.abs(noise2(tx * 0.04, ty * 0.065, s + 41));
      const blob = fbm2(tx * 0.022, ty * 0.034, s + 43, 3);
      if (worm < 0.075 + depthK * 0.0003 || blob > 0.36 - depthK * 0.0009) return [T.AIR, wall || T.STONE];
    }
    // pockets of pale sand in the upper soil (glass is made from it)
    if (d >= 2 && d < 16 && fbm2(tx * 0.09, ty * 0.12, s + 29, 2) > 0.42) fg = T.SAND;
    else if (fg === T.STONE || fg === T.DEEP) {
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
  // a sloping tunnel from the surface every ~45-90 tiles, and now and then a narrow ravine
  mouthAt(tx, ty, h) {
    if (tx > SPAWN_L - 16 && tx < SPAWN_R + 16) return false;
    const s = this.seed, STEP = 67;
    const k = Math.round(tx / STEP);
    for (const kk of [k - 1, k, k + 1]) {
      const r = hash2(kk, 51, s);
      if (r < 0.2) continue;
      const mx = kk * STEP + Math.floor(hash2(kk, 52, s) * 22) - 11;
      const g = gateNear(mx);
      if (Math.abs(mx - g.gx) < ARENA_HALF + 10 || this.shrineNear(mx) !== null) continue;
      if (r > 0.86) {
        if (Math.abs(mx) < BIOME_W / 2 + 20) continue;   // no sheer drops in the first stretch
        // ravine: narrow, tapering, 14-24 deep
        const depth = 14 + Math.floor(hash2(kk, 53, s) * 10), w = 1.6 + hash2(kk, 54, s);
        const dd = ty - this.col(mx).h;
        if (dd >= -1 && dd < depth && Math.abs(tx - mx) < w * (1 - dd / depth * 0.6)) return true;
        continue;
      }
      const dir = hash2(kk, 55, s) < 0.5 ? -1 : 1, len = 18 + Math.floor(hash2(kk, 56, s) * 14);
      const u = (tx - mx) * dir;
      if (u < -2 || u > len) continue;
      // a wide, gentle opening: the floor starts level with the ground and drops half a block per column,
      // so you can always walk straight in and back out. Tall enough to jump inside.
      const top = this.col(mx).h;
      const half = 1.9;
      const uu = Math.max(0, u);
      const cy = top - half + uu * 0.5 + Math.sin(uu * 0.35 + kk) * 0.2;
      // a flared lip before the cut, then an open sloped cut until the roof is thick, then a tunnel
      if (u < 0) { if (u === -1 && ty === this.col(tx).h) return true; continue; }
      const roof = (cy - half) - this.col(tx).h;
      if (roof < 3.5 ? (ty >= this.col(tx).h - 1 && ty <= cy + half) : (ty >= cy - half && ty <= cy + half)) return true;
    }
    return false;
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
      // the trunk is real (choppable timber); the tree itself is a painted sprite drawn on it
      const top = tr.base - Math.min(tr.h, 4);
      for (let y = tr.base - 1; y >= top; y--) put(tx, y, T.LOG);
      if (tr.kind === 'shroom') put(tx, tr.base - tr.h, T.CAP);
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
  // the top layer is always turf: soil open to the sky becomes grass, and soil right beside grass (left or
  // right, never above or below) becomes grass too. One step only, from a snapshot, so it never creeps along
  // a whole row underground.
  turfPass(fg, wall, x0, y0) {
    const sky = (x, y) => {            // open air with no back wall: above ground
      const lx = x - x0, ly = y - y0;
      if (lx >= 0 && ly >= 0 && lx < CH && ly < CH) { const i = ly * CH + lx; return fg[i] === T.AIR && !wall[i]; }
      const r = this.gen(x, y); return r[0] === T.AIR && !r[1];
    };
    const grassAt = (x, y) => {        // grass after the exposure rule, for columns beyond this chunk
      const lx = x - x0, ly = y - y0;
      if (lx >= 0 && ly >= 0 && lx < CH && ly < CH) return fg[ly * CH + lx] === T.GRASS;
      const t = this.gen(x, y)[0];
      return t === T.GRASS || (t === T.DIRT && sky(x, y - 1));
    };
    const turned = [];
    for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
      const i = ly * CH + lx;
      if (fg[i] !== T.DIRT) continue;
      const x = x0 + lx, y = y0 + ly;
      if (y > this.col(x).h + 8) continue;
      if (biomeOf(biomeIndexAt(x)).id === 'frost') continue;
      if (sky(x, y - 1) || sky(x - 1, y) || sky(x + 1, y)) fg[i] = T.GRASS;
    }
    for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
      const i = ly * CH + lx;
      if (fg[i] !== T.DIRT) continue;
      const x = x0 + lx, y = y0 + ly;
      if (y > this.col(x).h + 8) continue;
      if (grassAt(x - 1, y) || grassAt(x + 1, y)) turned.push(i);
    }
    for (const i of turned) fg[i] = T.GRASS;
  }
  // after an edit: soil left open to the sky, or right beside turf, grows turf a moment later
  queueTurf(tx, ty) {
    this.turfQ = this.turfQ || [];
    if (this.turfQ.length < 400) this.turfQ.push([tx, ty, 0.8 + Math.random() * 0.6]);
  }
  tickTurf(dt) {
    const q = this.turfQ;
    if (!q || !q.length) return;
    for (const e of q) e[2] -= dt;
    const due = q.filter(e => e[2] <= 0);
    this.turfQ = q.filter(e => e[2] > 0);
    for (const [x, y] of due) {
      if (this.get(x, y) !== T.DIRT || biomeOf(biomeIndexAt(x)).id === 'frost') continue;
      const open = (a, b) => this.get(a, b) === T.AIR && !this.wall(a, b);
      if (open(x, y - 1) || open(x - 1, y) || open(x + 1, y) || this.get(x - 1, y) === T.GRASS || this.get(x + 1, y) === T.GRASS) {
        this.set(x, y, T.GRASS, 0, true);
      }
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
    this.turfPass(fg, wall, x0, y0);
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
    if (!layer && !silent) { this.queueTurf(tx, ty); this.queueTurf(tx, ty + 1); this.queueTurf(tx - 1, ty); this.queueTurf(tx + 1, ty); }
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
    for (; ty <= end; ty++) {
      const d = TILES[this.get(tx, ty)];
      if (d.solid) return ty * TILE + (d.half ? TILE / 2 : 0);
      if ((d.platform || (d.climb && !TILES[this.get(tx, ty - 1)].climb)) && ty * TILE >= y) return ty * TILE;
    }
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
