"""Build the Agenter desktop packages from official Electron runtimes.

Produces, under dist/:
  agenter-1.0.0-win32-x64/     agenter.exe + runtime
  agenter-1.0.0-macos-arm64/   Agenter.app
  agenter-1.0.0-linux-x64/     agenter + runtime
  agenter_1.0.0_amd64.deb      a real dpkg package

The payload is the single-file HTML from mkhtml.py, loaded off disk, so the
desktop builds carry no js/ tree and need no network for anything but the
Gemini call the user opts into.
"""
import json, os, plistlib, shutil, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
DIST = os.path.join(ROOT, "dist")
WORK = os.path.join(HERE, "work")
CACHE = os.path.join(HERE, "cache")
RES = os.path.join(ROOT, "res")

EV = "43.2.0"
VERSION = "1.0.0"
APPID = "com.agenter.app"
BASE = "https://github.com/electron/electron/releases/download/v%s/" % EV
PLATS = {
    "win32-x64":   "electron-v%s-win32-x64.zip" % EV,
    "darwin-arm64": "electron-v%s-darwin-arm64.zip" % EV,
    "linux-x64":   "electron-v%s-linux-x64.zip" % EV,
}

MAIN_JS = """// Agenter desktop shell
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function create() {
  const win = new BrowserWindow({
    width: 1200, height: 840, minWidth: 420, minHeight: 560,
    backgroundColor: '#0b0e17', title: 'Agenter',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'agenter.html'));

  // Artifact previews open in a plain window; anything with a real URL is the
  // OS browser's problem, not ours.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url === '') {
      return { action: 'allow', overrideBrowserWindowOptions: {
        width: 1000, height: 720, backgroundColor: '#05070d', autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false }
      }};
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.AGENTER_SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      const ok = await win.webContents.executeJavaScript(
        "(function(){return !!(window.AGENTER&&AGENTER.Agent&&AGENTER.Paywall" +
        "&&AGENTER.Video&&document.getElementById('prompt'))?1:0;})()");
      console.log('SMOKE_RESULT=' + ok);
      app.quit();
    });
  }
}

app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) create(); });
"""

DESKTOP_ENTRY = """[Desktop Entry]
Type=Application
Name=Agenter
GenericName=AI coding agent
Comment=Your own AI coding agent
Exec=agenter %U
Icon=agenter
Terminal=false
Categories=Development;IDE;Utility;
Keywords=ai;agent;code;assistant;
StartupWMClass=Agenter
"""

LAUNCHER = """#!/bin/sh
exec /opt/agenter/agenter "$@"
"""


def log(*a):
    print(*a, flush=True)


def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, name)
    if os.path.exists(dst) and os.path.getsize(dst) > 1_000_000:
        log("   cached", name)
        return dst
    log("   downloading", name)
    urllib.request.urlretrieve(BASE + name, dst)
    return dst


def unzip(src, dst):
    """zipfile drops the exec bit and turns symlinks into regular files, and a
    macOS .app needs both; shell out to unzip instead."""
    os.makedirs(dst, exist_ok=True)
    subprocess.run(["unzip", "-q", "-o", src, "-d", dst], check=True)


KEEP_LOCALE = {"en-US.pak", "en-US.pak.info"}


def dir_size(path):
    total = 0
    for dirpath, _dirs, files in os.walk(path):
        for name in files:
            p = os.path.join(dirpath, name)
            if not os.path.islink(p):
                total += os.path.getsize(p)
    return total


