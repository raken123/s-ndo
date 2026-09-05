# Raken AI

Chat, make images and videos, and hand real work to a **Work Agent** and a
**Code Agent** — on Windows, macOS, Linux, Android and the web, from one code
base. Everything you make stays on your device.

| Platform | How to get it |
|---|---|
| **Web** | Open `raken-ai/app/index.html` from GitHub Pages (`https://<user>.github.io/s-ndo/raken-ai/app/`) — installable as a PWA, works offline after the first visit |
| **Single file** | `raken-ai.html` — the whole app embedded in one 150 KB file (styles, scripts, icons). Open it from disk, a USB stick or an e-mail attachment; nothing else needed |
| **Windows** | `raken-ai-<v>-win32-x64.tar.xz` → extract → run `RakenAI.exe` |
| **macOS** | `raken-ai-<v>-macos-arm64.tar.xz` (Apple Silicon) or `-macos-x64` (Intel) → extract → `xattr -dr com.apple.quarantine "Raken AI.app"` → open |
| **Linux** | `sudo apt install ./raken-ai_<v>_amd64.deb` then `raken-ai`, or the generic `-linux-x64.tar.xz` |
| **Android** | `raken-ai-<v>-android.apk` from the *Raken AI builds* workflow artifacts / a release, sideload it |

Desktop packages are produced by `desktop/build.py`; the APK by the Gradle
project in `android/`; the GitHub Actions workflow `.github/workflows/raken-ai.yml`
builds all of them and attaches everything to a release when you push a tag
like `raken-ai-v1.0.0`. See **Building** below.

## What it does

- **Chat** — streaming replies from Claude (Opus 5 / Sonnet 5, and Fable 5.1 on Pro), Markdown, code blocks with copy, optional web search, attach images, PDFs and text files, dictation and read-aloud, chats saved on device.
- **Images** — text to image with style chips and aspect ratios. Works out of the box with the free Pollinations provider (no key), or with fal.ai FLUX / any OpenAI-compatible image API with your key.
- **Videos** — text to video and image to video through fal.ai (LTX, MiniMax, Kling, Veo 3). Animate any image from your Gallery.
- **Work Agent** — give it a job; it searches the web, drafts documents, builds CSV tables and plans with tools, and files everything under **Documents** (view, copy, download, discuss in chat).
- **Code Agent** — describe an app; it reads/writes files in an in-browser project, tests logic in a sandboxed JS runner, and you get a live preview, an editor and a one-click `.zip` download.
- **Gallery / Documents** — everything generated, stored locally in IndexedDB. Export / import all data from Settings.
- **Pro** — founder offer (first 10 people get 98% off), plan comparison, license keys, daily free-tier limits enforced in-app.

## Setup for users

1. Open the app, enter a name.
2. **Settings → Assistant → Anthropic API key** (`console.anthropic.com`). Without a key the assistant runs in a labelled demo mode; images still work via Pollinations.
3. Optional: a **fal.ai key** for FLUX images and all video generation; an OpenAI-compatible key for other image models.

Keys are stored only in the app's local storage on that device and are sent only to the provider they belong to.

## Configuring the product (`app/config.js`)

| Key | What it does |
|---|---|
| `proMonthly`, `founderDiscount`, `founderSpots`, `founderMonths` | The Pro price and the founder offer shown everywhere (defaults: $24/mo, 98% off, 10 spots, 12 months) |
| `checkoutUrl`, `founderCheckoutUrl` | Where **Get Pro** / **Claim my spot** send people (a Stripe Payment Link, Lemon Squeezy, Gumroad…). The founder code is appended as `?code=`. Empty = built-in claim form that reserves a code on the device |
| `founderStatusUrl` | Optional JSON endpoint `{"claimed": n}` so the "spots left" counter is live across devices |
| `licensePublicKey` | Public key for license verification (see below). `null` = development mode, keys are only format-checked |
| `freeLimits` | Free-plan daily limits per device (chat, image, video, agent) |
| `models`, `defaultModel` | Model catalogue; `pro: true` models are only selectable on Pro |

### Issuing Pro license keys

