#!/usr/bin/env python3
"""Genererar app-ikoner och splash-bilder for Sando Fandom.

Kor:  python3 tools/make_icons.py
Kraver: pillow  (pip install pillow)

Market ar en rundad kvadrat med indigo->cyan-gradient och en vit
fyrauddig gnista (concave superellips, n < 1) plus en mindre gnista.
Allt ritas i 4x upplosning och skalas ner for kantutjamning.
"""

import math
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SS = 4  # supersampling

BRAND = (79, 70, 229)      # #4f46e5
ACCENT = (6, 182, 212)     # #06b6d4
DEEP = (49, 46, 129)       # #312e81


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


FIELD = 192  # gradienter/glow ritas litet och skalas upp (mjuka falt = ingen synlig skillnad)


def diagonal_gradient(size, c0, c1):
    """Diagonal (135 grader) gradient."""
    n = min(size, FIELD)
    img = Image.new("RGB", (n, n))
    px = img.load()
    for y in range(n):
        for x in range(n):
            t = (x + y) / (2 * (n - 1))
            px[x, y] = lerp(c0, c1, t)
    return img if n == size else img.resize((size, size), Image.BICUBIC)


def linear_gradient(w, h, c0, c1):
    """Diagonal gradient for godtyckligt format."""
    n = FIELD
    img = Image.new("RGB", (n, n))
    px = img.load()
    for y in range(n):
        for x in range(n):
            t = min(x / (n - 1) * 0.45 + y / (n - 1) * 0.55, 1.0)
            px[x, y] = lerp(c0, c1, t)
    return img.resize((w, h), Image.BICUBIC)


def radial_glow(size, center, radius, color, strength=0.45, canvas=None):
    """Mjuk radiell ljuspunkt som RGBA-lager (renderas litet, skalas upp)."""
    cw, ch = canvas if canvas else (size, size)
    n = FIELD
    sx, sy = n / cw, n / ch
    layer = Image.new("L", (n, n), 0)
    px = layer.load()
    cx, cy, r = center[0] * sx, center[1] * sy, radius * (sx + sy) / 2
    for y in range(n):
        dy = (y - cy) / r
        if abs(dy) >= 1.0:
            continue
        span = math.sqrt(1 - dy * dy) * r
        x0, x1 = max(0, int(cx - span)), min(n - 1, int(cx + span) + 1)
        for x in range(x0, x1 + 1):
            dx = (x - cx) / r
            d = math.hypot(dx, dy)
            if d < 1.0:
                px[x, y] = int(255 * strength * (1 - d) ** 2)
    layer = layer.resize((cw, ch), Image.BICUBIC)
    glow = Image.new("RGBA", (cw, ch), color + (0,))
    glow.putalpha(layer)
    return glow


