"""Encode the portrait gmfy teasers down to publishable copies.

render_v340.py writes ~26 MB masters: the spots carry a rendered 3D world and
a per-frame grain pass, so they compress far worse than the flat in-app spots
do. That is the right size to keep as a master and the wrong size to commit or
upload seven of, so this makes a distribution pass.

Full 1080x1920 portrait is preserved — that is the whole point of these — and
only the bitrate comes down. At crf 28 a spot lands near 4 MB with no visible
damage to the type or the gradients.

Run after ad/render_v340.py; writes ad/promo/gmfy-3.4.0-<slug>.mp4.
"""
import os, subprocess, sys
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
SRC = os.path.join(ROOT, "ad")
DST = os.path.join(SRC, "promo")
FF = imageio_ffmpeg.get_ffmpeg_exe()

sys.path.insert(0, SRC)
from v340 import ADS                                     # noqa: E402  (needs SRC on path)


def encode(i, slug):
    src = os.path.join(SRC, "gmfy_3.4.0_ad_%d_%s.mp4" % (i + 1, slug))
    dst = os.path.join(DST, "gmfy-3.4.0-%s.mp4" % slug)
    if not os.path.exists(src):
        raise SystemExit("missing master: " + src)
    subprocess.run([
        FF, "-y", "-loglevel", "error", "-i", src,
        "-c:v", "libx264", "-preset", "slow", "-crf", "28",
        "-maxrate", "2500k", "-bufsize", "5M",
        "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
        "-c:a", "aac", "-b:a", "96k", "-ac", "2",
        "-movflags", "+faststart", dst], check=True)
    return os.path.getsize(dst)


if __name__ == "__main__":
    os.makedirs(DST, exist_ok=True)
    total = 0
    for i, (slug, _dur, _fn, desc) in enumerate(ADS):
        n = encode(i, slug)
        total += n
        print("  %-10s %5d KB  %s" % (slug, n // 1024, desc), flush=True)
    print("%d portrait spots, %.1f MB total" % (len(ADS), total / 1e6))
