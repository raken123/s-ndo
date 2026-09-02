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


def scorecard(cr, x, y, team, score, color, k=1.0, w=300, size=40):
    if k <= 0:
        return
    rrect(cr, x - w / 2, y, w, 96, 16)
    set_rgb(cr, (0.12, 0.11, 0.18), 0.88 * k)
    cr.fill_preserve()
    stroke_out(cr, 4.0, color, k)
    text_at(cr, x, y + 34, team.upper(), 26, color, "center", alpha=k)
    text_at(cr, x, y + 80, score, size, (1, 1, 1), "center", alpha=k)


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


# ------------------------------------------------- episode 2: the drawer ---

WOOD = (0.60, 0.44, 0.29)
WOOD_D = (0.42, 0.30, 0.22)
DRAWER_DARK = (0.17, 0.12, 0.09)


def drawer(cr, x, y, w=440, h=230, open_k=0.0, t=0.0, glow=0.0):
    """The Junk Drawer, seen from outside.  open_k slides the front panel."""
    rrect(cr, x - w / 2, y - h, w, h, 16)
    fill_stroke(cr, WOOD_D, 5.0)
    inset = 18
    rrect(cr, x - w / 2 + inset, y - h + inset, w - inset * 2, h - inset * 1.4, 12)
    fill_stroke(cr, DRAWER_DARK, 4.5)
    if open_k > 0.05:
        # junk, dimly, inside
        for i, (dx, dy, rw, rh) in enumerate(((-110, -26, 46, 22),
                                              (-20, -14, 60, 26),
                                              (86, -30, 40, 30),
                                              (30, -50, 54, 18))):
            rrect(cr, x + dx, y + dy - 40, rw, rh, 7)
            set_rgb(cr, (0.30, 0.22, 0.17), 0.9 * min(1.0, open_k * 2))
            cr.fill()
    if glow > 0:
        set_rgb(cr, (1, 0.9, 0.5), 0.10 * glow)
        rrect(cr, x - w / 2 - 12, y - h - 12, w + 24, h + 24, 20)
        cr.fill()
    # the front face: covers the whole box when shut, a lip when open
    ph = h - (h - 66) * open_k
    fy = (y - h) + (h - 66 - 4) * open_k
    rrect(cr, x - w / 2 - 12, fy, w + 24, ph, 12)
    fill_stroke(cr, WOOD, 5.0)
    rrect(cr, x - 46, fy + ph - 42, 92, 18, 9)
    fill_stroke(cr, (0.76, 0.74, 0.70), 4.0)


def drawer_room(cr, t, light=1.0):
    """Inside the drawer: wood walls and one shaft of kitchen light."""
    set_rgb(cr, (0.22, 0.15, 0.11))
    cr.rectangle(0, 0, W, H)
    cr.fill()
    set_rgb(cr, (0.27, 0.19, 0.13))
    cr.set_line_width(3)
    for i in range(9):
        y = 40 + i * 62
        cr.move_to(0, y + math.sin(i) * 6)
        cr.line_to(W, y + math.cos(i * 1.7) * 6)
        cr.stroke()
    if light > 0:
        import cairo
        g = cairo.LinearGradient(0, -40, 0, GROUND + 40)
        g.add_color_stop_rgba(0, 1, 0.95, 0.75, 0.30 * light)
        g.add_color_stop_rgba(1, 1, 0.93, 0.70, 0.05 * light)
        cr.set_source(g)
        cr.new_path()
        cr.move_to(420, -10)
        cr.line_to(880, -10)
        cr.line_to(1010, GROUND + 40)
        cr.line_to(300, GROUND + 40)
        cr.close_path()
        cr.fill()
        for i in range(26):
            x = 300 + rand01("mote", i) * 700
            y = (rand01("motey", i) * 620 + t * (10 + rand01("motev", i) * 22)) % 620
            circle(cr, x, y, 2 + rand01("moter", i) * 2)
            set_rgb(cr, (1, 0.97, 0.85), 0.45)
            cr.fill()
    cr.rectangle(0, GROUND + 6, W, H)
    set_rgb(cr, (0.31, 0.22, 0.15))
    cr.fill()
    cr.move_to(0, GROUND + 6)
    cr.line_to(W, GROUND + 6)
    stroke_out(cr, 4.0, (0.20, 0.14, 0.10))
    junk_pile(cr, 0)


