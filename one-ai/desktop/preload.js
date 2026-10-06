// Gives the One AI page the same window.OneNative bridge the phone apps
// have. Preload scripts only run in the top frame, so previews in iframes
// never see it.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('OneNative', {
  saveFile: (token, name, mime, base64) => ipcRenderer.sendSync('one:save', name, mime, base64),
  shareFile: (token, name, mime, base64, text) => ipcRenderer.sendSync('one:share', name, mime, base64, text),
  appVersion: () => ipcRenderer.sendSync('one:version'),
  platform: () => 'desktop'
});
