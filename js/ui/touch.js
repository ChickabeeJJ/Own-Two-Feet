// Phone and tablet controls. A floating stick appears wherever the left thumb lands; action buttons are
// sized to the screen; a contextual action button (Talk, Rest, Open, Wake) appears only when it can be used.
// In build mode a tap on the world breaks (hold) or places (tap on empty space).
import { Input } from '../core/input.js';
import { TILE, TILES } from '../world/tiles.js';

export class Touch {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('touch');
    this.zone = document.getElementById('tzone');
    this.stick = document.getElementById('stick');
    this.knob = document.getElementById('knob');
    this.act = document.getElementById('tact');
    this.sid = null; this.tapped = false; this.build = false;
    this.home = null;
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.enabled = isTouch;
    if (isTouch) this.show(true);
    this.bind();
  }
  show(on) {
    this.root.classList.toggle('hidden', !on);
    this.game.touch = on ? this : null;
    document.body.classList.toggle('touch', on);
  }
  bind() {
    const st = this.stick, z = this.zone;
    const R = () => st.getBoundingClientRect().width / 2;
    const place = (x, y) => {
      const r = R();
      st.style.left = (x - r) + 'px'; st.style.top = (y - r) + 'px'; st.style.bottom = 'auto';
      this.cx = x; this.cy = y;
    };
    const setAxis = (e) => {
      const r = R();
      let dx = (e.clientX - this.cx) / r, dy = (e.clientY - this.cy) / r;
      const d = Math.hypot(dx, dy);
      if (d > 1) { dx /= d; dy /= d; }
      Input.virt.axisX = Math.abs(dx) > 0.16 ? dx : 0;
      Input.virt.axisY = Math.abs(dy) > 0.45 ? dy : 0;
      Input.virt.up = dy < -0.62; Input.virt.down = dy > 0.62;
      this.knob.style.transform = `translate(${dx * r * 0.62}px, ${dy * r * 0.62}px)`;
    };
    z.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.sid = e.pointerId; z.setPointerCapture(e.pointerId);
      place(e.clientX, e.clientY); st.classList.add('live');
      setAxis(e); this.tapped = true;
    });
    z.addEventListener('pointermove', e => { if (e.pointerId === this.sid) setAxis(e); });
    const end = e => {
      if (e.pointerId !== this.sid) return;
      this.sid = null; st.classList.remove('live');
      st.style.left = ''; st.style.top = ''; st.style.bottom = '';
      Input.virt.axisX = 0; Input.virt.axisY = 0; Input.virt.up = Input.virt.down = false;
      this.knob.style.transform = '';
    };
    z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end);
    const press = (b, a) => {
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        b.setPointerCapture(e.pointerId);
        this.tapped = true;
        if (navigator.vibrate) navigator.vibrate(8);
        if (a === 'tbuild') { this.toggleBuild(); return; }
        Input.virt[a] = true; b.classList.add('down');
      });
      const up = () => { if (a !== 'tbuild') { Input.virt[a] = false; b.classList.remove('down'); } };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    };
    for (const b of document.querySelectorAll('#tbtns .tb')) press(b, b.dataset.a);
    press(this.act, 'interact');
    // world taps in build mode
    const cv = document.getElementById('game');
    cv.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      this.tapped = true;
      if (!this.build) return;
      const w = this.game.screenToWorld(e.clientX, e.clientY);
      const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
      const t = this.game.world.get(tx, ty);
      // touch a block to dig it (hold), touch open space to place; drag to keep digging or lay a line
      this.game.touchBuild = { tx, ty, mode: t !== 0 ? 'mine' : 'place', tap: t === 0, pid: e.pointerId };
    });
    cv.addEventListener('pointermove', e => {
      const tb = this.game.touchBuild;
      if (!tb || tb.pid !== e.pointerId) return;
      const w = this.game.screenToWorld(e.clientX, e.clientY);
      tb.tx = Math.floor(w.x / TILE); tb.ty = Math.floor(w.y / TILE);
    });
    const tend = e => { const tb = this.game.touchBuild; if (tb && tb.pid === e.pointerId) tb.pid = null; };
    cv.addEventListener('pointerup', tend); cv.addEventListener('pointercancel', tend);
  }
  // called every frame by the UI: show the contextual action when something can be used
  frame() {
    const p = this.game.player;
    const it = p && p.interact && !this.game.cinematic && !(this.game.ui && this.game.ui.modal);
    if (it) {
      const verb = p.interact.verb || (p.interact.label.startsWith('Talk') ? 'Talk' : p.interact.label.startsWith('Rest') ? 'Rest' : p.interact.label.split(' ')[0]);
      if (this.act.dataset.v !== verb) { this.act.dataset.v = verb; this.act.querySelector('span').textContent = verb; }
      this.act.classList.remove('hidden');
    } else this.act.classList.add('hidden');
  }
  toggleBuild() {
    this.build = !this.build;
    document.querySelector('.tb[data-a="tbuild"]').classList.toggle('active', this.build);
    this.game.touchBuild = this.build ? { mode: null, tap: false, pid: null } : null;
    this.game.ui && this.game.ui.toast(this.build ? 'Build: hold a block to dig it, touch open space to place. Drag to build a line.' : 'Build off');
  }
}
export { TILES };
