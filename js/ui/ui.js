// DOM UI: HUD, cinematic cards, letterbox, dialog with typewriter, menus (journey, look, craft, together,
// settings, controls), character editor with a live ragdoll preview and a generated sigil.
import { PERKS } from '../game/levels.js';
import { Audio } from '../core/audio.js';
import { Input } from '../core/input.js';
import { TILE, T, TILES, biomeOf, gateNear } from '../world/tiles.js';
import { Body, P } from '../physics/body.js';
import { Animator } from '../physics/pose.js';
import { Cape, drawBody } from '../physics/skin.js';
import { Bag } from './bag.js';
import { QUESTS } from '../game/quests.js';
import { itemIconEl } from '../art/itemart.js';
import { usable, itemName } from '../game/items.js';
import { playerName } from '../game/progress.js';
import { COSMETICS, SLOTS, SLOT_NAMES, RECIPES, cosmetic, lookFromSave, Save, genName } from '../game/progress.js';
import { TYPES as BOSS_TYPES } from '../game/bosses.js';
import { mulberry, hashStr, TAU, clamp, shade } from '../core/util.js';
import { Platform } from '../platform.js';
import { iconURL, TILE_ICON, IMG } from '../art/images.js';
import { gateReq, LORE } from '../game/content.js';

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function tileIcon(t, size = 26) {
  const url = iconURL(t);
  if (url && IMG['icons/b_' + TILE_ICON[t]]) { const im = new Image(); im.src = url; im.className = 'ticon'; im.style.width = im.style.height = size + 'px'; return im; }
  const c = document.createElement('canvas');
  const d = Math.min(2, devicePixelRatio || 1);
  c.width = c.height = size * d;
  c.style.width = c.style.height = size + 'px';
  const g = c.getContext('2d');
  g.scale(d, d);
  const k = TILES[t].k;
  const col = k && k[0] === '#' ? k : { dirt: '#6b5850', stone: '#6e7486', deep: '#454858', log: '#7a6050', leaf: '#7da48a', moss: '#5f7a63' }[k] || '#888';
  g.fillStyle = shade(col, -0.18); g.beginPath(); g.roundRect(2, 3, size - 4, size - 4, 5); g.fill();
  g.fillStyle = col; g.beginPath(); g.roundRect(2, 2, size - 4, size - 5, 5); g.fill();
  g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(5, 3, size - 10, 2);
  if (t === T.GRASS) { g.fillStyle = '#9cbd8c'; g.beginPath(); g.roundRect(2, 2, size - 4, 7, [5, 5, 0, 0]); g.fill(); }
  if (t === T.LANTERN || t === T.HEARTH || t === T.CRYSTAL || t === T.EMBER) { g.fillStyle = '#fff3d8'; g.beginPath(); g.arc(size / 2, size / 2, size * 0.14, 0, TAU); g.fill(); }
  if (t === T.PLANK) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(2, size * 0.36, size - 4, 1.5); g.fillRect(2, size * 0.66, size - 4, 1.5); }
  if (t === T.BRICK || t === T.RUIN) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(2, size / 2, size - 4, 1.5); g.fillRect(size / 2, 2, 1.5, size / 2); }
  return c;
}

export function drawSigil(canvas, seed) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const r = mulberry(seed >>> 0);
  const n = 3 + ((r() * 4) | 0);
  g.translate(W / 2, H / 2);
  g.strokeStyle = '#f3ece0'; g.lineCap = 'round'; g.lineWidth = W * 0.035;
  g.globalAlpha = 0.9;
  g.beginPath(); g.arc(0, 0, W * 0.42, 0, TAU); g.stroke();
  g.lineWidth = W * 0.045;
  const a0 = r() * TAU, len = 0.15 + r() * 0.2, bend = r() - 0.5;
  for (let i = 0; i < n; i++) {
    const a = a0 + i * TAU / n;
    g.beginPath();
    g.moveTo(Math.cos(a) * W * 0.08, Math.sin(a) * W * 0.08);
    g.quadraticCurveTo(Math.cos(a + bend) * W * 0.3, Math.sin(a + bend) * W * 0.3, Math.cos(a) * W * (0.2 + len), Math.sin(a) * W * (0.2 + len));
    g.stroke();
  }
  if (r() < 0.6) { g.fillStyle = '#f3ece0'; g.beginPath(); g.arc(0, 0, W * 0.05, 0, TAU); g.fill(); }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

export class UI {
  constructor(game) {
    this.game = game;
    this.modal = null;          // 'dialog' | 'menu' | null
    this.hotbarDirty = true;
    this.cardTimer = null;
    this.lastHp = -1; this.lastMax = -1;
    this.menuTab = 'journey';
    this.dlg = null;
    this.tailorMode = false;
    $('#btn-menu').addEventListener('click', () => this.toggleMenu());
    $('#btn-together').addEventListener('click', () => this.openMenu('together'));
    $('#dialog').addEventListener('click', e => { if (e.target.classList.contains('opt')) return; this.advanceDialog(); });
  }
  get sv() { return this.game.save; }

