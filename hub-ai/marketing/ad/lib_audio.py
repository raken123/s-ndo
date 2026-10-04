"""Shared audio tools for the Hub AI ads: real voices (offline TTS), music,
sound effects, mixing, and the per-frame mouth movement for lip sync.

Voices come from Kokoro (an open TTS model) run by sherpa-onnx, fully
offline. Point HUBAI_TTS_DIR at a folder holding the unpacked downloads:

    sherpa-onnx-v1.12.0-linux-x64-static/   (github.com/k2-fsa/sherpa-onnx/releases/tag/v1.12.0)
    kokoro-en-v0_19/                         (github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models)

Each line is cached in build/voice-cache/, so re-running is quick.
"""

import hashlib
import json
import math
import os
import random
import struct
import subprocess
import wave

SR = 44100
FPS = 30
HERE = os.path.dirname(os.path.abspath(__file__))
TTS_DIR = os.environ.get("HUBAI_TTS_DIR", os.path.join(HERE, "tts"))

# Kokoro v0.19 speakers: 1 af_bella, 6 am_michael, 10 bm_lewis (see the
# sherpa-onnx docs). pitch is in semitones; tempo > 1 is faster.
VOICES = {
    "minnie": {"sid": 1, "pitch": 2.0, "tempo": 1.05, "gain": 1.0},
    "max": {"sid": 6, "pitch": 1.0, "tempo": 1.05, "gain": 1.0},
    "teacher": {"sid": 10, "pitch": -1.5, "tempo": 1.1, "gain": 1.15, "grit": True},
    "announcer": {"sid": 9, "pitch": -0.5, "tempo": 1.05, "gain": 1.05},
}


# ---------- WAV helpers ----------

def read_wav(path):
    """Mono float samples at SR."""
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getsampwidth() == 2, path
        n, ch = w.getnframes(), w.getnchannels()
        data = struct.unpack("<%dh" % (n * ch), w.readframes(n))
    return [data[i] / 32768 for i in range(0, len(data), ch)]


def write_wav(path, mono, peak=0.89):
    top = max((abs(v) for v in mono), default=0) or 1.0
    k = peak / top
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        buf = bytearray()
        for v in mono:
            s = int(max(-1.0, min(1.0, math.tanh(v * k * 1.1))) * 32767)
            buf += struct.pack("<hh", s, s)
        w.writeframes(bytes(buf))


# ---------- voices ----------

def say(who, text, cache_dir, tempo_extra=1.0):
    """Synthesizes one line for a character; returns mono samples."""
    v = VOICES[who]
    os.makedirs(cache_dir, exist_ok=True)
    key = hashlib.sha1(json.dumps([who, text, v, tempo_extra], sort_keys=True).encode()).hexdigest()[:16]
    out = os.path.join(cache_dir, key + ".wav")
    if not os.path.exists(out):
        raw = os.path.join(cache_dir, key + ".raw.wav")
        sherpa = os.path.join(TTS_DIR, "sherpa-onnx-v1.12.0-linux-x64-static", "bin", "sherpa-onnx-offline-tts")
        kok = os.path.join(TTS_DIR, "kokoro-en-v0_19")
        if not os.path.exists(sherpa):
            raise SystemExit("TTS not found in %s; see lib_audio.py for the downloads." % TTS_DIR)
        subprocess.run([sherpa, "--kokoro-model=" + kok + "/model.onnx", "--kokoro-voices=" + kok + "/voices.bin",
                        "--kokoro-tokens=" + kok + "/tokens.txt", "--kokoro-data-dir=" + kok + "/espeak-ng-data",
                        "--num-threads=4", "--sid=%d" % v["sid"], "--output-filename=" + raw, text],
                       check=True, capture_output=True)
        k = 2 ** (v["pitch"] / 12)
        tempo = v["tempo"] * tempo_extra / k
        chain = ["asetrate=%d" % round(24000 * k), "aresample=%d" % SR]
        while tempo > 2.0 or tempo < 0.5:  # atempo's range
            step = 2.0 if tempo > 2.0 else 0.5
            chain.append("atempo=%g" % step)
            tempo /= step
        chain.append("atempo=%.4f" % tempo)
        chain.append("silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_threshold=-45dB:stop_duration=0.25")
        if v.get("grit"):
            chain.append("acrusher=bits=12:mix=0.15,equalizer=f=180:t=q:w=1:g=4")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", ",".join(chain), "-ac", "1", "-ar", str(SR), out],
                       check=True)
    s = read_wav(out)
    return [x * v["gain"] for x in s]


def place_lines(lines, cache_dir, fit=True):
    """lines: [(start, slot_end, who, text)]. Synthesizes each line, speeding
    it up (max 25 %) when it would overrun its slot. Returns placed lines
    [{start, end, who, text, samples}]."""
    out = []
    for start, slot_end, who, text in lines:
        s = say(who, text, cache_dir)
        d = len(s) / SR
        if fit and d > (slot_end - start) + 0.05:
            factor = min(1.25, d / (slot_end - start))
            s = say(who, text, cache_dir, tempo_extra=factor)
            d = len(s) / SR
        out.append({"start": start, "end": round(start + d, 3), "who": who, "text": text, "samples": s})
    return out


