// Exposes the desktop-only API (Python, Godot, projects, Poly Haven) to the Nexora page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexoraDesktop', {
  call: async (name, args) => {
    const r = await ipcRenderer.invoke('nx:' + name, args);
    if (!r.ok) throw new Error(r.error);
    return r.value;
  },
  on: cb => {
    const h = (e, d) => cb(d);
    ipcRenderer.on('nx:event', h);
    return () => ipcRenderer.removeListener('nx:event', h);
  },
  platform: process.platform,
});
