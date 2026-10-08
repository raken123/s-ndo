"""Renders the Chargamo robot story as an animated 16:9 MP4 (frames + synthesized soundtrack)."""
import math
import random
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1]
W, H = 1920, 1080          # drawing canvas
OW, OH = 1280, 720         # output size
FPS = 24
SR = 44100

FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
F_SUB = ImageFont.truetype(FONT_B, 50)
F_TITLE = ImageFont.truetype(FONT_B, 150)
F_SMALL = ImageFont.truetype(FONT_R, 44)

BLUE = (30, 123, 255)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


# ---------------------------------------------------------------- robot sprite

def robot_sprite(s, glow=0.0, phone=0.0, eyes=0.0, sad=0.0):
    """The Chargamo cube: grey two-tier aluminium block with a black magnetic puck on top.
    phone: 0..1 how far the phone has been placed; eyes: 0..1 how open the blue eyes are."""
    w = int(s)
    d = int(s * 0.32)
    h = int(s * 1.22)
    pw, ph = int(s * 0.62), int(s * 1.1)
    cw, chh = w + d + 40, h + d + ph + 80
    img = Image.new("RGBA", (cw, chh), (0, 0, 0, 0))
    g = ImageDraw.Draw(img)
    x0 = 20
    ybot = chh - 20
    ytop = ybot - h
    # side face
    g.polygon([(x0 + w, ytop), (x0 + w + d, ytop - d * 0.5), (x0 + w + d, ybot - d * 0.5), (x0 + w, ybot)],
              fill=(112, 116, 122, 255))
    # front face with a soft vertical gradient
    for i in range(h):
        c = mix((176, 180, 186), (128, 132, 138), i / h)
        g.line([(x0, ytop + i), (x0 + w, ytop + i)], fill=c + (255,))
    # seam between the two tiers, slightly twisted like the real one
    seam = ytop + h * 0.52
    g.line([(x0, seam), (x0 + w, seam + 4)], fill=(95, 98, 104, 255), width=4)
    g.line([(x0 + w, seam + 4), (x0 + w + d, seam - d * 0.5)], fill=(80, 82, 88, 255), width=4)
    # diagonal fold line like in the photo
    g.line([(x0 + w * 0.12, ytop + h * 0.15), (x0 + w * 0.3, seam)], fill=(150, 154, 160, 255), width=3)
    # top: silver rim with black recess
    top = [(x0, ytop), (x0 + w, ytop), (x0 + w + d, ytop - d * 0.5), (x0 + d, ytop - d * 0.5)]
    g.polygon(top, fill=(190, 194, 200, 255))
    inset = 10
    g.polygon([(x0 + inset, ytop - 3), (x0 + w - inset * 0.3, ytop - 3),
               (x0 + w + d - inset, ytop - d * 0.5 + 4), (x0 + d + inset * 0.4, ytop - d * 0.5 + 4)],
              fill=(14, 14, 16, 255))
    # puck
    pcx, pcy = x0 + (w + d) / 2, ytop - d * 0.25
    prx, pry = w * 0.36, d * 0.36
    g.ellipse([pcx - prx, pcy - pry + 6, pcx + prx, pcy + pry + 6], fill=(60, 62, 66, 255))
    g.ellipse([pcx - prx, pcy - pry, pcx + prx, pcy + pry], fill=(150, 152, 158, 255))
    g.ellipse([pcx - prx + 5, pcy - pry + 3, pcx + prx - 5, pcy + pry - 3], fill=(18, 18, 20, 255))
    # logo: two little triangles, faintly glowing
    lc = mix((200, 200, 205), BLUE, glow)
    lx, ly, ls = pcx, pcy, s * 0.05
    g.polygon([(lx - ls, ly - ls * 0.6), (lx - ls * 0.15, ly), (lx - ls, ly + ls * 0.6)], fill=lc + (255,))
    g.polygon([(lx + ls, ly - ls * 0.6), (lx + ls * 0.15, ly), (lx + ls, ly + ls * 0.6)], fill=lc + (255,))
    if glow > 0:
        halo = Image.new("RGBA", img.size, (0, 0, 0, 0))
        hd = ImageDraw.Draw(halo)
        r = s * 0.12
        hd.ellipse([lx - r, ly - r, lx + r, ly + r], fill=BLUE + (int(160 * glow),))
        halo = halo.filter(ImageFilter.GaussianBlur(s * 0.06))
        img = Image.alpha_composite(halo, img)
        g = ImageDraw.Draw(img)
    # the phone, standing on the puck like a face
    if phone > 0:
        py_target = pcy - ph + 10
        py = lerp(py_target - s * 0.9, py_target, ease(phone))
        alpha = int(255 * clamp(phone * 3))
        px = pcx - pw / 2
        g.rounded_rectangle([px, py, px + pw, py + ph], radius=int(s * 0.07), fill=(40, 42, 46, alpha))
        g.rounded_rectangle([px + 7, py + 7, px + pw - 7, py + ph - 7], radius=int(s * 0.06), fill=(0, 0, 0, alpha))
        if eyes > 0:
            es = pw * 0.24
            gap = pw * 0.12
            ecy = py + ph * 0.45
            eh = max(es * eyes, es * 0.06)
            for ex in (pcx - gap / 2 - es, pcx + gap / 2):
                g.rectangle([ex, ecy - eh / 2, ex + es, ecy + eh / 2], fill=BLUE + (255,))
    return img


