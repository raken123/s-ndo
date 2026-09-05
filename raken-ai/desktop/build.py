#!/usr/bin/env python3
"""Build Raken AI desktop packages from the official prebuilt Electron runtimes.

    python3 build.py               # deb + win + mac-arm64
    python3 build.py deb win mac mac-x64 linux-tar
    python3 build.py --smoke       # also launch the Linux build headlessly and check it boots

Outputs in dist/:
    raken-ai_<v>_amd64.deb              Debian / Ubuntu package
    raken-ai-<v>-linux-x64.tar.xz       generic Linux tarball
    raken-ai-<v>-win32-x64.tar.xz       Windows folder with RakenAI.exe
    raken-ai-<v>-macos-arm64.tar.xz     Raken AI.app for Apple Silicon
    raken-ai-<v>-macos-x64.tar.xz       Raken AI.app for Intel Macs (optional)

No npm needed: the runtime zips are fetched straight from GitHub releases and
the app folder (../app) is dropped in as the payload. Unused locales are
removed and everything is xz-compressed so each artifact stays under 100 MB.
"""
import glob, json, os, plistlib, shutil, struct, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
DIST = os.path.join(HERE, "dist")
WORK = os.path.join(HERE, "work")
CACHE = os.path.join(HERE, "cache")
PKG = json.load(open(os.path.join(HERE, "package.json")))
VERSION = PKG["version"]
EV = PKG["devDependencies"]["electron"]
NAME = "raken-ai"
DISPLAY = "Raken AI"
APPID = "ai.raken.app"
BASE = "https://github.com/electron/electron/releases/download/v%s/" % EV
PLATS = {"win32-x64": "electron-v%s-win32-x64.zip" % EV,
         "darwin-arm64": "electron-v%s-darwin-arm64.zip" % EV,
         "darwin-x64": "electron-v%s-darwin-x64.zip" % EV,
         "linux-x64": "electron-v%s-linux-x64.zip" % EV}
KEEP_LOCALE = "en-US.pak"


def log(*a):
    print(*a, flush=True)


def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, name)
    if os.path.exists(dst) and os.path.getsize(dst) > 1_000_000:
        log("  cached", name)
        return dst
    log("  downloading", name)
    urllib.request.urlretrieve(BASE + name, dst + ".part")
    os.rename(dst + ".part", dst)
    return dst


def unzip(src, dst):
    """zipfile loses the exec bit and symlinks; use the unzip binary."""
    os.makedirs(dst, exist_ok=True)
    subprocess.run(["unzip", "-q", "-o", src, "-d", dst], check=True)


def icon_png(size):
    return os.path.join(APP, "icons", "icon-%d.png" % size)


def make_icns(out):
    types = {16: b"icp4", 32: b"icp5", 64: b"icp6", 128: b"ic07", 256: b"ic08", 512: b"ic09", 1024: b"ic10"}
    body = b""
    for s, t in types.items():
        data = open(icon_png(s), "rb").read()
        body += t + struct.pack(">I", len(data) + 8) + data
    with open(out, "wb") as f:
        f.write(b"icns" + struct.pack(">I", len(body) + 8) + body)


def make_ico(out):
    sizes = [16, 32, 48, 64, 128, 256]
    datas = [open(icon_png(s), "rb").read() for s in sizes]
    head = struct.pack("<HHH", 0, 1, len(sizes))
    off = 6 + 16 * len(sizes)
    entries = b""
    for s, d in zip(sizes, datas):
        entries += struct.pack("<BBBBHHII", s % 256, s % 256, 0, 0, 1, 32, len(d), off)
        off += len(d)
    with open(out, "wb") as f:
        f.write(head + entries + b"".join(datas))


def payload(dirpath):
    """package.json + main.js + preload.js + the app folder."""
    os.makedirs(dirpath, exist_ok=True)
    for f in ("package.json", "main.js", "preload.js"):
        shutil.copy(os.path.join(HERE, f), dirpath)
    shutil.copy(icon_png(256), os.path.join(dirpath, "icon.png"))
    dst = os.path.join(dirpath, "app")
    shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(APP, dst, ignore=shutil.ignore_patterns("*.map", ".DS_Store"))


def trim_locales(root):
    for p in glob.glob(os.path.join(root, "locales", "*.pak")):
        if os.path.basename(p) != KEEP_LOCALE:
            os.remove(p)
    for junk in ("resources/default_app.asar", "LICENSE", "LICENSES.chromium.html", "version"):
        p = os.path.join(root, junk)
        if os.path.exists(p):
            os.remove(p)


