// Cinematic director: the birth (first launch), title and biome cards, the blade in the ground,
// contextual tutorial hints, boss intros and victories, death and respawn.
import { Audio } from '../core/audio.js';
import { Input } from '../core/input.js';
import { P } from '../physics/body.js';
import { TILE, T, TILES, biomeOf, biomeIndexAt, gateNear } from '../world/tiles.js';
import { clamp, lerp, rand, TAU, rgba } from '../core/util.js';
import { drawGlow } from '../world/light.js';
import { Save, COSMETICS } from './progress.js';
import { setTimeoutGame } from './bosses.js';
import { Platform } from '../platform.js';

const BLADE_X = 12;

export class Story {
  constructor(game) {
    this.game = game;
    this.birthT = -1; this.stage = 0;
    this.seed = null;
    this.hints = [];
    this.hintT = 0;
    this.lastBiome = null;
    this.bladeY = null;
    this.tut = game.save.tut;
    this.gateWarned = {};
  }
  get sv() { return this.game.save; }
  get ui() { return this.game.ui; }

  // ------------------------------------------------------------ cards
  card(title, sub, cls = '', dur = 3.2) { if (this.ui) this.ui.card(title, sub, cls, dur); }
  meet(name, title) { this.card(name, title, 'small', 2.6); Audio.play('chime', { vol: 0.6 }); }

