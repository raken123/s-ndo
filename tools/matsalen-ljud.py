#!/usr/bin/env python3
"""Ljudspår till reklamfilmen Matsalen — sorlet följer filmens ljudkurva. Kräver numpy."""
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


# ---------- matsalssorl som följer filmens ljudkurva ----------
def noise_at(t):
    """Samma kurva som i filmen: stiger, larmar, lugnar sig"""
    if t < 1.5: return 42
    if t < 6.2: return 42 + (86 - 42) * (1 - (1 - (t - 1.5) / 4.7) ** 2)
    if t < 7.6: return 86
    if t < 10.2: return 86 - (86 - 38) * ((t - 7.6) / 2.6)
    if t < 27.5: return 40
    if t < 29.2: return 40 + 32 * ((t - 27.5) / 1.7)
    if t < 31.5: return 72 - 32 * ((t - 29.2) / 2.3)
    return 40

def chatter(t0, dur, level):
    """Sorl: korta bandbegränsade brus-utbrott, som röster på avstånd"""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    base = np.random.uniform(-1, 1, n)
    # enkel lågpass så det låter som prat och inte som brus
    k = 40
    base = np.convolve(base, np.ones(k)/k, mode='same')
    mod = 0.5 + 0.5 * np.sin(2*np.pi*3.1*tt + np.sin(2*np.pi*0.7*tt)*2)
    lvl = np.array([noise_at(t0 + x) for x in tt]) / 100.0
    add(t0, base * mod * lvl * env(n, 0.3, 0.6), level)

chatter(0.2, 11.0, 0.55)
chatter(11.4, 16.5, 0.30)
chatter(27.6, 4.4, 0.45)
chatter(32.2, 4.0, 0.22)

# 7.0 s — skärmen säger till: appens gula varningston
add(7.0, tone(392, 0.26, 'square'), 0.15)
add(7.35, tone(392, 0.26, 'square'), 0.15)
add(7.8, sweep(900, 300, 0.8), 0.07)

# 11.8 s — nästa klass släpps fram i kön
add(11.8, tone(1046.5, 0.22, 'tri'), 0.13)
add(12.05, tone(1318.5, 0.3, 'tri'), 0.12)
# 13.2 s — den som försökte tränga sig får gå tillbaka
add(13.2, tone(330, 0.22, 'tri'), 0.11)
add(13.45, tone(294, 0.32, 'tri'), 0.11)

# 16.9 s — dagens fråga vid bordet
add(16.9, tone(587.33, 0.28, 'tri'), 0.12)
add(17.2, tone(880, 0.36, 'tri'), 0.11)

# 23.4–28.6 s — rösterna tickar in
tp = 23.4
while tp < 28.6:
    add(tp, tone(880 + (tp*53 % 300), 0.06, 'sine'), 0.06)
    tp += 0.19
# 28.9 s — tacos vinner
for i, f in enumerate([523.25, 659.25, 783.99, 1046.5, 1318.5]):
    add(28.9 + i*0.12, tone(f, 0.3, 'tri'), 0.15)
for i in range(16):
    add(29.2 + i*0.07, noise(0.05, 0.04), 0.07)

# 31.0 s — två minuter kvar
add(31.0, tone(659.25, 0.26, 'tri'), 0.12)
add(31.3, tone(523.25, 0.34, 'tri'), 0.12)
# 33.2 s — brickorna ställs in
for i in range(7):
    add(33.2 + i*0.42, tone(1400 + (i % 3)*180, 0.07, 'sine'), 0.055)

# 36.4 s — slutkort
for i, f in enumerate([659.25, 880, 1318.5]):
    add(36.5 + i*0.16, tone(f, 0.45, 'tri', 0.01, 0.35), 0.16)
add(37.1, tone(329.63, 1.5, 'sine', 0.05, 1.2), 0.05)
# mjuk avslutning under slutkortet
for f in [261.63, 329.63, 392.0]:
    add(38.0, tone(f, 3.0, 'sine', 0.6, 2.4), 0.045)

# mjuk begränsning och normalisering
buf = np.tanh(buf * 1.2)
buf = buf / max(1e-9, np.max(np.abs(buf))) * 0.82
stereo = np.stack([buf, buf], axis=1)
data = (stereo * 32767).astype(np.int16)

import os
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ljud6.wav')
with wave.open(out, 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(data.tobytes())
print('ljud klart:', out, round(len(buf)/SR, 1), 's')
