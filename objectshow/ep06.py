"""Odds & Ends, episode 6: "The Fridge".

Mitt lost the vote and took it beautifully.  The rest go into cold storage,
where Cube — cold at last — adjudicates, and Spork wins by being frozen to the
furniture.
"""

import math

import ep05
import stage
from cast import CAST, pose
from draw import (GROUND, H, W, bounce, clamp, ease_back, ease_in_out,
                  ease_out, lerp, rand01, set_rgb, text_at)
from engine import (Show, camera, facial, glow_eyes, idle, look_at, speaks,
                    talker)
from timeline import A, S

TOTAL = 300.0
FIELD = ["Mugsy", "Cone", "Spork", "Plate"]
NOMINEES = ["Mugsy", "Cone", "Plate"]
DRAWER_CREW = ["Volt", "Cube", "Sticky", "Clip", "Mitt"]


BEATS = [
    dict(key="recap", beats=[
        A(2.4, "flash1"),
        S("Mega", "Previously, on Odds and Ends:", "smug", act="flash1"),
        S("Mega", "three new objects came out of the dishwasher.", "happy",
          act="flash1"),
        A(1.0, "flash2"),
        S("Mega", "One of them was built to win, and did.", "smug",
          act="flash2"),
        A(1.2, "flash3"),
        S("Mega", "And then you voted.", "happy", act="flash3"),
        A(3.0, "flash3"),
    ]),

    dict(key="title", beats=[
        A(8.4, "logo"),
    ]),

    dict(key="vote", beats=[
        A(2.6, "stage"),
        S("Mega", "Four of you are up. The votes are in.", "smug",
          act="stage"),
        A(1.2, "tally_Mugsy"),
        S("Mega", "Mugsy: twelve.", "happy", act="tally_Mugsy"),
        S("Mugsy", "Twelve is my lowest ever. Is that good? That is good.",
          "happy", act="tally_Mugsy"),
        A(1.2, "tally_Spork"),
        S("Mega", "Spork: sixteen.", "happy", act="tally_Spork"),
        S("Spork", "I have been here for ONE DAY.", "shock",
          act="tally_Spork"),
        A(1.2, "tally_Cone"),
        S("Mega", "Cone: nineteen.", "happy", act="tally_Cone"),
        S("Cone", "I accept the numbers. I have nothing left to appeal with.",
          "sad", act="tally_Cone"),
        A(1.4, "tally_Mitt"),
        S("Mega", "Mitt: thirty-one.", "smug", act="tally_Mitt"),
        S("Mitt", "Oh! That is a lot of attention. Thank you.", "happy",
          act="tally_Mitt"),
        A(1.8, "verdict"),
        S("Mega", "Mitt. You have been eliminated.", "flat", act="verdict"),
        S("Mitt", "That is all right. I have been in worse drawers.", "happy",
          act="fling"),
        A(2.6, "fling"),
        S("Volt", "Do not comfort me.", "furious", act="slam_shut"),
        S("Mitt", "I am going to.", "happy", act="slam_shut"),
        S("Sticky", "She is so WARM!", "happy", act="slam_shut"),
        S("Cube", "I am melting again. I was doing so well.", "sad",
          act="slam_shut"),
        A(1.8, "slam_shut"),
    ]),

    dict(key="fridge", beats=[
        A(3.0, "four"),
        S("Mega", "Four contestants. One appliance.", "smug", act="four"),
        A(3.0, "open"),
        S("Mega", "Today's challenge: COLD STORAGE.", "happy", act="open"),
        S("Mega", "Get in the fridge. Stay in the fridge.", "smug",
          act="open"),
        S("Mega", "The last object still functioning wins immunity.", "happy",
          act="open"),
        S("Plate", "Define functioning.", "smug", act="open"),
        S("Mega", "You will know when you stop.", "flat", act="open"),
        S("Spork", "Is the fridge safe?", "worried", act="open"),
        S("Mega", "No.", "flat", act="open"),
        S("Mugsy", "Is there a guest judge? There is always a guest judge.",
          "worried", act="cube"),
        S("Mega", "There is. And he has been asking since episode two.",
          "smug", act="cube"),
        A(2.6, "cube"),
        S("Cube", "...oh. Oh, that is the stuff.", "happy", act="cube"),
        S("Cube", "I am SOLID. I have EDGES again!", "happy", act="cube"),
        S("Volt", "He is happy. I hate that he is happy.", "furious",
          act="cube"),
        S("Mega", "Cube adjudicates. In you go.", "smug", act="getin"),
        A(3.6, "getin"),
    ]),

    dict(key="cold", beats=[
        A(3.2, "chill"),
        S("Mugsy", "It is cold. It is very cold.", "worried", act="chill"),
        S("Cone", "That is the entire premise, Mugsy.", "flat", act="chill"),
        S("Plate", "I am chilled. I am a chilled plate. This is fine.",
          "smug", act="chill"),
        S("Cube", "Enjoy. I have waited five episodes for this.", "happy",
          act="chill"),
        A(2.0, "stick"),
        S("Spork", "Should I hold the shelf? I am going to hold the shelf.",
          "happy", act="stick"),
        S("Cube", "Do not hold the shelf.", "flat", act="stick"),
        S("Spork", "I am holding the shelf.", "happy", act="stick"),
        A(2.4, "stick"),
        S("Spork", "I am holding the shelf forever.", "shock", act="stick"),
        A(2.0, "chill"),
        S("Mugsy", "A cold mug is a failure of a mug.", "sad", act="chill"),
        S("Mugsy", "This is the opposite of my purpose.", "sad", act="chill"),
        A(2.2, "brittle"),
        S("Cone", "I am becoming brittle. I warped, and now I am brittle.",
          "worried", act="brittle"),
        S("Cone", "I have been through a lot this season.", "sad",
          act="brittle"),
        A(1.8, "brittle"),
        S("Cone", "Did anyone hear that?", "shock", act="brittle"),
        S("Plate", "No.", "flat", act="brittle"),
        S("Cone", "Good.", "flat", act="brittle"),
        A(2.4, "jar"),
        S("Mugsy", "What is at the back?", "shock", act="jar"),
        S("Cube", "Don't.", "flat", act="jar"),
        S("Mugsy", "But what IS it?", "shock", act="jar"),
        S("Cube", "We do not talk to the jar.", "flat", act="jar"),
        A(3.0, "jar"),
        S("Plate", "I would like to leave the fridge.", "worried",
          act="leave_Plate"),
        S("Mega", "Nobody has left the fridge.", "flat", act="leave_Plate"),
        S("Plate", "I am leaving the fridge.", "flat", act="leave_Plate"),
        A(2.2, "leave_Mugsy"),
        S("Mugsy", "I am sorry. I am a mug. I am going.", "sad",
          act="leave_Mugsy"),
        A(2.2, "leave_Cone"),
        S("Cone", "I am too brittle for this. I am going before I chip.",
          "sad", act="leave_Cone"),
        A(2.6, "endcold"),
    ]),

    dict(key="results", beats=[
        A(3.0, "out"),
        S("Mega", "Everybody out.", "smug", act="out"),
        S("Mega", "Except one.", "smug", act="out"),
        S("Spork", "I cannot come out.", "shock", act="out"),
        S("Mega", "Spork remains in the fridge.", "flat", act="out"),
        S("Spork", "Because I am STUCK to it!", "shock", act="out"),
        S("Mega", "You are the last object still in the fridge.", "smug",
          act="out"),
        S("Cube", "Technically flawless.", "happy", act="out"),
        A(2.4, "win"),
        S("Mega", "SPORK WINS IMMUNITY!", "happy", act="win"),
        S("Spork", "Can someone get me off the shelf?", "worried", act="win"),
        S("Mega", "Eventually.", "smug", act="win"),
        S("Plate", "He is attached to a shelf.", "flat", act="win"),
        S("Mega", "And you are not.", "smug", act="win"),
        S("Cone", "He won by being attached to the furniture.", "flat",
          act="win"),
        S("Sticky", "That is how I won episode two!", "happy", act="win"),
        A(2.6, "win"),
    ]),

    dict(key="elimination", beats=[
        A(2.6, "stage2"),
        S("Mega", "Mugsy. Cone. Plate. You are up.", "smug", act="podium"),
        S("Plate", "I left the fridge with dignity.", "smug", act="podium"),
        S("Mega", "You left it first.", "flat", act="podium"),
        S("Mugsy", "I lasted longer than a PLATE.", "happy", act="podium"),
        S("Cone", "I would like the record to show that I am cracked.",
          "sad", act="podium"),
        A(1.6, "votes"),
        S("Mega", "Viewers: vote in the comments.", "happy", act="votes"),
        S("Mitt", "Whoever comes down, I will be here.", "happy",
          act="votes"),
        S("Volt", "She has made that a threat.", "furious", act="votes"),
        S("Cube", "I am going back in the fridge.", "happy", act="votes"),
        A(3.0, "votes"),
    ]),

    dict(key="outro", beats=[
        A(1.8, "next"),
        S("Mega", "Next time, on Odds and Ends:", "happy", act="next"),
        S("Mega", "we are going outside.", "smug", act="road"),
        A(2.2, "road"),
        S("Mega", "Four lanes. No pavement. Survive the motorway.", "smug",
          act="road"),
        S("Cone", "...Finally.", "happy", act="road"),
        S("Cone", "My natural habitat.", "happy", act="road"),
        A(2.4, "road"),
        A(6.5, "endcard"),
    ]),
]


