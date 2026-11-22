// World renderer: sky, parallax silhouettes, soft-voxel tiles (cached per 16x16 block), animated decor.
// Style: no outlines. Shape comes from rounded exposed corners, rim light on top faces and the lightmap.
import { TILE, T, TILES, BIOMES, BIOME_W, biomeIndexAt, biomeLocal, biomeOf } from './tiles.js';
import { hash2, mix, rgba, shade, clamp, lerp, smooth, fbm1, TAU } from '../core/util.js';

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
  k = smooth(clamp(k, 0, 1));
  const keys = ['grass', 'grassHi', 'dirt', 'stone', 'deep', 'leaf', 'log', 'moss', 'fog', 'accent'];
  p = { id: k < 0.5 ? A.id : B.id, flower: A.flower };
  for (const key of keys) p[key] = k > 0 ? mix(A[key], B[key], k) : A[key];
  palCache.set(tx, p);
  if (palCache.size > 20000) palCache.clear();
  return p;
}
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
    const col = kind === 'glass' ? '#6fdccb' : kind === 'frost' ? '#4f7283' : p.leaf;
    const h = hash2(tx, ty, 1), h2 = hash2(tx, ty, 2);
    const up = W.get(tx, ty - 1) === T.LEAVES, dn = W.get(tx, ty + 1) === T.LEAVES;
    const ox = (h - 0.5) * 8, oy = (h2 - 0.5) * 6;
    const lf = W.get(tx - 1, ty) === T.LEAVES, rt = W.get(tx + 1, ty) === T.LEAVES;
    if (pass === 0) {
      // underside shade: only where the canopy ends below
      if (!dn) { g.fillStyle = shade(col, -0.2); g.beginPath(); g.arc(x + 16, y + 20, 22, 0, TAU); g.fill(); }
    } else if (pass === 1) {
      // one merged mass: big overlapping discs in a single colour, small clumps on the outer rim
      g.fillStyle = col;
      g.beginPath(); g.arc(x + 16, y + 16, 23.5, 0, TAU); g.fill();
      if (!up || !lf || !rt) {
        const disc = (cx, cy, r) => { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); };
        if (!up) disc(x + 16 + ox * 1.5, y + 2 + oy, 11 + h * 5);
        if (!lf) disc(x + 1, y + 14 + oy, 10 + h2 * 4);
        if (!rt) disc(x + 31, y + 14 - oy, 10 + h * 4);
      }
    } else if (!up) {
      // sunlit crown, kept soft
      g.fillStyle = rgba(shade(col, kind === 'frost' ? 0.75 : 0.25), kind === 'frost' ? 0.9 : 0.55);
      g.beginPath(); g.ellipse(x + 16 + ox * 1.5, y + 2 + oy, 9 + h * 4, 5, 0, Math.PI, TAU); g.fill();
      if (kind === 'glass' && h < 0.3) { g.fillStyle = rgba('#ffffff', 0.5); g.beginPath(); g.arc(x + 12 + ox, y + 6, 2, 0, TAU); g.fill(); }
    }
  }
  drawWall(g, tx, ty, w, x, y) {
    const p = paletteAt(tx);
    const W = this.world;
    let c = tileColor(w, p);
    c = mix(mix(c, '#000000', 0.55), p.fog, 0.1);
    const n = !W.wall(tx, ty - 1), s = !W.wall(tx, ty + 1), e = !W.wall(tx + 1, ty), wv = !W.wall(tx - 1, ty);
    g.fillStyle = c;
    roundTile(g, x, y, TILE, TILE, n && wv ? 8 : 0, n && e ? 8 : 0, s && e ? 8 : 0, s && wv ? 8 : 0);
    if (w === T.RUIN || w === T.BRICK || w === T.PLANK) {
      g.fillStyle = rgba('#000000', 0.12);
      if (w === T.PLANK) g.fillRect(x, y + 15, TILE, 2);
      else g.fillRect(x + ((ty & 1) ? 0 : 15), y, 2, TILE);
    }
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
    let c = shade(base, (h - 0.5) * 0.06);
    if (t === T.GLASS) {
      g.fillStyle = rgba(base, 0.22);
      roundTile(g, x, y, TILE, TILE, rNW, rNE, rSE, rSW);
      g.fillStyle = rgba('#ffffff', 0.35);
      if (n) g.fillRect(x + 2, y + 1, TILE - 4, 2);
      g.beginPath(); g.moveTo(x + 6, y + 26); g.lineTo(x + 20, y + 6); g.lineTo(x + 24, y + 6); g.lineTo(x + 10, y + 26); g.fill();
      return;
    }
    if (t === T.ICE) {
      g.fillStyle = rgba(base, 0.75);
      roundTile(g, x, y, TILE, TILE, rNW, rNE, rSE, rSW);
      g.fillStyle = rgba('#ffffff', 0.35);
      g.beginPath(); g.moveTo(x + 4, y + 22); g.lineTo(x + 16, y + 4); g.lineTo(x + 21, y + 4); g.lineTo(x + 9, y + 22); g.fill();
      if (n) { g.fillStyle = rgba('#ffffff', 0.7); g.fillRect(x + (rNW ? 6 : 0), y, TILE - (rNW ? 6 : 0) - (rNE ? 6 : 0), 2); }
      return;
    }
    g.fillStyle = c;
    roundTile(g, x, y, TILE, TILE, rNW, rNE, rSE, rSW);
    // material detail (low contrast; no outlines)
    switch (t) {
      case T.PLANK: {
        g.fillStyle = shade(c, -0.14);
        g.fillRect(x, y + 10, TILE, 1.5); g.fillRect(x, y + 21, TILE, 1.5);
        g.fillRect(x + ((ty * 7) % 3) * 9 + 4, y, 1.5, 10);
        g.fillStyle = shade(c, 0.1); g.fillRect(x, y + 1, TILE, 1.5);
        break;
      }
      case T.BRICK: case T.RUIN: case T.MARBLE: {
        const off = (ty & 1) ? 0 : 16;
        g.fillStyle = shade(c, t === T.MARBLE ? -0.06 : -0.16);
        g.fillRect(x, y + 15, TILE, 2);
        g.fillRect(x + off, y, 2, 15);
        g.fillRect(x + ((off + 16) % 32), y + 17, 2, 15);
        if (t === T.MARBLE) { g.strokeStyle = rgba('#a9a39a', 0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(x + 3, y + 5 + h * 8); g.quadraticCurveTo(x + 16, y + 20, x + 29, y + 12 + h * 10); g.stroke(); }
        if (t === T.RUIN && h > 0.7) { g.fillStyle = shade(c, -0.2); g.fillRect(x + 6 + h * 10, y + 4, 2, 9); }
        break;
      }
      case T.CRYSTAL: {
        g.fillStyle = mix(p.stone, '#000000', 0.15);
        roundTile(g, x, y, TILE, TILE, rNW, rNE, rSE, rSW);
        const cc = base;
        for (let k = 0; k < 3; k++) {
          const hx = hash2(tx, ty, 10 + k), hy = hash2(tx, ty, 20 + k);
          const cx = x + 6 + hx * 20, cy = y + 6 + hy * 20, r = 4 + hash2(tx, ty, 30 + k) * 5;
          g.fillStyle = mix(cc, '#ffffff', 0.15 * k);
          g.beginPath(); g.moveTo(cx, cy - r * 1.4); g.lineTo(cx + r * 0.7, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r * 0.7, cy); g.closePath(); g.fill();
          g.fillStyle = rgba('#ffffff', 0.7); g.beginPath(); g.moveTo(cx, cy - r * 1.4); g.lineTo(cx + r * 0.25, cy - r * 0.2); g.lineTo(cx, cy); g.closePath(); g.fill();
        }
        break;
      }
      case T.GOLD: {
        g.fillStyle = mix(p.stone, '#000000', 0.05);
        roundTile(g, x, y, TILE, TILE, rNW, rNE, rSE, rSW);
        g.fillStyle = base;
        for (let k = 0; k < 5; k++) { const hx = hash2(tx, ty, 40 + k), hy = hash2(tx, ty, 50 + k); g.beginPath(); g.arc(x + 4 + hx * 24, y + 4 + hy * 24, 1.5 + hash2(tx, ty, 60 + k) * 2.5, 0, TAU); g.fill(); }
        break;
      }
      case T.EMBER: {
        g.fillStyle = '#2b1714';
        roundTile(g, x, y, TILE, TILE, rNW, rNE, rSE, rSW);
        g.strokeStyle = base; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x + 3, y + 8 + h * 12); g.lineTo(x + 13, y + 14); g.lineTo(x + 19, y + 6 + h * 6); g.lineTo(x + 29, y + 18); g.stroke();
        g.lineWidth = 1; g.strokeStyle = '#ffd2a0';
        g.beginPath(); g.moveTo(x + 13, y + 14); g.lineTo(x + 15, y + 26); g.stroke();
        break;
      }
      case T.OBSIDIAN: {
        g.fillStyle = rgba('#b8a8ff', 0.18); g.beginPath(); g.moveTo(x + 4, y + 28); g.lineTo(x + 22, y + 4); g.lineTo(x + 27, y + 4); g.lineTo(x + 9, y + 28); g.fill();
        break;
      }
      default: {
        // natural mass: a few soft specks and strata
        g.fillStyle = shade(c, -0.08);
        const ns = t === T.DIRT || t === T.GRASS ? 3 : 2;
        for (let k = 0; k < ns; k++) {
          const hx = hash2(tx, ty, 70 + k), hy = hash2(tx, ty, 80 + k);
          g.beginPath(); g.ellipse(x + 3 + hx * 26, y + 3 + hy * 26, 2 + hx * 3, 1.3 + hy * 1.5, 0, 0, TAU); g.fill();
        }
        if (t === T.MOSS) { g.fillStyle = rgba('#a8d8a0', 0.25); g.beginPath(); g.arc(x + 10 + h * 12, y + 10, 6, 0, TAU); g.fill(); }
      }
    }
    // exposed faces: rim light on top, soft shade underneath
    const topCol = t === T.GRASS ? p.grass : t === T.SNOW ? '#ffffff' : null;
    if (n) {
      if (topCol) {
        g.fillStyle = topCol;
        g.beginPath();
        const yb = y + 8 + h * 2;
        g.moveTo(x + (rNW ? 1 : 0), y + (rNW ? R * 0.6 : 0));
        if (rNW) g.quadraticCurveTo(x, y, x + R, y); else g.lineTo(x, y);
        g.lineTo(x + TILE - rNE, y);
        if (rNE) g.quadraticCurveTo(x + TILE, y, x + TILE - 1, y + R * 0.6); else g.lineTo(x + TILE, y);
        g.lineTo(x + TILE - (e ? 1 : 0), e ? y + 13 : yb);
        g.quadraticCurveTo(x + 22, yb + 3, x + 16, yb);
        g.quadraticCurveTo(x + 8, yb - 3, x + (w ? 1 : 0), w ? y + 13 : yb);
        g.closePath(); g.fill();
        g.fillStyle = t === T.GRASS ? p.grassHi : '#ffffff';
        g.globalAlpha = 0.55;
        g.fillRect(x + (rNW ? 6 : 0), y, TILE - (rNW ? 6 : 0) - (rNE ? 6 : 0), 2);
        g.globalAlpha = 1;
      } else {
        g.fillStyle = rgba('#ffffff', 0.13);
        g.fillRect(x + (rNW ? 7 : 0), y, TILE - (rNW ? 7 : 0) - (rNE ? 7 : 0), 3);
      }
    }
    if (s) { g.fillStyle = rgba('#000000', 0.16); g.fillRect(x + (rSW ? 8 : 0), y + TILE - 4, TILE - (rSW ? 8 : 0) - (rSE ? 8 : 0), 4); }
  }
  drawPassable(g, tx, ty, t, x, y, p, base, h) {
    const W = this.world;
    if (t === T.LOG) {
      const below = W.get(tx, ty + 1), above = W.get(tx, ty - 1);
      const kind = p.id;
      let col = base;
      if (kind === 'glass') col = '#5d7d88';
      if (kind === 'hollow') col = '#cfc6ee';
      const wTop = above === T.LOG ? 12 : 9, wBot = below === T.LOG ? 12 : 15;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x + 16 - wTop / 2, y); g.lineTo(x + 16 + wTop / 2, y);
      g.lineTo(x + 16 + wBot / 2, y + TILE + 0.5); g.lineTo(x + 16 - wBot / 2, y + TILE + 0.5); g.fill();
      g.fillStyle = rgba('#ffffff', 0.14); g.fillRect(x + 16 - wTop / 2 + 1, y, 3, TILE);
      g.fillStyle = rgba('#000000', 0.18); g.fillRect(x + 16 + wTop / 2 - 4, y, 3, TILE);
      if (TILES[below].solid) { g.fillStyle = col; g.beginPath(); g.ellipse(x + 16, y + TILE - 2, 12, 4, 0, 0, TAU); g.fill(); }
      return;
    }
    if (t === T.LEAVES) {
      const kind = p.id;
      const col = kind === 'glass' ? '#73e6d4' : kind === 'frost' ? '#55788a' : p.leaf;
      const alpha = kind === 'glass' ? 0.78 : 1;
      g.globalAlpha = alpha;
      const up = W.get(tx, ty - 1) === T.LEAVES;
      const dn = W.get(tx, ty + 1) === T.LEAVES;
      const lf = W.get(tx - 1, ty) === T.LEAVES, rt = W.get(tx + 1, ty) === T.LEAVES;
      g.fillStyle = dn ? col : shade(col, -0.16);
      g.beginPath(); g.arc(x + 16 + (h - 0.5) * 6, y + 17, 19, 0, TAU); g.fill();
      if (!dn) { g.fillStyle = shade(col, -0.16); g.beginPath(); g.arc(x + 16, y + 22, 15, 0, TAU); g.fill(); }
      g.fillStyle = col;
      g.beginPath(); g.arc(x + 16 + (h - 0.5) * 6, y + 14, 16, 0, TAU); g.fill();
      if (!up) {
        g.fillStyle = shade(col, kind === 'frost' ? 0.55 : 0.14);
        g.beginPath(); g.ellipse(x + 16 + (h - 0.5) * 8, y + 8, lf && rt ? 18 : 13, 9, 0, Math.PI, TAU); g.fill();
      }
      g.globalAlpha = 1;
      return;
    }
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
      g.fillStyle = '#2d2a30';
      if (hang) g.fillRect(x + 15, y, 2, 10);
      else g.fillRect(x + 14, y + 16, 4, 16);
      g.fillStyle = '#3a3540'; g.beginPath(); g.roundRect(x + 9, y + 6, 14, 14, 4); g.fill();
      g.fillStyle = base; g.beginPath(); g.roundRect(x + 11.5, y + 8.5, 9, 9, 3); g.fill();
      g.fillStyle = '#fff3d8'; g.beginPath(); g.arc(x + 16, y + 13, 2.6, 0, TAU); g.fill();
      return;
    }
    if (t === T.HEARTH) {
      g.fillStyle = '#4a4048'; g.beginPath(); g.roundRect(x + 2, y + 20, 28, 12, [4, 4, 2, 2]); g.fill();
      g.fillStyle = '#5c5058'; g.fillRect(x + 4, y + 20, 24, 3);
      return;
    }
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
  drawSky(ctx, W, H, camX, camY, zoom, time, blend, depth, tierDark) {
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
    // parallax silhouettes
    const LA = this.layerSet(A), LB = k > 0 ? this.layerSet(B) : null;
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
    }
    // underground: the sky fades into cave dark
    if (depth > 0) {
      const cave = mix(A.deep, '#05050a', 0.6);
      ctx.fillStyle = rgba(cave, clamp(depth, 0, 1));
      ctx.fillRect(0, 0, W, H);
    }
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

