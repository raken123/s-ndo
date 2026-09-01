"""Renders Odds & Ends episode 1 to an MP4.

    python3 render.py out.mp4            # the whole 5:00 episode
    python3 render.py out.mp4 --from 90 --to 110   # a slice, for checking
    python3 render.py --frame 42.0 shot.png        # one still
"""

import math
import subprocess
import sys

import cairo

import audio
import cues as cuemod
import script
import stage
from cast import CAST, CONTESTANTS, pose
from draw import (GROUND, H, W, clamp, ease_in_out, ease_out, ease_back,
                  bounce, lerp, rand01, set_rgb, text_at, wobble)

FPS = 24
TOTAL = 300.0

UPRIGHTS = ["Cone", "Mugsy", "Sticky"]
CONDUCTORS = ["Volt", "Clip", "Cube"]


# ------------------------------------------------------------- timeline ----

class Show:
    def __init__(self):
        self.scenes, self.total = script.build_timeline(TOTAL)
        self.cues = cuemod.build_cues(self.scenes)
        self.by_key = {s["key"]: s for s in self.scenes}
        self.acts = {s["key"]: self._acts(s) for s in self.scenes}
        self.mouths = self._mouths()
        self.cue_at = {}
        for c in self.cues:
            self.cue_at.setdefault(c["kind"], []).append(c["t"])

    @staticmethod
    def _acts(sc):
        """Merge consecutive beats sharing an act into (t0, t1, act) spans."""
        spans = []
        for b in sc["beats"]:
            a = b.get("act")
            if spans and spans[-1][2] == a:
                spans[-1][1] = b["t1"]
            else:
                spans.append([b["t0"], b["t1"], a])
        return [tuple(s) for s in spans]

    def _mouths(self):
        """Blip windows per spoken line, so mouths match the voice track."""
        out, idx = {}, 0
        for sc in self.scenes:
            for b in sc["beats"]:
                if b["kind"] != "say":
                    continue
                ch = CAST[b["who"]]
                blips = audio.voice_blips(b["text"], b["speak"], ch.voice,
                                          "%s%d" % (b["who"], idx))
                out[id(b)] = [b["t0"] + o for o, _f, _l in blips]
                idx += 1
        return out

    def act_span(self, sc, T):
        for t0, t1, a in self.acts[sc["key"]]:
            if t0 <= T < t1:
                return t0, t1, a
        t0, t1, a = self.acts[sc["key"]][-1]
        return t0, t1, a

    def act_start(self, sc, name, default=None):
        for t0, t1, a in self.acts[sc["key"]]:
            if a == name:
                return t0
        return default

    def act_end(self, sc, name, default=None):
        last = default
        for t0, t1, a in self.acts[sc["key"]]:
            if a == name:
                last = t1
        return last

    def locate(self, T):
        sc = self.scenes[-1]
        for s in self.scenes:
            if T < s["t1"]:
                sc = s
                break
        beat = sc["beats"][-1]
        for b in sc["beats"]:
            if T < b["t1"]:
                beat = b
                break
        return sc, beat

    def mouth(self, beat, T):
        if beat["kind"] != "say":
            return 0.0
        m = 0.0
        for bt in self.mouths.get(id(beat), ()):
            d = T - bt
            if -0.02 < d < 0.075:
                m = max(m, 1.0 - abs(d - 0.03) / 0.055)
        return clamp(m)

    def since(self, kind, T, window=1e9):
        """Seconds since the most recent cue of *kind*, or None."""
        best = None
        for t in self.cue_at.get(kind, ()):
            if t <= T and T - t < window:
                best = T - t if best is None else min(best, T - t)
        return best


SHOW = Show()


def talker(beat, name):
    return beat["kind"] == "say" and beat["who"] == name


def facial(beat, name, default="happy"):
    return beat["expr"] if talker(beat, name) else default


def idle(name, T, y=GROUND, x=0.0, s=1.0, **kw):
    p = pose(x, y + math.sin(T * 2.0 + rand01(name) * 6) * 2.0, s=s, **kw)
    return p


def look_at(px, tx):
    return (clamp((tx - px) / 380.0, -1, 1), 0.0)


# ---------------------------------------------------------------- camera ---