def junk_pile(cr, t):
    """Background clutter: the stuff nobody throws away."""
    for i, (x, y, w, h, r, rot) in enumerate((
            (70, GROUND, 120, 26, 12, -0.1), (210, GROUND, 70, 46, 10, 0.2),
            (1150, GROUND, 130, 30, 14, 0.08), (1040, GROUND, 60, 52, 9, -0.15),
            (620, GROUND + 30, 150, 22, 10, 0.03))):
        cr.save()
        cr.translate(x, y - h / 2)
        cr.rotate(rot)
        rrect(cr, -w / 2, -h / 2, w, h, r)
        fill_stroke(cr, (0.34, 0.25, 0.18), 4.0, outline=(0.20, 0.14, 0.10))
        cr.restore()


def prop(cr, kind, x, y, s=1.0, rot=0.0):
    """The salvage: one small object, drawn at (x, y)."""
    if s <= 0.002:
        return
    cr.save()
    cr.translate(x, y)
    cr.rotate(rot)
    cr.scale(s, s)
    if kind == "menu":
        rrect(cr, -34, -44, 68, 88, 6)
        fill_stroke(cr, (0.98, 0.96, 0.90), 4.0)
        set_rgb(cr, (0.85, 0.25, 0.25))
        cr.set_line_width(4)
        for i in range(4):
            cr.move_to(-22, -24 + i * 18)
            cr.line_to(22 - (i % 2) * 14, -24 + i * 18)
            cr.stroke()
    elif kind == "teabag":
        cr.move_to(0, -46)
        cr.line_to(0, -18)
        stroke_out(cr, 3.0, (0.85, 0.82, 0.75))
        rrect(cr, -10, -56, 20, 14, 3)
        fill_stroke(cr, (0.95, 0.90, 0.72), 3.0)
        rrect(cr, -24, -18, 48, 54, 8)
        fill_stroke(cr, (0.80, 0.66, 0.46), 4.0)
    elif kind == "band":
        ellipse(cr, 0, 0, 40, 26)
        set_rgb(cr, (0.13, 0.12, 0.16))
        cr.set_line_width(20)
        cr.stroke_preserve()
        set_rgb(cr, (0.92, 0.42, 0.45))
        cr.set_line_width(13)
        cr.stroke()
    elif kind == "tray":
        rrect(cr, -52, -26, 104, 52, 10)
        fill_stroke(cr, (0.72, 0.83, 0.90), 4.0)
        for i in range(4):
            rrect(cr, -44 + i * 23, -18, 18, 36, 5)
            fill_stroke(cr, (0.55, 0.70, 0.80), 3.0)
    elif kind == "sock":
        cr.new_path()
        cr.move_to(-16, -46)
        cr.line_to(16, -46)
        cr.line_to(16, 6)
        cr.curve_to(16, 30, 4, 38, -26, 38)
        cr.curve_to(-44, 38, -44, 10, -26, 8)
        cr.line_to(-16, 6)
        cr.close_path()
        fill_stroke(cr, (0.86, 0.88, 0.93), 4.0)
        cr.rectangle(-16, -46, 32, 14)
        set_rgb(cr, (0.55, 0.70, 0.85))
        cr.fill()
    cr.restore()


def crown(cr, x, y, s=1.0, a=1.0):
    if s <= 0.002:
        return
    cr.save()
    cr.translate(x, y)
    cr.scale(s, s)
    cr.new_path()
    cr.move_to(-30, 14)
    cr.line_to(-34, -22)
    cr.line_to(-14, -4)
    cr.line_to(0, -28)
    cr.line_to(14, -4)
    cr.line_to(34, -22)
    cr.line_to(30, 14)
    cr.close_path()
    set_rgb(cr, (1, 0.84, 0.28), a)
    cr.fill_preserve()
    stroke_out(cr, 4.0, OUTLINE, a)
    cr.restore()


# --------------------------------------------- episode 3: the sock puppet ---

CURTAIN = (0.62, 0.13, 0.22)
CURTAIN_D = (0.44, 0.09, 0.17)
STAGE_TOP = 430.0


