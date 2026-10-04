# Hub AI

Apps for making **hubs**: small single-file apps you can preview, save,
export as HTML and share. Hubs are built by the **Hub agents**, cloud agents
that each start from a GPT base model and are fine-tuned in Python, or by
**Gemini 3.8 Flash / Pro**. **FunHub** is a scrolling feed of hubs you can
play and share.

The agents run on **Hub AI Cloud** (`cloud/`), a small Python server you
deploy with your OpenAI and Gemini keys. The apps need its address; see
[cloud/README.md](cloud/README.md).

Downloads:

| Platform | File | Where |
|---|---|---|
| Android 7.0+ | `HubAI-1.0.0.apk` | `dist/` in this folder, and the release |
| macOS (Apple Silicon / Intel) | `HubAI-1.0.0-mac-arm64.dmg` / `-mac-x64.dmg` | GitHub release `hub-ai-v1.0.0` |
| Windows 10/11 x64 | `HubAI-Setup-1.0.0.exe` | GitHub release `hub-ai-v1.0.0` |
| Debian / Ubuntu x64 | `hub-ai_1.0.0_amd64.deb` | GitHub release `hub-ai-v1.0.0` |

CI rebuilds everything on every push that changes `hub-ai/`. The desktop
installers are 80–110 MB each, which is too big to commit, so they live on the
release (and as workflow artifacts).

## Install

1. Download `dist/HubAI-1.0.0.apk` to the phone (Android 7.0 or newer).
2. Open it and allow "Install unknown apps" for your browser or file manager
   when asked.

The APK is signed with the demo key in `app/hubai-demo.jks`, so newer builds
install over older ones. Replace the key before publishing anywhere (see
[Build](#build)).

## Desktop (macOS, Windows, Linux)

The desktop apps are the same UI in an Electron window (`desktop/`). Exports
open a save dialog; "Share" saves the file to `Downloads/Hub AI` and shows it
in the file manager, since desktops have no share sheet.

- **macOS:** open the `.dmg` and drag Hub AI to Applications. The app is
  ad-hoc signed but has no Apple Developer ID, so the first open is blocked
  with "can't verify the developer". On macOS 15 and newer, go to System
  Settings → Privacy & Security and click Open Anyway; on macOS 14 and older,
  right-click the app and choose Open. Or run
  `xattr -dr com.apple.quarantine "/Applications/Hub AI.app"`.
- **Windows:** run `HubAI-Setup-1.0.0.exe`. It isn't code-signed, so
  SmartScreen may warn: choose "More info", then "Run anyway".
- **Linux:** `sudo apt install ./hub-ai_1.0.0_amd64.deb`, then start Hub AI from
  the app menu or run `hub-ai`.

## Plans

Payments are a **demo**: checkout takes a test card, charges nothing, and
only records the plan on the server. Plans and credits are enforced by Hub AI
Cloud.

| | Hub Free | Hub Go — $2/month | Hub Plus — $12/month | Hub Enterprise — $120,000/seat/year |
|---|---|---|---|---|
| Credits | 10 per day, 200 per year max | 100 per day | 1,000 per month | 100,000 per month |
| Hub agents | V1 Mini | V1 Mini, Lite, **Standard** | + **V1 Plus**, a little **V1 Max** (5 per day) | All of them, plus 🤫 a secret one |
| Gemini | — | **Gemini 3.8 Flash** | Flash, a little **Gemini 3.8 Pro** (3 per day) | Flash and Pro |
| Hubs | Preview only, no saving | Save, **HTML export only** | Save, HTML and ZIP export | Save, HTML and ZIP export |
| Features | 5 | 10 | 15 | all 20 |

Credit costs per hub: V1 Mini 1, Lite 1, Standard 2, Plus 3, Max 5,
Gemini Flash 3, Gemini Pro 10. Credits are refunded when generation fails.

The secret agent (Hub V2 Max) never appears in the app or in `/v1/config`
unless the account is on Hub Enterprise. Model details stay on the server.

## Features

Five per plan, and every plan keeps the ones below it. (You asked for "Pro";
the paid tier between Go and Enterprise is Hub Plus, so they are there.)

| Plan | Features |
|---|---|
| Free | 🎲 Surprise Me · 🎉 Confetti Blast · 🐱 Cat Walk · 🙃 Upside-Down Mode · 📱 Device Flip |
| Go | 🌈 Rainbow Mode · 🔊 Click Sounds · 🧬 Hub DNA · 🔥 Daily Hub Challenge · 🧩 Embed Code |
| Plus | 🤪 Make It CRAZIER · ⚔️ Hub Battle · 🕰️ Time Machine · 🌍 Translate Hub · 🧼 No Watermark |
| Enterprise | 🧪 Hub Mashup · 🔐 Password Lock · 📲 Install as App · 🎨 Brand Kit · 🎰 Variation Blaster |

- Power-ups (Confetti, Cat Walk, Upside-Down, Rainbow, Click Sounds, No
  Watermark) are toggles under a hub; they go into previews and exports.
- CRAZIER, Translate and Mashup send the hub back to the agent (normal
  credit cost). Battle and Variation Blaster run 2 or 3 generations.
- Password Lock exports a file that asks for the password before showing
  the hub (password-stretched SHA-256 keystream; it keeps casual eyes out,
  not a determined attacker).
- Install as App exports a ZIP with a web manifest, icon and service worker:
  host it on any HTTPS site and "Add to Home Screen".
- The catalog lives in `cloud/hubcloud/config.py` (`FEATURES`); the app-side
  parts are in `app/src/main/assets/www/js/features.js`.

## Hub agents

The agents run on Hub AI Cloud. Each starts from a base model and is
fine-tuned in Python on Hub examples (`cloud/training/`). Which models they
use is configured on the server, not shown in the app; see
[cloud/README.md](cloud/README.md#agents).

## How it's built

- `cloud/`: Hub AI Cloud, the Python server that runs the agents, keeps
  accounts, plans and credits, and holds the API keys.
- `app/src/main/java/com/hubai/app/MainActivity.java`: a WebView shell with
  a small native bridge for saving to `Downloads/Hub AI` and the share
  sheet. Hubs run in sandboxed iframes, and the bridge only accepts calls
  carrying a token that only the app's own page has.
- `app/src/main/assets/www/`: the app UI (plain HTML/CSS/JS, no frameworks).
  Open `index.html` through any local web server to work on it in a desktop
  browser; native calls fall back to browser downloads.
- The apps get an anonymous account on Hub AI Cloud on first use. Hubs,
  FunHub posts and likes stay on the device. FunHub has no shared feed yet,
  so published hubs show in your own feed and you share them as `.html` files.

## Build

Android needs JDK 17 and the Android SDK (platform 35).

```sh
./gradlew assembleRelease
# -> app/build/outputs/apk/release/app-release.apk
```

To sign with your own key, set `HUBAI_KEYSTORE`, `HUBAI_KEYSTORE_PASSWORD`,
`HUBAI_KEY_ALIAS` and (if different) `HUBAI_KEY_PASSWORD`.

Desktop needs Node 22. Each installer has to be built on its own OS (CI uses
macOS, Windows and Ubuntu runners):

```sh
cd desktop
npm install
npm start            # run it from source
npm run dist:mac     # -> release/*.dmg   (on macOS)
npm run dist:win     # -> release/*.exe   (on Windows)
npm run dist:linux   # -> release/*.deb   (on Linux)
```