def paste_robot(frame, cx, by, s, angle=0.0, **kw):
    spr = robot_sprite(s, **kw)
    if angle:
        spr = spr.rotate(angle, resample=Image.BICUBIC, expand=True)
    frame.alpha_composite(spr, (int(cx - spr.width / 2), int(by - spr.height + 20)))


# ---------------------------------------------------------------- people

def person(d, x, ground, h, body, phase=0.0, walk=0.0, facing=1, cap=False, kneel=0.0,
           arms=None, skin=(232, 190, 160), hair=(60, 40, 30), legs=(40, 44, 56)):
    """Flat cartoon person. walk 0..1 = stride amount, kneel 0..1, arms=(left_angle,right_angle) in deg from down."""
    head_r = h * 0.075
    leg_len = h * 0.45
    torso_h = h * 0.33
    drop = kneel * leg_len * 0.45
    hip = (x, ground - leg_len + drop)
    sw = math.sin(phase) * 28 * walk
    lw = max(6, int(h * 0.05))
    for k, sgn in ((0, 1), (1, -1)):
        a = math.radians(sw * sgn)
        if kneel > 0 and k == 0:
            knee = (hip[0] + facing * leg_len * 0.45, hip[1] + leg_len * 0.1)
            foot = (knee[0], ground)
            d.line([hip, knee, foot], fill=legs, width=lw, joint="curve")
            continue
        knee = (hip[0] + math.sin(a) * leg_len * 0.5, hip[1] + math.cos(a) * leg_len * 0.5)
        foot = (hip[0] + math.sin(a) * leg_len * (1 - kneel * 0.5), ground)
        d.line([hip, knee, foot], fill=legs, width=lw, joint="curve")
        d.ellipse([foot[0] - lw * 0.6 + facing * 6, foot[1] - lw * 0.5, foot[0] + lw * 1.4 * facing + (lw * 0.6 if facing < 0 else 0), foot[1] + lw * 0.4], fill=(25, 25, 28))
    top = hip[1] - torso_h
    tw = h * 0.16
    d.rounded_rectangle([x - tw / 2, top, x + tw / 2, hip[1] + h * 0.03], radius=int(tw * 0.35), fill=body)
    shoulder = (x, top + h * 0.04)
    if arms is None:
        arms = (-sw * 0.9, sw * 0.9)
    for ang in arms:
        a = math.radians(ang)
        hand = (shoulder[0] + math.sin(a) * h * 0.3 * facing, shoulder[1] + math.cos(a) * h * 0.3)
        elbow = ((shoulder[0] + hand[0]) / 2 + facing * 4, (shoulder[1] + hand[1]) / 2)
        d.line([shoulder, elbow, hand], fill=body, width=int(lw * 0.85), joint="curve")
        d.ellipse([hand[0] - lw * 0.55, hand[1] - lw * 0.55, hand[0] + lw * 0.55, hand[1] + lw * 0.55], fill=skin)
    hc = (x + facing * 3, top - head_r * 1.05)
    d.ellipse([hc[0] - head_r, hc[1] - head_r, hc[0] + head_r, hc[1] + head_r], fill=skin)
    if cap:
        d.chord([hc[0] - head_r * 1.05, hc[1] - head_r * 1.15, hc[0] + head_r * 1.05, hc[1] + head_r * 0.6], 180, 360, fill=(20, 26, 48))
        d.rectangle([hc[0] - head_r * 1.05, hc[1] - head_r * 0.3, hc[0] + head_r * 1.05, hc[1] - head_r * 0.12], fill=(20, 26, 48))
        d.polygon([(hc[0] + facing * head_r * 0.6, hc[1] - head_r * 0.25), (hc[0] + facing * head_r * 1.7, hc[1] - head_r * 0.12),
                   (hc[0] + facing * head_r * 0.6, hc[1] - head_r * 0.05)], fill=(20, 26, 48))
        d.ellipse([x - tw * 0.32, top + h * 0.05, x - tw * 0.12, top + h * 0.08], fill=(240, 200, 60))
    else:
        d.chord([hc[0] - head_r, hc[1] - head_r * 1.05, hc[0] + head_r, hc[1] + head_r * 0.5], 180, 360, fill=hair)
    ex = hc[0] + facing * head_r * 0.45
    d.ellipse([ex - 3, hc[1] - 4, ex + 3, hc[1] + 2], fill=(30, 30, 30))
    return hc


