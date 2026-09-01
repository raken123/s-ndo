"""Beats and timing, shared by every episode.

A beat is either a spoken line (S) or a wordless action beat (A).  Line
durations are derived from their length, so the timeline, the voice track
and the subtitles all agree with each other by construction.
"""


def S(who, text, expr="happy", act=None, hold=0.30, rate=1.0):
    return dict(kind="say", who=who, text=text, expr=expr, act=act,
                hold=hold, rate=rate)


def A(dur, act=None):
    return dict(kind="act", dur=dur, act=act, who=None, text="", expr=None)


def say_dur(text, rate=1.0):
    return max(1.25, min(4.8, 0.62 + 0.050 * len(text))) * rate


def build_timeline(SCENES, total=None):
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

