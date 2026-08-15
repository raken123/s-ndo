/* Agenter — configuration.
 *
 * No API key lives in this file, and none is baked into any build. The key is
 * entered once in Settings and kept in this device's local storage. See
 * agenter/README.md for why: a key shipped inside an APK or an Electron asar is
 * readable by anyone who unzips it, and a key committed to git gets revoked by
 * secret scanning within minutes.
 */
window.AGENTER = window.AGENTER || {};

(function () {
  'use strict';

  // The Back To School window: 30 September, rolling to next year once it passes,
  // so a build that sits around for a while never shows a dead countdown.
  function dealEnds() {
    var now = new Date();
    var end = new Date(now.getFullYear(), 8, 30, 23, 59, 59); // month 8 = September
    if (end < now) end = new Date(now.getFullYear() + 1, 8, 30, 23, 59, 59);
    return end;
  }

  var PRO_MONTHLY = 20.00;
  var PERCENT_OFF = 75;

  AGENTER.CONFIG = {
    version: '1.0.0',
    appId: 'com.agenter.app',

    // "Gemini 3.5 Flash" is not a model Google publishes. gemini-2.5-flash is the
    // current Flash tier and is what this defaults to; override it in Settings.
    model: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',

    deal: {
      name: 'Back To School',
      percentOff: PERCENT_OFF,
      ends: dealEnds()
    },

    price: {
      currency: '$',
      full: PRO_MONTHLY,
      discounted: Math.round(PRO_MONTHLY * (100 - PERCENT_OFF)) / 100
    },

    // Pro is five times the free allowance.
    limits: { free: 10, pro: 50 },

    /* Capabilities that Pro unlocks. `test` is matched against the composer on
     * every keystroke — a hit opens the subscription page before Send is pressed.
     * Word boundaries keep "provide" from looking like "video". */
    gated: [
      { id: 'game3d',  label: '3D game',        test: /\b3\s*-?\s*d\b[\s-]*(game|games)\b/i },
      { id: 'cordova', label: 'Cordova app',    test: /\bcordova\b(?:[\s-]*(app|apk|application|project|build))?/i },
      { id: 'video',   label: 'Video',          test: /\bvideos?\b/i },
      { id: 'anim',    label: 'Animation',      test: /\banimations?\b|\banimated\b|\banimate\b/i },
      { id: 'device',  label: 'Device control', test: /\bdevice[\s-]*control\b|\bcontrol\s+(?:my|the|this)\s+device\b/i }
    ],

    // Milliseconds after the last keystroke before the composer is re-scanned.
    triggerDelay: 180
  };

  AGENTER.CONFIG.gatedById = AGENTER.CONFIG.gated.reduce(function (m, c) {
    m[c.id] = c; return m;
  }, {});

  /* First gated capability mentioned in `text`, or null. */
  AGENTER.matchGate = function (text) {
    if (!text) return null;
    var list = AGENTER.CONFIG.gated;
    for (var i = 0; i < list.length; i++) {
      if (list[i].test.test(text)) return list[i];
    }
    return null;
  };

  AGENTER.money = function (n) {
    return AGENTER.CONFIG.price.currency + n.toFixed(2);
  };
})();
