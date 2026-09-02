"""Odds & Ends, episode 4: "The Rulebook".

The kitchen light goes out, Cone reads rule seventeen aloud, and something in
the dark takes an interest.  It is a little scary.  It is also, eventually,
recycling night.
"""

import math

import ep03
import stage
from cast import CAST, hand_pos, pose
from draw import (GROUND, H, W, bounce, clamp, ease_back, ease_in_out,
                  ease_out, lerp, rand01, set_rgb, text_at)
from engine import (Show, camera, facial, glow_eyes, idle, look_at,
                    silhouette, speaks, talker)
from timeline import A, S

TOTAL = 300.0
LEFT = ["Mugsy", "Clip", "Cone"]              # still in the game
DRAWER_CREW = ["Volt", "Cube", "Sticky"]      # eliminated, and thriving
NOMINEES = ["Cone", "Clip"]


BEATS = [
    dict(key="recap", beats=[
        A(2.4, "flash1"),
        S("Mega", "Previously, on Odds and Ends:", "smug", act="flash1"),
        S("Mega", "a sock changed several lives.", "happy", act="flash1"),
        A(1.0, "flash2"),
        S("Mega", "Clip became a rubber band, and won.", "smug",
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
        S("Mega", "The votes are in.", "smug", act="stage"),
        A(1.2, "tally_Cone"),
        S("Mega", "Cone: eleven.", "happy", act="tally_Cone"),
        S("Cone", "Eleven. Noted. Filed.", "flat", act="tally_Cone"),
        A(1.2, "tally_Mugsy"),
        S("Mega", "Mugsy: nineteen.", "happy", act="tally_Mugsy"),
        S("Mugsy", "Nineteen! That is more than sixteen! I am improving!",
          "happy", act="tally_Mugsy"),
        A(1.4, "tally_Sticky"),
        S("Mega", "Sticky: forty-four.", "smug", act="tally_Sticky"),
        S("Sticky", "Is that a lot?", "happy", act="tally_Sticky"),
        S("Mega", "It is all of them, effectively.", "flat",
          act="tally_Sticky"),
        A(2.0, "verdict"),
        S("Mega", "Sticky. You have been eliminated.", "flat", act="verdict"),
        S("Sticky", "Does that mean I go in the drawer?", "happy",
          act="verdict"),
        S("Mega", "It does.", "flat", act="verdict"),
        S("Sticky", "With VOLT?", "happy", act="verdict"),
        S("Volt", "No. No, no, no—", "shock", act="fling"),
        A(3.0, "fling"),
        S("Sticky", "VOLT!", "happy", act="slam_shut"),
        S("Volt", "GET OFF—", "furious", act="slam_shut"),
        S("Cube", "She is stuck to him again.", "flat", act="slam_shut"),
        S("Volt", "I hate it here.", "sad", act="slam_shut"),
        S("Cube", "Welcome to the drawer. It is exactly as advertised.",
          "flat", act="slam_shut"),
        A(1.8, "slam_shut"),
    ]),

    dict(key="nightfall", beats=[
        A(3.0, "dusk"),
        S("Mega", "Three of you left. And tonight, the kitchen light goes "
          "off.", "smug", act="dusk"),
        A(3.4, "lightsout"),
        S("Mugsy", "Oh no.", "worried", act="lightsout"),
        S("Mega", "Tonight's challenge: THE NIGHT WATCH.", "happy",
          act="brief"),
        S("Mega", "Stay in the kitchen until sunrise. Last one here wins.",
          "smug", act="brief"),
        S("Clip", "Still here? Where would we go?", "happy", act="brief"),
        S("Mega", "Excellent question. Good luck.", "smug", act="exit"),
        A(3.2, "exit"),
        S("Mugsy", "He left. He never leaves.", "shock", act="exit"),
        S("Cone", "I will consult the rulebook.", "flat", act="rules"),
        S("Clip", "It is a menu.", "flat", act="rules"),
        S("Cone", "It has SEVENTEEN rules.", "flat", act="rules"),
        S("Cone", "Rule one: no tape. Rule two: no glue.", "flat",
          act="rules"),
        S("Cone", "Rule sixteen: soup of the day.", "flat", act="rules"),
        S("Cone", "Rule seventeen: do not read the rules aloud.", "flat",
          act="rules"),
        A(3.2, "rules"),
        S("Mugsy", "...Cone.", "shock", act="rules"),
        S("Cone", "I have made an error.", "flat", act="rules"),
        A(3.4, "rules"),
    ]),

    dict(key="watch", beats=[
        A(3.4, "creak"),
        S("Mugsy", "What was that?", "shock", act="creak"),
        S("Clip", "Nothing. It was nothing. I am not scared.", "worried",
          act="creak"),
        S("Cone", "There is a rule about noises. I am certain of it.",
          "flat", act="creak"),
        S("Clip", "Read the rule. Read it NOW.", "shock", act="creak"),
        A(3.2, "creak"),
        S("Clip", "I am a little scared.", "worried", act="creak"),
        A(2.4, "drip"),
        S("Mugsy", "I can hear breathing.", "shock", act="drip"),
        S("Cube", "That is me. I am dripping.", "flat", act="drip"),
        S("Mugsy", "That is WORSE!", "shock", act="drip"),
        A(3.2, "claws"),
        S("Clip", "THERE IS SOMETHING WITH CLAWS!", "shock", act="claws"),
        S("Mugsy", "Why is the moon looking at us?", "shock",
          act="claws"),
        S("Cone", "That is a whisk.", "flat", act="claws"),
        S("Clip", "IT IS A WHISK WITH CLAWS.", "furious", act="claws"),
        A(3.2, "hide"),
        S("Mugsy", "I am going to hide in the cupboard.", "worried",
          act="hide"),
        S("Cone", "There is no rule permitting hiding.", "flat", act="hide"),
        S("Mugsy", "There is no rule against it!", "shock", act="hide"),
        S("Cone", "...That is legally sound. Go.", "flat", act="hide"),
        A(3.2, "hide"),
        A(3.2, "eyes"),
        S("Clip", "Cone. Cone. Behind you.", "shock", act="eyes"),
        S("Cone", "I am not falling for—", "flat", act="eyes"),
        S("Volt", "Whatever that is, it is not coming in HERE.", "flat",
          act="eyes"),
        A(3.2, "eyes"),
        S("Cone", "That is a large silhouette.", "shock", act="loom"),
        S("Clip", "RUN! RUN!", "shock", act="loom"),
        A(3.4, "loom"),
    ]),

    dict(key="bin", beats=[
        A(2.8, "meet"),
        S("Bin", "...hello.", "flat", act="meet"),
        S("Cone", "Hello.", "shock", act="meet"),
        S("Bin", "I am here for the paper.", "flat", act="meet"),
        S("Cone", "The what?", "shock", act="meet"),
        S("Bin", "The paper. It is recycling night.", "happy", act="polite"),
        S("Bin", "Do not be alarmed. I am on wheels.", "happy",
          act="polite"),
        S("Cone", "This is a rulebook.", "flat", act="polite"),
        S("Bin", "It is a menu.", "flat", act="polite"),
        A(2.4, "polite"),
        S("Cone", "...It is a menu.", "sad", act="take"),
        A(3.0, "take"),
        S("Bin", "Thank you. Good night.", "happy", act="take"),
        A(3.0, "sunrise"),
        S("Clip", "That is a recycling bin.", "flat", act="sunrise"),
        S("Cone", "That was my entire personality.", "sad", act="sunrise"),
        S("Mega", "Sunrise! Who is still here?", "happy", act="sunrise"),
        A(3.0, "win"),
        S("Mugsy", "I have been terrified for six hours. Did I win?",
          "worried", act="win"),
        S("Mega", "You never once left the kitchen. MUGSY WINS IMMUNITY.",
          "happy", act="win"),
        S("Mugsy", "I have been afraid my whole life and it finally paid off.",
          "happy", act="win"),
        A(2.8, "win"),
    ]),

    dict(key="elimination", beats=[
        A(2.6, "stage2"),
        S("Mega", "Cone. Clip. You are up for elimination.", "smug",
          act="podium"),
        S("Cone", "I have no rulebook. I have nothing.", "sad", act="podium"),
        S("Clip", "I ran away from a bin.", "flat", act="podium"),
        S("Mega", "You did.", "smug", act="podium"),
        A(1.6, "votes"),
        S("Mega", "Viewers: vote in the comments.", "happy", act="votes"),
        S("Sticky", "Come and stay with us!", "happy", act="votes"),
        S("Volt", "Do NOT come and stay with us.", "furious", act="votes"),
        S("Cube", "We have a sock.", "happy", act="votes"),
        A(4.0, "votes"),
    ]),

    dict(key="outro", beats=[
        A(1.8, "next"),
        S("Mega", "Next time, on Odds and Ends:", "happy", act="next"),
        S("Mega", "the dishwasher.", "smug", act="next"),
        S("Mugsy", "The WHAT?", "shock", act="next"),
        A(2.4, "next"),
        A(6.5, "endcard"),
    ]),
]


# ---------------------------------------------------------------- scenes ---

VOTES = {"Cone": 11, "Mugsy": 19, "Sticky": 44}
VOTE_X = {"Cone": 260, "Mugsy": 510, "Sticky": 760}
VOTE_DRAWER_X = 1030
KITCHEN_X = {"Cone": 360, "Clip": 620, "Mugsy": 830}
CUPBOARD_X = 1105
DRAWER_X = 150
JUDGE_X = {"Volt": 96, "Cube": 196, "Sticky": 146}
BIN_HOME = 980


def drawer_crew(cr, show, sc, beat, T, light=0.0):
    """The eliminated, watching from the drawer.  There are three now."""
    stage.drawer(cr, DRAWER_X, GROUND + 20, 290, 150, open_k=1.0, t=T)
    CAST["Volt"].draw(cr, pose(JUDGE_X["Volt"], GROUND - 26, s=0.5,
                               expr=facial(beat, "Volt", "flat"),
                               mouth=speaks(show, beat, "Volt", T)), T)
    CAST["Sticky"].draw(cr, pose(JUDGE_X["Sticky"], GROUND - 26, s=0.5,
                                 rot=0.22,
                                 expr=facial(beat, "Sticky", "happy"),
                                 mouth=speaks(show, beat, "Sticky", T)), T)
    CAST["Cube"].draw(cr, pose(JUDGE_X["Cube"], GROUND - 26, s=0.5,
                               expr=facial(beat, "Cube", "flat"),
                               mouth=speaks(show, beat, "Cube", T)), T)


def line_at(sc, needle):
    """Start time of the first spoken line containing *needle*."""
    for b in sc["beats"]:
        if b["kind"] == "say" and needle in b["text"]:
            return b["t0"]
    return None


def flicker(cr, show, T, base=0.0):
    """Light that cannot be relied upon."""
    f = base
    for cue in ("thunder", "boo"):
        s = show.since(cue, T, 0.9)
        if s is not None:
            f = max(f, (1 - s / 0.9) ** 2)
    if f > 0:
        stage.flash(cr, f * 0.65, (0.85, 0.90, 1.0))


def sc_recap(cr, show, sc, beat, T):
    show3 = ep03.EPISODE
    clips = {"flash1": (139.0, 7.0), "flash2": (176.0, 5.0),
             "flash3": (268.0, 6.0)}
    t0, t1, act = show.act_span(sc, T)
    src, span = clips.get(act, clips["flash1"])
    lt = T - t0
    T3 = src + lt * (span / max(0.6, t1 - t0))
    sc3, beat3 = show3.locate(T3)
    cr.save()
    show3.fn[sc3["key"]](cr, show3, sc3, beat3, T3)
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
    set_rgb(cr, (0.13, 0.15, 0.30))
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
        set_rgb(cr, (1, 1, 1), 0.05)
        cr.fill()
    cr.restore()
    slam = show.cue_at["slam"][0] - sc["t0"]
    if t > slam - 0.5:
        k = clamp((t - slam + 0.45) / 0.55)
        stage.logo(cr, W / 2, 300, lerp(3.4, 1.0, ease_out(k)), 1.0,
                   sub='Episode 4: "The Rulebook"' if t > slam + 0.9 else None,
                   sub_a=clamp((t - slam - 0.9) / 0.5))
    fl = show.since("slam", T, 0.35)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.35) * 0.55)
    for i, name in enumerate(["Mugsy", "Clip", "Cone", "Sticky"]):
        st = slam + 1.7 + i * 0.28
        if t < st:
            continue
        k = clamp((t - st) / 0.55)
        CAST[name].draw(cr, pose(300 + i * 230, GROUND + 120 - bounce(k) * 120,
                                 s=0.92, sq=1 + 0.12 * (1 - k)), T)
    stage.vignette(cr, 0.4)


