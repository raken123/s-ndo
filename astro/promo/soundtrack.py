"""Syntetiserar ljudspåret till Astro-reklamfilmen (30 s, 44,1 kHz stereo WAV).

Ingen ljudfil behövs: ambient-matta, nedräkningspip, raketmuller, arpeggio,
warp-sus och slutackord skapas med enkla oscillatorer.
    python3 soundtrack.py utfil.wav
"""
import math
import random
import struct
import sys
import wave

SR = 44100
DUR = 30.0
N = int(SR * DUR)
L = [0.0] * N
R = [0.0] * N
random.seed(4)

# Händelser (sekunder) – följer tagningarna i trailer.js
COUNT_BEEPS = [3.5, 3.5 + 3.2 / 3, 3.5 + 2 * 3.2 / 3]
LIFTOFF = 6.7
COCKPIT = 10.5
MOON = 15.0
SATURN = 19.5
WARP = 23.5
END = 26.5


def env(t, a, d_start, d_len):
    """Attack a sekunder, sedan ut-toning som börjar vid d_start."""
    if t < 0:
        return 0.0
    g = min(1.0, t / a) if a > 0 else 1.0
    if t > d_start:
        g *= max(0.0, 1 - (t - d_start) / d_len)
    return g


def add(i, l, r):
    if 0 <= i < N:
        L[i] += l
        R[i] += r


def note(start, dur, freq, vol, pan=0.0, kind='sine', attack=0.005, release=None):
    release = dur if release is None else release
    s0 = int(start * SR)
    n = int((dur + release) * SR)
    ph = 0.0
    step = 2 * math.pi * freq / SR
    for k in range(n):
        t = k / SR
        g = env(t, attack, dur * 0.2, dur * 0.8 + release) * vol
        if g <= 0:
            continue
        if kind == 'pluck':
            v = math.sin(ph) * math.exp(-t * 6) + 0.3 * math.sin(2 * ph) * math.exp(-t * 10)
        elif kind == 'tri':
            v = 2 / math.pi * math.asin(math.sin(ph))
        else:
            v = math.sin(ph)
        ph += step
        add(s0 + k, v * g * (1 - pan) * 0.5 + v * g * 0.5, v * g * (1 + pan) * 0.5 + v * g * 0.5)


def pad(start, end, freqs, vol, fade_in=2.0, fade_out=2.0):
    s0, s1 = int(start * SR), int(end * SR)
    phases = [random.random() * 6.28 for _ in freqs] * 2
    for k in range(s0, min(s1, N)):
        t = (k - s0) / SR
        g = min(1, t / fade_in) * min(1, (end - start - t) / fade_out) * vol
        lv = rv = 0.0
        for j, f in enumerate(freqs):
            # två lätt ostämda röster per ton ger bredd
            lv += math.sin(phases[j] + 2 * math.pi * f * 0.998 * t)
            rv += math.sin(phases[j + len(freqs)] + 2 * math.pi * f * 1.002 * t)
        lfo = 0.8 + 0.2 * math.sin(2 * math.pi * 0.2 * t)
        add(k, lv * g * lfo / len(freqs), rv * g * lfo / len(freqs))


def noise_swell(start, end, vol, cutoff_from, cutoff_to, brown=False):
    s0, s1 = int(start * SR), int(end * SR)
    y = yb = 0.0
    for k in range(s0, min(s1, N)):
        u = (k - s0) / max(1, s1 - s0)
        cut = cutoff_from + (cutoff_to - cutoff_from) * u
        a = 1 - math.exp(-2 * math.pi * cut / SR)
        x = random.uniform(-1, 1)
        if brown:
            yb = (yb + 0.02 * x) / 1.02
            x = yb * 12
        y += a * (x - y)
        g = math.sin(math.pi * min(1, u * 1.3)) ** 1.5 * vol
        add(k, y * g, y * g * 0.95)


def kick(t0, vol=0.6):
    s0 = int(t0 * SR)
    ph = 0.0
    for k in range(int(0.35 * SR)):
        t = k / SR
        f = 45 + 90 * math.exp(-t * 30)
        ph += 2 * math.pi * f / SR
        v = math.sin(ph) * math.exp(-t * 9) * vol
        add(s0 + k, v, v)


