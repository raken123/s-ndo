# Odds & Ends — Episode 4: "The Rulebook"

The night episode. Sticky lost the vote and went to the drawer delighted; the
kitchen light goes out; Cone reads rule seventeen aloud, which is the rule
about not reading the rules aloud. Something in the dark takes an interest.

Spooky, not horrible: the tension is dark rooms, a flickering light, a shadow
that turns out to be a whisk, and a silhouette with glowing eyes that turns out
to be a recycling bin with somewhere to be.

| | |
|---|---|
| File | `odds_and_ends_ep04_the_rulebook.mp4` |
| Duration | `00:05:00.00` exactly |
| Video | H.264 High, 1280x720, 24 fps, ~314 kb/s |
| Audio | AAC-LC, 44.1 kHz stereo, 160 kb/s |
| Size | 17,938,640 bytes (17.1 MiB) |
| Source | [`../../objectshow/ep04.py`](../../objectshow/ep04.py) |

## Running order

| Start | Scene | |
|---|---|---|
| 0:00 | Previously on | three clips of episode 3 |
| 0:16 | Title | |
| 0:25 | The vote | Cone 11, Mugsy 19, Sticky 44 — Sticky is thrilled, Volt is not |
| 1:15 | Nightfall | the light goes off, the host leaves, Cone reads all seventeen rules |
| 2:08 | The night watch | a creak, a whisk, a cupboard, and two eyes that open |
| 3:24 | The Bin | "I am here for the paper. It is recycling night." |
| 4:17 | Elimination | Cone and Clip face the drawer |
| 4:43 | Outro | next time |

Mugsy wins immunity by hiding in a cupboard for six hours, which is the first
time being frightened of everything has ever paid off for him. Cone loses the
menu he had been calling a rulebook since episode 2.

## Standings

| | Character | |
|---|---|---|
| ☕ | **Mugsy** | immune |
| 🚧 | **Cone** | up for elimination |
| 📎 | **Clip** | up for elimination |
| 🗒️ | **Sticky** | eliminated, episode 4 — in the drawer, stuck to Volt |
| 🧊 | **Cube** | eliminated, episode 3 — in the drawer |
| 🔋 | **Volt** | eliminated, episode 1 — in the drawer, unhappy about the company |
| 🗑️ | **Bin** | not a contestant. Passing through. |
| 📣 | **Mega** | host |

## How the dark was made

The night set lerps its whole palette toward daylight on one `light`
parameter, so the sunrise at the end is the same drawing with the number moved
from 0 to 1. Scares are built from three pieces in `engine.py` and `stage.py`:
`silhouette` re-draws any character as a flat shadow, `glow_eyes` draws eyes
and nothing else, and the cue sheet fires `creak`, `heartbeat`, `thunder` and
`rumble` — all synthesised in `audio.py` — with the screen flash on the same
frame as the thunder.

## Rebuilding

```sh
pip install pycairo numpy imageio-ffmpeg
cd objectshow
python3 render.py ep04 ../video/odds-and-ends-ep4/odds_and_ends_ep04_the_rulebook.mp4
```

See [`../../objectshow/README.md`](../../objectshow/README.md) for how the
generator fits together.

## Next

Episode 5: "The Dishwasher".
