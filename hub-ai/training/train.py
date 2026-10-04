"""Trains the Hub v1 agents and writes them into the app's assets.

Each agent is a multinomial naive Bayes model that maps a request ("make me a
pomodoro timer in green") to a hub type. The app then builds the hub from the
matching template and fills in what it can read from the request (title,
colour, numbers) depending on the tier's features.

    python train.py                 # train all five tiers
    python train.py --tier pro      # train one tier
    python train.py --out DIR       # write the .json files somewhere else

Only the standard library is needed.
"""

import argparse
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dataset import generate  # noqa: E402
from hubspec import HUB_TYPES, STOPWORDS, TIER_ORDER, TIERS  # noqa: E402

VERSION = "1.0.0"
DEFAULT_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                           "app", "src", "main", "assets", "www", "models")
_STOP = set(STOPWORDS)
_TOKEN = re.compile(r"[a-z0-9]+")


def features(text, ngram):
    """Must stay in step with features() in agent.js."""
    words = [w for w in _TOKEN.findall(text.lower()) if w not in _STOP]
    feats = list(words)
    if ngram >= 2:
        feats += [a + "_" + b for a, b in zip(words, words[1:])]
    return feats


def train_tier(name):
    cfg = TIERS[name]
    labels = [t for t, _ in HUB_TYPES[:cfg["types"]]]
    train, test = generate(cfg["per_class"], labels)

    # Feature budget: keep the features that occur in the most training
    # requests, ties broken alphabetically so builds are reproducible.
    df = Counter()
    for text, _ in train:
        df.update(set(features(text, cfg["ngram"])))
    ranked = sorted(df.items(), key=lambda kv: (-kv[1], kv[0]))
    if cfg["vocab"]:
        ranked = ranked[:cfg["vocab"]]
    vocab = sorted(f for f, _ in ranked)
    index = {f: i for i, f in enumerate(vocab)}

    docs = Counter()
    counts = defaultdict(Counter)
    for text, label in train:
        docs[label] += 1
        for f in features(text, cfg["ngram"]):
            if f in index:
                counts[label][index[f]] += 1

    model = {
        "format": "hub-v1-nb",
        "version": VERSION,
        "tier": name,
        "label": cfg["label"],
        "ngram": cfg["ngram"],
        "alpha": cfg["alpha"],
        "features": cfg["features"],
        "stopwords": STOPWORDS,
        "labels": labels,
        "label_names": {t: n for t, n in HUB_TYPES if t in labels},
        "vocab": vocab,
        "docs": [docs[l] for l in labels],
        # Sparse per-label feature counts: {feature index: count}.
        "counts": [{str(k): v for k, v in sorted(counts[l].items())} for l in labels],
    }
    acc = evaluate(model, test)
    model["metrics"] = {"train_examples": len(train), "test_examples": len(test), "accuracy": round(acc, 4)}
    return model


class Scorer:
    """Inference with the same arithmetic as agent.js."""

    def __init__(self, model):
        self.m = model
        self.index = {f: i for i, f in enumerate(model["vocab"])}
        v = len(model["vocab"])
        a = model["alpha"]
        n_docs = sum(model["docs"])
        k = len(model["labels"])
        self.prior = [math.log((d + 1) / (n_docs + k)) for d in model["docs"]]
        self.totals = [sum(c.values()) for c in model["counts"]]
        self.denom = [math.log(t + a * v) for t in self.totals]
        self.counts = [{int(i): n for i, n in c.items()} for c in model["counts"]]

    def scores(self, text):
        a = self.m["alpha"]
        ids = [self.index[f] for f in features(text, self.m["ngram"]) if f in self.index]
        out = []
        for li in range(len(self.m["labels"])):
            s = self.prior[li]
            c = self.counts[li]
            for i in ids:
                s += math.log(c.get(i, 0) + a) - self.denom[li]
            out.append(s)
        return out

    def predict(self, text):
        s = self.scores(text)
        best = max(range(len(s)), key=lambda i: s[i])
        top = s[best]
        z = sum(math.exp(x - top) for x in s)
        return self.m["labels"][best], 1 / z


def evaluate(model, test):
    sc = Scorer(model)
    if not test:
        return 0.0
    ok = sum(1 for text, label in test if sc.predict(text)[0] == label)
    return ok / len(test)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tier", choices=TIER_ORDER, action="append",
                    help="tier to train (repeatable); default: all")
    ap.add_argument("--out", default=DEFAULT_OUT, help="output directory for hub-v1-<tier>.json")
    args = ap.parse_args(argv)

    os.makedirs(args.out, exist_ok=True)
    bundle = {}
    for name in args.tier or TIER_ORDER:
        model = train_tier(name)
        path = os.path.join(args.out, "hub-v1-%s.json" % name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(model, f, separators=(",", ":"), sort_keys=True)
            f.write("\n")
        m = model["metrics"]
        print("%-17s %2d hub types  %5d features  %5d examples  accuracy %.1f%%  -> %s" % (
            model["label"], len(model["labels"]), len(model["vocab"]), m["train_examples"],
            100 * m["accuracy"], os.path.relpath(path)))
        bundle[name] = model

    # The app loads models from a script tag (fetch() can't read file:// assets
    # in a WebView). Tiers that were not retrained this run keep their
    # existing .json file.
    for name in TIER_ORDER:
        path = os.path.join(args.out, "hub-v1-%s.json" % name)
        if name not in bundle and os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                bundle[name] = json.load(f)
    with open(os.path.join(args.out, "models.js"), "w", encoding="utf-8") as f:
        f.write("// Generated by training/train.py. Do not edit.\n")
        f.write("window.HUB_MODELS=")
        json.dump(bundle, f, separators=(",", ":"), sort_keys=True)
        f.write(";\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
