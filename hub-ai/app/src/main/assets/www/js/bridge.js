/* Storage and the bridge to the Android shell (MainActivity.java, exposed as
 * window.HubNative). In a normal browser the same calls fall back to web
 * APIs, so the UI can be developed and tested without a phone.
 */
(function () {
  'use strict';

  var PREFIX = 'hubai.';
  window.Store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; }
    },
    clear: function () {
      try {
        Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIX) === 0) localStorage.removeItem(k); });
      } catch (e) { /* storage unavailable */ }
    }
  };

  var N = window.HubNative || null;
  var pending = {}, seq = 0, token = '';

  function utf8(s) { return new TextEncoder().encode(s); }
  function b64(bytes) {
    var out = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(out);
  }
  function toBytes(data) { return typeof data === 'string' ? utf8(data) : data; }

  function download(name, mime, data) {
    var url = URL.createObjectURL(new Blob([toBytes(data)], { type: mime }));
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  window.HubBridge = {
    native: !!N,

    // Saves to Downloads/Hub AI on the phone. Resolves to a short message.
    save: function (name, mime, data) {
      if (N) {
        var r = JSON.parse(N.saveFile(token, name, mime, b64(toBytes(data))));
        return r.ok ? Promise.resolve('Saved to ' + r.path) : Promise.reject(new Error(r.error));
      }
      download(name, mime, data);
      return Promise.resolve('Downloaded ' + name);
    },

    // Opens the system share sheet with the file attached (and text as a fallback).
    share: function (name, mime, data, text) {
      if (N) {
        var r = JSON.parse(N.shareFile(token, name, mime, b64(toBytes(data)), text || ''));
        return r.ok ? Promise.resolve() : Promise.reject(new Error(r.error));
      }
      try {
        var file = new File([toBytes(data)], name, { type: mime });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file], title: name, text: text || '' });
        }
      } catch (e) { /* fall through */ }
      download(name, mime, data);
      return Promise.resolve();
    },

    // HTTP without CORS limits when running inside the app.
    request: function (method, url, headers, body) {
      if (N) {
        return new Promise(function (resolve) {
          var id = 'r' + (++seq);
          pending[id] = resolve;
          N.httpRequest(token, id, method, url, JSON.stringify(headers || {}), body || '');
        });
      }
      return fetch(url, { method: method, headers: headers, body: body })
        .then(function (r) { return r.text().then(function (t) { return { status: r.status, body: t }; }); },
              function (e) { return { status: 0, body: String(e && e.message || e) }; });
    },

    // MainActivity hands the top page a token after it loads. Hub iframes
    // also see window.HubNative but never get the token.
    _setToken: function (t) { token = t; },

    // Called by MainActivity when a request finishes.
    _done: function (id, status, body) {
      var f = pending[id];
      delete pending[id];
      if (f) f({ status: status, body: body });
    },

    toast: function (msg) { if (N) N.toast(String(msg)); },
    version: function () { return N ? N.appVersion() : 'web'; }
  };
})();
