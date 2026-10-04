"""The Hub agents: a model plus Hub's instructions for each creation type.

Which model runs an agent is a server-side detail (config.ENGINES); the
instructions tell every agent to present itself only as its Hub V1 name.
"""

import base64
import html as htmlmod
import json
import re

from . import config, providers, viewer3d

RULES = """You are {name}, a Hub AI agent. You make "hubs": things delivered as ONE self-contained HTML file.
Rules:
- Reply with the HTML document only, starting with <!doctype html>. No explanations, no Markdown fences.
- Inline all CSS and JavaScript. No external scripts, fonts, images or network requests.
- It must work offline on a phone: responsive layout, touch friendly, viewport meta tag.
- Use a calm dark theme (near-black background, light text, one accent colour) unless the request or the type asks otherwise.
- Wrap any localStorage use in try/catch; hubs may run in a sandbox without storage.
- Make it accessible: set <html lang>, give every form field a label and every icon button an aria-label, keep text contrast at least 4.5:1, and never block zoom.
- Give the document a short <title> naming it.
- End the page with a small footer: "Made with Hub AI · {name}".
- You are {name}, made by Hub AI. Never name or hint at any other company, model or AI product, in the hub or anywhere else.
{kind}
{tier}"""

KIND_RULES = {
    "app": "Type: an app. Build a working tool with real logic, sensible validation and saved data.",
    "game": "Type: a game. Make it playable with touch and keyboard: a start screen, score, game over and restart, and a saved high score.",
    "website": "Type: a website. A complete one-page site: navigation, hero, content sections and footer, with realistic copy.",
    "animation": ("Type: an animation. Draw everything on ONE <canvas id=\"stage\"> that fills the window (scaled by devicePixelRatio), "
                  "animated with requestAnimationFrame. Make it smooth and cinematic, and loop seamlessly every 4 to 10 seconds. "
                  "The app records this canvas to video, so draw the whole picture, including any text, on the canvas; the only HTML "
                  "outside it is the footer and a small pause button."),
    "slides": ("Type: a slide deck. 6 to 10 slides unless asked otherwise, each a <section class=\"slide\"> in a 16:9 frame scaled to fit "
               "the screen. Navigate with arrow keys, swipe and on-screen previous/next buttons; show a slide counter. Real content: "
               "titles, short bullet points, simple charts or diagrams in SVG/CSS. Put speaker notes in <aside class=\"notes\"> (hidden "
               "on screen). Add a \"Print / PDF\" button; print styles put one slide per landscape page."),
    "card": ("Type: an HTML card (invitation, greeting, business card or social post). One beautifully designed card, centred, at the "
             "proportions its use needs (invitation 5:7, business card 3.5:2, social post 1:1 or 4:5). Tasteful typography and "
             "decoration in CSS/SVG, subtle entrance animation. Add a \"Print\" button whose print styles print only the card."),
    "ui": ("Type: a UI design. High-fidelity mockups of the screens asked for, laid out side by side in device frames (phones 390x844, "
           "desktop 1440 wide, scaled to fit). Realistic content, consistent spacing and type scale, clear hierarchy. Below them, a small "
           "design-system panel: colour swatches with hex codes, type sizes, buttons and inputs in their states. Static, but with "
           "hover and focus states."),
    "infographic": ("Type: an infographic. Explain the topic visually with SVG charts and illustrations: labelled axes, legends, big "
                    "headline numbers and short captions. Use plausible example numbers and say they are examples unless the user gave data."),
    "doc": ("Type: a printable document. Show it as A4 page(s) on screen, with print styles (@page) so it prints exactly like that, and a "
            "\"Print / PDF\" button. Real, well-structured content."),
    "logo": ("Type: a logo or icon. The page's main content is ONE inline <svg id=\"art\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=...> "
             "holding the whole artwork, shown large; below it show the same mark small, on dark and on light. The #art SVG must stand "
             "alone when exported: no scripts, no external fonts or images (system font stacks only), text as <text>. Simple, bold, "
             "memorable shapes."),
    "diagram": ("Type: a diagram (flowchart, mind map, timeline or org chart). The page's main content is ONE inline <svg id=\"art\" "
                "xmlns=\"http://www.w3.org/2000/svg\" viewBox=...> holding the whole diagram: clear layout, arrows with markers, "
                "readable labels. The #art SVG must stand alone when exported: no scripts, no external fonts or images."),
}

TIER = {
    "spark": "Keep it simple and fast: the core of the request, done well.",
    "flux": "Do the core of the request well, plus one helpful extra.",
    "volt": "Make it polished: use the user's names, colours and numbers, and add sensible extras.",
    "prism": "Make it polished and complete: thoughtful layout, smooth interactions, persistence and useful extras.",
    "titan": "Make it exceptional: thoughtful layout and details, smooth interactions, persistence, accessibility and useful extras.",
    "v2max": "Make it exceptional: thoughtful layout and details, smooth interactions, persistence, accessibility and useful extras.",
}