def man_hands(x, ground, h, kneel=0.0, facing=1):
    """Where the man holds the robot (in front of the chest)."""
    leg_len = h * 0.45
    drop = kneel * leg_len * 0.45
    hip_y = ground - leg_len + drop
    return x + facing * h * 0.2, hip_y - h * 0.12


# ---------------------------------------------------------------- backgrounds

rng = random.Random(7)
BUILDINGS = []
xx = -40
while xx < W + 40:
    bw = rng.randint(160, 300)
    bh = rng.randint(330, 700)
    wins = [(rng.random() < 0.35) for _ in range(200)]
    BUILDINGS.append((xx, bw, bh, wins))
    xx += bw + rng.randint(6, 30)
RAIN = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(900, 1400)) for _ in range(260)]
GROUND = 880


def street(t, rain=1.0):
    img = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(GROUND):
        d.line([(0, y), (W, y)], fill=mix((10, 14, 32), (36, 40, 66), y / GROUND))
    for bx, bw, bh, wins in BUILDINGS:
        top = GROUND - 120 - bh
        d.rectangle([bx, top, bx + bw, GROUND], fill=(22, 25, 40))
        i = 0
        for wy in range(int(top + 30), GROUND - 160, 70):
            for wx in range(int(bx + 22), int(bx + bw - 40), 55):
                if wins[i % len(wins)]:
                    d.rectangle([wx, wy, wx + 26, wy + 36], fill=(232, 196, 110))
                i += 1
    d.rectangle([0, GROUND, W, H], fill=(48, 50, 58))
    d.rectangle([0, GROUND, W, GROUND + 14], fill=(90, 92, 100))
    for k in range(0, W, 220):
        d.line([(k, GROUND + 14), (k + 40, H)], fill=(58, 60, 68), width=3)
    # street lamp with a light cone over the robot
    lx = 1180
    d.rectangle([lx - 9, 300, lx + 9, GROUND], fill=(30, 32, 40))
    d.line([(lx, 300), (lx - 120, 280)], fill=(30, 32, 40), width=14)
    cone = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cone)
    cd.polygon([(lx - 150, 290), (lx - 100, 290), (lx + 90, GROUND + 40), (lx - 360, GROUND + 40)], fill=(255, 220, 140, 46))
    cone = cone.filter(ImageFilter.GaussianBlur(18))
    img.alpha_composite(cone)
    d = ImageDraw.Draw(img)
    d.ellipse([lx - 160, 270, lx - 90, 300], fill=(255, 230, 160))
    if rain > 0:
        for rx, ry, sp in RAIN:
            y = (ry + t * sp) % H
            x = (rx - t * sp * 0.12) % W
            d.line([(x, y), (x - 6, y + 34)], fill=(160, 170, 200, int(110 * rain)), width=2)
    return img


