// Desktop shell (Windows .exe / macOS .dmg). Serves www/ from a private app:// origin so
// ES modules, AudioWorklet and the microphone all behave like on a normal https site.
const { app, BrowserWindow, protocol, net, session, shell, ipcMain, systemPreferences, desktopCapturer, screen, clipboard, Notification } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WWW = path.join(__dirname, '..', 'www');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

function isExternal(url) {
  return /^https?:\/\//i.test(url);
}

const webPreferences = () => ({
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  autoplayPolicy: 'no-user-gesture-required',
});

function guardNavigation(win) {
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
}

let mainWin = null;

// ---------------------------------------------------------------- Agent Mode
// The character walks out of the app into its own small, transparent, always-on-top window and
// strolls along the bottom of the screen. Empty parts of that window let clicks through.
const BUDDY_W = 360;
const BUDDY_H = 560;
let buddyWin = null;
let walkTimer = null;

function walkBuddy(tx, ty, done) {
  clearInterval(walkTimer);
  if (!buddyWin) return;
  const send = (walking, dir) => buddyWin && !buddyWin.isDestroyed() && buddyWin.webContents.send('agent:walking', { walking, dir });
  walkTimer = setInterval(() => {
    if (!buddyWin || buddyWin.isDestroyed()) { clearInterval(walkTimer); return; }
    const [x, y] = buddyWin.getPosition();
    const dx = tx - x, dy = ty - y;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
      buddyWin.setPosition(Math.round(tx), Math.round(ty));
      clearInterval(walkTimer);
      send(false, 0);
      done?.();
      return;
    }
    const step = 5;
    const len = Math.hypot(dx, dy);
    buddyWin.setPosition(Math.round(x + (dx / len) * Math.min(step, len)), Math.round(y + (dy / len) * Math.min(step, len)));
    send(true, Math.sign(dx));
  }, 16);
}

function homeSpot(nearX, nearY) {
  const { workArea } = screen.getDisplayNearestPoint({ x: Math.round(nearX), y: Math.round(nearY) });
  return { x: workArea.x + workArea.width - BUDDY_W - 12, y: workArea.y + workArea.height - BUDDY_H, workArea };
}

function startAgent({ x, y }) {
  if (buddyWin && !buddyWin.isDestroyed()) { buddyWin.show(); return; }
  const { workArea } = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) });
  const sx = Math.min(Math.max(Math.round(x - BUDDY_W / 2), workArea.x), workArea.x + workArea.width - BUDDY_W);
  const sy = Math.min(Math.max(Math.round(y - BUDDY_H * 0.86), workArea.y), workArea.y + workArea.height - BUDDY_H);
  buddyWin = new BrowserWindow({
    width: BUDDY_W, height: BUDDY_H, x: sx, y: sy,
    transparent: true, frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, backgroundColor: '#00000000',
    title: 'BFDI Talk Agent', icon: path.join(WWW, 'assets', 'icon.png'),
    webPreferences: webPreferences(),
  });
  buddyWin.setAlwaysOnTop(true, 'floating');
  buddyWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  buddyWin.setIgnoreMouseEvents(true, { forward: true });
  guardNavigation(buddyWin);
  buddyWin.loadURL('app://bfdi/index.html?agent=1');
  buddyWin.webContents.once('did-finish-load', () => {
    const home = homeSpot(x, y);
    walkBuddy(home.x, home.y, () => buddyWin?.webContents.send('agent:arrived'));
  });
  buddyWin.on('closed', () => {
    clearInterval(walkTimer);
    buddyWin = null;
    if (mainWin && !mainWin.isDestroyed() && !mainWin.isVisible()) {
      mainWin.show();
      mainWin.webContents.send('agent:returned');
    }
  });
  mainWin?.hide();
}

function stopAgent() {
  if (!buddyWin) return;
  // Walk back towards where the app window is, then hop back in.
  const target = mainWin && !mainWin.isDestroyed() ? mainWin.getBounds() : null;
  const tx = target ? Math.round(target.x + target.width - BUDDY_W / 2) : buddyWin.getPosition()[0];
  const ty = target ? Math.round(target.y + target.height - BUDDY_H) : buddyWin.getPosition()[1];
  walkBuddy(tx, ty, () => buddyWin?.close());
}

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#0b1d55',
    title: 'BFDI Talk',
    icon: path.join(WWW, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: webPreferences(),
  });
  guardNavigation(mainWin);
  mainWin.on('closed', () => { mainWin = null; if (buddyWin && !buddyWin.isDestroyed()) buddyWin.close(); });
  mainWin.loadURL('app://bfdi/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(WWW, decodeURIComponent(pathname)));
    if (!file.startsWith(WWW)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  // Only the microphone and camera (Pro: video live) and screen capture (Pro: screen live) are granted.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb, details) => {
    if (permission === 'media') return cb((details.mediaTypes || []).every(t => t === 'audio' || t === 'video'));
    cb(permission === 'display-capture');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media' || permission === 'display-capture');
  // Screen live: use the system picker where there is one (macOS 15+), otherwise share the main screen.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] })
      .then(sources => callback(sources.length ? { video: sources[0] } : {}))
      .catch(() => callback({}));
  }, { useSystemPicker: true });

  ipcMain.handle('open-external', (_e, url) => {
    if (isExternal(url)) return shell.openExternal(url);
  });
  ipcMain.handle('clipboard:write', (_e, text) => clipboard.writeText(String(text).slice(0, 20000)));
  ipcMain.handle('notify', (_e, { title, body }) => {
    if (Notification.isSupported()) new Notification({ title: String(title), body: String(body) }).show();
  });
  ipcMain.handle('agent:start', (_e, pos) => startAgent(pos));
  ipcMain.handle('agent:stop', () => stopAgent());
  ipcMain.on('agent:ignore-mouse', (e, ignore) => {
    BrowserWindow.fromWebContents(e.sender)?.setIgnoreMouseEvents(!!ignore, { forward: true });
  });
  ipcMain.on('agent:drag', (_e, { dx, dy }) => {
    if (!buddyWin) return;
    clearInterval(walkTimer);
    const [x, y] = buddyWin.getPosition();
    buddyWin.setPosition(Math.round(x + dx), Math.round(y + dy));
  });
  ipcMain.handle('agent:stroll', () => {
    // Walk to the other side of the screen (for fun, or to get out of the way).
    if (!buddyWin) return;
    const [x, y] = buddyWin.getPosition();
    const { workArea } = screen.getDisplayNearestPoint({ x, y });
    const left = workArea.x + 12, right = workArea.x + workArea.width - BUDDY_W - 12;
    walkBuddy(x - workArea.x > workArea.width / 2 ? left : right, workArea.y + workArea.height - BUDDY_H);
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
