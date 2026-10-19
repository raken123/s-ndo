// ChatGPT Agents desktop shell: one window around the single-file app.
const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

function create() {
  const win = new BrowserWindow({
    width: 1280, height: 840, minWidth: 380, minHeight: 560,
    backgroundColor: "#212121", title: "ChatGPT Agents",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, "app.html"));
  // links from chats open in the real browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Google Pay's payment sheet opens as a popup; keep it inside the app so it can report back
    if (/^https:\/\/(pay|accounts)\.google\.com\//.test(url)) return { action: "allow" };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file:")) { e.preventDefault(); shell.openExternal(url); }
  });
}

if (process.platform === "darwin") {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: "appMenu" }, { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" },
  ]));
} else {
  Menu.setApplicationMenu(null);
}

app.whenReady().then(create);
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) create(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
