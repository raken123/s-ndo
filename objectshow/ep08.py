"""Odds & Ends, episode 8: "Bin Day".  The final.

Spork lost the vote from inside a hedge.  Two objects are left, the recycling
bin is doing its rounds, and the Last Good Chair has been in the shed since
episode 1.
"""

import math

import ep07
import stage
from cast import CAST, pose
from draw import (GROUND, H, W, bounce, clamp, ease_back, ease_in_out,
                  ease_out, lerp, rand01, set_rgb, text_at)
from engine import (Show, camera, facial, glow_eyes, idle, look_at,
                    silhouette, speaks, talker)
from timeline import A, S

TOTAL = 300.0
FINAL_TWO = ["Mugsy", "Cone"]
DRAWER_CREW = ["Volt", "Cube", "Sticky", "Clip", "Mitt", "Plate", "Spork"]


BEATS = [
    dict(key="recap", beats=[
        A(2.4, "flash1"),
        S("Mega", "Previously, on Odds and Ends:", "smug", act="flash1"),
        S("Mega", "the objects crossed a motorway.", "happy", act="flash1"),
        A(1.0, "flash2"),
        S("Mega", "A cone became infrastructure.", "smug", act="flash2"),
        A(1.2, "flash3"),
        S("Mega", "And then you voted.", "happy", act="flash3"),
        A(3.0, "flash3"),
    ]),

    dict(key="title", beats=[
        A(8.4, "logo"),
    ]),

    dict(key="vote", beats=[
        A(2.6, "stage"),
        S("Mega", "Two of you are up. The votes are in.", "smug",
          act="stage"),
        A(1.4, "tally_Mugsy"),
        S("Mega", "Mugsy: twenty-two.", "happy", act="tally_Mugsy"),
        S("Mugsy", "I have stopped celebrating these.", "flat",
          act="tally_Mugsy"),
        A(1.4, "tally_Spork"),
        S("Mega", "Spork: thirty-five.", "smug", act="tally_Spork"),
        S("Spork", "From a HEDGE. You voted me out of a HEDGE.", "shock",
          act="tally_Spork"),
        A(1.8, "verdict"),
        S("Mega", "Spork. You have been eliminated.", "flat", act="verdict"),
        S("Spork", "I am already outside. This is very efficient.", "flat",
          act="verdict"),
        S("Bin", "...hello.", "happy", act="fling"),
        S("Spork", "OH.", "shock", act="fling"),
        S("Bin", "It is bin day.", "happy", act="fling"),
        A(3.4, "fling"),
        S("Volt", "Is that a spork.", "flat", act="slam_shut"),
        S("Plate", "It is a spork.", "sly", act="slam_shut"),
        S("Clip", "Everyone shuffle up.", "smug", act="slam_shut"),
        S("Mitt", "There is always room.", "beam", act="slam_shut"),
        S("Cube", "There is no up.", "dizzy", act="slam_shut"),
        A(2.4, "slam_shut"),
    ]),

    dict(key="binday", beats=[
        A(3.2, "two"),
        S("Mega", "That leaves two.", "smug", act="two"),
        S("Mega", "Mugsy. Cone. This is the FINAL.", "happy", act="two"),
        S("Mugsy", "The final of what?", "worried", act="two"),
        S("Mega", "Of everything.", "smug", act="two"),
        A(4.0, "roll"),
        S("Mega", "Today's challenge: it is bin day.", "happy", act="roll"),
        S("Bin", "Good morning. I am collecting.", "happy", act="roll"),
        S("Mugsy", "Is the bin allowed to compete?", "worried",
          act="roll"),
        S("Mega", "The bin is not competing. The bin is weather.", "smug",
          act="roll"),
        S("Mega", "The last object not collected wins Odds and Ends.",
          "smug", act="roll"),
        S("Mega", "And the Last Good Chair.", "happy", act="chairtease"),
        S("Mugsy", "The chair? The chair from episode one?", "starry",
          act="chairtease"),
        S("Mega", "It has been in the shed. It is fine.", "flat",
          act="chairtease"),
        S("Cone", "What are the rules?", "flat", act="sort"),
        S("Bin", "Recycling only.", "happy", act="sort"),
        S("Cone", "...I am sorry?", "worried", act="sort"),
        S("Bin", "Recycling only. Are you recycling?", "happy", act="sort"),
        A(3.4, "sort"),
    ]),

    dict(key="collect", beats=[
        A(3.2, "ask"),
        S("Mugsy", "Cone. Cone, what are you made of.", "worried",
          act="ask"),
        S("Cone", "...Plastic.", "flat", act="ask"),
        S("Mugsy", "You are made of plastic.", "shock", act="ask"),
        S("Cone", "I am extremely made of plastic.", "sad", act="ask"),
        A(3.6, "chase"),
        S("Bin", "You are a very good example of recycling.", "happy",
          act="chase"),
        S("Cone", "Thank you. I would rather not be.", "worried",
          act="chase"),
        S("Cone", "Is there an appeal process?", "worried", act="chase"),
        S("Bin", "There is a form. It is inside me.", "happy",
          act="chase"),
        A(4.0, "chase"),
        S("Cone", "I directed traffic! I crossed a motorway!", "shock",
          act="chase"),
        S("Mugsy", "Cone, RUN!", "shock", act="chase"),
        S("Cone", "I do not run. I stand. It is the entire job.", "flat",
          act="chase"),
        S("Bin", "You did. I saw. It was excellent.", "happy", act="chase"),
        A(3.2, "offer"),
        S("Mugsy", "What about ME? Take ME!", "shock", act="offer"),
        S("Bin", "You are ceramic.", "flat", act="offer"),
        S("Mugsy", "Yes!", "happy", act="offer"),
        S("Bin", "Ceramic is not recycling.", "happy", act="offer"),
        S("Mugsy", "I have never been so glad to be a disappointment.",
          "beam", act="offer"),
        S("Bin", "Nothing personal. You go in general waste.", "happy",
          act="offer"),
        S("Mugsy", "That is the nicest thing anyone has said to me.",
          "beam", act="offer"),
        A(3.4, "collected"),
        S("Cone", "Wait. Wait — Mugsy.", "sad", act="collected"),
        S("Mugsy", "Cone?", "worried", act="collected"),
        S("Cone", "You crossed four lanes behind me.", "happy",
          act="collected"),
        S("Cone", "Cross this one on your own.", "happy", act="collected"),
        A(3.8, "collected"),
        S("Bin", "I know. I have always admired it.", "happy",
          act="collected"),
        S("Mugsy", "Cone!", "shock", act="collected"),
        S("Mega", "Cone has been collected.", "flat", act="collected"),
        A(3.2, "collected"),
    ]),

    dict(key="winner", beats=[
        A(3.0, "last"),
        S("Mega", "Mugsy. You are the last object standing.", "smug",
          act="last"),
        S("Mugsy", "I hid. That is all I did. I hid for eight episodes.",
          "worried", act="last"),
        S("Mega", "You did.", "smug", act="last"),
        A(2.4, "last"),
        S("Mega", "MUGSY WINS ODDS AND ENDS!", "happy", act="chair"),
        A(4.0, "chair"),
        S("Mega", "Eight episodes. Nine objects. One chair.", "smug",
          act="chair"),
        S("Mugsy", "That is the chair.", "starry", act="chair"),
        S("Mega", "That is the Last Good Chair.", "smug", act="chair"),
        A(3.2, "curtain_call"),
        S("Sticky", "WE ARE OUT!", "beam", act="curtain_call"),
        S("Volt", "I am out. I am out of the drawer.", "starry",
          act="curtain_call"),
        S("Cube", "Someone open the fridge.", "happy", act="curtain_call"),
        S("Clip", "Speech! SPEECH!", "happy", act="curtain_call"),
        S("Mugsy", "I do not have a speech. I have anxiety.", "worried",
          act="curtain_call"),
        S("Mitt", "That is a speech.", "beam", act="curtain_call"),
        S("Plate", "Congratulations. You are also filthy.", "sly",
          act="curtain_call"),
        S("Spork", "Does this mean I can leave the hedge?", "worried",
          act="curtain_call"),
        S("Cone", "Say something, Mugsy.", "happy", act="curtain_call"),
        S("Mugsy", "...Thanks for going first.", "beam", act="curtain_call"),
        A(3.4, "curtain_call"),
    ]),

    dict(key="finale", beats=[
        A(3.4, "sit"),
        S("Mugsy", "...This chair wobbles.", "flat", act="wobbly"),
        S("Mega", "It is the LAST GOOD CHAIR.", "smug", act="wobbly"),
        S("Mugsy", "It wobbles, Mega.", "flat", act="wobbly"),
        A(2.4, "wobbly"),
        S("Mega", "...It wobbles.", "flat", act="wobbly"),
        S("Volt", "IT HAS ALWAYS WOBBLED!", "furious", act="wobbly"),
        S("Cone", "It has always wobbled, and we have always known.",
          "flat", act="wobbly"),
        S("Sticky", "I love it here!", "beam", act="wobbly"),
        A(3.2, "wrap"),
        S("Mega", "That is our show.", "happy", act="wrap"),
        S("Bin", "Same time next week?", "happy", act="wrap"),
        S("Mega", "Same time next week.", "smug", act="wrap"),
        A(3.6, "wrap"),
    ]),

    dict(key="outro", beats=[
        A(8.0, "endcard"),
    ]),
]