```sh
node tools/genkey.mjs keygen                      # once; paste the public JWK into config.js
export RAKEN_LICENSE_PRIVATE_KEY='{...private jwk...}'
node tools/genkey.mjs issue --email a@b.c --months 12
```

The key is signed with ECDSA P-256 and verified in the app with WebCrypto, so
keys can't be forged without the private key. Users paste it under **Pro →
Have a license key?**.

### Raken Cloud gateway (optional)

Set **Settings → Raken Cloud gateway** to a server that accepts
`POST /v1/messages` (same body as the Anthropic Messages API) with an
`x-raken-license` header; the app then works without users bringing their own
key. The gateway is not part of this repository.

## Building

Requirements: Python 3, `unzip`, `xz`, `tar`, `dpkg-deb` (for the .deb), and
network access to GitHub releases. No npm is needed — the official Electron
runtime zips are downloaded directly.

```sh
cd raken-ai/desktop
python3 build.py                       # deb + win + mac-arm64  → dist/
python3 build.py deb linux-tar win mac mac-x64 --smoke
```

`--smoke` launches the Linux build under `xvfb` and checks the app boots.
Artifacts are trimmed (unused locales removed) and xz-compressed so each stays
under GitHub's 100 MB file limit.

Android (needs the Android SDK and Gradle 8.x; Java 17):

```sh
cd raken-ai/android
gradle assembleRelease                  # app/build/outputs/apk/release/app-release.apk
```

Set `RAKEN_KEYSTORE`, `RAKEN_KEYSTORE_PASSWORD`, `RAKEN_KEY_ALIAS`,
`RAKEN_KEY_PASSWORD` to sign with your own keystore; otherwise the debug key is
used so the APK is still installable.

Single-file edition: `python3 tools/mkhtml.py` embeds everything in `app/` into `raken-ai.html`.

Web: `raken-ai/app` is plain static files. Serve it from anywhere (the repo's
Pages workflow already does), or open `index.html` directly.

## How it is put together

```
raken-ai/
  app/              the web app (vanilla HTML/CSS/JS, no build step, no CDNs)
    index.html      shell and all views
    config.js       product configuration (pricing, offer, keys, limits, models)
    js/core.js      platform detection, settings, IndexedDB, network bridge, Markdown, zip
    js/ai.js        Claude Messages API client (streaming SSE) and the agent tool loop
    js/chat.js      Chat
    js/media.js     Images, Videos, Gallery
    js/agents.js    Work Agent, Code Agent, Documents, sandboxed JS runner
    js/pro.js       Pro page, founder offer, license activation
    js/settings.js  Settings, export/import
    js/app.js       navigation, onboarding, PWA registration
    sw.js           service worker (offline shell on the web)
  desktop/          Electron shell: main.js (app:// origin + HTTP bridge), preload.js, build.py
  android/          Gradle project: WebView + WebViewAssetLoader + save-file bridge
  tools/genkey.mjs  license key tool
  tools/mkhtml.py   builds the single-file raken-ai.html
  raken-ai.html     single-file edition (generated)
```

On the web and Android the page talks to providers directly (the Anthropic API
allows direct browser access with the `anthropic-dangerous-direct-browser-access`
header). On desktop every request goes through the Electron main process, so
CORS never applies. The desktop app is served from a private `app://` origin
so IndexedDB and WebCrypto behave exactly as on the web.

## Verification done in this repository

- The web app was driven in headless Chromium: onboarding, every view, Markdown
  rendering, zip writer, sandboxed JS runner (including the timeout), chat in
  demo mode with persistence across reload, CSV documents, the Code Agent
  project/preview, license activation (dev mode, signed keys, tampered keys),
  image error handling, gallery, light theme, Work Agent run, and the mobile
  layout — with no page exceptions.
- The Linux desktop build is launched headlessly by `build.py --smoke`.
- Windows and macOS packages are assembled from the official runtimes with the
  same payload; they are not executed here because there is no Windows/macOS
  machine in the build environment.
- The Android project is not compiled here (no Android SDK in the build
  environment); the *Raken AI builds* workflow compiles it on GitHub's runners.
