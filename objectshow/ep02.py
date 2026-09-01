"""Odds & Ends, episode 2: "The Junk Drawer".

Volt lost the vote.  The five survivors are sent into the drawer to salvage
one useful thing; one of them comes back with Volt.
"""

import math

import ep01
import stage
from cast import CAST, pose
from draw import (GROUND, H, W, bounce, clamp, ease_in_out, ease_out, lerp,
                  rand01, set_rgb, text_at)
from engine import Show, camera, facial, idle, look_at, speaks, talker
from timeline import A, S

TOTAL = 300.0
LEFT = ["Mugsy", "Clip", "Cone", "Sticky", "Cube"]      # still in the game
NOMINEES = ["Cone", "Mugsy", "Clip", "Cube"]
SALVAGE = {"Cone": "menu", "Mugsy": "teabag", "Clip": "band",
           "Cube": "tray", "Sticky": None}


BEATS = [
    dict(key="recap", beats=[
        A(2.4, "flash1"),
        S("Mega", "Previously, on Odds and Ends:", "smug", act="flash1"),
        S("Mega", "six objects stacked themselves for furniture.", "happy",
          act="flash1"),
        A(1.0, "flash2"),
        S("Mega", "One of them stuck to a cloud, which counted.", "smug",
          act="flash2"),
        A(1.2, "flash3"),
        S("Mega", "And then you voted.", "happy", act="flash3"),
        A(2.6, "flash3"),
    ]),

    dict(key="title", beats=[
        A(8.4, "logo"),
    ]),

    dict(key="vote", beats=[
        A(2.6, "stage"),
        S("Mega", "Welcome back. The votes are in.", "smug", act="stage"),
        A(1.2, "tally_Cube"),
        S("Mega", "Cube: twelve votes.", "happy", act="tally_Cube"),
        S("Cube", "That is fewer votes than I feared.", "happy",
          act="tally_Cube"),
        S("Cube", "Twelve is honestly flattering.", "happy",
          act="tally_Cube"),
        A(1.2, "tally_Clip"),
        S("Mega", "Clip: twenty votes.", "happy", act="tally_Clip"),
        S("Clip", "TWENTY? I am ICONIC!", "shock", act="tally_Clip"),
        A(1.4, "tally_Volt"),
        S("Mega", "Volt: forty-one votes.", "smug", act="tally_Volt"),
        S("Volt", "That is... that is most of the votes.", "worried",
          act="tally_Volt"),
        S("Mega", "That is all of the remaining votes, yes.", "smug",
          act="tally_Volt"),
        A(1.6, "verdict"),
        S("Volt", "I was ROBBED! I held that tower together!", "furious",
          act="verdict"),
        S("Clip", "I literally held that tower together.", "smug",
          act="verdict"),
        S("Volt", "NOBODY LIKES YOU EITHER!", "furious", act="verdict"),
        S("Mega", "The audience has spoken. Loudly.", "smug",
          act="verdict"),
        S("Mega", "Volt. You have been eliminated.", "flat", act="verdict"),
        A(2.0, "drawer_open"),
        S("Mega", "Please enjoy the Junk Drawer.", "smug", act="drawer_open"),
        S("Volt", "You cannot just put me in a—", "shock", act="fling"),
        A(3.0, "fling"),
        A(2.0, "slam_shut"),
        S("Mega", "Delightful.", "smug", act="slam_shut"),
        A(1.4, "slam_shut"),
    ]),

    dict(key="challenge", beats=[
        A(1.8, "banner"),
        S("Mega", "Five objects remain. Today's challenge: SALVAGE.", "happy",
          act="banner"),
        A(2.2, "banner"),
        S("Mega", "Go into the Junk Drawer. Bring back one useful thing.",
          "happy", act="rules"),
        S("Mega", "Most useful item wins immunity.", "smug", act="rules"),
        S("Cone", "Define useful.", "flat", act="rules"),
        S("Mega", "I will know it when I see it.", "smug", act="rules"),
        S("Cone", "That is not a definition.", "flat", act="rules"),
        S("Mugsy", "Is Volt still in there?", "worried", act="rules"),
        S("Mega", "Almost certainly.", "happy", act="rules"),
        S("Sticky", "Yay!", "happy", act="rules"),
        S("Mugsy", "That was not a yay situation.", "worried", act="rules"),
        S("Clip", "Is the drawer dangerous?", "happy", act="rules"),
        S("Mega", "Yes.", "flat", act="rules"),
        S("Mega", "Ninety seconds. In you go.", "happy", act="go"),
        A(3.6, "go"),
    ]),

    dict(key="inside", beats=[
        A(3.4, "enter"),
        S("Sticky", "It's cozy in here!", "happy", act="enter"),
        S("Mugsy", "It smells like batteries and regret.", "worried",
          act="enter"),
        S("Cone", "There is a rule against this. There must be.", "flat",
          act="enter"),
        A(1.4, "voltdark"),
        S("Volt", "That's me. That's my smell.", "flat", act="voltdark"),
        A(2.6, "voltreveal"),
        S("Clip", "VOLT! You look TERRIBLE!", "shock", act="voltreveal"),
        S("Volt", "I live here now. There is a sock.", "flat",
          act="voltreveal"),
        S("Mugsy", "Should we worry that he sounds happy?", "worried",
          act="voltreveal"),
        A(2.6, "find_Cone"),
        S("Cone", "A rulebook. At last, a rulebook.", "happy",
          act="find_Cone"),
        A(1.6, "find_Cube"),
        S("Cube", "An ice tray! It's like a family reunion!", "happy",
          act="find_Cube"),
        A(1.2, "find_Cube"),
        S("Cube", "They are all empty. I am the only one left.", "sad",
          act="find_Cube"),
        S("Cube", "I am going to be honest. I am sweating.", "worried",
          act="find_Cube"),
        A(1.6, "find_Mugsy"),
        S("Mugsy", "A teabag! Hello, old friend!", "happy", act="find_Mugsy"),
        A(1.6, "find_Clip"),
        S("Clip", "A RUBBER BAND. My nemesis.", "angry", act="find_Clip"),
        S("Clip", "He stretches. He snaps. He has NO structure.", "furious",
          act="find_Clip"),
        A(2.0, "find_Sticky"),
        S("Sticky", "Ooh, a sock! I do not know what it does!", "happy",
          act="find_Sticky"),
        S("Volt", "It does nothing. It has done nothing for years.",
          "flat", act="find_Sticky"),
        S("Sticky", "I found Volt!", "happy", act="find_Sticky"),
        S("Volt", "Get OFF me.", "furious", act="find_Sticky"),
        S("Sticky", "I can't! I'm so stuck!", "shock", act="find_Sticky"),
        A(2.8, "timeup"),
        S("Mega", "TIME! Bring me your salvage!", "happy", act="timeup"),
        A(1.6, "timeup"),
    ]),

    dict(key="judging", beats=[
        A(3.0, "present"),
        S("Mega", "Cone. What have you got.", "flat", act="judge_Cone"),
        S("Cone", "The rulebook.", "happy", act="judge_Cone"),
        S("Mega", "That is a takeout menu.", "flat", act="judge_Cone"),
        S("Cone", "It is the rulebook NOW.", "flat", act="judge_Cone"),
        A(1.4, "judge_Mugsy"),
        S("Mugsy", "A teabag. We were separated at the factory.", "worried",
          act="judge_Mugsy"),
        S("Mega", "Sentimental. Useless.", "smug", act="judge_Mugsy"),
        A(1.2, "judge_Clip"),
        S("Clip", "A rubber band. I brought him to face justice.", "smug",
          act="judge_Clip"),
        S("Mega", "That is a hostage.", "flat", act="judge_Clip"),
        A(1.2, "judge_Cube"),
        S("Cube", "I brought the concept of ice.", "happy", act="judge_Cube"),
        S("Mega", "You brought water.", "flat", act="judge_Cube"),
        A(1.4, "judge_Sticky"),
        S("Mega", "This is the worst salvage I have ever seen.", "flat",
          act="judge_Cube"),
        S("Clip", "Thank you.", "happy", act="judge_Cube"),
        S("Sticky", "I brought Volt!", "happy", act="judge_Sticky"),
        S("Volt", "I DID NOT CONSENT.", "furious", act="judge_Sticky"),
        A(1.6, "judge_Sticky"),
        S("Mega", "You retrieved an eliminated contestant.", "shock",
          act="judge_Sticky"),
        S("Mega", "That is the most useful thing anyone here has done.",
          "happy", act="judge_Sticky"),
        S("Mega", "STICKY WINS IMMUNITY!", "happy", act="win"),
        A(3.0, "win"),
        S("Sticky", "I still cannot let go!", "shock", act="win"),
        S("Volt", "She really cannot.", "flat", act="win"),
        A(2.4, "win"),
    ]),

    dict(key="elimination", beats=[
        A(2.6, "stage2"),
        S("Mega", "Cone. Mugsy. Clip. Cube. You are up for elimination.",
          "smug", act="podium"),
        S("Cone", "The rulebook says otherwise.", "flat", act="podium"),
        S("Mega", "The rulebook is a menu.", "flat", act="podium"),
        S("Clip", "Can I vote for the rubber band?", "happy", act="podium"),
        S("Mega", "No.", "flat", act="podium"),
        S("Cube", "Can I vote to be water somewhere else?", "worried",
          act="podium"),
        A(1.6, "votes"),
        S("Mega", "Viewers: vote in the comments.", "happy", act="votes"),
        S("Mega", "One of them joins Volt in the drawer.", "smug",
          act="votes"),
        S("Volt", "Bring snacks.", "flat", act="votes"),
        A(3.2, "votes"),
    ]),

    dict(key="outro", beats=[
        A(1.8, "next"),
        S("Mega", "Next time, on Odds and Ends:", "happy", act="next"),
        S("Mega", "somebody learns what a sock is for.", "smug", act="next"),
        S("Cube", "I am still just water!", "sad", act="next"),
        S("Sticky", "I am coming with you, Volt!", "happy", act="next"),
        S("Volt", "I know. I know you are.", "flat", act="next"),
        A(2.4, "next"),
        A(6.5, "endcard"),
    ]),
]


