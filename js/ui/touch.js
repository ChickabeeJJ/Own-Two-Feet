// On-screen controls for phones and tablets: a floating stick plus action buttons, all feeding Input.virt.
// In build mode a tap on the world mines (hold) or places (tap on empty space).
import { Input } from '../core/input.js';
import { TILE, TILES } from '../world/tiles.js';

export class Touch {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('touch');
    this.stick = document.getElementById('stick');
    this.knob = document.getElementById('knob');
    this.sid = null; this.tapped = false;
    this.build = false;
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.enabled = isTouch;
    if (isTouch) { game.touch = this; this.show(true); document.body.classList.add('touch'); }
    this.bind();
  }
  show(on) {
    this.root.classList.toggle('hidden', !on);
    this.game.touch = on ? this : null;
    document.body.classList.toggle('touch', on);
  }
  bind() {
    const st = this.stick;
    const setAxis = (e) => {
      const r = st.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > 1) { dx /= d; dy /= d; }
      Input.virt.axisX = Math.abs(dx) > 0.18 ? dx : 0;
      Input.virt.axisY = Math.abs(dy) > 0.45 ? dy : 0;
      Input.virt.up = dy < -0.6; Input.virt.down = dy > 0.6;
      this.knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
    };
    st.addEventListener('pointerdown', e => { this.sid = e.pointerId; st.setPointerCapture(e.pointerId); setAxis(e); this.tapped = true; e.preventDefault(); });
    st.addEventListener('pointermove', e => { if (e.pointerId === this.sid) setAxis(e); });
    const end = e => { if (e.pointerId !== this.sid) return; this.sid = null; Input.virt.axisX = 0; Input.virt.axisY = 0; Input.virt.up = Input.virt.down = false; this.knob.style.transform = ''; };
    st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
    for (const b of document.querySelectorAll('#tbtns .tb')) {
      const a = b.dataset.a;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        b.setPointerCapture(e.pointerId);
        this.tapped = true;
        if (a === 'tbuild') { this.toggleBuild(); return; }
        Input.virt[a] = true; b.classList.add('down');
      });
      const up = () => { if (a !== 'tbuild') { Input.virt[a] = false; b.classList.remove('down'); } };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    }
    // world taps
    const cv = document.getElementById('game');
    cv.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      this.tapped = true;
      if (!this.build) return;
      const w = this.game.screenToWorld(e.clientX, e.clientY);
      const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
      const t = this.game.world.get(tx, ty);
      this.game.touchBuild = { tx, ty, mine: t !== 0, place: t === 0, pid: e.pointerId };
    });
    cv.addEventListener('pointermove', e => {
      const tb = this.game.touchBuild;
      if (!tb || tb.pid !== e.pointerId) return;
      const w = this.game.screenToWorld(e.clientX, e.clientY);
      tb.tx = Math.floor(w.x / TILE); tb.ty = Math.floor(w.y / TILE);
    });
    const tend = e => { const tb = this.game.touchBuild; if (tb && tb.pid === e.pointerId) { tb.mine = false; tb.pid = null; } };
    cv.addEventListener('pointerup', tend); cv.addEventListener('pointercancel', tend);
  }
  toggleBuild() {
    this.build = !this.build;
    document.querySelector('.tb[data-a="tbuild"]').classList.toggle('active', this.build);
    if (!this.build) this.game.touchBuild = null;
    else this.game.touchBuild = { mine: false, place: false };
    this.game.ui && this.game.ui.toast(this.build ? 'Build: tap a block to break it, tap empty space to place' : 'Build off');
  }
}
export { TILES };
