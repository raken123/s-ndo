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

# The 20 extras, five unlocked by each plan (and kept on higher plans).
# "cloud" ones run through /v1/generate (mode=...), the rest in the apps.
FEATURES = [
    {"id": "surprise", "plan": "free", "emoji": "🎲", "name": "Surprise Me", "desc": "One tap fills in a wild hub idea you'd never think of."},
    {"id": "confetti", "plan": "free", "emoji": "🎉", "name": "Confetti Blast", "desc": "Every tap inside your hub explodes into confetti."},
    {"id": "catwalk", "plan": "free", "emoji": "🐱", "name": "Cat Walk", "desc": "A tiny cat strolls across your hub. Forever."},
    {"id": "upsidedown", "plan": "free", "emoji": "🙃", "name": "Upside-Down Mode", "desc": "Flip the whole hub on its head. Prank your friends."},
    {"id": "deviceflip", "plan": "free", "emoji": "📱", "name": "Device Flip", "desc": "See your hub as a phone, a tablet and a big screen."},
    {"id": "rainbow", "plan": "go", "emoji": "🌈", "name": "Rainbow Mode", "desc": "Your hub cycles through every colour of the rainbow."},
    {"id": "sounds", "plan": "go", "emoji": "🔊", "name": "Click Sounds", "desc": "Bloops and bleeps on every button."},
    {"id": "dna", "plan": "go", "emoji": "🧬", "name": "Hub DNA", "desc": "X-ray any hub: its colours, size, buttons and code."},
    {"id": "challenge", "plan": "go", "emoji": "🔥", "name": "Daily Hub Challenge", "desc": "A new challenge every day. Keep your streak alive."},
    {"id": "embed", "plan": "go", "emoji": "🧩", "name": "Embed Code", "desc": "Drop any hub into a website with one snippet."},
    {"id": "crazier", "plan": "plus", "emoji": "🤪", "name": "Make It CRAZIER", "desc": "Send a hub back to the agent to make it way wilder.", "cloud": True},
    {"id": "battle", "plan": "plus", "emoji": "⚔️", "name": "Hub Battle", "desc": "Two agents build the same hub. You pick the winner."},
    {"id": "timemachine", "plan": "plus", "emoji": "🕰️", "name": "Time Machine", "desc": "Every version of a hub, saved. Jump back any time."},
    {"id": "translate", "plan": "plus", "emoji": "🌍", "name": "Translate Hub", "desc": "Your hub, in another language, in seconds.", "cloud": True},
    {"id": "nowatermark", "plan": "plus", "emoji": "🧼", "name": "No Watermark", "desc": "Export hubs without the Hub AI footer."},
    {"id": "mashup", "plan": "enterprise", "emoji": "🧪", "name": "Hub Mashup", "desc": "Fuse two hubs into one brand-new creature.", "cloud": True},
    {"id": "lock", "plan": "enterprise", "emoji": "🔐", "name": "Password Lock", "desc": "Export a hub only people with the password can open."},
    {"id": "pwa", "plan": "enterprise", "emoji": "📲", "name": "Install as App", "desc": "Export a hub that installs on phones and works offline."},
    {"id": "brandkit", "plan": "enterprise", "emoji": "🎨", "name": "Brand Kit", "desc": "Your company's name and colour on every hub."},
    {"id": "variations", "plan": "enterprise", "emoji": "🎰", "name": "Variation Blaster", "desc": "Three versions of a hub at once. Keep the best."},
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
                  "Preview hubs (no saving or exports)", "5 CRAZY features", "Browse and share FunHub"],
    },
    "go": {
        "id": "go", "name": "Hub Go", "price": 2, "period": "month", "buyable": True,
        "credits": {"perDay": 100},
        "engines": ["mini", "lite", "standard", "flash"], "limits": {},
        "saveHubs": True, "exports": ["html"], "publish": True, "features": _features("go"),
        "perks": ["100 credits per day", "Hub V1 Standard, plus Mini and Lite", "Gemini 3.8 Flash",
                  "Save hubs, HTML export only", "Publish to FunHub", "10 CRAZY features"],
    },
    "plus": {
        "id": "plus", "name": "Hub Plus", "price": 12, "period": "month", "buyable": True,
        "credits": {"perMonth": 1000},
        "engines": ["mini", "lite", "standard", "plus", "max", "flash", "gpro"], "limits": {"max": 5, "gpro": 3},
        "saveHubs": True, "exports": ["html", "zip"], "publish": True, "features": _features("plus"),
        "perks": ["1000 credits per month", "Hub V1 Plus", "A little Hub V1 Max, 5 per day",
                  "A little Gemini 3.8 Pro, 3 per day", "HTML and ZIP export", "15 UNBELIEVABLE features"],
    },
    "enterprise": {
        "id": "enterprise", "name": "Hub Enterprise", "price": 120000, "period": "seat / year", "buyable": True,
        "credits": {"perMonth": 100000},
        "engines": ["mini", "lite", "standard", "plus", "max", "v2max", "flash", "gpro"], "limits": {},
        "saveHubs": True, "exports": ["html", "zip"], "publish": True, "features": _features("enterprise"),
        "perks": ["🤫 A top-secret model", "Every agent, no daily caps", "100,000 credits per month",
                  "All 20 features", "For very large companies",
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
