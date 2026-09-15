"""Build InfoDoc desktop packages from prebuilt Electron runtimes.

Produces, in src/dist:
    infodoc_<v>_amd64.deb            a real dpkg package for Debian/Ubuntu
    infodoc-<v>-win32-x64/           the Windows runtime (repack.py compresses it)
    infodoc-<v>-macos-arm64/         infodoc.app     (likewise)

The payload is the single-file HTML from mkhtml.py plus a main process and a
preload script. Two things need the main process:

  * Web Serial. Chromium refuses to hand a renderer a serial port unless the
    embedder answers the chooser and the permission checks, so main does that
    and shows a native port picker.
  * Records on disk. localStorage under file:// is too easy to lose, so the
    preload exposes a small file-backed store in the OS application-data
    directory, written atomically with a .bak kept behind.

Nothing is fetched at runtime and no server is involved.
"""
import json
import os
import plistlib
import shutil
import stat
import subprocess
import sys
import urllib.request

import icons

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")
WORK = os.path.join(HERE, "work")
CACHE = os.path.join(HERE, "cache")

EV = "43.2.0"                   # Electron runtime
VERSION = "1.0.0"
APPID = "cc.infodoc.app"
BASE = "https://github.com/electron/electron/releases/download/v%s/" % EV
PLATS = {
    "win32-x64": "electron-v%s-win32-x64.zip" % EV,
    "darwin-arm64": "electron-v%s-darwin-arm64.zip" % EV,
    "linux-x64": "electron-v%s-linux-x64.zip" % EV,
}