def camera(cr, zoom=1.0, cx=W / 2, cy=H / 2, shake=0.0, T=0.0):
    cr.translate(W / 2, H / 2)
    if shake:
        cr.translate(math.sin(T * 47) * shake, math.cos(T * 39) * shake)
    cr.scale(zoom, zoom)
    cr.translate(-cx, -cy)


# ---------------------------------------------------------------- scenes ---

def sc_cold_open(cr, sc, beat, T):
    t = T - sc["t0"]
    cr.save()
    camera(cr, lerp(1.16, 1.34, ease_in_out(t / sc["dur"])), W / 2, 468)
    stage.dark_stage(cr, T, spots=[(640, 210, 1.0)])
    stage.chair(cr, 640, GROUND, 1.05, T, glow=0.7 + 0.3 * math.sin(T * 2))

    sh = SHOW.since("sparkle", T, 1.0)
    if sh is not None:
        for i in range(9):
            a = i / 9 * math.tau + T
            r = 90 + sh * 190
            x, y = 640 + math.cos(a) * r, GROUND - 80 + math.sin(a) * r * 0.6
            cr.save()
            cr.translate(x, y)
            cr.rotate(T * 3 + i)
            set_rgb(cr, (1, 0.95, 0.5), clamp(1 - sh) * 0.9)
            cr.rectangle(-3, -12, 6, 24)
            cr.rectangle(-12, -3, 24, 6)
            cr.fill()
            cr.restore()

    mega_t = sc["beats"][1]["t0"]
    k = clamp((T - mega_t + 0.7) / 1.5)
    mx = lerp(1420, 980, ease_out(k))
    p = idle("Mega", T, x=mx, s=1.0, expr=facial(beat, "Mega", "smug"),
             mouth=SHOW.mouth(beat, T), look=look_at(mx, 640))
    if k < 1:
        p["step"] = T * 9
    CAST["Mega"].draw(cr, p, T)

    for name, act, tx in (("Cone", "cone_in", 300), ("Mugsy", "mugsy_in", 455)):
        st = SHOW.act_start(sc, act)
        if st is None or T < st - 0.9:
            continue
        k = clamp((T - st + 0.9) / 1.5)
        x = lerp(-140, tx, ease_out(k))
        p = idle(name, T, x=x, expr=facial(beat, name, "flat"),
                 mouth=SHOW.mouth(beat, T), look=look_at(x, 640))
        if k < 1:
            p["step"] = T * 9
        CAST[name].draw(cr, p, T)
    cr.restore()
    stage.vignette(cr, 0.5)


def sc_title(cr, sc, beat, T):
    t = T - sc["t0"]
    set_rgb(cr, (0.20, 0.42, 0.78))
    cr.rectangle(0, 0, W, H)
    cr.fill()
    cr.save()
    cr.translate(W / 2, H / 2 - 20)
    for i in range(16):
        a = i / 16 * math.tau + t * 0.35
        cr.new_path()
        cr.move_to(0, 0)
        cr.line_to(math.cos(a) * 1100, math.sin(a) * 1100)
        cr.line_to(math.cos(a + 0.19) * 1100, math.sin(a + 0.19) * 1100)
        cr.close_path()
        set_rgb(cr, (1, 1, 1), 0.07)
        cr.fill()
    cr.restore()

    slam = SHOW.cue_at["slam"][0] - sc["t0"]
    k = clamp((t - slam + 0.45) / 0.55)
    if t > slam - 0.5:
        s = lerp(3.4, 1.0, ease_out(k))
        wob = 1 + wobble(max(0.0, t - slam), 7, 6) * 0.06
        stage.logo(cr, W / 2, 300, s * wob, 1.0,
                   sub='Episode 1: "Stack Overflow"' if t > slam + 0.9 else None,
                   sub_a=clamp((t - slam - 0.9) / 0.5))
    fl = SHOW.since("slam", T, 0.35)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.35) * 0.55)

    for i, name in enumerate(CONTESTANTS):
        st = slam + 1.7 + i * 0.28
        if t < st:
            continue
        k = clamp((t - st) / 0.55)
        y = GROUND + 120 - bounce(k) * 120
        CAST[name].draw(cr, pose(150 + i * 196, y, s=0.92,
                                 expr="happy", sq=1 + 0.12 * (1 - k)), T)
    sp = SHOW.since("whoosh", T, 0.6)
    if sp is not None:
        set_rgb(cr, (1, 1, 1), clamp(1 - sp / 0.6) * 0.5)
        for i in range(7):
            y = 90 + i * 90
            cr.rectangle(lerp(-400, W, sp / 0.6) + i * 60, y, 380, 8)
            cr.fill()


