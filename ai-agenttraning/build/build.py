"""Build Raken Teknik Åk 4 2026/2027 AI Agentträning for every platform.

Produces in ../dist:
  raken-ai-agenttraning-1.0.0.html                  any browser, one file
  raken-ai-agenttraning_1.0.0_amd64.deb             Debian / Ubuntu
  Raken-AI-Agenttraning-1.0.0-arm64.dmg             macOS, Apple Silicon
  Raken-AI-Agenttraning-1.0.0-x64.dmg               macOS, Intel

The desktop builds are the official Electron runtime with the single-file app
as their payload, so they need no network at runtime.

The .dmg is made without a Mac, the way Bitcoin Core cross-builds theirs: the
volume is written as an ISO 9660 + Rock Ridge image with xorrisofs (Rock Ridge
keeps the framework symlinks and exec bits) and then compressed to a UDIF .dmg
by libdmg-hfsplus's `dmg`, patched to write bzip2 chunks (UDBZ, the format
`hdiutil -format UDBZ` makes; every macOS since 10.4 opens it). bzip2 keeps
the image under GitHub's 100 MB file limit where zlib does not. The .app is ad-hoc signed with rcodesign first,
because Apple Silicon refuses to launch a bundle whose signature no longer
matches its contents, and renaming Electron changes Info.plist.

Tools: dpkg-deb, unzip, xorrisofs, dmg (libdmg-hfsplus), rcodesign, Pillow.
Point DMG_TOOL / RCODESIGN at them if they are not on PATH.
"""
import json, os, plistlib, shutil, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")
WORK = os.environ.get("WORK", os.path.join(HERE, "work"))
CACHE = os.environ.get("CACHE", os.path.join(HERE, "cache"))
DMG_TOOL = os.environ.get("DMG_TOOL", "dmg")
RCODESIGN = os.environ.get("RCODESIGN", "rcodesign")

EV = "43.2.0"
VERSION = "1.0.0"
PKG = "raken-ai-agenttraning"
TITLE = "Raken Teknik Åk 4 2026/2027 AI Agentträning"
SHORT = "AI Agentträning"          # macOS menu bar name (CFBundleName, <= 15 chars)
MAC_EXE = "AI Agenttraning"        # ASCII executable name inside the bundle
APPID = "se.raken.teknik.ai-agenttraning"
DESC = "Träna din egen AI-agent – utan kod"
KEEP_LOCALES = ("en-US", "sv")     # Chromium UI strings (dialogs, context menus)
BASE = "https://github.com/electron/electron/releases/download/v%s/" % EV

MAIN_JS = """// Raken Teknik Åk 4 2026/2027 AI Agentträning – desktop shell
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

app.setName('%(short)s');

function create() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 420, minHeight: 560,
    backgroundColor: '#f3f5fa', title: '%(title)s',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  // the app is fully offline; anything that tries to leave it opens in the browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
  win.on('page-title-updated', e => e.preventDefault());
  if (process.env.RAKEN_SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      const r = await win.webContents.executeJavaScript(
        "(function(){try{var S=RakenAI.state();return 'levels='+S.levels.length+" +
        "' canvas='+!!document.querySelector('#logo')+' storage='+(function(){localStorage.setItem('x','1');return localStorage.getItem('x')})();}" +
        "catch(e){return 'ERR '+e.message}})()");
      console.log('SMOKE_RESULT ' + r);
      app.quit();
    });
  }
}

app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
""" % {"short": SHORT, "title": TITLE}


def log(*a):
    print(*a, flush=True)


def run(*cmd, **kw):
    subprocess.run(cmd, check=True, **kw)


def fetch(plat):
    name = "electron-v%s-%s.zip" % (EV, plat)
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, name)
    if not (os.path.exists(dst) and os.path.getsize(dst) > 1_000_000):
        log("  downloading", name)
        urllib.request.urlretrieve(BASE + name, dst)
    return dst


def unzip(src, dst):
    # the unzip binary keeps exec bits and symlinks; Python's zipfile does not
    shutil.rmtree(dst, ignore_errors=True)
    os.makedirs(dst)
    run("unzip", "-q", "-o", src, "-d", dst)


def html_path():
    return os.path.join(DIST, "%s-%s.html" % (PKG, VERSION))


def build_html():
    shutil.copy(os.path.join(ROOT, "app", "index.html"), html_path())
    return html_path()


def payload(d):
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "package.json"), "w") as f:
        json.dump({"name": PKG, "productName": SHORT, "version": VERSION, "description": DESC,
                   "main": "main.js", "author": "Raken Teknik", "license": "UNLICENSED"},
                  f, indent=2, ensure_ascii=False)
    with open(os.path.join(d, "main.js"), "w") as f:
        f.write(MAIN_JS)
    shutil.copy(html_path(), os.path.join(d, "index.html"))


