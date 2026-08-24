#!/usr/bin/env python3
"""Ljudspår till de tio reklamfilmerna (Idrotten … Avslutningen).

Ett skript per film blev tio nästan identiska filer, så alla tio ligger här.
Varje film har en cue-funktion som lägger ljud på filmens egna tidpunkter —
samma millisekunder som cap.play()/bubblorna i motsvarande reklam-*.html.

Kräver numpy.  Användning:
    python3 tools/tio-ljud.py [utkatalog]        # alla tio
    python3 tools/tio-ljud.py [utkatalog] idrotten provet   # bara vissa
"""
import numpy as np, wave, os, sys

SR = 44100

# ---------------------------------------------------------------- ljudkit
class Spar:
    def __init__(self, dur):
        self.dur = dur
        self.buf = np.zeros(int(SR * dur))

    def add(self, t, samples, gain=1.0):
        i = int(t * SR)
        if i < 0:
            samples, i = samples[-i:], 0
        n = min(len(samples), len(self.buf) - i)
        if n > 0:
            self.buf[i:i+n] += samples[:n] * gain
        return self

def env(n, a=0.01, r=0.05):
    e = np.ones(n)
    ai, ri = int(a * SR), int(r * SR)
    if ai: e[:ai] = np.linspace(0, 1, ai)
    if ri: e[-ri:] = np.linspace(1, 0, ri)
    return e

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
    f = np.linspace(f0, f1, n)
    ph = 2*np.pi*np.cumsum(f)/SR
    w = np.sign(np.sin(ph)) if kind == 'square' else np.sin(ph)
    return w * env(n, 0.02, 0.1)

def noise(dur, r=0.05):
    n = int(dur * SR)
    return np.random.uniform(-1, 1, n) * env(n, 0.005, r)

def lowpass(x, k=40):
    return np.convolve(x, np.ones(k)/k, mode='same')

N = {'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.0, 'A3': 220.0, 'B3': 246.94,
     'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.0, 'A4': 440.0, 'B4': 493.88,
     'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.0,
     'A2': 110.0, 'F2': 87.31, 'G2': 98.0, 'C2': 65.41, 'D2': 73.42}

def sing(s, t0, f, dur, gain=0.15):
    """Melodistämma med vibrato och två övertoner — sjungande, inte pipande.

    Vibratot måste läggas på den momentana frekvensen och integreras till fas.
    Att i stället gånga in det i fasen (2*pi*f*t*vib) ger ett avdrag som växer
    med t, så tonen glider uppåt — mätt till +45 cent på en halvsekundston.
    """
    n = int(dur * SR)
    tt = np.arange(n) / SR
    inst = f * (1 + 0.006 * np.sin(2*np.pi*5.2*tt))
    ph = 2*np.pi*np.cumsum(inst)/SR
    w = np.sin(ph) + 0.34*np.sin(2*ph) + 0.14*np.sin(3*ph)
    s.add(t0, w * env(n, 0.05, dur*0.45), gain)
    s.add(t0, np.sin(ph/2) * env(n, 0.06, dur*0.5), gain*0.3)

def arp(s, t0, chord, dur=2.0, gain=0.055):
    step = dur / 8
    for i, oi in enumerate([0, 1, 2, 1, 0, 1, 2, 1]):
        s.add(t0 + i*step, tone(N[chord[oi]], step*1.6, 'tri', 0.02, step*1.2), gain)

def bass(s, t0, note, dur=2.0, gain=0.09):
    s.add(t0, tone(N[note], dur*0.9, 'sine', 0.03, dur*0.5), gain)