# ---------------------------------------------------------------- scenes ---

VOTES = {"Mugsy": 22, "Spork": 35}
VOTE_X = {"Mugsy": 420, "Spork": 700}
VOTE_BIN_X = 880
CREW_DX = {"Volt": -132, "Cube": -88, "Sticky": -44, "Clip": 0, "Mitt": 44,
           "Plate": 88, "Spork": 132}
CROWD_X = {"Volt": 150, "Cube": 244, "Sticky": 338, "Clip": 432,
           "Mitt": 526, "Plate": 620, "Spork": 714}
CHAIR_X = 840
BIN_HOME = 1040


def crew(cr, show, sc, beat, T, x=130, scale=0.32, w=270, skip=()):
    stage.drawer(cr, x, GROUND + 20, w, 150, open_k=1.0, t=T)
    for name in DRAWER_CREW:
        if name in skip:
            continue
        CAST[name].draw(cr, pose(x + CREW_DX[name] * (w / 300.0),
                                 GROUND - 22, s=scale,
                                 rot=0.2 if name == "Sticky" else 0.0,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T)), T)


def rolling_bin(cr, show, beat, T, x, s=1.5, expr="happy", cone_in=False):
    """The bin, on wheels, with whatever it has already collected."""
    p = pose(x, GROUND, s=s, expr=facial(beat, "Bin", expr),
             mouth=speaks(show, beat, "Bin", T), look=(-1, 0), legs=False)
    CAST["Bin"].draw(cr, p, T)
    from draw import circle, fill_stroke
    for dx in (-46, 46):
        circle(cr, x + dx * s, GROUND - 6, 15 * s)
        fill_stroke(cr, (0.18, 0.18, 0.22), 4.0)
        circle(cr, x + dx * s, GROUND - 6, 5 * s)
        fill_stroke(cr, (0.62, 0.64, 0.68), 3.0)
    if cone_in:
        CAST["Cone"].draw(cr, pose(x - 6, GROUND - 2 * 100 * s + 96, s=0.52,
                                   expr=facial(beat, "Cone", "flat"),
                                   mouth=speaks(show, beat, "Cone", T)), T)


