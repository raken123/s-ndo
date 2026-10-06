/* One AI Cloud client. The address comes from Settings, js/config.js, or
 * (for the web app the server hosts itself) the page's own origin. */
(function () {
  'use strict';

  function base() {
    var s = Store.get('settings', {});
    var url = (s.cloudUrl || (window.ONE_CONFIG && ONE_CONFIG.cloudUrl) || '').trim();
    // The web app hosted by One AI Cloud talks to its own server; the Android
    // app's local asset host is not a server.
    if (!url && /^https?:$/.test(location.protocol) && location.hostname !== 'appassets.androidplatform.net') url = location.origin;
    return url.replace(/\/+$/, '');
  }

  function ApiError(message, status, code) {
    var e = new Error(message);
    e.status = status; e.code = code;
    return e;
  }

  function request(method, path, body, opts) {
    opts = opts || {};
    var url = base();
    if (!url) return Promise.reject(ApiError('Ange adressen till One AI Cloud under Inställningar.', 0, 'setup'));
    var headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    var token = Store.get('token', '');
    if (opts.auth !== false && token) headers.Authorization = 'Bearer ' + token;
    return fetch(url + path, { method: method, headers: headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: opts.signal })
      .catch(function (e) {
        if (e.name === 'AbortError') throw e;
        throw ApiError('Kan inte nå One AI Cloud. Kontrollera anslutningen.', 0, 'network');
      })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) throw ApiError(data.error || ('Fel ' + r.status), r.status, data.code);
          return data;
        });
      });
  }

  var accountPromise = null;
  function ensureAccount() {
    if (Store.get('token', '')) return Promise.resolve();
    if (!accountPromise) {
      accountPromise = request('POST', '/v1/accounts', {}, { auth: false }).then(function (a) {
        Store.set('token', a.token);
        Store.set('account', a.account);
      }).finally(function () { accountPromise = null; });
    }
    return accountPromise;
  }

  // Authenticated call; a server that forgot the account (new database)
  // gets a fresh one once.
  function authed(method, path, body, opts) {
    return ensureAccount().then(function () { return request(method, path, body, opts); }).catch(function (e) {
      if (e.status === 401 && !(opts && opts.retried)) {
        Store.remove('token');
        return authed(method, path, body, Object.assign({}, opts, { retried: true }));
      }
      throw e;
    });
  }

  window.Api = {
    base: base,
    configured: function () { return !!base(); },
    config: function () { return request('GET', '/v1/config', undefined, { auth: false }); },
    me: function () { return authed('GET', '/v1/me'); },
    chat: function (body, signal) { return authed('POST', '/v1/chat', body, { signal: signal }); },
    subscribe: function (plan) { return authed('POST', '/v1/subscribe', { plan: plan }); },
    cancel: function () { return authed('POST', '/v1/cancel', {}); },
    mcpList: function () { return authed('GET', '/v1/mcp/servers'); },
    mcpAdd: function (name, url, token) { return authed('POST', '/v1/mcp/servers', { name: name, url: url, token: token || undefined }); },
    mcpUpdate: function (id, enabled) { return authed('POST', '/v1/mcp/servers/update', { id: id, enabled: enabled }); },
    mcpDelete: function (id) { return authed('POST', '/v1/mcp/servers/delete', { id: id }); }
  };
})();
