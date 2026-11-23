// Extra scenarios for tools/shot.mjs
export default ({ page, sleep, key, shot, evalg }) => ({
  // deterministic animation filmstrip: freeze the live loop, step the sim by hand at 30 fps, crop around the hero
  async film() {
    await page.waitForFunction(() => window.__game && window.__game.story);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999; if (g.story.skipTutorial) g.story.skipTutorial(); });
    await sleep(1500);
    await evalg(() => { window.__game.hitstopT = 1e9; });
    const plan = [];
    for (let i = 0; i < 6; i++) plan.push([]);
    for (let i = 0; i < 14; i++) plan.push(['KeyD']);
    for (let i = 0; i < 2; i++) plan.push(['KeyD', 'Space']);
    for (let i = 0; i < 14; i++) plan.push(['KeyD']);
    for (let i = 0; i < 6; i++) plan.push([]);
    for (let i = 0; i < 8; i++) plan.push(i < 2 ? ['KeyJ'] : []);
    for (let i = 0; i < 6; i++) plan.push(i < 1 ? ['ShiftLeft'] : []);
    let f = 0;
    for (const keys of plan) {
      await page.evaluate((keys) => {
        const g = window.__game, I = window.__input;
        I.keys.clear(); for (const k of keys) I.keys.add(k);
        for (let s = 0; s < 4; s++) { I.poll(); g.step(1 / 120); I.endTick(); }
        g.updateCamera(1 / 30); g.render(0);
        const c = g.cam, sc = g.baseZoom * c.zoom, p = g.player.actor.c;
        return [(p.x - c.rx) * sc + innerWidth / 2, (p.y - c.ry) * sc + innerHeight / 2, sc];
      }, keys).then(([x, y, sc]) => page.screenshot({ path: `/tmp/otf-shots/film-${String(f++).padStart(3, '0')}.png`, clip: { x: Math.max(0, x - 70 * sc), y: Math.max(0, y - 95 * sc), width: 140 * sc, height: 120 * sc } }));
    }
  },
  async birth() {
    await sleep(400); await shot('b0-open');
    await sleep(1800); await shot('b1-fall');
    await page.keyboard.down('KeyD'); await sleep(1500); await page.keyboard.up('KeyD'); await shot('b2-steer');
    await page.keyboard.down('KeyA'); await sleep(1500); await page.keyboard.up('KeyA'); await shot('b3-lore');
    await sleep(3500); await shot('b4-near');
    await page.waitForFunction(() => window.__game.story.stage >= 1, null, { timeout: 20000 });
    await sleep(250); await shot('b5-impact');
    await page.waitForFunction(() => window.__game.story.stage >= 2, null, { timeout: 20000 });
    await sleep(500); await shot('b6-thread');
    await key('Space'); await sleep(900); await shot('b7-kneel');
    await key('Space'); await sleep(2600); await shot('b8-title');
    await page.waitForFunction(() => window.__game.story.stage >= 5, null, { timeout: 20000 });
    await sleep(600); await shot('b9-play');
    await page.keyboard.down('KeyD'); await sleep(1600); await page.keyboard.up('KeyD'); await sleep(800); await shot('b10-blade');
    await sleep(1500); await shot('b11-foe');
    console.log('state', JSON.stringify(await evalg(() => { const g = window.__game; return { obj: g.save.obj, blade: g.save.hasBlade, glimmer: g.save.glimmer, enemies: g.enemies.list.length }; })));
  },
  async tut() {
    await sleep(900);
    await evalg(() => { window.__game.story.skipBirth(); window.__game.enemies.calm = 999; });
    await sleep(800); await shot('t0-move');
    await page.keyboard.down('KeyD'); await sleep(1200); await page.keyboard.up('KeyD'); await sleep(1100);
    await key('Space', 200); await sleep(1300); await shot('t1-blade');
    const dbg = () => evalg(() => { const a = window.__game.player.actor; return [a.mode, Math.round(a.c.x / 32), Math.round(a.c.y / 32), Math.round(a.c.vy), window.__game.story.tutI]; });
    console.log('d1', JSON.stringify(await dbg()));
    await page.keyboard.down('KeyD'); await sleep(1500); await page.keyboard.up('KeyD'); await sleep(1300);
    console.log('d2', JSON.stringify(await dbg()));
    await evalg(() => { const g = window.__game, d = g.story.dummy; if (d) { g.player.respawnAt(d.c.x - 50, g.world.surface(Math.floor((d.c.x - 50) / 32)) * 32); g.player.actor.face(1); } });
    await sleep(700); await shot('t2-strike');
    console.log('d3', JSON.stringify(await dbg()), JSON.stringify(await evalg(() => { const d = window.__game.story.dummy; return d ? [Math.round(d.c.x / 32), d.mode] : null; })));
    for (let i = 0; i < 6; i++) { await key('KeyJ', 60); await sleep(420); }
    await sleep(1200); await key('ShiftLeft', 80); await sleep(1300); await shot('t3-mine');
    await evalg(() => { window.__game.save.stats.blocks += 3; }); await sleep(1200);
    await evalg(() => { window.__game.save.stats.placed += 1; }); await sleep(1200);
    await key('KeyQ'); await sleep(600); await key('Escape'); await sleep(1500); await shot('t4-done');
    const st = await evalg(() => { const g = window.__game; return { tutDone: g.save.tutDone, tutI: g.story.tutI, dummyHits: g.story.dummyHits, blade: g.save.hasBlade, obj: g.save.obj }; });
    console.log('tut', JSON.stringify(st));
  },
  // CrazyGames SDK flow against tools/cg-mock.js (run with --cg)
  async sdk() {
    await page.waitForFunction(() => window.__game && window.__game.story && window.__cg);
    await sleep(800);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); if (g.story.skipTutorial) g.story.skipTutorial(); g.enemies.calm = 999; });
    await sleep(600);
    await evalg(() => window.__game.ui.openMenu()); await sleep(300); await evalg(() => window.__game.ui.closeMenu()); await sleep(300);
    // die: the rewarded offer appears; take it
    await evalg(() => { const g = window.__game; window.__dieX = g.player.actor.c.x; g.player.hp = 0; g.player.die(); });
    await page.waitForSelector('#dialog:not(.hidden) .opt', { timeout: 8000 });
    await shot('sdk-offer');
    const pausedDuring = await evalg(async () => { document.querySelector('#dialog .opt').click(); await new Promise(r => setTimeout(r, 150)); return window.__game.paused; });
    await sleep(1200);
    const rose = await evalg(() => ({ dead: window.__game.player.dead, dx: Math.round(window.__game.player.actor.c.x - window.__dieX), paused: window.__game.paused }));
    // die again: wake at the shrine, a due midgame ad plays in the dark
    await evalg(() => { const g = window.__game; window.__platform.lastAd = -1e9; g.player.hp = 0; g.player.die(); });
    await page.waitForSelector('#dialog:not(.hidden) .opt', { timeout: 8000 });
    await evalg(() => document.querySelectorAll('#dialog .opt')[1].click());
    await sleep(2500);
    const after = await evalg(() => ({ dead: window.__game.player.dead, paused: window.__game.paused, calls: window.__cg.calls.filter(c => c !== 'data.set'), saves: window.__cg.calls.filter(c => c === 'data.set').length }));
    console.log('sdk', JSON.stringify({ pausedDuring, rose, after }));
    const need = ['init', 'loadingStart', 'loadingStop', 'gameplayStart', 'gameplayStop', 'ad:rewarded', 'ad:midgame'];
    const miss = need.filter(n => !after.calls.includes(n));
    if (miss.length || !pausedDuring || rose.dead || Math.abs(rose.dx) > 80 || after.dead || after.paused || !after.saves) throw new Error('sdk flow broken: ' + JSON.stringify({ miss, pausedDuring, rose, after }));
  },
  async content() {
    await sleep(900);
    const info = await evalg(() => { const g = window.__game; g.story.skipBirth(); g.save.tutDone = 1; g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999;
      const c = g.content; return { dolls: c.sites('doll', -200, 200), chests: c.sites('chest', -200, 200), stitches: c.sites('stitch', -200, 200), nests: c.sites('nest', -300, 300) }; });
    console.log('sites', JSON.stringify(info));
    const go = async (x, name) => { if (x === undefined) { console.log('skip', name); return; } await evalg((x) => { const g = window.__game; const tx = x - 3; g.player.respawnAt(tx * 32, g.world.surface(tx) * 32); g.cam.x = tx * 32; g.cam.y = g.player.y - 100; }, x); await sleep(1600); await shot(name); };
    await go(info.dolls[0], 'c0-doll');
    await evalg((x) => { window.__game.content.wakeDoll(x); }, info.dolls[0]);
    await sleep(1800); await shot('c1-woken');
    await go(info.chests[1], 'c2-chest');
    await evalg(() => { const g = window.__game; const ch = [...g.content.chests.keys()]; g.content.openChest(ch[0]); });
    await sleep(900); await shot('c3-opened');
    await go(info.stitches[0], 'c4-stitch');
    await go(info.nests[0], 'c5-nest');
    console.log('state', JSON.stringify(await evalg(() => { const g = window.__game; return { lights: g.save.lights, rescued: Object.keys(g.save.rescued).length, chests: Object.keys(g.save.chests).length, glimmer: g.save.glimmer }; })));
  },
  async gates() {
    await sleep(900);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); g.save.tutDone = 1; g.save.lights = 0; g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999;
      const x = (220 - 40) * 32; g.player.respawnAt(x, g.world.surface(220 - 40) * 32); });
    await page.keyboard.down('KeyD'); await sleep(2600); await page.keyboard.up('KeyD'); await sleep(400); await shot('g0-sealed');
    const a = await evalg(() => { const g = window.__game; return { active: !!g.bosses.active, sealed: !!g.bosses.sealed, x: Math.round(g.player.x / 32) }; });
    await evalg(() => { window.__game.save.lights = 10; });
    await page.keyboard.down('KeyD'); await sleep(1800); await page.keyboard.up('KeyD'); await sleep(600);
    const b = await evalg(() => { const g = window.__game; return { active: !!g.bosses.active, cinematic: g.cinematic, seen: g.save.bossSeen }; });
    await sleep(4000);
    await evalg(() => { const g = window.__game; g.bosses.abort(); g.player.respawnAt((220 - 40) * 32, g.world.surface(180) * 32); });
    await sleep(4500);
    await page.keyboard.down('KeyD'); await sleep(2600); await page.keyboard.up('KeyD'); await sleep(300);
    const c = await evalg(() => { const g = window.__game; return { active: !!g.bosses.active, cinematic: g.cinematic }; });
    await shot('g1-quick');
    console.log('gates', JSON.stringify({ a, b, c }));
  },
  async look() {
    // q: x,y (tiles), zoom — frame an arbitrary spot of the world
    await sleep(1200);
    const spec = process.env.LOOK || '30,-6,3';
    const [x, ys, z] = spec.split(',');
    await evalg(([x, ys, z]) => { const g = window.__game; x = +x; z = +z; const y = ys[0] === 's' ? g.world.surface(x) + Number(ys.slice(1)) : +ys; g.story.skipBirth && g.story.skipBirth(); g.cam.override = { x: x * 32, y: y * 32, t: 0.01 }; g.cam.zoomT = z; g.cam.zoom = z; g.cam.x = x * 32; g.cam.y = y * 32; }, [x, ys, z]);
    await sleep(1500); await shot('look');
  },
  async fight() {
    await sleep(1200);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999;
      const p = g.player; g.enemies.spawn('husk', p.x + 180, g.world.surface(Math.floor((p.x + 180) / 32)) * 32, 0, '#ffb36b');
      g.enemies.spawn('brute', p.x + 360, g.world.surface(Math.floor((p.x + 360) / 32)) * 32, 0, '#ffb36b');
      g.enemies.spawnWisp(p.x + 260, p.y - 160, 0, '#c4b5ff'); });
    await sleep(1400); await shot('f0');
    for (let i = 0; i < 10; i++) { await key('KeyJ', 50); await sleep(220); if (i === 2) await shot('f1'); if (i === 6) await shot('f2'); }
    await page.keyboard.down('KeyD'); await sleep(500); await page.keyboard.up('KeyD');
    for (let i = 0; i < 10; i++) { await key('KeyJ', 50); await sleep(200); if (i === 4) await shot('f3'); }
    await sleep(500); await shot('f4');
    const st = await evalg(() => { const g = window.__game; return { hp: g.player.hp, enemies: g.enemies.list.map(e => [e.kind, Math.round(e.hp), e.mode]), glimmer: g.save.glimmer, kills: g.save.stats.kills }; });
    console.log('state', JSON.stringify(st));
  },
  async boss() {
    await sleep(1200);
    const gx = Number(process.env.GATE || 220);
    await evalg((gx) => { const g = window.__game; g.story.skipBirth(); g.save.tutDone = 1; g.save.lights = 99; g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999;
      const x = (gx - 22) * 32; g.player.respawnAt(x, g.world.surface(gx - 22) * 32); g.cam.x = x; g.cam.y = g.player.y - 80; }, gx);
    await page.keyboard.down('KeyD'); await sleep(900); await page.keyboard.up('KeyD');
    await sleep(600); await shot('k0-intro');
    await sleep(1600); await shot('k1-card');
    await sleep(2600); await shot('k2-fight');
    for (let i = 0; i < 16; i++) { await page.keyboard.down('KeyD'); await key('KeyJ', 60); await page.keyboard.up('KeyD'); await sleep(160); if (i % 5 === 4) await shot('k3-' + i); }
    await evalg(() => { const B = window.__game.bosses.active; if (B) B.onHurt(99999); });
    await sleep(600); await shot('k4-kill');
    await sleep(4000); await shot('k5-relic');
    const st = await evalg(() => { const g = window.__game; return { hp: g.player.hp, bosses: g.save.bosses, abil: g.save.abil, glimmer: g.save.glimmer }; });
    console.log('state', JSON.stringify(st));
  },
  async shrine() {
    await sleep(1200);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999; g.save.glimmer = 500;
      const x = 98 * 32; g.player.respawnAt(x, g.world.surface(98) * 32); g.cam.x = x; g.cam.y = g.player.y - 80; });
    await page.keyboard.down('KeyD'); await sleep(900); await page.keyboard.up('KeyD');
    await sleep(1800); await shot('n0-meet');
    await evalg(() => { const g = window.__game; const n = g.actors.find(a => a.npcKind); if (n) { g.player.actor.c.x = n.c.x - 40; g.player.actor.body.translate(n.c.x - 40 - g.player.actor.body.x[4], 0); } });
    await sleep(600);
    const it = await evalg(() => { const p = window.__game.player; return p.interact ? p.interact.label : null; });
    console.log('interact', it);
    if (it === 'Rest') { await key('KeyE'); await sleep(1200); }   // first visit: rest at the fire, then talk
    console.log('interact2', await evalg(() => { const p = window.__game.player; return p.interact ? p.interact.label : null; }));
    await key('KeyE'); await sleep(1500); await shot('n1-talk');
    for (let i = 0; i < 4; i++) { await key('KeyE'); await sleep(500); }
    await shot('n2-opts');
    await key('Escape'); await sleep(400);
    await key('Escape'); await sleep(600); await shot('n3-menu');
    await page.click('.tab:nth-child(3)'); await sleep(900); await shot('n4-look');
    await page.click('.slots .tab:nth-child(3)'); await sleep(600); await shot('n5-heads');
    await page.click('.tab:nth-child(4)'); await sleep(400); await shot('n6-craft');
    await page.click('.tab:nth-child(2)'); await sleep(400); await shot('n7-journal');
  },
  async editor() {
    await sleep(1200);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); g.save.hasBlade = true; g.player.actor.blade = true; g.ui.openMenu('look'); });
    await sleep(1500);
    const el = await page.$('.preview canvas'); await el.screenshot({ path: '/tmp/otf-shots/preview.png' });
  },
  async prof() {
    await sleep(1200);
    await evalg((q) => { const g = window.__game; g.story.skipBirth(); if (q) { g.settings.quality = q; g.resize(); if (q === 'low') g.post.setEnabled(false); } }, process.env.Q || null);
    if (!process.env.IDLE) await page.keyboard.down('KeyD');
    await sleep(process.env.IDLE ? 2500 : 1000);
    await evalg((nd) => { window.__prof = {}; window.__noDecor = !!nd; }, process.env.NODECOR || null);
    await sleep(3000);
    const r = await evalg(() => { const P = window.__prof, n = P.frames; const o = {}; for (const k in P) if (k !== 'frames') o[k] = +(P[k] / n).toFixed(2); o.frames = n; return o; });
    console.log('prof', JSON.stringify(r));
    await page.keyboard.up('KeyD');
  },
  async mobile2() {
    await sleep(900);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); g.save.tutDone = 1; g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999; const x = 100 * 32; g.player.respawnAt(x, g.world.surface(100) * 32); });
    await sleep(1500);
    await page.touchscreen.tap(150, 300); await sleep(300);
    await shot('m3-play');
  },
  async mobile() {
    await sleep(6000); await shot('m0');
    await page.touchscreen.tap(400, 200); await sleep(500);
    await page.touchscreen.tap(400, 200); await sleep(500);
    await page.touchscreen.tap(400, 200); await sleep(3500); await shot('m1');
    await sleep(3500); await shot('m2');
  },
  async build() {
    await sleep(1200);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999; });
    await sleep(3000);
    // screen position of the surface tile two steps ahead
    const pos = await evalg(() => { const g = window.__game, p = g.player; const tx = Math.floor(p.x / 32) + 2, ty = g.world.surface(tx);
      const s = g.view.scale / g.pxRatio; return { x: (tx * 32 + 16 - g.cam.rx) * s + g.cssW / 2, y: (ty * 32 + 16 - g.cam.ry) * s + g.cssH / 2, tx, ty, t: g.world.get(tx, ty) }; });
    console.log('target', JSON.stringify(pos));
    await page.mouse.move(pos.x - 5, pos.y - 5); await page.mouse.move(pos.x, pos.y); await sleep(200);
    console.log('dbg', JSON.stringify(await evalg(() => { const g = window.__game, p = g.player, m = window.__game && g.player; const I = g.player; return { aim: p.mouseAim, cur: p.cursor, last: p.lastMouse, t: g.time }; })));
    await page.mouse.down(); await sleep(300);
    console.log('dbg2', JSON.stringify(await evalg(() => { const g = window.__game, p = g.player; return { mine: p.mine, cur: p.cursor, att: !!p.actor.attack, el: document.elementFromPoint(500, 300).id }; })));
    await sleep(1300); await shot('u0-mine'); await page.mouse.up();
    await sleep(300);
    const r1 = await evalg((p) => { const g = window.__game; return { blocks: g.save.stats.blocks, tile: g.world.get(p.tx, p.ty), inv: g.save.inv, hotbar: g.save.hotbar }; }, pos);
    console.log('after mine', JSON.stringify(r1));
    await evalg(() => { const g = window.__game; g.player.give(18, 1); g.player.give(12, 3); g.save.sel = g.save.hotbar.indexOf(18); });
    await page.mouse.click(pos.x, pos.y, { button: 'right' }); await sleep(500);
    const r2 = await evalg((p) => { const g = window.__game; return { placed: g.save.stats.placed, tile: g.world.get(p.tx, p.ty), home: g.save.home }; }, pos);
    console.log('after place', JSON.stringify(r2));
    await sleep(1500); await shot('u1-home');
  },
  async persist() {
    await sleep(1200);
    const before = await evalg(() => { const g = window.__game; g.story.skipBirth(); g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999;
      const tx = 9, ty = g.world.surface(9); g.world.set(tx, ty, 0); g.world.set(tx, ty - 3, 10); g.save.glimmer = 77; g.saveNow(); return { tx, ty, x: g.player.x }; });
    await evalg(() => sessionStorage.setItem('keep', '1'));
    await page.reload(); await page.waitForFunction(() => window.__game && window.__game.player);
    await sleep(2500);
    const after = await evalg(({ tx, ty }) => { const g = window.__game; return { a: g.world.get(tx, ty), b: g.world.get(tx, ty - 3), glimmer: g.save.glimmer, born: g.save.born, blade: g.save.hasBlade, stage: g.story.stage }; }, before);
    console.log('persist', JSON.stringify(after));
    await shot('p0-reload');
    // death and respawn
    await evalg(() => { const g = window.__game; g.player.hp = 1; g.player.actor.inv = 0; g.player.takeHit(1, g.player.x + 30, g.player.y - 40); });
    await sleep(1500); await shot('p1-dead');
    await sleep(4500);
    console.log('respawn', JSON.stringify(await evalg(() => { const g = window.__game; return { dead: g.player.dead, hp: g.player.hp, mode: g.player.actor.mode }; })));
    await shot('p2-respawn');
  },
  async swing() {
    await sleep(2200);
    await evalg(() => { const g = window.__game; g.cam.zoomT = 2.6; g.player.sv.hasBlade = true; g.player.actor.blade = true; });
    await sleep(900);
    await evalg(() => { window.__game.slowmo(0.06, 30); });
    await sleep(300);
    await key('KeyJ', 40);
    for (let i = 0; i < 6; i++) { await sleep(220); await shot('s' + i); }
  },
  async char() {
    await sleep(2200);
    await evalg(() => { const g = window.__game; g.cam.zoomT = 2.6; g.player.sv.hasBlade = true; g.player.actor.blade = true; });
    await sleep(900); await shot('c1-idle');
    await page.keyboard.down('KeyD'); await sleep(300); await shot('c2-walk'); await sleep(500); await shot('c3-run');
    await key('Space', 220); await sleep(120); await shot('c4-jump');
    await page.keyboard.up('KeyD');
    await sleep(700);
    await key('KeyJ', 60); await sleep(70); await shot('c5-swing1'); await sleep(60); await shot('c6-swing2');
    await sleep(400);
    await evalg(() => { const p = window.__game.player.actor; p.knockdown(1.2, -600, -500); });
    await sleep(300); await shot('c7-limp'); await sleep(1400); await shot('c8-getup');
    await sleep(900); await shot('c9-stand');
  },
});
