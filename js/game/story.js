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
import { PrologueArt } from '../art/prologue.js';
import { Thread } from './thread.js';
import { drawBladeStone, drawSeed } from '../art/props.js';
import { softDisc } from '../art/paint.js';
import { gateReq } from './content.js';
import { Actor } from './actor.js';
import { drawSprite } from '../art/images.js';

const BLADE_X = 12;
const FALL_H = 5600;
const PROLOGUE = [
  'Before the world had edges, there was a needle, and a thread.',
  'A Seamstress stitched the land awake, and dolls to walk it. Then she was gone.',
  'Her needles became five Wardens. They shut every gate and kept her light.',
];
const WARDENS = [['The Hollow Warden', '#ffb36b', 'horns'], ['The Glass Widow', '#8ff7ff', 'halo'], ['The Unmade Heart', '#c4b5ff', 'flower'], ['The Pyre Knight', '#ff7a3a', 'crown'], ['The Still Queen', '#dff6ff', 'spires']];
const LORE = [
  'One thread of her light was still falling.',
  'It found a doll who had never stood.',
  'Catch what light you can. You will need all of it.',
  'Brace.',
];

// tutorial: one verb at a time, each confirmed before the next
const TUT = [
  { id: 'move', title: 'Walk', keys: ['A', 'D'], touch: 'drag on the left side of the screen', text: 'Walk toward the light', done: s => Math.abs(s.game.player.x - s.tutX0) > 4 * TILE },
  { id: 'jump', title: 'Jump', keys: ['Space'], touch: 'tap Jump', text: 'Jump. Tap again in the air to jump higher', done: s => s.jumped },
  { id: 'blade', title: 'Take the blade', keys: [], touch: 'walk into it', text: 'Walk into the blade in the stone', done: s => s.sv.hasBlade },
  { id: 'strike', title: 'Strike', keys: ['J', 'Click'], touch: 'tap Strike', text: 'Hit the training doll three times', done: s => s.dummyHits >= 3 },
  { id: 'dash', title: 'Dash', keys: ['Shift'], touch: 'tap Dash', text: 'Dash. You can dash in the air too', done: s => s.dashed },
  { id: 'mine', title: 'Break blocks', keys: ['Hold Click'], touch: 'tap Build, then hold a block', text: 'Break three blocks of ground', done: s => s.sv.stats.blocks - s.tutB0 >= 3 },
  { id: 'place', title: 'Build', keys: ['Right-click'], touch: 'in build mode, tap empty space', text: 'Put a block back into the world', done: s => s.sv.stats.placed - s.tutP0 >= 1 },
  { id: 'craft', title: 'Craft', keys: ['I', 'Q'], touch: 'tap Bag, then pick Planks', text: 'Open your satchel and turn timber into planks', done: s => !!s.tut.crafted },
];

