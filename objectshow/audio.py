"""The soundtrack: chiptune score, cartoon SFX and synthesised object voices.

Nothing is sampled -- every sound here is built out of numpy arrays, so the
whole episode is reproducible from source.
"""

import math

import numpy as np

SR = 44100


def n2f(midi):
    return 440.0 * 2 ** ((midi - 69) / 12.0)


def osc(t, f, kind="square", detune=0.0):
    """Additive, harmonic-limited oscillators -- cheap and not harsh."""
    f = np.asarray(f, dtype=np.float64) * (1 + detune)
    ph = 2 * np.pi * f * t
    if kind == "sine":
        return np.sin(ph)
    out = np.zeros_like(t)
    if kind == "tri":
        harm, amp, sign = 5, lambda n: 1.0 / (n * n), True
        ns = range(1, 2 * harm, 2)
    elif kind == "saw":
        ns, amp, sign = range(1, 10), lambda n: 1.0 / n, False
    else:  # square
        ns, amp, sign = range(1, 16, 2), lambda n: 1.0 / n, False
    fmax = np.max(f) if np.size(f) else 1.0
    for i, n in enumerate(ns):
        if fmax * n > 9000:
            break
        s = -1 if (kind == "tri" and i % 2) else 1
        out += s * amp(n) * np.sin(ph * n)
    return out * (0.9 if kind != "tri" else 1.6)


def env(n, attack=0.005, decay=0.05, sustain=0.6, release=0.08):
    e = np.ones(n)
    a = max(1, int(attack * SR))
    d = max(1, int(decay * SR))
    r = max(1, int(release * SR))
    a, d, r = min(a, n), min(d, n), min(r, n)
    e[:a] = np.linspace(0, 1, a)
    e[a:a + d] = np.linspace(1, sustain, min(d, n - a))
    e[a + d:] = sustain
    e[n - r:] *= np.linspace(1, 0, r)
    return e


def noise(n, seed=0):
    rng = np.random.RandomState(seed)
    return rng.uniform(-1, 1, n)


def lowpass(x, cutoff):
    """One-pole lowpass, vectorised via an exponential-decay convolution."""
    if len(x) == 0:
        return x
    a = math.exp(-2 * math.pi * cutoff / SR)
    k = int(min(len(x), max(8, -6 / math.log(max(a, 1e-6)))))
    kern = (1 - a) * a ** np.arange(k)
    return np.convolve(x, kern, mode="full")[:len(x)]


class Track:
    def __init__(self, dur):
        self.buf = np.zeros(int(dur * SR) + SR, dtype=np.float64)

    def add(self, t, samples, gain=1.0):
        i = int(t * SR)
        if i < 0:
            samples, i = samples[-i:], 0
        j = min(len(self.buf), i + len(samples))
        if j > i:
            self.buf[i:j] += samples[:j - i] * gain

    def note(self, t, midi, dur, kind="square", gain=0.2, **kw):
        n = max(2, int(dur * SR))
        tt = np.arange(n) / SR
        self.add(t, osc(tt, n2f(midi), kind) * env(n, **kw) * gain)


# ------------------------------------------------------------------- sfx ---