def sc_recap(cr, show, sc, beat, T):
    show7 = ep07.EPISODE
    clips = {"flash1": (150.0, 7.0), "flash2": (176.0, 5.0),
             "flash3": (262.0, 6.0)}
    t0, t1, act = show.act_span(sc, T)
    src, span = clips.get(act, clips["flash1"])
    lt = T - t0
    T7 = src + lt * (span / max(0.6, t1 - t0))
    sc7, beat7 = show7.locate(T7)
    cr.save()
    show7.fn[sc7["key"]](cr, show7, sc7, beat7, T7)
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
    set_rgb(cr, (0.42, 0.16, 0.30))
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
        set_rgb(cr, (1, 0.86, 0.30), 0.06)
        cr.fill()
    cr.restore()
    slam = show.cue_at["slam"][0] - sc["t0"]
    if t > slam - 0.5:
        k = clamp((t - slam + 0.45) / 0.55)
        stage.logo(cr, W / 2, 290, lerp(3.4, 1.0, ease_out(k)), 1.0,
                   sub='Episode 8: "Bin Day"' if t > slam + 0.9 else None,
                   sub_a=clamp((t - slam - 0.9) / 0.5))
        text_at(cr, W / 2, 372, "SERIES FINALE", 34, (1, 0.86, 0.30),
                "center", outline=(0.12, 0.11, 0.18), outline_w=8,
                alpha=clamp((t - slam - 1.4) / 0.5))
    fl = show.since("slam", T, 0.35)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.35) * 0.55)
    for i, name in enumerate(["Mugsy", "Cone", "Spork"]):
        st = slam + 1.7 + i * 0.28
        if t < st:
            continue
        k = clamp((t - st) / 0.55)
        CAST[name].draw(cr, pose(400 + i * 240, GROUND + 120 - bounce(k) * 120,
                                 s=0.92, sq=1 + 0.12 * (1 - k)), T)


