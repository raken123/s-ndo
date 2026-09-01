"""Backgrounds, props and on-screen graphics."""

import math

from draw import (GROUND, H, OUTLINE, W, circle, clamp, ease_in_out, ease_out,
                  ellipse, fill_stroke, font, lerp, rand01, rrect, set_rgb,
                  stroke_out, text_at, text_w, wrap)

SKY_TOP = (0.55, 0.80, 0.97)
SKY_BOT = (0.85, 0.93, 1.00)
GRASS = (0.55, 0.80, 0.45)
GRASS_D = (0.44, 0.71, 0.36)
DARK_BG = (0.10, 0.09, 0.16)


def sky(cr, t, scroll=0.0):
    import cairo
    g = cairo.LinearGradient(0, 0, 0, GROUND)
    g.add_color_stop_rgb(0, *SKY_TOP)
    g.add_color_stop_rgb(1, *SKY_BOT)
    cr.set_source(g)
    cr.rectangle(0, 0, W, GROUND + 4)
    cr.fill()

    # sun
    circle(cr, 1130, 110, 52)
    set_rgb(cr, (1.0, 0.93, 0.45))
    cr.fill()
    circle(cr, 1130, 110, 68)
    set_rgb(cr, (1.0, 0.93, 0.45), 0.25)
    cr.fill()

    for i in range(5):
        cx = (rand01("cloud", i) * 1500 + t * (12 + i * 4) - scroll * 0.3) % 1560 - 140
        cy = 70 + rand01("cloudy", i) * 190
        s = 0.7 + rand01("clouds", i) * 0.7
        cloud(cr, cx, cy, s, 0.92)

    cr.rectangle(0, GROUND, W, H - GROUND)
    set_rgb(cr, GRASS)
    cr.fill()
    cr.move_to(0, GROUND)
    cr.line_to(W, GROUND)
    stroke_out(cr, 4.0, (0.30, 0.52, 0.26))
    for i in range(46):
        x = (rand01("tuft", i) * W + t * 2) % W
        y = GROUND + 14 + rand01("tufty", i) * 96
        set_rgb(cr, GRASS_D)
        cr.set_line_width(4)
        cr.set_line_cap(1)
        cr.move_to(x, y)
        cr.line_to(x + 5, y - 13)
        cr.stroke()


def hills(cr, t):
    set_rgb(cr, (0.62, 0.83, 0.55))
    for i, (cx, r) in enumerate(((180, 190), (520, 150), (980, 210))):
        cr.new_path()
        cr.arc(cx - t * 0.6 % (W + 600), GROUND, r, math.pi, 0)
        cr.close_path()
        cr.fill()


def cloud(cr, x, y, s=1.0, alpha=1.0):
    cr.save()
    cr.translate(x, y)
    cr.scale(s, s)
    cr.new_path()
    for cx, cy, r in ((-52, 6, 30), (-16, -12, 40), (26, 2, 32), (58, 10, 24)):
        circle(cr, cx, cy, r)
    rrect(cr, -70, 0, 148, 22, 11)
    set_rgb(cr, (1, 1, 1), alpha)
    cr.fill()
    cr.restore()


def dark_stage(cr, t, spots=(), floor=(0.16, 0.14, 0.24)):
    set_rgb(cr, DARK_BG)
    cr.rectangle(0, 0, W, H)
    cr.fill()
    import cairo
    for (sx, sw, a) in spots:
        g = cairo.LinearGradient(0, 0, 0, GROUND + 40)
        g.add_color_stop_rgba(0, 1, 0.97, 0.85, 0.10 * a)
        g.add_color_stop_rgba(1, 1, 0.96, 0.80, 0.30 * a)
        cr.set_source(g)
        cr.new_path()
        cr.move_to(sx - sw * 0.22, -10)
        cr.line_to(sx + sw * 0.22, -10)
        cr.line_to(sx + sw, GROUND + 46)
        cr.line_to(sx - sw, GROUND + 46)
        cr.close_path()
        cr.fill()
        ellipse(cr, sx, GROUND + 8, sw * 0.95, 34)
        set_rgb(cr, (1, 0.96, 0.78), 0.16 * a)
        cr.fill()
    cr.rectangle(0, GROUND + 8, W, H)
    set_rgb(cr, floor)
    cr.fill()
    cr.move_to(0, GROUND + 8)
    cr.line_to(W, GROUND + 8)
    stroke_out(cr, 3.0, (0.28, 0.25, 0.40))


