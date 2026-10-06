"""Calls to the provider model API (Gemini), standard library only.

GEMINI_API_KEY comes from the environment. With ONEAI_FAKE_MODELS=1 nothing
goes over the network: every call returns a small stand-in, which is what the
tests and the CI smoke tests run against.

Errors raised here are for the server log only; they name the provider, so
server.py answers the apps with a neutral message instead.
"""

import base64
import json
import os
import re
import struct
import time
import urllib.error
import urllib.request
import zlib

TIMEOUT = int(os.environ.get("ONEAI_MODEL_TIMEOUT", "300"))
VIDEO_TIMEOUT = int(os.environ.get("ONEAI_VIDEO_TIMEOUT", "600"))


class ProviderError(Exception):
    pass


def fake():
    return os.environ.get("ONEAI_FAKE_MODELS") == "1"


def _base():
    return os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")


def _key():
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ProviderError("The server has no GEMINI_API_KEY.")
    return key


def _request(url, body=None, timeout=TIMEOUT, raw=False):
    headers = {"x-goog-api-key": _key()}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method="POST" if body is not None else "GET", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            out = r.read()
            return out if raw else json.loads(out.decode())
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode()).get("error", {}).get("message")
        except ValueError:
            msg = None
        raise ProviderError("%s (HTTP %d)" % (msg or e.reason, e.code))
    except (urllib.error.URLError, TimeoutError) as e:
        raise ProviderError("Could not reach the model API: %s" % getattr(e, "reason", e))


# --- text ------------------------------------------------------------------

def generate(model, system, contents, json_mode=False, tools=None, max_tokens=65536):
    """One generateContent call. `contents` is a Gemini contents list.
    Returns the candidate's parts (text, functionCall, inlineData...)."""
    if fake():
        return _fake_parts(system, contents, json_mode, tools)
    config = {"maxOutputTokens": max_tokens}
    if json_mode:
        config["responseMimeType"] = "application/json"
    body = {"contents": contents, "generationConfig": config}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    if tools:
        body["tools"] = [{"functionDeclarations": tools}]
    data = _request(_base() + "/models/%s:generateContent" % model, body)
    cand = (data.get("candidates") or [{}])[0]
    parts = (cand.get("content") or {}).get("parts") or []
    if not parts:
        why = (data.get("promptFeedback") or {}).get("blockReason") or cand.get("finishReason")
        raise ProviderError("No answer (%s)." % why if why else "No answer.")
    return parts


def text_of(parts):
    return "".join(p.get("text", "") for p in parts if not p.get("thought"))


def ask(model, system, prompt, json_mode=False, attachments=None):
    """A single-turn request; returns text (or a JSON string)."""
    parts = [{"text": prompt}] + (attachments or [])
    return text_of(generate(model, system, [{"role": "user", "parts": parts}], json_mode=json_mode))


# --- images ----------------------------------------------------------------