def home(t, door=0.0, lamp=1.0):
    img = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(img)
    floor = 900
    for y in range(floor):
        d.line([(0, y), (W, y)], fill=mix((92, 72, 64), (128, 98, 82), y / floor))
    d.rectangle([0, floor, W, H], fill=(84, 58, 44))
    for k in range(0, W, 160):
        d.line([(k, floor), (k - 80, H)], fill=(74, 50, 38), width=3)
    # window with night city
    d.rectangle([1260, 180, 1700, 560], fill=(16, 22, 46))
    for i in range(14):
        wx = 1280 + (i * 37) % 400
        wy = 420 + (i * 53) % 120
        d.rectangle([wx, wy, wx + 12, wy + 16], fill=(230, 190, 110))
    d.rectangle([1250, 170, 1710, 570], outline=(240, 236, 228), width=14)
    d.line([(1480, 170), (1480, 570)], fill=(240, 236, 228), width=10)
    # door on the left, opening
    dx0, dy0, dx1 = 120, 300, 420
    d.rectangle([dx0 - 14, dy0 - 14, dx1 + 14, floor], fill=(60, 44, 36))
    d.rectangle([dx0, dy0, dx1, floor], fill=(20, 18, 22))
    leaf = lerp(dx1, dx0 + 40, ease(door))
    d.polygon([(dx0, dy0), (leaf, dy0 + 30 * ease(door)), (leaf, floor - 30 * ease(door)), (dx0, floor)], fill=(150, 104, 70))
    d.ellipse([leaf - 34, 610, leaf - 14, 630], fill=(220, 190, 90))
    # desk with monitor and lamp
    d.rectangle([900, 640, 1820, 680], fill=(70, 46, 32))
    d.rectangle([930, 680, 960, floor], fill=(60, 40, 28))
    d.rectangle([1760, 680, 1790, floor], fill=(60, 40, 28))
    d.rectangle([1480, 380, 1800, 590], fill=(26, 28, 34))
    d.rectangle([1494, 394, 1786, 576], fill=(40, 90, 150))
    for i in range(7):
        d.line([(1514, 414 + i * 22), (1514 + 60 + (i * 47) % 180, 414 + i * 22)], fill=(150, 220, 170), width=6)
    d.rectangle([1630, 590, 1650, 640], fill=(26, 28, 34))
    d.line([(980, 640), (1010, 470), (1080, 440)], fill=(40, 40, 44), width=10)
    d.polygon([(1060, 420), (1130, 440), (1100, 480)], fill=(40, 40, 44))
    if lamp > 0:
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.polygon([(1090, 460), (1120, 470), (1400, 650), (1000, 650)], fill=(255, 220, 150, int(70 * lamp)))
        glow = glow.filter(ImageFilter.GaussianBlur(24))
        img.alpha_composite(glow)
    return img


# ---------------------------------------------------------------- subtitles & finishing

def subtitle(img, text, a):
    if not text or a <= 0:
        return
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    lines = text.split("\n")
    lh = 64
    boxh = lh * len(lines) + 40
    widths = [d.textlength(s, font=F_SUB) for s in lines]
    bw = max(widths) + 80
    y0 = H - boxh - 46
    d.rounded_rectangle([(W - bw) / 2, y0, (W + bw) / 2, y0 + boxh], radius=24, fill=(0, 0, 0, int(165 * a)))
    for i, s in enumerate(lines):
        d.text(((W - widths[i]) / 2, y0 + 20 + i * lh), s, font=F_SUB, fill=(255, 255, 255, int(255 * a)))
    img.alpha_composite(layer)


# Each scene: (duration, draw(t) -> RGBA, subtitles [(start, end, text)], zoom (start, end, cx, cy))
SCENES = []


