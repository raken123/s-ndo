"""Calls to the model API (OpenAI), using only the standard library.

OPENAI_API_KEY comes from the environment (or hub-ai/cloud/.env). With
HUBAI_FAKE_MODELS=1 no network is used: every call returns a small stand-in
result that names the model, which is what the tests run against.

Error messages here are for the server log. The apps never see them (they
would name the provider); server.py answers with a neutral message.
"""

import base64
import json
import os
import re
import struct
import urllib.error
import urllib.request
import uuid
import zlib

TIMEOUT = int(os.environ.get("HUBAI_MODEL_TIMEOUT", "300"))


class ProviderError(Exception):
    pass


# OPENAI_BASE_URL points at a proxy or a test stand-in.
def _url(path):
    return os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/") + path


def _key():
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ProviderError("The server has no OPENAI_API_KEY.")
    return key


def _send(path, data, content_type):
    req = urllib.request.Request(_url(path), data=data, method="POST",
                                 headers={"Authorization": "Bearer " + _key(), "Content-Type": content_type})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode()).get("error", {}).get("message")
        except ValueError:
            msg = None
        raise ProviderError("%s (HTTP %d)" % (msg or e.reason, e.code))
    except (urllib.error.URLError, TimeoutError) as e:
        raise ProviderError("Could not reach the model API: %s" % getattr(e, "reason", e))


def _post(path, body):
    return _send(path, json.dumps(body).encode(), "application/json")


def _multipart(path, fields, files):
    """files: [(field, filename, mime, bytes)]"""
    bound = "hub-" + uuid.uuid4().hex
    out = []
    for k, v in fields.items():
        out.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (bound, k, v)).encode())
    for field, name, mime, data in files:
        out.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\nContent-Type: %s\r\n\r\n"
                    % (bound, field, name, mime)).encode() + data + b"\r\n")
    out.append(("--%s--\r\n" % bound).encode())
    return _send(path, b"".join(out), "multipart/form-data; boundary=" + bound)


def fake():
    return os.environ.get("HUBAI_FAKE_MODELS") == "1"


def chat(model, system, prompt, json_mode=False, effort=None):
    """Text (or, with json_mode, a JSON document) from a chat model.
    effort: reasoning effort ("low" | "medium" | "high"), or None."""
    if fake():
        return _fake_json(model, prompt) if json_mode else _fake_html(model, prompt, system)
    body = {"model": model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}]}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    if effort:
        body["reasoning_effort"] = effort
    data = _post("/chat/completions", body)
    try:
        choice = data["choices"][0]
        text = choice["message"].get("content") or ""
    except (KeyError, IndexError, TypeError):
        raise ProviderError("No answer.")
    if not text:
        raise ProviderError("Empty answer (%s)." % choice.get("finish_reason"))
    return text


def image(model, prompt, picture=None):
    """A picture from an image model: drawn from the prompt, or `picture`
    ((mime, base64)) edited as the prompt says. Returns (mime, base64)."""
    if fake():
        return picture if picture else ("image/png", _fake_png(prompt))
    if picture:
        ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}.get(picture[0], "png")
        data = _multipart("/images/edits", {"model": model, "prompt": prompt},
                          [("image", "photo." + ext, picture[0], base64.b64decode(picture[1]))])
    else:
        data = _post("/images/generations", {"model": model, "prompt": prompt, "size": "1024x1024"})
    try:
        b64 = data["data"][0]["b64_json"]
    except (KeyError, IndexError, TypeError):
        raise ProviderError("No image in the answer.")
    fmt = (data.get("output_format") or "png").lower()
    return {"jpeg": "image/jpeg", "jpg": "image/jpeg", "webp": "image/webp"}.get(fmt, "image/png"), b64


