"""Script and soundtrack for ad 2, "Detention" (about 45 s).

Max blanks on Hub AI in programming class, the furious teacher (who can't
build an app either) gives him 12 hours of detention and ten cartoon bonks
with a spiky projector remote. Next lesson Minnie sits next to him and
explains Hub AI.

Lines are laid out one after another using the real length of each spoken
line, and named marks (e.g. "bonk") tell school.html when to animate what.
Writes build/school/audio.wav and build/school/timeline.json.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib_audio import SR, Mix, finish, groove, kick, note, say, tone  # noqa: E402

OUT = os.path.join(HERE, "build", "school")
CACHE = os.path.join(HERE, "build", "voice-cache")

# ("say", who, text, pause_after) | ("mark", name) | ("wait", seconds)
SCRIPT = [
    ("wait", 0.4),
    ("mark", "class"),
    ("say", "teacher", "Class! Today, every single one of you builds an app!", 0.25),
    ("say", "teacher", "Watch and learn.", 0.1),
    ("mark", "typing"),
    ("wait", 1.5),
    ("mark", "error"),
    ("wait", 0.95),
    ("say", "teacher", "ARGH! Stupid computer!", 0.2),
    ("mark", "pick"),
    ("say", "teacher", "MAX! You do it!", 0.25),
    ("say", "max", "Uh… there's this app… Hub… Hub something… Hubba Bubba?", 0.2),
    ("mark", "rage"),
    ("say", "teacher", "Hubba Bubba?!", 0.1),
    ("say", "teacher", "Twelve hours of detention!", 0.15),
    ("mark", "bonk"),
    ("wait", 3.2),
    ("mark", "dizzy"),
    ("say", "max", "Ow…", 0.5),
    ("mark", "later"),
    ("wait", 2.2),
    ("mark", "detention"),
    ("say", "max", "Twelve… whole… hours.", 0.5),
    ("mark", "next"),
    ("wait", 1.3),
    ("mark", "minnie"),
    ("say", "minnie", "Psst, Max! It's called Hub AI.", 0.15),
    ("say", "minnie", "You just type what you want, and it builds the app for you!", 0.2),
    ("say", "max", "Wait… THAT's Hub AI?!", 0.15),
    ("mark", "phone"),
    ("say", "minnie", "Try it!", 0.2),
    ("mark", "typed"),
    ("wait", 0.8),
    ("mark", "built"),
    ("wait", 0.6),
    ("mark", "teacher"),
    ("say", "teacher", "Max! Where is your app?!", 0.2),
    ("mark", "show"),
    ("say", "max", "Right here. I made it with Hub AI.", 0.3),
    ("mark", "works"),
    ("say", "teacher", "It… it WORKS?!", 0.35),
    ("mark", "soft"),
    ("say", "teacher", "Can I… have Hub AI too?", 0.3),
    ("mark", "end"),
    ("wait", 3.0),
]

# Lay out the script.
t, placed, marks = 0.0, [], {}
for step in SCRIPT:
    if step[0] == "wait":
        t += step[1]
    elif step[0] == "mark":
        marks[step[1]] = round(t, 3)
    else:
        _, who, text, pause = step
        s = say(who, text, CACHE)
        d = len(s) / SR
        placed.append({"start": round(t, 3), "end": round(t + d, 3), "who": who, "text": text, "samples": s})
        t += d + pause
LENGTH = round(t, 2)
M = marks

music, fx = Mix(LENGTH, 11), Mix(LENGTH, 12)

# 1. Angry teacher: a plodding minor march.
march_chords = [[57, 60, 64], [52, 55, 59], [53, 57, 60], [52, 56, 59]]
groove(music, 0.0, M["bonk"], march_chords, [33, 28, 29, 28], bpm=96, drums=True, gain=0.7)
# typing, the error buzzer, the rage sting
k = 0
tt = M["typing"]
while tt < M["error"] - 0.05:
    fx.tick(tt, 0.22)
    tt += 0.075 + (k % 3) * 0.02
    k += 1
fx.buzzer(M["error"], 0.55, 0.26)
fx.sweep(M["rage"], 0.4, 120, 60, 0.5)
# 2. Ten bonks inside the cartoon scuffle, then dizzy birdies.
for i in range(10):
    fx.bonk(M["bonk"] + 0.15 + i * 0.29, 0.55)
fx.add(M["bonk"], fx.noise(3.2, 0.4, 0.06, hp=False))
for i in range(6):
    fx.add(M["dizzy"] + i * 0.18, tone(note(84 + (i % 3) * 3), 0.12, "sin", 18, 0.08))
# 3. Twelve hours later: a fast ticking clock, then a lonely tune.
for i in range(int((M["detention"] - M["later"]) / 0.12)):
    fx.tick(M["later"] + i * 0.12, 0.3)
for i, m in enumerate([64, 62, 60, 59, 57]):
    music.add(M["detention"] + 0.2 + i * 0.5, tone(note(m), 0.7, "sin", 3, 0.13))
# 4. Next lesson: the happy groove, a bell, a whoosh for Minnie, the build.
for i in range(3):
    fx.add(M["next"] + i * 0.25, tone(note(88), 0.5, "sin", 6, 0.12))
fx.whoosh(M["minnie"] - 0.2, 0.5, 0.45)
groove(music, M["minnie"], M["end"] + 0.1, [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], [36, 31, 33, 29])
for i in range(12):
    fx.tick(M["typed"] + i * 0.065, 0.15)
fx.sweep(M["built"], 0.6, 180, 50, 0.5)
fx.add(M["built"], fx.noise(0.4, 7, 0.2, hp=False))
fx.sweep(M["works"] - 0.15, 0.3, 1200, 300, 0.12, "tri")  # remote drops
for m in [60, 64, 67, 72, 76]:
    music.add(M["end"] + 0.05, tone(note(m), 1.8, "tri", 1.6, 0.09))
music.add(M["end"] + 0.05, kick(1.0))
for i in range(6):
    fx.pop(M["end"] + 0.05 + i * 0.09, 1500 + 200 * i, 0.1)

os.makedirs(OUT, exist_ok=True)
finish(os.path.join(OUT, "audio.wav"), os.path.join(OUT, "timeline.json"), LENGTH, music, fx, placed, {"marks": marks})
for ln in placed:
    print("%-8s %6.2f-%6.2f  %s" % (ln["who"], ln["start"], ln["end"], ln["text"]))
print("length", LENGTH, "marks", marks)
