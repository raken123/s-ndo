"""Builds the Hub v1 training set.

Every hub type has a handful of hand-written phrases. They are combined with
request wrappers and modifiers into a deterministic, shuffled pool of
examples. Extra hand-labelled examples can be added to data/extra.jsonl as
{"text": "...", "label": "todo"} lines; they are always used for training.
"""

import json
import os
import random

PHRASES = {
    "todo": ["to do list", "todo list", "task list", "checklist", "task manager",
             "list of things to do", "shopping list", "grocery list", "chores list",
             "daily tasks tracker", "packing list", "homework planner"],
    "notes": ["notes", "note taking", "notepad", "journal", "diary", "memo pad",
              "scratch pad for ideas", "quick notes", "sticky notes", "writing pad",
              "idea notebook", "markdown notes"],
    "counter": ["counter", "tally counter", "click counter", "people counter",
                "score keeper", "tally", "plus minus counter", "rep counter",
                "lap counter", "headcount clicker", "point counter", "number counter"],
    "timer": ["timer", "kitchen timer", "egg timer", "countdown timer",
              "minute timer", "cooking timer", "alarm timer", "workout timer",
              "interval timer", "nap timer", "tea timer", "5 minute timer"],
    "calculator": ["calculator", "basic calculator", "math calculator",
                   "arithmetic calculator", "pocket calculator", "add subtract multiply divide",
                   "number cruncher", "simple calc", "calc", "four function calculator",
                   "maths helper", "sum calculator"],
    "dice": ["dice roller", "roll dice", "die roller", "d20 roller", "dice game",
             "random dice", "board game dice", "two dice", "six sided die",
             "rpg dice", "dnd dice", "throw dice"],
    "stopwatch": ["stopwatch", "stop watch", "lap timer", "running stopwatch",
                  "race timer", "time tracker with laps", "split timer", "chronometer",
                  "measure elapsed time", "sports stopwatch", "speedrun timer", "track time"],
    "quiz": ["quiz", "trivia game", "trivia quiz", "multiple choice quiz", "test questions",
             "general knowledge quiz", "pub quiz", "quiz about space", "quiz about animals",
             "geography quiz", "science quiz", "question game"],
    "flashcards": ["flashcards", "flash cards", "study cards", "vocabulary cards",
                   "memorize words", "spaced repetition", "learning cards", "revision cards",
                   "language flashcards", "study deck", "cue cards", "exam revision"],
    "tipcalc": ["tip calculator", "tip splitter", "split the bill", "restaurant tip",
                "gratuity calculator", "bill splitter", "how much to tip", "tip amount",
                "split check between friends", "service tip", "dinner bill split", "tipping"],
    "converter": ["unit converter", "convert units", "temperature converter",
                  "length converter", "celsius to fahrenheit", "km to miles",
                  "weight converter", "kg to pounds", "metric imperial converter",
                  "measurement converter", "inches to centimeters", "conversion tool"],
    "pomodoro": ["pomodoro", "pomodoro timer", "focus timer", "study timer with breaks",
                 "work break timer", "25 minute focus", "productivity timer",
                 "tomato timer", "deep work timer", "focus sessions", "study sessions", "work sprints"],
    "habit": ["habit tracker", "streak tracker", "daily habits", "habit checklist",
              "routine tracker", "track habits", "goal streaks", "water intake tracker",
              "habit calendar", "build habits", "daily check in", "self improvement tracker"],
    "picker": ["random picker", "name picker", "decision maker", "spin the wheel",
               "random choice", "pick a random name", "who goes first", "raffle draw",
               "lottery picker", "choose for me", "random selector", "yes or no picker"],
    "password": ["password generator", "random password", "strong password maker",
                 "secure password", "passphrase generator", "generate passwords",
                 "password creator", "pin generator", "random string generator",
                 "safe password tool", "password strength", "login password ideas"],
    "bmi": ["bmi calculator", "body mass index", "bmi", "weight height calculator",
            "health calculator", "bmi checker", "ideal weight", "fitness calculator",
            "body mass", "calculate my bmi", "obesity check", "weight category"],
    "memory": ["memory game", "matching game", "card matching", "concentration game",
               "memory cards", "pairs game", "flip cards game", "brain game",
               "memory match", "emoji matching game", "find the pairs", "memory puzzle"],
    "clicker": ["clicker game", "idle game", "cookie clicker", "tap game", "incremental game",
                "click to earn", "upgrade clicker", "tapping game", "idle clicker",
                "click the button game", "coin clicker", "tap to score"],
    "drawing": ["drawing pad", "paint app", "sketch pad", "doodle", "canvas drawing",
                "whiteboard", "paint program", "draw with finger", "pixel art",
                "sketchbook", "drawing board", "doodle pad"],
    "expense": ["expense tracker", "budget tracker", "money tracker", "spending log",
                "budget planner", "track expenses", "finance tracker", "cost tracker",
                "monthly budget", "income and expenses", "savings tracker", "wallet log"],
    "countdown": ["countdown to date", "days until", "event countdown", "birthday countdown",
                  "new year countdown", "countdown clock", "days left until vacation",
                  "launch countdown", "wedding countdown", "how many days until",
                  "christmas countdown", "deadline countdown"],
    "landing": ["landing page", "portfolio", "personal homepage", "profile page",
                "business card page", "product landing", "about me page", "link in bio",
                "startup homepage", "resume page", "bakery homepage", "band homepage"],
    "snake": ["snake game", "snake", "classic snake", "nokia snake", "worm game",
              "eat the apples game", "retro snake", "snake arcade", "growing snake",
              "snake on a grid", "slither game", "old phone snake"],
    "breathing": ["breathing exercise", "breathe", "box breathing", "meditation timer",
                  "calm breathing", "relaxation exercise", "breath trainer",
                  "4 7 8 breathing", "mindfulness breathing", "anxiety relief breathing",
                  "guided breathing", "inhale exhale guide"],
}

