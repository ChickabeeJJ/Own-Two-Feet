// Stand-in for the CrazyGames SDK v3 used by tests: records every call in window.__cg.calls and plays ads
// instantly (adStarted -> adFinished after 300 ms). Load it with page.addInitScript.
(() => {
  const calls = [];
  const rec = (n) => (...a) => { calls.push(n); };
  const store = {};
  window.__cg = { calls };
  window.CrazyGames = { SDK: {
    environment: 'local',
    init: async () => { calls.push('init'); },
    game: {
      settings: { muteAudio: false, disableChat: false },
      addSettingsChangeListener: rec('settingsListener'),
      loadingStart: rec('loadingStart'), loadingStop: rec('loadingStop'),
      gameplayStart: rec('gameplayStart'), gameplayStop: rec('gameplayStop'), happytime: rec('happytime'),
      isInstantMultiplayer: false, getInviteParam: () => null, inviteLink: (p) => 'https://example.test/?room=' + p.room,
      showInviteButton: rec('showInviteButton'), hideInviteButton: rec('hideInviteButton'),
      updateRoom: rec('updateRoom'), leftRoom: rec('leftRoom'), addJoinRoomListener: rec('joinListener'),
    },
    ad: { requestAd: (type, cb) => { calls.push('ad:' + type); setTimeout(() => { cb.adStarted && cb.adStarted(); setTimeout(() => cb.adFinished && cb.adFinished(), 300); }, 50); } },
    user: { isUserAccountAvailable: true, getUser: async () => null, addAuthListener: rec('authListener'), showAuthPrompt: rec('authPrompt') },
    data: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); calls.push('data.set'); }, removeItem: (k) => { delete store[k]; } },
  } };
})();
