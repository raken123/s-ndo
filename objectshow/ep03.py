"""Odds & Ends, episode 3: "Sock Puppet".

Cube lost the vote and joined Volt in the drawer, where the two of them now
judge a talent show performed with an eleven-year-old sock.
"""

import math

import ep02
import stage
from cast import CAST, hand_pos, pose
from draw import (GROUND, H, W, bounce, clamp, ease_back, ease_in_out,
                  ease_out, lerp, rand01, set_rgb, text_at)
from engine import Show, camera, facial, idle, look_at, speaks, talker
from timeline import A, S

TOTAL = 300.0
LEFT = ["Mugsy", "Clip", "Cone", "Sticky"]          # still in the game
JUDGES = ["Volt", "Cube"]
NOMINEES = ["Cone", "Mugsy", "Sticky"]
ACTS = ["Cone", "Mugsy", "Clip", "Sticky"]
IMPRESSION = {"Cone": "Mega", "Mugsy": "a relaxed Mugsy",
              "Clip": "the rubber band", "Sticky": "Volt"}
TINT = {"Cone": "Mega", "Mugsy": "Mugsy", "Clip": None, "Sticky": "Volt"}
BAND = (0.92, 0.42, 0.45)
SCORES = {"Cone": (6, 7), "Mugsy": (4, 4), "Clip": (10, 10),
          "Sticky": (1, 9)}


