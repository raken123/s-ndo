# BFDI Talk

Talk out loud with your own object-show character. It answers in a real voice, its mouth
lip-syncs to the speech, and its eyes and mouth change with its mood. It runs on
**Gemini 3.8 Flash Live** (`gemini-3.8-live`) or **Gemini 3.8 Live Extended Thinking**
(`gemini-3.8-live-extended-thinking`).

Builds: **Windows `.exe`**, **macOS `.dmg`** and **Android `.apk`**. All three use the same web
app in `www/`. Electron wraps it for desktop and Capacitor wraps it for Android.

## Features

- **Live voice chat.** Talk hands-free, or turn on push-to-talk (hold the button or Space).
  You can also type.
- **Lip-sync.** The character's own speech audio picks one of four mouth shapes for each emotion
  (closed / small / medium / wide), plus an "oo" mouth for round vowels.
- **Emotions.** The AI calls a `set_expression` tool before each reply. The app has 19 emotions,
  each with its own eye set and mouths from your sprite sheets. If the AI skips the call, the app
  guesses an emotion from the words.
- **Characters.** 7 body shapes, 10 colours, a name, and personality presets or your own text.
- **30 Gemini voices** to choose from.
- **Usage meter.** One pool shared by both models:
  - 100% lasts about 20 minutes on Flash Live and about 8 minutes on Extended Thinking
    (2.5× cost).
  - At **0%** talking locks for **1 hour**. The character is knocked out (XX eyes) and a
    countdown shows. Then the meter refills to 100%.
  - After 75 quiet seconds the call hangs up so the meter doesn't drain.
- **Usage Credits.** *Buy Credits* opens https://jooykoll.itch.io/bfdi-talk-ai. After paying, the
  user uploads a screenshot of the payment:
  - Gemini reads the screenshot. It has to be an itch.io payment for BFDI Talk of **$5 or more**.
  - **$1 = 5% usage.** Credits can take the meter above 100%, and buying ends a cooldown at once.
  - The same screenshot or order number can't be used twice.

## Build

### Option A: GitHub Actions (recommended)

`.github/workflows/bfdi-talk.yml` builds all three files on GitHub's Windows, macOS and Linux
machines:

1. In the repo, go to **Settings → Secrets and variables → Actions → New repository secret**.
   Add `GEMINI_API_KEY` with your key.
2. Push to `main` (or run the workflow by hand from the **Actions** tab). Download
   `BFDI-Talk-Windows`, `BFDI-Talk-macOS` and `BFDI-Talk-Android` from the run's **Artifacts**.
3. To make a public download page, push a tag such as `bfdi-talk-v1.0.0`. The workflow then
   attaches all three files to a GitHub Release.

### Option B: locally

```bash
cd bfdi-talk
npm install
echo "GEMINI_API_KEY=your-key" > .env      # never committed

npm start              # run the desktop app
npm run serve          # or try it in a browser at http://localhost:5173
npm run dist:win       # .exe  (on Windows)
npm run dist:mac       # .dmg  (on a Mac)
npm run android:apk    # .apk  (needs Android Studio / SDK + JDK 21)
```

## Install notes

- **Windows.** The installer isn't code-signed, so SmartScreen may warn. Click
  *More info → Run anyway*.
- **macOS.** The app is ad-hoc signed but not notarized. The first time, right-click the app,
  choose *Open*, and confirm. On newer macOS versions, use *System Settings → Privacy & Security →
  Open Anyway* instead. Allow the microphone when asked.
- **Android.** The APK is a debug-signed build for sideloading. Allow "install unknown apps".
  To publish on Google Play, set up a release keystore and run `./gradlew bundleRelease`.

## About the API key and limits

- The key is **never committed**. `scripts/write-config.mjs` writes it into `www/js/config.js`
  (git-ignored) at build time.
- Anything shipped inside an app can be pulled back out of it. Anyone who downloads the
  EXE/DMG/APK could extract the key and use your Gemini quota. For a public release, put a small
  server in between. For example, it could hand out short-lived Gemini Live *ephemeral tokens*.
  Also set a spending cap on the key in Google AI Studio.
- The usage meter and the credit list are stored on the device. A determined user can reset them
  by clearing the app's data.
- Screenshot checking is a light check, and a skilled fake could get past it. For airtight
  credits, check purchases on a server with the itch.io API (`/purchases` endpoint, matched by the
  buyer's email or download key).

## Project layout

```
www/                 the app (HTML/CSS/JS, no bundler)
  js/app.js          UI, session flow, usage + purchase wiring
  js/live.js         Gemini Live WebSocket client, mic capture, playback, lip-sync analyser
  js/face.js         emotion → eyes/mouth table, blinking, mouth picking
  js/character.js    SVG bodies
  js/usage.js        usage meter, 1-hour lock, credits
  js/purchase.js     screenshot verification with Gemini
  assets/            sliced sprites (generated)
electron/            desktop shell (serves www/ from app://bfdi)
android/             Capacitor Android project
assets-src/          the original mouth + eye sprite sheets
tools/               slice_assets.py (cut sprites), make_icon.py (icons/splash)
```

To re-cut the sprites after editing the sheets, run `pip install pillow numpy scipy`, then
`npm run assets`.

The bottom-right eye set on the eye sheet is skipped because the artist's watermark
(MsBonnieArt) covers it. The eye art is by MsBonnieArt, so make sure you're allowed to use it
before you sell the app. The UI font is Fredoka (SIL Open Font License, `www/fonts/OFL.txt`).
BFDI is a show by jacknjellify, and this is an unofficial fan app.