def sfx(kind, seed=0):
    def T(d):
        return np.arange(int(d * SR)) / SR

    if kind == "pop":
        t = T(0.13)
        f = 900 * np.exp(-t * 16) + 220
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22) * 0.55
    if kind == "boing":
        t = T(0.34)
        f = 420 * np.exp(-t * 4.2) + 110 + 60 * np.sin(2 * np.pi * 11 * t)
        return osc(t, 1, "tri") * 0 + np.sin(
            2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.5
    if kind == "step":
        t = T(0.10)
        return (np.sin(2 * np.pi * 150 * t) + 0.4 * noise(len(t), seed)) * \
            np.exp(-t * 40) * 0.35
    if kind == "thud":
        t = T(0.28)
        f = 190 * np.exp(-t * 12) + 45
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) +
                0.5 * lowpass(noise(len(t), seed), 900)) * np.exp(-t * 13) * 0.6
    if kind == "crash":
        t = T(0.9)
        return lowpass(noise(len(t), seed), 5000) * np.exp(-t * 5.0) * 0.5
    if kind == "whoosh":
        t = T(0.55)
        w = lowpass(noise(len(t), seed), 2600)
        return w * np.sin(np.pi * np.clip(t / 0.55, 0, 1)) ** 2 * 0.35
    if kind == "zap":
        t = T(0.42)
        f = 1400 + 900 * np.sin(2 * np.pi * 28 * t)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.6 +
                0.6 * noise(len(t), seed)) * np.exp(-t * 9) * 0.42
    if kind == "drip":
        t = T(0.22)
        f = 1500 * np.exp(-t * 9) + 380
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 16) * 0.28
    if kind == "ding":
        t = T(0.55)
        return (np.sin(2 * np.pi * 1320 * t) +
                0.5 * np.sin(2 * np.pi * 1980 * t)) * np.exp(-t * 6) * 0.3
    if kind == "sparkle":
        out = np.zeros(int(0.7 * SR))
        for i, m in enumerate((84, 88, 91, 96)):
            t = T(0.5)
            s = np.sin(2 * np.pi * n2f(m) * t) * np.exp(-t * 9) * 0.16
            o = int(i * 0.07 * SR)
            out[o:o + len(s)] += s[:len(out) - o]
        return out
    if kind == "shine":
        t = T(1.4)
        f = np.linspace(200, 1500, len(t))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * \
            np.sin(np.pi * t / 1.4) ** 2 * 0.16
    if kind == "beep":
        t = T(0.16)
        return np.sin(2 * np.pi * 880 * t) * env(len(t), 0.004, 0.02, 0.8,
                                                 0.05) * 0.34
    if kind == "buzzer":
        t = T(0.85)
        return osc(t, 110, "square") * env(len(t), 0.005, 0.05, 0.9, 0.2) * 0.30
    if kind == "horn":
        t = T(0.7)
        return (osc(t, 330, "square") + osc(t, 440, "square")) * \
            env(len(t), 0.01, 0.06, 0.8, 0.25) * 0.20
    if kind == "slam":
        t = T(0.7)
        f = 320 * np.exp(-t * 15) + 60
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.8 +
                lowpass(noise(len(t), seed), 3000) * 0.5) * np.exp(-t * 6) * 0.55
    if kind == "tape":
        t = T(0.8)
        w = lowpass(noise(len(t), seed), 3000)
        return w * (0.5 + 0.5 * np.sin(2 * np.pi * 26 * t)) * \
            np.exp(-t * 2.2) * 0.22
    if kind == "sting":
        out = np.zeros(int(1.2 * SR))
        for i, m in enumerate((72, 76, 79)):
            t = T(1.0)
            s = osc(t, n2f(m), "square") * np.exp(-t * 3.2) * 0.12
            out[:len(s)] += s[:len(out)]
        return out
    if kind == "stinger":
        t = T(1.1)
        return (osc(t, n2f(45), "saw") + osc(t, n2f(51), "saw")) * \
            np.exp(-t * 2.4) * 0.12
    if kind == "creak":
        t = T(1.1)
        f = np.linspace(220, 130, len(t)) * (1 + 0.06 * np.sin(2 * np.pi * 7 * t))
        w = np.sin(2 * np.pi * np.cumsum(f) / SR)
        return w * (np.sin(np.pi * t / 1.1) ** 2) * 0.22
    if kind == "thunder":
        t = T(1.9)
        n = lowpass(noise(len(t), seed), 700)
        env_ = np.exp(-t * 1.5) * (1 - np.exp(-t * 30))
        rumble = np.sin(2 * np.pi * 42 * t) * np.exp(-t * 2.2) * 0.35
        return (n * 0.8 + rumble) * env_ * 0.55
    if kind == "rumble":
        t = T(2.2)
        w = np.sin(2 * np.pi * (36 + 4 * np.sin(2 * np.pi * 0.7 * t)) * t)
        return w * np.sin(np.pi * t / 2.2) ** 2 * 0.30
    if kind == "heartbeat":
        out = np.zeros(int(0.95 * SR))
        for i, off in enumerate((0.0, 0.30)):
            t = T(0.34)
            f = 90 * np.exp(-t * 9) + 42
            s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * \
                (0.40 if i == 0 else 0.28)
            o = int(off * SR)
            out[o:o + len(s)] += s[:len(out) - o]
        return out
    if kind == "wind":
        t = T(3.2)
        w = lowpass(noise(len(t), seed), 900)
        return w * (0.5 + 0.5 * np.sin(2 * np.pi * 0.3 * t)) * \
            np.sin(np.pi * t / 3.2) ** 2 * 0.20
    if kind == "boo":
        t = T(1.4)
        f = np.linspace(700, 90, len(t))
        w = osc(t, 1, "sine") * 0 + np.sin(2 * np.pi * np.cumsum(f) / SR)
        return (w + 0.5 * lowpass(noise(len(t), seed), 1800)) * \
            np.exp(-t * 2.0) * 0.42
    if kind == "click":
        t = T(0.08)
        return (noise(len(t), seed) * np.exp(-t * 90)) * 0.35
    if kind == "hum":
        t = T(3.0)
        w = (np.sin(2 * np.pi * 58 * t) * 0.8 +
             np.sin(2 * np.pi * 116.6 * t) * 0.25 +
             lowpass(noise(len(t), seed), 400) * 0.5)
        return w * np.sin(np.pi * t / 3.0) ** 0.6 * 0.16
    if kind == "crack":
        t = T(0.35)
        return (noise(len(t), seed) * np.exp(-t * 26) +
                np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 40) * 0.6) * 0.34
    if kind == "freeze":
        t = T(1.3)
        f = np.linspace(300, 2600, len(t))
        w = np.sin(2 * np.pi * np.cumsum(f) / SR)
        out = w * np.exp(-t * 1.6) * 0.20
        for i, m in enumerate((88, 93, 96)):
            tt = T(0.7)
            s = np.sin(2 * np.pi * n2f(m) * tt) * np.exp(-tt * 7) * 0.10
            o = int((0.25 + i * 0.14) * SR)
            out[o:o + len(s)] += s[:len(out) - o]
        return out
    if kind == "pass":
        t = T(1.5)
        f = 420 * np.exp(-t * 1.2) + 90
        w = (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5 +
             lowpass(noise(len(t), seed), 2200) * 0.9)
        return w * np.sin(np.pi * np.clip(t / 1.5, 0, 1)) ** 1.5 * 0.42
    if kind == "beepbeep":
        out = np.zeros(int(0.7 * SR))
        for i, off in enumerate((0.0, 0.26)):
            t = T(0.2)
            s = (osc(t, 440, "square") + osc(t, 554, "square")) * \
                env(len(t), 0.006, 0.03, 0.85, 0.06) * 0.16
            o = int(off * SR)
            out[o:o + len(s)] += s[:len(out) - o]
        return out
    if kind == "fanfare":
        out = np.zeros(int(2.0 * SR))
        for i, m in enumerate((67, 72, 76, 79)):
            t = T(0.7 if i < 3 else 1.3)
            s = (osc(t, n2f(m), "square") + 0.5 * osc(t, n2f(m + 12), "square")) \
                * env(len(t), 0.01, 0.08, 0.7, 0.3) * 0.16
            o = int(i * 0.17 * SR)
            out[o:o + len(s)] += s[:len(out) - o]
        return out
    return np.zeros(10)