# ---------------------------------------------------------------- scenes ---

VOTES = {"Cube": 12, "Clip": 20, "Volt": 41}
VOTE_X = {"Volt": 240, "Clip": 460, "Cube": 680}
DRAWER_X = 1010
INSIDE_X = {"Sticky": 300, "Mugsy": 470, "Cone": 660, "Clip": 850,
            "Cube": 1040}
VOLT_DARK_X = 120
JUDGE_X = {"Cone": 240, "Mugsy": 400, "Clip": 560, "Cube": 720,
           "Sticky": 880}


def line_at(sc, prefix):
    """Start time of the first spoken line beginning with *prefix*."""
    for b in sc["beats"]:
        if b["kind"] == "say" and b["text"].startswith(prefix):
            return b["t0"]
    return None


def held_prop(cr, name, x, y, k=1.0, t=0.0):
    kind = SALVAGE.get(name)
    if not kind or k <= 0:
        return
    s = ease_back(k) if k < 1 else 1.0
    stage.prop(cr, kind, x, y + math.sin(t * 2.4 + rand01(name) * 4) * 3,
               0.9 * s, math.sin(t * 1.3) * 0.06)


def ease_back(t):
    from draw import ease_back as eb
    return eb(t)


def sc_recap(cr, show, sc, beat, T):
    """Three clips of episode 1, replayed through the same scene code."""
    show1 = ep01.EPISODE
    clips = {"flash1": (161.0, 8.0), "flash2": (186.5, 5.0),
             "flash3": (260.0, 6.0)}
    t0, t1, act = show.act_span(sc, T)
    src, span = clips.get(act, clips["flash1"])
    lt = T - t0
    T1 = src + lt * (span / max(0.6, t1 - t0))
    sc1, beat1 = show1.locate(T1)
    cr.save()
    show1.fn[sc1["key"]](cr, show1, sc1, beat1, T1)
    cr.restore()

    set_rgb(cr, (0.96, 0.80, 0.42), 0.10)
    cr.rectangle(0, 0, W, H)
    cr.fill()
    stage.vignette(cr, 0.45)
    stage.flash(cr, (1 - clamp(lt / 0.30)) * 0.85)
    # a corner tag, so it never fights whatever the replayed scene draws
    from draw import rrect
    rrect(cr, 28, 26, 318, 46, 12)
    set_rgb(cr, (0.12, 0.11, 0.18), 0.85)
    cr.fill()
    text_at(cr, 187, 58, "PREVIOUSLY ON...", 26, (1, 0.86, 0.30), "center")


