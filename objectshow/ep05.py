"""Odds & Ends, episode 5: "The Dishwasher".

Clip lost the vote, which left two contestants, which is not a show.  Three
new objects arrive out of the dishwasher, and then everyone goes back into it.
"""

import math

import ep04
import stage
from cast import CAST, pose
from draw import (GROUND, H, W, bounce, clamp, ease_back, ease_in_out,
                  ease_out, lerp, rand01, set_rgb, text_at)
from engine import Show, camera, facial, idle, look_at, speaks, talker
from timeline import A, S

TOTAL = 300.0
OLD = ["Mugsy", "Cone"]
NEW = ["Spork", "Mitt", "Plate"]
FIELD = OLD + NEW
NOMINEES = ["Mugsy", "Cone", "Spork", "Mitt"]
DRAWER_CREW = ["Volt", "Cube", "Sticky", "Clip"]


BEATS = [
    dict(key="recap", beats=[
        A(2.4, "flash1"),
        S("Mega", "Previously, on Odds and Ends:", "smug", act="flash1"),
        S("Mega", "the light went out, and a bin took a menu.", "happy",
          act="flash1"),
        A(1.0, "flash2"),
        S("Mega", "Mugsy hid in a cupboard, and won.", "smug", act="flash2"),
        A(1.2, "flash3"),
        S("Mega", "And then you voted.", "happy", act="flash3"),
        A(3.0, "flash3"),
    ]),

    dict(key="title", beats=[
        A(8.4, "logo"),
    ]),

    dict(key="vote", beats=[
        A(2.6, "stage"),
        S("Mega", "Two of you are up. The votes are in.", "smug", act="stage"),
        A(1.2, "tally_Cone"),
        S("Mega", "Cone: twenty-four.", "happy", act="tally_Cone"),
        S("Cone", "Without the rulebook I am simply a cone.", "sad",
          act="tally_Cone"),
        S("Cone", "May I have the menu back?", "sad", act="tally_Cone"),
        S("Mega", "The bin has it.", "flat", act="tally_Cone"),
        A(1.4, "tally_Clip"),
        S("Mega", "Clip: thirty-one.", "smug", act="tally_Clip"),
        S("Clip", "Thirty-one? For running away from a BIN?", "furious",
          act="tally_Clip"),
        S("Mega", "You ran a long way.", "smug", act="tally_Clip"),
        A(1.8, "verdict"),
        S("Mega", "Clip. You have been eliminated.", "flat", act="verdict"),
        S("Clip", "Fine. FINE. I will be in the drawer, being iconic.",
          "angry", act="fling"),
        A(3.0, "fling"),
        S("Volt", "No. Absolutely not. It is FULL.", "furious",
          act="slam_shut"),
        S("Sticky", "There is room if we all lean!", "happy",
          act="slam_shut"),
        S("Cube", "I am ninety percent water and I am being squeezed.",
          "worried", act="slam_shut"),
        S("Clip", "Hello, everyone. I have notes.", "smug", act="slam_shut"),
        A(2.4, "slam_shut"),
    ]),

    dict(key="arrivals", beats=[
        A(3.0, "two"),
        S("Mega", "That leaves two contestants.", "flat", act="two"),
        S("Mugsy", "Two is not a show.", "worried", act="two"),
        S("Cone", "Two is barely a rivalry.", "flat", act="two"),
        S("Mega", "Correct. Which is why I have hired three.", "smug",
          act="two"),
        A(3.4, "door"),
        S("Mega", "Fresh out of the dishwasher: your new contestants!",
          "happy", act="door"),
        A(2.2, "meet_Spork"),
        S("Spork", "Hi! I am a fork! And a spoon! At the same time!",
          "happy", act="meet_Spork"),
        S("Spork", "Is that a problem? It feels like a problem.", "worried",
          act="meet_Spork"),
        A(2.2, "meet_Mitt"),
        S("Mitt", "Hello, small friends. I have held a casserole at two "
          "hundred degrees.", "happy", act="meet_Mitt"),
        S("Mitt", "Are we all friends? We are all friends.", "happy",
          act="meet_Mitt"),
        S("Mugsy", "That is a threat. Is that a threat?", "shock",
          act="meet_Mitt"),
        S("Mitt", "It is a fact. I keep them nearby.", "happy",
          act="meet_Mitt"),
        A(2.2, "meet_Plate"),
        S("Plate", "I am dishwasher safe. Top rack. Every time.", "smug",
          act="meet_Plate"),
        S("Cone", "That is not a personality.", "flat", act="meet_Plate"),
        S("Plate", "It is written on the back of me.", "smug",
          act="meet_Plate"),
        S("Cone", "...I withdraw the objection.", "flat", act="meet_Plate"),
        A(3.0, "meet_Plate"),
    ]),

    dict(key="cycle", beats=[
        S("Mega", "Today's challenge is where three of you were made.",
          "smug", act="brief"),
        S("Mega", "THE DISHWASHER. One full cycle.", "happy", act="brief"),
        S("Mega", "Come out cleanest and you win immunity.", "happy",
          act="brief"),
        S("Mugsy", "I am a mug. This is either my dream or my death.",
          "worried", act="brief"),
        S("Mega", "It is both! In you go.", "smug", act="start"),
        A(3.6, "start"),
        A(3.0, "wash"),
        S("Spork", "I am slipping through the rack. I am SLIPPING—", "shock",
          act="sink"),
        A(2.8, "sink"),
        S("Mitt", "I am getting heavier.", "flat", act="wash"),
        S("Mitt", "This is fine. This is what I was made for.", "happy",
          act="wash"),
        S("Plate", "This is my Tuesday.", "smug", act="wash"),
        S("Plate", "Everyone please stop touching the racks.", "smug",
          act="wash"),
        A(3.2, "wash"),
        S("Cone", "I do not think I am rated for this temperature.", "worried",
          act="warp"),
        S("Mugsy", "It is warm. It is actually really warm.", "happy",
          act="wash"),
        A(3.6, "warp"),
        S("Cone", "I am warping. I can feel myself becoming a new shape.",
          "shock", act="warp"),
        S("Mugsy", "Cone, you are a different shape!", "shock",
          act="warp"),
        S("Plate", "Try to warp evenly.", "smug", act="warp"),
        A(3.2, "wash"),
        S("Mitt", "I am now a soup.", "flat", act="wash"),
        S("Spork", "I have reached the bottom! There is a bottom!", "shock",
          act="sink"),
        A(3.4, "wash"),
        S("Spork", "Hello? From the bottom? Hello?", "worried",
          act="wash"),
        S("Mugsy", "I have never been this clean. I can see myself in me.",
          "happy", act="wash"),
        A(3.0, "endcycle"),
    ]),

    dict(key="results", beats=[
        A(2.6, "line"),
        S("Mega", "Cycle complete. Inspection.", "smug", act="line"),
        A(1.4, "inspect_Mugsy"),
        S("Mega", "Mugsy: spotless.", "happy", act="inspect_Mugsy"),
        S("Mugsy", "I would like that on the record.", "happy",
          act="inspect_Mugsy"),
        A(1.2, "inspect_Mitt"),
        S("Mega", "Mitt: waterlogged.", "flat", act="inspect_Mitt"),
        S("Mitt", "I will dry by Thursday.", "happy", act="inspect_Mitt"),
        A(1.2, "inspect_Spork"),
        S("Mega", "Spork: found at the bottom, as predicted.", "flat",
          act="inspect_Spork"),
        S("Spork", "Cutlery always falls through! It is the one thing I "
          "know!", "shock", act="inspect_Spork"),
        A(1.2, "inspect_Cone"),
        S("Mega", "Cone: warped.", "flat", act="inspect_Cone"),
        S("Cone", "I am a slightly different cone.", "sad",
          act="inspect_Cone"),
        S("Cone", "I would like to protest the temperature.", "flat",
          act="inspect_Cone"),
        A(1.2, "inspect_Plate"),
        S("Mega", "Plate: immaculate.", "happy", act="inspect_Plate"),
        S("Plate", "Top. Rack.", "smug", act="inspect_Plate"),
        A(2.4, "win"),
        S("Mega", "PLATE WINS IMMUNITY!", "happy", act="win"),
        S("Plate", "I would like to thank the machine.", "smug", act="win"),
        A(3.0, "win"),
    ]),

    dict(key="elimination", beats=[
        A(2.6, "stage2"),
        S("Mega", "Mugsy. Cone. Spork. Mitt. All four of you are up.", "smug",
          act="podium"),
        S("Spork", "On my FIRST DAY?", "shock", act="podium"),
        S("Mega", "Especially on your first day.", "smug", act="podium"),
        S("Mugsy", "I was spotless!", "worried", act="podium"),
        S("Mega", "Spotless is not immune.", "flat", act="podium"),
        A(1.6, "votes"),
        S("Mega", "Viewers: vote in the comments.", "happy", act="votes"),
        S("Clip", "Vote for whoever will fit in here.", "smug", act="votes"),
        S("Volt", "NOBODY fits in here.", "furious", act="votes"),
        A(3.2, "votes"),
    ]),

    dict(key="outro", beats=[
        A(1.8, "next"),
        S("Mega", "Next time, on Odds and Ends:", "happy", act="next"),
        S("Mega", "the fridge opens.", "smug", act="next"),
        S("Cube", "Is it cold in there?", "worried", act="next"),
        S("Mega", "Yes.", "flat", act="next"),
        S("Cube", "...Finally.", "happy", act="next"),
        A(2.4, "next"),
        A(6.5, "endcard"),
    ]),
]