# ---------------------------------------------------------------- scenes ---

VOTES = {"Mugsy": 12, "Spork": 16, "Cone": 19, "Mitt": 31}
VOTE_X = {"Mugsy": 220, "Spork": 400, "Cone": 580, "Mitt": 760}
VOTE_DRAWER_X = 1030
CREW_DX = {"Volt": -112, "Cube": -56, "Sticky": 0, "Clip": 56, "Mitt": 112}
FRIDGE_X = 1120
KITCHEN_X = {"Mugsy": 520, "Cone": 640, "Spork": 760, "Plate": 880}
COLD_X = {"Mugsy": 300, "Cone": 470, "Spork": 650, "Plate": 830}
CUBE_X = 1060
JAR_X = 640
OUT_X = {"Mugsy": 330, "Cone": 480, "Plate": 630}
ELIM_X = {"Mugsy": 400, "Cone": 600, "Plate": 800}


def crew(cr, show, sc, beat, T, x=140, scale=0.40, w=290, skip=()):
    stage.drawer(cr, x, GROUND + 20, w, 150, open_k=1.0, t=T)
    for name in DRAWER_CREW:
        if name in skip:
            continue
        CAST[name].draw(cr, pose(x + CREW_DX[name] * (w / 290.0),
                                 GROUND - 24, s=scale,
                                 rot=0.2 if name == "Sticky" else 0.0,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T)), T)


