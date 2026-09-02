"""The cast of Odds & Ends: seven objects, drawn from scratch every frame.

A character is drawn from a *pose* dict so scenes can push them around:

    x, y      feet position (y is the ground the character stands on)
    s         scale (1.0 == roughly 150px tall)
    rot       body rotation in radians
    sq        squash: >1 is stretched tall, <1 is squashed flat
    arm_l/r   arm angles in radians (0 == hanging down, +ve == raised out)
    step      walk-cycle phase; None keeps the legs planted
    expr      face expression key
    mouth     0..1 mouth openness (talking drives this)
    look      (dx, dy) pupil offset, -1..1
    flip      mirror horizontally
"""

import math

from draw import (OUTLINE, circle, ellipse, fill_stroke, limb, rand01, rrect,
                  set_rgb, stroke_out)


def pose(x, y, **kw):
    p = dict(x=x, y=y, s=1.0, rot=0.0, sq=1.0, arm_l=0.0, arm_r=0.0,
             step=None, expr="happy", mouth=0.0, look=(0.0, 0.0), flip=False,
             alpha=1.0, blink=None)
    p.update(kw)
    return p


# ------------------------------------------------------------------ face ---

def draw_eye(cr, cx, cy, r, look, lid):
    """lid: 0 open, 1 fully closed."""
    if lid > 0.85:
        cr.move_to(cx - r, cy)
        cr.line_to(cx + r, cy)
        stroke_out(cr, r * 0.5)
        return
    ry = r * (1 - lid)
    ellipse(cr, cx, cy, r, ry)
    fill_stroke(cr, (1, 1, 1), r * 0.34)
    px = cx + look[0] * r * 0.36
    py = cy + look[1] * ry * 0.36
    ellipse(cr, px, py, r * 0.46, min(ry * 0.62, r * 0.46))
    set_rgb(cr, OUTLINE)
    cr.fill()


def draw_face(cr, cx, cy, s, expr, mouth, look, lid):
    """Faces are BFDI-simple: two eyes and one expressive mouth."""
    eye_dx = 16 * s
    eye_r = 11 * s
    ey = cy
    brow = None

    if expr in ("angry", "furious"):
        brow = "angry"
    elif expr in ("worried", "sad"):
        brow = "sad"
    elif expr == "smug":
        brow = "smug"

    draw_eye(cr, cx - eye_dx, ey, eye_r, look, lid)
    draw_eye(cr, cx + eye_dx, ey, eye_r, look, lid)

    if brow == "angry":
        for sgn in (-1, 1):
            cr.move_to(cx + sgn * (eye_dx + eye_r * 0.9), ey - eye_r * 1.5)
            cr.line_to(cx + sgn * (eye_dx - eye_r * 0.7), ey - eye_r * 0.75)
            stroke_out(cr, 4.4 * s)
    elif brow == "sad":
        for sgn in (-1, 1):
            cr.move_to(cx + sgn * (eye_dx + eye_r * 0.9), ey - eye_r * 0.9)
            cr.line_to(cx + sgn * (eye_dx - eye_r * 0.7), ey - eye_r * 1.6)
            stroke_out(cr, 4.0 * s)
    elif brow == "smug":
        cr.move_to(cx - eye_dx - eye_r, ey - eye_r * 1.4)
        cr.line_to(cx - eye_dx + eye_r, ey - eye_r * 1.4)
        stroke_out(cr, 4.0 * s)

    my = cy + 24 * s
    open_h = 4 * s + mouth * 15 * s

    if expr in ("shock", "gasp"):
        ellipse(cr, cx, my + 2 * s, 9 * s, 11 * s + mouth * 5 * s)
        fill_stroke(cr, (0.22, 0.11, 0.14), 3.2 * s)
    elif mouth > 0.12:
        ellipse(cr, cx, my, 12 * s + mouth * 4 * s, open_h)
        fill_stroke(cr, (0.22, 0.11, 0.14), 3.2 * s)
    elif expr in ("sad", "worried", "angry", "furious"):
        cr.move_to(cx - 13 * s, my + 5 * s)
        cr.curve_to(cx - 5 * s, my - 4 * s, cx + 5 * s, my - 4 * s,
                    cx + 13 * s, my + 5 * s)
        stroke_out(cr, 4.0 * s)
    elif expr == "flat":
        cr.move_to(cx - 11 * s, my)
        cr.line_to(cx + 11 * s, my)
        stroke_out(cr, 4.0 * s)
    elif expr == "smug":
        cr.move_to(cx - 4 * s, my - 2 * s)
        cr.curve_to(cx + 4 * s, my + 7 * s, cx + 10 * s, my + 6 * s,
                    cx + 15 * s, my - 1 * s)
        stroke_out(cr, 4.0 * s)
    else:  # happy
        cr.move_to(cx - 15 * s, my - 4 * s)
        cr.curve_to(cx - 6 * s, my + 9 * s, cx + 6 * s, my + 9 * s,
                    cx + 15 * s, my - 4 * s)
        stroke_out(cr, 4.2 * s)


