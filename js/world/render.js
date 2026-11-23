// World renderer: sky, parallax silhouettes, soft-voxel tiles (cached per 16x16 block), animated decor.
// Style: no outlines. Shape comes from rounded exposed corners, rim light on top faces and the lightmap.
import { TILE, T, TILES, BIOMES, BIOME_W, biomeIndexAt, biomeLocal, biomeOf } from './tiles.js';
import { hash2, mix, rgba, shade, clamp, lerp, smooth, fbm1, TAU } from '../core/util.js';
import { pattern, grassLip, snowLip } from '../art/tex.js';
import { drawLantern, drawHearth } from '../art/props.js';
import { capsule } from '../art/paint.js';
import { makeLayers, drawClouds, drawSkyFeature } from '../art/bg.js';

const RC = 16;           // render block size in tiles
const PAD = 14;          // world px of overdraw around a block (grass, caps, rounded bits)

// colour palette for a column, blended across biome borders
const palCache = new Map();
export function paletteAt(tx) {
  let p = palCache.get(tx);
  if (p) return p;
  const bi = biomeIndexAt(tx), local = biomeLocal(tx);
  const A = biomeOf(bi);
  let B = A, k = 0;
  const edge = 24;
  if (local < edge) { B = biomeOf(bi - 1); k = 0.5 - local / edge / 2; }
  else if (local > BIOME_W - edge) { B = biomeOf(bi + 1); k = (local - (BIOME_W - edge)) / edge / 2; }
  k = Math.round(smooth(clamp(k, 0, 1)) * 4) / 4;
  const keys = ['grass', 'grassHi', 'dirt', 'stone', 'deep', 'leaf', 'log', 'moss', 'fog', 'accent'];
  p = { id: k < 0.5 ? A.id : B.id, flower: A.flower };
  for (const key of keys) p[key] = k > 0 ? mix(A[key], B[key], k) : A[key];
  palCache.set(tx, p);
  if (palCache.size > 20000) palCache.clear();
  return p;
}
// material + colour for the texture of a tile
const MAT = {};
function matOf(t, p) {
  switch (t) {
    case T.GRASS: case T.DIRT: return ['soil', p.dirt];
    case T.STONE: return p.id === 'meadow' || p.id === 'glass' ? ['moss', p.stone, mix(p.moss, p.grass, 0.4)] : ['stone', p.stone];
    case T.DEEP: return ['deep', p.deep];
    case T.MOSS: return ['moss', p.stone, mix(p.moss, p.grass, 0.4)];
    case T.SAND: return ['sand', '#a6927a'];
    case T.SNOW: return ['snow', '#eef4fa'];
    case T.ICE: return ['ice', '#a9d8f5'];
    case T.PLANK: return ['plank', '#9b7653'];
    case T.BRICK: return ['brick', '#8f8a96'];
    case T.RUIN: case T.GATE: return ['ruin', t === T.GATE ? '#4a4652' : '#a39d93'];
    case T.MARBLE: return ['marble', '#e9e4dc'];
    case T.OBSIDIAN: return ['obsidian', '#2a2440'];
    case T.EMBER: return ['ember', '#ff7a3a'];
    case T.CRYSTAL: return ['deep', mix(p.stone, '#000000', 0.15)];
    case T.GOLD: return ['stone', p.stone];
    default: return ['stone', p.stone];
  }
}
void MAT;
function tileColor(t, p) {
  const k = TILES[t].k;
  return k && k[0] === '#' ? k : p[k] || '#ff00ff';
}

