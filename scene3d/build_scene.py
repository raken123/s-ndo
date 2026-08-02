"""
Build a 3D testimonial scene: Kinger (from the supplied rig) speaks to camera
about Claude.

The character has no mouth, so the "talking" performance is carried entirely by
head bobs on the speech rhythm, brows, eye shape, pupil dilation, gaze and the
floating gloved hands. Captions are added later by compose.py.

Run with the bundled bpy venv:
    ./bl/bin/python build_scene.py
"""

import numpy  # noqa: F401  -- must precede bpy: avoids a glog double-init crash
import bpy
import math
import random
import os
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get(
    "KINGER_BLEND",
    "/root/.claude/uploads/82a25207-d2ec-5957-bd81-5641f11faa39/"
    "139347e7-Kinger_new_rig_Malik_Radwan.blend",
)
OUT_BLEND = os.path.join(HERE, "kinger_testimonial.blend")

FPS = 24
F_START = 1
F_END = 396  # 16.5 s

# Speech beats. Frames are inclusive; the text is used by compose.py for captions.
BEATS = [
    (1, 62, "Oh! Oh my — is it recording? It's recording."),
    (63, 128, "They asked me to say a few words about Claude."),
    (129, 200, "I handed it the most dreadful tangle of a problem…"),
    (201, 268, "…and it just understood. Straight away!"),
    (269, 330, "Didn't even sigh at me. Not once."),
    (331, 396, "Marvelous. Truly marvelous."),
]

# Frames where a blink starts (each lasts 2 frames). Kept clear of the
# wide-eyed "aha" around f201-f240.
BLINKS = [14, 46, 88, 124, 158, 190, 252, 284, 316, 358, 388]

D2R = math.radians


# ---------------------------------------------------------------- interpolation
def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


class Track:
    """Piecewise smooth interpolation over (frame, value) keys.

    Values may be floats or equal-length tuples.
    """

    def __init__(self, keys):
        self.keys = sorted(keys, key=lambda k: k[0])

    def at(self, f):
        ks = self.keys
        if f <= ks[0][0]:
            return ks[0][1]
        if f >= ks[-1][0]:
            return ks[-1][1]
        for i in range(len(ks) - 1):
            f0, v0 = ks[i]
            f1, v1 = ks[i + 1]
            if f0 <= f <= f1:
                t = smoothstep((f - f0) / (f1 - f0)) if f1 > f0 else 0.0
                if isinstance(v0, (tuple, list)):
                    return tuple(a + (b - a) * t for a, b in zip(v0, v1))
                return v0 + (v1 - v0) * t
        return ks[-1][1]


# ------------------------------------------------------------------- the scene
def clean_render_set(scene):
    """Hide everything that isn't the character, the lights or the camera.

    Skips the meshes whose hide_render is driven by the rig's sliders, so the
    rig keeps control of the brows, creases and eyelids.
    """
    driven = {
        "Brow.L", "Brow.R", "BrowCrease.L", "BrowCrease.R",
        "EyeCrease.L", "EyeCrease.R",
        "LidTop.L", "LidTop.R", "LidBot.L", "LidBot.R",
    }
    keep = {
        "Body", "Robe", "Hands", "Eye.L", "Eye.R", "Kinger_rig",
        "Camera", "Light", "Light.001", "Light.002", "Light.003",
    }
    for ob in list(scene.objects):
        if ob.name in driven or ob.name in keep:
            continue
        ob.hide_render = True
        ob.hide_viewport = True


