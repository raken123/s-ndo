"""Odds & Ends, episode 7: "The Motorway".

Plate lost the vote and was appalled by the drawer.  The last three are taken
outside, where a traffic cone finally gets to be right about something.
"""

import math

import ep06
import stage
from cast import CAST, pose
from draw import (GROUND, H, W, bounce, clamp, ease_back, ease_in_out,
                  ease_out, lerp, rand01, set_rgb, text_at)
from engine import (Show, camera, facial, glow_eyes, idle, look_at,
                    silhouette, speaks, talker)
from timeline import A, S

TOTAL = 300.0
FIELD = ["Mugsy", "Cone", "Spork"]
NOMINEES = ["Mugsy", "Spork"]
DRAWER_CREW = ["Volt", "Cube", "Sticky", "Clip", "Mitt", "Plate"]


BEATS = [
    dict(key="recap", beats=[
        A(2.4, "flash1"),
        S("Mega", "Previously, on Odds and Ends:", "smug", act="flash1"),
        S("Mega", "everybody went in the fridge.", "happy", act="flash1"),
        A(1.0, "flash2"),
        S("Mega", "Spork won by freezing to a shelf.", "smug", act="flash2"),
        A(1.2, "flash3"),
        S("Mega", "And then you voted.", "happy", act="flash3"),
        A(3.0, "flash3"),
    ]),

    dict(key="title", beats=[
        A(8.4, "logo"),
    ]),

    dict(key="vote", beats=[
        A(2.6, "stage"),
        S("Mega", "Three of you are up. The votes are in.", "smug",
          act="stage"),
        A(1.2, "tally_Mugsy"),
        S("Mega", "Mugsy: fourteen.", "happy", act="tally_Mugsy"),
        S("Mugsy", "That is my second lowest. I am on a run!", "happy",
          act="tally_Mugsy"),
        A(1.2, "tally_Cone"),
        S("Mega", "Cone: twenty.", "happy", act="tally_Cone"),
        S("Cone", "Consistent. Unloved, but consistent.", "flat",
          act="tally_Cone"),
        A(1.4, "tally_Plate"),
        S("Mega", "Plate: thirty-seven.", "smug", act="tally_Plate"),
        S("Plate", "Thirty-seven? I am the cleanest object here.", "shock",
          act="tally_Plate"),
        A(1.8, "verdict"),
        S("Mega", "Plate. You have been eliminated.", "flat", act="verdict"),
        S("Plate", "Where exactly am I going?", "worried", act="verdict"),
        S("Mega", "The drawer.", "smug", act="verdict"),
        S("Plate", "The DRAWER? Is it sorted?", "shock", act="fling"),
        A(2.8, "fling"),
        S("Volt", "Nothing in here is sorted.", "flat", act="slam_shut"),
        S("Plate", "I am going to be sick, and I am dishwasher safe.",
          "worried", act="slam_shut"),
        S("Cube", "There is no room. There has never been room.", "flat",
          act="slam_shut"),
        S("Clip", "You will love it. There is a sock.", "smug",
          act="slam_shut"),
        S("Mitt", "Come here, you.", "happy", act="slam_shut"),
        S("Plate", "Do not fold me into anything.", "shock",
          act="slam_shut"),
        A(1.8, "slam_shut"),
    ]),

    dict(key="hardshoulder", beats=[
        A(3.2, "three"),
        S("Mega", "Three contestants left.", "smug", act="three"),
        S("Spork", "I brought the shelf. The shelf came with me.", "worried",
          act="shelf"),
        S("Mega", "We will deal with that later.", "flat", act="shelf"),
        S("Spork", "Can I keep the shelf? For emotional reasons.",
          "worried", act="shelf"),
        A(3.8, "outside"),
        S("Mega", "Today, we are going OUTSIDE.", "happy", act="outside"),
        S("Mugsy", "Outside? Objects do not go outside.", "shock",
          act="outside"),
        S("Mega", "Today's challenge: SURVIVE THE MOTORWAY.", "smug",
          act="brief"),
        S("Mega", "Four lanes. No pavement. Get to the other side.", "happy",
          act="brief"),
        S("Mugsy", "That is the worst sentence I have ever heard.", "worried",
          act="brief"),
        S("Cone", "...Say it again.", "happy", act="brief"),
        S("Mega", "Get to the other side.", "flat", act="brief"),
        S("Cone", "Beautiful.", "happy", act="brief"),
        S("Cone", "I have waited my entire life for that sentence.",
          "happy", act="brief"),
        S("Mega", "Cone. Are you all right?", "flat", act="brief"),
        S("Cone", "I have never been more all right.", "happy", act="brief"),
        S("Mega", "On my signal.", "smug", act="signal"),
        A(3.4, "signal"),
    ]),

    dict(key="cross", beats=[
        A(3.6, "lorry"),
        S("Mugsy", "No. NO THANK YOU.", "shock", act="lorry"),
        S("Mugsy", "How many lanes is four?", "shock", act="lorry"),
        S("Cone", "Four.", "flat", act="lorry"),
        S("Spork", "I am quite light! Is being light bad here?", "worried",
          act="light"),
        S("Cone", "Being light is very bad here.", "flat", act="light"),
        A(3.2, "gust"),
        S("Spork", "I AM AIRBORNE.", "shock", act="gust"),
        S("Spork", "I would like to formally leave!", "shock", act="gust"),
        A(3.4, "gust"),
        S("Cone", "Mugsy. Stay behind me.", "flat", act="swerve"),
        S("Mugsy", "Behind you?", "shock", act="swerve"),
        S("Cone", "I am a traffic cone. They go around me.", "flat",
          act="swerve"),
        A(3.2, "swerve"),
        S("Mugsy", "...They went around you.", "shock", act="infra"),
        S("Cone", "They always go around me.", "happy", act="infra"),
        S("Mugsy", "Cone. You are directing traffic.", "shock",
          act="infra"),
        S("Cone", "I am ALWAYS directing traffic. Nobody listens.",
          "happy", act="infra"),
        A(2.8, "infra"),
        S("Cone", "For six episodes I have been a joke with a rulebook.",
          "flat", act="infra"),
        S("Cone", "Out here, I am infrastructure.", "happy", act="infra"),
        A(3.0, "hedge"),
        S("Spork", "I am in a hedge! I have landed in a hedge!", "shock",
          act="hedge"),
        S("Mega", "Spork has left the road.", "flat", act="hedge"),
        S("Spork", "The hedge left the ROAD?", "shock", act="hedge"),
        A(3.2, "together"),
        S("Cone", "Mugsy. Walk with me.", "happy", act="together"),
        S("Mugsy", "I cannot.", "worried", act="together"),
        S("Cone", "You can. Nobody hits a cone.", "happy", act="together"),
        S("Mega", "Two lanes to go.", "happy", act="together"),
        S("Mugsy", "I am walking on a motorway. I am a MUG.", "worried",
          act="together"),
        A(4.2, "together"),
        A(3.0, "endcross"),
    ]),

    dict(key="results", beats=[
        A(3.0, "line"),
        S("Mega", "Cone has crossed the motorway.", "smug", act="line"),
        S("Cone", "I have.", "happy", act="line"),
        S("Mega", "Mugsy crossed behind Cone.", "flat", act="line"),
        S("Mugsy", "I crossed behind Cone.", "happy", act="line"),
        S("Mega", "Spork is in a hedge.", "flat", act="line"),
        S("Spork", "It is quite nice in the hedge, actually.", "happy",
          act="line"),
        A(2.6, "win"),
        S("Mega", "CONE WINS IMMUNITY!", "happy", act="win"),
        S("Cone", "Say that again as well.", "happy", act="win"),
        S("Mega", "Cone wins immunity.", "smug", act="win"),
        S("Cone", "I would like to dedicate this to the menu.", "happy",
          act="win"),
        S("Mugsy", "He saved me. The cone saved me.", "happy", act="win"),
        S("Cone", "That is my JOB.", "happy", act="win"),
        S("Sticky", "The bin has the menu!", "happy", act="win"),
        S("Cone", "The bin has the menu.", "flat", act="win"),
        A(3.2, "win"),
    ]),

    dict(key="elimination", beats=[
        A(2.6, "stage2"),
        S("Mega", "Mugsy. Spork. You are up.", "smug", act="podium"),
        S("Spork", "I am still in the hedge.", "worried", act="podium"),
        S("Mega", "You may vote from a hedge.", "flat", act="podium"),
        S("Mugsy", "I hid behind a cone for six minutes.", "happy",
          act="podium"),
        S("Mega", "You did.", "smug", act="podium"),
        A(1.6, "votes"),
        S("Mega", "Viewers: vote in the comments.", "happy", act="votes"),
        S("Plate", "Vote for whoever is least clean.", "smug", act="votes"),
        S("Volt", "That is everyone. That is all of us.", "furious",
          act="votes"),
        A(3.0, "votes"),
    ]),

    dict(key="outro", beats=[
        A(1.8, "next"),
        S("Mega", "Next time, on Odds and Ends:", "happy", act="next"),
        S("Mega", "it is bin day.", "smug", act="binback"),
        A(2.8, "binback"),
        S("Bin", "...hello again.", "happy", act="binback"),
        S("Bin", "I am on wheels.", "happy", act="binback"),
        S("Mugsy", "NO.", "shock", act="binback"),
        A(3.0, "binback"),
        A(6.5, "endcard"),
    ]),
]


