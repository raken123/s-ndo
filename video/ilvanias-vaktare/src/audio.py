"""Syntetiserar musik, ljudmiljöer och effekter och mixar dem under berättarrösten.

Läser build/narration.wav och build/timeline.json, skriver build/mix.wav (48 kHz stereo).
Allt ljud skapas här med numpy/scipy – inga externa ljudfiler.
"""
import json
import math
import wave
import zlib
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
SR = 48000
TAU = 2 * np.pi

tl = json.loads((BUILD / "timeline.json").read_text(encoding="utf-8"))
DUR = tl["duration"]
N = int(DUR * SR) + SR
SCENES = {s["id"]: s for s in tl["scenes"]}
for s in tl["scenes"]:
    s["cues"] = [c for c in tl["cues"] if s["start"] <= c["start"] < s["end"]]

rng = np.random.default_rng(7)


# ---------------------------------------------------------------- tider (samma regler som i bildscenerna)
def ls(sid, i):
    s = SCENES[sid]
    lines = s["lines"]
    if not lines:
        return 0.0
    return lines[max(0, min(i, len(lines) - 1))]["start"] - s["start"]


def le(sid, i):
    s = SCENES[sid]
    lines = s["lines"]
    if not lines:
        return s["end"] - s["start"]
    return lines[max(0, min(i, len(lines) - 1))]["end"] - s["start"]


def cue(sid, needle, fallback=0.0):
    s = SCENES[sid]
    for c in s["cues"]:
        if needle.lower() in c["text"].lower():
            return c["start"] - s["start"]
    return fallback


def at(sid, t):
    """Absolut tid för lokal tid t i scenen."""
    return SCENES[sid]["start"] + t


def span(sid):
    s = SCENES[sid]
    return s["start"], s["end"]


def mulberry32(seed):
    """Samma slumptalsgenerator som rng() i lib.mjs, så att ljud och bild går i takt."""
    s = seed & 0xFFFFFFFF

    def nxt():
        nonlocal s
        s = (s + 0x6D2B79F5) & 0xFFFFFFFF
        t = s
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return nxt


# ---------------------------------------------------------------- byggstenar
def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, f1, f2, order=2):
    return sosfilt(butter(order, [f1, f2], "band", fs=SR, output="sos"), x)


def noise(n):
    return rng.standard_normal(n).astype(np.float64)


def smooth_rand(n, rate, seed):
    """Långsamt varierande kurva 0..1 (för vindstyrka m.m.)."""
    r = np.random.default_rng(seed)
    pts = r.random(int(n / SR * rate) + 3)
    xs = np.arange(len(pts)) * SR / rate
    return np.interp(np.arange(n), xs, pts)


def window(n, a, b, fade):
    """Kurva 0→1→0 över samplen n: på mellan a och b (sekunder), mjuka kanter."""
    t = np.arange(n) / SR
    up = np.clip((t - a) / max(fade, 1e-3), 0, 1)
    down = np.clip((b - t) / max(fade, 1e-3), 0, 1)
    w = np.minimum(up, down)
    return w * w * (3 - 2 * w)


class Bus:
    def __init__(self):
        self.L = np.zeros(N)
        self.R = np.zeros(N)

    def add(self, sig, t0, gain=1.0, pan=0.0):
        """Lägg in en mono- eller stereosignal med start vid absolut tid t0."""
        i0 = int(t0 * SR)
        if i0 >= N:
            return
        if sig.ndim == 1:
            l = sig * gain * math.cos((pan + 1) * math.pi / 4) * math.sqrt(2)
            r = sig * gain * math.sin((pan + 1) * math.pi / 4) * math.sqrt(2)
        else:
            l, r = sig[0] * gain, sig[1] * gain
        a = max(0, i0)
        off = a - i0
        b = min(N, i0 + len(l))
        if b <= a:
            return
        self.L[a:b] += l[off:off + b - a]
        self.R[a:b] += r[off:off + b - a]


music = Bus()
amb = Bus()
sfx = Bus()


