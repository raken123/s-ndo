/* The subscription page.
 *
 * On a free plan the composer is watched keystroke by keystroke: the moment a
 * gated capability is named, this opens — before Send is ever pressed. Leaving
 * it by any route (✕, Esc, backdrop, the leave link) clears the composer, which
 * is the deal the page states out loud before you take it. */
window.AGENTER = window.AGENTER || {};

(function () {
  'use strict';
  var Store = AGENTER.Store, CFG = AGENTER.CONFIG;

  var el = {};
  var openCap = null, ticker = null, hooks = {};

  function $(id) { return document.getElementById(id); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function countdown() {
    var ms = CFG.deal.ends - new Date();
    if (ms <= 0) return 'last day';
    var d = Math.floor(ms / 86400000);
    var h = Math.floor(ms / 3600000) % 24;
    var m = Math.floor(ms / 60000) % 60;
    var s = Math.floor(ms / 1000) % 60;
    return d > 0 ? (d + 'd ' + pad(h) + ':' + pad(m) + ':' + pad(s))
                 : (pad(h) + ':' + pad(m) + ':' + pad(s) + ' left');
  }

  var Paywall = {
    init: function (h) {
      hooks = h || {};
      el.root     = $('paywall');
      el.close    = $('pwClose');
      el.leave    = $('pwLeave');
      el.buy      = $('pwBuy');
      el.reason   = $('pwReason');
      el.clock    = $('dealClock');
      el.robot    = $('paywallRobot');

      AGENTER.paintRobot(el.robot);

      $('priceWas').textContent  = AGENTER.money(CFG.price.full);
      $('priceNow').textContent  = AGENTER.money(CFG.price.discounted);
      $('buyPrice').textContent  = AGENTER.money(CFG.price.discounted);
      $('priceNote').textContent =
        CFG.deal.name + ': ' + CFG.deal.percentOff + '% off — you save ' +
        AGENTER.money(CFG.price.full - CFG.price.discounted) + ' every month.';
      $('perkUsage').textContent =
        '— ' + CFG.limits.pro + ' runs a day instead of ' + CFG.limits.free + '.';

      el.close.onclick = function () { Paywall.leave(); };
      el.leave.onclick = function () { Paywall.leave(); };
      el.root.onclick  = function (e) { if (e.target === el.root) Paywall.leave(); };
      el.buy.onclick   = function () { Paywall.buy(); };

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && Paywall.isOpen()) { e.preventDefault(); Paywall.leave(); }
      });
    },

    isOpen: function () { return el.root && !el.root.hidden; },

    open: function (cap) {
      if (Paywall.isOpen()) return;
      openCap = cap || null;
      el.reason.textContent = cap
        ? ('“' + cap.label + '” is a Pro capability.')
        : 'Five times the usage, and every capability unlocked.';
      el.root.hidden = false;
      el.clock.textContent = countdown();
      ticker = setInterval(function () { el.clock.textContent = countdown(); }, 1000);
      // Focus the buy button so keyboard and screen-reader users land inside the sheet.
      setTimeout(function () { el.buy.focus(); }, 30);
    },

    close: function () {
      if (!Paywall.isOpen()) return;
      el.root.hidden = true;
      clearInterval(ticker); ticker = null;
      openCap = null;
    },

    /* Left without subscribing — the prompt goes. */
    leave: function () {
      Paywall.close();
      if (hooks.onLeave) hooks.onLeave();
    },

    buy: function () {
      Store.setPlan('pro');
      var cap = openCap;
      Paywall.close();
      if (hooks.onBuy) hooks.onBuy(cap);
    },

    /* Watch a textarea and open the page mid-typing. */
    watch: function (input, onHint) {
      var timer = null;
      input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var cap = AGENTER.matchGate(input.value);
          if (onHint) onHint(cap);
          if (cap && !Store.isPro() && !Paywall.isOpen()) Paywall.open(cap);
        }, CFG.triggerDelay);
      });
    }
  };

  AGENTER.Paywall = Paywall;
})();