# ---------------------------------------------------------------- scenes ---

VOTES = {"Cone": 24, "Clip": 31}
VOTE_X = {"Cone": 420, "Clip": 660}
VOTE_DRAWER_X = 1010
DRAWER_X = 150
CREW_DX = {"Volt": -96, "Cube": -32, "Sticky": 32, "Clip": 96}
DW_X = 1080
ARRIVE_X = {"Spork": 620, "Mitt": 760, "Plate": 900}
WASH_X = {"Mugsy": 240, "Cone": 430, "Spork": 620, "Mitt": 810, "Plate": 1000}
LINE_X = {"Mugsy": 300, "Cone": 470, "Spork": 640, "Mitt": 810,
          "Plate": 980}
CLEAN = {"Mugsy": "spotless", "Mitt": "waterlogged", "Spork": "at the bottom",
         "Cone": "warped", "Plate": "immaculate"}
ELIM_X = {n: 300 + i * 190 for i, n in enumerate(NOMINEES)}


def crew(cr, show, sc, beat, T, x=DRAWER_X, scale=0.45, w=300):
    """The drawer, now standing room only."""
    stage.drawer(cr, x, GROUND + 20, w, 150, open_k=1.0, t=T)
    for name in DRAWER_CREW:
        CAST[name].draw(cr, pose(x + CREW_DX[name], GROUND - 24, s=scale,
                                 rot=0.2 if name == "Sticky" else 0.0,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T)), T)


