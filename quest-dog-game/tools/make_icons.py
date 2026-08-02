#!/usr/bin/env python3
"""Render the Dog Blaster icon set with no image-library dependencies.

Draws a gold paw print inside a cyan reticle and writes the PNG sizes the
Android/Meta Quest export needs:

    icon.png              512x512  project + store icon
    android/icon_192.png  192x192  legacy launcher icon
    android/icon_fg.png   432x432  adaptive icon foreground (transparent)
    android/icon_bg.png   432x432  adaptive icon background (solid)

Usage:  python3 tools/make_icons.py
"""

import math
import os
import struct
import zlib

GOLD = (255, 204, 64)
CYAN = (110, 230, 255)
NIGHT = (22, 28, 42)


class Canvas:
    def __init__(self, size, background=None):
        self.size = size
        self.px = [[(0, 0, 0, 0.0)] * size for _ in range(size)]
        if background:
            self.px = [[(*background, 1.0)] * size for _ in range(size)]

    def blend(self, x, y, color, alpha):
        if not (0 <= x < self.size and 0 <= y < self.size) or alpha <= 0:
            return
        r, g, b, old = self.px[y][x]
        out = alpha + old * (1 - alpha)
        if out <= 0:
            return
        self.px[y][x] = (
            (color[0] * alpha + r * old * (1 - alpha)) / out,
            (color[1] * alpha + g * old * (1 - alpha)) / out,
            (color[2] * alpha + b * old * (1 - alpha)) / out,
            out,
        )

    def disc(self, cx, cy, radius, color, squash=1.0, rot=0.0, feather=1.6):
        reach = int(radius * 1.7) + 2
        cos_a, sin_a = math.cos(rot), math.sin(rot)
        for y in range(int(cy - reach), int(cy + reach)):
            for x in range(int(cx - reach), int(cx + reach)):
                dx, dy = x - cx + 0.5, y - cy + 0.5
                u = dx * cos_a + dy * sin_a
                v = (-dx * sin_a + dy * cos_a) / squash
                self.blend(x, y, color, _clamp((radius - math.hypot(u, v)) / feather))

    def rounded_rect(self, x0, y0, x1, y1, radius, color):
        for y in range(y0, y1):
            for x in range(x0, x1):
                dx = max(x0 + radius - x, 0, x - (x1 - radius - 1))
                dy = max(y0 + radius - y, 0, y - (y1 - radius - 1))
                alpha = 1.0 if not (dx or dy) else _clamp((radius - math.hypot(dx, dy)) / 1.5)
                self.blend(x, y, color, alpha)

    def ring(self, cx, cy, radius, thickness, color, alpha=1.0):
        for y in range(self.size):
            for x in range(self.size):
                distance = math.hypot(x - cx + 0.5, y - cy + 0.5)
                edge = _clamp((thickness - abs(distance - radius)) / 2.0)
                self.blend(x, y, color, edge * alpha)

    def bar(self, cx, cy, dx, dy, start, end, half_width, color):
        for t in range(int(start), int(end)):
            for w in range(-half_width, half_width + 1):
                self.blend(int(cx + dx * t - dy * w), int(cy + dy * t - dx * w), color, 1.0)

    def write(self, path):
        rows = b""
        for row in self.px:
            rows += b"\x00" + b"".join(
                bytes((int(r), int(g), int(b), int(a * 255))) for r, g, b, a in row
            )
        header = struct.pack(">IIBBBBB", self.size, self.size, 8, 6, 0, 0, 0)
        png = (
            b"\x89PNG\r\n\x1a\n"
            + _chunk(b"IHDR", header)
            + _chunk(b"IDAT", zlib.compress(rows, 9))
            + _chunk(b"IEND", b"")
        )
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "wb") as handle:
            handle.write(png)
        print(f"{path}  {self.size}x{self.size}  {len(png):,} bytes")


def _clamp(value):
    return max(0.0, min(1.0, value))


def _chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def draw_paw(canvas, scale, cx, cy):
    canvas.disc(cx, cy + 26 * scale, 108 * scale, GOLD, squash=0.86)
    toes = [(-150, -88, 52, 0.72, -0.35), (-58, -152, 56, 0.70, -0.12),
            (58, -152, 56, 0.70, 0.12), (150, -88, 52, 0.72, 0.35)]
    for ax, ay, radius, squash, rot in toes:
        canvas.disc(cx + ax * scale, cy + (ay + 26) * scale, radius * scale, GOLD,
                    squash=squash, rot=rot)


def draw_reticle(canvas, scale, cx, cy):
    radius = 208 * scale
    canvas.ring(cx, cy, radius, 10 * scale, CYAN, 0.95)
    half = max(1, int(5 * scale))
    for dx, dy in ((1, 0), (0, 1)):
        canvas.bar(cx, cy, dx, dy, radius * 0.72, radius * 1.16, half, CYAN)
        canvas.bar(cx, cy, -dx, -dy, radius * 0.72, radius * 1.16, half, CYAN)


def render(size, background=True, transparent_bg=False):
    canvas = Canvas(size)
    scale = size / 512.0
    if background and not transparent_bg:
        canvas.rounded_rect(0, 0, size, size, int(96 * scale), NIGHT)
        # Warm glow behind the paw.
        for i in range(70, 0, -1):
            canvas.disc(size * 0.5, size * 0.46, (150 + i * 1.6) * scale, (58, 42, 20), feather=6.0)
    draw_paw(canvas, scale, size * 0.5, size * 0.55)
    draw_reticle(canvas, scale, size * 0.5, size * 0.55)
    return canvas


def render_background(size):
    canvas = Canvas(size)
    canvas.rounded_rect(0, 0, size, size, 0, NIGHT)
    scale = size / 512.0
    for i in range(80, 0, -1):
        canvas.disc(size * 0.5, size * 0.5, (140 + i * 1.9) * scale, (42, 34, 24), feather=8.0)
    return canvas


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)
    render(512).write("icon.png")
    render(192).write("android/icon_192.png")
    # Adaptive icons get cropped to a circle, so the art is drawn smaller.
    fg = Canvas(432)
    draw_paw(fg, 432 / 512.0 * 0.66, 216, 216 - 6)
    draw_reticle(fg, 432 / 512.0 * 0.66, 216, 216 - 6)
    fg.write("android/icon_fg.png")
    render_background(432).write("android/icon_bg.png")
