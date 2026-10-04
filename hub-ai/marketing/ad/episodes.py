"""Scripts and soundtracks for the five Max & Minnie episodes.

    python3 episodes.py all          # or: kitchen space magic birthday rap

Each writes build/ep/<name>/audio.wav and timeline.json. Lines are laid
out from their real spoken length, and the named marks drive the matching
ep-<name>.html animation (see make_audio_school.py for the same idea).
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib_audio import SR, Mix, finish, groove, kick, note, say, tone  # noqa: E402

CACHE = os.path.join(HERE, "build", "voice-cache")

# ("say", who, text, pause_after) | ("mark", name) | ("wait", seconds)
EPISODES = {
    "kitchen": [
        ("wait", 0.3), ("mark", "title"),
        ("say", "announcer", "Welcome to Banana Kitchen!", 0.2),
        ("mark", "intro"),
        ("say", "minnie", "Today, we're baking… an app!", 0.15),
        ("say", "max", "Easy! Flour, eggs, and… a laptop?", 0.1),
        ("mark", "flour"), ("wait", 0.9),
        ("say", "max", "It's… crunchy.", 0.25),
        ("mark", "phone"),
        ("say", "minnie", "Max! You don't bake apps. You ask Hub AI.", 0.15),
        ("mark", "type"),
        ("say", "minnie", "A pizza timer, please!", 0.3),
        ("mark", "ding"), ("wait", 1.0),
        ("mark", "wow"),
        ("say", "max", "Whoa! Fresh out of the oven!", 0.2),
        ("say", "minnie", "Apps, baked in seconds.", 0.3),
        ("mark", "end"), ("wait", 3.0),
    ],
    "space": [
        ("wait", 0.3), ("mark", "launch"),
        ("say", "announcer", "Three… two… one… liftoff!", 0.2),
        ("mark", "cabin"),
        ("say", "minnie", "Max, we need a landing countdown for the Banana Moon!", 0.15),
        ("say", "max", "I'll code it! Beep, boop… beep?", 0.1),
        ("mark", "panic"), ("wait", 0.5),
        ("say", "max", "Houston, we have a problem.", 0.25),
        ("mark", "phone"),
        ("say", "minnie", "Relax. Hub AI, build a moon landing countdown!", 0.2),
        ("mark", "built"), ("wait", 0.7),
        ("say", "max", "Ten seconds to landing… we're gonna make it!", 0.2),
        ("mark", "land"), ("wait", 0.8),
        ("say", "minnie", "One small step for cats. One giant app for bananas!", 0.3),
        ("mark", "end"), ("wait", 3.0),
    ],
    "magic": [
        ("wait", 0.3), ("mark", "curtain"),
        ("say", "announcer", "Presenting… the Great Maxini!", 0.2),
        ("mark", "trick"),
        ("say", "max", "For my first trick, I will make an app appear!", 0.15),
        ("mark", "wave"),
        ("say", "max", "Abracadabra!", 0.1),
        ("mark", "poof"), ("wait", 1.0),
        ("say", "max", "…That's a banana peel.", 0.3),
        ("mark", "minnie"),
        ("say", "minnie", "Let me try. Hub AI, make a card trick app!", 0.2),
        ("mark", "built"), ("wait", 0.4),
        ("say", "minnie", "Ta-da!", 0.1),
        ("mark", "applause"), ("wait", 0.6),
        ("say", "max", "How did you do that?!", 0.15),
        ("say", "minnie", "It's not magic. It's Hub AI.", 0.3),
        ("mark", "end"), ("wait", 3.0),
    ],
    "birthday": [
        ("wait", 0.3), ("mark", "calendar"),
        ("say", "max", "Wait… today is Minnie's birthday?!", 0.15),
        ("mark", "panic"),
        ("say", "max", "No cake. No card. No gift. I'm doomed!", 0.2),
        ("mark", "idea"),
        ("say", "max", "Unless… Hub AI! A birthday card for Minnie!", 0.2),
        ("mark", "built"), ("wait", 0.7),
        ("mark", "door"), ("wait", 0.9),
        ("mark", "minnie"),
        ("say", "minnie", "Hi, Max!", 0.15),
        ("say", "max", "Happy birthday! I made you an app!", 0.2),
        ("mark", "gift"),
        ("say", "minnie", "You made me… an app?! Best gift ever!", 0.3),
        ("mark", "end"), ("wait", 3.0),
    ],
    "rap": [
        ("wait", 0.3), ("mark", "title"),
        ("say", "announcer", "Welcome to the Banana Rap Battle!", 0.2),
        ("mark", "max"),
        ("say", "max", "Yo, I'm Max, I code all night. My apps crash, but my rhymes are tight!", 0.2),
        ("mark", "minnie"),
        ("say", "minnie", "I'm Minnie, I don't stress. I ask Hub AI, it builds the rest!", 0.2),
        ("mark", "prove"),
        ("say", "max", "Oh yeah? Then prove it!", 0.15),
        ("mark", "phone"),
        ("say", "minnie", "Hub Battle! Two agents, one app!", 0.3),
        ("mark", "roll"), ("wait", 0.2),
        ("say", "announcer", "And the winner is…", 1.3),
        ("mark", "winner"),
        ("say", "minnie", "Everybody who uses Hub AI!", 0.2),
        ("mark", "drop"), ("wait", 0.4),
        ("mark", "end"), ("wait", 3.0),
    ],
    # ---- the update: new agents and everything you can make ----
    "agents": [
        ("wait", 0.3), ("mark", "intro"),
        ("say", "announcer", "Ladies and bananas… meet the new Hub V1 agents!", 0.15),
        ("mark", "lineup"),
        ("say", "announcer", "Spark! Flux! Volt! Prism! Titan!", 0.25),
        ("mark", "max"),
        ("say", "max", "Whoa. Which one do I pick?", 0.15),
        ("mark", "minnie"),
        ("say", "minnie", "Spark and Flux are fast. Volt and Prism are smart. And Titan is a genius!", 0.2),
        ("mark", "pixel"),
        ("say", "announcer", "And Hub V1 Pixel… makes pictures!", 0.2),
        ("mark", "wow"),
        ("say", "max", "They're all in Hub AI?", 0.1),
        ("say", "minnie", "All of them. Pick one and just ask!", 0.3),
        ("mark", "end"), ("wait", 3.0),
    ],
    "studio": [
        ("wait", 0.3), ("mark", "clap"),
        ("say", "announcer", "Lights… camera… banana!", 0.2),
        ("mark", "max"),
        ("say", "max", "I want to make a cartoon, but drawing takes forever.", 0.15),
        ("mark", "minnie"),
        ("say", "minnie", "Hub AI makes animations now. Watch!", 0.15),
        ("mark", "phone"),
        ("say", "minnie", "An animation of a rocket flying to the moon.", 0.3),
        ("mark", "built"), ("wait", 0.4),
        ("say", "max", "It moves!", 0.15),
        ("mark", "video"),
        ("say", "minnie", "And with one tap, it's a video. Ready for your feed.", 0.25),
        ("mark", "star"),
        ("say", "max", "I'm a movie star!", 0.3),
        ("mark", "end"), ("wait", 3.0),
    ],
    "pitch": [
        ("wait", 0.3), ("mark", "panic"),
        ("say", "max", "My big presentation is in five minutes, and I have zero slides!", 0.15),
        ("mark", "phone"),
        ("say", "minnie", "Hub AI, make a pitch deck for Banana Juice!", 0.3),
        ("mark", "built"), ("wait", 0.3),
        ("say", "max", "Ten slides? With charts?!", 0.15),
        ("say", "minnie", "Present it full screen, or save it as a PDF.", 0.2),
        ("mark", "card"),
        ("say", "max", "Can it make a thank-you card for the team?", 0.15),
        ("mark", "cardbuilt"),
        ("say", "minnie", "Cards, invitations, business cards. Done.", 0.3),
        ("mark", "end"), ("wait", 3.0),
    ],
    "lab": [
        ("wait", 0.3), ("mark", "build"),
        ("say", "max", "Behold! My rocket… made of cardboard.", 0.2),
        ("mark", "collapse"), ("wait", 0.8),
        ("say", "max", "Okay, maybe not.", 0.15),
        ("mark", "minnie"),
        ("say", "minnie", "Ask Hub AI for a 3D model instead!", 0.3),
        ("mark", "built"), ("wait", 0.3),
        ("say", "max", "I can spin it! And zoom!", 0.15),
        ("say", "minnie", "Download it for games or 3D printing.", 0.2),
        ("mark", "ui"),
        ("say", "max", "Now my rocket needs an app.", 0.15),
        ("mark", "uibuilt"),
        ("say", "minnie", "UI Design makes the screens for you.", 0.3),
        ("mark", "end"), ("wait", 3.0),
    ],
    "photo": [
        ("wait", 0.3), ("mark", "pose"),
        ("say", "max", "Say cheese!", 0.1),
        ("mark", "snap"), ("wait", 0.9),
        ("mark", "look"),
        ("say", "max", "Oh no! A banana peel on my head!", 0.15),
        ("mark", "phone"),
        ("say", "minnie", "Hub AI, remove the peel and add a sunset.", 0.3),
        ("mark", "built"), ("wait", 0.3),
        ("say", "max", "It's perfect!", 0.15),
        ("mark", "more"),
        ("say", "minnie", "And there's more. Games, websites, logos, diagrams, documents…", 0.15),
        ("mark", "outro"),
        ("say", "announcer", "Thirteen things to make. Twenty pro tools. One Hub AI.", 0.3),
        ("mark", "end"), ("wait", 3.0),
    ],
}


def layout(script):
    t, placed, marks = 0.0, [], {}
    for step in script:
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
    return placed, marks, round(t, 2)


HAPPY = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], [36, 31, 33, 29]


def stinger(music, fx, t):
    for m in [60, 64, 67, 72, 76]:
        music.add(t + 0.05, tone(note(m), 1.8, "tri", 1.6, 0.09))
    music.add(t + 0.05, kick(1.0))
    for i in range(6):
        fx.pop(t + 0.05 + i * 0.09, 1500 + 200 * i, 0.1)


def sound_kitchen(M, music, fx):
    jazz = [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 61, 64, 67]]
    groove(music, 0.0, M["end"], jazz, [38, 31, 36, 33], bpm=112, gain=0.8)
    fx.ding(M["title"], 0.12, 2093)
    fx.poof(M["flour"], 0.5)
    fx.add(M["flour"] + 0.25, fx.noise(0.5, 3, 0.12))           # sizzle
    for i in range(10):
        fx.tick(M["type"] + i * 0.08, 0.15)
    fx.ding(M["ding"], 0.35)
    fx.whoosh(M["ding"] + 0.3, 0.5, 0.35)
    stinger(music, fx, M["end"])


def sound_space(M, music, fx):
    for i in range(int(M["cabin"] / 0.12)):                       # rumble
        fx.add(i * 0.12, fx.noise(0.14, 8, 0.12 * min(1, i / 10), hp=False))
    fx.sweep(M["cabin"] - 0.6, 1.0, 60, 400, 0.4)
    arp = [60, 64, 67, 71, 72, 71, 67, 64]
    t = M["cabin"]
    k = 0
    while t < M["end"]:
        music.add(t, tone(note(arp[k % 8] + 12), 0.14, "sq", 14, 0.045))
        t += 0.125
        k += 1
    groove(music, M["cabin"], M["end"], *HAPPY, bpm=120, gain=0.6)
    fx.alarm(M["panic"], 1.6)
    for i in range(6):
        fx.pop(M["panic"] + i * 0.13, 300 + 120 * i, 0.15)
    fx.sweep(M["built"], 0.6, 200, 900, 0.25)
    fx.thud(M["land"], 0.9)
    stinger(music, fx, M["end"])


def sound_magic(M, music, fx):
    spooky = [[57, 60, 64], [56, 59, 64], [53, 57, 60], [52, 56, 59]]
    groove(music, M["trick"], M["minnie"], spooky, [33, 32, 29, 28], bpm=90, drums=False, gain=0.8)
    fx.drumroll(M["curtain"] + 0.2, 1.4, 0.18)
    fx.whoosh(M["curtain"], 0.8, 0.3)
    fx.poof(M["poof"], 0.6)
    fx.sweep(M["poof"] + 0.6, 0.6, 600, 200, 0.2, "tri")          # sad slide whistle
    groove(music, M["minnie"], M["end"], *HAPPY, bpm=124, gain=0.8)
    for i in range(5):
        fx.pop(M["built"] + i * 0.06, 900 + 160 * i, 0.05)
    fx.applause(M["applause"] + 0.1, 2.6, 0.4)
    stinger(music, fx, M["end"])


def sound_birthday(M, music, fx):
    fx.sweep(M["calendar"] + 1.6, 0.4, 1400, 120, 0.3, "tri")
    frantic = [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 56, 59]]
    groove(music, M["panic"], M["built"], frantic, [33, 31, 29, 28], bpm=150, gain=0.7)
    for i in range(10):
        fx.tick(M["idea"] + 1.0 + i * 0.07, 0.15)
    for i in range(8):
        fx.pop(M["built"] + i * 0.07, 900 + 160 * i, 0.12)
    fx.doorbell(M["door"], 0.3)
    # "Happy Birthday" (traditional) on a music box
    melody = [(67, .5), (67, .5), (69, 1), (67, 1), (72, 1), (71, 2), (67, .5), (67, .5), (69, 1), (67, 1), (74, 1), (72, 2)]
    t = M["minnie"]
    for m, d in melody:
        music.add(t, tone(note(m + 12), 0.5, "sin", 4, 0.1))
        t += d * 0.27
    groove(music, M["gift"], M["end"], *HAPPY, bpm=120, gain=0.7)
    stinger(music, fx, M["end"])


def sound_rap(M, music, fx):
    # boom-bap at 90 BPM
    beat, t, k = 60 / 90, 0.0, 0
    while t < M["roll"]:
        if k % 4 in (0, 2) or k % 8 == 7:
            music.add(t, kick(1.0))
        if k % 4 in (1, 3):
            music.add(t, music.noise(0.18, 18, 0.3))
        music.add(t, music.noise(0.03, 120, 0.08))
        music.add(t + beat / 2, music.noise(0.03, 120, 0.06))
        root = [33, 33, 31, 29][(k // 4) % 4]
        if k % 2 == 0:
            music.add(t, tone(note(root + 12), beat * 0.9, "sin", 3, 0.22))
        t += beat
        k += 1
    fx.cheer(M["title"] + 0.2, 2.2, 0.25)
    fx.add(M["prove"] - 0.4, fx.noise(0.3, 9, 0.25))              # record scratch
    fx.sweep(M["prove"] - 0.4, 0.3, 1400, 120, 0.3, "tri")
    fx.drumroll(M["roll"], M["winner"] - M["roll"] - 0.1, 0.22)
    fx.thud(M["drop"], 0.8)                                        # mic drop
    fx.cheer(M["drop"] + 0.1, 2.2, 0.3)
    stinger(music, fx, M["end"])


def sound_agents(M, music, fx):
    fx.cheer(M["intro"] + 0.1, 2.2, 0.22)
    fx.drumroll(M["intro"] + 0.2, M["lineup"] - M["intro"] - 0.3, 0.16)
    groove(music, M["lineup"], M["end"], *HAPPY, bpm=124, gain=0.7)
    line = M["lineup"]
    for i in range(5):
        fx.whoosh(line + 0.15 + i * 0.42, 0.35, 0.3)
        fx.pop(line + 0.3 + i * 0.42, 700 + 140 * i, 0.12)
    fx.sweep(M["pixel"] - 0.2, 0.5, 300, 1500, 0.2)
    fx.ding(M["pixel"] + 1.6, 0.25, 2093)
    fx.cheer(M["wow"], 2.0, 0.2)
    stinger(music, fx, M["end"])


def sound_studio(M, music, fx):
    fx.add(M["clap"] + 1.2, fx.noise(0.06, 60, 0.6))              # clapperboard
    fx.tick(M["clap"] + 1.2, 0.5)
    for i in range(int((M["phone"] - M["max"]) / 0.09)):            # projector purr
        fx.add(M["max"] + i * 0.09, fx.noise(0.05, 40, 0.03))
    groove(music, M["minnie"], M["end"], *HAPPY, bpm=118, gain=0.75)
    for i in range(10):
        fx.tick(M["phone"] + 0.4 + i * 0.08, 0.15)
    fx.whoosh(M["built"], 0.6, 0.35)
    fx.sweep(M["built"] + 0.2, 1.2, 200, 1200, 0.18)
    fx.ding(M["video"] + 1.4, 0.3)
    fx.applause(M["star"] + 0.2, 2.2, 0.3)
    stinger(music, fx, M["end"])


def sound_pitch(M, music, fx):
    for i in range(int(M["phone"] / 0.5)):                         # the clock
        fx.tick(i * 0.5, 0.3)
    frantic = [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 56, 59]]
    groove(music, 0.0, M["built"], frantic, [33, 31, 29, 28], bpm=150, gain=0.6)
    for i in range(10):
        fx.tick(M["phone"] + 0.3 + i * 0.08, 0.15)
    fx.ding(M["built"], 0.3)
    for i in range(6):
        fx.pop(M["built"] + 0.1 + i * 0.07, 900 + 160 * i, 0.12)
    groove(music, M["built"], M["end"], *HAPPY, bpm=120, gain=0.7)
    fx.whoosh(M["cardbuilt"] - 0.2, 0.5, 0.3)
    fx.ding(M["cardbuilt"] + 0.1, 0.2, 2349)
    stinger(music, fx, M["end"])


def sound_lab(M, music, fx):
    groove(music, 0.0, M["collapse"], *HAPPY, bpm=100, drums=False, gain=0.6)
    fx.thud(M["collapse"], 0.7)
    fx.poof(M["collapse"] + 0.05, 0.4)
    fx.sweep(M["collapse"] + 0.3, 0.6, 700, 180, 0.2, "tri")
    groove(music, M["minnie"], M["end"], *HAPPY, bpm=122, gain=0.75)
    for i in range(10):
        fx.tick(M["minnie"] + 0.6 + i * 0.08, 0.15)
    fx.whoosh(M["built"], 0.6, 0.35)
    fx.sweep(M["built"] + 0.6, 1.4, 300, 900, 0.15)                 # spinning
    fx.whoosh(M["uibuilt"] - 0.2, 0.5, 0.3)
    fx.ding(M["uibuilt"] + 0.1, 0.22, 2093)
    stinger(music, fx, M["end"])


def sound_photo(M, music, fx):
    groove(music, 0.0, M["snap"], *HAPPY, bpm=110, drums=False, gain=0.5)
    fx.add(M["snap"], fx.noise(0.08, 50, 0.7))                      # shutter
    fx.tick(M["snap"] + 0.06, 0.5)
    fx.sweep(M["look"] - 0.1, 0.5, 900, 200, 0.22, "tri")
    groove(music, M["phone"], M["end"], *HAPPY, bpm=122, gain=0.75)
    for i in range(10):
        fx.tick(M["phone"] + 0.4 + i * 0.08, 0.15)
    fx.whoosh(M["built"], 0.6, 0.35)
    fx.ding(M["built"] + 0.1, 0.3)
    for i in range(5):
        fx.pop(M["more"] + 0.5 + i * 0.6, 800 + 120 * i, 0.12)
    fx.cheer(M["outro"] + 0.2, 2.5, 0.22)
    stinger(music, fx, M["end"])


def build(name):
    placed, marks, length = layout(EPISODES[name])
    music, fx = Mix(length, 21), Mix(length, 22)
    globals()["sound_" + name](marks, music, fx)
    out = os.path.join(HERE, "build", "ep", name)
    os.makedirs(out, exist_ok=True)
    finish(os.path.join(out, "audio.wav"), os.path.join(out, "timeline.json"), length, music, fx, placed, {"marks": marks})
    print("%-9s %5.1f s  %d lines" % (name, length, len(placed)))


if __name__ == "__main__":
    names = list(EPISODES) if (len(sys.argv) < 2 or sys.argv[1] == "all") else sys.argv[1:]
    for n in names:
        build(n)
