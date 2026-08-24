#!/usr/bin/env python3
"""Ljudspår till reklamfilmen Fejksjuk — inklusive hejdåsången. Kräver numpy."""
import numpy as np, wave, struct

SR = 44100
DUR = 48.0
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


# ---------- toner för sången ----------
N = {'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.0, 'A3': 220.0, 'B3': 246.94,
     'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.0, 'A4': 440.0, 'B4': 493.88,
     'C5': 523.25, 'A2': 110.0, 'F2': 87.31, 'G2': 98.0}

def sing(t0, f, dur, gain=0.15):
    """Melodistämma med mjuk ansats — sjungande snarare än pipande"""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2*np.pi*5.2*tt)
    w = (np.sin(2*np.pi*f*tt*vib)
         + 0.34*np.sin(4*np.pi*f*tt*vib)
         + 0.14*np.sin(6*np.pi*f*tt*vib))
    add(t0, w * env(n, 0.05, dur*0.45), gain)
    add(t0, np.sin(2*np.pi*(f/2)*tt) * env(n, 0.06, dur*0.5), gain*0.3)

def arp(t0, chord, dur=2.0, gain=0.055):
    """Ackordet som brutna toner under melodin"""
    step = dur / 8
    order = [0, 1, 2, 1, 0, 1, 2, 1]
    for i, oi in enumerate(order):
        add(t0 + i*step, tone(N[chord[oi]], step*1.6, 'tri', 0.02, step*1.2), gain)

def bass(t0, note, dur=2.0, gain=0.09):
    add(t0, tone(N[note], dur*0.9, 'sine', 0.03, dur*0.5), gain)

def clap(t0, gain=0.05):
    add(t0, noise(0.06, 0.05), gain)

# 2.6 s — lampan tänds och surrar mot termometern
add(2.6, noise(0.04, 0.03), 0.10)
hum = int(4.6*SR); ht = np.arange(hum)/SR
add(2.7, np.sin(2*np.pi*118*ht) * (0.6+0.4*np.sin(2*np.pi*3*ht)) * env(hum, 0.3, 1.2), 0.045)

# 7.6 s — termometern piper klart: tjugo grader
add(7.6, tone(1568, 0.12, 'tri'), 0.14)
add(7.85, tone(1568, 0.12, 'tri'), 0.14)
add(8.2, sweep(660, 300, 0.6), 0.10)

# 8.8 s — MAMMA! Jag är jättesjuk!
add(8.8, sweep(320, 520, 0.35), 0.12)
add(9.2, sweep(520, 300, 0.5), 0.12)

# 10.2 s — hemma i tystnaden: klockan tickar
for i in range(9):
    add(10.2 + i*0.26, tone(1200 if i % 2 == 0 else 900, 0.05, 'sine', 0.004, 0.04), 0.045)

# 12.4 s — övergång till skolan
add(12.4, sweep(200, 760, 0.7), 0.11)

# 13.6–25.6 s — roliga aktiviteter
notes_fun = [523.25, 659.25, 783.99, 987.77, 783.99, 659.25]
tp, i = 13.8, 0
while tp < 25.4:
    f = notes_fun[i % len(notes_fun)]
    add(tp, tone(f, 0.22, 'tri', 0.01, 0.14), 0.062)
    add(tp, tone(f/2, 0.22, 'sine', 0.01, 0.14), 0.035)
    if i % 2 == 0:
        clap(tp + 0.11, 0.03)
    tp += 0.24
    i += 1
add(16.5, tone(1318.5, 0.3, 'tri'), 0.12)      # hjulet stannar
add(19.8, tone(1046.5, 0.26, 'tri'), 0.11)     # bingo
add(23.2, tone(1318.5, 0.3, 'tri'), 0.11)      # poäng

# ---------- 26,4–35,0 s: hejdåsången ----------
# Upptakt
sing(26.4, N['D4'], 0.45, 0.12)
melody = [
    ('G4', 'C'), ('G4', None), ('A4', None), ('G4', None),      # Hej då, hej då — tack för idag!
    ('E4', 'Am'), ('E4', None), ('D4', None), ('C4', None),     # Vi ses igen imorgon.
    ('F4', 'F'), ('F4', None), ('E4', None), ('D4', None),      # Ta med ditt skratt …
    ('D4', 'G'), ('E4', None), ('C4', None), ('C4', None)       # … en gång till!
]
CHORDS = {'C': ['C3', 'E3', 'G3'], 'Am': ['A2', 'C3', 'E3'], 'F': ['F2', 'A3', 'C4'], 'G': ['G2', 'B3', 'D4']}
BASS = {'C': 'C3', 'Am': 'A2', 'F': 'F2', 'G': 'G2'}
for i, (note, chord) in enumerate(melody):
    t0 = 27.0 + i * 0.5
    sing(t0, N[note], 0.46 if i % 4 != 3 else 0.9, 0.155)
    if chord:
        arp(t0, CHORDS[chord], 2.0)
        bass(t0, BASS[chord], 2.0)
    if i % 2 == 1:
        clap(t0, 0.045)
# avslutande ackord
arp(35.0, CHORDS['C'], 1.6, 0.05)
bass(35.0, 'C3', 1.6, 0.08)
sing(35.0, N['C4'], 1.4, 0.12)
sing(35.0, N['E4'], 1.4, 0.07)
sing(35.0, N['G4'], 1.4, 0.05)

# 36.6 s — klassen går ut
add(36.6, sweep(420, 180, 0.6), 0.09)
# 38.2 s — tomt klassrum
add(38.2, tone(196, 1.2, 'sine', 0.2, 1.0), 0.05)

# 39.9 s — Elias fattar att han missat allt
for i, f in enumerate([440, 392, 329.63, 293.66]):
    add(39.9 + i*0.26, tone(f, 0.34, 'tri'), 0.11)
# 42.8 s — men imorgon då!
add(42.8, tone(392, 0.26, 'tri'), 0.12)
add(43.1, tone(523.25, 0.26, 'tri'), 0.12)
add(43.4, tone(659.25, 0.42, 'tri'), 0.13)
add(43.8, tone(783.99, 0.5, 'tri'), 0.12)

# 45.0 s — mjuk övergång till slutkortet
add(45.0, tone(261.63, 1.4, 'sine', 0.3, 1.1), 0.055)

# 46.2 s — slutkort med en repris av sångens första fras
for i, note in enumerate(['G4', 'G4', 'A4', 'G4']):
    sing(46.3 + i*0.42, N[note], 0.4, 0.12)
arp(46.3, CHORDS['C'], 1.7, 0.05)
bass(46.3, 'C3', 1.7, 0.08)

# mjuk begränsning och normalisering
buf = np.tanh(buf * 1.2)
buf = buf / max(1e-9, np.max(np.abs(buf))) * 0.82
stereo = np.stack([buf, buf], axis=1)
data = (stereo * 32767).astype(np.int16)

import os
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ljud5.wav')
with wave.open(out, 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(data.tobytes())
print('ljud klart:', out, round(len(buf)/SR, 1), 's')