BEATS = [
    dict(key="recap", beats=[
        A(2.4, "flash1"),
        S("Mega", "Previously, on Odds and Ends:", "smug", act="flash1"),
        S("Mega", "five objects went into a drawer.", "happy", act="flash1"),
        A(1.0, "flash2"),
        S("Mega", "One came back with a battery attached.", "smug",
          act="flash2"),
        A(1.2, "flash3"),
        S("Mega", "And then you voted. Again.", "happy", act="flash3"),
        A(3.4, "flash3"),
    ]),

    dict(key="title", beats=[
        A(8.4, "logo"),
    ]),

    dict(key="vote", beats=[
        A(2.6, "stage"),
        S("Mega", "Four of you are up for elimination. The votes are in.",
          "smug", act="stage"),
        A(1.2, "tally_Cone"),
        S("Mega", "Cone: nine votes.", "happy", act="tally_Cone"),
        S("Cone", "Nine is procedurally acceptable.", "flat",
          act="tally_Cone"),
        A(1.2, "tally_Clip"),
        S("Mega", "Clip: fourteen.", "happy", act="tally_Clip"),
        S("Clip", "My public!", "happy", act="tally_Clip"),
        S("Clip", "Fourteen people have taste.", "happy",
          act="tally_Clip"),
        A(1.2, "tally_Mugsy"),
        S("Mega", "Mugsy: sixteen.", "happy", act="tally_Mugsy"),
        S("Mugsy", "Sixteen people looked at me and decided that.",
          "worried", act="tally_Mugsy"),
        A(1.4, "tally_Cube"),
        S("Mega", "Cube: thirty-eight.", "smug", act="tally_Cube"),
        S("Cube", "...Fair.", "flat", act="tally_Cube"),
        A(2.4, "verdict"),
        S("Mega", "You are technically a liquid now, which I have decided is "
          "against the rules.", "smug", act="verdict"),
        S("Cone", "WHICH rules?", "angry", act="verdict"),
        S("Mega", "Cube. You have been eliminated.", "flat", act="verdict"),
        S("Cube", "Is it cold in the drawer?", "worried", act="verdict"),
        S("Mega", "It is not.", "flat", act="verdict"),
        S("Cube", "Then I would like to melt out here, actually—", "worried",
          act="fling"),
        A(3.0, "fling"),
        A(2.6, "slam_shut"),
        S("Volt", "Oh good. A roommate.", "smug", act="slam_shut"),
        S("Cube", "Hi, Volt.", "happy", act="slam_shut"),
        S("Volt", "Do NOT spill on me.", "furious", act="slam_shut"),
        A(1.6, "slam_shut"),
    ]),

    dict(key="challenge", beats=[
        A(1.8, "banner"),
        S("Mega", "Four objects left. Today's challenge: SOCK PUPPET.",
          "happy", act="banner"),
        A(2.2, "banner"),
        S("Mega", "This sock has been in the drawer for eleven years.",
          "smug", act="sock"),
        S("Mugsy", "Eleven?", "shock", act="sock"),
        S("Mega", "You will each wear it and perform an impression.", "happy",
          act="sock"),
        S("Clip", "Of WHOM?", "shock", act="sock"),
        S("Mega", "Of anyone here. Best impression wins immunity.", "smug",
          act="sock"),
        S("Sticky", "Can I wear it as a hat?", "happy", act="sock"),
        S("Mega", "You may wear it however you like.", "flat",
          act="sock"),
        S("Cone", "Who is judging?", "flat", act="judges"),
        S("Mega", "Our eliminated contestants. Volt. Cube.", "smug",
          act="judges"),
        S("Volt", "I will be FAIR.", "smug", act="judges"),
        S("Cube", "I will be damp.", "flat", act="judges"),
        S("Mega", "Scores out of ten. Curtain up.", "happy", act="curtain"),
        A(3.4, "curtain"),
    ]),

    dict(key="show", beats=[
        A(3.2, "act_Cone"),
        S("Cone", "I am Mega. There is no rulebook.", "flat", act="act_Cone"),
        S("Cone", "The rulebook is a menu. I said so. It is binding.", "flat",
          act="act_Cone"),
        S("Mega", "That is not what I sound like.", "flat", act="act_Cone"),
        S("Cone", "It is now.", "flat", act="act_Cone"),
        A(2.2, "score_Cone"),
        S("Volt", "Six.", "flat", act="score_Cone"),
        S("Cube", "Seven. Good posture.", "happy", act="score_Cone"),
        S("Cone", "I have prepared a second impression.", "flat",
          act="score_Cone"),
        S("Mega", "You have not.", "flat", act="score_Cone"),
        A(3.0, "act_Mugsy"),
        S("Mugsy", "Hi. I am Mugsy and I am completely relaxed.", "happy",
          act="act_Mugsy"),
        A(3.2, "act_Mugsy"),
        S("Mugsy", "The sock smells like 2014.", "worried",
          act="act_Mugsy"),
        S("Mugsy", "I cannot sustain this.", "worried", act="act_Mugsy"),
        A(2.2, "score_Mugsy"),
        S("Volt", "Four.", "flat", act="score_Mugsy"),
        S("Cube", "Four. But I felt seen.", "sad", act="score_Mugsy"),
        A(3.0, "act_Clip"),
        S("Clip", "I am a rubber band. I have no structure.", "smug",
          act="act_Clip"),
        S("Clip", "Boing. Boing. I snap under pressure and I have no plan.",
          "happy", act="act_Clip"),
        S("Clip", "Look at me. I am a LOOP with no COMMITMENT.", "angry",
          act="act_Clip"),
        A(2.6, "act_Clip"),
        S("Clip", "Nobody has ever filed anything with me.", "angry",
          act="act_Clip"),
        A(2.2, "score_Clip"),
        S("Volt", "TEN.", "happy", act="score_Clip"),
        S("Cube", "Ten. Devastating.", "happy", act="score_Clip"),
        S("Clip", "YES!", "happy", act="score_Clip"),
        A(3.2, "act_Sticky"),
        S("Sticky", "I am Volt! Everything is RIGGED!", "angry",
          act="act_Sticky"),
        S("Sticky", "I am nine volts of FURY and I live in a DRAWER!",
          "furious", act="act_Sticky"),
        A(2.6, "act_Sticky"),
        S("Volt", "...That is not funny.", "flat", act="score_Sticky"),
        S("Cube", "That is a little funny.", "happy", act="score_Sticky"),
        S("Volt", "One.", "furious", act="score_Sticky"),
        S("Cube", "Nine.", "happy", act="score_Sticky"),
        S("Sticky", "Aww.", "sad", act="score_Sticky"),
        A(3.0, "score_Sticky"),
    ]),

    dict(key="scores", beats=[
        A(3.0, "board"),
        S("Mega", "Final scores.", "smug", act="board"),
        S("Mega", "Cone: thirteen. Mugsy: eight. Sticky: ten.", "happy",
          act="board"),
        S("Mugsy", "Eight is generous.", "worried", act="board"),
        S("Sticky", "Ten! That is a whole ten!", "happy", act="board"),
        A(2.4, "board"),
        S("Mega", "Clip: twenty out of twenty.", "happy", act="board"),
        S("Clip", "I WIN? I WIN!", "happy", act="win"),
        A(2.8, "win"),
        S("Cone", "I contest the methodology.", "flat", act="win"),
        S("Mega", "Clip wins immunity.", "smug", act="win"),
        S("Clip", "I would like to thank the rubber band.", "happy",
          act="win"),
        S("Mega", "He is still a hostage.", "flat", act="win"),
        S("Clip", "He is still a hostage.", "happy", act="win"),
        A(3.0, "win"),
    ]),

    dict(key="elimination", beats=[
        A(3.4, "stage2"),
        S("Mega", "Cone. Mugsy. Sticky. You are up for elimination.", "smug",
          act="podium"),
        S("Sticky", "Me? But I am nice!", "shock", act="podium"),
        S("Mega", "Statistically, that has never helped.", "smug",
          act="podium"),
        S("Cone", "I move that we consult the rulebook.", "flat",
          act="podium"),
        S("Mega", "The rulebook is a MENU.", "angry", act="podium"),
        S("Cone", "Then I move that we order.", "flat", act="podium"),
        A(1.6, "votes"),
        S("Mega", "Viewers: vote in the comments.", "happy", act="votes"),
        S("Volt", "Drawer's got room.", "smug", act="votes"),
        S("Cube", "Can I vote?", "happy", act="votes"),
        S("Mega", "No.", "flat", act="votes"),
        A(3.0, "votes"),
    ]),

    dict(key="outro", beats=[
        A(1.8, "next"),
        S("Mega", "Next time, on Odds and Ends:", "happy", act="next"),
        S("Mega", "Cone reads the menu aloud. All of it.", "smug", act="next"),
        S("Cone", "There are seventeen appetisers.", "happy", act="next"),
        S("Mega", "Bring a fork.", "smug", act="next"),
        A(3.0, "next"),
        A(6.5, "endcard"),
    ]),
]


