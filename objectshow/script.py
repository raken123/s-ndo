"""The screenplay for Odds & Ends, episode 1: "Stack Overflow".

A beat is either a spoken line (S) or a wordless action beat (A).  Line
durations are derived from their length, so the timeline, the voice track and
the subtitles all agree with each other by construction.
"""


def S(who, text, expr="happy", act=None, hold=0.30, rate=1.0):
    return dict(kind="say", who=who, text=text, expr=expr, act=act,
                hold=hold, rate=rate)


def A(dur, act=None):
    return dict(kind="act", dur=dur, act=act, who=None, text="", expr=None)


def say_dur(text, rate=1.0):
    return max(1.25, min(4.8, 0.62 + 0.050 * len(text))) * rate


SCENES = [
    dict(key="cold_open", beats=[
        A(3.0, "reveal"),
        S("Mega", "Ladies. Gentlemen. Objects.", "smug"),
        A(1.0, "reveal"),
        S("Mega", "Behold: the Last Good Chair.", "happy"),
        A(2.2, "chair_shine"),
        S("Cone", "That is a chair.", "flat", act="cone_in"),
        S("Mega", "That is THE chair.", "smug"),
        S("Mugsy", "The other ones wobble.", "worried", act="mugsy_in"),
        S("Mega", "The other ones WOBBLE.", "happy"),
        A(1.6, "chair_shine"),
    ]),

    dict(key="title", beats=[
        A(8.4, "logo"),
    ]),

    dict(key="rollcall", beats=[
        A(2.6, "field"),
        S("Mega", "Six objects. One chair. Let's meet them.", "happy"),
        A(1.4, "spot_Mugsy"),
        S("Mugsy", "Hi. I'm Mugsy. I am mostly ceramic and entirely nervous.",
          "worried", act="spot_Mugsy"),
        S("Mega", "Great. Next.", "flat", act="spot_Mugsy"),
        A(1.2, "spot_Clip"),
        S("Clip", "CLIP! I hold things together! Emotionally AND physically!",
          "happy", act="spot_Clip"),
        S("Mega", "Mostly physically.", "smug", act="spot_Clip"),
        A(1.2, "spot_Cone"),
        S("Cone", "Cone. I have read the rulebook twice.", "flat",
          act="spot_Cone"),
        S("Mega", "There is no rulebook.", "flat", act="spot_Cone"),
        S("Cone", "I have read it twice.", "flat", act="spot_Cone"),
        A(1.4, "spot_Sticky"),
        S("Sticky", "I'm Sticky! I wrote my whole strategy down!", "happy",
          act="spot_Sticky"),
        A(1.2, "spot_Sticky"),
        S("Sticky", "...and then I lost it.", "sad", act="spot_Sticky"),
        A(1.2, "spot_Volt"),
        S("Volt", "Volt. Nine volts. Zero patience.", "angry",
          act="spot_Volt"),
        S("Mega", "Charming.", "flat", act="spot_Volt"),
        A(1.2, "spot_Cube"),
        S("Cube", "I'm Cube. I'm chill.", "happy", act="spot_Cube"),
        S("Mega", "For how long?", "smug", act="spot_Cube"),
        S("Cube", "Ninety minutes. Tops.", "flat", act="spot_Cube"),
        S("Mega", "Delightful. Objects! To the field!", "happy",
          act="lineup"),
        A(2.6, "lineup"),
    ]),

    dict(key="challenge", beats=[
        S("Mega", "Today's challenge: STACK OVERFLOW!", "happy", act="banner"),
        A(3.0, "banner"),
        S("Mega", "Two teams. Stack yourselves as high as you can.", "happy"),
        S("Mega", "Tallest tower wins immunity. And the chair.", "smug"),
        S("Cone", "Can we use tape?", "flat"),
        S("Mega", "No.", "flat"),
        S("Cone", "Glue?", "flat"),
        S("Mega", "No.", "flat"),
        S("Cone", "Ambition?", "flat"),
        S("Mega", "...Fine. Yes. Ambition.", "smug"),
        S("Mega", "Team Uprights: Cone, Mugsy, Sticky.", "happy",
          act="team_a"),
        S("Mega", "Team Conductors: Volt, Clip, Cube.", "happy", act="team_b"),
        S("Volt", "We are going to win by SO much.", "smug", act="team_b"),
        S("Cube", "I support that statement structurally.", "happy",
          act="team_b"),
        S("Mega", "Sixty seconds. Starting NOW.", "happy", act="horn"),
        A(2.4, "horn"),
    ]),

    dict(key="stack", beats=[
        A(4.0, "scramble"),
        S("Cone", "I am the base. Structurally, I am the base.", "flat",
          act="build_a"),
        S("Mugsy", "Climbing! Climbing! Do not look at me!", "worried",
          act="build_a"),
        A(2.6, "build_a"),
        S("Mugsy", "My handle is load-bearing. Please respect it.", "worried",
          act="build_a"),
        S("Sticky", "I'm going UP!", "happy", act="build_a"),
        A(3.4, "build_a"),
        S("Volt", "Cube! Get up here! Clip, you're on top!", "angry",
          act="build_b"),
        S("Clip", "On it! I'll just clip us all together!", "happy",
          act="build_b"),
        A(2.4, "build_b"),
        S("Volt", "Do NOT clip me.", "furious", act="zap"),
        A(2.4, "zap"),
        S("Clip", "Clipped you.", "smug", act="build_b"),
        A(3.6, "towers"),
        S("Mega", "Thirty seconds!", "happy", act="towers"),
        S("Cube", "Guys. Guys. I am becoming a puddle.", "worried",
          act="melt"),
        S("Volt", "HOLD YOUR SHAPE!", "furious", act="melt"),
        A(3.6, "melt"),
        S("Cube", "That is not how ice works!", "shock", act="melt"),
        A(3.0, "wobble"),
        S("Sticky", "Ooh! A cloud!", "happy", act="cloud"),
        S("Mugsy", "Sticky. Sticky, no.", "shock", act="cloud"),
        A(3.4, "cloud_up"),
        S("Sticky", "I regret this! But I am so high up!", "shock",
          act="cloud_up"),
        S("Cone", "Sticky! Come back with our height!", "flat",
          act="cloud_up"),
        S("Mega", "Ten! Nine! Eight!", "happy", act="countdown"),
        A(3.0, "countdown"),
        S("Volt", "Nobody move. Nobody breathe.", "angry", act="countdown"),
        S("Clip", "I don't have lungs!", "happy", act="countdown"),
        S("Volt", "Then don't get LUNGS!", "furious", act="countdown"),
        A(2.4, "countdown"),
        S("Mega", "Three! Two! One!", "happy", act="countdown"),
        A(2.2, "collapse"),
        S("Cube", "puddle.", "flat", act="collapse"),
        A(3.4, "collapse"),
    ]),

    dict(key="results", beats=[
        A(2.6, "measure"),
        S("Mega", "TIME! Let us measure the towers.", "happy", act="measure"),
        S("Mega", "Team Conductors reached... zero units.", "flat",
          act="measure_b"),
        S("Volt", "We were a TOWER four seconds ago!", "furious",
          act="measure_b"),
        S("Mega", "You are a pile. Piles score zero.", "smug",
          act="measure_b"),
        S("Clip", "Do piles get participation points?", "happy",
          act="measure_b"),
        S("Mega", "No.", "flat", act="measure_b"),
        A(2.6, "measure_a"),
        S("Mega", "Team Uprights reached one hundred and forty units.",
          "happy", act="measure_a"),
        S("Mugsy", "That is higher than I have ever been. I want down.",
          "worried", act="measure_a"),
        S("Mega", "And Sticky is on a cloud, which counts.", "smug",
          act="measure_a"),
        S("Cone", "Under which rule?", "flat", act="measure_a"),
        S("Mega", "The rule where I say it counts.", "smug", act="measure_a"),
        A(2.4, "win"),
        S("Mega", "UPRIGHTS WIN! Immunity, and the Last Good Chair!", "happy",
          act="win"),
        S("Cone", "We will take turns. Alphabetically.", "flat", act="win"),
        S("Sticky", "I am still up here!", "shock", act="win"),
        A(3.0, "win"),
    ]),

    dict(key="elimination", beats=[
        A(3.4, "stage"),
        S("Mega", "Conductors. You are up for elimination.", "flat",
          act="stage"),
        S("Mega", "Volt. Clip. Cube. One of you goes in the Junk Drawer.",
          "smug", act="podium"),
        S("Volt", "This is rigged.", "furious", act="podium"),
        S("Clip", "This is CONTENT.", "happy", act="podium"),
        S("Cube", "Is the drawer cold? Asking for me.", "worried",
          act="podium"),
        A(2.4, "votes"),
        S("Mega", "Viewers: vote in the comments.", "happy", act="votes"),
        S("Mega", "Voting closes when I get bored.", "smug", act="votes"),
        S("Mega", "The chair is watching.", "smug", act="votes"),
        A(4.0, "votes"),
    ]),

    dict(key="outro", beats=[
        A(1.8, "next"),
        S("Mega", "Next time, on Odds and Ends:", "happy", act="next"),
        S("Mega", "somebody gets drawered.", "smug", act="next"),
        S("Sticky", "I AM STILL UP HERE.", "shock", act="next"),
        S("Mega", "Same objects. Fewer objects.", "smug", act="next"),
        A(2.4, "next"),
        A(6.0, "endcard"),
    ]),
]


