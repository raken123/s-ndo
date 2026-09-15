"""Build the standalone single-file InfoDoc, plus the Electron payload.

Everything in app/ collapses into one HTML document: the stylesheet and the five
scripts become inline, in their original order. That file is what the desktop
builds load from disk, and it also opens directly in a browser off a USB stick.

One thing changes between the two: a browser opened from file:// has no Web
Serial in some builds, so the network transport is the fallback there. The app
detects that at runtime; nothing is patched here.
"""
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, "..", "app"))
DIST = os.path.join(HERE, "dist")
VERSION = "1.0.0"

SCRIPTS = ["store.js", "link.js", "tests.js", "ui.js", "app.js"]

CSP = ("default-src 'self' data: blob:; "
       "connect-src 'self' ws: wss: data: blob:; "
       "script-src 'self' 'unsafe-inline'; "
       "style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data: blob:; "
       "object-src 'none'; "
       "base-uri 'none'; "
       "form-action 'none'")


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def build_html():
    html = read(os.path.join(APP, "index.html"))

    # a CSP that fits a document with no origin, and inline everything
    html = html.replace(
        '<link rel="stylesheet" href="css/app.css">',
        '<meta http-equiv="Content-Security-Policy" content="%s">\n'
        '<style>\n%s\n</style>' % (CSP, read(os.path.join(APP, "css", "app.css"))))

    for name in SCRIPTS:
        tag = '<script src="js/%s"></script>' % name
        if tag not in html:
            raise SystemExit("index.html does not load js/%s" % name)
        html = html.replace(tag, "<script>\n%s\n</script>" % read(os.path.join(APP, "js", name)))

    left = re.findall(r'<(?:script src|link rel="stylesheet")[^>]*>', html)
    if left:
        raise SystemExit("external references survived the inline pass: %r" % left)

    html = html.replace("<title>InfoDoc</title>",
                        "<title>InfoDoc %s</title>\n"
                        "<script>window.INFODOC_VERSION=%r;</script>" % (VERSION, VERSION))
    return html


if __name__ == "__main__":
    os.makedirs(DIST, exist_ok=True)
    html = build_html()
    out = os.path.join(DIST, "infodoc-%s.html" % VERSION)
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print("HTML  %s  %.0f KB" % (os.path.basename(out), os.path.getsize(out) / 1024))
    if "--copy" in sys.argv:
        dest = os.path.abspath(os.path.join(HERE, "..", "infodoc-%s.html" % VERSION))
        shutil.copy(out, dest)
        print("      copied to %s" % dest)