def rumsljud(s, t0, dur, level=0.25, taly=3.1):
    """Sorl/rumston: lågpassat brus med pratrytm."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    base = lowpass(np.random.uniform(-1, 1, n))
    mod = 0.5 + 0.5 * np.sin(2*np.pi*taly*tt + np.sin(2*np.pi*0.7*tt)*2)
    s.add(t0, base * mod * env(n, 0.4, 0.8), level)

def rumsbotten(s, level=0.05):
    """Grundton för hela filmen: rummet finns kvar även när ingen säger något.
    Utan den blir det digitalt döda sekunder mellan replikerna."""
    n = len(s.buf)
    tt = np.arange(n) / SR
    bed = lowpass(np.random.uniform(-1, 1, n), 160)
    bed *= 0.72 + 0.28 * np.sin(2*np.pi*0.13*tt + 1.1)
    s.add(0, bed * env(n, 0.8, 1.2), level)
    # svag ventilation/nätbrum så tystnaden har en färg
    s.add(0, np.sin(2*np.pi*98*tt) * (0.7 + 0.3*np.sin(2*np.pi*0.21*tt)) * env(n, 1.2, 1.6), level*0.16)
    s.add(0, np.sin(2*np.pi*147*tt) * env(n, 1.6, 2.0), level*0.07)

def rost(s, t0, f0, f1, dur=0.4, gain=0.12):
    """Antydd replik: en tonhöjdskurva, inga ord."""
    s.add(t0, sweep(f0, f1, dur), gain)

def pling(s, t0, f=880.0, dur=0.3, gain=0.12):
    s.add(t0, tone(f, dur, 'tri'), gain)

def uiTva(s, t0, f1=587.33, f2=880.0, gain=0.12):
    """Appens vanliga bekräftelseljud: två toner uppåt."""
    pling(s, t0, f1, 0.26, gain)
    pling(s, t0 + 0.26, f2, 0.34, gain*0.92)

def varning(s, t0, gain=0.14):
    """Gula varningstonen."""
    s.add(t0, tone(392, 0.26, 'square'), gain)
    s.add(t0 + 0.34, tone(392, 0.26, 'square'), gain)

def klapp(s, t0, antal=14, spann=1.1, gain=0.07):
    for i in range(antal):
        s.add(t0 + i*(spann/antal) + np.random.uniform(0, 0.02), noise(0.05, 0.04), gain)

def slutkort(s, t0):
    """Samma avslut som i de sex första filmerna."""
    for i, f in enumerate([N['E5'], N['A5'], 1318.5]):
        s.add(t0 + i*0.16, tone(f, 0.45, 'tri', 0.01, 0.35), 0.16)
    s.add(t0 + 0.6, tone(N['E4'], 1.5, 'sine', 0.05, 1.2), 0.05)
    for f in [N['C4'], N['E4'], N['G4']]:
        s.add(t0 + 1.5, tone(f, 3.0, 'sine', 0.6, 2.4), 0.045)

def skriv(s, t0, dur, takt=0.19, gain=0.055):
    """Röster/svar som tickar in, eller pennor mot papper."""
    tp = t0
    while tp < t0 + dur:
        s.add(tp, tone(880 + (tp*53 % 300), 0.06, 'sine'), gain)
        tp += takt


# ---------------------------------------------------------------- filmerna
def idrotten(s):                       # 40 s — stafett, lagen slumpas
    rumsljud(s, 0.3, 4.5, 0.30, 2.4)   # ekot i gympasalen
    rost(s, 1.6, 300, 420, 0.5)        # kaptenen väljer
    rost(s, 2.6, 420, 300, 0.45)
    rost(s, 4.8, 380, 250, 0.6, 0.10)  # "Sist igen…"
    s.add(6.0, tone(196, 1.6, 'sine', 0.4, 1.2), 0.05)   # tomrummet när hon står kvar
    uiTva(s, 10.4)                                        # lagen slumpas fram
    for i in range(3):                                    # tre lagnamn landar
        pling(s, 10.9 + i*0.5, [N['C5'], N['E5'], N['G5']][i], 0.34, 0.11)
    rumsljud(s, 11.5, 3.5, 0.22, 3.4)
    s.add(15.0, tone(1568, 0.14, 'tri'), 0.16)            # startsignal
    s.add(15.0, noise(0.12, 0.1), 0.10)
    for i in range(26):                                   # språng på golvet
        s.add(15.4 + i*0.46, noise(0.05, 0.035), 0.05)
    rumsljud(s, 15.6, 11.0, 0.26, 4.6)                    # hejarop
    for i in range(3):                                    # varvsignaler
        s.add(19.2 + i*4.2, tone(1046.5, 0.1, 'tri'), 0.10)
    for i in range(9):                                    # "HEJA SARA"
        s.add(23.2 + i*0.4, noise(0.06, 0.05), 0.075)
    s.add(26.8, sweep(700, 1500, 0.4), 0.12)              # mållinjen
    uiTva(s, 27.2, 659.25, 1046.5, 0.14)                  # bästa varv på skärmen
    klapp(s, 27.6, 22, 2.2, 0.075)
    for i, f in enumerate([N['C5'], N['E5'], N['G5'], N['C5']*2]):  # dagens stjärna
        pling(s, 28.9 + i*0.16, f, 0.4, 0.13)
    rumsljud(s, 29.6, 4.0, 0.18, 3.0)
    slutkort(s, 34.6)

def biblioteket(s):                    # 38 s — läsvila, bokval
    s.add(0.2, lowpass(np.random.uniform(-1, 1, int(6.0*SR))) * env(int(6.0*SR), 0.5, 1.5), 0.05)
    for i in range(11):                                   # sidor som bläddras
        s.add(0.9 + i*0.55, noise(0.07, 0.06), 0.045)
    for i in range(7):                                    # viskningarna
        s.add(6.0 + i*0.36, lowpass(np.random.uniform(-1, 1, int(0.22*SR)), 90) * env(int(0.22*SR), 0.03, 0.15), 0.09)
    varning(s, 8.7, 0.11)                                 # ljudmätaren slår till
    s.add(9.3, sweep(800, 300, 0.7), 0.06)
    s.add(10.0, tone(174.61, 2.4, 'sine', 0.6, 1.8), 0.04)  # tyst igen
    rost(s, 12.9, 300, 380, 0.4, 0.08)                    # Noor tvekar
    rost(s, 13.7, 380, 290, 0.45, 0.07)
    uiTva(s, 17.9)                                        # omröstningen öppnar
    skriv(s, 18.2, 4.6, 0.24, 0.05)                       # rösterna tickar in
    for i, f in enumerate([N['C5'], N['E5'], N['G5'], 1046.5]):  # vinnaren
        pling(s, 23.6 + i*0.14, f, 0.36, 0.13)
    klapp(s, 24.2, 12, 1.4, 0.05)                         # dämpade biblioteksklappar
    uiTva(s, 27.8, 659.25, 987.77, 0.12)                  # Noors förslag vann
    rumsljud(s, 28.4, 3.6, 0.14, 2.6)
    slutkort(s, 32.8)

def musiksalen(s):                     # 38 s — luciarep, sång 20.0 s
    for i, f in enumerate([N['C4'], N['E4'], N['G4'], N['C5']]):   # piano-ackord i början
        s.add(0.4 + i*0.1, tone(f, 2.2, 'tri', 0.02, 1.8), 0.06)
    rumsljud(s, 0.6, 4.4, 0.20, 2.2)
    for i, f in enumerate([N['G4'], N['A4'], N['G4'], N['F4'], N['E4']]):  # någon glömmer versen
        sing(s, 1.6 + i*0.42, f, 0.4, 0.10)
    s.add(3.8, sweep(420, 240, 0.6), 0.10)                # …och tystnar
    rost(s, 6.0, 300, 400, 0.5, 0.08)                     # Iris vill men vågar inte
    uiTva(s, 10.4)                                        # turordningen upp
    for i in range(3):
        pling(s, 10.9 + i*0.46, [N['C5'], N['D5'], N['E5']][i], 0.3, 0.10)
    for i, f in enumerate([N['C4'], N['G4'], N['C4'], N['G4']]):   # intro till sången
        s.add(17.4 + i*0.6, tone(f, 0.55, 'tri', 0.03, 0.4), 0.07)
    # luciasången: 12 toner från 20.0 s, 500 ms per ton (SANG/TON i filmen)
    melodi = ['C5', 'C5', 'D5', 'E5', 'E5', 'D5', 'C5', 'D5', 'E5', 'F5', 'E5', 'C5']
    for i, nm in enumerate(melodi):
        sing(s, 20.0 + i*0.5, N[nm], 0.46, 0.15)
        if i % 4 == 0:
            arp(s, 20.0 + i*0.5, ['C4', 'E4', 'G4'] if i % 8 == 0 else ['F4', 'A4', 'C5'], 2.0, 0.05)
            bass(s, 20.0 + i*0.5, 'C3' if i % 8 == 0 else 'F3', 2.0, 0.08)
    klapp(s, 26.2, 18, 1.8, 0.065)
    uiTva(s, 27.4, 659.25, 987.77, 0.12)                  # andra versen gick också bra
    rumsljud(s, 28.0, 4.2, 0.16, 2.8)
    slutkort(s, 33.2)

def slojden(s):                        # 38 s — sågen, kön, limtimer
    rumsljud(s, 0.2, 4.0, 0.22, 2.6)
    for i in range(9):                                    # hammare och verktyg
        s.add(0.8 + i*0.44, noise(0.06, 0.05), 0.065)
    rost(s, 4.2, 320, 460, 0.45, 0.11)                    # "Är det min tur nu?"
    rost(s, 5.4, 320, 460, 0.45, 0.10)
    rost(s, 6.4, 320, 460, 0.45, 0.09)
    uiTva(s, 9.2)                                         # rött ljus tänds
    s.add(9.6, tone(261.63, 0.4, 'square'), 0.09)
    # sågen går 9–21 s: surr med lätt vibrato, tar i när den möter trä
    n = int(12.0*SR); tt = np.arange(n)/SR
    sag = (np.sin(2*np.pi*146*tt) + 0.4*np.sin(2*np.pi*292*tt) + 0.25*lowpass(np.random.uniform(-1, 1, n), 12))
    lyft = 1 + 0.35*np.sin(2*np.pi*0.45*tt) + 0.12*np.sin(2*np.pi*7.0*tt)
    s.add(9.0, sag * lyft * env(n, 0.35, 0.7), 0.055)
    uiTva(s, 15.0, 523.25, 783.99, 0.12)                  # limtimern startar
    for i in range(6):                                    # kön flyttar fram
        pling(s, 16.2 + i*1.1, 1046.5 - i*40, 0.12, 0.055)
    s.add(21.0, sweep(300, 140, 0.9), 0.08)               # sågen stannar
    varning(s, 21.4, 0.10)                                # byte: gult
    uiTva(s, 23.4, 587.33, 880.0, 0.13)                   # grönt igen
    rumsljud(s, 24.0, 5.0, 0.18, 3.0)
    for i in range(7):
        s.add(24.6 + i*0.62, noise(0.06, 0.05), 0.055)
    slutkort(s, 33.6)

def sjukan(s):                         # 36 s — skrubbsår, kylpåse, tillbaka
    for i in range(9):                                    # rastens ljud på avstånd
        s.add(0.3 + i*0.3, noise(0.05, 0.04), 0.04)
    rost(s, 1.4, 520, 300, 0.5, 0.13)                     # "Aj!"
    rost(s, 2.1, 480, 280, 0.4, 0.10)
    rumsljud(s, 2.6, 3.6, 0.14, 2.4)                      # systern lugnar
    s.add(5.4, noise(0.1, 0.09), 0.06)                    # plåstret rivs upp
    s.add(6.6, tone(880, 0.14, 'tri'), 0.09)              # kylpåsen läggs på
    uiTva(s, 7.2, 523.25, 783.99, 0.13)                   # tiominuterstimern startar
    for i in range(22):                                   # klockan tickar på britsen
        s.add(7.8 + i*0.5, tone(1200 if i % 2 == 0 else 900, 0.05, 'sine', 0.004, 0.04), 0.035)
    uiTva(s, 12.6, 587.33, 880.0, 0.12)                   # dagens fråga
    rost(s, 13.4, 300, 400, 0.45, 0.08)
    rost(s, 14.6, 400, 300, 0.5, 0.08)
    s.add(19.9, tone(1568, 0.12, 'tri'), 0.13)            # tio minuter klara
    s.add(20.15, tone(1568, 0.12, 'tri'), 0.13)
    rost(s, 20.6, 330, 520, 0.5, 0.11)                    # "Nu är det bra"
    uiTva(s, 24.0, 659.25, 1046.5, 0.13)                  # närvaron: tillbaka 10:41
    uiTva(s, 25.6, 523.25, 880.0, 0.12)                   # sal 9, bild
    rumsljud(s, 26.2, 3.4, 0.14, 2.8)
    slutkort(s, 31.0)

def forstadagen(s):                    # 36 s — nya klassen, grupper, hej
    rumsljud(s, 0.2, 5.4, 0.30, 2.8)                      # trettio okända röster
    rost(s, 1.8, 300, 420, 0.4, 0.07)
    rost(s, 3.0, 420, 320, 0.4, 0.07)
    s.add(6.2, tone(196, 2.2, 'sine', 0.5, 1.6), 0.045)   # Noor säger inget
    uiTva(s, 11.8)                                        # grupperna slumpas
    for i in range(6):                                    # sex namn landar
        pling(s, 12.2 + i*0.34, [523.25, 587.33, 659.25, 698.46, 783.99, 880.0][i], 0.3, 0.10)
    uiTva(s, 16.9, 587.33, 987.77, 0.12)                  # namnen upp på tavlan
    uiTva(s, 22.5, 523.25, 783.99, 0.12)                  # färdiga frågor
    rost(s, 22.9, 320, 470, 0.45, 0.11)                   # "Hej, jag heter…"
    rost(s, 23.9, 470, 330, 0.5, 0.10)
    rost(s, 25.0, 340, 500, 0.45, 0.10)
    rumsljud(s, 22.8, 6.0, 0.24, 3.6)                     # sorlet blir varmt
    klapp(s, 27.2, 10, 1.2, 0.045)
    slutkort(s, 30.8)

def utvecklingssamtalet(s):            # 38 s — kvällssamtal, AI-Lärarens summering
    s.add(0.2, tone(110, 4.0, 'sine', 0.8, 2.6), 0.035)   # tom skola på kvällen
    for i in range(14):                                   # klockan på väggen
        s.add(0.6 + i*0.52, tone(1100 if i % 2 == 0 else 850, 0.04, 'sine', 0.004, 0.035), 0.03)
    rost(s, 1.6, 300, 380, 0.5, 0.08)                     # hälsningar
    rost(s, 2.6, 380, 300, 0.45, 0.07)
    uiTva(s, 7.0, 523.25, 783.99, 0.12)                   # terminens material fram
    for i in range(5):
        pling(s, 7.6 + i*0.62, 880 - i*70, 0.24, 0.07)
    uiTva(s, 12.2, 587.33, 987.77, 0.13)                  # AI-Läraren startar
    skriv(s, 14.0, 4.4, 0.16, 0.045)                      # texten skrivs ut rad för rad
    rost(s, 20.8, 300, 460, 0.5, 0.10)                    # "Det där visste jag inte"
    rost(s, 22.0, 460, 320, 0.55, 0.09)
    uiTva(s, 25.6, 659.25, 1046.5, 0.13)                  # målet skrivs in
    for i, f in enumerate([N['C5'], N['E5'], N['G5']]):
        pling(s, 26.8 + i*0.2, f, 0.34, 0.10)
    rumsljud(s, 27.4, 4.0, 0.13, 2.2)
    slutkort(s, 33.6)

def provet(s):                         # 38 s — matteprov, exit ticket
    rumsljud(s, 0.2, 3.0, 0.18, 2.4)
    for i in range(6):                                    # papper delas ut
        s.add(0.8 + i*0.33, noise(0.09, 0.08), 0.055)
    s.add(6.0, tone(1046.5, 0.16, 'tri'), 0.13)           # provet startar
    skriv(s, 6.4, 20.0, 0.33, 0.035)                      # pennor mot papper hela provet
    s.add(6.6, tone(87.31, 3.0, 'sine', 0.8, 2.0), 0.03)  # provtystnad
    rost(s, 9.0, 380, 250, 0.6, 0.10)                     # "Jag hinner aldrig…"
    s.add(10.0, sweep(300, 200, 0.8), 0.06)
    uiTva(s, 14.2, 523.25, 783.99, 0.12)                  # tiden på tavlan
    uiTva(s, 16.6, 587.33, 880.0, 0.11)                   # reglerna bredvid
    for i in range(16):                                   # klockan tickar mot slutet
        s.add(19.0 + i*0.5, tone(1200 if i % 2 == 0 else 900, 0.05, 'sine', 0.004, 0.04), 0.03)
    varning(s, 21.2, 0.10)                                # fem minuter kvar
    s.add(26.6, tone(1568, 0.14, 'tri'), 0.13)            # tiden ute
    s.add(26.9, tone(1568, 0.14, 'tri'), 0.13)
    uiTva(s, 27.2, 659.25, 1046.5, 0.13)                  # exit ticket upp
    skriv(s, 27.8, 3.6, 0.2, 0.05)                        # elva svarar
    for i, f in enumerate([N['C5'], N['E5'], N['G5']]):
        pling(s, 31.4 + i*0.18, f, 0.34, 0.11)
    rumsljud(s, 30.0, 3.0, 0.16, 3.0)
    slutkort(s, 33.8)

def fritids(s):                        # 36 s — lyckohjul, poäng, städtimer
    rumsljud(s, 0.2, 6.4, 0.34, 3.2)                      # fritidskaos
    rost(s, 3.0, 320, 480, 0.45, 0.12)                    # "Vad ska vi göra?"
    rost(s, 4.2, 320, 480, 0.4, 0.10)
    rost(s, 5.2, 340, 460, 0.4, 0.09)
    uiTva(s, 7.8)                                         # hjulet startar
    tp, takt = 8.0, 0.055                                 # hjulklicken bromsar in
    while tp < 12.6:
        s.add(tp, tone(1500, 0.03, 'sine', 0.002, 0.026), 0.06)
        takt *= 1.055
        tp += takt
    for i, f in enumerate([N['C5'], N['E5'], N['G5'], 1046.5]):  # Pyssel!
        pling(s, 12.6 + i*0.13, f, 0.38, 0.14)
    klapp(s, 13.0, 12, 1.2, 0.06)
    rumsljud(s, 13.4, 9.0, 0.24, 3.8)                     # pyssel pågår
    for i in range(8):                                    # poäng tickar in
        pling(s, 16.4 + i*0.9, 880 + (i % 3)*160, 0.14, 0.06)
    uiTva(s, 24.6, 523.25, 392.0, 0.13)                   # fem minuter: städa
    for i in range(9):                                    # lådor och lock
        s.add(25.2 + i*0.5, noise(0.07, 0.06), 0.055)
    for i in range(6):                                    # nedräkningen
        s.add(28.0 + i*0.5, tone(660, 0.08, 'tri'), 0.07)
    s.add(31.0, tone(1568, 0.16, 'tri'), 0.12)            # klart
    slutkort(s, 31.8)

def avslutningen(s):                   # 40 s — hela skolan i aulan, sång 14.0 s
    rumsljud(s, 0.2, 7.2, 0.40, 3.6)                      # sexhundra elever
    for i in range(12):                                   # stolar som skrapar
        s.add(0.6 + i*0.5, noise(0.08, 0.07), 0.05)
    uiTva(s, 6.4, 523.25, 783.99, 0.12)                   # texten upp på skärmen
    rost(s, 8.2, 320, 420, 0.5, 0.07)                     # ingen kan texten
    rost(s, 9.4, 420, 300, 0.45, 0.07)
    for i, f in enumerate([N['F4'], N['C5'], N['F4'], N['A4']]):  # intro
        s.add(11.6 + i*0.6, tone(f, 0.55, 'tri', 0.03, 0.4), 0.07)
    # sommarsången: 16 toner från 14.0 s, 520 ms per ton (SANG/TON i filmen)
    melodi = ['F4', 'G4', 'A4', 'A4', 'G4', 'F4', 'G4', 'A4',
              'C5', 'C5', 'B4', 'A4', 'G4', 'A4', 'G4', 'F4']
    ack = [['F4', 'A4', 'C5'], ['C4', 'E4', 'G4'], ['F4', 'A4', 'C5'], ['C4', 'E4', 'G4']]
    basar = ['F3', 'C3', 'F3', 'C3']
    for i, nm in enumerate(melodi):
        sing(s, 14.0 + i*0.52, N[nm], 0.48, 0.16)
        if i % 4 == 0:
            arp(s, 14.0 + i*0.52, ack[i//4], 2.08, 0.05)
            bass(s, 14.0 + i*0.52, basar[i//4], 2.08, 0.085)
    # andrastämma i tersen på sista raden
    for i, nm in enumerate(melodi[12:]):
        sing(s, 20.24 + i*0.52, N[nm]*1.26, 0.48, 0.07)
    klapp(s, 22.4, 30, 2.6, 0.08)                         # hela aulan applåderar
    rumsljud(s, 23.0, 5.0, 0.26, 3.2)
    uiTva(s, 24.0, 587.33, 880.0, 0.12)                   # året tillbakablickas
    for i in range(5):
        pling(s, 24.8 + i*0.7, 880 - i*60, 0.22, 0.07)
    uiTva(s, 30.0, 659.25, 1046.5, 0.13)                  # tack för i år
    rumsljud(s, 31.0, 5.0, 0.22, 4.0)                     # jubel: sommarlov
    klapp(s, 31.4, 20, 2.4, 0.07)
    slutkort(s, 36.6)


# namn, längd, cue-funktion, grundnivå för rumstonen
FILMER = [
    ('idrotten',            40.5, idrotten,            0.075),  # ekande gympasal
    ('biblioteket',         38.5, biblioteket,         0.030),  # tyst bibliotek
    ('musiksalen',          38.5, musiksalen,          0.045),
    ('slojden',             38.5, slojden,             0.070),
    ('sjukan',              36.5, sjukan,              0.038),
    ('forstadagen',         36.5, forstadagen,         0.060),
    ('utvecklingssamtalet', 38.5, utvecklingssamtalet, 0.028),  # tom skola på kvällen
    ('provet',              38.5, provet,              0.032),  # provtystnad
    ('fritids',             36.5, fritids,             0.075),
    ('avslutningen',        40.5, avslutningen,        0.085),  # aula med sexhundra
]


def skriv_wav(path, buf):
    buf = np.tanh(buf * 1.2)
    buf = buf / max(1e-9, np.max(np.abs(buf))) * 0.82
    data = (np.stack([buf, buf], axis=1) * 32767).astype(np.int16)
    with wave.open(path, 'w') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(data.tobytes())


if __name__ == '__main__':
    np.random.seed(7)
    utkatalog = sys.argv[1] if len(sys.argv) > 1 else '.'
    valda = set(sys.argv[2:])
    os.makedirs(utkatalog, exist_ok=True)
    for namn, dur, cue, botten in FILMER:
        if valda and namn not in valda:
            continue
        s = Spar(dur)
        rumsbotten(s, botten)
        cue(s)
        path = os.path.join(utkatalog, 'ljud-%s.wav' % namn)
        skriv_wav(path, s.buf)
        print('ljud klart: %-40s %4.1f s' % (path, dur))
