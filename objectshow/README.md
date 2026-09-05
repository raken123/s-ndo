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
| `ep04` | [The Rulebook](../video/odds-and-ends-ep4) | the light goes out, and something wants the paper |
| `ep05` | [The Dishwasher](../video/odds-and-ends-ep5) | three new objects arrive, and everyone takes a wash cycle |
| `ep06` | [The Fridge](../video/odds-and-ends-ep6) | cold storage, a guest adjudicator, and a shelf nobody should have touched |
| `ep07` | [The Motorway](../video/odds-and-ends-ep7) | four lanes, no pavement, and a cone in his element |
| `ep08` | [Bin Day](../video/odds-and-ends-ep8) | series finale: recycling only, and the chair from episode 1 |

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
python3 render.py ep05 out.mp4 --crf 23              # smaller file
python3 render.py ep02 --frame 162.0 still.png       # one still
python3 sheet.py ep02 sheet.png 4 22 40 84 130       # contact sheet
```

## Cast

Everyone lives in `cast.py`; a character is a body-drawing function plus a
voice. Eliminated contestants stay in the show — they move into the drawer and
keep talking.

| | | | |
|---|---|---|---|
| 📣 | **Mega** | host | — |
| ☕ | **Mugsy** | a mug, 60% anxiety | ep1–8, winner |
| 📎 | **Clip** | holds things together, loudly | ep1–5 |
| 🚧 | **Cone** | reads the rules. all of them. | ep1–8, runner-up |
| 🗒️ | **Sticky** | remembers nothing, sticks to everything | ep1–4 |
| 🔋 | **Volt** | 9 volts of unearned confidence | ep1 |
| 🧊 | **Cube** | cool under pressure. melting otherwise. | ep1–3 |
| 🗑️ | **Bin** | it is recycling night | ep4, ep8 |
| 🥄 | **Spork** | a fork and a spoon, at the same time | ep5–8 |
| 🧤 | **Mitt** | has held worse than you | ep5–6 |
| 🍽️ | **Plate** | immaculate, and aware of it | ep5–7 |

Adding one is a `Char` subclass with a `body()` method, a colour, a subtitle
tag and a `voice` dict; the walk cycle, blinking, expressions and mouth-sync
come from the base class.

## Expressions

Faces are built from an expression sheet in `cast.py`: an eye shape, an
optional brow or lash, and a resting mouth, with open mouths drawn red with a
white tooth strip and a tongue. `EXPRESSIONS` maps a name to that triple, so a
scene only ever says `expr="furious"`.

| | |
|---|---|
| eyes | `oval` `wide` `half` `slant` `arc_up` `arc_down` `x` `squint` `swirl` `star` |
| brows | `angry` `sad` `raised` `flat` `lash` |
| mouths | `grin` `flat` `frown` `wavy` `smirk` `angry` `gasp` |

Named expressions: `happy` `flat` `worried` `sad` `angry` `furious` `smug`
`shock` `gasp` `beam` `sly` `dizzy` `dead` `starry` `squint` `lashes`.

Talking is not a separate expression — `mouth` (0..1, driven by the voice
track) opens whichever mouth the expression implies, so an angry character
shouts with an angry mouth and a shocked one gasps.

```sh
python3 faces.py chart.png Cone     # the whole sheet, resting and talking
```

## Layout

| File | |
|---|---|
| `timeline.py` | beats and timing. Line durations derive from the text, so the timeline, voice track, mouth animation and subtitles cannot drift apart |
| `cues.py` | the cue sheet, read by both the soundtrack and the animation, so a crash on screen lands on the same frame as the crash in the speakers |
| `cast.py` | the characters: body shapes, faces, walk cycles, voices |
| `draw.py` | drawing and easing primitives |
| `stage.py` | backgrounds, props and on-screen graphics |
| `audio.py` | chiptune score, cartoon SFX, synthesised voices, ducking |
| `engine.py` | timing lookups, camera, the frame pipe into ffmpeg |
| `ep01.py`, `ep02.py` | one episode each: its script, and a draw function per scene |
| `render.py`, `sheet.py`, `faces.py` | command line |

## Writing another episode

An episode module needs three things:

```python
BEATS = [dict(key="scene_name", beats=[
    S("Mega", "A spoken line.", "smug", act="intro"),   # duration from the text
    A(2.4, "intro"),                                    # a wordless beat
])]

def sc_scene_name(cr, show, sc, beat, T): ...           # draw one frame

EPISODE = Show("ep09", 'Episode 9: "..."', BEATS, 300.0,
               {"scene_name": sc_scene_name})
```

Then add its name to `EPISODES` in `render.py`. Act names are global to the
cue sheet in `cues.py`, so give new ones distinct names — reusing another
episode's act name will fire that episode's sounds in yours (and yours in
theirs). Scenes ask the show what is
happening now — `show.act_start(sc, "fling")`, `show.since("buzzer", T, 1.0)`,
`show.mouth(beat, T)` — rather than tracking state themselves, so any moment
can be drawn directly without rendering the frames before it. Passing a total
runtime to `Show` stretches the final beat so the episode lands on it exactly.

Dialogue is subtitled. Voices are pitched blip-speech — one blip per syllable,
a distinct timbre per character — rather than recorded speech.