MAIN_JS = r"""// InfoDoc desktop shell
'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const RECORDS = () => path.join(app.getPath('userData'), 'infodoc-records.json');

let win = null;

/* ── records on disk ───────────────────────────────────────────────
 * Written to a sibling temp file and renamed, so a crash mid-write cannot
 * leave a half-written record file. The previous version is kept as .bak.
 */
function readRecords() {
  const p = RECORDS();
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      try { return fs.readFileSync(p + '.bak', 'utf8'); } catch (e2) { /* nothing yet */ }
    }
    return null;
  }
}

function writeRecords(text) {
  const p = RECORDS();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, text, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try { fs.copyFileSync(p, p + '.bak'); } catch (e) { /* first write */ }
  fs.renameSync(tmp, p);
  return true;
}

ipcMain.handle('infodoc:read', () => readRecords());
ipcMain.handle('infodoc:write', (ev, text) => {
  if (typeof text !== 'string' || text.length > 256 * 1024 * 1024) throw new Error('bad payload');
  return writeRecords(text);
});
ipcMain.handle('infodoc:path', () => RECORDS());

ipcMain.handle('infodoc:saveAs', async (ev, name, text) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Export InfoDoc records',
    defaultPath: path.join(app.getPath('documents'), String(name || 'infodoc-records.json')),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, String(text), 'utf8');
  return r.filePath;
});

ipcMain.handle('infodoc:openFile', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Import InfoDoc records',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});

/* ── Web Serial ────────────────────────────────────────────────────
 * Chromium will not expose a port to the page on its own: the embedder has to
 * answer the chooser and both permission hooks. Everything except serial is
 * refused, since nothing else in this app needs a device or a capability.
 */
function wireSerial(session) {
  session.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    if (!portList.length) { callback(''); return; }

    const label = (p) => {
      const id = [p.vendorId, p.productId].filter(Boolean).join(':');
      return (p.displayName || p.portName || 'port') + (id ? '  (' + id + ')' : '');
    };
    const shown = portList.slice(0, 8);
    dialog.showMessageBox(win, {
      type: 'question',
      title: 'Choose the Arduino',
      message: 'Which serial port is the board on?',
      detail: portList.length > shown.length
        ? (portList.length - shown.length) + ' further port(s) not shown.' : undefined,
      buttons: shown.map(label).concat(['Cancel']),
      cancelId: shown.length,
      defaultId: 0,
      noLink: true
    }).then((r) => {
      callback(r.response < shown.length ? shown[r.response].portId : '');
    }, () => callback(''));
  });

  session.setPermissionCheckHandler((wc, permission) => permission === 'serial');
  session.setPermissionRequestHandler((wc, permission, done) => done(permission === 'serial'));
  session.setDevicePermissionHandler((details) => details.deviceType === 'serial');
}

/* ── menu ──────────────────────────────────────────────────────── */
function buildMenu() {
  const send = (what) => () => { if (win) win.webContents.send('infodoc:menu', what); };
  const isMac = process.platform === 'darwin';
  const template = [];
  if (isMac) {
    template.push({ role: 'appMenu' });
  }
  template.push({
    label: 'File',
    submenu: [
      { label: 'New person', accelerator: 'CmdOrCtrl+N', click: send('new-person') },
      { type: 'separator' },
      { label: 'Print record…', accelerator: 'CmdOrCtrl+P', click: send('print-person') },
      { label: 'Print visit summary…', accelerator: 'CmdOrCtrl+Shift+P', click: send('print-visit') },
      { type: 'separator' },
      { label: 'Export records…', click: send('export') },
      { label: 'Import records…', click: send('import') },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  });
  template.push({ role: 'editMenu' });
  template.push({
    label: 'View',
    submenu: [
      { label: 'People', accelerator: 'CmdOrCtrl+1', click: send('view-people') },
      { label: 'Visit', accelerator: 'CmdOrCtrl+2', click: send('view-visit') },
      { label: 'Device', accelerator: 'CmdOrCtrl+3', click: send('view-device') },
      { label: 'Settings', accelerator: 'CmdOrCtrl+4', click: send('view-settings') },
      { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'reload' }, { role: 'toggleDevTools' }
    ]
  });
  template.push({ role: 'windowMenu' });
  template.push({
    role: 'help',
    submenu: [{
      label: 'Where are my records?',
      click: () => {
        dialog.showMessageBox(win, {
          type: 'info',
          title: 'Records',
          message: 'InfoDoc keeps everything in one file on this computer.',
          detail: RECORDS() + '\n\nIt is plain text and is not encrypted. Anyone with ' +
                  'access to this account can read it. Use full-disk encryption and keep ' +
                  'backups with File → Export records.',
          buttons: ['OK', 'Show the folder'],
          defaultId: 0, noLink: true
        }).then((r) => { if (r.response === 1) shell.showItemInFolder(RECORDS()); });
      }
    }]
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ── window ────────────────────────────────────────────────────── */
function create() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 720, minHeight: 560,
    backgroundColor: '#0f1419',
    title: 'InfoDoc',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true
    }
  });

  wireSerial(win.webContents.session);
  buildMenu();
  win.loadFile(path.join(__dirname, 'infodoc.html'));

  // nothing in this app should open a second window or navigate away
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  if (process.env.INFODOC_SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      const r = await win.webContents.executeJavaScript(
        '(function(){try{return JSON.stringify({' +
        'globals: !!(window.Store&&window.Link&&window.Tests&&window.UI),' +
        'serial: !!(navigator.serial),' +
        'native: !!(window.infodocNative),' +
        'backend: window.Store ? Store.backend : null,' +
        'people: window.Store ? Store.people().length : -1,' +
        'tabs: document.querySelectorAll(".tab").length,' +
        'canvas: !!document.querySelector("#reflexCanvas")' +
        '});}catch(e){return "ERR "+e.message;}})()');
      console.log('SMOKE_RESULT=' + r);
      app.quit();
    });
  }
}

app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) create(); });
"""

PRELOAD_JS = r"""// InfoDoc preload — the only bridge between the page and the OS.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('infodocNative', {
  read: () => ipcRenderer.invoke('infodoc:read'),
  write: (text) => ipcRenderer.invoke('infodoc:write', text),
  path: () => ipcRenderer.invoke('infodoc:path'),
  saveAs: (name, text) => ipcRenderer.invoke('infodoc:saveAs', name, text),
  openFile: () => ipcRenderer.invoke('infodoc:openFile'),
  onMenu: (cb) => ipcRenderer.on('infodoc:menu', (ev, what) => cb(what))
});
"""


def log(*a):
    print(*a, flush=True)


def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, name)
    if os.path.exists(dst) and os.path.getsize(dst) > 1_000_000:
        log("  cached", name)
        return dst
    log("  downloading", name)
    urllib.request.urlretrieve(BASE + name, dst)
    return dst