# ------------------------------------------------------------- character ---

class Char:
    """One contestant.  Subclasses draw the body; the rest is shared."""

    name = "?"
    color = (0.8, 0.8, 0.8)
    tag = (0.5, 0.5, 0.5)     # lower-third name-plate colour
    hw, hh = 46.0, 62.0       # half width / half height of the body
    face_y = 0.0              # face offset from body centre
    face_s = 1.0
    voice = dict(base=300.0, wave="square", rate=0.085, spread=1.0)
    blurb = ""

    # -- body, drawn in local space with the body centre at the origin -----
    def body(self, cr, t):
        raise NotImplementedError

    def arm_anchor(self):
        return self.hw * 0.92, -self.hh * 0.05

    def leg_anchor(self):
        return self.hw * 0.42, self.hh

    def draw(self, cr, p, t=0.0):
        s = p["s"]
        cr.save()
        cr.translate(p["x"], p["y"] - self.hh * s)
        cr.rotate(p["rot"])
        sq = p["sq"]
        cr.scale((1 / sq) ** 0.5 * (-1 if p["flip"] else 1), sq)
        cr.scale(s, s)

        ax, ay = self.arm_anchor()
        lx, ly = self.leg_anchor()
        step = p["step"]
        swing = 0.0 if step is None else math.sin(step) * 0.9

        # limbs go behind the body
        for sgn, ang in ((-1, p["arm_l"]), (1, p["arm_r"])):
            a = ang + (0.12 if step is None else -swing * sgn * 0.45)
            hx = sgn * ax
            ex = hx + sgn * math.cos(a - 0.6) * 40
            ey = ay + 44 - math.sin(a) * 44
            limb(cr, [(hx, ay), (hx + sgn * 22, ay + 26), (ex, ey)], 6.5)

        for sgn in (-1, 1):
            sw = swing * sgn
            fx = sgn * lx + sw * 22
            fy = ly + 34 - abs(sw) * 9
            limb(cr, [(sgn * lx, ly - 4), (sgn * lx + sw * 12, ly + 18),
                      (fx, fy)], 6.5)
            # foot
            cr.move_to(fx - 8, fy)
            cr.line_to(fx + 8, fy)
            stroke_out(cr, 7.0)

        self.body(cr, t)

        lid = p["blink"]
        if lid is None:
            # blink on a per-character rhythm
            period = 3.1 + rand01(self.name) * 2.4
            ph = (t + rand01(self.name, "o") * 5) % period
            lid = max(0.0, 1 - abs(ph - 0.08) / 0.11) if ph < 0.2 else 0.0
        draw_face(cr, 0, self.face_y, self.face_s, p["expr"], p["mouth"],
                  p["look"], lid)
        cr.restore()

    def top(self, p):
        """World-space y of the character's head -- used for stacking."""
        return p["y"] - self.hh * 2 * p["s"] * p["sq"]


class Mugsy(Char):
    name = "Mugsy"
    color = (0.97, 0.97, 0.99)
    tag = (0.31, 0.55, 0.86)
    hw, hh = 44.0, 54.0
    face_y = -4.0
    voice = dict(base=252.0, wave="tri", rate=0.088, spread=1.0)
    blurb = "a mug, 60% anxiety"

    def body(self, cr, t):
        cr.save()
        cr.new_path()
        cr.arc(self.hw + 6, -4, 32, -2.0, 2.0)
        cr.arc_negative(self.hw + 6, -4, 17, 2.0, -2.0)
        cr.close_path()
        fill_stroke(cr, self.color, 5.0)
        rrect(cr, -self.hw, -self.hh, self.hw * 2, self.hh * 2, 14)
        fill_stroke(cr, self.color, 5.0)
        cr.save()
        cr.rectangle(-self.hw, self.hh - 26, self.hw * 2, 15)
        cr.clip()
        rrect(cr, -self.hw, -self.hh, self.hw * 2, self.hh * 2, 14)
        set_rgb(cr, self.tag)
        cr.fill()
        cr.restore()
        cr.restore()


