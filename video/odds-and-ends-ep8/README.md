# Odds & Ends — Episode 8: "Bin Day" (series finale)

Spork lost the vote from inside a hedge and was collected on the spot. Two
objects are left, the recycling bin is doing its rounds, and the Last Good
Chair has been in the shed since episode 1.

The first episode drawn with the new expression system.

| | |
|---|---|
| File | `odds_and_ends_ep08_bin_day.mp4` |
| Duration | `00:05:00.00` exactly |
| Video | H.264 High, 1280x720, 24 fps, ~395 kb/s |
| Audio | AAC-LC, 44.1 kHz stereo, 160 kb/s |
| Size | 21,029,915 bytes (20.1 MiB) |
| Source | [`../../objectshow/ep08.py`](../../objectshow/ep08.py) |

## Running order

| Start | Scene | |
|---|---|---|
| 0:00 | Previously on | three clips of episode 7 |
| 0:16 | Title | series finale |
| 0:25 | The vote | Mugsy 22, Spork 35 — "From a HEDGE. You voted me out of a HEDGE." |
| 1:09 | Bin day | the final: the last object not collected wins the show |
| 1:57 | The collection | "Recycling only. Are you recycling?" |
| 3:22 | The winner | eight episodes, nine objects, one chair |
| 4:17 | The chair | it wobbles |
| 4:50 | End card | Odds & Ends will return |

## How it ends

Cone's advantage on the motorway is his undoing on bin day: he is plastic, and
the bin is polite about it but firm. *"You are a very good example of
recycling." — "Thank you. I would rather not be."* He goes with grace, and his
last line to Mugsy is the one that matters: **"You crossed four lanes behind
me. Cross this one on your own."**

**Mugsy wins Odds & Ends**, because ceramic is not recycling. Eight episodes of
being anxious, hiding in a cupboard and hiding behind a cone end with the bin
telling him, kindly, that he is general waste — *"That is the nicest thing
anyone has said to me."*

Then the drawer opens, everyone comes out, and the Last Good Chair from episode
1 is finally awarded. Mugsy sits in it.

> **Mugsy:** ...This chair wobbles.
> **Mega:** It is the LAST GOOD CHAIR.
> **Mugsy:** It wobbles, Mega.
> **Mega:** ...It wobbles.
> **Volt:** IT HAS ALWAYS WOBBLED!

## Final standings

| | | |
|---|---|---|
| 🏆 | **Mugsy** | winner — not recyclable |
| 🥈 | **Cone** | runner-up — collected, cheerfully |
| 🥄 | **Spork** | 3rd, episode 8 |
| 🍽️ | **Plate** | 4th, episode 7 |
| 🧤 | **Mitt** | 5th, episode 6 |
| 📎 | **Clip** | 6th, episode 5 |
| 🗒️ | **Sticky** | 7th, episode 4 |
| 🧊 | **Cube** | 8th, episode 3 |
| 🔋 | **Volt** | 9th, episode 1 |
| 🗑️ | **Bin** | not a contestant. Weather. |
| 📣 | **Mega** | host |

## Rebuilding

```sh
pip install pycairo numpy imageio-ffmpeg
cd objectshow
python3 render.py ep08 ../video/odds-and-ends-ep8/odds_and_ends_ep08_bin_day.mp4
```

See [`../../objectshow/README.md`](../../objectshow/README.md) for how the
generator fits together.
