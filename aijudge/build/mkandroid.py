#!/usr/bin/env python3
"""mkandroid.py — builds the two APKs, phone and VR.

The Android SDK build tools are driven directly (aapt2 → javac → d8 → zipalign
→ apksigner) rather than through Gradle. That keeps the build to a handful of
commands with no plugin resolution, no daemon and no network.

    ANDROID_HOME=/path/to/sdk python3 build/mkandroid.py

Both APKs are signed with a debug key generated on first run into
build/debug.keystore. They install with `adb install` and sideload onto a
headset; they are not Play-Store release builds.
"""
import os
import pathlib
import shutil
import subprocess
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
ANDROID = ROOT / "android"
DIST = ROOT / "dist"
WORK = ROOT / "build" / ".android"
KEYSTORE = ROOT / "build" / "debug.keystore"
VERSION = (ROOT / "VERSION").read_text().strip()

API = "android-34"
BUILD_TOOLS = "34.0.0"

MIPMAPS = {          # launcher density buckets and the PNG size each wants
    "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192,
}

VARIANTS = {
    "android": {
        "manifest": "AndroidManifest.phone.xml",
        "package": "com.aijudge.game",
        "out": f"AIJudge-{VERSION}-android.apk",
        "label": "phones and tablets",
    },
    "vr": {
        "manifest": "AndroidManifest.vr.xml",
        "package": "com.aijudge.vr",
        "out": f"AIJudge-{VERSION}-vr.apk",
        "label": "standalone headsets",
    },
}


def sdk_root() -> pathlib.Path:
    for var in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        if os.environ.get(var):
            return pathlib.Path(os.environ[var])
    for guess in (pathlib.Path.home() / "Android/Sdk", pathlib.Path("/opt/android-sdk")):
        if guess.exists():
            return guess
    sys.exit("! set ANDROID_HOME to an SDK with platforms/%s and build-tools/%s"
             % (API, BUILD_TOOLS))


def run(cmd, **kw):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.exit("! %s failed\n%s\n%s" % (cmd[0], r.stdout[-4000:], r.stderr[-4000:]))
    return r


def ensure_keystore():
    if KEYSTORE.exists():
        return
    print("  generating a debug signing key")
    run(["keytool", "-genkeypair", "-v",
         "-keystore", KEYSTORE, "-storepass", "android", "-keypass", "android",
         "-alias", "aijudge", "-keyalg", "RSA", "-keysize", "2048",
         "-validity", "10000",
         "-dname", "CN=AI Judge Debug, OU=aijudge, O=aijudge, C=US"])


def stage_resources(work: pathlib.Path):
    """Copies res/ in and drops the launcher icon into every density bucket."""
    res = work / "res"
    if res.exists():
        shutil.rmtree(res)
    shutil.copytree(ANDROID / "res", res)
    icons = DIST / "icons"
    if not (icons / "icon-192.png").exists():
        sys.exit("! run `node build/mkicon.js` first — dist/icons is empty")
    for bucket, size in MIPMAPS.items():
        d = res / f"mipmap-{bucket}"
        d.mkdir(parents=True, exist_ok=True)
        shutil.copy(icons / f"icon-{size}.png", d / "ic_launcher.png")
    return res


def compile_java(work: pathlib.Path, android_jar: pathlib.Path, bt: pathlib.Path):
    """javac → d8, producing the classes.dex both variants share."""
    classes = work / "classes"
    if classes.exists():
        shutil.rmtree(classes)
    classes.mkdir(parents=True)

    sources = sorted((ANDROID / "src").rglob("*.java"))
    run(["javac", "-source", "8", "-target", "8", "-nowarn",
         "-bootclasspath", android_jar, "-classpath", android_jar,
         "-d", classes, *sources])

    dexdir = work / "dex"
    if dexdir.exists():
        shutil.rmtree(dexdir)
    dexdir.mkdir(parents=True)
    run([bt / "d8", "--release", "--min-api", "24",
         "--lib", android_jar, "--output", dexdir,
         *sorted(classes.rglob("*.class"))])
    return dexdir / "classes.dex"


def build_variant(name, cfg, work, res_dir, android_jar, bt, dex, game_html):
    vwork = work / name
    if vwork.exists():
        shutil.rmtree(vwork)
    vwork.mkdir(parents=True)

    # 1. compile resources
    compiled = vwork / "res.zip"
    run([bt / "aapt2", "compile", "--dir", res_dir, "-o", compiled])

    # 2. link them against the platform, with the variant's manifest
    linked = vwork / "base.apk"
    run([bt / "aapt2", "link",
         "-I", android_jar,
         "--manifest", ANDROID / cfg["manifest"],
         "--rename-manifest-package", cfg["package"],
         "--min-sdk-version", "24", "--target-sdk-version", "34",
         "--version-code", "1", "--version-name", VERSION,
         "-o", linked, compiled])

    # 3. add the code and the game itself
    staged = vwork / "staged.apk"
    shutil.copy(linked, staged)
    with zipfile.ZipFile(staged, "a", zipfile.ZIP_DEFLATED) as z:
        z.write(dex, "classes.dex")
        # assets must not be compressed twice; the HTML compresses well, so let it
        z.writestr("assets/aijudge.html", game_html.read_bytes())

    # 4. align, then sign
    aligned = vwork / "aligned.apk"
    run([bt / "zipalign", "-p", "-f", "4", staged, aligned])

    out = DIST / cfg["out"]
    run([bt / "apksigner", "sign",
         "--ks", KEYSTORE, "--ks-pass", "pass:android", "--key-pass", "pass:android",
         "--ks-key-alias", "aijudge",
         "--v1-signing-enabled", "true", "--v2-signing-enabled", "true",
         "--out", out, aligned])
    run([bt / "apksigner", "verify", out])
    return out


def main():
    sdk = sdk_root()
    android_jar = sdk / "platforms" / API / "android.jar"
    bt = sdk / "build-tools" / BUILD_TOOLS
    if not android_jar.exists():
        sys.exit(f"! missing {android_jar}")
    if not (bt / "aapt2").exists():
        sys.exit(f"! missing build-tools {BUILD_TOOLS} in {sdk}")

    game_html = DIST / "aijudge.html"
    if not game_html.exists():
        sys.exit("! run `python3 build/mkweb.py` first")

    print(f"AI Judge {VERSION} — Android builds")
    print(f"  sdk               {sdk}")
    ensure_keystore()

    WORK.mkdir(parents=True, exist_ok=True)
    DIST.mkdir(parents=True, exist_ok=True)
    res_dir = stage_resources(WORK)
    dex = compile_java(WORK, android_jar, bt)
    print(f"  classes.dex       {dex.stat().st_size/1024:7.1f} KB")

    for name, cfg in VARIANTS.items():
        out = build_variant(name, cfg, WORK, res_dir, android_jar, bt, dex, game_html)
        print(f"  {out.name:<34} {out.stat().st_size/1024:7.1f} KB   {cfg['label']}")

    shutil.rmtree(WORK, ignore_errors=True)


if __name__ == "__main__":
    main()
