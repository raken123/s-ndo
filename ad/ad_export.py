"""One ad for the exporters: 'ship it' — dark slate, platform tiles, download bar."""
import math
from PIL import Image, ImageDraw
from gfx import *
from styles import flat, linear, big
from styles2 import bloom, speckle, perf
import world as WD

HF = WD.heightfield(5, 1.0)
TREES = WD.trees(11, 12)
G, GR, B, L = (245,197,66), (61,220,132), (76,151,255), (242,86,15)
SLATE = (16, 18, 26)
ANDRO = (61, 220, 132)
DESK = (108, 168, 255)
ORANGE = (250, 120, 40)


def props():
    return TREES[:6] + [
        {"kind":"coin","x":-5,"z":2,"h":1.3,"w":.8,"col":G},
        {"kind":"coin","x":2,"z":5,"h":1.3,"w":.8,"col":G},
        {"kind":"lava","x":5,"z":8,"h":1,"w":1.3,"col":L},
        {"kind":"finish","x":-1,"z":11,"h":3.6,"w":.8,"col":GR}]


def bg(t):
    img = linear((22, 25, 38), (8, 9, 14))
    d = ImageDraw.Draw(img, "RGBA")
    for x in range(0, W, 60):
        d.line([(x, 0), (x, H)], fill=(255, 255, 255, 6), width=1)
    for y in range(0, H, 60):
        d.line([(0, y), (W, y)], fill=(255, 255, 255, 6), width=1)
    return img


def glowbox(img, rect, col, appear=1.0, radius=28, w=4, fillA=.10):
    if appear <= 0:
        return img
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dl = ImageDraw.Draw(lay)
    a = int(255 * ease_out(appear, 2))
    x0, y0, x1, y1 = rect
    k = spring(appear)
    cx, cy = (x0+x1)/2, (y0+y1)/2
    sw, sh = (x1-x0)/2*(.88+.12*k), (y1-y0)/2*(.88+.12*k)
    dl.rounded_rectangle([cx-sw, cy-sh, cx+sw, cy+sh], radius=radius,
                         fill=col + (int(a*fillA),), outline=col + (a,), width=w)
    out = bloom(img, lay, 18, .8)
    out.paste(Image.alpha_composite(out.convert("RGBA"), lay).convert("RGB"), (0, 0))
    return out


def droid(d, cx, cy, s, col, a=255):
    """Simple robot silhouette — drawn, not a font glyph."""
    d.pieslice([cx-s, cy-s*1.05, cx+s, cy+s*.95], 180, 360, fill=col+(a,))
    d.rectangle([cx-s, cy-s*.05, cx+s, cy+s*.85], fill=col+(a,))
    d.rounded_rectangle([cx-s, cy+s*.55, cx+s, cy+s*.85], radius=int(s*.28), fill=col+(a,))
    d.ellipse([cx-s*.42, cy-s*.72, cx-s*.24, cy-s*.54], fill=SLATE+(a,))
    d.ellipse([cx+s*.24, cy-s*.72, cx+s*.42, cy-s*.54], fill=SLATE+(a,))
    d.line([(cx-s*.72, cy-s*1.34), (cx-s*.44, cy-s*.92)], fill=col+(a,), width=max(3,int(s*.11)))
    d.line([(cx+s*.72, cy-s*1.34), (cx+s*.44, cy-s*.92)], fill=col+(a,), width=max(3,int(s*.11)))
    d.rounded_rectangle([cx-s*1.34, cy-s*.02, cx-s*1.08, cy+s*.72], radius=int(s*.13), fill=col+(a,))
    d.rounded_rectangle([cx+s*1.08, cy-s*.02, cx+s*1.34, cy+s*.72], radius=int(s*.13), fill=col+(a,))