# ---------------------------------------------------------------- scenes ---

VOTES = {"Cone": 9, "Clip": 14, "Mugsy": 16, "Cube": 38}
VOTE_X = {"Cone": 190, "Clip": 385, "Mugsy": 580, "Cube": 775}
TOTALS = {"Cone": 13, "Mugsy": 8, "Clip": 20, "Sticky": 10}
DRAWER_X = 1000
JUDGE_DRAWER_X = 170
JUDGE_X = {"Volt": 120, "Cube": 224}
WAIT_X = [1000, 1092, 1184]
MEGA_X = 400
STAGE_X = 640
SOCK = (0.86, 0.88, 0.93)


def sock_color(name):
    """The puppet takes a hint of whoever is being impersonated."""
    target = TINT.get(name)
    c = BAND if target is None else CAST[target].color
    return tuple(0.55 * SOCK[i] + 0.45 * c[i] for i in range(3))


def judges_box(cr, show, sc, beat, T, k=1.0, paddles=None):
    """The drawer, stage left, containing this season's dead."""
    if k <= 0:
        return
    x = lerp(-360, JUDGE_DRAWER_X, ease_out(k))
    stage.drawer(cr, x, GROUND + 20, 280, 150, open_k=1.0, t=T)
    for name in JUDGES:
        dx = x - JUDGE_DRAWER_X + JUDGE_X[name]
        CAST[name].draw(cr, pose(dx, GROUND - 26, s=0.5,
                                 expr=facial(beat, name, "smug"),
                                 mouth=speaks(show, beat, name, T)), T)
        if paddles and name in paddles:
            n, pk = paddles[name]
            stage.score_paddle(cr, dx, 350, n, CAST[name].tag, pk)


def perform_pose(show, beat, name, T, t_start):
    """A contestant mid-impression: raised arm, a bit of bounce."""
    hop = abs(math.sin((T - t_start) * 3.4)) * 10
    p = idle(name, T, y=stage.STAGE_TOP - hop, x=STAGE_X, s=1.2,
             expr=facial(beat, name), mouth=speaks(show, beat, name, T),
             arm_r=1.45 + math.sin(T * 2.6) * 0.12, arm_l=0.35)
    return p