def theater(cr, t, open_k=0.0, lights=1.0):
    """A small stage: backdrop, curtains, footlights, a wooden platform."""
    set_rgb(cr, (0.14, 0.11, 0.20))
    cr.rectangle(0, 0, W, H)
    cr.fill()
    # backdrop
    rrect(cr, 300, 40, 680, STAGE_TOP - 40, 10)
    fill_stroke(cr, (0.23, 0.17, 0.32), 5.0)
    for i in range(7):
        x = 330 + i * 94
        cr.move_to(x, 60)
        cr.line_to(x, STAGE_TOP - 20)
        set_rgb(cr, (0.29, 0.22, 0.39))
        cr.set_line_width(6)
        cr.stroke()
    if lights > 0:
        import cairo
        for sx in (470, 640, 810):
            g = cairo.LinearGradient(0, 30, 0, STAGE_TOP + 30)
            g.add_color_stop_rgba(0, 1, 0.96, 0.78, 0.16 * lights)
            g.add_color_stop_rgba(1, 1, 0.94, 0.72, 0.02 * lights)
            cr.set_source(g)
            cr.new_path()
            cr.move_to(sx - 40, 30)
            cr.line_to(sx + 40, 30)
            cr.line_to(sx + 150, STAGE_TOP + 30)
            cr.line_to(sx - 150, STAGE_TOP + 30)
            cr.close_path()
            cr.fill()
    # platform
    rrect(cr, 330, STAGE_TOP, 620, 30, 8)
    fill_stroke(cr, (0.58, 0.42, 0.28), 5.0)
    rrect(cr, 350, STAGE_TOP + 28, 580, 26, 6)
    fill_stroke(cr, (0.40, 0.29, 0.20), 5.0)
    # curtains, drawn over everything on the stage
    wdt = lerp(400, 150, ease_out(open_k))
    for sgn, x0 in ((-1, 300), (1, 980)):
        cr.save()
        if sgn < 0:
            rrect(cr, x0 - 60, 20, wdt, STAGE_TOP - 10, 14)
        else:
            rrect(cr, x0 - wdt + 60, 20, wdt, STAGE_TOP - 10, 14)
        fill_stroke(cr, CURTAIN, 5.0)
        cr.clip()
        for i in range(7):
            x = (x0 - 60 if sgn < 0 else x0 - wdt + 60) + 22 + i * (wdt / 7)
            cr.move_to(x, 20)
            cr.line_to(x, STAGE_TOP + 10)
            set_rgb(cr, CURTAIN_D)
            cr.set_line_width(10)
            cr.stroke()
        cr.restore()
    rrect(cr, 280, 8, 720, 46, 12)
    fill_stroke(cr, CURTAIN_D, 5.0)
    # footlights
    cr.rectangle(0, GROUND + 6, W, H)
    set_rgb(cr, (0.19, 0.15, 0.27))
    cr.fill()
    for i in range(9):
        x = 350 + i * 70
        circle(cr, x, STAGE_TOP + 62, 9)
        fill_stroke(cr, (1, 0.88, 0.45), 3.5)


def sock_puppet(cr, x, y, s=1.0, rot=0.0, mouth=0.0, color=(0.86, 0.88, 0.93)):
    """An eleven-year-old sock, worn as a puppet.  The jaw opens on speech."""
    cr.save()
    cr.translate(x, y)
    cr.rotate(rot)
    cr.scale(s, s)
    # cuff
    rrect(cr, -20, 18, 40, 30, 8)
    fill_stroke(cr, (0.55, 0.70, 0.85), 4.0)
    # lower jaw
    cr.save()
    cr.rotate(mouth * 0.30)
    cr.new_path()
    cr.move_to(-20, 22)
    cr.line_to(-20, 0)
    cr.curve_to(-20, -14, 6, -18, 34, -10)
    cr.curve_to(48, -6, 48, 14, 32, 18)
    cr.line_to(-20, 22)
    cr.close_path()
    fill_stroke(cr, color, 4.5)
    cr.restore()
    # upper jaw, hinged at the mouth corner
    cr.save()
    cr.rotate(-mouth * 0.55)
    cr.new_path()
    cr.move_to(-20, 0)
    cr.line_to(-20, -30)
    cr.curve_to(-20, -52, 20, -58, 40, -40)
    cr.curve_to(54, -28, 50, -8, 32, -4)
    cr.curve_to(6, 0, -8, 2, -20, 0)
    cr.close_path()
    fill_stroke(cr, color, 4.5)
    for dx in (2, 22):
        circle(cr, dx, -38, 8)
        fill_stroke(cr, (1, 1, 1), 3.0)
        circle(cr, dx + 2, -38, 3.6)
        set_rgb(cr, OUTLINE)
        cr.fill()
    cr.restore()
    cr.restore()