# ---------------- icon ----------------
def icon(size):
    """The robot from the app header, drawn at 4x and scaled down."""
    from PIL import Image, ImageDraw
    S = 1024
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    blue, ink, white = (42, 120, 214, 255), (27, 32, 48, 255), (255, 255, 255, 240)
    d.rounded_rectangle((40, 40, S - 40, S - 40), radius=210, fill=(236, 243, 252, 255))
    d.line((512, 300, 512, 175), fill=blue, width=40)
    d.ellipse((462, 115, 562, 215), fill=blue)
    d.rounded_rectangle((170, 290, 854, 880), radius=150, fill=blue)
    d.rounded_rectangle((260, 420, 764, 790), radius=110, fill=white)
    for cx in (395, 629):  # happy eyes
        d.arc((cx - 60, 500, cx + 60, 620), 200, 340, fill=ink, width=34)
    d.arc((400, 560, 624, 740), 25, 155, fill=ink, width=34)
    return im.resize((size, size), Image.LANCZOS)


def trim_locales(locdir, suffix):
    for n in os.listdir(locdir):
        base = n[:-len(suffix)] if n.endswith(suffix) else None
        if base and base.replace("_", "-") not in KEEP_LOCALES and base not in ("en", "Base"):
            p = os.path.join(locdir, n)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)


# ---------------- linux / deb ----------------
def build_deb():
    root = os.path.join(WORK, "lin")
    unzip(fetch("linux-x64"), root)
    payload(os.path.join(root, "resources", "app"))
    os.rename(os.path.join(root, "electron"), os.path.join(root, PKG))
    trim_locales(os.path.join(root, "locales"), ".pak")
    for junk in ("LICENSES.chromium.html", "version", "resources/default_app.asar"):
        p = os.path.join(root, junk)
        if os.path.exists(p):
            os.remove(p)

    pkgroot = os.path.join(WORK, "debroot")
    shutil.rmtree(pkgroot, ignore_errors=True)
    opt = os.path.join(pkgroot, "opt", PKG)
    shutil.copytree(root, opt, symlinks=True)
    os.chmod(os.path.join(opt, "chrome-sandbox"), 0o4755)   # Electron refuses to start otherwise

    bindir = os.path.join(pkgroot, "usr", "bin")
    os.makedirs(bindir)
    os.symlink("../../opt/%s/%s" % (PKG, PKG), os.path.join(bindir, PKG))

    apps = os.path.join(pkgroot, "usr", "share", "applications")
    os.makedirs(apps)
    with open(os.path.join(apps, PKG + ".desktop"), "w") as f:
        f.write("[Desktop Entry]\nName=%s\nGenericName=AI-träning\nComment=%s\n"
                "Exec=/opt/%s/%s %%U\nIcon=%s\nTerminal=false\nType=Application\n"
                "Categories=Education;Science;ArtificialIntelligence;\nStartupWMClass=%s\n"
                % (TITLE, DESC, PKG, PKG, PKG, SHORT))
    for s in (32, 64, 128, 256, 512):
        d = os.path.join(pkgroot, "usr", "share", "icons", "hicolor", "%dx%d" % (s, s), "apps")
        os.makedirs(d)
        icon(s).save(os.path.join(d, PKG + ".png"))

    kb = int(subprocess.run(["du", "-sk", pkgroot], capture_output=True, text=True).stdout.split()[0])
    deb = os.path.join(pkgroot, "DEBIAN")
    os.makedirs(deb)
    with open(os.path.join(deb, "control"), "w") as f:
        f.write("Package: %s\nVersion: %s\nSection: education\nPriority: optional\n"
                "Architecture: amd64\nInstalled-Size: %d\n"
                "Maintainer: Raken Teknik <noreply@example.com>\n"
                "Depends: libgtk-3-0 | libgtk-3-0t64, libnss3, libxss1, libxtst6, xdg-utils, "
                "libatspi2.0-0 | libatspi2.0-0t64, libasound2 | libasound2t64, libgbm1\n"
                "Recommends: fonts-noto-color-emoji\n"
                "Description: %s\n"
                " Skapa egna AI-agenter som från början inte förstår någonting.\n"
                " Bygg och koda 2D-hinderbanor och träna agenten att hitta vägen\n"
                " med belöningar och straff, utan kod. Lär den också att prata\n"
                " genom att ge den svar och texter att läsa. Fungerar utan internet.\n"
                % (PKG, VERSION, kb, TITLE))
    with open(os.path.join(deb, "postinst"), "w") as f:
        f.write("#!/bin/sh\nset -e\nchmod 4755 /opt/%s/chrome-sandbox || true\n"
                "command -v update-desktop-database >/dev/null 2>&1 && "
                "update-desktop-database -q /usr/share/applications || true\n"
                "command -v gtk-update-icon-cache >/dev/null 2>&1 && "
                "gtk-update-icon-cache -q /usr/share/icons/hicolor || true\nexit 0\n" % PKG)
    os.chmod(os.path.join(deb, "postinst"), 0o755)

    out = os.path.join(DIST, "%s_%s_amd64.deb" % (PKG, VERSION))
    run("dpkg-deb", "--root-owner-group", "-Zxz", "-z9", "-b", pkgroot, out)
    return out