// the goal chain. each: id, text, hint(touch), target(game) -> {x,y} | null, done(game) -> bool
const nextGate = (s) => { const p = s.game.player.x / TILE; let gi = gateNear(Math.floor(p)); for (let i = 0; i < 4 && s.game.bosses.defeated(gi.k); i++) gi = gateNear(gi.gx + 440 * (gi.gx >= 0 ? 1 : -1)); return gi; };
const GOALS = [
  { id: 'hollow', text: 'Defeat the Hollow', hint: k => k ? 'tap Strike' : '<kbd>J</kbd> or <kbd>Click</kbd> strike', target: s => s.firstFoe && !s.firstFoe.removed ? { x: s.firstFoe.c.x, y: s.firstFoe.c.y - 50 } : null, done: s => s.firstFoeDown },
  { id: 'shrine', text: 'Follow Thread to the fire', hint: () => 'someone keeps a shrine ahead', target: s => ({ x: 105 * TILE + 16, y: s.game.world.surface(105) * TILE - 40 }), done: s => Object.keys(s.sv.met).length > 0 },
  { id: 'rest', text: 'Rest at the shrine', hint: k => k ? 'tap the action button by the fire' : '<kbd>E</kbd> by the fire', target: s => ({ x: 105 * TILE + 16, y: s.game.world.surface(105) * TILE - 40 }), done: s => !!s.sv.respawn },
  { id: 'lights', text: s => `Gather Threads of Light ${Math.min(s.sv.lights || 0, gateReq(nextGate(s).tier))}/${gateReq(nextGate(s).tier)}`, hint: () => 'wake lost dolls · find stitches · break nests · help keepers', target: s => s.game.content && s.game.content.nearestActivity(s.game.player.x), done: s => (s.sv.lights || 0) >= gateReq(nextGate(s).tier) },
  { id: 'warden', text: 'The gate is open: face its Warden', hint: () => 'watch the wind-up, then dash through', target: s => { const g = nextGate(s); return { x: g.gx * TILE, y: s.game.world.surface(g.gx) * TILE - 60 }; }, done: s => Object.keys(s.sv.bosses).length > 0 },
  { id: 'home', text: 'Make a home: place a Hearth', hint: k => k ? 'craft it in the menu' : '<kbd>Q</kbd> craft · <kbd>Right-click</kbd> place', target: () => null, done: s => !!s.sv.home },
  { id: 'onward', text: s => `Carry more light to the next gate ${Math.min(s.sv.lights || 0, gateReq(nextGate(s).tier))}/${gateReq(nextGate(s).tier)}`, hint: () => 'every gate holds more of her light', target: s => (s.sv.lights || 0) >= gateReq(nextGate(s).tier) ? { x: nextGate(s).gx * TILE, y: s.game.world.surface(nextGate(s).gx) * TILE - 60 } : s.game.content && s.game.content.nearestActivity(s.game.player.x), done: () => false },
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
    this.tutI = 0; this.dummy = null; this.dummyHits = 0; this.jumped = false; this.dashed = false;
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
    // the prologue plays first: the seed of light falling, then the wardens; the doll is inside the seed
    this.stage = -1; this.pt = 0; this.hidden = true; this.shot = 0;
    a.scriptPose.vy = 150;
    g.cam.zoomT = g.cam.zoom = 1.35;
  }
  // ---------------- prologue (non-interactive, any key fast-forwards to the fall)
  updatePrologue(dt) {
    const g = this.game, a = g.player.actor, ui = this.ui, sp = a.scriptPose;
    const t = this.pt += dt;
    if (!this.pBeat) { this.pBeat = 1; ui.lore(PROLOGUE[0]); }
    for (const bt of [0.25, 1.05, 1.85]) if (t >= bt && (this.beats || 0) < [0.25, 1.05, 1.85].indexOf(bt) + 1) { this.beats = (this.beats || 0) + 1; Audio.play('beat'); }
    // the painted plates are made a slice at a time; a shot starts only once its plates are ready
    const P = this.pArt || (this.pArt = new PrologueArt());
    P.step(this.shot === 0 ? 14 : 8);
    if (this.shot === 0 && t > 2.6 && ['sky', 'far', 'cath', 'near'].every(n => P.ready(n))) { this.shot = 1; this.s1 = t; ui.fade(0, 0.8); ui.lore(PROLOGUE[1]); }
    if (this.shot === 1 && t - this.s1 > 4.2 && P.ready('w0')) { this.shot = 2; this.wi = 0; this.wt = t; ui.lore(PROLOGUE[2]); Audio.play('roar', { vol: 0.25, pitch: 0.5 }); }
    if (this.shot === 2 && t - this.wt > 1.35) {
      if (this.wi >= 4) this.endPrologue();
      else if (P.ready('w' + (this.wi + 1))) { this.wi++; this.wt = t; Audio.play('slam', { vol: 0.25, pitch: 0.5 + this.wi * 0.1 }); }
    }
    // the seed drifts down; the camera rides above it
    sp.vy = 150 + t * 18;
    g.cam.override.x = a.c.x; g.cam.override.y = a.c.y + 40;
    const speed = 0.35;
    for (const p of this.puffs) { p.y -= dt * speed * 1.3 * p.z; if (p.y < -0.4) Object.assign(p, this.newPuff(false)); }
    if (t > 1.2 && (Input.any || Input.mouse.lp || (g.touch && g.touch.tapped))) { if (g.touch) g.touch.tapped = false; this.endPrologue(); }
  }
  endPrologue() {
    const g = this.game, a = g.player.actor, ui = this.ui;
    if (this.stage !== -1) return;
    this.stage = 0; this.t = 0; this.hidden = false; this.shot = 3;
    ui.fade(0, 0.4); ui.lore(null);
    a.scriptPose.vy = 240;
    g.cam.zoomT = 1.15;
    // the seed bursts and the doll tumbles out of it
    g.flash([1, 0.95, 0.85], 0.6); g.shake(0.3);
    g.fx.ring(a.c.x, a.c.y - 40, 8, 160, 0.6, '#ffe3a0', 6);
    g.fx.burst(a.c.x, a.c.y - 40, { n: 40, speed: 420, col: '#ffffff', col1: '#ffd9a0', add: true, life: 0.8, size: 2.8 });
    Audio.play('crack'); Audio.play('chime', { vol: 0.6 });
  }
  newPuff(anywhere) { return { x: Math.random(), y: anywhere ? Math.random() * 1.4 : 1.2 + Math.random() * 0.3, r: rand(0.12, 0.32), a: rand(0.12, 0.28), z: rand(0.8, 1.6) }; }
  updateFall(dt) {
    const g = this.game, a = g.player.actor, sp = a.scriptPose, ui = this.ui;
    const t = this.t += dt;
    if (t > 0.05 && this.loreI < 0) { this.loreI = 0; ui.lore(LORE[0]); Audio.play('beat'); }
    if (t > 0.25 && !this.faded) { this.faded = true; ui.fade(0, 1.2); }
    if (t > 1.2 && !this.prompted) { this.prompted = true; ui.press(g.touch ? 'drag to steer · catch the light' : 'A and D steer · catch the light'); }
    const remain = this.groundY - a.c.y;
    if (this.loreI === 0 && t > 3.1) { this.loreI = 1; ui.lore(LORE[1]); }
    if (this.loreI === 1 && t > 6.2) { this.loreI = 2; ui.lore(LORE[2]); }
    if (this.loreI === 2 && remain < 1500) { this.loreI = 3; ui.lore(LORE[3]); ui.press(null); }
    // steer
    const ax = Input.axis.x;
    sp.vx = lerp(sp.vx, ax * 340, 1 - Math.exp(-6 * dt));
    // the wind holds you over the meadow: steering fades out about 12 tiles from the landing spot
    const off = a.c.x - (4 * TILE + 16), lim = 12 * TILE;
    if (Math.abs(off) > lim && Math.sign(sp.vx) === Math.sign(off)) sp.vx *= Math.max(0, 1 - (Math.abs(off) - lim) / (3 * TILE));
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
      // each beat interrupts the one before, and only while the doll is still down: tapping early never
      // leaves Thread talking about a moment that has already passed
      setTimeoutGame(g, 0.6, () => { if (!this.presses) this.say('...hey.', 1.4, true); });
      setTimeoutGame(g, 1.6, () => { if (!this.presses) this.say('Up. You have to get up.', 2.4, true); });
      setTimeoutGame(g, 1.6, () => { ui.press(g.touch ? 'tap to get up' : 'press any key to get up'); this.stage = 2; this.presses = 0; a.scriptFromLimp({ mode: 'getup', getup: 0, strength: 0.32 }); });
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
        this.say('That’s it. One more.', 1.6, true);
      } else {
        this.stage = 3; this.t = 0;
        ui.press(null);
        sp.strength = 0.95;
        this.thread.hush();   // standing now: drop anything still queued about getting up
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
        this.say('You stood. Nobody stands anymore.', 3, true);
        // far away, a warden hears it
        setTimeoutGame(g, 1.4, () => { Audio.play('roar', { vol: 0.55, pitch: 0.65 }); g.shake(0.35); this.roared = g.time; });
        setTimeoutGame(g, 1.8, () => { this.card('On Two Feet', 'the last doll walks', '', 4.4); Audio.play('chime'); g.cam.override = null; g.cam.zoomT = 0.85; });
        setTimeoutGame(g, 4.6, () => { ui.letterbox(false); ui.hud(true); g.cinematic = false; g.cam.zoomT = 1; this.say('Let me show you how to walk this world.', 3.2); });
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
    if (this.sv.tutDone === undefined && this.sv.hasBlade) this.sv.tutDone = 1;
    if (this.sv.obj === undefined || this.sv.obj > 6) this.sv.obj = 0;
    this.thread.visible = true;
    this.ui.fade(1, 0);
    setTimeout(() => this.ui.fade(0, 1.4), 30);
    this.ui.hud(true);
    const B = g.biomeAt(g.player.x);
    this.card(B.name, `welcome back, ${(this.game.ui && this.game.ui.displayName().split(',')[0]) || 'Wren'}`, 'small', 2.8);
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
    if (this.stage === -1) { if (Input.pressed('menu')) { Input.consume('menu'); this.skipBirth(); return; } this.updatePrologue(dt); return; }
    if (this.stage === 0) { if (Input.pressed('menu')) { Input.consume('menu'); this.skipBirth(); return; } this.updateFall(dt); return; }
    if (this.stage === 1) { this.updateImpact(dt); return; }
    if (this.stage === 2 || this.stage === 3) { this.updateWake(dt); return; }
    if (this.bladeY === null) this.bladeY = g.world.surface(BLADE_X) * TILE;
    if (!this.sv.tutDone) this.updateTutorial(dt); else this.updateGoals(dt);
    if (this.dummy && !this.dummy.removed) { const d = this.dummy; d.c.x = this.dummyX; d.c.vx = 0; d.intent.mx = 0; }
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
    if (p.lowHp && !this.lowSaid) { this.lowSaid = true; this.say(g.touch ? 'You’re hurt. Hold Mend to heal.' : 'You’re hurt. Hold H to mend with breath.', 3.2); }
    if (!p.lowHp) this.lowSaid = false;
  }
  // ------------------------------------------------------------ tutorial
  tutStep() { return !this.sv.tutDone && TUT[this.tutI] ? TUT[this.tutI].id : null; }
  updateTutorial(dt) {
    const g = this.game, ui = this.ui, a = g.player.actor;
    if (this.tutX0 === undefined) { this.tutX0 = g.player.x; this.tutB0 = this.sv.stats.blocks; this.tutP0 = this.sv.stats.placed; }
    if (!a.c.ground && a.c.vy < -150) this.jumped = true;
    if (a.c.dashT > 0) this.dashed = true;
    const st = TUT[this.tutI];
    if (!st) { this.finishTutorial(); return; }
    if (st.id === 'strike' && !this.dummy) this.spawnDummy();
    if (st.id === 'craft' && !this.timberGiven) { this.timberGiven = true; if ((this.sv.inv[T.LOG] || 0) < 1) { g.player.give(T.LOG, 2); ui && ui.pickup(T.LOG, 2); this.say('Here. Two lengths of timber. Make something.', 2.6, true); } }
    this.thread.target = st.id === 'blade' ? { x: BLADE_X * TILE + 16, y: this.bladeY - 40 } : st.id === 'strike' && this.dummy ? { x: this.dummyX, y: this.dummy.c.y - 60 } : null;
    if (ui && !g.cinematic) ui.tutorial(st, this.tutI, TUT.length, !!g.touch, this.tutDoneT > 0);
    if (this.tutDoneT > 0) { this.tutDoneT -= dt; if (this.tutDoneT <= 0) { this.tutI++; if (TUT[this.tutI] && TUT[this.tutI].id === 'mine') this.tutB0 = this.sv.stats.blocks; if (TUT[this.tutI] && TUT[this.tutI].id === 'place') this.tutP0 = this.sv.stats.placed; } return; }
    if (st.done(this)) {
      this.tutDoneT = 0.9;
      Audio.play('confirm');
      const say = { move: 'Good. Feet first, always.', jump: 'Higher than the grass. A start.', blade: 'It fits your hand. Of course it does.', strike: 'Again, and harder when it counts.', dash: 'Fast. You can slip through attacks like that.', mine: 'Everything here can be taken apart...', place: '...and put back the way you like it.', craft: 'Ladders, doors, a workbench... you will want a home.' }[st.id];
      if (say) this.say(say, 2.4, true);
    }
  }
  // our own light on the blade: a soft shaft falling from above, motes drifting down it, a glow at the hilt
  drawBladeLight(ctx, x, y, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const H = 300, top = y - H, br = 0.85 + Math.sin(t * 1.3) * 0.15;
    for (const [w0, w1, al] of [[26, 70, 0.10], [12, 34, 0.12]]) {
      const gr = ctx.createLinearGradient(0, top, 0, y);
      gr.addColorStop(0, rgba('#fff4dc', 0)); gr.addColorStop(0.55, rgba('#fff1d0', al * br)); gr.addColorStop(1, rgba('#ffe2b0', al * 1.6 * br));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(x - w0 / 2 + 10, top); ctx.lineTo(x + w0 / 2 + 10, top); ctx.lineTo(x + w1 / 2, y - 6); ctx.lineTo(x - w1 / 2, y - 6); ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < 7; i++) {
      const u = ((t * 0.12 + i / 7) % 1), mx = x + 10 * (1 - u) + Math.sin(t * 1.7 + i * 2.1) * 9 * u, my = top + 40 + u * (H - 50);
      ctx.fillStyle = rgba('#fff6e0', 0.55 * Math.sin(u * Math.PI)); ctx.beginPath(); ctx.arc(mx, my, 1.6, 0, TAU); ctx.fill();
    }
    drawGlow(ctx, x + 4, y - 46, 46 * br, [1, 0.86, 0.6], 0.35);
    drawGlow(ctx, x, y - 8, 70, [1, 0.8, 0.55], 0.18);
    ctx.restore();
  }
  spawnDummy() {
    const g = this.game;
    const x = (BLADE_X + 7) * TILE + 16, tx = BLADE_X + 7;
    const y = g.world.surface(tx) * TILE;
    const look = { body: '#c9b48a', limb: '#b8a07a', coat: '#b8a07a', mat: 'cloth', eyes: '#3a2c22', eyeStyle: 'x', head: 'none', cape: null, blade: null, marks: [], rim: '#ffe2bd', bootCol: '#6b4a32', beltCol: '#7a5a3c' };
    const d = new Actor(g, { x, y, team: 'enemy', look, hp: 9999 });
    d.kind = 'dummy'; d.noCrumple = true;
    d.hurt = (dmg, info) => { this.dummyHits++; d.flash = 1; d.takeImpulse(info.x, info.y, info.dx * 600, -200, 0.9); Audio.play('hit', { pitch: 0.8 }); g.fx.text(d.c.x, d.c.y - 100, String(this.dummyHits), '#ffd9a0', 22); return null; };
    g.actors.push(d);
    this.dummy = d; this.dummyX = x;
    g.fx.dust(x, y - 4, 10, '#e8dccb', -Math.PI / 2, 120);
  }
  skipTutorial() {
    const g = this.game;
    if (!this.sv.hasBlade) { this.sv.hasBlade = true; g.player.actor.blade = true; } if (!(this.sv.inv.w_blade > 0)) this.sv.inv.w_blade = 1; this.sv.equip.weapon = this.sv.equip.weapon || 'w_blade';
    this.finishTutorial(true);
  }
  finishTutorial(skipped) {
    const g = this.game;
    this.sv.tutDone = 1; this.sv.obj = 0;
    this.ui && this.ui.tutorial(null);
    if (!skipped) { this.card('Tutorial complete', 'now the world is yours', 'small gain', 2.6); Audio.play('chime'); }
    // the training doll has done its job: it comes apart in a puff of straw
    if (this.dummy) {
      const d = this.dummy;
      g.fx.dust(d.c.x, d.c.y - 30, 14, '#e8dccb', -Math.PI / 2, 140);
      g.fx.burst(d.c.x, d.c.y - 50, { n: 12, speed: 160, col: '#e8d2b0', col1: '#b8a07a', life: 0.7, size: 2.2, kind: 'chip' });
      d.removed = true; this.dummy = null;
    }
    g.saveNow();
  }
  // a repeat attempt: no cutscene, straight back in
  bossQuick(B) {
    const g = this.game;
    g.cam.zoomT = 0.82;
    Audio.play('roar', { vol: 0.6 }); g.shake(0.35);
    setTimeoutGame(g, 0.35, () => B.wake());
    this.say(['Again. Watch its hands.', 'You know its tricks now.', 'Breathe. Then go.'][Math.floor(Math.random() * 3)], 2.2, true);
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
    // the first Hollow must stay findable: if it wandered off, fell somewhere unreachable or despawned,
    // another one claws out of the ground near you
    if (G.id === 'hollow' && !this.firstFoeDown && !g.cinematic) {
      const f = this.firstFoe, p = g.player;
      const lost = !f || f.removed || Math.abs(f.c.x - p.x) > 900 || Math.abs(f.c.y - p.y) > 500;
      this.foeLostT = lost ? (this.foeLostT || 0) + dt : 0;
      if (this.foeLostT > 2) { this.foeLostT = 0; if (f && !f.removed) f.removed = true; this.spawnFirstFoe(); }
    }
    const T_ = G.target(this);
    this.thread.target = T_;
    if (ui && !g.cinematic) {
      let dist = '';
      if (T_) { const d = Math.round(Math.abs(T_.x - g.player.x) / TILE); dist = d > 4 ? `${d} m ${T_.x > g.player.x ? '>' : '<'}` : ''; }
      // when Thread's target is buried or out of reach above, say how to get there
      let hint = G.hint(!!g.touch);
      if (T_) {
        const dx = Math.abs(T_.x - g.player.x), dy = T_.y - (g.player.y - 50);
        if (dx < 8 * TILE && dy > 3 * TILE) hint = g.touch ? 'it is underground: tap Build, then dig down' : 'it is underground: <kbd>Hold Click</kbd> the ground to dig down';
        else if (dx < 5 * TILE && dy < -3 * TILE) hint = g.touch ? 'it is up high: jump, or build steps' : 'it is up high: jump, or <kbd>Right-click</kbd> to build steps';
      }
      const under = g.player.y / TILE - g.world.surface(Math.floor(g.player.x / TILE));
      if (under > 5 && (!T_ || T_.y < g.player.y - 3 * TILE)) hint = g.touch ? 'underground: dig a stair up, or jump and place a block under you' : 'underground: dig a stair up, or jump and <kbd>Right-click</kbd> below you';
      this.objText = typeof G.text === 'function' ? G.text(this) : G.text;
      // the hint line fades once the player knows the ropes (it comes back if they stand around lost)
      ui.objective(this.objText, g.guide && g.guide.terse ? '' : hint, dist);
    }
  }
  objectiveText() { return this.objText || null; }
  completed(G) {
    const g = this.game;
    if (this.stage < 5) return;
    Audio.play('confirm');
    this.ui && this.ui.toast(typeof G.text === 'function' ? G.text(this) : G.text, 'done');
  }
  enterGoal(G) {
    const g = this.game, sv = this.sv;
    if (G.id === 'hollow') this.spawnFirstFoe();
    if (G.id === 'lights') this.say('The gate ahead is sealed with her thread. Light opens it. Lost dolls, stitches, nests... let\u2019s find them.', 4.4);
    if (G.id === 'shrine') this.say('There’s a fire ahead. Someone’s keeping it. Follow me.', 3.4);
    if (G.id === 'rest') this.say('Rest by the fire. The shrine will remember you if you fall.', 3.4);
    if (G.id === 'warden') this.say('Enough light. The gate will open now. Its Warden holds a piece of her. We take it back.', 4.2);
    if (G.id === 'home') this.say('You could stay somewhere. Build a home. Others might come.', 3.6);
    if (G.id === 'onward') this.say('Every gate holds more of her. The world has no edge. Neither do we.', 4);
  }
  spawnFirstFoe() {
    const g = this.game, p = g.player;
    const x = p.x + 340 * (p.actor.facing || 1), tx = Math.floor(x / TILE);
    const y = g.world.surface(tx) * TILE;
    const e = g.enemies.spawn('husk', x, y, 0, '#ffb36b');
    // it claws its way out of the ground (stands on the surface; the burst of earth sells the emergence)
    e.knockdown(0.6, 0, -500);
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
    if (!(this.sv.inv.w_blade > 0)) this.sv.inv.w_blade = 1;
    this.sv.equip.weapon = this.sv.equip.weapon || 'w_blade'; p.refreshLook();
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
    if (this.stage === -1 && g.player) {
      const p = g.player.actor;
      if (layer === 'front') drawSeedOfLight(ctx, p.c.x, p.c.y - 40, g.time, this.pt);
      if (layer === 'screen') this.drawPrologue(ctx, g.W, g.H, g.pxRatio, this.pt);
      return;
    }
    // tutorial guidance in the world: the training doll glows while you're meant to hit it, and a small
    // bobbing arrow by your doll points to where the step happens (the blade, the doll, the way to walk)
    const tut = this.tutStep && this.tutStep();
    if (layer === 'back' && tut === 'strike' && this.dummy && !this.dummy.removed) {
      const d = this.dummy, k = 0.6 + Math.sin(g.time * 4) * 0.25;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, d.c.x, d.c.y - 40, 70, [1, 0.85, 0.55], 0.35 * k);
      ctx.strokeStyle = rgba('#ffd9a0', 0.55 * k); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(d.c.x, d.c.y - 2, 30 + k * 6, 7 + k * 1.5, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (layer === 'front' && tut && !g.cinematic && !(g.ui && g.ui.modal) && g.player) {
      const p = g.player.actor;
      let tx = null;
      if (tut === 'move') tx = BLADE_X * TILE + 16;
      else if (tut === 'blade') tx = BLADE_X * TILE + 16;
      else if (tut === 'strike' && this.dummy) tx = this.dummy.c.x;
      if (tx !== null && Math.abs(tx - p.c.x) > 40) {
        const dir = Math.sign(tx - p.c.x), bob = Math.sin(g.time * 5) * 4;
        const x = p.c.x + dir * (34 + bob), y = p.c.y - 60;
        ctx.save(); ctx.fillStyle = rgba('#ffd9a0', 0.9);
        for (let i = 0; i < 2; i++) { const ox = x + dir * i * 9; ctx.globalAlpha = 0.5 + i * 0.4; ctx.beginPath(); ctx.moveTo(ox + dir * 6, y); ctx.lineTo(ox - dir * 3, y - 7); ctx.lineTo(ox - dir * 3, y + 7); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      } else if (tut === 'jump') {
        const y = p.c.y - 104 + Math.sin(g.time * 5) * 4;
        ctx.save(); ctx.fillStyle = rgba('#ffd9a0', 0.9); ctx.beginPath(); ctx.moveTo(p.c.x, y - 7); ctx.lineTo(p.c.x + 7, y + 3); ctx.lineTo(p.c.x - 7, y + 3); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    if (layer === 'back') {
      if (this.bladeY !== null && this.stage >= 5 && !this.sv.hasBlade) {
        const bx = BLADE_X * TILE + 16, by = this.bladeY;
        this.drawBladeLight(ctx, bx, by, g.time);
        if (!drawSprite(ctx, 'props/bladestone', bx, by + 4, 90, { grade: g.biomeAt(BLADE_X * TILE) })) drawBladeStone(ctx, bx, by + 2, 1, g.time, true);
      }
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
        ctx.translate(Math.round(pa.c.x), Math.round(pa.c.y - 40)); ctx.rotate(g.time * 0.6);
        drawStar(ctx, 0, 0, 34, 0.9);
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
  drawPrologue(ctx, W, H, px, t) {
    // painted: black with embers, the Loom-Cathedral at dusk, then each Warden in turn
    const P = this.pArt;
    if (P) {
      ctx.save();
      if (this.shot === 0) { ctx.fillStyle = '#040308'; ctx.fillRect(0, 0, W, H); P.embersDraw(ctx, W, H, t, '255,170,120', clamp(t / 1.5, 0, 1)); }
      else if (this.shot === 1) { ctx.fillStyle = '#040308'; ctx.fillRect(0, 0, W, H); P.vista(ctx, W, H, clamp((t - this.s1) / 4.2, 0, 1), t); const f = clamp(1 - (t - this.s1) / 0.8, 0, 1); if (f > 0) { ctx.fillStyle = `rgba(4,3,8,${f})`; ctx.fillRect(0, 0, W, H); } }
      else if (this.shot === 2) {
        ctx.fillStyle = '#040308'; ctx.fillRect(0, 0, W, H);
        const u = clamp((t - this.wt) / 1.35, 0, 1);
        P.warden(ctx, W, H, this.wi, u, t);
        const cut = clamp(1 - (t - this.wt) / 0.14, 0, 1);
        if (cut > 0) { ctx.fillStyle = `rgba(255,240,225,${cut * 0.35})`; ctx.fillRect(0, 0, W, H); }
      }
      ctx.restore();
      return;
    }
    // (fallback before the painter exists) shot 1: black. shot 3: the five wardens on the horizon
    if (t < 3.4) { ctx.fillStyle = `rgba(4,3,8,${clamp(1 - (t - 2.9) / 0.5, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
    const k = clamp((t - 6.0) / 0.5, 0, 1) * clamp((9.6 - t) / 0.45, 0, 1);
    if (k > 0) {
      ctx.save(); ctx.globalAlpha = k;
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#07060d'); sky.addColorStop(0.62, '#1a1626'); sky.addColorStop(0.66, '#2a2236'); sky.addColorStop(1, '#09080d');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      const hy = H * 0.68, push = 1 + (t - 6) * 0.012;
      ctx.translate(W / 2, hy); ctx.scale(push, push); ctx.translate(-W / 2, -hy);
      ctx.fillStyle = '#060509'; ctx.fillRect(0, hy, W, H - hy);
      WARDENS.forEach(([name, col, kind], i) => {
        const a = clamp((t - 6.25 - i * 0.42) / 0.5, 0, 1);
        if (a <= 0) return;
        const x = W * (0.14 + i * 0.18), h = H * (0.3 + (i % 2) * 0.05);
        drawWardenSil(ctx, x, hy, h, col, kind, a, t);
        ctx.globalAlpha = k * a * 0.85;
        ctx.fillStyle = col; ctx.textAlign = 'center';
        ctx.font = `600 ${Math.round(11 * px)}px Manrope, sans-serif`;
        ctx.fillText(name.toUpperCase(), x, hy + 26 * px);
        ctx.globalAlpha = k;
      });
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
  // after a fall: when ads are available (and nobody else shares the world) offer to rise on the spot for a
  // short rewarded ad; otherwise, or by choice, wake at the last shrine. A midgame ad may play during the fade.
  respawn() {
    const g = this.game, p = g.player, ui = this.ui;
    const solo = !(g.net && g.net.remotes && g.net.remotes.size > 0);
    if (Platform.adsReady && solo && !this.offeredRise) {
      this.offeredRise = true;
      const at = { x: p.actor.c.x, y: p.actor.c.y };
      ui.dialog('Thread', ['You fell. I can stitch you back together right here, if you can spare a moment.'], [
        { label: 'Rise here (short ad)', close: true, act: () => { Platform.rewarded().then(ok => { this.offeredRise = false; if (ok) this.riseHere(at); else this.toShrine(true); }); } },
        { label: 'Wake at the shrine', close: true, act: () => { this.offeredRise = false; this.toShrine(); } },
      ]);
      if (ui.dlg) ui.dlg.cancel = () => { this.offeredRise = false; this.toShrine(); };
      return;
    }
    this.toShrine();
  }
  riseHere(at) {
    const g = this.game, p = g.player, ui = this.ui;
    const gy = g.world.groundBelow(at.x, at.y - 60, 400);
    p.respawnAt(at.x, gy !== null ? gy : at.y);
    p.actor.inv = 2.5;
    ui.deathCard(false);
    g.flash([1, 1, 1], 0.3);
    this.say('There. Stitched. Go on.', 2.4);
    g.saveNow();
  }
  toShrine(skipAd) {
    const g = this.game, p = g.player, ui = this.ui, sv = this.sv;
    ui.fade(1, 0.8);
    setTimeout(() => {
      const r = sv.respawn || sv.home || { x: 4 * TILE + 16, y: g.world.surface(4) * TILE };
      if (g.bosses) g.bosses.abort();
      for (const e of g.actors) if (e.team === 'enemy') e.removed = true;
      p.respawnAt(r.x, r.y);
      g.cam.x = r.x; g.cam.y = r.y - 80; g.cam.vx = g.cam.vy = 0;
      this.thread.placed = false;
      const wake = () => {
        ui.fade(0, 1.4);
        ui.deathCard(false);
        this.say(['Get up. You always get up.', 'Again. Slower this time.', 'It’s alright. I’ve got you.'][Math.floor(Math.random() * 3)], 2.8);
        g.saveNow();
      };
      // a natural break: the screen is already dark, so a due midgame ad plays here
      if (!skipAd && Platform.midgameDue() && !(g.net && g.net.remotes && g.net.remotes.size > 0)) Platform.midgame().then(wake);
      else wake();
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

// the seed of light: a hot star with a long tail, flickering rays
// a clean star: a long four-point cross over a short diagonal one, closed paths, a white core
function drawStar(g, x, y, r, a = 1) {
  const pt = (n, R, r0, rot) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const ang = rot + i * Math.PI / n, rr = i % 2 ? r0 : R; g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); } g.closePath(); };
  g.fillStyle = `rgba(255,214,160,${0.55 * a})`; pt(4, r * 0.62, r * 0.1, Math.PI / 4); g.fill();
  g.fillStyle = `rgba(255,236,206,${0.85 * a})`; pt(4, r, r * 0.12, 0); g.fill();
  g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x, y, r * 0.16, 0, TAU); g.fill();
}
function drawSeedOfLight(g, x, y, time, t) {
  g.save(); g.globalCompositeOperation = 'lighter';
  const pulse = 1 + Math.sin(time * 9) * 0.08;
  const tail = g.createLinearGradient(x, y - 260, x, y);
  tail.addColorStop(0, 'rgba(255,217,160,0)'); tail.addColorStop(1, 'rgba(255,233,200,0.5)');
  g.fillStyle = tail; g.beginPath(); g.moveTo(x - 10, y - 260); g.lineTo(x + 10, y - 260); g.lineTo(x + 4, y); g.lineTo(x - 4, y); g.fill();
  drawGlow(g, x, y, 160 * pulse, [1, 0.85, 0.6], 0.6);
  drawGlow(g, x, y, 50 * pulse, [1, 1, 1], 0.9);
  g.strokeStyle = 'rgba(255,241,216,0.55)'; g.lineWidth = 1.5; g.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + time * 0.5, r = 34 + (i % 3) * 18; g.beginPath(); g.moveTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
  g.restore();
}
// a warden on the horizon: a tall cloaked shape with a rim of its colour and its crown or mark
function drawWardenSil(g, x, base, h, col, kind, a, t) {
  g.save(); g.globalAlpha *= a;
  const w = h * 0.34, top = base - h, hr = h * 0.07;
  const body = () => { g.beginPath(); g.moveTo(x - w, base); g.quadraticCurveTo(x - w * 0.55, top + h * 0.45, x - hr * 0.9, top + hr * 2.1); g.lineTo(x + hr * 0.9, top + hr * 2.1); g.quadraticCurveTo(x + w * 0.55, top + h * 0.45, x + w, base); g.closePath(); };
  // rim light
  g.save(); g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = '#0b0a10'; body(); g.fill(); g.restore();
  g.fillStyle = '#0b0a10'; body(); g.fill();
  g.beginPath(); g.arc(x, top + hr, hr, 0, TAU); g.fill();
  g.strokeStyle = col; g.lineWidth = 2; g.globalAlpha *= 0.8;
  if (kind === 'horns') { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * hr * 0.6, top + hr * 0.4); g.quadraticCurveTo(x + s * hr * 2.2, top - hr * 0.6, x + s * hr * 1.6, top - hr * 2.2); g.stroke(); } }
  if (kind === 'halo') { g.beginPath(); g.ellipse(x, top - hr * 0.6, hr * 1.4, hr * 0.45, 0, 0, TAU); g.stroke(); }
  if (kind === 'crown') { g.beginPath(); g.moveTo(x - hr, top); g.lineTo(x - hr * 0.6, top - hr * 1.2); g.lineTo(x, top - hr * 0.3); g.lineTo(x + hr * 0.6, top - hr * 1.2); g.lineTo(x + hr, top); g.stroke(); }
  if (kind === 'spires') { for (const s of [-1, 0, 1]) { g.beginPath(); g.moveTo(x + s * hr * 0.7, top); g.lineTo(x + s * hr * 0.9, top - hr * (s ? 1.4 : 2.2)); g.stroke(); } }
  if (kind === 'flower') { for (let i = 0; i < 7; i++) { const an = i / 7 * TAU + t * 0.3; g.beginPath(); g.ellipse(x + Math.cos(an) * hr * 1.6, top + hr + Math.sin(an) * hr * 1.6, hr * 0.6, hr * 0.3, an, 0, TAU); g.stroke(); } }
  // a cold glow where a heart would be
  g.globalAlpha = a * 0.6; g.globalCompositeOperation = 'lighter';
  drawGlow(g, x, top + h * 0.38, h * 0.12, [1, 1, 1].map((v, i) => parseInt(col.slice(1 + i * 2, 3 + i * 2), 16) / 255), 0.5 + Math.sin(t * 3) * 0.15);
  g.restore();
}