def mat_principled(name, base, rough=0.5, metallic=0.0, emit=None, emit_str=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_str
    return m


def build_set(scene):
    """A warm, shallow interview set: dark floor, backdrop, and bokeh lights."""
    coll = bpy.data.collections.new("Testimonial Set")
    scene.collection.children.link(coll)

    def add(ob):
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        coll.objects.link(ob)
        return ob

    # Floor -------------------------------------------------------------
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
    floor = add(bpy.context.object)
    floor.name = "SET_Floor"
    floor.data.materials.append(
        mat_principled("SET_floor", (0.035, 0.030, 0.055), rough=0.36)
    )

    # Backdrop wall -----------------------------------------------------
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 11.0, 0))
    wall = add(bpy.context.object)
    wall.name = "SET_Backdrop"
    wall.rotation_euler = (math.pi / 2, 0, 0)
    wall.data.materials.append(
        mat_principled("SET_backdrop", (0.055, 0.035, 0.085), rough=0.85)
    )

    # Bokeh lights behind him -------------------------------------------
    rng = random.Random(7)
    palette = [
        ((1.0, 0.62, 0.35), 6.0),    # warm amber
        ((1.0, 0.30, 0.34), 5.0),    # circus red
        ((0.35, 0.60, 1.0), 4.5),    # cold blue
        ((1.0, 0.85, 0.55), 7.0),    # bulb white
    ]
    for i in range(38):
        col, strength = palette[i % len(palette)]
        # Big and dim rather than small and fierce: tiny bright emitters are
        # what the denoiser smears into horizontal streaks.
        r = rng.uniform(0.10, 0.26)
        x = rng.uniform(-7.5, 7.5)
        y = rng.uniform(4.5, 10.2)
        z = rng.uniform(1.6, 6.4)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, y, z), segments=16, ring_count=10)
        ob = add(bpy.context.object)
        ob.name = "SET_Bokeh_%02d" % i
        m = mat_principled(
            "SET_bokeh_%02d" % i, (0, 0, 0), rough=1.0,
            emit=col, emit_str=strength * rng.uniform(0.7, 1.35),
        )
        ob.data.materials.append(m)
        # camera rays only: they are set dressing, not light sources, so this
        # keeps them noise-free and cheap
        ob.visible_shadow = False
        ob.visible_diffuse = False
        ob.visible_glossy = False
        ob.visible_transmission = False
        ob.visible_volume_scatter = False

    # A soft rim light to lift him off the backdrop ----------------------
    rim = bpy.data.lights.new("SET_Rim", type="AREA")
    rim.energy = 260.0
    rim.size = 3.0
    rim.color = (1.0, 0.72, 0.45)
    rim_ob = add(bpy.data.objects.new("SET_Rim", rim))
    rim_ob.location = (-2.6, 3.4, 5.2)
    _aim(rim_ob, Vector((0, -0.2, 3.6)))

    # Gentle fill from camera side so the wood reads --------------------
    fill = bpy.data.lights.new("SET_Fill", type="AREA")
    fill.energy = 90.0
    fill.size = 6.0
    fill.color = (0.62, 0.70, 1.0)
    fill_ob = add(bpy.data.objects.new("SET_Fill", fill))
    fill_ob.location = (2.4, -5.2, 2.2)
    _aim(fill_ob, Vector((0, -0.2, 3.2)))

    return coll


def _aim(ob, target):
    """Point an object's -Z axis at `target`."""
    d = (Vector(target) - ob.location)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def build_world(scene):
    w = scene.world or bpy.data.worlds.new("World")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes.get("Background")
    bg.inputs[0].default_value = (0.020, 0.015, 0.035, 1.0)
    bg.inputs[1].default_value = 1.0
    scene.render.film_transparent = False


def setup_camera(scene):
    cam = bpy.data.objects["Camera"]
    cam.data.lens = 50.0
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 2.0

    # Focus on the eyes via an empty so it stays locked as he moves.
    focus = bpy.data.objects.new("CAM_Focus", None)
    scene.collection.objects.link(focus)
    focus.location = (0.0, -0.42, 3.95)
    focus.empty_display_size = 0.2
    cam.data.dof.focus_object = focus

    scene.camera = cam
    return cam, focus


