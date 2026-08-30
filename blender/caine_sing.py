#!/usr/bin/env python3
"""
Caine — "I'LL MAAAKE YOUUU SAAAY NA NA NA NA" singing performance + lip sync.

Builds a bone-driven lip-sync and body performance on the Caine_rig armature
and renders it to MP4.

Usage
-----
    blender Caine_new_rig_Malik_Radwan_V2_1.blend -b -P blender/caine_sing.py -- --render
    blender Caine_new_rig_Malik_Radwan_V2_1.blend -b -P blender/caine_sing.py -- --inspect
    blender Caine_new_rig_Malik_Radwan_V2_1.blend    -P blender/caine_sing.py      # build only, keep GUI

Flags (after the bare `--`)
    --render          render the animation to MP4 after building the action
    --inspect         print a rig report and exit without changing anything
    --audio PATH      load an audio file into the sequencer so it is muxed into the MP4
    --out PATH        output file (default: //caine_sing.mp4)
    --engine NAME     BLENDER_EEVEE_NEXT (default) | CYCLES | BLENDER_WORKBENCH

Rig facts this script relies on (read out of the .blend, not guessed)
--------------------------------------------------------------------
* Armature object `Caine_rig` -> armature datablock `rig.003`, 602 bones.
* The mouth is NOT driven by shape keys. The 5 Key datablocks in the file are
  generically named (Basis, Key 1..4) and hold no visemes.
* `MouthSlider` is a rig MODE SWITCH, not a mouth-open amount. It travels on
  local X in [0.0, 0.165] (Limit Location, all six bits set) and drives:
      pose.bones["GumTopCtrl"].constraints["Stretch To"].influence = var*1/0.165
      pose.bones["GumBotCtrl"].constraints["Stretch To"].influence = var*1/0.165
      pose.bones["GumTopCtrl.001"].hide / ["GumBotCtrl.001"].hide
  So this script does NOT touch it -- whatever mode you saved the file in is
  preserved. Set MOUTH_SLIDER below to a float only if you want it forced.
* The mouth is posed with GumTopCtrl / GumBotCtrl (the lip arcs), the
  TeethTop*/TeethBot* controls (corners + width) and the tongue.01..04 chain.
* Face points along -Y, up is +Z. Mouth spans roughly Z 2.4 .. 4.0, so the
  offsets below are in the right order of magnitude for this character.
* All the other sliders (Eyes/Tongue/Baton/Suit/Jeffrey/Error/Catchlight)
  are visibility / material toggles on the same 0..0.165 travel.
"""

import sys
import math

import bpy
from mathutils import Vector, Euler

# --------------------------------------------------------------------------
# config
# --------------------------------------------------------------------------

ARMATURE = "Caine_rig"
ACTION_NAME = "Caine_SING_NANANA"

FPS = 24
RES_X, RES_Y = 1920, 1920
FRAME_START, FRAME_END = 1, 180

# Leave as None to preserve the mouth rig mode saved in the file.
# Set to 0.165 to force the "Stretch To" mouth mode fully on, 0.0 to force off.
MOUTH_SLIDER = None

# Mouth control bones, front (centre) to back (corners).
GUM_TOP, GUM_BOT = "GumTopCtrl", "GumBotCtrl"
TEETH_TOP_MID, TEETH_BOT_MID = "TeethTopMidCtrl", "TeethBotMidCtrl"
TEETH_TOP = [f"TeethTopCtrl.{s}.{i:03d}" for i in (1, 2, 3) for s in ("L", "R")]
TEETH_BOT = [f"TeethBotCtrl.{s}.{i:03d}" for i in (1, 2, 3) for s in ("L", "R")]
TONGUE = ["tongue.01", "tongue.02", "tongue.03", "tongue.04"]

# Corner bones sit further from centre as the index grows; widening should
# fall off toward the back of the mouth.
CORNER_FALLOFF = {1: 1.0, 2: 0.65, 3: 0.3}


class V:
    """A viseme: armature-space offsets in Blender units, plus shaping scalars.

    open   -- how far the bottom lip arc drops, in armature-space units
    width  -- +1 spreads the corners outward (EE), -1 purses them (OO)
    tongue -- tongue tip rotation in degrees, + is up toward the palate
    """

    def __init__(self, open=0.0, width=0.0, tongue=0.0, top_lift=None):
        self.open = open
        self.width = width
        self.tongue = tongue
        self.top_lift = open * 0.4 if top_lift is None else top_lift


