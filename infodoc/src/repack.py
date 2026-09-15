"""Trim the Windows and macOS Electron trees and compress them under 100 MB.

The Electron binary alone is 215 MB on Windows, and zip cannot get the bundle
past GitHub's 100 MB per-file limit. xz does, and tar also preserves the symlinks
a macOS .app framework needs — zip handles those poorly. Both platforms can open
a .tar.xz with no extra software: Windows 10+ and macOS both ship bsdtar with xz.

Only the en-US locale is kept; the other Chromium locale packs are 70 MB of dead
weight for an app with an English-only interface.
"""
import glob
import os
import shutil
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "work")
DIST = os.path.join(HERE, "dist")
VERSION = "1.0.0"
KEEP_LOCALE = "en-US.pak"


def size(p):
    return os.path.getsize(p) / 1e6


def du(p):
    return int(subprocess.run(["du", "-sb", p], capture_output=True, text=True)
               .stdout.split()[0])


def trim_win(root):
    freed = 0
    for p in glob.glob(os.path.join(root, "locales", "*.pak")):
        if os.path.basename(p) != KEEP_LOCALE:
            freed += os.path.getsize(p)
            os.remove(p)
    for junk in ("resources/default_app.asar", "LICENSE", "LICENSES.chromium.html",
                 "version", "dxcompiler.dll", "dxil.dll"):
        p = os.path.join(root, junk)
        if os.path.exists(p):
            freed += os.path.getsize(p)
            os.remove(p)
    return freed


def trim_mac(appdir):
    freed = 0
    res = os.path.join(appdir, "Contents", "Resources")
    for d in glob.glob(os.path.join(res, "*.lproj")):
        if os.path.basename(d) not in ("en.lproj", "en_GB.lproj"):
            freed += du(d)
            shutil.rmtree(d)
    p = os.path.join(res, "default_app.asar")
    if os.path.exists(p):
        freed += os.path.getsize(p)
        os.remove(p)
    fw = os.path.join(appdir, "Contents", "Frameworks",
                      "Electron Framework.framework", "Resources")
    for pak in glob.glob(os.path.join(fw, "*.pak")):
        if os.path.basename(pak) not in (KEEP_LOCALE, "resources.pak",
                                         "chrome_100_percent.pak",
                                         "chrome_200_percent.pak"):
            freed += os.path.getsize(pak)
            os.remove(pak)
    for d in glob.glob(os.path.join(fw, "*.lproj")):
        if os.path.basename(d) not in ("en.lproj", "en_GB.lproj"):
            freed += du(d)
            shutil.rmtree(d)
    return freed


def tarxz(cwd, member, out):
    if os.path.exists(out):
        os.remove(out)
    subprocess.run(["tar", "-cf", out, "--use-compress-program", "xz -9 -T0", member],
                   cwd=cwd, check=True)
    return out


if __name__ == "__main__":
    win = os.path.join(WORK, "win")
    mac = os.path.join(WORK, "mac")

    if os.path.isdir(win):
        before = du(win)
        freed = trim_win(win)
        print("win  trimmed %.1f MB (%.0f -> %.0f MB on disk)"
              % (freed / 1e6, before / 1e6, du(win) / 1e6), flush=True)
        # ship inside a folder so InfoDoc.exe is not loose in Downloads
        staged = os.path.join(WORK, "InfoDoc-%s-win32-x64" % VERSION)
        shutil.rmtree(staged, ignore_errors=True)
        shutil.copytree(win, staged, symlinks=True)
        out = tarxz(WORK, os.path.basename(staged),
                    os.path.join(DIST, "infodoc-%s-win32-x64.tar.xz" % VERSION))
        print("WIN  %s  %.1f MB" % (os.path.basename(out), size(out)), flush=True)

    if os.path.isdir(mac):
        appdir = os.path.join(mac, "InfoDoc.app")
        before = du(appdir)
        freed = trim_mac(appdir)
        print("mac  trimmed %.1f MB (%.0f -> %.0f MB on disk)"
              % (freed / 1e6, before / 1e6, du(appdir) / 1e6), flush=True)
        out = tarxz(mac, "InfoDoc.app",
                    os.path.join(DIST, "infodoc-%s-macos-arm64.tar.xz" % VERSION))
        print("MAC  %s  %.1f MB" % (os.path.basename(out), size(out)), flush=True)
