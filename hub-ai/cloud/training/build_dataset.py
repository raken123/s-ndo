"""Builds the fine-tuning datasets for the Hub agents.

Each example is a request (from dataset.py) and the hub Hub AI wants back
(rendered from the app's templates with the agent's level of features),
with the agent's system prompt, in OpenAI's chat fine-tuning format.

    python training/build_dataset.py            # all agents -> training/out/
    python training/build_dataset.py --tier max

Needs Node.js to render the templates.
"""

import argparse
import json
import math
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))

from dataset import generate  # noqa: E402
from hubspec import HUB_TYPES, TIER_ORDER, TIERS  # noqa: E402
from hubcloud import agents, config  # noqa: E402

OUT = os.path.join(HERE, "out")
TEMPLATES = os.path.join(HERE, "..", "..", "app", "src", "main", "assets", "www", "js", "templates.js")
DEFAULT_ACCENT = "#3b74d9"
COLORS = {
    "red": "#d94848", "orange": "#e07b2a", "yellow": "#c9a227", "gold": "#c9a227", "green": "#2f9e5b",
    "teal": "#1f9c94", "cyan": "#1a9fbf", "blue": "#3b74d9", "navy": "#2c4a8a", "purple": "#7d55c7",
    "violet": "#7d55c7", "pink": "#d2558f", "brown": "#8a5a3c", "gray": "#6f7782", "grey": "#6f7782",
}
NAMES = dict(HUB_TYPES)

RENDER_JS = r"""
const fs = require('fs'), vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), ctx);
const jobs = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(jobs.map(([type, opts]) => ctx.window.HubTemplates.render(type, opts))));
"""


def extract(text):
    """What a request asks for: title, colour, light theme, a number, a topic."""
    out, lower = {}, text.lower()
    m = re.search(r"\b(?:called|named|titled)\s+[\"“']?([^\"”'.,!?\n]{2,40})", text, re.I)
    if m:
        out["title"] = m.group(1).strip()
    for name, hexv in COLORS.items():
        if re.search(r"\b%s\b" % name, lower):
            out["accent"] = hexv
            break
    if re.search(r"\b(light|white|bright)\b", lower) and "dark" not in lower:
        out["dark"] = False
    d = re.search(r"\bd(4|6|8|10|12|20|100)\b", lower)
    n = re.search(r"\b(\d{1,4})\b", lower)
    if d or n:
        out["n"] = int((d or n).group(1))
    t = re.search(r"\b(?:about|until|for)\s+(?:the\s+|my\s+|our\s+|a\s+)?([a-z][a-z' ]{2,30}?)(?=\s+(?:with|in|that|called|for|and)\b|[.,!?]|$)", lower)
    if t and t.group(1) not in ("me", "kids", "work", "school", "my phone", "the gym", "my family", "you"):
        out["topic"] = t.group(1).title()
    return out


def options(tier, label, text, i):
    f = set(TIERS[tier]["features"])
    got = extract(text)
    title = got["title"] if "title" in f and "title" in got else NAMES[label]
    return {
        "title": title,
        "accent": got.get("accent", DEFAULT_ACCENT) if "accent" in f else DEFAULT_ACCENT,
        "dark": got.get("dark", True) if "theme" in f else True,
        "persist": "persist" in f,
        "extras": "extras" in f,
        "n": got.get("n") if "numbers" in f else None,
        "topic": got.get("topic", ""),
        "key": "hub-%s-%d" % (tier, i),
        "engine": config.engine(tier)["name"],
    }


def render(jobs):
    r = subprocess.run(["node", "-e", RENDER_JS, TEMPLATES], input=json.dumps(jobs),
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def build(tier):
    n = TIERS[tier]["examples"]
    labels = [t for t, _ in HUB_TYPES]
    train, valid = generate(math.ceil(n / len(labels)) + 1, labels)
    train, valid = train[:n], valid[:max(12, n // 8)]
    system = agents.system_prompt(tier)
    files = {}
    for split, rows in (("train", train), ("valid", valid)):
        htmls = render([[label, options(tier, label, text, i)] for i, (text, label) in enumerate(rows)])
        path = os.path.join(OUT, "%s.%s.jsonl" % (tier, split))
        with open(path, "w", encoding="utf-8") as f:
            for (text, _), html in zip(rows, htmls):
                f.write(json.dumps({"messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": text},
                    {"role": "assistant", "content": html},
                ]}) + "\n")
        files[split] = path
    return files


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tier", choices=TIER_ORDER, action="append")
    a = ap.parse_args(argv)
    os.makedirs(OUT, exist_ok=True)
    for tier in a.tier or TIER_ORDER:
        files = build(tier)
        sizes = {}
        for k, v in files.items():
            with open(v, encoding="utf-8") as f:
                sizes[k] = sum(1 for _ in f)
        print("%-9s %4d train  %3d valid  -> %s" % (tier, sizes["train"], sizes["valid"], os.path.relpath(files["train"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
