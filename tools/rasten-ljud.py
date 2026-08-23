#!/usr/bin/env python3
"""Ljudspår till reklamfilmen Rasten. Kräver numpy."""
import numpy as np, wave, struct

SR = 44100
DUR = 42.0
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


def bell(t0, n=2):
    """Skolklockan"""
    for k in range(n):
        add(t0 + k*0.62, tone(1046.5, 0.5, 'sine', 0.005, 0.45), 0.17)
        add(t0 + k*0.62, tone(1568, 0.4, 'sine', 0.005, 0.35), 0.09)

# 0.4 s — rasten ringer in
bell(0.4, 2)
# 1.6 s — glad utomhusstämning
for i, f in enumerate([523.25, 659.25, 783.99]):
    add(1.6 + i*0.22, tone(f, 0.26, 'tri', 0.01, 0.18), 0.09)

# 4.9 s — bråket om lagen
add(4.9, tone(329.63, 0.28, 'tri'), 0.13)
add(5.15, tone(311.13, 0.34, 'tri'), 0.13)

# 9.0 s — hon tar fram plattan och slumpar lagen
add(9.0, tone(1000, 0.08, 'tri'), 0.13)
for i, f in enumerate([523.25, 659.25, 783.99, 987.77]):
    add(9.9 + i*0.28, tone(f, 0.2, 'tri'), 0.11)

# 15.8 s — namnet rullar och stannar
tp = 15.8
while tp < 17.1:
    add(tp, tone(700 + (tp*37 % 400), 0.07, 'sine'), 0.07)
    tp += 0.11
add(17.2, tone(1318.5, 0.3, 'tri'), 0.15)

# 17.9 s — avspark
add(17.9, noise(0.09, 0.06), 0.14)
add(17.95, tone(180, 0.12, 'sine'), 0.12)
# 20.5 s — mål
for i, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
    add(20.5 + i*0.13, tone(f, 0.26, 'tri'), 0.15)

# 26.8 s — dagens fråga på bänken
add(26.8, tone(1000, 0.08, 'tri'), 0.12)
add(27.1, tone(587.33, 0.3, 'tri'), 0.12)
add(27.4, tone(880, 0.4, 'tri'), 0.12)
# 30.0 s — de börjar prata
add(30.0, tone(659.25, 0.28, 'tri'), 0.10)
add(30.3, tone(987.77, 0.38, 'tri'), 0.10)

# 31.5 s — rasten ringer ut
bell(31.5, 2)
# 33.6 s — alla ställer sig i led
for i, f in enumerate([783.99, 659.25, 523.25]):
    add(33.6 + i*0.24, tone(f, 0.3, 'tri'), 0.11)

# 36.6 s — slutkortet
for i, f in enumerate([659.25, 880, 1318.5]):
    add(36.6 + i*0.16, tone(f, 0.45, 'tri', 0.01, 0.35), 0.16)
add(37.2, tone(329.63, 1.6, 'sine', 0.05, 1.3), 0.05)

# mjuk begränsning och normalisering
buf = np.tanh(buf * 1.2)
buf = buf / max(1e-9, np.max(np.abs(buf))) * 0.82
stereo = np.stack([buf, buf], axis=1)
data = (stereo * 32767).astype(np.int16)

import os
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ljud3.wav')
with wave.open(out, 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(data.tobytes())
print('ljud klart:', out, round(len(buf)/SR, 1), 's')