def mouth_track(placed, who, length):
    """Per-frame mouth opening (0..1) for one character, from the loudness
    of their voice."""
    n = int(length * FPS)
    env = [0.0] * n
    hop = SR // FPS
    for ln in placed:
        if ln["who"] != who:
            continue
        s = ln["samples"]
        for i in range(0, len(s), hop):
            frame = int(ln["start"] * FPS) + i // hop
            if 0 <= frame < n:
                chunk = s[i:i + hop]
                env[frame] = max(env[frame], math.sqrt(sum(x * x for x in chunk) / max(1, len(chunk))))
    top = sorted(env)[int(len(env) * 0.98)] or 1.0
    out, prev = [], 0.0
    for v in env:
        target = min(1.0, (v / top) ** 0.7) if v > top * 0.08 else 0.0
        prev = prev + (target - prev) * (0.75 if target > prev else 0.55)
        out.append(round(prev, 2))
    return out


# ---------- synthesis ----------

class Mix:
    def __init__(self, length, seed=7):
        self.length = length
        self.buf = [0.0] * int(SR * length)
        self.rng = random.Random(seed)

    def add(self, t0, samples, gain=1.0):
        i0 = int(t0 * SR)
        b = self.buf
        for j, v in enumerate(samples):
            k = i0 + j
            if 0 <= k < len(b):
                b[k] += v * gain

    def noise(self, dur, decay, gain, hp=True):
        n, out, prev = int(dur * SR), [], 0.0
        for i in range(n):
            x = self.rng.uniform(-1, 1)
            out.append((x - prev if hp else x) * math.exp(-decay * i / SR) * gain)
            prev = x
        return out

    def whoosh(self, t0, dur=0.5, gain=0.35):
        n, out, y = int(dur * SR), [], 0.0
        for i in range(n):
            cutoff = 300 + 5000 * math.sin(math.pi * i / n)
            a = 1 - math.exp(-2 * math.pi * cutoff / SR)
            y += a * (self.rng.uniform(-1, 1) - y)
            out.append(y * math.sin(math.pi * i / n) * gain)
        self.add(t0, out)

    def sweep(self, t0, dur, f_from, f_to, gain, shape="sin"):
        n, ph, out = int(dur * SR), 0.0, []
        for i in range(n):
            f = f_from * (f_to / f_from) ** (i / n)
            ph += f / SR
            v = math.sin(2 * math.pi * ph) if shape == "sin" else (4 * abs(ph % 1 - 0.5) - 1)
            out.append(v * math.sin(math.pi * i / n) * gain)
        self.add(t0, out)

    def pop(self, t0, f=600, gain=0.3):
        self.sweep(t0, 0.09, f, f * 2.2, gain)

    def bonk(self, t0, gain=0.6):
        """Cartoon bonk: a woody knock with a falling pitch."""
        n, ph, out = int(0.22 * SR), 0.0, []
        for i in range(n):
            t = i / SR
            f = 900 * math.exp(-t * 18) + 220
            ph += f / SR
            out.append((math.sin(2 * math.pi * ph) + 0.5 * math.sin(4 * math.pi * ph)) * math.exp(-t * 22) * gain)
        self.add(t0, out)
        self.add(t0, self.noise(0.05, 60, gain * 0.5))

    def buzzer(self, t0, dur=0.6, gain=0.25):
        n = int(dur * SR)
        self.add(t0, [(1.0 if (110 * i / SR) % 1 < 0.5 else -1.0) * gain * (0.6 + 0.4 * ((i // (SR // 12)) % 2)) for i in range(n)])

    def tick(self, t0, gain=0.25):
        self.add(t0, self.noise(0.025, 200, gain))

    def ding(self, t0, gain=0.25, f=1760):
        """A bell: a few inharmonic partials ringing out."""
        n, out = int(1.6 * SR), []
        for i in range(n):
            t = i / SR
            v = sum(a * math.sin(2 * math.pi * f * r * t) * math.exp(-t * d) for r, a, d in ((1, 1, 2.5), (2.76, 0.5, 4), (5.4, 0.25, 6)))
            out.append(v * gain)
        self.add(t0, out)

    def doorbell(self, t0, gain=0.25):
        self.ding(t0, gain, 1318.5)
        self.ding(t0 + 0.45, gain, 1046.5)

    def poof(self, t0, gain=0.4):
        n, out, y = int(0.7 * SR), [], 0.0
        for i in range(n):
            a = 1 - math.exp(-2 * math.pi * (2500 * math.exp(-i / SR * 4) + 200) / SR)
            y += a * (self.rng.uniform(-1, 1) - y)
            out.append(y * math.exp(-i / SR * 4) * gain)
        self.add(t0, out)

    def applause(self, t0, dur=2.5, gain=0.35):
        """Lots of little claps, swelling and fading."""
        claps = int(dur * 45)
        for k in range(claps):
            t = t0 + self.rng.uniform(0, dur)
            env = math.sin(math.pi * (t - t0) / dur)
            self.add(t, self.noise(0.03, 120, gain * env * self.rng.uniform(0.4, 1.0)))

    def cheer(self, t0, dur=2.0, gain=0.25):
        self.applause(t0, dur, gain)
        n, out, y = int(dur * SR), [], 0.0
        for i in range(n):
            a = 1 - math.exp(-2 * math.pi * 900 / SR)
            y += a * (self.rng.uniform(-1, 1) - y)
            out.append(y * math.sin(math.pi * i / n) * gain * 0.8)
        self.add(t0, out)

    def drumroll(self, t0, dur=1.6, gain=0.25):
        t = t0
        while t < t0 + dur:
            self.add(t, self.noise(0.04, 60, gain * (0.5 + 0.5 * (t - t0) / dur)))
            t += 0.035
        self.add(t0 + dur, self.noise(0.5, 6, gain * 1.6, hp=False))

    def alarm(self, t0, dur=1.5, gain=0.18):
        n = int(dur * SR)
        self.add(t0, [math.sin(2 * math.pi * (880 if (i // (SR // 4)) % 2 else 660) * i / SR) * gain for i in range(n)])

    def thud(self, t0, gain=0.8):
        n, ph, out = int(0.5 * SR), 0.0, []
        for i in range(n):
            t = i / SR
            ph += (40 + 60 * math.exp(-t * 20)) / SR
            out.append(math.sin(2 * math.pi * ph) * math.exp(-t * 7) * gain)
        self.add(t0, out)
        self.add(t0, self.noise(0.3, 10, gain * 0.3, hp=False))


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tone(freq, dur, shape="tri", decay=6.0, gain=0.2):
    n, out = int(dur * SR), []
    for i in range(n):
        ph = freq * i / SR
        if shape == "tri":
            v = 4 * abs(ph % 1 - 0.5) - 1
        elif shape == "sq":
            v = 1.0 if ph % 1 < 0.5 else -1.0
        else:
            v = math.sin(2 * math.pi * ph)
        out.append(v * math.exp(-decay * i / SR) * gain)
    return out


def kick(gain=0.9):
    n, out, ph = int(0.28 * SR), [], 0.0
    for i in range(n):
        t = i / SR
        ph += (50 + 120 * math.exp(-t * 28)) / SR
        out.append(math.sin(2 * math.pi * ph) * math.exp(-t * 11) * gain)
    return out


def lowpass(samples, cutoff):
    a, y, out = 1 - math.exp(-2 * math.pi * cutoff / SR), 0.0, []
    for x in samples:
        y += a * (x - y)
        out.append(y)
    return out


def groove(mix, start, end, chords, roots, bpm=120, bass=True, drums=True, gain=1.0):
    """A bouncy loop: kick, offbeat chords, hats and an eighth-note bass."""
    beat_len = 60 / bpm
    t, beat = start, 0
    while t < end:
        bar = int((t - start) / (4 * beat_len)) % len(chords)
        if drums and beat % 2 == 0:
            mix.add(t, kick(0.9 * gain))
        if beat % 4 in (1, 3):
            if drums:
                mix.add(t, mix.noise(0.12, 30, 0.18 * gain))
            for m in chords[bar]:
                mix.add(t, tone(note(m + 12), 0.22, "tri", 14, 0.07 * gain))
        if drums:
            mix.add(t, mix.noise(0.03, 120, 0.06 * gain))
            mix.add(t + beat_len / 2, mix.noise(0.03, 120, 0.05 * gain))
        if bass:
            r = roots[bar]
            mix.add(t, lowpass(tone(note(r + 12), beat_len * 0.45, "sq", 5, 0.12 * gain), 700))
            mix.add(t + beat_len / 2, lowpass(tone(note(r + 24), beat_len * 0.4, "sq", 6, 0.08 * gain), 900))
        t += beat_len
        beat += 1


def finish(path_wav, path_json, length, music, voices_and_fx, placed, extra=None):
    """Ducks the music under speech, mixes, writes the WAV and the timeline."""
    duck = [1.0] * len(music.buf)
    for ln in placed:
        for i in range(max(0, int((ln["start"] - 0.1) * SR)), min(len(duck), int((ln["end"] + 0.15) * SR))):
            duck[i] = 0.32
    for ln in placed:
        voices_and_fx.add(ln["start"], ln["samples"], 1.25)
    fade = int(0.6 * SR)
    n = len(music.buf)
    mix = [(voices_and_fx.buf[i] + music.buf[i] * duck[i]) * (min(1.0, (n - i) / fade)) for i in range(n)]
    write_wav(path_wav, mix)
    who = sorted({ln["who"] for ln in placed})
    tl = {"length": length,
          "lines": [{k: ln[k] for k in ("start", "end", "who", "text")} for ln in placed],
          "mouth": {w: mouth_track(placed, w, length) for w in who}}
    tl.update(extra or {})
    with open(path_json, "w", encoding="utf-8") as f:
        json.dump(tl, f, ensure_ascii=False)
    return tl
