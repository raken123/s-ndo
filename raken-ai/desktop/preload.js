// Raken AI — preload: a tiny, explicit bridge between the page and the main process
const { contextBridge, ipcRenderer } = require("electron");

const chunkHandlers = new Map();
ipcRenderer.on("raken:chunk", (ev, id, text) => { const h = chunkHandlers.get(id); if (h) h(text); });
let seq = 0;

contextBridge.exposeInMainWorld("raken", {
  platform: "desktop",
  os: process.platform,
  versions: { electron: process.versions.electron, chrome: process.versions.chrome },
  // request({url, method, headers, body, binary}, onChunk?, signal?) -> {status, headers, body}
  request(req, onChunk, signal) {
    const id = ++seq;
    if (onChunk) { chunkHandlers.set(id, onChunk); req = Object.assign({}, req, { stream: true }); }
    if (signal) signal.addEventListener("abort", () => ipcRenderer.send("raken:abort", id));
    return ipcRenderer.invoke("raken:request", id, req).finally(() => chunkHandlers.delete(id));
  }
});