def monitor(d, cx, cy, s, col, a=255):
    d.rounded_rectangle([cx-s*1.25, cy-s*.9, cx+s*1.25, cy+s*.62], radius=int(s*.14),
                        outline=col+(a,), width=max(3, int(s*.10)))
    d.rectangle([cx-s*.16, cy+s*.62, cx+s*.16, cy+s*.96], fill=col+(a,))
    d.rounded_rectangle([cx-s*.72, cy+s*.96, cx+s*.72, cy+s*1.14], radius=int(s*.09), fill=col+(a,))
    d.line([(cx-s*.9, cy-s*.5), (cx+s*.4, cy-s*.5)], fill=col+(int(a*.55),), width=max(2,int(s*.07)))
    d.line([(cx-s*.9, cy-s*.2), (cx+s*.7, cy-s*.2)], fill=col+(int(a*.55),), width=max(2,int(s*.07)))
    d.line([(cx-s*.9, cy+s*.1), (cx+s*.1, cy+s*.1)], fill=col+(int(a*.55),), width=max(2,int(s*.07)))


def upload_glyph(d, cx, cy, s, col, a=255, lift=0.0):
    """Tray + arrow, the upload-icon motif."""
    ay = cy - s*.25 - lift
    d.polygon([(cx, ay-s*.55), (cx-s*.42, ay-s*.05), (cx+s*.42, ay-s*.05)], fill=col+(a,))
    d.rounded_rectangle([cx-s*.15, ay-s*.05, cx+s*.15, ay+s*.5], radius=int(s*.07), fill=col+(a,))
    d.line([(cx-s*.78, cy+s*.62), (cx-s*.78, cy+s*.95), (cx+s*.78, cy+s*.95), (cx+s*.78, cy+s*.62)],
           fill=col+(a,), width=max(3, int(s*.11)), joint="curve")


def bar(d, x0, y0, x1, y1, frac, col, a=255):
    d.rounded_rectangle([x0, y0, x1, y1], radius=int((y1-y0)/2), fill=(255,255,255,int(a*.10)))
    w = (x1-x0) * clamp(frac)
    if w > 4:
        d.rounded_rectangle([x0, y0, x0+w, y1], radius=int((y1-y0)/2), fill=col+(a,))


def chip(d, cx, cy, label, sub, col, appear=1.0):
    if appear <= 0:
        return
    a = int(255*ease_out(appear, 2)); k = spring(appear)
    hw = 340*(.86+.14*k)
    d.rounded_rectangle([cx-hw, cy-78, cx+hw, cy+78], radius=24,
                        fill=(255,255,255,int(a*.06)), outline=col+(a,), width=3)
    d.text((cx-hw+40, cy-16), label, font=font(DISPLAY, 52), fill=col+(a,), anchor="lm")
    d.text((cx-hw+40, cy+38), sub, font=font(BODY, 30), fill=MUTED+(a,), anchor="lm")


# ------------------------------------------------------------------ clips
def x1(t):
    img = bg(t)
    box = (130, 250, W-260, 520)
    WD.paste_world(img, box, WD.render_world(box, HF, props(), WD.Cam(yaw=t*.8), t=t*6), 26)
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle([130, 250, W-130, 770], radius=26, outline=(255,255,255,40), width=2)
    big(d, 950, "YOU MADE A GAME.", font(DISPLAY, 82), INK, seg(t,.10,.38))
    big(d, 1080, "NOW SHIP IT.", font(DISPLAY, 82), CYAN, seg(t,.30,.58))
    if t > .58:
        a = int(255*seg(t,.58,.82))
        d.text((W/2, 1230), "export it as a real app", font=font(BODY, 42),
               fill=MUTED+(a,), anchor="mm")
    return vignette(img, t, 3, .40)


