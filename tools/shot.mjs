// Dev harness: serves the game, drives it with a scripted scenario in headless Chromium, saves screenshots,
// and fails on page errors. Usage: node tools/shot.mjs [scenario] [--out dir] [--size 960x540]
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const scenario = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--')) || 'basic';
const out = opt('out', '/tmp/otf-shots');
const [W, H] = opt('size', '960x540').split('x').map(Number);
const fresh = !args.includes('--keep');
fs.mkdirSync(out, { recursive: true });

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const problems = [];
page.on('pageerror', e => problems.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) problems.push('console.error: ' + m.text()); else if (m.type() === 'log' || (m.type() === 'warning' && !m.text().includes('GL Driver'))) console.log('[page]', m.text()); });
await page.route(/crazygames-sdk/, r => r.abort());
if (fresh) await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
const q = opt('q', '');
await page.goto(`http://localhost:${port}/${q ? '?' + q : ''}`);
const sleep = ms => page.waitForTimeout(ms);
const key = async (k, ms = 120) => { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); };
const shot = async (name) => { await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
const evalg = (fn, a) => page.evaluate(fn, a);

const scenarios = {
  async basic() {
    await sleep(2500); await shot('a-start');
    await page.keyboard.down('KeyD'); await sleep(1200); await shot('b-run'); await page.keyboard.up('KeyD');
    await key('Space', 200); await sleep(150); await shot('c-jump');
    await sleep(800); await shot('d-land');
  },
};
// load extra scenarios from tools/scenarios.mjs if present
try { const ext = await import('./scenarios.mjs'); Object.assign(scenarios, ext.default({ page, sleep, key, shot, evalg })); } catch (e) { if (!String(e).includes('Cannot find module')) console.log('scenario load:', e.message); }

const t0 = Date.now();
try { await scenarios[scenario](); } catch (e) { problems.push('scenario: ' + e.message); }
const perf = await page.evaluate(() => window.__perf ? window.__perf() : null).catch(() => null);
if (perf) console.log('perf', JSON.stringify(perf));
console.log('scenario', scenario, 'ms', Date.now() - t0);
await browser.close(); server.close();
if (problems.length) { console.log('PROBLEMS:\n' + problems.slice(0, 12).join('\n')); process.exit(1); }
console.log('OK');
