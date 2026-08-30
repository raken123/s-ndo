# BFDIA 5B — Android

A two-character puzzle platformer for Android, in the spirit of *Battle for
Dream Island Again* episode 5b: you play **Firey** and **Leafy** at the same
time, swapping between them, and a level is only finished when **both** of them
are standing in the door.

Everything is drawn on a `Canvas` from vector shapes and every sound is
synthesised at startup, so the app has **no library dependencies at all** — the
`dependencies { }` block in `app/build.gradle` is empty — and no art or audio
assets beyond the launcher icon.

## The two of them

|            | Firey                                  | Leafy                                        |
|------------|----------------------------------------|----------------------------------------------|
| Burns      | sets wood alight just by touching it   | —                                            |
| Swims in   | lava                                   | water                                        |
| Dies in    | water                                  | lava, and any wood that is currently burning |
| Trick      | —                                      | hold JUMP while falling to glide             |

Spikes and the pit below the level finish either of them. Dying restarts the
level after a short pause; your cake count and best time per level are saved.

## Playing

Landscape, on-screen pad: left / right / down on the left, **JUMP** and **SWAP**
on the right, restart / mute / level-list along the top. A hardware keyboard
works too — arrows or WASD, space to jump, Tab or E to swap, R to restart.

## Building

The build needs a JDK 17+ and an Android SDK with platform 34.

```sh
./gradlew assembleDebug          # app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug           # straight onto a connected device
```

CI (`.github/workflows/android.yml`) builds both the debug and the unsigned
release APK on every push and uploads them as workflow artifacts.

## Tests

The simulation lives in `com.raken.bfdia5b.core` and imports nothing from
Android, so it can be exercised with a plain JDK — no emulator, no SDK, no
network:

```sh
./tools/run-core-tests.sh        # physics, hazards, puzzle pieces, all levels
./tools/typecheck-ui.sh          # compiles the Android layer against local stubs
```

`run-core-tests.sh` covers jump height, one-way platforms, drowning and melting,
wood catching and spreading fire, crate pushing, buttons, gates, keys, doors,
trampolines and the both-on-the-exit win condition. It then walks every shipped
level with a deliberately generous movement model (`LevelValidator`) and fails
if either character cannot reach the exit — which is how a mistyped tile that
seals off a route gets caught.

`typecheck-ui.sh` compiles `ui/` against the hand-written framework stubs in
`tools/androidstubs`. Those stubs are a local convenience only; they are not on
the Gradle source path and never ship.

## Levels

All 14 levels are plain text in `app/src/main/assets/levels.txt`:

```
@level Bonfire
@hint Firey burns wood just by touching it.
################################
#F..L.........W............EE..#
################################
@end
```

| tile | meaning                | tile | meaning                                |
|------|------------------------|------|----------------------------------------|
| `#`  | brick                  | `~`  | water                                  |
| `=`  | one-way platform       | `*`  | lava                                   |
| `W`  | wood (Firey burns it)  | `^`  | spikes                                 |
| `I`  | ice (no grip)          | `T`  | trampoline, throws you six tiles        |
| `B`  | button                 | `G`  | gate, open while a button is held down |
| `K`  | key                    | `D`  | door, locked until every key is taken  |
| `o`  | cake                   | `E`  | exit                                   |
| `F`  | Firey spawn            | `L`  | Leafy spawn                            |
| `C`  | crate                  | `.`  | air                                    |

When you draw a new one, keep to the geometry the movement is tuned for: a jump
climbs **two rows** and clears a gap of about **three tiles**, a crate is worth
one extra row, and a trampoline is worth six. Then run `run-core-tests.sh`; it
parses and validates whatever is in the file. To look at why a level fails:

```sh
java -cp build/coretests dev.bfdia5b.Reach app/src/main/assets/levels.txt 7
```

which prints the level with every cell that character can reach marked `+`.

## Layout

```
app/src/main/java/com/raken/bfdia5b/
  core/   Level, LevelPack, World, Player, Crate, Body, Input, Tiles  (pure Java)
  ui/     MainActivity, GameView, Renderer, Art, Controls, Save, Sfx  (Android)
app/src/main/assets/levels.txt      the campaign
tools/                              test harness, stubs, icon generator
art/icon-512.png                    source artwork for the launcher icon
```

Regenerate the launcher icons from the artwork with `./tools/make-icons.sh`.