def sc_vote(cr, show, sc, beat, T):
    verdict = show.act_start(sc, "verdict")
    fling = show.act_start(sc, "fling")
    shut = show.act_start(sc, "slam_shut")
    stage.dark_stage(cr, T, spots=[(VOTE_X[n], 130, 1.0) for n in VOTE_X])
    gone = fling is not None and T > fling + 2.4

    for name in ("Mugsy", "Spork"):
        x = VOTE_X[name]
        stage.podium(cr, x, GROUND + 10, 140, 120)
        if name == "Spork":
            stage.hedge(cr, x, GROUND - 16, 0.6)
            if gone:
                continue
        CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.82,
                                 rot=0.3 if name == "Spork" else 0.0,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, 1200)), T)
        ts = show.act_start(sc, "tally_" + name)
        if ts is not None and T > ts:
            k = ease_out(clamp((T - ts) / 0.9))
            col = CAST[name].tag
            if name == "Spork" and verdict is not None and T > verdict:
                col = (0.95, 0.30, 0.28) if int(T * 4) % 2 else (1, 0.75, 0.3)
            stage.scorecard(cr, x, 230, name,
                            "%d votes" % int(round(VOTES[name] * k)), col,
                            clamp((T - ts) / 0.35), w=190, size=30)
    if fling is not None and T > fling - 1.2:
        k = ease_out(clamp((T - fling + 1.2) / 1.8))
        rolling_bin(cr, show, beat, T, lerp(1560, VOTE_BIN_X, k), 1.35)
    crew(cr, show, sc, beat, T, x=1190, scale=0.30, w=250,
         skip=() if gone else ("Spork",))
    CAST["Mega"].draw(cr, idle("Mega", T, x=200, s=0.85,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True), T)
    text_at(cr, W / 2, 70, "THE VOTE", 52, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    stage.vignette(cr, 0.45)


def sc_binday(cr, show, sc, beat, T):
    roll = show.act_start(sc, "roll")
    stage.kitchen_night(cr, T, light=1.0)
    crew(cr, show, sc, beat, T, x=130, scale=0.30, w=250)
    for i, name in enumerate(FINAL_TWO):
        x = 520 + i * 150
        CAST[name].draw(cr, idle(name, T, x=x, s=0.95,
                                 expr=facial(beat, name),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, 950)), T)
    if roll is not None and T > roll - 0.6:
        k = ease_out(clamp((T - roll + 0.6) / 2.0))
        rolling_bin(cr, show, beat, T, lerp(1620, 960, k), 1.5)
    CAST["Mega"].draw(cr, idle("Mega", T, x=330, s=0.9,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True), T)
    if roll is not None and T < roll + 6.5:
        stage.banner(cr, 46, "THE FINAL: BIN DAY",
                     clamp((T - roll) / 0.5) * clamp((roll + 6.5 - T) / 0.4),
                     (0.24, 0.45, 0.66))


