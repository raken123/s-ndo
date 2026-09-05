"""Cue sheet shared by the soundtrack and the animation.

Both the audio renderer and the frame renderer read the same cue list, so a
crash on screen and a crash in the speakers land on the same frame.
"""

BEEP_OFFSETS = (0.05, 0.62, 1.20)


def build_cues(scenes):
    cues = []

    def add(t, kind, **kw):
        cues.append(dict(t=t, kind=kind, **kw))

    for sc in scenes:
        for b in sc["beats"]:
            act, t0 = b.get("act"), b["t0"]
            if act is None:
                continue
            if act == "reveal" and b["kind"] == "act" and t0 < 1.0:
                add(t0 + 0.35, "shine")
            elif act == "chair_shine":
                add(t0 + 0.25, "sparkle")
            elif act in ("cone_in", "mugsy_in"):
                add(t0 + 0.10, "step")
            elif act == "logo":
                add(t0 + 0.85, "whoosh")
                add(t0 + 1.55, "slam")
                add(t0 + 2.35, "sparkle")
                add(t0 + 3.10, "sparkle")
            elif act.startswith("spot_") and b["kind"] == "act":
                add(t0 + 0.12, "pop")
            elif act == "banner" and b["kind"] == "say":
                add(t0 + 0.05, "ding")
            elif act == "horn" and b["kind"] == "act":
                add(t0 + 0.02, "horn")
            elif act == "scramble" and b["kind"] == "act":
                for i in range(4):
                    add(t0 + 0.25 + i * 0.55, "boing")
            elif act == "zap" and b["kind"] == "act":
                add(t0 + 0.15, "zap")
            elif act == "melt" and b["kind"] == "act":
                for i in range(5):
                    add(t0 + 0.4 + i * 0.62, "drip")
            elif act == "cloud_up" and b["kind"] == "act":
                add(t0 + 0.1, "whoosh")
                add(t0 + 0.9, "sparkle")
            elif act == "countdown":
                if b["kind"] == "say" and b["text"].startswith(("Ten", "Three")):
                    for off in BEEP_OFFSETS:
                        add(t0 + off, "beep")
            elif act == "collapse" and b["kind"] == "act" and b["dur"] < 3.0:
                add(t0 + 0.05, "buzzer")
                for i in range(4):
                    add(t0 + 0.55 + i * 0.2, "thud")
            elif act == "measure_a" and b["kind"] == "act":
                add(t0 + 0.2, "tape")
            elif act == "measure" and b["kind"] == "act":
                add(t0 + 0.2, "tape")
            elif act == "win" and b["kind"] == "act" and b["dur"] > 2.0:
                pass
            elif act == "votes" and b["kind"] == "act" and b["dur"] > 3.0:
                for i in range(3):
                    add(t0 + 0.3 + i * 0.45, "ding")
            elif act == "endcard":
                add(t0 + 0.1, "sting")
            # --- episode 2 ---
            elif act.startswith("flash") and b["kind"] == "act":
                add(t0 + 0.05, "whoosh")
            elif act.startswith("tally_") and b["kind"] == "act":
                add(t0 + 0.15, "beep")
                add(t0 + 0.75, "ding")
            elif act == "drawer_open" and b["kind"] == "act":
                add(t0 + 0.25, "tape")
            elif act == "fling" and b["kind"] == "act":
                add(t0 + 0.10, "whoosh")
                add(t0 + 0.95, "thud")
            elif act == "slam_shut" and b["kind"] == "act" and b["dur"] > 1.8:
                add(t0 + 0.05, "slam")
            elif act == "go" and b["kind"] == "act":
                add(t0 + 0.05, "horn")
                for i in range(5):
                    add(t0 + 0.7 + i * 0.42, "step")
            elif act == "voltreveal" and b["kind"] == "act":
                add(t0 + 0.10, "stinger")
                add(t0 + 0.10, "zap")
            elif act.startswith("find_") and b["kind"] == "act":
                add(t0 + 0.30, "ding")
                add(t0 + 0.40, "sparkle")
            elif act == "timeup" and b["kind"] == "act" and b["dur"] > 2.0:
                add(t0 + 0.05, "buzzer")
            # --- episode 3 ---
            elif act == "curtain" and b["kind"] == "act":
                add(t0 + 0.05, "tape")
                add(t0 + 0.55, "ding")
            elif act.startswith("act_") and b["kind"] == "act":
                add(t0 + 0.10, "pop")
                add(t0 + 0.35, "ding")
            elif act.startswith("score_") and b["kind"] == "act":
                add(t0 + 0.15, "beep")
                add(t0 + 0.55, "beep")
            elif act == "board" and b["kind"] == "act" and b["dur"] > 2.5:
                add(t0 + 0.10, "ding")
            # --- episode 4 ---
            elif act == "lightsout" and b["kind"] == "act":
                add(t0 + 0.35, "click")
                add(t0 + 0.55, "rumble")
                add(t0 + 1.60, "wind")
            elif act == "rules" and b["kind"] == "act" and b["dur"] > 2.0:
                add(t0 + 0.10, "rumble")
                add(t0 + 0.90, "creak")
            elif act == "creak" and b["kind"] == "act":
                add(t0 + 0.20, "creak")
                for i in range(2):
                    add(t0 + 0.9 + i * 0.95, "heartbeat")
            elif act == "claws" and b["kind"] == "act":
                add(t0 + 0.10, "thunder")
            elif act == "hide" and b["kind"] == "act":
                add(t0 + 0.15, "creak")
                add(t0 + 0.95, "thud")
            elif act == "eyes" and b["kind"] == "act":
                add(t0 + 0.05, "rumble")
                for i in range(3):
                    add(t0 + 0.5 + i * 0.95, "heartbeat")
            elif act == "loom" and b["kind"] == "act":
                add(t0 + 0.10, "boo")
                add(t0 + 0.20, "thunder")
            elif act == "polite" and b["kind"] == "act":
                add(t0 + 0.20, "ding")
            elif act == "sunrise" and b["kind"] == "act":
                add(t0 + 0.10, "shine")
                add(t0 + 0.90, "sparkle")
            # --- episode 5 ---
            elif act == "door" and b["kind"] == "act":
                add(t0 + 0.15, "tape")
                add(t0 + 1.00, "ding")
            elif act.startswith("meet_") and b["kind"] == "act":
                add(t0 + 0.10, "pop")
                add(t0 + 0.30, "sparkle")
            elif act == "start" and b["kind"] == "act":
                add(t0 + 0.05, "horn")
                add(t0 + 0.60, "rumble")
            elif act == "wash" and b["kind"] == "act":
                for i in range(3):
                    add(t0 + 0.4 + i * 0.8, "drip")
            elif act == "sink" and b["kind"] == "act":
                add(t0 + 0.40, "thud")
            elif act == "warp" and b["kind"] == "act":
                add(t0 + 0.20, "creak")
            elif act == "endcycle" and b["kind"] == "act":
                add(t0 + 0.05, "beep")
                add(t0 + 0.55, "ding")
                add(t0 + 1.10, "shine")
            elif act.startswith("inspect_") and b["kind"] == "act":
                add(t0 + 0.15, "beep")
            # --- episode 6 ---
            elif act == "open" and b["kind"] == "act":
                add(t0 + 0.20, "creak")
                add(t0 + 0.90, "hum")
            elif act == "cube" and b["kind"] == "act":
                add(t0 + 0.15, "sparkle")
                add(t0 + 0.35, "freeze")
            elif act == "getin" and b["kind"] == "act":
                add(t0 + 0.10, "hum")
            elif act == "chill" and b["kind"] == "act":
                add(t0 + 0.30, "freeze")
            elif act == "stick" and b["kind"] == "act":
                add(t0 + 0.25, "freeze")
                add(t0 + 1.00, "crack")
            elif act == "brittle" and b["kind"] == "act":
                add(t0 + 0.35, "crack")
            elif act == "jar" and b["kind"] == "act":
                add(t0 + 0.20, "rumble")
                add(t0 + 1.10, "heartbeat")
            elif act == "endcold" and b["kind"] == "act":
                add(t0 + 0.05, "buzzer")
                add(t0 + 0.80, "shine")
            elif act == "road" and b["kind"] == "act":
                add(t0 + 0.10, "rumble")
                add(t0 + 1.20, "horn")
            # --- episode 7 ---
            elif act == "outside" and b["kind"] == "act":
                add(t0 + 0.20, "wind")
                add(t0 + 1.10, "pass")
            elif act == "signal" and b["kind"] == "act":
                add(t0 + 0.05, "horn")
            elif act in ("lorry", "gust") and b["kind"] == "act":
                add(t0 + 0.15, "pass")
                if act == "gust":
                    add(t0 + 0.60, "whoosh")
            elif act == "swerve" and b["kind"] == "act":
                add(t0 + 0.30, "pass")
                add(t0 + 0.95, "beepbeep")
            elif act == "hedge" and b["kind"] == "act":
                add(t0 + 0.20, "whoosh")
                add(t0 + 0.95, "thud")
            elif act == "together" and b["kind"] == "act":
                add(t0 + 0.40, "pass")
            elif act == "endcross" and b["kind"] == "act":
                add(t0 + 0.05, "buzzer")
                add(t0 + 0.70, "sparkle")
            elif act == "binback" and b["kind"] == "act":
                add(t0 + 0.15, "stinger")
                add(t0 + 1.00, "boo")

    for sc in scenes:
        if sc["key"] in ("results", "judging", "scores", "bin"):
            for b in sc["beats"]:
                if b.get("act") == "win" and b["kind"] == "say":
                    cues.append(dict(t=b["t0"] + 0.05, kind="fanfare"))
                    break
        if sc["key"] == "elimination":
            cues.append(dict(t=sc["t0"] + 0.05, kind="stinger"))
    cues.sort(key=lambda c: c["t"])
    return cues