# ---------------------------------------------------------------- scenes ---

VOTES = {"Mugsy": 14, "Cone": 20, "Plate": 37}
VOTE_X = {"Mugsy": 320, "Cone": 560, "Plate": 800}
VOTE_DRAWER_X = 1050
CREW_DX = {"Volt": -128, "Cube": -77, "Sticky": -26, "Clip": 26, "Mitt": 77,
           "Plate": 128}
START_X = {"Mugsy": 170, "Cone": 330, "Spork": 490}
FINISH_X = 1040
HEDGE_X, HEDGE_Y = 1150, 560
ELIM_X = {"Mugsy": 460, "Spork": 720}

# a deterministic timetable: (offset, lane, kind, speed)
TRAFFIC = [(i * 2.15 + rand01("tr", i) * 1.1,
            (i * 2 + int(rand01("trl", i) * 3)) % 3,
            ("car", "van", "lorry", "car", "lorry", "van")[i % 6],
            1.25 + rand01("trs", i) * 0.9) for i in range(46)]


def crew(cr, show, sc, beat, T, x=140, scale=0.36, w=310, skip=()):
    stage.drawer(cr, x, GROUND + 20, w, 150, open_k=1.0, t=T)
    for name in DRAWER_CREW:
        if name in skip:
            continue
        CAST[name].draw(cr, pose(x + CREW_DX[name] * (w / 310.0),
                                 GROUND - 24, s=scale,
                                 rot=0.2 if name == "Sticky" else 0.0,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T)), T)


