// Extra scenarios for tools/shot.mjs
export default ({ page, sleep, key, shot, evalg }) => ({
  async birth() {
    await sleep(1500); await shot('b0-dark');
    await sleep(2200); await shot('b1-seed');
    await sleep(1600); await shot('b2-landed');
    await key('Space'); await sleep(700); await shot('b3-twitch');
    await key('Space'); await sleep(900); await shot('b4-kneel');
    await key('Space'); await sleep(1600); await shot('b5-stand');
    await sleep(2400); await shot('b6-title');
    await sleep(2200); await shot('b7-play');
    await page.keyboard.down('KeyD'); await sleep(1500); await page.keyboard.up('KeyD'); await shot('b8-walk');
    await key('KeyE'); await sleep(1200); await shot('b9-blade');
    await page.keyboard.down('KeyD'); await sleep(4000); await page.keyboard.up('KeyD'); await shot('b10-far');
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
    const gx = Number(process.env.GATE || 170);
    await evalg((gx) => { const g = window.__game; g.story.skipBirth(); g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999;
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
    await key('KeyE'); await sleep(1500); await shot('n1-talk');
    for (let i = 0; i < 4; i++) { await key('KeyE'); await sleep(500); }
    await shot('n2-opts');
    await key('Escape'); await sleep(400);
    await key('Escape'); await sleep(600); await shot('n3-menu');
    await page.click('.tab:nth-child(2)'); await sleep(900); await shot('n4-look');
    await page.click('.slots .tab:nth-child(3)'); await sleep(600); await shot('n5-heads');
    await page.click('.tab:nth-child(3)'); await sleep(400); await shot('n6-craft');
    await page.click('.tab:nth-child(4)'); await sleep(400); await shot('n7-together');
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
    await page.keyboard.down('KeyD');
    await sleep(1000);
    await evalg(() => { window.__prof = {}; });
    await sleep(3000);
    const r = await evalg(() => { const P = window.__prof, n = P.frames; const o = {}; for (const k in P) if (k !== 'frames') o[k] = +(P[k] / n).toFixed(2); o.frames = n; return o; });
    console.log('prof', JSON.stringify(r));
    await page.keyboard.up('KeyD');
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
