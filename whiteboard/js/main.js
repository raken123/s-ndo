/* Start */
(function (App) {
  'use strict';
  App.version = '1.0.0';
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { App.boot(); });
  } else {
    App.boot();
  }
})(window.App);
