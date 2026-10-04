// Run inside the app by main.js when HUBAI_SMOKE=1 (CI starts the built app
// with it). Exercises the native bridge and, when a server is set, a real
// generation through Hub AI Cloud.
(async function () {
  var out = {};
  out.native = !!window.HubNative && HubBridge.native;
  out.version = HubBridge.version();
  out.cloud = typeof Cloud === 'object' && Plans.engines().length === 8;
  var r = { html: HubTemplates.render('snake', { title: 'Snake', accent: '#2f9e5b', dark: true, persist: true, extras: true, n: null, topic: '', key: 'smoke', engine: 'smoke' }) };
  out.save = await HubBridge.save('My Snake.html', 'text/html', r.html);
  out.zip = await HubBridge.save('bundle.zip', 'application/zip', Zip.zip([{name:'index.html', data:r.html}]));
  out.share = await HubBridge.share('share me.html', 'text/html', r.html, 'hi');
  // A hub iframe must not see the bridge.
  var f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');
  f.srcdoc = '<script>parent.postMessage({iframeNative: typeof window.HubNative}, "*")<\/script>';
  out.iframe = await new Promise(function (res) {
    window.addEventListener('message', function (e) { res(e.data.iframeNative); }, { once: true });
    document.body.appendChild(f);
  });
  if (Cloud.configured()) {
    try {
      var g = await Cloud.generate('mini', 'a to-do list');
      out.generated = { ok: /<html/i.test(g.html), engine: g.engineName, base: g.base, credits: g.me.credits };
    } catch (e) {
      out.generated = { ok: false, error: e.message };
    }
  }
  out.ui = document.querySelector('#credits').textContent;
  return out;
})()