  // ------------------------------------------------------------ birth
  startBirth() {
    const g = this.game, p = g.player, a = p.actor;
    g.cinematic = true;
    this.birthT = 0; this.stage = 0;
    a.mode = 'script'; a.scriptPose = { mode: 'cocoon', strength: 0.06 };
    a.blade = false;
    this.hidden = true;
    g.cam.override = { x: a.c.x + 10, y: a.c.y - 70, t: 1.4 };
    g.cam.x = g.cam.override.x; g.cam.y = g.cam.override.y - 200;
    g.cam.zoomT = 1.9; g.cam.zoom = 1.5;
    this.ui.hud(false);
    this.ui.letterbox(true);
    this.ui.fade(1, 0);
    this.seedFx = null;
  }
  updateBirth(dt) {
    const g = this.game, p = g.player, a = p.actor, ui = this.ui;
    const t = this.birthT += dt;
    if (this.stage === 0) {
      if (t > 0.4 && !this.b1) { this.b1 = 1; Audio.play('beat'); }
      if (t > 1.5 && !this.b2) { this.b2 = 1; Audio.play('beat', { vol: 1.2 }); }
      if (t > 2.0 && !this.b3) { this.b3 = 1; ui.fade(0, 2.2); }
      // a seed of light falls from the sky
      if (t > 2.4 && t < 3.4) {
        const u = (t - 2.4) / 1.0;
        const sx = a.c.x + (1 - u) * 260, sy = a.c.y - 30 - (1 - u * u) * 900;
        this.seedFx = { x: sx, y: sy };
        g.fx.spawn({ x: sx, y: sy, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.5, size: 4, size1: 0.5, col: '#ffffff', col1: '#ffd9a0', add: true });
      }
      if (t > 3.4 && !this.b4) {
        this.b4 = 1; this.seedFx = null; this.hidden = false;
        Audio.play('crack'); Audio.play('slam', { vol: 0.6 });
        g.shake(0.5); g.flash([1, 0.95, 0.85], 0.6);
        g.fx.ring(a.c.x, a.c.y - 10, 6, 160, 0.9, '#ffd9a0', 6);
        g.fx.dust(a.c.x, a.c.y - 4, 18, '#e8dccb', -Math.PI / 2, 260);
        g.fx.burst(a.c.x, a.c.y - 20, { n: 24, speed: 380, col: '#ffffff', col1: '#ffd9a0', add: true, life: 0.8, size: 3, grav: 600 });
        a.body.impulseAll(0, -260);
        Audio.play('title', { vol: 0.5 });
      }
      if (t > 4.6 && !this.b5) { this.b5 = 1; ui.press(g.touch ? 'tap to wake' : 'press any key to wake'); this.stage = 1; }
    } else if (this.stage >= 1 && this.stage <= 3) {
      const pressed = Input.any || Input.mouse.lp || (g.touch && g.touch.tapped);
      if (g.touch) g.touch.tapped = false;
      if (pressed) {
        this.stage++;
        Audio.init();
        if (this.stage === 2) {
          a.scriptPose = { mode: 'cocoon', strength: 0.3 };
          a.takeImpulse(a.body.x[P.HAND_F], a.body.y[P.HAND_F], 0, -500, 0);
          a.takeImpulse(a.body.x[P.HEAD], a.body.y[P.HEAD], 120, -300, 0);
          Audio.play('crack', { vol: 0.5 }); g.shake(0.12);
          ui.press(g.touch ? 'again' : 'again');
        } else if (this.stage === 3) {
          a.scriptPose = { mode: 'getup', getup: 0.42, strength: 0.65 };
          Audio.play('land', { vol: 0.7 }); g.fx.dust(a.c.x, a.c.y - 4, 8, '#e8dccb', -Math.PI / 2, 120);
          ui.press(g.touch ? 'stand' : 'stand');
        } else if (this.stage === 4) {
          ui.press(null);
          this.standT = 0;
          a.scriptPose = { mode: 'getup', getup: 0.42, strength: 0.9 };
        }
      }
    } else if (this.stage === 4) {
      this.standT += dt;
      if (a.scriptPose) a.scriptPose.getup = Math.min(1, 0.42 + this.standT / 1.3);
      if (this.standT > 1.4 && !this.s1) {
        this.s1 = 1;
        a.mode = 'ctrl'; a.scriptPose = null;
        this.card('Own Two Feet', 'a body. a world. yours.', '', 4.2);
        Audio.play('chime');
        g.cam.override = null; g.cam.zoomT = 1;
      }
      if (this.standT > 3.6 && !this.s2) { this.s2 = 1; ui.letterbox(false); ui.hud(true); g.cinematic = false; }
      if (this.standT > 4.6) {
        this.stage = 5; this.sv.born = true; g.saveNow();
        this.queueHint('move');
        Platform.gameplayStart();
      }
    }
  }
  skipBirth() {
    const g = this.game, a = g.player.actor;
    this.stage = 5; this.sv.born = true; this.hidden = false;
    a.mode = 'ctrl'; a.scriptPose = null;
    g.cam.override = null; g.cam.zoomT = 1; g.cinematic = false;
    this.ui.press(null); this.ui.letterbox(false); this.ui.hud(true); this.ui.fade(0, 0.5);
    this.queueHint('move');
    Platform.gameplayStart();
  }
  quickStart() {
    const g = this.game;
    this.stage = 5; this.hidden = false;
    this.ui.fade(1, 0);
    setTimeout(() => this.ui.fade(0, 1.6), 50);
    this.ui.hud(true);
    const B = g.biomeAt(g.player.x);
    this.card(B.name, `welcome back, ${this.sv.name.split(' ')[0]}`, 'small', 2.8);
    this.lastBiome = biomeIndexAt(Math.floor(g.player.x / TILE));
    Platform.gameplayStart();
  }

