"""gmfy 3.4.0 — five portrait teasers in the normal brand (violet/cyan).

One ad per headline 3.4.0 feature: the release itself, the ultra-big
third-person editor, invite codes, the new plans, and a build-to-play recap.
"""
import math
from PIL import Image, ImageDraw

import world as WD
from gfx import (W, H, font, clamp, ease_out, ease_in_out, spring, seg,
                 dark_bg, wordmark, pill, caption, bubble, vignette, glow,
                 atext, DISPLAY, BODY, BODYB,
                 VIOLET, CYAN, GOLD, PINK, INK, MUTED, GRASS)

GREEN = (61, 220, 132)
HF = WD.heightfield(5, 1.15)
TREES = WD.trees(11, 16)


def pieces():
    G, B, L, GR = (245, 197, 66), (76, 151, 255), (242, 86, 15), GREEN
    return TREES[:8] + [
        {"kind": "coin", "x": -4, "z": 2, "h": 1.3, "w": .8, "col": G},
        {"kind": "coin", "x": 2, "z": 5, "h": 1.3, "w": .8, "col": G},
        {"kind": "checkpoint", "x": -7, "z": 6, "h": 3.2, "w": .7, "col": B},
        {"kind": "lava", "x": 5, "z": 8, "h": 1, "w": 1.3, "col": L},
        {"kind": "finish", "x": -1, "z": 11, "h": 3.6, "w": .8, "col": GR}]


def worldbox(img, box, t, cam=None, props=None, grow=1.0, radius=34):
    cam = cam or WD.Cam(yaw=math.sin(t * .6) * .18)
    im = WD.render_world(box, HF, props if props is not None else TREES, cam,
                         t=t * 4, grow=grow)
    WD.paste_world(img, box, im, radius=radius)
    return img


def ver_tag(img, appear, y=None):
    """small 3.4.0 chip"""
    if appear <= 0:
        return img
    return pill(img, W / 2, y or H * 0.11, "VERSION 3.4.0", VIOLET, appear, 34)


# ---------------------------------------------------------------- 1 release
def a1_release(t):
    img = dark_bg(t * 4)
    img = wordmark(img, H * 0.34, 1.5, seg(t, .04, .34),
                   sub="build 3D games — without a bit of code")
    caption(img, H * 0.56, "3.4.0 is here", None, seg(t, .32, .54),
                  col=INK, size=96)
    feats = [("BIGGER EDITOR", CYAN, .50), ("THIRD PERSON", VIOLET, .58),
             ("INVITE FRIENDS", GOLD, .66), ("NEW PLANS", GREEN, .74)]
    for i, (lab, col, a0) in enumerate(feats):
        y = H * (0.66 + i * 0.075)
        img = pill(img, W / 2, y, lab, col, seg(t, a0, a0 + .16), 40)
    return vignette(img, t)


# ---------------------------------------------------------------- 2 big editor
def a2_bigscreen(t):
    img = dark_bg(t * 4 + 2)
    # a viewport that grows to fill almost the whole frame
    grow = ease_in_out(clamp(t * 1.4))
    mx = int(70 - 40 * grow)
    top = int(360 - 180 * grow)
    box = (mx, top, W - 2 * mx, int(1120 + 500 * grow))
    # third-person: pull the eye back and up over the (invisible) character
    cam = WD.Cam(x=math.sin(t * .5) * 1.5, z=-13.5, yaw=math.sin(t * .5) * .2,
                 pitch=0.34, height=5.0)
    img = worldbox(img, box, t, cam=cam, props=pieces(), radius=int(34 + 8 * grow))
    caption(img, H * 0.085, "Your whole screen", None, seg(t, .06, .26),
                  col=INK, size=74)
    img = pill(img, W / 2, H * 0.90, "THIRD-PERSON  ·  NO AVATAR", CYAN,
               seg(t, .5, .74), 38)
    return vignette(img, t)


