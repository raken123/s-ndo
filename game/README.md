# Prison Break

A top-down stealth escape game built with **Godot 4.3**, packaged as an Android APK.

Three blocks stand between you and the outside. Each one needs every keycard on
the floor before the gate will open, and the guards are the only thing in your way.

![Level 1](docs/level_1.png)

## How to play

| | Touch | Keyboard |
|---|---|---|
| Move | Drag anywhere on the left of the screen (floating joystick) | `WASD` / arrow keys |
| Sneak | `SNEAK` pad, bottom-right (toggle) | Hold `Shift` |
| Restart level | — | `R` |
| Dismiss a message | Tap | `Space` |

**The rules**

- Collect every keycard on the level, then reach the green gate.
- Any keycard opens any locked door — just walk into one while holding one.
- Guards see in a cone. It turns **orange** when they suspect something and
  **red** once they have you. The bar in the top-right is how close you are to
  being caught; break line of sight and it drains back down.
- **Sneaking roughly halves the distance you can be spotted from**, at half speed.
- Dark floor patches halve it again. Standing still in one is the safest place
  on the map.
- Getting caught restarts the current block only.

## Levels

| # | Name | Guards | Keycards |
|---|------|--------|----------|
| 1 | B-Block Cells | 2 | 1 |
| 2 | The Yard | 3 | 2 |
| 3 | Perimeter Wall | 4 | 2 |

## Project layout

```
game/
├── project.godot            # engine + input map config
├── export_presets.cfg       # Android export preset
├── assets/                  # icon sources (SVG) and rendered PNGs
├── src/
│   ├── main.gd              # level building, A* grid, game state machine
│   ├── main.tscn            # entry scene (everything else is built in code)
│   ├── levels.gd            # the level grids and patrol routes
│   ├── player.gd            # movement + visibility model
│   ├── guard.gd             # patrol / suspect / chase AI, vision cones
│   ├── hud.gd               # status bar, overlays, touch controls
│   └── *_view.gd            # drawing for the level, doors, keycards, exit
└── tools/
    ├── smoke_test.gd        # headless correctness checks
    └── screenshot.gd        # renders each level to a PNG
```

Levels are plain character grids in `src/levels.gd` — `#` wall, `.` floor,
`P` start, `K` keycard, `D` door, `E` exit, `~` shadow. Everything (collision
bodies, the A* navigation grid, entities) is generated from that grid at load
time, so a new level is just a new block of text plus patrol waypoints.

## Building

Requires Godot 4.3 with export templates, plus the Android SDK
(build-tools 34, platform 34) for the APK.

```bash
# Run the correctness checks
godot --headless --path game --script res://tools/smoke_test.gd

# Regenerate the level screenshots
xvfb-run godot --path game --rendering-driver opengl3 \
    --script res://tools/screenshot.gd

# Build the APK (keystore is passed via env, never committed)
export GODOT_ANDROID_KEYSTORE_RELEASE_PATH=/path/to/release.keystore
export GODOT_ANDROID_KEYSTORE_RELEASE_USER=youralias
export GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD=yourpassword
godot --headless --path game --export-release "Android" build/PrisonBreak.apk
```

The smoke test is the one worth keeping in the loop: besides checking the grids
are well formed, it verifies each level is actually **winnable** — that a keycard
is reachable before any door is opened, that every keycard and the exit are
reachable once doors are open, and that no patrol route is cut in half by a door
a guard cannot open. It caught three unwinnable levels during development.

## The build in this repo

`build/PrisonBreak.apk` — release build, `arm64-v8a` + `armeabi-v7a`,
minSdk 21 (Android 5.0+), signed with a debug key.

Because it is signed with a debug key rather than a Play-issued one, Android
will warn about installing from an unknown source; allow it for your browser or
file manager to install. Replace the keystore with your own before distributing.