# ---------------------------------------------------------------- voices ---

VOWELS = set("aeiouyAEIOUY")


def syllables(text):
    """Rough syllable count -- good enough to drive a mouth."""
    n, prev = 0, False
    for ch in text:
        v = ch in VOWELS
        if v and not prev:
            n += 1
        prev = v
    return max(1, n)


def voice_blips(text, dur, voice, seed):
    """Animal-Crossing style gibberish: one pitched blip per syllable."""
    from draw import rand01
    rate = voice["rate"]
    n = max(1, int(dur * 0.88 / rate))
    blips = []
    excited = text.count("!")
    question = text.rstrip().endswith("?")
    for i in range(n):
        f = i / max(1, n - 1)
        semis = (rand01(seed, i) - 0.5) * 2.4 * voice["spread"]
        semis += 3.0 * f if question else -1.6 * f
        semis += 1.2 * excited
        loud = 0.85 + 0.3 * rand01(seed, i, "a")
        if text[:60].isupper():
            loud *= 1.25
            semis += 1.5
        blips.append((i * rate, voice["base"] * 2 ** (semis / 12.0), loud))
    return blips


def render_voice(track, t0, text, voice, seed, gain=0.52):
    for off, f, loud in voice_blips(text, track.speak_dur, voice, seed):
        d = 0.055 + 0.02 * (f < 300)
        n = int(d * SR)
        t = np.arange(n) / SR
        sweep = f * (1 + 0.10 * np.exp(-t * 40))
        s = osc(t, sweep, voice["wave"]) * env(n, 0.004, 0.018, 0.45, 0.022)
        track.add(t0 + off, s * gain * loud)


