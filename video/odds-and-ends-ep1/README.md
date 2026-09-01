# Odds & Ends — Episode 1: "Stack Overflow"

A five-minute object show. Seven household objects, one chair, one challenge,
one elimination.

| | |
|---|---|
| File | `odds_and_ends_ep01_stack_overflow.mp4` |
| Duration | `00:05:00.00` exactly |
| Video | H.264 High, 1280x720, 24 fps, ~522 kb/s |
| Audio | AAC-LC, 44.1 kHz stereo, 160 kb/s |
| Size | 25,792,011 bytes (24.6 MiB) |
| Source | [`../../objectshow/ep01.py`](../../objectshow/ep01.py) |

Every frame and every sample is generated from the source in
[`../../objectshow`](../../objectshow) — there are no image, video or audio
assets anywhere in this repository. The art is vector drawing on a cairo
context; the soundtrack is numpy oscillators.

## Cast

| | Character | Deal |
|---|---|---|
| ☕ | **Mugsy** | a mug, 60% anxiety |
| 📎 | **Clip** | holds things together, loudly |
| 🚧 | **Cone** | reads the rules. all of them. |
| 🗒️ | **Sticky** | remembers nothing, sticks to everything |
| 🔋 | **Volt** | 9 volts of unearned confidence |
| 🧊 | **Cube** | cool under pressure. melting otherwise. |
| 📣 | **Mega** | your host, allegedly impartial |

## Running order

| Start | Scene | |
|---|---|---|
| 0:00 | Cold open | the Last Good Chair is revealed |
| 0:20 | Title | |
| 0:28 | Roll call | six contestants introduce themselves |
| 1:20 | The challenge | Stack Overflow: stack yourselves, 60 seconds |
| 1:57 | The stack | two towers, one melting ice cube |
| 3:24 | Results | a technicality involving a cloud |
| 4:11 | Elimination | Volt, Clip and Cube face the Junk Drawer |
| 4:40 | Outro | next time |

## Rebuilding

```sh
pip install pycairo numpy imageio-ffmpeg
cd objectshow
python3 render.py ep01 ../video/odds-and-ends-ep1/odds_and_ends_ep01_stack_overflow.mp4
```

Roughly 90 seconds on a modern core (~85 fps of 1280x720), and reproducible:
the same source always produces the same frames.

See [`../../objectshow/README.md`](../../objectshow/README.md) for the file map,
the slice/still/contact-sheet commands, and how to write another episode.

## Next

[Episode 2: "The Junk Drawer"](../odds-and-ends-ep2) — Volt lost the vote.
