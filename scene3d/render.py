"""
Render the testimonial scene.

    ./bl/bin/python render.py preview           # a handful of key frames
    ./bl/bin/python render.py frames [a] [b]    # the PNG sequence for compose.py

Frames land in ./out/preview or ./out/frames.
"""

import numpy  # noqa: F401  -- must precede bpy
import bpy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND = os.path.join(HERE, "kinger_testimonial.blend")
OUT = os.path.join(HERE, "out")

PREVIEW_FRAMES = [1, 150, 212, 340]


def load(res_pct=100, samples=None):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    sc.render.resolution_percentage = res_pct
    if samples:
        sc.cycles.samples = samples
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    return sc


def preview():
    sc = load(res_pct=55, samples=48)
    d = os.path.join(OUT, "preview")
    os.makedirs(d, exist_ok=True)
    for f in PREVIEW_FRAMES:
        sc.frame_set(f)
        sc.render.filepath = os.path.join(d, "p%04d.png" % f)
        bpy.ops.render.render(write_still=True)
        print("PREVIEW", f, flush=True)


def frames(a=None, b=None):
    sc = load()
    d = os.path.join(OUT, "frames")
    os.makedirs(d, exist_ok=True)
    a = int(a) if a else sc.frame_start
    b = int(b) if b else sc.frame_end
    for f in range(a, b + 1):
        path = os.path.join(d, "f%04d.png" % f)
        if os.path.exists(path):          # resumable
            continue
        sc.frame_set(f)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print("FRAME", f, flush=True)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    if mode == "preview":
        preview()
    else:
        frames(*sys.argv[2:4])
