// Playthrough bot: plays the real game from the opening fall like a person would (keyboard + mouse only,
// reading the screen state the player sees: tutorial step, objective, Thread's target, prompts, dialogs),
// and reports a timeline plus anything that looks wrong: stuck spots, soft-locks, errors, NaN, falling
// out of the world, dialogs that never close.
// Usage: node tools/play.mjs [seconds=240] [--mobile]
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SECS = +process.argv[2] || 240;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const W = 960, H = 540;
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const issues = [], timeline = [];
const t0 = Date.now();
const T = () => ((Date.now() - t0) / 1000).toFixed(1);
const issue = (m) => { if (!issues.some(i => i.m === m)) { issues.push({ t: T(), m }); console.log('ISSUE', T(), m); } };
page.on('pageerror', e => issue('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) issue('console: ' + m.text()); });
await page.route(/crazygames-sdk/, r => r.abort());
await page.addInitScript({ path: path.join(root, 'tools/cg-mock.js') });
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => window.__game && window.__game.story);
const sleep = ms => page.waitForTimeout(ms);
fs.mkdirSync('/tmp/otf-shots', { recursive: true });

// ------------------------------------------------------------------ what the player can see
const look = () => page.evaluate(() => {
  const g = window.__game, s = g.story, p = g.player, a = p.actor, c = g.cam, sc = g.baseZoom * c.zoom;
  const scr = (x, y) => [(x - c.rx) * sc + innerWidth / 2, (y - c.ry) * sc + innerHeight / 2];
  const tut = s.tutI !== undefined && !s.sv.tutDone && s.stage >= 5 ? (s.TUT || [])[s.tutI] : null;
  const foes = g.targets().filter(e => e.mode !== 'dead' && !e.removed).map(e => ({ x: e.c.x, y: e.c.y, kind: e.kind }));
  if (s.dummy && !s.dummy.removed) foes.push({ x: s.dummy.c.x, y: s.dummy.c.y, kind: 'dummy' });
  const tg = s.thread && s.thread.target;
  const surf = (x) => g.world.surface(Math.floor(x / 32)) * 32;
  const opts = [...document.querySelectorAll('#dialog .opt')].map(b => b.textContent);
  return {
    stage: s.stage, born: s.sv.born, tut: s.tutStep ? s.tutStep() : null, tutI: s.tutI, tutDone: !!s.sv.tutDone, obj: s.sv.obj,
    goal: document.querySelector('#objective .ob-text')?.textContent || '', press: (() => { const e = document.querySelector('#press'); return e && !e.classList.contains('hidden') ? e.textContent : ''; })(),
    x: a.c.x, y: a.c.y, vx: a.c.vx, ground: a.c.ground, hp: p.hp, dead: p.dead, mode: a.mode, cin: !!g.cinematic,
    modal: g.ui.modal, opts, interact: p.interact ? p.interact.label : null, foes, target: tg ? { x: tg.x, y: tg.y } : null,
    blade: !!s.sv.hasBlade, lights: s.sv.lights || 0, met: Object.keys(s.sv.met).length, respawn: !!s.sv.respawn,
    blocks: s.sv.stats.blocks, placed: s.sv.stats.placed, inv: Object.keys(s.sv.inv).length, nan: !isFinite(a.c.x + a.c.y),
    surfY: surf(a.c.x), scr: scr(a.c.x, a.c.y), sc, facing: a.facing, paused: g.paused,
  };
});
const worldToScreen = (st, x, y) => [(x - st.x) * st.sc + st.scr[0], (y - st.y) * st.sc + st.scr[1]];

// ------------------------------------------------------------------ hands
const held = new Set();
const hold = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } else if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
const tap = async (k, ms = 60) => { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); };
const releaseAll = async () => { for (const k of [...held]) await hold(k, false); };
const walkTo = async (st, x, near = 24) => {
  const dx = x - st.x;
  await hold('KeyD', dx > near); await hold('KeyA', dx < -near);
  return Math.abs(dx) <= near;
};