ROLL_X = {n: 150 + i * 168 for i, n in enumerate(CONTESTANTS)}


def sc_rollcall(cr, sc, beat, T):
    t0, t1, act = SHOW.act_span(sc, T)
    focus = act.split("_", 1)[1] if act and act.startswith("spot_") else None
    zoom, cx = 1.0, W / 2
    if focus:
        k = ease_in_out(clamp((T - t0) / 0.5))
        zoom = lerp(1.0, 1.55, k)
        cx = lerp(W / 2, ROLL_X[focus] + 40, k)
    elif act == "lineup":
        zoom = lerp(1.55, 1.0, ease_in_out(clamp((T - t0) / 0.6)))
        cx = lerp(ROLL_X["Cube"] + 40, W / 2, ease_in_out(clamp((T - t0) / 0.6)))
    cr.save()
    camera(cr, zoom, cx, 430)
    stage.sky(cr, T)
    stage.hills(cr, T * 0)

    for name in CONTESTANTS:
        x = ROLL_X[name]
        p = idle(name, T, x=x, expr=facial(beat, name))
        p["mouth"] = SHOW.mouth(beat, T) if talker(beat, name) else 0.0
        p["look"] = look_at(x, 1130)
        if focus == name:
            k = clamp((T - t0) / 0.45)
            p["y"] -= bounce(k) * 46 if k < 1 else 0
            p["s"] = 1.0
            p["look"] = (0.0, 0.0)
        elif act == "lineup":
            k = clamp((T - t0 - 0.2) / 0.5)
            p["y"] -= bounce(k) * 40 if k < 1 else 0
        CAST[name].draw(cr, p, T)

    mx = 1185
    CAST["Mega"].draw(cr, idle("Mega", T, x=mx, expr=facial(beat, "Mega"),
                               mouth=SHOW.mouth(beat, T)
                               if talker(beat, "Mega") else 0.0,
                               look=look_at(mx, 400)), T)
    cr.restore()

    if focus:
        ch = CAST[focus]
        stage.nameplate(cr, W / 2, 92, ch.name, ch.blurb, ch.tag,
                        clamp((T - t0) / 0.4))


CHAL_X = {n: 470 + i * 140 for i, n in enumerate(CONTESTANTS)}
TEAM_A_X = {"Cone": 400, "Mugsy": 530, "Sticky": 660}
TEAM_B_X = {"Volt": 880, "Clip": 1010, "Cube": 1140}


def sc_challenge(cr, sc, beat, T):
    stage.sky(cr, T)
    stage.hills(cr, 0)
    ta = SHOW.act_start(sc, "team_a")
    tb = SHOW.act_start(sc, "team_b")
    horn = SHOW.act_start(sc, "horn")

    for name in CONTESTANTS:
        x = CHAL_X[name]
        if name in TEAM_A_X and ta is not None and T > ta:
            x = lerp(x, TEAM_A_X[name], ease_in_out(clamp((T - ta) / 0.9)))
        if name in TEAM_B_X and tb is not None and T > tb:
            x = lerp(x, TEAM_B_X[name], ease_in_out(clamp((T - tb) / 0.9)))
        p = idle(name, T, x=x, s=0.95, expr=facial(beat, name),
                 mouth=SHOW.mouth(beat, T) if talker(beat, name) else 0.0,
                 look=look_at(x, 200))
        if horn is not None and T > horn:
            k = clamp((T - horn) / 0.3)
            p["sq"] = lerp(1.0, 0.85, k) if T - horn < 0.6 else 1.0
        CAST[name].draw(cr, p, T)

    p = idle("Mega", T, x=200, s=1.15, expr=facial(beat, "Mega"),
             mouth=SHOW.mouth(beat, T) if talker(beat, "Mega") else 0.0,
             look=(1, 0), flip=True,
             arm_r=0.8 if beat.get("act") == "banner" else 0.0)
    CAST["Mega"].draw(cr, p, T)

    if ta is not None and T > ta:
        a = clamp((T - ta) / 0.5)
        text_at(cr, 530, 300, "TEAM UPRIGHTS", 34, (1, 1, 1), "center",
                outline=(0.20, 0.45, 0.75), outline_w=8, alpha=a)
    if tb is not None and T > tb:
        a = clamp((T - tb) / 0.5)
        text_at(cr, 1010, 300, "TEAM CONDUCTORS", 34, (1, 1, 1), "center",
                outline=(0.75, 0.30, 0.30), outline_w=8, alpha=a)

    bt = SHOW.act_start(sc, "banner")
    if bt is not None and T < bt + 5.2:
        stage.banner(cr, 70, "CHALLENGE: STACK OVERFLOW",
                     clamp((T - bt) / 0.5) * clamp((bt + 5.2 - T) / 0.4))
    fl = SHOW.since("horn", T, 0.4)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.4) * 0.5, (1, 0.95, 0.7))


