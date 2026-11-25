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
    // the craft step: Thread hands over timber; open the satchel and make planks
    await sleep(800); await key('KeyQ'); await sleep(700); await shot('t3-satchel');
    await evalg(() => { const rows = [...document.querySelectorAll('#bag .rec')]; const r = rows.find(r => /Planks/.test(r.textContent)); r && r.click(); });
    await sleep(200); await evalg(() => { const b = document.querySelector('#bag .craft'); b.dispatchEvent(new PointerEvent('pointerdown')); b.dispatchEvent(new PointerEvent('pointerup')); });
    await sleep(1200); await key('Escape'); await sleep(1500); await shot('t4-done');
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
  // satchel + crafting + new building parts
  async bag() {
    await page.waitForFunction(() => window.__game && window.__game.story);
    await sleep(600);
    await evalg(() => { const g = window.__game, p = g.player; g.story.skipBirth(); if (g.story.skipTutorial) g.story.skipTutorial(); g.enemies.calm = 999; g.save.hasBlade = true; p.actor.blade = true; g.story.firstFoeDown = true; g.save.tut.foe = 1; g.save.obj = 1;
      for (const [t, n] of [[5, 6], [3, 30], [8, 10], [7, 8], [17, 12], [15, 4], [2, 10]]) p.give(t, n); p.hp = 3; });
    await sleep(500);
    await key('KeyI'); await sleep(900); await shot('bag-0-open');
    const r0 = await evalg(() => ({ modal: window.__game.ui.modal, recipes: document.querySelectorAll('#bag .rec').length, items: document.querySelectorAll('#bag .bag-grid .bslot').length }));
    // craft planks (first craftable at the top), hold for a few
    await evalg(() => { const rows = [...document.querySelectorAll('#bag .rec')]; const i = rows.findIndex(r => /Planks/.test(r.textContent)); rows[i].click(); });
    await sleep(200);
    const btn = await page.$('#bag .craft');
    const bb = await btn.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await sleep(400); await shot('bag-1-crafting'); await sleep(1700); await page.mouse.up();
    await sleep(900);
    const planks = await evalg(() => window.__game.player.sv.inv[9] || 0);
    // a workbench, by hand, then place it and craft at it
    await evalg(() => { const rows = [...document.querySelectorAll('#bag .rec')]; rows.find(r => /Workbench/.test(r.textContent)).click(); });
    await sleep(150); await evalg(() => document.querySelector('#bag .craft').dispatchEvent(new PointerEvent('pointerdown'))); await sleep(1200);
    await key('KeyI'); await sleep(500);
    const placed = await evalg(() => { const g = window.__game, p = g.player, W = g.world; const tx = Math.floor(p.x / 32) + 2, ty = Math.floor(p.y / 32) - 1;
      const put = (x, y, t) => { if (W.get(x, y) === 0 && p.take(t, 1)) { W.set(x, y, t); return true; } return false; };
      const ok = put(tx, ty, 32);
      // ladder column and a platform for physics checks
      p.give(25, 6); p.give(26, 4); p.give(28, 1); p.give(31, 1); p.give('i_draught', 2); p.give('g_lamp', 1);
      return ok; });
    await sleep(300);
    await key('KeyQ'); await sleep(900); await shot('bag-2-bench');
    const near = await evalg(() => [...document.querySelectorAll('#bag .bag-stations .st.on')].map(e => e.textContent));
    // drink a draught from the satchel, wear the lamp
    await evalg(() => { const b = window.__game.ui.bag; b.sel = 'i_draught'; b.renderDetail(); document.querySelector('#bag .dacts .btn').click(); });
    await sleep(300);
    await evalg(() => { const b = window.__game.ui.bag; b.sel = 'g_lamp'; b.renderDetail(); document.querySelector('#bag .dacts .btn').click(); });
    await sleep(400); await shot('bag-3-gear');
    const after = await evalg(() => { const p = window.__game.player; return { hp: p.hp, lamp: p.sv.equip.lamp, hot: p.sv.hotbar.length }; });
    await key('Escape'); await sleep(600);
    // ladder: build a column next to the player and climb it
    const climb = await evalg(async () => { const g = window.__game, p = g.player, W = g.world, a = p.actor; const tx = Math.floor(p.x / 32) - 2, gy = Math.floor(p.y / 32);
      for (let y = gy - 1; y >= gy - 5; y--) W.set(tx, y, 25);
      W.set(tx - 1, gy - 6, 3); W.set(tx, gy - 6, 0);
      p.respawnAt(tx * 32 + 16, gy * 32); await new Promise(r => setTimeout(r, 400)); const y0 = a.c.y;
      window.__input.keys.add('KeyW'); await new Promise(r => setTimeout(r, 1600)); window.__input.keys.delete('KeyW');
      await new Promise(r => setTimeout(r, 300));
      return { rose: Math.round(y0 - a.c.y), climb: !!a.c.climb }; });
    await shot('bag-4-ladder');
    console.log('bag', JSON.stringify({ r0, planks, placed, near, after, climb }));
    if (r0.modal !== 'bag' || planks < 8 || !placed || !near.includes('Workbench') || after.hp !== 4 || after.lamp !== 'g_lamp' || climb.rose < 100) throw new Error('bag flow broken');
  },
  // a husk follows the player up ledges of 2, 3, 4 and 5 blocks
  async climb() {
    await page.waitForFunction(() => window.__game && window.__game.story);
    await sleep(600);
    const res = [];
    for (const hgt of [2, 3, 4, 5]) {
      const r = await evalg(async (hgt) => {
        const g = window.__game, W = g.world, p = g.player; g.story.skipBirth(); g.story.skipTutorial && g.story.skipTutorial(); g.enemies.calm = 999; g.story.firstFoeDown = true; g.save.tut.foe = 1;
        for (const e of g.actors) if (e.team === 'enemy') e.removed = true;
        const bx = 440 + hgt * 35, gy = 40;   // clear of the town at 278-382
        for (let x = bx - 12; x < bx + 12; x++) { for (let y = gy - 14; y < gy + 4; y++) W.set(x, y, y >= gy ? 3 : 0); }
        for (let x = bx; x < bx + 12; x++) for (let y = gy - hgt; y < gy; y++) W.set(x, y, 3);
        p.respawnAt((bx + 3) * 32 + 16, (gy - hgt) * 32); p.hp = 99; p.actor.inv = 0;
        const e = g.enemies.spawn('husk', (bx - 8) * 32, gy * 32, 0); e.ai.state = 'chase'; e.ai.cd = 99;
        const y0 = e.c.y; let best = 0;
        for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 100)); p.hp = 99; best = Math.max(best, Math.round((y0 - e.c.y) / 32)); if (e.c.x > bx * 32 + 20 && e.c.y <= (gy - hgt) * 32 + 2) return { hgt, up: true, t: i / 10 }; }
        return { hgt, up: false, rose: best, x: Math.round(e.c.x / 32) - bx };
      }, hgt);
      res.push(r);
    }
    console.log('climb', JSON.stringify(res));
    if (res.some(r => !r.up)) throw new Error('husk failed a ledge');
  },
  async mouth() {
    await page.waitForFunction(() => window.__game && window.__game.story);
    await sleep(600);
    const info = await evalg(() => { const g = window.__game, W = g.world; g.story.skipBirth(); g.story.skipTutorial && g.story.skipTutorial(); g.enemies.calm = 999; g.story.firstFoeDown = true; g.save.tut.foe = 1;
      const found = []; for (let tx = 40; tx < 600 && found.length < 4; tx++) { const h = W.surface(tx); if (W.mouthAt(tx, h + 2, h) && !found.some(f => Math.abs(f - tx) < 30)) found.push(tx); }
      const tx = found[0]; g.player.respawnAt((tx - 6) * 32, W.surface(tx - 6) * 32); return found; });
    console.log('mouths', JSON.stringify(info));
    await sleep(2500); await shot('mouth-0');
    await page.keyboard.down('KeyD'); await sleep(2500); await page.keyboard.up('KeyD'); await sleep(600); await shot('mouth-1');
  },
  // movement: walk down stairs without falling poses, mantle a 3-block wall, crawl through a 1-block gap
  async moves() {
    await page.waitForFunction(() => window.__game && window.__game.story);
    await sleep(600);
    const pr = evalg(async () => {
      const g = window.__game, W = g.world, p = g.player, a = p.actor, I = window.__input;
      g.story.skipBirth(); g.story.skipTutorial && g.story.skipTutorial(); g.enemies.calm = 999; g.story.firstFoeDown = true; g.save.tut.foe = 1;
      for (const e of g.actors) if (e.team === 'enemy') e.removed = true;
      const bx = 600, gy = 40; const wait = ms => new Promise(r => setTimeout(r, ms));
      const clear = () => { for (let x = bx - 4; x < bx + 40; x++) for (let y = gy - 12; y < gy + 6; y++) W.set(x, y, y >= gy ? 3 : 0); };
      // stairs down: 6 one-block steps
      clear(); for (let i = 0; i < 6; i++) for (let x = bx + i * 2; x < bx + 40; x++) W.set(x, gy - 6 + i, 0), W.set(x, gy - 6 + i + (x < bx + i * 2 + 2 ? 1 : 0), 3);
      for (let x = bx - 4; x < bx; x++) for (let y = gy - 6; y < gy; y++) W.set(x, y, 3);
      p.respawnAt((bx - 2) * 32 + 16, (gy - 6) * 32); await wait(300);
      let airFrames = 0; I.keys.add('KeyD');
      for (let i = 0; i < 25; i++) { await wait(60); if (a.anim && !a.c.ground) airFrames++; }
      I.keys.delete('KeyD'); await wait(200);
      // mantle: a 3-block wall
      clear(); for (let x = bx + 6; x < bx + 12; x++) for (let y = gy - 3; y < gy; y++) W.set(x, y, 3);
      p.respawnAt((bx + 2) * 32, gy * 32); await wait(400);
      let mantled = false; I.keys.add('KeyD'); I.keys.add('Space'); await wait(120); I.keys.delete('Space');
      let onTop = false;
      for (let i = 0; i < 30; i++) { await wait(60); if (a.mantle) mantled = true; if (mantled && !a.mantle) { onTop = a.c.y <= (gy - 3) * 32 + 2; break; } }
      I.keys.delete('KeyD');
      // crawl: a gap one block high
      clear(); for (let x = bx + 6; x < bx + 14; x++) W.set(x, gy - 2, 3);
      p.respawnAt((bx + 2) * 32, gy * 32); await wait(400);
      I.keys.add('KeyC'); I.keys.add('KeyD'); await wait(1400); window.__crawlShot = true; await wait(3800); I.keys.delete('KeyD');
      const through = a.c.x > (bx + 14) * 32; I.keys.delete('KeyC'); await wait(400);
      return { airFrames, mantled, onTop, through, stood: !a.crawling };
    });
    // grab frames mid-mantle and mid-crawl
    await page.waitForFunction(() => window.__game.player.actor.mantle && window.__game.player.actor.mantle.t > 0.3, null, { timeout: 15000 }).then(() => shot('moves-mantle')).catch(() => {});
    await page.waitForFunction(() => window.__crawlShot, null, { timeout: 15000 }).then(() => shot('moves-crawl')).catch(() => {});
    const r = await pr;
    console.log('moves', JSON.stringify(r));
    await shot('moves-end');
    if (r.airFrames > 4 || !r.mantled || !r.onTop || !r.through) throw new Error('movement broken');
  },
  // every weapon: craft at a bench, equip, chain, charge; parry; finisher; sling knocks a wisp down
  async weapons() {
    await page.waitForFunction(() => window.__game && window.__game.story);
    await sleep(600);
    const res = await evalg(async () => {
      const g = window.__game, p = g.player, a = p.actor, I = window.__input, W = g.world; const wait = ms => new Promise(r => setTimeout(r, ms));
      g.story.skipBirth(); g.story.skipTutorial && g.story.skipTutorial(); g.enemies.calm = 999; g.story.firstFoeDown = true; g.save.tut.foe = 1;
      for (const [t, n] of [[9, 40], [3, 60], [8, 20], [17, 20], [15, 10], [2, 30]]) p.give(t, n);
      const out = {};
      const items = await import('/js/game/items.js');
      const near = { hand: true, bench: true, forge: true, loom: true };
      for (const id of ['w_spear', 'w_hammer', 'w_daggers', 'w_sling']) { const r = items.RECIPES.find(r => r.out === id); out[id + '_craftable'] = items.canCraft(p.sv, r, near); for (const [t, n] of r.need) p.take(t, n); p.give(id, 1); }
      const arena = () => { for (const e of g.actors) if (e.team === 'enemy') e.removed = true; const x = Math.floor(p.x / 32); for (let tx = x - 12; tx < x + 12; tx++) { for (let ty = 0; ty < 60; ty++) W.set(tx, ty, ty >= 40 ? 3 : 0); } p.respawnAt(x * 32 + 16, 40 * 32); };
      for (const id of ['w_blade', 'w_spear', 'w_hammer', 'w_daggers']) {
        arena(); await wait(200);
        p.sv.equip.weapon = id; p.refreshLook();
        const e = g.enemies.spawn('husk', p.x + 70, 40 * 32, 0); e.ai.cd = 99; e.hp = e.maxHp = 400; a.face(1);
        const hp0 = e.hp; let swings = 0;
        for (let i = 0; i < 6; i++) { I.keys.add('KeyJ'); await wait(60); I.keys.delete('KeyJ'); await wait(150); }
        // a charged heavy
        I.keys.add('KeyJ'); await wait(900); I.keys.delete('KeyJ'); await wait(700);
        out[id] = { dealt: Math.round(hp0 - e.hp), staggered: !!e.staggered || e.poise < e.maxPoise };
        e.removed = true;
      }
      // parry: start a strike just as a husk's claw lands
      arena(); await wait(200); p.sv.equip.weapon = 'w_blade'; p.refreshLook();
      const h = g.enemies.spawn('husk', p.x + 40, 40 * 32, 0); p.hp = 5; a.inv = 0;
      a.startAttack('side', 0.28); a.attack.W = (await import('/js/game/weapons.js')).WEAPONS.w_blade;
      g.enemies.hitTarget(a, 1, h.c.x, h.c.y - 50, undefined, h);
      out.parry = { hp: p.hp, counter: p.counterT > 0, enemyStaggered: !!h.staggered };
      h.removed = true;
      // finisher on a staggered husk
      const f = g.enemies.spawn('husk', p.x + 60, 40 * 32, 0); g.enemies.stagger(f, 2); f.hp = f.maxHp = 200;
      p.strike(f, f.cx, f.cy, 1, -0.2, 1, 'side', {});
      out.finisher = { zoom: g.cam.zoomT, hpLeft: Math.round(f.hp) };
      f.removed = true;
      // sling vs a wisp
      p.sv.equip.weapon = 'w_sling'; p.refreshLook();
      const w = g.enemies.spawnWisp(p.x + 160, p.y - 70, 0, '#c4b5ff'); w.hp = 999;
      g.throwables.throw('shot', p.x + 20, p.y - 64, 900, -60, { dmg: 8, poise: 6, tile: 3 });
      await wait(700);
      out.sling = { stunned: (w.stunT || 0) > 0 || w.hp < 999 };
      w.removed = true;
      return out;
    });
    console.log('weapons', JSON.stringify(res));
    await shot('weapons-end');
    const bad = ['w_blade', 'w_spear', 'w_hammer', 'w_daggers'].filter(k => !(res[k].dealt > 0)).concat(res.parry.hp === 5 && res.parry.counter ? [] : ['parry']).concat(res.finisher.zoom > 1.1 ? [] : ['finisher']).concat(res.sling.stunned ? [] : ['sling']);
    if (bad.length) throw new Error('combat broken: ' + bad.join(','));
  },
  async wfilm() {
    await page.waitForFunction(() => window.__game && window.__game.story);
    await evalg(() => { const g = window.__game, p = g.player; g.story.skipBirth(); g.story.skipTutorial && g.story.skipTutorial(); g.enemies.calm = 999; g.story.firstFoeDown = true; g.save.tut.foe = 1; for (const id of ['w_spear', 'w_hammer', 'w_daggers']) p.give(id, 1); });
    await sleep(1500);
    await evalg(() => { window.__game.hitstopT = 1e9; });
    let f = 0;
    for (const wid of ['w_blade', 'w_spear', 'w_hammer', 'w_daggers']) {
      await evalg((wid) => { const g = window.__game, p = g.player; p.sv.equip.weapon = wid; p.refreshLook(); }, wid);
      for (let i = 0; i < 20; i++) {
        const keys = (i % 5 === 0 && i < 15) ? ['KeyJ'] : [];
        await page.evaluate((keys) => {
          const g = window.__game, I = window.__input;
          I.keys.clear(); for (const k of keys) I.keys.add(k);
          for (let s = 0; s < 4; s++) { I.poll(); g.step(1 / 120); I.endTick(); }
          g.updateCamera(1 / 30); g.render(0);
          const c = g.cam, sc = g.baseZoom * c.zoom, p = g.player.actor.c;
          return [(p.x - c.rx) * sc + innerWidth / 2, (p.y - c.ry) * sc + innerHeight / 2, sc];
        }, keys).then(([x, y, sc]) => page.screenshot({ path: `/tmp/otf-shots/film-${String(f++).padStart(3, '0')}.png`, clip: { x: Math.max(0, x - 70 * sc), y: Math.max(0, y - 95 * sc), width: 140 * sc, height: 120 * sc } }));
      }
    }
  },
  // filmstrip of the movement animations: crawl (flat, then up a one-block step), ladder, ledge mantle
  async cfilm() {
    await page.waitForFunction(() => window.__game && window.__game.story);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); g.story.skipTutorial && g.story.skipTutorial(); g.enemies.calm = 999; g.story.firstFoeDown = true; g.save.tut.foe = 1; for (const e of g.actors) if (e.team === 'enemy') e.removed = true; });
    await sleep(1200);
    await evalg(() => { window.__game.hitstopT = 0; });
    let f = 0;
    const setup = (k) => evalg((k) => { const g = window.__game, W = g.world, p = g.player, T = window.__T; const bx = 600, gy = 40;
      for (let x = bx - 6; x < bx + 30; x++) for (let y = gy - 14; y < gy + 6; y++) W.set(x, y, y >= gy ? T.STONE : T.AIR);
      if (k === 'crawl') { for (let x = bx + 3; x < bx + 30; x++) W.set(x, gy - 2, T.STONE); for (let x = bx + 9; x < bx + 30; x++) W.set(x, gy - 1, T.STONE), W.set(x, gy - 2, T.AIR), W.set(x, gy - 3, T.STONE); p.respawnAt((bx + 1) * 32, gy * 32); }
      if (k === 'ladder') { for (let y = gy - 6; y < gy; y++) W.set(bx + 3, y, T.LADDER); for (let x = bx + 4; x < bx + 9; x++) W.set(x, gy - 6, T.STONE); p.respawnAt((bx + 3) * 32 + 16, gy * 32); }
      if (k === 'mantle') { for (let x = bx + 5; x < bx + 12; x++) for (let y = gy - 4; y < gy; y++) W.set(x, y, T.STONE); p.respawnAt((bx + 2) * 32, gy * 32); }
      p.actor.face(1); g.cam.x = p.x; g.cam.y = p.y; }, k);
    const step = async (keys, n) => {
      const [x, y, sc] = await evalg(([keys, n]) => {
        const g = window.__game, I = window.__input;
        I.keys.clear(); for (const k of keys) I.keys.add(k);
        for (let s = 0; s < n; s++) { I.poll(); g.step(1 / 120); I.endTick(); }
        g.updateCamera(1 / 30); g.render(0);
        const c = g.cam, sc = g.baseZoom * c.zoom, p = g.player.actor.c, A = g.player.actor;
        window.__flog = (window.__flog || []); window.__flog.push([Math.round(p.x - 600 * 32), Math.round(p.y - 40 * 32), A.lastMode, A.mode, p.ground ? 'g' : 'a', Math.round(p.vx)]);
        return [(p.x - c.rx) * sc + innerWidth / 2, (p.y - c.ry) * sc + innerHeight / 2, sc];
      }, [keys, n]);
      await page.screenshot({ path: `/tmp/otf-shots/film-${String(f++).padStart(3, '0')}.png`, clip: { x: Math.max(0, x - 70 * sc), y: Math.max(0, y - 95 * sc), width: 140 * sc, height: 120 * sc } });
    };
    await setup('mantle'); await step([], 30);
    await step(['KeyD', 'Space'], 4);
    for (let i = 0; i < 30; i++) await step(['KeyD'], 1);
    await setup('crawl'); await step([], 30);
    for (let i = 0; i < 20; i++) await step(['KeyC', 'KeyD'], 14);
    await setup('ladder'); await step([], 30);
    for (let i = 0; i < 10; i++) await step(['KeyW'], 10);
    console.log('crawl log', JSON.stringify(await evalg(() => window.__flog.splice(0))));
  },
  // the ledge mantle in real time (screenshots as fast as they come)
  async mfilm() {
    await page.waitForFunction(() => window.__game && window.__game.story);
    await sleep(800);
    await evalg(() => { const g = window.__game, W = g.world, p = g.player, T = window.__T; g.story.skipBirth(); g.story.skipTutorial(); g.enemies.calm = 999; for (const e of g.actors) if (e.team === 'enemy') e.removed = true;
      const bx = 600, gy = 40; for (let x = bx - 6; x < bx + 30; x++) for (let y = gy - 14; y < gy + 6; y++) W.set(x, y, y >= gy ? T.STONE : T.AIR);
      for (let x = bx + 5; x < bx + 12; x++) for (let y = gy - 5; y < gy; y++) W.set(x, y, T.STONE); p.respawnAt((bx + 2) * 32, gy * 32); p.actor.face(1); g.cam.zoomT = 1.8; g.slowTarget = 0.2; g.slowT = 1e9; });
    await sleep(1200);
    const ok = await evalg(() => { const g = window.__game, p = g.player, a = p.actor, c = a.c; const bx = 600, gy = 40;
      c.x = (bx + 5) * 32 - c.w / 2 - 1; c.y = (gy - 5) * 32 + 70; c.vy = 0; c.ground = false; return a.tryMantle(1); });
    console.log('mantle started', ok);
    let f = 0;
    for (let i = 0; i < 30; i++) {
      const box = await evalg(() => { const g = window.__game, c = g.cam, sc = g.baseZoom * c.zoom, p = g.player.actor.c; return [(p.x - c.rx) * sc + innerWidth / 2, (p.y - c.ry) * sc + innerHeight / 2, sc, !!g.player.actor.mantle]; });
      const [x, y, sc] = box;
      await page.screenshot({ path: `/tmp/otf-shots/film-${String(f++).padStart(3, '0')}.png`, clip: { x: Math.max(0, x - 80 * sc), y: Math.max(0, y - 150 * sc), width: 160 * sc, height: 170 * sc } });
    }
    await page.keyboard.up('KeyD');
  },
  async quests() {
    await page.waitForFunction(() => window.__game && window.__game.story);
    await sleep(600);
    const r = await evalg(async () => {
      const g = window.__game, p = g.player, sv = g.save, Q = g.quests, S = g.sites; const wait = ms => new Promise(r => setTimeout(r, ms));
      g.story.skipBirth(); g.story.skipTutorial && g.story.skipTutorial(); g.enemies.calm = 999; g.story.firstFoeDown = true; sv.tut.foe = 1;
      sv.respawn = { x: p.x, y: p.y }; await wait(400);
      const out = { benchStarted: !!sv.quests.q_bench, tracked: sv.qtrack };
      Q.onCraft(9, 4); await wait(100); out.step1 = sv.quests.q_bench.step;
      Q.onCraft(32, 1); await wait(150); Q.onPlace(32); await wait(150); Q.onCraft(25, 3); await wait(150); Q.onCraft('w_spear', 1); await wait(300);
      out.benchDone = sv.quests.q_bench.done;
      // a keeper chain through dialogue
      const opts = Q.dialogOpts('smith', 'Smith'); out.smithOffer = opts.map(o => o.label);
      opts[0].act(); out.smithStarted = !!sv.quests.q_smith;
      out.daily = sv.daily && sv.daily.list.map(d => d.text);
      out.trackedText = Q.trackedText();
      // sites: find and solve a brazier puzzle
      const bx = g.content.sites('brazier', 20, 600)[0]; out.brazierAt = bx;
      p.respawnAt(bx * 32 + 16, g.world.surface(bx) * 32); await wait(900);
      const site = S.list.get('brazier' + bx);
      for (const b of site.items) S.light(site, b);
      await wait(200); out.brazierSolved = site.solved; S.openChest(site); out.chestOpened = site.chest.open;
      // a camp: spawn, clear, chest
      const cx = g.content.sites('camp', 130, 900)[0]; out.campAt = cx;
      g.enemies.calm = 0;
      p.respawnAt(cx * 32 + 16 - 400, g.world.surface(cx - 12) * 32); await wait(1200);
      const camp = S.list.get('camp' + cx); out.campSpawned = camp && camp.spawned; out.elite = camp && camp.elite && camp.elite.eliteName;
      if (camp) for (const u of camp.units) g.enemies.kill(u, { x: u.cx, y: u.cy, dx: 1, dy: -0.5 });
      await wait(300); out.campCleared = camp && camp.solved;
      out.counters = sv.counters;
      return out;
    });
    console.log('quests', JSON.stringify(r));
    await page.keyboard.press('Escape'); await sleep(300);
    await evalg(() => window.__game.ui.openMenu('quests')); await sleep(600); await shot('quests-log');
    await evalg(() => window.__game.ui.closeMenu()); await sleep(300); await shot('quests-hud');
    if (!r.benchStarted || !r.benchDone || !r.smithStarted || !r.brazierSolved || !r.chestOpened || !r.campCleared) throw new Error('quests broken');
  },
  // the top layer is always turf: no soil open to the sky near the surface; uncovered soil turns
  async turf() {
    await sleep(900);
    const r = await evalg(() => { const g = window.__game, W = g.world, T = window.__T; g.story.skipBirth(); g.story.skipTutorial(); g.enemies.calm = 999;
      let exposed = 0, checked = 0;
      for (let tx = -150; tx < 400; tx++) { const h = W.surface(tx); for (let ty = h - 6; ty < h + 6; ty++) { if (W.get(tx, ty) !== T.DIRT) continue; checked++;
        const open = (a, b) => W.get(a, b) === T.AIR && !W.wall(a, b);
        if (open(tx, ty - 1) || open(tx - 1, ty) || open(tx + 1, ty)) exposed++; } }
      // dig the turf off a column: the soil under it greens a moment later
      const x = 60, h = W.surface(x); W.set(x, h, T.AIR); W.set(x - 1, h, T.AIR); W.set(x + 1, h, T.AIR);
      return { exposed, checked, x, h, below: W.get(x, h + 1) }; });
    await sleep(2200);
    const after = await evalg((r) => { const W = window.__game.world; return W.get(r.x, r.h + 1); }, r);
    console.log('turf', JSON.stringify({ ...r, belowAfter: after }));
    await evalg(() => { const g = window.__game; g.player.respawnAt(60 * 32, g.world.surface(58) * 32); g.cam.zoomT = 1.4; });
    await sleep(1200); await shot('turf-0');
  },
  // starting a new life wipes every block ever placed or broken
  async wipe() {
    await sleep(900);
    const a = await evalg(() => { const g = window.__game, W = g.world, T = window.__T; g.story.skipBirth(); g.story.skipTutorial();
      const x = 30, h = W.surface(x); W.set(x, h - 1, T.BRICK); W.set(x, h - 2, T.BRICK); W.set(x + 3, h, T.AIR); g.saveNow(); return { x, h, edits: W.edits.size }; });
    await evalg(() => { const S = window.__game.ui; const g = window.__game; import('./js/game/progress.js').then(m => { m.Save.wipe(g.world); location.reload(); }); });
    await page.waitForFunction(() => window.__game && window.__game.world && window.__game.story, { timeout: 15000 }).catch(() => {});
    await sleep(2500);
    const b = await evalg((a) => { const W = window.__game.world, T = window.__T; return { brick: W.get(a.x, a.h - 1) === T.BRICK, hole: W.get(a.x + 3, a.h) === T.AIR, edits: W.edits.size, born: !!window.__game.save.born }; }, a);
    console.log('wipe', JSON.stringify({ before: a, after: b }));
  },
  // spam-tapping through the wake-up: Thread's line matches the moment (no lag)
  async wake() {
    await page.waitForFunction(() => window.__game && window.__game.story && window.__game.story.stage === 2, { timeout: 40000 });
    const lines = [];
    for (let i = 0; i < 6; i++) { await key('Space', 40); await sleep(120); }
    for (let i = 0; i < 12; i++) { lines.push(await evalg(() => { const th = window.__game.story.thread; return th.line ? th.line.text : '-'; })); await sleep(250); }
    console.log('wake', JSON.stringify(lines.filter((l, i) => l !== lines[i - 1])));
  },
  // a Hollow surge: the rift opens, waves pour out, clearing them leaves a chest
  async surge() {
    await sleep(900);
    await evalg(() => { const g = window.__game, W = g.world, p = g.player; g.story.skipBirth(); g.story.skipTutorial(); g.story.firstFoeDown = true; g.save.tut.foe = 1; g.enemies.calm = 999;
      p.respawnAt(80 * 32, W.surface(80) * 32); g.surges.next = 0.2; p.hp = 99; });
    await sleep(1800); await shot('surge-0-warn');
    await sleep(2200); await shot('surge-1-wave');
    const st = [];
    for (let i = 0; i < 40; i++) {
      const r = await evalg(() => { const g = window.__game, S = g.surges, p = g.player; p.hp = 99;
        if (!S.s) return null;
        for (const e of S.s.alive) if (e.mode !== 'dead' && e.hurt) { p.strike(e, e.c.x, e.c.y - 40, 1, -0.2, 3, 'side', {}); }
        return [S.s.state, S.s.wave, S.s.waves, S.s.alive.length, S.s.queue.length]; });
      st.push(r); if (!r) break; await sleep(400);
    }
    const end = await evalg(() => { const g = window.__game; return { chests: g.surges.chests.length, level: g.save.level, xp: Math.round(g.save.xp), combo: g.player.combo && g.player.combo.best, kills: g.save.stats.kills }; });
    console.log('surge', JSON.stringify({ trace: st.filter((x, i) => i % 4 === 0 || !x), end }));
    await sleep(600); await shot('surge-2-clear');
  },
  // levels: XP to a level-up, a perk pick from the Character tab
  async levels() {
    await sleep(900);
    const r = await evalg(async () => { const g = window.__game, L = g.levels, sv = g.save; const wait = ms => new Promise(r => setTimeout(r, ms));
      g.story.skipBirth(); g.story.skipTutorial(); g.enemies.calm = 999; await wait(300);
      const before = { level: sv.level, maxHp: sv.maxHp };
      for (let i = 0; i < 6; i++) { L.gain(L.need(sv.level) + 1, g.player.x, g.player.y - 100); await wait(150); }
      const mid = { level: sv.level, picks: sv.perkPicks, maxHp: sv.maxHp, dmg: +L.dmgMult().toFixed(2), zone: L.zoneLevel(900 * 32) };
      return { before, mid }; });
    console.log('levels', JSON.stringify(r));
    await sleep(800); await shot('lv-0-card');
    await evalg(() => window.__game.ui.openMenu('character')); await sleep(900); await shot('lv-1-tab');
    await page.click('.perk-card'); await sleep(900);
    const after = await evalg(() => ({ perks: window.__game.save.perks, picks: window.__game.save.perkPicks }));
    console.log('levels after', JSON.stringify(after)); await shot('lv-2-picked');
  },
  // Rift Trials: enter, clear waves, take a boon, fall, results, again, leave; home is untouched
  async rift() {
    await sleep(900);
    const home = await evalg(() => { const g = window.__game, W = g.world, T = window.__T; g.story.skipBirth(); g.story.skipTutorial(); g.enemies.calm = 999;
      const x = 40, h = W.surface(x); W.set(x, h - 1, T.BRICK); g.saveNow(); return { seed: W.seed, x, h, px: Math.round(g.player.x) }; });
    await evalg(() => window.__game.rift.enter());
    await sleep(3500); await shot('rift-0-wave');
    const log = [];
    for (let i = 0; i < 60; i++) {
      const r = await evalg(() => { const g = window.__game, R = g.rift, p = g.player; if (!R.r) return null; p.hp = Math.max(p.hp, 3);
        for (const e of R.r.alive) if (e.mode !== 'dead') p.strike(e, e.c.x, e.c.y - 40, 1, -0.2, 6, 'side', {});
        return [R.r.wave, R.r.alive.length, R.r.queue.length, g.ui.modal, Math.round(R.r.breather)]; });
      log.push(r);
      if (r && r[3] === 'boon') { await shot('rift-1-boon'); await page.click('#rift-boons .perk-card'); }
      if (r && r[0] >= 4) break;
      await sleep(300);
    }
    await evalg(() => { const p = window.__game.player; p.hp = 0; p.die(); });
    await sleep(2600); await shot('rift-2-results');
    const res = await evalg(() => ({ shown: document.querySelector('#rift-res').classList.contains('on'), best: window.__game.save.rift.best }));
    await page.click('#rift-res .again'); await sleep(1500);
    const again = await evalg(() => ({ wave: window.__game.rift.r.wave, alive: !window.__game.player.dead }));
    await evalg(() => window.__game.rift.leave()); await sleep(1500);
    const back = await evalg((h) => { const g = window.__game, W = g.world, T = window.__T; return { seed: W.seed === h.seed, brick: W.get(h.x, h.h - 1) === T.BRICK, active: g.rift.active }; }, home);
    console.log('rift', JSON.stringify({ log: log.filter((x, i) => i % 5 === 0), res, again, back }));
    await shot('rift-3-home');
  },
  // the guide: a ladder lesson shows, climbing completes it; a winding Hollow brings the parry hint; tips
  async guide() {
    await sleep(900);
    await evalg(() => { const g = window.__game, W = g.world, p = g.player, T = window.__T; g.story.skipBirth(); g.story.skipTutorial(); g.enemies.calm = 999; g.surges.next = 999;
      const x = 70, h = W.surface(x); for (let y = h - 5; y < h; y++) W.set(x, y, T.LADDER); p.respawnAt(x * 32 + 16, h * 32); g.guide.cool = 0; });
    await sleep(1500);
    const a = await evalg(() => { const g = window.__game; return { cur: g.guide.cur && g.guide.cur.id, chip: document.querySelector('#guidechip') && document.querySelector('#guidechip').className, text: document.querySelector('#guidechip') && document.querySelector('#guidechip').textContent }; });
    await shot('guide-0-ladder');
    await page.keyboard.down('KeyW'); await sleep(700); await page.keyboard.up('KeyW'); await sleep(400);
    const b = await evalg(() => { const g = window.__game; return { ladderOk: g.save.guide.ladder && g.save.guide.ladder.ok, cur: g.guide.cur && g.guide.cur.id }; });
    // a husk winding up right next to us
    await evalg(() => { const g = window.__game, p = g.player; window.__hk = g.enemies.spawn('husk', p.x + 90, p.y, 0, '#ffb36b'); g.guide.cool = 0; g.guide.cur = null; });
    for (let i = 0; i < 12; i++) { await evalg(() => { const e = window.__hk; e.ai.state = 'windup'; e.ai.t = 0.2; e.face(-1); }); await sleep(100); }
    const c = await evalg(() => { const g = window.__game; return { cur: g.guide.cur && g.guide.cur.id, line: g.story.thread.line && g.story.thread.line.text }; });
    await shot('guide-1-parry');
    console.log('guide', JSON.stringify({ a, b, c }));
  },
  // a town: arrive, look around, trade, rest, take a bounty, temper the blade, travel by waystone
  async town() {
    await sleep(900);
    await evalg(() => { const g = window.__game, W = g.world, p = g.player; g.story.skipBirth(); g.story.skipTutorial(); g.enemies.calm = 999; g.surges.next = 999;
      p.respawnAt(-110 * 32, W.surface(-110) * 32); g.save.glimmer = 500; p.give(17, 10); p.give(8, 10); });
    await sleep(2500); await shot('town-0-first');
    await evalg(() => { const g = window.__game, W = g.world, p = g.player; p.respawnAt(326 * 32, W.surface(326) * 32); g.cam.zoomT = 0.8; });
    await sleep(2800); await shot('town-1-wide');
    const r = await evalg(async () => { const g = window.__game, T = g.towns, sv = g.save, wait = ms => new Promise(r => setTimeout(r, ms));
      const tn = T.townAt(g.player.x);
      const its = T.interactables().map(i => i.verb);
      T.store(tn); await wait(300); const shopOpen = !!g.ui.modal; g.ui.closeDialog && g.ui.closeDialog(); g.ui.modal = null; document.querySelector('#shop') && document.querySelector('#shop').classList.add('hidden');
      T.inn(tn); const rested = g.player.wellRested > 0;
      T.board(tn); await wait(1600); const opts = [...document.querySelectorAll('#dialog .opts button')].map(b => b.textContent);
      document.querySelector('#dialog .opts button') && document.querySelector('#dialog .opts button').click(); await wait(300);
      const bounty = sv.bounty && sv.bounty.kind;
      g.ui.closeDialog && g.ui.closeDialog();
      T.smith(tn); await wait(1600); const sOpts = [...document.querySelectorAll('#dialog .opts button')].map(b => b.textContent);
      document.querySelector('#dialog .opts button') && document.querySelector('#dialog .opts button').click(); await wait(300);
      const wl = sv.wlvl; g.ui.closeDialog && g.ui.closeDialog();
      const visited = Object.keys(sv.towns || {});
      return { name: tn && T.name(tn.bi), its, shopOpen, rested, opts, bounty, sOpts, wl, visited, folk: [...T.folk.values()].map(l => l.length) };
    });
    console.log('town', JSON.stringify(r));
    await evalg(() => { const g = window.__game; g.towns.waystone(g.towns.townAt(g.player.x)); }); await sleep(500); await shot('town-2-waystone');
    await evalg(() => { const b = [...document.querySelectorAll('#dialog .opts button')].find(b => /Travel/.test(b.textContent)); b && b.click(); }); await sleep(1500);
    const where = await evalg(() => Math.round(window.__game.player.x / 32));
    console.log('travelled to', where);
    await evalg(() => { const g = window.__game, p = g.player; g.cam.zoomT = 1.2; }); await sleep(1500); await shot('town-3-street');
  },
  // close look at the Hollows (grit, wraps, plates, chains, tatters)
  async foes() {
    await sleep(900);
    await evalg(() => { const g = window.__game, W = g.world, p = g.player; g.story.skipBirth(); g.story.skipTutorial(); g.enemies.calm = 999; g.surges.next = 999;
      p.respawnAt(80 * 32, W.surface(80) * 32); const y = W.surface(84) * 32;
      for (const [k, dx] of [['husk', 120], ['brute', 210], ['lancer', 300], ['slinger', 380]]) { const e = g.enemies.spawn(k, p.x + dx, W.surface(Math.floor((p.x + dx) / 32)) * 32, 0, '#ffb36b'); e.ai.state = 'idle'; e.ai.t = 99; e.face(-1); }
      g.cam.zoomT = 2.1; g.cam.x = p.x + 230; });
    await sleep(2500); await shot('foes-0');
  },
  async looks() {
    await sleep(900);
    await evalg(() => { const g = window.__game, W = g.world, p = g.player; g.story.skipBirth(); g.enemies.calm = 999; g.save.tutDone = 1; g.story.tutI = 9; g.cam.zoomT = 1.3; p.respawnAt(7 * 32, W.surface(7) * 32); });
    await sleep(2200); await shot('look-0-sword');
    // a cave with ore
    await evalg(() => { const g = window.__game, W = g.world, p = g.player, T = window.__T;
      for (let tx = 60; tx < 400; tx++) { const h = W.surface(tx); for (let ty = h + 8; ty < h + 40; ty++) { if (W.get(tx, ty) === T.CRYSTAL && !W.solid(tx + 2, ty - 1) && W.solid(tx + 2, ty)) { p.respawnAt((tx + 2) * 32 + 16, ty * 32); return; } } } });
    await sleep(2500); await shot('look-1-cave');
    // Thread on the move: run, then stop
    await evalg(() => { const g = window.__game, W = g.world, p = g.player; p.respawnAt(70 * 32, W.surface(70) * 32); g.cam.zoomT = 1.5; });
    await sleep(800); await page.keyboard.down('KeyD'); await sleep(1300); await shot('look-2-thread'); await page.keyboard.up('KeyD');
  },
  async fell() {
    await sleep(900);
    const info = await evalg(() => { const g = window.__game, W = g.world, p = g.player; g.story.skipBirth(); g.story.skipTutorial(); g.enemies.calm = 999; g.story.firstFoeDown = true; g.save.tut.foe = 1;
      let tx = 40; while (!g.wr.treeSprite(tx) && tx < 400) tx++;
      p.respawnAt((tx - 1) * 32 + 4, W.surface(tx - 1) * 32); p.actor.face(1); g.cam.zoomT = 1.5;
      return { tx, logs0: p.sv.inv[window.__T.LOG] || 0 }; });
    console.log('tree', JSON.stringify(info));
    await sleep(1500); await shot('fell-0');
    for (let i = 0; i < 3; i++) { await key('KeyJ', 60); await sleep(520); }
    await sleep(250); await shot('fell-1');
    await sleep(700); await shot('fell-2');
    const r = await evalg((tx) => { const g = window.__game; return { logs: g.player.sv.inv[window.__T.LOG] || 0, standing: !!g.wr.treeSprite(tx), falling: g.trees.falling.length }; }, info.tx);
    console.log('fell', JSON.stringify(r));
  },
  async artcheck() {
    await sleep(900);
    await evalg(() => { const g = window.__game, W = g.world, p = g.player; g.story.skipBirth(); g.story.skipTutorial(); g.enemies.calm = 999; g.story.firstFoeDown = true; g.save.tut.foe = 1;
      const x0 = 60; p.respawnAt(x0 * 32, W.surface(x0) * 32);
      const ids = [25, 26, 27, 28];
      const T = { STORE: 0, BENCH: 0 };
      [['STORE'], ['BENCH'], ['FORGE'], ['LOOM']].forEach(([k], i) => { const tx = x0 + 2 + i * 2, ty = W.surface(tx) - 1; W.set(tx, ty, window.__T[k]); });
      for (const id of ['i_draught', 'i_flare', 'i_charge', 'g_lamp', 'g_pick_gilt', 'g_charm_thread', 'g_charm_ember', 'w_spear']) p.give(id, 2);
      p.give(window.__T.LADDER, 4); p.give(window.__T.DOOR, 2); g.ui.hotbarDirty = true; g.cam.zoomT = 1.6; });
    await sleep(1800); await shot('art-0-stations');
    const nest = await evalg(() => { const g = window.__game, C = g.content; for (let x = 140; x < 900; x++) { const s = C.sites('nest', x, x + 1); if (s.length) { g.player.respawnAt((s[0] - 5) * 32, g.world.surface(s[0] - 5) * 32); return s[0]; } } return null; });
    console.log('nest', nest);
    await sleep(2200); await shot('art-1-nest');
  },
  async uitour() {
    await sleep(900);
    await evalg(() => { window.__game.story.skipBirth(); window.__game.enemies.calm = 999; });
    await sleep(1400); await shot('ui-0-tut');
    await evalg(() => { const g = window.__game; g.save.tutDone = 1; g.save.hasBlade = true; g.player.actor.blade = true; g.player.give(5, 6); g.player.give(12, 12); g.player.give(3, 20); g.player.give(17, 4); g.save.glimmer = 40; });
    for (const t of ['journey', 'look', 'quests', 'settings']) { await evalg((t) => window.__game.ui.openMenu(t), t); await sleep(900); await shot('ui-m-' + t); }
    await evalg(() => window.__game.ui.closeMenu()); await sleep(400);
    await evalg(() => window.__game.ui.bag.open({ page: 'items' })); await sleep(900); await shot('ui-bag-items');
    await evalg(() => { const g = window.__game, b = g.ui.bag; g.player.give('w_spear', 1); b.sel = 'w_spear'; b.render(); }); await sleep(700); await shot('ui-bag-craft');
    await evalg(() => { const b = window.__game.ui.bag, rows = [...document.querySelectorAll('#bag .rec')]; const i = rows.findIndex(r => /Planks/.test(r.textContent)); b.rsel = Math.max(0, i); b.renderRecipes(); const c = document.querySelector('#bag .craft'); c.dispatchEvent(new PointerEvent('pointerdown')); c.dispatchEvent(new PointerEvent('pointerup')); });
    await sleep(640); await shot('ui-bag-made');
  },
  async opening() {
    const t0 = Date.now();
    await sleep(1200); await shot('op-0-black');
    await page.waitForFunction(() => window.__game.story.shot === 1, { timeout: 30000 });
    console.log('vista ready after ms', Date.now() - t0);
    await sleep(2200); await shot('op-1-vista');
    for (let i = 0; i < 5; i++) {
      await page.waitForFunction((i) => window.__game.story.shot === 2 && window.__game.story.wi === i, i, { timeout: 30000 });
      await sleep(700); await shot('op-2-warden' + i);
    }
    await page.waitForFunction(() => window.__game.story.stage >= 0, { timeout: 30000 });
    console.log('prologue ms', Date.now() - t0);
    await sleep(900); await shot('op-3-fall');
  },
  async doll() {
    await page.waitForFunction(() => window.__game && window.__game.story);
    await sleep(600);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); g.story.skipTutorial && g.story.skipTutorial(); g.enemies.calm = 999; g.story.firstFoeDown = true; g.save.tut.foe = 1; });
    await sleep(800);
    const x = await evalg(() => { const g = window.__game, c = g.content; const xs = c.sites('doll', 20, 300).filter(x => !c.caveSpot || true); const x = xs[0]; g.player.respawnAt(x * 32 + 16 - 90, g.world.surface(x) * 32); return x; });
    await sleep(2500); await shot('doll-0-sleep');
    await evalg((x) => window.__game.content.wakeDoll(x), x); await sleep(900); await shot('doll-1-sit');
    await sleep(1100); await shot('doll-2-rise'); await sleep(1400); await shot('doll-3-stretch'); await sleep(1200); await shot('doll-4-wave');
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
    await evalg(() => window.__game.ui.openMenu('look')); await sleep(900); await shot('n4-look');
    await page.click('#menu .slots .chip:nth-child(3)'); await sleep(600); await shot('n5-heads');
    await evalg(() => window.__game.ui.openMenu('craft')); await sleep(400); await shot('n6-craft');
    await evalg(() => window.__game.ui.openMenu('journal')); await sleep(400); await shot('n7-journal');
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
  // one Strike, three jobs: mine the block you face, place the block in hand into open space, strike a foe
  async contextual() {
    await sleep(1200);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); if (g.story.skipTutorial) g.story.skipTutorial(); g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999; });
    await sleep(2500);
    const w = await evalg(() => { const g = window.__game, a = g.player.actor; a.face(1); for (const e of g.actors) if (e.team === 'enemy') e.removed = true;
      const tx = Math.floor((a.c.x + 30) / 32), ty = Math.floor((a.c.y - 20) / 32), id = g.world.get(tx, ty + 1) || 3;
      g.world.set(tx, ty, id); g.world.set(tx, ty - 1, id); return { tx, ty, id }; });
    await sleep(300);
    const m0 = await evalg(() => window.__game.player.strikeAs);
    await page.keyboard.down('KeyJ'); await sleep(2600); await shot('ctx-0-mine'); await page.keyboard.up('KeyJ'); await sleep(200);
    const m1 = await evalg((w) => window.__game.world.get(w.tx, w.ty), w);
    console.log('mine', JSON.stringify({ mode: m0, before: w.id, after: m1 }));
    await evalg((w) => { const g = window.__game; g.world.set(w.tx, w.ty, 0); g.world.set(w.tx, w.ty - 1, 0); for (const e of g.actors) if (e.team === 'enemy') e.removed = true; g.player.give(18, 3); g.save.sel = g.save.hotbar.indexOf(18); }, w);
    await sleep(300);
    const p0 = await evalg(() => { const p = window.__game.player; return { mode: p.strikeAs, placed: window.__game.save.stats.placed, cur: p.cursor, sel: p.save ? 0 : p.sv.sel, hb: p.sv.hotbar, fight: p.fightNear, foe: p.foeNear }; });
    await key('KeyJ'); await sleep(400); await shot('ctx-1-place');
    const p1 = await evalg((w) => ({ placed: window.__game.save.stats.placed, tile: window.__game.world.get(w.tx, w.ty) }), w);
    console.log('place', JSON.stringify({ p0, p1 }));
    const f0 = await evalg(() => { const g = window.__game, p = g.player; g.enemies.calm = 0; const e = g.enemies.spawn('husk', p.x - 60, p.actor.c.y, 0); e.ai.cd = 99; p.actor.face(-1); return true; });
    await sleep(300);
    const f1 = await evalg(() => window.__game.player.strikeAs);
    await key('KeyJ'); await sleep(120);
    const f2 = await evalg(() => { const a = window.__game.player.actor; return a.attack ? a.attack.kind : null; });
    console.log('fight', JSON.stringify({ mode: f1, attack: f2 }));
    if (m0 !== 'mine' || m1 === w.id || p0.mode !== 'place' || p1.placed <= p0.placed || f1 !== null || !f2 || f2 === 'mine') console.log('PROBLEMS: contextual strike', JSON.stringify({ m0, m1, p0, p1, f1, f2 }));
  },
  // the lunge-stab: a foe just out of reach, the doll drops and drives the blade out straight
  async lunge() {
    await sleep(1200);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); if (g.story.skipTutorial) g.story.skipTutorial(); g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999; });
    await sleep(2500);
    const r = await evalg(() => { const g = window.__game, p = g.player, a = p.actor; for (const e of g.actors) if (e.team === 'enemy') e.removed = true;
      a.face(1); const e = g.enemies.spawn('husk', a.c.x + 120, a.c.y, 0); e.ai.cd = 99; e.hp = e.maxHp = 400; window.__lx = a.c.x;
      window.__R = Math.random; Math.random = () => 0.05; return true; });
    await page.keyboard.down('KeyJ'); await sleep(30); await page.keyboard.up('KeyJ'); await sleep(20);
    const k = await evalg(() => { Math.random = window.__R; const a = window.__game.player.actor; return a.attack && a.attack.kind; });
    const rr = k;
    console.log('lunge kind', rr);
    for (let i = 0; i < 8; i++) { await sleep(45); await shot('film-' + i); }
    const d = await evalg(() => ({ moved: Math.round(window.__game.player.actor.c.x - window.__lx), hits: 400 - (window.__game.actors.find(a => a.team === 'enemy' && !a.removed) || { hp: 400 }).hp }));
    console.log('lunge', JSON.stringify(d));
    if (rr !== 'lungestab' || d.moved < 45) console.log('PROBLEMS: lunge', JSON.stringify({ rr, d }));
  },
  // guidance: the Threads of Light card appears when that goal begins, the compass strip shows points, the
  // Guide tab keeps the card
  async cards() {
    await sleep(1200);
    await evalg(() => { const g = window.__game; g.story.skipBirth(); if (g.story.skipTutorial) g.story.skipTutorial(); g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999;
      g.story.firstFoeDown = true; g.save.met = { 105: 1 }; g.save.respawn = { x: g.player.x, y: g.player.y }; });
    await sleep(2500);
    const c0 = await evalg(() => ({ modal: window.__game.ui.modal, card: document.querySelector('.tcard .tt') && document.querySelector('.tcard .tt').textContent, obj: document.querySelector('#objective .ob-text') && document.querySelector('#objective .ob-text').textContent }));
    console.log('card', JSON.stringify(c0));
    await shot('cards-0-lights');
    await page.keyboard.press('Enter'); await sleep(600);
    const c1 = await evalg(() => ({ modal: window.__game.ui.modal, card: document.querySelector('.tcard .tt') && document.querySelector('.tcard .tt').textContent }));
    console.log('card2', JSON.stringify(c1));
    await page.keyboard.press('Enter'); await sleep(900);
    const comp = await evalg(() => [...document.querySelectorAll('#compass .cs-poi')].map(e => e.className + ':' + e.textContent));
    console.log('compass', JSON.stringify(comp));
    await shot('cards-1-compass');
    await evalg(() => window.__game.ui.openMenu('guide')); await sleep(500);
    const items = await evalg(() => document.querySelectorAll('.guide-item').length);
    console.log('guide items', items);
    await shot('cards-2-guide');
    if (c0.card !== 'Threads of Light' || c1.card !== 'Always a way forward' || !comp.length || items < 2) console.log('PROBLEMS: cards', JSON.stringify({ c0, c1, comp, items }));
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