def scene(duration, subs, zoom=(1.0, 1.06, 0.5, 0.55)):
    def deco(fn):
        SCENES.append((duration, fn, subs, zoom))
        return fn
    return deco


ROBOT_X = 1060


@scene(10.0, [(0.6, 4.8, "Den stod ensam på gatan.\nHelt ensam. Och ledsen."),
              (5.2, 9.6, "Folk gick förbi. Ingen sa ens hej –\nden var ju bara en robot.")])
def s_alone(t):
    img = street(t)
    d = ImageDraw.Draw(img)
    for i, (spd, h, col, start) in enumerate([(260, 330, (70, 74, 96), -300), (200, 310, (88, 70, 80), W + 200),
                                               (320, 340, (60, 80, 90), -900)]):
        facing = 1 if i != 1 else -1
        x = start + facing * spd * t
        person(d, x, GROUND + 8, h, col, phase=t * 7 + i, walk=1, facing=facing, skin=(120, 110, 110), hair=(30, 30, 34),
               legs=(30, 32, 40))
    paste_robot(img, ROBOT_X, GROUND + 6, 120, glow=0.1)
    return img


@scene(9.0, [(0.4, 4.3, "Men en man stannade.\nHan jobbade med datateknik."),
             (4.6, 8.8, "Han visste hur det är\natt vara en robot.")])
def s_man_stops(t):
    img = street(t, rain=0.7)
    d = ImageDraw.Draw(img)
    x = lerp(-150, ROBOT_X - 170, ease(t / 3.6))
    walking = 1 - ease((t - 3.2) / 0.6)
    kneel = ease((t - 4.4) / 1.2)
    person(d, x, GROUND + 8, 380, (32, 120, 130), phase=t * 7, walk=walking, facing=1, kneel=kneel,
           arms=(20 + 50 * kneel, -10 + 70 * kneel) if kneel > 0 else None)
    paste_robot(img, ROBOT_X, GROUND + 6, 120, glow=0.1 + 0.5 * ease((t - 5.5) / 2))
    return img


@scene(6.0, [(0.4, 5.6, "Han tog med den hem.")])
def s_carry(t):
    img = street(t, rain=0.5)
    d = ImageDraw.Draw(img)
    x = lerp(ROBOT_X - 200, W + 300, ease(t / 6.0) * 0.9 + t / 6 * 0.1)
    hc = person(d, x, GROUND + 8, 380, (32, 120, 130), phase=t * 6, walk=1, facing=1, arms=(80, 70))
    hx, hy = man_hands(x, GROUND + 8, 380)
    paste_robot(img, hx + 25, hy + 50, 95, glow=0.5)
    return img


@scene(7.0, [(0.5, 6.6, "Hemma fick den äntligen värme.")], zoom=(1.0, 1.08, 0.62, 0.55))
def s_home(t):
    img = home(t)
    d = ImageDraw.Draw(img)
    person(d, 760, 900, 400, (32, 120, 130), facing=1, arms=(40, 55))
    paste_robot(img, 1200, 646, 105, glow=0.55 + 0.1 * math.sin(t * 2))
    return img


@scene(10.0, [(0.3, 3.4, "Plötsligt sprang två vakter in."),
              (3.6, 6.4, "De blockerade honom…"),
              (6.6, 9.8, "…och höll nästan på att\nkasta roboten i golvet.")], zoom=(1.0, 1.03, 0.45, 0.55))