def sc_recap(cr, show, sc, beat, T):
    show2 = ep02.EPISODE
    clips = {"flash1": (146.0, 7.5), "flash2": (229.5, 5.0),
             "flash3": (271.5, 6.0)}
    t0, t1, act = show.act_span(sc, T)
    src, span = clips.get(act, clips["flash1"])
    lt = T - t0
    T2 = src + lt * (span / max(0.6, t1 - t0))
    sc2, beat2 = show2.locate(T2)
    cr.save()
    show2.fn[sc2["key"]](cr, show2, sc2, beat2, T2)
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
    set_rgb(cr, (0.60, 0.20, 0.30))
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
        stage.logo(cr, W / 2, 300, lerp(3.4, 1.0, ease_out(k)), 1.0,
                   sub='Episode 3: "Sock Puppet"' if t > slam + 0.9 else None,
                   sub_a=clamp((t - slam - 0.9) / 0.5))
    fl = show.since("slam", T, 0.35)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.35) * 0.55)
    for i, name in enumerate(ep02.LEFT):
        st = slam + 1.7 + i * 0.28
        if t < st:
            continue
        k = clamp((t - st) / 0.55)
        CAST[name].draw(cr, pose(230 + i * 205, GROUND + 120 - bounce(k) * 120,
                                 s=0.92, sq=1 + 0.12 * (1 - k)), T)


