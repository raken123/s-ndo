# Escape from Blackgate

A first-person stealth game about breaking out of a prison, packaged as an
Android app with Apache Cordova. One night, five chapters, roughly
**15 minutes** of play. Rendered in 3D with three.js; no assets are loaded —
every texture is drawn on a canvas at startup.

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

**Rendering:** the game rules run on a 32px logic tile grid; `world.js` builds a
three.js scene from that same grid — wall shells merged into one buffer with
hidden faces culled, a floor baked to a single texture, hinged doors, chain-link
fence, bushes, watchtowers, ceiling strip lights, a starfield over the yard, and
guards whose torch beams pool on the floor so you can read where they are
looking. Every texture is generated on a canvas at load; nothing is downloaded.

**Controls**

| | Touch | Keyboard / mouse |
|---|---|---|
| Look | drag on the right half | move the mouse (click once to capture it) |
| Move | drag on the left half | WASD / arrows |
| Sneak | SNEAK button, or a gentle push on the stick | Ctrl or C |
| Run | RUN button | Shift |
| Search / unlock / cut / use exit | ACT button | E, Space, or click |
| Pause | ❚❚ | Esc or P |

Whatever is under the crosshair and within arm's reach gets a prompt, so ACT is
always one button.

## Building it yourself

```bash
npm install                 # cordova-android, three, esbuild
node tools/bundle-three.js  # three.js -> a classic script for file:// (Cordova)
node tools/make-icon.js     # regenerates every icon density from code
node tools/build-web.js     # optional single-file browser build
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
www/index.html          app shell, HUD, crosshair, touch zones
www/css/style.css       HUD + screens
www/js/levels.js        the five maps (ASCII tiles) and all level data
www/js/world.js         builds the 3D scene from a level: geometry, textures, props
www/js/game.js          movement, look, vision, hearing, AI, flow, minimap
www/js/lib/three.bundle.js  generated — do not edit by hand
tools/bundle-three.js   esbuild wrapper that produces the above
tools/make-icon.js      dependency-free PNG icon generator (SDF → hand-encoded PNG)
tools/build-web.js      inlines everything into one standalone HTML file
tools/playtest.js       end-to-end play-through test
res/android/icon/       generated launcher icons, ldpi → xxxhdpi
dist/                   built APK + single-file web build
```

## Adding a chapter

Levels are plain ASCII in `www/js/levels.js` — `#` wall, `.` floor, `B` bunk,
`L` locker, `c` crate, `%` bush, `F` fence, `~` water, `1`-`4` locked doors,
`S` start, `X` exit — plus guard patrol routes, camera sweeps and searchlight
paths as tile coordinates. `tools/playtest.js` will validate the new chapter
end to end.