def sc_vote(cr, show, sc, beat, T):
    verdict = show.act_start(sc, "verdict")
    fling = show.act_start(sc, "fling")
    shut = show.act_start(sc, "slam_shut")
    shake = 0.0
    sl = show.since("slam", T, 0.6)
    if sl is not None and shut is not None and T > shut:
        shake = 10 * (1 - sl / 0.6)
    cr.save()
    camera(cr, 1.0, W / 2, H / 2, shake, T)
    stage.dark_stage(cr, T, spots=[(VOTE_X[n], 130, 1.0) for n in VOTE_X])

    flying = fling is not None and T > fling + 0.15
    gone = fling is not None and T > fling + 1.15
    for name in ("Cone", "Mugsy", "Sticky"):
        x = VOTE_X[name]
        stage.podium(cr, x, GROUND + 10, 140, 120)
        if not (name == "Sticky" and flying):
            CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.85,
                                     expr=facial(beat, name, "flat"),
                                     mouth=speaks(show, beat, name, T),
                                     look=look_at(x, 1200)), T)
        ts = show.act_start(sc, "tally_" + name)
        if ts is not None and T > ts:
            k = ease_out(clamp((T - ts) / 0.9))
            col = CAST[name].tag
            if name == "Sticky" and verdict is not None and T > verdict:
                col = (0.95, 0.30, 0.28) if int(T * 4) % 2 else (1, 0.75, 0.3)
            stage.scorecard(cr, x, 236, name,
                            "%d votes" % int(round(VOTES[name] * k)), col,
                            clamp((T - ts) / 0.35), w=188, size=30)

    if flying and not gone:
        f = clamp((T - fling - 0.15) / 1.0)
        CAST["Sticky"].draw(cr, pose(lerp(VOTE_X["Sticky"], VOTE_DRAWER_X, f),
                                     GROUND - math.sin(f * math.pi) * 250,
                                     rot=f * 5.0, expr="happy"), T)

    open_from = verdict if verdict is not None else fling
    if open_from is not None and T > open_from - 0.4:
        k = ease_out(clamp((T - open_from + 0.4) / 1.1))
        open_k = clamp((T - open_from - 0.4) / 0.7)
        x = lerp(1640, VOTE_DRAWER_X, k)
        stage.drawer(cr, x, GROUND, 330, 190, open_k=open_k, t=T, glow=0.6)
        if open_k > 0.5:
            CAST["Volt"].draw(cr, pose(x - 70, GROUND - 44, s=0.5,
                                       expr=facial(beat, "Volt", "furious"),
                                       mouth=speaks(show, beat, "Volt", T)), T)
            CAST["Cube"].draw(cr, pose(x + 66, GROUND - 44, s=0.5,
                                       expr=facial(beat, "Cube", "flat"),
                                       mouth=speaks(show, beat, "Cube", T)), T)
            if gone:
                CAST["Sticky"].draw(cr, pose(x - 20, GROUND - 44, s=0.5,
                                             rot=0.24,
                                             expr=facial(beat, "Sticky",
                                                         "happy"),
                                             mouth=speaks(show, beat, "Sticky",
                                                          T)), T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1225, s=0.85,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    cr.restore()
    text_at(cr, W / 2, 70, "THE VOTE", 52, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    stage.vignette(cr, 0.45)


def sc_nightfall(cr, show, sc, beat, T):
    out = show.act_start(sc, "lightsout")
    exit_t = show.act_start(sc, "exit")
    rules = show.act_start(sc, "rules")
    light = 1.0 if out is None else 1 - clamp((T - out - 0.35) / 0.25)

    stage.kitchen_night(cr, T, light=light)
    stage.cupboard(cr, CUPBOARD_X, GROUND, 0.0, light)
    stage.whisk(cr, 520, 256, 0.85, 0.12)
    drawer_crew(cr, show, sc, beat, T, light)

    for name in LEFT:
        x = KITCHEN_X[name]
        p = idle(name, T, x=x, s=1.05, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=look_at(x, 1150))
        if name == "Cone" and rules is not None and T > rules:
            p["arm_r"] = 1.15
        CAST[name].draw(cr, p, T)
        if name == "Cone" and rules is not None and T > rules:
            hx, hy = hand_pos(CAST["Cone"], p)
            stage.prop(cr, "menu", hx + 4, hy - 30, 0.95,
                       math.sin(T * 1.4) * 0.08)

    if exit_t is None or T < exit_t + 1.0:
        mx = 1180
        if exit_t is not None:
            mx = lerp(1180, 1520, ease_in_out(clamp((T - exit_t) / 1.0)))
        CAST["Mega"].draw(cr, idle("Mega", T, x=mx, s=0.95,
                                   expr=facial(beat, "Mega", "smug"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(-1, 0),
                                   step=T * 9 if exit_t is not None
                                   and T > exit_t else None), T)
    if light < 0.5:
        stage.vignette(cr, 0.55 * (1 - light))
    flicker(cr, show, T)


def sc_watch(cr, show, sc, beat, T):
    hide = show.act_start(sc, "hide")
    eyes = show.act_start(sc, "eyes")
    loom = show.act_start(sc, "loom")
    claws = show.act_start(sc, "claws")
    hidden = hide is not None and T > hide + 3.4

    stage.kitchen_night(cr, T)
    door = 0.0
    if hide is not None:
        door = clamp((T - hide - 2.6) / 0.7) - clamp((T - hide - 4.2) / 0.7)
    stage.cupboard(cr, CUPBOARD_X, GROUND, door)
    drawer_crew(cr, show, sc, beat, T)

    # the whisk, and the enormous shadow it throws
    if claws is not None and T > claws:
        k = clamp((T - claws) / 0.5)
        cr.save()
        cr.translate(760, 300)
        cr.scale(2.2, 2.2)
        cr.push_group()
        stage.whisk(cr, 0, 0, 1.0, 0.16 + math.sin(T * 2) * 0.06)
        pat = cr.pop_group()
        cr.set_source_rgba(0.02, 0.02, 0.05, 0.72 * k)
        cr.mask(pat)
        cr.restore()
    stage.whisk(cr, 520, 256, 0.85, 0.12)

    for name in LEFT:
        x = KITCHEN_X[name]
        if name == "Mugsy":
            if hidden:
                continue
            if hide is not None and T > hide + 1.2:
                k = ease_in_out(clamp((T - hide - 1.2) / 1.6))
                x = lerp(x, CUPBOARD_X, k)
        if name == "Clip" and loom is not None and T > loom + 1.2:
            k = ease_in_out(clamp((T - loom - 1.2) / 1.4))
            x = lerp(x, -160, k)
        scared = "shock" if (eyes is not None and T > eyes
                             and name != "Cone") else "worried"
        p = idle(name, T, x=x, s=1.05, expr=facial(beat, name, scared),
                 mouth=speaks(show, beat, name, T), look=(1, -0.2))
        moving = ((name == "Mugsy" and hide is not None and T > hide + 1.2)
                  or (name == "Clip" and loom is not None and T > loom + 1.2))
        if moving:
            p["step"] = T * 12
        CAST[name].draw(cr, p, T)

    # something in the dark, taking its time
    if eyes is not None and T > eyes:
        k = clamp((T - eyes) / 1.2)
        glow_eyes(cr, BIN_HOME + 200, 330, 2.0 * k, 30,
                  a=0.35 + 0.55 * abs(math.sin(T * 1.6)))
    if loom is not None and T > loom:
        k = ease_in_out(clamp((T - loom) / 2.6))
        bx = lerp(1520, BIN_HOME + 60, k)
        silhouette(cr, CAST["Bin"], pose(bx, GROUND, s=1.75, expr="flat"), T,
                   alpha=0.92)
        glow_eyes(cr, bx, GROUND - 178, 1.9, 30,
                  a=0.75 + 0.25 * math.sin(T * 3))

    stage.vignette(cr, 0.6)
    flicker(cr, show, T)
    if eyes is not None and T > eyes:
        b = 0.10 + 0.06 * math.sin(T * 5.5)
        set_rgb(cr, (0.05, 0.02, 0.10), b)
        cr.rectangle(0, 0, W, H)
        cr.fill()


def sc_bin(cr, show, sc, beat, T):
    take = show.act_start(sc, "take")
    sun = show.act_start(sc, "sunrise")
    win = show.act_start(sc, "win")
    light = 0.0 if sun is None else ease_in_out(clamp((T - sun) / 1.8))

    stage.kitchen_night(cr, T, light=light)
    door = 0.0 if win is None else clamp((T - win + 1.2) / 0.8)
    stage.cupboard(cr, CUPBOARD_X, GROUND, door, light)
    drawer_crew(cr, show, sc, beat, T, light)

    cone = idle("Cone", T, x=520, s=1.05, expr=facial(beat, "Cone", "shock"),
                mouth=speaks(show, beat, "Cone", T), look=(1, 0),
                arm_r=1.15 if take is None or T < take + 1.4 else 0.2)
    CAST["Cone"].draw(cr, cone, T)
    if take is None or T < take + 1.2:
        hx, hy = hand_pos(CAST["Cone"], cone)
        stage.prop(cr, "menu", hx + 4, hy - 30, 0.95,
                   math.sin(T * 1.4) * 0.08)

    bp = pose(BIN_HOME + 20, GROUND, s=1.6,
              expr=facial(beat, "Bin", "happy"),
              mouth=speaks(show, beat, "Bin", T), look=(-1, 0),
              arm_l=0.9 if take is not None and T > take else 0.1)
    if light < 0.35:
        silhouette(cr, CAST["Bin"], bp, T, alpha=0.92)
        glow_eyes(cr, bp["x"], GROUND - 162, 1.8, 28, a=0.9)
    else:
        CAST["Bin"].draw(cr, bp, T)
    if take is not None and T > take + 1.2:
        hx, hy = hand_pos(CAST["Bin"], bp, right=False)
        stage.prop(cr, "menu", hx, hy - 20, 0.95, -0.2)

    if win is not None and T > win - 1.0:
        k = ease_out(clamp((T - win + 1.0) / 1.2))
        CAST["Mugsy"].draw(cr, idle("Mugsy", T, x=lerp(CUPBOARD_X, 760, k),
                                    s=0.95,
                                    expr=facial(beat, "Mugsy", "worried"),
                                    mouth=speaks(show, beat, "Mugsy", T),
                                    step=T * 10 if k < 1 else None), T)
    if sun is not None and T > sun:
        CAST["Clip"].draw(cr, idle("Clip", T, x=lerp(-160, 300,
                                                     ease_out(clamp((T - sun)
                                                                    / 1.2))),
                                   s=0.95, expr=facial(beat, "Clip", "shock"),
                                   mouth=speaks(show, beat, "Clip", T)), T)
        CAST["Mega"].draw(cr, idle("Mega", T, x=lerp(1560, 1190,
                                                     ease_out(clamp((T - sun
                                                                     - 0.6)
                                                                    / 1.2))),
                                   s=0.95, expr=facial(beat, "Mega", "smug"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(-1, 0)), T)
    if light < 0.5:
        stage.vignette(cr, 0.55 * (1 - light))
    flicker(cr, show, T)
    announce = line_at(sc, "WINS IMMUNITY")
    if announce is not None and T > announce + 1.6:
        stage.confetti(cr, T - announce - 1.6, 46)
        stage.banner(cr, 40, "MUGSY WINS IMMUNITY!",
                     clamp((T - announce - 1.6) / 0.4), (0.31, 0.55, 0.86))


ELIM_X = {"Cone": 470, "Clip": 700}


def sc_elimination(cr, show, sc, beat, T):
    votes = show.act_start(sc, "votes")
    stage.dark_stage(cr, T, spots=[(ELIM_X[n], 130, 1.0) for n in NOMINEES] +
                     [(930, 110, 0.7)])
    drawer_crew(cr, show, sc, beat, T)
    for name in NOMINEES:
        x = ELIM_X[name]
        stage.podium(cr, x, GROUND + 10, 140, 120)
        CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.85,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, 1150)), T)
        if votes is not None and T > votes:
            k = clamp((T - votes - NOMINEES.index(name) * 0.2) / 0.4)
            stage.scorecard(cr, x, 280, name, "vote", CAST[name].tag, k,
                            w=176, size=32)
    CAST["Mugsy"].draw(cr, idle("Mugsy", T, x=930, s=0.8,
                                expr=facial(beat, "Mugsy"),
                                mouth=speaks(show, beat, "Mugsy", T),
                                look=(-1, 0)), T)
    stage.crown(cr, 930, GROUND - 140, 0.8)
    text_at(cr, 930, GROUND + 66, "SAFE", 24, (0.4, 0.9, 0.5), "center",
            outline=(0.12, 0.11, 0.18), outline_w=6)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1160, s=0.9,
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


def dishwasher(cr, x, y, s, t):
    from draw import rrect
    if s <= 0.002:
        return
    cr.save()
    cr.translate(x, y)
    cr.scale(s, s)
    rrect(cr, -110, -170, 220, 170, 12)
    from draw import fill_stroke
    fill_stroke(cr, (0.66, 0.68, 0.74), 5.0)
    rrect(cr, -88, -150, 176, 96, 10)
    fill_stroke(cr, (0.20, 0.30, 0.42), 4.5)
    from draw import circle
    circle(cr, 0, -102, 34)
    fill_stroke(cr, (0.45, 0.72, 0.88), 4.0)
    set_rgb(cr, (1, 1, 1), 0.5 + 0.3 * math.sin(t * 3))
    cr.arc(0, -102, 22, 0, math.tau)
    cr.fill()
    rrect(cr, -70, -40, 140, 16, 7)
    fill_stroke(cr, (0.40, 0.42, 0.48), 4.0)
    cr.restore()


def sc_outro(cr, show, sc, beat, T):
    end = show.act_start(sc, "endcard", sc["t1"])
    stage.dark_stage(cr, T, spots=[(640, 260, 0.7)])
    if T < end:
        t = T - sc["t0"]
        text_at(cr, W / 2, 140, "NEXT TIME ON", 40, (1, 1, 1), "center",
                alpha=clamp(t / 0.5))
        stage.logo(cr, W / 2, 230, 0.62, clamp(t / 0.5))
        dishwasher(cr, 640, GROUND, 1.05 * ease_out(clamp((t - 0.8) / 0.9)), T)
        CAST["Mugsy"].draw(cr, idle("Mugsy", T, x=300, s=0.95,
                                    expr=facial(beat, "Mugsy", "shock"),
                                    mouth=speaks(show, beat, "Mugsy", T),
                                    look=(1, 0)), T)
        CAST["Mega"].draw(cr, idle("Mega", T, x=1120, s=0.9,
                                   expr=facial(beat, "Mega", "smug"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(-1, 0)), T)
    else:
        t = T - end
        stage.logo(cr, W / 2, 250, lerp(1.25, 1.0, ease_out(clamp(t / 0.8))),
                   1.0, sub='Episode 5: "The Dishwasher"',
                   sub_a=clamp((t - 0.7) / 0.6))
        for i, name in enumerate(LEFT):
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
    "nightfall": sc_nightfall, "watch": sc_watch, "bin": sc_bin,
    "elimination": sc_elimination, "outro": sc_outro,
}

EPISODE = Show("ep04", 'Episode 4: "The Rulebook"', BEATS, TOTAL, SCENE_FN)