def shiver(p, T, k, name):
    if k <= 0:
        return p
    p["x"] += math.sin(T * 34 + rand01(name) * 6) * 2.2 * k
    p["rot"] += math.sin(T * 29 + rand01(name, 2) * 6) * 0.018 * k
    return p


def sc_recap(cr, show, sc, beat, T):
    show5 = ep05.EPISODE
    clips = {"flash1": (96.0, 7.0), "flash2": (243.0, 5.0),
             "flash3": (266.0, 6.0)}
    t0, t1, act = show.act_span(sc, T)
    src, span = clips.get(act, clips["flash1"])
    lt = T - t0
    T5 = src + lt * (span / max(0.6, t1 - t0))
    sc5, beat5 = show5.locate(T5)
    cr.save()
    show5.fn[sc5["key"]](cr, show5, sc5, beat5, T5)
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
    set_rgb(cr, (0.24, 0.48, 0.62))
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
    stage.frost_overlay(cr, 0.35)
    slam = show.cue_at["slam"][0] - sc["t0"]
    if t > slam - 0.5:
        k = clamp((t - slam + 0.45) / 0.55)
        stage.logo(cr, W / 2, 300, lerp(3.4, 1.0, ease_out(k)), 1.0,
                   sub='Episode 6: "The Fridge"' if t > slam + 0.9 else None,
                   sub_a=clamp((t - slam - 0.9) / 0.5))
    fl = show.since("slam", T, 0.35)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.35) * 0.55)
    for i, name in enumerate(ep05.FIELD):
        st = slam + 1.7 + i * 0.28
        if t < st:
            continue
        k = clamp((t - st) / 0.55)
        CAST[name].draw(cr, pose(230 + i * 205, GROUND + 120 - bounce(k) * 120,
                                 s=0.92, sq=1 + 0.12 * (1 - k)), T)


