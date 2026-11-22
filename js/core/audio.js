// Synthesised sound: every SFX is built from oscillators and noise, plus a generative score per biome
// (slow pads, sparse plucked notes, and a driving pulse for boss fights). No audio files needed.
import { clamp, rand, pick } from './util.js';

const SCALES = {
  meadow: { root: 146.83, steps: [0, 2, 4, 7, 9, 12, 14, 16], prog: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]] },
  glass: { root: 164.81, steps: [0, 2, 4, 6, 7, 9, 11, 12, 14], prog: [[0, 2, 4], [1, 3, 5], [5, 7, 9], [3, 5, 7]] },
  hollow: { root: 130.81, steps: [0, 2, 3, 7, 8, 12, 14, 15], prog: [[0, 2, 3], [4, 5, 7], [3, 4, 6], [1, 3, 4]] },
  ember: { root: 110.0, steps: [0, 1, 3, 5, 7, 8, 10, 12, 13], prog: [[0, 2, 4], [1, 3, 5], [5, 7, 9], [6, 8, 10]] },
  frost: { root: 185.0, steps: [0, 3, 5, 7, 10, 12, 15, 17], prog: [[0, 1, 3], [2, 3, 5], [1, 3, 4], [3, 4, 6]] },
};
const semi = (root, n) => root * Math.pow(2, n / 12);

