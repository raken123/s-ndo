// Run inside the app by main.js when HUBAI_SMOKE=1 (CI starts the built app
// with it). Exercises the native bridge and prints the result.
(async function () {
  var out = {};
  out.native = !!window.HubNative && HubBridge.native;
  out.version = HubBridge.version();
  var r = HubAgent.generate('max', 'snake game in green');
  out.type = r.type;
  out.save = await HubBridge.save('My Snake.html', 'text/html', r.html);
  out.zip = await HubBridge.save('bundle.zip', 'application/zip', Zip.zip([{name:'index.html', data:r.html}]));
  out.share = await HubBridge.share('share me.html', 'text/html', r.html, 'hi');
  out.blocked = await HubBridge.request('GET', 'https://example.com/', {}, '');
  // A hub iframe must not see the bridge.
  var f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');
  f.srcdoc = '<script>parent.postMessage({iframeNative: typeof window.HubNative}, "*")<\/script>';
  out.iframe = await new Promise(function (res) {
    window.addEventListener('message', function (e) { res(e.data.iframeNative); }, { once: true });
    document.body.appendChild(f);
  });
  out.ui = document.querySelector('#credits').textContent;
  return out;
})()