def image(model, prompt, source=None):
    """A picture from an image model, drawn from `prompt` or editing `source`
    ((mime, base64)). Returns (mime, base64)."""
    if fake():
        return source if source else ("image/png", fake_png(prompt))
    parts = [{"text": prompt}]
    if source:
        parts.append({"inlineData": {"mimeType": source[0], "data": source[1]}})
    out = _request(_base() + "/models/%s:generateContent" % model, {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}})
    for p in ((out.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []:
        d = p.get("inlineData") or p.get("inline_data")
        if d and d.get("data"):
            return d.get("mimeType") or d.get("mime_type") or "image/png", d["data"]
    raise ProviderError("No image in the answer.")


# --- video -----------------------------------------------------------------

def video(model, prompt, aspect="16:9", source=None):
    """An MP4 from a Veo model. Starts a long-running operation, polls it and
    downloads the result. Returns bytes."""
    if fake():
        return FAKE_MP4
    instance = {"prompt": prompt}
    if source:
        instance["image"] = {"bytesBase64Encoded": source[1], "mimeType": source[0]}
    op = _request(_base() + "/models/%s:predictLongRunning" % model,
                  {"instances": [instance], "parameters": {"aspectRatio": aspect}})
    name = op.get("name")
    if not name:
        raise ProviderError("No video operation.")
    deadline = time.time() + VIDEO_TIMEOUT
    while not op.get("done"):
        if time.time() > deadline:
            raise ProviderError("Video took too long.")
        time.sleep(8)
        op = _request(_base() + "/" + name)
    if op.get("error"):
        raise ProviderError("Video failed: %s" % op["error"].get("message"))
    resp = op.get("response") or {}
    samples = (resp.get("generateVideoResponse") or {}).get("generatedSamples") or resp.get("generatedVideos") or []
    vid = (samples[0].get("video") if samples else None) or {}
    if vid.get("bytesBase64Encoded"):
        return base64.b64decode(vid["bytesBase64Encoded"])
    if not vid.get("uri"):
        raise ProviderError("No video in the answer.")
    return _request(vid["uri"], raw=True, timeout=VIDEO_TIMEOUT)


# --- music -----------------------------------------------------------------

def music(model, prompt):
    """A song from a Lyria model through the Interactions API.
    Returns (mime, bytes, lyrics_text)."""
    if fake():
        raise ProviderError("Fake mode has no music model.")  # agents fall back to the synthesizer
    out = _request(_base() + "/interactions", {"model": model, "input": prompt})
    audio, texts = [], []

    def walk(x):
        if isinstance(x, dict):
            kind = x.get("type")
            inline = x.get("inlineData") or x.get("inline_data")
            if kind == "audio" and x.get("data"):
                audio.append((x.get("mime_type") or x.get("mimeType") or "audio/mpeg", x["data"]))
            elif inline and str(inline.get("mimeType", inline.get("mime_type", ""))).startswith("audio/"):
                audio.append((inline.get("mimeType") or inline.get("mime_type"), inline["data"]))
            elif kind == "text" and isinstance(x.get("text"), str):
                texts.append(x["text"])
            for v in x.values():
                if isinstance(v, (dict, list)):
                    walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    walk(out)
    if not audio:
        raise ProviderError("No audio in the answer.")
    mime, data = audio[0]
    return mime, base64.b64decode(data), "\n".join(texts)


# --- stand-ins for ONEAI_FAKE_MODELS=1 --------------------------------------

def fake_png(prompt, size=96):
    """A gradient whose colours come from the prompt."""
    h = zlib.crc32(prompt.encode())
    c1, c2 = [(h >> s) & 255 for s in (0, 8, 16)], [(h >> s) & 255 for s in (4, 12, 20)]
    rows = b"".join(b"\0" + bytes(int(c1[i] + (c2[i] - c1[i]) * y / (size - 1)) for x in range(size) for i in range(3))
                    for y in range(size))

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + \
        chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")
    return base64.b64encode(png).decode()


# Not a playable video: only the start of an MP4 header, enough for tests.
FAKE_MP4 = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"\x00" * 64

FAKE_MARK = "[fake]"


def _last_user_text(contents):
    for c in reversed(contents):
        if c.get("role") == "user":
            t = " ".join(p.get("text", "") for p in c.get("parts", []) if "text" in p)
            if t:
                return t
    return ""


def _fake_parts(system, contents, json_mode, tools):
    """Deterministic answers. Agents that need structured output (JSON, file
    blocks) recognise fake mode and use their own sample data; this only has
    to cover chat, tool calls and file blocks."""
    prompt = _last_user_text(contents).split("Task:\n")[-1]
    # A tool call when asked for one, once; then an answer with its result.
    if tools and "#tool" in prompt:
        last = contents[-1]
        responses = [p["functionResponse"] for p in last.get("parts", []) if "functionResponse" in p]
        if not responses:
            return [{"functionCall": {"name": tools[0]["name"], "args": {"text": "hej"}}}]
        return [{"text": "%s Verktyget svarade: %s" % (FAKE_MARK, json.dumps(responses[0].get("response"), ensure_ascii=False))}]
    if json_mode:
        return [{"text": "{}"}]
    m = re.search(r"\b([\w-]+\.(?:py|js|html|css|md|txt|csv|json|pdf|docx|xlsx|pptx|svg|xml|yaml|sh))\b", prompt)
    agent = re.search(r"You are (Filegent|Appagent|Sitegent|Formegent|Designgent)", system or "")
    if system and "<<<FILE" in system and (m or agent):
        name = m.group(1) if m else "fil.txt"
        if agent and agent.group(1) == "Designgent":
            name = "design.svg"
        elif agent and agent.group(1) in ("Appagent", "Sitegent", "Formegent"):
            name = "index.html"
        body = "# %s\n\nDetta är en exempelfil.\n\n- punkt ett\n- punkt två\n" % name
        if name.endswith(".csv") or name.endswith(".xlsx"):
            body = "namn,antal\näpplen,3\npäron,5\n"
        if name.endswith(".html"):
            body = "<!doctype html><html lang=\"sv\"><head><meta charset=\"utf-8\"><title>%s</title></head><body><h1>%s</h1></body></html>" % (prompt[:40], prompt[:80])
        if name.endswith(".svg"):
            body = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#10a37f"/></svg>'
        return [{"text": "%s Här är filen.\n<<<FILE name=\"%s\">>>\n%s\n<<<END>>>" % (FAKE_MARK, name, body)}]
    return [{"text": "%s Svar på: %s" % (FAKE_MARK, prompt[:200])}]