# ---------------- macOS / dmg ----------------
MAC_README = """AI Agentträning – installera på Mac
====================================

1. Dra "AI Agentträning" till mappen Program (Applications).
2. Öppna Program och dubbelklicka på AI Agentträning.

Appen är inte registrerad hos Apple, så första gången säger macOS
att den inte kan kontrollera appen. Gör så här:

  macOS 15 och nyare:
    Systeminställningar -> Integritet och säkerhet -> scrolla ner ->
    "Öppna ändå" vid AI Agentträning. Bekräfta med ditt lösenord.

  macOS 14 och äldre:
    Högerklicka (eller ctrl-klicka) på appen -> Öppna -> Öppna.

  Eller i Terminal:
    xattr -dr com.apple.quarantine "/Applications/AI Agentträning.app"

Det behövs bara första gången. Appen fungerar helt utan internet.
"""


def build_app(arch):
    root = os.path.join(WORK, "mac-" + arch)
    unzip(fetch("darwin-" + arch), root)
    app = os.path.join(root, SHORT + ".app")
    os.rename(os.path.join(root, "Electron.app"), app)
    for junk in ("LICENSE", "LICENSES.chromium.html", "version"):
        p = os.path.join(root, junk)
        if os.path.exists(p):
            os.remove(p)
    contents = os.path.join(app, "Contents")
    os.rename(os.path.join(contents, "MacOS", "Electron"), os.path.join(contents, "MacOS", MAC_EXE))

    pl_path = os.path.join(contents, "Info.plist")
    with open(pl_path, "rb") as f:
        pl = plistlib.load(f)
    pl.update({"CFBundleExecutable": MAC_EXE, "CFBundleName": SHORT, "CFBundleDisplayName": TITLE,
               "CFBundleIdentifier": APPID, "CFBundleShortVersionString": VERSION,
               "CFBundleVersion": VERSION, "CFBundleIconFile": "app.icns",
               "LSApplicationCategoryType": "public.app-category.education",
               "NSHumanReadableCopyright": "Raken Teknik Åk 4 2026/2027"})
    pl.pop("NSMainNibFile", None)
    with open(pl_path, "wb") as f:
        plistlib.dump(pl, f)

    rsrc = os.path.join(contents, "Resources")
    for p in ("electron.icns", "default_app.asar"):
        if os.path.exists(os.path.join(rsrc, p)):
            os.remove(os.path.join(rsrc, p))
    icon(1024).save(os.path.join(rsrc, "app.icns"), format="ICNS")
    payload(os.path.join(rsrc, "app"))
    trim_locales(os.path.join(contents, "Frameworks", "Electron Framework.framework",
                              "Versions", "A", "Resources"), ".lproj")

    # ad-hoc signature over the whole bundle, nested helpers and framework included
    run(RCODESIGN, "sign", app, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return root, app


def build_dmg(arch):
    root, app = build_app(arch)
    vol = os.path.join(WORK, "dmgroot-" + arch)
    shutil.rmtree(vol, ignore_errors=True)
    os.makedirs(vol)
    shutil.move(app, os.path.join(vol, os.path.basename(app)))
    os.symlink("/Applications", os.path.join(vol, "Applications"))
    with open(os.path.join(vol, "Läs mig först.txt"), "w") as f:
        f.write(MAC_README)
    iso = os.path.join(WORK, "raken-%s.iso" % arch)
    # -D deep dirs, -l long ISO names, -r Rock Ridge (symlinks, modes, UTF-8 names)
    run("xorrisofs", "-quiet", "-D", "-l", "-V", "AI Agenttraning", "-no-pad", "-r",
        "-dir-mode", "0755", "-o", iso, vol)
    out = os.path.join(DIST, "Raken-AI-Agenttraning-%s-%s.dmg" % (VERSION, arch))
    run(DMG_TOOL, iso, out, stdout=subprocess.DEVNULL, env=dict(os.environ, DMG_BZIP2="1"))
    if shutil.which("dmg2img"):
        # decompress it again with an independent reader; must equal the volume we wrote
        back = iso + ".back"
        run("dmg2img", "-s", out, back, stdout=subprocess.DEVNULL)
        same = open(iso, "rb").read() == open(back, "rb").read()[:os.path.getsize(iso)]
        os.remove(back)
        if not same:
            sys.exit("dmg round-trip mismatch for " + out)
        log("      dmg2img round-trip: identical")
    os.remove(iso)
    return out


if __name__ == "__main__":
    os.makedirs(DIST, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    want = sys.argv[1:] or ["html", "deb", "arm64", "x64"]
    p = build_html()
    log("HTML  %-44s %6.2f MB" % (os.path.basename(p), os.path.getsize(p) / 1e6))
    if "deb" in want:
        p = build_deb()
        log("DEB   %-44s %6.1f MB" % (os.path.basename(p), os.path.getsize(p) / 1e6))
    for arch in ("arm64", "x64"):
        if arch in want:
            p = build_dmg(arch)
            log("DMG   %-44s %6.1f MB" % (os.path.basename(p), os.path.getsize(p) / 1e6))
