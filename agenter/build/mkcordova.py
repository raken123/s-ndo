"""Build the Agenter Android APK with Cordova.

The Cordova project is generated rather than committed: `platforms/` and
`plugins/` are machine-specific and large, and www/ + res/ + this script are
everything needed to reproduce them.

Needs a JDK (17 or 21), the Android SDK with platforms;android-36 and
build-tools;36.0.0, and ANDROID_HOME set. Run mkicons.py first.
"""
import os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
WWW = os.path.join(ROOT, "www")
RES = os.path.join(ROOT, "res")
DIST = os.path.join(ROOT, "dist")
PROJ = os.path.join(HERE, "cordova")

VERSION = "1.0.0"
APPID = "com.agenter.app"
DENSITIES = ["ldpi", "mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]

PLUGINS = [
    "cordova-plugin-device",
    "cordova-plugin-vibration",
    "cordova-plugin-battery-status",
]

CONFIG_XML = """<?xml version='1.0' encoding='utf-8'?>
<widget id="{appid}" version="{version}"
        xmlns="http://www.w3.org/ns/widgets"
        xmlns:cdv="http://cordova.apache.org/ns/1.0">
  <name>Agenter</name>
  <description>Your own AI coding agent.</description>
  <author email="noreply@example.com">Agenter</author>
  <content src="index.html" />

  <allow-navigation href="https://generativelanguage.googleapis.com/*" />
  <access origin="https://generativelanguage.googleapis.com/*" />
  <allow-intent href="http://*/*" />
  <allow-intent href="https://*/*" />

  <preference name="BackgroundColor" value="0xff0b0e17" />
  <preference name="Orientation" value="default" />
  <preference name="AndroidInsecureFileModeEnabled" value="false" />

  <platform name="android">
    <preference name="AndroidWindowSplashScreenBackground" value="#0b0e17" />
    <preference name="AndroidWindowSplashScreenAnimatedIcon"
                value="res/icon/android/xxxhdpi.png" />
{icons}
  </platform>
</widget>
"""

ICON_LINE = ('    <icon density="{d}" src="res/icon/android/{d}.png"\n'
             '          foreground="res/icon/android/{d}-fg.png"\n'
             '          background="res/icon/android/{d}-bg.png" />')


def log(*a):
    print(*a, flush=True)


def run(cmd, cwd=None, env=None):
    log("   $", " ".join(cmd[:4]), "…" if len(cmd) > 4 else "")
    r = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout[-4000:] + "\n" + r.stderr[-4000:] + "\n")
        sys.exit("failed: " + " ".join(cmd))
    return r.stdout


def env_for_android():
    env = dict(os.environ)
    home = env.get("ANDROID_HOME") or env.get("ANDROID_SDK_ROOT")
    if not home or not os.path.isdir(home):
        sys.exit("set ANDROID_HOME to an Android SDK with platforms;android-36")
    env["ANDROID_HOME"] = home
    env["ANDROID_SDK_ROOT"] = home
    env["PATH"] = os.pathsep.join([
        os.path.join(home, "platform-tools"),
        os.path.join(home, "cmdline-tools", "latest", "bin"),
        env.get("PATH", ""),
    ])
    # Gradle inherits JAVA_TOOL_OPTIONS noise on stdout otherwise.
    env.pop("JAVA_TOOL_OPTIONS", None)
    return env


def sync_www():
    """Copy www/ and the icons into the Cordova project."""
    dst = os.path.join(PROJ, "www")
    shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(WWW, dst)
    # index.html points at res/icon.svg for the favicon; ship it.
    os.makedirs(os.path.join(dst, "res"), exist_ok=True)
    shutil.copy(os.path.join(RES, "icon.svg"), os.path.join(dst, "res", "icon.svg"))

    res_dst = os.path.join(PROJ, "res")
    shutil.rmtree(res_dst, ignore_errors=True)
    shutil.copytree(os.path.join(RES, "icon"), os.path.join(res_dst, "icon"))


def write_config():
    icons = "\n".join(ICON_LINE.format(d=d) for d in DENSITIES)
    with open(os.path.join(PROJ, "config.xml"), "w", encoding="utf-8") as fh:
        fh.write(CONFIG_XML.format(appid=APPID, version=VERSION, icons=icons))


def main():
    env = env_for_android()
    cordova = shutil.which("cordova")
    if not cordova:
        sys.exit("cordova CLI not found — npm i -g cordova")

    fresh = not os.path.isdir(PROJ)
    if fresh:
        log("creating the cordova project")
        run([cordova, "create", PROJ, APPID, "Agenter"], env=env)

    log("syncing www/ and icons")
    sync_www()
    write_config()

    if not os.path.isdir(os.path.join(PROJ, "platforms", "android")):
        log("adding the android platform")
        run([cordova, "platform", "add", "android"], cwd=PROJ, env=env)

    installed = os.listdir(os.path.join(PROJ, "plugins")) if \
        os.path.isdir(os.path.join(PROJ, "plugins")) else []
    for p in PLUGINS:
        if p not in installed:
            log("adding", p)
            run([cordova, "plugin", "add", p], cwd=PROJ, env=env)

    log("building the debug apk")
    run([cordova, "build", "android", "--debug"], cwd=PROJ, env=env)

    built = os.path.join(PROJ, "platforms", "android", "app", "build",
                         "outputs", "apk", "debug", "app-debug.apk")
    if not os.path.exists(built):
        sys.exit("cordova reported success but produced no apk at " + built)

    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, "agenter-%s.apk" % VERSION)
    shutil.copy(built, out)
    log("   %s  %.1f MB" % (os.path.basename(out), os.path.getsize(out) / 1e6))


if __name__ == "__main__":
    main()