# ---------------------------------------------------------------- 3 invites
def a3_invite(t):
    img = dark_bg(t * 4 + 4)
    caption(img, H * 0.13, "Bring a friend", None, seg(t, .04, .24),
                  col=INK, size=88)
    bubble(img, 80, H * 0.30, "here, take my code", "l", seg(t, .20, .44))
    img = pill(img, W / 2, H * 0.44, "GMFY-7K2Q-M4XP", GOLD, seg(t, .34, .56), 52)
    bubble(img, W - 80, H * 0.56, "whoa i got Pro for 3 months??", "r",
           seg(t, .52, .78))
    caption(img, H * 0.72, "Gift your plan", "10 codes · 3 months each · you keep yours",
                  seg(t, .66, .86), col=INK, size=72)
    img = pill(img, W / 2, H * 0.90, "SHARE THE SUBSCRIPTION", VIOLET,
               seg(t, .8, .96), 40)
    return vignette(img, t)


# ---------------------------------------------------------------- 4 plans
def a4_plans(t):
    img = dark_bg(t * 4 + 6)
    caption(img, H * 0.12, "Pick your plan", None, seg(t, .04, .24),
                  col=INK, size=88)
    d = ImageDraw.Draw(img, "RGBA")
    rows = [("Go", "$2/mo", "50 games", CYAN, .22),
            ("Pro", "$20/mo", "1000 games", VIOLET, .34),
            ("Max", "$390/mo", "unlimited", GOLD, .46)]
    for i, (name, price, sub, col, a0) in enumerate(rows):
        ap = ease_out(seg(t, a0, a0 + .18), 2)
        if ap <= 0.02:
            continue
        y = H * (0.34 + i * 0.16)
        a = int(255 * ap)
        dx = int((1 - ap) * 40)
        x0, x1 = 90 + dx, W - 90 + dx
        d.rounded_rectangle([x0, y - 110, x1, y + 110], radius=26,
                            fill=col + (int(a * .10),), outline=col + (a,), width=3)
        d.text((x0 + 44, y - 34), name, font=font(font_display(), 60),
               fill=INK + (a,), anchor="lm")
        d.text((x0 + 44, y + 40), sub, font=font("InstrumentSans-Regular", 36),
               fill=MUTED + (a,), anchor="lm")
        d.text((x1 - 44, y), price, font=font(font_display(), 66),
               fill=col + (a,), anchor="rm")
    img = pill(img, W / 2, H * 0.90, "FREE PLAN — ADS + 28 LIMITS", GREEN,
               seg(t, .78, .96), 38)
    return vignette(img, t)


def font_display():
    return "Outfit-Bold"


# ---------------------------------------------------------------- 5 recap
def a5_recap(t):
    img = dark_bg(t * 4 + 8)
    box = (80, 360, W - 160, 1100)
    if t < 0.62:
        n = int(4 + 12 * ease_in_out(clamp(t * 1.6)))
        cam = WD.Cam(z=-12.5, yaw=math.sin(t * .7) * .25, pitch=0.32, height=4.6)
        img = worldbox(img, box, t, cam=cam, props=pieces()[:n])
        caption(img, H * 0.10, "Build it. Play it.", None, seg(t, .06, .26),
                      col=INK, size=80)
        img = pill(img, W / 2, H * 0.66, "COINS · LAVA · FINISH", CYAN,
                   seg(t, .30, .52), 40)
    else:
        img = wordmark(img, H * 0.40, 1.5, seg(t, .62, .82),
                       sub="build 3D games — without a bit of code")
        caption(img, H * 0.60, "gmfy 3.4.0", "out now, free to start",
                      seg(t, .74, .92), col=INK, size=84)
    return vignette(img, t)


