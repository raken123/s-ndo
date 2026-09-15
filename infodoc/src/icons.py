"""Draw the InfoDoc icon and write it as PNG, ICNS and ICO.

There is no Pillow in the build environment, so this is a small software
rasteriser: shapes are filled into an RGBA buffer at 4x and box-downsampled, and
the container formats are written by hand. Everything here is stdlib.
"""
import struct
import zlib

BG     = (0x16, 0x21, 0x2b, 255)
PAPER  = (0xe8, 0xed, 0xf2, 255)
ACCENT = (0x35, 0xa0, 0xd8, 255)
SHADOW = (0x0c, 0x12, 0x18, 255)

SS = 4          # supersampling factor


class Canvas:
    def __init__(self, n):
        self.n = n
        self.buf = bytearray(n * n * 4)

    def _blend(self, i, rgba):
        r, g, b, a = rgba
        if a == 255:
            self.buf[i:i + 4] = bytes((r, g, b, 255))
            return
        if a == 0:
            return
        dr, dg, db, da = self.buf[i], self.buf[i + 1], self.buf[i + 2], self.buf[i + 3]
        ia = 255 - a
        self.buf[i] = (r * a + dr * ia) // 255
        self.buf[i + 1] = (g * a + dg * ia) // 255
        self.buf[i + 2] = (b * a + db * ia) // 255
        self.buf[i + 3] = min(255, a + da * ia // 255)

    def rrect(self, x0, y0, x1, y1, rad, rgba):
        """Filled rounded rectangle, all coordinates in 0..1."""
        n = self.n
        px0, py0 = x0 * n, y0 * n
        px1, py1 = x1 * n, y1 * n
        r = rad * n
        for py in range(max(0, int(py0)), min(n, int(py1) + 1)):
            cy = py + 0.5
            for px in range(max(0, int(px0)), min(n, int(px1) + 1)):
                cx = px + 0.5
                if not (px0 <= cx <= px1 and py0 <= cy <= py1):
                    continue
                # inside the corner radius?
                ncx = min(max(cx, px0 + r), px1 - r)
                ncy = min(max(cy, py0 + r), py1 - r)
                dx, dy = cx - ncx, cy - ncy
                if dx * dx + dy * dy > r * r:
                    continue
                self._blend((py * n + px) * 4, rgba)

    def downsample(self, factor):
        n = self.n // factor
        out = Canvas(n)
        f2 = factor * factor
        for y in range(n):
            for x in range(n):
                r = g = b = a = 0
                for sy in range(factor):
                    base = ((y * factor + sy) * self.n + x * factor) * 4
                    for sx in range(factor):
                        i = base + sx * 4
                        r += self.buf[i]; g += self.buf[i + 1]
                        b += self.buf[i + 2]; a += self.buf[i + 3]
                o = (y * n + x) * 4
                out.buf[o] = r // f2
                out.buf[o + 1] = g // f2
                out.buf[o + 2] = b // f2
                out.buf[o + 3] = a // f2
        return out

    def png(self):
        n = self.n
        raw = bytearray()
        for y in range(n):
            raw.append(0)                                   # filter: none
            raw += self.buf[y * n * 4:(y + 1) * n * 4]

        def chunk(tag, data):
            c = struct.pack(">I", len(data)) + tag + data
            return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

        return (b"\x89PNG\r\n\x1a\n" +
                chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0)) +
                chunk(b"IDAT", zlib.compress(bytes(raw), 9)) +
                chunk(b"IEND", b""))


def draw(size):
    """The icon: a clipboard with a medical cross, on a dark rounded square."""
    c = Canvas(size * SS)
    c.rrect(0.00, 0.00, 1.00, 1.00, 0.225, BG)
    # a hairline of depth under the paper
    c.rrect(0.235, 0.215, 0.765, 0.855, 0.075, SHADOW)
    c.rrect(0.24, 0.20, 0.76, 0.845, 0.07, PAPER)
    # the clip at the top
    c.rrect(0.395, 0.125, 0.605, 0.255, 0.045, ACCENT)
    # the cross
    c.rrect(0.462, 0.375, 0.538, 0.725, 0.022, ACCENT)
    c.rrect(0.355, 0.512, 0.645, 0.588, 0.022, ACCENT)
    return c.downsample(SS)


_cache = {}


def png(size):
    if size not in _cache:
        _cache[size] = draw(size).png()
    return _cache[size]


def write_png(path, size):
    with open(path, "wb") as f:
        f.write(png(size))
    return path


# ── ICNS ──────────────────────────────────────────────────────────
# Each entry is an OSType, a big-endian length covering the header, then a PNG.
ICNS_TYPES = [
    (b"icp4", 16), (b"icp5", 32), (b"icp6", 64),
    (b"ic07", 128), (b"ic08", 256), (b"ic09", 512),
    (b"ic11", 32), (b"ic12", 64), (b"ic13", 256), (b"ic14", 512),
]


def write_icns(path):
    parts = []
    for tag, size in ICNS_TYPES:
        data = png(size)
        parts.append(tag + struct.pack(">I", len(data) + 8) + data)
    body = b"".join(parts)
    with open(path, "wb") as f:
        f.write(b"icns" + struct.pack(">I", len(body) + 8) + body)
    return path


# ── ICO ───────────────────────────────────────────────────────────
ICO_SIZES = [16, 32, 48, 64, 128, 256]


def write_ico(path):
    imgs = [(s, png(s)) for s in ICO_SIZES]
    out = struct.pack("<HHH", 0, 1, len(imgs))
    offset = 6 + 16 * len(imgs)
    dirs, blobs = b"", b""
    for s, data in imgs:
        dirs += struct.pack("<BBBBHHII",
                            0 if s >= 256 else s, 0 if s >= 256 else s,
                            0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)
    with open(path, "wb") as f:
        f.write(out + dirs + blobs)
    return path


if __name__ == "__main__":
    import os
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "icons")
    os.makedirs(out, exist_ok=True)
    for s in (16, 32, 48, 64, 128, 256, 512, 1024):
        p = write_png(os.path.join(out, "infodoc-%d.png" % s), s)
        print("%-28s %6d bytes" % (os.path.basename(p), os.path.getsize(p)))
    for fn, name in ((write_icns, "infodoc.icns"), (write_ico, "infodoc.ico")):
        p = fn(os.path.join(out, name))
        print("%-28s %6d bytes" % (name, os.path.getsize(p)))
