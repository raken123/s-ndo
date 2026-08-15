"""Rasterise res/icon.svg into every icon a Cordova/Electron build wants.

Headless Chromium does the rendering, so the PNGs match what the SVG looks like
in the app itself. Pillow assembles the Windows .ico; the .icns is written by
hand, because it is only a magic word and a list of length-prefixed PNGs and
Pillow's ICNS writer is not dependable off macOS.

Outputs (all under res/):
  icon/android/{ldpi..xxxhdpi}.png        legacy launcher icons
  icon/android/{d}-fg.png, {d}-bg.png     adaptive icon layers
  icon/png/{16..1024}.png                 Electron / Linux
  icon.ico                                Windows
  icon.icns                               macOS
"""
import os, re, shutil, struct, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
RES = os.path.join(ROOT, "res")
SVG = os.path.join(RES, "icon.svg")

CHROME = next((p for p in ("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
                           "/opt/pw-browsers/chromium",
                           shutil.which("chromium"),
                           shutil.which("chromium-browser"),
                           shutil.which("google-chrome")) if p and os.path.exists(p)), None)

# `--window-size` sizes the window, not the viewport: full Chromium reserves ~87
# rows for UI it never draws and pads the shot with transparency, which silently
# crops tall artwork. Render into a deliberately over-tall window and crop the
# exact square back out, which is correct under both headless_shell and Chromium.
SLACK = 160

ANDROID = {"ldpi": 36, "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
PNGS = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
ICO = [16, 24, 32, 48, 64, 128, 256]
# ICNS slot -> pixel size. All PNG-backed slots.
ICNS = [(b"icp4", 16), (b"icp5", 32), (b"ic07", 128),
        (b"ic08", 256), (b"ic09", 512), (b"ic10", 1024)]


def log(*a):
    print(*a, flush=True)


def read_svg():
    with open(SVG, encoding="utf-8") as fh:
        return fh.read()


def inner(svg):
    """Everything between <svg ...> and </svg>."""
    return re.sub(r"^.*?<svg[^>]*>", "", svg, flags=re.S).rsplit("</svg>", 1)[0]


def variants(svg):
    """The three artworks: full tile, adaptive background, adaptive foreground."""
    body = inner(svg)
    # The background tile is the first <rect .../> with the bg gradient.
    bg_rect = re.search(r'<rect width="512" height="512"[^>]*/>', body).group(0)
    robot = body.replace(bg_rect, "")

    full = svg
    # Adaptive background: the same gradient, square (the launcher applies the mask).
    background = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
                  + re.search(r"<defs>.*?</defs>", body, flags=re.S).group(0)
                  + bg_rect.replace(' rx="112"', "")
                  + "</svg>")
    # Adaptive foreground: robot only, shrunk into the 66% safe zone.
    foreground = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
                  + re.search(r"<defs>.*?</defs>", body, flags=re.S).group(0)
                  + '<g transform="translate(256 256) scale(0.66) translate(-256 -256)">'
                  + robot + "</g></svg>")
    return full, background, foreground


def render(svg_text, size, out):
    """Screenshot the SVG at size x size on a transparent ground."""
    from PIL import Image

    if not CHROME:
        sys.exit("no chromium found; cannot rasterise icons")
    with tempfile.TemporaryDirectory() as tmp:
        page = os.path.join(tmp, "i.html")
        shot = os.path.join(tmp, "shot.png")
        with open(page, "w", encoding="utf-8") as fh:
            fh.write("<!DOCTYPE html><meta charset='utf-8'>"
                     "<style>html,body{margin:0;padding:0;background:transparent}"
                     "svg{display:block;width:%dpx;height:%dpx}</style>%s"
                     % (size, size, svg_text))
        subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox",
                        "--hide-scrollbars", "--force-device-scale-factor=1",
                        "--default-background-color=00000000",
                        "--virtual-time-budget=1500",
                        "--screenshot=" + shot,
                        "--window-size=%d,%d" % (size, size + SLACK),
                        "--user-data-dir=" + os.path.join(tmp, "u"),
                        page],
                       check=True, capture_output=True)
        if not os.path.exists(shot):
            sys.exit("chromium produced no output for " + out)
        im = Image.open(shot).convert("RGBA").crop((0, 0, size, size))
        if im.getbbox() is None:
            sys.exit("rendered %s at %dpx came out empty" % (out, size))
        im.save(out)


def write_icns(sources, out):
    """icns = 'icns' + total length + [type][len][png] ..."""
    chunks = b""
    for slot, size in ICNS:
        with open(sources[size], "rb") as fh:
            data = fh.read()
        chunks += slot + struct.pack(">I", len(data) + 8) + data
    with open(out, "wb") as fh:
        fh.write(b"icns" + struct.pack(">I", len(chunks) + 8) + chunks)


def main():
    from PIL import Image

    full, background, foreground = variants(read_svg())
    andir = os.path.join(RES, "icon", "android")
    pngdir = os.path.join(RES, "icon", "png")
    os.makedirs(andir, exist_ok=True)
    os.makedirs(pngdir, exist_ok=True)

    log("android launcher icons")
    for name, px in sorted(ANDROID.items(), key=lambda kv: kv[1]):
        render(full, px, os.path.join(andir, name + ".png"))
        # Adaptive layers are drawn at 108/72 of the legacy size, per Android's spec.
        big = int(round(px * 108 / 72))
        render(background, big, os.path.join(andir, name + "-bg.png"))
        render(foreground, big, os.path.join(andir, name + "-fg.png"))
        log("   %-8s %dpx (adaptive %dpx)" % (name, px, big))

    log("square pngs")
    made = {}
    for px in PNGS:
        p = os.path.join(pngdir, "%d.png" % px)
        render(full, px, p)
        made[px] = p
        log("   %dpx" % px)

    log("icon.ico")
    Image.open(made[1024]).save(os.path.join(RES, "icon.ico"),
                                sizes=[(s, s) for s in ICO])

    log("icon.icns")
    write_icns(made, os.path.join(RES, "icon.icns"))

    log("done")


if __name__ == "__main__":
    main()
