"""Script and soundtrack for the Hub AI 30-second vertical ad.

Writes:
  build/timeline.json   dialogue lines and every syllable (for mouth sync)
  build/audio.wav       music + cat voices + sound effects, 44.1 kHz stereo

The cats "talk" in synthesized babble (think Animal Crossing) under big
captions, so there is no text-to-speech dependency. Standard library only.
"""

import json
import math
import os
import random
import re
import struct
import wave

SR = 44100
LENGTH = 30.0
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")

# (start, end, who, caption). Minnie knows Hub AI; Max has never heard of it.
LINES = [
    (0.35, 2.55, "max", "Ugh… I want my own app. But I can't code."),
    (2.95, 5.25, "minnie", "Max. MAX! Have you heard of Hub AI?!"),
    (5.45, 6.75, "max", "Hub… what?"),
    (7.0, 10.5, "minnie", "You just type what you want… and BOOM! A whole app!"),
    (10.8, 12.75, "max", "No way. Even a banana tracker?"),
    (12.95, 14.85, "minnie", "EVEN a banana tracker."),
    (15.2, 19.1, "minnie", "Confetti! Cat walks! Upside-down mode! 20 crazy features!"),
    (19.4, 21.0, "max", "And I can share them?!"),
    (21.25, 23.8, "minnie", "On FunHub! Swipe, play, share!"),
    (24.05, 25.45, "max", "Wait… is it free?!"),
    (25.65, 27.45, "minnie", "Free to start. And psst… there's a secret model."),
    (27.6, 28.3, "max", "WHAT?!"),
]

VOICE = {"minnie": 430.0, "max": 225.0}
# Rough vowel formants (F1, F2) in Hz.
VOWELS = [(800, 1200), (500, 1900), (300, 2300), (500, 900), (350, 800)]

rng = random.Random(7)
L = [0.0] * int(SR * LENGTH)  # mono mix, duplicated to stereo at the end


def add(buf, t0, samples, gain=1.0):
    i0 = int(t0 * SR)
    for j, v in enumerate(samples):
        k = i0 + j
        if 0 <= k < len(buf):
            buf[k] += v * gain


def env(n, a=0.005, r=0.05):
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    return [min(1.0, i / na, (n - i) / nr) for i in range(n)]


class Biquad:
    """Band-pass filter (constant peak gain), used for vowel formants."""

    def __init__(self, f, q):
        w = 2 * math.pi * f / SR
        alpha = math.sin(w) / (2 * q)
        a0 = 1 + alpha
        self.b0, self.b2 = alpha / a0, -alpha / a0
        self.a1, self.a2 = -2 * math.cos(w) / a0, (1 - alpha) / a0
        self.x1 = self.x2 = self.y1 = self.y2 = 0.0

    def __call__(self, x):
        y = self.b0 * x + self.b2 * self.x2 - self.a1 * self.y1 - self.a2 * self.y2
        self.x2, self.x1, self.y2, self.y1 = self.x1, x, self.y1, y
        return y


# ---------- voices ----------

def syllables_of(text):
    words = re.findall(r"[A-Za-z0-9']+", text)
    out = []
    for w in words:
        n = max(1, len(re.findall(r"[aeiouy]+", w.lower())))
        out.append(min(n, 4))
    return out


def babble(who, start, end, text):
    """Returns the syllables [(t0, t1, who)] and adds the voice to the mix."""
    words = syllables_of(text)
    total = sum(words)
    span = end - start
    gaps = len(words) - 1
    gap = min(0.06, span * 0.12 / max(1, gaps))
    syl = (span - gap * gaps) / total
    question = text.strip().endswith("?") or text.strip().endswith("?!")
    shout = text.isupper() or "!" in text
    base = VOICE[who]
    out, t = [], start
    idx = 0
    for wi, n in enumerate(words):
        for _ in range(n):
            d = syl * rng.uniform(0.7, 0.95)
            f0 = base * rng.uniform(0.86, 1.2)
            if question and idx >= total - 2:
                f0 *= 1.25 + 0.15 * (idx - total + 2)
            if shout:
                f0 *= 1.06
            voice_syllable(t, d, f0, rng.choice(VOWELS), 0.32 if shout else 0.26)
            out.append([round(t, 3), round(t + d, 3), who])
            t += syl
            idx += 1
        t += gap
    return out