// ---------------- procedural parallax layers per biome ----------------
function makeLayers(B) {
  const out = [];
  out.fills = [];
  const LW = 1800, LH = 640;
  const cols = [
    mix(B.sky[2], B.fog, 0.35),
    mix(B.fog, B.sky[1], 0.35),
    mix(mix(B.fog, B.deep, 0.4), B.sky[1], 0.15),
    mix(mix(B.deep, B.fog, 0.28), B.sky[1], 0.1),
  ];
  for (let i = 0; i < 4; i++) {
    const cv = document.createElement('canvas');
    cv.width = LW; cv.height = LH;
    const g = cv.getContext('2d');
    const col = cols[i];
    const seed = i * 101 + B.id.length * 13;
    const ridge = (amp, freq, base, oct = 4) => {
      g.beginPath(); g.moveTo(0, LH);
      for (let x = 0; x <= LW; x += 6) {
        // seamless: blend the noise with its wrapped copy
        const u = x / LW;
        const n = fbm1(x * freq, seed, oct) * (1 - u) + fbm1((x - LW) * freq, seed, oct) * u;
        g.lineTo(x, base - n * amp);
      }
      g.lineTo(LW, LH); g.closePath(); g.fill();
    };
    g.fillStyle = col;
    const base = LH * (0.55 + i * 0.08);
    if (i === 0) {
      ridge(200, 0.0028, base, 5);
    } else if (i === 1) {
      ridge(110, 0.005, base + 30, 4);
      feature(g, B, i, LW, base + 10, col, seed);
    } else {
      ridge(60 + i * 10, 0.008 + i * 0.002, base + 40, 3);
      feature(g, B, i, LW, base + 30, col, seed);
    }
    // atmospheric haze at the foot of each layer
    const hz = g.createLinearGradient(0, base - 80, 0, LH);
    hz.addColorStop(0, rgba(B.fog, 0)); hz.addColorStop(1, rgba(B.fog, i < 2 ? 0.55 : 0.32));
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = hz; g.fillRect(0, 0, LW, LH);
    g.globalCompositeOperation = 'source-over';
    out.push(cv);
    out.fills.push(mix(col, B.fog, i < 2 ? 0.55 : 0.32));
  }
  return out;
}
function feature(g, B, layer, LW, base, col, seed) {
  const count = layer === 1 ? 6 : 10;
  for (let k = 0; k < count; k++) {
    const x = (hash2(k, layer, seed) * LW) | 0;
    const s = (0.6 + hash2(k, 7, seed) * 0.8) * (layer === 1 ? 1.3 : 1);
    const drawAt = (xx) => {
      g.save(); g.translate(xx, base + 4); g.scale(s, s); g.fillStyle = col;
      switch (B.id) {
        case 'meadow': {
          if (k % 5 === 0) {
            // a ruined arch
            g.strokeStyle = g.fillStyle; g.lineWidth = 22; g.lineCap = 'butt';
            g.beginPath(); g.moveTo(-38, 0); g.lineTo(-38, -70); g.arc(0, -70, 38, Math.PI, TAU); g.lineTo(38, 0); g.stroke();
            g.fillRect(-52, -8, 30, 8); g.fillRect(28, -6, 22, 6);
          } else {
            g.fillRect(-3, -60, 6, 60);
            for (const [ex, ey, rx, ry] of [[0, -76, 30, 26], [-20, -60, 20, 15], [20, -62, 22, 16]]) { g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, 0, TAU); g.fill(); }
            if (k % 3 === 0) { g.fillRect(34, -40, 4, 40); g.beginPath(); g.ellipse(36, -50, 16, 14, 0, 0, TAU); g.fill(); }
          }
          break;
        }
        case 'glass': {
          g.fillRect(-5, -160, 10, 160);
          g.beginPath(); g.moveTo(0, -240); g.lineTo(26, -150); g.lineTo(0, -120); g.lineTo(-26, -150); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(-20, -110); g.lineTo(-44, -96); g.lineTo(-20, -90); g.fill();
          break;
        }
        case 'hollow': {
          g.fillRect(-6, -90, 12, 90);
          g.beginPath(); g.ellipse(0, -92, 46, 22, 0, Math.PI, TAU); g.fill();
          g.beginPath(); g.moveTo(-30 + k * 5, -620); g.lineTo(-10, -620); g.lineTo(-18 + k, -380 - k * 20); g.fill();
          break;
        }
        case 'ember': {
          g.beginPath(); g.moveTo(-40, 0); g.lineTo(-18, -120); g.lineTo(-6, -90); g.lineTo(8, -170); g.lineTo(30, 0); g.fill();
          g.fillRect(40, -60, 4, 60); g.fillRect(30, -48, 24, 3);
          break;
        }
        case 'frost': {
          g.beginPath(); g.moveTo(-30, 0); g.lineTo(0, -260); g.lineTo(30, 0); g.fill();
          g.beginPath(); g.moveTo(14, 0); g.lineTo(34, -140); g.lineTo(52, 0); g.fill();
          break;
        }
      }
      g.restore();
    };
    drawAt(x);
    if (x > LW - 300) drawAt(x - LW);
    if (x < 300) drawAt(x + LW);
  }
}
