"""Models, agents and plans: the whole One AI catalog in one place.

The One models are One AI's own names. Which provider model runs behind each
one is set here (or with ONEAI_MODEL_<ID> in the environment) and never
reaches the apps: /v1/config only carries One names, prices and units.
"""

import os

# --- models ---------------------------------------------------------------
#
# `run` is the provider model id. `review` adds a second pass that checks and
# fixes what the first pass made (code, apps, sites, documents). `plan` adds a
# first pass that plans the work before it is done. `cost` is in units per
# message; agents add their own cost on top.

MODELS = [
    {"id": "one-1-mini", "name": "One 1 Mini", "family": 1, "cost": 1,
     "about": "Snabbast. Bra för korta frågor och enkla filer.", "run": "gemini-3.1-flash-lite"},
    {"id": "one-1-standard", "name": "One 1 Standard", "family": 1, "cost": 1,
     "about": "Bra på det mesta, varje dag.", "run": "gemini-3.5-flash"},
    {"id": "one-1-plus", "name": "One 1 Plus", "family": 1, "cost": 2,
     "about": "Smartare svar och bättre kod.", "run": "gemini-3.6-flash"},
    {"id": "one-1-max", "name": "One 1 Max", "family": 1, "cost": 4,
     "about": "För svåra uppgifter, långa dokument och stora appar.", "run": "gemini-3.1-pro-preview"},
    {"id": "one-1-max-fast", "name": "One 1 Max Fast", "family": 1, "cost": 3,
     "about": "Nästan lika bra som Max, mycket snabbare.", "run": "gemini-3.8-flash"},
    {"id": "one-1-ultra", "name": "One 1 Ultra", "family": 1, "cost": 10, "enterprise": True, "review": True,
     "about": "Mest avancerad. Granskar och rättar sitt eget arbete. Endast Enterprise.", "run": "gemini-3.1-pro-preview"},
    {"id": "one-2-mini", "name": "One 2 Mini", "family": 2, "cost": 1, "enterprise": True,
     "about": "Nästa generation, snabbast.", "run": "gemini-3.5-flash-lite"},
    {"id": "one-2-standard", "name": "One 2 Standard", "family": 2, "cost": 2, "enterprise": True,
     "about": "Nästa generation för allt vardagligt.", "run": "gemini-3.7-flash"},
    {"id": "one-2-plus", "name": "One 2 Plus", "family": 2, "cost": 3, "enterprise": True,
     "about": "Nästa generation, starkare kod och resonemang.", "run": "gemini-3.8-flash"},
    {"id": "one-2-max", "name": "One 2 Max", "family": 2, "cost": 6, "enterprise": True, "review": True,
     "about": "Nästa generation för de svåraste uppgifterna.", "run": "gemini-3.1-pro-preview"},
    {"id": "one-2-max-fast", "name": "One 2 Max Fast", "family": 2, "cost": 5, "enterprise": True, "review": True,
     "about": "Nästa generations Max, snabbare.", "run": "gemini-3.8-flash"},
    {"id": "one-2-ultra", "name": "One 2 Ultra", "family": 2, "cost": 15, "enterprise": True, "plan": True, "review": True,
     "about": "Det bästa One kan: planerar, bygger och granskar.", "run": "gemini-3.1-pro-preview"},
]

# --- agents ---------------------------------------------------------------
#
# Every agent works with the model the user picked; the media agents also use
# a dedicated provider model (`media`). `weak` is the reduced variant some
# plans get (One Go's Imagent).

