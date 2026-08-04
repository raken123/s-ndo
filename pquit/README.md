# PQuit

An Android app for quitting porn. Three things, nothing else:

1. **A streak** you can see on the home screen.
2. **Games** for when the urge hits - snake, 2048, breakout, memory, and a breathing
   exercise. An urge peaks in a few minutes; the games are there to be boring company
   until it does.
3. **The big red button.** If you actually want to go and look, you press it - and
   instead of a lecture you get a one hour wait. Chrome, Edge, TikTok, YouTube and
   (in strict mode) every other app you installed yourself stay shut for that hour.
   Everything that came with the phone keeps working. When the hour is up the block
   lifts by itself and the decision is yours again.

Built with Cordova. Everything is stored on the phone - no account, no server, no
analytics, no network calls.

## Install

Download `dist/PQuit-1.0.0.apk`, copy it to the phone, open it, and allow
"install unknown apps" when Android asks. Minimum Android 7.0 (API 24).

After first launch, open **Setup → App blocking → Open accessibility settings**, find
**PQuit blocker** under *Installed apps* (sometimes under *Downloaded apps*) and switch
it on. Without that switch the timer still counts down but nothing gets blocked -
Android gives no other way for an ordinary app to hold another app closed.

Usage access (Setup → Usage access) is optional and only powers the Screen time page.

## How the blocking works

`PQuitAccessibilityService` gets told which app just came to the foreground. If a
cooldown is running and that app is on the block list, the service sends the phone
home and shows a full-screen countdown instead.

Blocked while a cooldown runs:

- Chrome (plus beta/dev/canary), Edge, TikTok, YouTube - always, by package name.
  These are usually *preinstalled*, which is exactly why "only preinstalled apps work"
  is not enough on its own.
- Other browsers people reach for next: Firefox, Opera, Brave, Samsung Internet,
  DuckDuckGo, UC Browser, the AOSP browser.
- In **strict mode** (on by default): every app you installed yourself. Apps that
  shipped with the phone stay open.

Never blocked, in any mode: the launcher, phone/dialer, contacts, messages, settings,
system UI, the package installer, emergency dialling, and PQuit itself.

The deadline is stored as both wall-clock and `elapsedRealtime`, and the lock ends only
when both have passed - so winding the system clock forward does not end it early. A
second press during a running cooldown can extend it, never shorten it.

### What it deliberately does not do

- It does not filter web pages or block porn sites by URL. It blocks the *apps*, for
  the *hour*, and that is the whole mechanism.
- It cannot stop you from opening Settings and turning the accessibility service off.
  Android does not let a normal app prevent that, and any app claiming otherwise is
  either a device-owner deployment or lying. The friction is the point, not a cage.
- It uninstalls like any other app. This is a tool you are choosing to use, not a
  parental control.

### Screen time

The block is temporary by design: it **disables itself when the hour runs out**. An
ongoing notification counts it down, and an alarm clears it at the end.

The Screen time page shows today's foreground time per app (from Android's
`UsageStatsManager`), how much of it went to blocked apps, and a shortcut to the
system's own Digital Wellbeing. Android's daily app timers keep working alongside
PQuit - PQuit handles the hour after the red button, Digital Wellbeing handles the
long-run limits.

## Building it yourself

```bash
npm install -g cordova
cd pquit
cordova platform add android@13
cordova plugin add ./plugins-local/cordova-plugin-pquit-blocker
cordova build android                 # → platforms/android/app/build/outputs/apk/debug/
```

Needs a JDK 17+, `ANDROID_HOME` pointing at an SDK with platform 34 and build-tools
34.0.0. The APK in `dist/` is the debug-signed build of exactly this source - fine for
sideloading, not for the Play Store.

For a release build, make your own keystore and keep it somewhere safe (lose it and you
can never update an installed copy in place):

```bash
keytool -genkey -v -keystore pquit.keystore -alias pquit \
        -keyalg RSA -keysize 2048 -validity 10000
cordova build android --release -- \
        --keystore=pquit.keystore --alias=pquit --storePassword=… --password=…
```

The launcher icon is generated, not hand-drawn: `python3 tools/mkicon.py` (needs
Pillow) rewrites every density in `res/icon/android/`.

## Layout

```
pquit/
├── config.xml                     app id, name, icons, preferences
├── www/                           the UI (plain HTML/CSS/JS, no framework)
│   ├── index.html                 all five screens
│   ├── js/app.js                  navigation, red button, countdown, setup
│   ├── js/native.js               plugin bridge + browser fallback for dev
│   ├── js/store.js                streak and counters in localStorage
│   └── js/games/                  snake, 2048, breakout, memory, breathe
├── plugins-local/cordova-plugin-pquit-blocker/
│   ├── src/android/LockState.java                 deadline + block list
│   ├── src/android/PQuitAccessibilityService.java the bouncer
│   ├── src/android/BlockActivity.java             the countdown wall
│   ├── src/android/LockNotifier.java              ongoing notification + alarm
│   └── src/android/PQuitBlocker.java              the JS bridge
├── tools/mkicon.py                icon generator
└── dist/PQuit-1.0.0.apk           installable build
```

`www/` runs in a desktop browser too (`python3 -m http.server` inside `www/`); the
plugin is replaced by a simulated lock so the UI can be worked on without a phone.
