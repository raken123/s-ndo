/* app.js — boot. */
(function (global) {
  'use strict';

  window.INFODOC_VERSION = window.INFODOC_VERSION || '1.0.0';

  function fail(e) {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;background:#0f1419;color:#e8edf2;' +
      'font:14px/1.6 system-ui,sans-serif;padding:32px;z-index:99;overflow:auto';
    box.innerHTML = '<h1 style="font-size:19px">InfoDoc could not start</h1>' +
      '<pre style="color:#f1a29a;white-space:pre-wrap">' +
      String(e && e.stack ? e.stack : e).replace(/[<&]/g, function (c) {
        return c === '<' ? '&lt;' : '&amp;';
      }) + '</pre>' +
      '<p style="color:#9fb0c0">Your records have not been touched.</p>';
    document.body.appendChild(box);
  }

  function boot() {
    Store.load().then(function () {
      UI.init();
      var e = Store.lastError();
      if (e) UI.toast(e);

      // the desktop menu drives the same actions the buttons do
      if (global.infodocNative && global.infodocNative.onMenu) {
        var byMenu = {
          'new-person': '#newPerson',
          'print-person': '#printPerson',
          'print-visit': '#printVisit',
          'export': '#exportJson',
          'import': '#importJson'
        };
        global.infodocNative.onMenu(function (what) {
          if (what.indexOf('view-') === 0) return UI.show(what.slice(5));
          var sel = byMenu[what];
          var btn = sel && document.querySelector(sel);
          if (!btn) return;
          if (what === 'print-person') UI.show('people');
          if (what === 'export' || what === 'import') UI.show('settings');
          btn.click();
        });
      }

      // Cmd/Ctrl+1..4 switch views; Escape stops whatever test is running
      document.addEventListener('keydown', function (ev) {
        if ((ev.metaKey || ev.ctrlKey) && ev.key >= '1' && ev.key <= '4') {
          var views = ['people', 'visit', 'device', 'settings'];
          UI.show(views[Number(ev.key) - 1]);
          ev.preventDefault();
        } else if (ev.key === 'Escape') {
          UI.cancelAllTests();
        }
      });
    }).catch(fail);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.addEventListener('error', function (ev) {
    if (global.UI && global.UI.log) global.UI.log('! ' + ev.message, 'er');
  });
})(window);
