/* Client for Hub AI Cloud (hub-ai/cloud), where the Hub agents run.
 *
 * The first call creates an anonymous account on the server and keeps its
 * token on this device. Plans, credits and daily caps are enforced by the
 * server; the copies kept here are only for display.
 */
(function () {
  'use strict';

  function url() {
    var u = Store.get('settings', {}).cloudUrl || (window.HUB_CONFIG && window.HUB_CONFIG.cloudUrl) || '';
    return u.trim().replace(/\/+$/, '');
  }

  // The token belongs to one server; switching servers makes a new account.
  function auth() {
    var a = Store.get('cloud.auth', null);
    return a && a.url === url() ? a : null;
  }

  function request(method, path, body, token) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(url() + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (r.ok) return data;
          var err = new Error(data.error || ('Hub AI Cloud answered ' + r.status));
          err.status = r.status; err.code = data.code;
          throw err;
        });
      }, function () {
        var err = new Error('Can\'t reach Hub AI Cloud at ' + url() + '. Check your connection or the server address in Settings.');
        err.code = 'offline';
        throw err;
      });
  }

  function account() {
    var a = auth();
    if (a) return Promise.resolve(a);
    return request('POST', '/v1/accounts').then(function (d) {
      a = { url: url(), token: d.token, account: d.account };
      Store.set('cloud.auth', a);
      return a;
    });
  }

  // Authenticated call; a token the server no longer knows is replaced once.
  function call(method, path, body, retried) {
    if (!url()) {
      var e = new Error('Connect to Hub AI Cloud first: add the server address in Settings.');
      e.code = 'no_server';
      return Promise.reject(e);
    }
    return account().then(function (a) {
      return request(method, path, body, a.token);
    }).catch(function (err) {
      if (err.status === 401 && !retried) {
        Store.set('cloud.auth', null);
        return call(method, path, body, true);
      }
      throw err;
    });
  }

  function keepMe(me) { if (me) Store.set('cloud.me', me); return me; }

  window.Cloud = {
    url: url,
    configured: function () { return !!url(); },
    account: function () { var a = auth(); return a && a.account; },

    // Fetches plans/agents and this account's status.
    refresh: function () {
      if (!url()) return Promise.reject(new Error('No server set.'));
      return Promise.all([
        request('GET', '/v1/config').then(function (c) { Store.set('cloud.config', c); return c; }),
        call('GET', '/v1/me').then(keepMe)
      ]);
    },
    generate: function (engine, prompt) {
      return call('POST', '/v1/generate', { engine: engine, prompt: prompt }).then(function (r) { keepMe(r.me); return r; });
    },
    subscribe: function (plan) { return call('POST', '/v1/subscribe', { plan: plan }).then(keepMe); },
    cancel: function () { return call('POST', '/v1/cancel').then(keepMe); },
    forget: function () { Store.set('cloud.auth', null); Store.set('cloud.me', null); }
  };
})();
