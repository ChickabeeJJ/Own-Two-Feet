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
        const bx = 300 + hgt * 40, gy = 40;
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
    for (const wid of ['w_spear', 'w_hammer', 'w_daggers']) {
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
