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
    # Two models: Astra builds the hub, Sol reviews and fixes it.
    {"id": "v2max", "name": "Hub V2 Max", "provider": "openai", "base": ["GPT-6 Astra", "GPT-6 Sol"],
     "models": ["gpt-6-astra", "gpt-6-sol"], "cost": 100},
    {"id": "flash", "name": "Gemini 3.8 Flash", "provider": "gemini", "base": ["Gemini 3.8 Flash"], "models": ["gemini-3.8-flash"], "cost": 3},
    {"id": "gpro", "name": "Gemini 3.8 Pro", "provider": "gemini", "base": ["Gemini 3.8 Pro"], "models": ["gemini-3.8-pro"], "cost": 10},
]

# credits: perDay / perMonth / perYear caps (all that are set apply).
# limits: engine id -> uses per day ("a little" access).
PLANS = {
    "free": {
        "id": "free", "name": "Hub Free", "price": 0, "period": "", "buyable": True,
        "credits": {"perDay": 10, "perYear": 200},
        "engines": ["mini"], "limits": {},
        "saveHubs": False, "exports": [], "publish": False,
        "perks": ["10 credits per day, up to 200 per year", "Hub V1 Mini (GPT-4o)",
                  "Preview hubs (no saving or exports)", "Browse and share FunHub"],
    },
    "go": {
        "id": "go", "name": "Hub Go", "price": 2, "period": "month", "buyable": True,
        "credits": {"perDay": 100},
        "engines": ["mini", "lite", "standard", "flash"], "limits": {},
        "saveHubs": True, "exports": ["html"], "publish": True,
        "perks": ["100 credits per day", "Hub V1 Standard (GPT-5), plus Mini and Lite",
                  "Gemini 3.8 Flash", "Save hubs, HTML export only", "Publish to FunHub"],
    },
    "plus": {
        "id": "plus", "name": "Hub Plus", "price": 12, "period": "month", "buyable": True,
        "credits": {"perMonth": 1000},
        "engines": ["mini", "lite", "standard", "plus", "max", "flash", "gpro"], "limits": {"max": 5, "gpro": 3},
        "saveHubs": True, "exports": ["html", "zip"], "publish": True,
        "perks": ["1000 credits per month", "Hub V1 Plus (GPT-5.6 Sol)", "A little Hub V1 Max (GPT-6 Astra), 5 per day",
                  "A little Gemini 3.8 Pro, 3 per day", "Everything in Go", "HTML and ZIP export"],
    },
    # Not sold in the apps. An operator moves a company's accounts onto it
    # with the admin endpoint or `python -m hubcloud.admin`.
    "enterprise": {
        "id": "enterprise", "name": "Hub Enterprise", "price": 120000, "period": "seat / year", "buyable": False,
        "credits": {"perMonth": 100000},
        "engines": ["mini", "lite", "standard", "plus", "max", "v2max", "flash", "gpro"], "limits": {},
        "saveHubs": True, "exports": ["html", "zip"], "publish": True,
        "perks": ["Hub V2 Max: GPT-6 Astra builds, GPT-6 Sol reviews", "Every agent, no daily caps",
                  "100,000 credits per month", "For very large companies only",
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


def public_config():
    """What GET /v1/config returns (no secrets)."""
    engines = []
    for e in ENGINES:
        d = {k: e[k] for k in ("id", "name", "provider", "base", "cost")}
        d["kind"] = "gemini" if e["provider"] == "gemini" else "agent"
        d["training"] = training_status(e["id"])["state"]
        engines.append(d)
    return {"engines": engines, "plans": [PLANS[p] for p in PLAN_ORDER]}