def sc_vote(cr, show, sc, beat, T):
    verdict = show.act_start(sc, "verdict")
    fling = show.act_start(sc, "fling")
    shut = show.act_start(sc, "slam_shut")
    shake = 0.0
    sl = show.since("slam", T, 0.6)
    if sl is not None and shut is not None and T > shut:
        shake = 9 * (1 - sl / 0.6)
    cr.save()
    camera(cr, 1.0, W / 2, H / 2, shake, T)
    stage.dark_stage(cr, T, spots=[(VOTE_X[n], 110, 1.0) for n in VOTE_X])
    flying = fling is not None and T > fling + 0.15
    gone = fling is not None and T > fling + 1.15
    for name in ("Mugsy", "Spork", "Cone", "Mitt"):
        x = VOTE_X[name]
        stage.podium(cr, x, GROUND + 10, 124, 120)
        if not (name == "Mitt" and flying):
            CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.78,
                                     expr=facial(beat, name, "flat"),
                                     mouth=speaks(show, beat, name, T),
                                     look=look_at(x, 1200)), T)
        ts = show.act_start(sc, "tally_" + name)
        if ts is not None and T > ts:
            k = ease_out(clamp((T - ts) / 0.9))
            col = CAST[name].tag
            if name == "Mitt" and verdict is not None and T > verdict:
                col = (0.95, 0.30, 0.28) if int(T * 4) % 2 else (1, 0.75, 0.3)
            stage.scorecard(cr, x, 236, name,
                            "%d votes" % int(round(VOTES[name] * k)), col,
                            clamp((T - ts) / 0.35), w=172, size=28)
    if flying and not gone:
        f = clamp((T - fling - 0.15) / 1.0)
        CAST["Mitt"].draw(cr, pose(lerp(VOTE_X["Mitt"], VOTE_DRAWER_X, f),
                                   GROUND - math.sin(f * math.pi) * 230,
                                   rot=f * 3.0, expr="happy"), T)
    open_from = verdict if verdict is not None else fling
    if open_from is not None and T > open_from - 0.4:
        k = ease_out(clamp((T - open_from + 0.4) / 1.1))
        x = lerp(1680, VOTE_DRAWER_X, k)
        stage.drawer(cr, x, GROUND, 340, 190, open_k=1.0, t=T, glow=0.6)
        for name in DRAWER_CREW:
            if name == "Mitt" and not gone:
                continue
            CAST[name].draw(cr, pose(x + CREW_DX[name] * 1.06, GROUND - 44,
                                     s=0.44,
                                     rot=0.2 if name == "Sticky" else 0.0,
                                     expr=facial(beat, name, "flat"),
                                     mouth=speaks(show, beat, name, T)), T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1235, s=0.82,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    cr.restore()
    text_at(cr, W / 2, 70, "THE VOTE", 52, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    stage.vignette(cr, 0.45)


def sc_fridge(cr, show, sc, beat, T):
    op = show.act_start(sc, "open")
    cube = show.act_start(sc, "cube")
    enter = show.act_start(sc, "getin")
    door = 0.0 if op is None else ease_out(clamp((T - op - 0.2) / 1.3))
    stage.kitchen_night(cr, T, light=1.0)
    crew(cr, show, sc, beat, T, x=130, scale=0.38, w=270,
         skip=("Cube",) if cube is not None and T > cube - 1.2 else ())
    stage.fridge_front(cr, FRIDGE_X, GROUND, 1.0, door, T, glow=door)
    if door > 0.3:
        stage.breath(cr, FRIDGE_X - 130, GROUND - 120, T, door * 0.7, "fr")

    for name in FIELD:
        x = KITCHEN_X[name]
        walk = None
        if enter is not None:
            st = enter + 0.5 + FIELD.index(name) * 0.4
            k = clamp((T - st) / 1.2)
            if k > 0:
                x = lerp(x, FRIDGE_X - 60, ease_in_out(k))
                walk = T * 11
            if k >= 1:
                continue
        CAST[name].draw(cr, idle(name, T, x=x, s=0.85,
                                 expr=facial(beat, name),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, FRIDGE_X), step=walk), T)
    if cube is not None and T > cube - 1.2:
        k = ease_in_out(clamp((T - cube + 1.2) / 2.6))
        x = lerp(130, FRIDGE_X - 190, k)
        p = idle("Cube", T, x=x, s=0.85, expr=facial(beat, "Cube", "happy"),
                 mouth=speaks(show, beat, "Cube", T), look=(1, 0),
                 step=T * 10 if k < 1 else None)
        p["sq"] = lerp(0.6, 1.0, k)
        CAST["Cube"].draw(cr, p, T)
        if k > 0.85:
            from ep05 import sparkle_ring
            sparkle_ring(cr, x, GROUND - 60, T, 0.8, 5, 78)
    CAST["Mega"].draw(cr, idle("Mega", T, x=360, s=0.9,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True), T)
    if op is not None and T < op + 6.0:
        stage.banner(cr, 50, "CHALLENGE: COLD STORAGE",
                     clamp((T - op) / 0.5) * clamp((op + 6.0 - T) / 0.4),
                     (0.30, 0.58, 0.78))


def sc_cold(cr, show, sc, beat, T):
    stuck = show.act_start(sc, "stick")
    jar_t = show.act_start(sc, "jar")
    endc = show.act_start(sc, "endcold")
    chill = clamp((T - sc["t0"]) / 40.0)
    frost = clamp((T - sc["t0"] - 8) / 55.0) * 0.8

    stage.fridge_inside(cr, T, frost=0.0, light=1.0)
    stage.jar(cr, JAR_X, 330)
    if jar_t is not None and T > jar_t:
        glow_eyes(cr, JAR_X, 288, 0.95, 15, (0.72, 0.95, 0.55),
                  0.4 + 0.5 * abs(math.sin(T * 1.7)))

    for name in FIELD:
        left = show.act_start(sc, "leave_" + name)
        x = COLD_X[name]
        if left is not None and T > left + 1.4:
            k = ease_in_out(clamp((T - left - 1.4) / 1.6))
            x = lerp(x, W + 160, k)
            if k >= 1:
                continue
        p = idle(name, T, x=x, s=0.92, expr=facial(beat, name, "worried"),
                 mouth=speaks(show, beat, name, T))
        shiver(p, T, chill, name)
        if name == "Spork" and stuck is not None and T > stuck + 1.6:
            p["x"] = COLD_X["Spork"]
            p["arm_r"] = 1.25
            p["expr"] = beat["expr"] if talker(beat, "Spork") else "shock"
        if name == "Plate":
            p["expr"] = beat["expr"] if talker(beat, "Plate") else "smug"
        CAST[name].draw(cr, p, T)
        if chill > 0.25:
            stage.breath(cr, p["x"] + 20, p["y"] - 96, T, chill * 0.7, name)
        if name == "Spork" and stuck is not None and T > stuck + 1.6:
            from draw import circle, fill_stroke
            circle(cr, p["x"] + 62, GROUND - 4, 22)
            fill_stroke(cr, (0.86, 0.96, 1.0), 4.0, alpha=0.9)

    cp = idle("Cube", T, x=CUBE_X, s=0.92, expr=facial(beat, "Cube", "happy"),
              mouth=speaks(show, beat, "Cube", T), look=(-1, 0))
    CAST["Cube"].draw(cr, cp, T)
    text_at(cr, CUBE_X, GROUND + 62, "ADJUDICATOR", 20, (0.25, 0.45, 0.62),
            "center")

    stage.frost_overlay(cr, frost)
    if endc is not None and T > endc:
        stage.flash(cr, clamp(1 - (T - endc) / 0.6) * 0.5)
        text_at(cr, W / 2, 120, "TIME!", 74, (0.20, 0.42, 0.60), "center",
                outline=(1, 1, 1), outline_w=10,
                alpha=clamp((T - endc) / 0.3))


def sc_results(cr, show, sc, beat, T):
    win = show.act_start(sc, "win")
    stage.kitchen_night(cr, T, light=1.0)
    crew(cr, show, sc, beat, T, x=130, scale=0.38, w=270, skip=("Cube",))
    stage.fridge_front(cr, FRIDGE_X, GROUND, 1.0, 1.0, T, glow=1.0)
    # Spork, on the shelf, where he will remain
    CAST["Spork"].draw(cr, pose(FRIDGE_X - 16, GROUND - 34, s=0.46,
                                arm_r=1.2,
                                expr=facial(beat, "Spork", "shock"),
                                mouth=speaks(show, beat, "Spork", T)), T)
    for name in ("Mugsy", "Cone", "Plate"):
        x = OUT_X[name]
        p = idle(name, T, x=x, s=0.88, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=(1, 0))
        if name == "Cone":
            p["rot"] = 0.12
            p["sq"] = 0.9
        CAST[name].draw(cr, p, T)
    CAST["Cube"].draw(cr, idle("Cube", T, x=830, s=0.88,
                               expr=facial(beat, "Cube", "happy"),
                               mouth=speaks(show, beat, "Cube", T),
                               look=(1, 0)), T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=950, s=0.9,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True), T)
    if win is not None and T > win:
        stage.confetti(cr, T - win, 54)
        stage.banner(cr, 40, "SPORK WINS IMMUNITY!", clamp((T - win) / 0.4),
                     (0.52, 0.56, 0.64))
        stage.crown(cr, FRIDGE_X - 16, GROUND - 118,
                    0.6 * ease_back(clamp((T - win) / 0.5)))


