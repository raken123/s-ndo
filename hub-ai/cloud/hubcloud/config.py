"""Agents, creation types and plans. The server is the source of truth: the
apps fetch this from GET /v1/config (and ship a copy, www/js/cloud-config.js,
for offline display; regenerate it with `python -m hubcloud.export_config`).

Every Hub agent runs on a model from the provider set in ENGINES. Which
one is a server-side detail: the apps only ever see the Hub V1 names, never
the provider or model. Model ids can be overridden with environment
variables (HUBAI_MODEL_<AGENT>, comma-separated for several).
"""

import os

# id, display name, provider, default API model id(s), reasoning effort,
# credit cost, and what it makes ("text" agents build hubs; "image" draws and
# edits pictures). Order is the order shown in the apps.
ENGINES = [
    {"id": "spark", "name": "Hub V1 Spark", "provider": "openai", "models": ["gpt-5.6-luna"], "effort": "low", "cost": 1, "makes": "text"},
    {"id": "flux", "name": "Hub V1 Flux", "provider": "openai", "models": ["gpt-5.6-luna"], "effort": "medium", "cost": 1, "makes": "text"},
    {"id": "volt", "name": "Hub V1 Volt", "provider": "openai", "models": ["gpt-5.6-terra"], "effort": "medium", "cost": 2, "makes": "text"},
    {"id": "prism", "name": "Hub V1 Prism", "provider": "openai", "models": ["gpt-5.6-sol"], "effort": "medium", "cost": 3, "makes": "text"},
    {"id": "titan", "name": "Hub V1 Titan", "provider": "openai", "models": ["gpt-5.6-sol"], "effort": "high", "cost": 6, "makes": "text"},
    {"id": "pixel", "name": "Hub V1 Pixel", "provider": "openai", "models": ["gpt-image-2"], "effort": None, "cost": 4, "makes": "image"},
    # Secret: never listed in /v1/config, only shown to accounts whose plan
    # includes it. Two passes: the first model builds, the second reviews
    # and fixes.
    {"id": "v2max", "name": "Hub V2 Max", "provider": "openai", "models": ["gpt-5.6-sol", "gpt-5.6-sol"], "effort": "high",
     "cost": 100, "makes": "text", "secret": True},
]

# What you can create. "output" says how the server builds it: "html" is a
# self-contained page, "svg" a page around one <svg id="art">, "model3d" a
# 3D scene the server turns into a viewer, "image" a picture (Hub V1 Pixel).
KINDS = [
    {"id": "app", "emoji": "🧩", "name": "App", "output": "html", "desc": "Tools, trackers, calculators and forms.",
     "examples": ["Expense tracker with monthly totals", "Booking page for a hair salon", "Loan calculator with a payment table"]},
    {"id": "animation", "emoji": "🎞️", "name": "Animation", "output": "html", "desc": "Looping animations you can export as video.",
     "examples": ["A rocket launching into a starry sky", "Logo reveal for a coffee shop", "Rain falling on a neon city"]},
    {"id": "slides", "emoji": "📽️", "name": "Slides", "output": "html", "desc": "Presentation decks with speaker-ready layouts.",
     "examples": ["Pitch deck for a food delivery startup", "5 slides on how volcanoes work", "Quarterly sales review"]},
    {"id": "card", "emoji": "💌", "name": "HTML Card", "output": "html", "desc": "Invitations, greetings, business cards and posts.",
     "examples": ["Birthday invitation for a pool party", "Business card for a photographer", "Thank-you card for a teacher"]},
    {"id": "model3d", "emoji": "🧊", "name": "3D Model", "output": "model3d", "desc": "3D models you can spin, zoom and export as OBJ.",
     "examples": ["A low-poly house with a garden", "A cartoon rocket", "A wooden chair"]},
    {"id": "ui", "emoji": "🎨", "name": "UI Design", "output": "html", "desc": "High-fidelity screens for apps and websites.",
     "examples": ["Banking app home screen", "Music player, light and dark", "Sign-up flow for a fitness app"]},
    {"id": "image", "emoji": "🖼️", "name": "Image & Photo Edit", "output": "image", "desc": "Create pictures, or upload a photo and describe the edit.",
     "examples": ["Remove the background and make it white", "Make it look like a watercolor", "A cozy cabin in the snow at night"]},
    {"id": "game", "emoji": "🎮", "name": "Game", "output": "html", "desc": "Arcade, puzzle and party games.",
     "examples": ["Snake with power-ups", "Memory game with emojis", "Flappy-style game with a banana"]},
    {"id": "website", "emoji": "🌐", "name": "Website", "output": "html", "desc": "Landing pages, portfolios and event sites.",
     "examples": ["Landing page for a bakery", "Portfolio for a designer", "Wedding website with RSVP"]},
    {"id": "infographic", "emoji": "📈", "name": "Infographic", "output": "html", "desc": "Charts, dashboards and visual explainers.",
     "examples": ["How coffee is made, step by step", "World population by continent", "Monthly budget breakdown"]},
    {"id": "logo", "emoji": "✒️", "name": "Logo & Icon", "output": "svg", "desc": "Vector logos and icons, export as SVG or PNG.",
     "examples": ["Logo for a bike repair shop", "App icon for a meditation app", "Monogram with the letters AK"]},
    {"id": "diagram", "emoji": "🔀", "name": "Diagram", "output": "svg", "desc": "Flowcharts, mind maps, timelines and org charts.",
     "examples": ["Flowchart for an online order", "Mind map about climate change", "Timeline of the space race"]},
    {"id": "doc", "emoji": "📄", "name": "Document", "output": "html", "desc": "Resumes, reports, letters and menus, ready to print.",
     "examples": ["One-page resume for a nurse", "Restaurant menu", "Project status report"]},
]


