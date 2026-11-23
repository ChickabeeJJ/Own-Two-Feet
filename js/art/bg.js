// Backgrounds: painted parallax flats with atmospheric gradients and rim light, cloud banks, and one sky
// set piece per biome (floating isles, glowing crystal spires, a stone sky, a smoking volcano, an aurora).
import { canvas, rng, shade, mix, rgba, softDisc, TAU } from './paint.js';
import { fbm1, hash2 } from '../core/util.js';

const LW = 2000, LH = 700;

function ridgePath(g, seed, amp, freq, base, oct, sharp = 0) {
  const pts = [];
  for (let x = 0; x <= LW; x += 5) {
    const u = x / LW;
    let n = fbm1(x * freq, seed, oct) * (1 - u) + fbm1((x - LW) * freq, seed, oct) * u;
    if (sharp) n = n + Math.abs(fbm1(x * freq * 3, seed + 9, 2)) * sharp * (1 - Math.abs(u - 0.5) * 0) ;
    pts.push([x, base - n * amp]);
  }
  return pts;
}
function fillRidge(g, pts, top, bottom, rim, rimA) {
  g.beginPath(); g.moveTo(0, LH);
  for (const [x, y] of pts) g.lineTo(x, y);
  g.lineTo(LW, LH); g.closePath();
  let minY = LH; for (const p of pts) minY = Math.min(minY, p[1]);
  const gr = g.createLinearGradient(0, minY, 0, LH);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fill();
  if (rim) {
    g.strokeStyle = rgba(rim, rimA); g.lineWidth = 2.2;
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y + 1.2) : g.moveTo(x, y + 1.2)); g.stroke();
  }
}

export function makeLayers(B) {
  const out = []; out.fills = [];
  const cols = [
    mix(B.sky[2], B.fog, 0.4),
    mix(B.fog, B.sky[1], 0.4),
    mix(mix(B.fog, B.deep, 0.45), B.sky[1], 0.15),
    mix(mix(B.deep, B.fog, 0.22), B.sky[1], 0.08),
  ];
  for (let i = 0; i < 4; i++) {
    const cv = canvas(LW, LH);
    const g = cv.getContext('2d');
    const col = cols[i];
    const seed = i * 101 + B.id.length * 13;
    const base = LH * (0.5 + i * 0.09);
    const top = shade(col, 0.06), bottom = mix(col, B.fog, i < 2 ? 0.55 : 0.3);
    const rimA = [0.3, 0.24, 0.16, 0.1][i];
    if (i === 0) {
      const pts = ridgePath(g, seed, B.id === 'frost' ? 300 : 220, 0.0026, base, 5, B.id === 'frost' ? 0.6 : 0);
      fillRidge(g, pts, top, bottom, B.sunCol, rimA);
      if (B.id === 'frost' || B.id === 'meadow') snowCaps(g, pts, B.id === 'frost' ? base - 110 : base - 170);
    } else if (i === 1) {
      fillRidge(g, ridgePath(g, seed, 130, 0.0048, base + 20, 4), top, bottom, B.sunCol, rimA);
      features(g, B, i, base + 10, col, seed);
    } else {
      fillRidge(g, ridgePath(g, seed, 70 + i * 12, 0.008 + i * 0.002, base + 40, 3), top, bottom, B.sunCol, rimA);
      features(g, B, i, base + 30, col, seed);
    }
    // haze at the foot of every flat
    g.globalCompositeOperation = 'source-atop';
    const hz = g.createLinearGradient(0, base - 80, 0, LH);
    hz.addColorStop(0, rgba(B.fog, 0)); hz.addColorStop(1, rgba(B.fog, i < 2 ? 0.6 : 0.35));
    g.fillStyle = hz; g.fillRect(0, 0, LW, LH);
    g.globalCompositeOperation = 'source-over';
    out.push(cv);
    out.fills.push(mix(col, B.fog, i < 2 ? 0.6 : 0.35));
  }
  out.clouds = makeClouds(B);
  return out;
}
function snowCaps(g, pts, line) {
  g.save();
  g.beginPath(); g.moveTo(0, LH); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(LW, LH); g.closePath(); g.clip();
  g.fillStyle = 'rgba(244,248,252,0.75)';
  g.beginPath(); g.moveTo(0, line);
  for (let x = 0; x <= LW; x += 20) g.lineTo(x, line + Math.sin(x * 0.05) * 10 + Math.sin(x * 0.013) * 18);
  g.lineTo(LW, 0); g.lineTo(0, 0); g.closePath(); g.fill();
  g.restore();
}

