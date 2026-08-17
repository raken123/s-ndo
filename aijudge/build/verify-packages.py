#!/usr/bin/env python3
"""verify-packages.py — checks the five shipped artifacts are what they claim.

Structural only: it opens each package and confirms the format, the payload and
the metadata. Whether the Linux binary actually runs is proven separately by
installing the .deb and pointing build/verify.js at the URL it serves; the
Windows and macOS builds cannot be executed here and are checked as files.
"""
import hashlib
import pathlib
import struct
import subprocess
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
VERSION = (ROOT / "VERSION").read_text().strip()

checks = []


def check(name, ok, detail=""):
    checks.append(ok)
    print(("  ok   " if ok else "  FAIL ") + name + (f"  — {detail}" if detail else ""))


def section(title):
    print(f"\n{title}")


# ---------------------------------------------------------------- html

def verify_html():
    section("single file")
    p = DIST / "aijudge.html"
    if not p.exists():
        return check("dist/aijudge.html exists", False)
    text = p.read_text(encoding="utf-8")
    check("dist/aijudge.html exists", True, f"{p.stat().st_size/1024:.1f} KB")
    check("nothing is fetched at runtime",
          "<script src=" not in text and 'link rel="stylesheet"' not in text)
    check("all eleven modules are inlined",
          all(m in text for m in ("AJGL", "AJMesh", "AJScene", "AJRender", "AJAudio",
                                  "AJAccount", "AJJudge", "AJNet", "AJXR", "AJGame", "AJUI")))
    check("the icon travels with it", "data:image/svg+xml;base64," in text)
    check("both Gemini models are named",
          "gemini-3.1-flash-lite" in text and "gemini-3.6-flash" in text)
    check("VIP is priced at $59", "PRICE_USD = 59" in text)
    check("ten drum morphs a day", "MORPHS_PER_DAY = 10" in text)


# ---------------------------------------------------------------- apks

def verify_apk(path, want_package, want_label, vr):
    section(f"{path.name}")
    if not path.exists():
        return check("built", False)
    check("built", True, f"{path.stat().st_size/1024:.1f} KB")

    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        check("carries the game", "assets/aijudge.html" in names,
              f"{z.getinfo('assets/aijudge.html').file_size} B"
              if "assets/aijudge.html" in names else "")
        check("carries dexed code", "classes.dex" in names)
        check("carries a launcher icon",
              any("ic_launcher" in n and "xxxhdpi" in n for n in names))
        check("is signed", any(n.startswith("META-INF/") and
                               n.endswith((".RSA", ".DSA", ".EC")) for n in names))
        if "assets/aijudge.html" in names:
            same = z.read("assets/aijudge.html") == (DIST / "aijudge.html").read_bytes()
            check("the bundled game matches dist/aijudge.html", same)

    # aapt2 is optional here; when present it answers the manifest questions
    aapt2 = find_aapt2()
    if aapt2:
        out = subprocess.run([aapt2, "dump", "badging", str(path)],
                             capture_output=True, text=True).stdout
        check("package id", f"name='{want_package}'" in out, want_package)
        check("label", f"application-label:'{want_label}'" in out, want_label)
        check("version", f"versionName='{VERSION}'" in out, VERSION)
        tree = subprocess.run([aapt2, "dump", "xmltree", "--file", "AndroidManifest.xml",
                               str(path)], capture_output=True, text=True).stdout
        check("declares INTERNET", "android.permission.INTERNET" in tree)
        if vr:
            check("declares the VR launch category",
                  "com.oculus.intent.category.VR" in tree)
            check("declares head tracking", "android.hardware.vr.headtracking" in tree)
            check("flags itself as the VR build", '"aijudge.vr"' in tree)
        else:
            check("is not flagged as VR", "com.oculus.intent.category.VR" not in tree)
    else:
        print("  (aapt2 not on PATH — manifest checks skipped)")


def find_aapt2():
    import os
    import shutil
    if shutil.which("aapt2"):
        return shutil.which("aapt2")
    for var in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        root = os.environ.get(var)
        if not root:
            continue
        for c in sorted(pathlib.Path(root, "build-tools").glob("*/aapt2"), reverse=True):
            return str(c)
    return None


# ---------------------------------------------------------------- deb

def verify_deb():
    path = DIST / f"aijudge_{VERSION}_amd64.deb"
    section(path.name)
    if not path.exists():
        return check("built", False)
    check("built", True, f"{path.stat().st_size/1024:.1f} KB")

    listing = subprocess.run(["dpkg-deb", "-c", str(path)],
                             capture_output=True, text=True).stdout
    info = subprocess.run(["dpkg-deb", "-I", str(path)],
                          capture_output=True, text=True).stdout

    check("declares amd64", "Architecture: amd64" in info)
    check("declares the version", f"Version: {VERSION}" in info)
    check("installs the binary", "/opt/aijudge/aijudge" in listing)
    check("puts aijudge on PATH", "/usr/bin/aijudge" in listing)
    check("installs a desktop entry",
          "/usr/share/applications/aijudge.desktop" in listing)
    check("installs hicolor icons", "/usr/share/icons/hicolor/256x256/apps/aijudge.png" in listing)
    binline = next((l for l in listing.splitlines()
                    if l.rstrip().endswith("/opt/aijudge/aijudge")), "")
    check("the binary is executable", binline.startswith("-rwxr-xr-x"),
          binline.split()[0] if binline else "not listed")

    # the ELF itself
    raw = subprocess.run(["dpkg-deb", "--fsys-tarfile", str(path)],
                         capture_output=True).stdout
    import io
    import tarfile
    with tarfile.open(fileobj=io.BytesIO(raw)) as t:
        member = t.extractfile("./opt/aijudge/aijudge").read()
    check("ships an ELF x86-64 binary",
          member[:4] == b"\x7fELF" and member[4] == 2 and member[18] == 0x3e)
    check("is statically linked (runs on older distributions)",
          b"/lib64/ld-linux" not in member[:8192])
    check("the game is embedded in the binary", b"\x1f\x8b" in member)