def x2(t):
    """Upload your icon."""
    img = bg(t)
    d = ImageDraw.Draw(img, "RGBA")
    d.text((W/2, 250), "1 — YOUR ICON", font=font(BODYB, 44), fill=MUTED+(255,), anchor="mm")
    lift = 26*max(0.0, math.sin(t*5)) if t < .45 else 0
    img = glowbox(img, (250, 400, W-250, 900), CYAN, seg(t,.05,.30), 34, 3, .05)
    d = ImageDraw.Draw(img, "RGBA")
    if t > .16:
        a = int(255*seg(t,.16,.40))
        upload_glyph(d, W/2, 600, 130, CYAN, a, lift)
        d.text((W/2, 800), "tap to upload", font=font(BODY, 40), fill=MUTED+(a,), anchor="mm")
    if t > .48:
        ap = seg(t,.48,.74); a = int(255*ease_out(ap,2)); k = spring(ap)
        s = int(150*(.7+.3*k))
        d.rounded_rectangle([W/2-s, 560-s, W/2+s, 560+s], radius=int(s*.24), fill=ORANGE+(a,))
        d.ellipse([W/2-s*.66, 560-s*.66, W/2+s*.66, 560+s*.66], fill=(30,40,90,a))
        d.rectangle([W/2-s*.14, 560-s*.30, W/2+s*.14, 560+s*.32], fill=(255,240,120,a))
        d.text((W/2, 800), "myicon.png · 700×700", font=font(BODY, 36),
               fill=INK+(a,), anchor="mm")
    if t > .74:
        a = int(255*seg(t,.74,.94))
        d.text((W/2, 1030), "resized to every size", font=font(DISPLAY, 62), fill=INK+(a,), anchor="mm")
        for i, sz in enumerate([36, 48, 72, 96, 144, 192]):
            ap2 = seg(t, .78+i*.03, .88+i*.03)
            if ap2 <= 0: continue
            a2 = int(255*ease_out(ap2,2))
            x = 150 + i*130
            s2 = 20 + i*7
            d.rounded_rectangle([x-s2, 1180-s2, x+s2, 1180+s2], radius=int(s2*.24), fill=ORANGE+(a2,))
            d.text((x, 1260), str(sz), font=font(MONO, 26), fill=MUTED+(a2,), anchor="mm")
    return vignette(img, t, 3, .40)


def x3(t):
    """Two targets."""
    img = bg(t)
    d = ImageDraw.Draw(img, "RGBA")
    d.text((W/2, 250), "2 — PICK A TARGET", font=font(BODYB, 44), fill=MUTED+(255,), anchor="mm")
    img = glowbox(img, (110, 400, W-110, 810), ANDRO, seg(t,.06,.32), 30, 4)
    img = glowbox(img, (110, 880, W-110, 1290), DESK, seg(t,.30,.56), 30, 4)
    d = ImageDraw.Draw(img, "RGBA")
    if t > .18:
        a = int(255*seg(t,.18,.42))
        droid(d, 280, 600, 90, ANDRO, a)
        d.text((470, 560), "CORDOVA", font=font(DISPLAY, 62), fill=ANDRO+(a,), anchor="lm")
        d.text((470, 640), "Android APK", font=font(BODY, 38), fill=MUTED+(a,), anchor="lm")
    if t > .42:
        a = int(255*seg(t,.42,.66))
        monitor(d, 280, 1075, 90, DESK, a)
        d.text((470, 1035), "ELECTRON", font=font(DISPLAY, 62), fill=DESK+(a,), anchor="lm")
        d.text((470, 1115), "Windows · macOS · Linux", font=font(BODY, 34), fill=MUTED+(a,), anchor="lm")
    if t > .72:
        d.text((W/2, 1420), "same game, both ways", font=font(BODY, 40),
               fill=MUTED+(int(255*seg(t,.72,.92)),), anchor="mm")
    return vignette(img, t, 3, .40)


def x4(t):
    """Packing the zip."""
    img = bg(t)
    d = ImageDraw.Draw(img, "RGBA")
    d.text((W/2, 250), "3 — PACKING", font=font(BODYB, 44), fill=MUTED+(255,), anchor="mm")
    files = ["config.xml", "www/index.html", "www/engine.js", "www/game.js",
             "www/blocks.js", "www/player.js", "res/icon/…  ×6"]
    for i, fn in enumerate(files):
        ap = seg(t, .04+i*.08, .16+i*.08)
        if ap <= 0: continue
        a = int(255*ease_out(ap,2))
        y = 400 + i*104
        dx = int((1-ease_out(ap))*50)
        d.rounded_rectangle([150+dx, y, W-150+dx, y+82], radius=14,
                            fill=(255,255,255,int(a*.05)), outline=(255,255,255,int(a*.16)), width=2)
        d.text((190+dx, y+41), fn, font=font(MONO, 34), fill=INK+(a,), anchor="lm")
        d.text((W-190+dx, y+41), "ok", font=font(MONO, 30), fill=ANDRO+(a,), anchor="rm")
    if t > .70:
        a = int(255*seg(t,.70,.86))
        bar(d, 150, 1220, W-150, 1268, seg(t,.70,.96), CYAN, a)
        d.text((W/2, 1340), "14 files · 64 KB", font=font(BODYB, 40), fill=INK+(a,), anchor="mm")
    return vignette(img, t, 3, .40)