# ----------------------------------------------------------------- music ---

CHORDS = {
    "I": (0, 4, 7), "vi": (9, 12, 16), "IV": (5, 9, 12), "V": (7, 11, 14),
    "ii": (2, 5, 9), "iii": (4, 7, 11), "bVII": (10, 14, 17),
    "i": (0, 3, 7), "iv": (5, 8, 12), "bVI": (8, 12, 15), "v": (7, 10, 14),
    "bII": (1, 5, 8),          # Neapolitan -- for when something is behind you
}

CUES = {
    # key root, bpm, progression, style
    "cold_open": (57, 84, ["i", "bVI", "iv", "v"], "sparse"),
    "title": (60, 150, ["I", "V", "vi", "IV"], "theme"),
    "rollcall": (60, 132, ["I", "vi", "IV", "V"], "bouncy"),
    "challenge": (58, 140, ["I", "bVII", "IV", "I"], "drive"),
    "stack": (55, 152, ["i", "bVII", "bVI", "v"], "drive"),
    "results": (62, 138, ["IV", "V", "I", "vi"], "bright"),
    "elimination": (53, 96, ["i", "bVI", "iv", "i"], "dark"),
    "outro": (60, 150, ["I", "V", "vi", "IV"], "theme"),
    # episode 2
    "recap": (60, 142, ["I", "V", "vi", "IV"], "theme"),
    "vote": (53, 100, ["i", "bVI", "iv", "v"], "dark"),
    "inside": (54, 118, ["i", "bVII", "bVI", "bVII"], "sneaky"),
    "judging": (62, 132, ["IV", "V", "I", "vi"], "bright"),
    # episode 3
    "show": (58, 126, ["I", "vi", "ii", "V"], "bouncy"),
    "scores": (62, 138, ["IV", "V", "I", "vi"], "bright"),
    # episode 4
    "nightfall": (51, 88, ["i", "bVI", "iv", "v"], "dark"),
    "watch": (49, 76, ["i", "i", "bII", "i"], "creep"),
    "bin": (51, 92, ["i", "bVI", "bVII", "i"], "creep"),
    # episode 5
    "arrivals": (60, 134, ["I", "vi", "IV", "V"], "bouncy"),
    "cycle": (57, 148, ["i", "bVII", "bVI", "bVII"], "drive"),
    # episode 6
    "fridge": (62, 126, ["I", "V", "vi", "IV"], "bouncy"),
    "cold": (57, 112, ["i", "bVII", "bVI", "v"], "sneaky"),
    # episode 7
    "hardshoulder": (58, 132, ["I", "bVII", "IV", "I"], "drive"),
    "cross": (55, 156, ["i", "bVII", "bVI", "v"], "drive"),
    # episode 8
    "binday": (60, 128, ["I", "vi", "IV", "V"], "bouncy"),
    "collect": (56, 158, ["i", "bVII", "bVI", "bVII"], "drive"),
    "winner": (60, 144, ["I", "V", "vi", "IV"], "theme"),
    "finale": (60, 138, ["IV", "V", "I", "vi"], "bright"),
}

MELODY = {
    "theme": [0, 4, 7, 12, 11, 7, 4, 7, 9, 7, 4, 0, 2, 4, 7, 4],
    "bouncy": [0, 7, 4, 7, 2, 7, 4, 7, 5, 12, 9, 12, 7, 11, 7, 2],
    "drive": [0, 0, 7, 0, 10, 0, 7, 5, 0, 0, 7, 12, 10, 7, 5, 3],
    "bright": [4, 7, 9, 12, 11, 9, 7, 4, 5, 9, 12, 16, 14, 12, 9, 7],
    "dark": [0, 3, 7, 3, 0, -2, 0, 3],
    "sparse": [0, 7, 3, 7],
    "sneaky": [0, 3, 5, 3, 7, 3, 5, 3, 0, -2, 0, 3, 5, 7, 5, 3],
    "creep": [0, -1, 0, 3, 0, -2, 0, 1],
}