function tree(g, x, y, s, col, kind) {
  if (kind === 'pine') {
    g.fillRect(x - 2 * s, y - 20 * s, 4 * s, 20 * s);
    for (let k = 0; k < 4; k++) { const w = (22 - k * 4) * s, yy = y - 14 * s - k * 14 * s; g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x, yy - 22 * s); g.lineTo(x + w, yy); g.closePath(); g.fill(); }
    return;
  }
  g.fillRect(x - 2.5 * s, y - 40 * s, 5 * s, 40 * s);
  for (const [dx, dy, r] of [[0, -58, 22], [-16, -44, 15], [16, -46, 16], [-6, -70, 14], [10, -64, 14]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); g.fill(); }
}
function features(g, B, layer, base, col, seed) {
  const R = rng(seed * 7 + 3);
  const count = (layer === 1 ? 7 : 13) * (B.id === 'glass' || B.id === 'frost' ? 0.5 : 1) | 0;
  const drawAt = (x, s, k) => {
    g.save(); g.fillStyle = col; g.strokeStyle = col;
    switch (B.id) {
      case 'meadow': {
        if (k % 6 === 0) {
          // ruined arch with a fallen keystone
          g.lineWidth = 20 * s; g.lineCap = 'butt';
          g.beginPath(); g.moveTo(x - 38 * s, base); g.lineTo(x - 38 * s, base - 70 * s); g.arc(x, base - 70 * s, 38 * s, Math.PI, TAU); g.lineTo(x + 38 * s, base); g.stroke();
          g.fillRect(x - 52 * s, base - 8 * s, 28 * s, 8 * s);
        } else if (k % 6 === 3) {
          // a tower with a lit window
          g.fillRect(x - 12 * s, base - 140 * s, 24 * s, 140 * s);
          g.beginPath(); g.moveTo(x - 17 * s, base - 140 * s); g.lineTo(x, base - 172 * s); g.lineTo(x + 17 * s, base - 140 * s); g.fill();
          g.fillStyle = rgba('#ffd28a', 0.8); g.fillRect(x - 3 * s, base - 110 * s, 6 * s, 9 * s);
        } else { for (let t = 0; t < 3; t++) tree(g, x + (t - 1) * 22 * s, base + 2, s * (0.8 + t * 0.15), col, 'round'); }
        break;
      }
      case 'glass': {
        g.fillRect(x - 5 * s, base - 160 * s, 10 * s, 160 * s);
        g.beginPath(); g.moveTo(x, base - 250 * s); g.lineTo(x + 28 * s, base - 160 * s); g.lineTo(x, base - 120 * s); g.lineTo(x - 28 * s, base - 160 * s); g.closePath(); g.fill();
        g.fillStyle = rgba('#bff6ff', layer === 1 ? 0.25 : 0.12);
        g.beginPath(); g.moveTo(x, base - 250 * s); g.lineTo(x + 6 * s, base - 160 * s); g.lineTo(x, base - 130 * s); g.closePath(); g.fill();
        g.fillStyle = col; g.beginPath(); g.moveTo(x - 20 * s, base - 110 * s); g.lineTo(x - 46 * s, base - 96 * s); g.lineTo(x - 20 * s, base - 90 * s); g.fill();
        break;
      }
      case 'hollow': {
        g.fillRect(x - 6 * s, base - 90 * s, 12 * s, 90 * s);
        g.beginPath(); g.ellipse(x, base - 92 * s, 48 * s, 24 * s, 0, Math.PI, TAU); g.fill();
        g.fillStyle = rgba('#c9bcff', 0.5);
        for (let d = -3; d <= 3; d++) { g.beginPath(); g.arc(x + d * 12 * s, base - 96 * s + Math.abs(d) * 3 * s, 2.2 * s, 0, TAU); g.fill(); }
        break;
      }
      case 'ember': {
        g.beginPath(); g.moveTo(x - 44 * s, base); g.lineTo(x - 20 * s, base - 130 * s); g.lineTo(x - 6 * s, base - 96 * s); g.lineTo(x + 8 * s, base - 180 * s); g.lineTo(x + 34 * s, base); g.fill();
        g.fillStyle = rgba('#ff8a3a', 0.25); g.fillRect(x - 40 * s, base - 6 * s, 74 * s, 6 * s);
        break;
      }
      case 'frost': {
        g.beginPath(); g.moveTo(x - 30 * s, base); g.lineTo(x, base - 260 * s); g.lineTo(x + 30 * s, base); g.fill();
        g.fillStyle = rgba('#ffffff', 0.35); g.beginPath(); g.moveTo(x, base - 260 * s); g.lineTo(x + 8 * s, base - 160 * s); g.lineTo(x, base - 150 * s); g.closePath(); g.fill();
        g.fillStyle = col;
        for (let t = 0; t < 4; t++) tree(g, x + 40 * s + t * 18 * s, base + 2, s * (0.7 + (t % 2) * 0.2), col, 'pine');
        break;
      }
    }
    g.restore();
  };
  for (let k = 0; k < count; k++) {
    const x = R() * LW, s = (0.6 + R() * 0.8) * (layer === 1 ? 1.3 : 1);
    drawAt(x, s, k);
    if (x > LW - 320) drawAt(x - LW, s, k);
    if (x < 320) drawAt(x + LW, s, k);
  }
}