def sparkle_points(cx, cy, r, n=0.58, steps=720, rot=0.0):
    """Fyrauddig concave stjarna: |x/r|^n + |y/r|^n = 1."""
    pts = []
    for i in range(steps):
        th = 2 * math.pi * i / steps
        ct, st = math.cos(th), math.sin(th)
        denom = (abs(ct) ** n + abs(st) ** n) ** (1.0 / n)
        rr = r / max(denom, 1e-6)
        x, y = rr * ct, rr * st
        if rot:
            x, y = x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)
        pts.append((cx + x, cy + y))
    return pts


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def build_icon(size, rounded=True, padding=0.0):
    """Bygger ikonen i angiven pixelstorlek."""
    S = size * SS
    base = diagonal_gradient(S, BRAND, ACCENT).convert("RGBA")

    # Djupare hoger-underkant for lite volym
    shade = Image.new("RGBA", (S, S), DEEP + (0,))
    shade.putalpha(radial_glow(S, (S * 0.12, S * 0.1), S * 1.15, DEEP, 0.55).getchannel("A"))
    base = Image.alpha_composite(base, shade)
    base = Image.alpha_composite(base, radial_glow(S, (S * 0.74, S * 0.22), S * 0.72, (255, 255, 255), 0.30))

    fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(fg)

    # Stor gnista, lite forskjuten at vanster/ner
    cx, cy, r = S * 0.435, S * 0.555, S * 0.295
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).polygon(sparkle_points(cx, cy, r * 1.06), fill=(255, 255, 255, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.035))
    fg = Image.alpha_composite(fg, glow)
    d = ImageDraw.Draw(fg)
    d.polygon(sparkle_points(cx, cy, r), fill=(255, 255, 255, 255))

    # Liten gnista uppe till hoger
    d.polygon(sparkle_points(S * 0.755, S * 0.268, S * 0.125), fill=(255, 255, 255, 235))
    # Mikro-gnista
    d.polygon(sparkle_points(S * 0.845, S * 0.475, S * 0.058), fill=(255, 255, 255, 190))

    img = Image.alpha_composite(base, fg)

    if rounded:
        img.putalpha(rounded_mask(S, int(S * 0.225)))

    if padding:
        inner = int(S * (1 - 2 * padding))
        small = img.resize((inner, inner), Image.LANCZOS)
        canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        canvas.paste(small, ((S - inner) // 2, (S - inner) // 2), small)
        img = canvas

    return img.resize((size, size), Image.LANCZOS)


def build_splash(w, h):
    """Splash: gradientbakgrund med centrerad ikon."""
    bg = linear_gradient(w, h, DEEP, BRAND).convert("RGBA")
    bg = Image.alpha_composite(bg, radial_glow(max(w, h), (w * 0.5, h * 0.42), max(w, h) * 0.55,
                                               ACCENT, 0.35, canvas=(w, h)))
    mark = build_icon(int(min(w, h) * 0.34), rounded=True)
    bg.paste(mark, ((w - mark.width) // 2, (h - mark.height) // 2), mark)
    return bg.convert("RGB")


ANDROID = {
    "ldpi": 36, "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192,
}
IOS = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024]
SPLASHES_ANDROID = {
    "land-mdpi": (480, 320), "land-hdpi": (800, 480), "land-xhdpi": (1280, 720),
    "land-xxhdpi": (1600, 960), "land-xxxhdpi": (1920, 1280),
    "port-mdpi": (320, 480), "port-hdpi": (480, 800), "port-xhdpi": (720, 1280),
    "port-xxhdpi": (960, 1600), "port-xxxhdpi": (1280, 1920),
}


def main():
    icon_dir = os.path.join(ROOT, "res", "icon")
    scr_dir = os.path.join(ROOT, "res", "screen")
    for p in (os.path.join(icon_dir, "android"), os.path.join(icon_dir, "ios"),
              os.path.join(scr_dir, "android"), os.path.join(scr_dir, "ios")):
        os.makedirs(p, exist_ok=True)

    build_icon(1024).save(os.path.join(icon_dir, "icon.png"))
    build_icon(512).save(os.path.join(ROOT, "www", "img", "icon-512.png"))
    build_icon(192).save(os.path.join(ROOT, "www", "img", "icon-192.png"))
    print("icon.png (1024) + www/img")

    for dpi, s in ANDROID.items():
        build_icon(s).save(os.path.join(icon_dir, "android", f"icon-{dpi}.png"))
        # Adaptive foreground: samma mark utan rundning och med luft runt om
        build_icon(s * 2, rounded=False, padding=0.18).save(
            os.path.join(icon_dir, "android", f"icon-{dpi}-foreground.png"))
    print("android:", ", ".join(ANDROID))

    for s in IOS:
        build_icon(s, rounded=False).save(os.path.join(icon_dir, "ios", f"icon-{s}.png"))
    print("ios:", ", ".join(str(s) for s in IOS))

    for name, (w, h) in SPLASHES_ANDROID.items():
        build_splash(w, h).save(os.path.join(scr_dir, "android", f"splash-{name}.png"))
    build_splash(2732, 2732).resize((1200, 1200), Image.LANCZOS).save(
        os.path.join(scr_dir, "ios", "Default@2x~universal~anyany.png"))
    print("splashes klara")


if __name__ == "__main__":
    main()