def s_guards(t):
    door = ease(t / 0.5)
    img = home(t, door=door)
    d = ImageDraw.Draw(img)
    shake = (math.sin(t * 60) * 6 * clamp(1 - t / 0.6)) if t < 0.6 else 0
    # guards run in from the door
    g1x = lerp(270, 980, ease((t - 0.4) / 2.2))
    g2x = lerp(270, 640, ease((t - 0.9) / 2.2))
    running1 = 1 - ease((t - 2.4) / 0.4)
    running2 = 1 - ease((t - 2.9) / 0.4)
    # man backs away a bit
    mx = lerp(1300, 1460, ease((t - 2.0) / 1.5))
    person(d, mx, 900, 400, (32, 120, 130), facing=-1, arms=(30, -30))
    person(d, g2x, 900, 410, (24, 34, 70), phase=t * 10, walk=running2, facing=1, cap=True, skin=(205, 160, 130),
           arms=(100, 100) if t > 3.2 else None)
    grab = ease((t - 4.0) / 1.0)
    person(d, g1x, 900, 420, (24, 34, 70), phase=t * 10 + 1, walk=running1, facing=1, cap=True, skin=(180, 140, 110),
           arms=(90 + 40 * grab, 60 + 60 * grab) if t > 3.0 else None)
    # robot: on the desk, then grabbed and tipped towards the floor
    if t < 4.0:
        paste_robot(img, 1200, 646, 105, glow=0.6)
    else:
        lift = ease((t - 4.0) / 1.2)
        tip = ease((t - 6.6) / 1.4)
        wobble = math.sin(t * 9) * 8 * tip
        rx = lerp(1200, g1x + 130, lift)
        ry = lerp(646, 560, lift) + tip * 140
        paste_robot(img, rx, ry, 105, angle=lerp(0, 55, tip) + wobble, glow=0.6 * (1 - tip))
    if shake:
        img = img.transform(img.size, Image.AFFINE, (1, 0, shake, 0, 1, 0))
    return img


@scene(6.0, [(0.3, 5.7, "Men han tog tillbaka den.")], zoom=(1.04, 1.0, 0.55, 0.55))
def s_rescue(t):
    img = home(t, door=1)
    d = ImageDraw.Draw(img)
    person(d, 640, 900, 410, (24, 34, 70), facing=1, cap=True, skin=(205, 160, 130), arms=(20, 20))
    person(d, 900, 900, 420, (24, 34, 70), facing=1, cap=True, skin=(180, 140, 110),
           arms=(lerp(130, 20, ease(t / 1.2)), lerp(120, 20, ease(t / 1.2))))
    mx = lerp(1460, 1180, ease(t / 1.2))
    person(d, mx, 900, 400, (32, 120, 130), facing=-1, arms=(80, 70))
    take = ease(t / 1.2)
    hx, hy = man_hands(mx, 900, 400, facing=-1)
    rx = lerp(1050, hx - 10, take)
    ry = lerp(700, hy + 50, take)
    paste_robot(img, rx, ry, 95, angle=lerp(55, 0, take), glow=0.3 + 0.4 * take)
    return img


@scene(14.0, [(0.4, 4.6, "”Ni ser bara en maskin.”"),
              (4.8, 9.2, "”Jag ser någon som jobbar dygnet runt,\nsom ingen tackar och ingen säger hej till.”"),
              (9.4, 13.8, "”Den känner kanske inte som vi –\nmen den förtjänar respekt.”")], zoom=(1.0, 1.1, 0.52, 0.5))
def s_speech(t):
    img = home(t, door=1)
    d = ImageDraw.Draw(img)
    leave = ease((t - 11.5) / 2.5)
    g1 = lerp(640, 250, leave)
    g2 = lerp(880, 330, leave)
    for gx, sk in ((g1, (205, 160, 130)), (g2, (180, 140, 110))):
        person(d, gx, 900, 410, (24, 34, 70), facing=1 if leave < 0.3 else -1, cap=True, skin=sk,
               walk=1 if 0.05 < leave < 0.98 else 0, phase=t * 8, arms=(10, 10) if leave < 0.05 else None)
    gest = math.sin(t * 2.3) * 25
    person(d, 1180, 900, 400, (32, 120, 130), facing=-1, arms=(80, 40 + gest))
    hx, hy = man_hands(1180, 900, 400, facing=-1)
    paste_robot(img, hx - 25, hy + 50, 95, glow=0.6 + 0.2 * math.sin(t * 3))
    return img


@scene(11.0, [(0.5, 4.5, "Han ställde sin mobil på roboten…"),
              (5.0, 10.6, "…och för första gången\nsåg roboten tillbaka.")], zoom=(1.0, 1.35, 0.62, 0.52))
