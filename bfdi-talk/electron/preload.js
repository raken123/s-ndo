const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bfdiDesktop', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  platform: process.platform,
});