AGENTS = [
    {"id": "filegent", "name": "Filegent", "icon": "📄", "cost": 0,
     "about": "Vanliga filer: text, kod, PDF, Word, Excel, CSV, JSON, Markdown och alla andra textformat."},
    {"id": "imagent", "name": "Imagent", "icon": "🖼️", "cost": 4,
     "about": "Bilder och fotoredigering.", "media": "gemini-3-pro-image", "weak": "gemini-3.1-flash-lite-image"},
    {"id": "vidagent", "name": "Vidagent", "icon": "🎬", "cost": 25,
     "about": "Videor (MP4).", "media": "veo-3.1-generate-preview"},
    {"id": "appagent", "name": "Appagent", "icon": "🧩", "cost": 3,
     "about": "Appar och spel som fungerar direkt, plus installerbar webbapp (ZIP)."},
    {"id": "presegent", "name": "Presegent", "icon": "📽️", "cost": 3,
     "about": "Presentationer: PowerPoint (PPTX) och bildspel i webbläsaren."},
    {"id": "formegent", "name": "Formegent", "icon": "📝", "cost": 2,
     "about": "Formulär och enkäter som sparar svar och exporterar CSV."},
    {"id": "sitegent", "name": "Sitegent", "icon": "🌐", "cost": 4,
     "about": "Hela webbplatser med flera sidor, som ZIP."},
    {"id": "inboxagent", "name": "Inboxagent", "icon": "✉️", "cost": 1,
     "about": "Mejl: utkast, svar och nyhetsbrev som .eml-filer."},
    {"id": "musigent", "name": "Musigent", "icon": "🎵", "cost": 6,
     "about": "Musik: låtar och ljudklipp (MP3/WAV), noter som MIDI.", "media": "lyria-3.5"},
    {"id": "modelgent", "name": "Modelgent", "icon": "🧊", "cost": 3,
     "about": "3D-modeller (GLB) som går att öppna i Blender, Windows 3D och webben."},
    {"id": "designgent", "name": "Designgent", "icon": "🎨", "cost": 2,
     "about": "Design: logotyper, ikoner, affischer och UI-skisser (SVG)."},
]

ALL_AGENTS = [a["id"] for a in AGENTS]
ONE_1 = [m["id"] for m in MODELS if m["family"] == 1]
ONE_2 = [m["id"] for m in MODELS if m["family"] == 2]

# --- plans ----------------------------------------------------------------
#
# Usage is counted in units per day (`units`, None = unlimited). `limits` caps
# single agents per day. Prices are SEK per month.

PLUS_UNITS = 1500
PLUS_LIMITS = {"vidagent": 5, "imagent": 60, "musigent": 20}
# One Pro: "half of 100,000 %" of One Plus, i.e. 50,000 % = 500 times Plus.
PRO_FACTOR = 500

