// gmfy Hub desktop shell (Electron). Loads the bundled client and can host a hub server.
'use strict';
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');

let win = null;
let hosted = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 420, minHeight: 600,
    backgroundColor: '#0b0f1a', title: 'gmfy Hub', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.on('closed', () => { win = null; });
}

async function host(action, opts = {}) {
  if (action === 'start' && !hosted) {
    const { start } = require('./server/index.js');
    const dataFile = path.join(app.getPath('userData'), 'hub-data.json');
    const clientDir = path.join(__dirname, 'app');
    const port = Number(opts.port || 8787);
    try {
      hosted = await start({ port, dataFile, clientDir, quiet: true });
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
      hosted = await start({ port: 0, dataFile, clientDir, quiet: true });   // fall back to a free port
    }
  }
  if (action === 'stop' && hosted) { await hosted.close(); hosted = null; }
  return hosted ? { running: true, port: hosted.port, urls: hosted.urls } : { running: false };
}

ipcMain.handle('host', (e, action, opts) => host(action, opts));
ipcMain.handle('openExternal', (e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
  }
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (hosted) hosted.close(); });
