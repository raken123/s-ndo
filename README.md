# Snake FPS 🐍🍎

A first-person snake game packaged as an Apache Cordova app. You see the world
from the snake's head: roam a walled arena, hunt the red apples, and don't bite
your own tail. Eating apples makes you longer — and faster.

## Controls

- **Touch:** swipe left/right, or tap the ⟲ ⟳ buttons
- **Keyboard:** ← / → or A / D

## Play in a browser

Open `www/index.html` — no build needed (the `cordova.js` 404 in the console is
harmless outside the app).

## Build the Android APK

Requires Node.js, the Android SDK, and a JDK.

```bash
npm install -g cordova
npm install
cordova prepare            # restores the android platform
cordova build android      # debug APK
cordova build android --release
```

The debug APK lands in
`platforms/android/app/build/outputs/apk/debug/app-debug.apk`.

The app icon (snake + red apple) is generated in `res/icon/` and wired up for
all Android densities in `config.xml`.

---

`index.html` at the repo root is the separate Sändo web app and is not part of
the Cordova build (the app uses `www/`).