def sc_vote(cr, show, sc, beat, T):
    dopen = show.act_start(sc, "fling")
    fling = show.act_start(sc, "fling")
    shut = show.act_start(sc, "slam_shut")
    verdict = show.act_start(sc, "verdict")
    open_from = verdict if verdict is not None else fling

    shake = 0.0
    sl = show.since("slam", T, 0.6)
    if sl is not None and shut is not None and T > shut:
        shake = 10 * (1 - sl / 0.6)
    cr.save()
    camera(cr, 1.0, W / 2, H / 2, shake, T)
    stage.dark_stage(cr, T, spots=[(VOTE_X[n], 120, 1.0) for n in VOTE_X])

    flying = fling is not None and T > fling + 0.15
    gone = fling is not None and T > fling + 1.15

    for name in ("Cone", "Clip", "Mugsy", "Cube"):
        x = VOTE_X[name]
        stage.podium(cr, x, GROUND + 10, 130, 120)
        if not (name == "Cube" and flying):
            p = idle(name, T, y=GROUND + 4, x=x, s=0.82,
                     expr=facial(beat, name, "flat"),
                     mouth=speaks(show, beat, name, T), look=look_at(x, 1200))
            CAST[name].draw(cr, p, T)
        ts = show.act_start(sc, "tally_" + name)
        if ts is not None and T > ts:
            k = ease_out(clamp((T - ts) / 0.9))
            col = CAST[name].tag
            if name == "Cube" and verdict is not None and T > verdict:
                col = (0.95, 0.30, 0.28) if int(T * 4) % 2 else (1, 0.75, 0.3)
            stage.scorecard(cr, x, 236, name,
                            "%d votes" % int(round(VOTES[name] * k)), col,
                            clamp((T - ts) / 0.35), w=188, size=30)

    if flying and not gone:
        f = clamp((T - fling - 0.15) / 1.0)
        CAST["Cube"].draw(cr, pose(lerp(VOTE_X["Cube"], DRAWER_X, f),
                                   GROUND - math.sin(f * math.pi) * 250,
                                   rot=f * 6.0, expr="shock"), T)

    if open_from is not None and T > open_from - 0.4:
        k = ease_out(clamp((T - open_from + 0.4) / 1.1))
        open_k = clamp((T - open_from - 0.4) / 0.7)
        if shut is not None and T > shut:
            open_k *= 1 - ease_out(clamp((T - shut) / 0.3))
        x = lerp(1620, DRAWER_X, k)
        stage.drawer(cr, x, GROUND, 320, 190, open_k=open_k, t=T, glow=0.6)
        if open_k > 0.5:
            CAST["Volt"].draw(cr, pose(x - 60, GROUND - 44, s=0.5,
                                       expr=facial(beat, "Volt", "smug"),
                                       mouth=speaks(show, beat, "Volt", T)), T)
            if gone:
                CAST["Cube"].draw(cr, pose(x + 52, GROUND - 44, s=0.5,
                                           expr=facial(beat, "Cube", "happy"),
                                           mouth=speaks(show, beat, "Cube", T)),
                                  T)

    CAST["Mega"].draw(cr, idle("Mega", T, x=1215, s=0.85,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    cr.restore()
    text_at(cr, W / 2, 70, "THE VOTE", 52, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    if sl is not None and shut is not None and T > shut:
        stage.flash(cr, (1 - sl / 0.6) * 0.3, (1, 0.9, 0.7))
    stage.vignette(cr, 0.45)


CHAL_X = {n: 720 + i * 118 for i, n in enumerate(LEFT)}


def sc_challenge(cr, show, sc, beat, T):
    curtain = show.act_start(sc, "curtain")
    judges = show.act_start(sc, "judges")
    sock = show.act_start(sc, "sock")
    open_k = 0.0 if curtain is None else ease_in_out(clamp((T - curtain) / 1.6))
    stage.theater(cr, T, open_k, lights=0.5 + 0.5 * open_k)

    for name in LEFT:
        x = CHAL_X[name]
        CAST[name].draw(cr, idle(name, T, x=x, s=0.72,
                                 expr=facial(beat, name),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, MEGA_X)), T)

    mp = idle("Mega", T, x=MEGA_X, s=0.85, expr=facial(beat, "Mega"),
              mouth=speaks(show, beat, "Mega", T), look=(1, 0), flip=True,
              arm_l=1.3 if sock is not None and T > sock else 0.0)
    CAST["Mega"].draw(cr, mp, T)
    if sock is not None and T > sock:
        hx, hy = hand_pos(CAST["Mega"], mp, right=False)
        stage.prop(cr, "sock", hx, hy - 26,
                   1.0 * ease_back(clamp((T - sock) / 0.45)),
                   math.sin(T * 1.6) * 0.12)
    if judges is not None:
        judges_box(cr, show, sc, beat, T, clamp((T - judges) / 1.0))

    bt = show.act_start(sc, "banner")
    if bt is not None and T < bt + 6.0:
        stage.banner(cr, 60, "CHALLENGE: SOCK PUPPET",
                     clamp((T - bt) / 0.5) * clamp((bt + 6.0 - T) / 0.4),
                     (0.62, 0.13, 0.22))


def sc_show(cr, show, sc, beat, T):
    t0, t1, act = show.act_span(sc, T)
    performer = act.split("_", 1)[1] if act and "_" in act else None
    scoring = bool(act and act.startswith("score_"))
    a_start = show.act_start(sc, "act_%s" % performer, sc["t0"]) \
        if performer else sc["t0"]

    stage.theater(cr, T, 1.0)
    judges_box(cr, show, sc, beat, T, 1.0, paddles={
        j: (SCORES[performer][i], clamp((T - t0) / 0.5))
        for i, j in enumerate(JUDGES)} if scoring and performer else None)

    waiting = [n for n in LEFT if n != performer]
    for i, name in enumerate(waiting[:3]):
        x = WAIT_X[i]
        p = idle(name, T, x=x, s=0.6, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=(-1, 0))
        CAST[name].draw(cr, p, T)

    if performer:
        p = perform_pose(show, beat, performer, T, a_start)
        CAST[performer].draw(cr, p, T)
        hx, hy = hand_pos(CAST[performer], p)
        stage.sock_puppet(cr, hx, hy - 6, 1.30,
                          -0.25 + math.sin(T * 2.2) * 0.12,
                          speaks(show, beat, performer, T),
                          sock_color(performer))
        text_at(cr, STAGE_X, 104,
                "%s as %s" % (performer.upper(),
                              IMPRESSION[performer].upper()),
                28, (1, 1, 1), "center", outline=(0.12, 0.11, 0.18),
                outline_w=8, alpha=clamp((T - a_start) / 0.5))

    CAST["Mega"].draw(cr, idle("Mega", T, x=MEGA_X, s=0.85,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True), T)
    if scoring and performer:
        stage.flash(cr, clamp(1 - (T - t0) / 0.4) * 0.25, (1, 0.95, 0.7))


SCORE_X = {n: 430 + i * 130 for i, n in enumerate(["Cone", "Mugsy", "Clip",
                                                   "Sticky"])}


def sc_scores(cr, show, sc, beat, T):
    board = show.act_start(sc, "board")
    win = show.act_start(sc, "win")
    stage.theater(cr, T, 1.0)
    judges_box(cr, show, sc, beat, T, 1.0)

    for name in ["Cone", "Mugsy", "Clip", "Sticky"]:
        x = SCORE_X[name]
        p = idle(name, T, y=stage.STAGE_TOP, x=x, s=0.78,
                 expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=(1, 0))
        if win is not None and T > win and name == "Clip":
            p["y"] -= abs(math.sin((T - win) * 5)) * 20
            p["expr"] = beat["expr"] if talker(beat, "Clip") else "happy"
        CAST[name].draw(cr, p, T)
        if board is not None and T > board:
            k = clamp((T - board - list(SCORE_X).index(name) * 0.2) / 0.4)
            stage.scorecard(cr, x, 150, name, "%d / 20" % TOTALS[name],
                            CAST[name].tag, k, w=124, size=26)
    if win is not None and T > win:
        stage.crown(cr, SCORE_X["Clip"], stage.STAGE_TOP - 118,
                    ease_back(clamp((T - win) / 0.5)))
        stage.confetti(cr, T - win)
        stage.banner(cr, 40, "CLIP WINS IMMUNITY!", clamp((T - win) / 0.4),
                     (0.83, 0.21, 0.27))
    CAST["Mega"].draw(cr, idle("Mega", T, x=MEGA_X, s=0.85,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True), T)


ELIM_X = {n: 400 + i * 190 for i, n in enumerate(NOMINEES)}


def sc_elimination(cr, show, sc, beat, T):
    votes = show.act_start(sc, "votes")
    stage.dark_stage(cr, T, spots=[(ELIM_X[n], 120, 1.0) for n in NOMINEES] +
                     [(960, 110, 0.7)])
    judges_box(cr, show, sc, beat, T, 1.0)

    for name in NOMINEES:
        x = ELIM_X[name]
        stage.podium(cr, x, GROUND + 10, 130, 120)
        CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.8,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, 1160)), T)
        if votes is not None and T > votes:
            k = clamp((T - votes - NOMINEES.index(name) * 0.2) / 0.4)
            stage.scorecard(cr, x, 290, name, "vote", CAST[name].tag, k,
                            w=168, size=32)

    CAST["Clip"].draw(cr, idle("Clip", T, x=960, s=0.78,
                               expr=facial(beat, "Clip"),
                               mouth=speaks(show, beat, "Clip", T),
                               look=(-1, 0)), T)
    stage.crown(cr, 960, GROUND - 136, 0.8)
    text_at(cr, 960, GROUND + 66, "SAFE", 24, (0.4, 0.9, 0.5), "center",
            outline=(0.12, 0.11, 0.18), outline_w=6)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1170, s=0.9,
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
    stage.dark_stage(cr, T, spots=[(640, 260, 0.7)])
    if T < end:
        t = T - sc["t0"]
        text_at(cr, W / 2, 140, "NEXT TIME ON", 40, (1, 1, 1), "center",
                alpha=clamp(t / 0.5))
        stage.logo(cr, W / 2, 230, 0.62, clamp(t / 0.5))
        stage.prop(cr, "menu", 640, 420,
                   3.0 * ease_out(clamp((t - 0.8) / 0.9)),
                   math.sin(T * 1.2) * 0.08)
        cp = idle("Cone", T, x=330, s=0.95, expr=facial(beat, "Cone"),
                  mouth=speaks(show, beat, "Cone", T), look=(1, 0),
                  arm_r=0.9)
        CAST["Cone"].draw(cr, cp, T)
        CAST["Mega"].draw(cr, idle("Mega", T, x=1150, s=0.9,
                                   expr=facial(beat, "Mega", "smug"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(-1, 0)), T)
    else:
        t = T - end
        stage.logo(cr, W / 2, 250, lerp(1.25, 1.0, ease_out(clamp(t / 0.8))),
                   1.0, sub='Episode 4: "The Rulebook"',
                   sub_a=clamp((t - 0.7) / 0.6))
        for i, name in enumerate(LEFT):
            st = 0.5 + i * 0.16
            if t < st:
                continue
            k = clamp((t - st) / 0.5)
            CAST[name].draw(cr, pose(300 + i * 230,
                                     GROUND + 120 - bounce(k) * 120,
                                     s=0.92), T)
        text_at(cr, W / 2, 400, "VOTE IN THE COMMENTS", 30, (1, 1, 1),
                "center", alpha=clamp((t - 1.3) / 0.6))
    stage.vignette(cr, 0.4)


SCENE_FN = {
    "recap": sc_recap, "title": sc_title, "vote": sc_vote,
    "challenge": sc_challenge, "show": sc_show, "scores": sc_scores,
    "elimination": sc_elimination, "outro": sc_outro,
}

EPISODE = Show("ep03", 'Episode 3: "Sock Puppet"', BEATS, TOTAL, SCENE_FN)