class Clip(Char):
    name = "Clip"
    color = (0.91, 0.27, 0.32)
    tag = (0.83, 0.21, 0.27)
    hw, hh = 42.0, 60.0
    face_y = 6.0
    face_s = 0.95
    voice = dict(base=430.0, wave="saw", rate=0.062, spread=1.3)
    blurb = "holds things together, loudly"

    def body(self, cr, t):
        # a paperclip: two nested open loops, stroked fat
        cr.set_line_cap(1)
        cr.set_line_join(1)
        for i, (w, h, extra, oy) in enumerate(((self.hw, self.hh, 26, 0),
                                               (self.hw * 0.46, self.hh * 0.50, 4, -22))):
            cr.save()
            cr.translate(0, oy)
            cr.new_path()
            cr.move_to(-w + 1, h - extra)
            cr.line_to(-w + 1, -h + w)
            cr.arc(0, -h + w, w, math.pi, 0)
            cr.line_to(w - 1, h - w)
            cr.arc(0, h - w, w, 0, math.pi)
            set_rgb(cr, OUTLINE)
            cr.set_line_width(15)
            cr.stroke_preserve()
            set_rgb(cr, self.color)
            cr.set_line_width(9)
            cr.stroke()
            cr.restore()


class Cone(Char):
    name = "Cone"
    color = (0.96, 0.51, 0.16)
    tag = (0.85, 0.42, 0.10)
    hw, hh = 52.0, 60.0
    face_y = 6.0
    voice = dict(base=190.0, wave="square", rate=0.10, spread=0.7)
    blurb = "reads the rules. all of them."

    def arm_anchor(self):
        return 34.0, 14.0

    def body(self, cr, t):
        cr.new_path()
        cr.move_to(-9, -self.hh)
        cr.curve_to(-4, -self.hh - 6, 4, -self.hh - 6, 9, -self.hh)
        cr.line_to(self.hw - 8, self.hh - 16)
        cr.line_to(-self.hw + 8, self.hh - 16)
        cr.close_path()
        fill_stroke(cr, self.color, 5.0)
        cr.save()
        cr.new_path()
        cr.move_to(-9, -self.hh)
        cr.line_to(9, -self.hh)
        cr.line_to(self.hw - 8, self.hh - 16)
        cr.line_to(-self.hw + 8, self.hh - 16)
        cr.close_path()
        cr.clip()
        cr.rectangle(-self.hw, -22, self.hw * 2, 17)
        set_rgb(cr, (0.99, 0.98, 0.95))
        cr.fill()
        cr.restore()
        rrect(cr, -self.hw, self.hh - 18, self.hw * 2, 18, 6)
        fill_stroke(cr, (0.88, 0.42, 0.12), 5.0)


class Sticky(Char):
    name = "Sticky"
    color = (0.99, 0.88, 0.36)
    tag = (0.85, 0.68, 0.11)
    hw, hh = 50.0, 50.0
    face_y = -2.0
    voice = dict(base=360.0, wave="sine", rate=0.075, spread=1.1)
    blurb = "remembers nothing, sticks to everything"

    def body(self, cr, t):
        cr.new_path()
        cr.move_to(-self.hw, -self.hh)
        cr.line_to(self.hw, -self.hh)
        cr.line_to(self.hw, self.hh - 20)
        cr.curve_to(self.hw - 14, self.hh + 4, -self.hw + 26, self.hh,
                    -self.hw, self.hh)
        cr.close_path()
        fill_stroke(cr, self.color, 5.0)
        set_rgb(cr, (0.80, 0.66, 0.20), 0.75)
        cr.set_line_width(3.0)
        for i in range(2):
            y = 20 + i * 13
            cr.move_to(-self.hw + 12, y)
            cr.line_to(self.hw - 22 - i * 8, y)
            cr.stroke()


class Volt(Char):
    name = "Volt"
    color = (0.31, 0.72, 0.36)
    tag = (0.20, 0.58, 0.27)
    hw, hh = 38.0, 60.0
    face_y = 2.0
    voice = dict(base=205.0, wave="saw", rate=0.070, spread=1.4)
    blurb = "9 volts of unearned confidence"

    def body(self, cr, t):
        rrect(cr, -14, -self.hh - 12, 28, 16, 5)
        fill_stroke(cr, (0.72, 0.72, 0.76), 4.5)
        rrect(cr, -self.hw, -self.hh, self.hw * 2, self.hh * 2, 10)
        fill_stroke(cr, self.color, 5.0)
        rrect(cr, -self.hw, self.hh - 22, self.hw * 2, 22, 9)
        fill_stroke(cr, (0.17, 0.17, 0.21), 4.5)
        cr.new_path()
        cr.move_to(-6, -52)
        cr.line_to(-26, -30)
        cr.line_to(-16, -30)
        cr.line_to(-24, -14)
        cr.line_to(-2, -38)
        cr.line_to(-14, -38)
        cr.close_path()
        fill_stroke(cr, (0.99, 0.92, 0.35), 3.2)


