# Hub AI marketing

Twelve vertical ads (1080×1920, H.264 + AAC, 30 fps) for Instagram Reels,
TikTok and YouTube Shorts, starring two cat-bananas: **Minnie**, who knows
Hub AI, and **Max**, who doesn't (yet). The phone in each ad shows real
screenshots of the app.

| File | Length | Story |
|---|---|---|
| `HubAI-ad-Minnie-and-Max.mp4` | 30 s | Bored Max can't code; Minnie shows him Hub AI, the features, FunHub and a secret model. |
| `HubAI-ad-Detention.mp4` | 45 s | In programming class the furious teacher, Mr. Crunch, can't build an app himself. Max blanks on the name ("Hubba Bubba?"), gets 12 hours of detention and ten cartoon bonks with a spiky projector remote. Next lesson Minnie sits next to him and explains Hub AI; Max builds a Detention Countdown, and the teacher ends up wanting Hub AI too. |

**The update** (19–25 s each): five Max & Minnie ads about the new Hub V1
agents and everything you can make now. They are also the first thing the
app shows after updating (compressed copies in
`app/src/main/assets/www/media/whatsnew/`). They never name the model
provider, on screen or out loud.

| File | Length | Story | End line |
|---|---|---|---|
| `HubAI-ad-Update-Agents.mp4` | 25 s | An arena announcer presents the new agents card by card: Spark, Flux, Volt, Prism, Titan, then Pixel for pictures. Minnie explains who's fast, who's smart and who's the genius. | Meet the new Hub V1 agents. |
| `HubAI-ad-Update-Animations.mp4` | 19 s | Lights, camera, banana: Max can't draw a cartoon fast enough. Minnie asks Hub AI for an animation, it plays on the big screen, and one tap exports it as a video (9:16, 1:1, 16:9). | Animations in seconds. Export as video. |
| `HubAI-ad-Update-Slides-and-Cards.mp4` | 21 s | Max's pitch is in five minutes and he has zero slides. Minnie makes a 10-slide deck with charts (full screen or PDF), then a thank-you card for the team. | Slides and cards, ready before the meeting. |
| `HubAI-ad-Update-3D-and-UI.mp4` | 20 s | Max's cardboard rocket collapses. Minnie asks for a 3D model: a spinning hologram you can zoom and download (GLB/OBJ, games, 3D printing). Then UI Design makes the rocket app's screens. | From idea to 3D, and the screens too. |
| `HubAI-ad-Update-Photo-Edits.mp4` | 21 s | Max's photo-booth selfie has a banana peel on his head. Minnie edits it away and adds a sunset, then shows the rest: games, websites, logos, diagrams, documents. "Thirteen things to make. Twenty pro tools. One Hub AI." | Apps, animations, slides, 3D, photos and more. |

And the earlier Max & Minnie series (19–23 s each):

| File | Length | Story | End line |
|---|---|---|---|
| `HubAI-ad-Kitchen.mp4` | 21 s | *Banana Kitchen*: Max tries to bake an app with flour, eggs and a laptop (it's crunchy). Minnie asks Hub AI for a pizza timer and it comes out of the oven. | Fresh apps, baked in seconds. |
| `HubAI-ad-Space.mp4` | 23 s | Liftoff to the Banana Moon. Max codes the landing countdown and sets off every alarm ("Houston, we have a problem"); Minnie asks Hub AI and they touch down. | Apps that are out of this world. |
| `HubAI-ad-Magic.mp4` | 19 s | The Great Maxini promises to make an app appear and gets a banana peel. Minnie asks Hub AI for a card trick app: ta-da, applause. | It's not magic. It's Hub AI. |
| `HubAI-ad-Birthday.mp4` | 19 s | Max realises it's Minnie's birthday: no cake, no card, no gift, doomed. He asks Hub AI for a birthday card app just before the doorbell rings. "Best gift ever!" | Forgot a gift? Make one. |
| `HubAI-ad-Rap-Battle.mp4` | 23 s | The Banana Rap Battle. Max raps, Minnie raps back, Max says "prove it", and Minnie starts a Hub Battle: two agents, one app. Everybody wins. Mic drop. | Two agents enter. One app wins. |

The voices are real speech from Kokoro, an open text-to-speech model, run
offline: Minnie is `af_bella`, Max is `am_michael`, Mr. Crunch is
`bm_lewis` and the episodes' announcer is `bm_george`, each pitched for the
character. The mouths move with the
loudness of each voice, frame by frame. Every line was checked with an
offline speech recognizer (Whisper tiny) against the script.

The bonks are slapstick: a cartoon dust cloud with "BONK!" and a counter,
then dizzy stars and a bandage. Some ad platforms review violence, even
cartoon violence, more strictly, so check the platform's ad policy before
paying to promote the Detention ad.

## Re-render

Needs Python 3, Node.js with Playwright, ffmpeg, and the offline TTS (about
570 MB):

```sh
mkdir -p hub-ai/marketing/ad/tts && cd hub-ai/marketing/ad/tts
curl -L https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.12.0/sherpa-onnx-v1.12.0-linux-x64-static.tar.bz2 | tar xj
curl -L https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2 | tar xj
cd ..
# (or set HUBAI_TTS_DIR to wherever those two folders are)

python3 make_audio.py            # ad 1: build/audio.wav + build/timeline.json
python3 make_audio_school.py     # ad 2: build/school/...
node screens.js                  # app screenshots (serve app/src/main/assets/www on :8765, run a test cloud on :8799)
node render.js                                          # ad 1 -> build/hub-ai-ad.mp4
node render.js --page=school.html --build=build/school  # ad 2 -> build/school/hub-ai-ad.mp4
node render.js --still=9.2,17.6                         # just a few frames, to check a change

# the five episodes
python3 episodes.py all          # build/ep/<name>/audio.wav + timeline.json (all ten episodes)
python3 check_voices.py build/ep/*   # optional: Whisper tiny listens to every line
node screens_eps.js              # their phone screens (serve the app on :8765)
node screens_v2.js               # the update ads' screens (app on :8765, a fake-model cloud on :8799)
for e in kitchen space magic birthday rap agents studio pitch lab photo; do node render.js --page=ep-$e.html --build=build/ep/$e; done
```

- `lib_audio.py`: voices (TTS + pitch), music, sound effects, mixing and lip sync.
- `cats.js`: Minnie, Max and Mr. Crunch, drawn in SVG.
- `stage.js`: what the episodes share: phone, captions, confetti, emoji
  rain, comic stamps, smoke puffs, costumes (chef hats, space helmets, top
  hat, party hats, cap and shades) and the end card.
- `photo-booth.html`: Max's selfie (before and after) that the photo-edit ad edits.
- `ep-<name>.html`: one page per episode. `episodes.py` holds every
  episode's script, its named marks and its sound effects; the page's
  `render(t)` follows those marks.
- `ad.html` / `school.html`: each ad's animation; `render(t)` draws any
  moment `t`. Open either with `?play` in a browser and click to preview
  with sound.
- Edit the dialogue in `make_audio.py` (`LINES`) or `make_audio_school.py`
  (`SCRIPT`). Ad 2 lays its lines out from their spoken length and the
  animation follows the marks, so changing a line keeps everything in sync.
