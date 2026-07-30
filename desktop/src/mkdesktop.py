"""Build gmfy desktop packages from prebuilt Electron runtimes.

Produces:
  gmfy-3.3.0-win32-x64.zip     containing gmfy.exe and its runtime
  gmfy-3.3.0-macos-arm64.zip   containing gmfy.app
  gmfy_3.3.0_amd64.deb         a real dpkg package

The app payload is the standalone single-file HTML, loaded from disk, so the
desktop builds carry no separate js/ tree and need no network at runtime.
"""
import json, os, plistlib, shutil, subprocess, sys, urllib.request, zipfile, stat

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")
WORK = os.path.join(HERE, "work")
CACHE = os.path.join(HERE, "cache")
RES = os.path.abspath(os.path.join(HERE, "..", "gmfyapp", "res", "icon", "android"))

EV = "43.2.0"
VERSION = "3.3.0"
APPID = "com.gmfy.app"
BASE = "https://github.com/electron/electron/releases/download/v%s/" % EV
PLATS = {"win32-x64": "electron-v%s-win32-x64.zip" % EV,
         "darwin-arm64": "electron-v%s-darwin-arm64.zip" % EV,
         "linux-x64": "electron-v%s-linux-x64.zip" % EV}

MAIN_JS = """// gmfy desktop shell
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function create() {
  const win = new BrowserWindow({
    width: 1180, height: 820, minWidth: 480, minHeight: 640,
    backgroundColor: '#05060a', title: 'gmfy',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'gmfy.html'));
  // downloads (exported projects, photos) open in the browser/OS, not in-app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  if (process.env.GMFY_SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      const n = await win.webContents.executeJavaScript(
        "(function(){var c=document.querySelector('#c');" +
        "if(!c) return -1;" +
        "return !!(window.Gmfy&&window.GmfyAuth&&window.GmfyExport&&window.GMFY_SRC)?1:0;})()");
      console.log('SMOKE_RESULT=' + n);
      app.quit();
    });
  }
}

app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
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
    """zipfile loses the exec bit and symlinks; use the unzip binary."""
    os.makedirs(dst, exist_ok=True)
    subprocess.run(["unzip", "-q", "-o", src, "-d", dst], check=True)


def payload(dirpath):
    """package.json + main.js + the standalone HTML."""
    os.makedirs(dirpath, exist_ok=True)
    pkg = {"name": "gmfy", "version": VERSION, "description":
           "Build 3D games without a bit of code.", "main": "main.js",
           "author": "gmfy", "license": "UNLICENSED"}
    with open(os.path.join(dirpath, "package.json"), "w") as f:
        json.dump(pkg, f, indent=2)
    with open(os.path.join(dirpath, "main.js"), "w") as f:
        f.write(MAIN_JS)
    shutil.copy(os.path.join(DIST, "gmfy-%s.html" % VERSION),
                os.path.join(dirpath, "gmfy.html"))


def icon(size):
    """Nearest Android density icon, scaled."""
    from PIL import Image
    src = os.path.join(RES, "xxxhdpi.png")
    im = Image.open(src).convert("RGBA")
    return im.resize((size, size), Image.LANCZOS)


# ---------------- windows ----------------
def build_windows():
    root = os.path.join(WORK, "win")
    shutil.rmtree(root, ignore_errors=True)
    unzip(fetch(PLATS["win32-x64"]), root)
    payload(os.path.join(root, "resources", "app"))
    os.rename(os.path.join(root, "electron.exe"), os.path.join(root, "gmfy.exe"))
    for junk in ("LICENSE", "LICENSES.chromium.html", "version"):
        p = os.path.join(root, junk)
        if os.path.exists(p):
            os.remove(p)
    out = os.path.join(DIST, "gmfy-%s-win32-x64.zip" % VERSION)
    if os.path.exists(out):
        os.remove(out)
    subprocess.run(["zip", "-q", "-r", "-9", out, "."], cwd=root, check=True)
    return out


# ---------------- macos ----------------
def build_macos():
    root = os.path.join(WORK, "mac")
    shutil.rmtree(root, ignore_errors=True)
    unzip(fetch(PLATS["darwin-arm64"]), root)
    src = os.path.join(root, "Electron.app")
    appdir = os.path.join(root, "gmfy.app")
    os.rename(src, appdir)
    contents = os.path.join(appdir, "Contents")

    # rename the executable and point Info.plist at it
    macos = os.path.join(contents, "MacOS")
    os.rename(os.path.join(macos, "Electron"), os.path.join(macos, "gmfy"))
    os.chmod(os.path.join(macos, "gmfy"), 0o755)

    plist_path = os.path.join(contents, "Info.plist")
    with open(plist_path, "rb") as f:
        pl = plistlib.load(f)
    pl.update({"CFBundleExecutable": "gmfy", "CFBundleName": "gmfy",
               "CFBundleDisplayName": "gmfy", "CFBundleIdentifier": APPID,
               "CFBundleShortVersionString": VERSION, "CFBundleVersion": VERSION,
               "CFBundleIconFile": "gmfy.icns"})
    pl.pop("NSMainNibFile", None)
    with open(plist_path, "wb") as f:
        plistlib.dump(pl, f)

    # icon: an icns built from the app artwork
    rsrc = os.path.join(contents, "Resources")
    for old in ("electron.icns",):
        p = os.path.join(rsrc, old)
        if os.path.exists(p):
            os.remove(p)
    sizes = [16, 32, 64, 128, 256, 512]
    icon(512).save(os.path.join(rsrc, "gmfy.icns"), format="ICNS",
                   sizes=[(s, s) for s in sizes])

    payload(os.path.join(rsrc, "app"))

    out = os.path.join(DIST, "gmfy-%s-macos-arm64.zip" % VERSION)
    if os.path.exists(out):
        os.remove(out)
    # -y keeps symlinks as symlinks, which macOS frameworks require
    subprocess.run(["zip", "-q", "-r", "-9", "-y", out, "gmfy.app"],
                   cwd=root, check=True)
    return out


# ---------------- linux / deb ----------------
def build_deb():
    root = os.path.join(WORK, "lin")
    shutil.rmtree(root, ignore_errors=True)
    unzip(fetch(PLATS["linux-x64"]), root)
    payload(os.path.join(root, "resources", "app"))
    os.rename(os.path.join(root, "electron"), os.path.join(root, "gmfy"))
    os.chmod(os.path.join(root, "gmfy"), 0o755)

    pkgroot = os.path.join(WORK, "debroot")
    shutil.rmtree(pkgroot, ignore_errors=True)
    optdir = os.path.join(pkgroot, "opt", "gmfy")
    os.makedirs(os.path.dirname(optdir), exist_ok=True)
    shutil.copytree(root, optdir, symlinks=True)

    # chrome-sandbox must be setuid root or Electron refuses to start
    sb = os.path.join(optdir, "chrome-sandbox")
    if os.path.exists(sb):
        os.chmod(sb, 0o4755)

    os.makedirs(os.path.join(pkgroot, "usr", "bin"), exist_ok=True)
    rel = os.path.relpath(os.path.join(optdir, "gmfy"),
                          os.path.join(pkgroot, "usr", "bin"))
    os.symlink(rel, os.path.join(pkgroot, "usr", "bin", "gmfy"))

    appsdir = os.path.join(pkgroot, "usr", "share", "applications")
    os.makedirs(appsdir, exist_ok=True)
    with open(os.path.join(appsdir, "gmfy.desktop"), "w") as f:
        f.write("[Desktop Entry]\nName=gmfy\n"
                "Comment=Build 3D games without a bit of code\n"
                "Exec=/opt/gmfy/gmfy %U\nIcon=gmfy\nTerminal=false\n"
                "Type=Application\nCategories=Development;Graphics;Game;\n"
                "StartupWMClass=gmfy\n")

    for s in (32, 64, 128, 256, 512):
        d = os.path.join(pkgroot, "usr", "share", "icons", "hicolor",
                         "%dx%d" % (s, s), "apps")
        os.makedirs(d, exist_ok=True)
        icon(s).save(os.path.join(d, "gmfy.png"))

    installed_kb = int(subprocess.run(["du", "-sk", pkgroot], capture_output=True,
                                      text=True).stdout.split()[0])
    debian = os.path.join(pkgroot, "DEBIAN")
    os.makedirs(debian, exist_ok=True)
    with open(os.path.join(debian, "control"), "w") as f:
        f.write(
            "Package: gmfy\nVersion: %s\nSection: devel\nPriority: optional\n"
            "Architecture: amd64\nInstalled-Size: %d\nMaintainer: gmfy <noreply@example.com>\n"
            "Depends: libgtk-3-0 | libgtk-3-0t64, libnotify4, libnss3, libxss1, "
            "libxtst6, xdg-utils, libatspi2.0-0, libsecret-1-0\n"
            "Description: Build 3D games without a bit of code\n"
            " gmfy is a 3D game maker. Sculpt terrain, place coins, hazards and\n"
            " a finish, script behaviour with Scratch-style blocks, then play it.\n"
            " This package bundles its own runtime and works offline.\n"
            % (VERSION, installed_kb))
    with open(os.path.join(debian, "postinst"), "w") as f:
        f.write("#!/bin/sh\nset -e\n"
                "chmod 4755 /opt/gmfy/chrome-sandbox || true\n"
                "if which update-desktop-database >/dev/null 2>&1; then\n"
                "  update-desktop-database -q /usr/share/applications || true\n"
                "fi\nexit 0\n")
    os.chmod(os.path.join(debian, "postinst"), 0o755)

    out = os.path.join(DIST, "gmfy_%s_amd64.deb" % VERSION)
    if os.path.exists(out):
        os.remove(out)
    subprocess.run(["dpkg-deb", "--root-owner-group", "-Zxz", "-b", pkgroot, out],
                   check=True)
    return out, root


if __name__ == "__main__":
    os.makedirs(DIST, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    want = sys.argv[1:] or ["deb", "win", "mac"]
    if "deb" in want:
        log("linux/deb:")
        p, _ = build_deb()
        log("  DEB   %s  %.1f MB" % (os.path.basename(p), os.path.getsize(p) / 1e6))
    if "win" in want:
        log("windows:")
        p = build_windows()
        log("  EXE   %s  %.1f MB" % (os.path.basename(p), os.path.getsize(p) / 1e6))
    if "mac" in want:
        log("macos:")
        p = build_macos()
        log("  APP   %s  %.1f MB" % (os.path.basename(p), os.path.getsize(p) / 1e6))
