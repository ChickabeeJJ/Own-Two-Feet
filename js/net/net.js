// Multiplayer. CrazyGames provides invites and rooms; the connection itself is peer to peer (WebRTC
// through PeerJS). Two ways to play together:
//  - Invite: you open your own world; friends join through the CrazyGames invite button / link.
//  - Open world: serverless matchmaking. Everyone tries to claim a well-known shard id; whoever gets it
//    hosts that shard's shared world, everyone else joins it. If the host leaves, a guest takes over.
// The host owns enemies, bosses and the world. Each player simulates their own body; remote players are
// full ragdolls driven by their controller state, so they move and fall physically on every screen.
import { Platform } from '../platform.js';
import { Audio } from '../core/audio.js';
import { Actor } from '../game/actor.js';
import { Proj } from '../game/enemies.js';
import { lookFromSave, Save, RELICS } from '../game/progress.js';
import { P } from '../physics/body.js';
import { TILE } from '../world/tiles.js';
import { clamp, lerp, rand, sign, mulberry } from '../core/util.js';

const VERSION = 'v1';
const PUBLIC_SEED = 0x5eed2026;
const MAX_PLAYERS = 6;
const SHARDS = 8;

function peerOptions() {
  const q = new URLSearchParams(location.search);
  const o = { debug: 0 };
  if (q.get('peerhost')) {
    o.host = q.get('peerhost'); o.port = +(q.get('peerport') || 9000); o.path = q.get('peerpath') || '/'; o.secure = q.get('peersecure') === '1';
    o.config = { iceServers: [] };
  } else {
    o.config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] };
  }
  return o;
}
const rid = () => Math.random().toString(36).slice(2, 10);

export class Net {
  constructor(game) {
    this.game = game;
    this.available = typeof window.Peer === 'function';
    this.active = false; this.isHost = false; this.isGuest = false; this.mode = null;
    this.peer = null; this.conns = new Map(); this.remotes = new Map();
    this.hostConn = null; this.myId = null; this.roomId = null; this.inviteUrl = null;
    this.status = 'Offline'; this.sendT = 0; this.entT = 0; this.peers = 1;
    this.netIds = new WeakMap(); this.nextNid = 1; this.puppets = new Map();
    this.worldBosses = null; this.savedPos = null; this.shard = 0;
    this.visiting = false;
    this.lastRx = new Map();
    game.systems.push(this);
  }
  statusText() {
    if (!this.active) return this.status === 'Offline' ? 'You are alone in your world. Open it to a friend, or step into the open world where strangers wander.' : this.status;
    return `${this.mode === 'public' ? 'Open world' : this.isHost ? 'Your world is open' : 'Visiting a friend'} · ${this.peers} soul${this.peers > 1 ? 's' : ''} here`;
  }
  roster() { return [...this.remotes.values()].map(r => ({ name: r.name, host: r.host })); }
  myName() { return Platform.username || this.game.save.name.split(' ')[0]; }
  myLook() { const sv = this.game.save; return { look: sv.look, marks: sv.marks, hasBlade: sv.hasBlade }; }

  // ------------------------------------------------------------ boot: invites + instant multiplayer
  boot() {
    if (!this.available) return;
    const room = Platform.inviteParam('room');
    Platform.onJoinRoom(p => { if (p && p.room && p.room !== this.roomId) this.join(p.room); });
    if (room) setTimeout(() => this.join(room), 600);
    else if (Platform.isInstantMultiplayer()) setTimeout(() => this.joinPublic(), 1200);
  }

  makePeer(id) {
    return new Promise((res, rej) => {
      let p;
      try { p = id ? new window.Peer(id, peerOptions()) : new window.Peer(peerOptions()); } catch (e) { rej(e); return; }
      const to = setTimeout(() => { rej(new Error('timeout')); try { p.destroy(); } catch (e) {} }, 9000);
      p.on('open', i => { clearTimeout(to); res(p); });
      p.on('error', e => { clearTimeout(to); rej(e); });
    });
  }

