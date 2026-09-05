// Platform detection: Electron (Windows/macOS/Linux), Android WebView, or plain browser.
window.Platform = (function () {
  const desktop = window.hubDesktop || null;
  const android = window.AndroidBridge || null;
  const name = desktop ? 'desktop' : android ? 'android' : 'web';
  const os = desktop ? desktop.platform : android ? 'android' : (navigator.platform || 'web');
  const isFile = location.protocol === 'file:';
  function defaultServer() {
    if (!isFile) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    return 'ws://localhost:8787/ws';
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  return {
    name, os, isFile, defaultServer, store,
    canHost: !!(desktop && desktop.hostServer),
    touch: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,
    version: desktop ? desktop.version : android && android.version ? android.version() : 'web',
    hostServer: desktop && desktop.hostServer ? desktop.hostServer : null,
    stopServer: desktop && desktop.stopServer ? desktop.stopServer : null,
    openExternal: (url) => { if (desktop && desktop.openExternal) desktop.openExternal(url); else if (android && android.openExternal) android.openExternal(url); else window.open(url, '_blank'); },
  };
})();
