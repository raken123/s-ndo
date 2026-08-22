#!/usr/bin/env python3
"""Ljudspår till reklamfilmen. Kräver numpy."""
import numpy as np, wave, struct

SR = 44100
DUR = 39.0
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

# 4.2 s — skivan stannar när skriket kommer
add(4.15, sweep(900, 120, 0.45), 0.22)
add(4.15, noise(0.25, 0.2) * 0.5, 0.10)

# 6.4–8.2 s — cringe-nivån klättrar
add(6.4, sweep(280, 900, 1.7) * (0.6 + 0.4*np.sin(np.linspace(0, 40, int(1.7*SR)))), 0.13)

# 8.2 s — appens larm: 1480/1180 Hz fyrkantvåg, som i koden
for k in range(5):
    add(8.2 + k*0.9, tone(1480, 0.26, 'square'), 0.16)
    add(8.5 + k*0.9, tone(1180, 0.26, 'square'), 0.16)

# 13.8 s — installationskortet dyker upp
add(13.8, tone(620, 0.18, 'tri'), 0.16)
# 14.7 s — fingret trycker
add(14.68, noise(0.05, 0.04), 0.10)
add(14.70, tone(1000, 0.09, 'tri'), 0.16)
# 14.8–16.3 s — installationen surrar fram
prog = int(1.5*SR)
tt = np.arange(prog)/SR
add(14.8, np.sin(2*np.pi*200*tt) * (0.5+0.5*np.sin(2*np.pi*6*tt)) * env(prog, 0.15, 0.3), 0.07)
# 16.4 s — klart
for i, f in enumerate([880, 1174, 1568]):
    add(16.4 + i*0.13, tone(f, 0.2, 'tri'), 0.17)

# 17.8–27 s — lekfull slinga medan klassen har roligt
notes = [523.25, 659.25, 783.99, 987.77, 783.99, 659.25]
tpos = 17.8
i = 0
while tpos < 27.0:
    f = notes[i % len(notes)]
    add(tpos, tone(f, 0.22, 'tri', 0.01, 0.14), 0.075)
    add(tpos, tone(f/2, 0.22, 'sine', 0.01, 0.14), 0.045)
    tpos += 0.23
    i += 1

# 28.4 s — dörren öppnas
add(28.4, sweep(160, 420, 0.5), 0.10)
# 30.5 s — läraren tar emot
add(30.5, tone(587.33, 0.3, 'tri'), 0.12)
add(30.75, tone(880, 0.35, 'tri'), 0.12)

# 33.6 s — slutkortet
for i, f in enumerate([659.25, 880, 1318.5]):
    add(33.6 + i*0.16, tone(f, 0.45, 'tri', 0.01, 0.35), 0.16)
add(34.3, tone(1318.5/2, 1.6, 'sine', 0.05, 1.2), 0.06)

# mjuk begränsning och normalisering
buf = np.tanh(buf * 1.2)
buf = buf / max(1e-9, np.max(np.abs(buf))) * 0.82
stereo = np.stack([buf, buf], axis=1)
data = (stereo * 32767).astype(np.int16)

import os
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ljud.wav')
with wave.open(out, 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(data.tobytes())
print('ljud klart:', out, round(len(buf)/SR, 1), 's')
