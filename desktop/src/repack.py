"""Trim the Electron runtimes and repack them small enough for a 100 MB limit.

zip cannot get the Windows or macOS runtime under 100 MB (the Electron binary
alone is 215 MB on Windows), so both ship as .tar.xz. Both platforms can open
that with no extra software: Windows 10+ and macOS both bundle bsdtar with xz
support, and tar also preserves the symlinks a macOS .app framework needs.
"""
import glob, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "work")
DIST = os.path.join(HERE, "dist")
VERSION = "3.3.0"
KEEP_LOCALE = "en-US.pak"


def size(p):
    return os.path.getsize(p) / 1e6


def trim_win(root):
    freed = 0
    loc = os.path.join(root, "locales")
    for p in glob.glob(os.path.join(loc, "*.pak")):
        if os.path.basename(p) != KEEP_LOCALE:
            freed += os.path.getsize(p)
            os.remove(p)
    for junk in ("resources/default_app.asar", "LICENSE", "LICENSES.chromium.html",
                 "version", "dxcompiler.dll"):
        p = os.path.join(root, junk)
        if os.path.exists(p):
            freed += os.path.getsize(p)
            os.remove(p)
    return freed


def trim_mac(appdir):
    """Drop the 54 unused .lproj localisations and the default app."""
    freed = 0
    res = os.path.join(appdir, "Contents", "Resources")
    for d in glob.glob(os.path.join(res, "*.lproj")):
        if os.path.basename(d) not in ("en.lproj", "en_GB.lproj"):
            freed += int(subprocess.run(["du", "-sb", d], capture_output=True,
                                        text=True).stdout.split()[0])
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
    return freed


def tarxz(cwd, member, out):
    if os.path.exists(out):
        os.remove(out)
    # -9 with threads; tar keeps symlinks and the exec bits intact
    subprocess.run(["tar", "-cf", out, "--use-compress-program", "xz -9 -T0",
                    member], cwd=cwd, check=True)
    return out


if __name__ == "__main__":
    win = os.path.join(WORK, "win")
    mac = os.path.join(WORK, "mac")

    if os.path.isdir(win):
        f = trim_win(win)
        print("win  trimmed %.1f MB" % (f / 1e6), flush=True)
        # ship the runtime inside a folder so gmfy.exe is not loose
        staged = os.path.join(WORK, "gmfy-%s-win32-x64" % VERSION)
        shutil.rmtree(staged, ignore_errors=True)
        shutil.copytree(win, staged, symlinks=True)
        out = tarxz(WORK, os.path.basename(staged),
                    os.path.join(DIST, "gmfy-%s-win32-x64.tar.xz" % VERSION))
        print("EXE  %s  %.1f MB" % (os.path.basename(out), size(out)), flush=True)

    if os.path.isdir(mac):
        f = trim_mac(os.path.join(mac, "gmfy.app"))
        print("mac  trimmed %.1f MB" % (f / 1e6), flush=True)
        out = tarxz(mac, "gmfy.app",
                    os.path.join(DIST, "gmfy-%s-macos-arm64.tar.xz" % VERSION))
        print("APP  %s  %.1f MB" % (os.path.basename(out), size(out)), flush=True)
    print("REPACKDONE", flush=True)
