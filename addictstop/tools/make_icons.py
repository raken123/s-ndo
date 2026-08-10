#!/usr/bin/env python3
"""Generate the AddictStop launcher icons.

The mark: an emerald rounded square, a gold crescent, and a white stickman
in sujud on the prayer mat -- the same stickman the app asks you to follow.

Everything is drawn at 8x and downsampled so the small densities stay clean.

    python3 tools/make_icons.py
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "res", "android")
IOS_DIR = os.path.join(ROOT, "res", "ios")
SIZES = [36, 48, 72, 96, 144, 192, 512]
# Every size cordova-ios asks for in config.xml, from the notification badge
# through to the App Store listing.
IOS_SIZES = [20, 29, 40, 48, 50, 55, 57, 58, 60, 72, 76, 80, 87, 88, 100,
             114, 120, 144, 152, 167, 172, 180, 196, 216, 1024]
SS = 8  # supersampling factor

BG_TOP = (16, 92, 74)
BG_BOTTOM = (8, 34, 28)
GOLD = (245, 196, 81)
WHITE = (255, 255, 255)
MAT = (233, 178, 92)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_icon(size):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # Vertical gradient background.
    grad = Image.new("RGB", (1, S))
    gp = grad.load()
    for y in range(S):
        gp[0, y] = lerp(BG_TOP, BG_BOTTOM, y / max(1, S - 1))
    grad = grad.resize((S, S))
    img.paste(grad, (0, 0), rounded_mask(S, int(S * 0.22)))

    d = ImageDraw.Draw(img)

    def px(x, y):
        return (x * S, y * S)

    def circle(cx, cy, r, fill):
        d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=fill)

    def line(p1, p2, width, fill):
        d.line([px(*p1), px(*p2)], fill=fill, width=int(width * S), joint="curve")

    # --- Crescent: a gold disc with a background-coloured disc bitten out. ---
    crescent = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(crescent)
    cd.ellipse([0.545 * S, 0.10 * S, 0.875 * S, 0.43 * S], fill=GOLD + (255,))
    cd.ellipse([0.605 * S, 0.085 * S, 0.925 * S, 0.405 * S], fill=(0, 0, 0, 0))
    img.alpha_composite(crescent)

    # --- Prayer mat. ---
    d.rounded_rectangle(
        [0.13 * S, 0.775 * S, 0.87 * S, 0.825 * S],
        radius=0.025 * S,
        fill=MAT + (255,),
    )

    # --- Stickman in sujud (forehead, hands, knees and toes on the mat). ---
    limb = 0.052
    head_r = 0.072
    hip = (0.625, 0.545)
    shoulder = (0.405, 0.665)
    knee = (0.665, 0.775)
    toe = (0.775, 0.775)
    elbow = (0.335, 0.745)
    hand = (0.255, 0.775)

    line(hip, knee, limb, WHITE)          # thigh
    line(knee, toe, limb, WHITE)          # shin / foot flat on the mat
    line(hip, shoulder, limb + 0.012, WHITE)  # back, sloping down to the ground
    line(shoulder, (0.345, 0.700), limb * 0.9, WHITE)  # neck
    line(shoulder, elbow, limb * 0.85, WHITE)
    line(elbow, hand, limb * 0.85, WHITE)
    circle(0.302, 0.735, head_r, WHITE + (255,))

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for s in SIZES:
        path = os.path.join(OUT_DIR, "icon-%d.png" % s)
        draw_icon(s).save(path)
        print("wrote", path)

    # Splash / adaptive foreground: the mark on a transparent field with padding.
    splash = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    splash.paste(draw_icon(320), (96, 96))
    splash.save(os.path.join(OUT_DIR, "splash.png"))
    print("wrote", os.path.join(OUT_DIR, "splash.png"))

    # iOS rounds the corners itself and rejects alpha in App Store artwork, so
    # these are flattened onto the icon's own dark green.
    os.makedirs(IOS_DIR, exist_ok=True)
    for s in IOS_SIZES:
        flat = Image.new("RGB", (s, s), BG_BOTTOM)
        icon = draw_icon(s)
        flat.paste(icon, (0, 0), icon)
        path = os.path.join(IOS_DIR, "icon-%d.png" % s)
        flat.save(path)
        print("wrote", path)


if __name__ == "__main__":
    main()