# ------------------------------------------------------------- choreography
def head_tracks():
    """(nod, turn, tilt) in degrees for the head bone."""
    return Track([
        (1, (-2.0, 7.0, 3.0)),      # gazing off, hasn't noticed the camera
        (10, (-5.0, 11.0, 5.0)),
        (18, (5.0, -3.0, -4.5)),    # "Oh!" - snaps round to camera
        (30, (2.0, 0.0, -2.0)),
        (62, (0.0, 1.0, 1.0)),
        (75, (-1.5, -4.0, 2.0)),    # settling into the interview
        (100, (1.5, 3.0, -2.0)),
        (128, (0.0, 0.0, 1.0)),
        (142, (3.0, -7.0, -4.0)),   # recalling the "tangle"
        (162, (2.0, 8.0, 4.5)),
        (182, (4.0, -5.0, -3.0)),
        (200, (1.0, 2.0, 2.0)),
        (208, (-9.0, 0.0, -0.5)),   # the "aha" - chin up, pops back
        (218, (-6.0, 1.5, -2.0)),
        (242, (2.0, -2.5, 3.0)),
        (268, (0.0, 1.0, 1.0)),
        (282, (5.5, 3.5, -3.0)),    # a small chuckle
        (298, (2.0, -3.5, 3.0)),
        (312, (5.0, 2.5, -2.0)),
        (330, (1.0, 0.0, 1.0)),
        (346, (4.0, -2.0, 2.5)),    # warm, settling
        (366, (-1.0, 1.5, -1.0)),
        (382, (3.5, 0.0, 1.0)),
        (396, (1.5, 0.0, 1.5)),
    ])


def hand_tracks():
    """Object-space positions and fingers-up roll for the floating gloves."""
    # The gloves float ~0.8 m nearer the lens than his body, so they read much
    # wider than the same |x| would on him: keep them inside about ±1.0.
    left = Track([
        (1, (0.86, -0.50, 2.60)),
        (18, (0.74, -0.86, 3.12)),    # lifts as he notices the camera
        (40, (0.82, -0.70, 2.88)),
        (62, (0.86, -0.60, 2.74)),
        (92, (0.72, -0.82, 2.98)),    # small presentational gesture
        (128, (0.82, -0.64, 2.80)),
        (150, (1.00, -0.78, 3.00)),   # spreads wide: the tangle
        (176, (0.66, -0.96, 3.10)),
        (200, (0.94, -0.72, 2.90)),
        (212, (0.58, -1.04, 3.40)),   # hands snap up together
        (232, (0.62, -0.94, 3.24)),
        (268, (0.78, -0.74, 2.94)),
        (292, (0.88, -0.66, 2.78)),
        (322, (0.80, -0.78, 2.90)),
        (352, (0.68, -0.86, 2.98)),   # gentle clasp
        (396, (0.72, -0.82, 2.90)),
    ])
    right = Track([
        (1, (-0.84, -0.48, 2.54)),
        (18, (-0.78, -0.80, 2.96)),
        (40, (-0.84, -0.66, 2.80)),
        (62, (-0.88, -0.58, 2.68)),
        (92, (-0.76, -0.76, 2.86)),
        (128, (-0.84, -0.62, 2.74)),
        (150, (-0.98, -0.76, 2.92)),
        (176, (-0.70, -0.92, 3.04)),
        (200, (-0.92, -0.70, 2.84)),
        (212, (-0.56, -1.02, 3.32)),
        (232, (-0.60, -0.90, 3.18)),
        (268, (-0.76, -0.72, 2.88)),
        (292, (-0.86, -0.64, 2.72)),
        (322, (-0.78, -0.74, 2.84)),
        (352, (-0.66, -0.82, 2.90)),
        (396, (-0.70, -0.78, 2.84)),
    ])
    # roll swings the fingers inside the palm plane: 0 = out, -60 = up
    roll = Track([
        (1, -12.0), (18, -40.0), (40, -26.0), (62, -22.0),
        (92, -32.0), (128, -24.0),
        (150, -6.0), (176, -14.0), (200, -10.0),    # low and spread: the tangle
        (212, -58.0), (232, -50.0), (268, -30.0),   # thrown up on the "aha"
        (292, -24.0), (322, -28.0), (352, -26.0), (396, -24.0),
    ])
    # pitch keeps the palm toward the lens, tilting up a little as he opens out
    pitch = Track([
        (1, -86.0), (18, -92.0), (62, -88.0), (128, -88.0),
        (150, -104.0), (176, -100.0), (200, -98.0),  # palms turning upward
        (212, -82.0), (232, -84.0), (268, -88.0),
        (322, -90.0), (396, -88.0),
    ])
    return left, right, roll, pitch