def sc_title(cr, show, sc, beat, T):
    from cast import CONTESTANTS
    t = T - sc["t0"]
    set_rgb(cr, (0.42, 0.26, 0.62))
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

    slam = show.cue_at["slam"][0] - sc["t0"]
    if t > slam - 0.5:
        k = clamp((t - slam + 0.45) / 0.55)
        s = lerp(3.4, 1.0, ease_out(k))
        stage.logo(cr, W / 2, 300, s, 1.0,
                   sub='Episode 2: "The Junk Drawer"'
                   if t > slam + 0.9 else None,
                   sub_a=clamp((t - slam - 0.9) / 0.5))
    fl = show.since("slam", T, 0.35)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.35) * 0.55)
    for i, name in enumerate(CONTESTANTS):
        st = slam + 1.7 + i * 0.28
        if t < st:
            continue
        k = clamp((t - st) / 0.55)
        CAST[name].draw(cr, pose(150 + i * 196, GROUND + 120 - bounce(k) * 120,
                                 s=0.92, sq=1 + 0.12 * (1 - k)), T)


def sc_vote(cr, show, sc, beat, T):
    dopen = show.act_start(sc, "drawer_open")
    fling = show.act_start(sc, "fling")
    shut = show.act_start(sc, "slam_shut")
    verdict = show.act_start(sc, "verdict")

    shake = 0.0
    sl = show.since("slam", T, 0.6)
    if sl is not None and shut is not None and T > shut:
        shake = 10 * (1 - sl / 0.6)

    cr.save()
    camera(cr, 1.0, W / 2, H / 2, shake, T)
    stage.dark_stage(cr, T, spots=[(VOTE_X[n], 140, 1.0) for n in VOTE_X])

    flying = fling is not None and T > fling + 0.15
    gone = fling is not None and T > fling + 1.15

    for name in ("Volt", "Clip", "Cube"):
        x = VOTE_X[name]
        stage.podium(cr, x, GROUND + 10, 150, 120)
        if name == "Volt" and flying:
            continue
        p = idle(name, T, y=GROUND + 4, x=x, s=0.9,
                 expr=facial(beat, name, "flat"),
                 mouth=speaks(show, beat, name, T), look=look_at(x, 1180))
        if name == "Volt" and verdict is not None and T > verdict:
            p["expr"] = beat["expr"] if talker(beat, "Volt") else "furious"
        CAST[name].draw(cr, p, T)

        ts = show.act_start(sc, "tally_" + name)
        if ts is not None and T > ts:
            k = ease_out(clamp((T - ts) / 0.9))
            n = int(round(VOTES[name] * k))
            col = CAST[name].tag
            if name == "Volt" and verdict is not None and T > verdict:
                col = (0.95, 0.30, 0.28) if int(T * 4) % 2 else (1, 0.75, 0.3)
            stage.scorecard(cr, x, 250, name, "%d votes" % n, col,
                            clamp((T - ts) / 0.35), w=210)

    # Volt's exit, stage right, at speed
    if fling is not None and flying and not gone:
        f = clamp((T - fling - 0.15) / 1.0)
        x = lerp(VOTE_X["Volt"], DRAWER_X, f)
        y = GROUND - math.sin(f * math.pi) * 260
        CAST["Volt"].draw(cr, pose(x, y, rot=f * 7.0, expr="shock"), T)

    if dopen is not None and T > dopen - 0.4:
        k = ease_out(clamp((T - dopen + 0.4) / 1.1))
        open_k = clamp((T - dopen - 0.5) / 0.7)
        if shut is not None and T > shut:
            open_k *= 1 - ease_out(clamp((T - shut) / 0.3))
        stage.drawer(cr, lerp(1560, DRAWER_X, k), GROUND, 340, 190,
                     open_k=open_k, t=T, glow=0.6)
        text_at(cr, DRAWER_X, GROUND - 215, "THE JUNK DRAWER", 28,
                (1, 0.86, 0.30), "center", outline=(0.12, 0.11, 0.18),
                outline_w=7, alpha=clamp((T - dopen) / 0.8))

    mx = 1190 if dopen is None or T < dopen else 1235
    CAST["Mega"].draw(cr, idle("Mega", T, x=mx, s=0.95,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    cr.restore()

    text_at(cr, W / 2, 74, "THE VOTE", 54, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    if sl is not None and shut is not None and T > shut:
        stage.flash(cr, (1 - sl / 0.6) * 0.3, (1, 0.9, 0.7))
    stage.vignette(cr, 0.45)


CHAL_X = {n: 330 + i * 106 for i, n in enumerate(LEFT)}


def sc_challenge(cr, show, sc, beat, T):
    go = show.act_start(sc, "go")
    stage.sky(cr, T)
    stage.hills(cr, 0)

    for i, name in enumerate(LEFT):
        x = CHAL_X[name]
        walk = None
        if go is not None:
            st = go + 0.7 + i * 0.42
            k = clamp((T - st) / 1.1)
            if k > 0:
                x = lerp(x, DRAWER_X - 40, ease_in_out(k))
                walk = T * 11
            if k >= 1:
                continue
        p = idle(name, T, x=x, s=0.85, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=look_at(x, 150),
                 step=walk)
        CAST[name].draw(cr, p, T)

    stage.drawer(cr, DRAWER_X, GROUND, 380, 210, open_k=1.0, t=T,
                 glow=0.5 + 0.3 * math.sin(T * 2))
    CAST["Mega"].draw(cr, idle("Mega", T, x=170, s=1.1,
                               expr=facial(beat, "Mega"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True,
                               arm_r=0.8 if beat.get("act") == "banner"
                               else 0.0), T)
    bt = show.act_start(sc, "banner")
    if bt is not None and T < bt + 6.0:
        stage.banner(cr, 60, "CHALLENGE: SALVAGE",
                     clamp((T - bt) / 0.5) * clamp((bt + 6.0 - T) / 0.4),
                     (0.55, 0.38, 0.72))
    fl = show.since("horn", T, 0.4)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.4) * 0.45, (1, 0.95, 0.7))


def sc_inside(cr, show, sc, beat, T):
    reveal = show.act_start(sc, "voltreveal")
    stuck = line_at(sc, "I found Volt")
    timeup = show.act_start(sc, "timeup")
    enter_end = show.act_end(sc, "enter", sc["t0"] + 4)

    stage.drawer_room(cr, T)

    for name in LEFT:
        x = INSIDE_X[name]
        settle = clamp((T - sc["t0"]) / 3.0)
        x += math.sin(T * 1.3 + rand01(name) * 5) * 26 * (1 - settle * 0.6)
        p = idle(name, T, x=x, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T))
        if T < enter_end:
            p["step"] = T * 8
            p["look"] = (math.sin(T * 1.7), -0.3)
        if reveal is not None and reveal < T < reveal + 3.0:
            p["expr"] = beat["expr"] if talker(beat, name) else "shock"
            p["look"] = (-1, 0)
        if name == "Sticky" and stuck is not None and T > stuck:
            k = ease_in_out(clamp((T - stuck) / 1.2))
            x = lerp(x, VOLT_DARK_X + 92, k)
            p["x"] = x
            p["rot"] = k * 0.25
            p["expr"] = beat["expr"] if talker(beat, "Sticky") else "happy"
        CAST[name].draw(cr, p, T)

        fs = show.act_start(sc, "find_" + name)
        if fs is not None and T > fs:
            held_prop(cr, name, p["x"], p["y"] - 178,
                      clamp((T - fs) / 0.45), T)

    # Volt: two eyes in the dark, then the whole disappointing truth
    if reveal is None or T < reveal:
        for sgn in (-1, 1):
            for r, col in ((13, (0.15, 0.14, 0.10)), (7, (0.99, 0.92, 0.35))):
                cr.new_path()
                cr.arc(VOLT_DARK_X + sgn * 17, GROUND - 92, r, 0, math.tau)
                set_rgb(cr, col, 0.9)
                cr.fill()
    else:
        vp = idle("Volt", T, x=VOLT_DARK_X, expr=facial(beat, "Volt", "flat"),
                  mouth=speaks(show, beat, "Volt", T), look=(1, 0))
        CAST["Volt"].draw(cr, vp, T)
        if T < reveal + 0.5:
            stage.flash(cr, (1 - (T - reveal) / 0.5) * 0.5, (1, 0.95, 0.6))

    # the sock, found and immediately abandoned
    sock = line_at(sc, "Ooh, a sock")
    if sock is not None and T > sock:
        if stuck is None or T < stuck:
            stage.prop(cr, "sock", INSIDE_X["Sticky"] - 10, GROUND - 178,
                       0.9 * ease_back(clamp((T - sock) / 0.4)))
        else:
            stage.prop(cr, "sock", INSIDE_X["Sticky"] - 10, GROUND - 26,
                       0.9, 1.4)

    if timeup is not None and T > timeup:
        stage.flash(cr, clamp(1 - (T - timeup) / 0.5) * 0.55)
        text_at(cr, W / 2, 120, "TIME!", 78, (1, 0.86, 0.30), "center",
                outline=(0.12, 0.11, 0.18), outline_w=12,
                alpha=clamp((T - timeup) / 0.3))
    stage.vignette(cr, 0.35)


def sc_judging(cr, show, sc, beat, T):
    win = show.act_start(sc, "win")
    t0, t1, act = show.act_span(sc, T)
    focus = act.split("_", 1)[1] if act and act.startswith("judge_") else None

    zoom, cx = 1.0, W / 2
    if focus and win is None or (focus and win is not None and T < win):
        k = ease_in_out(clamp((T - t0) / 0.55))
        zoom, cx = lerp(1.0, 1.30, k), lerp(W / 2, JUDGE_X[focus] + 30, k)
    cr.save()
    camera(cr, zoom, cx, 420)
    stage.sky(cr, T)
    stage.hills(cr, 0)

    for name in LEFT:
        x = JUDGE_X[name]
        up = 1.1 if focus == name else 0.55
        p = idle(name, T, x=x, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), arm_l=up, arm_r=up,
                 look=look_at(x, JUDGE_X.get(focus, W) + 140))
        if name == "Cube":
            p["sq"] = 0.86
        if name == "Sticky" and win is not None and T > win:
            p["y"] -= abs(math.sin((T - win) * 5)) * 18
        CAST[name].draw(cr, p, T)
        held_prop(cr, name, x, p["y"] - 195, 1.0, T)
        if name == "Cube":
            stage.puddle(cr, x, GROUND - 4, 54)

    vp = pose(JUDGE_X["Sticky"] + 105, GROUND, rot=0.30,
              expr=facial(beat, "Volt", "furious"),
              mouth=speaks(show, beat, "Volt", T))
    CAST["Volt"].draw(cr, vp, T)

    CAST["Mega"].draw(cr, idle("Mega", T, x=1140, s=1.0,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    if win is not None and T > win:
        stage.crown(cr, JUDGE_X["Sticky"], GROUND - 250,
                    ease_back(clamp((T - win) / 0.5)))
    cr.restore()

    if win is not None and T > win:
        stage.confetti(cr, T - win)
        stage.banner(cr, 40, "STICKY WINS IMMUNITY!",
                     clamp((T - win) / 0.4), (0.85, 0.68, 0.16))
    elif focus:
        stage.nameplate(cr, W / 2, 74, focus, "salvage inspection",
                        CAST[focus].tag, clamp((T - t0) / 0.4))


ELIM_X = {n: 380 + i * 172 for i, n in enumerate(NOMINEES)}


def sc_elimination(cr, show, sc, beat, T):
    votes = show.act_start(sc, "votes")
    stage.dark_stage(cr, T, spots=[(ELIM_X[n], 120, 1.0) for n in NOMINEES] +
                     [(1040, 120, 0.7)])
    stage.drawer(cr, 140, GROUND + 30, 250, 150, open_k=1.0, t=T)
    CAST["Volt"].draw(cr, pose(140, GROUND - 34, s=0.62,
                               expr=facial(beat, "Volt", "flat"),
                               mouth=speaks(show, beat, "Volt", T)), T)

    for name in NOMINEES:
        x = ELIM_X[name]
        stage.podium(cr, x, GROUND + 10, 130, 120)
        CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.8,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, 1190)), T)
        if votes is not None and T > votes:
            k = clamp((T - votes - NOMINEES.index(name) * 0.2) / 0.4)
            if k > 0:
                stage.scorecard(cr, x, 300, name, "vote", CAST[name].tag, k,
                                w=168)

    sp = idle("Sticky", T, x=1055, s=0.8, expr=facial(beat, "Sticky"),
              mouth=speaks(show, beat, "Sticky", T), look=(-1, 0))
    CAST["Sticky"].draw(cr, sp, T)
    stage.crown(cr, 1055, GROUND - 158, 0.8)
    text_at(cr, 1055, GROUND + 66, "SAFE", 24, (0.4, 0.9, 0.5), "center",
            outline=(0.12, 0.11, 0.18), outline_w=6)

    CAST["Mega"].draw(cr, idle("Mega", T, x=1200, s=0.9,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    text_at(cr, W / 2, 74, "ELIMINATION", 54, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    if votes is not None and T > votes:
        text_at(cr, W / 2, 124, "vote in the comments", 28, (1, 1, 1),
                "center", bold=False, alpha=clamp((T - votes) / 0.5))
    stage.vignette(cr, 0.45)


def sc_outro(cr, show, sc, beat, T):
    end = show.act_start(sc, "endcard", sc["t1"])
    stage.dark_stage(cr, T, spots=[(640, 260, 0.7)])
    if T < end:
        t = T - sc["t0"]
        text_at(cr, W / 2, 140, "NEXT TIME ON", 40, (1, 1, 1), "center",
                alpha=clamp(t / 0.5))
        stage.logo(cr, W / 2, 230, 0.62, clamp(t / 0.5))
        stage.prop(cr, "sock", 640, 430, 2.6 * ease_out(clamp((t - 0.8) / 0.9)),
                   math.sin(T * 1.4) * 0.12)
        CAST["Cube"].draw(cr, pose(250, GROUND, sq=0.55,
                                   expr=facial(beat, "Cube", "sad"),
                                   mouth=speaks(show, beat, "Cube", T)), T)
        stage.puddle(cr, 250, GROUND - 4, 70)
        CAST["Sticky"].draw(cr, pose(980, GROUND, rot=0.22,
                                     expr=facial(beat, "Sticky"),
                                     mouth=speaks(show, beat, "Sticky", T)), T)
        CAST["Volt"].draw(cr, pose(1090, GROUND, rot=-0.15,
                                   expr=facial(beat, "Volt", "flat"),
                                   mouth=speaks(show, beat, "Volt", T)), T)
        CAST["Mega"].draw(cr, idle("Mega", T, x=1215, s=0.9,
                                   expr=facial(beat, "Mega", "smug"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(-1, 0)), T)
    else:
        t = T - end
        stage.logo(cr, W / 2, 250, lerp(1.25, 1.0, ease_out(clamp(t / 0.8))),
                   1.0, sub='Episode 3: "Sock Puppet"',
                   sub_a=clamp((t - 0.7) / 0.6))
        for i, name in enumerate(LEFT):
            st = 0.5 + i * 0.16
            if t < st:
                continue
            k = clamp((t - st) / 0.5)
            CAST[name].draw(cr, pose(230 + i * 205,
                                     GROUND + 120 - bounce(k) * 120, s=0.92), T)
        text_at(cr, W / 2, 400, "VOTE IN THE COMMENTS", 30, (1, 1, 1),
                "center", alpha=clamp((t - 1.3) / 0.6))
    stage.vignette(cr, 0.4)


SCENE_FN = {
    "recap": sc_recap, "title": sc_title, "vote": sc_vote,
    "challenge": sc_challenge, "inside": sc_inside, "judging": sc_judging,
    "elimination": sc_elimination, "outro": sc_outro,
}

EPISODE = Show("ep02", 'Episode 2: "The Junk Drawer"', BEATS, TOTAL, SCENE_FN)