class Cube(Char):
    name = "Cube"
    color = (0.66, 0.87, 0.96)
    tag = (0.29, 0.62, 0.80)
    hw, hh = 48.0, 48.0
    face_y = 0.0
    voice = dict(base=290.0, wave="sine", rate=0.105, spread=0.8)
    blurb = "cool under pressure. melting otherwise."

    def body(self, cr, t):
        rrect(cr, -self.hw, -self.hh, self.hw * 2, self.hh * 2, 16)
        fill_stroke(cr, self.color, 5.0)
        set_rgb(cr, (1, 1, 1), 0.85)
        cr.set_line_width(7)
        cr.set_line_cap(1)
        cr.move_to(-self.hw + 14, -self.hh + 30)
        cr.line_to(-self.hw + 30, -self.hh + 14)
        cr.stroke()
        cr.move_to(-self.hw + 14, -self.hh + 46)
        cr.line_to(-self.hw + 46, -self.hh + 14)
        cr.stroke()


class Mega(Char):
    """The host: a megaphone with a microphone stand's confidence."""

    name = "Mega"
    color = (0.85, 0.24, 0.30)
    tag = (0.42, 0.30, 0.72)
    hw, hh = 52.0, 46.0
    face_y = 0.0
    face_s = 0.92
    voice = dict(base=168.0, wave="square", rate=0.078, spread=0.9)
    blurb = "your host, allegedly impartial"

    def arm_anchor(self):
        return 40.0, 0.0

    def body(self, cr, t):
        cr.new_path()
        cr.move_to(-self.hw - 26, -self.hh - 16)
        cr.line_to(-self.hw + 4, -self.hh + 8)
        cr.line_to(-self.hw + 4, self.hh - 8)
        cr.line_to(-self.hw - 26, self.hh + 16)
        cr.close_path()
        fill_stroke(cr, (0.93, 0.35, 0.38), 5.0)
        rrect(cr, -self.hw, -self.hh, self.hw * 2, self.hh * 2, 18)
        fill_stroke(cr, self.color, 5.0)
        rrect(cr, self.hw - 4, -16, 20, 34, 8)
        fill_stroke(cr, (0.25, 0.24, 0.30), 4.5)
        circle(cr, self.hw + 6, -self.hh + 8, 7)
        fill_stroke(cr, (1, 0.85, 0.3), 3.5)


class Spork(Char):
    """New for episode 5.  Two things at once, badly."""

    name = "Spork"
    color = (0.82, 0.84, 0.88)
    tag = (0.52, 0.56, 0.64)
    hw, hh = 32.0, 60.0
    face_y = -30.0
    face_s = 0.88
    voice = dict(base=395.0, wave="saw", rate=0.060, spread=1.35)
    blurb = "a fork and a spoon, at the same time"

    def arm_anchor(self):
        return 26.0, 10.0

    def body(self, cr, t):
        for dx in (-17, 0, 17):
            rrect(cr, dx - 5, -86, 10, 40, 5)
            fill_stroke(cr, self.color, 4.5)
        rrect(cr, -13, -34, 26, self.hh + 34, 11)
        fill_stroke(cr, self.color, 5.0)
        ellipse(cr, 0, -34, 30, 32)
        fill_stroke(cr, self.color, 5.0)


class Mitt(Char):
    """New for episode 5.  Warm, soft, alarmingly calm."""

    name = "Mitt"
    color = (0.90, 0.45, 0.40)
    tag = (0.78, 0.33, 0.30)
    hw, hh = 48.0, 56.0
    face_y = -10.0
    voice = dict(base=232.0, wave="sine", rate=0.096, spread=0.9)
    blurb = "has held worse than you"

    def body(self, cr, t):
        cr.new_path()
        cr.move_to(-self.hw + 6, self.hh - 12)
        cr.curve_to(-self.hw - 4, 6, -self.hw + 2, -self.hh,
                    -6, -self.hh + 2)
        cr.curve_to(28, -self.hh - 4, self.hw + 2, -22, self.hw - 4, 10)
        cr.curve_to(self.hw - 6, self.hh - 20, self.hw - 14, self.hh - 12,
                    self.hw - 18, self.hh - 12)
        cr.close_path()
        fill_stroke(cr, self.color, 5.0)
        # thumb
        cr.new_path()
        cr.move_to(-self.hw + 2, 4)
        cr.curve_to(-self.hw - 24, -2, -self.hw - 26, 34, -self.hw + 4, 30)
        cr.close_path()
        fill_stroke(cr, self.color, 5.0)
        rrect(cr, -self.hw + 2, self.hh - 22, self.hw * 2 - 20, 24, 8)
        fill_stroke(cr, (0.97, 0.94, 0.86), 4.5)


