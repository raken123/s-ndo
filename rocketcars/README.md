# Rocket Cars

Car football for Android, built with Cordova + three.js. Rocket-League-style: drive,
boost, jump, double jump, flip and fly a car around an arena and knock a giant ball
into the other team's net.

**Ready-to-install APK:** [`dist/RocketCars-1.0.0.apk`](dist/RocketCars-1.0.0.apk) (2.9 MB)

## Mechanics

| Mechanic | How it works |
| --- | --- |
| **Driving** | Arcade car physics with speed-sensitive steering, lateral grip and a powerslide that cuts grip while you drift. |
| **Boost** | Burns 30/s from a 100 meter, thrusts along the car's nose. Yellow pads give +12, big orange rings give a full 100; they respawn after 4 s / 10 s. |
| **Jump** | Impulse along the car's *up* axis, so you jump off walls sideways. Holding the button for the first 0.2 s adds thrust for a higher jump. |
| **Double jump** | Tap JUMP again in the air with the stick centred — a second vertical impulse. |
| **Flip / dodge** | Tap JUMP again while holding a direction. Gives a velocity impulse in that direction plus a full 360° rotation about the matching axis. Pull the stick the opposite way mid-flip to cancel the rotation. |
| **Front flick** | A forward flip while the ball rests on the car. The contact-point velocity (ω × r) from the flip rotation launches the ball — measured at **60 m/s vs 14 m/s** for the same touch without flipping. |
| **Flying** | Jump, aim the nose with the stick (pitch/yaw), then hold BOOST. Angular velocity is integrated properly, so you can aerial to the ceiling. |
| **Air roll** | Hold DRIFT in the air and the stick rolls the car about its nose axis instead of yawing. |
| **Wall & ceiling driving** | Carry >13 m/s into a wall and the car rolls onto it, keeping its speed, and drives up and across the ceiling. Slow down and gravity peels you off. |
| **Ball** | Bouncy, spins visibly, capped at 92 m/s, contained by the arena including rounded corners and the goal mouths. |

## Controls (touch, landscape)

- **Left half of the screen** — floating stick. Left/right steers on the ground, and pitches/yaws in the air.
- **GAS / BRAKE** — throttle and reverse.
- **JUMP** — jump, double jump, flip.
- **BOOST** — burn boost.
- **DRIFT/ROLL** — powerslide on the ground, air-roll in the air.
- **BALL CAM** toggles between looking at the ball and looking where you drive.

Keyboard (for desktop testing): `W`/`S` throttle, `A`/`D` steer, `↑`/`↓` pitch,
`Space` jump, `Shift` boost, `Q`/`E` drift & air roll.

Air pitch defaults to inverted (stick up = nose down, as in Rocket League); there is
a toggle on the menu.

## Match

3 opponent difficulties (Rookie / Pro / All-Star), 2/3/5 minute matches, kickoff
countdowns, goal explosions and sudden-death overtime on a draw.

## Layout

```
www/
  index.html        HUD, menus, overlays
  css/style.css     responsive layout (landscape + portrait)
  js/config.js      every tunable constant
  js/arena.js       scene, arena, car & ball meshes, boost pads, effects
  js/physics.js     collision planes, car physics, ball physics, impulses
  js/input.js       multi-touch stick + buttons, keyboard
  js/ai.js          opponent bot
  js/game.js        loop, camera, match flow, HUD, audio
tools/make-icon.js  renders the app icon and every Android density from scratch
```

Physics runs on a fixed 120 Hz substep, decoupled from the render rate, and the
renderer drops its pixel ratio automatically if frames get expensive.

## Building

Requires Node, JDK 21 and the Android SDK (platform 36, build-tools 36).

```bash
npm install -g cordova
cd rocketcars
cordova platform add android
cordova build android --debug          # installable debug APK
```

Release build (use your own keystore):

```bash
keytool -genkeypair -alias mykey -keyalg RSA -keysize 2048 -validity 10000 \
        -keystore my.keystore
cordova build android --release -- --packageType=apk \
        --keystore=my.keystore --alias=mykey \
        --storePassword=… --password=…
```

Regenerate the icons after editing `tools/make-icon.js`:

```bash
node tools/make-icon.js
```

## Installing

Copy the APK to an Android device and open it. You will need to allow
"install unknown apps" for whichever app you open it from. It is signed with a
self-signed key, so uninstall any earlier copy before installing a rebuild.
