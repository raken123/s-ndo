# Odds & Ends — Episode 2: "The Junk Drawer"

Volt lost the vote. The five survivors are sent into the drawer to salvage one
useful thing; one of them comes back with Volt.

| | |
|---|---|
| File | `odds_and_ends_ep02_the_junk_drawer.mp4` |
| Duration | `00:05:00.00` exactly |
| Video | H.264 High, 1280x720, 24 fps, ~511 kb/s |
| Audio | AAC-LC, 44.1 kHz stereo, 160 kb/s |
| Size | 25,410,834 bytes (24.2 MiB) |
| Source | [`../../objectshow/ep02.py`](../../objectshow/ep02.py) |

## Running order

| Start | Scene | |
|---|---|---|
| 0:00 | Previously on | three clips of episode 1, replayed through its own scene code |
| 0:18 | Title | |
| 0:26 | The vote | Cube 12, Clip 20, Volt 41 — and a drawer arrives |
| 1:23 | The challenge | Salvage: bring back one useful thing |
| 1:59 | Inside the drawer | it is dark, and something in there is already talking |
| 3:12 | Judging | a takeout menu, a teabag, a hostage, and some water |
| 4:09 | Elimination | Cone, Mugsy, Clip and Cube face the drawer |
| 4:38 | Outro | next time |

## Standings

| | Character | |
|---|---|---|
| 🗒️ | **Sticky** | immune — retrieved an eliminated contestant |
| 🚧 | **Cone** | up for elimination — brought a menu, insists it is a rulebook |
| ☕ | **Mugsy** | up for elimination — brought a teabag, sentimentally |
| 📎 | **Clip** | up for elimination — brought a rubber band, forcibly |
| 🧊 | **Cube** | up for elimination — brought the concept of ice, i.e. water |
| 🔋 | **Volt** | eliminated, episode 1 — lives in the drawer now |
| 📣 | **Mega** | host |

## Rebuilding

```sh
pip install pycairo numpy imageio-ffmpeg
cd objectshow
python3 render.py ep02 ../video/odds-and-ends-ep2/odds_and_ends_ep02_the_junk_drawer.mp4
```

See [`../../objectshow/README.md`](../../objectshow/README.md) for how the
generator fits together.

## Next

[Episode 3: "Sock Puppet"](../odds-and-ends-ep3) — Cube lost the vote.
