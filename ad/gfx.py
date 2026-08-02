"""Shared drawing toolkit for the gmfy ad clips."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
FPS = 30
FONTS = "/mnt/skills/examples/canvas-design/canvas-fonts"

# UI brand (neon) — matches the app chrome
BG      = (5, 6, 10)
BG2     = (11, 9, 21)
INK     = (233, 236, 245)
MUTED   = (138, 145, 168)
VIOLET  = (124, 92, 255)
CYAN    = (34, 211, 238)
PINK    = (236, 72, 153)
GOLD    = (245, 197, 66)
GREEN   = (61, 220, 132)
BUBBLE  = (28, 30, 40)

# world palette (bright, friendly) — matches what the app renders
SKY_TOP = (99, 184, 240)
SKY_BOT = (216, 240, 255)
GRASS   = (92, 184, 74)
TREE    = (47, 143, 69)

_fc = {}


def font(name, size):
    k = (name, size)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(f"{FONTS}/{name}.ttf", size)
    return _fc[k]


DISPLAY = "Outfit-Bold"
BODY    = "InstrumentSans-Regular"
BODYB   = "InstrumentSans-Bold"
MONO    = "JetBrainsMono-Regular"


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(t, p=3):
    return 1 - (1 - clamp(t)) ** p


def ease_in_out(t):
    t = clamp(t)
    return 3 * t * t - 2 * t * t * t


def spring(t):
    t = clamp(t)
    c = 2.70158
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


def seg(t, a, b):
    return 1.0 if b <= a else clamp((t - a) / (b - a))


# ---------- backdrops ----------
_cache = {}


_bgc = {"key": None, "img": None}


def dark_bg(t, quant=0.10):
    """Neon UI backdrop for talking beats (cached in coarse time steps)."""
    key = round(t / quant)
    if _bgc["key"] == key:
        return _bgc["img"].copy()
    img = _dark_bg(t)
    _bgc["key"] = key
    _bgc["img"] = img
    return img.copy()


def _dark_bg(t):
    if "d" not in _cache:
        y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
        col = np.array(BG2, np.float32) * (1 - y) + np.array(BG, np.float32) * y
        _cache["d"] = np.repeat(col[:, None, :], W, axis=1)
    arr = _cache["d"].copy()
    yy, xx = np.mgrid[0:H:4, 0:W:4].astype(np.float32)
    for cx, cy, rad, col, ph, amp in ((0.24, 0.20, 430, VIOLET, 0.0, 0.20),
                                      (0.82, 0.58, 470, CYAN, 2.1, 0.15),
                                      (0.50, 0.95, 400, PINK, 4.0, 0.13)):
        px = (cx + 0.035 * math.sin(t * 1.6 + ph)) * W
        py = (cy + 0.030 * math.cos(t * 1.3 + ph)) * H
        fall = np.exp(-((xx - px) ** 2 + (yy - py) ** 2) / (2 * rad * rad)).astype(np.float32)
        g = np.repeat(np.repeat(fall, 4, 0), 4, 1)[:H, :W]
        arr += g[:, :, None] * np.array(col, np.float32) * amp
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


_vig = {}


def vignette(img, t, grain=3, amount=0.5):
    if amount not in _vig:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        dx = (xx - W / 2) / (W / 2)
        dy = (yy - H / 2) / (H / 2)
        _vig[amount] = (1.0 - amount * np.clip((dx * dx + dy * dy) * 0.70, 0, 1))[:, :, None]
    a = np.asarray(img).astype(np.float32) * _vig[amount]
    if grain:
        r = np.random.default_rng(int(t * 1000) % 9999)
        small = r.normal(0, grain, (H // 4 + 1, W // 4 + 1, 1)).astype(np.float32)
        a += np.repeat(np.repeat(small, 4, 0), 4, 1)[:H, :W]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def glow(img, layer, radius=26, strength=1.0):
    b = layer.filter(ImageFilter.GaussianBlur(radius))
    base = np.asarray(img).astype(np.float32)
    bl = np.asarray(b.convert("RGB")).astype(np.float32)
    al = (np.asarray(b.split()[-1]).astype(np.float32) / 255.0)[:, :, None] * strength
    out = 255 - (255 - base) * (255 - bl * al) / 255
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


# ---------- text ----------
def wrap(d, text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines


def block(d, x, y, lines, f, fill, lh=1.24, anchor="la"):
    step = int(f.size * lh)
    for i, ln in enumerate(lines):
        d.text((x, y + i * step), ln, font=f, fill=fill, anchor=anchor)
    return y + len(lines) * step


def caption(img, y, big, small=None, appear=1.0, col=INK, size=84):
    if appear <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    f = font(DISPLAY, size)
    lines = wrap(d, big, f, W - 150)
    a = int(255 * ease_out(appear, 2))
    band = len(lines) * int(size * 1.15) + (108 if small else 46)
    top = int(y - size * 1.05)
    sc = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sc)
    for i in range(band):
        f2 = i / max(1, band - 1)
        ds.line([(0, top + i), (W, top + i)],
                fill=(4, 5, 9, int(95 * a / 255 * math.sin(math.pi * min(1, f2 * 1.15)) ** 0.7)))
    img.paste(Image.alpha_composite(img.convert("RGBA"), sc).convert("RGB"), (0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    dy = int((1 - ease_out(appear)) * 36)
    for i, ln in enumerate(lines):
        yy = y + i * int(size * 1.15) + dy
        d.text((W / 2 + 3, yy + 5), ln, font=f, fill=(0, 0, 0, int(a * .5)), anchor="mm")
        d.text((W / 2, yy), ln, font=f, fill=col + (a,), anchor="mm")
    if small:
        d.text((W / 2, y + len(lines) * int(size * 1.15) + 34 + dy), small,
               font=font(BODY, 42), fill=MUTED + (a,), anchor="mm")


# ---------- chat ----------
def bubble(img, x, y, text, side, appear=1.0, accent=None, maxw=760, size=52):
    if appear <= 0:
        return y
    d = ImageDraw.Draw(img, "RGBA")
    f = font(BODY if side == "l" else BODYB, size)
    lines = wrap(d, text, f, maxw - 92)
    bw = min(maxw, max(int(d.textlength(l, font=f)) for l in lines) + 92)
    bh = int(f.size * 1.26) * len(lines) + 60
    k = spring(appear)
    sc = 0.86 + 0.14 * k
    bw2, bh2 = int(bw * sc), int(bh * sc)
    off = int((1 - ease_out(appear)) * 54) * (-1 if side == "l" else 1)
    bx = max(48, x + off) if side == "l" else min(W - 48 - bw2, x - bw2 + off)
    a = int(255 * ease_out(appear, 2))

    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dl = ImageDraw.Draw(lay)
    if side == "l":
        dl.rounded_rectangle([bx, y, bx + bw2, y + bh2], radius=40, fill=BUBBLE + (a,),
                             outline=(255, 255, 255, int(a * .10)), width=2)
        tcol = INK + (a,)
    else:
        col = accent or VIOLET
        for i in range(bh2):
            fr = i / max(1, bh2)
            c = tuple(int(col[j] * (1 - fr * .42) + CYAN[j] * (fr * .42)) for j in range(3))
            dl.line([(bx, y + i), (bx + bw2, y + i)], fill=c + (a,))
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).rounded_rectangle([bx, y, bx + bw2, y + bh2], radius=40, fill=255)
        lay.putalpha(Image.composite(lay.split()[-1], Image.new("L", (W, H), 0), m))
        tcol = (255, 255, 255, a)
    img.paste(Image.alpha_composite(img.convert("RGBA"), lay).convert("RGB"), (0, 0))

    d = ImageDraw.Draw(img, "RGBA")
    f2 = font(BODY if side == "l" else BODYB, int(size * sc))
    block(d, bx + 44, y + 28, wrap(d, text, f2, bw2 - 84), f2, tcol, 1.26)
    return y + bh2


def wordmark(img, cy, scale=1.0, appear=1.0, sub=None):
    if appear <= 0:
        return img
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    size = int(150 * scale * (0.82 + 0.18 * spring(appear)))
    f = font(DISPLAY, size)
    a = int(255 * ease_out(appear, 2))
    tw = d.textlength("gmfy", font=f)
    cx = W / 2 - tw / 2
    for i, ch in enumerate("gmfy"):
        fr = i / 3
        c = tuple(int(VIOLET[k] * (1 - fr) + CYAN[k] * fr) for k in range(3))
        d.text((cx, cy), ch, font=f, fill=c + (a,), anchor="lm")
        cx += d.textlength(ch, font=f)
    out = glow(img, lay, 34, 1.15)
    out.paste(Image.alpha_composite(out.convert("RGBA"), lay).convert("RGB"), (0, 0))
    if sub:
        ImageDraw.Draw(out, "RGBA").text(
            (W / 2, cy + size * 0.86), sub, font=font(BODY, int(40 * scale)),
            fill=MUTED + (int(235 * ease_out(seg(appear, .35, 1))),), anchor="mm")
    return out


def pill(img, cx, cy, label, col, appear=1.0, size=44, pad=34):
    if appear <= 0:
        return img
    d = ImageDraw.Draw(img, "RGBA")
    f = font(BODYB, size)
    w2 = (d.textlength(label, font=f) / 2 + pad) * (0.8 + 0.2 * spring(appear))
    h2 = size * 0.86
    a = int(255 * ease_out(appear, 2))
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle([cx - w2, cy - h2, cx + w2, cy + h2],
                                          radius=int(h2), fill=col + (int(a * .20),),
                                          outline=col + (a,), width=3)
    out = glow(img, lay, 16, .8)
    out.paste(Image.alpha_composite(out.convert("RGBA"), lay).convert("RGB"), (0, 0))
    ImageDraw.Draw(out, "RGBA").text((cx, cy + 1), label, font=f, fill=col + (a,), anchor="mm")
    return out
