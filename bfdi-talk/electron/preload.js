const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bfdiDesktop', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  platform: process.platform,
  // Agent Mode
  agentStart: (pos) => ipcRenderer.invoke('agent:start', pos),
  agentStop: () => ipcRenderer.invoke('agent:stop'),
  agentStroll: () => ipcRenderer.invoke('agent:stroll'),
  agentIgnoreMouse: (ignore) => ipcRenderer.send('agent:ignore-mouse', ignore),
  agentDrag: (dx, dy) => ipcRenderer.send('agent:drag', { dx, dy }),
  onAgent: (event, cb) => {
    const ch = { walking: 'agent:walking', arrived: 'agent:arrived', returned: 'agent:returned' }[event];
    if (ch) ipcRenderer.on(ch, (_e, data) => cb(data));
  },
});
