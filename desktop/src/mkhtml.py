"""Build the standalone single-file HTML of gmfy, plus the Electron payload.

The app normally runs under Cordova over https://localhost. Two things have to
change to run from a plain file:// document:

  * every script becomes inline, so the CSP must allow inline script (the
    original 'self' policy would block it);
  * export.js cannot fetch() its runtime sources, so they are embedded on
    window.GMFY_SRC (export.js prefers that when present).
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WWW = os.path.abspath(os.path.join(HERE, "..", "gmfyapp", "www"))
OUT = os.path.join(HERE, "dist")
VERSION = "3.3.0"

# load order matters: engine before the things that use it
SCRIPTS = ["auth.js", "engine.js", "plans.js", "export.js", "worldfx.js",
           "maker.js", "game.js", "blocks.js", "app.js"]
EMBED = ["js/engine.js", "js/game.js", "js/blocks.js"]     # what export.js needs


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def build_html():
    html = read(os.path.join(WWW, "index.html"))

    # 1. inline scripts must be permitted, and file:// has no 'self' origin
    html = re.sub(
        r'<meta http-equiv="Content-Security-Policy"[^>]*>',
        '<meta http-equiv="Content-Security-Policy" content="'
        "default-src 'self' data: blob:; connect-src 'self' data: blob:; "
        "style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; "
        'media-src *; img-src \'self\' data: blob:;">',
        html, count=1)

    # 2. cordova.js does not exist outside Cordova
    html = html.replace('<script src="cordova.js"></script>\n', "")
    html = html.replace('<script src="cordova.js"></script>', "")

    # 3. sources export.js would otherwise fetch.
    #    This must be spliced in BEFORE the scripts are inlined: export.js
    #    contains the literal '</body>' (it generates player HTML), so any
    #    anchor-based insertion done afterwards would land inside its source
    #    instead of in the document. Anchoring on the first script tag also
    #    guarantees GMFY_SRC exists before any app code runs.
    embed = {p: read(os.path.join(WWW, p)) for p in EMBED}
    blob = ("<script>window.GMFY_SRC=" + json.dumps(embed) +
            ";window.GMFY_STANDALONE=true;</script>\n")
    first = '<script src="js/%s"></script>' % SCRIPTS[0]
    if first not in html:
        raise SystemExit("cannot find first script tag to anchor the embed blob")
    html = html.replace(first, blob + first, 1)

    # 4. every external script becomes inline, in the original order
    for name in SCRIPTS:
        tag = '<script src="js/%s"></script>' % name
        if tag not in html:
            raise SystemExit("script tag missing from index.html: " + name)
        src = read(os.path.join(WWW, "js", name))
        # a literal </script> inside a string would end the block early
        src = src.replace("</script>", "<\\/script>")
        html = html.replace(tag, "<script>\n" + src + "\n</script>")

    # Check for surviving *tags* only. export.js contains the literal
    # '<script src=' inside the player HTML it generates, so a bare substring
    # search would false-positive on inlined source.
    left = re.findall(r'<script\s+src="(?!data:)[^"]+"\s*>\s*</script>', html)
    if left:
        raise SystemExit("external scripts survived inlining: %r" % left[:3])
    return html


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    html = build_html()
    single = os.path.join(OUT, "gmfy-%s.html" % VERSION)
    with open(single, "w", encoding="utf-8") as f:
        f.write(html)
    print("HTML  %s  %.1f KB" % (os.path.basename(single), len(html) / 1024))