  // ------------------------------------------------------------ hosting
  async host(publicShard = null) {
    if (this.active && this.isHost) return true;
    const g = this.game;
    this.status = 'Opening your world…'; this.toast('Opening your world…');
    try {
      const id = publicShard !== null ? `otf-pub-${VERSION}-${publicShard}` : `otf-${rid()}`;
      const peer = await this.makePeer(id);
      this.peer = peer; this.myId = peer.id; this.roomId = peer.id;
      this.active = true; this.isHost = true; this.isGuest = false;
      this.mode = publicShard !== null ? 'public' : 'invite';
      peer.on('connection', c => this.onIncoming(c));
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
      peer.on('error', e => console.warn('peer', e.type));
      if (this.mode === 'invite') {
        const params = { room: this.roomId };
        Platform.updateRoom({ roomId: this.roomId, isJoinable: true, inviteParams: params });
        Platform.showInvite(params);
        this.inviteUrl = await Platform.inviteLink(params);
        this.toast('Your world is open. Share the invite link.');
        if (navigator.clipboard && this.inviteUrl) navigator.clipboard.writeText(this.inviteUrl).catch(() => {});
      }
      this.peers = 1; this.updateHud();
      return true;
    } catch (e) {
      this.status = e && e.type === 'unavailable-id' ? 'taken' : 'Could not open a connection right now.';
      if (publicShard === null) this.toast('Could not reach the network');
      this.teardown(false);
      if (e && e.type === 'unavailable-id') throw e;
      return false;
    }
  }
  onIncoming(c) {
    c.on('open', () => {
      if (this.conns.size + 1 >= MAX_PLAYERS) { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); return; }
      this.conns.set(c.peer, c);
      c.on('data', d => this.onData(c, d));
      c.on('close', () => this.dropPeer(c.peer));
      c.on('error', () => this.dropPeer(c.peer));
    });
  }
  welcome(c, hello) {
    const g = this.game;
    const players = [{ id: this.myId, name: this.myName(), look: this.myLook(), x: g.player.x, y: g.player.y, host: true }];
    for (const r of this.remotes.values()) players.push({ id: r.id, name: r.name, look: r.lookData, x: r.actor.c.x, y: r.actor.c.y });
    c.send({ t: 'welcome', you: c.peer, seed: g.world.seed, edits: g.world.serializeEdits(), players, bosses: this.bossMap(), spawn: { x: g.player.x, y: g.player.y } });
    this.addRemote(c.peer, hello.name, hello.look, g.player.x, g.player.y);
    this.broadcast({ t: 'pj', id: c.peer, name: hello.name, look: hello.look }, c.peer);
    this.toast(`${hello.name} has arrived`); Audio.play('chime', { vol: 0.6 });
    this.refreshRoom();
  }
  refreshRoom() {
    this.peers = 1 + this.remotes.size;
    if (this.mode === 'invite' && this.isHost) Platform.updateRoom({ roomId: this.roomId, isJoinable: this.peers < MAX_PLAYERS, inviteParams: { room: this.roomId } });
    this.updateHud();
  }

  // ------------------------------------------------------------ joining
  async join(roomId, isPublic = false) {
    if (!this.available || !roomId) return false;
    if (this.active) this.leave(true);
    const g = this.game;
    this.status = 'Joining…'; if (!isPublic) this.toast('Joining a friend…');
    try {
      const peer = await this.makePeer(null);
      this.peer = peer; this.myId = peer.id;
      const c = peer.connect(roomId, { reliable: true, serialization: 'json' });
      const res = await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('no answer')), 9000);
        c.on('open', () => c.send({ t: 'hello', name: this.myName(), look: this.myLook() }));
        c.on('data', d => {
          if (d.t === 'full') { clearTimeout(to); reject(Object.assign(new Error('full'), { full: true })); }
          else if (d.t === 'welcome') { clearTimeout(to); resolve(d); }
          else if (this.hostConn) this.onData(c, d);
        });
        c.on('error', e => { clearTimeout(to); reject(e); });
        peer.on('error', e => { clearTimeout(to); reject(e); });
      });
      this.hostConn = c; this.roomId = roomId;
      this.active = true; this.isGuest = true; this.isHost = false; this.mode = isPublic ? 'public' : 'invite';
      c.on('close', () => { if (this.hostConn === c) this.hostLost(); });
      this.enterWorld(res);
      Platform.updateRoom({ roomId, isJoinable: true, inviteParams: { room: roomId } });
      return true;
    } catch (e) {
      this.teardown(false);
      if (e && e.full) throw e;
      if (!isPublic) { this.toast('That world could not be reached'); this.status = 'Could not join.'; }
      return false;
    }
  }
  enterWorld(w) {
    const g = this.game;
    if (!this.visiting) { g.saveNow(); this.savedPos = { x: g.player.x, y: g.player.y }; }
    this.visiting = true;
    this.switchWorld(w.seed, w.edits);
    this.worldBosses = w.bosses || {};
    for (const pl of w.players) if (pl.id !== this.myId) this.addRemote(pl.id, pl.name, pl.look, pl.x, pl.y, pl.host);
    const sp = w.spawn;
    g.player.respawnAt(sp.x - 40, sp.y);
    g.cam.x = g.player.x; g.cam.y = g.player.y - 80;
    this.peers = 1 + this.remotes.size; this.updateHud();
    const host = [...this.remotes.values()].find(r => r.host);
    g.story.card(this.mode === 'public' ? 'The Open World' : `${host ? host.name : 'A friend'}'s World`, this.mode === 'public' ? 'strangers wander here' : 'you are welcome here', 'small', 3);
    Audio.play('gate', { vol: 0.6 });
  }
  switchWorld(seed, edits) {
    const g = this.game;
    for (const a of g.actors) a.removed = true;
    g.actors = []; g.projectiles = [];
    if (g.bosses) { g.bosses.active = null; g.bosses.arena = null; }
    if (g.shrines) { g.shrines.map.clear(); g.shrines.home = null; }
    g.setWorld(seed);
    g.world.loadEdits(edits);
    g.world.onChange((tx, ty, t, layer, silent) => { if (!silent && this.active && this.applyingRemote !== true) {} });
    g.player.actor.mode = 'ctrl';
  }
  hostLost() {
    const g = this.game;
    if (!this.active || !this.isGuest) return;
    const wasPublic = this.mode === 'public';
    this.toast(wasPublic ? 'The host left. Holding the world together…' : 'Your friend closed their world');
    for (const r of this.remotes.values()) r.actor.removed = true;
    this.remotes.clear(); this.clearPuppets();
    try { this.peer && this.peer.destroy(); } catch (e) {}
    this.peer = null; this.hostConn = null; this.active = false; this.isGuest = false;
    if (wasPublic) {
      // take over the shard if it is free, keeping this world exactly as it is
      setTimeout(() => this.claimShard(this.shard, true), rand(300, 1800));
    } else this.returnHome();
  }

  // ------------------------------------------------------------ open world
  async joinPublic() {
    if (!this.available) { this.toast('The open world needs a network connection'); return; }
    if (this.active && this.mode === 'public') return;
    if (this.active) this.leave(true);
    this.toast('Stepping into the open world…');
    for (let n = 0; n < SHARDS; n++) {
      const r = await this.claimShard(n, false);
      if (r === 'ok') return;
      if (r === 'fail') break;
    }
    this.toast('The open world is out of reach right now');
  }
  async claimShard(n, keepWorld) {
    const id = `otf-pub-${VERSION}-${n}`;
    this.shard = n;
    try {
      const ok = await this.host(n);
      if (!ok) return 'fail';
      // we are the shard host: the public world, ephemeral
      if (!keepWorld) {
        const g = this.game;
        if (!this.visiting) { g.saveNow(); this.savedPos = { x: g.player.x, y: g.player.y }; }
        this.visiting = true;
        this.switchWorld(PUBLIC_SEED, {});
        this.worldBosses = {};
        const sx = 4 * TILE + 16;
        g.player.respawnAt(sx, g.world.surface(4) * TILE);
        g.cam.x = g.player.x; g.cam.y = g.player.y - 80;
        g.story.card('The Open World', 'others will find you here', 'small', 3);
      }
      this.toast('You hold this corner of the open world');
      return 'ok';
    } catch (e) {
      if (!(e && e.type === 'unavailable-id')) return 'fail';
      try { const ok = await this.join(id, true); return ok ? 'ok' : 'next'; }
      catch (e2) { return e2 && e2.full ? 'next' : 'next'; }
    }
  }

  // ------------------------------------------------------------ leaving
  leave(silent = false) {
    const wasVisiting = this.visiting;
    this.teardown(true);
    Platform.leftRoom(); Platform.hideInvite();
    if (wasVisiting) this.returnHome();
    if (!silent) this.toast('Back in your own world');
  }
  teardown(closeAll) {
    for (const c of this.conns.values()) { try { c.close(); } catch (e) {} }
    this.conns.clear();
    if (this.hostConn) { try { this.hostConn.close(); } catch (e) {} }
    for (const r of this.remotes.values()) r.actor.removed = true;
    this.remotes.clear(); this.clearPuppets();
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} }
    this.peer = null; this.hostConn = null;
    this.active = false; this.isHost = false; this.isGuest = false; this.mode = null; this.inviteUrl = null;
    this.peers = 1; this.updateHud();
  }
  returnHome() {
    const g = this.game, sv = g.save;
    this.visiting = false; this.worldBosses = null;
    this.switchWorld(sv.seed, sv.edits);
    const p = this.savedPos || sv.pos || { x: 4 * TILE + 16, y: g.world.surface(4) * TILE };
    g.player.respawnAt(p.x, p.y);
    g.cam.x = p.x; g.cam.y = p.y - 80;
    g.story.card(g.biomeAt(p.x).name, 'home again', 'small', 2.4);
  }

  // ------------------------------------------------------------ messaging
  send(c, m) { try { if (c && c.open) c.send(m); } catch (e) {} }
  broadcast(m, except) { for (const [id, c] of this.conns) if (id !== except) this.send(c, m); }
  out(m) { if (this.isHost) this.broadcast(m); else this.send(this.hostConn, m); }
  onData(c, d) {
    if (!d || typeof d !== 'object') return;
    const g = this.game;
    this.lastRx.set(c.peer, performance.now());
    switch (d.t) {
      case 'hello': if (this.isHost) this.welcome(c, d); break;
      case 'st': {
        const id = this.isHost ? c.peer : d.id;
        const r = this.remotes.get(id);
        if (r) this.applyState(r, d);
        if (this.isHost) { d.id = c.peer; this.broadcast(d, c.peer); }
        break;
      }
      case 'pj': if (!this.isHost) { this.addRemote(d.id, d.name, d.look, g.player.x, g.player.y); this.toast(`${d.name} has arrived`); this.peers = 1 + this.remotes.size; this.updateHud(); } break;
      case 'pl': if (!this.isHost) this.dropPeer(d.id); break;
      case 'edit': {
        this.applyingRemote = true;
        g.world.set(d.tx, d.ty, d.tile, d.layer || 0);
        this.applyingRemote = false;
        if (d.tile === 0) g.fx.debris(d.tx * TILE + 16, d.ty * TILE + 16, 3, 4);
        if (this.isHost) this.broadcast(d, c.peer);
        break;
      }
      case 'look': {
        const id = this.isHost ? c.peer : d.id;
        const r = this.remotes.get(id);
        if (r) { r.lookData = d.look; r.actor.look = this.lookFrom(d.look); }
        if (this.isHost) { d.id = c.peer; this.broadcast(d, c.peer); }
        break;
      }
      case 'emote': {
        const id = this.isHost ? c.peer : d.id;
        const r = this.remotes.get(id);
        if (r) r.actor.doEmote(d.e, 1.8);
        if (this.isHost) { d.id = c.peer; this.broadcast(d, c.peer); }
        break;
      }
      case 'shove': {
        // someone bumped us with their blade: harmless, physical
        if (d.to === this.myId) { const a = g.player.actor; a.takeImpulse(a.cx, a.cy, d.dx * 500, -220, 0.5); a.c.vx += d.dx * 260; Audio.play('hit', { vol: 0.3 }); }
        else if (this.isHost) { const t = this.conns.get(d.to); this.send(t, d); }
        break;
      }
      case 'hit': if (this.isHost) this.hostHit(d); break;
      case 'phit': if (d.to === this.myId) g.player.takeHit(d.n || 1, d.x, d.y, { knock: d.k || 420, heavy: d.h }); else if (this.isHost) this.send(this.conns.get(d.to), d); break;
      case 'ents': if (!this.isHost) this.applyEnts(d.e); break;
      case 'roster': if (!this.isHost) this.prune(new Set(d.ids)); break;
      case 'proj': if (!this.isHost) g.projectiles.push(Object.assign(new Proj(g, d.o), { ghost: true })); break;
      case 'card': if (!this.isHost) { g.story.card(d.a, d.b, d.c, d.d); if (d.lb !== undefined) g.ui.letterbox(d.lb); if (d.snd) Audio.play(d.snd); if (d.shake) g.shake(d.shake); } break;
      case 'bossEnd': if (!this.isHost) this.guestVictory(d); break;
      case 'souls': if (!this.isHost) { g.fx.souls(d.x, d.y, Math.min(10, d.n), g.player.actor.c, '#bff6ff', () => { g.save.glimmer += 1; Audio.play('soul', { pitch: rand(0.9, 1.3), gap: 0.02 }); g.ui.glimmerBump(); }); } break;
    }
  }
  dropPeer(id) {
    const r = this.remotes.get(id);
    if (r) { r.actor.removed = true; this.remotes.delete(id); this.toast(`${r.name} has gone`); }
    if (this.isHost) { this.conns.delete(id); this.broadcast({ t: 'pl', id }); }
    this.refreshRoom();
  }
  lookFrom(L) {
    const tmp = { look: (L && L.look) || this.game.save.look, marks: (L && L.marks) || [] };
    const look = lookFromSave(tmp);
    return look;
  }
  addRemote(id, name, look, x, y, host = false) {
    if (this.remotes.has(id) || id === this.myId) return;
    const g = this.game;
    const a = new Actor(g, { x, y, team: 'friend', look: this.lookFrom(look), blade: look ? look.hasBlade !== false : true, abil: { djump: true, wall: true, dash: true } });
    a.remote = true; a.noCrumple = true;
    a.puppet = { x, y, vx: 0, vy: 0, t: 0 };
    a.netName = String(name || 'Soul').slice(0, 18);
    g.actors.push(a);
    this.remotes.set(id, { id, name: a.netName, actor: a, lookData: look, host });
  }
  applyState(r, d) {
    const a = r.actor, pp = a.puppet;
    pp.x = d.x; pp.y = d.y; pp.vx = d.vx; pp.vy = d.vy; pp.t = 0;
    pp.ground = !!d.g; pp.dash = !!d.d; pp.limp = d.m === 1;
    if (d.f && d.f !== a.facing) a.face(d.f);
    if (d.ak && (!a.attack || a.attack.kind !== d.ak || d.at < a.attack.t - 0.3)) a.startAttack(d.ak, 0.3);
    if (pp.limp && a.mode === 'ctrl') a.knockdown(0.4);
    r.dead = !!d.dead;
  }
  // per tick
  update(dt) {
    const g = this.game;
    if (!this.active) return;
    // heartbeat: a silent peer is a gone peer (WebRTC close events can take a long time)
    const now = performance.now();
    if (this.isGuest && this.hostConn) {
      const last = this.lastRx.get(this.hostConn.peer) || (this.lastRx.set(this.hostConn.peer, now), now);
      if (now - last > 3500) { this.lastRx.delete(this.hostConn.peer); this.hostLost(); return; }
    }
    if (this.isHost) for (const [id, c] of this.conns) {
      const last = this.lastRx.get(id) || (this.lastRx.set(id, now), now);
      if (now - last > 6000) { this.lastRx.delete(id); try { c.close(); } catch (e) {} this.dropPeer(id); }
    }
    // puppets for remote players / host enemies
    for (const r of this.remotes.values()) this.drivePuppet(r.actor, dt);
    for (const a of this.puppets.values()) this.drivePuppet(a, dt);
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / 20;
      const a = g.player.actor, c = a.c;
      const m = { t: 'st', x: Math.round(c.x), y: Math.round(c.y), vx: Math.round(c.vx), vy: Math.round(c.vy), f: a.facing, g: c.ground ? 1 : 0, d: c.dashT > 0 ? 1 : 0, m: a.mode === 'limp' ? 1 : 0, dead: g.player.dead ? 1 : 0 };
      if (a.attack) { m.ak = a.attack.kind; m.at = +a.attack.t.toFixed(2); }
      m.id = this.myId;
      this.out(m);
    }
    if (this.isHost) {
      this.rosterT = (this.rosterT || 0) - dt;
      if (this.rosterT <= 0) {
        this.rosterT = 2;
        const ids = new Set([this.myId, ...this.conns.keys()]);
        this.prune(ids);
        this.broadcast({ t: 'roster', ids: [...ids] });
      }
      this.entT -= dt;
      if (this.entT <= 0 && this.conns.size) { this.entT = 1 / 12; this.sendEnts(); }
    }
    // friendly shoves: blade through a friend knocks them about a little
    const pa = g.player.actor;
    if (pa.attack && pa.attack.t > 0.2 && pa.attack.t < 0.6) {
      const s = pa.bladeSeg(1);
      for (const r of this.remotes.values()) {
        const b = r.actor.body;
        if (pa.attack.hits.has('f' + r.id)) continue;
        if ((b.x[P.CHEST] - s.x1) ** 2 + (b.y[P.CHEST] - s.y1) ** 2 < 30 * 30) {
          pa.attack.hits.add('f' + r.id);
          r.actor.takeImpulse(s.x1, s.y1, pa.facing * 500, -200, 0.5);
          this.out({ t: 'shove', to: r.id, dx: pa.facing });
          Audio.play('hit', { vol: 0.25 });
        }
      }
    }
  }
  drivePuppet(a, dt) {
    const pp = a.puppet; if (!pp) return;
    pp.t += dt;
    if (a.mode === 'dead') return;
    const c = a.c;
    // predict a little, then glide toward the network position
    const tx = pp.x + pp.vx * Math.min(pp.t, 0.15), ty = pp.y + pp.vy * Math.min(pp.t, 0.15);
    const k = 1 - Math.exp(-14 * dt);
    const dx = tx - c.x, dy = ty - c.y;
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) { a.body.translate(tx - c.x, ty - c.y); c.x = tx; c.y = ty; }
    if (a.mode === 'limp') return;
    if (a.mode !== 'ctrl') return;
    a.intent.mx = 0; a.intent.jump = false; a.intent.dash = false;
    c.x += dx * k; c.y += dy * k;
    c.vx = pp.vx; c.vy = pp.vy; c.ground = pp.ground;
    c.dashT = pp.dash ? 0.05 : 0;
  }
  updateHud() {
    const g = this.game;
    const el = document.getElementById('souls-online');
    if (!el) return;
    if (this.active) { el.classList.remove('hidden'); el.textContent = `${this.peers} soul${this.peers > 1 ? 's' : ''}`; }
    else el.classList.add('hidden');
  }
  toast(m) { this.game.ui && this.game.ui.toast(m); }

  // ------------------------------------------------------------ world + combat sync
  sendEdit(tx, ty, tile, layer) { if (this.active) this.out({ t: 'edit', tx, ty, tile, layer }); }
  sendLook() { if (this.active) this.out({ t: 'look', id: this.myId, look: this.myLook() }); }
  sendEmote(e) { if (this.active) this.out({ t: 'emote', id: this.myId, e }); }
  bossMap() { return this.worldBosses || this.game.save.bosses; }
  nid(a) { let n = this.netIds.get(a); if (!n) { n = this.nextNid++; this.netIds.set(a, n); } return n; }
  sendEnts() {
    const g = this.game;
    const players = [g.player.actor, ...[...this.remotes.values()].map(r => r.actor)];
    const list = [];
    for (const e of g.actors) {
      if (e.team !== 'enemy' || e.removed) continue;
      if (!players.some(p => Math.abs(p.c.x - e.c.x) < 1600)) continue;
      const kind = e.kind === 'wisp' ? 'wisp' : e.isBoss ? (e.kind === 'golem' ? 'golem' : 'boss') : e.kind;
      list.push([this.nid(e), kind, Math.round(e.c.x), Math.round(e.c.y), Math.round(e.c.vx), Math.round(e.c.vy), e.facing || 1, e.mode === 'dead' ? 1 : 0, Math.round(e.hp || 0), e.attack ? e.attack.kind : 0, +(e.telegraph || 0).toFixed(2), e.isBoss ? this.bossLook(e) : 0, e.scale]);
    }
    this.broadcast({ t: 'ents', e: list });
  }
  bossLook(e) {
    const B = this.game.bosses.active;
    if (!B) return 0;
    return { name: B.name, hpK: +B.hpK.toFixed(3), look: e.look || null, spec: B.spec.col };
  }
  applyEnts(list) {
    const g = this.game;
    const seen = new Set();
    let bossInfo = null;
    for (const r of list) {
      const [nid, kind, x, y, vx, vy, f, dead, hp, ak, tele, extra, scale] = r;
      seen.add(nid);
      let a = this.puppets.get(nid);
      if (!a) {
        if (dead) continue;
        a = this.makePuppet(kind, x, y, extra, scale);
        a.nid = nid;
        this.puppets.set(nid, a);
        g.actors.push(a);
      }
      if (a.kind === 'wisp' || a.kind === 'golem') { a.c.x = lerp(a.c.x, x, 0.5); a.c.y = lerp(a.c.y, y, 0.5); }
      else {
        a.puppet.x = x; a.puppet.y = y; a.puppet.vx = vx; a.puppet.vy = vy; a.puppet.t = 0; a.puppet.ground = Math.abs(vy) < 5;
        if (f && f !== a.facing && a.mode === 'ctrl') a.face(f);
        if (ak && !a.attack) a.startAttack(ak, kind === 'brute' || kind === 'boss' ? 0.5 : 0.32);
        a.telegraph = tele;
      }
      a.hp = hp;
      if (dead && a.mode !== 'dead') { if (a.knockdown) { a.mode = 'dead'; a.deadT = 0; a.body && a.body.impulseAll(rand(-200, 200), -400); } else { a.mode = 'dead'; } }
      if (extra) bossInfo = extra;
    }
    for (const [nid, a] of this.puppets) if (!seen.has(nid)) { if (a.mode !== 'dead') a.removed = true; this.puppets.delete(nid); }
    g.ui.bossBar(bossInfo ? { name: bossInfo.name, hpK: bossInfo.hpK } : null);
  }
  makePuppet(kind, x, y, extra, scale) {
    const g = this.game;
    if (kind === 'wisp') { const w = g.enemies.spawnWisp(x, y, 0, '#c4b5ff'); g.actors.pop(); w.update = function (dt) { this.t += dt; this.flash = Math.max(0, this.flash - dt * 5); if (this.mode === 'dead') { this.deadT += dt; if (this.deadT > 0.6) this.removed = true; } }; w.hurt = (dmg, info) => { w.flash = 1; this.sendHit(w, dmg, info); }; return w; }
    if (kind === 'golem') {
      const o = { id: 'pg' + rid(), team: 'enemy', kind: 'golem', scale: 2, hitR: 34, mode: 'ctrl', removed: false, glows: [], flash: 0, c: { x, y, vx: 0, vy: 0, w: 70, h: 70 }, update() { this.flash = Math.max(0, this.flash - 0.04); },
        draw(ctx) { ctx.save(); ctx.fillStyle = this.flash > 0 ? '#fff' : '#3b3458'; ctx.beginPath(); ctx.arc(this.c.x, this.c.y, 34, 0, 6.29); ctx.fill(); ctx.fillStyle = '#ece6da'; ctx.beginPath(); ctx.ellipse(this.c.x, this.c.y - 4, 24, 28, 0, 0, 6.29); ctx.fill(); ctx.restore(); } };
      Object.defineProperty(o, 'cx', { get() { return this.c.x; } }); Object.defineProperty(o, 'cy', { get() { return this.c.y; } });
      o.hurt = (dmg, info) => { o.flash = 1; this.sendHit(o, dmg, info); };
      return o;
    }
    const boss = kind === 'boss';
    const look = boss && extra && extra.look ? extra.look : { body: '#2d2935', shade: '#1e1b25', mat: kind === 'brute' ? 'metal' : 'cloth', eyes: '#ffb36b', eyeStyle: 'none', head: 'mask', maskCol: '#ece6da', maskHorns: kind === 'brute', cape: kind === 'brute' ? { col: '#4a3a3a', style: 'cape', len: 6 } : null, blade: null, marks: [], rim: '#ffcf9e' };
    const a = new Actor(g, { x, y, team: 'enemy', scale: scale || (kind === 'brute' ? 1.32 : 0.92), look, blade: boss, facing: -1 });
    a.kind = kind; a.isBoss = boss; a.noCrumple = true; a.glowEye = boss && extra ? extra.spec : '#ffb36b';
    a.puppet = { x, y, vx: 0, vy: 0, t: 0 };
    a.hurt = (dmg, info) => { a.flash = 1; a.takeImpulse(info.x, info.y, info.dx * 500, (info.dy || -0.3) * 300, 0.5); this.sendHit(a, dmg, info); };
    return a;
  }
  sendHit(a, dmg, info) { this.send(this.hostConn, { t: 'hit', nid: a.nid, dmg, x: Math.round(info.x), y: Math.round(info.y), dx: info.dx, dy: info.dy, kind: info.kind }); }
  hostHit(d) {
    const g = this.game;
    for (const e of g.actors) {
      if (e.team !== 'enemy' || this.netIds.get(e) !== d.nid) continue;
      if (e.hurt && e.mode !== 'dead') {
        const was = e.mode;
        e.hurt(d.dmg, { x: d.x, y: d.y, dx: d.dx, dy: d.dy, kind: d.kind, from: null });
        if (e.mode === 'dead' && was !== 'dead') {
          // the one who landed it gets the glimmer
          const n = e.kind === 'brute' ? 9 : e.kind === 'wisp' ? 4 : 5;
          this.broadcast({ t: 'souls', x: Math.round(e.cx), y: Math.round(e.cy), n });
        }
      }
      break;
    }
  }
  // host: an enemy attack landed on a remote player
  hitRemote(actor, n, x, y, o = {}) {
    for (const r of this.remotes.values()) if (r.actor === actor) { this.send(this.conns.get(r.id), { t: 'phit', to: r.id, n, x, y, k: o.knock, h: o.heavy }); return; }
  }
  onProj(o) { if (this.active && this.isHost && this.conns.size) this.broadcast({ t: 'proj', o }); }
  announce(a, b, c, d, extra = {}) { if (this.active && this.isHost) this.broadcast(Object.assign({ t: 'card', a, b, c, d }, extra)); }
  bossDown(B, relicIdx) { if (this.active && this.isHost) this.broadcast({ t: 'bossEnd', name: B.name, k: this.game.bosses.arena ? this.game.bosses.arena.k : 0 }); }
  guestVictory(d) {
    const g = this.game, sv = g.save;
    // fighting beside a friend counts: the relic of your next gate is yours too
    if (this.worldBosses) this.worldBosses['g' + d.k] = true;
    const n = Object.keys(sv.bosses).length + (sv.coopRelics || 0);
    sv.coopRelics = (sv.coopRelics || 0) + 1;
    const relic = n < 4 ? RELICS[n] : RELICS[4];
    if (relic.id === 'vessel') { sv.maxHp++; g.player.hp = sv.maxHp; }
    else { sv.abil[relic.id] = true; if (relic.id === 'djump' || relic.id === 'wall') g.player.actor.abil[relic.id] = true; }
    g.story.card(relic.name, relic.desc, 'gain', 3.6);
    Audio.play('chime');
    g.saveNow();
  }
  prune(ids) {
    for (const [id, r] of this.remotes) if (!ids.has(id) || id === this.myId) { r.actor.removed = true; this.remotes.delete(id); }
    this.peers = 1 + this.remotes.size; this.updateHud();
  }
  clearPuppets() { for (const a of this.puppets.values()) a.removed = true; this.puppets.clear(); }

  // name tags
  draw(ctx, a, layer) {
    if (layer !== 'front' || !this.active) return;
    ctx.save();
    ctx.font = '600 11px Manrope, sans-serif'; ctx.textAlign = 'center';
    for (const r of this.remotes.values()) {
      const b = r.actor.body;
      const x = b.ipx(P.HEAD, a), y = b.ipy(P.HEAD, a) - 22;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(r.name, x + 1, y + 1);
      ctx.fillStyle = '#bff6ff'; ctx.fillText(r.name, x, y);
    }
    ctx.restore();
  }
  lights(arr) { for (const r of this.remotes.values()) arr.push({ x: r.actor.c.x, y: r.actor.c.y - 50, c: [0.85, 0.95, 1], s: 0.6 }); }
}
export { mulberry, clamp, sign };
