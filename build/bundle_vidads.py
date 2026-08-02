"""Re-encode the 1080x1920 ad masters down to the copies the app ships.

The masters in ad/ are ~4.5 MB each — fine as source, far too heavy to bundle
eight of them into an APK and to inline as base64 in the single-file HTML.
These spots are flat gradients, large type and a little motion, so they survive
a big downscale: 720x1280 at a modest bitrate lands around 0.5 MB per 30s clip
with no visible damage to the text edges.

Run after ad/render_vidads.py; writes gmfyapp/www/ad/<slug>.mp4.
"""
import os, subprocess, sys
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
SRC = os.path.join(ROOT, "ad")
DST = os.path.join(ROOT, "gmfyapp", "www", "ad")
FF = imageio_ffmpeg.get_ffmpeg_exe()

sys.path.insert(0, SRC)
from vidads import ADS                                    # noqa: E402  (needs SRC on path)


def bundle(slug):
    src = os.path.join(SRC, "gmfy_vidad_%s.mp4" % slug)
    dst = os.path.join(DST, "%s.mp4" % slug)
    if not os.path.exists(src):
        raise SystemExit("missing master: " + src)
    subprocess.run([
        FF, "-y", "-loglevel", "error", "-i", src,
        "-vf", "scale=720:1280:flags=lanczos", "-r", "24",
        "-c:v", "libx264", "-preset", "slow", "-crf", "30",
        "-maxrate", "220k", "-bufsize", "600k",
        "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
        "-c:a", "aac", "-b:a", "64k", "-ac", "2",
        "-movflags", "+faststart", dst], check=True)
    return os.path.getsize(dst)


if __name__ == "__main__":
    os.makedirs(DST, exist_ok=True)
    total = 0
    for slug, _dur, _fn, desc in ADS:
        n = bundle(slug)
        total += n
        print("  %-12s %4d KB  %s" % (slug, n // 1024, desc), flush=True)
    print("bundled %d clips, %.1f MB total (base64 inlines to ~%.1f MB)"
          % (len(ADS), total / 1e6, total * 4 / 3 / 1e6))
