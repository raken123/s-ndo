"""Full-screen 30s video ads for gmfy's free tier — fictional brands only.

Each is a self-contained portrait 1080x1920 spot for a made-up product, styled
to look like a real app-store / product ad: brand lockup, tagline, a little
motion, a star rating and an INSTALL / ORDER call-to-action. No real companies.
"""
import math
from PIL import Image, ImageDraw, ImageFilter
from gfx import (W, H, font, clamp, ease_out, ease_in_out, spring, seg,
                 atext, DISPLAY, BODY, BODYB, INK, MUTED)


# ---------------- shared pieces ----------------
def grad(top, bot, t=0.0, drift=0):
    a = Image.new("RGB", (W, H))
    px = a.load()
    import numpy as np
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    col = (np.array(top, np.float32) * (1 - y) + np.array(bot, np.float32) * y)
    arr = np.repeat(col[:, None, :], W, axis=1)
    return Image.fromarray(arr.astype("uint8"), "RGB")


def soft_blobs(img, blobs, t):
    import numpy as np
    yy, xx = np.mgrid[0:H:6, 0:W:6].astype(np.float32)
    base = np.asarray(img, np.float32)
    add = np.zeros((H, W, 3), np.float32)
    for cx, cy, rad, col, ph, amp in blobs:
        px = (cx + 0.03 * math.sin(t * 1.2 + ph)) * W
        py = (cy + 0.03 * math.cos(t * 1.0 + ph)) * H
        fall = np.exp(-((xx - px) ** 2 + (yy - py) ** 2) / (2 * rad * rad)).astype(np.float32)
        g = np.repeat(np.repeat(fall, 6, 0), 6, 1)[:H, :W]
        add += g[:, :, None] * np.array(col, np.float32) * amp
    return Image.fromarray(np.clip(base + add, 0, 255).astype("uint8"), "RGB")


def center_text(d, cx, y, txt, f, col, a=255, anchor="mm"):
    atext(d, (cx, y), txt, f, col, a, anchor)


def cta(img, y, label, col, appear):
    if appear <= 0:
        return img
    d = ImageDraw.Draw(img, "RGBA")
    a = int(255 * ease_out(appear, 2))
    k = 0.86 + 0.14 * spring(appear)
    f = font(BODYB, 58)
    hw = (d.textlength(label, font=f) / 2 + 70) * k
    hh = 66 * k
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle([W / 2 - hw, y - hh, W / 2 + hw, y + hh],
                                          radius=int(hh), fill=col + (a,))
    b = lay.filter(ImageFilter.GaussianBlur(26))
    import numpy as np
    base = np.asarray(img, np.float32)
    gl = np.asarray(b.convert("RGB"), np.float32) * 0.6
    img = Image.fromarray(np.clip(255 - (255 - base) * (255 - gl) / 255, 0, 255)
                          .astype("uint8"), "RGB")
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle([W / 2 - hw, y - hh, W / 2 + hw, y + hh], radius=int(hh),
                        fill=col + (a,))
    atext(d, (W / 2, y + 2), label, f, (10, 12, 18), a)
    return img


def stars(d, cx, y, appear, col=(255, 210, 70)):
    if appear <= 0:
        return
    a = int(255 * ease_out(appear, 2))
    n = 5
    gap = 66
    for i in range(n):
        x = cx - (n - 1) * gap / 2 + i * gap
        pts = []
        for k in range(10):
            ang = -math.pi / 2 + k * math.pi / 5
            r = 26 if k % 2 == 0 else 11
            pts.append((x + math.cos(ang) * r, y + math.sin(ang) * r))
        sa = int(a * clamp((appear * 5) - i))
        d.polygon(pts, fill=col + (sa,))


def badge(d, cx, y, txt, appear, col=(255, 255, 255)):
    if appear <= 0:
        return
    a = int(255 * ease_out(appear, 2))
    f = font(BODYB, 30)
    hw = d.textlength(txt, font=f) / 2 + 26
    d.rounded_rectangle([cx - hw, y - 26, cx + hw, y + 26], radius=26,
                        outline=col + (a,), width=3, fill=col + (int(a * .12),))
    atext(d, (cx, y + 1), txt, f, col, a)


