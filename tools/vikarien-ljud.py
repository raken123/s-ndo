#!/usr/bin/env python3
"""Ljudspår till reklamfilmen Vikarien. Kräver numpy."""
import numpy as np, wave, struct

SR = 44100
DUR = 44.0
buf = np.zeros(int(SR * DUR))

def env(n, a=0.01, r=0.05):
    e = np.ones(n)
    ai, ri = int(a * SR), int(r * SR)
    if ai: e[:ai] = np.linspace(0, 1, ai)
    if ri: e[-ri:] = np.linspace(1, 0, ri)
    return e

def add(t, samples, gain=1.0):
    i = int(t * SR)
    n = min(len(samples), len(buf) - i)
    if n > 0:
        buf[i:i+n] += samples[:n] * gain

def tone(f, dur, kind='sine', a=0.01, r=0.06):
    n = int(dur * SR)
    t = np.arange(n) / SR
    if kind == 'square':
        w = np.sign(np.sin(2*np.pi*f*t))
    elif kind == 'tri':
        w = 2*np.abs(2*(t*f - np.floor(t*f+0.5))) - 1
    else:
        w = np.sin(2*np.pi*f*t)
    return w * env(n, a, r)

def sweep(f0, f1, dur, kind='sine'):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = np.linspace(f0, f1, n)
    ph = 2*np.pi*np.cumsum(f)/SR
    w = np.sign(np.sin(ph)) if kind == 'square' else np.sin(ph)
    return w * env(n, 0.02, 0.1)

def noise(dur, r=0.05):
    n = int(dur * SR)
    return np.random.uniform(-1, 1, n) * env(n, 0.005, r)


# 0.6 s — dörren öppnas och vikarien kliver in
add(0.6, sweep(150, 420, 0.55), 0.10)

# 4.9 s — "Vi brukar ha rast nu!" — busigt litet motiv
add(4.9, tone(523.25, 0.18, 'tri'), 0.13)
add(5.08, tone(659.25, 0.26, 'tri'), 0.13)

# 9.3 s — hon trycker på tavlan, schemat avslöjar dem
add(9.3, tone(1000, 0.08, 'tri'), 0.14)
for i, f in enumerate([784, 587.33, 392]):
    add(9.6 + i*0.19, tone(f, 0.3, 'tri'), 0.15)

# 11.4 s — "Åhhh…"
add(11.4, sweep(420, 240, 0.7), 0.12)

# 14.6 s — grupperna slumpas fram
add(14.6, tone(1000, 0.07, 'tri'), 0.13)
for i, f in enumerate([523.25, 659.25, 783.99, 987.77]):
    add(15.0 + i*0.26, tone(f, 0.2, 'tri'), 0.11)

# 20.8 s — ljudnivån klättrar, gult läge, och lugnar sig igen
add(20.8, sweep(240, 560, 1.6), 0.09)
add(22.5, tone(392, 0.24, 'square'), 0.13)
add(22.85, tone(392, 0.24, 'square'), 0.13)
add(23.8, tone(659.25, 0.26, 'tri'), 0.12)
add(24.05, tone(880, 0.36, 'tri'), 0.12)

# 25.2 s — en hand i luften
add(25.2, tone(1174.66, 0.22, 'tri'), 0.12)
# 26.9 s — hon trycker på AI-Läraren, som läser arbetsboken
add(26.9, tone(1000, 0.08, 'tri'), 0.13)
for i in range(3):
    add(27.7 + i*0.3, tone(660 + i*60, 0.12, 'sine'), 0.07)
for i, f in enumerate([880, 1174.66, 1568]):
    add(28.7 + i*0.14, tone(f, 0.22, 'tri'), 0.15)

# 31.6–36.4 s — lektionen rullar på
notes = [523.25, 659.25, 783.99, 987.77, 783.99, 659.25]
tpos, i = 31.6, 0
while tpos < 36.4:
    f = notes[i % len(notes)]
    add(tpos, tone(f, 0.22, 'tri', 0.01, 0.14), 0.07)
    add(tpos, tone(f/2, 0.22, 'sine', 0.01, 0.14), 0.04)
    tpos += 0.24
    i += 1
# 33.3 s — hjulet stannar
add(33.3, tone(1318.5, 0.3, 'tri'), 0.14)

# 36.9 s — lektionen är slut, samma signal som appen spelar
for k in range(3):
    add(36.9 + k*0.3, tone(880 if k % 2 == 0 else 1174.66, 0.22), 0.15)

# 39.8 s — "Hur gick det?"
add(39.8, tone(587.33, 0.26, 'tri'), 0.11)
# 41.6 s — "Bäst hittills."
add(41.6, tone(783.99, 0.24, 'tri'), 0.12)
add(41.85, tone(1046.5, 0.4, 'tri'), 0.12)

# 43.7 s — slutkortet
for i, f in enumerate([659.25, 880, 1318.5]):
    add(43.7 + i*0.16, tone(f, 0.45, 'tri', 0.01, 0.35), 0.16)
add(44.0, tone(659.25, 1.2, 'sine', 0.05, 1.0), 0.05)

# mjuk begränsning och normalisering
buf = np.tanh(buf * 1.2)
buf = buf / max(1e-9, np.max(np.abs(buf))) * 0.82
stereo = np.stack([buf, buf], axis=1)
data = (stereo * 32767).astype(np.int16)

import os
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ljud2.wav')
with wave.open(out, 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(data.tobytes())
print('ljud klart:', out, round(len(buf)/SR, 1), 's')
