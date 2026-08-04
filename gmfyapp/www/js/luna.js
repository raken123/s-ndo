/* gmfy — Luna world generation.
 *
 * Turns a text prompt ("a snowy island with a finish line on the far peak")
 * into a world spec, which Gmfy.worldFromSpec() then validates and clamps
 * before anything reaches the engine. Model output is treated as untrusted
 * input: worldFromSpec already whitelists prop kinds, range-checks every
 * coordinate and rejects malformed colours, so a hostile or broken response
 * degrades to a plain generated world rather than corrupting one.
 *
 * ── Build quota ──────────────────────────────────────────────────────────
 * Each plan gets a number of generations per calendar month:
 *
 *     Free 5   ·   Go 50   ·   Pro 185   ·   Max 300
 *
 * The count is stored per account and resets when the month changes. Like
 * every other limit in this app it is device-local and advisory: a determined
 * user can clear localStorage and get their allowance back. Enforcing it for
 * real needs the same backend that would hold the API key (see below).
 *
 * ── Why there is no API key in this file ─────────────────────────────────
 * gmfy is a client-side app. Everything here ships inside the APK and inside
 * the single-file HTML build, both of which the user has on their device, so
 * anything embedded in this source is readable by anyone who installs it — a
 * bundled key would be extractable in seconds and billed to whoever owns it.
 * There is no obfuscation that fixes this; it is a property of shipping code
 * to a device.
 *
 * So a key is never bundled. Two supported setups, in order of preference:
 *
 *   1. PROXY (the real one). Point Luna at your own endpoint that holds the
 *      key server-side, checks who the caller is and enforces the quota
 *      somewhere the user cannot edit. Set window.GMFY_LUNA_PROXY, or call
 *      GmfyLuna.setProxy(url). No key is stored on the device at all.
 *
 *   2. BRING YOUR OWN KEY (development, or power users). The user pastes
 *      their own key, which is kept in localStorage on their own device and
 *      spends their own credits. Never ship someone else's key this way.
 */
(function (global) {
  'use strict';

  // generations per calendar month, by plan id
  var QUOTA = { free: 5, go: 50, pro: 185, max: 300 };

  var MODEL = 'gpt-5.6-luna';
  var ENDPOINT = 'https://api.openai.com/v1/chat/completions';

  var K_USED  = 'gmfy.luna.used.v1';     // {period:'YYYY-MM', n:Number}
  var K_KEY   = 'gmfy.luna.key.v1';      // the user's own key, their device
  var K_PROXY = 'gmfy.luna.proxy.v1';

  var BIOMES = ['meadow', 'forest', 'beach', 'hills', 'snow', 'sunset'];
  // worldFromSpec only accepts these seven; asking for others just wastes
  // tokens on props that get rewritten to 'block'
  var KINDS = ['tower', 'block', 'tree', 'cactus', 'spike', 'rock', 'dome'];

  function scoped(k) {
    return global.GmfyAuth ? global.GmfyAuth.scope(k) : k;
  }
  function read(k, dflt) {
    try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : dflt; }
    catch (e) { return dflt; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  function planId() {
    return global.GmfyPlans ? global.GmfyPlans.current().id : 'free';
  }
  function period() {
    var d = new Date();
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2);
  }

  function quota() { return QUOTA[planId()] || 0; }

  function used() {
    var rec = read(scoped(K_USED), null);
    if (!rec || rec.period !== period()) return 0;      // a new month starts over
    return rec.n || 0;
  }

  function left() { return Math.max(0, quota() - used()); }

  function spend() {
    write(scoped(K_USED), { period: period(), n: used() + 1 });
  }

  // ---- credentials (never bundled — see the header) ----
  function proxy() {
    return global.GMFY_LUNA_PROXY || read(scoped(K_PROXY), null) || null;
  }
  function setProxy(url) {
    if (url) write(scoped(K_PROXY), String(url));
    else { try { localStorage.removeItem(scoped(K_PROXY)); } catch (e) {} }
  }
  function key() {
    return global.GMFY_LUNA_KEY || read(scoped(K_KEY), null) || null;
  }
  function setKey(k) {
    if (k) write(scoped(K_KEY), String(k).trim());
    else { try { localStorage.removeItem(scoped(K_KEY)); } catch (e) {} }
  }
  function configured() { return !!(proxy() || key()); }

  function prompt(text) {
    return 'Design a small 3D game world. Reply with JSON only, no prose.\n' +
      'Schema: {"biome": one of ' + BIOMES.join('|') + ',\n' +
      ' "relief": number 0.1-3 (how hilly),\n' +
      ' "props": [{"kind": one of ' + KINDS.join('|') + ',\n' +
      '   "x": -17..17, "z": -17..17, "h": 0.4..12, "w": 0.2..3,\n' +
      '   "col": "#rrggbb"}]}\n' +
      'Use 12-40 props, spread out, no two at the same spot.\n' +
      'The world to build: ' + text;
  }

  // Models like to wrap JSON in prose or a fenced block; take the outermost
  // braces rather than trusting the whole body to parse.
  function extract(body) {
    if (!body) return null;
    var a = body.indexOf('{'), b = body.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(body.slice(a, b + 1)); } catch (e) { return null; }
  }

  /* Generate a world spec. cb(err, spec) — spec is raw model output and must
     still go through Gmfy.worldFromSpec(), which does the validation. */
  function generate(text, cb) {
    text = (text || '').trim();
    if (!text) { cb('Describe the world you want first.'); return; }
    if (!configured()) {
      cb('Luna needs an endpoint. Add a proxy URL, or your own API key, below.');
      return;
    }
    if (left() <= 0) {
      cb('No builds left this month on ' + planId().toUpperCase() +
         ' (' + quota() + '/month). Upgrade for more.');
      return;
    }

    var url = proxy() || ENDPOINT;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    // a proxy holds its own credentials; only the BYO-key path sends one
    if (!proxy() && key()) xhr.setRequestHeader('Authorization', 'Bearer ' + key());
    xhr.timeout = 60000;

    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300) {
        cb('Luna returned ' + xhr.status + (xhr.status === 401
          ? ' — the key was rejected.' : '.'));
        return;
      }
      var body = null, spec = null;
      try { body = JSON.parse(xhr.responseText); } catch (e) {}
      // accept both a chat-completions shape and a proxy that just returns
      // the spec, so a self-hosted endpoint does not have to imitate an API
      var msg = body && body.choices && body.choices[0] &&
                body.choices[0].message && body.choices[0].message.content;
      spec = msg ? extract(msg) : (body && body.props ? body : null);
      if (!spec) { cb('Luna sent something this build could not read.'); return; }
      spend();                                   // only a usable world costs a build
      cb(null, spec);
    };
    xhr.onerror = function () { cb('Could not reach Luna. Check the connection.'); };
    xhr.ontimeout = function () { cb('Luna timed out.'); };

    xhr.send(JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt(text) }],
      response_format: { type: 'json_object' }
    }));
  }

  global.GmfyLuna = {
    QUOTA: QUOTA, MODEL: MODEL,
    quota: quota, used: used, left: left, spend: spend,
    generate: generate, configured: configured,
    key: key, setKey: setKey, proxy: proxy, setProxy: setProxy
  };
})(window);
