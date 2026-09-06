# Odds & Ends — Series 2, Episode 2: "The Host"

The network has notes. The note is: *is the host replaceable?* Nine objects get
the badge and fifty seconds each to prove it. Fourteen minutes, 315 lines.

| | |
|---|---|
| File | `odds_and_ends_s2e02_the_host.mp4` |
| Duration | `00:14:00.00` exactly |
| Video | H.264 High, 1280x720, 24 fps, CRF 30 with x264's animation tune |
| Audio | AAC-LC, 44.1 kHz mono, 80 kb/s |
| Size | 25,933,872 bytes (24.7 MiB) |
| Source | [`../../objectshow/s2e02.py`](../../objectshow/s2e02.py) |

## Running order

| Start | Scene | |
|---|---|---|
| 0:00 | Previously on | four clips of the garage |
| 0:17 | The vote | Bulb 8, Spanner 12, Cone 19, Clip 21, Volt 40 |
| 1:45 | Title | |
| 1:54 | The brief | it is not going to be the lawnmower |
| 2:59 | The auditions | nine hosts, fifty seconds each |
| 10:31 | Scores | out of ten, and then out of ten again |
| 11:56 | The winner | somebody wins by asking people how they are |
| 12:35 | Elimination | Clip, Cone, Spanner and Reel |
| 13:34 | Outro | the lawnmower, allegedly |

## The auditions

| | Host | The format |
|---|---|---|
| 🔧 | **Spanner** | "Challenge: pick up that screw. Fuzz picked it up. Fuzz wins. Done." Nineteen seconds. Efficient. Volt: "I hated it. It was correct, and I hated it." |
| 📎 | **Clip** | Entirely teasers. "Coming up: a look at what is coming up." Goes to a break in a garage, and comes back. |
| 🚧 | **Cone** | Reads the rules. All forty-one. Rule 13 is that rule 12 is a rule. Never starts the challenge. |
| 💡 | **Bulb** | Changes format four times in fifty seconds, then has a fifth idea and the lights go out. His best idea is "fewer ideas", which he hates. |
| 🎾 | **Fuzz** | Hosts while bouncing, so he is audible for the whole slot and visible for a third of it. Announces a winner without saying who. |
| 🎨 | **Gloss** | Not a challenge. A feelings segment. Asks Reel about being left half unwound, and makes four objects cry, including one in the box. |
| 🔌 | **Reel** | Cannot host an unmeasured space. Measures the garage, the crate, and Mega (410 mm, with the horn). |
| 🗒️ | **Sticky** | Gives everyone immunity, including the eliminated. "That is not a show, that is a party." — "YES." |
| ☕ | **Mugsy** | Does not want the badge. Then asks Bulb for *one* idea and waits while he has it, and gives Gloss something to paint. |

Mugsy scores a nine, which Mega revises to a four on the spot, until the box —
which is the audience — objects loudly enough that it goes back to nine. He
wins immunity and does not give the badge back.

## Standings

| | Character | |
|---|---|---|
| ☕ | **Mugsy** | immune. Has the badge. Is not giving it back. |
| 💡🎾🎨🗒️ | Bulb, Fuzz, Gloss, Sticky | safe |
| 📎🚧🔧🔌 | Clip, Cone, Spanner, Reel | up for elimination |
| 🔋 | **Volt** | eliminated, s2e2 — out of the box for exactly one episode |
| 🧊🧤🍽️🥄 | Cube, Mitt, Plate, Spork | in the box, and now also the audience |

Teams are over. That was a one-week idea, and it was not Bulb's.

## Rebuilding

```sh
pip install pycairo numpy imageio-ffmpeg
cd objectshow
python3 render.py s2e02 ../video/odds-and-ends-s2e2/odds_and_ends_s2e02_the_host.mp4 --crf 30
```

About four and three quarter minutes. At fourteen minutes CRF 28 lands just
over 30 MiB, so this one is CRF 30.

See [`../../objectshow/README.md`](../../objectshow/README.md) for how the
generator fits together.

## Next

Series 2, Episode 3: "The Lawnmower". It has been announced twice. This time
the engine turned over.
