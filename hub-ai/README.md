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

| | Hub Free | Hub Go — $2/month | Hub Plus — $12/month | Hub Enterprise |
|---|---|---|---|---|
| Credits | 10 per day, 200 per year max | 100 per day | 1,000 per month | 100,000 per month |
| Hub agents | V1 Mini | V1 Mini, Lite, **Standard** | + **V1 Plus**, a little **V1 Max** (5 per day) | Everything, incl. **Hub V2 Max** |
| Gemini | — | **Gemini 3.8 Flash** | Flash, a little **Gemini 3.8 Pro** (3 per day) | Flash and Pro |
| Hubs | Preview only, no saving | Save, **HTML export only** | Save, HTML and ZIP export | Save, HTML and ZIP export |
| Price | Free | $2/month | $12/month | $120,000 per seat per year, very large companies only, not sold in the app |

Credit costs per hub: V1 Mini 1, Lite 1, Standard 2, Plus 3, Max 5, V2 Max 100,
Gemini Flash 3, Gemini Pro 10. Credits are refunded when generation fails.

## Hub agents

| Agent | Starts from |
|---|---|
| Hub V1 Mini | GPT-4o |
| Hub V1 Lite | GPT-4.5 |
| Hub V1 Standard | GPT-5 |
| Hub V1 Plus | GPT-5.6 Sol |
| Hub V1 Max | GPT-6 Astra |
| Hub V2 Max | GPT-6 Astra (builds) + GPT-6 Sol (reviews and fixes) |

Each agent is its base model plus Hub's instructions, fine-tuned in Python
on Hub examples rendered from the app's hub templates
(`cloud/training/`). The model ids are configurable on the server; some of
these models don't exist under these names yet. See
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
