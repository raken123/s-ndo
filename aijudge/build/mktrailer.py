#!/usr/bin/env python3
"""mktrailer.py — cuts the captured footage into the trailer, and writes its score.

    node build/mktrailer.js      # first: capture the footage from the game
    python3 build/mktrailer.py   # then: score it, cut it, encode it

Three minutes, 1920x1080, 30fps. The picture is real footage from the game —
build/mktrailer.js steps the actual hall frame by frame — with the typography
and the end card drawn on top here. The score is synthesised from scratch: the
judge is a drum robot, so the trailer is carried by drums.
"""
import math
import pathlib
import shutil
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
FOOTAGE = DIST / "trailer"
WORK = FOOTAGE / "cut"
VERSION = (ROOT / "VERSION").read_text().strip()

W, H, FPS = 1920, 1080, 30
DURATION = 180.0
TOTAL = int(DURATION * FPS)
SR = 44100

RELEASE = "OCTOBER 12"

SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SERIF_B = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

PARCH = (243, 231, 205)
BRASS = (216, 168, 74)
FELT = (176, 74, 72)
OAK_DK = (18, 12, 7)

# The exact moment the gun goes off, measured from the captured clip: the
# verdict beat runs 2.6s, then the arms come up for 0.75s.
SHOT_T = 112.0 + 3.28

# ---------------------------------------------------------------- the cut

#          clip            in    out     t_in    t_out
EDIT = [
    ("01-hall",           0.0,  22.0,    0.0,   22.0),
    ("04-robot",          0.0,  14.0,   22.0,   36.0),
    ("02-queue",          0.0,  26.0,   36.0,   62.0),
    ("03-front",          0.0,  10.0,   62.0,   72.0),
    ("05-trial",          0.0,  24.0,   72.0,   96.0),
    ("06-deliberate",     0.0,  16.0,   96.0,  112.0),
    ("07-verdict",        0.0,  18.0,  112.0,  130.0),
    ("08-morph",          0.0,  14.0,  130.0,  144.0),
    ("09-wide",           0.0,  18.0,  144.0,  162.0),
]
ENDCARD_IN = 162.0

# style, text, appears, disappears, and an optional vertical nudge in pixels
# (negative lifts the line clear of whatever the game is drawing underneath)
TEXT = [
    ("small",  "THE HALL OF SMALL GRIEVANCES",              2.4,   8.4),
    ("line",   "Two strangers. One drum.",                  11.0,  18.0),
    ("title",  "AI JUDGE",                                  23.5,  31.0),
    ("line",   "It holds two guns.",                        31.8,  35.6),
    ("line",   "Every case begins in the line.",            38.0,  46.5),
    ("line",   "Real people. You wait your turn.",          49.5,  59.5),
    ("line",   "You cannot be judged from\nanywhere but the front.",
                                                            63.5,  71.2),
    ("line",   "Then it poses a case.",                     75.0,  83.0),
    ("line",   "Forty-five seconds to make yours.",         85.5,  94.6),
    ("line",   "It reads you both.",                        97.8, 104.0),
    ("small",  "GEMINI 3.1 FLASH LITE  ·  3.6 FLASH FOR VIP",
                                                           105.2, 111.2),
    ("line",   "Lose, and you get shot.",                  112.6, 115.1, -232),
    ("line",   "There is no appeal.",                      121.0, 127.5, -120),
    ("line",   "Become the drum.\nRule the case yourself.", 131.5, 141.5),
    ("small",  "VIP  ·  TEN DRUM MORPHS A DAY",            141.9, 143.9),
    ("line",   "Online multiplayer.\nThirty-six small disputes.",
                                                           146.0, 154.0),
    ("small",  "VR  ·  ANDROID  ·  MACOS  ·  WINDOWS  ·  LINUX",
                                                           155.0, 161.4),
]

# ---------------------------------------------------------------- score


def env(n, attack, decay, sustain=0.0, release=0.0):
    """A simple AD/ADSR contour, in samples."""
    e = np.zeros(n, dtype=np.float32)
    a = max(1, int(attack * SR))
    d = max(1, int(decay * SR))
    e[:a] = np.linspace(0, 1, a, dtype=np.float32)
    tail = min(n - a, d)
    if tail > 0:
        e[a:a + tail] = np.linspace(1, sustain, tail, dtype=np.float32)
    if sustain > 0 and n > a + d:
        hold = n - a - d
        r = max(1, int(release * SR))
        e[a + d:] = sustain
        if r < hold:
            e[-r:] = np.linspace(sustain, 0, r, dtype=np.float32)
    return e


