"""Slår ihop spelet (www/) till en enda HTML-fil som går att öppna var som helst.

python tools/build_single_html.py UT.html              # ett helt HTML-dokument
python tools/build_single_html.py UT.html --fragment   # utan <html>/<head>/<body> (för inbäddning)
"""
import base64
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "www"))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def main():
    out = sys.argv[1]
    fragment = "--fragment" in sys.argv
    html = read("index.html")
    css = read("style.css")
    if fragment:
        # en enda mörk look, oavsett värdens tema
        css = css.replace(":root {", ":root {\n  color-scheme: dark;", 1)
    icon = base64.b64encode(open(os.path.join(ROOT, "icon.png"), "rb").read()).decode()

    def inline_script(m):
        src = m.group(1)
        code = read(src).replace("</script", "<\\/script")
        return "<script>\n" + code + "\n</script>"

    html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)
    html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + css + "\n</style>")
    html = html.replace('<link rel="icon" href="icon.png">', '<link rel="icon" href="data:image/png;base64,' + icon + '">')
    if fragment:
        head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
        body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
        head = re.sub(r"<meta[^>]*>\s*", "", head)
        html = head.strip() + "\n" + body.strip() + "\n"
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print("skrev", out, round(len(html.encode()) / 1024), "KB")


if __name__ == "__main__":
    main()
