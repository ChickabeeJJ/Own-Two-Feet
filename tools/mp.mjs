// Multiplayer test: local PeerJS signalling server + two (or three) headless players.
// Usage: PEER_MODULES=/path/to/node_modules node tools/mp.mjs
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const peerMod = require(path.join(process.env.PEER_MODULES || '', 'peer'));

const out = '/tmp/otf-shots';
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const peerSrv = peerMod.PeerServer({ port: 9123, host: '127.0.0.1', path: '/' });
await new Promise(r => setTimeout(r, 500));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const problems = [];
async function player(name) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(name + ' pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) problems.push(name + ' console: ' + m.text()); });
  await page.route(/crazygames-sdk/, r => r.abort());
  await page.goto(`http://localhost:${port}/?peerhost=127.0.0.1&peerport=9123&peerpath=/`);
  await page.waitForFunction(() => window.__game && window.__game.net && window.__game.story);
  await page.evaluate(() => { const g = window.__game; g.story.skipBirth(); g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999; });
  return { page, ctx, name };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (p, fn, a) => p.page.evaluate(fn, a);
const check = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) problems.push('FAIL ' + msg); };

try {
  // ---------------- invite flow
  const A = await player('A'), B = await player('B');
  const room = await ev(A, async () => { await window.__game.net.host(); return window.__game.net.roomId; });
  check(!!room, 'host opened a room: ' + room);
  const joined = await ev(B, async (room) => window.__game.net.join(room), room);
  check(joined, 'guest joined');
  await sleep(1500);
  check(await ev(A, () => window.__game.net.remotes.size) === 1, 'host sees guest');
  check(await ev(B, () => window.__game.net.remotes.size) === 1, 'guest sees host');
  check(await ev(B, () => window.__game.world.seed) === await ev(A, () => window.__game.world.seed), 'guest is in the host world');
  // guest walks; host sees the remote ragdoll move
  const x0 = await ev(A, () => [...window.__game.net.remotes.values()][0].actor.c.x);
  await B.page.keyboard.down('KeyD'); await sleep(1200); await B.page.keyboard.up('KeyD');
  await sleep(500);
  const x1 = await ev(A, () => [...window.__game.net.remotes.values()][0].actor.c.x);
  check(x1 - x0 > 100, `remote player moved on host screen (${Math.round(x1 - x0)}px)`);
  // block edits replicate both ways
  const edit = await ev(A, () => { const g = window.__game, p = g.player; const tx = Math.floor(p.x / 32) + 2, ty = Math.floor(p.y / 32); g.world.set(tx, ty, 0); g.net.sendEdit(tx, ty, 0, 0); return [tx, ty]; });
  await sleep(600);
  check(await ev(B, ([tx, ty]) => window.__game.world.get(tx, ty), edit) === 0, 'host edit reached guest');
  const edit2 = await ev(B, () => { const g = window.__game, p = g.player; const tx = Math.floor(p.x / 32), ty = Math.floor(p.y / 32) - 4; g.world.set(tx, ty, 10); g.net.sendEdit(tx, ty, 10, 0); return [tx, ty]; });
  await sleep(600);
  check(await ev(A, ([tx, ty]) => window.__game.world.get(tx, ty), edit2) === 10, 'guest edit reached host');
  // host-owned enemy appears for the guest; the guest's blade damages it on the host
  await ev(A, () => { const g = window.__game; const r = [...g.net.remotes.values()][0].actor; const e = g.enemies.spawn('husk', r.c.x + 70, g.world.surface(Math.floor((r.c.x + 70) / 32)) * 32, 0); e.ai.cd = 99; window.__e = e; });
  await sleep(1200);
  check(await ev(B, () => window.__game.net.puppets.size) >= 1, 'guest sees the host enemy');
  const hp0 = await ev(A, () => window.__e.hp);
  for (let i = 0; i < 6; i++) { await B.page.keyboard.down('KeyJ'); await sleep(60); await B.page.keyboard.up('KeyJ'); await sleep(300); }
  const hp1 = await ev(A, () => window.__e.hp);
  check(hp1 < hp0, `guest strikes damage the host enemy (${Math.round(hp0)} -> ${Math.round(hp1)})`);
  await A.page.screenshot({ path: path.join(out, 'mp-host.png') });
  await B.page.screenshot({ path: path.join(out, 'mp-guest.png') });
  // guest leaves and returns home
  await ev(B, () => window.__game.net.leave());
  await sleep(1200);
  check(await ev(A, () => window.__game.net.remotes.size) === 0, 'host saw the guest leave');
  check(await ev(B, () => window.__game.world.seed === window.__game.save.seed), 'guest back in own world');
  await A.ctx.close(); await B.ctx.close();

  // ---------------- open world shards + host migration
  const C = await player('C'), D = await player('D'), E = await player('E');
  await ev(C, () => window.__game.net.joinPublic());
  await sleep(800);
  check(await ev(C, () => window.__game.net.isHost && window.__game.net.mode === 'public'), 'first wanderer holds shard 0');
  await ev(D, () => window.__game.net.joinPublic());
  await ev(E, () => window.__game.net.joinPublic());
  await sleep(1500);
  check(await ev(D, () => window.__game.net.isGuest), 'second wanderer joined the shard');
  check(await ev(C, () => window.__game.net.remotes.size) === 2, 'shard host sees two strangers');
  await C.ctx.close();
  await sleep(12000);
  const roles = [await ev(D, () => [window.__game.net.isHost, window.__game.net.isGuest]), await ev(E, () => [window.__game.net.isHost, window.__game.net.isGuest])];
  check(roles.filter(r => r[0]).length === 1 && roles.filter(r => r[1]).length === 1, 'a guest took over the shard: ' + JSON.stringify(roles));
  await sleep(5000);
  const rs = [await ev(D, () => window.__game.net.remotes.size), await ev(E, () => window.__game.net.remotes.size)];
  check(rs[0] === 1 && rs[1] === 1, 'the survivors found each other again ' + JSON.stringify(rs) + JSON.stringify([await ev(D, () => [window.__game.net.myId, [...window.__game.net.remotes.keys()]]), await ev(E, () => [window.__game.net.myId, [...window.__game.net.remotes.keys()]])]));
  await D.page.screenshot({ path: path.join(out, 'mp-shard.png') });
} catch (e) { problems.push('test: ' + e.message); }
await browser.close(); server.close(); try { peerSrv.close && peerSrv.close(); } catch (e) {}
if (problems.length) { console.log('PROBLEMS:\n' + problems.slice(0, 15).join('\n')); process.exit(1); }
console.log('MP OK');
process.exit(0);