VISEMES = {
    "REST": V(open=0.00, width=0.00),
    "MM":   V(open=-0.02, width=0.05),                 # M / B / P - lips pressed
    "IH":   V(open=0.14, width=0.25),                  # "I'll"
    "AA":   V(open=0.34, width=0.10),                  # "maaake", "saaay", "na"
    "OO":   V(open=0.17, width=-0.75),                 # "youuu" - pursed
    "EE":   V(open=0.09, width=0.85),                  # "-ay" tail, "y-"
    "SS":   V(open=0.06, width=0.55),                  # "s"
    "K":    V(open=0.11, width=0.15),                  # "-ke"
    "NN":   V(open=0.12, width=0.15, tongue=26.0),     # N / L / D - tongue up
}

# (frame, viseme) -- "I'LL MAAAKE YOUUU SAAAY NA NA NA NA" at 24 fps.
LIPSYNC = [
    (1,   "REST"),
    (10,  "REST"),
    (13,  "IH"),    # I'-
    (17,  "NN"),    # -ll
    (21,  "MM"),    # M-
    (25,  "AA"),    # -AAA-
    (39,  "AA"),
    (43,  "K"),     # -ke
    (47,  "EE"),    # Y-
    (51,  "OO"),    # -OUUU
    (65,  "OO"),
    (69,  "SS"),    # S-
    (73,  "AA"),    # -AAA-
    (89,  "AA"),
    (93,  "EE"),    # -y
    (100, "REST"),
    (107, "NN"),    # NA
    (111, "AA"),
    (117, "NN"),    # NA
    (121, "AA"),
    (127, "NN"),    # NA
    (131, "AA"),
    (137, "NN"),    # NA
    (142, "AA"),
    (156, "AA"),
    (168, "EE"),    # settle into a grin
    (180, "EE"),
]

# Stressed syllables -- used for the head bob, brow accents and body sway.
ACCENTS = [25, 51, 73, 111, 121, 131, 142]


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def argv():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def get_arm():
    ob = bpy.data.objects.get(ARMATURE)
    if ob is None or ob.type != "ARMATURE":
        cands = [o.name for o in bpy.data.objects if o.type == "ARMATURE"]
        raise SystemExit(f"Armature {ARMATURE!r} not found. Armatures present: {cands}")
    return ob


def to_local(pbone, delta):
    """Convert an armature-space offset into the bone's local location space.

    `bone.matrix_local` is the bone's rest matrix in armature space, so its
    inverse maps an armature-space delta onto the bone's own axes -- which is
    what `pose_bone.location` is expressed in. This is why the offsets in
    VISEMES can be written as plain (x, y, z) without knowing each bone's roll.
    """
    m = pbone.bone.matrix_local.to_3x3()
    try:
        return m.inverted() @ Vector(delta)
    except ValueError:
        return Vector(delta)


def move(pbone, delta):
    pbone.location = to_local(pbone, delta)


def rotate(pbone, rx=0.0, ry=0.0, rz=0.0):
    """Set a local rotation in degrees, respecting the bone's rotation mode."""
    e = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), "XYZ")
    if pbone.rotation_mode == "QUATERNION":
        pbone.rotation_quaternion = e.to_quaternion()
    elif pbone.rotation_mode == "AXIS_ANGLE":
        q = e.to_quaternion()
        pbone.rotation_axis_angle = (q.angle, *q.axis)
    else:
        pbone.rotation_euler = e


def key(pbone, frame, loc=False, rot=False):
    if loc:
        pbone.keyframe_insert("location", frame=frame, group=pbone.name)
    if rot:
        path = {"QUATERNION": "rotation_quaternion",
                "AXIS_ANGLE": "rotation_axis_angle"}.get(pbone.rotation_mode, "rotation_euler")
        pbone.keyframe_insert(path, frame=frame, group=pbone.name)


def pb(ob, name):
    return ob.pose.bones.get(name)


# --------------------------------------------------------------------------
# inspect
# --------------------------------------------------------------------------