def kind(kind_id):
    for k in KINDS:
        if k["id"] == kind_id:
            return k
    return None


# The 20 tools, five unlocked by each plan (and kept on higher plans).
# "cloud" ones run through /v1/generate (mode=..., or data=... for Data
# Import); the rest run in the apps.
FEATURES = [
    {"id": "refine", "plan": "free", "emoji": "✏️", "name": "Edit with AI", "desc": "Describe a change in plain words. The agent updates the hub and the old version is kept.", "cloud": True},
    {"id": "deviceflip", "plan": "free", "emoji": "📱", "name": "Device Preview", "desc": "Check the hub at phone, tablet and desktop sizes."},
    {"id": "source", "plan": "free", "emoji": "🧾", "name": "Source Code", "desc": "Read the hub's complete HTML and copy it."},
    {"id": "starters", "plan": "free", "emoji": "📋", "name": "Prompt Templates", "desc": "Detailed starting prompts for forms, calculators, trackers, dashboards and more."},
    {"id": "a11y", "plan": "free", "emoji": "♿", "name": "Accessibility Check", "desc": "Finds missing labels and alt text, low contrast, blocked zoom and other WCAG problems."},
    {"id": "timemachine", "plan": "go", "emoji": "🕘", "name": "Version History", "desc": "Every change is kept. Preview and restore any earlier version."},
    {"id": "editor", "plan": "go", "emoji": "⌨️", "name": "Code Editor", "desc": "Edit the HTML yourself, preview it, and save it as a new version."},
    {"id": "embed", "plan": "go", "emoji": "🧩", "name": "Embed Code", "desc": "Put a hub on any website with a sandboxed iframe snippet."},
    {"id": "seo", "plan": "go", "emoji": "🔎", "name": "SEO & Share Tags", "desc": "Set the page title, description and the preview shown when the link is shared."},
    {"id": "dna", "plan": "go", "emoji": "📊", "name": "Performance Report", "desc": "File size, page structure, external requests and what slows the hub down."},
    {"id": "translate", "plan": "plus", "emoji": "🌍", "name": "Translate", "desc": "Translate all visible text into one of 16 languages. Code and layout stay the same.", "cloud": True},
    {"id": "autofix", "plan": "plus", "emoji": "🩺", "name": "AI Bug Fix", "desc": "The agent reviews the hub for bugs, accessibility and small-screen problems and fixes them.", "cloud": True},
    {"id": "battle", "plan": "plus", "emoji": "⚖️", "name": "Compare Agents", "desc": "Two agents build the same request side by side. Keep the better result."},
    {"id": "dataimport", "plan": "plus", "emoji": "📎", "name": "Data Import", "desc": "Attach a CSV or JSON file and the hub is built around your own data.", "cloud": True},
    {"id": "nowatermark", "plan": "plus", "emoji": "🏷️", "name": "White-label Export", "desc": "Export and share hubs without the \"Made with Hub AI\" footer."},
    {"id": "lock", "plan": "enterprise", "emoji": "🔐", "name": "Password Protection", "desc": "Export an encrypted hub that only opens with the password."},
    {"id": "security", "plan": "enterprise", "emoji": "🛡️", "name": "Security Scan & Lockdown", "desc": "Scan for external requests and risky code, and export with a policy that blocks all network access."},
    {"id": "pwa", "plan": "enterprise", "emoji": "📲", "name": "Installable App", "desc": "Export a progressive web app that installs on phones and works offline."},
    {"id": "brandkit", "plan": "enterprise", "emoji": "🎨", "name": "Brand Kit", "desc": "Your company name and brand colour on every new hub."},
    {"id": "variations", "plan": "enterprise", "emoji": "🗂️", "name": "Multiple Drafts", "desc": "Generate three alternative designs at once and keep the best."},
]