def logo_lockup(img, cy, name, appear, dot_col, name_col=INK):
    """A square app-icon dot + the brand name, centred."""
    d = ImageDraw.Draw(img, "RGBA")
    a = int(255 * ease_out(appear, 2))
    k = spring(appear)
    # shrink the wordmark for long brand names so the lockup stays on-canvas
    size = 118
    while size > 70 and d.textlength(name, font=font(DISPLAY, size)) > W - 260:
        size -= 4
    fn = font(DISPLAY, size)
    tw = d.textlength(name, font=fn)
    ic = int(150 * (0.7 + 0.3 * k))
    total = ic + 34 + tw
    x0 = W / 2 - total / 2
    iy = cy - ic / 2
    d.rounded_rectangle([x0, iy, x0 + ic, iy + ic], radius=int(ic * 0.26),
                        fill=dot_col + (a,))
    atext(d, (x0 + ic / 2, cy), name[0].upper(), font(DISPLAY, int(ic * 0.62)),
          (255, 255, 255), a)
    atext(d, (x0 + ic + 34, cy), name, fn, name_col, a, "lm")


def grain(img, t):
    import numpy as np
    g = (np.random.default_rng(int(t * 97) % 999).normal(128, 2.0, (H // 5, W // 5))
         .clip(0, 255).astype("uint8"))
    from PIL import ImageChops
    gg = Image.fromarray(g, "L").resize((W, H), Image.BILINEAR).convert("RGB")
    return ImageChops.add(img, gg, 1.0, -128)


# ================= ad 1 — Tendar (dating) =================
def tendar(t):
    img = grad((36, 6, 20), (12, 3, 10))
    img = soft_blobs(img, [(0.30, 0.28, 380, (255, 77, 109), 0, 0.5),
                           (0.74, 0.66, 420, (255, 140, 160), 2.0, 0.35)], t)
    d = ImageDraw.Draw(img, "RGBA")
    # floating hearts
    for i in range(9):
        ph = i * 0.7
        hx = (0.12 + (i * 0.11) % 0.8) * W
        hy = H * (1.15 - ((t * (0.5 + (i % 3) * .2) + i * .13) % 1.15))
        s = 18 + (i % 3) * 12
        aa = int(120 * clamp(1 - abs(hy / H - 0.5) * 1.4))
        heart(d, hx, hy, s, (255, 90, 120, aa))
    logo_lockup(img, H * 0.30, "Tendar", seg(t, .05, .30), (255, 77, 109))
    d = ImageDraw.Draw(img, "RGBA")
    center_text(d, W / 2, H * 0.44, "Try Tendar Today", font(DISPLAY, 96), INK,
                255 * ease_out(seg(t, .28, .48), 2))
    center_text(d, W / 2, H * 0.51, "the app that actually finds your people",
                font(BODY, 44), MUTED, 255 * ease_out(seg(t, .40, .58), 2))
    stars(d, W / 2, H * 0.60, seg(t, .52, .68))
    center_text(d, W / 2, H * 0.655, "4.9  ·  2M+ matches made", font(BODYB, 34),
                (255, 180, 195), 255 * ease_out(seg(t, .58, .72), 2))
    img = cta(img, H * 0.80, "Install free", (255, 77, 109), seg(t, .70, .90))
    d = ImageDraw.Draw(img, "RGBA")
    badge(d, W / 2, H * 0.885, "AD  ·  gmfy free", seg(t, .82, .96), (255, 210, 220))
    return grain(img, t)


def heart(d, x, y, s, col):
    d.ellipse([x - s, y - s * .6, x, y + s * .2], fill=col)
    d.ellipse([x, y - s * .6, x + s, y + s * .2], fill=col)
    d.polygon([(x - s, y - s * .1), (x + s, y - s * .1), (x, y + s * .9)], fill=col)


# ================= ad 2 — SnackRocket (food delivery) =================
def snackrocket(t):
    img = grad((36, 22, 6), (14, 8, 3))
    img = soft_blobs(img, [(0.28, 0.30, 400, (255, 150, 50), 0, 0.5),
                           (0.76, 0.7, 420, (255, 90, 40), 1.8, 0.32)], t)
    d = ImageDraw.Draw(img, "RGBA")
    # a rocket that climbs
    ry = H * (1.05 - 0.5 * ease_in_out(clamp(t * 1.2)))
    rx = W * (0.5 + 0.04 * math.sin(t * 6))
    if t < 0.6:
        rocket(d, rx, ry, seg(t, .02, .2))
    logo_lockup(img, H * 0.28, "SnackRocket", seg(t, .30, .50), (255, 122, 40))
    d = ImageDraw.Draw(img, "RGBA")
    center_text(d, W / 2, H * 0.43, "Snacks in 8 minutes", font(DISPLAY, 92), INK,
                255 * ease_out(seg(t, .44, .62), 2))
    center_text(d, W / 2, H * 0.50, "hot food, delivered before you finish a level",
                font(BODY, 42), MUTED, 255 * ease_out(seg(t, .52, .68), 2))
    stars(d, W / 2, H * 0.59, seg(t, .60, .74))
    center_text(d, W / 2, H * 0.645, "free delivery on your first order", font(BODYB, 36),
                (255, 200, 140), 255 * ease_out(seg(t, .66, .8), 2))
    img = cta(img, H * 0.80, "Order now", (255, 122, 40), seg(t, .74, .92))
    d = ImageDraw.Draw(img, "RGBA")
    badge(d, W / 2, H * 0.885, "AD  ·  gmfy free", seg(t, .84, .97), (255, 210, 170))
    return grain(img, t)


def rocket(d, x, y, ap):
    a = int(255 * ease_out(ap, 2))
    d.polygon([(x, y - 70), (x + 34, y + 30), (x - 34, y + 30)], fill=(240, 244, 252, a))
    d.polygon([(x - 34, y + 10), (x - 60, y + 54), (x - 20, y + 34)], fill=(255, 122, 40, a))
    d.polygon([(x + 34, y + 10), (x + 60, y + 54), (x + 20, y + 34)], fill=(255, 122, 40, a))
    d.ellipse([x - 14, y - 26, x + 14, y + 2], fill=(80, 170, 255, a))
    for i in range(6):
        fy = y + 34 + i * 16
        fw = 22 - i * 3
        d.polygon([(x - fw, fy), (x + fw, fy), (x, fy + 30)],
                  fill=(255, 200 - i * 20, 40, int(a * (1 - i / 6))))


# ================= ad 3 — RiftRunner (mobile game) =================
def riftrunner(t):
    img = grad((10, 8, 34), (4, 3, 14))
    img = soft_blobs(img, [(0.26, 0.28, 420, (124, 92, 255), 0, 0.5),
                           (0.78, 0.68, 440, (34, 211, 238), 2.2, 0.4)], t)
    d = ImageDraw.Draw(img, "RGBA")
    # speed streaks
    for i in range(26):
        ph = (t * 1.6 + i * 0.19) % 1.0
        y = H * ph
        x = (i * 137 % W)
        ln = 60 + (i % 4) * 40
        aa = int(90 * (1 - abs(ph - .5) * 1.4))
        d.line([(x, y), (x + 30, y + ln)], fill=(150, 200, 255, aa), width=3)
    logo_lockup(img, H * 0.29, "RiftRunner", seg(t, .05, .30),
                (124, 92, 255))
    d = ImageDraw.Draw(img, "RGBA")
    center_text(d, W / 2, H * 0.44, "Outrun the rift", font(DISPLAY, 100), INK,
                255 * ease_out(seg(t, .30, .50), 2))
    center_text(d, W / 2, H * 0.51, "the endless runner everyone's playing",
                font(BODY, 44), MUTED, 255 * ease_out(seg(t, .44, .62), 2))
    stars(d, W / 2, H * 0.60, seg(t, .56, .72), col=(120, 220, 255))
    center_text(d, W / 2, H * 0.655, "4.8  ·  editors' choice", font(BODYB, 34),
                (150, 210, 255), 255 * ease_out(seg(t, .62, .76), 2))
    img = cta(img, H * 0.80, "Play free", (34, 211, 238), seg(t, .72, .90))
    d = ImageDraw.Draw(img, "RGBA")
    badge(d, W / 2, H * 0.885, "AD  ·  gmfy free", seg(t, .84, .97), (170, 220, 255))
    return grain(img, t)


# ================= ad 4 — NimbusFit (fitness) =================
def nimbusfit(t):
    img = grad((6, 32, 30), (3, 12, 14))
    img = soft_blobs(img, [(0.30, 0.26, 400, (52, 214, 164), 0, 0.46),
                           (0.74, 0.70, 430, (80, 240, 210), 1.6, 0.30)], t)
    d = ImageDraw.Draw(img, "RGBA")
    # three activity rings closing behind the lockup — kept above the subline,
    # which is low-contrast grey and unreadable on top of a ring stroke
    for i, (rad, col) in enumerate(((250, (52, 214, 164)), (196, (120, 230, 255)),
                                    (142, (245, 197, 66)))):
        prog = ease_out(seg(t, .02 + i * .06, .55 + i * .06), 2)
        d.ellipse([W / 2 - rad, H * .30 - rad, W / 2 + rad, H * .30 + rad],
                  outline=col + (26,), width=18)
        if prog > 0:
            d.arc([W / 2 - rad, H * .30 - rad, W / 2 + rad, H * .30 + rad],
                  -90, -90 + 360 * prog, fill=col + (130,), width=18)
    # heartbeat trace scrolling through the gap between the rating and the CTA
    pulse(d, H * 0.722, t, (52, 214, 164))
    logo_lockup(img, H * 0.30, "NimbusFit", seg(t, .05, .30), (52, 214, 164))
    d = ImageDraw.Draw(img, "RGBA")
    center_text(d, W / 2, H * 0.44, "20 minutes. That's it.", font(DISPLAY, 94), INK,
                255 * ease_out(seg(t, .30, .50), 2))
    center_text(d, W / 2, H * 0.51, "coaching that fits between two levels",
                font(BODY, 44), (170, 205, 195), 255 * ease_out(seg(t, .44, .62), 2))
    stars(d, W / 2, H * 0.60, seg(t, .56, .72), col=(120, 240, 200))
    center_text(d, W / 2, H * 0.655, "4.9  ·  1.4M workouts logged", font(BODYB, 34),
                (150, 235, 210), 255 * ease_out(seg(t, .62, .76), 2))
    img = cta(img, H * 0.80, "Start free week", (52, 214, 164), seg(t, .72, .90))
    d = ImageDraw.Draw(img, "RGBA")
    badge(d, W / 2, H * 0.885, "AD  ·  gmfy free", seg(t, .84, .97), (170, 240, 220))
    return grain(img, t)


def pulse(d, y, t, col):
    """A scrolling ECG-ish trace."""
    pts, span = [], 260.0
    for x in range(0, W + 8, 8):
        u = ((x + t * 900) % span) / span
        if   u < .34: dy = 0
        elif u < .40: dy = -(u - .34) / .06 * 62
        elif u < .46: dy = -62 + (u - .40) / .06 * 96
        elif u < .52: dy = 34 - (u - .46) / .06 * 34
        else:         dy = 0
        pts.append((x, y + dy))
    for w, a in ((8, 30), (4, 150)):
        d.line(pts, fill=col + (a,), width=w, joint="curve")


# ================= ad 5 — Bloomly (plant delivery) =================
def bloomly(t):
    img = grad((14, 30, 12), (5, 12, 8))
    img = soft_blobs(img, [(0.24, 0.72, 420, (124, 200, 90), 0, 0.42),
                           (0.78, 0.34, 400, (220, 190, 90), 2.4, 0.26)], t)
    d = ImageDraw.Draw(img, "RGBA")
    # two stems grow up the sides, unfurling leaves and framing the copy
    grow = ease_in_out(clamp(t * 1.7))
    for sx, span, delay, sc in ((0.155, 0.72, 0.00, 1.0), (0.845, 0.58, 0.18, 0.82)):
        g = clamp((grow - delay) / (1 - delay))
        if g <= 0:
            continue
        stem(d, W * sx, span * g, 6, delay, grow, sc)
    # pollen drifting up
    for i in range(14):
        px = (0.08 + (i * 0.137) % 0.86) * W
        py = H * (1.1 - ((t * (0.34 + (i % 4) * .11) + i * .07) % 1.1))
        r = 4 + (i % 3) * 3
        d.ellipse([px - r, py - r, px + r, py + r],
                  fill=(240, 226, 150, int(110 * clamp(1 - abs(py / H - .45) * 1.5))))
    logo_lockup(img, H * 0.26, "Bloomly", seg(t, .05, .30), (124, 200, 90))
    d = ImageDraw.Draw(img, "RGBA")
    center_text(d, W / 2, H * 0.40, "Plants that don't die", font(DISPLAY, 94), INK,
                255 * ease_out(seg(t, .30, .50), 2))
    center_text(d, W / 2, H * 0.47, "we pick them, ship them, and text you when to water",
                font(BODY, 38), MUTED, 255 * ease_out(seg(t, .44, .62), 2))
    stars(d, W / 2, H * 0.56, seg(t, .56, .72), col=(200, 235, 140))
    center_text(d, W / 2, H * 0.615, "4.7  ·  300k plants delivered", font(BODYB, 34),
                (190, 225, 150), 255 * ease_out(seg(t, .62, .76), 2))
    img = cta(img, H * 0.80, "Get 20% off", (124, 200, 90), seg(t, .72, .90))
    d = ImageDraw.Draw(img, "RGBA")
    badge(d, W / 2, H * 0.885, "AD  ·  gmfy free", seg(t, .84, .97), (200, 230, 170))
    return grain(img, t)


def stem(d, x, span, n, delay, grow, sc):
    """One stem rising `span` (as a fraction of H) from the bottom edge."""
    d.line([(x, H * 1.02), (x, H * (1.02 - span))], fill=(96, 178, 84, 180),
           width=int(13 * sc))
    for i in range(n):
        lp = clamp((grow - delay - 0.10 * i) * 3.2)
        if lp <= 0:
            continue
        ly = H * 1.02 - (H * span) * (0.12 + i * 0.16)
        leaf(d, x, ly, 124 * sc * lp, -1 if i % 2 else 1,
             (110, 196, 96, int(205 * lp)))


def leaf(d, x, y, s, side, col):
    d.polygon([(x, y), (x + side * s * .62, y - s * .46),
               (x + side * s, y - s * .04), (x + side * s * .40, y + s * .22)],
              fill=col)


# ================= ad 6 — Vaultly (savings) =================
def vaultly(t):
    img = grad((6, 16, 38), (3, 7, 16))
    img = soft_blobs(img, [(0.28, 0.30, 410, (56, 140, 255), 0, 0.44),
                           (0.74, 0.70, 430, (245, 197, 66), 2.0, 0.26)], t)
    d = ImageDraw.Draw(img, "RGBA")
    # coins stacking up from the bottom edge (kept clear of the CTA and badge)
    n = int(6 * ease_out(clamp(t * 1.5), 2))
    for i in range(n):
        cy = H * 1.005 - i * 34
        drop = clamp((t * 1.5 * 6 - i) * 2.2)
        cy -= (1 - ease_out(drop, 3)) * 260
        coin(d, W / 2, cy, int(230 * min(1.0, drop * 1.4)))
    # a balance counting up, then fading as the copy lands
    amt = int(2480 * ease_out(clamp(t * 2.0), 2))
    fade = 255 * ease_out(seg(t, .04, .18), 2) * (1 - ease_out(seg(t, .26, .40), 2))
    center_text(d, W / 2, H * 0.155, "$%s" % format(amt, ","), font(DISPLAY, 130),
                (245, 197, 66), max(0, fade))
    logo_lockup(img, H * 0.30, "Vaultly", seg(t, .22, .44), (56, 140, 255))
    d = ImageDraw.Draw(img, "RGBA")
    center_text(d, W / 2, H * 0.44, "Save without thinking", font(DISPLAY, 92), INK,
                255 * ease_out(seg(t, .40, .58), 2))
    center_text(d, W / 2, H * 0.51, "we round up your spare change, every single day",
                font(BODY, 40), MUTED, 255 * ease_out(seg(t, .50, .66), 2))
    stars(d, W / 2, H * 0.60, seg(t, .60, .74))
    center_text(d, W / 2, H * 0.655, "4.8  ·  $90M+ tucked away", font(BODYB, 34),
                (170, 200, 255), 255 * ease_out(seg(t, .66, .80), 2))
    img = cta(img, H * 0.775, "Open an account", (56, 140, 255), seg(t, .74, .92))
    d = ImageDraw.Draw(img, "RGBA")
    badge(d, W / 2, H * 0.855, "AD  ·  gmfy free", seg(t, .84, .97), (180, 210, 255))
    return grain(img, t)


def coin(d, x, y, a):
    d.ellipse([x - 96, y - 26, x + 96, y + 26], fill=(245, 197, 66, a))
    d.ellipse([x - 96, y - 34, x + 96, y + 18], fill=(255, 220, 120, a))
    d.ellipse([x - 62, y - 24, x + 62, y + 8], outline=(180, 140, 30, int(a * .6)), width=4)


# ================= ad 7 — PixelPaws (pet game) =================
def pixelpaws(t):
    img = grad((30, 8, 40), (12, 4, 18))
    img = soft_blobs(img, [(0.28, 0.30, 400, (236, 72, 153), 0, 0.46),
                           (0.74, 0.68, 420, (168, 92, 255), 1.9, 0.34)], t)
    d = ImageDraw.Draw(img, "RGBA")
    # confetti
    for i in range(22):
        cx = (0.05 + (i * 0.091) % 0.92) * W
        cy = H * (((t * (0.5 + (i % 4) * .18) + i * .09) % 1.12) - 0.06)
        s = 9 + (i % 3) * 5
        col = ((255, 210, 80), (120, 235, 255), (255, 120, 190))[i % 3]
        d.rectangle([cx - s, cy - s, cx + s, cy + s],
                    fill=col + (int(120 * clamp(1 - abs(cy / H - .5) * 1.5)),))
    # a pixel pup hopping across the lower half, then settling
    hop = clamp(t * 1.9)
    bx = W * (0.18 + 0.64 * ease_in_out(hop))
    by = H * 0.70 - abs(math.sin(hop * math.pi * 3.4)) * 190 * (1 - hop * 0.7)
    pup(d, bx, by, int(255 * ease_out(seg(t, .02, .16), 2)))
    logo_lockup(img, H * 0.28, "PixelPaws", seg(t, .06, .32), (236, 72, 153))
    d = ImageDraw.Draw(img, "RGBA")
    center_text(d, W / 2, H * 0.42, "Adopt a pixel pup", font(DISPLAY, 98), INK,
                255 * ease_out(seg(t, .32, .52), 2))
    center_text(d, W / 2, H * 0.49, "raise it, race it, trade it with your friends",
                font(BODY, 42), MUTED, 255 * ease_out(seg(t, .46, .64), 2))
    stars(d, W / 2, H * 0.58, seg(t, .58, .74), col=(255, 170, 220))
    center_text(d, W / 2, H * 0.635, "4.9  ·  5M pets adopted", font(BODYB, 34),
                (255, 180, 220), 255 * ease_out(seg(t, .64, .78), 2))
    img = cta(img, H * 0.80, "Play free", (236, 72, 153), seg(t, .74, .92))
    d = ImageDraw.Draw(img, "RGBA")
    badge(d, W / 2, H * 0.885, "AD  ·  gmfy free", seg(t, .84, .97), (255, 200, 230))
    return grain(img, t)


PUP = ["..1111..",
       ".111111.",
       ".122112.",
       ".111111.",
       "..1111..",
       ".111111.",
       "1111111.",
       ".11..11."]


def pup(d, x, y, a):
    """A chunky 8x8 sprite so it reads as pixel art at any distance."""
    px = 26
    ox, oy = x - px * 4, y - px * 4
    for r, row in enumerate(PUP):
        for c, ch in enumerate(row):
            if ch == ".":
                continue
            col = (255, 230, 160) if ch == "1" else (40, 18, 30)
            d.rectangle([ox + c * px, oy + r * px,
                         ox + c * px + px - 2, oy + r * px + px - 2], fill=col + (a,))


# ================= ad 8 — Zenote (notes / focus) =================
def zenote(t):
    img = grad((12, 12, 34), (5, 5, 14))
    img = soft_blobs(img, [(0.30, 0.32, 420, (110, 120, 255), 0, 0.38),
                           (0.72, 0.68, 430, (90, 200, 220), 2.3, 0.26)], t)
    d = ImageDraw.Draw(img, "RGBA")
    # a slow breathing circle behind the lockup
    br = 300 + 46 * math.sin(t * math.pi * 3.2)
    for w, a in ((3, 60), (1, 110)):
        d.ellipse([W / 2 - br, H * .30 - br, W / 2 + br, H * .30 + br],
                  outline=(150, 165, 255, a), width=w)
    # ruled lines that write themselves in, ending above the star row
    for i in range(5):
        ly = H * 0.565 + i * 44
        wp = ease_out(clamp((t * 1.6 - 0.06 * i) * 1.8), 2)
        if wp <= 0:
            continue
        ln = (W * 0.62) * (0.55 + 0.45 * ((i * 7) % 5) / 4.0)
        d.rounded_rectangle([W / 2 - ln / 2, ly - 7,
                             W / 2 - ln / 2 + ln * wp, ly + 7],
                            radius=7, fill=(180, 190, 235, 46))
    logo_lockup(img, H * 0.30, "Zenote", seg(t, .05, .30), (110, 120, 255))
    d = ImageDraw.Draw(img, "RGBA")
    center_text(d, W / 2, H * 0.43, "Think in one place", font(DISPLAY, 98), INK,
                255 * ease_out(seg(t, .30, .50), 2))
    center_text(d, W / 2, H * 0.50, "notes, tasks and focus timers that stay out of the way",
                font(BODY, 37), MUTED, 255 * ease_out(seg(t, .44, .62), 2))
    stars(d, W / 2, H * 0.70, seg(t, .58, .74), col=(160, 175, 255))
    center_text(d, W / 2, H * 0.755, "4.8  ·  app of the day", font(BODYB, 34),
                (165, 180, 255), 255 * ease_out(seg(t, .64, .78), 2))
    img = cta(img, H * 0.83, "Try Zenote", (110, 120, 255), seg(t, .74, .92))
    d = ImageDraw.Draw(img, "RGBA")
    badge(d, W / 2, H * 0.915, "AD  ·  gmfy free", seg(t, .84, .97), (190, 200, 255))
    return grain(img, t)


ADS = [
    ("tendar", 30, tendar, "Tendar — dating app spot"),
    ("snackrocket", 30, snackrocket, "SnackRocket — food delivery spot"),
    ("riftrunner", 30, riftrunner, "RiftRunner — mobile game spot"),
    ("nimbusfit", 30, nimbusfit, "NimbusFit — fitness app spot"),
    ("bloomly", 30, bloomly, "Bloomly — plant delivery spot"),
    ("vaultly", 30, vaultly, "Vaultly — savings app spot"),
    ("pixelpaws", 30, pixelpaws, "PixelPaws — pet game spot"),
    ("zenote", 30, zenote, "Zenote — notes app spot"),
]
