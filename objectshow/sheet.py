"""Contact sheet of an episode at chosen timestamps -- the storyboard check.

    python3 sheet.py ep02 out.png 4 22 40 84 130 165
"""

import sys

import cairo

import engine
import render
from draw import H, W, text_at


def sheet(show, times, out, cols=3, scale=0.5):
    rows = (len(times) + cols - 1) // cols
    sw, sh = int(W * scale), int(H * scale)
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, sw * cols, sh * rows)
    cr = cairo.Context(surf)
    fs, fc = engine.new_surface()
    for i, T in enumerate(times):
        fc.set_source_rgb(0, 0, 0)
        fc.paint()
        engine.draw_frame(fc, show, T)
        fs.flush()
        cr.save()
        cr.translate((i % cols) * sw, (i // cols) * sh)
        cr.rectangle(0, 0, sw, sh)
        cr.clip()
        cr.scale(scale, scale)
        cr.set_source_surface(fs, 0, 0)
        cr.paint()
        cr.restore()
        cr.save()
        cr.translate((i % cols) * sw, (i // cols) * sh)
        text_at(cr, 8, 26, "t=%.1f" % T, 22, (1, 1, 0),
                outline=(0, 0, 0), outline_w=5)
        cr.restore()
    surf.write_to_png(out)
    print("wrote", out)


if __name__ == "__main__":
    show = render.load(sys.argv[1])
    sheet(show, [float(a) for a in sys.argv[3:]], sys.argv[2])
