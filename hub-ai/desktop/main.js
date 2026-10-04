// Hub AI desktop shell: loads the same UI as the Android app from www/.
const { app, BrowserWindow, dialog, ipcMain, net, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const ALLOWED_HOST = 'generativelanguage.googleapis.com';
let win = null;

function safeName(name) {
  let n = String(name || '').replace(/[^A-Za-z0-9._-]+/g, '-');
  if (!n || n.startsWith('.')) n = 'hub' + n;
  return n.slice(-80);
}

function hubDir() {
  return process.env.HUBAI_SAVE_DIR || path.join(app.getPath('downloads'), 'Hub AI');
}

function write(file, base64) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(base64, 'base64'));
}

// Only the app's own top-level page may use the bridge.
function trusted(event) {
  return win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame;
}

ipcMain.on('hub:save', (event, name, mime, base64) => {
  if (!trusted(event)) { event.returnValue = JSON.stringify({ ok: false, error: 'Not allowed' }); return; }
  try {
    let file = path.join(hubDir(), safeName(name));
    if (!process.env.HUBAI_SAVE_DIR) {
      const ext = path.extname(file).slice(1);
      file = dialog.showSaveDialogSync(win, {
        title: 'Export hub',
        defaultPath: file,
        filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : []
      });
      if (!file) { event.returnValue = JSON.stringify({ ok: false, error: 'cancelled' }); return; }
    }
    write(file, base64);
    event.returnValue = JSON.stringify({ ok: true, path: file });
  } catch (e) {
    event.returnValue = JSON.stringify({ ok: false, error: String(e.message || e) });
  }
});

// Desktops have no share sheet: save the file and show it in the file
// manager, ready to attach to a message or upload.
ipcMain.on('hub:share', (event, name, mime, base64) => {
  if (!trusted(event)) { event.returnValue = JSON.stringify({ ok: false, error: 'Not allowed' }); return; }
  try {
    const file = path.join(hubDir(), safeName(name));
    write(file, base64);
    if (!process.env.HUBAI_SAVE_DIR) shell.showItemInFolder(file);
    event.returnValue = JSON.stringify({ ok: true, path: file, message: 'Saved ' + path.basename(file) + ' to share' });
  } catch (e) {
    event.returnValue = JSON.stringify({ ok: false, error: String(e.message || e) });
  }
});

ipcMain.on('hub:version', (event) => { event.returnValue = app.getVersion(); });

ipcMain.on('hub:http', async (event, id, method, url, headersJson, body) => {
  if (!trusted(event)) return;
  let status = 0, text = '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== ALLOWED_HOST) throw new Error('Blocked host ' + u.hostname);
    const r = await net.fetch(url, { method, headers: JSON.parse(headersJson || '{}'), body: body || undefined });
    status = r.status;
    text = await r.text();
  } catch (e) {
    text = String(e.message || e);
  }
  if (win && !win.isDestroyed()) {
    win.webContents.executeJavaScript('HubBridge._done(' + JSON.stringify(id) + ',' + status + ',' + JSON.stringify(text) + ')');
  }
});

function create() {
  win = new BrowserWindow({
    width: 1100, height: 800, minWidth: 380, minHeight: 560,
    backgroundColor: '#0d0d0d', title: 'Hub AI', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'www', 'index.html'));

  // Web links open in the browser; the app never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
  win.on('closed', () => { win = null; });

  if (process.env.HUBAI_SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      const r = await win.webContents.executeJavaScript(process.env.HUBAI_SMOKE);
      console.log('SMOKE_RESULT=' + JSON.stringify(r));
      app.quit();
    });
  }
}

app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!win) create(); });
