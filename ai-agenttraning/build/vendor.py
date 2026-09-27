"""Vendor Scratch's block editor (scratch-blocks, Apache-2.0) into app/vendor.

Copies the vertical Blockly build, the Scratch block definitions, the English
messages, and only the Swedish Scratch translations (the full file carries
~100 languages). The images the editor uses are turned into one JS map of
data: URIs, so the app keeps working as a single offline HTML file.

    python3 build/vendor.py [path/to/scratch-blocks/package]

Without a path it runs `npm pack` for the version below.
"""
import base64, json, os, re, shutil, subprocess, sys, tarfile, tempfile

VERSION = "1.3.0"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "app", "vendor", "scratch-blocks")
MEDIA = [
    "green-flag.svg", "repeat.svg", "rotate-left.svg", "rotate-right.svg",
    "dropdown-arrow.svg", "dropdown-arrow-dark.svg", "delete-x.svg",
    "comment-arrow-up.svg", "comment-arrow-down.svg", "zoom-in.svg", "zoom-out.svg",
    "zoom-reset.svg", "eyedropper.svg", "status-ready.svg", "status-not-ready.svg",
    "icons/remove.svg", "icons/arrow_button.svg", "icons/control_forever.svg",
    "icons/control_repeat.svg", "icons/control_stop.svg", "icons/control_wait.svg",
    "icons/event_whenflagclicked.svg", "extensions/pen-block-icon.svg",
    "extensions/music-block-icon.svg", "extensions/wedo2-block-icon.svg", "extensions/microbit-block-icon.svg", "handopen.cur", "handclosed.cur", "handdelete.cur", "sprites.png",
]
MIME = {".svg": "image/svg+xml", ".png": "image/png", ".cur": "image/x-icon", ".gif": "image/gif"}


def package_dir(arg):
    if arg:
        return arg
    tmp = tempfile.mkdtemp()
    subprocess.run(["npm", "pack", "scratch-blocks@" + VERSION], cwd=tmp, check=True,
                   stdout=subprocess.DEVNULL)
    tgz = [f for f in os.listdir(tmp) if f.endswith(".tgz")][0]
    with tarfile.open(os.path.join(tmp, tgz)) as t:
        t.extractall(tmp)
    return os.path.join(tmp, "package")


def main():
    pkg = package_dir(sys.argv[1] if len(sys.argv) > 1 else None)
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT)
    for f in ("blockly_compressed_vertical.js", "blocks_compressed.js", "blocks_compressed_vertical.js", "LICENSE"):
        shutil.copy(os.path.join(pkg, f), os.path.join(OUT, f))
    shutil.copy(os.path.join(pkg, "msg", "messages.js"), os.path.join(OUT, "messages.js"))

    src = open(os.path.join(pkg, "msg", "scratch_msgs.js"), encoding="utf-8").read()
    m = re.search(r'Blockly\.ScratchMsgs\.locales\["sv"\] =\s*(\{.*?\n\});', src, re.S)
    sv = json.loads(m.group(1))
    with open(os.path.join(OUT, "scratch_msgs_sv.js"), "w", encoding="utf-8") as f:
        f.write("// Swedish Scratch block translations, extracted from scratch-blocks %s\n" % VERSION)
        f.write("Blockly.ScratchMsgs.locales['sv'] = %s;\n" % json.dumps(sv, ensure_ascii=False, indent=0))

    media = {}
    for name in MEDIA:
        data = open(os.path.join(pkg, "media", name), "rb").read()
        media[name] = "data:%s;base64,%s" % (MIME[os.path.splitext(name)[1]], base64.b64encode(data).decode())
    with open(os.path.join(OUT, "media.js"), "w") as f:
        f.write("// scratch-blocks media as data: URIs (the app runs from a single file)\n")
        f.write("window.SB_MEDIA = %s;\n" % json.dumps(media, indent=0))
    with open(os.path.join(OUT, "VERSION"), "w") as f:
        f.write("scratch-blocks %s (Apache-2.0, https://github.com/scratchfoundation/scratch-blocks)\n" % VERSION)
    for f in sorted(os.listdir(OUT)):
        print("%-36s %8.1f KB" % (f, os.path.getsize(os.path.join(OUT, f)) / 1024))


if __name__ == "__main__":
    main()
