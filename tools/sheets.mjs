// Renders the asset sheets to art/sheets/*.png (characters, maps, assets) from the real art code,
// and appends in-game biome captures to the maps sheet.
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'art', 'sheets');
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl'] });
// 1) in-game scene captures for the maps sheet
const scenesDir = path.join(outDir, 'scenes');
fs.mkdirSync(scenesDir, { recursive: true });
const scenes = [['meadow', 18], ['glass', 400], ['hollow', 850], ['ember', 1290], ['frost', -420], ['shrine', 103]];
if (!process.argv[2] || process.argv[2] === 'maps') for (const [name, x] of scenes) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await p.route(/crazygames-sdk/, r => r.abort());
  await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await p.goto(`http://localhost:${port}/`);
  await p.waitForFunction(() => window.__game && window.__game.story);
  await p.evaluate((x) => {
    const g = window.__game; g.story.skipBirth(); g.save.hasBlade = true; g.player.actor.blade = true; g.enemies.calm = 999;
    const gy = g.world.surface(x) * 32;
    g.player.respawnAt((x - 3) * 32, gy); g.player.actor.face(1);
    g.cam.override = { x: x * 32 + 60, y: gy - 150, t: 0.01 }; g.cam.x = g.cam.override.x; g.cam.y = g.cam.override.y; g.cam.zoomT = g.cam.zoom = 0.95;
    document.getElementById('hud').style.display = 'none'; document.getElementById('ui').style.display = 'none';
    if (g.thread) g.thread.visible = false;
  }, x);
  await p.waitForTimeout(2200);
  await p.screenshot({ path: path.join(scenesDir, name + '.png') });
  await p.close();
  console.log('scene', name);
}
const page = await browser.newPage({ viewport: { width: 2500, height: 2200 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://localhost:${port}/tools/sheets.html`);
await page.waitForFunction(() => window.__sheetsDone, null, { timeout: 60000 });
const only = process.argv[2];
for (const id of ['characters', 'maps', 'assets', 'requests']) {
  if (only && only !== id) continue;
  const el = await page.$('#' + id);
  await el.screenshot({ path: path.join(outDir, id + '.png') });
  console.log('wrote', id);
}
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await browser.close(); server.close();
