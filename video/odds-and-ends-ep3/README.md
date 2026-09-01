# Odds & Ends — Episode 3: "Sock Puppet"

Cube lost the vote and joined Volt in the drawer, where the two of them now
judge a talent show performed with an eleven-year-old sock.

| | |
|---|---|
| File | `odds_and_ends_ep03_sock_puppet.mp4` |
| Duration | `00:05:00.00` exactly |
| Video | H.264 High, 1280x720, 24 fps, ~365 kb/s |
| Audio | AAC-LC, 44.1 kHz stereo, 160 kb/s |
| Size | 19,844,920 bytes (18.9 MiB) |
| Source | [`../../objectshow/ep03.py`](../../objectshow/ep03.py) |

## Running order

| Start | Scene | |
|---|---|---|
| 0:00 | Previously on | three clips of episode 2, replayed through its own scene code |
| 0:17 | Title | |
| 0:26 | The vote | Cone 9, Clip 14, Mugsy 16, Cube 38 — and a ruling about liquids |
| 1:26 | The challenge | wear the sock, do an impression; the drawer judges |
| 2:04 | The show | four acts, scored out of ten by the eliminated |
| 3:35 | Scores | Clip takes twenty out of twenty |
| 4:10 | Elimination | Cone, Mugsy and Sticky face the drawer |
| 4:40 | Outro | next time |

## The acts

| | Performer | Impression | Volt | Cube |
|---|---|---|---|---|
| 🚧 | **Cone** | Mega, on the subject of rulebooks | 6 | 7 |
| ☕ | **Mugsy** | a relaxed Mugsy | 4 | 4 |
| 📎 | **Clip** | the rubber band, in absentia | 10 | 10 |
| 🗒️ | **Sticky** | Volt, to his face | 1 | 9 |

Clip wins immunity, 20/20. The sock takes on a hint of whoever is being
impersonated, and its jaw is driven by the same mouth track as the performer's.

## Standings

| | Character | |
|---|---|---|
| 📎 | **Clip** | immune |
| 🚧 | **Cone** | up for elimination |
| ☕ | **Mugsy** | up for elimination |
| 🗒️ | **Sticky** | up for elimination |
| 🧊 | **Cube** | eliminated, episode 3 — judge |
| 🔋 | **Volt** | eliminated, episode 1 — judge |
| 📣 | **Mega** | host |

## Rebuilding

```sh
pip install pycairo numpy imageio-ffmpeg
cd objectshow
python3 render.py ep03 ../video/odds-and-ends-ep3/odds_and_ends_ep03_sock_puppet.mp4
```

See [`../../objectshow/README.md`](../../objectshow/README.md) for how the
generator fits together.

## Next

Episode 4: "The Rulebook" — Cone reads the menu aloud. All of it.
