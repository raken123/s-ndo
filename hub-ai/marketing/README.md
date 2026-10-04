# Hub AI marketing

Two vertical ads (1080×1920, H.264 + AAC, 30 fps) for Instagram Reels,
TikTok and YouTube Shorts, starring two cat-bananas: **Minnie**, who knows
Hub AI, and **Max**, who doesn't (yet). The phone in each ad shows real
screenshots of the app.

| File | Length | Story |
|---|---|---|
| `HubAI-ad-Minnie-and-Max.mp4` | 30 s | Bored Max can't code; Minnie shows him Hub AI, the features, FunHub and a secret model. |
| `HubAI-ad-Detention.mp4` | 45 s | In programming class the furious teacher, Mr. Crunch, can't build an app himself. Max blanks on the name ("Hubba Bubba?"), gets 12 hours of detention and ten cartoon bonks with a spiky projector remote. Next lesson Minnie sits next to him and explains Hub AI; Max builds a Detention Countdown, and the teacher ends up wanting Hub AI too. |

The voices are real speech from Kokoro, an open text-to-speech model, run
offline: Minnie is `af_bella`, Max is `am_michael` and Mr. Crunch is
`bm_lewis`, each pitched for the character. The mouths move with the
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
```

- `lib_audio.py`: voices (TTS + pitch), music, sound effects, mixing and lip sync.
- `cats.js`: Minnie, Max and Mr. Crunch, drawn in SVG.
- `ad.html` / `school.html`: each ad's animation; `render(t)` draws any
  moment `t`. Open either with `?play` in a browser and click to preview
  with sound.
- Edit the dialogue in `make_audio.py` (`LINES`) or `make_audio_school.py`
  (`SCRIPT`). Ad 2 lays its lines out from their spoken length and the
  animation follows the marks, so changing a line keeps everything in sync.