def s_eyes(t):
    img = home(t, door=0)
    d = ImageDraw.Draw(img)
    person(d, 860, 900, 400, (32, 120, 130), facing=1, arms=(lerp(150, 40, ease((t - 1.5) / 1.5)), 40))
    phone = ease((t - 0.6) / 2.2)
    eyes = ease((t - 4.4) / 0.8)
    blink = 0.08 if (7.6 < t < 7.75) or (9.4 < t < 9.55) else 1
    paste_robot(img, 1200, 646, 115, glow=0.8, phone=phone, eyes=eyes * blink)
    return img


@scene(5.0, [], zoom=(1.0, 1.0, 0.5, 0.5))
def s_title(t):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    a = ease(t / 1.2)
    es, gap = 150, 90
    eh = max(es * ease((t - 0.3) / 0.6), 6)
    for ex in (W / 2 - gap / 2 - es, W / 2 + gap / 2):
        d.rectangle([ex, 380 - eh / 2, ex + es, 380 + eh / 2], fill=mix((0, 0, 0), BLUE, a))
    tw = d.textlength("CHARGAMO", font=F_TITLE)
    d.text(((W - tw) / 2, 560), "CHARGAMO", font=F_TITLE, fill=mix((0, 0, 0), (235, 240, 255), a))
    sub = "Säg hej till din robot."
    sw = d.textlength(sub, font=F_SMALL)
    d.text(((W - sw) / 2, 760), sub, font=F_SMALL, fill=mix((0, 0, 0), (150, 170, 210), ease((t - 1.0) / 1.2)))
    return img


def finish(img, t, dur, subs, zoom):
    z = lerp(zoom[0], zoom[1], ease(t / dur))
    cw, ch = W / z, H / z
    cx = clamp(zoom[2] * W, cw / 2, W - cw / 2)
    cy = clamp(zoom[3] * H, ch / 2, H - ch / 2)
    img = img.crop((int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))).resize((W, H), Image.BICUBIC)
    for s0, s1, text in subs:
        if s0 <= t <= s1:
            subtitle(img, text, min(ease((t - s0) / 0.35), ease((s1 - t) / 0.35)))
    fade = min(ease(t / 0.5), ease((dur - t) / 0.5))
    out = img.convert("RGB").resize((OW, OH), Image.LANCZOS)
    if fade < 1:
        out = Image.blend(Image.new("RGB", out.size), out, fade)
    return out


# ---------------------------------------------------------------- soundtrack

def note(f):
    return 440.0 * 2 ** ((f - 69) / 12)


def tone(freqs, dur, vol, attack=0.6, release=0.8, kind="pad"):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    sig = np.zeros(n)
    for f in freqs:
        if kind == "pad":
            sig += np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2 * tt + 0.3) + 0.12 * np.sin(2 * np.pi * f * 3 * tt)
        else:  # bell / piano-ish
            sig += (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt * 2.2)
    env = np.minimum(1, tt / max(attack, 1e-3)) * np.minimum(1, (dur - tt) / max(release, 1e-3))
    return sig * np.clip(env, 0, 1) * vol / max(1, len(freqs))


def add(buf, sig, at):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i]


