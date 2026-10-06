// Run inside the app by main.js when ONEAI_SMOKE=1 (CI starts the built
// apps with it). Checks the UI, the native bridge and, when a server is
// set, a real chat and file through One AI Cloud.
(async function () {
  var out = {};
  out.native = !!window.OneNative && OneBridge.native;
  out.version = OneBridge.version();
  out.ui = !!document.getElementById('composer') && typeof Api === 'object' && typeof Markdown === 'object';
  out.save = await OneBridge.save('test åäö.txt', 'text/plain', 'One AI');
  // A preview iframe must not see the bridge.
  var f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');
  f.srcdoc = '<script>parent.postMessage({iframeNative: typeof window.OneNative}, "*")<\/script>';
  out.iframe = await new Promise(function (res) {
    window.addEventListener('message', function (e) { res(e.data.iframeNative); }, { once: true });
    document.body.appendChild(f);
  });
  if (Api.configured()) {
    try {
      var r = await Api.chat({ model: 'one-1-standard', agent: 'filegent', messages: [{ role: 'user', text: 'Skapa filen rapport.pdf' }] });
      out.chat = { ok: r.files.length > 0 && r.files[0].name === 'rapport.pdf', units: r.me.units };
    } catch (e) {
      out.chat = { ok: false, error: e.message };
    }
  }
  return out;
})()