def build_timeline(total=None):
    """Stamp absolute times onto every beat.

    If *total* is given, the final end card stretches or shrinks so the
    episode lands on exactly that runtime.
    """
    scenes, t = [], 0.0
    for sc in SCENES:
        beats, st = [], t
        for b in sc["beats"]:
            b = dict(b)
            b["dur"] = b.get("dur") or say_dur(b["text"], b.get("rate", 1.0))
            if b["kind"] == "say":
                b["speak"] = b["dur"]
                b["dur"] += b.get("hold", 0.3)
            b["t0"], b["t1"] = t, t + b["dur"]
            t = b["t1"]
            beats.append(b)
        scenes.append(dict(key=sc["key"], t0=st, t1=t, dur=t - st,
                           beats=beats))
    if total is not None:
        pad = total - t
        last, endcard = scenes[-1], scenes[-1]["beats"][-1]
        endcard["dur"] += pad
        endcard["t1"] += pad
        last["t1"] += pad
        last["dur"] += pad
        t = total
    return scenes, t


if __name__ == "__main__":
    scenes, total = build_timeline()
    lines = sum(1 for s in scenes for b in s["beats"] if b["kind"] == "say")
    for s in scenes:
        print("%-12s %6.2f  ->%7.2f" % (s["key"], s["dur"], s["t1"]))
    print("total %.2fs (%d:%05.2f), %d spoken lines" %
          (total, int(total // 60), total % 60, lines))