def face_tracks():
    # kept modest: past ~1.3 the pupil swallows the blue iris and reads as blank
    pupil = Track([
        (1, 0.98), (16, 1.18), (40, 1.06), (62, 1.00), (128, 0.98),
        (150, 0.86), (200, 0.92),
        (208, 1.26), (232, 1.14), (268, 1.04),
        (300, 1.02), (396, 1.06),
    ])
    brow_raise = Track([
        (1, 0.000), (16, 0.075), (40, 0.030), (62, 0.020),
        (82, 0.045), (128, 0.020),
        (146, -0.020), (182, -0.026), (200, 0.000),
        (208, 0.082), (242, 0.050), (268, 0.032),
        (292, 0.042), (330, 0.036), (352, 0.030), (396, 0.026),
    ])
    brow_angle = Track([  # degrees; positive = raised outer edge (warm)
        (1, 0.0), (16, 8.0), (62, 4.0), (128, 2.0),
        (146, -15.0), (182, -16.0), (200, -6.0),
        (208, 11.0), (268, 7.0), (300, 9.0), (396, 9.0),
    ])
    squint = Track([  # 0..1, warm crinkle
        (1, 0.0), (200, 0.0), (240, 0.10), (269, 0.05),
        (286, 0.50), (330, 0.44), (352, 0.56), (396, 0.50),
    ])
    wide = Track([  # eye-open boost for the "aha"
        (1, 0.0), (14, 0.020), (60, 0.0), (200, 0.0),
        (208, 0.050), (242, 0.020), (268, 0.0), (396, 0.0),
    ])
    gaze = Track([  # PupilsCtrl offset (x, z)
        (1, (0.18, -0.05)), (16, (0.0, 0.0)), (70, (-0.05, 0.02)),
        (128, (0.0, 0.0)),
        (142, (0.13, 0.06)),   # glances away, recalling
        (172, (-0.10, 0.05)),
        (200, (0.0, 0.0)), (232, (0.0, 0.0)),
        (300, (0.045, 0.0)), (396, (0.0, 0.0)),
    ])
    return pupil, brow_raise, brow_angle, squint, wide, gaze


def speak_gate(f):
    """1.0 while he is speaking, easing to 0 in the gaps between beats."""
    best = 0.0
    for a, b, _ in BEATS:
        if a - 4 <= f <= b + 4:
            ramp = min(smoothstep((f - (a - 4)) / 7.0), smoothstep(((b + 4) - f) / 7.0))
            best = max(best, ramp)
    return best


def action_fcurves(action):
    """Yield every fcurve in an action.

    Blender 4.4+ moved fcurves into layers/strips/channelbags; fall back to the
    flat `action.fcurves` list on older versions.
    """
    if hasattr(action, "fcurves"):
        yield from action.fcurves
        return
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                yield from bag.fcurves


# ------------------------------------------------------------------ applying
class Rig:
    def __init__(self, ob):
        self.ob = ob
        self.P = ob.pose.bones
        for pb in ob.pose.bones:
            pb.rotation_mode = "XYZ"

    def rest(self):
        for pb in self.ob.pose.bones:
            pb.location = (0, 0, 0)
            pb.rotation_euler = (0, 0, 0)
            pb.scale = (1, 1, 1)

    def set_hand(self, name, pos, yaw_deg=0.0, pitch_deg=-88.0, roll_deg=-20.0):
        """Place a hand at an absolute object-space position.

        The glove is a flat, palm-down four-finger mitt lying in the XY plane at
        rest. `pitch_deg` near -90 turns the palm to face the lens, which is the
        only orientation that reads as a hand; `roll_deg` then swings the
        fingers within that plane (0 = pointing outward, -60 = pointing up).
        """
        pb = self.P[name]
        rest3 = pb.bone.matrix_local.to_3x3().normalized().to_4x4()
        m = (
            Matrix.Translation(Vector(pos))
            @ Matrix.Rotation(D2R(yaw_deg), 4, "Z")
            @ Matrix.Rotation(D2R(pitch_deg), 4, "X")
            @ Matrix.Rotation(D2R(roll_deg), 4, "Y")
            @ rest3
        )
        pb.matrix = m