// ---------------------------------------------------------------- clouds
function makeClouds(B) {
  const cv = canvas(LW, 360);
  const g = cv.getContext('2d');
  const R = rng(B.id.length * 31 + 7);
  const lit = mix(B.sky[2], '#ffffff', 0.35), dark = mix(B.sky[1], B.fog, 0.4);
  for (let c = 0; c < 9; c++) {
    const cx = R() * LW, cy = 80 + R() * 200, w = 120 + R() * 220;
    const draw = (ox) => {
      for (let i = 0; i < 9; i++) {
        const px = cx + ox + (R() - 0.5) * w, py = cy + (R() - 0.5) * 26 - Math.cos((px - cx - ox) / w * Math.PI) * 18, r = 24 + R() * 40;
        const gr = g.createLinearGradient(0, py - r * 0.7, 0, py + r * 0.7);
        gr.addColorStop(0, rgba(lit, 0.3)); gr.addColorStop(0.55, rgba(mix(lit, dark, 0.5), 0.22)); gr.addColorStop(1, rgba(dark, 0.0));
        g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, r * 1.9, r * 0.62, 0, 0, TAU); g.fill();
      }
    };
    draw(0); if (cx > LW - 300) draw(-LW); if (cx < 300) draw(LW);
  }
  return cv;
}
export function drawClouds(ctx, L, W, H, camX, camY, zoom, time, alpha, band = 0) {
  const cv = L.clouds; if (!cv) return;
  const f = band ? 0.09 : 0.03;
  const sc = zoom * (band ? 1.1 : 0.8);
  const w = cv.width * sc, h = cv.height * sc;
  let ox = -(((camX * f + time * (band ? 9 : 4)) * zoom) % w);
  if (ox > 0) ox -= w;
  const y = H * (band ? 0.22 : 0.06) - camY * f * zoom * 0.4;
  ctx.globalAlpha = alpha * (band ? 0.35 : 0.75);
  for (let x = ox; x < W; x += w) ctx.drawImage(cv, x, y, w + 1, h);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- sky set pieces
export function drawSkyFeature(ctx, B, W, H, camX, camY, zoom, time, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const par = (f) => -camX * f * zoom;
  switch (B.id) {
    case 'meadow': {
      // distant floating isles with threads of water
      for (let i = 0; i < 3; i++) {
        const x = ((par(0.02) + i * W * 0.45 + W * 0.15) % (W * 1.35) + W * 1.35) % (W * 1.35) - W * 0.15;
        const y = H * (0.18 + i * 0.07) + Math.sin(time * 0.3 + i) * 6 - camY * 0.01 * zoom;
        const s = H / 900 * (1.2 - i * 0.25);
        const col = mix(B.sky[1], B.fog, 0.45);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(x - 80 * s, y); ctx.quadraticCurveTo(x, y - 18 * s, x + 80 * s, y); ctx.quadraticCurveTo(x + 30 * s, y + 30 * s, x + 4 * s, y + 70 * s); ctx.quadraticCurveTo(x - 30 * s, y + 30 * s, x - 80 * s, y); ctx.fill();
        ctx.fillStyle = mix(col, '#9cbd8c', 0.35);
        for (const [dx, r] of [[-40, 16], [-18, 22], [10, 18], [36, 14]]) { ctx.beginPath(); ctx.arc(x + dx * s, y - 12 * s, r * s, 0, TAU); ctx.fill(); }
        const fall = ctx.createLinearGradient(0, y, 0, y + 220 * s);
        fall.addColorStop(0, rgba('#e8f4ff', 0.5)); fall.addColorStop(1, rgba('#e8f4ff', 0));
        ctx.fillStyle = fall; ctx.fillRect(x + 22 * s, y + 6 * s, 3 * s, 220 * s);
      }
      break;
    }
    case 'glass': {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = ((par(0.03) + i * W * 0.33) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
        const base = H * 0.62, h = H * (0.5 + (i % 2) * 0.15);
        const gr = ctx.createLinearGradient(0, base - h, 0, base);
        gr.addColorStop(0, rgba('#bff6ff', 0.32)); gr.addColorStop(1, rgba('#5fb8c8', 0));
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(x, base - h); ctx.lineTo(x + 20, base); ctx.lineTo(x - 20, base); ctx.closePath(); ctx.fill();
        softDisc(ctx, x, base - h, 40, '#bff6ff', 0.25 + Math.sin(time + i) * 0.08);
      }
      break;
    }
    case 'hollow': {
      // a sky made of stone: stalactites hang over everything
      const col = mix(B.deep, B.sky[0], 0.3);
      ctx.fillStyle = col;
      const off = par(0.06);
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let x = -40; x <= W + 40; x += 24) {
        const wx = x - off;
        const k = Math.floor(wx / 24);
        const h = 30 + hash2(k, 3, 7) * 90 + (hash2(k, 5, 7) < 0.15 ? 120 : 0);
        ctx.lineTo(x, 26 + Math.sin(wx * 0.01) * 10); ctx.lineTo(x + 12, h * H / 900); ctx.lineTo(x + 24, 26);
      }
      ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) { const x = ((hash2(i, 1, 3) * W * 1.4 - off * 1.2) % W + W) % W, y = 40 + hash2(i, 2, 3) * H * 0.12; softDisc(ctx, x, y, 10, '#c9bcff', 0.35 + Math.sin(time * 1.4 + i) * 0.15); }
      break;
    }
    case 'ember': {
      const x = ((par(0.02) + W * 0.7) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3;
      const base = H * 0.66, s = H / 900;
      ctx.fillStyle = mix(B.sky[1], B.fog, 0.35);
      ctx.beginPath(); ctx.moveTo(x - 360 * s, base); ctx.lineTo(x - 50 * s, base - 300 * s); ctx.lineTo(x + 50 * s, base - 300 * s); ctx.lineTo(x + 360 * s, base); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      softDisc(ctx, x, base - 300 * s, 140 * s, '#ff7a3a', 0.45 + Math.sin(time * 1.7) * 0.08);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 9; i++) {
        const u = ((time * 0.05 + i / 9) % 1);
        softDisc(ctx, x + Math.sin(u * 5 + i) * 40 * s + u * 120 * s, base - 300 * s - u * 380 * s, (40 + u * 120) * s, mix('#3a2422', B.sky[1], u), 0.35 * (1 - u));
      }
      break;
    }
    case 'frost': {
      // aurora
      ctx.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 3; band++) {
        const col = ['#8affc8', '#8ff7ff', '#c4a8ff'][band];
        ctx.beginPath();
        for (let x = 0; x <= W; x += 16) {
          const y = H * (0.12 + band * 0.05) + Math.sin(x * 0.004 + time * 0.25 + band) * 40 + Math.sin(x * 0.011 - time * 0.4) * 16 - camX * 0.0004 * zoom;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        for (let x = W; x >= 0; x -= 16) {
          const y = H * (0.12 + band * 0.05) + Math.sin(x * 0.004 + time * 0.25 + band) * 40 + Math.sin(x * 0.011 - time * 0.4) * 16 + 120 + Math.sin(x * 0.02 + time) * 20;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        const gr = ctx.createLinearGradient(0, H * 0.08, 0, H * 0.4);
        gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.35, rgba(col, 0.16)); gr.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = gr; ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}