def chair(cr, x, y, s=1.0, t=0.0, glow=0.0):
    """The Last Good Chair.  Prize, mascot, silent antagonist."""
    cr.save()
    cr.translate(x, y)
    cr.scale(s, s)
    if glow > 0:
        for i in range(3):
            r = 96 + i * 26 + math.sin(t * 2.2) * 5
            circle(cr, 0, -66, r)
            set_rgb(cr, (1, 0.95, 0.6), 0.10 * glow)
            cr.fill()
    wood, wood_d = (0.79, 0.55, 0.31), (0.62, 0.40, 0.21)
    for dx in (-40, 40):
        rrect(cr, dx - 8, -34, 16, 34, 5)
        fill_stroke(cr, wood_d, 4.0)
    rrect(cr, -52, -52, 104, 20, 7)
    fill_stroke(cr, wood, 4.5)
    rrect(cr, -46, -140, 14, 92, 6)
    fill_stroke(cr, wood_d, 4.0)
    rrect(cr, 32, -140, 14, 92, 6)
    fill_stroke(cr, wood_d, 4.0)
    for yy in (-134, -110):
        rrect(cr, -46, yy, 92, 16, 6)
        fill_stroke(cr, wood, 4.0)
    cr.restore()


def nameplate(cr, x, y, name, blurb, color, k):
    """Roll-call card: slides up with an overshoot."""
    if k <= 0:
        return
    a = clamp(k * 1.6)
    dy = (1 - ease_out(k)) * 40
    font(cr, 34)
    w = max(text_w(cr, name.upper()) + 60, 260)
    font(cr, 20, False)
    w = max(w, text_w(cr, blurb) + 50)
    cr.save()
    cr.translate(0, dy)
    rrect(cr, x - w / 2, y, w, 78, 16)
    set_rgb(cr, (0.12, 0.11, 0.18), 0.90 * a)
    cr.fill_preserve()
    stroke_out(cr, 4.0, color, a)
    text_at(cr, x, y + 36, name.upper(), 34, (1, 1, 1), "center", alpha=a)
    text_at(cr, x, y + 63, blurb, 19, color, "center", bold=False, alpha=a)
    cr.restore()


def subtitle(cr, name, text, color, k=1.0):
    if k <= 0 or not text:
        return
    lines = wrap(cr, text, 34, 900)
    h = 30 + len(lines) * 40
    y = H - h - 26
    bw = 0
    font(cr, 34)
    for ln in lines:
        bw = max(bw, text_w(cr, ln))
    bw = max(bw + 56, 380)
    x = W / 2 - bw / 2
    rrect(cr, x, y, bw, h, 16)
    set_rgb(cr, (0.10, 0.09, 0.15), 0.80 * k)
    cr.fill_preserve()
    stroke_out(cr, 3.5, color, 0.9 * k)
    # speaker tag
    font(cr, 22)
    tw = text_w(cr, name.upper()) + 30
    rrect(cr, x + 16, y - 17, tw, 32, 10)
    set_rgb(cr, color, k)
    cr.fill_preserve()
    stroke_out(cr, 3.0, (0.10, 0.09, 0.15), k)
    text_at(cr, x + 16 + tw / 2, y + 6, name.upper(), 22, (1, 1, 1), "center",
            alpha=k)
    for i, ln in enumerate(lines):
        text_at(cr, W / 2, y + 48 + i * 40, ln, 34, (1, 1, 1), "center",
                alpha=k)


def logo(cr, cx, cy, s=1.0, alpha=1.0, sub=None, sub_a=1.0):
    cr.save()
    cr.translate(cx, cy)
    cr.scale(s, s)
    text_at(cr, 0, 0, "ODDS & ENDS", 104, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=16, alpha=alpha)
    cr.restore()
    if sub:
        text_at(cr, cx, cy + 62 * s, sub, 38, (1, 1, 1), "center",
                outline=(0.12, 0.11, 0.18), outline_w=8, alpha=sub_a)


def banner(cr, y, text, k, color=(0.92, 0.30, 0.36)):
    if k <= 0:
        return
    dy = (1 - ease_out(k)) * -160
    cr.save()
    cr.translate(0, dy)
    rrect(cr, 90, y, W - 180, 96, 18)
    set_rgb(cr, color, 0.96)
    cr.fill_preserve()
    stroke_out(cr, 5.0)
    text_at(cr, W / 2, y + 64, text, 56, (1, 1, 1), "center",
            outline=(0.12, 0.11, 0.18), outline_w=8)
    cr.restore()


