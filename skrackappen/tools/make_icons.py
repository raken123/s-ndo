"""Ritar Skräckappens ikon (pantheröga på svart) i alla storlekar som behövs.

python tools/make_icons.py   # skriver till www/, desktop/build/ och android/app/src/main/res/
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EYE = (212, 242, 90)


def eye_layer(size, scale=1.0):
    """Ett gult kattöga med smal pupill och glöd, på genomskinlig bakgrund."""
    S = size * 4  # rita stort och skala ner för mjuka kanter
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cx, cy = S / 2, S / 2
    w, h = S * 0.36 * scale, S * 0.19 * scale

    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx - w * 1.35, cy - h * 2.1, cx + w * 1.35, cy + h * 2.1], fill=EYE + (120,))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.07))
    img.alpha_composite(glow)

    d = ImageDraw.Draw(img)
    # mandelform: två bågar
    pts = []
    for i in range(0, 181):
        a = math.radians(i)
        pts.append((cx - w * math.cos(a), cy - h * math.sin(a) ** 0.85))
    for i in range(0, 181):
        a = math.radians(i)
        pts.append((cx + w * math.cos(a), cy + h * math.sin(a) ** 0.85))
    d.polygon(pts, fill=EYE + (255,))
    # iris-skugga
    d.ellipse([cx - h * 1.0, cy - h * 1.0, cx + h * 1.0, cy + h * 1.0], fill=(176, 206, 60, 255))
    # pupill
    pw, ph = w * 0.11, h * 0.95
    d.ellipse([cx - pw, cy - ph, cx + pw, cy + ph], fill=(8, 8, 4, 255))
    # glans
    d.ellipse([cx + w * 0.18, cy - h * 0.55, cx + w * 0.3, cy - h * 0.3], fill=(255, 255, 230, 220))
    return img.resize((size, size), Image.LANCZOS)


def scratches(size):
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for k in range(3):
        x0 = S * (0.18 + k * 0.07)
        d.line([(x0, S * 0.66), (x0 + S * 0.16, S * 0.86)], fill=(150, 20, 28, 200), width=int(S * 0.018))
    return img.resize((size, size), Image.LANCZOS)


def full_icon(size, radius=0.22, bg=(7, 6, 9)):
    S = size * 4
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=255)
    tile = Image.new("RGBA", (S, S), bg + (255,))
    # svag vinjett
    v = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(v).ellipse([S * 0.1, S * 0.1, S * 0.9, S * 0.9], fill=(40, 46, 18, 255))
    v = v.filter(ImageFilter.GaussianBlur(S * 0.12))
    tile.alpha_composite(v)
    base.paste(tile, (0, 0), m)
    base = base.resize((size, size), Image.LANCZOS)
    base.alpha_composite(eye_layer(size))
    base.alpha_composite(scratches(size))
    return base


def round_icon(size):
    img = full_icon(size, radius=0.5)
    return img


def main():
    os.makedirs(os.path.join(ROOT, "desktop", "build"), exist_ok=True)
    full_icon(1024).save(os.path.join(ROOT, "desktop", "build", "icon.png"))
    full_icon(256).save(os.path.join(ROOT, "www", "icon.png"))
    res = os.path.join(ROOT, "android", "app", "src", "main", "res")
    dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for name, k in dens.items():
        d = os.path.join(res, "mipmap-" + name)
        os.makedirs(d, exist_ok=True)
        full_icon(int(48 * k), radius=0.2).save(os.path.join(d, "ic_launcher.png"))
        round_icon(int(48 * k)).save(os.path.join(d, "ic_launcher_round.png"))
        fg = Image.new("RGBA", (int(108 * k), int(108 * k)), (0, 0, 0, 0))
        e = eye_layer(int(72 * k), 1.0)
        fg.alpha_composite(e, (int(18 * k), int(18 * k)))
        sc = scratches(int(72 * k))
        fg.alpha_composite(sc, (int(18 * k), int(18 * k)))
        fg.save(os.path.join(d, "ic_launcher_foreground.png"))
    print("ikoner klara")


if __name__ == "__main__":
    main()
