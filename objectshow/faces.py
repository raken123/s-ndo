"""Expression chart: every face the cast can pull, resting and talking.

    python3 faces.py chart.png [Character]
"""

import sys

import cairo

import cast
from draw import text_at

ORDER = ["happy", "flat", "worried", "sad", "angry", "furious", "smug",
         "shock", "beam", "sly", "lashes", "squint", "starry", "dizzy",
         "dead"]


def chart(out, who="Mugsy", cols=5, cw=190, ch=225):
    rows = (len(ORDER) + cols - 1) // cols * 2
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, cols * cw, rows * ch)
    cr = cairo.Context(surf)
    cr.set_source_rgb(0.95, 0.96, 0.99)
    cr.paint()
    ch_obj = cast.CAST[who]
    for half, (mouth, label) in enumerate(((0.0, ""), (0.9, " talking"))):
        for i, expr in enumerate(ORDER):
            x = (i % cols) * cw + cw / 2
            y = (half * (rows // 2) + i // cols) * ch + ch - 30
            ch_obj.draw(cr, cast.pose(x, y, s=0.8, expr=expr, mouth=mouth), 0)
            text_at(cr, x, y + 22, expr + label, 16, (0.15, 0.15, 0.2),
                    "center")
    surf.write_to_png(out)
    print("wrote", out)


if __name__ == "__main__":
    chart(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "Mugsy")
