# Escape from Blackgate

A top-down stealth game about breaking out of a prison, packaged as an Android
app with Apache Cordova. One night, five chapters, roughly **15 minutes** of play.

![icon](res/android/icon/xxhdpi.png)

## Install

Sideload `dist/escape-from-blackgate-1.0.0.apk` (debug-signed, so Android will
ask you to allow installs from your file manager / browser).

- Package: `com.blackgate.escape`
- minSdk 24 (Android 7.0), targetSdk 35
- No permissions used at runtime, no network calls, everything runs offline

## The game

| # | Chapter | What you are doing |
|---|---------|--------------------|
| 1 | Cellblock D | Search your bunk for a hairpin, pick the cell lock, lift the block key, reach the stairwell |
| 2 | Laundry & Stores | Steal a guard uniform (it makes patrols look through you) and the supervisor's keycard |
| 3 | Security Wing | Pull the breaker to kill the cameras, take the wire cutters and the yard key |
| 4 | The Yard | Cross open gravel between two sweeping searchlights, cut the fence at the storm drain |
| 5 | The Storm Drain | A dark flooded maze — find the lamp and the crowbar, lever open the manhole |

**Systems:** guard vision cones with real line-of-sight, hearing (running is
loud, sneaking is silent, water splashes), a suspicion meter per guard, a wing
alert level that escalates to a lockdown sweep, patrol → investigate → chase →
search AI on BFS pathfinding, cameras, searchlights, cover bushes, a disguise
that fails at close range, stamina, three chances, and per-chapter saves.

**Controls**

| | Touch | Keyboard |
|---|---|---|
| Move | drag anywhere on the left half | WASD / arrows |
| Sneak | push the stick gently | Ctrl or C |
| Run | RUN button | Shift |
| Search / unlock / cut / use exit | ACT button | E or Space |
| Pause | ❚❚ | Esc or P |

## Building it yourself

```bash
npm install                # pulls cordova-android
node tools/make-icon.js    # regenerates every icon density from code
cordova build android --debug
```

Requires the Android SDK (platform 35 + build-tools 35) and a JDK 17+, with
`ANDROID_HOME` pointing at the SDK. The release variant is
`cordova build android --release` (you supply the keystore).

## Testing

`tools/playtest.js` drives the real game in headless Chromium: it starts each
chapter, collects every item, opens every locked door, cuts the fence, checks
that guarded exits refuse you until you hold the right item, and asserts the
run ends on the victory screen with no JavaScript errors.

```bash
npm i playwright
node tools/playtest.js --shots /tmp/shots
```

## Layout

```
www/index.html        app shell, HUD, touch controls
www/css/style.css     HUD + screens
www/js/levels.js      the five maps (ASCII tiles) and all level data
www/js/game.js        engine: movement, vision, AI, rendering, flow
tools/make-icon.js    dependency-free PNG icon generator (SDF → hand-encoded PNG)
tools/playtest.js     end-to-end play-through test
res/android/icon/     generated launcher icons, ldpi → xxxhdpi
dist/                 built APK
```

## Adding a chapter

Levels are plain ASCII in `www/js/levels.js` — `#` wall, `.` floor, `B` bunk,
`L` locker, `c` crate, `%` bush, `F` fence, `~` water, `1`-`4` locked doors,
`S` start, `X` exit — plus guard patrol routes, camera sweeps and searchlight
paths as tile coordinates. `tools/playtest.js` will validate the new chapter
end to end.
