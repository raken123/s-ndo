"""Läser manus.txt, talar in varje replik med edge-tts och bygger tidslinjen.

Utdata (i build/):
  narration.wav   – hela berättarspåret, 48 kHz mono
  timeline.json   – scener och repliker med start/slut i sekunder
  undertext.srt   – undertexter, en mening (eller del av mening) per rad
"""
import asyncio
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import edge_tts
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
CACHE = BUILD / "tts-cache"
SR = 48000

VOICES = {
    "Berättare": dict(voice="sv-SE-SofieNeural", rate="-4%", pitch="+0Hz"),
    "Alba": dict(voice="sv-SE-SofieNeural", rate="+4%", pitch="+22Hz"),
    "Haji": dict(voice="sv-SE-MattiasNeural", rate="+0%", pitch="+4Hz"),
    "Ninja King": dict(voice="sv-SE-MattiasNeural", rate="-16%", pitch="-14Hz"),
    "Vida": dict(voice="sv-SE-SofieNeural", rate="-12%", pitch="-18Hz"),
}

# Fasta längder för scener utan repliker (titel och eftertext).
SILENT_SCENES = {"titel": 9.0, "slut": 10.0}
SCENE_LEAD = 1.4      # tystnad innan första repliken i en scen
SCENE_TAIL = 1.2      # tystnad efter sista repliken
GAP_SAME = 0.45       # mellan två repliker av samma talare
GAP_CHANGE = 0.32     # vid byte av talare
GAP_ATTRIB = 0.12     # före "sa hon", "hördes en röst" osv.
GAP_PARAGRAPH = 1.0   # tom rad i manuset


def parse(path):
    scenes = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("## "):
            scenes.append({"id": line[3:].strip(), "items": []})
        elif line.startswith("#"):
            continue
        elif not line:
            if scenes and scenes[-1]["items"] and scenes[-1]["items"][-1] != "paus":
                scenes[-1]["items"].append("paus")
        else:
            speaker, text = line.split(":", 1)
            speaker = speaker.strip()
            if speaker not in VOICES:
                sys.exit(f"okänd talare: {speaker}")
            scenes[-1]["items"].append({"speaker": speaker, "text": text.strip()})
    for s in scenes:
        while s["items"] and s["items"][-1] == "paus":
            s["items"].pop()
    return scenes


async def synth(speaker, text):
    cfg = VOICES[speaker]
    key = hashlib.sha1(json.dumps([cfg, text], ensure_ascii=False).encode()).hexdigest()[:16]
    mp3 = CACHE / f"{key}.mp3"
    meta = CACHE / f"{key}.json"
    if not (mp3.exists() and meta.exists()):
        for attempt in range(5):
            try:
                com = edge_tts.Communicate(text, cfg["voice"], rate=cfg["rate"], pitch=cfg["pitch"])
                audio, cues = bytearray(), []
                async for chunk in com.stream():
                    if chunk["type"] == "audio":
                        audio += chunk["data"]
                    elif chunk["type"] == "SentenceBoundary":
                        cues.append({"t": chunk["offset"] / 1e7, "d": chunk["duration"] / 1e7, "text": chunk["text"]})
                mp3.write_bytes(audio)
                meta.write_text(json.dumps(cues, ensure_ascii=False))
                break
            except Exception as e:  # nätverksfel: försök igen
                print("  försöker igen:", e)
                await asyncio.sleep(2 ** attempt)
        else:
            sys.exit(f"kunde inte tala in: {text[:40]}")
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(mp3), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32), json.loads(meta.read_text())


def trim(sig, thresh=0.004):
    """Klipp bort tystnad i början och slutet, men behåll en liten marginal."""
    idx = np.flatnonzero(np.abs(sig) > thresh)
    if not len(idx):
        return sig, 0.0
    a = max(0, idx[0] - int(0.03 * SR))
    b = min(len(sig), idx[-1] + int(0.08 * SR))
    return sig[a:b], a / SR