def soundtrack(total, starts):
    buf = np.zeros(int(total * SR) + SR)
    rngn = np.random.default_rng(3)
    s = dict(zip(["alone", "stops", "carry", "home", "guards", "rescue", "speech", "eyes", "title"], starts))
    # rain over the street scenes
    rain_len = s["home"] - 0.0
    noise = rngn.normal(0, 1, int(rain_len * SR))
    kern = np.ones(9) / 9
    rain = np.convolve(noise, kern, mode="same") * 0.05
    env = np.ones_like(rain)
    fade = int(1.5 * SR)
    env[-fade:] = np.linspace(1, 0, fade)
    add(buf, rain * env, 0)
    # sad pad: Am F C G
    prog = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]]
    t0 = 0.0
    k = 0
    while t0 < s["guards"] - 0.5:
        add(buf, tone([note(m) for m in prog[k % 4]], 4.2, 0.10, 1.2, 1.4), t0)
        if k % 2 == 0:
            add(buf, tone([note(prog[k % 4][2] + 12)], 3.0, 0.06, 0.01, 2.0, kind="bell"), t0 + 1.0)
        t0 += 4.0
        k += 1
    # door bang and running footsteps
    bang_t = s["guards"] + 0.05
    nb = int(0.5 * SR)
    tb = np.arange(nb) / SR
    bang = (rngn.normal(0, 1, nb) * 0.5 + np.sin(2 * np.pi * 70 * tb)) * np.exp(-tb * 12) * 0.55
    add(buf, bang, bang_t)
    for i in range(14):
        nf = int(0.07 * SR)
        tf = np.arange(nf) / SR
        step = (rngn.normal(0, 1, nf) * 0.4 + np.sin(2 * np.pi * 110 * tf)) * np.exp(-tf * 60) * 0.35
        add(buf, step, bang_t + 0.5 + i * 0.19)
    # tension drone + heartbeat pulse
    add(buf, tone([note(40), note(47)], s["rescue"] - s["guards"] + 1, 0.16, 0.5, 1.0), s["guards"])
    for i in range(int((s["rescue"] - s["guards"]) / 0.75)):
        nh = int(0.12 * SR)
        th = np.arange(nh) / SR
        add(buf, np.sin(2 * np.pi * 55 * th) * np.exp(-th * 30) * 0.4, s["guards"] + 1.0 + i * 0.75)
    # warm resolve under the rescue and the speech: F C Am G
    prog2 = [[53, 57, 60], [48, 52, 55, 60], [57, 60, 64], [55, 59, 62]]
    t0 = s["rescue"]
    k = 0
    while t0 < s["eyes"] - 0.5:
        add(buf, tone([note(m) for m in prog2[k % 4]], 4.2, 0.10, 1.0, 1.4), t0)
        t0 += 4.0
        k += 1
    # bright ending: C G Am F with bells
    prog3 = [[48, 55, 64, 67], [55, 59, 62, 67], [57, 60, 64, 69], [53, 60, 65, 69]]
    t0 = s["eyes"]
    k = 0
    while t0 < total - 1:
        add(buf, tone([note(m) for m in prog3[k % 4]], 4.2, 0.11, 0.8, 1.4), t0)
        add(buf, tone([note(prog3[k % 4][-1] + 12)], 3.0, 0.07, 0.01, 2.0, kind="bell"), t0 + 0.5)
        t0 += 4.0
        k += 1
    # magnet click + boot chime when the eyes open
    nc = int(0.05 * SR)
    tc = np.arange(nc) / SR
    add(buf, np.sin(2 * np.pi * 1800 * tc) * np.exp(-tc * 120) * 0.4, s["eyes"] + 2.8)
    for i, m in enumerate([72, 76, 79, 84]):
        add(buf, tone([note(m)], 0.5, 0.18, 0.01, 0.4, kind="bell"), s["eyes"] + 4.4 + i * 0.11)
    # gentle fades
    fin = int(2.5 * SR)
    end = int(total * SR)
    buf[end - fin:end] *= np.linspace(1, 0, fin)
    buf[end:] = 0
    peak = np.max(np.abs(buf)) or 1
    buf = buf / peak * 0.8
    # tiny stereo width
    left = buf
    right = np.concatenate([np.zeros(200), buf[:-200]])
    return np.stack([left, right], axis=1)[:end]


def main():
    total = sum(sc[0] for sc in SCENES)
    starts, acc = [], 0.0
    for sc in SCENES:
        starts.append(acc)
        acc += sc[0]
    wav_path = OUT + ".wav"
    audio = soundtrack(total, starts)
    with wave.open(wav_path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((audio * 32767).astype(np.int16).tobytes())

    ff = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
        "-i", wav_path,
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT,
    ], stdin=subprocess.PIPE)
    n = 0
    for dur, fn, subs, zoom in SCENES:
        frames = int(round(dur * FPS))
        for i in range(frames):
            t = i / FPS
            ff.stdin.write(finish(fn(t), t, dur, subs, zoom).tobytes())
            n += 1
        print(f"{fn.__name__}: {frames} frames", flush=True)
    ff.stdin.close()
    ff.wait()
    print("frames", n, "seconds", total)


if __name__ == "__main__":
    main()
