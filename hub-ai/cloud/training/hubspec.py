"""What each Hub agent is fine-tuned on.

The hub types must match the template names in
app/src/main/assets/www/js/templates.js. The templates render the example
answers; dataset.py writes the example requests.
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
# Per agent: how many examples to fine-tune on (spread over all hub types)
# and which template features its answers show, so each tier learns its
# own level of polish. Hub V2 Max fine-tunes its builder (GPT-6 Astra) on
# the Max set; its reviewer (GPT-6 Sol) runs from instructions.
TIERS = {
    "mini": {"examples": 48, "features": []},
    "lite": {"examples": 72, "features": ["accent"]},
    "standard": {"examples": 120, "features": ["accent", "title", "persist"]},
    "plus": {"examples": 168, "features": ["accent", "title", "persist", "theme", "numbers"]},
    "max": {"examples": 240, "features": ["accent", "title", "persist", "theme", "numbers", "extras"]},
    "v2max": {"examples": 240, "features": ["accent", "title", "persist", "theme", "numbers", "extras"]},
}

TIER_ORDER = ["mini", "lite", "standard", "plus", "max", "v2max"]