  // ------------------------------------------------------------ per tick
  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    if (this.stage < 5 && this.birthT >= 0) {
      if (Input.pressed('menu') && this.stage < 4) { Input.consume('menu'); this.skipBirth(); return; }
      this.updateBirth(dt);
      return;
    }
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
        }
        const got = Save.unlockSrc(B.id);
        if (got.length && this.ui) setTimeout(() => this.ui.toast('Unlocked: ' + got.map(c => c.name).join(', ')), 2600);
      }
      if (!(g.bosses && g.bosses.active)) Audio.setScene(B.id, false);
    }
    // a gate ahead
    const gi = gateNear(Math.floor(p.x / TILE));
    if (!g.save.bosses['g' + gi.k] && Math.abs(p.x / TILE - gi.gx) < 60 && !this.gateWarned[gi.k]) {
      this.gateWarned[gi.k] = 1;
      Audio.play('roar', { vol: 0.35, pitch: 0.7 }); g.shake(0.2);
      this.ui && this.ui.toast('Something waits at the gate.');
    }
    this.updateHints(dt);
    // blade in the ground near the birthplace
    if (!this.sv.hasBlade && this.bladeY === null) this.bladeY = g.world.surface(BLADE_X) * TILE;
  }

  // ------------------------------------------------------------ hints
  queueHint(id) { if (!this.tut[id]) this.hints.push(id); }
  updateHints(dt) {
    const g = this.game, p = g.player, ui = this.ui, a = p.actor;
    if (!ui) return;
    if (g.cinematic || (g.bosses && g.bosses.active)) { ui.hint(null); return; }
    const touch = !!g.touch;
    const H = {
      move: touch ? 'Drag the left stick to walk' : '<kbd>A</kbd><kbd>D</kbd> walk',
      jump: touch ? 'Tap <kbd>&#8593;</kbd> to jump' : '<kbd>Space</kbd> jump',
      blade: touch ? 'Tap <kbd>E</kbd> to take the blade' : '<kbd>E</kbd> take the blade',
      strike: touch ? 'Tap <kbd>&#9876;</kbd> to strike' : '<kbd>J</kbd> or <kbd>Click</kbd> strike',
      mine: touch ? 'Tap <kbd>&#9638;</kbd> then tap a block to break it' : 'Hold <kbd>Click</kbd> on a block to break it',
      place: touch ? 'In build mode, tap empty space to place' : '<kbd>Right-click</kbd> to place · <kbd>1</kbd>-<kbd>9</kbd> choose',
      dash: touch ? 'Tap <kbd>&#187;</kbd> to dash' : '<kbd>Shift</kbd> dash',
      heal: touch ? 'Hold <kbd>&#10084;</kbd> to mend with breath' : 'Hold <kbd>H</kbd> to mend with breath',
      craft: touch ? 'Open the menu to craft' : '<kbd>Q</kbd> craft · <kbd>Esc</kbd> menu',
    };
    const done = {
      move: () => Math.abs(p.x - 4 * TILE) > 3 * TILE,
      jump: () => !a.c.ground && a.c.vy < -100,
      blade: () => this.sv.hasBlade,
      strike: () => !!a.attack,
      mine: () => this.sv.stats.blocks > 0,
      place: () => this.sv.stats.placed > 0,
      dash: () => a.c.dashT > 0,
      heal: () => p.healT > 0.3,
      craft: () => this.tut.crafted,
    };
    const cur = this.hints[0];
    if (!cur) { ui.hint(null); return; }
    this.hintT += dt;
    if (this.hintT > 0.6) ui.hint(H[cur]);
    if (done[cur] && done[cur]()) {
      this.tut[cur] = 1; this.hints.shift(); this.hintT = 0; ui.hint(null);
      const next = { move: 'jump', jump: this.sv.hasBlade ? 'strike' : null, blade: 'strike', strike: 'mine', mine: 'place', place: 'craft' }[cur];
      if (next) setTimeoutGame(g, 1.2, () => this.queueHint(next));
    }
    if (this.hintT > 14 && cur !== 'blade') { this.tut[cur] = 1; this.hints.shift(); this.hintT = 0; ui.hint(null); }
  }

  interactables() {
    if (this.sv.hasBlade || this.bladeY === null || this.stage < 5) return [];
    return [{ x: BLADE_X * TILE + 16, y: this.bladeY - 30, r: 90, label: 'Take the blade', act: () => this.takeBlade() }];
  }
  takeBlade() {
    const g = this.game, p = g.player;
    this.sv.hasBlade = true; p.actor.blade = true;
    if (this.hints[0] === 'blade') { this.tut.blade = 1; this.hints.shift(); }
    g.slowmo(0.3, 0.8); g.flash([1, 0.95, 0.85], 0.35); g.shake(0.25);
    Audio.play('clang', { pitch: 0.7 }); Audio.play('chime', { vol: 0.7 });
    g.fx.ring(BLADE_X * TILE + 16, this.bladeY - 20, 6, 120, 0.7, '#9ff3ff', 5);
    this.card('A Blade', 'hold it like you mean it', 'small gain', 2.6);
    this.hintT = 0; this.hints.unshift('strike');
    if (g.enemies) g.enemies.calm = Math.min(g.enemies.calm, 12);
    g.saveNow();
  }
  // first enemies show up after the blade; teach the dash then
  onFirstEnemy() { if (!this.tut.dash) this.queueHint('dash'); }

  draw(ctx, a, layer) {
    const g = this.game;
    if (layer === 'back' && this.bladeY !== null && !this.sv.hasBlade) {
      const x = BLADE_X * TILE + 16, y = this.bladeY;
      ctx.save();
      ctx.translate(x, y + 4); ctx.rotate(0.22);
      ctx.fillStyle = '#e8eef5';
      ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(-4, -26, 0, -42); ctx.quadraticCurveTo(4, -26, 3, 0); ctx.fill();
      ctx.fillStyle = '#3a3540'; ctx.fillRect(-9, -44, 18, 4); ctx.fillRect(-2, -58, 4, 15);
      ctx.restore();
    }
    if (layer === 'front') {
      if (this.bladeY !== null && !this.sv.hasBlade) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, BLADE_X * TILE + 20, this.bladeY - 26, 46 + Math.sin(g.time * 2) * 6, [0.62, 0.95, 1], 0.4);
        ctx.restore();
      }
      if (this.seedFx) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, this.seedFx.x, this.seedFx.y, 90, [1, 0.9, 0.7], 0.9);
        drawGlow(ctx, this.seedFx.x, this.seedFx.y, 24, [1, 1, 1], 1);
        ctx.restore();
      }
    }
  }
  lights(arr) {
    if (this.seedFx) arr.push({ x: this.seedFx.x, y: this.seedFx.y, c: [1, 0.9, 0.7], s: 1 });
    if (this.bladeY !== null && !this.sv.hasBlade) arr.push({ x: BLADE_X * TILE + 16, y: this.bladeY - 26, c: [0.6, 0.95, 1], s: 0.6 });
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
    setTimeoutGame(g, 1.3, () => {
      B.wake();
      Audio.play('roar'); g.shake(0.8); g.flash([1, 0.85, 0.75], 0.2); g.pulse(2);
      this.card(B.name, B.title, 'boss', 2.8);
    });
    setTimeoutGame(g, 3.9, () => {
      g.cam.override = null; g.cam.zoomT = 0.82;
      ui.letterbox(false); g.cinematic = false;
    });
  }
  bossVictory(B, relic, got) {
    const g = this.game, ui = this.ui;
    ui.letterbox(true);
    setTimeoutGame(g, 1.6, () => this.card(B.name, 'has fallen', 'boss', 2.2));
    setTimeoutGame(g, 4.2, () => {
      this.card(relic.name, relic.desc + (relic.key ? ` · ${relic.key}` : ''), 'gain', 3.8);
      Audio.play('chime');
    });
    setTimeoutGame(g, 6.5, () => {
      ui.letterbox(false);
      ui.toast('Your body remembers: a new mark');
      if (got && got.length) setTimeout(() => ui.toast('Unlocked: ' + got.map(c => c.name).join(', ')), 1200);
    });
  }

  // ------------------------------------------------------------ death
  respawn() {
    const g = this.game, p = g.player, ui = this.ui, sv = this.sv;
    ui.fade(1, 0.8);
    setTimeout(() => {
      const r = sv.respawn || sv.home || { x: 4 * TILE, y: g.world.surface(4) * TILE };
      if (g.bosses) g.bosses.abort();
      for (const e of g.actors) if (e.team === 'enemy') e.removed = true;
      p.respawnAt(r.x, r.y);
      g.cam.x = r.x; g.cam.y = r.y - 80; g.cam.vx = g.cam.vy = 0;
      ui.fade(0, 1.4);
      ui.deathCard(false);
      g.saveNow();
    }, 900);
  }
}
export { BLADE_X, COSMETICS };