def inspect(ob):
    print(f"\n=== {ob.name} -> {ob.data.name} : {len(ob.pose.bones)} bones ===")
    print(f"scene: {bpy.context.scene.frame_start}-{bpy.context.scene.frame_end} "
          f"@ {bpy.context.scene.render.fps} fps, "
          f"{bpy.context.scene.render.resolution_x}x{bpy.context.scene.render.resolution_y}")
    names = [GUM_TOP, GUM_BOT, TEETH_TOP_MID, TEETH_BOT_MID, "head", "torso", "chest",
             "MouthSlider", "TongueSlider", "BrowCtrl.L", "BrowCtrl.R", "EyesCtrl"] \
            + TEETH_TOP + TEETH_BOT + TONGUE
    print("\n  bone                      present  rot_mode     constraints")
    for n in names:
        p = pb(ob, n)
        if p is None:
            print(f"  {n:26s} MISSING")
            continue
        cons = ",".join(f"{c.type}" for c in p.constraints) or "-"
        print(f"  {n:26s} ok       {p.rotation_mode:12s} {cons}")
    missing = [n for n in names if pb(ob, n) is None]
    print(f"\n  {len(missing)} missing of {len(names)}")
    if missing:
        print(f"  missing: {missing}")


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------

def apply_viseme(ob, vis):
    v = VISEMES[vis]

    if (p := pb(ob, GUM_BOT)):
        move(p, (0.0, 0.0, -v.open))
    if (p := pb(ob, GUM_TOP)):
        move(p, (0.0, 0.0, v.top_lift))
    if (p := pb(ob, TEETH_BOT_MID)):
        move(p, (0.0, 0.0, -v.open * 0.8))
    if (p := pb(ob, TEETH_TOP_MID)):
        move(p, (0.0, 0.0, v.top_lift * 0.8))

    for name in TEETH_TOP + TEETH_BOT:
        p = pb(ob, name)
        if p is None:
            continue
        idx = int(name.rsplit(".", 1)[1])
        side = 1.0 if ".L." in name else -1.0
        fall = CORNER_FALLOFF.get(idx, 0.3)
        drop = -v.open * 0.55 * fall if "Bot" in name else v.top_lift * 0.55 * fall
        move(p, (side * v.width * 0.16 * fall, 0.0, drop))

    for i, name in enumerate(TONGUE):
        p = pb(ob, name)
        if p is None:
            continue
        rotate(p, rx=v.tongue * (1.0 - i * 0.18))


def key_viseme(ob, frame):
    for name in [GUM_TOP, GUM_BOT, TEETH_TOP_MID, TEETH_BOT_MID] + TEETH_TOP + TEETH_BOT:
        if (p := pb(ob, name)):
            key(p, frame, loc=True)
    for name in TONGUE:
        if (p := pb(ob, name)):
            key(p, frame, rot=True)


def build_lipsync(ob):
    for frame, vis in LIPSYNC:
        apply_viseme(ob, vis)
        key_viseme(ob, frame)


def build_performance(ob):
    """Head bob, brow accents, body sway and a baton flourish."""
    head, torso, chest = pb(ob, "head"), pb(ob, "torso"), pb(ob, "chest")
    brow_l, brow_r = pb(ob, "BrowCtrl.L"), pb(ob, "BrowCtrl.R")
    eyes = pb(ob, "EyesCtrl")

    # neutral at both ends
    for p in (head, torso, chest):
        if p:
            rotate(p, 0, 0, 0)
            key(p, FRAME_START, rot=True)
            key(p, FRAME_END, rot=True)

    # anticipation: head tips back just before the first word
    if head:
        rotate(head, rx=-7)
        key(head, 8, rot=True)

    # nod into every stressed syllable, drift back out between them
    for i, f in enumerate(ACCENTS):
        sway = 6.0 * (1 if i % 2 == 0 else -1)
        if head:
            rotate(head, rx=9, rz=sway * 0.5)
            key(head, f, rot=True)
            rotate(head, rx=-3, rz=sway * 0.25)
            key(head, f + 6, rot=True)
        if torso:
            rotate(torso, rx=3, rz=sway * 0.4)
            key(torso, f + 2, rot=True)
        if chest:
            rotate(chest, rz=-sway * 0.3)
            key(chest, f + 2, rot=True)

    # brows: up on the big held vowels, neutral otherwise
    for p in (brow_l, brow_r):
        if not p:
            continue
        move(p, (0, 0, 0))
        key(p, FRAME_START, loc=True)
        for f in (25, 73, 142):
            move(p, (0, 0, 0.11))
            key(p, f, loc=True)
        for f in (45, 100, 168):
            move(p, (0, 0, 0.03))
            key(p, f, loc=True)
        move(p, (0, 0, 0.05))
        key(p, FRAME_END, loc=True)

    # eyes flick on the na-na-nas
    if eyes:
        move(eyes, (0, 0, 0))
        key(eyes, FRAME_START, loc=True)
        for i, f in enumerate((111, 121, 131, 142)):
            move(eyes, (0.06 * (1 if i % 2 == 0 else -1), 0, 0.02))
            key(eyes, f, loc=True)
        move(eyes, (0, 0, 0))
        key(eyes, FRAME_END, loc=True)

    # baton flourish, if the baton control exists and is enabled
    baton = pb(ob, "BatonCtrl")
    if baton:
        for i, f in enumerate(range(100, 156, 14)):
            rotate(baton, rz=20 * (1 if i % 2 == 0 else -1))
            key(baton, f, rot=True)
        rotate(baton, 0, 0, 0)
        key(baton, FRAME_START, rot=True)
        key(baton, FRAME_END, rot=True)