def animate(rig, cam, focus):
    P = rig.P
    head = head_tracks()
    handL, handR, handRoll, handPitch = hand_tracks()
    pupil, brow_raise, brow_angle, squint, wide, gaze = face_tracks()
    rng = random.Random(11)
    # per-frame jitter phases so the idle motion never repeats exactly
    ph = [rng.uniform(0, math.tau) for _ in range(8)]

    blink_frames = set()
    for b in BLINKS:
        blink_frames.update((b, b + 1))

    anim_bones = [
        "head", "neck", "spine_fk.004", "spine_fk.005", "chest",
        "BrowCtrl.L", "BrowCtrl.R", "PupilsCtrl",
        "Pupil.L", "Pupil.R", "Iris.L", "Iris.R",
        "EyeTop.L", "EyeTop.R", "EyeBot.L", "EyeBot.R",
        "LidTop.L", "LidTop.R", "LidBot.L", "LidBot.R",
        "hand_ik.L", "hand_ik.R",
    ]

    for f in range(F_START, F_END + 1):
        t = f / FPS
        g = speak_gate(f)

        # ---- head: pose track + speech bob + idle drift -----------------
        nod, turn, tilt = head.at(f)
        bob = (
            1.7 * math.sin(math.tau * 3.55 * t + ph[0])
            + 0.8 * math.sin(math.tau * 1.75 * t + ph[1])
        ) * g
        swing = (0.9 * math.sin(math.tau * 2.1 * t + ph[2])) * g
        nod += bob + 0.55 * math.sin(math.tau * 0.31 * t + ph[3])
        turn += swing + 0.8 * math.sin(math.tau * 0.23 * t + ph[4])
        tilt += 0.6 * math.sin(math.tau * 0.19 * t + ph[5]) + 0.5 * swing
        P["head"].rotation_euler = (D2R(nod), D2R(turn), D2R(tilt))

        # neck carries a softened copy so the bend reads through the collar
        P["neck"].rotation_euler = (D2R(nod * 0.32), D2R(turn * 0.38), D2R(tilt * 0.30))

        # ---- body: breathing + weight shift -----------------------------
        breath = 1.15 * math.sin(math.tau * 0.30 * t)
        shift = 1.5 * math.sin(math.tau * 0.13 * t + ph[6])
        P["spine_fk.004"].rotation_euler = (D2R(breath * 0.6), D2R(shift * 0.5), D2R(shift))
        P["spine_fk.005"].rotation_euler = (D2R(breath), D2R(shift * 0.4), D2R(shift * 0.7))

        # ---- brows -------------------------------------------------------
        br = brow_raise.at(f)
        ba = brow_angle.at(f)
        # a touch of extra lift on stressed syllables
        br += 0.006 * g * max(0.0, math.sin(math.tau * 1.75 * t + ph[1]))
        P["BrowCtrl.L"].location = (0, 0, br)
        P["BrowCtrl.R"].location = (0, 0, br)
        P["BrowCtrl.L"].rotation_euler = (0, D2R(ba), 0)
        P["BrowCtrl.R"].rotation_euler = (0, D2R(-ba), 0)

        # ---- eyes: shape, pupils, gaze ------------------------------------
        sq = squint.at(f)
        wd = wide.at(f)
        top = wd - 0.070 * sq
        bot = -0.30 * wd + 0.050 * sq
        for n in ("EyeTop.L", "EyeTop.R"):
            P[n].location = (0, 0, top)
        for n in ("EyeBot.L", "EyeBot.R"):
            P[n].location = (0, 0, bot)

        ps = pupil.at(f)
        for n in ("Pupil.L", "Pupil.R"):
            P[n].scale = (ps, ps, ps)

        gx, gz = gaze.at(f)
        # small involuntary darts while he talks
        gx += 0.012 * g * math.sin(math.tau * 0.63 * t + ph[7])
        gz += 0.008 * g * math.sin(math.tau * 0.41 * t + ph[0])
        P["PupilsCtrl"].location = (gx, 0, gz)

        # ---- blinks: the lid meshes are a binary switch at y = 0.19 --------
        lid = 0.0 if f in blink_frames else 0.38
        for n in ("LidTop.L", "LidTop.R", "LidBot.L", "LidBot.R"):
            P[n].location = (0, lid, 0)

        # hands need the body solved first, since they hang off `chest`
        bpy.context.view_layer.update()
        hl = list(handL.at(f))
        hr = list(handR.at(f))
        # gestures float a little on their own
        hl[2] += 0.022 * math.sin(math.tau * 0.47 * t + ph[2]) + 0.016 * g * math.sin(math.tau * 2.3 * t)
        hr[2] += 0.022 * math.sin(math.tau * 0.43 * t + ph[3]) + 0.016 * g * math.sin(math.tau * 2.1 * t + 1.1)
        rl = handRoll.at(f)
        pt = handPitch.at(f)
        rig.set_hand(
            "hand_ik.L", hl, yaw_deg=-14.0, pitch_deg=pt,
            roll_deg=rl + 5.0 * math.sin(math.tau * 0.33 * t + ph[4]),
        )
        rig.set_hand(
            "hand_ik.R", hr, yaw_deg=14.0, pitch_deg=pt,
            roll_deg=-(rl + 5.0 * math.sin(math.tau * 0.29 * t + ph[5])),
        )

        # ---- keyframe everything ------------------------------------------
        for n in anim_bones:
            pb = P.get(n)
            if pb is None:
                continue
            pb.keyframe_insert("location", frame=f)
            pb.keyframe_insert("rotation_euler", frame=f)
            pb.keyframe_insert("scale", frame=f)

        # ---- camera: a slow push-in with a breath of handheld --------------
        u = (f - F_START) / max(1, (F_END - F_START))
        cy = -7.50 + 0.60 * smoothstep(u)
        cx = 0.62 + 0.10 * math.sin(math.tau * 0.11 * t)
        cz = 3.50 + 0.05 * math.sin(math.tau * 0.17 * t + 1.3)
        cam.location = (cx, cy, cz)
        _aim(cam, Vector((0.0, -0.35, 3.50 + 0.03 * math.sin(math.tau * 0.2 * t))))
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)

    # the lid switch must not ease between open and closed
    ad = rig.ob.animation_data
    if ad and ad.action:
        for fc in action_fcurves(ad.action):
            if any(k in fc.data_path for k in ("LidTop", "LidBot")):
                for kp in fc.keyframe_points:
                    kp.interpolation = "CONSTANT"


def main():
    bpy.ops.wm.open_mainfile(filepath=SRC)
    scene = bpy.context.scene

    scene.frame_start = F_START
    scene.frame_end = F_END
    scene.render.fps = FPS
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100

    # Tuned on 4 CPU cores: 24 samples with OpenImageDenoise is visually clean
    # here and lands at ~30 s/frame; more samples buy almost nothing.
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.08
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 3
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 3
    scene.cycles.transmission_bounces = 3
    scene.render.use_persistent_data = True
    scene.view_settings.look = "AgX - Medium High Contrast"

    # the character ships with two stacked level-2 subsurf modifiers per mesh,
    # which is far more geometry than this shot needs
    for ob in bpy.data.objects:
        for mod in ob.modifiers:
            if mod.type == "SUBSURF":
                mod.render_levels = 1

    clean_render_set(scene)
    build_world(scene)
    build_set(scene)
    cam, focus = setup_camera(scene)

    rig = Rig(bpy.data.objects["Kinger_rig"])
    rig.rest()
    animate(rig, cam, focus)

    scene.frame_set(F_START)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print("SAVED", OUT_BLEND)


if __name__ == "__main__":
    main()
