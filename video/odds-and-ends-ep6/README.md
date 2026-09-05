# Odds & Ends — Episode 6: "The Fridge"

Mitt lost the vote and took it beautifully. The rest go into cold storage,
where Cube — cold at last, after asking since episode 2 — adjudicates, and
Spork wins by being frozen to the furniture.

| | |
|---|---|
| File | `odds_and_ends_ep06_the_fridge.mp4` |
| Duration | `00:05:00.00` exactly |
| Video | H.264 High, 1280x720, 24 fps, ~437 kb/s |
| Audio | AAC-LC, 44.1 kHz stereo, 160 kb/s |
| Size | 22,554,256 bytes (21.5 MiB) |
| Source | [`../../objectshow/ep06.py`](../../objectshow/ep06.py) |

## Running order

| Start | Scene | |
|---|---|---|
| 0:00 | Previously on | three clips of episode 5 |
| 0:17 | Title | |
| 0:26 | The vote | Mugsy 12, Spork 16, Cone 19, Mitt 31 |
| 1:16 | The fridge | cold storage, and a guest adjudicator who has waited five episodes |
| 2:04 | The cold | shivering, frost, a shelf that should not have been touched, and the jar |
| 3:28 | Results | the last object still in the fridge, technically |
| 4:06 | Elimination | Mugsy, Cone and Plate — the immune contestant cannot attend |
| 4:36 | Outro | four lanes, no pavement |

Spork holds the shelf, freezes to it, and therefore never leaves the fridge —
which is the rule as written. His podium at the elimination is empty, with a
crown on it and a card reading *still in the fridge*.

Cone continues to have the worst season of anyone: warped in episode 5, brittle
in this one, and audibly cracking by the end of it.

## Standings

| | Character | |
|---|---|---|
| 🥄 | **Spork** | immune — attached to a shelf |
| ☕ | **Mugsy** | up for elimination — lasted longer than a plate |
| 🚧 | **Cone** | up for elimination — warped, and now cracked |
| 🍽️ | **Plate** | up for elimination — left the fridge first, with dignity |
| 🧤 | **Mitt** | eliminated, episode 6 — comforting the drawer, against its will |
| 📎 | **Clip** | eliminated, episode 5 |
| 🗒️ | **Sticky** | eliminated, episode 4 |
| 🧊 | **Cube** | eliminated, episode 3 — guest adjudicator, finally solid |
| 🔋 | **Volt** | eliminated, episode 1 |
| 📣 | **Mega** | host |

## Rebuilding

```sh
pip install pycairo numpy imageio-ffmpeg
cd objectshow
python3 render.py ep06 ../video/odds-and-ends-ep6/odds_and_ends_ep06_the_fridge.mp4
```

See [`../../objectshow/README.md`](../../objectshow/README.md) for how the
generator fits together.

## Next

Episode 7: "The Motorway" — four lanes, no pavement. Cone has been waiting his
whole life for this.
