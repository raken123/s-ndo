#!/usr/bin/env python3
"""mkweb.py — folds web/ into one self-contained aijudge.html.

Every script, the stylesheet and the icon are inlined, so the result runs from
a USB stick, from inside an APK's assets, or from a .app bundle with nothing
fetched at runtime.
"""
import base64
import hashlib
import os
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
DIST = ROOT / "dist"
VERSION = (ROOT / "VERSION").read_text().strip()


KEY_PLACEHOLDER = "const DEFAULT_API_KEY = '';"


def bench_key() -> str:
    """The Gemini key this release is built with, if the builder configured one.

    Checked in order: AIJUDGE_API_KEY, then build/apikey.txt. Both are outside
    version control, so a plain checkout builds a game with no key that falls
    back to its own local bench.
    """
    env = os.environ.get("AIJUDGE_API_KEY", "").strip()
    if env:
        return env
    f = pathlib.Path(__file__).resolve().parent / "apikey.txt"
    if f.exists():
        return f.read_text().strip()
    return ""


def data_uri(path: pathlib.Path) -> str:
    mime = {
        ".svg": "image/svg+xml",
        ".png": "image/png",
    }[path.suffix]
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def build() -> pathlib.Path:
    html = (WEB / "index.html").read_text(encoding="utf-8")

    # stylesheet
    css = (WEB / "style.css").read_text(encoding="utf-8")
    html = html.replace(
        '<link rel="stylesheet" href="style.css">',
        "<style>\n" + css + "\n</style>",
    )

    # icon, both in <link rel=icon> and in the two <img> tags
    icon = data_uri(WEB / "assets" / "icon.svg")
    html = html.replace('href="assets/icon.svg"', f'href="{icon}"')
    html = html.replace('src="assets/icon.svg"', f'src="{icon}"')

    # scripts, in the order the page lists them
    def inline(match):
        src = match.group(1)
        js = (WEB / src).read_text(encoding="utf-8")
        # </script> inside a string literal would close the tag early
        js = js.replace("</script>", "<\\/script>")
        return f"<script>\n{js}\n</script>"

    html, n = re.subn(r'<script src="([^"]+)"></script>', inline, html)
    if n < 10:
        sys.exit(f"! only inlined {n} scripts — index.html changed shape?")

    html = html.replace(
        "<title>AI Judge</title>",
        f"<title>AI Judge</title>\n<meta name=\"version\" content=\"{VERSION}\">",
    )

    # the bench key, if this build has one
    key = bench_key()
    if key:
        if html.count(KEY_PLACEHOLDER) != 1:
            sys.exit("! could not find DEFAULT_API_KEY to substitute — judge.js changed?")
        html = html.replace(KEY_PLACEHOLDER, f"const DEFAULT_API_KEY = '{key}';")

    DIST.mkdir(parents=True, exist_ok=True)
    out = DIST / "aijudge.html"
    out.write_text(html, encoding="utf-8")

    size = out.stat().st_size
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    note = ("baked in — do not commit this build"
            if key else "none — the local bench will judge")
    print(f"  aijudge.html      {size/1024:7.1f} KB  {n} scripts inlined")
    print(f"  bench key         {note}")
    print(f"  sha256            {digest}")
    return out


if __name__ == "__main__":
    print(f"AI Judge {VERSION} — single-file build")
    build()