def voice_syllable(t0, dur, f0, vowel, gain):
    n = int(dur * SR)
    f1, f2 = Biquad(vowel[0], 6), Biquad(vowel[1], 8)
    e = env(n, 0.012, 0.03)
    ph, s = 0.0, []
    for i in range(n):
        f = f0 * (1 + 0.025 * math.sin(2 * math.pi * 6 * i / SR)) * (1 + 0.08 * (i / n))  # vibrato, little lift
        ph += f / SR
        saw = 2 * (ph % 1) - 1
        v = f1(saw) * 1.0 + f2(saw) * 0.7 + 0.15 * math.sin(2 * math.pi * ph)
        s.append(v * e[i])
    add(L, t0, s, gain)


# ---------- music ----------

def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tone(freq, dur, shape="tri", decay=6.0, gain=0.2):
    n = int(dur * SR)
    out = []
    for i in range(n):
        ph = freq * i / SR
        if shape == "tri":
            v = 4 * abs(ph % 1 - 0.5) - 1
        elif shape == "sq":
            v = 1.0 if ph % 1 < 0.5 else -1.0
        else:
            v = math.sin(2 * math.pi * ph)
        out.append(v * math.exp(-decay * i / SR) * gain)
    return out


def kick(gain=0.9):
    n = int(0.28 * SR)
    out, ph = [], 0.0
    for i in range(n):
        t = i / SR
        f = 50 + 120 * math.exp(-t * 28)
        ph += f / SR
        out.append(math.sin(2 * math.pi * ph) * math.exp(-t * 11) * gain)
    return out


def noise(dur, decay, gain, hp=True):
    n = int(dur * SR)
    out, prev = [], 0.0
    for i in range(n):
        x = rng.uniform(-1, 1)
        v = x - prev if hp else x
        prev = x
        out.append(v * math.exp(-decay * i / SR) * gain)
    return out


def lowpass(samples, cutoff):
    a = 1 - math.exp(-2 * math.pi * cutoff / SR)
    y, out = 0.0, []
    for x in samples:
        y += a * (x - y)
        out.append(y)
    return out


MUSIC = [0.0] * len(L)
BPM = 120
BEAT = 60 / BPM
CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]  # C G Am F
ROOTS = [36, 31, 33, 29]

# Intro (bored Max): a slow, sad minor plink.
for k, m in enumerate([57, 55, 52, 50]):
    add(MUSIC, 0.2 + k * 0.62, tone(note(m), 0.9, "sin", 3.0, 0.16))

# Main groove from Minnie's entrance until the gasp.
GROOVE_START, GROOVE_END = 2.85, 27.55
t = GROOVE_START
beat = 0
while t < GROOVE_END:
    bar = int((t - GROOVE_START) / (4 * BEAT)) % 4
    if beat % 2 == 0:
        add(MUSIC, t, kick())
    if beat % 4 in (1, 3):
        add(MUSIC, t, noise(0.12, 30, 0.18))  # clap-ish snare
        for m in CHORDS[bar]:
            add(MUSIC, t, tone(note(m + 12), 0.22, "tri", 14, 0.07))
    add(MUSIC, t, noise(0.03, 120, 0.06))
    add(MUSIC, t + BEAT / 2, noise(0.03, 120, 0.05))
    root = ROOTS[bar]
    add(MUSIC, t, lowpass(tone(note(root + 12), BEAT * 0.45, "sq", 5, 0.12), 700))
    add(MUSIC, t + BEAT / 2, lowpass(tone(note(root + 24), BEAT * 0.4, "sq", 6, 0.08), 900))
    t += BEAT
    beat += 1