def trim_locales(tree):
    """Chromium ships ~220 locales these builds never read; English is enough.

    Windows and Linux keep them as `locales/*.pak`. macOS keeps them as
    `<lang>.lproj/locale.pak` inside the framework instead, which a locales/-only
    rule walks straight past — hence both passes. Done here rather than in
    repack.py so the .deb is built from a trimmed tree too.
    """
    dropped = 0

    for dirpath, _dirs, files in os.walk(tree):
        if os.path.basename(dirpath) != "locales":
            continue
        for name in files:
            if name not in KEEP_LOCALE:
                p = os.path.join(dirpath, name)
                dropped += os.path.getsize(p)
                os.remove(p)

    for dirpath, dirs, _files in os.walk(tree):
        for name in list(dirs):
            if name.endswith(".lproj") and not name.startswith("en"):
                p = os.path.join(dirpath, name)
                dropped += dir_size(p)
                shutil.rmtree(p)
                dirs.remove(name)

    if dropped:
        log("   dropped %.0f MB of unused locales" % (dropped / 1e6))
    return dropped


def payload_into(resources_app):
    """Drop main.js, package.json, the HTML and the icon into resources/app."""
    os.makedirs(resources_app, exist_ok=True)
    shutil.copy(os.path.join(DIST, "agenter-%s.html" % VERSION),
                os.path.join(resources_app, "agenter.html"))
    shutil.copy(os.path.join(RES, "icon", "png", "512.png"),
                os.path.join(resources_app, "icon.png"))
    with open(os.path.join(resources_app, "main.js"), "w", encoding="utf-8") as fh:
        fh.write(MAIN_JS)
    with open(os.path.join(resources_app, "package.json"), "w", encoding="utf-8") as fh:
        json.dump({"name": "agenter", "version": VERSION, "main": "main.js",
                   "description": "Your own AI coding agent", "license": "MIT"}, fh, indent=2)


def build_windows(src):
    out = os.path.join(WORK, "agenter-%s-win32-x64" % VERSION)
    shutil.rmtree(out, ignore_errors=True)
    unzip(src, out)
    os.rename(os.path.join(out, "electron.exe"), os.path.join(out, "agenter.exe"))
    payload_into(os.path.join(out, "resources", "app"))
    trim_locales(out)
    log("   windows tree at", os.path.relpath(out, ROOT))
    return out


def build_linux(src):
    out = os.path.join(WORK, "agenter-%s-linux-x64" % VERSION)
    shutil.rmtree(out, ignore_errors=True)
    unzip(src, out)
    os.rename(os.path.join(out, "electron"), os.path.join(out, "agenter"))
    os.chmod(os.path.join(out, "agenter"), 0o755)
    # Electron's sandbox helper must stay setuid-root capable.
    sandbox = os.path.join(out, "chrome-sandbox")
    if os.path.exists(sandbox):
        os.chmod(sandbox, 0o4755)
    payload_into(os.path.join(out, "resources", "app"))
    trim_locales(out)
    log("   linux tree at", os.path.relpath(out, ROOT))
    return out


def build_macos(src):
    out = os.path.join(WORK, "agenter-%s-macos-arm64" % VERSION)
    shutil.rmtree(out, ignore_errors=True)
    unzip(src, out)
    app_src = os.path.join(out, "Electron.app")
    app_dst = os.path.join(out, "Agenter.app")
    os.rename(app_src, app_dst)

    macos_dir = os.path.join(app_dst, "Contents", "MacOS")
    os.rename(os.path.join(macos_dir, "Electron"), os.path.join(macos_dir, "Agenter"))
    os.chmod(os.path.join(macos_dir, "Agenter"), 0o755)

    plist_path = os.path.join(app_dst, "Contents", "Info.plist")
    with open(plist_path, "rb") as fh:
        pl = plistlib.load(fh)
    pl.update({
        "CFBundleName": "Agenter",
        "CFBundleDisplayName": "Agenter",
        "CFBundleExecutable": "Agenter",
        "CFBundleIdentifier": APPID,
        "CFBundleIconFile": "agenter.icns",
        "CFBundleShortVersionString": VERSION,
        "CFBundleVersion": VERSION,
        "NSHumanReadableCopyright": "MIT licensed.",
    })
    with open(plist_path, "wb") as fh:
        plistlib.dump(pl, fh)

    icons = os.path.join(app_dst, "Contents", "Resources")
    for stale in ("electron.icns",):
        p = os.path.join(icons, stale)
        if os.path.exists(p):
            os.remove(p)
    shutil.copy(os.path.join(RES, "icon.icns"), os.path.join(icons, "agenter.icns"))

    payload_into(os.path.join(icons, "app"))
    trim_locales(app_dst)
    # Drop the leftover top-level junk the zip carries.
    for junk in ("LICENSE", "LICENSES.chromium.html", "version"):
        p = os.path.join(out, junk)
        if os.path.isfile(p):
            os.remove(p)
    log("   macos bundle at", os.path.relpath(app_dst, ROOT))
    return out


