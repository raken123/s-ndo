"""Inline the Nexora sources into one self-contained HTML file.

    python nexora/build/build.py

Writes nexora/index.html (the website) and nexora/dist/nexora-<version>.html
(the file the desktop builds load). Download sizes and checksums shown on the
download page come from nexora/dist/downloads.json, written by desktop.py.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist")
VERSION = "1.1.0"


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def build():
    parts = {
        "CSS": read("app.css"),
        "RUNTIME": read("runtime.js"),
        "GAMES": read("games.js"),
        "LOCALGEN": read("localgen.js"),
        "AI": read("ai.js"),
        "APP": read("app.js"),
    }
    for name, text in parts.items():
        if "</script" in text.lower() or "</style" in text.lower():
            sys.exit("%s contains a closing script/style tag, which would break inlining" % name)

    # File names are fixed by the version. Sizes and checksums (from desktop.py) go
    # only into the website: the copy inside the desktop apps cannot contain its own hash.
    files = [{"id": "exe", "file": "Nexora-Setup-%s-x64.exe" % VERSION},
             {"id": "dmg", "file": "Nexora-%s-arm64.dmg" % VERSION},
             {"id": "deb", "file": "nexora_%s_amd64.deb" % VERSION}]
    measured = {}
    manifest = os.path.join(DIST, "downloads.json")
    if os.path.exists(manifest):
        with open(manifest) as f:
            measured = {m["file"]: m for m in json.load(f)}

    def page(downloads):
        html = read("shell.html")
        html = html.replace("/*@BUILD@*/{}", json.dumps({"version": VERSION, "downloads": downloads}, ensure_ascii=False))
        for name, text in parts.items():
            marker = "/*@%s@*/" % name
            assert marker in html, marker
            html = html.replace(marker, text)
        return html

    os.makedirs(DIST, exist_ok=True)
    outs = {os.path.join(ROOT, "index.html"): page([measured.get(f["file"], f) for f in files]),
            os.path.join(DIST, "nexora-%s.html" % VERSION): page(files)}
    for out, html in outs.items():
        with open(out, "w", encoding="utf-8") as f:
            f.write(html)
        print("wrote %s (%.0f KB)" % (os.path.relpath(out, os.path.dirname(ROOT)), len(html.encode()) / 1024))
    return list(outs)


if __name__ == "__main__":
    build()
