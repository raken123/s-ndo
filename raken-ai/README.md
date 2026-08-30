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
| **Light** | The subscription. Plan comparison, the three noses, and the mock purchase flow. |
| **Library** | Saved accords and the molecule bank. |

## Light — the subscription

Simulated end to end: no store, no payment, no network. The chosen plan is kept in
`localStorage`, so it survives a reload.

| | Free | Light — €4.99/mo |
| --- | --- | --- |
| Charging | 1.4 %/min | **4.2 %/min (3×)** |
| Raken AI (core nose) | ✓ | ✓ |
| Raken AI Fast | — | ✓ |
| Raken AI Super Parfume | — | ✓ |
| Composition screening | ✓ | ✓ |
| Water verification | ✓ | ✓ |

The three noses differ in what they actually produce:

* **Raken AI** — two notes per layer, eau de parfum.
* **Raken AI Fast** — composes roughly 2.6× quicker and pushes the cell a little harder.
* **Raken AI Super Parfume** — three notes per layer, extrait concentration, ~3.5 h more wear.

A locked nose opens the paywall instead of composing. Cancelling drops charging back to
1.4 %/min and pushes the active nose back to the core one.

## The two checks

Both run on **every plan**, cannot be switched off, and are not part of what Light sells.

* **Composition screening** — every request is screened before a formula is built. Anything
  that reads as drugs, explosives, poisons or harming someone is refused in the chat with the
  category named, the request is counted on the dock's safety card, and no accord is produced.
  Screening runs before the dock and plan checks, so it applies even with the flacon off the dock.
* **Liquid verification** — the dock measures conductivity and refractive index on every scan,
  every charge tick, and before every synthesis or mist. If what is in the reservoir is not
  water, charging halts, the atomiser locks, the hero reads *Liquid rejected*, and the nose
  refuses to synthesise. The **Liquid in the dock** simulation on the Dock screen switches
  between distilled water and something else.

## The dock rules

The dock state drives the whole interface:

* **Seated in the dock** → the hero uses the product shot *with* the pink Water Dock, water
  level and charge read out in litres and percent, and synthesis and diffusion are unlocked.
* **Off the dock** → the hero swaps to the flacon-only shot, water and charge read `—`, and
  every action that needs power is refused with an explanation.
* **Dock but no water** → synthesis is refused until the reservoir is refilled.

Two ways to change it: the **Scan dock** button (runs the scan animation, then reports what it
found) or the **Flacon placed in dock** switch, which stands in for the dock proximity sensor.
Every scan also verifies the liquid — see below.

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

Needs JDK 17 and the Android SDK (compileSdk 34, minSdk 24).

If you would rather not install either, CI builds it for you. Every push that touches
`raken-ai/` runs the **Build RAKEN AI APK** workflow, which

* uploads the APK as the `raken-ai-debug-apk` run artifact (needs a GitHub login, expires
  after 90 days), and
* commits it to this branch as **`raken-ai/dist/raken-ai-debug.apk`**, which is the easy
  link to hand to someone.

It is a *debug* build signed with the throwaway debug key, so Android will ask you to allow
installs from unknown sources. That is expected for a UI test — do not ship it.

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
