"""Script and soundtrack for ad 1, "Minnie & Max" (30 s).

Writes build/audio.wav (music + voices + sound effects) and
build/timeline.json (lines, plus per-frame mouth movement for lip sync).
Voices are real speech from an offline TTS model; see lib_audio.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_audio import Mix, finish, groove, kick, note, place_lines, tone  # noqa: E402

LENGTH = 30.0
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")

# (start, latest end, who, line). Minnie knows Hub AI; Max has never heard of it.
LINES = [
    (0.35, 2.65, "max", "Ugh… I want my own app. But I can't code."),
    (2.95, 5.3, "minnie", "Max. MAX! Have you heard of Hub AI?!"),
    (5.45, 6.85, "max", "Hub… what?"),
    (7.2, 10.6, "minnie", "You just type what you want… and BOOM! A whole app!"),
    (10.8, 12.85, "max", "No way. Even a banana tracker?"),
    (12.95, 15.0, "minnie", "EVEN a banana tracker."),
    (15.2, 19.2, "minnie", "Confetti! Cat walks! Upside-down mode! Twenty crazy features!"),
    (19.4, 21.1, "max", "And I can share them?!"),
    (21.25, 23.9, "minnie", "On Fun Hub! Swipe, play, share!"),
    (24.05, 25.55, "max", "Wait… is it free?!"),
    (25.55, 27.5, "minnie", "Free to start. And psst… there's a secret model."),
    (27.62, 28.3, "max", "WHAT?!"),
]

music, fx = Mix(LENGTH, 7), Mix(LENGTH, 8)

# Intro (bored Max): slow, sad plinks. Then the groove until the gasp.
for k, m in enumerate([57, 55, 52, 50]):
    music.add(0.2 + k * 0.62, tone(note(m), 0.9, "sin", 3.0, 0.16))
groove(music, 2.85, 27.55, [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], [36, 31, 33, 29])
for k, m in enumerate([72, 74, 76, 79, 76, 79, 81, 79, 76, 74, 72, 74, 76, 72, 74, 79]):
    music.add(15.2 + k * 0.25, tone(note(m), 0.2, "sq", 12, 0.05))
for m in [60, 64, 67, 72, 76]:
    music.add(28.35, tone(note(m), 1.6, "tri", 1.8, 0.09))
music.add(28.35, kick(1.0))

fx.whoosh(2.75, 0.55, 0.5)                     # Minnie zooms in
fx.sweep(8.95, 0.7, 180, 40, 0.7)              # BOOM
fx.add(8.95, fx.noise(0.6, 6, 0.35, hp=False))
for k in range(8):                             # bananas raining
    fx.pop(12.95 + k * 0.17, 300 + 40 * k, 0.04)
for k, t in enumerate([15.2, 16.25, 17.35, 18.35]):
    fx.pop(t, 520 + 140 * k, 0.18)
fx.sweep(17.35, 0.5, 900, 200, 0.18, "tri")    # upside-down flip
fx.whoosh(21.2, 0.35, 0.3)                     # swipe
fx.whoosh(21.9, 0.35, 0.3)
fx.sweep(27.5, 0.35, 1400, 120, 0.3, "tri")    # record scratch
fx.add(27.5, fx.noise(0.3, 9, 0.25))
for k in range(6):                             # sparkle on the end card
    fx.pop(28.35 + k * 0.09, 1500 + 200 * k, 0.12)

placed = place_lines(LINES, os.path.join(OUT, "voice-cache"))
os.makedirs(OUT, exist_ok=True)
finish(os.path.join(OUT, "audio.wav"), os.path.join(OUT, "timeline.json"), LENGTH, music, fx, placed)
for ln in placed:
    print("%-7s %5.2f-%5.2f  %s" % (ln["who"], ln["start"], ln["end"], ln["text"]))