export const Audio = {
  ctx: null, master: null, sfx: null, mus: null, verb: null, muted: false, ready: false,
  vol: { master: 0.8, sfx: 0.9, music: 0.55 },
  biome: 'meadow', boss: false, intensity: 0, nextBeat: 0, beat: 0, chord: 0, padVoices: [], lastPlay: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.vol.master;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
    this.mus = c.createGain(); this.mus.gain.value = this.vol.music; this.mus.connect(this.master);
    // reverb from a decaying noise impulse
    this.verb = c.createConvolver();
    const len = c.sampleRate * 3.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb.buffer = ir;
    this.verbGain = c.createGain(); this.verbGain.gain.value = 0.55;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    // echo for plucks
    this.delay = c.createDelay(1.5); this.delay.delayTime.value = 0.42;
    const fb = c.createGain(); fb.gain.value = 0.35;
    const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
    this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay); dl.connect(this.mus);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.nextBeat = c.currentTime + 0.2;
    this.ready = true;
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.vol.master, this.ctx.currentTime, 0.05); },
  setVolume(k, v) { this.vol[k] = v; if (!this.ctx) return; const n = k === 'master' ? this.master : k === 'sfx' ? this.sfx : this.mus; n.gain.setTargetAtTime(k === 'master' && this.muted ? 0 : v, this.ctx.currentTime, 0.05); },

  // ------------------------------------------------------------ primitives
  env(g, t, a, peak, d, sus = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d);
  },
  tone(type, f0, f1, dur, vol, dest, t = 0, a = 0.005) {
    const c = this.ctx; t = t || c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    this.env(g, t, a, vol, dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + a + dur + 0.05);
    return g;
  },
  hiss(dur, vol, type, f0, f1, q = 1, dest, t = 0, a = 0.004) {
    const c = this.ctx; t = t || c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rand(0.8, 1.2);
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    const g = c.createGain(); this.env(g, t, a, vol, dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfx);
    s.start(t, rand(0, 0.5)); s.stop(t + dur + a + 0.05);
    return g;
  },
  send(g, amt) { if (!g) return; const s = this.ctx.createGain(); s.gain.value = amt; g.connect(s); s.connect(this.verb); },

  play(name, o = {}) {
    if (!this.ready || this.muted) return;
    const c = this.ctx, now = c.currentTime;
    // throttle identical sounds so swarms don't turn into noise
    const minGap = o.gap ?? 0.03;
    if (this.lastPlay[name] && now - this.lastPlay[name] < minGap) return;
    this.lastPlay[name] = now;
    const v = o.vol ?? 1;
    const p = o.pitch ?? 1;
    switch (name) {
      case 'step': this.hiss(0.05, 0.05 * v, 'bandpass', 900 * p, 400 * p, 1.2); this.tone('sine', 120 * p, 70, 0.05, 0.04 * v); break;
      case 'jump': this.hiss(0.12, 0.08 * v, 'bandpass', 600, 1800, 0.9); this.tone('sine', 220, 330, 0.09, 0.04 * v); break;
      case 'djump': this.send(this.tone('triangle', 420, 900, 0.18, 0.08 * v), 0.4); this.hiss(0.2, 0.08 * v, 'highpass', 2000, 5000, 0.7); break;
      case 'land': this.tone('sine', 140, 50, 0.12, 0.16 * v); this.hiss(0.1, 0.12 * v, 'lowpass', 800, 200, 0.7); break;
      case 'dash': this.send(this.hiss(0.22, 0.16 * v, 'bandpass', 500, 3800, 1.4), 0.3); break;
      case 'swing': this.hiss(0.16, 0.13 * v, 'bandpass', 900 * p, 3200 * p, 2.2); break;
      case 'hit': this.tone('square', 180 * p, 60, 0.08, 0.1 * v); this.hiss(0.08, 0.2 * v, 'lowpass', 3000, 300, 0.8); this.tone('sine', 90, 40, 0.15, 0.25 * v); break;
      case 'clang': this.send(this.tone('triangle', 1400 * p, 1300 * p, 0.4, 0.09 * v), 0.6); this.tone('square', 2300 * p, 2200 * p, 0.12, 0.03 * v); this.hiss(0.06, 0.15 * v, 'highpass', 4000, 6000, 1); break;
      case 'kill': this.send(this.tone('sine', 520, 140, 0.4, 0.18 * v), 0.5); this.hiss(0.35, 0.2 * v, 'bandpass', 2000, 300, 0.8); break;
      case 'mine': this.hiss(0.06, 0.12 * v, 'bandpass', 1400 * p, 900 * p, 3); this.tone('triangle', 300 * p, 200 * p, 0.05, 0.05 * v); break;
      case 'break': this.hiss(0.18, 0.22 * v, 'lowpass', 2400 * p, 300, 0.8); this.tone('sine', 160 * p, 60, 0.14, 0.15 * v); break;
      case 'place': this.tone('sine', 300 * p, 180 * p, 0.08, 0.18 * v); this.hiss(0.04, 0.1 * v, 'bandpass', 1200, 800, 2); break;
      case 'soul': this.send(this.tone('sine', 880 * p, 1320 * p, 0.25, 0.05 * v), 0.6); break;
      case 'pickup': this.send(this.tone('triangle', 660, 990, 0.12, 0.08 * v), 0.4); this.tone('sine', 990, 1320, 0.15, 0.05 * v, null, now + 0.06); break;
      case 'hurt': this.tone('sawtooth', 300, 80, 0.25, 0.14 * v); this.hiss(0.25, 0.25 * v, 'lowpass', 2000, 200, 0.8); this.send(this.tone('sine', 60, 40, 0.5, 0.3 * v), 0.3); break;
      case 'heal': for (let i = 0; i < 3; i++) this.send(this.tone('sine', 520 * Math.pow(1.25, i), 520 * Math.pow(1.25, i), 0.3, 0.06 * v, null, now + i * 0.07), 0.8); break;
      case 'blip': this.tone('sine', 900 * p, 900 * p, 0.04, 0.05 * v); break;
      case 'confirm': this.send(this.tone('triangle', 520, 780, 0.12, 0.07 * v), 0.5); this.tone('sine', 1040, 1040, 0.2, 0.04 * v, null, now + 0.08); break;
      case 'roar': {
        const g = this.tone('sawtooth', 90 * p, 45 * p, 1.4, 0.22 * v, null, 0, 0.15); this.send(g, 0.6);
        this.send(this.hiss(1.4, 0.3 * v, 'lowpass', 900, 150, 1.5, null, 0, 0.2), 0.5);
        break;
      }
      case 'slam': this.tone('sine', 80, 30, 0.6, 0.45 * v); this.send(this.hiss(0.6, 0.35 * v, 'lowpass', 1500, 80, 0.8), 0.4); break;
      case 'boom': this.tone('sine', 60, 25, 1.2, 0.5 * v); this.send(this.hiss(1.2, 0.4 * v, 'lowpass', 3000, 60, 0.6), 0.7); break;
      case 'shard': this.send(this.tone('triangle', 1200 * p, 600 * p, 0.25, 0.06 * v), 0.5); break;
      case 'beat': this.tone('sine', 70, 40, 0.18, 0.4 * v); this.tone('sine', 60, 35, 0.2, 0.3 * v, null, now + 0.22); break;
      case 'crack': this.hiss(0.3, 0.3 * v, 'highpass', 1200, 4000, 0.9); this.send(this.tone('triangle', 1600, 2400, 0.4, 0.06 * v), 0.8); break;
      case 'chime': [0, 4, 7, 12].forEach((n, i) => this.send(this.tone('sine', semi(523.25, n), semi(523.25, n), 1.2, 0.05 * v, null, now + i * 0.11, 0.01), 0.9)); break;
      case 'title': [0, 7, 12, 16, 19].forEach((n, i) => this.send(this.tone('sine', semi(146.83, n), semi(146.83, n), 3.0, 0.06 * v, this.mus, now + i * 0.32, 0.3), 1.0)); break;
      case 'gate': this.send(this.tone('sawtooth', 55, 55, 2.0, 0.08 * v, null, 0, 0.6), 1); this.send(this.tone('sine', 110, 108, 2.0, 0.1 * v, null, 0, 0.6), 1); break;
      case 'shoot': this.send(this.tone('triangle', 700 * p, 300 * p, 0.2, 0.06 * v), 0.4); break;
      case 'talk': this.tone('triangle', rand(380, 520) * p, rand(380, 520) * p, 0.05, 0.03 * v); break;
    }
  },

  // ------------------------------------------------------------ music
  setScene(biome, boss) { this.biome = biome; this.boss = !!boss; },
  update() {
    if (!this.ready) return;
    const c = this.ctx;
    const bpm = this.boss ? 116 : 62;
    const spb = 60 / bpm;
    while (this.nextBeat < c.currentTime + 0.25) {
      this.scheduleBeat(this.nextBeat, spb);
      this.nextBeat += spb;
      this.beat++;
    }
  },
  scheduleBeat(t, spb) {
    const S = SCALES[this.biome] || SCALES.meadow;
    const bar = Math.floor(this.beat / 4), inBar = this.beat % 4;
    if (inBar === 0 && bar % 2 === 0) {
      this.chord = (this.chord + 1) % S.prog.length;
      this.pad(S, S.prog[this.chord], t, spb * 8);
    }
    if (this.boss) {
      // pulse: kick on every beat, offbeat hat, bass ostinato
      const k = this.tone('sine', 110, 38, 0.3, 0.32, this.mus, t);
      void k;
      this.hiss(0.05, 0.04, 'highpass', 7000, 9000, 1, this.mus, t + spb / 2);
      const n = S.steps[[0, 0, 3, 1][inBar] % S.steps.length];
      this.tone('sawtooth', semi(S.root / 2, n), semi(S.root / 2, n), spb * 0.8, 0.06, this.mus, t, 0.01);
      if (inBar === 2) this.hiss(0.18, 0.08, 'bandpass', 220, 120, 2, this.mus, t);
    } else if (Math.random() < 0.42) {
      // sparse plucks drawn from the scale, an octave up
      const n = pick(S.steps) + (Math.random() < 0.3 ? 12 : 0);
      const f = semi(S.root * 2, n);
      const at = t + (Math.random() < 0.3 ? spb / 2 : 0);
      const g = this.tone('sine', f, f, 1.4, 0.05, this.mus, at, 0.005);
      const g2 = this.tone('triangle', f * 2, f * 2, 0.3, 0.012, this.mus, at, 0.003);
      const s = this.ctx.createGain(); s.gain.value = 0.7; g.connect(s); g2.connect(s); s.connect(this.delay); s.connect(this.verb);
    }
  },
  pad(S, chord, t, dur) {
    const c = this.ctx;
    const out = c.createGain(); out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(this.boss ? 0.03 : 0.05, t + dur * 0.25);
    out.gain.linearRampToValueAtTime(0.0001, t + dur * 1.1);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(450, t + dur);
    lp.connect(out); out.connect(this.mus);
    const s = c.createGain(); s.gain.value = 0.8; out.connect(s); s.connect(this.verb);
    for (const deg of chord) {
      const n = S.steps[deg % S.steps.length] + 12 * Math.floor(deg / S.steps.length);
      const f = semi(S.root, n);
      for (const det of [-6, 5]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        const og = c.createGain(); og.gain.value = 0.33;
        o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur * 1.15);
      }
    }
    // sub
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = semi(S.root / 2, S.steps[chord[0] % S.steps.length]);
    const og = c.createGain(); og.gain.value = 0.6; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur * 1.15);
  },
};
