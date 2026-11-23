// CrazyGames HTML5 SDK v3, wrapped. Every call is guarded: off CrazyGames, offline or with the SDK
// blocked, the game runs the same (localStorage saves, URL invite params, no platform UI).
// Method names follow the v3 SDK: game.gameplayStart/Stop, loadingStart/Stop, happytime, inviteLink,
// showInviteButton/hideInviteButton, isInstantMultiplayer, getInviteParam, updateRoom, leftRoom,
// addJoinRoomListener, settings + addSettingsChangeListener, user.getUser/addAuthListener/showAuthPrompt,
// data.getItem/setItem/removeItem.

const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };

export const Platform = {
  sdk: null, env: 'standalone', user: null, inGameplay: false,
  userListeners: [], settingsListeners: [], joinListeners: [], adListeners: [],
  adActive: false, lastAd: performance.now(), adCount: 0,
  muted: false,

  async init() {
    // wait briefly for the async SDK script
    const t0 = performance.now();
    while (!(window.CrazyGames && window.CrazyGames.SDK) && !window.__cgFail && performance.now() - t0 < 2500) await new Promise(r => setTimeout(r, 50));
    const S = window.CrazyGames && window.CrazyGames.SDK;
    if (!S) return this;
    try {
      await Promise.race([S.init(), new Promise((_, no) => setTimeout(() => no(new Error('sdk timeout')), 4000))]);
      this.sdk = S;
      this.env = S.environment || 'crazygames';
      if (this.env === 'disabled') { this.sdk = null; return this; }
    } catch (e) { this.sdk = null; return this; }
    if (this.loading) { safe(() => this.sdk.game.loadingStart()); if (this.loading === 'stopped') safe(() => this.sdk.game.loadingStop()); }
    if (this.inGameplay) safe(() => this.sdk.game.gameplayStart());
    safe(() => {
      this.applySettings(this.sdk.game.settings);
      this.sdk.game.addSettingsChangeListener(s => this.applySettings(s));
    });
    safe(() => this.sdk.user.addAuthListener(u => this.setUser(u)));
    safe(() => {
      if (this.sdk.user.isUserAccountAvailable !== false) {
        const p = this.sdk.user.getUser();
        if (p && p.then) p.then(u => this.setUser(u)).catch(() => {});
      }
    });
    safe(() => this.sdk.game.addJoinRoomListener(params => { for (const f of this.joinListeners) f(params || {}); }));
    return this;
  },
  applySettings(s) {
    if (!s) return;
    this.muted = !!s.muteAudio;
    for (const f of this.settingsListeners) f(s);
  },
  setUser(u) { this.user = u || null; for (const f of this.userListeners) f(this.user); },
  onUser(f) { this.userListeners.push(f); if (this.user) f(this.user); },
  onSettings(f) { this.settingsListeners.push(f); },
  onJoinRoom(f) { this.joinListeners.push(f); },
  get username() { return this.user && this.user.username ? String(this.user.username).slice(0, 18) : null; },
  authPrompt() { safe(() => this.sdk && this.sdk.user.showAuthPrompt()); },

  // ---------------- lifecycle ----------------
  // loading events can be asked for before init finishes; they are replayed once the SDK is ready
  loadingStart() { this.loading = 'started'; safe(() => this.sdk && this.sdk.game.loadingStart()); },
  loadingStop() { this.loading = 'stopped'; safe(() => this.sdk && this.sdk.game.loadingStop()); },
  gameplayStart() { if (this.inGameplay) return; this.inGameplay = true; safe(() => this.sdk && this.sdk.game.gameplayStart()); },
  gameplayStop() { if (!this.inGameplay) return; this.inGameplay = false; safe(() => this.sdk && this.sdk.game.gameplayStop()); },
  happytime() { safe(() => this.sdk && this.sdk.game.happytime()); },

  // ---------------- ads ----------------
  // The game pauses and goes silent for the whole ad (onAd listeners), and gameplay events are stopped.
  // Midgame ads only at natural breaks (respawn), never in the first 3 minutes and at most every 3 minutes.
  // Rewarded ads are always the player's choice and only pay out when the ad finished.
  get adsReady() { return !!(this.sdk && this.sdk.ad && this.sdk.ad.requestAd); },
  onAd(f) { this.adListeners.push(f); },
  setAd(on) { this.adActive = on; for (const f of this.adListeners) f(on); },
  requestAd(type) {
    return new Promise(res => {
      if (!this.adsReady || this.adActive) return res(false);
      let done = false, started = false;
      const end = (ok) => { if (done) return; done = true; if (started) this.setAd(false); this.lastAd = performance.now(); this.adCount++; res(ok); };
      const cb = {
        adStarted: () => { started = true; this.setAd(true); },
        adFinished: () => end(true),
        adError: () => end(false),
      };
      const fail = safe(() => { this.sdk.ad.requestAd(type, cb); return false; }, true);
      if (fail) end(false);
      setTimeout(() => end(false), 90000);   // never hang the game on a lost callback
    });
  },
  midgameDue() { return this.adsReady && performance.now() - this.lastAd > 180000; },
  midgame() { return this.midgameDue() ? this.requestAd('midgame') : Promise.resolve(false); },
  rewarded() { return this.requestAd('rewarded'); },

  // ---------------- storage ----------------
  getItem(k) {
    const v = safe(() => this.sdk && this.sdk.data ? this.sdk.data.getItem(k) : null, null);
    if (v !== null && v !== undefined) return v;
    return safe(() => localStorage.getItem(k), null);
  },
  setItem(k, v) {
    safe(() => this.sdk && this.sdk.data && this.sdk.data.setItem(k, v));
    safe(() => localStorage.setItem(k, v));
  },
  removeItem(k) {
    safe(() => this.sdk && this.sdk.data && this.sdk.data.removeItem(k));
    safe(() => localStorage.removeItem(k));
  },

  // ---------------- multiplayer / invites ----------------
  isInstantMultiplayer() { return !!safe(() => this.sdk && this.sdk.game.isInstantMultiplayer, false); },
  inviteParam(name) {
    const v = safe(() => this.sdk && this.sdk.game.getInviteParam ? this.sdk.game.getInviteParam(name) : null, null);
    if (v) return v;
    return safe(() => new URLSearchParams(location.search).get(name), null);
  },
  async inviteLink(params) {
    const v = await Promise.resolve(safe(() => this.sdk && this.sdk.game.inviteLink(params), null)).catch(() => null);
    if (v) return v;
    const u = new URL(location.href);
    for (const k in params) u.searchParams.set(k, params[k]);
    return u.toString();
  },
  showInvite(params) { safe(() => this.sdk && this.sdk.game.showInviteButton(params)); },
  hideInvite() { safe(() => this.sdk && this.sdk.game.hideInviteButton()); },
  updateRoom(o) { safe(() => this.sdk && this.sdk.game.updateRoom && this.sdk.game.updateRoom(o)); },
  leftRoom() { safe(() => this.sdk && this.sdk.game.leftRoom && this.sdk.game.leftRoom()); },
};