def split_cue(text, start, end, max_len=84):
    """Dela långa meningar vid komma/mellanslag och fördela tiden efter längd."""
    if len(text) <= max_len:
        return [(start, end, text)]
    words, parts, cur = text.split(" "), [], ""
    n_parts = -(-len(text) // max_len)
    target = len(text) / n_parts
    for w in words:
        cand = (cur + " " + w).strip()
        if cur and (len(cand) > max_len or (len(cur) >= target * 0.8 and cur.endswith((",", ":", ";")))):
            parts.append(cur)
            cur = w
        else:
            cur = cand
    parts.append(cur)
    total = sum(len(p) for p in parts)
    out, t = [], start
    for p in parts:
        dt = (end - start) * len(p) / total
        out.append((t, t + dt, p))
        t += dt
    return out


def wrap(text, width=46):
    if len(text) <= width:
        return text
    words = text.split(" ")
    best = None
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        score = max(len(a), len(b))
        if best is None or score < best[0]:
            best = (score, a, b)
    return best[1] + "\n" + best[2]


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


async def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    scenes = parse(ROOT / "manus.txt")
    pieces, timeline, cues = [], [], []
    t = 0.0

    def put(sig):
        nonlocal t
        pieces.append(sig)
        t += len(sig) / SR

    def silence(sec):
        put(np.zeros(int(sec * SR), dtype=np.float32))

    for scene in scenes:
        start = t
        lines = []
        if scene["id"] in SILENT_SCENES:
            silence(SILENT_SCENES[scene["id"]])
        else:
            silence(SCENE_LEAD)
            prev = None
            for item in scene["items"]:
                if item == "paus":
                    silence(GAP_PARAGRAPH)
                    prev = None
                    continue
                if prev is not None:
                    if item["text"][0].islower():
                        silence(GAP_ATTRIB)
                    elif prev == item["speaker"]:
                        silence(GAP_SAME)
                    else:
                        silence(GAP_CHANGE)
                print(f"[{scene['id']}] {item['speaker']}: {item['text'][:60]}")
                sig, sentence_cues = await synth(item["speaker"], item["text"])
                sig, cut = trim(sig)
                line_start = t
                put(sig)
                lines.append({"speaker": item["speaker"], "text": item["text"],
                              "start": round(line_start, 3), "end": round(t, 3)})
                for i, c in enumerate(sentence_cues):
                    cs = line_start + max(0.0, c["t"] - cut)
                    nxt = sentence_cues[i + 1]["t"] - cut if i + 1 < len(sentence_cues) else None
                    ce = line_start + (nxt if nxt is not None else len(sig) / SR)
                    ce = min(ce, line_start + max(0.0, c["t"] + c["d"] - cut) + 0.6, t)
                    for a, b, txt in split_cue(c["text"].strip(), cs, ce):
                        cues.append({"start": a, "end": b, "text": txt, "speaker": item["speaker"]})
                prev = item["speaker"]
            silence(SCENE_TAIL)
        timeline.append({"id": scene["id"], "start": round(start, 3), "end": round(t, 3), "lines": lines})

    audio = np.concatenate(pieces)
    peak = np.abs(audio).max()
    audio = audio / peak * 0.89
    import wave
    with wave.open(str(BUILD / "narration.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype("<i2").tobytes())

    (BUILD / "timeline.json").write_text(json.dumps(
        {"duration": round(t, 3), "scenes": timeline, "cues": cues}, ensure_ascii=False, indent=1))

    with open(ROOT / "undertext.srt", "w", encoding="utf-8") as f:
        for i, c in enumerate(cues, 1):
            end = min(c["end"], cues[i]["start"] - 0.02) if i < len(cues) else c["end"]
            f.write(f"{i}\n{srt_time(c['start'])} --> {srt_time(end)}\n{wrap(c['text'])}\n\n")
    print(f"klart: {t / 60:.1f} min, {len(cues)} undertexter")


if __name__ == "__main__":
    asyncio.run(main())