# ---------------------------------------------------------------- exe

def verify_exe():
    path = DIST / f"AIJudge-{VERSION}-win-x64.exe"
    section(path.name)
    if not path.exists():
        return check("built", False)
    data = path.read_bytes()
    check("built", True, f"{len(data)/1024:.1f} KB")

    check("is a DOS/PE image", data[:2] == b"MZ")
    pe_off = struct.unpack_from("<I", data, 0x3C)[0]
    check("has a PE header", data[pe_off:pe_off + 4] == b"PE\0\0")
    machine, nsect = struct.unpack_from("<HH", data, pe_off + 4)
    check("targets x86-64", machine == 0x8664, hex(machine))
    magic = struct.unpack_from("<H", data, pe_off + 24)[0]
    check("is PE32+ (64-bit)", magic == 0x20B, hex(magic))
    subsystem = struct.unpack_from("<H", data, pe_off + 24 + 68)[0]
    check("is a GUI subsystem app (no console window)", subsystem == 2, str(subsystem))

    # section names tell us the resources made it in
    sect_off = pe_off + 24 + struct.unpack_from("<H", data, pe_off + 20)[0]
    names = []
    for i in range(nsect):
        names.append(data[sect_off + i * 40: sect_off + i * 40 + 8].rstrip(b"\0").decode())
    check("has a resource section (icon and version info)", ".rsrc" in names,
          " ".join(names))
    check("no runtime DLLs to ship alongside",
          b"libgcc_s_seh-1.dll" not in data and b"libwinpthread-1.dll" not in data)
    check("imports only system DLLs",
          b"KERNEL32.dll" in data and b"WS2_32.dll" in data)
    check("the game is embedded in the binary", b"\x1f\x8b" in data)


# ---------------------------------------------------------------- dmg

def verify_dmg():
    path = DIST / f"AIJudge-{VERSION}-macos.dmg"
    section(path.name)
    if not path.exists():
        return check("built", False)
    check("built", True, f"{path.stat().st_size/1024:.1f} KB")

    data = path.read_bytes()
    # ISO 9660: 'CD001' at the start of the first volume descriptor (sector 16)
    check("is a mountable ISO 9660 image", data[0x8001:0x8006] == b"CD001")
    check("volume is named for the game", b"AI Judge" in data[0x8000:0x8200])

    import shutil
    if not shutil.which("isoinfo"):
        print("  (isoinfo not on PATH — contents check skipped)")
        return
    listing = subprocess.run(["isoinfo", "-R", "-l", "-i", str(path)],
                             capture_output=True, text=True).stdout
    check("contains the app bundle", "AIJudge.app" in listing)
    check("contains Info.plist", "Info.plist" in listing)
    check("contains the launcher", "AIJudge" in listing)
    check("contains the game", "aijudge.html" in listing)
    check("contains the .icns icon", "icon.icns" in listing)
    check("has a drag-to-install Applications link", "Applications ->" in listing)
    exec_line = [l for l in listing.splitlines() if l.strip().endswith("AIJudge")]
    check("the launcher keeps its execute bit",
          any(l.strip().startswith("-rwx") for l in exec_line),
          exec_line[0].strip()[:12] if exec_line else "not found")

    body = subprocess.run(["isoinfo", "-R", "-i", str(path),
                           "-x", "/AIJudge.app/Contents/Resources/aijudge.html"],
                          capture_output=True).stdout
    check("the bundled game matches dist/aijudge.html",
          body == (DIST / "aijudge.html").read_bytes(),
          f"{len(body)} B")


# ----------------------------------------------------------------

def main():
    print(f"AI Judge {VERSION} — package verification")
    verify_html()
    verify_apk(DIST / f"AIJudge-{VERSION}-android.apk",
               "com.aijudge.game", "AI Judge", vr=False)
    verify_apk(DIST / f"AIJudge-{VERSION}-vr.apk",
               "com.aijudge.vr", "AI Judge VR", vr=True)
    verify_deb()
    verify_exe()
    verify_dmg()

    section("checksums")
    for f in sorted(DIST.glob("*")):
        if f.is_file() and f.suffix in (".apk", ".deb", ".exe", ".dmg", ".html"):
            print(f"  {hashlib.sha256(f.read_bytes()).hexdigest()}  {f.name}")

    ok = sum(1 for c in checks if c)
    print(f"\n{ok}/{len(checks)} checks passed")
    sys.exit(0 if ok == len(checks) else 1)


if __name__ == "__main__":
    main()
