"""Listens to an ad's final mix: cuts out every spoken line and runs it
through an offline speech recognizer (Whisper tiny via sherpa-onnx), so you
can see whether each line is understandable over the music.

    python3 check_voices.py build/ep/kitchen [build/ep/space ...]

Needs sherpa-onnx-whisper-tiny.en next to the TTS (see lib_audio.py):
github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.en.tar.bz2
Tiny Whisper is a weak listener: made-up words and very short lines can
come back garbled even when they sound fine.
"""

import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TTS = os.environ.get("HUBAI_TTS_DIR", os.path.join(HERE, "tts"))
BIN = os.path.join(TTS, "sherpa-onnx-v1.12.0-linux-x64-static", "bin", "sherpa-onnx-offline")
W = os.path.join(TTS, "sherpa-onnx-whisper-tiny.en")


def words(s):
    return re.findall(r"[a-z0-9']+", s.lower().replace("twenty", "20"))


def check(folder):
    tl = json.load(open(os.path.join(folder, "timeline.json")))
    tmp = tempfile.mkdtemp()
    full = os.path.join(tmp, "a.wav")
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", os.path.join(folder, "audio.wav"), "-ac", "1", "-ar", "16000", full], check=True)
    files = []
    for i, l in enumerate(tl["lines"]):
        f = os.path.join(tmp, "l%02d.wav" % i)
        subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-ss", str(max(0, l["start"] - 0.1)),
                        "-t", str(l["end"] - l["start"] + 0.25), "-i", full, "-af", "adelay=600,apad=pad_dur=0.6", f], check=True)
        files.append(f)
    r = subprocess.run([BIN, "--whisper-encoder=" + W + "/tiny.en-encoder.onnx", "--whisper-decoder=" + W + "/tiny.en-decoder.onnx",
                        "--tokens=" + W + "/tiny.en-tokens.txt"] + files, capture_output=True, text=True)
    out = r.stdout + r.stderr  # sherpa-onnx prints its results on stderr
    heard = re.findall(r'"text": "([^"]*)"', out)
    total = hit = 0
    print("==", folder)
    for l, h in zip(tl["lines"], heard):
        want, got = words(l["text"]), set(words(h))
        n = sum(1 for w in want if w in got)
        total += len(want)
        hit += n
        print("  %3d%%  %-8s %-58s | %s" % (100 * n // max(1, len(want)), l["who"], l["text"][:58], h.strip()))
    print("  words recognized: %d%%" % (100 * hit // max(1, total)))


if __name__ == "__main__":
    for f in sys.argv[1:]:
        check(f)
