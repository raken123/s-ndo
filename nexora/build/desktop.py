"""Build the Nexora desktop apps from official Electron runtimes, on Linux.

    python nexora/build/build.py      # the single-file HTML the apps load
    python nexora/build/desktop.py    # -> nexora/dist/
        Nexora-Setup-<v>-x64.exe      Windows installer (7-Zip SFX + PowerShell)
        Nexora-<v>-arm64.dmg          macOS disk image (HFS+, ad-hoc signed app)
        nexora_<v>_amd64.deb          Debian/Ubuntu package

No Windows or macOS machine is needed. Tools are fetched into a cache on first
run: 7-Zip (7zz and the 7zSD installer module), libdmg-hfsplus (built with
cmake) for HFS+/UDIF, and rcodesign for ad-hoc code signing. Set NEXORA_CACHE
to reuse a download cache.
"""
import hashlib
import json
import os
import plistlib
import shutil
import struct
import subprocess
import sys
import urllib.request
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, "dist")
CACHE = os.environ.get("NEXORA_CACHE", os.path.join(HERE, ".cache"))
WORK = os.path.join(CACHE, "work")
TOOLS = os.path.join(CACHE, "tools")

VERSION = "1.2.0"
NAME = "Nexora"
APPID = "app.nexora.desktop"
EV = "43.2.0"
ELECTRON = "https://github.com/electron/electron/releases/download/v%s/electron-v%s-%%s.zip" % (EV, EV)
SEVENZIP = "https://github.com/ip7z/7zip/releases/download/24.09/"
RCODESIGN = ("https://github.com/indygreg/apple-platform-rs/releases/download/apple-codesign%2F0.29.0/"
             "apple-codesign-0.29.0-x86_64-unknown-linux-musl.tar.gz")
LIBDMG = "https://github.com/mozilla/libdmg-hfsplus"
KEEP_LOCALES = ("en-US.pak", "sv.pak")
KEEP_LPROJ = ("en.lproj", "sv.lproj", "Base.lproj")

# The Electron main process, preload bridge and Godot/Python helpers live in nexora/desktop/.
DESKTOP_SRC = os.path.join(ROOT, "desktop")
DESKTOP_FILES = ["main.js", "preload.js", "unzip.js", "python_guard.py",
                 "godot/probe.gd", "godot/probe_driver.gd", "godot/probe.tscn", "godot/nexora_godot_local.py"]


def log(*a):
    print(*a, flush=True)


def run(*cmd, **kw):
    kw.setdefault("check", True)
    return subprocess.run(list(cmd), **kw)


def fetch(url, name=None):
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, name or os.path.basename(url))
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return dst
    log("  downloading", url)
    urllib.request.urlretrieve(url, dst + ".part")
    os.rename(dst + ".part", dst)
    return dst


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def du(p):
    return int(run("du", "-sk", p, capture_output=True, text=True).stdout.split()[0]) * 1024


# ------------------------------------------------------------------ tools
def tools():
    os.makedirs(TOOLS, exist_ok=True)
    t = {k: os.path.join(TOOLS, k) for k in ("7zz", "7zSD.sfx", "dmg", "hfsplus", "empty.hfs", "rcodesign")}
    if not os.path.exists(t["7zz"]):
        run("tar", "-xf", fetch(SEVENZIP + "7z2409-linux-x64.tar.xz"), "-C", TOOLS, "7zz")
    if not os.path.exists(t["7zSD.sfx"]):
        run(t["7zz"], "e", "-y", "-o" + TOOLS, fetch(SEVENZIP + "lzma2409.7z"), "bin/7zSD.sfx", stdout=subprocess.DEVNULL)
    if not os.path.exists(t["dmg"]):
        src = os.path.join(CACHE, "libdmg-hfsplus")
        if not os.path.isdir(src):
            run("git", "clone", "-q", "--depth", "1", LIBDMG, src)
        b = os.path.join(src, "build")
        os.makedirs(b, exist_ok=True)
        run("cmake", "..", "-DCMAKE_BUILD_TYPE=Release", cwd=b, stdout=subprocess.DEVNULL)
        run("make", "-j8", "dmg-bin", "hfsplus", cwd=b, stdout=subprocess.DEVNULL)
        shutil.copy(os.path.join(b, "dmg", "dmg"), t["dmg"])
        shutil.copy(os.path.join(b, "hfs", "hfsplus"), t["hfsplus"])
        shutil.copy(os.path.join(src, "test", "empty.hfs"), t["empty.hfs"])
    if not os.path.exists(t["rcodesign"]):
        run("tar", "-xzf", fetch(RCODESIGN), "-C", TOOLS, "--strip-components=1", "--wildcards", "*/rcodesign")
    return t


