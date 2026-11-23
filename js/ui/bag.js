// The satchel: a cinematic inventory and crafting screen. The world keeps moving behind it in slow motion,
// the camera leans in, the doll sits down and opens its bag. Left: everything you carry, sorted by kind,
// with gear slots and the hotbar. Right: the crafting book; what you can make depends on what you carry and
// which stations are near. Crafting is a small ceremony: the ingredients fly into a ring, it turns and
// flashes, and the new thing drops into the satchel.
import { Input } from '../core/input.js';
import { Audio } from '../core/audio.js';
import { TILES, T } from '../world/tiles.js';
import { RECIPES, ITEMS, STATION_NAMES, itemName, itemCat, itemDesc, isGear, usable, placeable, onHotbar, stationsNear, canCraft, norm } from '../game/items.js';
import { itemIconEl } from '../art/itemart.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
const CATS = [['all', 'All'], ['block', 'Blocks'], ['part', 'Parts'], ['use', 'Use'], ['gear', 'Gear']];
const GEAR_SLOTS = [['lamp', 'Lamp'], ['pick', 'Pick'], ['charm', 'Charm']];

export class Bag {
  constructor(ui) {
    this.ui = ui; this.game = ui.game;
    this.root = el('div', 'hidden'); this.root.id = 'bag';
    document.getElementById('ui').appendChild(this.root);
    this.open_ = false; this.cat = 'all'; this.sel = null; this.rsel = 0; this.chest = null; this.busy = false; this.k = 0;
    this.root.addEventListener('pointerdown', e => e.stopPropagation());
  }
  get isOpen() { return this.open_; }

  // ---------------------------------------------------------------- open / close
  open(o = {}) {
    const g = this.game, p = g.player;
    if (!p || p.dead || g.cinematic || this.ui.modal) return;
    this.open_ = true; this.chest = o.chest || null; this.focus = o.page || 'craft';
    this.ui.modal = 'bag';
    this.root.classList.remove('hidden', 'out');
    document.body.classList.add('bag-open');
    this.ui.letterbox(true);
    // cinematic: slow time, lean the camera in, sit down
    g.slowTarget = 0.18; g.slowT = 1e9;
    g.cam.zoomT = 1.28;
    p.actor.sitting = true;
    Audio.play('blip', { pitch: 0.7 }); Audio.play('place', { pitch: 1.5, vol: 0.4 });
    this.near = stationsNear(g);
    this.render();
    if (g.story && g.story.tut) g.story.tut.bagOpened = 1;
  }
  close() {
    if (!this.open_) return;
    const g = this.game;
    this.open_ = false; this.busy = false;
    this.ui.modal = null;
    this.root.classList.add('out');
    setTimeout(() => { if (!this.open_) this.root.classList.add('hidden'); }, 260);
    document.body.classList.remove('bag-open');
    this.ui.letterbox(false);
    g.slowTarget = 1; g.slowT = 0;
    g.cam.zoomT = 1;
    if (g.player) g.player.actor.sitting = false;
    this.ui.hotbarDirty = true;
    Audio.play('blip', { pitch: 0.55 });
    g.saveNow && g.saveNow();
  }
  // keys while open (called from ui.input)
  input() {
    if (Input.pressed('bag') || Input.pressed('menu') || (Input.pressed('craft') && !this.chest)) { Input.consume('bag'); Input.consume('menu'); Input.consume('craft'); this.close(); return; }
    const list = this.visibleRecipes();
    if (Input.pressed('down')) { Input.consume('down'); this.rsel = Math.min(list.length - 1, this.rsel + 1); this.renderRecipes(); }
    if (Input.pressed('up') || Input.pressed('jump')) { Input.consume('up'); Input.consume('jump'); this.rsel = Math.max(0, this.rsel - 1); this.renderRecipes(); }
    if (Input.pressed('interact') || Input.keys.has('Enter') && !this.enterHeld) { Input.consume('interact'); this.enterHeld = true; this.craft(list[this.rsel]); }
    if (!Input.keys.has('Enter')) this.enterHeld = false;
    for (let i = 1; i <= 9; i++) if (Input.pressed('slot' + i)) { Input.consume('slot' + i); if (this.sel !== null && onHotbar(this.sel)) this.assign(this.sel, i - 1); }
  }
  // per frame: ease the cinematic grade in and out
  frame(dt) {
    const g = this.game;
    this.k += ((this.open_ ? 1 : 0) - this.k) * Math.min(1, dt * 7);
    g.bagK = this.k;
    if (this.open_) {
      const n = stationsNear(g);
      if (JSON.stringify(n) !== JSON.stringify(this.near)) { this.near = n; this.renderRecipes(); this.renderStations(); }
    }
  }