def sc_elimination(cr, show, sc, beat, T):
    votes = show.act_start(sc, "votes")
    stage.dark_stage(cr, T, spots=[(ELIM_X[n], 120, 1.0) for n in NOMINEES] +
                     [(1000, 110, 0.6)])
    crew(cr, show, sc, beat, T, x=130, scale=0.38, w=270)
    for name in NOMINEES:
        x = ELIM_X[name]
        stage.podium(cr, x, GROUND + 10, 130, 120)
        CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.8,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, 1150)), T)
        if votes is not None and T > votes:
            k = clamp((T - votes - NOMINEES.index(name) * 0.2) / 0.4)
            stage.scorecard(cr, x, 290, name, "vote", CAST[name].tag, k,
                            w=168, size=32)
    # the immune contestant is not here; he is still attached to a shelf
    stage.podium(cr, 1000, GROUND + 10, 130, 120)
    stage.crown(cr, 1000, GROUND - 60, 0.7)
    stage.scorecard(cr, 1000, 330, "Spork", "still in the fridge",
                    CAST["Spork"].tag, clamp((T - sc["t0"]) / 0.8), w=250,
                    size=22)
    text_at(cr, 1000, GROUND + 66, "SAFE", 22, (0.4, 0.9, 0.5), "center",
            outline=(0.12, 0.11, 0.18), outline_w=6)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1180, s=0.88,
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