WRAPPERS = [
    "{x}", "make a {x}", "make me a {x}", "build a {x}", "create a {x}",
    "i want a {x}", "i need a {x}", "can you make a {x}", "generate a {x} app",
    "a {x} hub", "simple {x}", "please build a {x} for me", "{x} app",
    "give me a {x}", "quick {x}", "could you create a {x} please", "new {x} hub",
    "build me a little {x}", "{x} that works offline", "let's make a {x}",
]

MODIFIERS = [
    "", "", "", " with dark mode", " in blue", " with big buttons", " for my phone",
    " for kids", " that saves data", " in green", " with a clean look", " called my hub",
    " for school", " for work", " with sounds", " in red", " that looks minimal",
    " for my family", " with a black theme", " for the gym",
]

SEED = 38


def generate(per_class, labels, seed=SEED):
    """Returns (train, test) lists of (text, label) pairs.

    The test split is fixed per label so different tiers are measured on
    comparable data; per_class only limits how much of the train pool a tier
    sees.
    """
    rng = random.Random(seed)
    train, test = [], []
    for label in labels:
        pool = sorted({w.format(x=p) + m for p in PHRASES[label] for w in WRAPPERS for m in MODIFIERS})
        rng.shuffle(pool)
        n_test = max(10, len(pool) // 20)
        test += [(t, label) for t in pool[:n_test]]
        train += [(t, label) for t in pool[n_test:n_test + per_class]]
    train += [e for e in load_extra() if e[1] in labels]
    rng.shuffle(train)
    return train, test


def load_extra(path=None):
    path = path or os.path.join(os.path.dirname(__file__), "data", "extra.jsonl")
    out = []
    if not os.path.exists(path):
        return out
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                row = json.loads(line)
                out.append((row["text"], row["label"]))
    return out
