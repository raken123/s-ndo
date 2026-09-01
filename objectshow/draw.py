"""Drawing primitives for the Odds & Ends object show.

Everything is vector art on a cairo context: flat fills, thick dark outlines,
rounded caps.  The house style is one colour per shape plus a 5px outline.
"""

import math

W, H = 1280, 720
GROUND = 548.0
OUTLINE = (0.13, 0.12, 0.16)


# ---------------------------------------------------------------- easing ---

def lerp(a, b, t):
    return a + (b - a) * t


def clamp(x, lo=0.0, hi=1.0):
    return lo if x < lo else hi if x > hi else x


def ease_in_out(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in(t):
    t = clamp(t)
    return t ** 3


def ease_back(t):
    """Overshoot slightly, then settle -- the object-show arrival pop."""
    t = clamp(t)
    c = 1.9
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


def bounce(t):
    """0 -> 1 with a couple of decaying bounces."""
    t = clamp(t)
    return 1 - abs(math.cos(t * math.pi * 2.5)) * (1 - t) ** 1.4


def wobble(t, freq=6.0, decay=3.0):
    return math.sin(t * freq * math.tau) * math.exp(-t * decay)


def rand01(*seed):
    """Deterministic pseudo-random in [0,1) from any hashable seed."""
    h = 0
    for s in seed:
        h = (h * 1000003 + hash(s)) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 1274126177) & 0xFFFFFFFF
    return ((h >> 8) & 0xFFFFFF) / float(0x1000000)


# ------------------------------------------------------------- primitives ---

def set_rgb(cr, c, a=1.0):
    if a >= 1.0:
        cr.set_source_rgb(*c)
    else:
        cr.set_source_rgba(c[0], c[1], c[2], a)


def stroke_out(cr, width=5.0, color=OUTLINE, alpha=1.0):
    set_rgb(cr, color, alpha)
    cr.set_line_width(width)
    cr.set_line_join(1)   # round
    cr.set_line_cap(1)    # round
    cr.stroke()


def fill_stroke(cr, fill, width=5.0, alpha=1.0, outline=OUTLINE):
    set_rgb(cr, fill, alpha)
    cr.fill_preserve()
    stroke_out(cr, width, outline, alpha)


def rrect(cr, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    cr.new_sub_path()
    cr.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    cr.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    cr.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    cr.arc(x + r, y + r, r, math.pi, 1.5 * math.pi)
    cr.close_path()


def ellipse(cr, cx, cy, rx, ry):
    cr.save()
    cr.translate(cx, cy)
    cr.scale(max(rx, 0.001), max(ry, 0.001))
    cr.arc(0, 0, 1, 0, math.tau)
    cr.restore()


def circle(cr, cx, cy, r):
    cr.new_sub_path()
    cr.arc(cx, cy, r, 0, math.tau)


def curve_through(cr, pts):
    """Smooth-ish polyline: straight segments are fine at these widths."""
    cr.move_to(*pts[0])
    for p in pts[1:]:
        cr.line_to(*p)


def limb(cr, pts, width=6.0, color=OUTLINE):
    """A noodle arm or leg: a stroked path with round caps."""
    cr.new_path()
    if len(pts) == 3:
        (x0, y0), (x1, y1), (x2, y2) = pts
        cr.move_to(x0, y0)
        # quadratic through the middle point, expressed as a cubic
        cr.curve_to(x0 + 2.0 / 3 * (x1 - x0), y0 + 2.0 / 3 * (y1 - y0),
                    x2 + 2.0 / 3 * (x1 - x2), y2 + 2.0 / 3 * (y1 - y2), x2, y2)
    else:
        curve_through(cr, pts)
    stroke_out(cr, width, color)


# ------------------------------------------------------------------ text ---

def font(cr, size, bold=True, family="DejaVu Sans"):
    cr.select_font_face(family, 0, 1 if bold else 0)
    cr.set_font_size(size)


def text_w(cr, s):
    return cr.text_extents(s)[4]


def text_at(cr, x, y, s, size, color=(1, 1, 1), align="left", bold=True,
            outline=None, outline_w=6.0, alpha=1.0):
    font(cr, size, bold)
    w = text_w(cr, s)
    if align == "center":
        x -= w / 2
    elif align == "right":
        x -= w
    if outline is not None:
        cr.move_to(x, y)
        cr.text_path(s)
        set_rgb(cr, outline, alpha)
        cr.set_line_width(outline_w)
        cr.set_line_join(1)
        cr.stroke()
    cr.move_to(x, y)
    set_rgb(cr, color, alpha)
    cr.show_text(s)
    return w


def wrap(cr, s, size, max_w, bold=True):
    font(cr, size, bold)
    words, lines, cur = s.split(), [], ""
    for wd in words:
        trial = (cur + " " + wd).strip()
        if text_w(cr, trial) > max_w and cur:
            lines.append(cur)
            cur = wd
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines
