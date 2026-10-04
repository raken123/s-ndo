# Hub AI marketing

## `HubAI-ad-Minnie-and-Max.mp4`

A 30-second vertical ad (1080×1920, H.264 + AAC, 30 fps) for Instagram
Reels, TikTok and YouTube Shorts. Two cat-bananas talk: **Minnie** knows
Hub AI, **Max** has never heard of it. Their voices are synthesized babble
under big captions, so it works with or without sound. The phone shows real
screenshots of the app.

Captions sit in the upper-middle of the frame and the cats in the lower
middle, clear of the platforms' top bar, bottom caption area and right-hand
buttons.

### Re-render it

Needs Python 3, Node.js with Playwright, and ffmpeg.

```sh
cd hub-ai/marketing/ad
python3 make_audio.py      # script, music, voices, sound effects -> build/audio.wav, build/timeline.json
node screens.js            # app screenshots (serve app/src/main/assets/www on :8765, run a test cloud on :8799)
node render.js             # 900 frames -> build/hub-ai-ad.mp4
node render.js --still=9.2,17.6   # just a few frames, to check a change
```

Edit the dialogue in `make_audio.py` (`LINES`) and the animation in
`ad.html` (`render(t)` draws any moment `t`). Open `ad.html?play` in a
browser and click to preview with sound.
