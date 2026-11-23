// Boot: platform SDK, save, world, player, systems, UI, multiplayer. Straight into play.
import { Platform } from './platform.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Game } from './game/game.js';
import { Player } from './game/player.js';
import { Save } from './game/progress.js';
import { Enemies } from './game/enemies.js';
import { Bosses } from './game/bosses.js';
import { Shrines } from './game/npcs.js';
import { Story } from './game/story.js';
import { Content } from './game/content.js';
import { UI } from './ui/ui.js';
import { Touch } from './ui/touch.js';
import { TILE, T } from './world/tiles.js';
import { loadImages } from './art/images.js';

async function boot() {
  Platform.loadingStart();
  const pInit = Platform.init();
  const canvas = document.getElementById('game');
  Input.init(canvas);
  void pInit;   // the SDK finishes initialising in the background; the game starts on the first frame
  const sv = Save.load();
  const game = new Game(canvas);
  window.__game = game;
  game.save = sv;
  // settings
  const st = Object.assign(game.settings, { shake: 1, flashes: true, post: true, quality: 'high', touchOn: false, muted: false }, sv.settings || {});
  sv.settings = st;
  if (st.vol_master !== undefined) Audio.vol.master = st.vol_master;
  if (st.vol_music !== undefined) Audio.vol.music = st.vol_music;
  if (st.vol_sfx !== undefined) Audio.vol.sfx = st.vol_sfx;
  Audio.muted = !!st.muted || Platform.muted;
  Platform.onSettings(s => Audio.setMuted(!!s.muteAudio || !!st.muted));
  game.resize();
  if (!st.post && game.post.setEnabled) game.post.setEnabled(false);

  // world + player
  const art = loadImages();
  game.setWorld(sv.seed);
  game.world.loadEdits(sv.edits);
  const start = sv.born && sv.pos ? sv.pos : { x: 4 * TILE + 16, y: game.world.surface(4) * TILE };
  game.player = new Player(game, sv, start.x, start.y);
  game.player.actor.unstick();
  game.cam.x = start.x; game.cam.y = start.y - 70;
  game.targets = () => { const t = game.actors.filter(a => a.team === 'enemy' && a.mode !== 'dead' && !a.removed); return game.content ? t.concat(game.content.targets()) : t; };

  // systems
  game.enemies = new Enemies(game);
  game.bosses = new Bosses(game);
  game.shrines = new Shrines(game);
  game.story = new Story(game);
  game.content = new Content(game);
  game.systems.push(game.story, game.content, game.shrines, game.enemies, game.bosses);
  game.systems.push({ draw: (ctx, a, layer) => { if (layer === 'front') game.player.drawCursor(ctx); } });
  game.ui = new UI(game);
  game.touchCtl = new Touch(game);
  if (st.touchOn && !game.touch) game.touchCtl.show(true);

  // saving
  let lastSave = 0;
  game.saveNow = () => {
    const p = game.player;
    if (!p) return;
    if (game.net && game.net.visiting) { sv.hp = Math.max(1, p.hp); Save.write(null); return; }
    if (!p.dead && p.actor.mode === 'ctrl' && p.actor.c.ground) sv.pos = { x: p.x, y: p.y };
    sv.hp = Math.max(1, p.hp);
    Save.write(game.world);
    lastSave = game.time;
  };
  game.onTickHooks.push(() => { if (game.time - lastSave > 20 && game.story.stage >= 5) game.saveNow(); });
  addEventListener('visibilitychange', () => { if (document.hidden) { game.saveNow(); Platform.gameplayStop(); } else if (!game.paused) Platform.gameplayStart(); });
  addEventListener('pagehide', () => game.saveNow());
  game.onTilePlaced = (tx, ty, t) => { if (t === T.HEARTH) game.shrines.setHome(tx, ty); };
  game.onTileBroken = (tx, ty, t) => { if (t === T.HEARTH && sv.home && Math.abs(sv.home.x - (tx * TILE + 16)) < 2) { sv.home = null; game.ui.toast('Your hearth is gone'); } };
  game.player.onRespawn = () => game.story.respawn();
  game.player.select(sv.sel || 0);

  // first enemy teaches the dash
  let taught = false;
  game.onTickHooks.push(() => { if (!taught && game.enemies.list.length) { taught = true; game.story.onFirstEnemy(); } });

  // audio unlock on the first gesture (browser policy)
  const unlock = () => { Audio.init(); Audio.setScene(game.biomeAt(game.player.x).id, false); };
  addEventListener('pointerdown', unlock, { once: false }); addEventListener('keydown', unlock, { once: false });

  // multiplayer (optional; loads lazily so a blocked network never slows the boot)
  import('./net/net.js').then(m => { game.net = new m.Net(game); game.net.boot(); }).catch(e => console.warn('net unavailable', e && e.message));

  // perf probe for tests
  const ft = [];
  let lastT = performance.now();
  const probe = () => { const n = performance.now(); ft.push(n - lastT); lastT = n; if (ft.length > 240) ft.shift(); requestAnimationFrame(probe); };
  requestAnimationFrame(probe);
  window.__perf = () => { const s = [...ft].sort((a, b) => a - b); return { avg: +(ft.reduce((a, b) => a + b, 0) / ft.length).toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), actors: game.actors.length, chunks: game.world.chunks.size }; };

  art.then(() => { document.body.classList.add('art'); if (game.wr) game.wr.refreshArt(); if (game.ui) game.ui.hotbarDirty = true; });
  game.start();
  Platform.loadingStop();
  if (!sv.born) game.story.startBirth(); else game.story.quickStart();
}
boot().catch(e => console.error(e));