  // ------------------------------------------------------------ cinematic pieces
  hud(show) { $('#hud').classList.toggle('hidden', false); $('#hud').classList.toggle('dim', !show); this.hudOn = show; }
  letterbox(on) { $('#letterbox').classList.toggle('on', on); $('#hud').classList.toggle('dim', on || !this.hudOn); }
  fade(v, dur = 0.9) { const f = $('#fade'); f.style.transition = `opacity ${dur}s cubic-bezier(.2,.8,.2,1)`; f.style.opacity = v; }
  press(text) { const p = $('#press'); if (!text) { p.classList.add('hidden'); return; } p.textContent = text; p.classList.remove('hidden'); }
  hint(html) {
    const h = $('#hint');
    if (!html) { h.classList.remove('show'); return; }
    if (h.dataset.h !== html) { h.innerHTML = html; h.dataset.h = html; }
    h.classList.remove('hidden'); h.classList.add('show');
  }
  lore(text) {
    const l = $('#lore');
    if (!text) { l.classList.remove('show'); return; }
    l.classList.remove('show');
    clearTimeout(this.loreT);
    this.loreT = setTimeout(() => { l.textContent = text; void l.offsetWidth; l.classList.add('show'); }, l.textContent ? 650 : 0);
  }
  // a compact banner: a progress ring, the verb, one line of how; on touch the button to press pulses
  tutorial(st, i, n, touch, done) {
    const el = $('#tut');
    document.querySelectorAll('#touch .hint').forEach(b => b.classList.remove('hint'));
    document.body.classList.toggle('tutoring', !!st);
    if (!st) { el.classList.add('hidden'); return; }
    $('#objective').classList.add('hidden');
    const BTN = { jump: 'jump', strike: 'attack', dash: 'dash', mine: 'tbuild', place: 'tbuild', craft: 'tbag' };
    if (touch && !done && BTN[st.id]) { const b = document.querySelector(`#tbtns .tb[data-a="${BTN[st.id]}"]`); if (b) b.classList.add('hint'); }
    document.body.classList.toggle('hint-stick', touch && !done && st.id === 'move');
    const key = st.id + (touch ? 't' : 'k') + (done ? 'd' : '');
    if (el.dataset.k === key) return;
    el.dataset.k = key;
    el.classList.remove('hidden');
    const keys = touch ? `<span class="tt-touch">${esc(st.touch)}</span>` : st.keys.map(k => `<kbd>${esc(k)}</kbd>`).join('<span class="tt-or">or</span>');
    const frac = (i + (done ? 1 : 0)) / n, C = 2 * Math.PI * 15;
    el.innerHTML = `<div class="tt-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="bg"/><circle cx="18" cy="18" r="15" class="fg" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - frac)}"/></svg><span>${i + 1}/${n}</span></div>`
      + `<div class="tt-main"><div class="tt-title">${done ? '<i class="tt-check"></i>' : ''}${esc(st.title)}</div><div class="tt-text">${esc(st.text)}</div></div>`
      + `<div class="tt-keys">${keys}</div><button class="tt-skip" title="Skip tutorial">Skip</button>`;
    el.classList.toggle('done', done);
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    el.querySelector('.tt-skip').onclick = () => { this.game.story.skipTutorial(); Audio.play('blip'); };
  }
  objective(text, hint, dist) {
    const o = $('#objective');
    const key = text + '|' + hint;
    if (o.dataset.k !== key) {
      o.dataset.k = key;
      o.querySelector('.ob-text').textContent = text;
      o.querySelector('.ob-hint').innerHTML = hint || '';
      o.classList.remove('hidden', 'pulse'); void o.offsetWidth; o.classList.add('pulse');
    }
    const d = o.querySelector('.ob-dist');
    const dir = dist && dist.endsWith('>') ? 'r' : dist && dist.endsWith('<') ? 'l' : '';
    const txt = dist ? dist.replace(/[<>]$/, '').trim() : '';
    if (d.textContent !== txt) d.textContent = txt;
    if (d.dataset.dir !== dir) { d.dataset.dir = dir; d.className = 'ob-dist' + (dir ? ' chev-after ' + dir : ''); }
  }
  card(title, sub, cls = '', dur = 3.2) {
    const c = $('#card');
    c.className = cls;
    c.querySelector('.title').textContent = title;
    c.querySelector('.sub').textContent = sub || '';
    c.classList.remove('hidden');
    void c.offsetWidth;
    c.classList.add('show');
    document.body.classList.add('carding');
    clearTimeout(this.cardTimer);
    this.cardTimer = setTimeout(() => { c.classList.remove('show'); document.body.classList.remove('carding'); }, dur * 1000);
  }
  toast(msg, kind) {
    const t = el('div', 'toast' + (kind ? ' ' + kind : ''), esc(msg));
    $('#toasts').appendChild(t);
    while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 600); }, 2600);
  }
  pickup(tile, n) {
    const box = $('#pickups');
    const last = box.lastChild;
    if (last && last.dataset.t == tile && Date.now() - last.dataset.ts < 1500) {
      last.dataset.n = +last.dataset.n + n; last.dataset.ts = Date.now();
      last.querySelector('span').textContent = `+${last.dataset.n} ${itemName(tile)}`;
      return;
    }
    const d = el('div', 'pk', `<span>+${n} ${esc(itemName(tile))}</span>`);
    d.prepend(itemIconEl(tile, 20));
    d.dataset.t = tile; d.dataset.n = n; d.dataset.ts = Date.now();
    box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { d.style.transition = 'opacity .6s'; d.style.opacity = 0; setTimeout(() => d.remove(), 700); }, 2200);
  }
  // combo counter (right edge): grows and warms with the count, shows the reward multiplier
  combo(n, mult) {
    let el = this.comboEl;
    if (!el) { el = this.comboEl = document.createElement('div'); el.id = 'combo'; el.innerHTML = '<b></b><span>hits</span><i></i><em></em>'; document.getElementById('ui').appendChild(el); }
    if (n < 2) { el.classList.remove('on'); return; }
    el.classList.add('on');
    el.querySelector('b').textContent = n;
    el.querySelector('i').textContent = 'x' + mult.toFixed(2).replace(/0$/, '') + ' rewards';
    el.style.setProperty('--heat', Math.min(1, n / 40).toFixed(2));
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    clearTimeout(this.comboTO); el.querySelector('em').style.animation = 'none'; void el.offsetWidth; el.querySelector('em').style.animation = '';
  }
  // surge banner under the compass: what is happening and how many Hollows are left
  surgeHud(text, left, state) {
    let el = this.surgeEl;
    if (!el) { el = this.surgeEl = document.createElement('div'); el.id = 'surge'; el.innerHTML = '<b></b><span></span>'; document.getElementById('ui').appendChild(el); }
    if (!text) { el.classList.remove('on'); return; }
    el.classList.add('on'); el.classList.toggle('warn', state === 'warn');
    const k = text + '|' + left;
    if (el.dataset.k === k) return; el.dataset.k = k;
    el.querySelector('b').textContent = text;
    el.querySelector('span').textContent = left === null || left === undefined ? '' : left + ' left';
  }
  // Rift Trials: choose one of three boons between waves
  riftBoons(list, cb) {
    let el = this.boonEl;
    if (!el) { el = this.boonEl = document.createElement('div'); el.id = 'rift-boons'; document.getElementById('ui').appendChild(el); }
    el.innerHTML = '<em>Choose a boon</em><div class="perk-row"></div>';
    const row = el.querySelector('.perk-row');
    this.modal = 'boon'; document.body.classList.add('modal');
    list.forEach((b, i) => {
      const c = document.createElement('button'); c.className = 'perk-card'; c.style.setProperty('--i', i);
      c.innerHTML = `<i class="pk-ico">${b.name[0]}</i><b>${esc(b.name)}</b><span>${esc(b.desc)}</span>`;
      c.onclick = () => { el.classList.remove('on'); this.modal = null; document.body.classList.remove('modal'); cb(b); };
      row.appendChild(c);
    });
    el.classList.add('on');
  }
  // kill streak callout in the middle of the screen
  streak(text, k) {
    let el = this.streakEl;
    if (!el) { el = this.streakEl = document.createElement('div'); el.id = 'streak'; document.getElementById('ui').appendChild(el); }
    el.innerHTML = `<b>${esc(text)}</b><span>${k} undone</span>`;
    el.className = 'on' + (k >= 5 ? ' big' : '');
    void el.offsetWidth;
    clearTimeout(this.streakTO); this.streakTO = setTimeout(() => el.classList.remove('on'), 1400);
  }
  glimmerBump() { const g = $('#glimmer'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); }
  deathCard(show = true) {
    if (show) { this.letterbox(true); this.card('The body forgets', 'but you remember', 'boss', 2.6); }
    else this.letterbox(false);
  }
  bossBar(B) {
    const bb = $('#bossbar');
    if (!B || this.game.cinematic && B.state === 'intro') { bb.classList.add('hidden'); return; }
    bb.classList.remove('hidden');
    bb.querySelector('.bname').textContent = B.name;
    const w = (B.hpK * 100).toFixed(1) + '%';
    bb.querySelector('.bfill').style.width = w;
    bb.querySelector('.bghost').style.width = w;
  }

  // ------------------------------------------------------------ dialog
  dialog(name, lines, opts) {
    this.modal = 'dialog';
    this.dlg = { name, lines, opts, i: 0, shown: 0, t: 0, focus: 0 };
    $('#dialog').classList.remove('hidden');
    $('#dialog .who').textContent = name;
    $('#dialog .opts').innerHTML = '';
    this.letterbox(true);
  }
  advanceDialog() {
    const d = this.dlg; if (!d) return;
    const line = d.lines[d.i] || '';
    if (d.shown < line.length) { d.shown = line.length; return; }
    if (d.i < d.lines.length - 1) { d.i++; d.shown = 0; Audio.play('blip', { pitch: 1.2 }); return; }
  }
  showOpts() {
    const d = this.dlg, box = $('#dialog .opts');
    if (box.childElementCount) return;
    // there is always a way to just leave
    if (!d.opts) d.opts = [];
    if (!d.opts.some(o => /^(Farewell|Wake at|Leave|Not now)/.test(o.label))) d.opts.push({ label: 'Farewell' });
    d.opts.forEach((o, i) => {
      const b = el('button', 'opt', esc(o.label) + (o.cost ? ` <small>${o.cost.glimmer} glimmer${(o.cost.items || []).map(([t, n]) => ` + ${n} ${esc(TILES[t].name)}`).join('')}</small>` : ''));
      b.addEventListener('click', () => this.pickOpt(i));
      box.appendChild(b);
    });
    this.focusOpt(0);
  }
  focusOpt(i) { const bs = [...$('#dialog .opts').children]; if (!bs.length) return; this.dlg.focus = (i + bs.length) % bs.length; bs.forEach((b, k) => b.classList.toggle('focus', k === this.dlg.focus)); }
  pickOpt(i) {
    const d = this.dlg; if (!d) return;
    const o = d.opts[i];
    Audio.play('confirm');
    const keep = !o.close && o.label !== 'Farewell' && o.label !== 'Trade' && !o.label.startsWith('Change');
    if (o.act) o.act();
    if (!keep || !this.dlg) { if (this.dlg === d) this.closeDialog(); return; }
    // refresh costs after a purchase
    $('#dialog .opts').innerHTML = '';
    const g = this.game;
    if (g.shrines && d.kindRef) {}
    this.showOpts();
  }
  closeDialog() {
    this.dlg = null; this.modal = null;
    $('#dialog').classList.add('hidden');
    this.letterbox(false);
  }
  updateDialog(dt) {
    const d = this.dlg; if (!d) return;
    const line = d.lines[d.i] || '';
    d.t += dt;
    if (d.shown < line.length) { d.shown = Math.min(line.length, d.shown + dt * 52); if ((d.t * 30 | 0) % 3 === 0) Audio.play('talk', { gap: 0.06, vol: 0.5 }); }
    $('#dialog .text').textContent = line.slice(0, Math.floor(d.shown));
    const last = d.i >= d.lines.length - 1 && d.shown >= line.length;
    if (last) this.showOpts();
    if (Input.pressed('interact') || Input.pressed('jump') || Input.pressed('attack')) {
      Input.consume('interact'); Input.consume('jump'); Input.consume('attack');
      if (last) this.pickOpt(d.focus); else this.advanceDialog();
    }
    if (last) {
      if (Input.pressed('left') || Input.pressed('up')) this.focusOpt(d.focus - 1);
      if (Input.pressed('right') || Input.pressed('down')) this.focusOpt(d.focus + 1);
      for (let i = 1; i <= 6; i++) if (Input.pressed('slot' + i) && i - 1 < d.opts.length) this.pickOpt(i - 1);
    }
    if (Input.pressed('menu')) { Input.consume('menu'); const c = d.cancel; this.closeDialog(); if (c) c(); }
  }
  shop(name, items) {
    this.dialog(name, ['Have a look. Everything is honest, mostly.'], items.map(it => ({ label: it.label, cost: it.cost, act: it.act })).concat([{ label: 'Farewell' }]));
    this.dlg.shown = 999;
  }

  // ------------------------------------------------------------ menu
  toggleMenu() { if (this.modal === 'menu') this.closeMenu(); else this.openMenu(); }
  openMenu(tab) {
    if (this.dlg) this.closeDialog();
    this.tailorMode = tab === 'look' && this.game.player && this.nearTailor();
    this.modal = 'menu';
    document.body.classList.add('menu-open', 'modal');
    if (tab) this.menuTab = tab;
    $('#menu').classList.remove('hidden');
    const mp = this.game.net && this.game.net.active;
    if (!mp) { this.game.paused = true; Platform.gameplayStop(); }
    Audio.play('blip');
    this.renderMenu();
  }
  closeMenu() {
    this.modal = null;
    document.body.classList.remove('menu-open', 'modal');
    $('#menu').classList.add('hidden');
    this.game.paused = false;
    if (this.game.story && this.game.story.stage >= 5) Platform.gameplayStart();
    this.preview = null;
    this.game.saveNow && this.game.saveNow();
  }
  nearTailor() {
    const g = this.game;
    return g.actors.some(a => a.npcKind === 'tailor' && Math.abs(a.c.x - g.player.x) < 260);
  }
  renderMenu() {
    const tabs = [['journey', 'Journey'], ['character', 'Character'], ['quests', 'Quests'], ['journal', 'Journal'], ['look', 'Look'], ['craft', 'Craft'], ['together', 'Together'], ['settings', 'Settings'], ['controls', 'Controls']];
    const th = $('#menu .tabs');
    // tabs are built once; the underline slides between them
    if (!th.querySelector('.tab')) {
      for (const [id, name] of tabs) {
        const b = el('button', 'tab', name); b.dataset.id = id;
        b.addEventListener('click', () => { if (this.menuTab === id) return; this.menuTab = id; Audio.play('blip'); this.renderMenu(); });
        th.appendChild(b);
      }
      th.appendChild(el('div', 'tab-line'));
      const back = el('button', 'menu-back', '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Back</span>');
      back.onclick = () => { Audio.play('blip', { pitch: 0.8 }); this.closeMenu(); };
      $('#menu .menu-head').appendChild(back);
    }
    let on = null;
    for (const b of th.querySelectorAll('.tab')) { const is = b.dataset.id === this.menuTab; b.classList.toggle('on', is); if (is) on = b; }
    const line = th.querySelector('.tab-line');
    if (on && line) requestAnimationFrame(() => { line.style.width = on.offsetWidth + 'px'; line.style.transform = `translateX(${on.offsetLeft}px)`; line.style.top = (on.offsetTop + on.offsetHeight - 2) + 'px'; });
    const body = $('#menu .menu-body');
    body.classList.remove('enter'); void body.offsetWidth;
    body.innerHTML = '';
    this['tab_' + this.menuTab](body);
    // content slides in, its parts one after another
    body.classList.add('enter');
    [...body.querySelectorAll('.big-btn, .stat, .qcard, .recipe, .item, .row > .col > *')].slice(0, 30).forEach((e, i) => e.style.setProperty('--i', i));
  }
  tab_journey(body) {
    const sv = this.sv, g = this.game;
    const row = el('div', 'row');
    const c1 = el('div', 'col');
    const resume = el('button', 'big-btn primary', '<b>Continue</b><span>Back on your feet</span>');
    resume.onclick = () => this.closeMenu();
    c1.appendChild(resume);
    const look = el('button', 'big-btn', '<b>Your Look</b><span>Make this body yours</span>');
    look.onclick = () => { this.menuTab = 'look'; this.renderMenu(); };
    c1.appendChild(look);
    const tog = el('button', 'big-btn', '<b>Play Together</b><span>Invite a friend or wander the open world</span>');
    tog.onclick = () => { this.menuTab = 'together'; this.renderMenu(); };
    c1.appendChild(tog);
    if (g.rift && sv.tutDone) {
      const inR = g.rift.active;
      const rb = el('button', 'big-btn rift-btn', inR ? '<b>Leave the Rift</b><span>Back to the world, rewards kept</span>' : `<b>Rift Trials</b><span>Endless waves in a sealed arena · best wave ${sv.rift && sv.rift.best || 0}</span>`);
      rb.onclick = () => { this.closeMenu(); if (inR) g.rift.leave(); else g.rift.enter(); };
      c1.appendChild(rb);
    }
    // a way out of any hole: walk back from the last shrine (or home)
    if (g.player && !g.player.dead && !(g.bosses && g.bosses.active) && g.story && g.story.stage >= 5) {
      const back = el('button', 'big-btn', '<b>Return to the shrine</b><span>Trapped or lost? Thread pulls you back</span>');
      back.onclick = () => { this.closeMenu(); g.story.toShrine(true); };
      c1.appendChild(back);
    }
    row.appendChild(c1);
    const c2 = el('div', 'col');
    c2.appendChild(el('div', 'h', 'The story so far'));
    const st = sv.stats;
    const relics = Object.entries(sv.abil).filter(([, v]) => v).length;
    const stats = [['Name', esc(this.displayName())], ['Gates fallen', Object.keys(sv.bosses).length], ['Relics', relics], ['Vessels', sv.maxHp], ['Furthest step', `${st.far} m`], ['Foes undone', st.kills], ['Blocks broken', st.blocks], ['Blocks placed', st.placed], ['People met', Object.keys(sv.met).length], ['Home', sv.home ? 'Yes' : 'Not yet'], ['Falls', st.deaths]];
    for (const [k, v] of stats) c2.appendChild(el('div', 'stat', `<span>${k}</span><b>${v}</b>`));
    row.appendChild(c2);
    body.appendChild(row);
  }
  displayName() { return playerName(this.sv, Platform.username); }
  // the quest log: tracked quest, active chains with their steps, the day's commissions, finished quests
  // level, experience and perks; a pending perk pick shows three cards to choose from
  tab_character(body) {
    const g = this.game, sv = this.sv, L = g.levels;
    const lvl = sv.level || 1, need = L ? L.need(lvl) : 100, frac = Math.min(1, (sv.xp || 0) / need);
    const wrap = el('div', 'char');
    const head = el('div', 'char-head');
    head.innerHTML = `<div class="char-lv"><span>Level</span><b>${lvl}</b></div><div class="char-xp"><div class="bar"><i style="width:${(frac * 100).toFixed(1)}%"></i></div><span>${Math.floor(sv.xp || 0)} / ${need} experience</span></div>`
      + `<div class="char-stats"><span>Damage <b>+${Math.round(((L ? L.dmgMult() : 1) - 1) * 100)}%</b></span><span>Vessels <b>${sv.maxHp}</b></span><span>Zone here <b>${L ? L.zoneLevel(g.player.x) : 1}</b></span></div>`;
    wrap.appendChild(head);
    if (L && sv.perkPicks > 0) {
      wrap.appendChild(el('div', 'h', `Choose a perk <em>${sv.perkPicks} to choose</em>`));
      const row = el('div', 'perk-row');
      L.offer().forEach((pk, i) => {
        const c = el('button', 'perk-card', `<i class="pk-ico">${pk.name[0]}</i><b>${esc(pk.name)}</b><span>${esc(pk.desc)}</span>`);
        c.style.setProperty('--i', i);
        c.onclick = () => { if (L.pick(pk.id)) { c.classList.add('chosen'); setTimeout(() => this.renderMenu(), 420); } };
        row.appendChild(c);
      });
      wrap.appendChild(row);
    }
    wrap.appendChild(el('div', 'h', 'Your perks'));
    const own = el('div', 'perk-own');
    const mine = (sv.perks || []).map(id => PERKS.find(p => p.id === id)).filter(Boolean);
    if (!mine.length) own.appendChild(el('div', 'note', 'Every third level you choose a perk. The first comes at level 3.'));
    for (const pk of mine) own.appendChild(el('div', 'perk-chip', `<b>${esc(pk.name)}</b><span>${esc(pk.desc)}</span>`));
    wrap.appendChild(own);
    body.appendChild(wrap);
  }
  xpBar(level, frac, bump) {
    const b = $('#xp'); if (!b) return;
    $('#lvl').textContent = level; $('#xp-fill').style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + '%';
    if (bump) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  }
  levelCard(n, vessel, perk) {
    this.game.story.card(`Level ${n}`, perk ? 'a perk to choose: Menu, Character' : vessel ? 'a new vessel' : 'stronger', 'small', 2.6);
  }
  tab_quests(body) {
    const g = this.game, Q = g.quests, sv = this.sv;
    if (!Q) return;
    const row = el('div', 'row'), c1 = el('div', 'col'), c2 = el('div', 'col');
    c1.appendChild(el('div', 'h', 'Quests'));
    const ids = Object.keys(sv.quests || {});
    const active = ids.filter(id => !sv.quests[id].done), done = ids.filter(id => sv.quests[id].done);
    if (!active.length) c1.appendChild(el('div', 'note', 'Keepers at the shrines have work. Ask them when you meet them.'));
    for (const id of active) {
      const D = QUESTS[id], st = sv.quests[id];
      const card = el('div', 'qcard' + (sv.qtrack === id ? ' tracked' : ''));
      card.appendChild(el('div', 'qh', `<b>${esc(D.name)}</b><span>${esc(D.giver === 'Thread' ? 'from Thread' : 'from a ' + D.giver)}</span>`));
      D.steps.forEach((s, i) => {
        const p = i === st.step ? Q.progress(s, st.base) : 0;
        const prog = i === st.step && s.t !== 'talk' ? ` <em>${s.t === 'deliver' ? Math.min(sv.inv[s.id] || 0, s.n) : p}/${s.n}</em>` : '';
        card.appendChild(el('div', 'qstep' + (i < st.step ? ' ok' : i === st.step ? ' now' : ''), `<i></i>${esc(s.text)}${prog}`));
      });
      const tb = el('button', 'mini-btn', sv.qtrack === id ? 'Tracking' : 'Track');
      tb.onclick = () => { sv.qtrack = id; this.renderMenu(); };
      card.appendChild(tb);
      c1.appendChild(card);
    }
    if (done.length) c1.appendChild(el('div', 'note', 'Finished: ' + done.map(id => esc(QUESTS[id].name)).join(', ')));
    c2.appendChild(el('div', 'h', "Today's commissions"));
    const d = sv.daily;
    if (d) {
      const card = el('div', 'qcard' + (sv.qtrack === 'daily' ? ' tracked' : ''));
      for (const c of d.list) {
        const p = Q.progress(c, c.base);
        card.appendChild(el('div', 'qstep' + (c.done ? ' ok' : ' now'), `<i></i>${esc(c.text)}${c.done || c.t === 'deliver' ? '' : ` <em>${p}/${c.n}</em>`}`));
      }
      card.appendChild(el('div', 'note', d.claimed ? 'Claimed. New commissions tomorrow.' : d.list.every(c => c.done) ? 'All done: claim your reward from any keeper.' : 'Finish all three, then see any keeper for a reward.'));
      const tb = el('button', 'mini-btn', sv.qtrack === 'daily' ? 'Tracking' : 'Track');
      tb.onclick = () => { sv.qtrack = 'daily'; this.renderMenu(); };
      if (!d.claimed) card.appendChild(tb);
      c2.appendChild(card);
    }
    const nav = el('label', 'toggle', `<input type="checkbox" ${Q.navOn ? 'checked' : ''}> Show the way to the tracked quest`);
    nav.querySelector('input').onchange = (e) => { Q.navOn = e.target.checked; g.settings.questNav = Q.navOn; g.saveSettings && g.saveSettings(); };
    c2.appendChild(nav);
    row.appendChild(c1); row.appendChild(c2);
    body.appendChild(row);
  }
  tab_journal(body) {
    const sv = this.sv, g = this.game;
    const row = el('div', 'row');
    const c1 = el('div', 'col');
    const gi = gateNear(Math.floor(g.player.x / TILE));
    const need = gateReq(gi.tier);
    c1.appendChild(el('div', 'h', 'Threads of light'));
    c1.appendChild(el('div', 'stat', `<span>Carried</span><b>${sv.lights || 0}</b>`));
    c1.appendChild(el('div', 'stat', `<span>Needed for the nearest gate</span><b>${need}</b>`));
    c1.appendChild(el('div', 'stat', `<span>Dolls woken</span><b>${Object.keys(sv.rescued || {}).length}</b>`));
    c1.appendChild(el('div', 'stat', `<span>Lost stitches found</span><b>${Object.keys(sv.stitches || {}).length}</b>`));
    c1.appendChild(el('div', 'stat', `<span>Nests broken</span><b>${Object.keys(sv.nests || {}).length}</b>`));
    c1.appendChild(el('div', 'stat', `<span>Chests opened</span><b>${Object.keys(sv.chests || {}).length}</b>`));
    c1.appendChild(el('div', 'h', 'Favours'));
    const open = (sv.requests || []).filter(r => !r.claimed);
    if (!open.length) c1.appendChild(el('div', 'note', 'Keepers at the shrines have work for you. Ask them.'));
    for (const r of open) c1.appendChild(el('div', 'stat', `<span>${esc(r.name)}: ${esc(g.shrines.requestText(r))}</span><b>${g.shrines.requestProgress(r)}</b>`));
    row.appendChild(c1);
    const c2 = el('div', 'col');
    c2.appendChild(el('div', 'h', 'What the stitches remember'));
    const lore = sv.lore || [];
    if (!lore.length) c2.appendChild(el('div', 'note', 'Lost stitches glow in high places and deep caves. Each holds a memory of her.'));
    lore.forEach((i, k) => c2.appendChild(el('div', 'note', `<b style="color:var(--warm)">${k + 1}.</b> ${esc(LORE[i])}`)));
    row.appendChild(c2);
    body.appendChild(row);
  }
  tab_look(body) {
    const sv = this.sv;
    const wrap = el('div', 'editor');
    const pv = el('div', 'preview');
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 560;
    pv.appendChild(cv);
    const nm = el('div', 'name', esc(this.displayName()));
    pv.appendChild(nm);
    const sg = document.createElement('canvas'); sg.width = sg.height = 108; sg.className = 'sigil';
    drawSigil(sg, hashStr(this.displayName() + JSON.stringify(sv.look) + sv.marks.join('')));
    pv.appendChild(sg);
    pv.appendChild(el('div', 'note', 'Your sigil changes with every choice. No one else carries this one.'));
    const rn = el('button', 'mini-btn', 'New name');
    rn.onclick = () => { sv.name = genName((Math.random() * 1e9) | 0); this.renderMenu(); };
    void rn;
    wrap.appendChild(pv);
    const right = el('div', 'col');
    const slots = el('div', 'slots');
    this.lookSlot = this.lookSlot || 'color';
    for (const s of SLOTS) {
      const all = COSMETICS.filter(c => c.slot === s), own = all.filter(c => sv.unlocked.includes(c.id)).length;
      const b = el('button', 'chip' + (s === this.lookSlot ? ' on' : ''), `${SLOT_NAMES[s]}<small>${own}/${all.length}</small>`);
      b.onclick = () => { this.lookSlot = s; Audio.play('blip', { pitch: 1.2 }); this.renderMenu(); };
      slots.appendChild(b);
    }
    right.appendChild(slots);
    if (!this.tailorMode) right.appendChild(el('div', 'note', 'Priced looks can be bought from a tailor. Talk to one, then choose “Change my look”.'));
    const grid = el('div', 'grid');
    for (const c of COSMETICS.filter(c => c.slot === this.lookSlot)) {
      const owned = sv.unlocked.includes(c.id);
      const on = sv.look[c.slot] === c.id;
      const it = el('div', 'item' + (on ? ' on' : '') + (owned ? '' : ' locked'));
      let sw = '#444';
      if (c.slot === 'color') sw = c.v[0];
      else if (c.slot === 'cape') sw = c.v ? c.v.col : 'transparent';
      else if (c.slot === 'eyes') sw = c.v[0];
      else if (c.slot === 'blade') sw = c.v.glow;
      else if (c.slot === 'mat') sw = { cloth: '#d9d2c4', porcelain: 'linear-gradient(135deg,#fff,#cfc8bd)', metal: 'linear-gradient(135deg,#e9c48a,#7a5a33)', glow: 'radial-gradient(#9ff3ff,#1c3a40)', shadow: '#1d1a24' }[c.v];
      else sw = 'rgba(255,255,255,.12)';
      it.innerHTML = `<div class="sw" style="background:${sw}">${owned ? '' : '<i class="lock"></i>'}</div><b>${esc(c.name)}</b>${owned ? (on ? '<span class="how">Wearing</span>' : '') : `<span class="how">${esc(c.how)}</span>`}${!owned && c.cost ? `<span class="cost">${c.cost}</span>` : ''}`;
      it.onclick = () => {
        if (!owned) {
          if (c.cost && this.tailorMode) {
            if (sv.glimmer >= c.cost) { sv.glimmer -= c.cost; Save.unlock(c.id); Audio.play('confirm'); this.toast(`${c.name} is yours`); }
            else { Audio.play('blip', { pitch: 0.6 }); this.toast('Not enough glimmer'); return; }
          } else { Audio.play('blip', { pitch: 0.6 }); return; }
        }
        sv.look[c.slot] = c.id;
        Audio.play('blip', { pitch: 1.3 });
        this.game.player.refreshLook();
        if (this.game.net) this.game.net.sendLook && this.game.net.sendLook();
        this.renderMenu();
      };
      grid.appendChild(it);
    }
    right.appendChild(grid);
    wrap.appendChild(right);
    body.appendChild(wrap);
    this.startPreview(cv);
  }
  startPreview(cv) {
    const look = lookFromSave(this.sv);
    const b = new Body({ scale: 3.5, x: 230, y: 330, facing: 1 });
    const an = new Animator(b);
    const cape = look.cape ? new Cape(7, look.cape.len * 3.5) : null;
    if (cape) cape.flare = 640;
    this.preview = { cv, b, an, cape, look, t: 0 };
  }
  tickPreview(dt) {
    const p = this.preview; if (!p || !p.cv.isConnected) { this.preview = null; return; }
    p.t += dt;
    const steps = Math.min(8, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < steps; i++) {
      // the preview turns now and then and waves or bows, like it knows it's being looked at
      const cyc = p.t % 9;
      const f = cyc > 4.5 ? -1 : 1;
      if (f !== p.b.facing) p.b.flip();
      const emote = cyc > 2.2 && cyc < 3.6 ? 'wave' : cyc > 6.6 && cyc < 7.8 ? 'bow' : null;
      p.an.update(1 / 120, { mode: emote ? 'emote' : 'ground', emote, x: 230, gy: 512, py: 400, vx: 0, vy: 0, runMax: 300, look: { x: 240 + f * 200, y: 230 } }, null);
      p.b.step(1 / 120, null);
      if (p.cape) p.cape.step(1 / 120, (p.b.x[P.NECK] + p.b.x[P.CHEST]) / 2 - 7, (p.b.y[P.NECK] + p.b.y[P.CHEST]) / 2, Math.sin(p.t * 1.3) * 25 - 10, 1);
    }
    const g = p.cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 480, 560);
    // a soft spotlight and a stone pedestal
    const sp = g.createRadialGradient(230, 240, 20, 230, 300, 300);
    sp.addColorStop(0, 'rgba(255,233,200,.18)'); sp.addColorStop(1, 'rgba(255,233,200,0)');
    g.fillStyle = sp; g.fillRect(0, 0, 480, 560);
    const ped = g.createLinearGradient(0, 512, 0, 560);
    ped.addColorStop(0, '#4a4550'); ped.addColorStop(1, '#2a2630');
    g.fillStyle = ped; g.beginPath(); g.ellipse(230, 528, 150, 30, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,240,220,.12)'; g.beginPath(); g.ellipse(230, 516, 140, 22, 0, 0, TAU); g.fill();
    const grd = g.createRadialGradient(230, 512, 10, 230, 512, 140);
    grd.addColorStop(0, 'rgba(0,0,0,.4)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.ellipse(230, 514, 120, 18, 0, 0, TAU); g.fill();
    drawBody(g, p.b, p.look, 1, { cape: p.cape, blade: this.sv.hasBlade, time: p.t, glows: [] });
  }
  tab_craft(body) {
    const g = this.game;
    body.appendChild(el('div', 'h', 'Crafting lives in your satchel'));
    body.appendChild(el('div', 'note', 'Open it with I or Tab (Q opens the crafting book), or the Bag button on touch. Simple things can be made anywhere; build a Workbench, Forge or Loom for the rest. A shrine fire works as a workbench.'));
    const b = el('button', 'big-btn primary', '<b>Open the satchel</b><span>Inventory and crafting</span>');
    b.onclick = () => { this.closeMenu(); setTimeout(() => this.bag.open({ page: 'craft' }), 50); };
    body.appendChild(b);
  }
  tab_together(body) {
    const g = this.game, net = g.net;
    const row = el('div', 'row');
    const c1 = el('div', 'col');
    c1.appendChild(el('div', 'h', 'Play together'));
    if (!net || !net.available) {
      c1.appendChild(el('div', 'note', 'Multiplayer needs a network connection. It will appear here when one is available.'));
    } else {
      const status = el('div', 'note', esc(net.statusText()));
      c1.appendChild(status);
      if (!net.active) {
        const inv = el('button', 'big-btn primary', '<b>Invite a friend</b><span>Open your world and share a link</span>');
        inv.onclick = async () => { await net.host(); this.renderMenu(); };
        c1.appendChild(inv);
        const pub = el('button', 'big-btn', '<b>Wander the open world</b><span>Meet strangers in a shared world</span>');
        pub.onclick = async () => { this.closeMenu(); await net.joinPublic(); };
        c1.appendChild(pub);
      } else {
        if (net.isHost && net.inviteUrl) {
          c1.appendChild(el('div', 'h', 'Invite link'));
          const code = el('div', 'code', esc(net.inviteUrl));
          c1.appendChild(code);
          const cp = el('button', 'mini-btn', 'Copy link');
          cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(net.inviteUrl).then(() => this.toast('Link copied')).catch(() => {}); };
          c1.appendChild(cp);
        }
        const lv = el('button', 'big-btn', '<b>Leave</b><span>Return to your own world</span>');
        lv.style.marginTop = '14px';
        lv.onclick = () => { net.leave(); this.renderMenu(); };
        c1.appendChild(lv);
      }
    }
    row.appendChild(c1);
    const c2 = el('div', 'col');
    c2.appendChild(el('div', 'h', 'Souls here'));
    const list = net && net.active ? net.roster() : [];
    c2.appendChild(el('div', 'stat', `<span>${esc(this.displayName())}</span><b>you</b>`));
    for (const r of list) c2.appendChild(el('div', 'stat', `<span>${esc(r.name)}</span><b>${r.host ? 'host' : ''}</b>`));
    c2.appendChild(el('div', 'note', 'Friends share your world, your gates and your fights. Wardens grow stronger for every soul in the arena. Press T to emote.'));
    row.appendChild(c2);
    body.appendChild(row);
  }
  tab_settings(body) {
    const g = this.game, st = g.settings;
    const row = el('div', 'row');
    const c1 = el('div', 'col');
    c1.appendChild(el('div', 'h', 'Sound'));
    for (const [k, name] of [['master', 'Master'], ['music', 'Music'], ['sfx', 'Effects']]) {
      const s = el('label', 'slider', `<span style="width:70px">${name}</span>`);
      const inp = document.createElement('input'); inp.type = 'range'; inp.min = 0; inp.max = 1; inp.step = 0.05; inp.value = Audio.vol[k];
      inp.oninput = () => { Audio.setVolume(k, +inp.value); st['vol_' + k] = +inp.value; };
      s.appendChild(inp); c1.appendChild(s);
    }
    const tg = (name, key, fn) => {
      const t = el('div', 'toggle' + (st[key] ? ' on' : ''), `<span>${name}</span><i></i>`);
      t.onclick = () => { st[key] = !st[key]; fn && fn(st[key]); t.classList.toggle('on', st[key]); Audio.play('blip'); };
      c1.appendChild(t);
    };
    tg('Mute', 'muted', v => Audio.setMuted(v));
    row.appendChild(c1);
    const c2 = el('div', 'col');
    c2.appendChild(el('div', 'h', 'Picture'));
    const tg2 = (name, key, fn) => {
      const on = key === 'shakeOn' ? st.shake > 0 : st[key];
      const t = el('div', 'toggle' + (on ? ' on' : ''), `<span>${name}</span><i></i>`);
      t.onclick = () => { fn(); this.renderMenu(); Audio.play('blip'); };
      c2.appendChild(t);
    };
    tg2('Screen shake', 'shakeOn', () => { st.shake = st.shake > 0 ? 0 : 1; });
    tg2('Bright flashes', 'flashes', () => { st.flashes = !st.flashes; });
    tg2('Bloom & grading', 'post', () => { st.post = !st.post; g.post.setEnabled && g.post.setEnabled(st.post); });
    tg2('Touch controls', 'touchOn', () => { st.touchOn = !st.touchOn; g.touchCtl && g.touchCtl.show(st.touchOn); });
    const q = el('div', 'slider', '<span style="width:70px">Quality</span>');
    for (const lv of ['low', 'medium', 'high']) {
      const b = el('button', 'mini-btn', lv); if (st.quality === lv) b.style.borderColor = '#ffd9a0';
      b.onclick = () => { st.quality = lv; st.qualityLocked = true; if (lv !== 'low' && st.post === false) { st.post = true; g.post.setEnabled && g.post.setEnabled(true); } g.resize(); this.renderMenu(); };
      q.appendChild(b);
    }
    c2.appendChild(q);
    const wipe = el('button', 'mini-btn', 'Start a new life');
    wipe.style.marginTop = '20px';
    wipe.onclick = () => {
      if (wipe.dataset.sure) { Save.wipe(this.game.world); location.reload(); }
      else { wipe.dataset.sure = 1; wipe.textContent = 'Erase everything? Tap again'; }
    };
    c2.appendChild(wipe);
    const terms = el('button', 'mini-btn', 'Terms & Privacy');
    terms.style.marginTop = '12px'; terms.style.marginLeft = '8px';
    terms.onclick = () => this.showTerms();
    c2.appendChild(terms);
    row.appendChild(c2);
    body.appendChild(row);
  }
  // in-game terms of use and privacy notice (plain text; no outside links). A template for the owner to
  // review and adapt; it is not legal advice.
  showTerms() {
    const body = $('#menu .menu-body');
    body.innerHTML = '';
    const back = el('button', 'mini-btn', 'Back to settings');
    back.onclick = () => this.renderMenu();
    body.appendChild(back);
    const t = el('div', 'terms');
    t.innerHTML = TERMS_HTML;
    body.appendChild(t);
  }
  tab_controls(body) {
    const rows = [
      ['A / D · Arrow keys', 'Walk'], ['Space · W', 'Jump (again in the air with Second Wind)'], ['Shift · K', 'Dash'],
      ['J · Left click', 'Strike (hold W or S to aim up or down)'], ['Hold left click', 'Break the block under the cursor'],
      ['Right click', 'Place the chosen block (Shift: as a back wall)'], ['1-9 · Wheel', 'Choose a block'],
      ['B', 'Build mode for keyboard / pad (Strike mines, E places)'], ['E', 'Talk · Rest · Take'], ['H (hold)', 'Mend a vessel with breath'],
      ['Q', 'Craft'], ['T', 'Emote'], ['M', 'Mute'], ['Esc', 'Menu'],
    ];
    const box = el('div', 'ctrl-list');
    for (const [k, v] of rows) { box.appendChild(el('kbd', '', esc(k))); box.appendChild(el('span', '', esc(v))); }
    body.appendChild(box);
    body.appendChild(el('div', 'note', 'Gamepad: stick to move, A jump, X strike, B dash, Y talk, LB build mode.'));
  }

  // ------------------------------------------------------------ per frame
  // runs right after input is polled, before the simulation consumes edges
  input(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    if (!this.bag) this.bag = new Bag(this);
    if (this.modal === 'dialog') { this.updateDialog(dt); return; }
    if (this.modal === 'bag') { this.bag.input(); return; }
    if (!this.modal && Input.pressed('bag') && !g.cinematic) { Input.consume('bag'); this.bag.open({ page: 'items' }); return; }
    if (!this.modal && Input.pressed('menu') && !g.cinematic) { Input.consume('menu'); this.openMenu('journey'); }
    else if (this.modal === 'menu' && Input.pressed('menu')) { Input.consume('menu'); this.closeMenu(); }
    if (!this.modal && Input.pressed('craft') && !g.cinematic) { Input.consume('craft'); this.bag.open({ page: 'craft' }); }
    if (!this.modal && Input.pressed('emote') && !g.cinematic) { Input.consume('emote'); this.emote(); }
  }
  frame(dt) {
    const g = this.game, p = g.player;
    if (this.bag) this.bag.frame(dt);
    // the boss bar only shows while a fight is actually on and you're in its arena
    { const B = g.bosses && g.bosses.active, A = g.bosses && g.bosses.arena;
      const on = B && !B.over && A && p && p.x > A.x0 - 200 && p.x < A.x1 + 200;
      if (!on) { const bb = $('#bossbar'); if (bb && !bb.classList.contains('hidden')) bb.classList.add('hidden'); } }
    if (g.quests && (this.qT = (this.qT || 0) - dt) <= 0) {
      this.qT = 0.4;
      const q = g.quests.trackedText(), box = $('#objective .ob-quest');
      if (box) {
        box.classList.toggle('hidden', !q || !!(g.story && g.story.tutStep && g.story.tutStep()));
        if (q) { box.querySelector('.q-name').textContent = q.name; box.querySelector('.q-text').textContent = q.text; box.querySelector('.q-hint').textContent = q.hint; }
      }
    }
    if (this.preview) this.tickPreview(dt);
    if (!p) return;
    if (g.touch) g.touch.frame();
    const sv = this.sv;
    // vessels
    if (p.hp !== this.lastHp || sv.maxHp !== this.lastMax) {
      const box = $('#vessels');
      if (box.childElementCount !== sv.maxHp) { box.innerHTML = ''; for (let i = 0; i < sv.maxHp; i++) box.appendChild(el('div', 'vessel')); }
      [...box.children].forEach((v, i) => {
        const full = i < p.hp;
        if (!full && v.classList.contains('full')) { v.classList.remove('lost'); void v.offsetWidth; v.classList.add('lost'); }
        v.classList.toggle('full', full);
      });
      this.lastHp = p.hp; this.lastMax = sv.maxHp;
    }
    $('#breath-fill').style.width = clamp(sv.breath || 0, 0, 100) + '%';
    if (g.levels && (this.lastLv !== sv.level || this.lastXp !== sv.xp)) { this.lastLv = sv.level; this.lastXp = sv.xp; this.xpBar(sv.level || 1, (sv.xp || 0) / g.levels.need(sv.level || 1)); $('#xp').classList.toggle('pick', sv.perkPicks > 0); }
    const gl = $('#glimmer-n'); if (gl.textContent != sv.glimmer) gl.textContent = sv.glimmer;
    // hotbar
    if (this.hotbarDirty || this.lastSel !== sv.sel) this.renderHotbar();
    // prompt
    const pr = $('#prompt');
    const it = p.interact;
    if (it && !this.modal && !g.cinematic) {
      const html = `<kbd>${g.touch ? 'E' : 'E'}</kbd>${esc(it.label)}`;
      if (pr.dataset.h !== html) { pr.innerHTML = html; pr.dataset.h = html; }
      pr.classList.remove('hidden');
    } else pr.classList.add('hidden');
    // compass toward the next unbeaten gate in the facing direction
    if ((g.frame % 15) === 0) {
      const ptx = Math.floor(p.x / TILE);
      let best = null;
      for (const d of [p.actor.facing, -p.actor.facing]) {
        let gi = gateNear(ptx);
        if ((gi.gx - ptx) * d < 0) gi = gateNear(ptx + d * 340);
        if ((gi.gx - ptx) * d < 0) continue;
        if (!sv.bosses['g' + gi.k]) { best = { gi, d }; break; }
      }
      const c = $('#compass');
      if (best && !(g.bosses && g.bosses.active)) {
        const B = BOSS_TYPES[biomeOf(best.gi.guard).id];
        const dist = Math.abs(best.gi.gx - ptx);
        c.innerHTML = `${best.d < 0 ? '<i class="chev l"></i>' : ''}<b>${esc(B.name)}</b> · ${dist} m${best.d > 0 ? '<i class="chev r"></i>' : ''}`;
      } else c.innerHTML = '';
    }
  }
  pausedTick(dt) { /* menus animate via CSS; dialog/preview run in frame() */ }
  renderHotbar() {
    const sv = this.sv, box = $('#hotbar'), g = this.game;
    box.innerHTML = '';
    sv.hotbar.forEach((t, i) => {
      const s = el('div', 'slot' + (i === sv.sel ? ' sel' : ''));
      s.appendChild(itemIconEl(t, 28));
      s.appendChild(el('span', 'k', i + 1));
      s.appendChild(el('span', 'n', sv.inv[t] || 0));
      // tapping the slot in hand again uses a consumable (throw a flare, drink a draught)
      s.onclick = () => { if (sv.sel === i && usable(t) && g.player) g.player.useQueued = true; sv.sel = i; Audio.play('blip'); };
      box.appendChild(s);
    });
    this.hotbarDirty = false; this.lastSel = sv.sel;
  }
  emote() {
    const g = this.game, a = g.player.actor;
    const list = ['wave', 'cheer', 'bow', 'point'];
    this.emoteI = ((this.emoteI ?? -1) + 1) % list.length;
    a.doEmote(list[this.emoteI], 1.8);
    if (g.net && g.net.active) g.net.sendEmote(list[this.emoteI]);
  }
}
const TERMS_HTML = `
<h3>On Two Feet: Terms of Use</h3>
<p>Last updated: November 2026. By playing On Two Feet ("the game") you agree to these terms. If you do not agree, please do not play.</p>
<p><b>Using the game.</b> The game is provided for personal, non-commercial entertainment. Please do not cheat, exploit bugs to harm other players, disrupt multiplayer sessions, or try to access parts of the game or its services you are not meant to.</p>
<p><b>Playing with others.</b> Multiplayer has no text chat; players meet through emotes and play together. Be kind. Do not use names or behaviour that harass, threaten or impersonate others. Hosts can end a session at any time.</p>
<p><b>Your creations.</b> What you build in your world is yours to enjoy. When you host or join a shared world, other players can see and change what is built there.</p>
<p><b>Availability.</b> The game is provided "as is" and may change, pause or end at any time. Saved progress can be lost (for example if browser data is cleared). We are not liable for lost progress or for damages arising from use of the game, to the extent the law allows.</p>
<p><b>Platform.</b> When you play on CrazyGames, the CrazyGames terms and privacy policy also apply, including to accounts, ads and payments they provide.</p>
<h3>Privacy</h3>
<p><b>What the game stores.</b> Your save (world edits, progress, settings and your doll's look) is stored by the CrazyGames data service when available, otherwise in your browser's local storage on this device. It contains no personal information. You can erase it at any time with "Start a new life".</p>
<p><b>Accounts.</b> If you are signed in to CrazyGames, the game may read your public username to show it above your doll. It does not receive your email or password.</p>
<p><b>Multiplayer.</b> Playing together uses direct peer-to-peer connections (WebRTC) set up through a connection broker. To connect, your network address is shared with the players in your session and with the broker. The game sends your doll's movement, emotes, look and block edits to those players and nothing else.</p>
<p><b>Ads.</b> Ads are served by CrazyGames. Rewarded ads only ever play when you choose them. Ad providers may collect data under the CrazyGames privacy policy and your consent choices there.</p>
<p><b>Children.</b> The game does not knowingly collect personal information from anyone, including children.</p>
<p><b>Contact.</b> Questions about these terms or your data can be sent through the game's page on CrazyGames.</p>
<h3>Credits</h3>
<p>Fonts: Cormorant Garamond and Manrope (SIL Open Font License). Networking: PeerJS (MIT). All other art, music and code were made for this game.</p>
`;
export { esc };
