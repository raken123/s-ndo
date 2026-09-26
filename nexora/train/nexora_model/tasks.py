"""What each kind of request expects back, and how an answer is checked.

These mirror the app (nexora/src/ai.js and media.js): an answer that passes here is one
the app can use. Games are checked by actually playing them (see selftest.py)."""
import json
import re
import xml.etree.ElementTree as ET

WAVES = {"sine", "square", "triangle", "sawtooth"}


def extract_html(text):
    m = re.search(r"```html\s*([\s\S]*?)```", text, re.I) or re.search(r"```\s*(<!doctype[\s\S]*?)```", text, re.I)
    if m:
        return m.group(1).strip()
    i = re.search(r"<!doctype html|<html", text, re.I)
    return re.sub(r"```\s*$", "", text[i.start():]).strip() if i else None


def extract_svg(text):
    i, j = text.find("<svg"), text.rfind("</svg>")
    return text[i:j + 6] if i >= 0 and j > i else None


def extract_json(text):
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.I)
    s = m.group(1) if m else text[text.find("{"):text.rfind("}") + 1]
    try:
        return json.loads(s)
    except (ValueError, TypeError):
        return None


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def check_svg(text, frames=1):
    """The SVG, if it is well-formed, self-contained and has a viewBox; else None."""
    svg = extract_svg(text or "")
    if not svg or len(svg) > 200_000:
        return None
    try:
        root = ET.fromstring(svg)
    except ET.ParseError:
        return None
    if not root.tag.endswith("svg") or not root.get("viewBox"):
        return None
    if re.search(r"(href|src)\s*=\s*[\"']\s*https?:", svg):
        return None
    if frames > 1:
        vb = [float(v) for v in re.split(r"[\s,]+", root.get("viewBox").strip()) if v]
        if len(vb) != 4 or abs(vb[2] - 256 * frames) > 1:
            return None
    if len(list(root.iter())) < 3:
        return None
    return svg


def check_mesh(text):
    m = extract_json(text or "")
    if not isinstance(m, dict) or not isinstance(m.get("vertices"), list) or not isinstance(m.get("faces"), list):
        return None
    vs, fs = m["vertices"], m["faces"]
    if not 4 <= len(vs) <= 20000 or not 4 <= len(fs) <= 5000:
        return None
    if not all(isinstance(v, list) and len(v) >= 3 and all(_num(c) for c in v[:3]) for v in vs):
        return None
    if not all(isinstance(f, list) and len(f) >= 3 and all(isinstance(i, int) and 0 <= i < len(vs) for i in f) for f in fs):
        return None
    ys = [v[1] for v in vs]
    if max(ys) - min(ys) <= 0.05:
        return None
    return m


def check_music(text):
    s = extract_json(text or "")
    if not isinstance(s, dict) or not _num(s.get("bpm")) or not 40 <= s["bpm"] <= 240 or not isinstance(s.get("tracks"), list):
        return None
    notes = 0
    for t in s["tracks"]:
        if not isinstance(t, dict) or t.get("wave") not in WAVES or not isinstance(t.get("notes"), list):
            return None
        for n in t["notes"]:
            if not isinstance(n, list) or len(n) < 3 or not all(_num(x) for x in n[:3]):
                return None
        notes += len(t["notes"])
    if notes < 8 or not 1 <= len(s["tracks"]) <= 8:
        return None
    for d in s.get("drums", []):
        if not isinstance(d, list) or len(d) < 2 or d[1] not in ("kick", "snare", "hat"):
            return None
    return s


def check_sfx(text):
    s = extract_json(text or "")
    if not isinstance(s, dict) or not isinstance(s.get("layers"), list) or not 1 <= len(s["layers"]) <= 8:
        return None
    for layer in s["layers"]:
        if not isinstance(layer, dict) or layer.get("wave") not in WAVES | {"noise"} or not _num(layer.get("duration")):
            return None
        if not 0.01 <= layer["duration"] <= 3:
            return None
        if layer["wave"] != "noise" and not (isinstance(layer.get("freq"), (list, int, float)) or isinstance(layer.get("steps"), list)):
            return None
    return s


def check_text(text):
    t = (text or "").strip()
    return t if 15 <= len(t) <= 4000 and "```" not in t else None


def check_asset(req, text):
    """Returns the cleaned answer to train on for a non-game request, or None."""
    kind = req["kind"]
    if kind == "svg":
        svg = check_svg(text, req.get("frames", 1))
        return svg
    if kind in ("mesh", "music", "sfx"):
        obj = {"mesh": check_mesh, "music": check_music, "sfx": check_sfx}[kind](text)
        return json.dumps(obj, ensure_ascii=False, separators=(",", ":")) if obj is not None else None
    if kind == "text":
        return check_text(text)
    raise ValueError("not an asset kind: " + kind)


def game_answer(html):
    return "```html\n" + html.strip() + "\n```"


def fix_request(spec, html, errors):
    """The app's exact bug-fix request (PROMPTS.fix in ai.js)."""
    f = spec["fix"]
    user = f["user"].replace("@@ERRORS@@", "\n".join(errors) if errors else
                             "(no runtime errors captured – review the code for logic bugs, broken controls or missing restart)")
    return [{"role": "system", "content": f["system"]}, {"role": "user", "content": user.replace("@@HTML@@", html)}]


def messages(req):
    return [{"role": "system", "content": req["system"]}, {"role": "user", "content": req["user"]}]
