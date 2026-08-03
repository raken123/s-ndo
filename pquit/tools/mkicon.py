#!/usr/bin/env python3
"""Generate the PQuit launcher icon set.

Draws everything at 4x and downsamples, which is cheaper than fighting with
Pillow's aliasing. Run from anywhere:  python3 tools/mkicon.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

BG_TOP = (18, 22, 38)
BG_BOTTOM = (40, 16, 44)
RED = (225, 44, 60)
RED_DARK = (150, 20, 34)
WHITE = (248, 248, 255)

SS = 4  # supersample factor


def rounded_gradient(size, radius_ratio=0.22):
    """Dark vertical gradient with rounded corners."""
    img = Image.new("RGB", (size, size), BG_TOP)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        d.line(
            [(0, y), (size, y)],
            fill=tuple(int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)),
        )
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255
    )
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def draw_icon(px, square=True):
    """Big red stop button with a white P on a dark plate."""
    s = px * SS
    img = rounded_gradient(s) if square else Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if not square:  # round / adaptive variant: full-bleed dark disc
        d.ellipse([0, 0, s - 1, s - 1], fill=BG_TOP)

    c = s / 2
    r = s * 0.315

    # soft ring around the button
    d.ellipse([c - r * 1.28, c - r * 1.28, c + r * 1.28, c + r * 1.28],
              fill=None, outline=(70, 30, 46), width=int(s * 0.018))
    # button body + highlight
    d.ellipse([c - r, c - r, c + r, c + r], fill=RED_DARK)
    d.ellipse([c - r * 0.94, c - r * 0.99, c + r * 0.94, c + r * 0.89], fill=RED)

    # the P
    try:
        font = ImageFont.truetype(FONT, int(r * 1.5))
    except OSError:
        font = ImageFont.load_default()
    box = d.textbbox((0, 0), "P", font=font)
    d.text(
        (c - (box[2] - box[0]) / 2 - box[0], c - (box[3] - box[1]) / 2 - box[1] - r * 0.02),
        "P",
        font=font,
        fill=WHITE,
    )

    # slash across the button: "no"
    d.line([(c - r * 0.72, c + r * 0.72), (c + r * 0.72, c - r * 0.72)],
           fill=WHITE, width=int(s * 0.035))

    return img.resize((px, px), Image.LANCZOS)


DENSITIES = {
    "ldpi": 36, "mdpi": 48, "hdpi": 72,
    "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192,
}


def main():
    out = os.path.join(ROOT, "res", "icon", "android")
    os.makedirs(out, exist_ok=True)
    for name, px in DENSITIES.items():
        draw_icon(px).save(os.path.join(out, f"ldpi.png".replace("ldpi", name)))
        draw_icon(px, square=False).save(os.path.join(out, f"{name}-round.png"))
        # adaptive foreground needs ~1.5x padding around the art
        fg = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        art = draw_icon(int(px * 0.62), square=False)
        fg.paste(art, ((px - art.width) // 2, (px - art.height) // 2), art)
        fg.save(os.path.join(out, f"{name}-foreground.png"))
    draw_icon(512).save(os.path.join(ROOT, "res", "icon", "icon-512.png"))
    draw_icon(1024).save(os.path.join(ROOT, "res", "icon", "icon-1024.png"))

    # splash / launch image
    sp = Image.new("RGB", (1080, 1920), BG_TOP)
    d = ImageDraw.Draw(sp)
    for y in range(1920):
        t = y / 1919
        d.line([(0, y), (1080, y)],
               fill=tuple(int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)))
    logo = draw_icon(420, square=False)
    sp.paste(logo, (330, 640), logo)
    try:
        f = ImageFont.truetype(FONT, 96)
        w = d.textbbox((0, 0), "PQuit", font=f)[2]
        d.text((540 - w / 2, 1140), "PQuit", font=f, fill=WHITE)
    except OSError:
        pass
    os.makedirs(os.path.join(ROOT, "res", "screen", "android"), exist_ok=True)
    sp.save(os.path.join(ROOT, "res", "screen", "android", "splashscreen.png"))
    print("icons written to", out)


if __name__ == "__main__":
    main()