def sc_collect(cr, show, sc, beat, T):
    chase = show.act_start(sc, "chase")
    coll = show.act_start(sc, "collected")
    taken = coll is not None and T > coll + 5.0

    stage.kitchen_night(cr, T, light=1.0)
    crew(cr, show, sc, beat, T, x=130, scale=0.30, w=250)

    cone_x, bin_x = 660, 960
    if chase is not None and T > chase:
        k = ease_in_out(clamp((T - chase) / 6.0))
        cone_x = lerp(660, 300, k)
        bin_x = lerp(960, 470, k)
    if coll is not None and T > coll:
        k = ease_in_out(clamp((T - coll) / 4.0))
        cone_x = lerp(cone_x, bin_x - 40, k)

    mug_x = 520
    if chase is not None and T > chase:
        mug_x = lerp(520, 850, ease_in_out(clamp((T - chase - 1.0) / 2.0)))
    CAST["Mugsy"].draw(cr, idle("Mugsy", T, x=mug_x, s=0.95,
                                expr=facial(beat, "Mugsy", "shock"),
                                mouth=speaks(show, beat, "Mugsy", T),
                                look=(-1, 0)), T)
    if not taken:
        cp = idle("Cone", T, x=cone_x, s=0.95,
                  expr=facial(beat, "Cone", "worried"),
                  mouth=speaks(show, beat, "Cone", T), look=(1, 0))
        if chase is not None and T > chase and (coll is None or T < coll):
            cp["step"] = T * 13
        CAST["Cone"].draw(cr, cp, T)
    rolling_bin(cr, show, beat, T, bin_x, 1.5, cone_in=taken)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1180, s=0.9,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    if taken and T < coll + 7.0:
        text_at(cr, W / 2, 96, "CONE HAS BEEN COLLECTED", 40, (1, 1, 1),
                "center", outline=(0.12, 0.11, 0.18), outline_w=9,
                alpha=clamp((T - coll - 5.0) / 0.5))