# Lead hook while the features fly in.
melody = [72, 74, 76, 79, 76, 79, 81, 79, 76, 74, 72, 74, 76, 72, 74, 79]
for k, m in enumerate(melody):
    add(MUSIC, 15.2 + k * BEAT / 2, tone(note(m), 0.2, "sq", 12, 0.05))

# End card stinger.
for m in [60, 64, 67, 72, 76]:
    add(MUSIC, 28.35, tone(note(m), 1.6, "tri", 1.8, 0.09))
add(MUSIC, 28.35, kick(1.0))

# ---------- sound effects ----------

def sweep(t0, dur, f_from, f_to, gain, shape="sin"):
    n = int(dur * SR)
    ph, out = 0.0, []
    for i in range(n):
        f = f_from * (f_to / f_from) ** (i / n)
        ph += f / SR
        v = math.sin(2 * math.pi * ph) if shape == "sin" else (4 * abs(ph % 1 - 0.5) - 1)
        out.append(v * math.sin(math.pi * i / n) * gain)
    add(L, t0, out)


def whoosh(t0, dur=0.5, gain=0.35):
    n = int(dur * SR)
    out, y = [], 0.0
    for i in range(n):
        cutoff = 300 + 5000 * math.sin(math.pi * i / n)
        a = 1 - math.exp(-2 * math.pi * cutoff / SR)
        y += a * (rng.uniform(-1, 1) - y)
        out.append(y * math.sin(math.pi * i / n) * gain)
    add(L, t0, out)


def pop(t0, f=600, gain=0.3):
    sweep(t0, 0.09, f, f * 2.2, gain)


whoosh(2.75, 0.55, 0.5)                       # Minnie zooms in
sweep(8.95, 0.7, 180, 40, 0.7)                # BOOM
add(L, 8.95, noise(0.6, 6, 0.35, hp=False))
for k in range(8):                            # bananas raining
    pop(12.95 + k * 0.17, 500 + 90 * k, 0.16)
for k, tt in enumerate([15.2, 16.25, 17.35, 18.35]):
    pop(tt, 520 + 140 * k, 0.32)
sweep(17.35, 0.5, 900, 200, 0.18, "tri")      # upside-down flip
whoosh(21.2, 0.35, 0.3)                       # swipe
whoosh(21.9, 0.35, 0.3)
sweep(27.5, 0.35, 1400, 120, 0.3, "tri")      # record scratch...
add(L, 27.5, noise(0.3, 9, 0.25))
for k in range(6):                            # sparkle on the end card
    pop(28.35 + k * 0.09, 1500 + 200 * k, 0.12)

# ---------- dialogue + mix ----------

syllables = []
for (a, b, who, text) in LINES:
    syllables += babble(who, a, b, text)

# Duck the music under dialogue.
duck = [1.0] * len(L)
for (a, b, _, _) in LINES:
    i0, i1 = int((a - 0.1) * SR), int((b + 0.15) * SR)
    for i in range(max(0, i0), min(len(L), i1)):
        duck[i] = 0.5

fade_out = int(0.6 * SR)
peak = 0.0
mix = []
for i in range(len(L)):
    v = L[i] + MUSIC[i] * duck[i]
    if i > len(L) - fade_out:
        v *= (len(L) - i) / fade_out
    mix.append(v)
    peak = max(peak, abs(v))
norm = 0.89 / peak if peak else 1.0

os.makedirs(OUT, exist_ok=True)
with wave.open(os.path.join(OUT, "audio.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for v in mix:
        s = int(max(-1.0, min(1.0, math.tanh(v * norm * 1.1))) * 32767)
        frames += struct.pack("<hh", s, s)
    w.writeframes(bytes(frames))

with open(os.path.join(OUT, "timeline.json"), "w", encoding="utf-8") as f:
    json.dump({"length": LENGTH, "lines": [{"start": a, "end": b, "who": w, "text": t} for a, b, w, t in LINES],
               "syllables": syllables}, f, ensure_ascii=False, indent=1)
print("wrote audio.wav and timeline.json:", len(syllables), "syllables")
