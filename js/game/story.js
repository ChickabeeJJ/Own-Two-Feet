// Story director.
// LORE: Before the world there was a needle and a thread. The Seamstress stitched the land, and dolls to
// walk it. Then she vanished; her needles became the Wardens and shut every gate, and the dolls forgot
// how to stand. You are the last doll, born from the last falling thread of her light. Walk through
// every gate, take back her light, and finish the world yourself.
//
// First launch: no menu, no loading screen. A cold open: you fall through the sky steering toward
// motes of light while the lore is told in four lines, crash into the meadow, get up on your own two
// feet, and Thread (her last stitch) climbs out of your chest to guide you. Then a chain of clear goals.
import { Audio } from '../core/audio.js';
import { Input } from '../core/input.js';
import { P } from '../physics/body.js';
import { TILE, T, TILES, biomeOf, biomeIndexAt, gateNear } from '../world/tiles.js';
import { clamp, lerp, rand, TAU, rgba, sign } from '../core/util.js';
import { drawGlow } from '../world/light.js';
import { Save, COSMETICS } from './progress.js';
import { setTimeoutGame } from './bosses.js';
import { Platform } from '../platform.js';
import { Thread } from './thread.js';
import { drawBladeStone, drawSeed } from '../art/props.js';
import { softDisc } from '../art/paint.js';

const BLADE_X = 12;
const FALL_H = 5600;
const LORE = [
  'Before the world, there was a needle, and a thread.',
  'The Seamstress stitched the land, and dolls to walk it.',
  'Then she vanished. Her needles became Wardens, and shut every gate.',
  'One thread of her light was still falling.',
];

// the goal chain. each: id, text, hint(touch), target(game) -> {x,y} | null, done(game) -> bool, enter(story)
const GOALS = [
  { id: 'blade', text: 'Take the blade', hint: k => k ? 'walk to it' : '<kbd>A</kbd><kbd>D</kbd> walk · <kbd>Space</kbd> jump', target: s => ({ x: BLADE_X * TILE + 16, y: s.bladeY - 30 }), done: s => s.sv.hasBlade },
  { id: 'hollow', text: 'Defeat the Hollow', hint: k => k ? 'tap &#9876; to strike' : '<kbd>J</kbd> or <kbd>Click</kbd> strike', target: s => s.firstFoe && !s.firstFoe.removed ? { x: s.firstFoe.c.x, y: s.firstFoe.c.y - 50 } : null, done: s => s.firstFoeDown },
  { id: 'dig', text: 'Break 5 blocks', hint: k => k ? 'tap &#9638; then hold a block' : 'hold <kbd>Click</kbd> on the ground', target: () => null, done: s => s.sv.stats.blocks - (s.sv.digBase || 0) >= 5 },
  { id: 'shrine', text: 'Follow Thread to the fire', hint: () => 'someone keeps a shrine ahead', target: s => ({ x: 105 * TILE + 16, y: s.game.world.surface(105) * TILE - 40 }), done: s => Object.keys(s.sv.met).length > 0 },
  { id: 'rest', text: 'Rest at the shrine', hint: k => k ? 'tap E by the fire' : '<kbd>E</kbd> by the fire', target: s => ({ x: 105 * TILE + 16, y: s.game.world.surface(105) * TILE - 40 }), done: s => !!s.sv.respawn },
  { id: 'warden', text: 'Defeat the Hollow Warden', hint: () => 'the first gate · dash with <kbd>Shift</kbd>', target: s => ({ x: 170 * TILE, y: s.game.world.surface(170) * TILE - 60 }), done: s => Object.keys(s.sv.bosses).length > 0 },
  { id: 'home', text: 'Make a home: place a Hearth', hint: k => k ? 'craft it in the menu' : '<kbd>Q</kbd> craft · <kbd>Right-click</kbd> place', target: () => null, done: s => !!s.sv.home },
  { id: 'onward', text: 'Walk on. Every gate holds more of her light', hint: () => 'the world has no edge', target: s => { const g = gateNear(Math.floor(s.game.player.x / TILE) + 200); return { x: g.gx * TILE, y: s.game.world.surface(g.gx) * TILE - 60 }; }, done: () => false },
];