# ------------------------------------------------------------ the challenge --

TOWER_A_X, TOWER_B_X = 400, 890
CLOUD_Y = 150


def stack_layout(sc, T, beat):
    """Where all six objects are during the stacking challenge."""
    P = {}
    t_build_a = SHOW.act_start(sc, "build_a", sc["t0"] + 4)
    t_build_b = SHOW.act_start(sc, "build_b", sc["t0"] + 12)
    t_melt = SHOW.act_start(sc, "melt", sc["t0"] + 40)
    t_cloud = SHOW.act_start(sc, "cloud", sc["t0"] + 50)
    t_cloudup = SHOW.act_start(sc, "cloud_up", sc["t0"] + 53)
    t_coll = SHOW.act_end(sc, "collapse", sc["t1"]) - 3.4
    t_wob = SHOW.act_start(sc, "wobble", t_melt + 6)

    scramble = T < t_build_a
    for name in CONTESTANTS:
        home = TOWER_A_X if name in UPRIGHTS else TOWER_B_X
        if scramble:
            i = (UPRIGHTS if name in UPRIGHTS else CONDUCTORS).index(name)
            k = (T - sc["t0"]) * 2.2 + rand01(name) * 6
            x = home + (i - 1) * 105 + math.sin(k) * 55
            P[name] = pose(x, GROUND + math.sin(k * 3) * 0, step=T * 11,
                           expr="happy")
        else:
            P[name] = pose(home, GROUND, expr="happy")

    def climb(name, base_name, t_start, dur=1.3):
        """Lift a character onto the head of the one below."""
        below = P[base_name]
        top = CAST[base_name].top(below)
        k = ease_in_out(clamp((T - t_start) / dur))
        p = P[name]
        gx = below["x"]
        p["x"] = lerp(p["x"], gx, k)
        p["y"] = lerp(GROUND, top + 6, k)
        if k < 1:
            p["y"] -= math.sin(k * math.pi) * 40
            p["step"] = T * 12
        return p

    if T >= t_build_a:
        P["Cone"]["x"] = TOWER_A_X
        climb("Mugsy", "Cone", t_build_a + 0.6)
        climb("Sticky", "Mugsy", t_build_a + 2.6)
    if T >= t_build_b:
        P["Volt"]["x"] = TOWER_B_X
        climb("Cube", "Volt", t_build_b + 0.5)
        climb("Clip", "Cube", t_build_b + 2.2)

    # Cube melts: it squashes, and everything above it sinks
    melt_k = clamp((T - t_melt) / 9.0) if T > t_melt else 0.0
    if melt_k > 0:
        P["Cube"]["sq"] = lerp(1.0, 0.42, ease_in_out(melt_k))
        P["Cube"]["expr"] = "worried"
        P["Clip"]["y"] = CAST["Cube"].top(P["Cube"]) + 6

    # tower B leans as the ice goes
    lean = 0.0
    if T > t_wob:
        lean = math.sin((T - t_wob) * 2.4) * 0.09 * clamp((T - t_wob) / 2.0)
        for i, name in enumerate(("Volt", "Cube", "Clip")):
            P[name]["rot"] = lean * (0.3 + i * 0.5)
            P[name]["x"] += lean * (i * 70)

    # Sticky drifts up to a cloud and stays there
    if T > t_cloud:
        P["Sticky"]["look"] = (0.2, -1.0)
    if T > t_cloudup:
        k = ease_in_out(clamp((T - t_cloudup) / 2.4))
        P["Sticky"]["y"] = lerp(P["Sticky"]["y"], CLOUD_Y + 46, k)
        P["Sticky"]["x"] = lerp(P["Sticky"]["x"], 300, k)
        P["Sticky"]["rot"] = math.sin(T * 1.6) * 0.08
        P["Sticky"]["expr"] = "shock" if k > 0.4 else P["Sticky"]["expr"]

    # tower B falls over at the buzzer
    if T > t_coll:
        f = clamp((T - t_coll) / 1.1)
        P["Volt"].update(x=TOWER_B_X - 120 * ease_out(f), y=GROUND,
                         rot=-1.4 * ease_out(f), expr="furious")
        P["Clip"].update(x=TOWER_B_X + 150 * ease_out(f),
                         y=GROUND - math.sin(f * math.pi) * 120,
                         rot=5.0 * f, expr="shock")
        P["Cube"].update(x=TOWER_B_X + 20, y=GROUND, sq=0.12, expr="flat")
    return P


