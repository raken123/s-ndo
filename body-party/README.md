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

## Tech

One HTML file with no build step. Body tracking uses [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker)
(PoseLandmarker with up to 6 poses, plus the selfie segmenter for background removal), loaded from a CDN.
Graphics are drawn on a canvas, and sound and music are made with the Web Audio API.
