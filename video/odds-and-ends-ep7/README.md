# Odds & Ends — Episode 7: "The Motorway"

Plate lost the vote and was appalled to find the drawer unsorted. The last
three are taken outside to the hard shoulder, where a traffic cone finally gets
to be right about something.

| | |
|---|---|
| File | `odds_and_ends_ep07_the_motorway.mp4` |
| Duration | `00:05:00.00` exactly |
| Video | H.264 High, 1280x720, 24 fps, ~420 kb/s |
| Audio | AAC-LC, 44.1 kHz stereo, 160 kb/s |
| Size | 21,922,426 bytes (20.9 MiB) |
| Source | [`../../objectshow/ep07.py`](../../objectshow/ep07.py) |

## Running order

| Start | Scene | |
|---|---|---|
| 0:00 | Previously on | three clips of episode 6 |
| 0:16 | Title | |
| 0:25 | The vote | Mugsy 14, Cone 20, Plate 37 — "The DRAWER? Is it sorted?" |
| 1:18 | Hard shoulder | four lanes, no pavement, and Spork still holding a piece of shelf |
| 2:08 | The crossing | traffic, a slipstream, a hedge, and one object nobody will hit |
| 3:33 | Results | one crossed, one crossed behind him, one is in a hedge |
| 4:12 | Elimination | Mugsy and Spork — you may vote from a hedge |
| 4:37 | Outro | it is bin day |

Cone wins immunity. It is his season's payoff: he lost the rulebook in episode
2, warped in the dishwasher in episode 5, cracked in the fridge in episode 6,
and out here traffic simply goes around him. *"For six episodes I have been a
joke with a rulebook. Out here, I am infrastructure."* Mugsy crosses four lanes
of motorway by hiding behind him the whole way.

## Standings

| | Character | |
|---|---|---|
| 🚧 | **Cone** | immune — infrastructure |
| ☕ | **Mugsy** | up for elimination — hid behind a cone for six minutes |
| 🥄 | **Spork** | up for elimination — in a hedge |
| 🍽️ | **Plate** | eliminated, episode 7 — in the drawer, which is not sorted |
| 🧤 | **Mitt** | eliminated, episode 6 |
| 📎 | **Clip** | eliminated, episode 5 |
| 🗒️ | **Sticky** | eliminated, episode 4 |
| 🧊 | **Cube** | eliminated, episode 3 |
| 🔋 | **Volt** | eliminated, episode 1 |
| 🗑️ | **Bin** | returning, episode 8 |
| 📣 | **Mega** | host |

## The traffic

Vehicles are a deterministic timetable — forty-six passes seeded from the
episode, three lanes deep, with the near lane drawn *after* the cast so lorries
sweep across the front of frame. The near lane also asks
`swerve_dip()` where Cone is standing, and goes around him. Nobody hits a cone.

## Rebuilding

```sh
pip install pycairo numpy imageio-ffmpeg
cd objectshow
python3 render.py ep07 ../video/odds-and-ends-ep7/odds_and_ends_ep07_the_motorway.mp4
```

See [`../../objectshow/README.md`](../../objectshow/README.md) for how the
generator fits together.

## Next

[Episode 8: "Bin Day"](../odds-and-ends-ep8) — the series finale. Spork lost
the vote, and the bin is on wheels.
