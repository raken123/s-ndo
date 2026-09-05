"""Renders an Odds & Ends episode to an MP4.

    python3 render.py ep01 out.mp4                  # the whole episode
    python3 render.py ep02 out.mp4 --from 90 --to 110   # a slice, for checking
    python3 render.py ep02 --frame 42.0 shot.png    # one still
    python3 render.py ep02 --list                   # running order and runtime
    python3 render.py ep05 out.mp4 --crf 23         # smaller file, x264 quality
"""

import importlib
import sys

import engine

EPISODES = ("ep01", "ep02", "ep03", "ep04", "ep05", "ep06")


def load(name):
    return importlib.import_module(name).EPISODE


def main(argv):
    if not argv or argv[0] not in EPISODES:
        raise SystemExit(__doc__)
    show = load(argv[0])
    args = argv[1:]

    if "--list" in args:
        lines = sum(1 for s in show.scenes for b in s["beats"]
                    if b["kind"] == "say")
        print("%s -- %s" % (show.key, show.title))
        for s in show.scenes:
            print("  %-12s %6.2f  ->%7.2f" % (s["key"], s["dur"], s["t1"]))
        print("  total %.2fs (%d:%05.2f), %d spoken lines" %
              (show.total, int(show.total // 60), show.total % 60, lines))
        return

    if "--frame" in args:
        i = args.index("--frame")
        surf, cr = engine.new_surface()
        cr.set_source_rgb(0, 0, 0)
        cr.paint()
        engine.draw_frame(cr, show, float(args[i + 1]))
        surf.write_to_png(args[i + 2])
        print("wrote", args[i + 2])
        return

    out = args[0]
    t_from = float(args[args.index("--from") + 1]) if "--from" in args else 0.0
    t_to = float(args[args.index("--to") + 1]) if "--to" in args else show.total
    tmp = args[args.index("--tmp") + 1] if "--tmp" in args else "/tmp"
    crf = int(args[args.index("--crf") + 1]) if "--crf" in args else 20
    engine.render(show, out, t_from, t_to, tmp=tmp, crf=crf)


if __name__ == "__main__":
    main(sys.argv[1:])
