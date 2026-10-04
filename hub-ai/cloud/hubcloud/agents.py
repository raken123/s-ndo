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
- Make it accessible: set <html lang>, give every form field a label and every icon button an aria-label, keep text contrast at least 4.5:1, and never block zoom.
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


# What the agent is asked for each mode. "create" is a plain request.
MODES = {
    "refine": ("Here is a hub:\n\n{html}\n\nChange it as follows: {prompt}\n\nKeep everything else (purpose, data, "
               "design and behaviour) the same, and reply with the complete updated HTML document."),
    "fix": ("Here is a hub:\n\n{html}\n\nReview it as a careful senior engineer and fix every problem you find: "
            "JavaScript errors and broken interactions, lost or corrupted saved data, layout problems on small screens, "
            "and accessibility (labels for every input, text alternatives, colour contrast of at least 4.5:1, visible "
            "focus states, keyboard use, zoom not blocked). Keep its purpose, content and design. {prompt}"),
    "translate": ("Here is a hub:\n\n{html}\n\nTranslate every piece of visible text (including the title, buttons, "
                  "placeholders and messages) into {lang}. Set the lang attribute to match. Keep the code, layout and "
                  "behaviour exactly the same."),
}

DATA = ("\n\nThe user attached a data file, {name}. Build the hub around this data: embed it in the page (as a "
        "JavaScript constant) so the hub works offline, parse it robustly, and use the real column names and values."
        "\n\n--- {name} ---\n{data}\n--- end of {name} ---")


def build_request(mode, prompt, html="", lang="", data="", data_name=""):
    request = prompt if mode == "create" else MODES[mode].format(prompt=prompt, html=html, lang=lang).strip()
    if data:
        request += DATA.format(name=data_name or "data.csv", data=data)
    return request


def generate(engine_id, prompt, mode="create", html="", lang="", data="", data_name=""):
    """Returns {"html", "title", "models"}. Raises providers.ProviderError."""
    e = config.engine(engine_id)
    models = config.models_for(engine_id)
    system = system_prompt(engine_id)
    request = build_request(mode, prompt, html, lang, data, data_name)
    if e["provider"] == "gemini":
        html = clean_html(providers.gemini(models[0], system, request))
    else:
        html = clean_html(providers.openai_chat(models[0], system, [{"role": "user", "content": request}]))
        # Hub V2 Max: the second model reviews and fixes the first one's hub.
        for reviewer in models[1:]:
            review = REVIEW.format(name=e["name"], rules=system)
            html = clean_html(providers.openai_chat(reviewer, review, [
                {"role": "user", "content": "Request:\n" + request + "\n\nHub:\n" + html}]))
    return {"html": html, "title": title_of(html, (prompt or mode)[:40]), "models": models}