export class Story {
  constructor(game) {
    this.game = game;
    this.stage = 0;          // 0 fall, 1 impact, 2 wake, 3 rising, 5 play
    this.t = 0;
    this.hidden = false;
    this.lastBiome = null;
    this.bladeY = null;
    this.tut = game.save.tut;
    this.gateWarned = {};
    this.motes = []; this.puffs = []; this.streaks = [];
    this.loreI = -1;
    this.thread = new Thread(game);
    game.thread = this.thread;
    this.firstFoe = null; this.firstFoeDown = !!this.sv.tut.foe;
  }
  get sv() { return this.game.save; }
  get ui() { return this.game.ui; }

  card(title, sub, cls = '', dur = 3.2) { if (this.ui) this.ui.card(title, sub, cls, dur); }
  meet(name, title) { this.card(name, title, 'small', 2.6); Audio.play('chime', { vol: 0.6 }); }
  say(text, dur, prio) { this.thread.say(text, dur, prio); }

  // ------------------------------------------------------------ the fall
  startBirth() {
    const g = this.game, a = g.player.actor;
    const sx = 4 * TILE + 16, gy = g.world.surface(4) * TILE;
    this.stage = 0; this.t = 0;
    g.cinematic = true;
    a.c.x = sx - 140; a.c.y = gy - FALL_H; a.c.vx = 0; a.c.vy = 0;
    a.body.reset(a.c.x, a.c.y - a.pelvisH);
    a.mode = 'script'; a.scriptPose = { mode: 'skydive', strength: 0.55, vx: 0, vy: 0 };
    a.blade = false;
    this.thread.visible = false;
    g.cam.override = { x: a.c.x, y: a.c.y + 60, t: 0.08 };
    g.cam.x = a.c.x; g.cam.y = a.c.y + 60; g.cam.zoomT = g.cam.zoom = 1.15;
    this.ui.hud(false); this.ui.letterbox(true); this.ui.fade(1, 0);
    // motes of light along the way down
    this.motes = [];
    for (let i = 0; i < 18; i++) {
      const y = gy - FALL_H + 700 + i * ((FALL_H - 1300) / 18);
      const x = sx + Math.sin(i * 1.7) * 150 + rand(-50, 50);
      this.motes.push({ x, y, got: false, t: rand(0, 6) });
    }
    for (let i = 0; i < 9; i++) this.puffs.push(this.newPuff(true));
    for (let i = 0; i < 26; i++) this.streaks.push({ x: Math.random(), y: Math.random(), l: rand(0.05, 0.16), a: rand(0.04, 0.12) });
    this.gotMotes = 0;
    this.groundY = gy;
  }
  newPuff(anywhere) { return { x: Math.random(), y: anywhere ? Math.random() * 1.4 : 1.2 + Math.random() * 0.3, r: rand(0.12, 0.32), a: rand(0.12, 0.28), z: rand(0.8, 1.6) }; }
  updateFall(dt) {
    const g = this.game, a = g.player.actor, sp = a.scriptPose, ui = this.ui;
    const t = this.t += dt;
    if (t > 0.05 && this.loreI < 0) { this.loreI = 0; ui.lore(LORE[0]); Audio.play('beat'); }
    if (t > 0.25 && !this.faded) { this.faded = true; ui.fade(0, 1.2); }
    if (t > 1.2 && !this.prompted) { this.prompted = true; ui.press(g.touch ? 'drag to steer · catch the light' : '← → steer · catch the light'); }
    const remain = this.groundY - a.c.y;
    if (this.loreI === 0 && t > 3.1) { this.loreI = 1; ui.lore(LORE[1]); }
    if (this.loreI === 1 && t > 6.2) { this.loreI = 2; ui.lore(LORE[2]); }
    if (this.loreI === 2 && remain < 1500) { this.loreI = 3; ui.lore(LORE[3]); ui.press(null); }
    // steer
    const ax = Input.axis.x;
    sp.vx = lerp(sp.vx, ax * 340, 1 - Math.exp(-6 * dt));
    sp.vy = Math.min(1200, 240 + Math.max(0, t - 0.6) * 95);
    g.cam.override.x = a.c.x + sp.vx * 0.2; g.cam.override.y = a.c.y + 90;
    // motes
    const cx = a.c.x, cy = a.c.y - 40;
    for (const m of this.motes) {
      if (m.got) continue;
      m.t += dt;
      if (Math.hypot(m.x - cx, m.y - cy) < 52) {
        m.got = true; this.gotMotes++;
        this.sv.glimmer += 1;
        Audio.play('soul', { pitch: 1 + this.gotMotes * 0.06, gap: 0.01 });
        g.fx.burst(m.x, m.y, { n: 12, speed: 240, col: '#ffffff', col1: '#9ff3ff', add: true, life: 0.5, size: 2.4 });
        g.fx.ring(m.x, m.y, 4, 40, 0.3, '#bff6ff', 3);
        ui.glimmerBump();
      }
    }
    // the wind of falling
    const speed = sp.vy / 1200;
    for (const p of this.puffs) { p.y -= dt * speed * 1.3 * p.z; if (p.y < -0.4) Object.assign(p, this.newPuff(false)); }
    for (const s of this.streaks) { s.y -= dt * (1.5 + speed * 3); if (s.y < -0.2) { s.y = 1.1; s.x = Math.random(); } }
    if (sp.landed) this.impact();
  }
  impact() {
    const g = this.game, a = g.player.actor, ui = this.ui;
    this.stage = 1; this.t = 0;
    ui.press(null); ui.lore(null);
    Audio.play('boom'); Audio.play('crack');
    g.slowmo(0.16, 1.1); g.flash([1, 0.95, 0.85], 0.85); g.shake(1.1); g.pulse(2.4);
    const x = a.c.x, y = a.c.y;
    g.fx.ring(x, y - 8, 10, 260, 1.0, '#ffd9a0', 9);
    g.fx.ring(x, y - 8, 6, 140, 0.6, '#ffffff', 5);
    g.fx.dust(x, y - 4, 26, '#e8dccb', -Math.PI / 2, 380);
    g.fx.burst(x, y - 20, { n: 40, speed: 520, col: '#ffffff', col1: '#ffd9a0', add: true, life: 0.9, size: 3, grav: 700 });
    for (let i = 0; i < 4; i++) g.fx.debris(x + rand(-30, 30), y - 6, T.DIRT, 4);
    this.crater = { x, y, t: 0 };
    const vx = a.scriptPose.vx || 0;
    a.mode = 'ctrl'; a.scriptPose = null;
    a.knockdown(999, vx * 1.3 + 160, -420);
    g.cam.override = { x, y: y - 40, t: 0.5 };
    g.cam.zoomT = 1.55;
  }
  updateImpact(dt) {
    const g = this.game, a = g.player.actor, ui = this.ui;
    this.t += dt;
    g.cam.override.x = a.body.x[P.PELVIS]; g.cam.override.y = a.body.y[P.PELVIS] - 30;
    if (this.t > 1.6 && a.body.restSpeed() < 140 && !this.woke) {
      this.woke = true;
      // her last stitch climbs out of your chest
      const b = a.body;
      const th = this.thread;
      th.visible = true; th.placed = true;
      th.x = th.ix = b.x[P.CHEST]; th.y = th.iy = b.y[P.CHEST];
      th.override = { x: b.x[P.HEAD] + 30, y: b.y[P.HEAD] - 40 };
      g.fx.burst(th.x, th.y, { n: 16, speed: 200, col: '#ffffff', col1: '#9ff3ff', add: true, life: 0.6, size: 2.2 });
      Audio.play('chime', { vol: 0.7 });
      setTimeoutGame(g, 0.6, () => this.say('...hey.', 1.6));
      setTimeoutGame(g, 2.0, () => this.say('Up. You have to get up.', 2.6));
      setTimeoutGame(g, 2.6, () => { ui.press(g.touch ? 'tap to get up' : 'press any key to get up'); this.stage = 2; this.presses = 0; a.scriptFromLimp({ mode: 'getup', getup: 0, strength: 0.32 }); });
    }
  }
  updateWake(dt) {
    const g = this.game, a = g.player.actor, ui = this.ui;
    const sp = a.scriptPose;
    if (!sp) return;
    this.thread.override = { x: a.c.x + 36, y: a.c.y - 110 };
    g.cam.override.x = a.c.x; g.cam.override.y = a.c.y - 70;
    const pressed = Input.any || Input.mouse.lp || (g.touch && g.touch.tapped);
    if (g.touch) g.touch.tapped = false;
    if (pressed && this.stage === 2) {
      this.presses++;
      Audio.init();
      if (this.presses === 1) {
        sp.strength = 0.7; this.kneel = 0;
        a.takeImpulse(a.body.x[P.CHEST], a.body.y[P.CHEST], 0, -300, 0);
        Audio.play('land', { vol: 0.6 }); g.shake(0.1);
        ui.press(g.touch ? 'again' : 'again');
        this.say('That’s it. One more.', 2);
      } else {
        this.stage = 3; this.t = 0;
        ui.press(null);
        sp.strength = 0.95;
      }
    }
    if (this.presses >= 1 && this.stage === 2) sp.getup = Math.min(0.45, sp.getup + dt / 0.5);
    if (this.stage === 3) {
      this.t += dt;
      sp.getup = Math.min(1, sp.getup + dt / 1.1);
      if (this.t > 1.2 && !this.stood) {
        this.stood = true;
        a.mode = 'ctrl'; a.scriptPose = null;
        this.thread.override = null;
        this.say('You stood. Nobody stands anymore.', 3);
        // far away, a warden hears it
        setTimeoutGame(g, 1.4, () => { Audio.play('roar', { vol: 0.55, pitch: 0.65 }); g.shake(0.35); this.roared = g.time; });
        setTimeoutGame(g, 1.8, () => { this.card('Own Two Feet', 'the last doll walks', '', 4.4); Audio.play('chime'); g.cam.override = null; g.cam.zoomT = 0.85; });
        setTimeoutGame(g, 4.6, () => { ui.letterbox(false); ui.hud(true); g.cinematic = false; g.cam.zoomT = 1; this.say('She left a blade for you. Over there.', 3.2); });
        setTimeoutGame(g, 5.4, () => { this.stage = 5; this.sv.born = true; this.sv.obj = 0; g.saveNow(); Platform.gameplayStart(); });
      }
    }
  }
  skipBirth() {
    const g = this.game, a = g.player.actor;
    const sx = 4 * TILE + 16, gy = g.world.surface(4) * TILE;
    this.stage = 5; this.sv.born = true; this.hidden = false;
    if (this.sv.obj === undefined) this.sv.obj = 0;
    a.mode = 'ctrl'; a.scriptPose = null;
    a.c.x = sx; a.c.y = gy; a.c.vx = a.c.vy = 0; a.unstick(); a.body.reset(sx, a.c.y - a.pelvisH);
    g.cam.override = null; g.cam.zoomT = 1; g.cinematic = false;
    g.cam.x = sx; g.cam.y = gy - 120;
    this.thread.visible = true; this.thread.placed = false; this.thread.override = null;
    this.ui.press(null); this.ui.lore(null); this.ui.letterbox(false); this.ui.hud(true); this.ui.fade(0, 0.5);
    this.puffs = []; this.streaks = [];
    Platform.gameplayStart();
  }
  quickStart() {
    const g = this.game;
    this.stage = 5; this.hidden = false;
    if (this.sv.obj === undefined) this.sv.obj = this.sv.hasBlade ? 2 : 0;
    this.thread.visible = true;
    this.ui.fade(1, 0);
    setTimeout(() => this.ui.fade(0, 1.4), 30);
    this.ui.hud(true);
    const B = g.biomeAt(g.player.x);
    this.card(B.name, `welcome back, ${this.sv.name.split(' ')[0]}`, 'small', 2.8);
    this.lastBiome = biomeIndexAt(Math.floor(g.player.x / TILE));
    setTimeoutGame(g, 1.5, () => this.say(['You came back.', 'The thread still glows.', 'Let’s keep walking.'][Math.floor(Math.random() * 3)], 2.6));
    Platform.gameplayStart();
  }