def sparkle_ring(cr, x, y, T, k=1.0, n=6, r=90):
    for i in range(n):
        a = i / n * math.tau + T * 1.6
        px, py = x + math.cos(a) * r, y + math.sin(a) * r * 0.6
        cr.save()
        cr.translate(px, py)
        cr.rotate(T * 3 + i)
        set_rgb(cr, (1, 0.98, 0.75), 0.85 * k)
        cr.rectangle(-2.5, -10, 5, 20)
        cr.rectangle(-10, -2.5, 20, 5)
        cr.fill()
        cr.restore()


def sc_recap(cr, show, sc, beat, T):
    show4 = ep04.EPISODE
    clips = {"flash1": (196.0, 7.0), "flash2": (243.0, 5.0),
             "flash3": (272.0, 6.0)}
    t0, t1, act = show.act_span(sc, T)
    src, span = clips.get(act, clips["flash1"])
    lt = T - t0
    T4 = src + lt * (span / max(0.6, t1 - t0))
    sc4, beat4 = show4.locate(T4)
    cr.save()
    show4.fn[sc4["key"]](cr, show4, sc4, beat4, T4)
    cr.restore()
    set_rgb(cr, (0.96, 0.80, 0.42), 0.10)
    cr.rectangle(0, 0, W, H)
    cr.fill()
    stage.vignette(cr, 0.45)
    stage.flash(cr, (1 - clamp(lt / 0.30)) * 0.85)
    from draw import rrect
    rrect(cr, 28, 26, 318, 46, 12)
    set_rgb(cr, (0.12, 0.11, 0.18), 0.85)
    cr.fill()
    text_at(cr, 187, 58, "PREVIOUSLY ON...", 26, (1, 0.86, 0.30), "center")