def unzip(src, dst):
    """zipfile drops the exec bit and symlinks, which macOS frameworks need."""
    os.makedirs(dst, exist_ok=True)
    subprocess.run(["unzip", "-q", "-o", src, "-d", dst], check=True)


def payload(dirpath):
    os.makedirs(dirpath, exist_ok=True)
    pkg = {
        "name": "infodoc", "version": VERSION, "main": "main.js",
        "description": "Patient notes with Arduino Modulino checks",
        "author": "InfoDoc", "license": "UNLICENSED"
    }
    with open(os.path.join(dirpath, "package.json"), "w") as f:
        json.dump(pkg, f, indent=2)
    with open(os.path.join(dirpath, "main.js"), "w") as f:
        f.write(MAIN_JS)
    with open(os.path.join(dirpath, "preload.js"), "w") as f:
        f.write(PRELOAD_JS)
    src = os.path.join(DIST, "infodoc-%s.html" % VERSION)
    if not os.path.exists(src):
        raise SystemExit("run mkhtml.py first: %s is missing" % src)
    shutil.copy(src, os.path.join(dirpath, "infodoc.html"))
    icons.write_png(os.path.join(dirpath, "icon.png"), 256)


# ── windows ──────────────────────────────────────────────────────
def build_windows():
    root = os.path.join(WORK, "win")
    shutil.rmtree(root, ignore_errors=True)
    unzip(fetch(PLATS["win32-x64"]), root)
    payload(os.path.join(root, "resources", "app"))
    os.rename(os.path.join(root, "electron.exe"), os.path.join(root, "InfoDoc.exe"))
    icons.write_ico(os.path.join(root, "infodoc.ico"))
    return root


# ── macos ────────────────────────────────────────────────────────
def build_macos():
    root = os.path.join(WORK, "mac")
    shutil.rmtree(root, ignore_errors=True)
    unzip(fetch(PLATS["darwin-arm64"]), root)
    appdir = os.path.join(root, "InfoDoc.app")
    os.rename(os.path.join(root, "Electron.app"), appdir)
    contents = os.path.join(appdir, "Contents")

    macos = os.path.join(contents, "MacOS")
    os.rename(os.path.join(macos, "Electron"), os.path.join(macos, "InfoDoc"))
    os.chmod(os.path.join(macos, "InfoDoc"), 0o755)

    plist_path = os.path.join(contents, "Info.plist")
    with open(plist_path, "rb") as f:
        pl = plistlib.load(f)
    pl.update({
        "CFBundleExecutable": "InfoDoc", "CFBundleName": "InfoDoc",
        "CFBundleDisplayName": "InfoDoc", "CFBundleIdentifier": APPID,
        "CFBundleShortVersionString": VERSION, "CFBundleVersion": VERSION,
        "CFBundleIconFile": "infodoc.icns",
        "NSHumanReadableCopyright": "",
        "LSApplicationCategoryType": "public.app-category.medical",
    })
    pl.pop("NSMainNibFile", None)
    with open(plist_path, "wb") as f:
        plistlib.dump(pl, f)

    rsrc = os.path.join(contents, "Resources")
    old = os.path.join(rsrc, "electron.icns")
    if os.path.exists(old):
        os.remove(old)
    icons.write_icns(os.path.join(rsrc, "infodoc.icns"))
    payload(os.path.join(rsrc, "app"))
    return root, appdir


