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
import { WEAPONS } from '../game/weapons.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
const CATS = [['all', 'All'], ['block', 'Blocks'], ['part', 'Parts'], ['use', 'Use'], ['gear', 'Gear']];
const CAT_NAME = { block: 'Block', part: 'Building part', station: 'Station', use: 'Consumable', gear: 'Gear' };
const GEAR_SLOTS = [['weapon', 'Weapon'], ['lamp', 'Lamp'], ['pick', 'Pick'], ['charm', 'Charm']];
const RCATS = [['all', 'All'], ['build', 'Build'], ['weapons', 'Arms'], ['tools', 'Tools'], ['use', 'Use']];
const RAR = ['Common', 'Fine', 'Rare', 'Storied'];
const RAR_COL = ['#e9dcc6', '#9fe0a8', '#8fc8ff', '#d7a8ff'];
const FINE = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
// rarity: plain blocks are common; consumables and precious stone are fine; gear and stations rare; the best gear storied
export function rarity(id) {
  id = norm(id); const c = itemCat(id);
  if (id === 'g_pick_crystal' || id === 'w_hammer' || id === 'w_daggers' || String(id).startsWith('g_charm')) return 3;
  if (c === 'gear' || c === 'station' || String(id).startsWith('i_infuse')) return 2;
  if (c === 'use' || [T.CRYSTAL, T.GOLD, T.OBSIDIAN, T.EMBER, T.GLASS, T.MARBLE, T.LANTERN].includes(id)) return 1;
  return 0;
}
function recipeCat(r) {
  const id = r.out, c = itemCat(id);
  if (ITEMS[id] && (ITEMS[id].slot === 'weapon' || String(id).startsWith('i_infuse'))) return 'weapons';
  if (c === 'gear') return 'tools';
  if (c === 'use') return 'use';
  return 'build';
}
// bars for the detail card: weapons get damage/reach/speed/stagger, picks their mining speed
function statsOf(id) {
  const W = WEAPONS[id];
  if (W) return [['Damage', W.dmg / 22, String(W.dmg)], ['Reach', W.ranged ? 1 : W.len / 54, W.ranged ? 'Far' : W.len < 25 ? 'Short' : W.len > 45 ? 'Long' : 'Mid'], ['Speed', W.speed / 1.5, W.speed >= 1.4 ? 'Swift' : W.speed < 0.8 ? 'Slow' : 'Even'], ['Stagger', W.poise / 30, String(W.poise)]];
  if (ITEMS[id] && ITEMS[id].mine) return [['Mining', ITEMS[id].mine / 2.6, 'x' + ITEMS[id].mine]];
  return [];
}
// the crafting ring: two counter-turning rings of marks around the result
const RING_SVG = '<svg class="rsvg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" class="o"/><circle cx="50" cy="50" r="47" class="ticks"/><circle cx="50" cy="50" r="39" class="i"/><g class="runes">'
  + Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2, x = 50 + Math.cos(a) * 43, y = 50 + Math.sin(a) * 43; return `<rect x="${(x - 1.6).toFixed(1)}" y="${(y - 1.6).toFixed(1)}" width="3.2" height="3.2" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join('') + '</g></svg>';

export class Bag {
  constructor(ui) {
    this.ui = ui; this.game = ui.game;
    this.root = el('div', 'hidden'); this.root.id = 'bag';
    document.getElementById('ui').appendChild(this.root);
    this.open_ = false; this.cat = 'all'; this.rcat = 'all'; this.count = 1; this.sel = null; this.rsel = 0; this.chest = null; this.busy = false; this.k = 0;
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
    if (Input.pressed('interact') || Input.keys.has('Enter') && !this.enterHeld) { Input.consume('interact'); this.enterHeld = true; this.craft(list[this.rsel], this.count); }
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
      if (JSON.stringify(n) !== JSON.stringify(this.near)) { this.near = n; this.renderRecipes(); this.renderStations(); this.renderRcats(); }
    }
  }

  // ---------------------------------------------------------------- data helpers
  get sv() { return this.game.player.sv; }
  items() {
    const inv = this.sv.inv, out = [];
    for (const id in inv) if (inv[id] > 0) out.push(norm(id));
    const order = { gear: 0, use: 1, station: 2, part: 3, block: 4 };
    out.sort((a, b) => (order[itemCat(a)] - order[itemCat(b)]) || rarity(b) - rarity(a) || String(itemName(a)).localeCompare(itemName(b)));
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
    return RECIPES.map((r, i) => ({ r, i })).filter(o => this.rcat === 'all' || recipeCat(o.r) === this.rcat)
      .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map(o => o.r);
  }
  // how many times this recipe can be made from what you carry
  maxCraft(r) {
    if (!canCraft(this.sv, r, this.near)) return 0;
    let m = 99;
    for (const [id, n] of r.need) m = Math.min(m, Math.floor((this.sv.inv[id] || 0) / n));
    return Math.max(0, m);
  }

  // ---------------------------------------------------------------- render
  render() {
    const R = this.root, sv = this.sv;
    R.innerHTML = '';
    const left = el('div', 'bag-panel bag-l'), right = el('div', 'bag-panel bag-r');
    left.appendChild(el('div', 'bag-h', `<i class="bag-ico satchel"></i><b>Satchel</b><span class="sub">${this.items().length} kinds</span><span class="glim" title="Glimmer"><i></i>${sv.glimmer | 0}</span>`));
    const chips = el('div', 'bag-chips');
    for (const [k, n] of CATS) {
      const cnt = k === 'all' ? this.items().length : this.items().filter(id => itemCat(id) === k || (k === 'part' && itemCat(id) === 'station')).length;
      const b = el('button', 'chip' + (this.cat === k ? ' on' : ''), `<i class="ci ci-${k}"></i>${n}${cnt ? `<em>${cnt}</em>` : ''}`);
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
      const id = sv.equip[slot];
      const s = el('div', 'eslot ' + slot + (id ? ' full r' + rarity(id) : ''));
      if (id) s.appendChild(itemIconEl(id, slot === 'weapon' ? 36 : 30)); else s.appendChild(el('i', 'ci ci-' + slot));
      s.appendChild(el('span', 'en', id ? esc(itemName(id)) : n));
      s.onclick = () => { if (id) { this.sel = id; Audio.play('blip', { pitch: 1.4 }); this.renderGrid(); this.renderDetail(); } };
      this.tipOn(s, id);
      eq.appendChild(s);
    }
    left.appendChild(eq);
    R.appendChild(left);

    if (this.chest) this.renderChestPanel(right);
    else {
      const h = el('div', 'bag-h', '<i class="bag-ico book"></i><b>Crafting</b>');
      this.stationsEl = el('div', 'bag-stations');
      h.appendChild(this.stationsEl);
      right.appendChild(h);
      this.rcatsEl = el('div', 'bag-chips rcats');
      right.appendChild(this.rcatsEl);
      this.recipesEl = el('div', 'bag-recipes');
      right.appendChild(this.recipesEl);
      this.forge = el('div', 'bag-forge');
      right.appendChild(this.forge);
    }
    R.appendChild(right);

    // hotbar row
    const hb = el('div', 'bag-hot');
    hb.appendChild(el('div', 'lbl', 'In hand'));
    this.hotEl = el('div', 'slots');
    hb.appendChild(this.hotEl);
    R.appendChild(hb);
    const x = el('button', 'bag-x', '<i></i>Close');
    x.onclick = () => this.close();
    R.appendChild(x);
    this.tip = el('div', 'bag-tip hidden');
    R.appendChild(this.tip);

    this.renderGrid(); this.renderDetail(); this.renderHot();
    if (!this.chest) { this.renderStations(); this.renderRcats(); this.renderRecipes(); }
  }
  // a hover card on devices with a mouse
  tipOn(node, id) {
    if (!FINE || id === undefined || id === null) return;
    node.addEventListener('pointerenter', () => {
      const t = this.tip; if (!t) return;
      const r = rarity(id);
      t.className = 'bag-tip r' + r;
      t.innerHTML = `<b>${esc(itemName(id))}</b><span class="rt">${RAR[r]} · ${esc(CAT_NAME[itemCat(id)] || '')}</span><span class="dd">${esc(itemDesc(id))}</span>`;
      const a = node.getBoundingClientRect(), W = innerWidth;
      t.style.left = Math.min(W - 250, a.right + 10) + 'px'; t.style.top = Math.max(8, a.top - 4) + 'px';
    });
    node.addEventListener('pointerleave', () => this.tip && this.tip.classList.add('hidden'));
  }
  slotEl(id, n, size = 40) {
    const s = el('div', 'bslot r' + rarity(id));
    s.appendChild(itemIconEl(id, size));
    if (n > 1) s.appendChild(el('span', 'n', n > 999 ? '999+' : n));
    s.dataset.id = id;
    return s;
  }
  renderGrid() {
    const g = this.grid; if (!g) return;
    g.innerHTML = '';
    const list = this.items().filter(id => this.inCat(id));
    if (!list.length) g.appendChild(el('div', 'empty', this.cat === 'all' ? 'Your satchel is empty. Break blocks, strike trees, open chests.' : 'Nothing of this kind yet.'));
    list.forEach((id, k) => {
      const s = this.slotEl(id, this.sv.inv[id]);
      s.style.setProperty('--i', k);
      if (this.sel === id) s.classList.add('on');
      if (Object.values(this.sv.equip).includes(id)) s.classList.add('worn');
      s.draggable = onHotbar(id);
      s.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(id)); });
      s.onclick = () => {
        if (this.chest) { this.moveToChest(id, 1); return; }
        this.sel = id; Audio.play('blip', { pitch: 1.4 }); this.renderGrid(); this.renderDetail();
      };
      this.tipOn(s, id);
      g.appendChild(s);
    });
    // a few empty frames so the satchel reads as a bag with room in it
    const pad = Math.max(0, 12 - list.length);
    for (let i = 0; i < pad && list.length; i++) g.appendChild(el('div', 'bslot void'));
  }
  renderDetail() {
    const d = this.detail; if (!d) return;
    d.innerHTML = ''; d.className = 'bag-detail';
    const id = this.sel;
    if (id === null || !(this.sv.inv[id] > 0)) { d.appendChild(el('div', 'hint', this.chest ? 'Tap an item to put it in the chest.' : 'Tap an item to look at it. Drag it, or tap it and then an In hand slot, to carry it.')); return; }
    const r = rarity(id);
    d.className = 'bag-detail r' + r;
    const top = el('div', 'dtop');
    const halo = el('div', 'halo'); halo.appendChild(itemIconEl(id, 46)); top.appendChild(halo);
    top.appendChild(el('div', 'dtx', `<b>${esc(itemName(id))}</b><em class="rt">${RAR[r]} · ${esc(CAT_NAME[itemCat(id)] || '')} · ${this.sv.inv[id]} carried</em><span>${esc(itemDesc(id))}</span>`));
    d.appendChild(top);
    const stats = statsOf(id);
    if (stats.length) {
      const sb = el('div', 'dstats');
      for (const [n, v, txt] of stats) sb.appendChild(el('div', 'stat', `<span>${n}</span><i><b style="width:${Math.round(Math.min(1, v) * 100)}%"></b></i><em>${txt}</em>`));
      d.appendChild(sb);
    }
    const acts = el('div', 'dacts');
    const add = (label, fn, primary) => { const b = el('button', 'btn' + (primary ? ' primary' : ''), label); b.onclick = fn; acts.appendChild(b); };
    if (isGear(id)) {
      const slot = ITEMS[id].slot, worn = this.sv.equip[slot] === id;
      add(worn ? 'Take off' : (slot === 'weapon' ? 'Wield' : 'Wear'), () => this.equip(id, worn ? null : slot), !worn);
    }
    if (id === 'i_draught') add('Drink', () => { this.game.player.useItem(id, null); this.render(); }, true);
    if (id === 'i_infuse_ember' || id === 'i_infuse_frost') add('Infuse your weapon', () => { this.game.player.useItem(id, null); this.render(); }, true);
    if (usable(id) && id !== 'i_draught' && !String(id).startsWith('i_infuse')) add('Take in hand', () => { this.assign(id, this.hotIndex(id)); this.selectHot(id); this.close(); }, true);
    if (placeable(id)) add('Take in hand', () => { this.assign(id, this.hotIndex(id)); this.selectHot(id); this.close(); });
    d.appendChild(acts);
    d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop');
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
      if (this.sel !== null && onHotbar(this.sel)) s.classList.add('drop');
      s.onclick = () => {
        if (this.sel !== null && onHotbar(this.sel)) { this.assign(this.sel, i); return; }
        if (id !== undefined) { this.sv.sel = i; this.ui.hotbarDirty = true; this.renderHot(); }
      };
      s.addEventListener('dragover', e => e.preventDefault());
      s.addEventListener('drop', e => { e.preventDefault(); const v = norm(e.dataTransfer.getData('text/plain')); if (onHotbar(v)) this.assign(v, i); });
      if (id !== undefined) this.tipOn(s, id);
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
    const s = this.hotEl && this.hotEl.children[Math.min(i, h.length - 1)];
    if (s) { s.classList.add('land'); }
  }
  equip(id, slot) {
    const eq = this.sv.equip;
    if (slot) eq[slot] = id; else for (const k in eq) if (eq[k] === id) delete eq[k];
    Audio.play('confirm');
    if (slot === 'weapon') Audio.play('swing', { pitch: 1.2, vol: 0.5 });
    this.game.player.refreshLook();
    this.render();
    const s = this.root.querySelector('.eslot.' + (slot || ITEMS[id].slot));
    if (s && slot) s.classList.add('land');
  }
  renderStations() {
    const box = this.stationsEl; if (!box) return;
    box.innerHTML = '';
    for (const k of ['hand', 'bench', 'forge', 'loom']) {
      const on = this.near[k];
      const sp = el('span', 'st' + (on ? ' on' : ''), `<i class="ci ci-st-${k}"></i>${STATION_NAMES[k]}`);
      sp.title = on ? STATION_NAMES[k] + ' in reach' : 'Stand near a ' + STATION_NAMES[k] + ' to use its recipes';
      box.appendChild(sp);
    }
  }
  renderRcats() {
    const box = this.rcatsEl; if (!box) return;
    box.innerHTML = '';
    for (const [k, n] of RCATS) {
      const ready = RECIPES.filter(r => (k === 'all' || recipeCat(r) === k) && canCraft(this.sv, r, this.near)).length;
      const b = el('button', 'chip' + (this.rcat === k ? ' on' : ''), `<i class="ci ci-${k}"></i>${n}${ready ? `<em class="ready">${ready}</em>` : ''}`);
      b.onclick = () => { this.rcat = k; this.rsel = 0; this.count = 1; Audio.play('blip', { pitch: 1.2 }); this.renderRcats(); this.renderRecipes(); };
      box.appendChild(b);
    }
  }
  renderRecipes() {
    const box = this.recipesEl; if (!box) return;
    box.innerHTML = '';
    const list = this.visibleRecipes();
    this.rsel = Math.max(0, Math.min(this.rsel, list.length - 1));
    if (!list.length) box.appendChild(el('div', 'empty', 'No recipes of this kind.'));
    list.forEach((r, i) => {
      const ok = canCraft(this.sv, r, this.near), here = !r.st || this.near[r.st];
      const row = el('div', 'rec r' + rarity(r.out) + (ok ? ' ok' : '') + (here ? '' : ' locked') + (i === this.rsel ? ' on' : ''));
      row.style.setProperty('--i', i);
      const fr = el('div', 'rfr'); fr.appendChild(itemIconEl(r.out, 30)); row.appendChild(fr);
      const need = here ? r.need.map(([id, n]) => `<span class="${(this.sv.inv[id] || 0) >= n ? 'nh' : 'nm'}">${n} ${esc(itemName(id))}</span>`).join('') : `<span class="lk">Needs a ${esc(STATION_NAMES[r.st])}</span>`;
      row.appendChild(el('div', 'rtx', `<b>${esc(itemName(r.out))}${r.n > 1 ? ' <small>x' + r.n + '</small>' : ''}</b><span class="rneed">${need}</span>`));
      if (ok) row.appendChild(el('span', 'rok', this.maxCraft(r) > 1 ? 'x' + Math.min(99, this.maxCraft(r)) : ''));
      row.onclick = () => { if (this.rsel !== i) this.count = 1; this.rsel = i; Audio.play('blip', { pitch: 1.3 }); this.renderRecipes(); };
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
    const max = this.maxCraft(r);
    this.count = Math.max(1, Math.min(this.count || 1, Math.max(1, max)));
    const ring = el('div', 'ring r' + rarity(r.out) + (ok ? ' ready' : ''));
    ring.innerHTML = RING_SVG;
    ring.appendChild(itemIconEl(r.out, 50));
    if (r.n * this.count > 1) ring.appendChild(el('span', 'n', 'x' + r.n * this.count));
    this.ringEl = ring;
    f.appendChild(ring);
    const info = el('div', 'finfo');
    info.appendChild(el('div', 'fname', `<b>${esc(itemName(r.out))}</b><em class="rt">${RAR[rarity(r.out)]}${r.st ? ' · ' + esc(STATION_NAMES[r.st]) : ''}</em><span>${esc(itemDesc(r.out))}</span>`));
    const need = el('div', 'fneed');
    this.needEls = [];
    for (const [id, n] of r.need) {
      const have = this.sv.inv[id] || 0, want = n * this.count;
      const c = el('div', 'ing' + (have >= want ? ' ok' : ''));
      const ic = itemIconEl(id, 24); c.appendChild(ic);
      c.appendChild(el('span', '', `${Math.min(have, 999)}<i>/${want}</i>`));
      c.title = itemName(id);
      need.appendChild(c); this.needEls.push(ic);
    }
    info.appendChild(need);
    const row = el('div', 'frow');
    if (max > 1) {
      const step = el('div', 'stepper');
      const mk = (t, fn, cls) => { const b = el('button', cls || '', t); b.onclick = (e) => { e.stopPropagation(); fn(); Audio.play('blip', { pitch: 1.5, vol: 0.5 }); this.renderForge(r); }; return b; };
      step.appendChild(mk('-', () => this.count = Math.max(1, this.count - 1)));
      step.appendChild(el('span', 'cnt', String(this.count)));
      step.appendChild(mk('+', () => this.count = Math.min(max, this.count + 1)));
      step.appendChild(mk('Max', () => this.count = max, 'mx'));
      row.appendChild(step);
    }
    const btn = el('button', 'btn primary craft', here ? (ok ? (this.count > 1 ? `Craft x${this.count}` : 'Craft') : 'Missing ingredients') : 'Needs a ' + STATION_NAMES[r.st]);
    btn.disabled = !ok;
    // hold to keep crafting
    const start = (e) => { e.preventDefault(); this.holding = true; this.craft(r, this.count); };
    const stop = () => { this.holding = false; };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop); btn.addEventListener('pointerleave', stop); btn.addEventListener('pointercancel', stop);
    row.appendChild(btn);
    info.appendChild(row);
    f.appendChild(info);
  }

  // ---------------------------------------------------------------- crafting ceremony
  craft(r, times = 1) {
    const g = this.game, p = g.player;
    if (!r || this.busy || !canCraft(this.sv, r, this.near)) { if (r && !this.busy) Audio.play('blip', { pitch: 0.5, vol: 0.5 }); return; }
    times = Math.max(1, Math.min(times, this.maxCraft(r)));
    this.busy = true;
    for (const [id, n] of r.need) p.take(id, n * times);
    const ring = this.ringEl, rr = ring ? ring.getBoundingClientRect() : null;
    // ingredients fly into the ring
    if (rr && this.needEls) {
      this.needEls.forEach((ic, k) => {
        const a = ic.getBoundingClientRect();
        for (let j = 0; j < Math.min(3, times); j++) {
          const c = ic.cloneNode(true); c.getContext('2d').drawImage(ic, 0, 0);
          c.className = 'ticon flyer'; c.style.left = a.left + 'px'; c.style.top = a.top + 'px';
          document.body.appendChild(c);
          const dx = rr.left + rr.width / 2 - a.left - a.width / 2, dy = rr.top + rr.height / 2 - a.top - a.height / 2;
          c.animate([{ transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 }, { transform: `translate(${dx * 0.6}px,${dy * 0.6 - 34 - j * 8}px) scale(1.15) rotate(90deg)`, opacity: 1, offset: 0.55 }, { transform: `translate(${dx}px,${dy}px) scale(0.2) rotate(240deg)`, opacity: 0 }], { duration: 520, delay: k * 70 + j * 60, easing: 'cubic-bezier(.5,0,.5,1)', fill: 'forwards' }).onfinish = () => c.remove();
        }
      });
    }
    if (ring) { ring.classList.remove('spin', 'flash'); void ring.offsetWidth; ring.classList.add('spin'); }
    Audio.play('swing', { pitch: 1.6, vol: 0.4 });
    setTimeout(() => Audio.play('blip', { pitch: 2, vol: 0.3 }), 260);
    setTimeout(() => {
      const made = r.n * times;
      p.give(r.out, made);
      this.sv.crafted = (this.sv.crafted || 0) + made;
      if (g.quests) g.quests.onCraft(r.out, made);
      if (g.guide && r.st === 'bench') g.guide.ev('bench');
      if (g.story && g.story.tut) g.story.tut.crafted = 1;
      Audio.play('confirm'); Audio.play('place', { pitch: 1.3 });
      if (rarity(r.out) >= 2) Audio.play('soul', { pitch: 1.3 });
      g.fx.burst(p.actor.c.x + p.actor.facing * 12, p.actor.c.y - 34, { n: 14 + rarity(r.out) * 8, speed: 140, col: '#ffffff', col1: RAR_COL[rarity(r.out)], add: true, life: 0.6, size: 2.4, kind: 'mote' });
      if (ring) { ring.classList.add('flash'); this.sparks(rr, rarity(r.out)); }
      this.madeCard(r.out, made);
      // the result drops into the satchel
      if (rr) {
        const c = itemIconEl(r.out, 54); c.className = 'ticon flyer big';
        c.style.left = (rr.left + rr.width / 2 - 27) + 'px'; c.style.top = (rr.top + rr.height / 2 - 27) + 'px';
        document.body.appendChild(c);
        const gr = this.grid && this.grid.getBoundingClientRect();
        const tx = gr ? gr.left + 30 - (rr.left + rr.width / 2 - 27) : 0, ty = gr ? gr.top + 20 - (rr.top + rr.height / 2 - 27) : 120;
        c.animate([{ transform: 'translate(0,0) scale(1.3)', opacity: 1 }, { transform: 'translate(0,-28px) scale(1.6)', opacity: 1, offset: 0.3 }, { transform: `translate(${tx}px,${ty}px) scale(0.5)`, opacity: 0.2 }], { duration: 620, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' }).onfinish = () => c.remove();
      }
      this.sel = norm(r.out);
      this.renderGrid(); this.renderHot(); this.renderDetail();
      const fresh = this.grid && this.grid.querySelector(`.bslot[data-id="${r.out}"]`);
      if (fresh) fresh.classList.add('fresh');
      setTimeout(() => {
        this.busy = false;
        this.renderRcats(); this.renderRecipes();
        if (this.holding && canCraft(this.sv, r, this.near)) this.craft(r, 1);
      }, 320);
    }, 560);
  }
  // a spray of sparks out of the ring (DOM, so it sits above the panels)
  sparks(rr, rar) {
    if (!rr) return;
    const cx = rr.left + rr.width / 2, cy = rr.top + rr.height / 2, n = 14 + rar * 6;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i'); s.className = 'bag-spark';
      s.style.left = cx + 'px'; s.style.top = cy + 'px'; s.style.background = i % 3 ? RAR_COL[rar] : '#fff';
      document.body.appendChild(s);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, d = 50 + Math.random() * 70;
      s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d - 2}px,${Math.sin(a) * d + 14}px) scale(.2)`, opacity: 0 }], { duration: 520 + Math.random() * 380, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' }).onfinish = () => s.remove();
    }
  }
  // "Made: Planks x8" card that rises in the middle and fades
  madeCard(id, n) {
    const old = this.root.querySelector('.bag-made'); if (old) old.remove();
    const r = rarity(id);
    const c = el('div', 'bag-made r' + r);
    c.appendChild(itemIconEl(id, 40));
    c.appendChild(el('div', '', `<em>${r >= 2 ? 'Crafted ' + RAR[r] : 'Crafted'}</em><b>${esc(itemName(id))}${n > 1 ? ' x' + n : ''}</b>`));
    this.root.appendChild(c);
    setTimeout(() => c.classList.add('go'), 1500);
    setTimeout(() => c.remove(), 2000);
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
