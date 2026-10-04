// Gives the Hub AI page the same window.HubNative bridge the Android app has
// (see MainActivity.java). Preload scripts only run in the top frame, so hubs
// inside iframes never see it.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('HubNative', {
  saveFile: (token, name, mime, base64) => ipcRenderer.sendSync('hub:save', name, mime, base64),
  shareFile: (token, name, mime, base64, text) => ipcRenderer.sendSync('hub:share', name, mime, base64, text),
  httpRequest: (token, id, method, url, headers, body) => ipcRenderer.send('hub:http', id, method, url, headers, body),
  toast: () => {},
  appVersion: () => ipcRenderer.sendSync('hub:version')
});
