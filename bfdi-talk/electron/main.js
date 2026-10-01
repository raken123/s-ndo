// Desktop shell (Windows .exe / macOS .dmg). Serves www/ from a private app:// origin so
// ES modules, AudioWorklet and the microphone all behave like on a normal https site.
const { app, BrowserWindow, protocol, net, session, shell, ipcMain, systemPreferences } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WWW = path.join(__dirname, '..', 'www');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

function isExternal(url) {
  return /^https?:\/\//i.test(url);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#0b1d55',
    title: 'BFDI Talk',
    icon: path.join(WWW, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault();
      if (isExternal(url)) shell.openExternal(url);
    }
  });
  win.loadURL('app://bfdi/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(WWW, decodeURIComponent(pathname)));
    if (!file.startsWith(WWW)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  // Only the microphone (and clipboard-free basics) are ever granted.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb, details) => {
    cb(permission === 'media' && (details.mediaTypes || []).every(t => t === 'audio'));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  ipcMain.handle('open-external', (_e, url) => {
    if (isExternal(url)) return shell.openExternal(url);
  });

  createWindow();
  // Ask for the mic after the window is up: if macOS never shows the prompt (common for apps that
  // aren't notarized), awaiting it first would leave the app running with no window at all.
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone').catch(() => { /* allowed later in Settings */ });
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