def sc_title(cr, show, sc, beat, T):
    t = T - sc["t0"]
    set_rgb(cr, (0.16, 0.42, 0.55))
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
    stage.bubbles(cr, t * 0.8, 18, "title", 0.8)
    slam = show.cue_at["slam"][0] - sc["t0"]
    if t > slam - 0.5:
        k = clamp((t - slam + 0.45) / 0.55)
        stage.logo(cr, W / 2, 300, lerp(3.4, 1.0, ease_out(k)), 1.0,
                   sub='Episode 5: "The Dishwasher"'
                   if t > slam + 0.9 else None,
                   sub_a=clamp((t - slam - 0.9) / 0.5))
    fl = show.since("slam", T, 0.35)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.35) * 0.55)
    for i, name in enumerate(["Mugsy", "Cone"] + NEW):
        st = slam + 1.7 + i * 0.28
        if t < st:
            continue
        k = clamp((t - st) / 0.55)
        CAST[name].draw(cr, pose(230 + i * 205, GROUND + 120 - bounce(k) * 120,
                                 s=0.92, sq=1 + 0.12 * (1 - k)), T)


def sc_vote(cr, show, sc, beat, T):
    verdict = show.act_start(sc, "verdict")
    fling = show.act_start(sc, "fling")
    shake = 0.0
    sl = show.since("slam", T, 0.6)
    shut = show.act_start(sc, "slam_shut")
    if sl is not None and shut is not None and T > shut:
        shake = 10 * (1 - sl / 0.6)
    cr.save()
    camera(cr, 1.0, W / 2, H / 2, shake, T)
    stage.dark_stage(cr, T, spots=[(VOTE_X[n], 130, 1.0) for n in VOTE_X])
    flying = fling is not None and T > fling + 0.15
    gone = fling is not None and T > fling + 1.15
    for name in ("Cone", "Clip"):
        x = VOTE_X[name]
        stage.podium(cr, x, GROUND + 10, 140, 120)
        if not (name == "Clip" and flying):
            CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.85,
                                     expr=facial(beat, name, "flat"),
                                     mouth=speaks(show, beat, name, T),
                                     look=look_at(x, 1200)), T)
        ts = show.act_start(sc, "tally_" + name)
        if ts is not None and T > ts:
            k = ease_out(clamp((T - ts) / 0.9))
            col = CAST[name].tag
            if name == "Clip" and verdict is not None and T > verdict:
                col = (0.95, 0.30, 0.28) if int(T * 4) % 2 else (1, 0.75, 0.3)
            stage.scorecard(cr, x, 236, name,
                            "%d votes" % int(round(VOTES[name] * k)), col,
                            clamp((T - ts) / 0.35), w=188, size=30)
    if flying and not gone:
        f = clamp((T - fling - 0.15) / 1.0)
        CAST["Clip"].draw(cr, pose(lerp(VOTE_X["Clip"], VOTE_DRAWER_X, f),
                                   GROUND - math.sin(f * math.pi) * 250,
                                   rot=f * 6.0, expr="angry"), T)
    open_from = verdict if verdict is not None else fling
    if open_from is not None and T > open_from - 0.4:
        k = ease_out(clamp((T - open_from + 0.4) / 1.1))
        x = lerp(1660, VOTE_DRAWER_X, k)
        stage.drawer(cr, x, GROUND, 330, 190, open_k=1.0, t=T, glow=0.6)
        for name in DRAWER_CREW:
            if name == "Clip" and not gone:
                continue
            CAST[name].draw(cr, pose(x + CREW_DX[name] * 1.05, GROUND - 44,
                                     s=0.48,
                                     rot=0.2 if name == "Sticky" else 0.0,
                                     expr=facial(beat, name, "flat"),
                                     mouth=speaks(show, beat, name, T)), T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1225, s=0.85,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    cr.restore()
    text_at(cr, W / 2, 70, "THE VOTE", 52, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    stage.vignette(cr, 0.45)


def sc_arrivals(cr, show, sc, beat, T):
    door = show.act_start(sc, "door")
    door_k = 0.0 if door is None else ease_out(clamp((T - door - 0.2) / 1.2))
    stage.kitchen_night(cr, T, light=1.0)
    stage.dishwasher_front(cr, DW_X, GROUND, 1.0, door_k, T, glow=door_k)
    if door_k > 0.2:
        stage.steam(cr, DW_X - 40, GROUND - 90, T, door_k * 0.9, "dw", 8, 220)

    for i, name in enumerate(OLD):
        x = 350 + i * 140
        CAST[name].draw(cr, idle(name, T, x=x, s=0.95,
                                 expr=facial(beat, name),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, DW_X)), T)
    for name in NEW:
        ms = show.act_start(sc, "meet_" + name)
        if ms is None or T < ms - 0.9:
            continue
        k = ease_out(clamp((T - ms + 0.9) / 1.4))
        x = lerp(DW_X - 60, ARRIVE_X[name], k)
        p = idle(name, T, x=x, s=0.95, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=look_at(x, 200))
        if k < 1:
            p["step"] = T * 10
        CAST[name].draw(cr, p, T)
        if T < ms + 3.0:
            sparkle_ring(cr, x, GROUND - 90, T,
                         clamp(1 - (T - ms) / 3.0) * 0.8, 6, 96)
    CAST["Mega"].draw(cr, idle("Mega", T, x=180, s=1.0,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True), T)
    for name in NEW:
        ms = show.act_start(sc, "meet_" + name)
        if ms is not None and ms <= T < ms + 4.2:
            ch = CAST[name]
            stage.nameplate(cr, W / 2, 84, ch.name, ch.blurb, ch.tag,
                            clamp((T - ms) / 0.4) * clamp((ms + 4.2 - T) / 0.4))


def sc_cycle(cr, show, sc, beat, T):
    start = show.act_start(sc, "start")
    endc = show.act_start(sc, "endcycle")
    sink = show.act_start(sc, "sink")
    warp = show.act_start(sc, "warp")
    run = 0.0 if start is None else clamp((T - start - 0.6) / 1.6)
    if endc is not None and T > endc:
        run *= 1 - clamp((T - endc) / 1.2)
    water = run * (0.10 + 0.16 * (0.5 + 0.5 * math.sin(T * 0.5)))

    shake = 1.2 * run
    cr.save()
    camera(cr, 1.0, W / 2, H / 2, shake, T)
    stage.dishwasher_inside(cr, T, water=water, spray=run,
                            steam_k=0.5 * run + (0.8 if endc is not None
                                                 and T > endc else 0.0))
    for name in FIELD:
        x = WASH_X[name]
        p = idle(name, T, x=x, s=0.95, expr=facial(beat, name, "worried"),
                 mouth=speaks(show, beat, name, T))
        p["x"] += math.sin(T * 2.2 + rand01(name) * 5) * 5 * run
        if name == "Spork" and sink is not None and T > sink:
            k = ease_in_out(clamp((T - sink) / 2.0))
            p["y"] = GROUND + 150 * k
            p["expr"] = beat["expr"] if talker(beat, "Spork") else "shock"
        if name == "Mitt" and run > 0:
            p["sq"] = lerp(1.0, 0.80, run)
        if name == "Cone" and warp is not None and T > warp:
            k = clamp((T - warp) / 6.0)
            p["rot"] = math.sin(T * 1.4) * 0.10 * k + 0.12 * k
            p["sq"] = lerp(1.0, 0.86, k)
        if name == "Plate":
            p["expr"] = beat["expr"] if talker(beat, "Plate") else "smug"
        if name == "Mugsy" and run > 0.5:
            p["expr"] = beat["expr"] if talker(beat, "Mugsy") else "happy"
        CAST[name].draw(cr, p, T)
        if name == "Plate" and run > 0.4:
            sparkle_ring(cr, x, GROUND - 60, T, 0.5 * run, 4, 74)
    cr.restore()
    if start is not None and T > start:
        stage.timer(cr, max(0.0, (endc or sc["t1"]) - T), warn=run < 0.4,
                    k=clamp((T - start) / 0.6))
    if endc is not None and T > endc:
        stage.flash(cr, clamp(1 - (T - endc) / 0.6) * 0.5)
        text_at(cr, W / 2, 130, "CYCLE COMPLETE", 62, (1, 0.98, 0.85),
                "center", outline=(0.12, 0.11, 0.18), outline_w=11,
                alpha=clamp((T - endc) / 0.4))


def sc_results(cr, show, sc, beat, T):
    win = show.act_start(sc, "win")
    t0, t1, act = show.act_span(sc, T)
    focus = act.split("_", 1)[1] if act and act.startswith("inspect_") else None
    zoom, cx = 1.0, W / 2
    if focus and (win is None or T < win):
        k = ease_in_out(clamp((T - t0) / 0.55))
        zoom, cx = lerp(1.0, 1.28, k), lerp(W / 2, LINE_X[focus] + 20, k)
    cr.save()
    camera(cr, zoom, cx, 420)
    stage.kitchen_night(cr, T, light=1.0)
    crew(cr, show, sc, beat, T, x=120, scale=0.42, w=250)

    for name in FIELD:
        x = LINE_X[name]
        p = idle(name, T, x=x, s=0.92, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=(1, 0))
        if name == "Cone":
            p["rot"] = 0.14 + math.sin(T * 1.2) * 0.03
            p["sq"] = 0.88
            p["expr"] = beat["expr"] if talker(beat, "Cone") else "sad"
        if name == "Mitt":
            p["sq"] = 0.82
        if name == "Spork":
            p["y"] += 6
            p["expr"] = beat["expr"] if talker(beat, "Spork") else "worried"
        if name == "Plate" and win is not None and T > win:
            p["y"] -= abs(math.sin((T - win) * 5)) * 18
        CAST[name].draw(cr, p, T)
        if name in ("Plate", "Mugsy"):
            sparkle_ring(cr, x, GROUND - 80, T, 0.7, 5, 82)
        if name == "Mitt":
            ds = show.since("drip", T, 0.6)
            stage.puddle(cr, x, GROUND - 4, 40)
        if name == "Cone" and focus == "Cone":
            text_at(cr, x, GROUND - 210, "NOT DISHWASHER SAFE", 24,
                    (0.95, 0.35, 0.32), "center",
                    outline=(0.12, 0.11, 0.18), outline_w=7)
    if win is not None and T > win:
        stage.crown(cr, LINE_X["Plate"], GROUND - 190,
                    ease_back(clamp((T - win) / 0.5)))
    CAST["Mega"].draw(cr, idle("Mega", T, x=1180, s=0.95,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    cr.restore()
    if focus and (win is None or T < win):
        stage.scorecard(cr, W / 2, 60, focus, CLEAN[focus], CAST[focus].tag,
                        clamp((T - t0) / 0.4), w=440, size=34)
    if win is not None and T > win:
        stage.confetti(cr, T - win)
        stage.banner(cr, 40, "PLATE WINS IMMUNITY!", clamp((T - win) / 0.4),
                     (0.30, 0.52, 0.82))


def sc_elimination(cr, show, sc, beat, T):
    votes = show.act_start(sc, "votes")
    stage.dark_stage(cr, T, spots=[(ELIM_X[n], 110, 1.0) for n in NOMINEES] +
                     [(1060, 110, 0.7)])
    crew(cr, show, sc, beat, T, x=120, scale=0.40, w=250)
    for name in NOMINEES:
        x = ELIM_X[name]
        stage.podium(cr, x, GROUND + 10, 120, 120)
        CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.74,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, 1150)), T)
        if votes is not None and T > votes:
            k = clamp((T - votes - NOMINEES.index(name) * 0.18) / 0.4)
            stage.scorecard(cr, x, 290, name, "vote", CAST[name].tag, k,
                            w=160, size=30)
    CAST["Plate"].draw(cr, idle("Plate", T, x=1060, s=0.74,
                                expr=facial(beat, "Plate", "smug"),
                                mouth=speaks(show, beat, "Plate", T),
                                look=(-1, 0)), T)
    stage.crown(cr, 1060, GROUND - 130, 0.74)
    text_at(cr, 1060, GROUND + 66, "SAFE", 22, (0.4, 0.9, 0.5), "center",
            outline=(0.12, 0.11, 0.18), outline_w=6)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1200, s=0.85,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    text_at(cr, W / 2, 70, "ELIMINATION", 52, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    if votes is not None and T > votes:
        text_at(cr, W / 2, 118, "vote in the comments", 28, (1, 1, 1),
                "center", bold=False, alpha=clamp((T - votes) / 0.5))
    stage.vignette(cr, 0.45)


def fridge(cr, x, y, s, t):
    from draw import circle, fill_stroke, rrect
    if s <= 0.002:
        return
    cr.save()
    cr.translate(x, y)
    cr.scale(s, s)
    rrect(cr, -110, -300, 220, 300, 16)
    fill_stroke(cr, (0.80, 0.83, 0.88), 5.5)
    cr.move_to(-104, -196)
    cr.line_to(104, -196)
    stroke_out = __import__("draw").stroke_out
    stroke_out(cr, 5.0)
    rrect(cr, 70, -280, 16, 70, 7)
    fill_stroke(cr, (0.55, 0.58, 0.64), 4.0)
    rrect(cr, 70, -180, 16, 120, 7)
    fill_stroke(cr, (0.55, 0.58, 0.64), 4.0)
    set_rgb(cr, (0.62, 0.86, 0.98), 0.35 + 0.2 * math.sin(t * 2.5))
    rrect(cr, -104, -190, 208, 182, 10)
    cr.fill()
    circle(cr, -40, -120, 5)
    cr.restore()


def sc_outro(cr, show, sc, beat, T):
    end = show.act_start(sc, "endcard", sc["t1"])
    stage.dark_stage(cr, T, spots=[(640, 260, 0.7)])
    if T < end:
        t = T - sc["t0"]
        text_at(cr, W / 2, 130, "NEXT TIME ON", 40, (1, 1, 1), "center",
                alpha=clamp(t / 0.5))
        stage.logo(cr, W / 2, 220, 0.62, clamp(t / 0.5))
        fridge(cr, 660, GROUND, 0.92 * ease_out(clamp((t - 0.8) / 0.9)), T)
        crew(cr, show, sc, beat, T, x=180, scale=0.42, w=260)
        CAST["Mega"].draw(cr, idle("Mega", T, x=1120, s=0.9,
                                   expr=facial(beat, "Mega", "smug"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(-1, 0)), T)
    else:
        t = T - end
        stage.logo(cr, W / 2, 250, lerp(1.25, 1.0, ease_out(clamp(t / 0.8))),
                   1.0, sub='Episode 6: "The Fridge"',
                   sub_a=clamp((t - 0.7) / 0.6))
        for i, name in enumerate(FIELD):
            st = 0.5 + i * 0.16
            if t < st:
                continue
            k = clamp((t - st) / 0.5)
            CAST[name].draw(cr, pose(230 + i * 205,
                                     GROUND + 120 - bounce(k) * 120,
                                     s=0.92), T)
        text_at(cr, W / 2, 400, "VOTE IN THE COMMENTS", 30, (1, 1, 1),
                "center", alpha=clamp((t - 1.3) / 0.6))
    stage.vignette(cr, 0.4)


SCENE_FN = {
    "recap": sc_recap, "title": sc_title, "vote": sc_vote,
    "arrivals": sc_arrivals, "cycle": sc_cycle, "results": sc_results,
    "elimination": sc_elimination, "outro": sc_outro,
}

EPISODE = Show("ep05", 'Episode 5: "The Dishwasher"', BEATS, TOTAL, SCENE_FN)