def timer(cr, secs, warn=False, k=1.0):
    if k <= 0:
        return
    x, y = W - 210, 34
    rrect(cr, x, y, 176, 74, 14)
    set_rgb(cr, (0.12, 0.11, 0.18), 0.85 * k)
    cr.fill_preserve()
    stroke_out(cr, 4.0, (1, 0.86, 0.30) if not warn else (0.95, 0.35, 0.32), k)
    col = (1, 0.42, 0.38) if warn else (1, 1, 1)
    text_at(cr, x + 88, y + 56, "%02d" % max(0, int(math.ceil(secs))), 52, col,
            "center", alpha=k)


def scorecard(cr, x, y, team, score, color, k=1.0, w=300):
    if k <= 0:
        return
    rrect(cr, x - w / 2, y, w, 96, 16)
    set_rgb(cr, (0.12, 0.11, 0.18), 0.88 * k)
    cr.fill_preserve()
    stroke_out(cr, 4.0, color, k)
    text_at(cr, x, y + 34, team.upper(), 26, color, "center", alpha=k)
    text_at(cr, x, y + 80, score, 40, (1, 1, 1), "center", alpha=k)


def confetti(cr, t, n=70, seed="c"):
    for i in range(n):
        x = (rand01(seed, i) * W + math.sin(t * 1.4 + i) * 26) % W
        fall = ((t * (150 + rand01(seed, i, "v") * 170) +
                 rand01(seed, i, "o") * 900) % 900) - 120
        col = [(0.95, 0.35, 0.35), (1, 0.84, 0.3), (0.4, 0.78, 0.95),
               (0.55, 0.85, 0.45), (0.78, 0.6, 0.95)][i % 5]
        cr.save()
        cr.translate(x, fall)
        cr.rotate(t * 3 + i)
        cr.rectangle(-7, -4, 14, 8)
        set_rgb(cr, col)
        cr.fill()
        cr.restore()


def flash(cr, a, color=(1, 1, 1)):
    if a <= 0:
        return
    set_rgb(cr, color, clamp(a))
    cr.rectangle(0, 0, W, H)
    cr.fill()


def vignette(cr, a=0.35):
    import cairo
    g = cairo.RadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 780)
    g.add_color_stop_rgba(0, 0, 0, 0, 0)
    g.add_color_stop_rgba(1, 0, 0, 0, a)
    cr.set_source(g)
    cr.rectangle(0, 0, W, H)
    cr.fill()


def puddle(cr, x, y, w, color=(0.66, 0.87, 0.96)):
    ellipse(cr, x, y, w, w * 0.28)
    fill_stroke(cr, color, 4.5)


def bolt(cr, x0, y0, x1, y1, t, seed="z"):
    n = 6
    cr.new_path()
    cr.move_to(x0, y0)
    for i in range(1, n):
        f = i / n
        jitter = (rand01(seed, i, int(t * 30)) - 0.5) * 46
        cr.line_to(lerp(x0, x1, f) + jitter, lerp(y0, y1, f) + jitter * 0.4)
    cr.line_to(x1, y1)
    set_rgb(cr, (1, 0.95, 0.4))
    cr.set_line_width(9)
    cr.set_line_cap(1)
    cr.set_line_join(1)
    cr.stroke_preserve()
    set_rgb(cr, (1, 1, 1), 0.9)
    cr.set_line_width(4)
    cr.stroke()


def arrow_down(cr, x, y, h, color=(0.95, 0.35, 0.32)):
    cr.new_path()
    cr.move_to(x, y)
    cr.line_to(x, y - h)
    stroke_out(cr, 6.0, color)
    cr.new_path()
    cr.move_to(x - 12, y - 14)
    cr.line_to(x, y)
    cr.line_to(x + 12, y - 14)
    stroke_out(cr, 6.0, color)


def podium(cr, x, y, w=150, h=110, color=(0.30, 0.28, 0.44)):
    rrect(cr, x - w / 2, y, w, h, 10)
    fill_stroke(cr, color, 4.5)
    rrect(cr, x - w / 2 - 10, y - 14, w + 20, 20, 8)
    fill_stroke(cr, (0.42, 0.38, 0.58), 4.5)