def env_ad(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- musik
def pad_note(freq, dur, seed):
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    sig = np.zeros(n)
    for det in (-0.004, 0.0, 0.004):
        f = freq * (1 + det)
        ph = r.random() * TAU
        sig += np.sin(TAU * f * t + ph) + 0.3 * np.sin(TAU * 2 * f * t + ph) + 0.12 * np.sin(TAU * 3 * f * t)
    sig *= 1 + 0.15 * np.sin(TAU * (0.15 + r.random() * 0.1) * t)
    return sig / 3


def chord_segment(notes, dur, seed):
    n = int(dur * SR)
    sig = np.zeros(n)
    for k, m in enumerate(notes):
        sig += pad_note(midi(m), dur, seed * 31 + k) * (0.9 if k else 1.1)
    # bas en oktav under grundtonen
    t = np.arange(n) / SR
    sig += 0.8 * np.sin(TAU * midi(notes[0] - 12) * t)
    fade = min(2.0, dur / 2)
    sig *= window(n, 0, dur, fade)
    return sig / len(notes)


def bell(freq, dur=3.0, decay=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(TAU * freq * t) + 0.4 * np.sin(TAU * freq * 2.76 * t) * np.exp(-t * 3) + 0.2 * np.sin(TAU * freq * 5.4 * t) * np.exp(-t * 6)
    return s * env_ad(n, 0.004, decay)


C = {
    "Dm": [50, 57, 62, 65], "Bb": [46, 58, 62, 65], "F": [53, 57, 60, 65], "C": [48, 55, 60, 64],
    "Gm": [43, 55, 58, 62], "A": [45, 57, 61, 64], "Am": [45, 57, 60, 64], "Dsus2": [50, 57, 62, 64],
    "Eb": [51, 58, 63, 67], "Fadd9": [53, 60, 65, 67], "Bbmaj7": [46, 57, 62, 65],
}

PLAN = {  # scen: (ackord, nivå, klockor)
    "titel": ("Dm Bb F C", 1.0, 0.8), "hav": ("Dm Gm Dm Eb", 0.7, 0), "hamn": ("Dm Bb Gm A Dm Gm", 0.7, 0.25),
    "rummet": ("F C Dm Bb F C", 0.8, 0.6), "festival": ("F Bb C F Bb C", 0.85, 0.8), "parken": ("Bbmaj7 F Dm C Bbmaj7 Dsus2", 0.8, 0.6),
    "dalen": ("Dm Eb", 0.6, 0), "vanner": ("F C Dm Bb Gm Dm Gm A F C Bb F", 0.8, 0.4), "vaktare": ("Dm Bb C Dm Eb C Bb F", 0.9, 0.2),
    "gong": ("Dsus2 Am Dsus2 F", 0.7, 0.3), "spangen": ("F C Bb F Dm C", 0.75, 0.5), "salen": ("Dsus2 Dsus2", 0.6, 0.2),
    "kansla": ("Dsus2 Bbmaj7 Dsus2 Fadd9 Dsus2 Bbmaj7 Dsus2 Fadd9", 0.75, 0.5), "ensam": ("Dm Bb C F", 0.8, 0.3),
    "haji": ("F C Dm Bb F C Dm Bb F C", 0.75, 0.4), "koket": ("F Bb C F", 0.7, 0.3), "radet": ("Dm Gm Bb A", 0.75, 0),
    "koket2": ("F C Dm Bb F C Dm Bb Gm A F C Bb F C F", 0.7, 0.3), "redo": ("Dm C Bb C", 0.75, 0.4),
    "vida": ("Dsus2 Bbmaj7 Gm A Dm Bb F C Dm Eb Dm", 0.75, 0.4), "station": ("F C", 0.8, 0.3), "ljussten": ("Bbmaj7 F Dm", 0.75, 0.7),
    "taget": ("F C Dm Bb F", 0.75, 0.4), "resan": ("Bb F C F", 0.95, 0.7), "slut": ("Bb C F", 1.0, 0.8),
}

for sid, (prog, level, bells) in PLAN.items():
    a, b = span(sid)
    names = prog.split()
    seg = (b - a) / len(names)
    for k, name in enumerate(names):
        t0 = a + k * seg - 1.0
        dur = seg + 2.0
        if sid == "slut" and k == len(names) - 1:
            dur += 2.0
        music.add(chord_segment(C[name], dur, zlib.crc32(f'{sid}{k}'.encode()) % 1000), max(0, t0), 0.16 * level, pan=0)
        # klockor: ackordtoner två oktaver upp, glest
        if bells > 0:
            r = np.random.default_rng(zlib.crc32(f'{sid}{k}b'.encode()))
            tt = 0.4
            while tt < seg:
                if r.random() < bells:
                    m = C[name][1 + r.integers(0, 3)] + 24
                    music.add(bell(midi(m)), t0 + 1 + tt, 0.035 * level, pan=r.uniform(-0.6, 0.6))
                tt += r.choice([0.8, 1.2, 1.6, 2.4])

# hela musikspåret blir mjukare och varmare
music.L = lp(music.L, 2400)
music.R = lp(music.R, 2400)


# ---------------------------------------------------------------- ljudmiljöer
def bed(gen, sid, gain, curve=None, a=None, b=None, fade=1.5):
    s0, s1 = span(sid)
    a = s0 - 0.8 if a is None else a
    b = s1 + 0.8 if b is None else b
    n = int((b - a) * SR)
    if n <= 0:
        return
    w = window(n, 0, b - a, fade)
    if curve is not None:
        w = w * curve(np.arange(n) / SR + (a - s0))
    amb.add(np.stack([gen(n) * w, gen(n) * w]), a, gain)


def wind(n):
    return lp(noise(n), 500) * (0.4 + 0.8 * smooth_rand(n, 0.3, rng.integers(1_000_000))) + 0.15 * bp(noise(n), 700, 1100) * smooth_rand(n, 0.5, rng.integers(1_000_000))


def sea(n):
    t = np.arange(n) / SR
    swell = 0.5 + 0.5 * np.sin(TAU * t / 7.3 + rng.random() * 6) ** 2 * (0.6 + 0.4 * np.sin(TAU * t / 17))
    return lp(noise(n), 900) * swell + 0.3 * bp(noise(n), 1500, 5000) * swell ** 3


def rain(n):
    drops = np.zeros(n)
    idx = rng.integers(0, n, n // 300)
    drops[idx] = rng.uniform(-1, 1, len(idx))
    return 0.5 * hp(noise(n), 2500) + 2.0 * bp(drops, 2000, 6000)


def stream(n):
    return bp(noise(n), 500, 3000) * (0.6 + 0.4 * smooth_rand(n, 6, rng.integers(1_000_000)))


def room(n):
    return lp(noise(n), 180)


def crowd(n):
    return bp(noise(n), 250, 1400) * (0.5 + 0.5 * smooth_rand(n, 3, rng.integers(1_000_000)))


def fire(n):
    clicks = np.zeros(n)
    idx = rng.integers(0, n, int(n / SR * 9))
    clicks[idx] = rng.uniform(-1, 1, len(idx)) ** 3
    return 2.5 * hp(clicks, 1500) + 0.5 * lp(noise(n), 160)


def crickets(n):
    t = np.arange(n) / SR
    gate = (np.sin(TAU * 18 * t) > 0.3) * (np.sin(TAU * 0.7 * t) > -0.2)
    return 0.3 * np.sin(TAU * 4600 * t) * lp(gate.astype(float), 200)


def drone(n):
    t = np.arange(n) / SR
    return 0.5 * np.sin(TAU * 55 * t) + 0.35 * np.sin(TAU * 58.3 * t) + 0.2 * lp(noise(n), 120)


def hum(n):  # flugmonstrets surr
    t = np.arange(n) / SR
    saw = sum(np.sin(TAU * 165 * k * t + k) / k for k in range(1, 8))
    return saw * (0.7 + 0.3 * np.sin(TAU * 31 * t))


def train_clack(n, period=1.05):
    s = np.zeros(n)
    k = 0.0
    while k * SR < n - SR:
        for d in (0.0, 0.13):
            i = int((k + d) * SR)
            s[i:i + 600] += np.exp(-np.arange(600) / 90) * rng.uniform(0.6, 1.0)
        k += period
    return 1.4 * bp(s, 300, 3000) + 0.35 * lp(noise(n), 140)


# hav, vind, regn
hav_s, hav_e = span("hav")
wild = lambda t: 0.55 + 0.7 * np.clip((t - (ls("hav", 2) - 3)) / 8, 0, 1)
bed(wind, "hav", 0.18, wild)
bed(sea, "hav", 0.22, wild)
bed(rain, "hav", 0.1, wild)
bed(sea, "hamn", 0.18)
bed(wind, "hamn", 0.14, lambda t: 0.6 + 0.6 * np.clip((t - ls("hamn", 3)) / 4, 0, 1))
bed(drone, "hamn", 0.08, lambda t: np.clip((t - ls("hamn", 4) + 1) / 4, 0, 1))
bed(wind, "rummet", 0.08)
bed(crowd, "festival", 0.22)
bed(sea, "festival", 0.12)
bed(wind, "parken", 0.1, lambda t: 1 - 0.7 * np.clip((t - ls("parken", 2)) / 5, 0, 1))
bed(drone, "dalen", 0.1)
bed(wind, "dalen", 0.1)
bed(rain, "vanner", 0.1, None, at("vanner", ls("vanner", 1) + 1.5), at("vanner", ls("vanner", 3) + 1), 1.5)
bed(drone, "vaktare", 0.1, lambda t: 1 - np.clip((t - ls("vaktare", 3)) / 2, 0, 1))
bed(hum, "vaktare", 0.05, None, at("vaktare", ls("vaktare", 2) - 0.5), at("vaktare", ls("vaktare", 3) + 0.5), 1.5)
bed(wind, "vaktare", 0.08)
bed(stream, "gong", 0.06, None, at("gong", 6), None)
bed(stream, "spangen", 0.07)
bed(wind, "spangen", 0.07)
bed(room, "salen", 0.12)
bed(room, "kansla", 0.08)
bed(room, "ensam", 0.12)
bed(wind, "haji", 0.06)
bed(fire, "koket", 0.18)
bed(fire, "koket2", 0.16)
bed(wind, "koket2", 0.18, None, at("koket2", ls("koket2", 14) - 0.5), at("koket2", ls("koket2", 15) + 1), 1.5)
bed(room, "radet", 0.12)
bed(drone, "radet", 0.05)
bed(room, "redo", 0.06)
bed(drone, "vida", 0.06)
bed(lambda n: bp(noise(n), 200, 900), "vida", 0.1, None, at("vida", cue("vida", "illvilja") - 0.5), at("vida", ls("vida", 5) + 1), 1.5)
bed(crickets, "ljussten", 0.05, lambda t: np.clip((t - ls("ljussten", 1) + 1) / 4, 0, 1))
bed(wind, "ljussten", 0.06)
bed(lambda n: train_clack(n, 1.05), "taget", 0.35)
bed(lambda n: train_clack(n, 0.9), "resan", 0.12)
bed(wind, "resan", 0.1)
bed(wind, "titel", 0.06)
bed(wind, "slut", 0.05)


# ---------------------------------------------------------------- effekter
def chirp():
    k = rng.integers(2, 5)
    out = []
    for _ in range(k):
        n = int(rng.uniform(0.05, 0.11) * SR)
        t = np.arange(n) / SR
        f0, f1 = rng.uniform(2600, 3600), rng.uniform(3800, 5200)
        f = f0 + (f1 - f0) * (t / t[-1]) ** rng.uniform(0.5, 2)
        out.append(np.sin(TAU * np.cumsum(f) / SR) * np.sin(np.pi * t / t[-1]))
        out.append(np.zeros(int(rng.uniform(0.04, 0.12) * SR)))
    return np.concatenate(out)


def birds(sid, a, b, rate=0.6, gain=0.05):
    t = a
    while t < b:
        t += rng.exponential(1 / rate)
        sfx.add(chirp(), at(sid, t), gain * rng.uniform(0.5, 1), pan=rng.uniform(-0.8, 0.8))


def gong_hit():
    n = int(9 * SR)
    t = np.arange(n) / SR
    parts = [(98, 1.0, 6), (147.5, 0.6, 5), (196.3, 0.5, 4.5), (245.2, 0.45, 4), (296.1, 0.35, 3.5), (351.7, 0.3, 3), (412.4, 0.2, 2.5), (523.1, 0.15, 2)]
    s = sum(a * np.sin(TAU * f * (1 - 0.01 * np.exp(-t * 3)) * t) * np.exp(-t / d) * (1 + 0.2 * np.sin(TAU * 1.3 * t)) for f, a, d in parts)
    s[: int(0.05 * SR)] += lp(noise(int(0.05 * SR)), 2000) * np.linspace(1, 0, int(0.05 * SR))
    return s * np.minimum(1, t / 0.004)


def chime(n_notes=6, spread=1.5, base=2200):
    out = np.zeros(int((spread + 2.5) * SR))
    for _ in range(n_notes):
        f = base * 2 ** (rng.integers(0, 12) / 12) * rng.choice([1, 1.5, 2])
        b = bell(f, 2.0, 0.6)
        i = int(rng.uniform(0, spread) * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    return out


def boom(dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(TAU * np.cumsum(70 * np.exp(-t * 1.5) + 32) / SR) * np.exp(-t / 0.9)
    return s + 0.6 * lp(noise(n), 300) * np.exp(-t / 0.5)


def whoosh(dur=1.6, rise=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = (t / dur) ** 2 if rise else np.exp(-t * 3)
    return bp(noise(n), 400, 4000) * e


def pop():
    n = int(1.8 * SR)
    s = lp(noise(int(0.06 * SR)), 1500) * np.linspace(1, 0, int(0.06 * SR))
    out = np.zeros(n)
    out[: len(s)] += s * 1.5
    idx = rng.integers(int(0.15 * SR), n, 70)
    out[idx] += rng.uniform(-0.7, 0.7, len(idx))
    return hp(out, 300) * np.exp(-np.arange(n) / SR / 0.9)


def whistle(dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(np.sin(TAU * f * (1 + 0.004 * np.sin(TAU * 5 * t)) * t) / (k + 1) for k, f in enumerate([622, 740, 932]))
    return s * window(n, 0, dur, 0.15) + 0.2 * bp(noise(n), 1500, 4000) * window(n, 0, dur, 0.1)


def chuff():
    n = int(0.35 * SR)
    return lp(noise(n), 900) * env_ad(n, 0.01, 0.09)


def whoom():
    n = int(3 * SR)
    t = np.arange(n) / SR
    return (np.sin(TAU * 110 * t) + 0.5 * np.sin(TAU * 165 * t) + 0.2 * np.sin(TAU * 440 * t)) * np.minimum(1, t / 0.25) * np.exp(-t / 1.1)


def slide(dur=2.0):
    n = int(dur * SR)
    return bp(noise(n), 200, 1200) * window(n, 0, dur, 0.4) * (0.7 + 0.3 * smooth_rand(n, 25, 5))


# titel: gnistan över himlen
sfx.add(chime(10, 3.6, 2400), at("titel", 0.3), 0.05, pan=-0.2)
# hav: båten förliser
sfx.add(whoosh(2.5), at("hav", le("hav", 2) - 4.5), 0.25)
# festival: fyrverkerier på samma tider som i bilden
r = mulberry32(53)
for k in range(8):
    t0 = 3 + k * 3.6 + r() * 1.5
    fx = 300 + r() * 1300
    r()
    sfx.add(pop(), at("festival", t0), 0.18, pan=(fx - 960) / 960)
birds("festival", 0, 30, 0.3, 0.03)
birds("parken", 0, ls("parken", 2), 0.9, 0.05)
birds("rummet", 0, 35, 0.25, 0.025)
# dalen: blixten
ft = ls("dalen", 1) - 1.2
sfx.add(whoosh(1.2), at("dalen", ft - 1.2), 0.2)
sfx.add(boom(4), at("dalen", ft), 0.3)
n = int(6 * SR)
tt = np.arange(n) / SR
sfx.add(np.sin(TAU * 3800 * tt) * np.exp(-tt / 2.2) * np.minimum(1, tt / 0.3), at("dalen", ft + 0.3), 0.025)
# vänner: fåglar i början och slutet
birds("vanner", 0, ls("vanner", 1) + 1, 0.6, 0.04)
birds("vanner", ls("vanner", 3) + 1, 52, 0.6, 0.04)
sfx.add(chime(8, 2.5, 1800), at("vanner", ls("vanner", 3) + 1.5), 0.05)
# väktarna: ljusexplosionen
s3 = ls("vaktare", 3)
sfx.add(whoosh(1.5), at("vaktare", s3 - 1.5), 0.3)
sfx.add(boom(4), at("vaktare", s3), 0.25)
sfx.add(chime(16, 4, 1600), at("vaktare", s3 + 0.2), 0.07)
# gongen
sfx.add(gong_hit(), at("gong", 1.2), 0.14)
birds("gong", 6.5, 33, 0.7, 0.04)
# spången: dörren och fåglarna
sfx.add(slide(2.0), at("spangen", 0.6), 0.12)
birds("spangen", 2.5, ls("spangen", 1) + 4, 1.4, 0.06)
birds("spangen", ls("spangen", 1) + 4, 36, 0.4, 0.035)
# känna: ett mjukt "vom" för varje ring
s5 = ls("kansla", 5)
prev = -1
for i in range(int(SCENES["kansla"]["end"] * 24 - SCENES["kansla"]["start"] * 24)):
    t = i / 24
    practice = np.clip((t - s5) / 3, 0, 1)
    practice = practice * practice * (3 - 2 * practice)
    period = 4.2 + (2.8 - 4.2) * practice
    k = math.floor(t / period)
    if k != prev:
        sfx.add(whoom(), at("kansla", t), 0.05)
        prev = k
sfx.add(chime(8, 3, 1500), at("kansla", ls("kansla", 3)), 0.035)
sfx.add(chime(10, 3, 1800), at("ensam", ls("ensam", 1)), 0.04)
birds("haji", 0, 70, 0.35, 0.03)
# rådet
sfx.add(chime(5, 2, 1200), at("radet", ls("radet", 1)), 0.04)
# redo: staven och klädbytet
sfx.add(chime(6, 1.2, 2600), at("redo", cue("redo", "spegelstav", 1) + 1.2), 0.05)
sfx.add(chime(14, 1.6, 2000), at("redo", cue("redo", "jeansen") + 0.2), 0.06)
sfx.add(whoosh(1.0), at("redo", cue("redo", "jeansen") - 0.2), 0.12)
# vida: ljusstenen och när den försvinner
sfx.add(chime(14, 3, 2200), at("vida", cue("vida", "ljussten", ls("vida", 5)) - 0.3), 0.06)
sfx.add(chime(6, 2.5, 1400), at("vida", ls("vida", 7) + 0.3), 0.04)
sfx.add(boom(3) * 0.5, at("vida", cue("vida", "hämndbegär")), 0.25)
# stationen: ånga och vissla
st = SCENES["station"]
sfx.add(whistle(1.4), at("station", 0.2), 0.08, pan=0.5)
t = 0.0
while t < 11:
    rate = 1.2 + 0.5 * 26 * t / 60
    sfx.add(chuff(), at("station", t), 0.25, pan=0.4)
    t += max(0.18, 1 / rate)
sfx.add(chime(4, 0.8, 3000), at("station", ls("station", 1) + 0.3), 0.03)
# ljusstenen flyger
sfx.add(chime(30, 14, 2600), at("ljussten", 0.5), 0.03)
# tåget: gnistorna
bt = cue("taget", "gnistorna", ls("taget", 3) + 2)
sfx.add(chime(18, 2.5, 2200), at("taget", bt - 0.2), 0.06)
# resan
sfx.add(whistle(2.0), at("resan", 3), 0.04, pan=-0.3)
birds("resan", 0, 26, 0.5, 0.03)
sfx.add(chime(12, 6, 2000), at("slut", 0.2), 0.04)


# ---------------------------------------------------------------- mix
with wave.open(str(BUILD / "narration.wav")) as w:
    voice = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768
voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]

# duckning: musik och miljö sänks när någon talar
env = lp(np.abs(voice), 3)
duck = 1 - 0.55 * np.clip(env / 0.04, 0, 1)
duck = lp(duck, 2)

mixL = voice * 1.0 + (music.L * 0.72 + amb.L * 0.55) * duck + sfx.L * 0.9
mixR = voice * 1.0 + (music.R * 0.72 + amb.R * 0.55) * duck + sfx.R * 0.9

# mjuk in- och uttoning
fade = np.minimum(np.clip(np.arange(N) / SR / 1.5, 0, 1), np.clip((DUR - np.arange(N) / SR) / 2.5, 0, 1))
mixL *= fade
mixR *= fade
peak = max(np.abs(mixL).max(), np.abs(mixR).max())
mix = np.stack([mixL, mixR], axis=1) / peak * 0.95
mix = np.tanh(mix * 1.2) / np.tanh(1.2)

with wave.open(str(BUILD / "mix.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())

for name, bus in (("musik", music), ("miljö", amb), ("effekter", sfx)):
    print(f"{name}: topp {max(np.abs(bus.L).max(), np.abs(bus.R).max()):.3f}")
print(f"mix klar: {DUR:.1f} s")

# nivåkontroll per scen (dB relativt rösten), skrivs bara ut
def db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


for s in tl["scenes"]:
    a, b = int(s["start"] * SR), int(s["end"] * SR)
    v = db(voice[a:b])
    print(f"{s['id']:9s} röst {v:6.1f}  musik {db((music.L * 0.72 * duck)[a:b]) - v:6.1f}  miljö {db((amb.L * 0.55 * duck)[a:b]) - v:6.1f}  effekter {db((sfx.L * 0.9)[a:b]) - v:6.1f}")
