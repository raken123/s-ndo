const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hubDesktop', {
  platform: process.platform,
  version: '1.0.0',
  hostServer: (action, opts) => ipcRenderer.invoke('host', action, opts),
  openExternal: (url) => ipcRenderer.invoke('openExternal', url),
});