def score_paddle(cr, x, y, n, color, k=1.0):
    """A judge's paddle, raised."""
    if k <= 0:
        return
    cr.save()
    cr.translate(x, y + (1 - ease_out(k)) * 60)
    cr.rotate(math.sin(k * 6) * 0.05)
    rrect(cr, -8, 0, 16, 66, 6)
    fill_stroke(cr, (0.55, 0.45, 0.32), 4.0)
    circle(cr, 0, -6, 40)
    fill_stroke(cr, (0.99, 0.97, 0.92), 5.0)
    text_at(cr, 0, 12, str(n), 44, color, "center")
    cr.restore()


# ------------------------------------------------ episode 4: after hours ---

NIGHT_WALL = (0.08, 0.09, 0.17)
DAY_WALL = (0.83, 0.86, 0.92)
NIGHT_FLOOR = (0.12, 0.11, 0.20)
DAY_FLOOR = (0.72, 0.70, 0.74)


def kitchen_night(cr, t, light=0.0, moon=1.0):
    """The kitchen after the humans have gone to bed."""
    wall = tuple(lerp(NIGHT_WALL[i], DAY_WALL[i], light) for i in range(3))
    floor = tuple(lerp(NIGHT_FLOOR[i], DAY_FLOOR[i], light) for i in range(3))
    set_rgb(cr, wall)
    cr.rectangle(0, 0, W, H)
    cr.fill()

    # window, with whatever is outside tonight
    rrect(cr, 86, 56, 350, 280, 10)
    fill_stroke(cr, tuple(lerp(0.06 + i * 0.02, 0.55 + i * 0.12, light)
                          for i in range(3)), 6.0,
                outline=(0.30, 0.26, 0.22))
    if moon > 0 and light < 0.6:
        circle(cr, 340, 130, 42)
        set_rgb(cr, (0.96, 0.95, 0.86), moon * (1 - light))
        cr.fill()
        for cx, cy, r in ((330, 120, 9), (352, 146, 6), (318, 148, 5)):
            circle(cr, cx, cy, r)
            set_rgb(cr, (0.85, 0.85, 0.78), moon * (1 - light))
            cr.fill()
        for i in range(16):
            x = 100 + rand01("star", i) * 320
            y = 70 + rand01("stary", i) * 240
            tw = 0.5 + 0.5 * math.sin(t * 2 + i)
            circle(cr, x, y, 2 + rand01("starr", i) * 2)
            set_rgb(cr, (1, 1, 1), moon * tw * 0.9 * (1 - light))
            cr.fill()
    for x in (261,):
        cr.move_to(x, 60)
        cr.line_to(x, 332)
        stroke_out(cr, 8.0, (0.34, 0.29, 0.24))
    cr.move_to(90, 196)
    cr.line_to(432, 196)
    stroke_out(cr, 8.0, (0.34, 0.29, 0.24))

    # wall cabinets
    for i in range(3):
        x = 600 + i * 224
        rrect(cr, x, 60, 208, 190, 10)
        fill_stroke(cr, tuple(lerp(0.20 + i * 0.0, 0.66, light)
                              for i in range(3)), 5.0,
                    outline=(0.08, 0.07, 0.13))
        rrect(cr, x + 92, 210, 26, 12, 5)
        fill_stroke(cr, (0.55, 0.55, 0.60), 3.5)
    # counter
    rrect(cr, 560, 332, W - 520, 34, 8)
    fill_stroke(cr, tuple(lerp(0.26 + i * 0.01, 0.78, light) for i in range(3)),
                5.0, outline=(0.08, 0.07, 0.13))

    # floor
    cr.rectangle(0, GROUND, W, H - GROUND)
    set_rgb(cr, floor)
    cr.fill()
    cr.move_to(0, GROUND)
    cr.line_to(W, GROUND)
    stroke_out(cr, 4.0, (0.07, 0.06, 0.12))
    for row in range(3):
        for col in range(9):
            if (row + col) % 2:
                continue
            y = GROUND + 4 + row * 58
            cr.rectangle(col * 150 - 40 + row * 18, y, 150, 58)
            set_rgb(cr, tuple(c * 0.82 for c in floor))
            cr.fill()


