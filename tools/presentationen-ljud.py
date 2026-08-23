#!/usr/bin/env python3
"""Ljudspår till reklamfilmen Presentationen. Kräver numpy."""
import numpy as np, wave, struct

SR = 44100
DUR = 41.0
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


# 1.0 s — lugn morgonton, redovisningsdag
for i, f in enumerate([392, 523.25, 659.25]):
    add(1.0 + i*0.22, tone(f, 0.3, 'tri', 0.01, 0.22), 0.09)

# 3.8 s — hon rotar i väskan
for i in range(6):
    add(3.8 + i*0.22, noise(0.07, 0.05), 0.05)
# 5.4 s — insikten: allt ligger hemma
add(5.4, sweep(520, 180, 0.9), 0.14)

# 9.8 s — läraren: lugn, vi löser det
add(9.8, tone(523.25, 0.28, 'tri'), 0.12)
add(10.1, tone(659.25, 0.34, 'tri'), 0.12)
# 10.3 s — turordningen byter plats
add(10.3, tone(1000, 0.07, 'tri'), 0.12)
add(10.6, tone(880, 0.16, 'tri'), 0.10)
add(10.85, tone(1046.5, 0.22, 'tri'), 0.11)

# 13.6 s — timern startar
add(13.6, tone(1174.66, 0.2, 'tri'), 0.12)
# 15.4 s — AI-Läraren plockar fram punkterna, en i taget
for i in range(5):
    add(15.5 + i*0.42, tone(659.25 + i*70, 0.16, 'sine'), 0.08)
add(17.8, tone(1568, 0.3, 'tri'), 0.13)

# 19.4 s — Milo redovisar, dämpad bakgrund
tp, i = 19.4, 0
while tp < 24.0:
    add(tp, tone([392, 440, 523.25][i % 3], 0.3, 'sine', 0.02, 0.24), 0.035)
    tp += 0.6
    i += 1

# 26.0 s — Veras tur: stödorden tonar in
for i in range(5):
    add(26.1 + i*0.26, tone(523.25 + i*90, 0.18, 'tri'), 0.08)
# 30.0 s — applåder
for i in range(26):
    add(30.0 + i*0.075 + (i % 3)*0.012, noise(0.05, 0.04), 0.09)
# 30.5 s — stjärnan
add(30.5, tone(1318.5, 0.34, 'tri'), 0.14)

# 33.2 s — läxan står kvar på tavlan
add(33.2, tone(1000, 0.08, 'tri'), 0.11)
add(33.5, tone(587.33, 0.3, 'tri'), 0.12)
add(33.8, tone(880, 0.42, 'tri'), 0.12)

# 37.2 s — slutkortet
for i, f in enumerate([659.25, 880, 1318.5]):
    add(37.2 + i*0.16, tone(f, 0.45, 'tri', 0.01, 0.35), 0.16)
add(37.9, tone(329.63, 1.5, 'sine', 0.05, 1.2), 0.05)

# mjuk begränsning och normalisering
buf = np.tanh(buf * 1.2)
buf = buf / max(1e-9, np.max(np.abs(buf))) * 0.82
stereo = np.stack([buf, buf], axis=1)
data = (stereo * 32767).astype(np.int16)

import os
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ljud4.wav')
with wave.open(out, 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(data.tobytes())
print('ljud klart:', out, round(len(buf)/SR, 1), 's')
