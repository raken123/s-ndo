"""Agents, engines and plans. The server is the source of truth: the apps
fetch this from GET /v1/config (and ship a copy, www/js/cloud-config.js,
for offline display; regenerate it with `python -m hubcloud.export_config`).

Every Hub agent starts from a base model. Model ids can be overridden with
environment variables (HUBAI_MODEL_<AGENT>), and agents.json (written by
training/finetune.py) swaps in the fine-tuned model for an agent.
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
AGENTS_FILE = os.environ.get("HUBAI_AGENTS_FILE", os.path.join(HERE, "..", "agents.json"))

# id, display name, provider, base model label(s), default API model id(s),
# credit cost. Order is the order shown in the apps.
ENGINES = [
    {"id": "mini", "name": "Hub V1 Mini", "provider": "openai", "base": ["GPT-4o"], "models": ["gpt-4o"], "cost": 1},
    {"id": "lite", "name": "Hub V1 Lite", "provider": "openai", "base": ["GPT-4.5"], "models": ["gpt-4.5-preview"], "cost": 1},
    {"id": "standard", "name": "Hub V1 Standard", "provider": "openai", "base": ["GPT-5"], "models": ["gpt-5"], "cost": 2},
    {"id": "plus", "name": "Hub V1 Plus", "provider": "openai", "base": ["GPT-5.6 Sol"], "models": ["gpt-5.6-sol"], "cost": 3},
    {"id": "max", "name": "Hub V1 Max", "provider": "openai", "base": ["GPT-6 Astra"], "models": ["gpt-6-astra"], "cost": 5},
    # Secret: never listed in /v1/config, only shown to accounts whose plan
    # includes it. Two models: Astra builds the hub, Sol reviews and fixes it.
    {"id": "v2max", "name": "Hub V2 Max", "provider": "openai", "base": ["GPT-6 Astra", "GPT-6 Sol"],
     "models": ["gpt-6-astra", "gpt-6-sol"], "cost": 100, "secret": True},
    {"id": "flash", "name": "Gemini 3.8 Flash", "provider": "gemini", "base": ["Gemini 3.8 Flash"], "models": ["gemini-3.8-flash"], "cost": 3},
    {"id": "gpro", "name": "Gemini 3.8 Pro", "provider": "gemini", "base": ["Gemini 3.8 Pro"], "models": ["gemini-3.8-pro"], "cost": 10},
]

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
        "engines": ["mini"], "limits": {},
        "saveHubs": False, "exports": [], "publish": False, "features": _features("free"),
        "perks": ["10 credits per day, up to 200 per year", "Hub V1 Mini",
                  "Preview hubs (no saving or exports)", "5 tools", "Browse and share FunHub"],
    },
    "go": {
        "id": "go", "name": "Hub Go", "price": 2, "period": "month", "buyable": True,
        "credits": {"perDay": 100},
        "engines": ["mini", "lite", "standard", "flash"], "limits": {},
        "saveHubs": True, "exports": ["html"], "publish": True, "features": _features("go"),
        "perks": ["100 credits per day", "Hub V1 Standard, plus Mini and Lite", "Gemini 3.8 Flash",
                  "Save hubs, HTML export only", "Publish to FunHub", "10 tools"],
    },
    "plus": {
        "id": "plus", "name": "Hub Plus", "price": 12, "period": "month", "buyable": True,
        "credits": {"perMonth": 1000},
        "engines": ["mini", "lite", "standard", "plus", "max", "flash", "gpro"], "limits": {"max": 5, "gpro": 3},
        "saveHubs": True, "exports": ["html", "zip"], "publish": True, "features": _features("plus"),
        "perks": ["1000 credits per month", "Hub V1 Plus", "A little Hub V1 Max, 5 per day",
                  "A little Gemini 3.8 Pro, 3 per day", "HTML and ZIP export", "15 tools"],
    },
    "enterprise": {
        "id": "enterprise", "name": "Hub Enterprise", "price": 120000, "period": "seat / year", "buyable": True,
        "credits": {"perMonth": 100000},
        "engines": ["mini", "lite", "standard", "plus", "max", "v2max", "flash", "gpro"], "limits": {},
        "saveHubs": True, "exports": ["html", "zip"], "publish": True, "features": _features("enterprise"),
        "perks": ["🤫 A top-secret model", "Every agent, no daily caps", "100,000 credits per month",
                  "All 20 tools", "For very large companies",
                  "Costs about one person's yearly salary per seat"],
    },
}

PLAN_ORDER = ["free", "go", "plus", "enterprise"]


def _overrides():
    try:
        with open(AGENTS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def models_for(engine_id):
    """API model ids for an engine: env var, then fine-tuned, then default."""
    e = engine(engine_id)
    env = os.environ.get("HUBAI_MODEL_" + engine_id.upper())
    if env:
        return [m.strip() for m in env.split(",") if m.strip()]
    tuned = _overrides().get(engine_id, {}).get("models")
    return list(tuned) if tuned else list(e["models"])


def training_status(engine_id):
    o = _overrides().get(engine_id)
    if o and o.get("models"):
        return {"state": "fine-tuned", "models": o["models"], "at": o.get("at")}
    return {"state": "prompted", "models": models_for(engine_id)}


def engine(engine_id):
    for e in ENGINES:
        if e["id"] == engine_id:
            return e
    return None


def secret_engines(plan_id):
    """The secret engines a plan unlocks, as the apps may show them."""
    return [{"id": e["id"], "name": e["name"], "kind": "agent", "cost": e["cost"], "secret": True}
            for e in ENGINES if e.get("secret") and e["id"] in PLANS[plan_id]["engines"]]


def public_config():
    """What GET /v1/config returns: no secrets, no model details."""
    engines = [{"id": e["id"], "name": e["name"], "cost": e["cost"],
                "kind": "gemini" if e["provider"] == "gemini" else "agent"}
               for e in ENGINES if not e.get("secret")]
    secret = {e["id"] for e in ENGINES if e.get("secret")}
    plans = [dict(PLANS[p], engines=[x for x in PLANS[p]["engines"] if x not in secret]) for p in PLAN_ORDER]
    return {"engines": engines, "plans": plans, "features": FEATURES}
