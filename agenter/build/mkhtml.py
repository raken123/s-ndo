"""Fold www/ into one self-contained HTML file.

Styles and scripts are inlined, the favicon becomes a data URI, and the Cordova
shim (which only exists inside the APK) is dropped. The result runs from file://
with nothing fetched at runtime — it is also the payload the Electron builds load.
"""
import base64, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
WWW = os.path.join(ROOT, "www")
DIST = os.path.join(ROOT, "dist")

VERSION = "1.0.0"
OUT = os.path.join(DIST, "agenter-%s.html" % VERSION)


def read(*parts):
    with open(os.path.join(WWW, *parts), encoding="utf-8") as fh:
        return fh.read()


def main():
    html = read("index.html")

    # <link rel="stylesheet" href="css/app.css">  ->  <style>
    def css_sub(m):
        return "<style>\n" + read(*m.group(1).split("/")) + "</style>"
    html, n_css = re.subn(r'<link rel="stylesheet" href="([^"]+)">', css_sub, html)

    # favicon -> data URI, so the tab icon survives file://
    with open(os.path.join(ROOT, "res", "icon", "png", "128.png"), "rb") as fh:
        b64 = base64.b64encode(fh.read()).decode("ascii")
    html = re.sub(r'<link rel="icon" href="[^"]+">',
                  '<link rel="icon" href="data:image/png;base64,%s">' % b64, html)

    # cordova.js only exists inside the APK.
    html = re.sub(r'\s*<script src="cordova\.js"></script>', "", html)

    scripts = re.findall(r'<script src="([^"]+)"></script>', html)
    bundle = []
    for src in scripts:
        code = read(*src.split("/"))
        bundle.append("/* ---- %s ---- */\n%s" % (src, code))
    # The closing tag inside a JS string would end the block early.
    joined = "\n".join(bundle).replace("</script>", "<\\/script>")
    html = re.sub(r'<script src="[^"]+"></script>\s*', "", html)
    html = html.replace("</body>", "<script>\n" + joined + "\n</script>\n</body>")

    os.makedirs(DIST, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)

    assert n_css == 1, "stylesheet was not inlined"
    assert "<script src=" not in html, "a script tag survived inlining"
    print("%s  %d scripts, %.0f KB" % (os.path.relpath(OUT, ROOT), len(scripts),
                                       os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