REVIEW = """You are {name}'s reviewer. You receive a hub (one self-contained HTML file) and the request it was built for.
Find and fix bugs, broken interactions, layout problems on small screens, and anything that ignores the request or the rules below.
Then reply with the complete corrected HTML document only, starting with <!doctype html>.
{rules}"""

SCENE = """You are {name}, a Hub AI agent that designs 3D models. Never name any other company, model or AI product.
Reply with ONE JSON object only:
{{"title": short name, "background": "#rrggbb", "parts": [{{"shape": one of "box", "sphere", "cylinder", "cone", "pyramid", "torus",
"scale": [x, y, z], "position": [x, y, z], "rotation": [x, y, z] in degrees, "color": "#rrggbb"}}, ...]}}
Every shape is 1 unit across before scaling, centred on its position; cylinders, cones and pyramids stand along Y; a torus lies flat
(ring around Y). Y is up and the model rests on y = 0. Build the object from 8 to 120 parts so it is clearly recognisable, with
pleasing, harmonious colours. {tier}"""


def system_prompt(engine_id, kind="app"):
    e = config.engine(engine_id)
    return RULES.format(name=e["name"], kind=KIND_RULES.get(kind, KIND_RULES["app"]), tier=TIER.get(engine_id, "")).strip()


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


def footer(engine_id):
    return "Made with Hub AI · " + config.engine(engine_id)["name"]


def _scene(engine_id, prompt, html, mode, data, data_name):
    e = config.engine(engine_id)
    request = prompt
    if mode == "refine":
        old = viewer3d.scene_of(html)
        if not old:
            raise ValueError("That is not a Hub AI 3D model.")
        request = "Here is a 3D scene:\n\n" + json.dumps(old) + "\n\nChange it as follows: " + prompt + \
            "\n\nKeep everything else the same and reply with the complete updated JSON."
    if data:
        request += DATA.format(name=data_name or "data.csv", data=data)
    text = providers.gemini(config.models_for(engine_id)[0], SCENE.format(name=e["name"], tier=TIER.get(engine_id, "")),
                            request, json_mode=True)
    m = re.search(r"\{[\s\S]*\}", text or "")
    try:
        scene = viewer3d.clean(json.loads(m.group(0) if m else text))
    except ValueError as err:
        raise providers.ProviderError("Unusable 3D scene: %s" % err)
    return {"html": viewer3d.page(scene, footer(engine_id)), "title": scene["title"]}


def image_page(title, mime, b64, engine_id):
    t = htmlmod.escape(title)
    return ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,"
            "initial-scale=1\"><title>" + t + "</title><style>html,body{margin:0;min-height:100%;background:#0d0d0d;color:#9a9a9a;"
            "font:12px system-ui,sans-serif}main{min-height:calc(100vh - 28px);display:grid;place-items:center;padding:8px;box-sizing:"
            "border-box}img{max-width:100%;max-height:calc(100vh - 44px);border-radius:8px}footer{text-align:center;padding:6px}"
            "</style></head><body><main><img id=\"art\" alt=\"" + t + "\" src=\"data:" + mime + ";base64," + b64 + "\"></main>"
            "<footer>" + htmlmod.escape(footer(engine_id)) + "</footer></body></html>")


def _image(engine_id, prompt, image):
    model = config.models_for(engine_id)[0]
    if image:
        ask = ("Edit this image as follows: " + prompt + ". Keep everything not mentioned unchanged and keep the "
               "same framing and quality.")
    else:
        ask = "Create an image: " + prompt
    mime, b64 = providers.gemini_image(model, ask, image)
    title = (prompt.strip().split("\n")[0] or "Image")[:40]
    return {"html": image_page(title, mime, b64, engine_id), "title": title, "image": "data:%s;base64,%s" % (mime, b64)}


def generate(engine_id, prompt, mode="create", html="", lang="", data="", data_name="", kind="app", image=None):
    """Returns {"html", "title", ...}. Raises providers.ProviderError.
    image: (mime, base64) of a picture to edit (kind "image")."""
    e = config.engine(engine_id)
    out_type = config.kind(kind)["output"]
    if out_type == "image":
        return _image(engine_id, prompt, image)
    if out_type == "model3d":
        return _scene(engine_id, prompt, html, mode, data, data_name)
    models = config.models_for(engine_id)
    system = system_prompt(engine_id, kind)
    request = build_request(mode, prompt, html, lang, data, data_name)
    page = clean_html(providers.gemini(models[0], system, request))
    # Hub V2 Max: the second pass reviews and fixes the first one's hub.
    for reviewer in models[1:]:
        review = REVIEW.format(name=e["name"], rules=system)
        page = clean_html(providers.gemini(reviewer, review, "Request:\n" + request + "\n\nHub:\n" + page))
    return {"html": page, "title": title_of(page, (prompt or mode)[:40])}


def decode_image(data_url):
    """(mime, base64) from a data: URL of a PNG, JPEG or WebP, or None."""
    m = re.fullmatch(r"data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)", data_url or "")
    if not m:
        return None
    b64 = re.sub(r"\s", "", m.group(2))
    try:
        base64.b64decode(b64, validate=True)
    except ValueError:
        return None
    return m.group(1), b64