def noise(n):
    return np.random.uniform(-1, 1, n).astype(np.float32)


def lowpass(x, cutoff):
    """One-pole lowpass; cheap, and the right amount of dull for wood and skin."""
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):          # short buffers only — hits, not the mix
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def sweep(n, f0, f1, curve=3.0):
    t = np.linspace(0, n / SR, n, endpoint=False, dtype=np.float32)
    k = np.exp(-curve * t / max(1e-6, n / SR))
    f = f1 + (f0 - f1) * k
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase).astype(np.float32)


def kick(dur=0.55, f0=170, f1=41, gain=1.0):
    n = int(dur * SR)
    body = sweep(n, f0, f1, 4.5) * env(n, 0.001, dur)
    click = lowpass(noise(int(0.012 * SR)), 1400) * 0.5
    out = body.copy()
    out[:len(click)] += click
    return out * gain


def tom(dur=0.7, f0=260, f1=95, gain=0.8):
    n = int(dur * SR)
    return sweep(n, f0, f1, 3.2) * env(n, 0.002, dur) * gain


def snare(dur=0.28, gain=0.8, bright=2000):
    n = int(dur * SR)
    skin = sweep(n, 330, 180, 6) * env(n, 0.001, dur * 0.5) * 0.35
    wires = highpass(noise(n), bright) * env(n, 0.001, dur) * 0.9
    return (skin + wires) * gain


def hat(dur=0.07, gain=0.35):
    n = int(dur * SR)
    return highpass(noise(n), 7000) * env(n, 0.0005, dur) * gain


def cymbal(dur=2.6, gain=0.5):
    n = int(dur * SR)
    shimmer = highpass(noise(n), 2600) * env(n, 0.004, dur)
    body = highpass(noise(n), 900) * env(n, 0.02, dur * 0.7) * 0.4
    return (shimmer + body) * gain


def wood(dur=0.12, gain=0.5, f=900):
    n = int(dur * SR)
    return (sweep(n, f * 2.4, f, 12) * env(n, 0.0005, dur) * 0.7
            + highpass(noise(n), 3000) * env(n, 0.0005, dur * 0.35) * 0.3) * gain


def marimba(freq, dur=0.5, gain=0.35):
    n = int(dur * SR)
    t = np.linspace(0, dur, n, endpoint=False, dtype=np.float32)
    y = (np.sin(2 * np.pi * freq * t)
         + 0.35 * np.sin(2 * np.pi * freq * 4 * t)
         + 0.12 * np.sin(2 * np.pi * freq * 10 * t))
    return (y * env(n, 0.002, dur)).astype(np.float32) * gain


def drone(dur, freq, gain=0.2, detune=1.006):
    n = int(dur * SR)
    t = np.linspace(0, dur, n, endpoint=False, dtype=np.float32)
    saw = np.zeros(n, dtype=np.float32)
    for h in range(1, 9):                      # a soft additive saw
        saw += np.sin(2 * np.pi * freq * h * t) / h
        saw += np.sin(2 * np.pi * freq * detune * h * t) / h * 0.7
    fade = int(1.6 * SR)
    e = np.ones(n, dtype=np.float32)
    e[:fade] = np.linspace(0, 1, fade)
    e[-fade:] = np.linspace(1, 0, fade)
    return saw * e * gain / 3.0


def place(buf, t, sample, gain=1.0, pan=0.5):
    i = int(t * SR)
    if i < 0 or i >= len(buf):
        return
    n = min(len(sample), len(buf) - i)
    buf[i:i + n, 0] += sample[:n] * gain * (1 - pan) * 2 * 0.5
    buf[i:i + n, 1] += sample[:n] * gain * pan * 2 * 0.5


def reverb(mono, decay=1.5, mix=0.28):
    """FFT convolution against a synthetic hall — a wooden room, not a cathedral."""
    n_ir = int(decay * SR)
    t = np.linspace(0, decay, n_ir, endpoint=False, dtype=np.float32)
    ir = noise(n_ir) * np.exp(-4.2 * t)
    ir[: int(0.011 * SR)] = 0                   # a little pre-delay
    ir /= np.abs(ir).sum() / 12.0
    size = 1 << int(np.ceil(np.log2(len(mono) + n_ir)))
    wet = np.fft.irfft(np.fft.rfft(mono, size) * np.fft.rfft(ir, size))[:len(mono)]
    return (mono * (1 - mix) + wet.astype(np.float32) * mix).astype(np.float32)


