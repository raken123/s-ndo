# RAKEN AI — UI prototype

Interface concept for an AI-powered parfum: a 100 ml flacon that sits on a **Water Dock**,
charges from the water in the dock, and composes new scents from a written description.

**This is a UI test only.** There is no device, no Bluetooth, no AI backend — every value,
sensor reading and "neural" response is simulated in the browser.

## Screens

| Screen | What it shows |
| --- | --- |
| **Dock** | Live device view. Shows the docked product shot when the flacon is seated, and the flacon-only shot when it is not. Water in litres, hydro-cell charge, full telemetry. |
| **Compose** | Chat with the neural nose. Describe a smell, get a full accord (top / heart / base notes, longevity, sillage, water cost) and load it into the flacon. |
| **Water** | Reservoir tank in litres, refill / use, hydro-electric charging figures, 7-day usage. |
| **Library** | Saved accords and the molecule bank. |

## The dock rules

The dock state drives the whole interface:

* **Seated in the dock** → the hero uses the product shot *with* the pink Water Dock, water
  level and charge read out in litres and percent, and synthesis and diffusion are unlocked.
* **Off the dock** → the hero swaps to the flacon-only shot, water and charge read `—`, and
  every action that needs power is refused with an explanation.
* **Dock but no water** → synthesis is refused until the reservoir is refilled.

Two ways to change it: the **Scan dock** button (runs the scan animation, then reports what it
found) or the **Flacon placed in dock** switch, which stands in for the dock proximity sensor.

Reservoir capacity is `0.50 L`; roughly `0.01 L` of water is worth `3 %` of charge, and a
synthesis costs about `0.016 L`.

## Running it

Any static server works — nothing is fetched from the network:

```bash
cd raken-ai
python3 -m http.server 8080
# open http://localhost:8080
```

On a phone, open it and use *Add to home screen*: `manifest.webmanifest` makes it launch
standalone, full-screen and black.

## Building the APK

`android/` is a thin WebView shell around the same files — the UI is not duplicated, the
Gradle build copies `index.html`, `manifest.webmanifest` and `assets/` into the APK at build
time, so the web prototype and the app can never drift apart.

```bash
cd raken-ai/android
gradle wrapper --gradle-version 8.7   # once, if you have no wrapper
./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

Needs JDK 17 and the Android SDK (compileSdk 34, minSdk 24). If you would rather not install
either, run the **Build RAKEN AI APK** workflow from the Actions tab and download the
`raken-ai-debug-apk` artifact.

## Files

```
raken-ai/
├── index.html               entire UI — markup, styles, simulation
├── manifest.webmanifest     installable web app
├── assets/
│   ├── bottle-solo.png      hero shot: flacon off the dock
│   ├── bottle-docked.png    hero shot: flacon on the water dock
│   └── icon-192/512.png     launcher icons
└── android/                 WebView shell for the APK
```