def draw_tape(cr, x, y0, y1, label, color, k=1.0):
    if k <= 0:
        return
    y = lerp(y0, y1, ease_out(k))
    cr.new_path()
    cr.move_to(x, y0)
    cr.line_to(x, y)
    set_rgb(cr, color, 0.95)
    cr.set_line_width(6)
    cr.set_dash([16, 10])
    cr.stroke()
    cr.set_dash([])
    for yy in (y0, y):
        cr.move_to(x - 16, yy)
        cr.line_to(x + 16, yy)
        cr.set_line_width(6)
        cr.stroke()
    text_at(cr, x + 26, (y0 + y) / 2, label, 34, (1, 1, 1),
            outline=(0.12, 0.11, 0.18), outline_w=8)


def timer_value(sc, T):
    anchors = [(sc["t0"], 60.0)]
    for b in sc["beats"]:
        if b["kind"] != "say":
            continue
        if b["text"].startswith("Thirty"):
            anchors.append((b["t0"] + 0.2, 30.0))
        elif b["text"].startswith("Ten"):
            anchors.append((b["t0"] + 0.2, 10.0))
        elif b["text"].startswith("Three"):
            anchors.append((b["t0"] + 0.2, 3.0))
    coll = SHOW.act_end(sc, "collapse", sc["t1"]) - 3.4
    anchors.append((coll, 0.0))
    anchors.append((sc["t1"], 0.0))
    for (ta, va), (tb, vb) in zip(anchors, anchors[1:]):
        if ta <= T <= tb:
            return lerp(va, vb, (T - ta) / max(0.01, tb - ta))
    return 0.0


def sc_stack(cr, sc, beat, T):
    coll = SHOW.act_end(sc, "collapse", sc["t1"]) - 3.4
    secs = timer_value(sc, T)
    shake = 0.0
    if secs < 10:
        shake = 1.5
    cs = SHOW.since("buzzer", T, 1.0)
    if cs is not None:
        shake = 12 * (1 - cs)
    zs = SHOW.since("zap", T, 0.5)
    if zs is not None:
        shake = max(shake, 7 * (1 - zs / 0.5))

    cr.save()
    camera(cr, 1.0, W / 2, H / 2, shake, T)
    stage.sky(cr, T)
    stage.hills(cr, 0)
    P = stack_layout(sc, T, beat)

    if T > SHOW.act_start(sc, "cloud", 1e9) - 1.0:
        stage.cloud(cr, 300, CLOUD_Y + 52, 1.15)

    for name in CONTESTANTS:
        p = P[name]
        p["expr"] = beat["expr"] if talker(beat, name) else p["expr"]
        p["mouth"] = SHOW.mouth(beat, T) if talker(beat, name) else 0.0
        if p["y"] < GROUND - 4 and p["step"] is None:
            p["y"] += math.sin(T * 3 + rand01(name) * 5) * 1.6
        CAST[name].draw(cr, p, T)

    if T > coll + 0.9:
        stage.puddle(cr, TOWER_B_X + 20, GROUND - 6,
                     lerp(40, 92, clamp((T - coll - 0.9) / 1.2)))
    md = SHOW.since("drip", T, 0.5)
    if md is not None:
        for i in range(3):
            cr.save()
            cr.translate(P["Cube"]["x"] - 30 + i * 30,
                         P["Cube"]["y"] - 20 + md * 120)
            set_rgb(cr, (0.66, 0.87, 0.96))
            cr.arc(0, 0, 5, 0, math.tau)
            cr.fill()
            cr.restore()

    if zs is not None:
        stage.bolt(cr, P["Clip"]["x"], P["Clip"]["y"] - 60,
                   P["Volt"]["x"], P["Volt"]["y"] - 70, T)

    CAST["Mega"].draw(cr, idle("Mega", T, x=1235, s=0.9,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=SHOW.mouth(beat, T) if talker(beat, "Mega")
                               else 0.0, look=(-1, 0)), T)
    cr.restore()

    stage.timer(cr, secs, warn=secs < 10)
    if zs is not None:
        stage.flash(cr, (1 - zs / 0.5) * 0.35, (1, 0.98, 0.7))
    if cs is not None:
        stage.flash(cr, (1 - cs) * 0.25, (1, 0.4, 0.4))


