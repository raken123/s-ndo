"""Shared definitions for the Hub v1 agents.

The hub types listed here must match the template names in
app/src/main/assets/www/js/templates.js. Tiers unlock hub types in the order
they appear in HUB_TYPES.
"""

# (hub type, short label) in unlock order.
HUB_TYPES = [
    ("todo", "To-do list"),
    ("notes", "Notes"),
    ("counter", "Counter"),
    ("timer", "Timer"),
    ("calculator", "Calculator"),
    ("dice", "Dice roller"),
    ("stopwatch", "Stopwatch"),
    ("quiz", "Quiz"),
    ("flashcards", "Flashcards"),
    ("tipcalc", "Tip calculator"),
    ("converter", "Unit converter"),
    ("pomodoro", "Pomodoro"),
    ("habit", "Habit tracker"),
    ("picker", "Random picker"),
    ("password", "Password generator"),
    ("bmi", "BMI calculator"),
    ("memory", "Memory game"),
    ("clicker", "Clicker game"),
    ("drawing", "Drawing pad"),
    ("expense", "Expense tracker"),
    ("countdown", "Countdown"),
    ("landing", "Landing page"),
    ("snake", "Snake game"),
    ("breathing", "Breathing exercise"),
]

# name -> settings. "types" is how many entries of HUB_TYPES the tier knows,
# "per_class" how many generated examples per hub type it trains on,
# "vocab" the feature budget, "ngram" 1 = words, 2 = words + word pairs.
# "features" switches on generator extras in the app (see agent.js).
TIERS = {
    "mini": {
        "label": "Hub v1 Mini", "types": 6, "per_class": 40, "vocab": 300, "ngram": 1,
        "alpha": 1.0, "features": [],
    },
    "lite": {
        "label": "Hub v1 Lite", "types": 10, "per_class": 80, "vocab": 700, "ngram": 1,
        "alpha": 0.8, "features": ["accent"],
    },
    "standard": {
        "label": "Hub V1 Standard", "types": 16, "per_class": 150, "vocab": 1800, "ngram": 2,
        "alpha": 0.5, "features": ["accent", "title", "persist"],
    },
    "pro": {
        "label": "Hub V1 Pro", "types": 22, "per_class": 250, "vocab": 4000, "ngram": 2,
        "alpha": 0.3, "features": ["accent", "title", "persist", "theme", "numbers"],
    },
    "max": {
        "label": "Hub V1 Max", "types": 24, "per_class": 400, "vocab": 0, "ngram": 2,
        "alpha": 0.2, "features": ["accent", "title", "persist", "theme", "numbers", "extras"],
    },
}

TIER_ORDER = ["mini", "lite", "standard", "pro", "max"]

# Dropped before features are built. Shipped inside every model file so the
# app tokenizes exactly the same way.
STOPWORDS = sorted({
    "a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "with", "me",
    "my", "i", "you", "your", "it", "is", "be", "can", "could", "please", "that",
    "this", "some", "want", "would", "like", "need", "make", "build", "create",
    "generate", "give", "app", "hub", "simple", "little", "small", "quick", "just",
    "so", "do", "we", "us", "our", "should", "will", "let", "lets", "s", "which",
    "where", "at", "by", "from", "as", "into", "up", "very", "really", "nice",
    "cool", "new", "one", "has", "have", "write", "code", "page", "website", "site",
})
