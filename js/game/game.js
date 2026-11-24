// Game core: fixed-step simulation, camera, render pipeline, hit-stop / slow-mo, entity registry.
import { Input } from '../core/input.js';
import { Audio } from '../core/audio.js';
import { createPostFX } from '../core/postfx.js';
import { World, ARENA_HALF } from '../world/world.js';
import { TILE, T, TILES, biomeOf, biomeIndexAt, tierOf, BIOME_W, gateNear } from '../world/tiles.js';
import { WorldRenderer, biomeBlendAt } from '../world/render.js';
import { LightMap, drawGlow } from '../world/light.js';
import { FX } from './fx.js';
import { clamp, lerp, damp, smoothDamp, noise1, hexToRgb, mix, rand } from '../core/util.js';

export const SIM = 1 / 120;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.post = createPostFX(canvas);
    this.post.set({ thr: 0.9, bloom: 0.55 });
    this.time = 0; this.tick = 0; this.frame = 0;
    this.acc = 0; this.timeScale = 1; this.slowT = 0; this.slowTarget = 1; this.hitstopT = 0;
    this.cam = { x: 0, y: 0, vx: 0, vy: 0, zoom: 1, zoomT: 1, zoomV: 0, shake: 0, lookX: 0, focus: null, override: null };
    this.quality = 'high';
    this.settings = { shake: 1, flashes: true, quality: 'high', music: 0.55, sfx: 0.9 };
    this.actors = [];        // everything with a body (enemies, npcs, remote players)
    this.projectiles = [];
    this.pickups = [];
    this.systems = [];       // objects with update(dt) / draw(ctx, a, layer)
    this.paused = false;
    this.cinematic = false;  // input locked
    this.wind = 0;
    this.dynLights = [];
    this.lightTick = 0;
    this.state = 'boot';
    this.biomeNow = null;
    this.onTickHooks = [];
    this.view = { x0: 0, y0: 0, x1: 0, y1: 0, scale: 1, frame: 0 };
    addEventListener('resize', () => this.resize());
    this.resize();
  }
  setWorld(seed) {
    this.world = new World(seed);
    this.wr = new WorldRenderer(this.world);
    this.light = new LightMap(this.world);
    this.fx = new FX(this);
  }
  resize() {
    const dprCap = this.settings.quality === 'low' ? 1 : this.settings.quality === 'medium' ? 1.35 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const w = innerWidth, h = innerHeight;
    let pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    const maxW = this.settings.quality === 'high' ? 2560 : 1920;
    if (pw > maxW) { const k = maxW / pw; pw = Math.round(pw * k); ph = Math.round(ph * k); }
    this.canvas.width = pw; this.canvas.height = ph;
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    if (this.post.ok) { this.post.canvas.style.width = w + 'px'; this.post.canvas.style.height = h + 'px'; this.post.resize(pw, ph); }
    this.W = pw; this.H = ph; this.cssW = w; this.cssH = h;
    this.pxRatio = pw / w;
    // base zoom: a 720px tall view shows ~22 tiles; small screens see a bit more
    const base = h / 640;
    this.baseZoom = clamp(base * (h < 500 ? 1.02 : 1), 0.5, 2.2);
  }

  // ------------------------------------------------------------ feel helpers
  shake(a) { this.cam.shake = Math.min(1.2, this.cam.shake + a * this.settings.shake); }
  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }
  slowmo(scale, t) { this.slowTarget = scale; this.slowT = t; }
  flash(col = [1, 1, 1], a = 0.5) { if (!this.settings.flashes) a *= 0.25; this.post.P.flashCol = col; this.post.P.flash = Math.max(this.post.P.flash, a); }
  pulse(ab = 1) { this.post.P.ab = Math.max(this.post.P.ab, ab); }

  screenToWorld(sx, sy) {
    const s = this.view.scale / this.pxRatio;
    return { x: this.cam.rx + (sx - this.cssW / 2) / s, y: this.cam.ry + (sy - this.cssH / 2) / s };
  }

  // ------------------------------------------------------------ loop
  start() {
    let last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.1) dt = 0.1;
      this.frameDt = dt;
      this.autoQuality(dt);
      Input.poll();
      if (Input.pressed('mute')) { Input.consume('mute'); Audio.setMuted(!Audio.muted); if (this.ui) this.ui.toast(Audio.muted ? 'Sound off' : 'Sound on'); }
      if (this.ui) this.ui.input(dt);
      if (!this.paused) {
        // slow-mo eases in and out
        if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slowTarget = 1; }
        this.timeScale = damp(this.timeScale, this.slowTarget, 9, dt);
        if (this.hitstopT > 0) this.hitstopT -= dt;
        else this.acc += dt * this.timeScale;
        let n = 0;
        while (this.acc >= SIM && n < 12) { this.step(SIM); this.acc -= SIM; n++; Input.endTick(); }
        if (n === 12) this.acc = 0;
      } else {
        if (this.ui) this.ui.pausedTick(dt);
        Input.endTick();
      }
      this.updateCamera(dt);
      this.render(this.acc / SIM);
      if (this.ui) this.ui.frame(dt);
      Audio.update();
      this.frame++;
    };
    requestAnimationFrame(loop);
  }

  // keep it smooth on weak devices: step quality down if frames stay slow
  autoQuality(dt) {
    if (this.settings.qualityLocked || this.paused || !this.player) return;
    this.aqT = (this.aqT || 0) + dt;
    this.aqAvg = this.aqAvg === undefined ? dt : this.aqAvg * 0.97 + dt * 0.03;
    if (this.aqT < 10) return;
    // only for sustained, clearly slow frames (under ~28 fps for 10 s), and never below medium by itself
    if (this.aqAvg > 0.036) {
      const q = this.settings.quality;
      const next = q === 'high' ? 'medium' : null;
      if (!next) { this.settings.qualityLocked = true; return; }
      this.settings.quality = next;
      this.resize();
      this.aqT = 0; this.aqAvg = undefined;
    }
  }
  step(dt) {
    this.time += dt; this.tick++;
    this.wind = Math.sin(this.time * 0.23) * 0.6 + Math.sin(this.time * 0.71) * 0.3;
    for (const h of this.onTickHooks) h(dt);
    for (const s of this.systems) if (s.update) s.update(dt);
    if (this.world.tickTurf) this.world.tickTurf(dt);
    if (this.player) this.player.update(dt);
    for (const a of this.actors) a.update(dt);
    this.actors = this.actors.filter(a => !a.removed);
    if (!(this.ui && this.ui.modal) && !this.cinematic) for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.fx.update(dt);
    if (this.player) {
      const bl = biomeBlendAt(this.player.x);
      this.fx.ambient(dt, this.view, bl.k > 0.5 ? bl.B : bl.A, this.depthK || 0);
      if ((this.tick % 240) === 0) this.world.trim(this.player.x, this.player.y);
    }
  }

  updateCamera(dt) {
    const c = this.cam;
    let tx = c.x, ty = c.y;
    const P = this.player;
    if (c.override) { tx = c.override.x; ty = c.override.y; }
    else if (P) {
      const a = P.actor;
      // look ahead in the direction of travel, settle when idle
      const ahead = clamp(a.c.vx * 0.35, -140, 140) + a.facing * 40;
      c.lookX = damp(c.lookX, ahead, 2.2, dt);
      tx = a.c.x + c.lookX;
      ty = a.c.y - lerp(135, 60, this.depthK || 0) + clamp(a.c.vy * 0.12, -40, 120);
      if (c.focus) { tx = lerp(tx, c.focus.x, c.focus.k); ty = lerp(ty, c.focus.y, c.focus.k); }
    }
    const tm = c.override ? (c.override.t || 0.9) : 0.22;
    [c.x, c.vx] = smoothDamp(c.x, tx, c.vx, tm, dt);
    [c.y, c.vy] = smoothDamp(c.y, ty, c.vy, tm * 1.3, dt);
    [c.zoom, c.zoomV] = smoothDamp(c.zoom, c.zoomT, c.zoomV, 0.6, dt);
    c.shake = Math.max(0, c.shake - dt * 1.6);
    const tr = c.shake * c.shake;
    c.sx = noise1(this.time * 28, 1) * 26 * tr;
    c.sy = noise1(this.time * 28, 2) * 26 * tr;
    c.rot = noise1(this.time * 20, 3) * 0.02 * tr;
    c.rx = c.x + c.sx; c.ry = c.y + c.sy;
    // post fx decay
    const P2 = this.post.P;
    P2.flash = Math.max(0, P2.flash - dt * 3.5);
    P2.ab = damp(P2.ab, 0, 6, dt);
  }

  // ------------------------------------------------------------ render
  render(a) {
    const PR = window.__prof;
    let pt = PR ? performance.now() : 0;
    const mark = PR ? (k) => { const n = performance.now(); PR[k] = (PR[k] || 0) + n - pt; pt = n; } : () => {};
    const ctx = this.ctx, W = this.W, H = this.H, c = this.cam;
    if (!this.world) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
    const scale = this.baseZoom * c.zoom * this.pxRatio;
    const v = this.view;
    v.scale = scale; v.frame = this.frame;
    v.x0 = c.rx - W / 2 / scale; v.x1 = c.rx + W / 2 / scale;
    v.y0 = c.ry - H / 2 / scale; v.y1 = c.ry + H / 2 / scale;
    const bl = biomeBlendAt(c.x);
    const A = bl.A, B = bl.B, k = bl.k;
    const surf = this.world.surface(Math.floor(c.x / TILE)) * TILE;
    const depth = clamp((c.y - surf - 6 * TILE) / (16 * TILE), 0, 1);
    this.depthK = depth;
    const tierDark = clamp(tierOf(bl.bi) / 5, 0, 0.6);
    // 1. sky + parallax (screen space)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    this.wr.drawSky(ctx, W, H, c.rx, c.ry - surf, scale, this.time, bl, depth, tierDark, this.teaseInfo(c.rx, depth));
    const shafts = (A.id === 'hollow' ? 0.2 : 1) * (1 - depth) * (1 - tierDark);
    this.wr.drawShafts(ctx, W, H, this.time, shafts, k > 0.5 ? B.sunCol : A.sunCol);
    mark('sky');
    // 2. world space
    ctx.setTransform(scale, 0, 0, scale, W / 2 - c.rx * scale, H / 2 - c.ry * scale);
    if (c.rot) { ctx.translate(c.rx, c.ry); ctx.rotate(c.rot); ctx.translate(-c.rx, -c.ry); }
    const decorActors = [];
    if (this.player) decorActors.push(this.player.actor.c);
    for (const ac of this.actors) if (Math.abs(ac.c.x - c.x) < 1200) decorActors.push(ac.c);
    this.wr.drawTrees(ctx, v, this.time, decorActors, 0.6 + this.wind * 0.4);
    this.wr.drawTiles(ctx, v);
    mark('tiles');
    // systems behind actors (shrines, pickups, telegraphs)
    mark('decor');
    for (const s of this.systems) if (s.draw) s.draw(ctx, a, 'back');
    const glows = [];
    for (const ac of this.actors) {
      if (ac.c.x < v.x0 - 200 || ac.c.x > v.x1 + 200 || ac.c.y < v.y0 - 200 || ac.c.y > v.y1 + 300) continue;
      ac.draw(ctx, a);
      for (const g of ac.glows) glows.push(g);
    }
    if (this.player && !(this.story && this.story.hidden)) { this.player.draw(ctx, a); for (const g of this.player.actor.glows) glows.push(g); }
    for (const p of this.projectiles) p.draw(ctx, a);
    for (const s of this.systems) if (s.draw) s.draw(ctx, a, 'mid');
    this.fx.draw(ctx, false);
    mark('actors');
    // 3. lighting
    this.dynLights.length = 0;
    if (this.player) {
      const pa = this.player.actor;
      const lamp = this.player.sv.equip && this.player.sv.equip.lamp;
      this.dynLights.push({ x: pa.c.x, y: pa.c.y - 50, c: lamp ? [1.0, 0.88, 0.7] : [0.95, 0.9, 0.82], s: lamp ? 1.35 : 0.78 });
    }
    for (const s of this.systems) if (s.lights) s.lights(this.dynLights);
    for (const p of this.projectiles) if (p.light) this.dynLights.push(p.light);
    const sunK = 1 - tierDark * 0.55;
    const sun = (k > 0 ? [lerp(A.sun[0], B.sun[0], k), lerp(A.sun[1], B.sun[1], k), lerp(A.sun[2], B.sun[2], k)] : A.sun).map(x => x * sunK);
    const amb = k > 0 ? [lerp(A.amb[0], B.amb[0], k), lerp(A.amb[1], B.amb[1], k), lerp(A.amb[2], B.amb[2], k)] : A.amb;
    if ((this.frame & 1) === 0 || !this.light.R) this.light.compute(v, this.dynLights, sun, amb, 1);
    mark('lightc');
    this.light.draw(ctx);
    mark('lightd');
    // 4. additive glows (after light so they shine in the dark)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const em = this.light.emitters;
    for (let i = 0; i < em.length; i += 3) {
      const tx = em[i], ty = em[i + 1], t = em[i + 2];
      const L = TILES[t].light;
      const fl = t === T.LANTERN || t === T.HEARTH ? 0.85 + Math.sin(this.time * 9 + tx) * 0.08 + Math.sin(this.time * 23 + ty) * 0.05 : 0.7 + Math.sin(this.time * 2 + tx * 3) * 0.15;
      const r = t === T.LANTERN || t === T.HEARTH ? 70 : t === T.SHROOM ? 46 : t === T.CAP ? 26 : 34;
      drawGlow(ctx, tx * TILE + 16, ty * TILE + (t === T.LANTERN ? 13 : 16), r, L, (t === T.CAP ? 0.15 : 0.45) * fl);
    }
    for (const g of glows) drawGlow(ctx, g[0], g[1], g[2], hexToRgb(g[3]).map(x => x / 255), g[4]);
    ctx.restore();
    this.fx.draw(ctx, true);
    for (const s of this.systems) if (s.draw) s.draw(ctx, a, 'front');
    mark('glow');
    // 5. screen-space overlays drawn by systems (cursor, hints)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const s of this.systems) if (s.draw) s.draw(ctx, a, 'screen');
    // 6. grade
    const P = this.post.P;
    const grade = k > 0 ? A.grade.map((x, i) => lerp(x, B.grade[i], k)) : A.grade;
    P.tint = grade.map(x => x * (1 - tierDark * 0.12));
    const bk = this.bagK || 0;   // the satchel's cinematic grade: muted, vignetted world around the doll
    P.desat = damp(P.desat, this.player && this.player.lowHp ? 0.35 : bk > 0.05 ? 0.3 * bk : this.timeScale < 0.6 ? 0.25 : 0, 4, this.frameDt || 0.016);
    P.vig = 0.4 + depth * 0.15 + tierDark * 0.1 + bk * 0.45;
    this.post.render(this.time);
    mark('post');
    if (PR) PR.frames = (PR.frames || 0) + 1;
  }

  // the next undefeated warden, looming on the horizon as you get close
  teaseInfo(camX, depth) {
    if (!this.bosses || !this.save || (this.bosses.active)) return null;
    const ctx = Math.floor(camX / TILE);
    const gi = gateNear(ctx);
    if (this.bosses.defeated(gi.k)) return null;
    const d = Math.abs(gi.gx - ctx);
    if (d > 210 || d < 34) return null;
    const B = biomeOf(gi.guard);
    const arch = { meadow: 'warden', ember: 'warden', glass: 'wraith', frost: 'wraith', hollow: 'golem' }[B.id];
    const eye = { meadow: '#ffb36b', ember: '#ff7a3a', glass: '#8ff7ff', frost: '#dff6ff', hollow: '#c4b5ff' }[B.id];
    const k = Math.min(1, (210 - d) / 50) * Math.min(1, (d - 34) / 20) * (1 - depth);
    return { x: gi.gx * TILE, k, arch, eye, col: mix(B.fog, B.deep, 0.55) };
  }
  // helpers for systems
  biomeAt(x) { return biomeOf(biomeIndexAt(Math.floor(x / TILE))); }
  gateInfo(x) { const g = gateNear(Math.floor(x / TILE)); return Object.assign(g, { gxw: g.gx * TILE, half: ARENA_HALF * TILE }); }
}
export { TILE, T, BIOME_W, mix, rand };
