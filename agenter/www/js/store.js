/* Persistence: plan, usage allowance, API key, sessions.
 *
 * localStorage is unavailable on some file:// origins, so every access goes
 * through a wrapper that quietly degrades to an in-memory map for the session. */
window.AGENTER = window.AGENTER || {};

(function () {
  'use strict';
  var PREFIX = 'agenter.';
  var memory = {};
  var backing = (function () {
    try {
      var k = PREFIX + '__probe';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return window.localStorage;
    } catch (e) {
      return null;
    }
  })();

  function get(key, fallback) {
    var raw;
    try {
      raw = backing ? backing.getItem(PREFIX + key) : memory[key];
    } catch (e) { raw = memory[key]; }
    if (raw === null || raw === undefined) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function set(key, value) {
    var raw = JSON.stringify(value);
    memory[key] = raw;
    try { if (backing) backing.setItem(PREFIX + key, raw); } catch (e) { /* quota / private mode */ }
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  var Store = {
    /* ── plan ─────────────────────────────────────────────── */
    plan: function () { return get('plan', 'free') === 'pro' ? 'pro' : 'free'; },
    isPro: function () { return Store.plan() === 'pro'; },
    setPlan: function (p) { set('plan', p === 'pro' ? 'pro' : 'free'); },

    /* ── usage, reset each local day ──────────────────────── */
    usage: function () {
      var u = get('usage', null);
      if (!u || u.day !== today()) { u = { day: today(), used: 0 }; set('usage', u); }
      return u;
    },
    limit: function () {
      var L = AGENTER.CONFIG.limits;
      return Store.isPro() ? L.pro : L.free;
    },
    remaining: function () { return Math.max(0, Store.limit() - Store.usage().used); },
    spend: function () {
      var u = Store.usage();
      u.used += 1;
      set('usage', u);
      return u;
    },

    /* ── credentials ──────────────────────────────────────── */
    apiKey: function () { return get('apiKey', '') || ''; },
    setApiKey: function (k) { set('apiKey', (k || '').trim()); },
    model: function () { return get('model', '') || AGENTER.CONFIG.model; },
    setModel: function (m) { set('model', (m || '').trim()); },
    hasKey: function () { return Store.apiKey().length > 0; },

    /* ── sessions ─────────────────────────────────────────── */
    sessions: function () { return get('sessions', []); },
    saveSessions: function (list) { set('sessions', list.slice(0, 40)); },
    currentId: function () { return get('currentId', null); },
    setCurrentId: function (id) { set('currentId', id); }
  };

  AGENTER.Store = Store;
})();