def _fake_png(prompt):
    """A 96x96 gradient whose colour comes from the prompt."""
    h = zlib.crc32(prompt.encode())
    c1, c2 = [(h >> s) & 255 for s in (0, 8, 16)], [(h >> s) & 255 for s in (4, 12, 20)]
    rows = b"".join(b"\0" + bytes(int(c1[i] + (c2[i] - c1[i]) * y / 95) for x in range(96) for i in range(3)) for y in range(96))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))  # noqa: E731
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 96, 96, 8, 2, 0, 0, 0)) + \
        chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")
    return base64.b64encode(png).decode()


def _fake_json(model, prompt):
    """A small cartoon rocket, as a 3D scene."""
    return json.dumps({"title": "Rocket", "background": "#101418", "parts": [
        {"shape": "cylinder", "scale": [1, 2.2, 1], "position": [0, 1.6, 0], "rotation": [0, 0, 0], "color": "#eeeeee"},
        {"shape": "cone", "scale": [1, 1, 1], "position": [0, 3.2, 0], "rotation": [0, 0, 0], "color": "#e5484d"},
        {"shape": "sphere", "scale": [0.45, 0.45, 0.2], "position": [0, 2.1, 0.45], "rotation": [0, 0, 0], "color": "#7cc4ff"},
        {"shape": "box", "scale": [0.12, 0.8, 0.7], "position": [0.55, 0.6, 0], "rotation": [0, 0, -15], "color": "#e5484d"},
        {"shape": "box", "scale": [0.12, 0.8, 0.7], "position": [-0.55, 0.6, 0], "rotation": [0, 0, 15], "color": "#e5484d"},
        {"shape": "cone", "scale": [0.6, 0.7, 0.6], "position": [0, 0.15, 0], "rotation": [180, 0, 0], "color": "#ff9b2f"},
        {"shape": "torus", "scale": [1.05, 1.05, 1.05], "position": [0, 1.1, 0], "rotation": [0, 0, 0], "color": "#ffd23a"},
    ], "model": model, "prompt": prompt[:80]})


def _fake_html(model, prompt, system=""):
    import html
    # A request about an existing hub keeps that hub's title; a new one is
    # titled after the first line of the request.
    old = re.search(r"<title[^>]*>([^<]*)</title>", prompt) if prompt.startswith("Here is a hub") else None
    title = html.unescape(old.group(1)) if old else prompt.strip().split("\n")[0]
    p = html.escape(title[:200])
    if '<canvas id="stage">' in system:
        return ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>%s</title><style>html,body{margin:0;height:100%%;"
                "background:#000}canvas{display:block;width:100%%;height:100%%}</style></head><body><canvas id=\"stage\"></canvas>"
                "<script>var c=document.getElementById('stage'),x=c.getContext('2d');function f(t){c.width=innerWidth;c.height=innerHeight;"
                "x.fillStyle='#101418';x.fillRect(0,0,c.width,c.height);x.fillStyle='#ffd23a';x.beginPath();"
                "x.arc(c.width/2+Math.sin(t/500)*c.width/4,c.height/2,40,0,7);x.fill();requestAnimationFrame(f)}requestAnimationFrame(f)</script>"
                "<p data-model=\"%s\" hidden></p></body></html>" % (p[:40], model))
    if '<svg id="art"' in system:
        return ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>%s</title></head><body style=\"background:#111\">"
                "<svg id=\"art\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\"><circle cx=\"100\" cy=\"100\" r=\"80\" "
                "fill=\"#ffd23a\"/><text x=\"100\" y=\"112\" font-size=\"36\" text-anchor=\"middle\">%s</text></svg>"
                "<p data-model=\"%s\">Made by %s</p></body></html>" % (p[:40], p[:6], model, model))
    return ("```html\n<!doctype html><html><head><meta charset=\"utf-8\"><title>%s</title></head>"
            "<body style=\"background:#0f0f0f;color:#eee;font-family:sans-serif\"><h1>%s</h1>"
            "<p data-model=\"%s\">Made by %s</p></body></html>\n```" % (p[:40], p, model, model))