def tarxz(cwd, member, out):
    if os.path.exists(out):
        os.remove(out)
    subprocess.run(["tar", "-cf", out, "--use-compress-program", "xz -9 -T0", member], cwd=cwd, check=True)
    return out


def size_mb(p):
    return os.path.getsize(p) / 1e6


# ---------------- windows ----------------
def build_windows():
    root = os.path.join(WORK, "win")
    shutil.rmtree(root, ignore_errors=True)
    unzip(fetch(PLATS["win32-x64"]), root)
    payload(os.path.join(root, "resources", "app"))
    os.rename(os.path.join(root, "electron.exe"), os.path.join(root, "RakenAI.exe"))
    make_ico(os.path.join(root, "RakenAI.ico"))
    trim_locales(root)
    staged = os.path.join(WORK, "%s-%s-win32-x64" % (NAME, VERSION))
    shutil.rmtree(staged, ignore_errors=True)
    os.rename(root, staged)
    return tarxz(WORK, os.path.basename(staged), os.path.join(DIST, "%s-%s-win32-x64.tar.xz" % (NAME, VERSION)))


# ---------------- macos ----------------
def build_macos(arch):
    root = os.path.join(WORK, "mac-" + arch)
    shutil.rmtree(root, ignore_errors=True)
    unzip(fetch(PLATS["darwin-" + arch]), root)
    appdir = os.path.join(root, DISPLAY + ".app")
    os.rename(os.path.join(root, "Electron.app"), appdir)
    contents = os.path.join(appdir, "Contents")
    macos = os.path.join(contents, "MacOS")
    os.rename(os.path.join(macos, "Electron"), os.path.join(macos, DISPLAY))
    os.chmod(os.path.join(macos, DISPLAY), 0o755)

    plist_path = os.path.join(contents, "Info.plist")
    with open(plist_path, "rb") as f:
        pl = plistlib.load(f)
    pl.update({"CFBundleExecutable": DISPLAY, "CFBundleName": DISPLAY, "CFBundleDisplayName": DISPLAY,
               "CFBundleIdentifier": APPID, "CFBundleShortVersionString": VERSION, "CFBundleVersion": VERSION,
               "CFBundleIconFile": "raken.icns", "NSMicrophoneUsageDescription": "Raken AI uses the microphone for dictation."})
    pl.pop("NSMainNibFile", None)
    with open(plist_path, "wb") as f:
        plistlib.dump(pl, f)

    rsrc = os.path.join(contents, "Resources")
    for old in ("electron.icns",):
        p = os.path.join(rsrc, old)
        if os.path.exists(p):
            os.remove(p)
    make_icns(os.path.join(rsrc, "raken.icns"))
    for d in glob.glob(os.path.join(rsrc, "*.lproj")):
        if os.path.basename(d) not in ("en.lproj", "en_GB.lproj"):
            shutil.rmtree(d)
    p = os.path.join(rsrc, "default_app.asar")
    if os.path.exists(p):
        os.remove(p)
    fw = os.path.join(contents, "Frameworks", "Electron Framework.framework", "Resources")
    for pak in glob.glob(os.path.join(fw, "*.pak")):
        if os.path.basename(pak) not in (KEEP_LOCALE, "resources.pak", "chrome_100_percent.pak", "chrome_200_percent.pak"):
            os.remove(pak)
    payload(os.path.join(rsrc, "app"))
    return tarxz(root, DISPLAY + ".app", os.path.join(DIST, "%s-%s-macos-%s.tar.xz" % (NAME, VERSION, arch)))


# ---------------- linux ----------------
def linux_root():
    root = os.path.join(WORK, "lin")
    if os.path.isdir(root):
        return root
    unzip(fetch(PLATS["linux-x64"]), root)
    payload(os.path.join(root, "resources", "app"))
    os.rename(os.path.join(root, "electron"), os.path.join(root, NAME))
    os.chmod(os.path.join(root, NAME), 0o755)
    trim_locales(root)
    return root


def build_linux_tar():
    root = linux_root()
    staged = os.path.join(WORK, "%s-%s-linux-x64" % (NAME, VERSION))
    shutil.rmtree(staged, ignore_errors=True)
    shutil.copytree(root, staged, symlinks=True)
    return tarxz(WORK, os.path.basename(staged), os.path.join(DIST, "%s-%s-linux-x64.tar.xz" % (NAME, VERSION)))