def _features(upto):
    order = ["free", "go", "plus", "enterprise"]
    return [f["id"] for f in FEATURES if order.index(f["plan"]) <= order.index(upto)]


# credits: perDay / perMonth / perYear caps (all that are set apply).
# limits: engine id -> uses per day ("a little" access).
PLANS = {
    "free": {
        "id": "free", "name": "Hub Free", "price": 0, "period": "", "buyable": True,
        "credits": {"perDay": 10, "perYear": 200},
        "engines": ["spark", "flux", "pixel"], "limits": {},
        "saveHubs": False, "exports": [], "publish": False, "features": _features("free"),
        "perks": ["10 credits per day, up to 200 per year", "Hub V1 Spark and Hub V1 Flux", "Every creation type",
                  "Preview only (no saving or exports)", "5 tools", "Browse and share FunHub"],
    },
    "go": {
        "id": "go", "name": "Hub Go", "price": 2, "period": "month", "buyable": True,
        "credits": {"perDay": 100},
        "engines": ["spark", "flux", "volt", "pixel"], "limits": {},
        "saveHubs": True, "exports": ["html"], "publish": True, "features": _features("go"),
        "perks": ["100 credits per day", "Hub V1 Volt, plus Spark and Flux", "Save, HTML export only",
                  "Publish to FunHub", "10 tools"],
    },
    "plus": {
        "id": "plus", "name": "Hub Plus", "price": 12, "period": "month", "buyable": True,
        "credits": {"perMonth": 1000},
        "engines": ["spark", "flux", "volt", "prism", "titan", "pixel"], "limits": {"titan": 5},
        "saveHubs": True, "exports": ["html", "zip"], "publish": True, "features": _features("plus"),
        "perks": ["1000 credits per month", "Hub V1 Prism", "A little Hub V1 Titan, 5 per day",
                  "HTML, ZIP, video, SVG and 3D exports", "15 tools"],
    },
    "enterprise": {
        "id": "enterprise", "name": "Hub Enterprise", "price": 120000, "period": "seat / year", "buyable": True,
        "credits": {"perMonth": 100000},
        "engines": ["spark", "flux", "volt", "prism", "titan", "pixel", "v2max"], "limits": {},
        "saveHubs": True, "exports": ["html", "zip"], "publish": True, "features": _features("enterprise"),
        "perks": ["🤫 A top-secret model", "Every agent, no daily caps", "100,000 credits per month",
                  "All 20 tools", "For very large companies",
                  "Costs about one person's yearly salary per seat"],
    },
}

PLAN_ORDER = ["free", "go", "plus", "enterprise"]


def models_for(engine_id):
    """API model ids for an engine: the env var, else the default."""
    env = os.environ.get("HUBAI_MODEL_" + engine_id.upper())
    if env:
        return [m.strip() for m in env.split(",") if m.strip()]
    return list(engine(engine_id)["models"])


def effort_for(engine_id):
    """Reasoning effort for an engine: HUBAI_EFFORT_<AGENT> ("none" turns it
    off, for models that don't take it), else the default."""
    env = os.environ.get("HUBAI_EFFORT_" + engine_id.upper())
    if env:
        return None if env.lower() == "none" else env
    return engine(engine_id).get("effort")


def engine(engine_id):
    for e in ENGINES:
        if e["id"] == engine_id:
            return e
    return None


def secret_engines(plan_id):
    """The secret engines a plan unlocks, as the apps may show them."""
    return [{"id": e["id"], "name": e["name"], "makes": e["makes"], "cost": e["cost"], "secret": True}
            for e in ENGINES if e.get("secret") and e["id"] in PLANS[plan_id]["engines"]]


def public_config():
    """What GET /v1/config returns: no secrets, no model details."""
    engines = [{"id": e["id"], "name": e["name"], "cost": e["cost"], "makes": e["makes"]}
               for e in ENGINES if not e.get("secret")]
    secret = {e["id"] for e in ENGINES if e.get("secret")}
    plans = [dict(PLANS[p], engines=[x for x in PLANS[p]["engines"] if x not in secret]) for p in PLAN_ORDER]
    return {"engines": engines, "kinds": KINDS, "plans": plans, "features": FEATURES}
