"""
Lay captions over the rendered frames and encode the final MP4.

The bpy wheel is built without FFMPEG support, so Blender cannot encode video
here. Captions are drawn with Pillow and the frames are piped straight into
ffmpeg, which avoids writing a second copy of the sequence to disk.

    ./bl/bin/python compose.py
"""

import os
import glob
import subprocess
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES = os.path.join(HERE, "out", "frames")
OUT_MP4 = os.path.join(HERE, "out", "kinger_on_claude.mp4")

FPS = 24

# Speech beats: (first frame, last frame, caption). Mirrors build_scene.BEATS.
BEATS = [
    (1, 62, "Oh! Oh my — is it recording? It's recording."),
    (63, 128, "They asked me to say a few words about Claude."),
    (129, 200, "I handed it the most dreadful tangle of a problem…"),
    (201, 268, "…and it just understood. Straight away!"),
    (269, 330, "Didn't even sigh at me. Not once."),
    (331, 396, "Marvelous. Truly marvelous."),
]

TAG_A, TAG_B = 26, 122
TAG_NAME = "KINGER"
TAG_ROLE = "chess piece · long-time Claude user"

FONT_DIR = "/mnt/skills/examples/canvas-design/canvas-fonts"
F_BOLD = os.path.join(FONT_DIR, "InstrumentSans-Bold.ttf")
F_REG = os.path.join(FONT_DIR, "InstrumentSans-Regular.ttf")
F_FALLBACK = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

FADE = 6          # frames of fade at each end of a caption
WRAP_FRAC = 0.80  # caption wraps to this fraction of the frame width


def font(path, size):
    for p in (path, F_FALLBACK):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def ramp(f, a, b):
    """Alpha 0..1 with a short fade at each end of [a, b]."""
    if f < a or f > b:
        return 0.0
    return min(1.0, (f - a + 1) / FADE, (b - f + 1) / FADE)


def wrap_pixels(draw, text, fnt, max_w):
    """Wrap on measured width rather than character count."""
    lines, cur = [], ""
    for word in text.split():
        trial = (cur + " " + word).strip()
        if not cur or draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines or [text]


def rounded_box(draw, xy, radius, fill):
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def draw_caption(base, text, alpha, fnt):
    """Centred caption in a translucent rounded bar along the bottom."""
    if alpha <= 0.001:
        return base
    W, H = base.size
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    lines = wrap_pixels(d, text, fnt, W * WRAP_FRAC)

    asc, desc = fnt.getmetrics()
    lh = int((asc + desc) * 1.22)
    widths = [d.textlength(ln, font=fnt) for ln in lines]
    tw = max(widths)
    th = lh * len(lines)

    pad_x, pad_y = 34, 22
    bx0 = (W - tw) / 2 - pad_x
    bx1 = (W + tw) / 2 + pad_x
    by1 = H - 46
    by0 = by1 - th - pad_y * 2
    rounded_box(d, (bx0, by0, bx1, by1), radius=18, fill=(10, 8, 18, int(150 * alpha)))

    y = by0 + pad_y
    for ln, w in zip(lines, widths):
        x = (W - w) / 2
        d.text((x + 2, y + 2), ln, font=fnt, fill=(0, 0, 0, int(190 * alpha)))
        d.text((x, y), ln, font=fnt, fill=(255, 251, 243, int(255 * alpha)))
        y += lh

    return Image.alpha_composite(base, layer)


def draw_tag(base, alpha, f_name, f_role):
    """Lower-third name plate with a small accent rule."""
    if alpha <= 0.001:
        return base
    W, H = base.size
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    x, y = 84, int(H * 0.475)
    d.rectangle((x - 18, y - 4, x - 12, y + 66), fill=(255, 186, 92, int(235 * alpha)))
    d.text((x + 2, y + 2), TAG_NAME, font=f_name, fill=(0, 0, 0, int(190 * alpha)))
    d.text((x, y), TAG_NAME, font=f_name, fill=(255, 240, 208, int(255 * alpha)))
    y2 = y + 48
    d.text((x + 2, y2 + 2), TAG_ROLE, font=f_role, fill=(0, 0, 0, int(180 * alpha)))
    d.text((x, y2), TAG_ROLE, font=f_role, fill=(219, 214, 235, int(240 * alpha)))

    return Image.alpha_composite(base, layer)


def main():
    files = sorted(glob.glob(os.path.join(FRAMES, "f*.png")))
    if not files:
        raise SystemExit("no frames in %s - run `render.py frames` first" % FRAMES)

    W, H = Image.open(files[0]).size
    print("composing %d frames at %dx%d" % (len(files), W, H))

    f_cap = font(F_BOLD, 34)
    f_name = font(F_BOLD, 44)
    f_role = font(F_REG, 22)

    os.makedirs(os.path.dirname(OUT_MP4), exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H),
        "-framerate", str(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        OUT_MP4,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    for path in files:
        f = int(os.path.basename(path)[1:5])
        im = Image.open(path).convert("RGBA")
        for a, b, text in BEATS:
            al = ramp(f, a, b)
            if al > 0:
                im = draw_caption(im, text, al, f_cap)
        im = draw_tag(im, ramp(f, TAG_A, TAG_B), f_name, f_role)
        proc.stdin.write(im.convert("RGB").tobytes())

    proc.stdin.close()
    rc = proc.wait()
    if rc != 0:
        raise SystemExit("ffmpeg failed with %d" % rc)
    print("WROTE", OUT_MP4, os.path.getsize(OUT_MP4), "bytes")


if __name__ == "__main__":
    main()
