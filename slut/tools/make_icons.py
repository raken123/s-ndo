"""Ritar Sluts ikon (en pratbubbla med ett brustet hjärta) i alla storlekar som behövs.

python tools/make_icons.py   # skriver till www/, desktop/build/ och android/app/src/main/res/
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLUE = (47, 111, 224)
RED = (232, 68, 96)


def symbol(size):
    """Pratbubbla med brustet hjärta och två läsbockar, på genomskinlig bakgrund."""
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # bubbla
    x0, y0, x1, y1 = S * 0.16, S * 0.2, S * 0.84, S * 0.72
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(S * 0.12), fill=BLUE + (255,))
    d.polygon([(S * 0.3, y1 - 2), (S * 0.24, S * 0.86), (S * 0.44, y1 - 2)], fill=BLUE + (255,))
    # hjärta
    cx, cy, r = S * 0.5, S * 0.44, S * 0.11
    d.ellipse([cx - 2 * r, cy - r, cx, cy + r], fill=RED + (255,))
    d.ellipse([cx, cy - r, cx + 2 * r, cy + r], fill=RED + (255,))
    d.polygon([(cx - 2 * r + S * 0.008, cy + r * 0.35), (cx + 2 * r - S * 0.008, cy + r * 0.35), (cx, cy + r * 2.3)], fill=RED + (255,))
    # sprickan
    crack = [(cx + S * 0.01, cy - r * 0.7), (cx - S * 0.025, cy + r * 0.2), (cx + S * 0.02, cy + r * 0.9), (cx - S * 0.01, cy + r * 2.0)]
    d.line(crack, fill=BLUE + (255,), width=int(S * 0.028))
    # läsbockar
    for k in (0, 1):
        ox = S * (0.64 + k * 0.06)
        d.line([(ox, S * 0.63), (ox + S * 0.03, S * 0.66), (ox + S * 0.08, S * 0.58)], fill=(255, 255, 255, 235), width=int(S * 0.022))
    return img.resize((size, size), Image.LANCZOS)


def full_icon(size, radius=0.22, bg=(10, 12, 22)):
    S = size * 4
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=255)
    tile = Image.new("RGBA", (S, S), bg + (255,))
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([S * 0.12, S * 0.12, S * 0.88, S * 0.88], fill=(60, 28, 70, 255))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.12))
    tile.alpha_composite(glow)
    base.paste(tile, (0, 0), m)
    base = base.resize((size, size), Image.LANCZOS)
    base.alpha_composite(symbol(size))
    return base


def main():
    os.makedirs(os.path.join(ROOT, "desktop", "build"), exist_ok=True)
    full_icon(1024).save(os.path.join(ROOT, "desktop", "build", "icon.png"))
    full_icon(256).save(os.path.join(ROOT, "www", "icon.png"))
    res = os.path.join(ROOT, "android", "app", "src", "main", "res")
    for name, k in {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}.items():
        d = os.path.join(res, "mipmap-" + name)
        os.makedirs(d, exist_ok=True)
        full_icon(int(48 * k), radius=0.2).save(os.path.join(d, "ic_launcher.png"))
        full_icon(int(48 * k), radius=0.5).save(os.path.join(d, "ic_launcher_round.png"))
        fg = Image.new("RGBA", (int(108 * k), int(108 * k)), (0, 0, 0, 0))
        fg.alpha_composite(symbol(int(72 * k)), (int(18 * k), int(18 * k)))
        fg.save(os.path.join(d, "ic_launcher_foreground.png"))
    print("ikoner klara")


if __name__ == "__main__":
    main()