def sc_results(cr, sc, beat, T):
    win_t = SHOW.act_start(sc, "win", sc["t1"])
    stage.sky(cr, T)
    stage.hills(cr, 0)
    stage.cloud(cr, 300, CLOUD_Y + 52, 1.15)

    # team A still stacked: Cone with Mugsy on his head
    cone = pose(TOWER_A_X, GROUND, expr=facial(beat, "Cone", "flat"),
                mouth=SHOW.mouth(beat, T) if talker(beat, "Cone") else 0.0)
    if T > win_t:
        cone["y"] -= abs(math.sin((T - win_t) * 5)) * 16
    CAST["Cone"].draw(cr, cone, T)
    mug = pose(TOWER_A_X, CAST["Cone"].top(cone) + 6,
               expr=facial(beat, "Mugsy", "worried"),
               mouth=SHOW.mouth(beat, T) if talker(beat, "Mugsy") else 0.0)
    CAST["Mugsy"].draw(cr, mug, T)

    sticky = pose(300, CLOUD_Y + 46, rot=math.sin(T * 1.6) * 0.08,
                  expr=facial(beat, "Sticky", "shock"),
                  mouth=SHOW.mouth(beat, T) if talker(beat, "Sticky") else 0.0)
    CAST["Sticky"].draw(cr, sticky, T)

    # team B: a pile
    CAST["Volt"].draw(cr, pose(TOWER_B_X - 110, GROUND, rot=-1.4,
                               expr=facial(beat, "Volt", "furious"),
                               mouth=SHOW.mouth(beat, T) if talker(beat, "Volt")
                               else 0.0), T)
    CAST["Clip"].draw(cr, pose(TOWER_B_X + 130, GROUND, rot=1.2,
                               expr=facial(beat, "Clip", "happy"),
                               mouth=SHOW.mouth(beat, T) if talker(beat, "Clip")
                               else 0.0), T)
    stage.puddle(cr, TOWER_B_X + 20, GROUND - 6, 92)
    CAST["Cube"].draw(cr, pose(TOWER_B_X + 20, GROUND, sq=0.12,
                               expr=facial(beat, "Cube", "flat"),
                               mouth=SHOW.mouth(beat, T) if talker(beat, "Cube")
                               else 0.0), T)

    mp = idle("Mega", T, x=1225, s=0.95, expr=facial(beat, "Mega", "smug"),
              mouth=SHOW.mouth(beat, T) if talker(beat, "Mega") else 0.0,
              look=(-1, 0))
    CAST["Mega"].draw(cr, mp, T)

    tb = SHOW.act_start(sc, "measure_b")
    ta = SHOW.act_start(sc, "measure_a")
    cards = clamp((win_t - T) / 0.4) if T > win_t - 0.4 else 1.0
    if tb is not None and T > tb:
        stage.scorecard(cr, 1010, 88, "Conductors", "0 units",
                        (0.85, 0.35, 0.35), clamp((T - tb) / 0.4) * cards)
    if ta is not None and T > ta:
        k = clamp((T - ta) / 0.8)
        draw_tape(cr, TOWER_A_X + 150, GROUND, CAST["Mugsy"].top(mug), "140",
                  (0.20, 0.45, 0.80), k)
        stage.scorecard(cr, 1010, 200, "Uprights", "140 units",
                        (0.30, 0.55, 0.85), clamp((T - ta) / 0.4) * cards)
        stage.arrow_down(cr, 300, CLOUD_Y + 96, 40)
    if T > win_t:
        stage.confetti(cr, T - win_t)
        stage.banner(cr, 40, "UPRIGHTS WIN!", clamp((T - win_t) / 0.4),
                     (0.25, 0.62, 0.40))
        stage.chair(cr, 660, GROUND, 0.9, T,
                    glow=clamp((T - win_t - 0.4) / 0.8))