def swerve_dip(vx, cone_x, amount=54.0, width=300.0):
    """Traffic goes around a cone.  It always has."""
    d = abs(vx - cone_x)
    return -amount * max(0.0, 1 - (d / width) ** 2)


def traffic(cr, sc, T, cone_x=None, near=False, dusk=0.5):
    """Draw the vehicles whose pass overlaps this instant."""
    t = T - sc["t0"]
    for i, (off, lane, kind, speed) in enumerate(TRAFFIC):
        if (lane == 2) != near:
            continue
        span = (W + 900) / (speed * 620.0)
        dt = t - off
        if dt < 0 or dt > span:
            continue
        x = -420 + dt * speed * 620.0
        y = stage.LANES[lane]
        s = (0.55, 0.78, 1.06)[lane]
        if lane == 2 and cone_x is not None:
            y += swerve_dip(x, cone_x)
        stage.vehicle(cr, kind, x, y, s, seed=i, speed=min(1.0, speed))


def sc_recap(cr, show, sc, beat, T):
    show6 = ep06.EPISODE
    clips = {"flash1": (150.0, 7.0), "flash2": (222.0, 5.0),
             "flash3": (262.0, 6.0)}
    t0, t1, act = show.act_span(sc, T)
    src, span = clips.get(act, clips["flash1"])
    lt = T - t0
    T6 = src + lt * (span / max(0.6, t1 - t0))
    sc6, beat6 = show6.locate(T6)
    cr.save()
    show6.fn[sc6["key"]](cr, show6, sc6, beat6, T6)
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
    set_rgb(cr, (0.22, 0.22, 0.30))
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
        set_rgb(cr, (1, 0.86, 0.30), 0.05)
        cr.fill()
    cr.restore()
    slam = show.cue_at["slam"][0] - sc["t0"]
    if t > slam - 0.5:
        k = clamp((t - slam + 0.45) / 0.55)
        stage.logo(cr, W / 2, 300, lerp(3.4, 1.0, ease_out(k)), 1.0,
                   sub='Episode 7: "The Motorway"'
                   if t > slam + 0.9 else None,
                   sub_a=clamp((t - slam - 0.9) / 0.5))
    fl = show.since("slam", T, 0.35)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.35) * 0.55)
    for i, name in enumerate(ep06.FIELD):
        st = slam + 1.7 + i * 0.28
        if t < st:
            continue
        k = clamp((t - st) / 0.55)
        CAST[name].draw(cr, pose(300 + i * 230, GROUND + 120 - bounce(k) * 120,
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
    stage.dark_stage(cr, T, spots=[(VOTE_X[n], 120, 1.0) for n in VOTE_X])
    flying = fling is not None and T > fling + 0.15
    gone = fling is not None and T > fling + 1.15
    for name in ("Mugsy", "Cone", "Plate"):
        x = VOTE_X[name]
        stage.podium(cr, x, GROUND + 10, 132, 120)
        if not (name == "Plate" and flying):
            CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.82,
                                     expr=facial(beat, name, "flat"),
                                     mouth=speaks(show, beat, name, T),
                                     look=look_at(x, 1200)), T)
        ts = show.act_start(sc, "tally_" + name)
        if ts is not None and T > ts:
            k = ease_out(clamp((T - ts) / 0.9))
            col = CAST[name].tag
            if name == "Plate" and verdict is not None and T > verdict:
                col = (0.95, 0.30, 0.28) if int(T * 4) % 2 else (1, 0.75, 0.3)
            stage.scorecard(cr, x, 236, name,
                            "%d votes" % int(round(VOTES[name] * k)), col,
                            clamp((T - ts) / 0.35), w=180, size=28)
    if flying and not gone:
        f = clamp((T - fling - 0.15) / 1.0)
        CAST["Plate"].draw(cr, pose(lerp(VOTE_X["Plate"], VOTE_DRAWER_X, f),
                                    GROUND - math.sin(f * math.pi) * 240,
                                    rot=f * 6.5, expr="shock"), T)
    open_from = verdict if verdict is not None else fling
    if open_from is not None and T > open_from - 0.4:
        k = ease_out(clamp((T - open_from + 0.4) / 1.1))
        x = lerp(1700, VOTE_DRAWER_X, k)
        stage.drawer(cr, x, GROUND, 350, 190, open_k=1.0, t=T, glow=0.6)
        for name in DRAWER_CREW:
            if name == "Plate" and not gone:
                continue
            CAST[name].draw(cr, pose(x + CREW_DX[name] * 1.02, GROUND - 44,
                                     s=0.40,
                                     rot=0.2 if name == "Sticky" else 0.0,
                                     expr=facial(beat, name, "flat"),
                                     mouth=speaks(show, beat, name, T)), T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1240, s=0.8,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    cr.restore()
    text_at(cr, W / 2, 70, "THE VOTE", 52, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    stage.vignette(cr, 0.45)


def sc_hardshoulder(cr, show, sc, beat, T):
    out = show.act_start(sc, "outside")
    sig = show.act_start(sc, "signal")
    if out is None or T < out:
        stage.kitchen_night(cr, T, light=1.0)
        crew(cr, show, sc, beat, T, x=130, scale=0.34, w=280)
        for i, name in enumerate(FIELD):
            x = 520 + i * 150
            p = idle(name, T, x=x, s=0.9, expr=facial(beat, name),
                     mouth=speaks(show, beat, name, T), look=look_at(x, 360))
            if name == "Spork":
                p["arm_r"] = 1.0
            CAST[name].draw(cr, p, T)
            if name == "Spork":
                from draw import fill_stroke, rrect
                rrect(cr, x + 44, GROUND - 176, 96, 16, 6)
                fill_stroke(cr, (0.90, 0.96, 1.0), 4.0)
        CAST["Mega"].draw(cr, idle("Mega", T, x=380, s=0.9,
                                   expr=facial(beat, "Mega", "smug"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(1, 0), flip=True), T)
        return

    k = clamp((T - out) / 1.0)
    stage.motorway_day(cr, T, dusk=0.45)
    traffic(cr, sc, T, near=False)
    stage.gantry(cr, "OBJECTS ON ROAD", k)
    for i, name in enumerate(FIELD):
        x = START_X[name]
        p = idle(name, T, x=x, s=0.95, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=(1, 0))
        if name == "Cone":
            p["expr"] = beat["expr"] if talker(beat, "Cone") else "happy"
            p["y"] -= abs(math.sin(T * 2.6)) * 6
        CAST[name].draw(cr, p, T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1150, s=0.95,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    traffic(cr, sc, T, near=True)
    if sig is not None and T > sig:
        stage.flash(cr, clamp(1 - (T - sig) / 0.5) * 0.45, (1, 0.95, 0.7))
    stage.vignette(cr, 0.3)


def sc_cross(cr, show, sc, beat, T):
    gust = show.act_start(sc, "gust")
    hedge_t = show.act_start(sc, "hedge")
    tog = show.act_start(sc, "together")
    endc = show.act_start(sc, "endcross")
    swer = show.act_start(sc, "swerve")

    # Cone advances steadily; the crossing is his to lead
    prog = ease_in_out(clamp((T - sc["t0"] - 6) / (sc["dur"] - 12)))
    cone_x = lerp(START_X["Cone"], FINISH_X, prog)

    stage.motorway_day(cr, T, dusk=0.45)
    traffic(cr, sc, T, cone_x, near=False)
    if hedge_t is not None and T > hedge_t - 0.6:
        stage.hedge(cr, HEDGE_X, HEDGE_Y, 1.0)

    poses = {}
    for name in FIELD:
        if name == "Cone":
            p = idle(name, T, x=cone_x, s=0.95,
                     expr=facial(beat, name, "happy"),
                     mouth=speaks(show, beat, name, T), look=(1, 0),
                     arm_r=1.35 if swer is not None and T > swer else 0.2,
                     step=T * 7)
        elif name == "Mugsy":
            hide = swer is not None and T > swer + 1.0
            x = lerp(START_X["Mugsy"], cone_x - 74, clamp(
                (T - (swer or sc["t0"]) - 1.0) / 1.4)) if hide \
                else START_X["Mugsy"]
            p = idle(name, T, x=x, s=0.95,
                     expr=facial(beat, name, "shock"),
                     mouth=speaks(show, beat, name, T), look=(1, 0),
                     step=T * 9 if hide else None)
        else:
            x, y, rot = START_X["Spork"], GROUND, 0.0
            if gust is not None and T > gust:
                f = clamp((T - gust) / 1.6)
                x += -f * 250 + math.sin(f * 3.4) * 60
                y -= math.sin(f * math.pi) * 190
                rot = f * 4.0
            if hedge_t is not None and T > hedge_t - 1.2:
                f = ease_in_out(clamp((T - hedge_t + 1.2) / 1.6))
                x = lerp(x, HEDGE_X - 20, f)
                y = lerp(y, HEDGE_Y + 10, f)
                rot = lerp(rot, 0.5, f)
            if hedge_t is not None and T > hedge_t + 0.6:
                x, y, rot = HEDGE_X - 20, HEDGE_Y + 10, 0.5
            p = pose(x, y, rot=rot, s=0.95,
                     expr=facial(beat, name, "shock"),
                     mouth=speaks(show, beat, name, T))
        poses[name] = p
        CAST[name].draw(cr, p, T)

    lanes = min(4, int(prog * 4) + 1)
    stage.scorecard(cr, 1130, 40, "lane", "%d of 4" % lanes,
                    (1, 0.86, 0.30), 1.0, w=250, size=34)
    traffic(cr, sc, T, cone_x, near=True)
    gs = show.since("pass", T, 0.5)
    if gs is not None:
        set_rgb(cr, (1, 1, 1), (1 - gs / 0.5) * 0.12)
        for i in range(7):
            cr.rectangle(0, 300 + i * 60, W, 5)
            cr.fill()
    if endc is not None and T > endc:
        stage.flash(cr, clamp(1 - (T - endc) / 0.6) * 0.45)
        text_at(cr, W / 2, 150, "OTHER SIDE", 66, (1, 0.86, 0.30), "center",
                outline=(0.12, 0.11, 0.18), outline_w=11,
                alpha=clamp((T - endc) / 0.3))
    stage.vignette(cr, 0.3)


def sc_results(cr, show, sc, beat, T):
    win = show.act_start(sc, "win")
    stage.motorway_day(cr, T, dusk=0.55)
    traffic(cr, sc, T, near=False)
    stage.hedge(cr, HEDGE_X, HEDGE_Y, 1.0)
    CAST["Spork"].draw(cr, pose(HEDGE_X - 20, HEDGE_Y + 10, rot=0.5, s=0.95,
                                expr=facial(beat, "Spork", "happy"),
                                mouth=speaks(show, beat, "Spork", T)), T)
    for i, name in enumerate(("Mugsy", "Cone")):
        x = 430 + i * 170
        p = idle(name, T, x=x, s=0.98, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=(1, 0))
        if name == "Cone":
            p["expr"] = beat["expr"] if talker(beat, "Cone") else "happy"
            if win is not None and T > win:
                p["y"] -= abs(math.sin((T - win) * 5)) * 18
        CAST[name].draw(cr, p, T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=900, s=0.95,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True), T)
    if win is not None and T > win:
        stage.crown(cr, 600, GROUND - 190, ease_back(clamp((T - win) / 0.5)))
        stage.confetti(cr, T - win, 60)
        stage.banner(cr, 40, "CONE WINS IMMUNITY!", clamp((T - win) / 0.4),
                     (0.85, 0.42, 0.10))
    stage.vignette(cr, 0.3)


def sc_elimination(cr, show, sc, beat, T):
    votes = show.act_start(sc, "votes")
    stage.dark_stage(cr, T, spots=[(ELIM_X[n], 130, 1.0) for n in NOMINEES] +
                     [(960, 110, 0.7)])
    crew(cr, show, sc, beat, T, x=140, scale=0.36, w=310)
    for name in NOMINEES:
        x = ELIM_X[name]
        stage.podium(cr, x, GROUND + 10, 140, 120)
        if name == "Spork":
            stage.hedge(cr, x, GROUND - 20, 0.62)
        CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.8,
                                 rot=0.4 if name == "Spork" else 0.0,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, 1150)), T)
        if votes is not None and T > votes:
            k = clamp((T - votes - NOMINEES.index(name) * 0.2) / 0.4)
            stage.scorecard(cr, x, 290, name, "vote", CAST[name].tag, k,
                            w=176, size=32)
    CAST["Cone"].draw(cr, idle("Cone", T, x=960, s=0.8,
                               expr=facial(beat, "Cone", "happy"),
                               mouth=speaks(show, beat, "Cone", T),
                               look=(-1, 0)), T)
    stage.crown(cr, 960, GROUND - 150, 0.8)
    text_at(cr, 960, GROUND + 66, "SAFE", 22, (0.4, 0.9, 0.5), "center",
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
    back = show.act_start(sc, "binback")
    stage.dark_stage(cr, T, spots=[(640, 260, 0.7)])
    if T < end:
        t = T - sc["t0"]
        text_at(cr, W / 2, 130, "NEXT TIME ON", 40, (1, 1, 1), "center",
                alpha=clamp(t / 0.5))
        stage.logo(cr, W / 2, 220, 0.62, clamp(t / 0.5))
        if back is not None and T > back:
            k = ease_out(clamp((T - back) / 1.6))
            bp = pose(lerp(1560, 880, k), GROUND, s=1.5,
                      expr=facial(beat, "Bin", "happy"),
                      mouth=speaks(show, beat, "Bin", T), look=(-1, 0))
            if T < back + 2.2:
                silhouette(cr, CAST["Bin"], bp, T, alpha=0.92)
                glow_eyes(cr, bp["x"], GROUND - 152, 1.7, 26, a=0.9)
            else:
                CAST["Bin"].draw(cr, bp, T)
        CAST["Mugsy"].draw(cr, idle("Mugsy", T, x=330, s=0.95,
                                    expr=facial(beat, "Mugsy", "shock"),
                                    mouth=speaks(show, beat, "Mugsy", T),
                                    look=(1, 0)), T)
        CAST["Mega"].draw(cr, idle("Mega", T, x=560, s=0.9,
                                   expr=facial(beat, "Mega", "smug"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(1, 0), flip=True), T)
    else:
        t = T - end
        stage.logo(cr, W / 2, 250, lerp(1.25, 1.0, ease_out(clamp(t / 0.8))),
                   1.0, sub='Episode 8: "Bin Day"',
                   sub_a=clamp((t - 0.7) / 0.6))
        for i, name in enumerate(FIELD):
            st = 0.5 + i * 0.16
            if t < st:
                continue
            k = clamp((t - st) / 0.5)
            CAST[name].draw(cr, pose(400 + i * 240,
                                     GROUND + 120 - bounce(k) * 120,
                                     s=0.92), T)
        text_at(cr, W / 2, 400, "VOTE IN THE COMMENTS", 30, (1, 1, 1),
                "center", alpha=clamp((t - 1.3) / 0.6))
    stage.vignette(cr, 0.4)


SCENE_FN = {
    "recap": sc_recap, "title": sc_title, "vote": sc_vote,
    "hardshoulder": sc_hardshoulder, "cross": sc_cross,
    "results": sc_results, "elimination": sc_elimination, "outro": sc_outro,
}

EPISODE = Show("ep07", 'Episode 7: "The Motorway"', BEATS, TOTAL, SCENE_FN)