def score_scene(track, sc, gain=1.0):
    root, bpm, prog, style = CUES.get(sc["key"], CUES["rollcall"])
    beat = 60.0 / bpm
    bar = beat * 4
    t, i = sc["t0"], 0
    mel = MELODY[style]
    dark = style in ("dark", "sparse", "creep")
    while t < sc["t1"] - 0.05:
        ch = CHORDS[prog[i % len(prog)]]
        # bass
        for k in range(4 if not dark else 2):
            bt = t + k * (beat if not dark else beat * 2)
            if bt >= sc["t1"]:
                break
            track.note(bt, root - 12 + ch[0], beat * 0.92, "tri",
                       gain=0.16 * gain, attack=0.006, decay=0.10,
                       sustain=0.55, release=0.06)
        # chord stabs
        for k in ((0, 2) if not dark else (0,)):
            bt = t + k * beat + (0.0 if dark else beat * 0.5)
            if bt >= sc["t1"]:
                break
            for nte in ch:
                track.note(bt, root + nte, beat * 0.45, "square",
                           gain=0.045 * gain, attack=0.005, decay=0.06,
                           sustain=0.4, release=0.06)
        # melody
        steps = 8 if not dark else 4
        for k in range(steps):
            bt = t + k * (bar / steps)
            if bt >= sc["t1"]:
                break
            m = mel[(i * steps + k) % len(mel)]
            track.note(bt, root + 12 + m, bar / steps * 0.85, "square",
                       gain=0.055 * gain, attack=0.004, decay=0.05,
                       sustain=0.45, release=0.05)
        # drums
        if not dark:
            for k in range(4):
                bt = t + k * beat
                if bt >= sc["t1"]:
                    break
                n = int(0.14 * SR)
                tt = np.arange(n) / SR
                kick = np.sin(2 * np.pi * (150 * np.exp(-tt * 22) + 45) * tt)
                if k % 2 == 0:
                    track.add(bt, kick * np.exp(-tt * 16) * 0.22 * gain)
                else:
                    sn = lowpass(noise(n, k + i), 4000)
                    track.add(bt, sn * np.exp(-tt * 24) * 0.11 * gain)
                for h in range(2):
                    hn = int(0.05 * SR)
                    ht = np.arange(hn) / SR
                    track.add(bt + h * beat / 2,
                              noise(hn, k * 3 + h) * np.exp(-ht * 60) * 0.05 * gain)
        t += bar
        i += 1


def duck_envelope(scenes, total, floor=0.42, ramp=0.12):
    """Pull the music down under every spoken line."""
    n = int(total * SR) + SR
    env_ = np.ones(n)
    r = int(ramp * SR)
    fade = np.linspace(1.0, floor, r)
    for sc in scenes:
        for b in sc["beats"]:
            if b["kind"] != "say":
                continue
            i = max(0, int((b["t0"] - 0.10) * SR))
            j = min(n, int((b["t0"] + b["speak"] + 0.18) * SR))
            if j - i < 2 * r + 2:
                continue
            env_[i:i + r] = np.minimum(env_[i:i + r], fade)
            env_[i + r:j - r] = np.minimum(env_[i + r:j - r], floor)
            env_[j - r:j] = np.minimum(env_[j - r:j], fade[::-1])
    return env_


def build_audio(scenes, cues, total):
    from cast import CAST
    music = Track(total)
    track = Track(total)

    for sc in scenes:
        g = 1.0
        if sc["key"] in ("rollcall", "results", "elimination", "challenge",
                         "stack", "cold_open"):
            g = 0.80
        score_scene(music, sc, g)
    music.buf *= duck_envelope(scenes, total)
    track.buf += music.buf

    for c in cues:
        track.add(c["t"], sfx(c["kind"], seed=int(c["t"] * 97) % 9973))

    idx = 0
    for sc in scenes:
        for b in sc["beats"]:
            if b["kind"] != "say":
                continue
            ch = CAST[b["who"]]
            track.speak_dur = b["speak"]
            render_voice(track, b["t0"], b["text"], ch.voice,
                         seed="%s%d" % (b["who"], idx))
            idx += 1

    buf = track.buf[:int(total * SR)]
    peak = np.max(np.abs(buf)) or 1.0
    buf = np.tanh(buf / max(peak, 0.9) * 1.25) * 0.92
    return buf


def write_wav(path, buf):
    import wave
    data = np.clip(buf, -1, 1)
    pcm = (data * 32767).astype("<i2")
    stereo = np.repeat(pcm[:, None], 2, axis=1).tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(stereo)