def sc_elimination(cr, sc, beat, T):
    t = T - sc["t0"]
    stage.dark_stage(cr, T, spots=[(380, 150, 1.0), (640, 150, 1.0),
                                   (900, 150, 1.0)])
    votes = SHOW.act_start(sc, "votes")
    for i, name in enumerate(CONDUCTORS):
        x = 380 + i * 260
        stage.podium(cr, x, GROUND + 10, 160, 120)
        p = idle(name, T, y=GROUND + 4, x=x, s=0.92,
                 expr=facial(beat, name, "flat"),
                 mouth=SHOW.mouth(beat, T) if talker(beat, name) else 0.0,
                 look=look_at(x, 1150))
        CAST[name].draw(cr, p, T)
        if votes is not None and T > votes:
            k = clamp((T - votes - i * 0.25) / 0.4)
            if k > 0:
                stage.scorecard(cr, x, 300, name, "vote", CAST[name].tag, k,
                                w=210)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1150, s=1.0,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=SHOW.mouth(beat, T) if talker(beat, "Mega")
                               else 0.0, look=(-1, 0)), T)
    text_at(cr, W / 2, 78, "ELIMINATION", 58, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp(t / 0.6))
    if votes is not None and T > votes:
        text_at(cr, W / 2, 132, "vote in the comments", 30, (1, 1, 1),
                "center", bold=False, alpha=clamp((T - votes) / 0.5))
    stage.vignette(cr, 0.45)


def sc_outro(cr, sc, beat, T):
    end = SHOW.act_start(sc, "endcard", sc["t1"])
    stage.dark_stage(cr, T, spots=[(640, 260, 0.7)])
    if T < end:
        t = T - sc["t0"]
        text_at(cr, W / 2, 150, "NEXT TIME ON", 40, (1, 1, 1), "center",
                alpha=clamp(t / 0.5))
        stage.logo(cr, W / 2, 240, 0.62, clamp(t / 0.5))
        # the Junk Drawer, ominously ajar
        cr.save()
        cr.translate(640, 470)
        k = ease_out(clamp((t - 1.0) / 1.4))
        from draw import rrect, fill_stroke
        rrect(cr, -200, -60, 400, 150, 14)
        fill_stroke(cr, (0.42, 0.30, 0.22), 5.0)
        rrect(cr, -180 + 30 * k, -40, 360, 110, 12)
        fill_stroke(cr, (0.60, 0.44, 0.29), 5.0)
        cr.restore()
        text_at(cr, 640, 618, "THE JUNK DRAWER", 34, (1, 0.86, 0.30),
                "center", alpha=clamp((t - 1.4) / 0.6))
        CAST["Sticky"].draw(cr, pose(180, 346, s=0.7,
                                     rot=math.sin(T * 1.6) * 0.1,
                                     expr=facial(beat, "Sticky", "shock"),
                                     mouth=SHOW.mouth(beat, T)
                                     if talker(beat, "Sticky") else 0.0), T)
        stage.cloud(cr, 180, 352, 0.8)
        CAST["Mega"].draw(cr, idle("Mega", T, x=1120, s=0.95,
                                   expr=facial(beat, "Mega", "smug"),
                                   mouth=SHOW.mouth(beat, T)
                                   if talker(beat, "Mega") else 0.0,
                                   look=(-1, 0)), T)
    else:
        t = T - end
        k = clamp(t / 0.8)
        stage.logo(cr, W / 2, 250, lerp(1.25, 1.0, ease_out(k)), 1.0,
                   sub='Episode 2: "The Junk Drawer"',
                   sub_a=clamp((t - 0.7) / 0.6))
        for i, name in enumerate(CONTESTANTS):
            st = 0.5 + i * 0.16
            if t < st:
                continue
            kk = clamp((t - st) / 0.5)
            CAST[name].draw(cr, pose(150 + i * 196, GROUND + 120 -
                                     bounce(kk) * 120, s=0.92), T)
        text_at(cr, W / 2, 400, "VOTE IN THE COMMENTS", 30, (1, 1, 1),
                "center", alpha=clamp((t - 1.3) / 0.6))
    stage.vignette(cr, 0.4)


