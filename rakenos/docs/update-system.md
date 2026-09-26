# RakenOS System Updates

## Release history

`data/rakenos-updates.json` holds the complete history: **177 releases**, RakenOS 1.0.0 through 59.0.2. Every generation has three releases:

| Release | Type | Purpose |
|---|---|---|
| `N.0.0` | `major` | the generation release with new features |
| `N.0.1` | `maintenance` | stability and corrections for what `N.0.0` introduced |
| `N.0.2` | `polish` | security, polish and smaller refinements |

Each release entry contains `version`, `name`, `releaseDate` (for example `"April 18"`), `releaseMonth`, `releaseDay`, `releaseType`, `title`, `summary`, `highlights`, `sections` (titled lists such as *Home Screen*, *Privacy*, *RAS Runtime*, *Bug Fixes*), `security.advisories` (RKSA identifiers), `components` (interface, RAS runtime, RAS API level, RScript, Store service), `payload` (size, manifest, SHA-256), `rollout` (waves A–D with dates) and `requiresVersion` (the release it is built against).

### Dates

All release dates are in spring — March, April or May. `.0.0` is usually in March, `.0.1` usually in April and `.0.2` usually in May, and the three are always in chronological order. `.0.2` releases are never later than May 25 so that every rollout wave also lands in spring. Dates were drawn **once** from a seeded generator and are stored in the dataset; running the generator again keeps the stored dates (`--regenerate-dates` draws new ones deliberately).

### Content

Release notes are authored per generation in `tools/release-content/` and assembled by `tools/generate-updates.js`:

- `majors-01-19.js`, `majors-20-39.js`, `majors-40-59.js` — title, summary and notes for each `.0.0`, the authored follow-ups for `.0.1` and `.0.2`, and the features ("subjects") the generation introduced;
- `pools.js` — maintenance notes for specific areas (each used at most once in the whole history), targeted templates for the features of a generation, and security advisory building blocks.

The generator validates the result: 177 releases, spring dates, chronological generations, no generic "bug fixes and improvements" text, and **no sentence repeated anywhere** in the history.

Generations follow the product's evolution: 1–9 foundations (Store, RAS, notifications, camera, files, privacy, performance); 10–19 multitasking, widgets, accessibility, Store discovery, universal search, Camera Pro, app lifecycle, scanner services; 20–29 Raken Design 2, resource management, continuity, notification system 2, RAS APIs 2, security architecture; 30–39 productivity, multitasking 2, Privacy Report, backup and recovery, Routines, Private Space, seamless updates; 40–49 RAS Runtime 4, motion engine, third-generation Store, advanced accessibility, passkeys, lockdown mode, RScript 5; 50–59 modular architecture, stability, Raken Design 3, predictive performance, post-quantum security, RAS Runtime 6, and the mature generation.

## Update flow

```
Checking → Update Available → Downloading → Verifying → Preparing → Ready → Updated
               ↘ Up to date     ↘ Rolling out (your group's day has not come yet)
```

`update-system/update-engine.js` implements the state machine:

- **Checking** asks the provider for the next release after the installed one (updates are sequential deltas, `requiresVersion`).
- **Downloading** transfers the payload with progress.
- **Verifying** computes SHA-256 of the downloaded payload and compares it with the digest in the release; a mismatch stops the update.
- **Preparing** stages the release's system components.
- **Ready** waits for installation. With *Install when ready* on, the update installs the next time the device is locked.
- **Updated** records the new version, its components (for example the RAS API level, which unlocks newer Store apps) and the install history.

Settings → System Update shows RakenOS, Current Version, Last Checked, Automatic Updates, Update History and *Check for Updates*. Settings → System Update → Automatic Updates has *Automatic Updates*, *Download updates automatically* and *Install when ready*.

### What is and is not installed silently

RakenOS system components (interface, RAS runtime, RScript engine, Store service, system version) are applied inside RakenOS. The Android application package is **never** replaced silently: if a release carries `shellUpdate`, the engine downloads it through the RakenSystem plugin, verifies its SHA-256 and opens Android's package installer, where the user confirms. On Android 8+ this also requires the *Install unknown apps* permission, which the plugin opens in system settings when missing.

## Staged rollout

Every release reaches devices in four waves:

| Group | Share | Receives the release |
|---|---|---|
| A | 10% | on release day |
| B | 25% | 1–2 days later |
| C | 30% | a few days later |
| D | 35% | up to 6 days later |

Offsets are stored per release (`rollout.phases`). All groups receive **the same version**. The group comes from a random 128-bit identifier generated on the device (`update-system/rollout.js`) — no personal data, no hardware information. It can be reset in Settings → Privacy.

In the prototype, the next release is treated as published to the device when the current version was installed, and one rollout day lasts one minute by default so waves can be observed. Developer Options → *Staged rollout simulation* switches between real days, one hour, one minute and ten seconds.

## Update server API

`update-system/api-core.js` contains the server logic. The in-app `LocalUpdateProvider` and the development server share it, so they always agree.

```
GET /api/os/latest
GET /api/os/releases?limit=&before=
GET /api/os/releases/:version
GET /api/os/releases/:version/payload        → { version, sha256, sizeBytes }
GET /api/os/releases/:version/payload.bin    → payload bytes
GET /api/os/check?currentVersion=22.0.1&rolloutGroup=B&since=<ms>&dayMs=<ms>
```

```json
{
  "updateAvailable": true,
  "currentVersion": "22.0.1",
  "latestVersion": "59.0.2",
  "latestEligibleVersion": "22.0.2",
  "rollout": "available",
  "rolloutGroup": "B",
  "openGroups": ["A", "B"]
}
```

Run the development server with `npm run backend` (`--port`, `--day-ms`). To point a device at it, set Developer Options → *Update server* (for the Android emulator: `http://10.0.2.2:8787`).
