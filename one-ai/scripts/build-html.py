"""Builds dist/OneAI.html: the whole web app in one file (styles, scripts and
icon inlined), to open from disk or host anywhere.

    python3 scripts/build-html.py [--cloud-url https://din-server]
"""
import argparse
import base64
import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
WEB = os.path.join(ROOT, "web")


def read(*p):
    with open(os.path.join(WEB, *p), encoding="utf-8") as f:
        return f.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cloud-url", default=os.environ.get("ONEAI_CLOUD_URL", ""))
    ap.add_argument("--out", default=os.path.join(ROOT, "dist", "OneAI-1.0.0.html"))
    a = ap.parse_args()
    page = read("index.html")
    icon = "data:image/svg+xml;base64," + base64.b64encode(read("icon.svg").encode()).decode()
    page = page.replace('<link rel="manifest" href="manifest.webmanifest">\n', "")
    page = page.replace('href="icon.svg"', 'href="%s"' % icon).replace('src="icon.svg"', 'src="%s"' % icon)
    page = page.replace('<link rel="stylesheet" href="css/app.css">', "<style>\n%s</style>" % read("css", "app.css"))

    def script(m):
        name = m.group(1)
        code = read(*name.split("/"))
        if name == "js/config.js" and a.cloud_url:
            code = "window.ONE_CONFIG = { cloudUrl: %s };\n" % json.dumps(a.cloud_url)
        return "<script>\n%s</script>" % code.replace("</script", "<\\/script")
    page = re.sub(r'<script src="([^"]+)"></script>', script, page)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(page)
    print("wrote %s (%d kB)" % (os.path.relpath(a.out, ROOT), len(page.encode()) // 1024))


main()
