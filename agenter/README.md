# Agenter 1.0.0

Your own AI coding agent, in five builds of one codebase: a single HTML file, an
Android APK, and Electron apps for Windows, macOS and Linux.

| File | Platform | Size |
|---|---|---|
| `dist/agenter-1.0.0.html` | any browser | 96 KB |
| `dist/agenter-1.0.0.apk` | Android 7+ (API 24) | 3.6 MB |
| `dist/agenter_1.0.0_amd64.deb` | Debian / Ubuntu x86-64 | 82.8 MB |
| `dist/agenter-1.0.0-linux-x64.tar.xz` | any Linux x86-64 | 80.2 MB |
| `dist/agenter-1.0.0-win32-x64.tar.xz` | Windows x86-64 | 92.7 MB |
| `dist/agenter-1.0.0-macos-arm64.tar.xz` | macOS Apple Silicon | 72.1 MB |

The icon is a cute robot — one SVG in `res/icon.svg`, rasterised into every
density Android and the desktop platforms ask for, including Android adaptive
icon layers.

---

## The API key is not in the build, and that is deliberate

Agenter talks to Gemini, but **no key is compiled into any of these artifacts**,
and none is committed. On first run, open **⚙ Settings** and paste one; it is
kept in that device's local storage and sent nowhere but Google's endpoint.

This is not caution for its own sake. A key baked into an APK or an Electron
`resources/app` is readable by anyone who unzips the file — both are plain zip
archives — and a key pushed to GitHub is picked up by secret scanning and
revoked by Google, usually within minutes. Embedding one would have produced an
app that leaks the key *and* stops working.

**If you pasted a key into a chat or an issue to get this built, treat it as
public and rotate it** at <https://aistudio.google.com/apikey>.

Without a key the app still runs: every scaffold below is generated locally, so
the paywall, the video generator, the 3D game and the device panel all work
offline. Only prompt-specific model answers need the key.

### Model

Defaults to `gemini-2.5-flash`, changeable in Settings. There is no
"Gemini 3.5 Flash" — Google does not publish that model, so a build pinned to
that string would 404 on every request. `2.5-flash` is the current Flash tier.

---

## Plans

**Free** — 10 runs a day. **Pro** — 50 runs a day, five times the free
allowance, plus every gated capability.

The **Back To School** deal is 75% off: $20.00/month down to $5.00/month. The
countdown runs to 30 September and rolls to the next year once that passes, so
an old build never shows a dead timer.

### The five trigger phrases

Typing any of these opens the subscription page **while you are still typing —
before Send is pressed**:

`3D game` · `Cordova app` · `Video` · `Animation` · `Device control`

Matching is on word boundaries, 180 ms after the last keystroke, and only on the
Free plan. "provide a summary" does not trip the `Video` rule, and "explain 3d
printing" does not trip `3D game`.

**Leaving the page erases the prompt.** Every exit — ✕, Esc, clicking the
backdrop, the leave link — clears the composer, and the page says so before you
take it. Subscribing closes it and leaves the prompt intact.

On Free, asking for a gated capability anyway gets a flat **No.** rather than a
degraded attempt.

### A note on the erase-on-exit rule

It works, it is tested, and it is what was asked for — but destroying text a
user typed is a real cost to them, not just a nudge, and people generally read
it as the app punishing them rather than as a reason to buy. The erasure is a
single hook (`onLeave` in `www/js/ui.js`); dropping the `elPrompt.value = ''`
line turns it into an ordinary upsell without touching anything else.

---

## What Pro unlocks

**Videos, made with HTML.** A prompt becomes a standalone document: a canvas
timeline that plays scenes, and a Record button that runs
`canvas.captureStream()` through `MediaRecorder` to hand back a real `.webm`.
The generated file fetches nothing at runtime — it *is* the video.

**3D games.** `Cube Runner` — perspective projection done by hand on a 2D
canvas, painter's-algorithm depth sorting, no WebGL and no libraries. Arrow keys
on desktop, drag on a phone.

**Cordova apps.** A full project tree, a real `config.xml` with adaptive icon
declarations, and the build commands.

**Animations.** Four CSS motion primitives on non-default easing curves, all
disabled under `prefers-reduced-motion`.

**Device control.** Battery, vibration, screen metrics, network and clipboard —
through Cordova plugins in the APK and the equivalent web APIs on desktop, so
the same panel works in all five builds.

---

## Install

### HTML

Open `dist/agenter-1.0.0.html` in any browser, including off a USB stick. All
nine scripts and the styles are inlined and the favicon is a data URI.

### Android

```sh
adb install dist/agenter-1.0.0.apk
```

Debug-signed, so sideloading needs "install from unknown sources". For Play,
rebuild with `cordova build android --release` and your own keystore.

### Linux

```sh
sudo apt install ./dist/agenter_1.0.0_amd64.deb
agenter
```

Installs to `/opt/agenter` with a launcher at `/usr/bin/agenter` and a desktop
entry. `apt` rather than `dpkg -i` so the dependencies come along. For non-Debian
distributions, extract `agenter-1.0.0-linux-x64.tar.xz` and run `./agenter`.