class Plate(Char):
    """New for episode 5.  Dishwasher safe, and never lets you forget it."""

    name = "Plate"
    color = (0.98, 0.98, 1.00)
    tag = (0.30, 0.52, 0.82)
    hw, hh = 56.0, 56.0
    face_y = 2.0
    face_s = 0.92
    voice = dict(base=322.0, wave="tri", rate=0.082, spread=1.0)
    blurb = "immaculate, and aware of it"

    def body(self, cr, t):
        circle(cr, 0, 0, self.hw)
        fill_stroke(cr, self.color, 5.0)
        circle(cr, 0, 0, self.hw - 9)
        set_rgb(cr, self.tag)
        cr.set_line_width(7)
        cr.stroke()
        circle(cr, 0, 0, self.hw - 22)
        set_rgb(cr, (0.90, 0.93, 0.98))
        cr.set_line_width(3)
        cr.stroke()


class Bin(Char):
    """Episode 4's late-night visitor.  Enormous, unhurried, blue."""

    name = "Bin"
    color = (0.30, 0.55, 0.78)
    tag = (0.22, 0.42, 0.62)
    hw, hh = 86.0, 100.0
    face_y = -2.0
    face_s = 1.45
    voice = dict(base=92.0, wave="square", rate=0.135, spread=0.5)
    blurb = "it is recycling night"

    def arm_anchor(self):
        return self.hw * 0.94, -self.hh * 0.10

    def leg_anchor(self):
        return self.hw * 0.44, self.hh

    def body(self, cr, t):
        cr.new_path()
        cr.move_to(-self.hw, -self.hh + 14)
        cr.line_to(self.hw, -self.hh + 14)
        cr.line_to(self.hw * 0.84, self.hh)
        cr.line_to(-self.hw * 0.84, self.hh)
        cr.close_path()
        fill_stroke(cr, self.color, 5.5)
        rrect(cr, -self.hw - 10, -self.hh - 6, self.hw * 2 + 20, 28, 9)
        fill_stroke(cr, (0.24, 0.44, 0.64), 5.0)
        rrect(cr, -24, -self.hh - 20, 48, 16, 7)
        fill_stroke(cr, (0.24, 0.44, 0.64), 4.5)
        # recycling arrows, low on the body
        cr.save()
        cr.translate(0, 62)
        for i in range(3):
            cr.save()
            cr.rotate(i * math.tau / 3)
            cr.new_path()
            cr.move_to(-14, -20)
            cr.line_to(10, -20)
            cr.line_to(10, -28)
            cr.line_to(24, -14)
            cr.line_to(10, 0)
            cr.line_to(10, -8)
            cr.line_to(-14, -8)
            cr.close_path()
            set_rgb(cr, (0.92, 0.96, 0.99), 0.9)
            cr.fill()
            cr.restore()
        cr.restore()


def hand_pos(ch, p, right=True):
    """World position of a character's hand -- for props they hold up.

    Mirrors the arm maths in Char.draw, so a prop placed here lands in the
    hand instead of floating next to it.
    """
    sgn = 1 if right else -1
    ax, ay = ch.arm_anchor()
    a = (p["arm_r"] if right else p["arm_l"]) + (0.12 if p["step"] is None
                                                 else 0.0)
    ex = sgn * ax + sgn * math.cos(a - 0.6) * 40
    ey = ay + 44 - math.sin(a) * 44
    s, sq = p["s"], p["sq"]
    fx = (1 / sq) ** 0.5 * (-1 if p["flip"] else 1)
    return p["x"] + s * fx * ex, p["y"] - ch.hh * s + s * sq * ey


CAST = {c.name: c() for c in (Mugsy, Clip, Cone, Sticky, Volt, Cube, Mega,
                              Bin, Spork, Mitt, Plate)}
CONTESTANTS = ["Mugsy", "Clip", "Cone", "Sticky", "Volt", "Cube"]
