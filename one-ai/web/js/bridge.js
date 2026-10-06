/* Storage and the bridge to the native shells (MainActivity.java on Android,
 * preload.js on desktop, OneAI/WebView.swift on iOS, all exposed as
 * window.OneNative). In a browser the same calls fall back to web APIs.
 */
(function () {
  'use strict';

  var PREFIX = 'oneai.';
  window.Store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; }
    },
    remove: function (k) { try { localStorage.removeItem(PREFIX + k); } catch (e) { /* unavailable */ } }
  };

  // Chats (with their files) live in IndexedDB; localStorage is too small.
  // Without IndexedDB they are kept in memory for the session.
  var memory = {};
  var dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise(function (res) {
        try {
          var r = indexedDB.open('oneai', 1);
          r.onupgradeneeded = function () { r.result.createObjectStore('chats', { keyPath: 'id' }); };
          r.onsuccess = function () { res(r.result); };
          r.onerror = function () { res(null); };
        } catch (e) { res(null); }
      });
    }
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      if (!d) { var o = fn(null); return o && o.result !== undefined ? o.result : o; }
      return new Promise(function (res, rej) {
        var t = d.transaction('chats', mode), s = t.objectStore('chats'), out = fn(s);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  window.Chats = {
    all: function () {
      return tx('readonly', function (s) { return s ? s.getAll() : { result: Object.values(memory) }; })
        .then(function (list) { return (list || []).sort(function (a, b) { return b.updated - a.updated; }); });
    },
    put: function (chat) {
      return tx('readwrite', function (s) { if (s) s.put(chat); else memory[chat.id] = chat; });
    },
    remove: function (id) {
      return tx('readwrite', function (s) { if (s) s.delete(id); else delete memory[id]; });
    },
    clear: function () {
      return tx('readwrite', function (s) { if (s) s.clear(); else memory = {}; });
    }
  };

  var N = window.OneNative || null;
  var token = '';

  function utf8(s) { return new TextEncoder().encode(s); }
  function b64(bytes) {
    var out = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(out);
  }
  function toBytes(data) { return typeof data === 'string' ? utf8(data) : data; }

  // Android and desktop answer at once with a JSON string; iOS answers with
  // a Promise of one.
  function native(answer) {
    return Promise.resolve(answer).then(function (s) {
      var r = typeof s === 'string' ? JSON.parse(s) : s;
      if (!r || !r.ok) throw new Error((r && r.error) || 'Kunde inte spara');
      return r;
    });
  }

  function download(name, mime, data) {
    var url = URL.createObjectURL(new Blob([toBytes(data)], { type: mime }));
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  window.OneBridge = {
    native: !!N,
    b64: b64,

    // Saves to Downloads/One AI on phones (a save dialog on desktop).
    save: function (name, mime, data) {
      if (N) {
        return native(N.saveFile(token, name, mime, b64(toBytes(data)))).then(function (r) { return r.message || ('Sparad: ' + r.path); });
      }
      download(name, mime, data);
      return Promise.resolve('Laddade ner ' + name);
    },

    // The system share sheet with the file attached. Desktops save the file
    // and show it in the file manager instead.
    share: function (name, mime, data, text) {
      if (N) {
        return native(N.shareFile(token, name, mime, b64(toBytes(data)), text || '')).then(function (r) { return r.message || ''; });
      }
      try {
        var file = new File([toBytes(data)], name, { type: mime });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file], title: name, text: text || '' }).then(function () { return ''; });
        }
      } catch (e) { /* fall through */ }
      download(name, mime, data);
      return Promise.resolve('Laddade ner ' + name);
    },

    // The Android shell hands the top page a token after loading; previews
    // in iframes also see window.OneNative but never get the token.
    _setToken: function (t) { token = t; },
    version: function () { return N && N.appVersion ? N.appVersion() : 'webb'; },
    platform: function () { return N && N.platform ? N.platform() : 'web'; }
  };
})();
