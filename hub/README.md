# gmfy Hub

A game hub in the spirit of Roblox and Fortnite's lobby: one account, one wallet of **Gems**, a
catalogue of multiplayer games, a studio where anyone can build and publish their own game, and
**game passes** that creators sell for Gems. Ships for **Windows, macOS, Android**, Linux and the
browser from a single codebase.

| Platform | Package | Built by |
|---|---|---|
| Windows 10/11 x64 | `gmfy-hub-<v>-win-x64.exe` (installer) and portable `.exe` | `desktop/` via electron-builder |
| macOS (Apple Silicon + Intel) | `gmfy-hub-<v>-mac-<arch>.dmg` / `.zip` | `desktop/` via electron-builder |
| Android 8.0+ | `gmfy-hub-android-debug.apk` (installable) / release-unsigned | `android/` via Gradle |
| Linux x64 | `.AppImage` | `desktop/` |
| Browser | served by the hub server at `/` | `client/` |

All of them are the same web client (`client/`) inside a native shell. The desktop app additionally
embeds the server, so any Windows or Mac user can **host a hub for their friends** from Settings.

## What it does

* **Real multiplayer.** An authoritative Node server simulates every room at 20 Hz over WebSockets:
  movement, wall collisions, gem pickups, tagging and zone control all happen server-side, and clients
  render interpolated state. Matchmaking fills public servers up to each game's player cap; private
  servers come with a 6-character invite code; friends can join each other's public games.
* **Three game modes.** Gem Rush (collect the most gems), Tag (score while you are free, tag to pass
  "it") and King of the Hill (hold the zone). Three official games ship with the hub.
* **Custom games.** The Create studio has a drag-to-paint tile map editor, mode selection, arena
  size, round length, player cap, speed and gem-rate tuning, colours, a draft/publish toggle and a
  one-click private test server. Every published game appears in Discover with live player counts.
* **Gems economy.** Welcome bonus, daily bonus, round rewards (winner, participation), a full
  ledger, top-earners leaderboard and gem packs. Gem packs go through a payment adapter; the bundled
  one is a **sandbox** that grants instantly (clearly labelled in the shop). Plug in Stripe, Google
  Play Billing or StoreKit by replacing `SandboxPayments` in `server/lib/economy.js`.
* **Game passes.** Creators attach up to six passes to a game, each granting a permanent in-game
  perk: speed boost, gem magnet, double score or VIP glow. Buyers pay Gems once; **70 % goes to the
  creator**, 30 % to the platform ledger. Perks apply immediately, even mid-round. Passes that have
  been sold cannot be deleted, only re-priced. Creators also earn 1 Gem per other player per round.
* **Avatar shop.** Colours, hats and trails, previewed live and visible to every other player.
* **Social.** Friend requests, presence (online / which game), join-a-friend, global chat and
  per-room chat. Sessions survive restarts; passwords are PBKDF2-hashed.
* **Mobile-first controls.** Virtual joystick on touch screens, WASD/arrows or hold-mouse-to-move on
  desktop, Android back button mapped to in-app navigation, safe-area aware layout.

## Run it

The server has **zero dependencies**: Node 18+ is all you need.

```sh
cd hub
npm start                 # http://localhost:8787  (data in server/data/hub.json)
PORT=9000 HUB_DATA=/srv/hub.json npm start
docker build -t gmfy-hub . && docker run -p 8787:8787 -v hubdata:/data gmfy-hub
```

Open the printed URL in a browser, or point a desktop/Android app at `ws://<host>:8787/ws` from the
sign-in screen's *Server* field. Put the server behind TLS (`wss://`) before exposing it to the internet.

## Build the apps

Native builds run in CI (`.github/workflows/hub.yml`) on every push touching `hub/`, producing
downloadable artifacts, and a **GitHub Release** when a `hub-v*` tag is pushed. Locally:

```sh
# Windows / macOS / Linux (needs npm access; run on the target OS)
cd hub/desktop && npm install && npm run dist        # → desktop/dist/

# Android (needs JDK 17 + Android SDK 34)
cd hub && node scripts/sync-client.js && cd android && gradle assembleDebug
#                                              → app/build/outputs/apk/debug/app-debug.apk
```

Desktop builds are unsigned; add code-signing certificates as CI secrets to sign them. The Android
release APK is unsigned too; the debug APK is signed with the debug key and installs directly.

## Tests

```sh
npm test            # unit + browser end-to-end
npm run test:unit   # node:test — protocol, auth, economy, passes, validation, rooms, simulation
npm run test:e2e    # drives the real client in headless Chrome with a second WebSocket player
```

The end-to-end run registers through the UI, claims the daily bonus, buys a pass, joins a room
where a bot joins by invite code, moves both players, verifies the canvas renders and chat arrives,
builds and publishes a custom game with a pass, has the bot buy it and checks the creator's payout
lands live, buys a hat, exchanges a friend request and resumes the session after a reload.

## Layout

```
hub/
  server/           zero-dependency Node server (HTTP static + WebSocket)
    index.js        entry point / embeddable start()
    lib/ws.js       RFC 6455 WebSocket server and client
    lib/hub.js      message router, presence, chat, social
    lib/rooms.js    matchmaking, rooms, 20 Hz authoritative simulation, round rewards
    lib/economy.js  Gems, shop, gem packs (payment adapter), game passes, creator payouts
    lib/games.js    catalogue, custom-game validation, likes
    lib/auth.js     accounts, PBKDF2 passwords, sessions
    lib/catalog.js  shop items, gem packs, perks, modes, official games
    test/           node:test suite
  client/           the web app (vanilla JS, no build step)
  desktop/          Electron shell; can host a server; electron-builder config for win/mac/linux
  android/          Gradle project: full-screen WebView with a JS bridge
  scripts/          sync-client (copies client/server into the shells), make-icons, e2e
```

## Protocol

JSON over WebSocket. Requests carry `t` (type) and `rid`; replies are `{t:'res', rid, ok, data|error}`.
Server pushes: `hello`, `state` (20 Hz room state), `room.roster`, `round.end`, `chat`, `user`
(wallet/avatar changed), `social`. See the `on(...)` table at the bottom of `server/lib/hub.js`.