  // ---------------------------------------------------------------- data helpers
  get sv() { return this.game.player.sv; }
  items() {
    const inv = this.sv.inv, out = [];
    for (const id in inv) if (inv[id] > 0) out.push(norm(id));
    const order = { gear: 0, use: 1, station: 2, part: 3, block: 4 };
    out.sort((a, b) => (order[itemCat(a)] - order[itemCat(b)]) || String(itemName(a)).localeCompare(itemName(b)));
    return out;
  }
  inCat(id) {
    const c = itemCat(id);
    return this.cat === 'all' || c === this.cat || (this.cat === 'part' && c === 'station');
  }
  visibleRecipes() {
    // what you can make first, then what's missing ingredients, then what needs a station that isn't near
    const sv = this.sv, near = this.near || { hand: true };
    const rank = (r) => canCraft(sv, r, near) ? 0 : (!r.st || near[r.st]) ? 1 : 2;
    return RECIPES.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map(o => o.r);
  }

  // ---------------------------------------------------------------- render
  render() {
    const R = this.root;
    R.innerHTML = '';
    const left = el('div', 'bag-panel bag-l'), right = el('div', 'bag-panel bag-r');
    left.appendChild(el('div', 'bag-h', `<b>Satchel</b><span class="sub">${this.items().length} kinds carried</span>`));
    const chips = el('div', 'bag-chips');
    for (const [k, n] of CATS) {
      const b = el('button', 'chip' + (this.cat === k ? ' on' : ''), n);
      b.onclick = () => { this.cat = k; Audio.play('blip', { pitch: 1.2 }); this.render(); };
      chips.appendChild(b);
    }
    left.appendChild(chips);
    this.grid = el('div', 'bag-grid');
    left.appendChild(this.grid);
    this.detail = el('div', 'bag-detail');
    left.appendChild(this.detail);
    const eq = el('div', 'bag-equip');
    eq.appendChild(el('div', 'lbl', 'Worn'));
    for (const [slot, n] of GEAR_SLOTS) {
      const id = this.sv.equip[slot];
      const s = el('div', 'eslot' + (id ? ' full' : ''));
      if (id) s.appendChild(itemIconEl(id, 34)); else s.appendChild(el('span', 'ph', n));
      s.title = id ? itemName(id) : n;
      s.onclick = () => { if (id) { this.sel = id; this.renderDetail(); } };
      eq.appendChild(s);
    }
    left.appendChild(eq);
    R.appendChild(left);

    if (this.chest) this.renderChestPanel(right);
    else {
      const h = el('div', 'bag-h', '<b>Crafting</b>');
      this.stationsEl = el('div', 'bag-stations');
      h.appendChild(this.stationsEl);
      right.appendChild(h);
      this.recipesEl = el('div', 'bag-recipes');
      right.appendChild(this.recipesEl);
      this.forge = el('div', 'bag-forge');
      right.appendChild(this.forge);
    }
    R.appendChild(right);

    // hotbar row
    const hb = el('div', 'bag-hot');
    hb.appendChild(el('div', 'lbl', 'Hotbar'));
    this.hotEl = el('div', 'slots');
    hb.appendChild(this.hotEl);
    R.appendChild(hb);
    const x = el('button', 'bag-x', 'Close');
    x.onclick = () => this.close();
    R.appendChild(x);

    this.renderGrid(); this.renderDetail(); this.renderHot();
    if (!this.chest) { this.renderStations(); this.renderRecipes(); }
  }
  slotEl(id, n, size = 40) {
    const s = el('div', 'bslot');
    s.appendChild(itemIconEl(id, size));
    if (n > 1) s.appendChild(el('span', 'n', n));
    s.dataset.id = id;
    return s;
  }
  renderGrid() {
    const g = this.grid; if (!g) return;
    g.innerHTML = '';
    const list = this.items().filter(id => this.inCat(id));
    if (!list.length) g.appendChild(el('div', 'empty', this.cat === 'all' ? 'Your satchel is empty. Break blocks, cut trees, open chests.' : 'Nothing of this kind yet.'));
    for (const id of list) {
      const s = this.slotEl(id, this.sv.inv[id]);
      if (this.sel === id) s.classList.add('on');
      if (Object.values(this.sv.equip).includes(id)) s.classList.add('worn');
      s.draggable = onHotbar(id);
      s.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(id)); });
      s.onclick = () => {
        if (this.chest) { this.moveToChest(id, 1); return; }
        this.sel = id; Audio.play('blip', { pitch: 1.4 }); this.renderGrid(); this.renderDetail();
      };
      g.appendChild(s);
    }
  }
  renderDetail() {
    const d = this.detail; if (!d) return;
    d.innerHTML = '';
    const id = this.sel;
    if (id === null || !(this.sv.inv[id] > 0)) { d.appendChild(el('div', 'hint', this.chest ? 'Tap an item to put it in the chest.' : 'Tap an item to see it. Drag it, or tap it then a hotbar slot, to carry it in hand.')); return; }
    const top = el('div', 'dtop');
    top.appendChild(itemIconEl(id, 46));
    top.appendChild(el('div', 'dtx', `<b>${esc(itemName(id))}</b><span>${esc(itemDesc(id))}</span>`));
    d.appendChild(top);
    const acts = el('div', 'dacts');
    const add = (label, fn, primary) => { const b = el('button', 'btn' + (primary ? ' primary' : ''), label); b.onclick = fn; acts.appendChild(b); };
    if (isGear(id)) {
      const slot = ITEMS[id].slot, worn = this.sv.equip[slot] === id;
      add(worn ? 'Take off' : 'Wear', () => this.equip(id, worn ? null : slot), true);
    }
    if (id === 'i_draught') add('Drink', () => { this.game.player.useItem(id, null); this.render(); }, true);
    if (usable(id) && id !== 'i_draught') add('Take in hand', () => { this.assign(id, this.hotIndex(id)); this.selectHot(id); this.close(); }, true);
    if (placeable(id)) add('Take in hand', () => { this.assign(id, this.hotIndex(id)); this.selectHot(id); this.close(); });
    d.appendChild(acts);
  }
  hotIndex(id) { const h = this.sv.hotbar; const i = h.indexOf(id); return i >= 0 ? i : Math.min(h.length, 8); }
  selectHot(id) { const i = this.sv.hotbar.indexOf(id); if (i >= 0) this.sv.sel = i; this.ui.hotbarDirty = true; }
  renderHot() {
    const box = this.hotEl; if (!box) return;
    box.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const id = this.sv.hotbar[i];
      const s = id !== undefined ? this.slotEl(id, this.sv.inv[id] || 0, 30) : el('div', 'bslot empty');
      s.appendChild(el('span', 'k', i + 1));
      if (i === this.sv.sel) s.classList.add('sel');
      s.onclick = () => {
        if (this.sel !== null && onHotbar(this.sel)) { this.assign(this.sel, i); return; }
        if (id !== undefined) { this.sv.sel = i; this.ui.hotbarDirty = true; this.renderHot(); }
      };
      s.addEventListener('dragover', e => e.preventDefault());
      s.addEventListener('drop', e => { e.preventDefault(); const v = norm(e.dataTransfer.getData('text/plain')); if (onHotbar(v)) this.assign(v, i); });
      box.appendChild(s);
    }
  }
  assign(id, i) {
    const h = this.sv.hotbar;
    id = norm(id);
    const cur = h.indexOf(id);
    if (cur === i) return;
    if (i >= h.length) { if (cur >= 0) h.splice(cur, 1); h.push(id); }
    else if (cur >= 0) { const t = h[i]; h[i] = id; h[cur] = t; }
    else h[i] = id;
    while (h.length > 9) h.pop();
    Audio.play('place', { pitch: 1.6, vol: 0.5 });
    this.ui.hotbarDirty = true;
    this.renderHot();
  }
  equip(id, slot) {
    const eq = this.sv.equip;
    if (slot) eq[slot] = id; else for (const k in eq) if (eq[k] === id) delete eq[k];
    Audio.play('confirm');
    this.game.player.refreshLook();
    this.render();
  }
  renderStations() {
    const box = this.stationsEl; if (!box) return;
    box.innerHTML = '';
    for (const k of ['hand', 'bench', 'forge', 'loom']) {
      const on = this.near[k];
      box.appendChild(el('span', 'st' + (on ? ' on' : ''), STATION_NAMES[k]));
    }
  }
  renderRecipes() {
    const box = this.recipesEl; if (!box) return;
    box.innerHTML = '';
    const list = this.visibleRecipes();
    this.rsel = Math.max(0, Math.min(this.rsel, list.length - 1));
    list.forEach((r, i) => {
      const ok = canCraft(this.sv, r, this.near), here = !r.st || this.near[r.st];
      const row = el('div', 'rec' + (ok ? ' ok' : '') + (here ? '' : ' locked') + (i === this.rsel ? ' on' : ''));
      row.appendChild(itemIconEl(r.out, 30));
      const tx = el('div', 'rtx', `<b>${esc(itemName(r.out))}${r.n > 1 ? ' x' + r.n : ''}</b><span>${here ? r.need.map(([id, n]) => `${n} ${esc(itemName(id))}`).join(' · ') : 'Needs a ' + esc(STATION_NAMES[r.st]) + ' nearby'}</span>`);
      row.appendChild(tx);
      row.onclick = () => { this.rsel = i; Audio.play('blip', { pitch: 1.3 }); this.renderRecipes(); };
      box.appendChild(row);
    });
    const on = box.children[this.rsel];
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
    this.renderForge(list[this.rsel]);
  }
  renderForge(r) {
    const f = this.forge; if (!f) return;
    f.innerHTML = '';
    if (!r) return;
    const ok = canCraft(this.sv, r, this.near), here = !r.st || this.near[r.st];
    const ring = el('div', 'ring');
    ring.appendChild(itemIconEl(r.out, 54));
    if (r.n > 1) ring.appendChild(el('span', 'n', 'x' + r.n));
    this.ringEl = ring;
    f.appendChild(ring);
    const info = el('div', 'finfo');
    info.appendChild(el('div', 'fname', `<b>${esc(itemName(r.out))}</b><span>${esc(itemDesc(r.out))}</span>`));
    const need = el('div', 'fneed');
    this.needEls = [];
    for (const [id, n] of r.need) {
      const have = this.sv.inv[id] || 0;
      const c = el('div', 'ing' + (have >= n ? ' ok' : ''));
      const ic = itemIconEl(id, 26); c.appendChild(ic);
      c.appendChild(el('span', '', `${Math.min(have, 999)}/${n}`));
      c.title = itemName(id);
      need.appendChild(c); this.needEls.push(ic);
    }
    info.appendChild(need);
    const btn = el('button', 'btn primary craft', here ? (ok ? 'Craft' : 'Missing ingredients') : 'Needs a ' + STATION_NAMES[r.st]);
    btn.disabled = !ok;
    // hold to keep crafting
    const start = (e) => { e.preventDefault(); this.holding = true; this.craft(r); };
    const stop = () => { this.holding = false; };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop); btn.addEventListener('pointerleave', stop); btn.addEventListener('pointercancel', stop);
    info.appendChild(btn);
    if (ok) info.appendChild(el('div', 'hold', 'hold to make several'));
    f.appendChild(info);
  }

  // ---------------------------------------------------------------- crafting ceremony
  craft(r) {
    const g = this.game, p = g.player;
    if (!r || this.busy || !canCraft(this.sv, r, this.near)) { if (r && !this.busy) Audio.play('blip', { pitch: 0.5, vol: 0.5 }); return; }
    this.busy = true;
    for (const [id, n] of r.need) p.take(id, n);
    const ring = this.ringEl, rr = ring ? ring.getBoundingClientRect() : null;
    // ingredients fly into the ring
    if (rr && this.needEls) {
      this.needEls.forEach((ic, k) => {
        const a = ic.getBoundingClientRect();
        const c = ic.cloneNode(true); c.getContext('2d').drawImage(ic, 0, 0);
        c.className = 'flyer'; c.style.left = a.left + 'px'; c.style.top = a.top + 'px';
        document.body.appendChild(c);
        const dx = rr.left + rr.width / 2 - a.left - a.width / 2, dy = rr.top + rr.height / 2 - a.top - a.height / 2;
        c.animate([{ transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 }, { transform: `translate(${dx * 0.6}px,${dy * 0.6 - 30}px) scale(1.1) rotate(90deg)`, opacity: 1, offset: 0.55 }, { transform: `translate(${dx}px,${dy}px) scale(0.2) rotate(220deg)`, opacity: 0 }], { duration: 520, delay: k * 70, easing: 'cubic-bezier(.5,0,.5,1)', fill: 'forwards' }).onfinish = () => c.remove();
      });
    }
    if (ring) { ring.classList.remove('spin', 'flash'); void ring.offsetWidth; ring.classList.add('spin'); }
    Audio.play('swing', { pitch: 1.6, vol: 0.4 });
    setTimeout(() => {
      p.give(r.out, r.n);
      this.sv.crafted = (this.sv.crafted || 0) + r.n;
      if (g.story && g.story.tut) g.story.tut.crafted = 1;
      Audio.play('confirm'); Audio.play('place', { pitch: 1.3 });
      g.fx.burst(p.actor.c.x + p.actor.facing * 12, p.actor.c.y - 34, { n: 14, speed: 140, col: '#ffffff', col1: '#ffd9a0', add: true, life: 0.6, size: 2.4, kind: 'mote' });
      if (ring) { ring.classList.add('flash'); }
      // the result drops into the satchel
      if (rr) {
        const c = itemIconEl(r.out, 54); c.className = 'flyer big';
        c.style.left = (rr.left + rr.width / 2 - 27) + 'px'; c.style.top = (rr.top + rr.height / 2 - 27) + 'px';
        document.body.appendChild(c);
        const gr = this.grid && this.grid.getBoundingClientRect();
        const tx = gr ? gr.left + 30 - (rr.left + rr.width / 2 - 27) : 0, ty = gr ? gr.top + 20 - (rr.top + rr.height / 2 - 27) : 120;
        c.animate([{ transform: 'translate(0,0) scale(1.3)', opacity: 1 }, { transform: 'translate(0,-24px) scale(1.5)', opacity: 1, offset: 0.3 }, { transform: `translate(${tx}px,${ty}px) scale(0.5)`, opacity: 0.2 }], { duration: 560, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' }).onfinish = () => c.remove();
      }
      this.renderGrid(); this.renderHot(); this.renderDetail();
      setTimeout(() => {
        this.busy = false;
        this.renderRecipes();
        if (this.holding && canCraft(this.sv, r, this.near)) this.craft(r);
      }, 320);
    }, 560);
  }

  // ---------------------------------------------------------------- storage chests
  renderChestPanel(right) {
    const st = this.sv.stores[this.chest] || (this.sv.stores[this.chest] = {});
    right.appendChild(el('div', 'bag-h', '<b>Storage chest</b><span class="sub">tap to take back</span>'));
    const grid = el('div', 'bag-grid chest');
    const ids = Object.keys(st).filter(k => st[k] > 0).map(norm);
    if (!ids.length) grid.appendChild(el('div', 'empty', 'Empty. Tap things in your satchel to store them here.'));
    for (const id of ids) {
      const s = this.slotEl(id, st[id]);
      s.onclick = () => this.moveFromChest(id, 1);
      grid.appendChild(s);
    }
    right.appendChild(grid);
    const all = el('button', 'btn', 'Store all blocks');
    all.onclick = () => { for (const id of this.items()) if (itemCat(id) === 'block') this.moveToChest(id, this.sv.inv[id], true); this.render(); };
    right.appendChild(all);
  }
  moveToChest(id, n, quiet) {
    const st = this.sv.stores[this.chest];
    n = Math.min(n, this.sv.inv[id] || 0);
    if (!n || !this.game.player.take(id, n)) return;
    st[id] = (st[id] || 0) + n;
    if (!quiet) { Audio.play('place', { pitch: 1.4, vol: 0.4 }); this.render(); }
  }
  moveFromChest(id, n) {
    const st = this.sv.stores[this.chest];
    n = Math.min(n, st[id] || 0);
    if (!n) return;
    st[id] -= n; if (st[id] <= 0) delete st[id];
    this.game.player.give(id, n);
    Audio.play('place', { pitch: 1.6, vol: 0.4 });
    this.render();
  }
}
export { T };