def x5(t):
    """Out come the artefacts."""
    img = bg(t)
    d = ImageDraw.Draw(img, "RGBA")
    d.text((W/2, 250), "4 — BUILD IT", font=font(BODYB, 44), fill=MUTED+(255,), anchor="mm")
    cmds = [("$ cordova build android", ANDRO, .05), ("$ npm run dist", DESK, .30)]
    for i,(c,col,at) in enumerate(cmds):
        ap = seg(t, at, at+.18)
        if ap <= 0: continue
        a = int(255*ease_out(ap,2))
        y = 400 + i*180
        d.rounded_rectangle([140, y, W-140, y+120], radius=16,
                            fill=(0,0,0,int(a*.45)), outline=col+(int(a*.6),), width=2)
        d.text((180, y+60), c, font=font(MONO, 36), fill=col+(a,), anchor="lm")
    chip(d, W/2, 900, "LavaDash.apk", "3.4 MB · installs on Android", ANDRO, seg(t,.50,.74))
    chip(d, W/2, 1090, "LavaDash.exe", "desktop installer", DESK, seg(t,.66,.90))
    if t > .84:
        d.text((W/2, 1300), "your icon. your name. your game.", font=font(BODY, 40),
               fill=MUTED+(int(255*seg(t,.84,.98)),), anchor="mm")
    return vignette(img, t, 3, .40)


def x6(t):
    img = bg(t)
    d = ImageDraw.Draw(img, "RGBA")
    if t > .04:
        a = int(255*seg(t,.04,.26))
        droid(d, W/2-230, 420, 78, ANDRO, a)
        monitor(d, W/2+230, 430, 78, DESK, a)
        d.text((W/2, 430), "+", font=font(DISPLAY, 76), fill=MUTED+(a,), anchor="mm")
    img = wordmark(img, 760, 1.35, seg(t,.22,.54), sub="build 3D games — without a bit of code")
    d = ImageDraw.Draw(img, "RGBA")
    if t > .52:
        a = int(255*seg(t,.52,.74))
        d.text((W/2, 1010), "now with APK + desktop export", font=font(BODYB, 42),
               fill=CYAN+(a,), anchor="mm")
    ap = seg(t,.68,.92)
    if ap > 0:
        a = int(255*ease_out(ap,2)); k = spring(ap)
        hw = 330*(.86+.14*k)
        lay = Image.new("RGBA", (W, H), (0,0,0,0))
        dl = ImageDraw.Draw(lay)
        for i in range(120):
            fr = i/119
            c = tuple(int(VIOLET[j]*(1-fr) + CYAN[j]*fr) for j in range(3))
            dl.line([(W/2-hw, 1200+i), (W/2+hw, 1200+i)], fill=c+(a,))
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).rounded_rectangle([W/2-hw, 1200, W/2+hw, 1320], radius=60, fill=255)
        lay.putalpha(Image.composite(lay.split()[-1], Image.new("L", (W,H), 0), m))
        img = glow(img, lay, 26, 1.0)
        img.paste(Image.alpha_composite(img.convert("RGBA"), lay).convert("RGB"), (0,0))
        ImageDraw.Draw(img, "RGBA").text((W/2, 1260), "START FREE", font=font(DISPLAY, 56),
                                         fill=(255,255,255,a), anchor="mm")
    return vignette(img, t, 3, .40)


ADS = [("16_export", "Export: APK + desktop", [x1, x2, x3, x4, x5, x6])]