# ── linux / deb ──────────────────────────────────────────────────
def build_deb():
    root = os.path.join(WORK, "lin")
    shutil.rmtree(root, ignore_errors=True)
    unzip(fetch(PLATS["linux-x64"]), root)
    payload(os.path.join(root, "resources", "app"))
    os.rename(os.path.join(root, "electron"), os.path.join(root, "infodoc"))
    os.chmod(os.path.join(root, "infodoc"), 0o755)

    pkgroot = os.path.join(WORK, "debroot")
    shutil.rmtree(pkgroot, ignore_errors=True)
    optdir = os.path.join(pkgroot, "opt", "infodoc")
    os.makedirs(os.path.dirname(optdir), exist_ok=True)
    shutil.copytree(root, optdir, symlinks=True)

    # Electron's sandbox helper has to be setuid root or the app will not start
    sb = os.path.join(optdir, "chrome-sandbox")
    if os.path.exists(sb):
        os.chmod(sb, 0o4755)

    os.makedirs(os.path.join(pkgroot, "usr", "bin"), exist_ok=True)
    rel = os.path.relpath(os.path.join(optdir, "infodoc"),
                          os.path.join(pkgroot, "usr", "bin"))
    os.symlink(rel, os.path.join(pkgroot, "usr", "bin", "infodoc"))

    appsdir = os.path.join(pkgroot, "usr", "share", "applications")
    os.makedirs(appsdir, exist_ok=True)
    with open(os.path.join(appsdir, "infodoc.desktop"), "w") as f:
        f.write("[Desktop Entry]\nName=InfoDoc\n"
                "Comment=Patient notes with Arduino Modulino checks\n"
                "Exec=/opt/infodoc/infodoc %U\nIcon=infodoc\nTerminal=false\n"
                "Type=Application\nCategories=Office;MedicalSoftware;\n"
                "StartupWMClass=InfoDoc\n")

    for s in (16, 32, 48, 64, 128, 256, 512):
        d = os.path.join(pkgroot, "usr", "share", "icons", "hicolor",
                         "%dx%d" % (s, s), "apps")
        os.makedirs(d, exist_ok=True)
        icons.write_png(os.path.join(d, "infodoc.png"), s)

    installed_kb = int(subprocess.run(["du", "-sk", pkgroot], capture_output=True,
                                      text=True).stdout.split()[0])
    debian = os.path.join(pkgroot, "DEBIAN")
    os.makedirs(debian, exist_ok=True)
    with open(os.path.join(debian, "control"), "w") as f:
        f.write(
            "Package: infodoc\nVersion: %s\nSection: utils\nPriority: optional\n"
            "Architecture: amd64\nInstalled-Size: %d\n"
            "Maintainer: InfoDoc <noreply@example.com>\n"
            "Depends: libgtk-3-0 | libgtk-3-0t64, libnotify4, libnss3, libxss1, "
            "libxtst6, xdg-utils, libatspi2.0-0, libsecret-1-0\n"
            "Description: Patient notes with Arduino Modulino checks\n"
            " InfoDoc keeps the notes for people coming in to see a doctor, and\n"
            " records three quick checks taken with an Arduino and three Modulino\n"
            " nodes: forehead temperature, reaction time on a joystick, and how\n"
            " steady the hands are. It bundles its own runtime and works offline.\n"
            " Not a medical device.\n"
            % (VERSION, installed_kb))
    with open(os.path.join(debian, "postinst"), "w") as f:
        f.write("#!/bin/sh\nset -e\n"
                "chmod 4755 /opt/infodoc/chrome-sandbox || true\n"
                "if which update-desktop-database >/dev/null 2>&1; then\n"
                "  update-desktop-database -q /usr/share/applications || true\n"
                "fi\n"
                "if which gtk-update-icon-cache >/dev/null 2>&1; then\n"
                "  gtk-update-icon-cache -q -f /usr/share/icons/hicolor || true\n"
                "fi\nexit 0\n")
    os.chmod(os.path.join(debian, "postinst"), 0o755)

    out = os.path.join(DIST, "infodoc_%s_amd64.deb" % VERSION)
    if os.path.exists(out):
        os.remove(out)
    subprocess.run(["dpkg-deb", "--root-owner-group", "-Zxz", "-b", pkgroot, out],
                   check=True)
    return out, root


if __name__ == "__main__":
    os.makedirs(DIST, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    want = [a for a in sys.argv[1:] if not a.startswith("-")] or ["deb", "win", "mac"]
    if "deb" in want:
        log("linux/deb:")
        p, _ = build_deb()
        log("  DEB   %s  %.1f MB" % (os.path.basename(p), os.path.getsize(p) / 1e6))
    if "win" in want:
        log("windows:")
        r = build_windows()
        log("  WIN   staged in %s" % r)
    if "mac" in want:
        log("macos:")
        r, a = build_macos()
        log("  MAC   staged in %s" % a)
    log("now run repack.py to trim and compress the win/mac trees")