PLANS = {
    "lite": {
        "name": "One Lite", "price": 0, "order": 0,
        "tagline": "Gratis. Chatta och skapa vanliga filer.",
        "models": ["one-1-mini", "one-1-standard", "one-1-plus"],
        "agents": ["filegent"], "weak": [],
        "units": 50, "limits": {}, "mcp": 1,
        "points": ["One 1 Mini, Standard och Plus", "Filegent: vanliga filer", "50 enheter per dag",
                   "1 MCP-koppling", "Ingen Imagent eller Vidagent"],
    },
    "go": {
        "name": "One Go", "price": 60, "order": 1,
        "tagline": "Som Lite, plus lite bildskapande.",
        "models": ["one-1-mini", "one-1-standard", "one-1-plus"],
        "agents": ["filegent", "imagent"], "weak": ["imagent"],
        "units": 50, "limits": {"imagent": 3}, "mcp": 2,
        "points": ["Allt i One Lite", "Imagent (enkel), 3 bilder per dag", "2 MCP-kopplingar"],
    },
    "plus": {
        "name": "One Plus", "price": 129, "order": 2,
        "tagline": "Mycket av allt: video, appar, bilder, sajter och mer.",
        "models": [m for m in ONE_1 if m != "one-1-ultra"],
        "agents": ALL_AGENTS, "weak": [],
        "units": PLUS_UNITS, "limits": PLUS_LIMITS, "mcp": 5,
        "points": ["One 1 Mini, Standard, Plus, Max och Max Fast",
                   "Vidagent, Appagent, Imagent, Presegent, Formegent, Sitegent, Inboxagent",
                   "Musigent, Modelgent (3D) och Designgent",
                   "{:,} enheter per dag".format(PLUS_UNITS).replace(",", " "), "5 MCP-kopplingar"],
    },
    "pro": {
        "name": "One Pro", "price": 1299, "order": 3,
        "tagline": "Allt i Plus, med 50 000 % av användningen.",
        "models": [m for m in ONE_1 if m != "one-1-ultra"],
        "agents": ALL_AGENTS, "weak": [],
        "units": PLUS_UNITS * PRO_FACTOR, "limits": {k: v * PRO_FACTOR for k, v in PLUS_LIMITS.items()}, "mcp": 25,
        "points": ["Allt i One Plus", "Hälften av 100 000 % användning: 500 gånger Plus",
                   "{:,} enheter per dag".format(PLUS_UNITS * PRO_FACTOR).replace(",", " "), "25 MCP-kopplingar"],
    },
    "enterprise_lite": {
        "name": "One Enterprise Lite", "price": 4999, "order": 4,
        "tagline": "Allt i Pro, med One 1 Ultra och One 2 Standard.",
        "models": ONE_1 + ["one-2-standard"],
        "agents": ALL_AGENTS, "weak": [],
        "units": PLUS_UNITS * PRO_FACTOR, "limits": {k: v * PRO_FACTOR for k, v in PLUS_LIMITS.items()}, "mcp": 100,
        "points": ["Allt i One Pro", "One 1 Ultra", "One 2 Standard", "100 MCP-kopplingar"],
    },
    "enterprise": {
        "name": "One Enterprise", "price": 13499, "order": 5,
        "tagline": "Obegränsad användning, One 1 Ultra och hela One 2-familjen.",
        "models": ONE_1 + ONE_2,
        "agents": ALL_AGENTS, "weak": [],
        "units": None, "limits": {}, "mcp": None,
        "points": ["Obegränsad användning", "One 1 Ultra", "Hela One 2-familjen: Mini, Standard, Plus, Max, Max Fast, Ultra",
                   "Alla agenter", "Obegränsat antal MCP-kopplingar"],
    },
}

DEFAULT_PLAN = "lite"
DEFAULT_MODEL = "one-1-standard"


def _env_id(x):
    return x.upper().replace("-", "_")


def model(model_id):
    return next((m for m in MODELS if m["id"] == model_id), None)


def agent(agent_id):
    return next((a for a in AGENTS if a["id"] == agent_id), None)


def provider_model(model_id):
    """The provider model behind a One model (ONEAI_MODEL_ONE_1_MAX=...)."""
    return os.environ.get("ONEAI_MODEL_" + _env_id(model_id)) or model(model_id)["run"]


def media_model(agent_id, weak=False):
    a = agent(agent_id)
    key = "ONEAI_MEDIA_" + _env_id(agent_id) + ("_WEAK" if weak else "")
    return os.environ.get(key) or (a.get("weak") if weak else a.get("media"))


def cheapest_plan(kind, item_id):
    """The first plan (by price) that includes a model or agent."""
    for pid, p in sorted(PLANS.items(), key=lambda kv: kv[1]["order"]):
        if item_id in p[kind]:
            return pid
    return None


def public_config():
    """What the apps may know: names, prices, units. No provider details."""
    return {
        "models": [{k: m[k] for k in ("id", "name", "family", "cost", "about")} | {"enterprise": bool(m.get("enterprise"))}
                   for m in MODELS],
        "agents": [{k: a[k] for k in ("id", "name", "icon", "cost", "about")} for a in AGENTS],
        "plans": [dict(id=pid, **{k: p[k] for k in ("name", "price", "tagline", "models", "agents", "weak", "units",
                                                     "limits", "mcp", "points")})
                  for pid, p in sorted(PLANS.items(), key=lambda kv: kv[1]["order"])],
        "currency": "kr", "defaultModel": DEFAULT_MODEL,
    }