def sc_winner(cr, show, sc, beat, T):
    chair = show.act_start(sc, "chair")
    call = show.act_start(sc, "curtain_call")
    out = call is not None and T > call - 1.0

    stage.kitchen_night(cr, T, light=1.0)
    if not out:
        crew(cr, show, sc, beat, T, x=130, scale=0.30, w=250)
    else:
        stage.drawer(cr, 130, GROUND + 20, 250, 150, open_k=1.0, t=T)
    if chair is not None and T > chair:
        k = ease_out(clamp((T - chair - 0.6) / 1.4))
        stage.chair(cr, CHAIR_X, GROUND, 1.0 * k if k > 0.02 else 0.02, T,
                    glow=0.6 + 0.4 * math.sin(T * 2))
    CAST["Mugsy"].draw(cr, idle("Mugsy", T, x=690, s=1.0,
                                expr=facial(beat, "Mugsy", "beam"),
                                mouth=speaks(show, beat, "Mugsy", T),
                                look=(1, 0)), T)
    rolling_bin(cr, show, beat, T, BIN_HOME, 1.5, cone_in=True)
    if out:
        for i, name in enumerate(DRAWER_CREW):
            st = call - 1.0 + i * 0.28
            if T < st:
                continue
            k = ease_out(clamp((T - st) / 1.2))
            x = lerp(180, CROWD_X[name], k)
            p = idle(name, T, x=x, s=0.62, expr=facial(beat, name, "beam"),
                     mouth=speaks(show, beat, name, T), look=(1, 0),
                     step=T * 11 if k < 1 else None)
            CAST[name].draw(cr, p, T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1200, s=0.9,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    if chair is not None and T > chair:
        stage.confetti(cr, T - chair, 70)
        stage.banner(cr, 36, "MUGSY WINS ODDS & ENDS!",
                     clamp((T - chair) / 0.4), (0.31, 0.55, 0.86))


def sc_finale(cr, show, sc, beat, T):
    wob = show.act_start(sc, "wobbly")
    wrap = show.act_start(sc, "wrap")
    tilt = 0.0
    if wob is not None and T > wob:
        tilt = math.sin((T - wob) * 3.4) * 0.05

    stage.kitchen_night(cr, T, light=1.0)
    stage.drawer(cr, 130, GROUND + 20, 250, 150, open_k=1.0, t=T)
    for name in DRAWER_CREW:
        CAST[name].draw(cr, idle(name, T, x=CROWD_X[name], s=0.62,
                                 expr=facial(beat, name, "beam"),
                                 mouth=speaks(show, beat, name, T),
                                 look=(1, 0)), T)
    cr.save()
    cr.translate(CHAIR_X, GROUND)
    cr.rotate(tilt)
    cr.translate(-CHAIR_X, -GROUND)
    stage.chair(cr, CHAIR_X, GROUND, 1.0, T, glow=0.35)
    CAST["Mugsy"].draw(cr, pose(CHAIR_X - 4, GROUND - 52, s=0.95,
                                expr=facial(beat, "Mugsy", "flat"),
                                mouth=speaks(show, beat, "Mugsy", T),
                                look=(-1, 0)), T)
    cr.restore()
    rolling_bin(cr, show, beat, T, BIN_HOME, 1.5, cone_in=True)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1200, s=0.9,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    if wrap is not None and T > wrap:
        stage.confetti(cr, T - wrap, 40)


def sc_outro(cr, show, sc, beat, T):
    t = T - sc["t0"]
    stage.dark_stage(cr, T, spots=[(640, 300, 0.8)])
    stage.logo(cr, W / 2, 220, lerp(1.25, 1.0, ease_out(clamp(t / 0.8))), 1.0)
    text_at(cr, W / 2, 286, "WILL RETURN", 40, (1, 1, 1), "center",
            outline=(0.12, 0.11, 0.18), outline_w=8,
            alpha=clamp((t - 0.8) / 0.6))
    text_at(cr, W / 2, 340, 'Series 2: "The Garage"', 30, (1, 0.86, 0.30),
            "center", alpha=clamp((t - 1.6) / 0.6))
    cast_row = ["Mugsy", "Cone", "Spork", "Mitt", "Plate", "Clip", "Sticky",
                "Cube", "Volt"]
    for i, name in enumerate(cast_row):
        st = 0.4 + i * 0.13
        if t < st:
            continue
        k = clamp((t - st) / 0.5)
        CAST[name].draw(cr, pose(150 + i * 122, GROUND + 130 - bounce(k) * 130,
                                 s=0.62), T)
    text_at(cr, W / 2, 400, "thank you for voting", 26, (1, 1, 1), "center",
            bold=False, alpha=clamp((t - 2.6) / 0.8))
    stage.vignette(cr, 0.4)


SCENE_FN = {
    "recap": sc_recap, "title": sc_title, "vote": sc_vote,
    "binday": sc_binday, "collect": sc_collect, "winner": sc_winner,
    "finale": sc_finale, "outro": sc_outro,
}

EPISODE = Show("ep08", 'Episode 8: "Bin Day"', BEATS, TOTAL, SCENE_FN)
