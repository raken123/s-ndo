// One AI desktop shell: the web app from www/ in a window, plus saving files.
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let win = null;

function safeName(name) {
  let n = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim();
  if (!n || n.startsWith('.')) n = 'fil' + n;
  return n.slice(-100);
}

function saveDir() {
  return process.env.ONEAI_SAVE_DIR || path.join(app.getPath('downloads'), 'One AI');
}

function write(file, base64) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(base64, 'base64'));
}

// Only the app's own top-level page may use the bridge.
function trusted(event) {
  return win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame;
}

ipcMain.on('one:save', (event, name, mime, base64) => {
  if (!trusted(event)) { event.returnValue = JSON.stringify({ ok: false, error: 'Not allowed' }); return; }
  try {
    let file = path.join(saveDir(), safeName(name));
    if (!process.env.ONEAI_SAVE_DIR) {
      const ext = path.extname(file).slice(1);
      file = dialog.showSaveDialogSync(win, {
        title: 'Spara fil',
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
// manager, ready to attach or upload.
ipcMain.on('one:share', (event, name, mime, base64) => {
  if (!trusted(event)) { event.returnValue = JSON.stringify({ ok: false, error: 'Not allowed' }); return; }
  try {
    const file = path.join(saveDir(), safeName(name));
    write(file, base64);
    if (!process.env.ONEAI_SAVE_DIR) shell.showItemInFolder(file);
    event.returnValue = JSON.stringify({ ok: true, path: file, message: 'Sparade ' + path.basename(file) + ' för att dela' });
  } catch (e) {
    event.returnValue = JSON.stringify({ ok: false, error: String(e.message || e) });
  }
});

ipcMain.on('one:version', (event) => { event.returnValue = app.getVersion(); });

function create() {
  win = new BrowserWindow({
    width: 1200, height: 820, minWidth: 380, minHeight: 560,
    backgroundColor: '#ffffff', title: 'One AI', autoHideMenuBar: true,
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

  // ONEAI_SMOKE=1 runs scripts/smoke.js in the page and exits 0 when the app,
  // its bridge and (with ONEAI_SMOKE_CLOUD) a chat through One AI Cloud work.
  if (process.env.ONEAI_SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      let r = null;
      try {
        if (process.env.ONEAI_SMOKE_CLOUD) {
          await win.webContents.executeJavaScript('Store.set("settings", ' + JSON.stringify({ cloudUrl: process.env.ONEAI_SMOKE_CLOUD }) + ')');
        }
        r = await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'scripts', 'smoke.js'), 'utf8'));
      } catch (e) {
        r = { error: String(e.message || e) };
      }
      const ok = r && r.native && r.ui && r.iframe === 'undefined' && /^Sparad/.test(r.save || '') &&
        (!process.env.ONEAI_SMOKE_CLOUD || (r.chat && r.chat.ok));
      const report = 'SMOKE_RESULT=' + JSON.stringify(r) + '\n' + (ok ? 'SMOKE_OK' : 'SMOKE_FAILED') + '\n';
      // stdout to a pipe is asynchronous on macOS and would be cut off by
      // app.exit(), so the report also goes to a file when asked.
      if (process.env.ONEAI_SMOKE_OUT) fs.writeFileSync(process.env.ONEAI_SMOKE_OUT, report);
      process.stdout.write(report, () => app.exit(ok ? 0 : 1));
    });
  }
}

app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!win) create(); });
