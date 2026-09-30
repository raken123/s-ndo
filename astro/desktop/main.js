// Astro – skrivbordsversion (Windows .exe och macOS .dmg) byggd med Electron.
//
// Startflaggor:
//   --kiosk      helskärm utan möjlighet att lämna (museiläge). Avsluta med Ctrl+Shift+Q.
//   --windowed   starta i fönster i stället för helskärm.
const { app, BrowserWindow, protocol, net, session, systemPreferences, powerSaveBlocker, globalShortcut, Menu } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const KIOSK = process.argv.includes('--kiosk') || process.env.ASTRO_KIOSK === '1';
const WINDOWED = process.argv.includes('--windowed');

// Spelets filer: i den packade appen ligger de i resources/web, under utveckling i ../web.
const WEB_ROOT = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'web');

// Ett eget, säkert "app://"-protokoll så att ES-moduler, kamera och WebXR fungerar som på en webbserver.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#050b18',
    title: 'Astro',
    fullscreen: !WINDOWED,
    kiosk: KIOSK,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadURL('app://astro/index.html?platform=desktop');
  // Öppna aldrig externa länkar/fönster inifrån spelet.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  return win;
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    let rel = decodeURIComponent(pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(WEB_ROOT, rel));
    if (!file.startsWith(WEB_ROOT)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  // Tillåt bara kamera (närvarodetektering) och helskärm.
  const allowed = new Set(['media', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));

  if (process.platform === 'darwin') {
    try { await systemPreferences.askForMediaAccess('camera'); } catch { /* kamera nekad – spelet fungerar ändå */ }
  }

  // Museiskärmen ska inte somna mitt i en resa.
  powerSaveBlocker.start('prevent-display-sleep');

  const win = createWindow();

  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
  globalShortcut.register('F11', () => { if (!KIOSK) win.setFullScreen(!win.isFullScreen()); });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
