// Unified input: keyboard, mouse, gamepad and virtual (touch) buttons all feed the same action map.
// pressed()/released() are edge flags that survive until the next simulation tick consumes them.

const KEYMAP = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  jump: ['Space', 'KeyW', 'ArrowUp'], attack: ['KeyJ', 'KeyX'], dash: ['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyC'],
  interact: ['KeyE', 'KeyF'], menu: ['Escape', 'KeyP'], craft: ['KeyQ'], emote: ['KeyT'], build: ['KeyB'], bag: ['KeyI', 'Tab'], use: ['KeyR'],
  slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'], slot5: ['Digit5'],
  slot6: ['Digit6'], slot7: ['Digit7'], slot8: ['Digit8'], slot9: ['Digit9'], mute: ['KeyM'], heal: ['KeyH'],
};

export const Input = {
  keys: new Set(),
  down: {}, _pressed: {}, _released: {},
  virt: {},              // touch / ui driven holds
  mouse: { x: 0, y: 0, l: false, r: false, lp: false, rp: false, moved: false, wheel: 0, inside: false },
  axis: { x: 0, y: 0 },  // analog move (touch stick / gamepad)
  aim: null,             // touch aim vector
  any: false,            // any key or button pressed this tick
  lastDevice: 'kb',
  pad: null,

  init(canvas) {
    const prevent = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
    addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (prevent.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code); this.any = true; this.lastDevice = 'kb';
    });
    addEventListener('keyup', e => { this.keys.delete(e.code); });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = false; });
    const pos = e => { const r = canvas.getBoundingClientRect(); this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; };
    canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; pos(e); this.mouse.moved = true; this.mouse.inside = true; });
    canvas.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      pos(e); this.any = true; this.lastDevice = 'kb';
      if (e.button === 0) { this.mouse.l = true; this.mouse.lp = true; }
      if (e.button === 2) { this.mouse.r = true; this.mouse.rp = true; }
    });
    addEventListener('pointerup', e => {
      if (e.pointerType !== 'mouse') return;
      if (e.button === 0) this.mouse.l = false;
      if (e.button === 2) this.mouse.r = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  },

  // called once per rendered frame before simulation ticks
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    this.pad = gp;
    const gpd = {};
    let gx = 0, gy = 0;
    if (gp) {
      const b = i => gp.buttons[i] && gp.buttons[i].pressed;
      gx = Math.abs(gp.axes[0]) > 0.25 ? gp.axes[0] : 0;
      gy = Math.abs(gp.axes[1]) > 0.25 ? gp.axes[1] : 0;
      gpd.jump = b(0); gpd.attack = b(2); gpd.dash = b(1) || b(7) || b(5); gpd.interact = b(3);
      gpd.menu = b(9); gpd.left = b(14) || gx < -0.5; gpd.right = b(15) || gx > 0.5;
      gpd.up = b(12) || gy < -0.5; gpd.down = b(13) || gy > 0.5; gpd.build = b(4); gpd.craft = b(8);
      if (Object.values(gpd).some(Boolean)) this.lastDevice = 'pad';
    }
    for (const a in KEYMAP) {
      let d = !!this.virt[a] || !!gpd[a];
      if (!d) for (const k of KEYMAP[a]) if (this.keys.has(k)) { d = true; break; }
      if (d && !this.down[a]) { this._pressed[a] = true; this.any = true; }
      if (!d && this.down[a]) this._released[a] = true;
      this.down[a] = d;
    }
    let ax = (this.down.right ? 1 : 0) - (this.down.left ? 1 : 0);
    let ay = (this.down.down ? 1 : 0) - (this.down.up ? 1 : 0);
    if (gx) ax = gx;
    if (gy) ay = gy;
    if (this.virt.axisX !== undefined && (this.virt.axisX || this.virt.axisY)) { ax = this.virt.axisX; ay = this.virt.axisY; }
    this.axis.x = ax; this.axis.y = ay;
  },
  pressed(a) { return !!this._pressed[a]; },
  released(a) { return !!this._released[a]; },
  consume(a) { const v = !!this._pressed[a]; this._pressed[a] = false; return v; },
  // end of a simulation tick: edges are spent
  endTick() {
    for (const k in this._pressed) this._pressed[k] = false;
    for (const k in this._released) this._released[k] = false;
    this.mouse.lp = this.mouse.rp = false;
    this.mouse.wheel = 0;
    this.any = false;
  },
};