export class WorldRenderer {
  constructor(world) {
    this.world = world;
    this.cache = new Map();      // "rcx,rcy" -> {cv, scale, dirty}
    this.scale = 1;
    this.layers = new Map();     // biome id -> parallax canvases
    world.onChange((tx, ty) => this.invalidate(tx, ty));
  }
  invalidate(tx, ty) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = Math.floor((tx + dx) / RC) + ',' + Math.floor((ty + dy) / RC);
      const c = this.cache.get(k);
      if (c) c.dirty = true;
    }
  }

  // ------------------------------------------------------------ tiles
  buildBlock(rcx, rcy, scale, old) {
    const size = Math.ceil((RC * TILE + PAD * 2) * scale);
    const cv = old && old.cv.width === size ? old.cv : document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    g.setTransform(scale, 0, 0, scale, PAD * scale, PAD * scale);
    const W = this.world;
    const x0 = rcx * RC, y0 = rcy * RC;
    // walls first
    for (let ly = 0; ly < RC; ly++) for (let lx = 0; lx < RC; lx++) {
      const tx = x0 + lx, ty = y0 + ly;
      const f = W.get(tx, ty);
      if (TILES[f].opaque && TILES[f].solid) continue;
      const w = W.wall(tx, ty);
      if (!w) continue;
      this.drawWall(g, tx, ty, w, lx * TILE, ly * TILE);
    }
    // back decor: trunks, canopy (one merged mass), other passables, then solid tiles
    const each = (fn) => { for (let ly = 0; ly < RC; ly++) for (let lx = 0; lx < RC; lx++) fn(x0 + lx, y0 + ly, lx * TILE, ly * TILE); };
    each((tx, ty, x, y) => { if (W.get(tx, ty) === T.LOG) this.drawTile(g, tx, ty, T.LOG, x, y); });
    for (let pass = 0; pass < 3; pass++) each((tx, ty, x, y) => { if (W.get(tx, ty) === T.LEAVES) this.drawLeaves(g, tx, ty, x, y, pass); });
    each((tx, ty, x, y) => { const t = W.get(tx, ty); if (t && t !== T.LOG && t !== T.LEAVES && !TILES[t].solid) this.drawTile(g, tx, ty, t, x, y); });
    each((tx, ty, x, y) => { const t = W.get(tx, ty); if (t && TILES[t].solid) this.drawTile(g, tx, ty, t, x, y); });
    return { cv, scale, dirty: false, used: 0 };
  }
  drawLeaves(g, tx, ty, x, y, pass) {
    const W = this.world, p = paletteAt(tx);
    const kind = p.id;
    const col = kind === 'glass' ? '#6fdccb' : p.leaf;
    const h = hash2(tx, ty, 1), h2 = hash2(tx, ty, 2);
    const up = W.get(tx, ty - 1) === T.LEAVES, dn = W.get(tx, ty + 1) === T.LEAVES;
    const lf = W.get(tx - 1, ty) === T.LEAVES, rt = W.get(tx + 1, ty) === T.LEAVES;
    const ox = (h - 0.5) * 8, oy = (h2 - 0.5) * 6;
    if (pass === 0) {
      // underside: a darker skirt where the canopy ends
      if (!dn) { g.fillStyle = shade(col, -0.32); g.beginPath(); g.arc(x + 16, y + 21, 22, 0, TAU); g.fill(); }
    } else if (pass === 1) {
      // one merged mass filled with painted foliage
      g.fillStyle = pattern(g, 'leaf', col);
      g.beginPath(); g.arc(x + 16, y + 16, 23.5, 0, TAU); g.fill();
      const disc = (cx, cy, r) => { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); };
      if (!up) disc(x + 16 + ox * 1.5, y + 2 + oy, 11 + h * 5);
      if (!lf) disc(x + 1, y + 14 + oy, 10 + h2 * 4);
      if (!rt) disc(x + 31, y + 14 - oy, 10 + h * 4);
      if (!dn) { g.fillStyle = rgba('#000000', 0.18); disc(x + 16, y + 30, 14); }
    } else if (!up) {
      // sunlit crown
      const lg = g.createLinearGradient(0, y - 12, 0, y + 14);
      lg.addColorStop(0, rgba(shade(col, kind === 'frost' ? 0.8 : 0.35), kind === 'frost' ? 0.95 : 0.6)); lg.addColorStop(1, rgba(col, 0));
      g.fillStyle = lg;
      g.beginPath(); g.ellipse(x + 16 + ox * 1.5, y + 4 + oy, 15 + h * 4, 12, 0, Math.PI, TAU); g.fill();
      if (kind === 'glass' && h < 0.35) { g.fillStyle = rgba('#ffffff', 0.65); g.beginPath(); g.arc(x + 12 + ox, y + 6, 1.8, 0, TAU); g.fill(); }
    }
  }
  drawWall(g, tx, ty, w, x, y) {
    const p = paletteAt(tx);
    const W = this.world;
    const [mat, col, extra] = matOf(w, p);
    const n = !W.wall(tx, ty - 1), s = !W.wall(tx, ty + 1), e = !W.wall(tx + 1, ty), wv = !W.wall(tx - 1, ty);
    const R = 9;
    g.fillStyle = pattern(g, mat, col, extra);
    roundTile(g, x, y, TILE, TILE, n && wv ? R : 0, n && e ? R : 0, s && e ? R : 0, s && wv ? R : 0);
    // back walls sit in shadow and haze
    g.fillStyle = rgba(mix('#05040a', p.fog, 0.18), 0.62);
    roundTile(g, x, y, TILE, TILE, n && wv ? R : 0, n && e ? R : 0, s && e ? R : 0, s && wv ? R : 0);
    if (n) { g.fillStyle = rgba('#ffffff', 0.05); g.fillRect(x + (n && wv ? R : 0), y, TILE - (n && wv ? R : 0) - (n && e ? R : 0), 2); }
  }
  drawTile(g, tx, ty, t, x, y) {
    const W = this.world, p = paletteAt(tx);
    const d = TILES[t];
    const base = tileColor(t, p);
    const h = hash2(tx, ty, 1);
    const sol = (a, b) => { const q = W.get(a, b); return TILES[q].solid && TILES[q].opaque; };
    if (!d.solid) return this.drawPassable(g, tx, ty, t, x, y, p, base, h);
    const n = !sol(tx, ty - 1), s = !sol(tx, ty + 1), e = !sol(tx + 1, ty), w = !sol(tx - 1, ty);
    const R = 10;
    const rNW = n && w ? R : 0, rNE = n && e ? R : 0, rSE = s && e ? R : 0, rSW = s && w ? R : 0;
    if (t === T.GLASS) {
      g.fillStyle = rgba(base, 0.2);
      roundTile(g, x, y, TILE, TILE, rNW, rNE, rSE, rSW);
      g.strokeStyle = rgba('#e8f8ff', 0.5); g.lineWidth = 1.5;
      g.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
      g.fillStyle = rgba('#ffffff', 0.35);
      g.beginPath(); g.moveTo(x + 6, y + 26); g.lineTo(x + 20, y + 6); g.lineTo(x + 25, y + 6); g.lineTo(x + 11, y + 26); g.fill();
      return;
    }
    const [mat, col, extra] = matOf(t, p);
    g.fillStyle = pattern(g, mat, col, extra);
    if (t === T.ICE) g.globalAlpha = 0.85;
    roundTile(g, x, y, TILE, TILE, rNW, rNE, rSE, rSW);
    g.globalAlpha = 1;
    // ore and veins
    if (t === T.CRYSTAL) {
      for (let k = 0; k < 3; k++) {
        const hx = hash2(tx, ty, 10 + k), hy = hash2(tx, ty, 20 + k);
        const cx = x + 6 + hx * 20, cy = y + 6 + hy * 20, r = 4 + hash2(tx, ty, 30 + k) * 5;
        g.fillStyle = shade(base, -0.25); g.beginPath(); g.moveTo(cx, cy - r * 1.4); g.lineTo(cx + r * 0.7, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r * 0.7, cy); g.closePath(); g.fill();
        g.fillStyle = mix(base, '#ffffff', 0.15 * k); g.beginPath(); g.moveTo(cx, cy - r * 1.4); g.lineTo(cx + r * 0.7, cy); g.lineTo(cx, cy + r * 0.2); g.closePath(); g.fill();
        g.fillStyle = rgba('#ffffff', 0.8); g.beginPath(); g.moveTo(cx, cy - r * 1.4); g.lineTo(cx + r * 0.25, cy - r * 0.2); g.lineTo(cx, cy); g.closePath(); g.fill();
      }
    } else if (t === T.GOLD) {
      for (let k = 0; k < 6; k++) {
        const hx = hash2(tx, ty, 40 + k), hy = hash2(tx, ty, 50 + k), r = 1.4 + hash2(tx, ty, 60 + k) * 2.6;
        g.fillStyle = shade(base, -0.3); g.beginPath(); g.arc(x + 4 + hx * 24, y + 5 + hy * 24, r, 0, TAU); g.fill();
        g.fillStyle = base; g.beginPath(); g.arc(x + 4 + hx * 24 - 0.4, y + 4 + hy * 24, r * 0.85, 0, TAU); g.fill();
        g.fillStyle = rgba('#fff6d8', 0.8); g.fillRect(x + 3.4 + hx * 24, y + 3 + hy * 24, 1, 1);
      }
    }
    // exposed faces: turf / snow cap on top, lit rim, shade underneath and on the far side
    if (n) {
      if (t === T.GRASS) {
        const lip = grassLip(p.grass, p.grassHi);
        g.drawImage(lip, ((tx % 4) + 4) % 4 * 32, 0, 32, lip.height, x - 0.3, y - 7, 32.6, lip.height);
      } else if (t === T.SNOW || (p.id === 'frost' && (t === T.STONE || t === T.DIRT))) {
        const lip = snowLip();
        g.drawImage(lip, ((tx % 4) + 4) % 4 * 32, 0, 32, lip.height, x - 0.3, y - 5, 32.6, lip.height);
      } else {
        const lg = g.createLinearGradient(0, y, 0, y + 6);
        lg.addColorStop(0, rgba('#ffffff', 0.22)); lg.addColorStop(1, rgba('#ffffff', 0));
        g.fillStyle = lg; g.fillRect(x + (rNW ? 6 : 0), y, TILE - (rNW ? 6 : 0) - (rNE ? 6 : 0), 6);
      }
    }
    if (s) {
      const sg = g.createLinearGradient(0, y + TILE - 9, 0, y + TILE);
      sg.addColorStop(0, rgba('#000000', 0)); sg.addColorStop(1, rgba('#000000', 0.38));
      g.fillStyle = sg; g.fillRect(x + (rSW ? 7 : 0), y + TILE - 9, TILE - (rSW ? 7 : 0) - (rSE ? 7 : 0), 9);
      if ((t === T.DIRT || t === T.GRASS) && h < 0.45) {
        // roots dangle from soil ceilings
        g.strokeStyle = rgba(shade(base, -0.4), 0.9); g.lineWidth = 1.3; g.lineCap = 'round';
        const rx = x + 6 + h * 40, len = 6 + hash2(tx, ty, 7) * 12;
        g.beginPath(); g.moveTo(rx, y + TILE - 1); g.quadraticCurveTo(rx + 3, y + TILE + len * 0.5, rx - 1, y + TILE + len); g.stroke();
      }
      if ((t === T.MOSS || (p.id === 'glass' || p.id === 'meadow') && t === T.STONE) && h > 0.7) {
        g.fillStyle = rgba('#7fa36b', 0.9);
        for (let k = 0; k < 3; k++) { const mx = x + 5 + k * 9 + h * 4, ml = 4 + hash2(tx, ty, 80 + k) * 8; g.beginPath(); g.moveTo(mx - 2, y + TILE - 1); g.lineTo(mx + 2, y + TILE - 1); g.lineTo(mx, y + TILE + ml); g.closePath(); g.fill(); }
      }
    }
    if (w) { const wg = g.createLinearGradient(x, 0, x + 5, 0); wg.addColorStop(0, rgba('#ffffff', 0.1)); wg.addColorStop(1, rgba('#ffffff', 0)); g.fillStyle = wg; g.fillRect(x, y + (rNW ? 7 : 0), 5, TILE - (rNW ? 7 : 0) - (rSW ? 7 : 0)); }
    if (e) { const eg = g.createLinearGradient(x + TILE - 7, 0, x + TILE, 0); eg.addColorStop(0, rgba('#000000', 0)); eg.addColorStop(1, rgba('#000000', 0.26)); g.fillStyle = eg; g.fillRect(x + TILE - 7, y + (rNE ? 7 : 0), 7, TILE - (rNE ? 7 : 0) - (rSE ? 7 : 0)); }
  }
  drawPassable(g, tx, ty, t, x, y, p, base, h) {
    const W = this.world;
    if (t === T.LOG) {
      const below = W.get(tx, ty + 1), above = W.get(tx, ty - 1);
      const kind = p.id;
      let col = base;
      if (kind === 'glass') col = '#5d7d88';
      if (kind === 'hollow') col = '#cfc6ee';
      const top = above === T.LOG, foot = TILES[below].solid;
      const wTop = top ? 12 : 8, wBot = foot ? 24 : below === T.LOG ? 12 : 14;
      g.beginPath();
      g.moveTo(x + 16 - wTop / 2, y);
      g.lineTo(x + 16 + wTop / 2, y);
      if (foot) { g.quadraticCurveTo(x + 16 + 6, y + TILE - 6, x + 16 + wBot / 2, y + TILE + 0.5); g.lineTo(x + 16 - wBot / 2, y + TILE + 0.5); g.quadraticCurveTo(x + 16 - 6, y + TILE - 6, x + 16 - wTop / 2, y); }
      else { g.lineTo(x + 16 + wBot / 2, y + TILE + 0.5); g.lineTo(x + 16 - wBot / 2, y + TILE + 0.5); }
      g.closePath();
      g.fillStyle = pattern(g, 'bark', col); g.fill();
      const sh = g.createLinearGradient(x + 16 - 9, 0, x + 16 + 9, 0);
      sh.addColorStop(0, rgba('#ffffff', 0.12)); sh.addColorStop(0.45, rgba('#000000', 0)); sh.addColorStop(1, rgba('#000000', 0.42));
      g.fillStyle = sh; g.fill();
      if (!top && hash2(tx, ty, 9) < 0.5) { g.strokeStyle = col; g.lineWidth = 3; g.lineCap = 'round'; const d = hash2(tx, ty, 8) < 0.5 ? -1 : 1; g.beginPath(); g.moveTo(x + 16, y + 8); g.quadraticCurveTo(x + 16 + d * 8, y + 2, x + 16 + d * 14, y - 4); g.stroke(); }
      return;
    }
    if (t === T.LEAVES) return;
    if (t === T.CAP) {
      const up = W.get(tx, ty - 1) === T.CAP;
      g.fillStyle = up ? shade(base, -0.15) : base;
      g.beginPath(); g.roundRect(x - 1, y + (up ? 0 : 6), TILE + 2, up ? TILE : TILE - 6, up ? 0 : [12, 12, 0, 0]); g.fill();
      if (!up) { g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(x + 2, y + 7, TILE - 4, 2); }
      g.fillStyle = rgba('#e6deff', 0.5);
      g.beginPath(); g.arc(x + 8 + h * 16, y + 18, 2.2, 0, TAU); g.fill();
      return;
    }
    if (t === T.SHROOM) {
      g.fillStyle = '#d8d0f5'; g.fillRect(x + 14, y + 18, 4, 14);
      g.fillStyle = base; g.beginPath(); g.ellipse(x + 16, y + 19, 10, 6, 0, Math.PI, TAU); g.fill();
      g.fillStyle = '#e6deff'; g.beginPath(); g.arc(x + 12, y + 15, 1.5, 0, TAU); g.arc(x + 19, y + 16, 1.2, 0, TAU); g.fill();
      return;
    }
    if (t === T.LANTERN) {
      const hang = TILES[W.get(tx, ty - 1)].solid && !TILES[W.get(tx, ty + 1)].solid;
      if (hang) { g.strokeStyle = '#2d2a30'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 16, y); g.lineTo(x + 16, y + 8); g.stroke(); drawLantern(g, x + 16, y + 17, 1, 0); }
      else { capsule(g, x + 16, y + TILE, x + 16, y + 20, 2.2, 2, '#3a3036', { dark: 0.5 }); drawLantern(g, x + 16, y + 12, 1, 0); }
      return;
    }
    if (t === T.HEARTH) { drawHearth(g, x + 16, y + TILE, 0.62, 0.5); return; }
  }

  ensureScale(s) {
    const q = Math.max(0.5, Math.round(s * 8) / 8);
    if (Math.abs(q - this.scale) > 1e-3) {
      this.scale = q;
      for (const c of this.cache.values()) c.dirty = true;
    }
    return q;
  }

  // draw all visible tile blocks. ctx is in world space (transform set by caller).
  drawTiles(ctx, view) {
    const s = view.scale;
    const q = this.ensureScale(s);
    const x0 = Math.floor(view.x0 / TILE / RC) - 0, x1 = Math.floor(view.x1 / TILE / RC);
    const y0 = Math.floor(view.y0 / TILE / RC), y1 = Math.floor(view.y1 / TILE / RC);
    let builds = 0;
    const frame = view.frame;
    for (let ry = y0; ry <= y1; ry++) for (let rx = x0; rx <= x1; rx++) {
      const k = rx + ',' + ry;
      let c = this.cache.get(k);
      if (!c || c.dirty || c.scale !== q) {
        // keep stale art on screen while we spread rebuilds over frames, unless missing
        if (!c || builds < 4 || c.dirty) {
          c = this.buildBlock(rx, ry, q, c);
          this.cache.set(k, c);
          builds++;
        }
      }
      c.used = frame;
      const sz = c.cv.width / c.scale;
      ctx.drawImage(c.cv, rx * RC * TILE - PAD, ry * RC * TILE - PAD, sz, sz);
    }
    if (this.cache.size > 90) for (const [k, c] of this.cache) if (frame - c.used > 120) this.cache.delete(k);
  }

  // animated grass, flowers, sprouts on top of exposed natural ground
  drawDecor(ctx, view, time, actors, wind) {
    const W = this.world;
    const tx0 = Math.floor(view.x0 / TILE) - 1, tx1 = Math.floor(view.x1 / TILE) + 1;
    const ty0 = Math.floor(view.y0 / TILE) - 1, ty1 = Math.floor(view.y1 / TILE) + 1;
    ctx.lineCap = 'round';
    for (let tx = tx0; tx <= tx1; tx++) {
      const p = paletteAt(tx);
      for (let ty = ty0; ty <= ty1; ty++) {
        const t = W.get(tx, ty);
        if (t !== T.GRASS) continue;
        if (W.get(tx, ty - 1) !== T.AIR && W.get(tx, ty - 1) !== T.LOG) continue;
        const bx = tx * TILE, by = ty * TILE;
        // push from nearby actors
        let push = 0;
        for (const a of actors) {
          const dx = bx + 16 - a.x, dy = by - a.y;
          if (Math.abs(dx) < 34 && dy > -20 && dy < 70) push += Math.sign(dx || 1) * (1 - Math.abs(dx) / 34) * 0.9;
        }
        const n = 5;
        ctx.strokeStyle = p.grass;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const hx = hash2(tx, ty, 100 + k);
          const x = bx + 2 + (k + hx * 0.8) * (28 / n);
          const len = 6 + hash2(tx, ty, 110 + k) * 9;
          const sway = Math.sin(time * 1.6 + x * 0.05) * wind * 3 + push * 7;
          ctx.moveTo(x, by + 2);
          ctx.quadraticCurveTo(x + sway * 0.3, by - len * 0.5, x + sway, by - len);
        }
        ctx.stroke();
        const fh = hash2(tx, ty, 120);
        if (fh < 0.16) {
          const x = bx + 6 + fh * 120, len = 12 + fh * 40;
          const sway = Math.sin(time * 1.4 + x * 0.04) * wind * 3 + push * 6;
          ctx.strokeStyle = shade(p.grass, -0.1); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x, by + 2); ctx.quadraticCurveTo(x, by - len * 0.5, x + sway, by - len); ctx.stroke();
          ctx.fillStyle = p.flower[(fh * 100 | 0) % p.flower.length];
          ctx.beginPath(); ctx.arc(x + sway, by - len, 3, 0, TAU); ctx.fill();
        }
      }
    }
  }

  // ------------------------------------------------------------ sky + parallax
  layerSet(B) {
    let L = this.layers.get(B.id);
    if (L) return L;
    L = makeLayers(B);
    this.layers.set(B.id, L);
    return L;
  }
  // screen-space background. depth: 0 at surface, 1 deep underground
  drawSky(ctx, W, H, camX, camY, zoom, time, blend, depth, tierDark, tease) {
    const { A, B, k } = blend;
    const sky = i => k > 0 ? mix(A.sky[i], B.sky[i], k) : A.sky[i];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky(0)); g.addColorStop(0.55, sky(1)); g.addColorStop(1, sky(2));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // sun glow
    const sunCol = k > 0.5 ? B.sunCol : A.sunCol;
    const sx = W * 0.72 - camX * 0.01 % W, sy = H * 0.58 + camY * 0.02;
    const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.9);
    rg.addColorStop(0, rgba(sunCol, 0.55)); rg.addColorStop(0.15, rgba(sunCol, 0.22)); rg.addColorStop(1, rgba(sunCol, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rgba(sunCol, 0.8); ctx.beginPath(); ctx.arc(sx, sy, H * 0.045, 0, TAU); ctx.fill();
    // stars for darker skies
    const starA = (A.id === 'hollow' || A.id === 'ember' ? 0.8 : 0.15) * (1 - k) + (B.id === 'hollow' || B.id === 'ember' ? 0.8 : 0.15) * k + tierDark * 0.6;
    if (starA > 0.05) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 90; i++) {
        const x = ((hash2(i, 1, 9) * W * 1.5 - camX * 0.004) % W + W) % W, y = hash2(i, 2, 9) * H * 0.6;
        ctx.globalAlpha = starA * (0.3 + 0.7 * Math.abs(Math.sin(time * 0.7 + i))) * (1 - y / (H * 0.6));
        ctx.fillRect(x, y, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }
    // set pieces and clouds behind the flats
    const LA = this.layerSet(A), LB = k > 0 ? this.layerSet(B) : null;
    drawSkyFeature(ctx, A, W, H, camX, camY, zoom, time, 1 - k);
    if (LB) drawSkyFeature(ctx, B, W, H, camX, camY, zoom, time, k);
    drawClouds(ctx, LA, W, H, camX, camY, zoom, time, 1 - k);
    if (LB) drawClouds(ctx, LB, W, H, camX, camY, zoom, time, k);
    // parallax silhouettes
    const factors = [0.06, 0.14, 0.26, 0.42];
    for (let i = 0; i < 4; i++) {
      const f = factors[i];
      const drawL = (L, alpha) => {
        const cv = L[i];
        const lw = cv.width, lh = cv.height;
        const sc = zoom * (0.75 + f * 0.6);
        const w = lw * sc, h = lh * sc;
        const baseY = H * 0.62 + (-camY * f * zoom) * 0.55 + (i * 0.06) * H;
        let ox = -((camX * f * zoom) % w);
        if (ox > 0) ox -= w;
        ctx.globalAlpha = alpha;
        for (let x = ox; x < W; x += w) ctx.drawImage(cv, x, baseY - h * 0.8, w + 1, h);
        // fill below the layer so tall views never show a gap
        const bottom = baseY + h * 0.2;
        if (bottom < H) { ctx.fillStyle = L.fills[i]; ctx.fillRect(0, bottom - 1, W, H - bottom + 1); }
        ctx.globalAlpha = 1;
      };
      drawL(LA, 1);
      if (LB) drawL(LB, k);
      if (i === 1 && tease) this.drawTease(ctx, W, H, camX, camY, zoom, time, tease);
      if (i === 1) { drawClouds(ctx, LA, W, H, camX, camY, zoom, time, 1 - k, 1); if (LB) drawClouds(ctx, LB, W, H, camX, camY, zoom, time, k, 1); }
    }
    // underground: the sky fades into cave dark
    if (depth > 0) {
      const cave = mix(A.deep, '#05050a', 0.6);
      ctx.fillStyle = rgba(cave, clamp(depth, 0, 1));
      ctx.fillRect(0, 0, W, H);
    }
  }
  // a giant shape on the horizon where the next warden waits
  drawTease(ctx, W, H, camX, camY, scale, time, tease) {
    if (!tease || tease.k <= 0.01) return;
    const f = 0.16;
    const sx = W / 2 + (tease.x - camX) * f * scale * 1.0;
    const baseY = H * 0.62 + (-camY * f * scale) * 0.55 + 0.1 * H;
    if (sx < -W * 0.5 || sx > W * 1.5) return;
    const h = H * 0.62;
    ctx.save();
    ctx.globalAlpha = tease.k * 0.85;
    ctx.translate(sx, baseY);
    ctx.fillStyle = tease.col;
    const u = h / 100;
    const breathe = Math.sin(time * 0.8) * u * 0.6;
    if (tease.arch === 'warden') {
      ctx.beginPath(); ctx.ellipse(0, -50 * u + breathe, 15 * u, 26 * u, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-7 * u, -88 * u + breathe, 14 * u, 15 * u, 5 * u); ctx.fill();
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sd * 4 * u, -86 * u + breathe); ctx.quadraticCurveTo(sd * 14 * u, -96 * u, sd * 10 * u, -108 * u); ctx.quadraticCurveTo(sd * 9 * u, -97 * u, sd * 1 * u, -88 * u); ctx.fill();
        ctx.fillRect(sd * 6 * u - 3 * u, -28 * u, 6 * u, 30 * u);
      }
      ctx.save(); ctx.translate(16 * u, -60 * u); ctx.rotate(0.25); ctx.fillRect(-1.5 * u, -2 * u, 3 * u, 60 * u); ctx.restore();
    } else if (tease.arch === 'wraith') {
      const fl = Math.sin(time * 0.6) * 4 * u;
      ctx.beginPath(); ctx.moveTo(0, -100 * u + fl); ctx.quadraticCurveTo(26 * u, -70 * u + fl, 30 * u, -10 * u); ctx.lineTo(10 * u, -20 * u); ctx.lineTo(0, -4 * u); ctx.lineTo(-10 * u, -18 * u); ctx.lineTo(-30 * u, -8 * u); ctx.quadraticCurveTo(-26 * u, -70 * u + fl, 0, -100 * u + fl); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-7 * u, -106 * u + fl, 14 * u, 15 * u, 5 * u); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, -60 * u, 14 * u, 0, TAU); ctx.fill();
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + time * 0.15; ctx.beginPath(); ctx.roundRect(Math.cos(a) * 28 * u - 5 * u, -60 * u + Math.sin(a) * 22 * u - 5 * u, 10 * u, 10 * u, 2 * u); ctx.fill(); }
    }
    // eyes that notice you
    const blink = (Math.sin(time * 0.9) > -0.97) ? 1 : 0.1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = tease.k * blink;
    ctx.fillStyle = tease.eye;
    const ey = tease.arch === 'warden' ? -82 * u + breathe : tease.arch === 'wraith' ? -100 * u : -62 * u;
    ctx.beginPath(); ctx.ellipse(-3 * u, ey, 1.4 * u, 0.7 * u, 0, 0, TAU); ctx.ellipse(3 * u, ey, 1.4 * u, 0.7 * u, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(0, ey, 0, 0, ey, 8 * u);
    g.addColorStop(0, rgba(tease.eye, 0.22)); g.addColorStop(1, rgba(tease.eye, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, ey, 8 * u, 0, TAU); ctx.fill();
    ctx.restore();
  }
  drawShafts(ctx, W, H, time, strength, col) {
    if (strength <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const ph = time * 0.05 + i * 1.7;
      const x = ((i * 0.23 + 0.1 + Math.sin(ph) * 0.03) % 1) * W * 1.2;
      const a = strength * (0.022 + 0.018 * Math.sin(time * 0.3 + i * 2));
      const wdt = W * (0.05 + 0.04 * hash2(i, 3, 1));
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(col, a)); g.addColorStop(0.7, rgba(col, a * 0.3)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, -10); ctx.lineTo(x + wdt, -10); ctx.lineTo(x + wdt - H * 0.45, H); ctx.lineTo(x - H * 0.45 - wdt * 0.6, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

export function biomeBlendAt(x) {
  const tx = x / TILE;
  const bi = biomeIndexAt(tx), local = biomeLocal(tx);
  const A = biomeOf(bi);
  const edge = 30;
  if (local < edge) return { A: biomeOf(bi - 1), B: A, k: smooth(0.5 + local / edge / 2), bi };
  if (local > BIOME_W - edge) return { A, B: biomeOf(bi + 1), k: smooth((local - (BIOME_W - edge)) / edge / 2), bi };
  return { A, B: A, k: 0, bi };
}

// rounded rect with individual corner radii, filled
function roundTile(g, x, y, w, h, a, b, c, d) {
  if (!a && !b && !c && !d) { g.fillRect(x, y, w + 0.5, h + 0.5); return; }
  g.beginPath();
  g.moveTo(x + a, y);
  g.lineTo(x + w - b + 0.5, y); if (b) g.quadraticCurveTo(x + w, y, x + w, y + b); else g.lineTo(x + w + 0.5, y);
  g.lineTo(x + w + (b || c ? 0 : 0.5), y + h - c + 0.5); if (c) g.quadraticCurveTo(x + w, y + h, x + w - c, y + h); else g.lineTo(x + w + 0.5, y + h + 0.5);
  g.lineTo(x + d, y + h + (c || d ? 0 : 0.5)); if (d) g.quadraticCurveTo(x, y + h, x, y + h - d); else g.lineTo(x, y + h + 0.5);
  g.lineTo(x, y + a); if (a) g.quadraticCurveTo(x, y, x + a, y);
  g.closePath(); g.fill();
}