def smooth(action):
    """Bezier everywhere, with a bit of snap on the consonant hits."""
    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
        fc.update()


def build(ob):
    ob.animation_data_create()
    act = bpy.data.actions.get(ACTION_NAME)
    if act:
        bpy.data.actions.remove(act)
    act = bpy.data.actions.new(ACTION_NAME)
    act.use_fake_user = True
    ob.animation_data.action = act
    # Blender 4.4+ slotted actions: assigning the action usually creates a slot
    # already, so only make one if it did not.
    ad = ob.animation_data
    if hasattr(ad, "action_slot") and ad.action_slot is None \
            and getattr(act, "slots", None) is not None:
        try:
            ad.action_slot = act.slots.new(id_type="OBJECT", name=ob.name)
        except Exception as e:
            print(f"note: could not create action slot ({e}); "
                  "keyframe_insert will handle it")

    if MOUTH_SLIDER is not None and (p := pb(ob, "MouthSlider")):
        p.location.x = MOUTH_SLIDER

    build_lipsync(ob)
    build_performance(ob)
    smooth(act)
    print(f"built action {act.name!r}: {len(act.fcurves)} fcurves, "
          f"{sum(len(fc.keyframe_points) for fc in act.fcurves)} keyframes")
    return act


# --------------------------------------------------------------------------
# scene / render
# --------------------------------------------------------------------------

def setup_scene(out, engine, audio=None):
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = FRAME_START, FRAME_END
    sc.render.fps, sc.render.fps_base = FPS, 1.0
    sc.render.resolution_x, sc.render.resolution_y = RES_X, RES_Y
    sc.render.resolution_percentage = 100

    for cand in (engine, "BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        try:
            sc.render.engine = cand
            if cand != engine:
                print(f"engine {engine!r} unavailable, using {cand!r}")
            break
        except TypeError:
            continue
    else:
        print(f"could not set engine, keeping {sc.render.engine!r}")

    sc.render.filepath = out
    sc.render.image_settings.file_format = "FFMPEG"
    ff = sc.render.ffmpeg
    ff.format = "MPEG4"
    ff.codec = "H264"
    ff.constant_rate_factor = "HIGH"
    ff.ffmpeg_preset = "GOOD"
    ff.gopsize = 12

    if audio:
        if not sc.sequence_editor:
            sc.sequence_editor_create()
        se = sc.sequence_editor
        seqs = getattr(se, "strips", None)
        if seqs is None:                      # Blender < 4.4 called them sequences
            seqs = se.sequences
        for s in [s for s in seqs if s.type == "SOUND"]:
            seqs.remove(s)
        seqs.new_sound("song", audio, 1, FRAME_START)
        ff.audio_codec = "AAC"
        ff.audio_bitrate = 192
        print(f"audio: {audio}")
    else:
        ff.audio_codec = "NONE"

    print(f"scene: {FRAME_START}-{FRAME_END} @ {FPS}fps, {RES_X}x{RES_Y}, "
          f"engine={sc.render.engine}, out={out}")


def main():
    a = argv()

    def opt(flag, default=None):
        return a[a.index(flag) + 1] if flag in a and a.index(flag) + 1 < len(a) else default

    ob = get_arm()

    if "--inspect" in a:
        inspect(ob)
        return

    build(ob)
    setup_scene(opt("--out", "//caine_sing.mp4"),
                opt("--engine", "BLENDER_EEVEE_NEXT"),
                opt("--audio"))

    if "--render" in a:
        print("rendering...")
        bpy.ops.render.render(animation=True)
        print(f"done -> {bpy.context.scene.render.filepath}")
    else:
        print("action built. pass --render to write the MP4, "
              "or save the file and scrub the timeline.")


if __name__ == "__main__":
    main()
