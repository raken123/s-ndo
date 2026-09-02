# Odds & Ends — Episode 5: "The Dishwasher"

Clip lost the vote, which left two contestants, which is not a show. So three
new objects arrive — out of the dishwasher — and then everyone goes back into
it for a full cycle.

| | |
|---|---|
| File | `odds_and_ends_ep05_the_dishwasher.mp4` |
| Duration | `00:05:00.00` exactly |
| Video | H.264 High, 1280x720, 24 fps, ~763 kb/s |
| Audio | AAC-LC, 44.1 kHz stereo, 160 kb/s |
| Size | 34,818,348 bytes (33.2 MiB) |
| Source | [`../../objectshow/ep05.py`](../../objectshow/ep05.py) |

## New contestants

| | Character | Deal |
|---|---|---|
| 🥄 | **Spork** | a fork and a spoon, at the same time. Falls through every rack there has ever been. |
| 🧤 | **Mitt** | has held worse than you. Warm, soft, alarmingly calm. |
| 🍽️ | **Plate** | immaculate, and aware of it. Dishwasher safe — top rack — and it is written on the back of them. |

## Running order

| Start | Scene | |
|---|---|---|
| 0:00 | Previously on | three clips of episode 4 |
| 0:17 | Title | |
| 0:25 | The vote | Cone 24, Clip 31 — the drawer is now standing room only |
| 1:12 | Arrivals | two contestants is not a show, so the host has hired three |
| 2:10 | The cycle | one full wash: spray, rising water, and a warping cone |
| 3:28 | Inspection | spotless, waterlogged, at the bottom, warped, immaculate |
| 4:14 | Elimination | everyone except Plate |
| 4:39 | Outro | next time |

Plate wins immunity by being designed for the challenge. Spork falls through
the rack within thirty seconds of his first appearance and delivers the rest of
his lines from the bottom of the machine. Cone comes out a slightly different
cone.

## Standings

| | Character | |
|---|---|---|
| 🍽️ | **Plate** | immune |
| ☕ | **Mugsy** | up for elimination — spotless, which is not immune |
| 🚧 | **Cone** | up for elimination — not dishwasher safe |
| 🥄 | **Spork** | up for elimination, on his first day |
| 🧤 | **Mitt** | up for elimination — will dry by Thursday |
| 📎 | **Clip** | eliminated, episode 5 — in the drawer, has notes |
| 🗒️ | **Sticky** | eliminated, episode 4 — in the drawer |
| 🧊 | **Cube** | eliminated, episode 3 — in the drawer, being squeezed |
| 🔋 | **Volt** | eliminated, episode 1 — in the drawer, and it is FULL |
| 📣 | **Mega** | host |

## Rebuilding

```sh
pip install pycairo numpy imageio-ffmpeg
cd objectshow
python3 render.py ep05 ../video/odds-and-ends-ep5/odds_and_ends_ep05_the_dishwasher.mp4
```

See [`../../objectshow/README.md`](../../objectshow/README.md) for how the
generator fits together.

## Next

Episode 6: "The Fridge" — and Cube has been asking for somewhere cold since
episode 2.