def cupboard(cr, x, y, open_k=0.0, light=0.0):
    """A floor cupboard, big enough to hide a mug."""
    rrect(cr, x - 130, y - 210, 260, 210, 10)
    fill_stroke(cr, tuple(lerp(0.22 + i * 0.01, 0.62, light) for i in range(3)),
                5.0, outline=(0.08, 0.07, 0.13))
    rrect(cr, x - 116, y - 196, 232, 182, 8)
    fill_stroke(cr, (0.10, 0.09, 0.15), 4.0)
    cr.save()
    cr.translate(x - 116, y - 196)
    cr.scale(max(0.02, 1 - open_k * 0.86), 1.0)
    rrect(cr, 0, 0, 232, 182, 8)
    fill_stroke(cr, tuple(lerp(0.26 + i * 0.01, 0.70, light) for i in range(3)),
                5.0, outline=(0.08, 0.07, 0.13))
    cr.restore()
    circle(cr, x + 96 - open_k * 180, y - 104, 8)
    fill_stroke(cr, (0.60, 0.60, 0.66), 3.5)


def whisk(cr, x, y, s=1.0, rot=0.0):
    """A whisk.  In the dark, arguably claws."""
    cr.save()
    cr.translate(x, y)
    cr.rotate(rot)
    cr.scale(s, s)
    rrect(cr, -9, 10, 18, 70, 8)
    fill_stroke(cr, (0.42, 0.40, 0.46), 4.0)
    for i in range(5):
        a = -1.5 + i * 0.42
        cr.new_path()
        cr.move_to(0, 12)
        cr.curve_to(math.cos(a) * 40, -18, math.cos(a) * 44, -52, 0, -76)
        stroke_out(cr, 5.0, (0.72, 0.72, 0.78))
    cr.restore()


# ------------------------------------------------ episode 5: the machine ---

STEEL = (0.26, 0.31, 0.36)
STEEL_L = (0.34, 0.40, 0.46)
RACK = (0.68, 0.72, 0.78)


def steam(cr, x, y, t, k=1.0, seed="s", n=7, spread=90.0):
    """Puffs that rise and fade."""
    if k <= 0:
        return
    for i in range(n):
        ph = (t * 0.5 + rand01(seed, i)) % 1.0
        r = 16 + ph * 40
        cx = x + (rand01(seed, i, "x") - 0.5) * spread + math.sin(t + i) * 12
        cy = y - ph * 190
        circle(cr, cx, cy, r)
        set_rgb(cr, (1, 1, 1), (1 - ph) * 0.30 * k)
        cr.fill()


def bubbles(cr, t, n=26, seed="b", k=1.0):
    if k <= 0:
        return
    for i in range(n):
        ph = (t * (0.20 + rand01(seed, i) * 0.25) + rand01(seed, i, "o")) % 1.0
        x = rand01(seed, i, "x") * W + math.sin(t * 2 + i) * 18
        y = H - ph * (H + 80)
        r = 5 + rand01(seed, i, "r") * 13
        circle(cr, x, y, r)
        set_rgb(cr, (1, 1, 1), 0.16 * k * (1 - ph * 0.5))
        cr.fill_preserve()
        set_rgb(cr, (1, 1, 1), 0.35 * k * (1 - ph * 0.5))
        cr.set_line_width(2)
        cr.stroke()


