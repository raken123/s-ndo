// Raken AI — Electron main process
const { app, BrowserWindow, shell, protocol, net, ipcMain, session, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

const APP_DIR = path.join(__dirname, "app");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };

// app:// is a "standard, secure" scheme so the page gets a real origin: IndexedDB,
// crypto.subtle, service-worker-free offline use and clean storage all work.
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

function serveApp() {
  protocol.handle("app", (req) => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname); if (p === "/" || p === "") p = "/index.html";
    const file = path.normalize(path.join(APP_DIR, p));
    if (!file.startsWith(APP_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response("Not found", { status: 404 });
    return new Response(fs.readFileSync(file), { headers: { "content-type": MIME[path.extname(file)] || "application/octet-stream" } });
  });
}

let win;
function create() {
  win = new BrowserWindow({
    width: 1240, height: 840, minWidth: 420, minHeight: 600, backgroundColor: "#0b0d14", title: "Raken AI",
    icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  win.loadURL("app://raken/index.html");
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("app://")) { e.preventDefault(); shell.openExternal(url); } });
  if (process.env.RAKEN_SMOKE) {
    win.webContents.once("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, 1500));
      const ok = await win.webContents.executeJavaScript("(function(){return !!(window.Raken&&window.Raken.platform==='desktop'&&document.querySelector('#view-chat'))?1:0})()");
      console.log("SMOKE_RESULT=" + ok); app.quit();
    });
  }
}

// ---- network bridge: the renderer asks main to do HTTP so CORS never applies ----
const inflight = new Map();
ipcMain.handle("raken:request", async (ev, id, req) => {
  const ac = new AbortController(); inflight.set(id, ac);
  try {
    const res = await net.fetch(req.url, { method: req.method || "GET", headers: req.headers || {}, body: req.body || undefined, signal: ac.signal });
    const headers = {}; res.headers.forEach((v, k) => headers[k] = v);
    if (req.binary) return { status: res.status, headers, body: Buffer.from(await res.arrayBuffer()).toString("base64") };
    if (req.stream && res.body) {
      const reader = res.body.getReader(); const dec = new TextDecoder(); let all = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; const t = dec.decode(value, { stream: true }); all += t; if (!ev.sender.isDestroyed()) ev.sender.send("raken:chunk", id, t); }
      return { status: res.status, headers, body: all };
    }
    return { status: res.status, headers, body: await res.text() };
  } finally { inflight.delete(id); }
});
ipcMain.on("raken:abort", (ev, id) => { const ac = inflight.get(id); if (ac) ac.abort(); });

app.whenReady().then(() => {
  serveApp();
  Menu.setApplicationMenu(process.platform === "darwin" ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" }]) : null);
  // downloads (generated images, zips, documents) go through the normal save dialog
  session.defaultSession.on("will-download", (e, item) => { item.setSaveDialogOptions({ title: "Save" }); });
  create();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) create(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin" || process.env.RAKEN_SMOKE) app.quit(); });
