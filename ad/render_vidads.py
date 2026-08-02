"""Render the portrait in-app video ads (fictional brands). 1080x1920, 24fps."""
import os, subprocess, sys, time, wave
from multiprocessing import Pool
import numpy as np, imageio_ffmpeg

from gfx import W, H
from vidads import ADS
from admusic import music

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "outvidads")
os.makedirs(OUT, exist_ok=True)
FPS, SR, CHUNK = 24, 44100, 5.0


def part(job):
    """One 5-second chunk of one ad, so the pool has enough work units."""
    ai, ci = job
    slug, dur, fn, _ = ADS[ai]
    path = os.path.join(OUT, "p_%s_%02d.mp4" % (slug, ci))
    if os.path.exists(path):
        return job
    t0, t1 = ci * CHUNK / dur, min(1.0, (ci + 1) * CHUNK / dur)
    nf = int(round((t1 - t0) * dur * FPS))
    wav = path + ".wav"
    with wave.open(wav, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(music(ai * 4 + ci, dur=(t1 - t0) * dur,
                            impact=(ci == 0)).tobytes())
    p = subprocess.Popen([FF, "-y", "-loglevel", "error", "-f", "rawvideo",
        "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H), "-r", str(FPS), "-i", "-",
        "-i", wav, "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
        "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "112k",
        "-shortest", "-movflags", "+faststart", path], stdin=subprocess.PIPE)
    for i in range(nf):
        t = t0 + (t1 - t0) * (i / max(1, nf - 1))
        im = fn(min(1.0, t))
        p.stdin.write(np.asarray(im.convert("RGB"), dtype=np.uint8).tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError(path)
    os.remove(wav)
    return job


if __name__ == "__main__":
    t0 = time.time()
    # optional slug filter, so reworking one spot doesn't re-render all of them
    only = set(sys.argv[1:])
    want = [ai for ai, (slug, *_r) in enumerate(ADS) if not only or slug in only]
    bad = only - {a[0] for a in ADS}
    if bad:
        raise SystemExit("unknown ad slug(s): %s" % ", ".join(sorted(bad)))
    jobs = []
    for ai in want:
        for ci in range(int(ADS[ai][1] / CHUNK)):
            jobs.append((ai, ci))
    print("%d ads, %d chunks, %d workers"
          % (len(want), len(jobs), len(os.sched_getaffinity(0))), flush=True)

    done = 0
    with Pool(len(os.sched_getaffinity(0))) as pool:
        for _ in pool.imap_unordered(part, jobs):
            done += 1
            el = time.time() - t0
            print("  %02d/%d  %.1f min elapsed  eta %.1f min"
                  % (done, len(jobs), el / 60,
                     el / done * (len(jobs) - done) / 60), flush=True)

    for ai in want:
        slug, dur, fn, desc = ADS[ai]
        parts = [os.path.join(OUT, "p_%s_%02d.mp4" % (slug, ci))
                 for ci in range(int(dur / CHUNK))]
        lst = os.path.join(OUT, "l_%s.txt" % slug)
        with open(lst, "w") as f:
            for pp in parts:
                f.write("file '%s'\n" % pp)
        final = os.path.join(HERE, "gmfy_vidad_%s.mp4" % (slug,))
        subprocess.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                        "-i", lst, "-c", "copy", final], check=True)
        os.remove(lst)
        for pp in parts:
            os.remove(pp)
        print("  %-11s %5d KB  %s" % (slug, os.path.getsize(final) // 1024, desc),
              flush=True)
    print("EVTDONE %.1f min" % ((time.time() - t0) / 60), flush=True)