# --- Ambient-matta (A-moll add9) och senare F-dur ---
pad(0.0, SATURN + 0.5, [110.0, 164.81, 246.94, 261.63], 0.22, fade_in=3.0, fade_out=1.5)
pad(SATURN - 0.5, END + 0.3, [87.31, 130.81, 220.0, 261.63], 0.22, fade_in=1.0, fade_out=0.8)
pad(END - 0.2, DUR, [110.0, 164.81, 220.0, 277.18, 329.63], 0.26, fade_in=0.5, fade_out=2.6)

# --- Glitter i introt ---
for i, f in enumerate([1318.5, 1760.0, 1975.5, 2637.0, 1760.0, 2217.5]):
    note(0.6 + i * 0.45, 0.2, f, 0.05, pan=(-0.6 if i % 2 else 0.6), release=1.2)

# --- Nedräkning och uppskjutning ---
for t in COUNT_BEEPS:
    note(t, 0.14, 880, 0.22, kind='tri', release=0.1)
note(LIFTOFF, 0.35, 1320, 0.22, kind='tri', release=0.2)
noise_swell(LIFTOFF - 0.3, COCKPIT + 0.3, 0.55, 60, 900, brown=True)
kick(LIFTOFF, 0.8)

# --- Driv: bas + arpeggio från uppskjutningen ---
BPM = 120
beat = 60 / BPM
bass_roots = [(LIFTOFF, SATURN, 55.0), (SATURN, END, 43.65)]
for a, b, f in bass_roots:
    t = a
    while t < b - 0.01:
        note(t, beat * 0.45, f, 0.30, kind='tri', attack=0.01, release=0.05)
        note(t, beat * 0.45, f * 2, 0.08, kind='sine', attack=0.01, release=0.05)
        t += beat / 2
t = LIFTOFF
while t < END - 0.01:
    kick(t, 0.45)
    t += beat
ARP_A = [440.0, 523.25, 659.26, 987.77, 880.0, 659.26, 523.25, 493.88]
ARP_F = [349.23, 440.0, 523.25, 783.99, 698.46, 523.25, 440.0, 392.0]
t, i = COCKPIT, 0
while t < END - 0.01:
    seq = ARP_A if t < SATURN else ARP_F
    f = seq[i % len(seq)]
    note(t, beat / 4, f, 0.07, pan=0.5 * math.sin(i * 0.7), kind='pluck', release=0.35)
    t += beat / 4
    i += 1

# --- Landning på månen: mjuk klocka ---
for j, f in enumerate([659.26, 987.77, 1318.5]):
    note(MOON + 0.1 + j * 0.12, 0.3, f, 0.09, pan=0.3 * (j - 1), release=1.5)

# --- Warp-sus ---
noise_swell(WARP - 0.4, WARP + 1.8, 0.35, 300, 7000)
noise_swell(WARP + 0.6, WARP + 2.6, 0.2, 5000, 400)

# --- Slut: ackord + klockspel ---
kick(END, 0.9)
for j, f in enumerate([880.0, 1108.73, 1318.5, 1760.0]):
    note(END + 0.2 + j * 0.16, 0.4, f, 0.08, pan=0.4 * (j - 1.5), release=2.2)

# --- Enkelt eko (stereo) ---
for delay, fb in ((0.23, 0.28), (0.37, 0.22)):
    dL, dR = int(delay * SR), int(delay * 1.13 * SR)
    for k in range(N - 1, dR, -1):
        L[k] += L[k - dL] * fb
        R[k] += R[k - dR] * fb

# --- Normalisera, mjuk limiter och toning i slutet ---
peak = max(max(abs(x) for x in L), max(abs(x) for x in R)) or 1.0
out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for k in range(N):
        t = k / SR
        g = min(1.0, (DUR - t) / 1.2) * min(1.0, t / 0.3)
        lv = math.tanh(L[k] / peak * 1.6) * 0.89 * g
        rv = math.tanh(R[k] / peak * 1.6) * 0.89 * g
        frames += struct.pack('<hh', int(lv * 32767), int(rv * 32767))
    w.writeframes(bytes(frames))
print('skrev', out)