# ---------------------------------------------------------------- 6 free tier
def a6_free(t):
    """What the free plan actually is: ad-supported, limited, still usable.

    Deliberately not sold as 'everything for free' — the app ships 28 real
    restrictions and a full-screen spot before each play, so an ad claiming
    otherwise would be contradicted the moment anyone installed it.
    """
    img = dark_bg(t * 4 + 10)
    caption(img, H * 0.12, "Free, honestly", None, seg(t, .04, .24),
            col=INK, size=88)
    d = ImageDraw.Draw(img, "RGBA")
    rows = [("Build and play", "no account limits on making games", GREEN, .20),
            ("A 30s spot before each play", "that's what pays for it", CYAN, .32),
            ("28 features held back", "watermark, exports, biomes, undo…", GOLD, .44)]
    for i, (head, sub, col, a0) in enumerate(rows):
        ap = ease_out(seg(t, a0, a0 + .18), 2)
        if ap <= 0.02:
            continue
        y = H * (0.33 + i * 0.135)
        a = int(255 * ap)
        dx = int((1 - ap) * 40)
        d.rounded_rectangle([90 + dx, y - 96, W - 90 + dx, y + 96], radius=26,
                            fill=col + (int(a * .10),), outline=col + (a,), width=3)
        atext(d, (134 + dx, y - 26), head, font(DISPLAY, 54), INK, a, "lm")
        atext(d, (134 + dx, y + 42), sub, font(BODY, 34), MUTED, a, "lm")
    img = pill(img, W / 2, H * 0.79, "OR WATCH ONE AD TO UNLOCK ONE", VIOLET,
               seg(t, .60, .80), 38)
    img = pill(img, W / 2, H * 0.89, "UPGRADE TO DROP ALL OF IT", CYAN,
               seg(t, .76, .94), 38)
    return vignette(img, t)


# ---------------------------------------------------------------- 7 rewarded
def a7_rewarded(t):
    """The rewarded-video loop: watch 25s, lift one restriction for the session."""
    img = dark_bg(t * 4 + 12)
    caption(img, H * 0.13, "Earn it or buy it", None, seg(t, .04, .24),
            col=INK, size=86)
    d = ImageDraw.Draw(img, "RGBA")
    # a progress bar filling to 25s, then the unlock lands
    watched = ease_in_out(clamp(seg(t, .22, .62)))
    bx0, bx1, by = 130, W - 130, H * 0.40
    ap = ease_out(seg(t, .18, .32), 2)
    if ap > 0.02:
        a = int(255 * ap)
        d.rounded_rectangle([bx0, by - 30, bx1, by + 30], radius=30,
                            fill=(255, 255, 255, int(a * .07)),
                            outline=VIOLET + (int(a * .5),), width=2)
        if watched > 0:
            d.rounded_rectangle([bx0, by - 30, bx0 + (bx1 - bx0) * watched, by + 30],
                                radius=30, fill=VIOLET + (a,))
        atext(d, (W / 2, by + 86), "%d / 25s watched" % round(watched * 25),
              font(BODYB, 38), MUTED, a)
    img = pill(img, W / 2, H * 0.56, "WATERMARK  ·  UNLOCKED", GREEN,
               seg(t, .60, .78), 44)
    caption(img, H * 0.70, "21 of the 28 are rewardable",
            "the other 7 need a paid plan", seg(t, .70, .88), col=INK, size=64)
    img = pill(img, W / 2, H * 0.91, "UNLOCKS LAST THE SESSION", GOLD,
               seg(t, .84, .98), 36)
    return vignette(img, t)


ADS = [
    ("release", 30, a1_release, "3.4.0 is here"),
    ("bigscreen", 30, a2_bigscreen, "ultra-big third-person editor"),
    ("invite", 30, a3_invite, "gift your plan to a friend"),
    ("plans", 30, a4_plans, "Go / Pro / Max pricing"),
    ("recap", 30, a5_recap, "build it, play it"),
    ("free", 30, a6_free, "what the free plan really is"),
    ("rewarded", 30, a7_rewarded, "watch an ad, lift a limit"),
]