def build_deb(linux_tree):
    root = os.path.join(WORK, "deb")
    shutil.rmtree(root, ignore_errors=True)
    opt = os.path.join(root, "opt", "agenter")
    shutil.copytree(linux_tree, opt, symlinks=True)

    binp = os.path.join(root, "usr", "bin")
    os.makedirs(binp, exist_ok=True)
    with open(os.path.join(binp, "agenter"), "w", encoding="utf-8") as fh:
        fh.write(LAUNCHER)
    os.chmod(os.path.join(binp, "agenter"), 0o755)

    appsd = os.path.join(root, "usr", "share", "applications")
    os.makedirs(appsd, exist_ok=True)
    with open(os.path.join(appsd, "agenter.desktop"), "w", encoding="utf-8") as fh:
        fh.write(DESKTOP_ENTRY)

    for px in (16, 32, 48, 64, 128, 256, 512):
        d = os.path.join(root, "usr", "share", "icons", "hicolor",
                         "%dx%d" % (px, px), "apps")
        os.makedirs(d, exist_ok=True)
        shutil.copy(os.path.join(RES, "icon", "png", "%d.png" % px),
                    os.path.join(d, "agenter.png"))

    size_kb = int(subprocess.run(["du", "-sk", root], capture_output=True, text=True)
                  .stdout.split()[0])

    ctl = os.path.join(root, "DEBIAN")
    os.makedirs(ctl, exist_ok=True)
    with open(os.path.join(ctl, "control"), "w", encoding="utf-8") as fh:
        fh.write(
            "Package: agenter\n"
            "Version: %s\n"
            "Section: devel\n"
            "Priority: optional\n"
            "Architecture: amd64\n"
            "Installed-Size: %d\n"
            "Depends: libgtk-3-0 | libgtk-3-0t64, libnotify4, libnss3, libxss1, "
            "libxtst6, xdg-utils, libatspi2.0-0 | libatspi2.0-0t64, libsecret-1-0\n"
            "Maintainer: Agenter <noreply@example.com>\n"
            "Description: Agenter - your own AI coding agent\n"
            " An offline-first coding agent that scaffolds 3D games, Cordova apps,\n"
            " HTML videos, animations and device-control panels.\n" % (VERSION, size_kb))

    # dpkg refuses a setuid binary owned by the build user; force root ownership.
    deb = os.path.join(DIST, "agenter_%s_amd64.deb" % VERSION)
    subprocess.run(["dpkg-deb", "--root-owner-group", "-Zxz", "-b", root, deb], check=True)
    log("   %s  %.1f MB" % (os.path.basename(deb), os.path.getsize(deb) / 1e6))
    return deb


def main():
    html = os.path.join(DIST, "agenter-%s.html" % VERSION)
    if not os.path.exists(html):
        sys.exit("run mkhtml.py first — %s is missing" % html)

    os.makedirs(DIST, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)

    log("electron v%s" % EV)
    zips = {k: fetch(v) for k, v in PLATS.items()}

    log("windows"); build_windows(zips["win32-x64"])
    log("macos");   build_macos(zips["darwin-arm64"])
    log("linux");   tree = build_linux(zips["linux-x64"])
    log("deb");     build_deb(tree)
    log("done — run repack.py to trim locales and compress")


if __name__ == "__main__":
    main()
