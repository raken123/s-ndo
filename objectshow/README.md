# Odds & Ends — the generator

An object show, generated from source. Every frame is vector-drawn on a cairo
context and piped raw into ffmpeg; every sample of the soundtrack is built from
numpy oscillators. There is not one image, video or audio asset in this
repository.

Episodes live in [`../video`](../video):

| | | |
|---|---|---|
| `ep01` | [Stack Overflow](../video/odds-and-ends-ep1) | stack yourselves as high as you can |
| `ep02` | [The Junk Drawer](../video/odds-and-ends-ep2) | go into the drawer, bring back one useful thing |
| `ep03` | [Sock Puppet](../video/odds-and-ends-ep3) | wear the sock, do an impression, be judged by the eliminated |

## Building

```sh
pip install pycairo numpy imageio-ffmpeg
cd objectshow
python3 render.py ep02 ../video/odds-and-ends-ep2/odds_and_ends_ep02_the_junk_drawer.mp4
```

About 90-130 seconds per five-minute episode on a modern core. Renders are
reproducible: the same source always produces the same frames and the same
audio, on any machine and in any process.

Useful while working:

```sh
python3 render.py ep02 --list                  # running order and total runtime
python3 render.py ep02 out.mp4 --from 115 --to 133   # one slice
python3 render.py ep02 --frame 162.0 still.png       # one still
python3 sheet.py ep02 sheet.png 4 22 40 84 130       # contact sheet
```

## Layout

| File | |
|---|---|
| `timeline.py` | beats and timing. Line durations derive from the text, so the timeline, voice track, mouth animation and subtitles cannot drift apart |
| `cues.py` | the cue sheet, read by both the soundtrack and the animation, so a crash on screen lands on the same frame as the crash in the speakers |
| `cast.py` | the seven characters: body shapes, faces, walk cycles, voices |
| `draw.py` | drawing and easing primitives |
| `stage.py` | backgrounds, props and on-screen graphics |
| `audio.py` | chiptune score, cartoon SFX, synthesised voices, ducking |
| `engine.py` | timing lookups, camera, the frame pipe into ffmpeg |
| `ep01.py`, `ep02.py` | one episode each: its script, and a draw function per scene |
| `render.py`, `sheet.py` | command line |

## Writing another episode

An episode module needs three things:

```python
BEATS = [dict(key="scene_name", beats=[
    S("Mega", "A spoken line.", "smug", act="intro"),   # duration from the text
    A(2.4, "intro"),                                    # a wordless beat
])]

def sc_scene_name(cr, show, sc, beat, T): ...           # draw one frame

EPISODE = Show("ep04", 'Episode 4: "..."', BEATS, 300.0,
               {"scene_name": sc_scene_name})
```

Then add its name to `EPISODES` in `render.py`. Scenes ask the show what is
happening now — `show.act_start(sc, "fling")`, `show.since("buzzer", T, 1.0)`,
`show.mouth(beat, T)` — rather than tracking state themselves, so any moment
can be drawn directly without rendering the frames before it. Passing a total
runtime to `Show` stretches the final beat so the episode lands on it exactly.

Dialogue is subtitled. Voices are pitched blip-speech — one blip per syllable,
a distinct timbre per character — rather than recorded speech.