def build_score(path):
    n = int(DURATION * SR)
    dry = np.zeros((n, 2), dtype=np.float32)
    beat = 60.0 / 84.0                          # 84 bpm

    # --- 0-22  the empty hall: a heartbeat and a room ---
    for i in range(9):
        place(dry, 1.2 + i * 2.4, kick(0.7, 120, 36, 0.5))
    place(dry, 6.0, wood(0.16, 0.30, 700), 1.0, 0.35)
    place(dry, 13.4, wood(0.16, 0.30, 640), 1.0, 0.66)
    d = drone(24.0, 55.0, 0.16)
    place(dry, 0.0, d, 1.0, 0.5)

    # --- 22-36  the robot: the room wakes up ---
    place(dry, 21.6, cymbal(3.4, 0.34))
    for i in range(9):
        place(dry, 22.0 + i * 1.55, kick(0.6, 150, 40, 0.75))
        if i % 2 == 1:
            place(dry, 22.0 + i * 1.55 + 0.78, wood(0.11, 0.24, 820), 1.0, 0.7)
    place(dry, 22.0, drone(15.0, 61.7, 0.19), 1.0, 0.5)
    place(dry, 30.5, tom(0.8, 240, 88, 0.55), 1.0, 0.3)
    place(dry, 31.6, tom(0.8, 200, 74, 0.6), 1.0, 0.7)

    # --- 36-62  the line: a slow march ---
    place(dry, 36.0, drone(27.0, 55.0, 0.2), 1.0, 0.5)
    t = 36.0
    step = 0
    while t < 62.0:
        place(dry, t, kick(0.5, 160, 42, 0.85))
        place(dry, t + beat, hat(0.06, 0.22), 1.0, 0.62)
        place(dry, t + beat * 2, kick(0.45, 150, 40, 0.6))
        place(dry, t + beat * 2, wood(0.1, 0.26, 760), 1.0, 0.34)
        place(dry, t + beat * 3, hat(0.06, 0.2), 1.0, 0.38)
        if step % 4 == 3:
            place(dry, t + beat * 3.5, snare(0.2, 0.34))
        t += beat * 4
        step += 1

    # --- 62-72  the front: hold your breath ---
    place(dry, 62.0, drone(11.0, 65.4, 0.22), 1.0, 0.5)
    place(dry, 62.0, cymbal(3.0, 0.22))
    for i in range(5):
        place(dry, 62.4 + i * 1.9, tom(0.75, 210 - i * 12, 80, 0.5),
              1.0, 0.35 if i % 2 else 0.65)

    # --- 72-96  the case: a wooden motif, thinking ---
    place(dry, 72.0, drone(25.0, 55.0, 0.15), 1.0, 0.5)
    motif = [293.66, 349.23, 392.00, 349.23, 261.63]     # D F G F C
    t = 72.5
    k = 0
    while t < 95.0:
        place(dry, t, marimba(motif[k % len(motif)], 0.62, 0.30),
              1.0, 0.4 + 0.2 * (k % 3) / 2)
        if k % 5 == 0:
            place(dry, t, kick(0.5, 140, 38, 0.55))
        t += beat * 0.75
        k += 1

    # --- 96-115.1  deliberation: the roll builds and does not stop ---
    place(dry, 96.0, drone(19.5, 55.0, 0.26), 1.0, 0.5)
    place(dry, 100.0, drone(15.5, 82.4, 0.14), 1.0, 0.5)
    t, gap = 96.0, 0.20
    while t < SHOT_T - 0.2:
        prog = (t - 96.0) / (SHOT_T - 96.0)
        place(dry, t, snare(0.16, 0.16 + prog * 0.5, 1700 + prog * 1800),
              1.0, 0.5 + (0.16 if int(t * 40) % 2 else -0.16))
        gap = max(0.028, 0.20 * (1.0 - prog * 0.88))
        t += gap
    for i in range(6):                                   # stabs under the verdict
        place(dry, 112.2 + i * 0.62, kick(0.5, 175, 44, 0.8 + i * 0.03))

    # --- the shot: everything stops, then one hit ---
    place(dry, SHOT_T, kick(1.5, 260, 30, 1.5))
    place(dry, SHOT_T, snare(0.5, 1.0, 1200))
    place(dry, SHOT_T, cymbal(4.2, 0.75))
    place(dry, SHOT_T, tom(1.6, 320, 55, 0.9), 1.0, 0.35)
    place(dry, SHOT_T + 0.02, tom(1.6, 300, 48, 0.9), 1.0, 0.65)
    place(dry, SHOT_T + 0.35, drone(13.0, 41.2, 0.3), 1.0, 0.5)

    # --- 121-130  the tail ---
    for i in range(4):
        place(dry, 121.5 + i * 2.1, kick(0.8, 120, 34, 0.5))
    place(dry, 126.0, wood(0.14, 0.3, 620), 1.0, 0.3)

    # --- 130-162  the drum takes the bench: the groove returns ---
    place(dry, 130.0, cymbal(3.2, 0.4))
    place(dry, 130.0, drone(33.0, 65.4, 0.2), 1.0, 0.5)
    t, step = 130.0, 0
    while t < 161.2:
        strong = 1.0 if t < 146.0 else 1.18
        place(dry, t, kick(0.5, 165, 43, 0.95 * strong))
        place(dry, t + beat * 0.5, hat(0.05, 0.2))
        place(dry, t + beat, snare(0.22, 0.42 * strong))
        place(dry, t + beat * 1.5, hat(0.05, 0.22), 1.0, 0.62)
        place(dry, t + beat * 2, kick(0.45, 155, 41, 0.7 * strong))
        place(dry, t + beat * 2.5, hat(0.05, 0.2), 1.0, 0.38)
        place(dry, t + beat * 3, snare(0.22, 0.44 * strong))
        if step % 2 == 1:
            place(dry, t + beat * 3.5, tom(0.5, 210, 90, 0.5 * strong), 1.0, 0.7)
        if step % 4 == 3 and t > 146.0:
            for j in range(4):
                place(dry, t + beat * 3.5 + j * 0.075, snare(0.12, 0.4),
                      1.0, 0.3 + j * 0.13)
        t += beat * 4
        step += 1

    # --- 162-180  the end card ---
    place(dry, 161.4, cymbal(4.5, 0.5))
    place(dry, 161.4, kick(1.4, 220, 32, 1.15))
    place(dry, 162.0, drone(18.0, 55.0, 0.24), 1.0, 0.5)
    place(dry, 165.4, kick(1.0, 150, 38, 0.7))           # the icon settles
    place(dry, 167.6, kick(1.0, 150, 38, 0.7))           # the name
    for i in range(7):                                    # a roll into the date
        place(dry, 170.9 + i * 0.13, snare(0.14, 0.3 + i * 0.06),
              1.0, 0.5 + (0.2 if i % 2 else -0.2))
    place(dry, 172.0, kick(1.8, 280, 28, 1.6))           # OCTOBER 12 lands
    place(dry, 172.0, cymbal(5.5, 0.7))
    place(dry, 172.0, tom(1.8, 300, 46, 0.9), 1.0, 0.35)
    place(dry, 172.03, tom(1.8, 280, 42, 0.9), 1.0, 0.65)
    place(dry, 172.4, drone(7.5, 41.2, 0.26), 1.0, 0.5)

    # --- room, glue, and a soft ceiling ---
    out = np.stack([reverb(dry[:, 0]), reverb(dry[:, 1])], axis=1)
    peak = float(np.max(np.abs(out))) or 1.0
    out = np.tanh(out / peak * 1.95) * 0.94   # drive gives the quiet passages body
    fade = int(1.4 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    out[:int(0.4 * SR)] *= np.linspace(0, 1, int(0.4 * SR))[:, None]

    pcm = (np.clip(out, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  score             {len(pcm)/SR:.1f}s  {path.stat().st_size/1024/1024:.1f} MB")


# ---------------------------------------------------------------- picture

_fonts = {}


def font(path, size):
    key = (path, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


def make_vignette():
    """A soft warm falloff, so the canvas footage and the end card sit together."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    dx = (x - W / 2) / (W / 2)
    dy = (y - H / 2) / (H / 2)
    r = np.sqrt(dx * dx + dy * dy * 1.06) / 1.42
    v = np.clip(1.0 - 0.62 * np.power(np.clip(r, 0, 1), 2.6), 0, 1)
    rgb = np.stack([v, v * 0.995, v * 0.985], axis=2)
    return Image.fromarray((rgb * 255).astype(np.uint8), "RGB")


def spaced(draw, xy, text, fnt, fill, tracking=0, anchor_centre=True):
    """Draws letter-spaced text, returning its width. Tracking sells a title."""
    widths = [draw.textlength(ch, font=fnt) for ch in text]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    x = xy[0] - total / 2 if anchor_centre else xy[0]
    for ch, wch in zip(text, widths):
        draw.text((x, xy[1]), ch, font=fnt, fill=fill)
        x += wch + tracking
    return total


def draw_cue(img, style, text, alpha, dy=0):
    if alpha <= 0.004:
        return
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    a = int(255 * min(1.0, alpha))

    if style == "title":
        f = font(SERIF_B, 168)
        shadow = (0, 0, 0, int(a * 0.55))
        for off in ((0, 6), (0, 5)):
            spaced(d, (W / 2 + off[0], H / 2 - 118 + off[1]), text, f, shadow, 22)
        spaced(d, (W / 2, H / 2 - 118), text, f, PARCH + (a,), 22)
        rule = 300
        d.line([(W / 2 - rule, H / 2 + 96), (W / 2 + rule, H / 2 + 96)],
               fill=BRASS + (int(a * 0.85),), width=3)
    elif style == "line":
        f = font(SERIF, 62)
        lines = text.split("\n")
        y = H - 268 + dy - (len(lines) - 1) * 40
        for ln in lines:
            wln = d.textlength(ln, font=f)
            d.text((W / 2 - wln / 2 + 2, y + 4), ln, font=f, fill=(0, 0, 0, int(a * 0.6)))
            d.text((W / 2 - wln / 2, y), ln, font=f, fill=PARCH + (a,))
            y += 84
    else:  # small
        f = font(SANS_B, 31)
        y = H - 176 + dy
        wln = spaced(d, (W / 2, y + 3), text, f, (0, 0, 0, int(a * 0.55)), 7)
        spaced(d, (W / 2, y), text, f, BRASS + (a,), 7)
        d.line([(W / 2 - wln / 2 - 46, y + 20), (W / 2 - wln / 2 - 20, y + 20)],
               fill=BRASS + (int(a * 0.7),), width=2)
        d.line([(W / 2 + wln / 2 + 20, y + 20), (W / 2 + wln / 2 + 46, y + 20)],
               fill=BRASS + (int(a * 0.7),), width=2)

    img.alpha_composite(layer)


def cue_alpha(t, start, end, fade=0.65):
    if t < start - fade or t > end + fade:
        return 0.0
    if t < start:
        return (t - (start - fade)) / fade
    if t > end:
        return 1.0 - (t - end) / fade
    return 1.0


def endcard_background():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    dx = (x - W / 2) / (W / 2)
    dy = (y - H * 0.42) / (H / 2)
    r = np.clip(np.sqrt(dx * dx + dy * dy), 0, 1.6)
    warm = np.clip(1.15 - r * 0.78, 0, 1)
    rgb = np.stack([28 + warm * 44, 19 + warm * 27, 11 + warm * 14], axis=2)
    grain = np.random.normal(0, 2.0, (H, W, 1))
    return Image.fromarray(np.clip(rgb + grain, 0, 255).astype(np.uint8), "RGB")


def draw_endcard(bg, icon, t):
    """t is seconds into the end card."""
    img = bg.copy().convert("RGBA")
    d = ImageDraw.Draw(img)

    ia = cue_alpha(t, 1.4, 17.6, 1.0)
    if ia > 0:
        size = 272
        ic = icon.resize((size, size), Image.LANCZOS)
        faded = Image.new("RGBA", ic.size, (0, 0, 0, 0))
        faded = Image.blend(faded, ic, min(1.0, ia))
        img.alpha_composite(faded, (W // 2 - size // 2, 146))

    na = cue_alpha(t, 3.6, 17.6, 0.9)
    if na > 0:
        a = int(255 * na)
        f = font(SERIF_B, 150)
        for off in (6, 5):
            spaced(d, (W / 2, 452 + off), "AI JUDGE", f, (0, 0, 0, int(a * 0.55)), 20)
        spaced(d, (W / 2, 452), "AI JUDGE", f, PARCH + (a,), 20)
        d.line([(W / 2 - 340, 646), (W / 2 + 340, 646)],
               fill=BRASS + (int(a * 0.8),), width=3)

    pa = cue_alpha(t, 6.4, 17.6, 0.9)
    if pa > 0:
        a = int(255 * pa)
        f = font(SANS_B, 30)
        spaced(d, (W / 2, 686), "VR  ·  ANDROID  ·  MACOS  ·  WINDOWS  ·  LINUX",
               f, BRASS + (a,), 8)

    # the date lands with a small punch, then holds
    da = cue_alpha(t, 10.0, 17.6, 0.35)
    if da > 0:
        punch = max(0.0, 1.0 - (t - 10.0) / 0.42)
        scale = 1.0 + 0.085 * punch * punch
        a = int(255 * da)
        size = int(118 * scale)
        f = font(SERIF_B, size)
        y = 796 - (size - 118) // 2
        for off in (7, 6):
            spaced(d, (W / 2, y + off), RELEASE, f, (0, 0, 0, int(a * 0.6)), 17)
        spaced(d, (W / 2, y), RELEASE, f, BRASS + (a,), 17)

    ta = cue_alpha(t, 11.2, 17.6, 0.8)
    if ta > 0:
        f = font(SANS, 27)
        txt = "aijudge  ·  the hall of small grievances"
        spaced(d, (W / 2, 962), txt, f, PARCH + (int(200 * ta),), 5)

    return img


def assemble():
    if not (FOOTAGE / "01-hall").exists():
        sys.exit("! no footage — run `node build/mktrailer.js` first")
    if WORK.exists():
        shutil.rmtree(WORK)
    WORK.mkdir(parents=True)

    vig = make_vignette()
    endbg = endcard_background()
    icon = Image.open(DIST / "icons" / "icon-512.png").convert("RGBA")

    # cache the frame lists per clip
    clips = {}
    for name, *_ in EDIT:
        clips[name] = sorted((FOOTAGE / name).glob("f*.jpg"))
        if not clips[name]:
            sys.exit(f"! no frames for {name}")

    print(f"  assembling        {TOTAL} frames")
    for idx in range(TOTAL):
        t = idx / FPS

        if t >= ENDCARD_IN:
            frame = draw_endcard(endbg, icon, t - ENDCARD_IN)
        else:
            seg = next(s for s in EDIT if s[3] <= t < s[4])
            name, cin, cout, tin, tout = seg
            src = clips[name]
            k = int((cin + (t - tin)) * FPS)
            k = max(0, min(len(src) - 1, k))
            frame = Image.open(src[k]).convert("RGB")
            frame = ImageChops.multiply(frame, vig).convert("RGBA")
            for cue in TEXT:
                style, text, a, b = cue[:4]
                dy = cue[4] if len(cue) > 4 else 0
                al = cue_alpha(t, a, b)
                if al > 0:
                    draw_cue(frame, style, text, al, dy)

        # open from black, and close on it
        fade = 1.0
        if t < 1.6:
            fade = t / 1.6
        elif t > DURATION - 1.8:
            fade = max(0.0, (DURATION - t) / 1.8)
        # a hard flash on the shot, matching the muzzle
        if 0 <= t - SHOT_T < 0.16:
            frame = Image.blend(frame, Image.new("RGBA", (W, H), (255, 240, 214, 255)),
                                0.34 * (1 - (t - SHOT_T) / 0.16))
        out = frame.convert("RGB")
        if fade < 1.0:
            out = Image.blend(Image.new("RGB", (W, H), (0, 0, 0)), out, fade)

        out.save(WORK / f"f{idx + 1:05d}.jpg", quality=93, subsampling=1)
        if idx % 300 == 0:
            print(f"    {idx}/{TOTAL}  {t:6.1f}s")
    print(f"    {TOTAL}/{TOTAL}  done")


def encode(audio):
    out = DIST / f"AIJudge-{VERSION}-trailer.mp4"
    if out.exists():
        out.unlink()
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-framerate", str(FPS), "-i", str(WORK / "f%05d.jpg"),
        "-i", str(audio),
        "-c:v", "libx264", "-preset", "slow", "-crf", "19",
        "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        "-shortest", str(out)
    ], check=True)
    return out


def main():
    print(f"AI Judge {VERSION} — trailer")
    FOOTAGE.mkdir(parents=True, exist_ok=True)
    audio = FOOTAGE / "score.wav"
    build_score(audio)
    assemble()
    out = encode(audio)
    probe = subprocess.run(
        ["ffprobe", "-hide_banner", "-v", "error", "-show_entries",
         "format=duration,size:stream=codec_name,width,height,r_frame_rate",
         "-of", "default=nw=1", str(out)],
        capture_output=True, text=True).stdout.strip().replace("\n", "  ")
    print(f"  {out.name}   {out.stat().st_size/1024/1024:.1f} MB")
    print(f"  {probe}")
    shutil.rmtree(WORK, ignore_errors=True)


if __name__ == "__main__":
    main()
