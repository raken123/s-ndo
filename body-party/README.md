# Body Party 🎉

A camera party game where **your body is the controller**. Up to **6 players** at once.
The game shows your real body with the background removed, not a cartoon character.

> 📺 **Having a party?** Connect the computer to a TV and put the camera under or on top of it. Stand 2–3 m back.

## Play

Open `body-party/index.html` over **https** or **localhost** (browsers only allow the camera there):

- GitHub Pages: `https://<user>.github.io/s-ndo/body-party/`
- Locally: `python3 -m http.server` in the repo, then open `http://localhost:8000/body-party/`

Chrome or Edge works best. No camera? Click **"Try it with the mouse"** (mouse = hand, Space = jump, ↓ = squat).

## Controls (no keyboard or mouse needed)

| Gesture | What it does |
|---|---|
| 👋 Swipe your arm left/right | Switch games |
| 🙌 Raise both hands and hold | Start the selected game / play again / start recording |
| ✋ Hover your hand over a button | Press it |
| 🙅 Cross your arms and hold | Quit the game / go back / stop recording |
| 🐸 Frog-jump 5× (squat, then jump) | Open **Settings** |

## Games

- 🚗 **Catch the Car**: grab toy cars with your hands (gold = +3, police = −2)
- 🔴 **Intensive Dots**: touch shrinking dots with any body part
- 🎪 **Circus Jumping**: jump over the balls and duck under the flaming hoops (3 lives)
- 🎈 **Balloon Pop**: pop balloons and avoid the skull balloons
- 🍉 **Fruit Chop**: swing your arms fast to chop fruit, but not the bombs
- ☄️ **Meteor Dodge**: dodge falling meteors; the last one standing wins
- ⚽ **Keepy Uppy**: keep the balls in the air with your head, hands, knees and feet
- 🎬 **Nonsense Cam**: record yourselves with silly effects (party hats, googly eyes, sparkles, rainbow, clones, big heads, flip), then save the video

## Settings

Difficulty, round length, max players (1–6), background removal, body glow, mirror, skeleton,
jump sensitivity, hover-to-press time, tracking quality (fast/accurate), music, volume, switch camera.

**Submit your own game:** type your idea with the **hand keyboard** (hover a key to press it).
It is sent to **jomni556@gmail.com** through [FormSubmit](https://formsubmit.co). The very first
submission sends an activation email to that address, and someone has to click the link in it once.
If sending fails, the player's email app opens with the message already filled in.

## 📱 Use the TV and a phone at the same time

Choose **📱 Phone** in the menu (or in Settings, or on the Submit screen). The TV then shows a QR code and a 5-letter code.
Scan the QR code with the phone camera, or tap **"Use this phone as a remote"** on the start screen and type the code.
From the phone you can:
- switch games, play, go back, and open Settings or the Store
- **type with the phone's own keyboard** when you submit a game. While a phone is connected, the big hand keyboard on the TV is hidden.

Several phones can connect at once. The link is a direct WebRTC connection, set up through the free [PeerJS](https://peerjs.com) server.
Inside the Android app, the QR code points to the GitHub Pages copy of the game (`PUBLIC_URL` in `index.html`), so the page must be published there. Typing the code works either way.

## 💳 Paid features (Android app, Google Play Billing)

| Product ID | Type | What it unlocks |
|---|---|---|
| `party_pack` | One-time in-app product | 🍉 Fruit Chop, ☄️ Meteor Dodge, ⚽ Keepy Uppy, forever |
| `plus_monthly` | Subscription (monthly base plan) | Everything in the Party Pack, Nonsense Cam Pro (60-second videos, no watermark, all 8 effects), 💀 Insane difficulty |

Free version: Catch the Car, Intensive Dots, Circus Jumping, Balloon Pop and Nonsense Cam (15-second videos with a watermark and 4 effects).
You set the prices in the Play Console, and the game shows them automatically. On the website, the Store explains that purchases are made in the Android app.

## 🤖 Android app (APK + AAB)

The `android/` folder is a small Kotlin app that runs this same `index.html` in a full-screen WebView. It works on phones, tablets and **Android TV**
(TVs need a USB camera).

Every push runs **Actions → "Android build (APK + AAB)"**, and the finished build appears under *Artifacts*:
- `BodyParty-1.0.N.apk`: install it directly on a phone or TV to test.
- `BodyParty-1.0.N.aab`: upload this one to Google Play.

**Before publishing to Google Play:**
1. Create an upload key once: `keytool -genkeypair -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Add these repository secrets: `ANDROID_KEYSTORE_BASE64` (`base64 -w0 upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
   Without them, CI signs every build with a new throwaway test key. That is fine for testing, but it can't be used for Play Store updates.
3. The package name is `com.bodyparty.app`. You can change `applicationId` in `android/app/build.gradle.kts` if you like, but do it before the first upload.
4. In the Play Console, create the in-app product `party_pack` and the subscription `plus_monthly` (with a monthly base plan), then set the prices.
   Purchases only work in builds installed from Google Play, for example through the internal testing track.
5. Purchases are checked on the device. For stronger protection against cheating, add server-side verification later with the Google Play Developer API.

## Tech

One HTML file with no build step. Body tracking uses [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker)
(PoseLandmarker with up to 6 poses, plus the selfie segmenter for background removal), loaded from a CDN.
Graphics are drawn on a canvas, and sound and music are made with the Web Audio API.
