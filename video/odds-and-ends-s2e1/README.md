# Odds & Ends — Series 2, Episode 1: "The Garage"

The kitchen is being renovated. The drawer has become a box, the box is in the
garage, and the garage has objects of its own. Twelve minutes — the first
long-form episode.

| | |
|---|---|
| File | `odds_and_ends_s2e01_the_garage.mp4` |
| Duration | `00:12:00.00` exactly |
| Video | H.264 High, 1280x720, 24 fps, CRF 28 with x264's animation tune |
| Audio | AAC-LC, 44.1 kHz **mono**, 80 kb/s |
| Size | 27,746,141 bytes (26.5 MiB) |
| Source | [`../../objectshow/s2e01.py`](../../objectshow/s2e01.py) |

## New contestants

| | Character | Deal |
|---|---|---|
| 🔧 | **Spanner** | fixes things. Not a wrench. There is an ocean of difference, and he will end you. |
| 💡 | **Bulb** | has ideas, all of them bad. Flickers while having them; goes out entirely if he has two. |
| 🎾 | **Fuzz** | a tennis ball. Under the car for three years. Bounces for safety. Cannot stop. |
| 🎨 | **Gloss** | a tin of magnolia. They called the hallway "a bit beige". He is WARM CREAM. |
| 🔌 | **Reel** | an extension lead. Twelve metres. Half unwound since 2019. Tangled, which is different from hard. |

## Returning

Mugsy (reigning champion, retired, contract found under the chair seat), Cone
(now says "infrastructure" about everything), Volt (seven episodes in a drawer,
delighted to be back, immediately losing again), Sticky, and Clip, who has
notes. Cube, Mitt, Plate and Spork stay in the box, being miscellaneous.

## Running order

| Start | Scene | |
|---|---|---|
| 0:00 | Previously, on series one | eight clips, one per episode |
| 0:24 | The box | KITCHEN MISC, 6:40 AM, and a chair with a contract under it |
| 1:25 | Title | series two |
| 1:34 | Meet the garage | five objects with opinions |
| 3:24 | The returnees | five back from the box, one against his will, one against everyone's |
| 4:35 | Teams | Sharp Objects and Soft Objects. Bulb is not sharp. Gloss is not soft. |
| 5:51 | The shelf | first team to put one member on the top shelf, where the good screws are |
| 9:32 | Results | the shelf, and the floor from a height |
| 10:27 | Elimination | Sharp Objects: Spanner, Cone, Volt, Clip, Bulb |
| 11:43 | Outro | the lawnmower |

## How the shelf goes

Sharp Objects have a ladder, a base (Cone, structurally), and Clip climbing it
with commitment, which is to say clipped to it. Soft Objects have Fuzz, who
bounces past the shelf and off the ceiling; Gloss, who is knocked over and
becomes the floor; Reel, who is unwound and thrown over the shelf as a rope;
and Mugsy, who climbs a cable he has no business climbing, with Sticky attached.
Bulb has a second idea and the lights go out.

Clip reaches the shelf and is ruled adjacent to it. Cone lets go of the ladder
to object to the ruling. The ladder falls. Fuzz comes down from the ceiling
onto Mugsy, who arrives on the shelf with six inches to spare and no idea how.
**Soft Objects win.** Sharp Objects are up.

## Standings after episode 1

| Team | | |
|---|---|---|
| Soft Objects | Mugsy, Sticky, Fuzz, Gloss, Reel | safe |
| Sharp Objects | Spanner, Cone, Volt, Clip, Bulb | up for elimination |
| The box | Cube, Mitt, Plate, Spork | miscellaneous |

## Rebuilding

```sh
pip install pycairo numpy imageio-ffmpeg
cd objectshow
python3 render.py s2e01 ../video/odds-and-ends-s2e1/odds_and_ends_s2e01_the_garage.mp4 --crf 28
```

About four minutes. Long-form episodes are rendered at CRF 28; the art is flat
vector and does not visibly mind.

The soundtrack is now written mono. Every voice, cue and note in the mix is
centred, so the old stereo track was two identical channels — at twelve minutes
that was 14 MiB of duplicate audio, more than half the file. Mono at 80 kb/s
brings this episode from 33.0 MiB to 26.5 MiB with nothing audible lost.

See [`../../objectshow/README.md`](../../objectshow/README.md) for how the
generator fits together.

## Next

[Series 2, Episode 2: "The Host"](../odds-and-ends-s2e2) — it is not going to
be the lawnmower. The network has notes.
