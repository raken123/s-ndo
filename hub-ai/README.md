# Hub AI

Apps for making **hubs**: apps, animations, slides, HTML cards, 3D models,
UI designs, pictures and photo edits, games, websites, infographics, logos,
diagrams and documents, each a single file you can preview, save, export and
share. They are made by the **Hub V1 agents**: Spark, Flux, Volt, Prism,
Titan and Pixel (pictures). **FunHub** is a scrolling feed of hubs you can
play and share.

The agents run on **Hub AI Cloud** (`cloud/`), a small Python server you
deploy with your model API key. The apps need its address; see
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
| Hub agents | V1 Spark, V1 Flux, V1 Pixel | + **V1 Volt** | + **V1 Prism**, a little **V1 Titan** (5 per day) | All of them, plus 🤫 a secret one |
| What you can make | Everything (13 types) | Everything | Everything | Everything |
| Hubs | Preview only, no saving | Save, **HTML export only** | Save; HTML, ZIP, video, SVG/PNG, picture and 3D exports | Same as Plus |
| Tools | 5 | 10 | 15 | all 20 |

Credit costs per hub: V1 Spark 1, Flux 1, Volt 2, Prism 3, Titan 6, Pixel
(pictures and photo edits) 4. Credits are refunded when generation fails.

## What you can make

| Type | What comes out | Extra export |
|---|---|---|
| 🧩 App, 🎮 Game, 🌐 Website | a working single-file app | |
| 🎞️ Animation | a looping canvas animation | 🎬 video (WebM/MP4, 9:16, 1:1 or 16:9, 5–15 s), recorded on the device |
| 📽️ Slides | a deck with keyboard/swipe navigation and speaker notes | print to PDF from the deck |
| 💌 HTML Card | an invitation, greeting, business card or post | print |
| 🧊 3D Model | a model in a WebGL viewer (spin, zoom) | GLB and OBJ from the viewer |
| 🎨 UI Design | high-fidelity screens plus a small design system | |
| 🖼️ Image & Photo Edit | a new picture, or your photo edited as described (Hub V1 Pixel) | the picture (PNG/JPEG) |
| 📈 Infographic | charts and visual explainers | |
| ✒️ Logo & Icon, 🔀 Diagram | one standalone SVG | SVG and PNG |
| 📄 Document | printable A4 pages | print to PDF |

Edit with AI works on every type; for pictures it edits the picture again.
Hubs that offer a file (like the 3D viewer) ask the app, which asks you
before saving.

The secret agent (Hub V2 Max) never appears in the app or in `/v1/config`
unless the account is on Hub Enterprise. Model details stay on the server.

## Tools

Twenty professional tools, five per plan; every plan keeps the ones below
it. (You asked for "Pro"; the paid tier between Go and Enterprise is Hub
Plus, so they are there.)

| Plan | Tools |
|---|---|
| Free | ✏️ Edit with AI · 📱 Device Preview · 🧾 Source Code · 📋 Prompt Templates · ♿ Accessibility Check |
| Go | 🕘 Version History · ⌨️ Code Editor · 🧩 Embed Code · 🔎 SEO & Share Tags · 📊 Performance Report |
| Plus | 🌍 Translate · 🩺 AI Bug Fix · ⚖️ Compare Agents · 📎 Data Import · 🏷️ White-label Export |
| Enterprise | 🔐 Password Protection · 🛡️ Security Scan & Lockdown · 📲 Installable App · 🎨 Brand Kit · 🗂️ Multiple Drafts |

- **Edit with AI**, **AI Bug Fix** and **Translate** send the hub back to the
  agent (`mode` `refine`, `fix`, `translate`; the agent's usual credit cost).
  Every change, by AI or in the Code Editor, is kept in Version History.
- **Data Import** attaches a CSV, TSV, JSON or text file (up to 100 KB) to
  the request; the agent embeds the data in the hub so it still works
  offline.
- **Accessibility Check** runs in the app: page language, viewport and zoom,
  title, alt text, form labels, button names, colour contrast (4.5:1, CSS
  variables resolved), duplicate ids, focus styles, headings, keyboard
  reachability. Errors it finds can go straight to AI Bug Fix. Automatic
  checks catch many problems, not all.
- **Performance Report**: size, JS/CSS/embedded media, element count and
  nesting, external requests (offline or not), fast timers, `document.write`.
- **Security Scan** flags external scripts, network calls, forms posting
  elsewhere, `eval`, cookies, `http://` and unsafe `innerHTML`. **Lockdown**
  exports with a Content-Security-Policy that blocks every network request.
- **Password Protection** exports an encrypted file (password-stretched
  SHA-256 keystream, 8+ character passwords). It keeps the content private
  from anyone without the password; a weak password can still be guessed
  offline.
- **Installable App** exports a ZIP with a web manifest, icon and service
  worker: host it on any HTTPS site and "Add to Home Screen".
- The catalog lives in `cloud/hubcloud/config.py` (`FEATURES`); the app-side
  parts are in `app/src/main/assets/www/js/features.js`.

## Hub agents

The agents run on Hub AI Cloud with Hub's instructions for each type of
creation. Which model powers each one is configured on the server and never
shown in the apps; see [cloud/README.md](cloud/README.md#agents).

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