async function unstickCheck(st, now) {
  // stuck: holding a direction but not moving -> jump, then dig through
  if (held.has('KeyD') || held.has('KeyA')) {
    if (Math.abs(st.x - lastProg.x) > 40) { lastProg = { x: st.x, t: now }; unstick = 0; }
    else if (now - lastProg.t > 1500) {
      unstick++;
      if (unstick < 3) { await tap('Space', 260); await sleep(120); await tap('Space', 260); }
      else if (unstick < 6) {
        // pillar up like a person: jump, and place a block where your feet were
        const feet = worldToScreen(st, st.x, st.y + 16);
        await page.keyboard.down('Space'); await sleep(230);
        await page.mouse.move(feet[0], feet[1]); await page.mouse.down({ button: 'right' }); await sleep(60); await page.mouse.up({ button: 'right' });
        await page.keyboard.up('Space'); await sleep(400);
      }
      else {
        const dir = held.has('KeyD') ? 1 : -1;
        const [sx, sy] = worldToScreen(st, (Math.floor(st.x / 32) + dir) * 32 + 16, (Math.floor(st.y / 32) - 1) * 32 + 16);
        await page.mouse.move(sx, sy); await page.mouse.down(); await sleep(1200); await page.mouse.up();
        if (unstick === 7) { issue(`walls the player in at tile ${Math.round(st.x / 32)} (needed to dig)`); await page.screenshot({ path: `/tmp/otf-shots/play-stuck-${shots++}.png` }); }
        if (unstick === 10) {
          // a person gives up and uses the menu's way out
          await releaseAll(); await page.keyboard.press('Escape'); await sleep(400);
          const ok = await page.evaluate(() => { const b = [...document.querySelectorAll('#menu .big-btn')].find(b => /Return to the shrine/.test(b.textContent)); if (b) { b.click(); return true; } return false; });
          console.log('UNSTUCK via menu', ok); unstick = 0; await sleep(2500);
        }
      }
      lastProg.t = now;
    }
  }
}
// ------------------------------------------------------------------ brain
let last = null, stuckT = 0, lastProg = { x: 0, t: Date.now() }, phase = '', phaseT = Date.now(), mineI = 0, unstick = 0;
const setPhase = async (p) => { if (p !== phase) { timeline.push(`${T()}s ${p}`); console.log('PHASE', T(), p); phase = p; phaseT = Date.now(); await releaseAll(); } };
let lastInteract = null, placeDbg = 0, shots = 0, lastLog = 0, now0 = 0;
while ((Date.now() - t0) / 1000 < SECS) {
  let st;
  try { st = await look(); } catch (e) { issue('look failed: ' + e.message); break; }
  if (st.nan) issue('player position is NaN');
  if ((now0 = Date.now()) - lastLog > 10000) { lastLog = now0; console.log('STATE', T(), JSON.stringify({ tile: Math.round(st.x / 32), stage: st.stage, tut: st.tut, goal: st.goal, hp: st.hp, modal: st.modal, paused: st.paused, interact: st.interact, target: st.target && Math.round(st.target.x / 32), lights: st.lights, foes: st.foes.map(f => f.kind + '@' + Math.round(f.x / 32)).join(' ') })); }
  if (st.y > st.surfY + 32 * 60) issue(`fell far below the surface at x=${Math.round(st.x / 32)}`);
  const now = Date.now();
  // a phase that takes far too long is a soft-lock candidate
  if (now - phaseT > 70000) { issue(`stuck in phase "${phase}" for 70s at tile ${Math.round(st.x / 32)}`); phaseT = now; await page.screenshot({ path: `/tmp/otf-shots/play-stuck-${shots++}.png` }); }

  if (st.born && st.stage >= 5 && !st.cin && !st.dead && !st.modal) await unstickCheck(st, now);
  if (st.modal === 'dialog') {
    await setPhase(phase.startsWith('dialog') ? phase : 'dialog: ' + phase);
    await releaseAll();
    if (st.opts.length) {
      const pref = st.opts.findIndex(o => /^Rest/.test(o)) >= 0 ? st.opts.findIndex(o => /^Rest/.test(o)) : st.opts.findIndex(o => /Farewell|Wake at|Leave|Later|No/.test(o));
      const i = pref >= 0 ? pref : st.opts.length - 1;
      await page.evaluate((i) => document.querySelectorAll('#dialog .opt')[i].click(), i);
    } else await tap('KeyE');
    await sleep(250); continue;
  }
  if (st.modal === 'menu' || (st.modal === 'bag' && st.tut !== 'craft')) { await tap('Escape', 120); await sleep(200); continue; }
  if (st.dead) { await setPhase('dead'); await releaseAll(); await sleep(400); continue; }

  if (!st.born || st.stage < 5) {
    await setPhase('opening');
    // steer the fall toward the motes, then wake up when asked
    if (st.press) await tap('Space');
    else { await hold('KeyD', (now / 900 | 0) % 2 === 0); await hold('KeyA', (now / 900 | 0) % 2 === 1); }
    await sleep(120); continue;
  }
  if (st.cin) { await releaseAll(); await sleep(200); continue; }

  // ---------------- tutorial
  const tut = st.tut;
  if (tut && !st.tutDone) {
    await setPhase('tutorial: ' + tut);
    if (tut === 'move') await hold('KeyD', true);
    else if (tut === 'jump') { await hold('KeyD', false); await tap('Space', 120); await sleep(500); }
    else if (tut === 'blade' && st.target) await walkTo(st, st.target.x, 8);
    else if (tut === 'strike') {
      const d = st.foes.find(f => f.kind === 'dummy');
      if (d) { const there = await walkTo(st, d.x - 40 * Math.sign(d.x - st.x || 1), 18); if (there) { await releaseAll(); if ((d.x > st.x) !== (st.facing > 0)) await tap(d.x > st.x ? 'KeyD' : 'KeyA', 40); await tap('KeyJ'); await sleep(260); } }
    }
    else if (tut === 'dash') { await tap('ShiftLeft'); await sleep(400); }
    else if (tut === 'mine') {
      await releaseAll();
      // a person clicks a block they can see next to them: nearest exposed solid tile within 3 tiles
      const pick = await page.evaluate(() => { const g = window.__game, W = g.world, a = g.player.actor; const px = Math.floor(a.c.x / 32), py = Math.floor((a.c.y - 10) / 32); let best = null;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) { const x = px + dx, y = py + dy; const t = W.get(x, y); if (!t || !W.solid(x, y) || t === 20) continue; if (W.solid(x, y - 1) && W.solid(x - 1, y) && W.solid(x + 1, y)) continue; if (dx === 0 && dy >= 0) continue; const d = Math.abs(dx) + Math.abs(dy); if (!best || d < best[2]) best = [x, y, d]; } return best; });
      if (!pick) { await hold('KeyD', true); await sleep(300); await hold('KeyD', false); continue; }
      const [sx, sy] = worldToScreen(st, pick[0] * 32 + 16, pick[1] * 32 + 16);
      await page.mouse.move(sx, sy); await page.mouse.down(); await sleep(1400); await page.mouse.up(); mineI++;
    }
    else if (tut === 'place') {
      // a person puts the block on the ground beside them: an empty tile resting on something solid
      const pick = await page.evaluate(() => { const g = window.__game, W = g.world, a = g.player.actor, p = g.player; const px = Math.floor(a.c.x / 32), py = Math.floor((a.c.y - 10) / 32); let best = null;
        for (let dy = -3; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) { const x = px + dx, y = py + dy; if (W.get(x, y) || !W.solid(x, y + 1) || Math.abs(dx) < 1) continue; if (p.bodyIn && p.bodyIn(x, y)) continue; const d = Math.abs(dx) + Math.abs(dy); if (!best || d < best[2]) best = [x, y, d]; } return best; });
      if (pick) {
        const [sx, sy] = worldToScreen(st, pick[0] * 32 + 16, pick[1] * 32 + 16);
        await page.mouse.move(sx, sy); await sleep(60);
        await page.mouse.down({ button: 'right' }); await sleep(80); await page.mouse.up({ button: 'right' }); await sleep(300);
      } else { await hold('KeyD', true); await sleep(300); await hold('KeyD', false); }
    }
    else if (tut === 'craft') {
      // open the satchel, pick planks, press craft, close
      await tap('KeyQ', 120); await sleep(700);
      await page.evaluate(() => { const r = [...document.querySelectorAll('#bag .rec')].find(r => /Planks/.test(r.textContent)); r && r.click(); });
      await sleep(200);
      const b = await page.$('#bag .craft'); if (b) { const bb = await b.boundingBox(); if (bb) { await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); } }
      await sleep(1300); await tap('Escape', 120); await sleep(500);
    }
    await sleep(120); continue;
  }

  // ---------------- goals
  await setPhase('goal: ' + st.goal.replace(/\d+\/\d+/, 'n/m'));
  const foe = st.foes.filter(f => f.kind !== 'dummy').sort((a, b) => Math.abs(a.x - st.x) - Math.abs(b.x - st.x))[0];
  if (foe && Math.abs(foe.x - st.x) < 260 && Math.abs(foe.y - st.y) < 200) {
    // fight: close in, face, strike; dash away when hurt
    const there = await walkTo(st, foe.x - 34 * Math.sign(foe.x - st.x || 1), 16);
    if (there) { await releaseAll(); if ((foe.x > st.x) !== (st.facing > 0)) await tap(foe.x > st.x ? 'KeyD' : 'KeyA', 40); await tap('KeyJ'); await sleep(180); }
    if (st.hp <= 1 && Math.random() < 0.2) await tap('KeyH', 900);
    continue;
  }
  const want = st.interact && (/^(Rest)/.test(st.interact) ? /Rest/.test(st.goal) : /^Talk/.test(st.interact) ? st.met === 0 || /fire|Rest/.test(st.goal) : true);
  if (want && st.interact !== lastInteract) { lastInteract = st.interact; await releaseAll(); await tap('KeyE'); await sleep(300); continue; }
  if (!st.interact) lastInteract = null;
  if (st.target) {
    const there = await walkTo(st, st.target.x, 20);
    if (there) {
      await releaseAll();
      const dy = st.target.y - (st.y - 50);
      if (dy < -40) { await tap('Space', 260); await sleep(250); }
      else if (dy > 96) {
        // dig straight down like a person following Thread underground
        const [sx, sy] = worldToScreen(st, st.x, st.y + 16);
        await page.mouse.move(sx, sy); await page.mouse.down(); await sleep(900); await page.mouse.up();
      } else { await tap('KeyJ'); await sleep(200); }
    }
  } else { await hold('KeyD', true); }
  await sleep(100);
}
await releaseAll();
const fin = await look().catch(() => null);
await page.screenshot({ path: '/tmp/otf-shots/play-end.png' });
const perf = await page.evaluate(() => window.__perf && window.__perf()).catch(() => null);
console.log('\nTIMELINE\n' + timeline.join('\n'));
console.log('\nEND', JSON.stringify(fin && { x: Math.round(fin.x / 32), goal: fin.goal, lights: fin.lights, hp: fin.hp, blade: fin.blade, met: fin.met, respawn: fin.respawn, blocks: fin.blocks, placed: fin.placed }), 'perf', JSON.stringify(perf));
console.log('\nISSUES ' + issues.length + '\n' + issues.map(i => `${i.t}s ${i.m}`).join('\n'));
await browser.close(); server.close();
