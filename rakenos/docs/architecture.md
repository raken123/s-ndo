# RakenOS architecture

## One app

There is one RakenOS app: package `com.raken.rakenos`, file `RakenOS.apk`. The same build runs on every compatible device. `app/` is the Cordova project; `app/www/os/` is the system shell and its apps; `tools/assemble-www.mjs` copies the shared modules (`design-system/`, `update-system/`, `ras-runtime/`, `store/`, `data/`) into `app/www/lib/` so the APK and the browser preview run identical code.

```
app/www/os/
├── main.js              boot sequence
├── core/                DOM helpers, settings store, IndexedDB, platform bridge, capability detection
├── ui/                  navigation stack, dialogs, sheets, menus, toasts, list builders
├── shell/               boot, setup, lock screen, PIN pad, home, windows, recents, gestures,
│                        status bar, Notification/Control Center, search, theme and wallpapers
├── services/            notifications, security, updates, RAS apps, Store, files, alarms, battery, usage
└── apps/                Settings (+ System Update), Camera, Gallery, Files, Notes, Calculator,
                         Clock, Browser, Raken Store, Scanner, RAS app host
```

## Capability detection

`core/capabilities.js` asks the native `RakenSystem` plugin (`app/plugins-src/cordova-plugin-raken-system`) for capability flags: `camera`, `multipleCameras`, `advancedCamera` (a camera with a FULL or LEVEL_3 hardware level and manual sensor control), `torch`, `nfc`, `scanner2d` (a RakenOS system feature flag or a built-in scanner service), `vibration`, `bluetooth`, `wifi`, `telephony`, `fingerprint`, `gps`. In a browser the same flags come from web APIs.

Features are switched on from these flags:

| Capability | Enables |
|---|---|
| `nfc` | NFC settings, NFC tile in Control Center, NFC-only Store apps |
| `scanner2d` | Scanner app, Scanner settings, Scanner tile, scanner-only Store apps |
| `torch` | Flashlight tile, Lock Screen flashlight, camera flash |
| `advancedCamera` | Camera Pro mode |
| `multipleCameras` | camera switching |
| `vibration` | system haptics |

Developer Options can simulate a *missing* capability for testing; it can never add hardware.

**No model names.** The plugin does not read the device model, manufacturer or product name, and nothing in RakenOS displays one. `tools/scan-model-names.mjs` enforces this in the build, and the e2e suite checks the rendered text of every visited screen.

## Native services (RakenSystem plugin)

`getCapabilities`, `getBattery`, `setBrightness` (window brightness), `setTorch`, `vibrate`, `requestPermission` (camera), `openSystemSettings`, `openExternal`, `canRequestPackageInstalls`, `installPackage` (download, verify SHA-256, open the Android package installer — the user always confirms).

## Data and privacy

Settings live in local storage; photos and installed RAS packages in IndexedDB. Usage statistics, search history and the rollout identifier stay on the device. Diagnostics sharing is off by default.
