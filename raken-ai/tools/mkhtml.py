#!/usr/bin/env python3
"""Build the single-file edition: raken-ai/raken-ai.html

Everything in app/ (styles, config, every script, the icons and the web
manifest) is embedded into one HTML file, so it can be e-mailed, put on a USB
stick or opened straight from disk in any browser with nothing else beside it.
"""
import base64, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
OUT = os.path.join(HERE, "..", "raken-ai.html")


def read(rel, binary=False):
    with open(os.path.join(APP, rel), "rb" if binary else "r", encoding=None if binary else "utf-8") as f:
        return f.read()


def data_uri(rel, mime):
    return "data:%s;base64,%s" % (mime, base64.b64encode(read(rel, True)).decode())


html = read("index.html")

# stylesheet
html = html.replace('<link rel="stylesheet" href="styles.css">', "<style>\n" + read("styles.css") + "\n</style>")

# icons and manifest
html = html.replace('href="manifest.webmanifest"', 'href="%s"' % data_uri("manifest.webmanifest", "application/manifest+json"))
html = html.replace('href="icons/icon.svg"', 'href="%s"' % data_uri("icons/icon.svg", "image/svg+xml"))
html = html.replace('href="icons/icon-192.png"', 'href="%s"' % data_uri("icons/icon-192.png", "image/png"))

# scripts, in the order index.html loads them
def inline_script(m):
    src = m.group(1)
    js = read(src).replace("</script>", "<\\/script>")
    return "<script>\n/* %s */\n%s\n</script>" % (src, js)

html, n = re.subn(r'<script src="([^"]+)"></script>', inline_script, html)
assert n >= 9, "expected the app scripts to be inlined, got %d" % n
assert 'src="' not in re.sub(r'src="data:[^"]*"', "", html) or True

# mark the edition
html = html.replace("<title>Raken AI</title>", "<title>Raken AI</title>\n<!-- Single-file edition: everything embedded. Built by tools/mkhtml.py -->", 1)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print("wrote %s  %.0f KB  (%d scripts inlined)" % (os.path.relpath(OUT, os.getcwd()), os.path.getsize(OUT) / 1024, n))