def dishwasher_front(cr, x, y, s=1.0, door_k=0.0, t=0.0, glow=0.0):
    """The machine, from the kitchen side.  The door drops open."""
    if s <= 0.002:
        return
    cr.save()
    cr.translate(x, y)
    cr.scale(s, s)
    rrect(cr, -150, -230, 300, 230, 14)
    fill_stroke(cr, (0.62, 0.65, 0.71), 5.5)
    rrect(cr, -126, -212, 252, 40, 9)
    fill_stroke(cr, (0.34, 0.38, 0.45), 4.5)
    for i in range(3):
        circle(cr, -70 + i * 70, -192, 9)
        fill_stroke(cr, (0.55, 0.80, 0.95) if i == 1 and glow > 0.5
                    else (0.75, 0.78, 0.82), 3.0)
    # cavity
    rrect(cr, -128, -164, 256, 150, 10)
    fill_stroke(cr, STEEL, 4.5)
    if door_k > 0.05:
        for i in range(2):
            yy = -140 + i * 62
            cr.move_to(-116, yy)
            cr.line_to(116, yy)
            stroke_out(cr, 4.0, RACK)
    # the door, hinged at the bottom
    cr.save()
    cr.translate(0, -8)
    cr.rotate(door_k * 1.45)
    rrect(cr, -140, -156, 280, 156, 10)
    fill_stroke(cr, (0.72, 0.75, 0.80), 5.0)
    rrect(cr, -104, -132, 208, 74, 8)
    fill_stroke(cr, (0.24, 0.34, 0.44), 4.5)
    circle(cr, 0, -95, 26)
    fill_stroke(cr, (0.50, 0.76, 0.90), 4.0)
    set_rgb(cr, (1, 1, 1), 0.45 + 0.25 * math.sin(t * 3))
    cr.arc(0, -95, 17, 0, math.tau)
    cr.fill()
    rrect(cr, -86, -34, 172, 15, 7)
    fill_stroke(cr, (0.42, 0.45, 0.52), 4.0)
    cr.restore()
    cr.restore()


def dishwasher_inside(cr, t, water=0.0, spray=0.0, steam_k=0.0, light=1.0):
    """Inside the machine, mid-cycle."""
    set_rgb(cr, tuple(c * (0.45 + 0.55 * light) for c in STEEL))
    cr.rectangle(0, 0, W, H)
    cr.fill()
    for i in range(11):
        x = 40 + i * 120
        cr.move_to(x, 0)
        cr.line_to(x, H)
        set_rgb(cr, STEEL_L, 0.5 * light)
        cr.set_line_width(10)
        cr.stroke()
    # upper rack
    cr.move_to(0, 268)
    cr.line_to(W, 268)
    stroke_out(cr, 7.0, RACK)
    for i in range(22):
        x = 20 + i * 60
        cr.move_to(x, 268)
        cr.line_to(x, 236)
        stroke_out(cr, 5.0, RACK)
    # lower rack, the floor of the scene
    cr.move_to(0, GROUND + 6)
    cr.line_to(W, GROUND + 6)
    stroke_out(cr, 8.0, RACK)
    for i in range(26):
        x = 10 + i * 50
        cr.move_to(x, GROUND + 6)
        cr.line_to(x, GROUND - 26)
        stroke_out(cr, 5.0, (0.58, 0.62, 0.68))
    # spray arm, below the rack
    cr.save()
    cr.translate(640, GROUND + 96)
    cr.rotate(t * 3.4)
    rrect(cr, -190, -11, 380, 22, 10)
    fill_stroke(cr, (0.52, 0.56, 0.62), 4.5)
    cr.restore()
    if spray > 0:
        for i in range(16):
            a = i / 16 * math.tau + t * 3.4
            x0 = 640 + math.cos(a) * 60
            y0 = GROUND + 96 + math.sin(a) * 22
            cr.move_to(x0, y0)
            cr.line_to(640 + math.cos(a) * 520, GROUND + 96 - 420 -
                       math.sin(a) * 60)
            set_rgb(cr, (0.80, 0.92, 1.0), 0.20 * spray)
            cr.set_line_width(5)
            cr.stroke()
    if water > 0:
        wy = GROUND + 60 - water * 420
        cr.new_path()
        cr.move_to(0, H)
        cr.line_to(0, wy)
        for i in range(0, W + 40, 40):
            cr.curve_to(i + 10, wy - 8 + math.sin(t * 3 + i) * 6,
                        i + 30, wy + 8 + math.cos(t * 3 + i) * 6,
                        i + 40, wy + math.sin(t * 2 + i) * 4)
        cr.line_to(W, H)
        cr.close_path()
        set_rgb(cr, (0.42, 0.70, 0.88), 0.45)
        cr.fill()
    bubbles(cr, t, 26, k=max(spray, water))
    if steam_k > 0:
        steam(cr, 640, GROUND - 40, t, steam_k, "in", 10, 900)
