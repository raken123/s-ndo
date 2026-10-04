"""The Hub agents: a base model plus Hub's instructions (and, once
training/finetune.py has run, a fine-tuned version of the base model).
"""

import re

from . import config, providers

RULES = """You are {name}, a Hub AI agent. You build "hubs": small single-page apps delivered as ONE self-contained HTML file.
Rules:
- Reply with the HTML document only, starting with <!doctype html>. No explanations, no Markdown fences.
- Inline all CSS and JavaScript. No external scripts, fonts, images or network requests.
- It must work offline on a phone: responsive layout, touch friendly, viewport meta tag.
- Use a calm dark theme (near-black background, light text, one accent colour) unless the request asks otherwise.
- Wrap any localStorage use in try/catch; hubs may run in a sandbox without storage.
- Give the document a short <title> naming the hub.
- End the page with a small footer: "Made with Hub AI · {name}".
{tier}"""

TIER = {
    "mini": "Keep it simple: one screen, the core feature only, under 150 lines.",
    "lite": "Keep it small: the core feature plus one helpful extra. Use the colour the user asks for.",
    "standard": "Use the user's title and colours. Save the user's data with localStorage.",
    "plus": "Use the user's title, colours and numbers. Save data with localStorage. Add sensible extras (reset, history, keyboard shortcuts).",
    "max": "Make it polished and complete: thoughtful layout, smooth interactions, persistence, accessibility (labels, focus states), and useful extras.",
    "v2max": "Make it polished and complete: thoughtful layout, smooth interactions, persistence, accessibility (labels, focus states), and useful extras.",
    "flash": "",
    "gpro": "",
}

REVIEW = """You are {name}'s reviewer. You receive a hub (one self-contained HTML file) and the request it was built for.
Find and fix bugs, broken interactions, layout problems on small screens, and anything that ignores the request or the rules below.
Then reply with the complete corrected HTML document only, starting with <!doctype html>.
{rules}"""


def system_prompt(engine_id):
    e = config.engine(engine_id)
    return RULES.format(name=e["name"], tier=TIER.get(engine_id, "")).strip()


def clean_html(text):
    t = (text or "").strip()
    fence = re.search(r"```(?:html)?\s*([\s\S]*?)```", t, re.I)
    if fence:
        t = fence.group(1).strip()
    start = re.search(r"<!doctype html|<html", t, re.I)
    if start and start.start() > 0:
        t = t[start.start():]
    if not re.search(r"<html|<body|<!doctype", t, re.I):
        raise providers.ProviderError("The model did not return an HTML document.")
    return t


def title_of(html, fallback):
    m = re.search(r"<title[^>]*>([^<]{1,80})</title>", html, re.I)
    return m.group(1).strip() if m else fallback


def generate(engine_id, prompt):
    """Returns {"html", "title", "models"}. Raises providers.ProviderError."""
    e = config.engine(engine_id)
    models = config.models_for(engine_id)
    system = system_prompt(engine_id)
    if e["provider"] == "gemini":
        html = clean_html(providers.gemini(models[0], system, prompt))
    else:
        html = clean_html(providers.openai_chat(models[0], system, [{"role": "user", "content": prompt}]))
        # Hub V2 Max: the second model reviews and fixes the first one's hub.
        for reviewer in models[1:]:
            review = REVIEW.format(name=e["name"], rules=system)
            html = clean_html(providers.openai_chat(reviewer, review, [
                {"role": "user", "content": "Request:\n" + prompt + "\n\nHub:\n" + html}]))
    return {"html": html, "title": title_of(html, prompt[:40]), "models": models}
