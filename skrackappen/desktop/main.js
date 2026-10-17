// Skräckappen för Windows, macOS och Linux. Spelet ligger i www/ och körs helt offline.
const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');

// Ljudet ska kunna börja utan att man först klickar
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function menu() {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'windowMenu' }]));
  } else {
    Menu.setApplicationMenu(null);
  }
}

function create() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 360,
    backgroundColor: '#050407',
    title: 'Skräckappen',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'www', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'www', 'index.html'));

  // länkar öppnas i webbläsaren, inte i spelfönstret
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) e.preventDefault();
  });

  // Röktest för CI: SKRACK_SMOKE=1 startar spelet, kontrollerar att det lever och avslutar.
  if (process.env.SKRACK_SMOKE) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        let ok = false;
        let info = '';
        try {
          info = await win.webContents.executeJavaScript(
            'JSON.stringify({ ready: !!(window.SK && SK.ready), story: SK.STORY.length, levels: Object.keys(SK.LEVELS).length, platform: SK.platform })'
          );
          const r = JSON.parse(info);
          ok = r.ready && r.story > 300 && r.levels === 6 && r.platform === 'desktop';
        } catch (e) {
          info = String(e);
        }
        const line = (ok ? 'SMOKE_OK ' : 'SMOKE_FAIL ') + info + '\n';
        if (process.env.SKRACK_SMOKE_OUT) fs.writeFileSync(process.env.SKRACK_SMOKE_OUT, line);
        process.stdout.write(line);
        app.exit(ok ? 0 : 1);
      }, 1500);
    });
  }
}

app.whenReady().then(() => {
  menu();
  create();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) create();
  });
});
app.on('window-all-closed', () => app.quit());