def build_deb():
    root = linux_root()
    pkgroot = os.path.join(WORK, "debroot")
    shutil.rmtree(pkgroot, ignore_errors=True)
    optdir = os.path.join(pkgroot, "opt", NAME)
    os.makedirs(os.path.dirname(optdir), exist_ok=True)
    shutil.copytree(root, optdir, symlinks=True)
    sb = os.path.join(optdir, "chrome-sandbox")
    if os.path.exists(sb):
        os.chmod(sb, 0o4755)
    os.makedirs(os.path.join(pkgroot, "usr", "bin"), exist_ok=True)
    os.symlink("/opt/%s/%s" % (NAME, NAME), os.path.join(pkgroot, "usr", "bin", NAME))
    appsdir = os.path.join(pkgroot, "usr", "share", "applications")
    os.makedirs(appsdir, exist_ok=True)
    with open(os.path.join(appsdir, NAME + ".desktop"), "w") as f:
        f.write("[Desktop Entry]\nName=%s\nComment=%s\nExec=/opt/%s/%s %%U\nIcon=%s\nTerminal=false\n"
                "Type=Application\nCategories=Utility;Office;Development;\nStartupWMClass=%s\n"
                % (DISPLAY, PKG["description"], NAME, NAME, NAME, DISPLAY))
    for s in (16, 32, 48, 64, 128, 256, 512):
        d = os.path.join(pkgroot, "usr", "share", "icons", "hicolor", "%dx%d" % (s, s), "apps")
        os.makedirs(d, exist_ok=True)
        shutil.copy(icon_png(s), os.path.join(d, NAME + ".png"))
    installed_kb = int(subprocess.run(["du", "-sk", pkgroot], capture_output=True, text=True).stdout.split()[0])
    debian = os.path.join(pkgroot, "DEBIAN")
    os.makedirs(debian, exist_ok=True)
    with open(os.path.join(debian, "control"), "w") as f:
        f.write("Package: %s\nVersion: %s\nSection: utils\nPriority: optional\nArchitecture: amd64\n"
                "Installed-Size: %d\nMaintainer: Raken <noreply@example.com>\n"
                "Depends: libgtk-3-0 | libgtk-3-0t64, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0 | libatspi2.0-0t64, libsecret-1-0\n"
                "Description: %s\n %s\n This package bundles its own runtime.\n"
                % (NAME, VERSION, installed_kb, PKG["description"], "Raken AI: chat, images, videos, Work Agent and Code Agent."))
    with open(os.path.join(debian, "postinst"), "w") as f:
        f.write("#!/bin/sh\nset -e\nchmod 4755 /opt/%s/chrome-sandbox || true\n"
                "if which update-desktop-database >/dev/null 2>&1; then update-desktop-database -q /usr/share/applications || true; fi\n"
                "if which gtk-update-icon-cache >/dev/null 2>&1; then gtk-update-icon-cache -q /usr/share/icons/hicolor || true; fi\nexit 0\n" % NAME)
    os.chmod(os.path.join(debian, "postinst"), 0o755)
    out = os.path.join(DIST, "%s_%s_amd64.deb" % (NAME, VERSION))
    if os.path.exists(out):
        os.remove(out)
    subprocess.run(["dpkg-deb", "--root-owner-group", "-Zxz", "-b", pkgroot, out], check=True)
    return out


def smoke():
    root = linux_root()
    env = dict(os.environ, RAKEN_SMOKE="1", ELECTRON_DISABLE_SANDBOX="1")
    cmd = [os.path.join(root, NAME), "--no-sandbox", "--disable-gpu"]
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=120)
    ok = "SMOKE_RESULT=1" in r.stdout
    log("  smoke:", "OK" if ok else "FAILED", r.stdout.strip()[-200:], r.stderr.strip()[-400:] if not ok else "")
    return ok


if __name__ == "__main__":
    os.makedirs(DIST, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    want = args or ["deb", "win", "mac"]
    outs = []
    if "deb" in want:
        log("linux/deb:"); outs.append(build_deb())
    if "linux-tar" in want:
        log("linux/tar:"); outs.append(build_linux_tar())
    if "win" in want:
        log("windows:"); outs.append(build_windows())
    if "mac" in want:
        log("macos arm64:"); outs.append(build_macos("arm64"))
    if "mac-x64" in want:
        log("macos x64:"); outs.append(build_macos("x64"))
    if "--smoke" in sys.argv:
        log("smoke test:"); smoke()
    for o in outs:
        log("  %-45s %.1f MB" % (os.path.basename(o), size_mb(o)))
    subprocess.run("cd '%s' && sha256sum * > SHA256SUMS" % DIST, shell=True)
    log("BUILD DONE")
