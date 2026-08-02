/* gmfy — accounts.
 *
 * SCOPE: this is on-device auth. Accounts live in localStorage on this phone
 * and are never sent anywhere. Passwords are stored as a salted SHA-256 digest
 * rather than plaintext, so a casual look at app storage does not reveal them —
 * but anyone with the unlocked device and developer tools can clear the store
 * and register again. It gates the UI; it is not a security boundary, and it is
 * not a substitute for a real server-side login.
 */
(function (global) {
  'use strict';

  var USERS = 'gmfy.users.v1';
  var SESSION = 'gmfy.session.v1';

  function read(key, dflt) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : dflt;
    } catch (e) { return dflt; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  function randSalt() {
    var a = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(a);
    else for (var i = 0; i < 16; i++) a[i] = (Math.random() * 256) | 0;
    return Array.prototype.map.call(a, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  /* SHA-256 where available (secure context); otherwise a clearly-labelled
     non-cryptographic fallback so the app still works. */
  function digest(text) {
    if (global.crypto && global.crypto.subtle && global.TextEncoder) {
      return global.crypto.subtle
        .digest('SHA-256', new TextEncoder().encode(text))
        .then(function (buf) {
          return Array.prototype.map.call(new Uint8Array(buf), function (b) {
            return ('0' + b.toString(16)).slice(-2);
          }).join('');
        })
        .catch(function () { return 'weak:' + weakHash(text); });
    }
    return Promise.resolve('weak:' + weakHash(text));
  }

  function weakHash(str) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) {
      h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 + str.charCodeAt(i) * (i + 7), 2246822519) >>> 0;
    }
    return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }

  function normEmail(e) { return String(e || '').trim().toLowerCase(); }

  function validate(email, password) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail(email)))
      return 'Enter a valid email address.';
    if (String(password || '').length < 6)
      return 'Password needs at least 6 characters.';
    return null;
  }

  var Auth = {
    /* resolves { ok:true, user } or { ok:false, error } */
    signUp: function (email, password) {
      var err = validate(email, password);
      if (err) return Promise.resolve({ ok: false, error: err });

      var mail = normEmail(email);
      var users = read(USERS, {});
      if (users[mail]) return Promise.resolve({ ok: false, error: 'That account already exists — sign in instead.' });

      var salt = randSalt();
      return digest(salt + ':' + password).then(function (h) {
        users[mail] = { salt: salt, hash: h, created: Date.now() };
        if (!write(USERS, users))
          return { ok: false, error: 'Device storage is unavailable.' };
        write(SESSION, { email: mail, at: Date.now() });
        return { ok: true, user: { email: mail } };
      });
    },

    signIn: function (email, password) {
      var mail = normEmail(email);
      var users = read(USERS, {});
      var rec = users[mail];
      if (!rec) return Promise.resolve({ ok: false, error: 'No account for that email.' });

      return digest(rec.salt + ':' + password).then(function (h) {
        if (h !== rec.hash) return { ok: false, error: 'Wrong password.' };
        write(SESSION, { email: mail, at: Date.now() });
        return { ok: true, user: { email: mail } };
      });
    },

    current: function () {
      var s = read(SESSION, null);
      return (s && s.email) ? { email: s.email } : null;
    },

    signOut: function () {
      try { localStorage.removeItem(SESSION); } catch (e) {}
    },

    /* per-account key so saved worlds don't leak between users */
    scope: function (key) {
      var u = Auth.current();
      return key + '::' + (u ? u.email : 'guest');
    }
  };

  global.GmfyAuth = Auth;
})(window);
