"""Draws the One AI icon as PNGs for the desktop and iOS builds:
python3 scripts/make-icons.py (needs Pillow; the PNGs are committed)."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def icon(size, rounded=True):
    s = 4  # draw big, scale down for smooth edges
    n = size * s
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 0.22), fill="#0d0d0d")
    else:
        d.rectangle([0, 0, n, n], fill="#0d0d0d")
    c, r, w = n / 2, n * 0.293, int(n * 0.086)
    d.ellipse([c - r, c - r, c + r, c + r], outline="white", width=w)
    lw = int(n * 0.07)
    pts = [(n * 0.462, n * 0.40), (n * 0.53, n * 0.358), (n * 0.53, n * 0.642)]
    d.line(pts, fill="white", width=lw, joint="curve")
    for x, y in (pts[0], pts[2]):
        d.ellipse([x - lw / 2, y - lw / 2, x + lw / 2, y + lw / 2], fill="white")
    return im.resize((size, size), Image.LANCZOS)


def save(im, *path):
    p = os.path.join(ROOT, *path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)
    print("wrote", os.path.relpath(p, ROOT))


save(icon(1024), "desktop", "build", "icon.png")
# iOS draws its own rounded corners and wants no transparency.
save(icon(1024, rounded=False).convert("RGB"), "ios", "OneAI", "Assets.xcassets", "AppIcon.appiconset", "icon-1024.png")
