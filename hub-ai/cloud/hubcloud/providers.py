"""Calls to the model APIs, using only the standard library.

OPENAI_API_KEY and GEMINI_API_KEY come from the environment. With
HUBAI_FAKE_MODELS=1 no network is used: every call returns a small hub that
names the model, which is what the tests run against.
"""

import json
import os
import re
import urllib.error
import urllib.request

TIMEOUT = int(os.environ.get("HUBAI_MODEL_TIMEOUT", "300"))


class ProviderError(Exception):
    pass


# OPENAI_BASE_URL / GEMINI_BASE_URL point at a proxy or a test stand-in.
def _openai_url():
    return os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/") + "/chat/completions"


def _gemini_url(model):
    base = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
    return base.rstrip("/") + "/models/%s:generateContent" % model


def _post(url, headers, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers=dict(headers, **{"Content-Type": "application/json"}))
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


def fake():
    return os.environ.get("HUBAI_FAKE_MODELS") == "1"


def openai_chat(model, system, messages):
    """messages: [{"role": "user"|"assistant", "content": str}]"""
    if fake():
        return _fake_html(model, messages[-1]["content"])
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ProviderError("The server has no OPENAI_API_KEY.")
    data = _post(_openai_url(), {"Authorization": "Bearer " + key}, {
        "model": model,
        "messages": [{"role": "system", "content": system}] + messages,
    })
    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError):
        raise ProviderError("The model returned no answer.")


def gemini(model, system, prompt):
    if fake():
        return _fake_html(model, prompt)
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ProviderError("The server has no GEMINI_API_KEY.")
    data = _post(_gemini_url(model), {"x-goog-api-key": key}, {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 32768},
    })
    parts = (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts")) or []
    if not parts:
        why = (data.get("promptFeedback") or {}).get("blockReason")
        raise ProviderError("Gemini blocked this request (%s)." % why if why else "Gemini returned no answer.")
    return "".join(p.get("text", "") for p in parts)


def _fake_html(model, prompt):
    import html
    # A request about an existing hub keeps that hub's title; a new one is
    # titled after the first line of the request.
    old = re.search(r"<title[^>]*>([^<]*)</title>", prompt) if prompt.startswith("Here is a hub") else None
    title = html.unescape(old.group(1)) if old else prompt.strip().split("\n")[0]
    p = html.escape(title[:200])
    return ("```html\n<!doctype html><html><head><meta charset=\"utf-8\"><title>%s</title></head>"
            "<body style=\"background:#0f0f0f;color:#eee;font-family:sans-serif\"><h1>%s</h1>"
            "<p data-model=\"%s\">Made by %s</p></body></html>\n```" % (p[:40], p, model, model))