### Windows

```
tar -xf agenter-1.0.0-win32-x64.tar.xz
```

Run `agenter.exe` from the extracted folder. `tar` is built into Windows 10 and
later. Keep the folder together — the exe needs the DLLs and `resources/`.

### macOS

```sh
tar -xf agenter-1.0.0-macos-arm64.tar.xz
xattr -dr com.apple.quarantine Agenter.app
open Agenter.app
```

**Not code-signed or notarised**, so Gatekeeper refuses it until the quarantine
attribute is cleared. Apple Silicon only; an Intel Mac needs the `darwin-x64`
runtime instead.

---

## What was verified

`build/verify.js` drives the built HTML in headless Chromium from `file://` —
the origin the desktop builds actually run under. **41 checks, all passing:**

- No page errors on load; every global present.
- Each of the five phrases opens the page mid-typing, and names the right
  capability.
- Each exit route — ✕, Esc, backdrop, leave link — clears the composer.
- Four innocent prompts, including "provide a summary" and "explain 3d
  printing", do not trigger it.
- Free + video is refused; Pro + video produces an artifact.
- The generated video is a real standalone document, paints 1141 distinct
  colours on its canvas, and fetches nothing.
- The 3D game renders (390 distinct colours) with no page errors.
- Pro's limit is exactly 5× Free's.
- Buying keeps the prompt; leaving does not.
- No `AIza…` literal anywhere in the bundle, and the key starts empty.

The `.deb`'s Electron tree was launched under `xvfb` with `AGENTER_SMOKE=1` and
reported every app global live inside the Electron window.

The APK was verified with `aapt2` and `apksigner`: `com.agenter.app`, minSdk 24,
targetSdk 36, `INTERNET` and `VIBRATE` permissions only, all of `www/` present
in `assets/`, and both legacy and adaptive (v26) launcher icons. It passes
`apksigner verify` under APK Signature Scheme v2.

The Windows and macOS archives were checked structurally only: `agenter.exe` is
a valid PE32+ x86-64 image, `Agenter.app`'s executable is a 64-bit arm64 Mach-O
with its 14 framework symlinks intact, `Info.plist` names the right executable
and bundle id, and `agenter.icns` is a valid icon container. They are assembled
from official Electron runtimes with the same payload and `main.js` that was
verified on Linux, but **neither was actually run** — there is no Windows or
macOS machine in the build environment, so "runs" is not a claim that has been
tested for those two.

`tar.xz` rather than zip for both: a zipped Windows tree lands past GitHub's
100 MB per-file limit, and zip mangles the framework symlinks a macOS `.app`
depends on.

## Checksums (SHA-256)

```
e8fbd3218da31253f6ca131283ccf5bd44817192a78573702d334c5fdf83dfd8  agenter-1.0.0.html
570c520f3fa32687a2d5059c207d2f040d99a5baa0c48a049812125585e52b03  agenter-1.0.0.apk
1468f3a5c4007a009cddc108bfc4fa948672c5471876f10d619e79fb02878534  agenter_1.0.0_amd64.deb
b5489afaf151773a8432ffd6a3389786ba771a00ae2e16a6bf5ed58659659548  agenter-1.0.0-linux-x64.tar.xz
90c9d89e4e48cdb7e0c56d9a206705cf1c58432c78b2245985b8d4d250550850  agenter-1.0.0-win32-x64.tar.xz
959407dd552544b9b88a570deac347d9c192b356a64cbd390812c85fab046e8e  agenter-1.0.0-macos-arm64.tar.xz
```

---

## Rebuilding

```sh
python3 build/mkicons.py                       # svg -> every png, ico, icns
python3 build/mkhtml.py                        # the single-file HTML
python3 build/mkdesktop.py                     # electron runtimes, trees, .deb
ANDROID_HOME=… python3 build/mkcordova.py      # the APK
python3 build/repack.py                        # compress, checksum
node build/verify.js                           # the browser test
```

`mkcordova.py` needs a JDK (17 or 21) and an Android SDK with
`platforms;android-36` and `build-tools;36.0.0`. `verify.js` needs
`playwright-core` — `npm i playwright-core` inside `build/`.

The Cordova project under `build/cordova/` is generated, not committed:
`platforms/` and `plugins/` are large and machine-specific, and `www/` plus
`res/` plus the script reproduce them.

---

## Layout

```
www/                 the app — the only place source lives
  index.html
  css/app.css
  js/config.js       plans, pricing, the five trigger patterns
  js/robot.js        the mascot, inline so it renders from file://
  js/store.js        plan, usage, key, sessions
  js/gemini.js       the API client
  js/video.js        HTML video generation
  js/device.js       device control, Cordova plugins or web APIs
  js/agent.js        routing, gating, offline scaffolds
  js/paywall.js      the subscription page and the composer watcher
  js/ui.js           transcript, artifacts, settings
res/icon.svg         one drawing; every icon derives from it
build/               the five build scripts and the browser test
dist/                the artifacts
```