# ------------------------------------------------------------------ icon (pure python, no PIL)
def _png(w, h, rgba):
    raw = b"".join(b"\x00" + bytes(rgba[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def icon_png(size):
    """The Nexora logo: a violet-to-cyan rounded square with a dark N."""
    # N outline in a 64-unit box (same path as the web favicon)
    N = [(18, 46), (18, 18), (24, 18), (40, 36), (40, 18), (46, 18), (46, 46), (40, 46), (24, 28), (24, 46)]
    def inside_poly(x, y):
        c = False
        j = len(N) - 1
        for i in range(len(N)):
            xi, yi = N[i]; xj, yj = N[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                c = not c
            j = i
        return c
    def inside_rr(x, y, r=14):
        cx = min(max(x, r), 64 - r); cy = min(max(y, r), 64 - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    a, b = (0x7c, 0x5c, 0xff), (0x22, 0xd3, 0xee)
    ss = 3
    px = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            cov = n_cov = 0
            for sy in range(ss):
                for sx in range(ss):
                    u = (x + (sx + 0.5) / ss) * 64 / size
                    v = (y + (sy + 0.5) / ss) * 64 / size
                    if inside_rr(u, v):
                        cov += 1
                        if inside_poly(u, v):
                            n_cov += 1
            k = cov / (ss * ss)
            if k == 0:
                continue
            t = min(1, max(0, (x + y) / (2 * size)))
            col = [a[i] + (b[i] - a[i]) * t for i in range(3)]
            m = n_cov / cov
            col = [col[i] * (1 - m) + (0x0b, 0x0b, 0x20)[i] * m for i in range(3)]
            o = (y * size + x) * 4
            px[o:o + 4] = bytes([int(col[0]), int(col[1]), int(col[2]), int(255 * k)])
    return _png(size, size, px)


def icns(pngs):
    types = {16: b"icp4", 32: b"icp5", 64: b"icp6", 128: b"ic07", 256: b"ic08", 512: b"ic09", 1024: b"ic10"}
    body = b"".join(types[s] + struct.pack(">I", len(d) + 8) + d for s, d in sorted(pngs.items()))
    return b"icns" + struct.pack(">I", len(body) + 8) + body


def ico(pngs):
    items = sorted(pngs.items())
    head = struct.pack("<HHH", 0, 1, len(items))
    off = 6 + 16 * len(items)
    dirs, data = b"", b""
    for s, d in items:
        dirs += struct.pack("<BBBBHHII", s % 256, s % 256, 0, 0, 1, 32, len(d), off + len(data))
        data += d
    return head + dirs + data


# ------------------------------------------------------------------ common
def unzip(src, dst):
    shutil.rmtree(dst, ignore_errors=True)
    os.makedirs(dst)
    run("unzip", "-q", "-o", src, "-d", dst)  # the unzip binary keeps exec bits and symlinks


def payload(dirpath, icon512):
    os.makedirs(dirpath, exist_ok=True)
    with open(os.path.join(dirpath, "package.json"), "w") as f:
        json.dump({"name": "nexora", "productName": NAME, "version": VERSION, "main": "main.js",
                   "description": "Skapa spel med AI", "author": "Nexora", "license": "UNLICENSED"}, f, indent=2)
    for rel in DESKTOP_FILES:
        dst = os.path.join(dirpath, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy(os.path.join(DESKTOP_SRC, rel), dst)
    with open(os.path.join(dirpath, "icon.png"), "wb") as f:
        f.write(icon512)
    shutil.copy(os.path.join(DIST, "nexora-%s.html" % VERSION), os.path.join(dirpath, "nexora.html"))


def trim_locales(locdir):
    for p in os.listdir(locdir):
        if p.endswith(".pak") and p not in KEEP_LOCALES:
            os.remove(os.path.join(locdir, p))


# ------------------------------------------------------------------ windows
INSTALL_PS1 = r"""$ErrorActionPreference = 'Stop'
$name = 'Nexora'
$src = Join-Path $PSScriptRoot 'Nexora'
$dst = Join-Path $env:LOCALAPPDATA 'Programs\Nexora'
Get-Process -Name 'Nexora' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 300
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
Copy-Item -Recurse -Force $src $dst
Copy-Item -Force (Join-Path $PSScriptRoot 'uninstall.ps1') $dst
$exe = Join-Path $dst 'Nexora.exe'
$ico = Join-Path $dst 'nexora.ico'
$sh = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
  $lnk = $sh.CreateShortcut((Join-Path $dir 'Nexora.lnk'))
  $lnk.TargetPath = $exe; $lnk.WorkingDirectory = $dst; $lnk.IconLocation = $ico
  $lnk.Description = 'Skapa spel med AI'; $lnk.Save()
}
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Nexora'
New-Item -Force -Path $key | Out-Null
Set-ItemProperty -Path $key -Name DisplayName -Value 'Nexora'
Set-ItemProperty -Path $key -Name DisplayVersion -Value '@VERSION@'
Set-ItemProperty -Path $key -Name Publisher -Value 'Nexora'
Set-ItemProperty -Path $key -Name DisplayIcon -Value $ico
Set-ItemProperty -Path $key -Name InstallLocation -Value $dst
Set-ItemProperty -Path $key -Name NoModify -Value 1 -Type DWord
Set-ItemProperty -Path $key -Name NoRepair -Value 1 -Type DWord
Set-ItemProperty -Path $key -Name EstimatedSize -Value @KB@ -Type DWord
Set-ItemProperty -Path $key -Name UninstallString -Value ('powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $dst 'uninstall.ps1') + '"')
Start-Process -FilePath $exe -WorkingDirectory $dst
"""

UNINSTALL_PS1 = r"""$ErrorActionPreference = 'SilentlyContinue'
Get-Process -Name 'Nexora' | Stop-Process -Force
Start-Sleep -Milliseconds 300
Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Nexora.lnk')
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Nexora.lnk')
Remove-Item -Recurse 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Nexora'
$dir = Join-Path $env:LOCALAPPDATA 'Programs\Nexora'
Start-Process -WindowStyle Hidden cmd.exe -ArgumentList '/c', ('timeout /t 2 >nul & rmdir /s /q "' + $dir + '"')
"""

SFX_CONFIG = """;!@Install@!UTF-8!
Title="Nexora @VERSION@"
BeginPrompt="Installera Nexora @VERSION@? Appen installeras för din användare med genvägar på skrivbordet och i Start-menyn."
Progress="yes"
RunProgram="powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File install.ps1"
;!@InstallEnd@!
"""


def build_windows(t, icons):
    root = os.path.join(WORK, "win")
    unzip(fetch(ELECTRON % "win32-x64"), os.path.join(root, NAME))
    app = os.path.join(root, NAME)
    os.rename(os.path.join(app, "electron.exe"), os.path.join(app, "Nexora.exe"))
    for junk in ("LICENSE", "LICENSES.chromium.html", "version", "resources/default_app.asar"):
        p = os.path.join(app, junk)
        if os.path.exists(p):
            os.remove(p)
    trim_locales(os.path.join(app, "locales"))
    payload(os.path.join(app, "resources", "app"), icons[512])
    with open(os.path.join(app, "nexora.ico"), "wb") as f:
        f.write(ico({s: icons[s] for s in (16, 32, 48, 64, 128, 256)}))
    kb = du(app) // 1024
    with open(os.path.join(root, "install.ps1"), "w", encoding="utf-8-sig") as f:
        f.write(INSTALL_PS1.replace("@VERSION@", VERSION).replace("@KB@", str(kb)).replace("\n", "\r\n"))
    with open(os.path.join(root, "uninstall.ps1"), "w", encoding="utf-8-sig") as f:
        f.write(UNINSTALL_PS1.replace("\n", "\r\n"))

    arc = os.path.join(WORK, "win.7z")
    if os.path.exists(arc):
        os.remove(arc)
    run(t["7zz"], "a", "-t7z", "-mx=9", "-m0=LZMA2:d=64m", "-mmt=on", arc, NAME, "install.ps1", "uninstall.ps1",
        cwd=root, stdout=subprocess.DEVNULL)
    out = os.path.join(DIST, "Nexora-Setup-%s-x64.exe" % VERSION)
    with open(out, "wb") as f:
        for part in (open(t["7zSD.sfx"], "rb").read(), SFX_CONFIG.replace("@VERSION@", VERSION).encode("utf-8"), open(arc, "rb").read()):
            f.write(part)
    return out


# ------------------------------------------------------------------ macos
def build_macos(t, icons):
    root = os.path.join(WORK, "mac")
    unzip(fetch(ELECTRON % "darwin-arm64"), root)
    appdir = os.path.join(root, "%s.app" % NAME)
    os.rename(os.path.join(root, "Electron.app"), appdir)
    contents = os.path.join(appdir, "Contents")
    macos = os.path.join(contents, "MacOS")
    os.rename(os.path.join(macos, "Electron"), os.path.join(macos, NAME))
    os.chmod(os.path.join(macos, NAME), 0o755)
    plist_path = os.path.join(contents, "Info.plist")
    with open(plist_path, "rb") as f:
        pl = plistlib.load(f)
    pl.update({"CFBundleExecutable": NAME, "CFBundleName": NAME, "CFBundleDisplayName": NAME,
               "CFBundleIdentifier": APPID, "CFBundleShortVersionString": VERSION, "CFBundleVersion": VERSION,
               "CFBundleIconFile": "nexora.icns", "LSApplicationCategoryType": "public.app-category.developer-tools",
               "NSHumanReadableCopyright": "© Nexora"})
    with open(plist_path, "wb") as f:
        plistlib.dump(pl, f)
    rsrc = os.path.join(contents, "Resources")
    for p in os.listdir(rsrc):
        if p.endswith(".lproj") and p not in KEEP_LPROJ:
            shutil.rmtree(os.path.join(rsrc, p))
    for p in ("electron.icns", "default_app.asar"):
        if os.path.exists(os.path.join(rsrc, p)):
            os.remove(os.path.join(rsrc, p))
    with open(os.path.join(rsrc, "nexora.icns"), "wb") as f:
        f.write(icns({s: icons[s] for s in (16, 32, 64, 128, 256, 512)}))
    fw = os.path.join(contents, "Frameworks", "Electron Framework.framework", "Resources")
    for p in os.listdir(fw):
        if p.endswith(".lproj") and p not in KEEP_LPROJ:
            shutil.rmtree(os.path.join(fw, p))
    payload(os.path.join(rsrc, "app"), icons[512])

    # Every modified bundle needs a valid signature or Apple Silicon kills it at launch.
    # Ad-hoc signing (no certificate) satisfies that; Gatekeeper still asks the user once.
    run(t["rcodesign"], "sign", appdir, stdout=subprocess.DEVNULL)

    # HFS+ volume: Nexora.app plus an /Applications link to drag it onto.
    stage = os.path.join(WORK, "dmgroot")
    shutil.rmtree(stage, ignore_errors=True)
    os.makedirs(stage)
    run("cp", "-a", appdir, stage)
    img = os.path.join(WORK, "nexora.hfs")
    shutil.copy(t["empty.hfs"], img)
    size = int(du(stage) * 1.15) + 32 * 1024 * 1024
    run(t["hfsplus"], img, "grow", str(size), stdout=subprocess.DEVNULL)
    run(t["hfsplus"], img, "addall", stage, "--symlinks=clone_link", stdout=subprocess.DEVNULL)
    run(t["hfsplus"], img, "symlink", "/Applications", "/Applications", stdout=subprocess.DEVNULL)
    out = os.path.join(DIST, "Nexora-%s-arm64.dmg" % VERSION)
    if os.path.exists(out):
        os.remove(out)
    run(t["dmg"], "-c", os.environ.get("NEXORA_DMG_COMPRESSION", "lzma"), "build", img, out, stdout=subprocess.DEVNULL)
    return out


# ------------------------------------------------------------------ linux / deb
def build_deb(icons):
    root = os.path.join(WORK, "lin")
    unzip(fetch(ELECTRON % "linux-x64"), root)
    os.rename(os.path.join(root, "electron"), os.path.join(root, "nexora"))
    os.chmod(os.path.join(root, "nexora"), 0o755)
    for junk in ("LICENSE", "LICENSES.chromium.html", "version", "resources/default_app.asar"):
        p = os.path.join(root, junk)
        if os.path.exists(p):
            os.remove(p)
    trim_locales(os.path.join(root, "locales"))
    payload(os.path.join(root, "resources", "app"), icons[512])

    pkg = os.path.join(WORK, "debroot")
    shutil.rmtree(pkg, ignore_errors=True)
    opt = os.path.join(pkg, "opt", "nexora")
    os.makedirs(os.path.dirname(opt))
    shutil.copytree(root, opt, symlinks=True)
    os.chmod(os.path.join(opt, "chrome-sandbox"), 0o4755)
    os.makedirs(os.path.join(pkg, "usr", "bin"))
    os.symlink("../../opt/nexora/nexora", os.path.join(pkg, "usr", "bin", "nexora"))
    apps = os.path.join(pkg, "usr", "share", "applications")
    os.makedirs(apps)
    with open(os.path.join(apps, "nexora.desktop"), "w") as f:
        f.write("[Desktop Entry]\nName=Nexora\nGenericName=AI-spelskapare\nComment=Skapa spel med AI\n"
                "Exec=/opt/nexora/nexora %U\nIcon=nexora\nTerminal=false\nType=Application\n"
                "Categories=Development;Game;Graphics;\nStartupWMClass=Nexora\n")
    for s in (32, 64, 128, 256, 512):
        d = os.path.join(pkg, "usr", "share", "icons", "hicolor", "%dx%d" % (s, s), "apps")
        os.makedirs(d)
        with open(os.path.join(d, "nexora.png"), "wb") as f:
            f.write(icons[s])
    deb = os.path.join(pkg, "DEBIAN")
    os.makedirs(deb)
    with open(os.path.join(deb, "control"), "w") as f:
        f.write("Package: nexora\nVersion: %s\nSection: games\nPriority: optional\nArchitecture: amd64\n"
                "Installed-Size: %d\nMaintainer: Nexora <noreply@example.com>\n"
                "Depends: libgtk-3-0 | libgtk-3-0t64, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, "
                "libatspi2.0-0 | libatspi2.0-0t64, libsecret-1-0, libgbm1, libasound2 | libasound2t64\n"
                "Description: Skapa spel med AI\n"
                " Nexora gör spelbara 2D- och 3D-spel av en beskrivning, med grafik,\n"
                " 3D-modeller, musik och export till webb, PC och mobil. Fungerar offline.\n"
                % (VERSION, du(pkg) // 1024))
    with open(os.path.join(deb, "postinst"), "w") as f:
        f.write("#!/bin/sh\nset -e\nchmod 4755 /opt/nexora/chrome-sandbox || true\n"
                "command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q /usr/share/applications || true\n"
                "command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q /usr/share/icons/hicolor || true\nexit 0\n")
    os.chmod(os.path.join(deb, "postinst"), 0o755)
    out = os.path.join(DIST, "nexora_%s_amd64.deb" % VERSION)
    if os.path.exists(out):
        os.remove(out)
    run("dpkg-deb", "--root-owner-group", "-Zxz", "-z9", "-b", pkg, out, stdout=subprocess.DEVNULL)
    return out


def build_dev(icons):
    """Unpacked Linux app for tests: <cache>/work/dev/nexora (see verify_desktop.js)."""
    root = os.path.join(WORK, "dev")
    unzip(fetch(ELECTRON % "linux-x64"), root)
    os.rename(os.path.join(root, "electron"), os.path.join(root, "nexora"))
    payload(os.path.join(root, "resources", "app"), icons[512])
    return os.path.join(root, "nexora")


if __name__ == "__main__":
    os.makedirs(WORK, exist_ok=True)
    if sys.argv[1:] == ["dev"]:
        print(build_dev({512: icon_png(64)}))
        sys.exit(0)
    if not os.path.exists(os.path.join(DIST, "nexora-%s.html" % VERSION)):
        sys.exit("run build.py first")
    want = sys.argv[1:] or ["deb", "win", "mac"]
    t = tools()
    log("icons")
    icons = {s: icon_png(s) for s in (16, 32, 48, 64, 128, 256, 512)}
    built = {}
    if "deb" in want:
        log("linux/deb"); built["deb"] = build_deb(icons)
    if "win" in want:
        log("windows/exe"); built["exe"] = build_windows(t, icons)
    if "mac" in want:
        log("macos/dmg"); built["dmg"] = build_macos(t, icons)

    manifest_path = os.path.join(DIST, "downloads.json")
    manifest = []
    if os.path.exists(manifest_path):
        manifest = [m for m in json.load(open(manifest_path)) if m["id"] not in built]
    for k, p in built.items():
        manifest.append({"id": k, "file": os.path.basename(p), "size": os.path.getsize(p), "sha256": sha256(p)})
        log("  %-4s %-34s %6.1f MB" % (k, os.path.basename(p), os.path.getsize(p) / 1e6))
    order = ["exe", "dmg", "deb"]
    manifest.sort(key=lambda m: order.index(m["id"]))
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