def sc_outro(cr, show, sc, beat, T):
    end = show.act_start(sc, "endcard", sc["t1"])
    road = show.act_start(sc, "road")
    if T < end:
        t = T - sc["t0"]
        if road is not None and T > road:
            k = clamp((T - road) / 1.0)
            stage.motorway(cr, T - road, k,
                           headlights=clamp((T - road - 1.2) / 2.0))
            CAST["Cone"].draw(cr, idle("Cone", T, y=GROUND, x=300, s=1.0,
                                       expr=facial(beat, "Cone", "happy"),
                                       mouth=speaks(show, beat, "Cone", T),
                                       look=(1, 0)), T)
            CAST["Mega"].draw(cr, idle("Mega", T, x=1120, s=0.9,
                                       expr=facial(beat, "Mega", "smug"),
                                       mouth=speaks(show, beat, "Mega", T),
                                       look=(-1, 0)), T)
            text_at(cr, W / 2, 96, "NEXT TIME ON", 36, (1, 1, 1), "center",
                    outline=(0.10, 0.10, 0.15), outline_w=8, alpha=k)
            stage.logo(cr, W / 2, 176, 0.56, k)
            stage.vignette(cr, 0.4)
            return
        stage.dark_stage(cr, T, spots=[(640, 260, 0.7)])
        text_at(cr, W / 2, 150, "NEXT TIME ON", 40, (1, 1, 1), "center",
                alpha=clamp(t / 0.5))
        stage.logo(cr, W / 2, 240, 0.62, clamp(t / 0.5))
        CAST["Mega"].draw(cr, idle("Mega", T, x=1120, s=0.9,
                                   expr=facial(beat, "Mega", "smug"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(-1, 0)), T)
    else:
        t = T - end
        stage.motorway(cr, t + 4, 1.0, headlights=0.35)
        set_rgb(cr, (0.06, 0.06, 0.11), 0.55)
        cr.rectangle(0, 0, W, H)
        cr.fill()
        stage.logo(cr, W / 2, 250, lerp(1.25, 1.0, ease_out(clamp(t / 0.8))),
                   1.0, sub='Episode 7: "The Motorway"',
                   sub_a=clamp((t - 0.7) / 0.6))
        for i, name in enumerate(FIELD):
            st = 0.5 + i * 0.16
            if t < st:
                continue
            k = clamp((t - st) / 0.5)
            CAST[name].draw(cr, pose(320 + i * 215,
                                     GROUND + 120 - bounce(k) * 120,
                                     s=0.92), T)
        text_at(cr, W / 2, 400, "VOTE IN THE COMMENTS", 30, (1, 1, 1),
                "center", alpha=clamp((t - 1.3) / 0.6))
    stage.vignette(cr, 0.4)


SCENE_FN = {
    "recap": sc_recap, "title": sc_title, "vote": sc_vote,
    "fridge": sc_fridge, "cold": sc_cold, "results": sc_results,
    "elimination": sc_elimination, "outro": sc_outro,
}

EPISODE = Show("ep06", 'Episode 6: "The Fridge"', BEATS, TOTAL, SCENE_FN)