SCENE_FN = {
    "cold_open": sc_cold_open, "title": sc_title, "rollcall": sc_rollcall,
    "challenge": sc_challenge, "stack": sc_stack, "results": sc_results,
    "elimination": sc_elimination, "outro": sc_outro,
}


# ----------------------------------------------------------------- frame ---

def draw_frame(cr, T):
    sc, beat = SHOW.locate(T)
    cr.save()
    SCENE_FN[sc["key"]](cr, sc, beat, T)
    cr.restore()

    if beat["kind"] == "say":
        k = clamp((T - beat["t0"]) / 0.12) * clamp((beat["t1"] - T) / 0.14)
        stage.subtitle(cr, beat["who"], beat["text"], CAST[beat["who"]].tag, k)

    # hard cut protection: dip to black across scene boundaries
    fade = 0.0
    if sc["key"] != "title":
        fade = max(clamp(1 - (T - sc["t0"]) / 0.22),
                   clamp(1 - (sc["t1"] - T) / 0.22))
    if T < 0.8:
        fade = max(fade, clamp(1 - T / 0.8))
    if T > TOTAL - 1.2:
        fade = max(fade, clamp(1 - (TOTAL - T) / 1.2))
    if fade > 0:
        stage.flash(cr, fade, (0, 0, 0))


def new_surface():
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    cr = cairo.Context(surf)
    cr.set_antialias(cairo.ANTIALIAS_GOOD)
    return surf, cr


def render(out, t_from=0.0, t_to=TOTAL, with_audio=True, tmp="/tmp"):
    import os
    import time

    wav = os.path.join(tmp, "episode.wav")
    if with_audio:
        buf = audio.build_audio(SHOW.scenes, SHOW.cues, TOTAL)
        buf = buf[int(t_from * audio.SR):int(t_to * audio.SR)]
        audio.write_wav(wav, buf)

    ff = __import__("imageio_ffmpeg").get_ffmpeg_exe()
    cmd = [ff, "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s",
           "%dx%d" % (W, H), "-r", str(FPS), "-i", "-"]
    if with_audio:
        cmd += ["-i", wav, "-c:a", "aac", "-b:a", "160k", "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.PIPE)

    n0, n1 = int(t_from * FPS), int(t_to * FPS)
    surf, cr = new_surface()
    start = time.time()
    for n in range(n0, n1):
        cr.save()
        cr.set_operator(cairo.OPERATOR_SOURCE)
        cr.set_source_rgb(0, 0, 0)
        cr.paint()
        cr.restore()
        draw_frame(cr, n / FPS)
        surf.flush()
        proc.stdin.write(bytes(surf.get_data()))
        if (n - n0) % (FPS * 20) == 0:
            done = max(1, n - n0)
            el = time.time() - start
            print("  %6.1fs / %.0fs  (%.1f fps, eta %.0fs)" %
                  (n / FPS, t_to, done / max(el, 0.01),
                   (n1 - n) / max(done / max(el, 0.01), 0.01)), flush=True)
    proc.stdin.close()
    err = proc.stderr.read().decode()[-1500:]
    if proc.wait() != 0:
        raise SystemExit("ffmpeg failed:\n" + err)
    print("wrote", out, "in %.0fs" % (time.time() - start))


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--frame" in args:
        i = args.index("--frame")
        T = float(args[i + 1])
        out = args[i + 2]
        surf, cr = new_surface()
        cr.set_source_rgb(0, 0, 0)
        cr.paint()
        draw_frame(cr, T)
        surf.write_to_png(out)
        print("wrote", out)
    else:
        out = args[0]
        t_from = float(args[args.index("--from") + 1]) if "--from" in args else 0.0
        t_to = float(args[args.index("--to") + 1]) if "--to" in args else TOTAL
        tmp = args[args.index("--tmp") + 1] if "--tmp" in args else "/tmp"
        render(out, t_from, t_to, tmp=tmp)
