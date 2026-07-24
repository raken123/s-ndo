#!/usr/bin/env python3
"""Genererar Mattenites appikon i alla storlekar Android behöver.

  python3 tools/make-icons.py

Skapar res/icon/android/*.png (legacy + adaptiva ikoner) och www/img/icon.png.
Kräver Pillow:  pip install Pillow
"""

import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]

BRAND = (124, 92, 255)
BRAND2 = (0, 229, 200)
BOMB = (17, 21, 46)
SPARK = (255, 199, 58)


def font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def gradient(size):
    """Diagonal lila → turkos-gradient."""
    small = Image.new("RGB", (64, 64))
    px = small.load()
    for y in range(64):
        for x in range(64):
            t = (x / 63 * 0.55 + y / 63 * 0.45)
            px[x, y] = (
                int(BRAND[0] + (BRAND2[0] - BRAND[0]) * t),
                int(BRAND[1] + (BRAND2[1] - BRAND[1]) * t),
                int(BRAND[2] + (BRAND2[2] - BRAND[2]) * t),
            )
    return small.resize((size, size), Image.LANCZOS)


def draw_bomb(img, size, cx, cy, r, with_letter=True):
    """Ritar bomben med lunta och gnista på en befintlig bild."""
    d = ImageDraw.Draw(img, "RGBA")

    # Skugga
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse(
        [cx - r, cy - r + r * 0.10, cx + r, cy + r + r * 0.10], fill=(0, 0, 0, 110)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(r * 0.10))
    img.alpha_composite(shadow)

    # Kropp
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BOMB + (255,))
    # Glansdagern
    d.ellipse(
        [cx - r * 0.74, cy - r * 0.80, cx - r * 0.36, cy - r * 0.58],
        fill=(255, 255, 255, 26),
    )

    # Hatt
    cap_w, cap_h = r * 0.46, r * 0.30
    d.rounded_rectangle(
        [cx - cap_w / 2, cy - r - cap_h * 0.75, cx + cap_w / 2, cy - r + cap_h * 0.35],
        radius=cap_h * 0.30,
        fill=BOMB + (255,),
    )

    # Lunta
    fuse_w = max(2, int(r * 0.11))
    pts = []
    for i in range(31):
        t = i / 30
        ang = -math.pi / 2 + t * 1.5
        rad = r * (0.55 + t * 0.55)
        pts.append(
            (cx + math.sin(ang + 1.6) * rad * 0.75 + t * r * 0.32,
             cy - r - cap_h * 0.4 - t * r * 0.62 + math.sin(t * 3.2) * r * 0.07)
        )
    d.line(pts, fill=(255, 255, 255, 235), width=fuse_w, joint="curve")

    # Gnista
    sx, sy = pts[-1]
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(
        [sx - r * 0.34, sy - r * 0.34, sx + r * 0.34, sy + r * 0.34],
        fill=SPARK + (170,),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(r * 0.13))
    img.alpha_composite(glow)
    for i in range(8):
        a = i * math.pi / 4
        ln = r * (0.30 if i % 2 == 0 else 0.19)
        d.line(
            [sx, sy, sx + math.cos(a) * ln, sy + math.sin(a) * ln],
            fill=SPARK + (255,),
            width=max(2, int(r * 0.055)),
        )
    d.ellipse([sx - r * 0.11, sy - r * 0.11, sx + r * 0.11, sy + r * 0.11], fill=(255, 255, 255, 255))

    if with_letter:
        f = font(int(r * 1.02))
        d.text((cx, cy + r * 0.10), "M", font=f, fill=(255, 255, 255, 255), anchor="mm")


def operators(img, size, alpha=70):
    """Små matteoperatorer i bakgrunden."""
    d = ImageDraw.Draw(img, "RGBA")
    f = font(int(size * 0.13))
    spots = [(0.15, 0.21, "+"), (0.87, 0.47, "×"), (0.14, 0.79, "÷"), (0.86, 0.81, "−")]
    for x, y, ch in spots:
        d.text((size * x, size * y), ch, font=f, fill=(255, 255, 255, alpha), anchor="mm")


def rounded_mask(size, radius_ratio=0.225):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255
    )
    return mask


def make_icon(size, rounded=True):
    base = gradient(size).convert("RGBA")
    operators(base, size)
    draw_bomb(base, size, size * 0.5, size * 0.58, size * 0.27)
    if rounded:
        base.putalpha(rounded_mask(size))
    return base


def make_adaptive_foreground(size=432):
    """Adaptiv förgrund: motivet ligger i den säkra mittzonen (66 %)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_bomb(img, size, size * 0.5, size * 0.54, size * 0.20)
    return img


def make_adaptive_background(size=432):
    img = gradient(size).convert("RGBA")
    operators(img, size, alpha=55)
    return img


def main():
    out = os.path.join(ROOT, "res", "icon", "android")
    os.makedirs(out, exist_ok=True)

    for name, size in [
        ("ldpi", 36), ("mdpi", 48), ("hdpi", 72),
        ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192),
    ]:
        make_icon(size).save(os.path.join(out, "icon-%s.png" % name))

    make_icon(512, rounded=False).save(os.path.join(out, "icon-playstore.png"))
    make_icon(1024).save(os.path.join(ROOT, "res", "icon", "icon.png"))
    make_icon(192).save(os.path.join(ROOT, "www", "img", "icon.png"))
    make_icon(512).save(os.path.join(ROOT, "www", "img", "icon-512.png"))

    for name, size in [
        ("ldpi", 81), ("mdpi", 108), ("hdpi", 162),
        ("xhdpi", 216), ("xxhdpi", 324), ("xxxhdpi", 432),
    ]:
        make_adaptive_foreground(size).save(os.path.join(out, "icon-%s-foreground.png" % name))
        make_adaptive_background(size).save(os.path.join(out, "icon-%s-background.png" % name))

    # Splash-ikon (Android 12+ visar den i en cirkel, motivet får ta 2/3)
    splash = Image.new("RGBA", (960, 960), (0, 0, 0, 0))
    draw_bomb(splash, 960, 480, 500, 205)
    splash.save(os.path.join(ROOT, "res", "screen", "android", "splash-icon.png"))

    print("Ikoner skapade i", out)


if __name__ == "__main__":
    main()
