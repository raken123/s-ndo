/* ==========================================================================
   app.js — start, Cordova-koppling, hårdvaruknappar
   ========================================================================== */
(function (M) {
  'use strict';

  function boot() {
    M.load();
    M.ui.refreshChips();
    M.ui.show('home');

    // Nya prestationer kan ha tillkommit sedan förra versionen
    var fresh = M.checkAchievements();
    if (fresh.length) setTimeout(function () { M.ui.achToast(fresh); }, 800);

    // Tabbar
    M.ui.$$('.tabbar button').forEach(function (b) {
      b.onclick = function () { M.ui.show(b.dataset.tab); };
    });

    // Stäng modal när man klickar utanför
    M.ui.$('#modal').onclick = function (e) {
      if (e.target.id === 'modal') M.ui.closeModal();
    };

    // Spara när appen går i bakgrunden
    document.addEventListener('pause', M.save, false);
    window.addEventListener('beforeunload', M.save);

    // Android-bakåtknapp
    document.addEventListener('backbutton', function () {
      if (M.ui.$('#modal').classList.contains('open')) return M.ui.closeModal();
      if (M.game.running) return M.ui.show('home');
      if (M.ui.current !== 'home') return M.ui.show('home');
      if (navigator.app && navigator.app.exitApp) navigator.app.exitApp();
    }, false);

    // Tangentbord: 1-4 svarar, Esc stänger modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') return M.ui.closeModal();
      if (M.game.running && M.game.phase === 'answer' && /^[1-4]$/.test(e.key)) {
        M.game.answer(parseInt(e.key, 10) - 1);
      }
    });
  }

  // Spelet behöver inga Cordova-plugin, så vi startar direkt och låter
  // cordova.js ladda i bakgrunden för bakåtknappen och pause-händelsen.
  if (window.location.protocol === 'file:' && !window.cordova) {
    var s = document.createElement('script');
    s.src = 'cordova.js';
    s.onerror = function () { /* körs utanför Cordova — spelet fungerar ändå */ };
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.MATTENITE = window.MATTENITE || {});