  // ------------------------------------------------------------ per tick
  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    if (this.thread.visible) this.thread.update(dt);
    if (this.crater) this.crater.t += dt;
    if (this.stage === 0) { if (Input.pressed('menu')) { Input.consume('menu'); this.skipBirth(); return; } this.updateFall(dt); return; }
    if (this.stage === 1) { this.updateImpact(dt); return; }
    if (this.stage === 2 || this.stage === 3) { this.updateWake(dt); return; }
    if (this.bladeY === null) this.bladeY = g.world.surface(BLADE_X) * TILE;
    this.updateGoals(dt);
    // walking into the blade takes it
    if (!this.sv.hasBlade && Math.abs(p.x - (BLADE_X * TILE + 16)) < 34 && Math.abs(p.y - this.bladeY) < 70 && !g.cinematic) this.takeBlade();
    // biome discovery
    const bi = biomeIndexAt(Math.floor(p.x / TILE));
    if (bi !== this.lastBiome && !p.dead) {
      const first = this.lastBiome !== null;
      this.lastBiome = bi;
      const B = biomeOf(bi);
      const key = 'b' + bi;
      if (!this.sv.seen[key]) {
        this.sv.seen[key] = 1;
        if (first || bi !== 0) {
          this.card(B.name, B.sub, '', 3.6);
          Audio.play('gate', { vol: 0.6 });
          setTimeoutGame(g, 3.8, () => this.say(BIOME_LINES[B.id] || 'Somewhere new.', 3.2));
        }
        const got = Save.unlockSrc(B.id);
        if (got.length && this.ui && bi !== 0) setTimeout(() => this.ui.toast('Unlocked: ' + got.map(c => c.name).join(', ')), 2600);
      }
      if (!(g.bosses && g.bosses.active)) Audio.setScene(B.id, false);
    }
    // a gate ahead
    const gi = gateNear(Math.floor(p.x / TILE));
    if (!g.bosses.defeated(gi.k) && Math.abs(p.x / TILE - gi.gx) < 60 && !this.gateWarned[gi.k]) {
      this.gateWarned[gi.k] = 1;
      Audio.play('roar', { vol: 0.35, pitch: 0.7 }); g.shake(0.2);
      this.say('That gate... a Warden is behind it. It holds a piece of her.', 3.6);
    }
    if (p.lowHp && !this.lowSaid) { this.lowSaid = true; this.say(g.touch ? 'You’re hurt. Hold ❤ to mend.' : 'You’re hurt. Hold H to mend with breath.', 3.2); }
    if (!p.lowHp) this.lowSaid = false;
  }
  updateGoals(dt) {
    const g = this.game, sv = this.sv, ui = this.ui;
    let i = sv.obj ?? 0;
    // skip goals already satisfied (old saves, multiplayer, etc.)
    while (i < GOALS.length - 1 && GOALS[i].done(this)) {
      this.completed(GOALS[i]);
      i++;
      sv.obj = i;
      this.enterGoal(GOALS[i]);
    }
    const G = GOALS[i];
    const T_ = G.target(this);
    this.thread.target = T_;
    if (ui && !g.cinematic) {
      let dist = '';
      if (T_) { const d = Math.round(Math.abs(T_.x - g.player.x) / TILE); dist = d > 4 ? `${d} m ${T_.x > g.player.x ? '→' : '←'}` : ''; }
      ui.objective(G.text, G.hint(!!g.touch), dist);
    }
  }
  completed(G) {
    const g = this.game;
    if (this.stage < 5) return;
    Audio.play('confirm');
    this.ui && this.ui.toast('✓ ' + G.text);
  }
  enterGoal(G) {
    const g = this.game, sv = this.sv;
    if (G.id === 'hollow') this.spawnFirstFoe();
    if (G.id === 'dig') { sv.digBase = sv.stats.blocks; this.say('Everything here can be taken apart, and built again. Try the ground.', 3.6); }
    if (G.id === 'shrine') this.say('There’s a fire ahead. Someone’s keeping it. Follow me.', 3.4);
    if (G.id === 'rest') this.say('Rest by the fire. The shrine will remember you if you fall.', 3.4);
    if (G.id === 'warden') this.say('The first gate. Its Warden holds a piece of her light. We take it back.', 4);
    if (G.id === 'home') this.say('You could stay somewhere. Build a home. Others might come.', 3.6);
    if (G.id === 'onward') this.say('Every gate holds more of her. The world has no edge. Neither do we.', 4);
  }
  spawnFirstFoe() {
    const g = this.game, p = g.player;
    const x = p.x + 340 * (p.actor.facing || 1), tx = Math.floor(x / TILE);
    const y = g.world.surface(tx) * TILE;
    const e = g.enemies.spawn('husk', x, y + 40, 0, '#ffb36b');
    // it claws its way out of the ground
    e.knockdown(0.6, 0, -900);
    g.fx.dust(x, y - 4, 16, '#e8dccb', -Math.PI / 2, 220);
    g.fx.debris(x, y - 6, T.DIRT, 8);
    Audio.play('crack'); g.shake(0.25);
    e.ai.cd = 1.2;
    this.firstFoe = e;
    const prev = e.hurt;
    e.hurt = (dmg, info) => { prev(dmg, info); if (e.mode === 'dead' && !this.firstFoeDown) { this.firstFoeDown = true; this.sv.tut.foe = 1; this.say('It was a doll once, like you. It forgot how to stand.', 3.6); } };
    this.say('A Hollow! Strike it!', 2.2, true);
    if (g.enemies) g.enemies.calm = 30;
  }

  interactables() {
    if (this.sv.hasBlade || this.bladeY === null || this.stage < 5) return [];
    return [{ x: BLADE_X * TILE + 16, y: this.bladeY - 30, r: 90, label: 'Take the blade', act: () => this.takeBlade() }];
  }
  takeBlade() {
    const g = this.game, p = g.player;
    if (this.sv.hasBlade) return;
    this.sv.hasBlade = true; p.actor.blade = true;
    g.slowmo(0.3, 0.8); g.flash([1, 0.95, 0.85], 0.35); g.shake(0.25);
    Audio.play('clang', { pitch: 0.7 }); Audio.play('chime', { vol: 0.7 });
    g.fx.ring(BLADE_X * TILE + 16, this.bladeY - 20, 6, 140, 0.7, '#9ff3ff', 5);
    this.card('A Blade', 'it was waiting for you', 'small gain', 2.6);
    this.say('It fits your hand. Of course it does.', 2.6);
    g.saveNow();
  }
  onFirstEnemy() {}

  // ------------------------------------------------------------ draw
  draw(ctx, a, layer) {
    const g = this.game;
    if (layer === 'back') {
      if (this.bladeY !== null && this.stage >= 5) drawBladeStone(ctx, BLADE_X * TILE + 16, this.bladeY + 2, 1, g.time, !this.sv.hasBlade);
      if (this.crater) {
        const c = this.crater, k = clamp(1 - c.t / 40, 0, 1);
        if (k > 0) {
          ctx.save(); ctx.globalAlpha = 0.55 * k;
          ctx.strokeStyle = '#2a201c'; ctx.lineWidth = 2; ctx.lineCap = 'round';
          for (let i = 0; i < 9; i++) { const ang = Math.PI + (i / 8) * Math.PI; ctx.beginPath(); ctx.moveTo(c.x, c.y - 2); ctx.lineTo(c.x + Math.cos(ang) * 40, c.y - 2 + Math.sin(ang) * 6 * 0.3); ctx.stroke(); }
          ctx.globalCompositeOperation = 'lighter'; softDisc(ctx, c.x, c.y - 4, 60, '#ffb36b', 0.25 * k * k);
          ctx.restore();
        }
      }
    }
    if (layer === 'front') {
      if (this.stage === 0) {
        for (const m of this.motes) {
          if (m.got) continue;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          drawGlow(ctx, m.x, m.y, 30 + Math.sin(m.t * 4) * 4, [0.75, 0.97, 1], 0.7);
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, TAU); ctx.fill();
          ctx.restore();
        }
        // the falling doll glows like a seed of light
        const pa = g.player.actor;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, pa.c.x, pa.c.y - 40, 120, [1, 0.88, 0.7], 0.45);
        ctx.restore();
      }
      this.thread.draw(ctx, a, 'front');
    }
    if (layer === 'screen' && this.stage === 0) {
      const W = g.W, H = g.H;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of this.streaks) {
        ctx.strokeStyle = rgba('#ffffff', s.a); ctx.lineWidth = 1.2 * (W / 1000);
        ctx.beginPath(); ctx.moveTo(s.x * W, s.y * H); ctx.lineTo(s.x * W, (s.y + s.l) * H); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const p of this.puffs) softDisc(ctx, p.x * W, p.y * H, p.r * W * 0.6 * p.z, '#f4ece4', p.a);
      ctx.restore();
    }
  }
  lights(arr) {
    const g = this.game;
    if (this.stage === 0) arr.push({ x: g.player.actor.c.x, y: g.player.actor.c.y - 40, c: [1, 0.9, 0.75], s: 1 });
    if (this.bladeY !== null && !this.sv.hasBlade) arr.push({ x: BLADE_X * TILE + 16, y: this.bladeY - 40, c: [0.6, 0.95, 1], s: 0.7 });
    this.thread.lights(arr);
  }

  // ------------------------------------------------------------ bosses
  bossIntro(B) {
    const g = this.game, ui = this.ui;
    g.cinematic = true;
    ui.letterbox(true); ui.hint(null);
    const c = B.center();
    g.cam.override = { x: lerp(g.player.x, c.x, 0.65), y: c.y - 60, t: 1.1 };
    g.cam.zoomT = 0.95;
    Audio.play('gate');
    this.say('Here it comes.', 1.8, true);
    setTimeoutGame(g, 1.3, () => {
      B.wake();
      Audio.play('roar'); g.shake(0.8); g.flash([1, 0.85, 0.75], 0.2); g.pulse(2);
      this.card(B.name, B.title, 'boss', 2.8);
    });
    setTimeoutGame(g, 3.9, () => {
      g.cam.override = null; g.cam.zoomT = 0.82;
      ui.letterbox(false); g.cinematic = false;
      this.say('Watch it wind up, then dash through!', 2.8);
    });
  }
  bossVictory(B, relic, got) {
    const g = this.game, ui = this.ui;
    ui.letterbox(true);
    setTimeoutGame(g, 1.6, () => this.card(B.name, 'has fallen', 'boss', 2.2));
    setTimeoutGame(g, 4.2, () => { this.card(relic.name, relic.desc + (relic.key ? ` · ${relic.key}` : ''), 'gain', 3.8); Audio.play('chime'); });
    setTimeoutGame(g, 6.5, () => {
      ui.letterbox(false);
      this.say('She’s a little brighter now. Can you feel it?', 3.4);
      ui.toast('Your body remembers: a new mark');
      if (got && got.length) setTimeout(() => ui.toast('Unlocked: ' + got.map(c => c.name).join(', ')), 1200);
    });
  }

  // ------------------------------------------------------------ death
  respawn() {
    const g = this.game, p = g.player, ui = this.ui, sv = this.sv;
    ui.fade(1, 0.8);
    setTimeout(() => {
      const r = sv.respawn || sv.home || { x: 4 * TILE + 16, y: g.world.surface(4) * TILE };
      if (g.bosses) g.bosses.abort();
      for (const e of g.actors) if (e.team === 'enemy') e.removed = true;
      p.respawnAt(r.x, r.y);
      g.cam.x = r.x; g.cam.y = r.y - 80; g.cam.vx = g.cam.vy = 0;
      this.thread.placed = false;
      ui.fade(0, 1.4);
      ui.deathCard(false);
      this.say(['Get up. You always get up.', 'Again. Slower this time.', 'It’s alright. I’ve got you.'][Math.floor(Math.random() * 3)], 2.8);
      g.saveNow();
    }, 900);
  }
  // kept for older callers
  queueHint() {}
}

const BIOME_LINES = {
  meadow: 'The meadow. This is where the dolls stopped walking.',
  glass: 'The trees here kept some of her light. Listen to them ring.',
  hollow: 'No sky down here. Stay close to me.',
  ember: 'Everything here is still burning. Even the ground.',
  frost: 'So quiet. Even the wind forgot how to move.',
};
export { BLADE_X, COSMETICS, drawSeed, sign };
