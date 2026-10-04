"""Tests for the Hub v1 trainer.

    python -m unittest discover -s training -p "test_*.py"

The parity test runs the app's agent.js under Node (skipped when Node is
not installed) and checks it ranks requests exactly like train.py.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import train  # noqa: E402
from hubspec import HUB_TYPES, TIER_ORDER, TIERS  # noqa: E402

WWW = os.path.join(HERE, "..", "app", "src", "main", "assets", "www")
TEMPLATES = os.path.join(WWW, "js", "templates.js")

PROMPTS = [
    "make me a pomodoro timer in green called Deep Work",
    "grocery list",
    "snake game for my brother",
    "quiz about planets",
    "a website for my bakery",
    "roll two dice",
    "how much should I tip",
    "track my spending this month",
    "box breathing to calm down",
    "",
]


class TrainTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = tempfile.mkdtemp()
        train.main(["--out", cls.out])
        cls.models = {}
        for t in TIER_ORDER:
            with open(os.path.join(cls.out, "hub-v1-%s.json" % t), encoding="utf-8") as f:
                cls.models[t] = json.load(f)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.out)

    def test_tiers_grow(self):
        prev = []
        for t in TIER_ORDER:
            labels = self.models[t]["labels"]
            self.assertEqual(len(labels), TIERS[t]["types"])
            self.assertEqual(labels[:len(prev)], prev, "%s must know everything the tier below knows" % t)
            prev = labels

    def test_accuracy(self):
        floors = {"mini": 0.85, "lite": 0.9, "standard": 0.95, "pro": 0.95, "max": 0.95}
        for t, floor in floors.items():
            self.assertGreaterEqual(self.models[t]["metrics"]["accuracy"], floor, t)

    def test_max_understands_requests(self):
        sc = train.Scorer(self.models["max"])
        expect = {
            "make me a pomodoro timer in green called Deep Work": "pomodoro",
            "grocery list": "todo",
            "snake game for my brother": "snake",
            "a website for my bakery": "landing",
            "how much should I tip": "tipcalc",
            "track my spending this month": "expense",
        }
        for text, label in expect.items():
            self.assertEqual(sc.predict(text)[0], label, text)

    def test_templates_cover_hub_types(self):
        with open(TEMPLATES, encoding="utf-8") as f:
            src = f.read()
        for t, _ in HUB_TYPES:
            self.assertIn("T.%s = function" % t, src)

    def test_bundle(self):
        with open(os.path.join(self.out, "models.js"), encoding="utf-8") as f:
            text = f.read()
        data = json.loads(text.split("window.HUB_MODELS=", 1)[1].rstrip().rstrip(";"))
        self.assertEqual(sorted(data), sorted(TIER_ORDER))

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_js_parity(self):
        script = r"""
const fs = require('fs'), vm = require('vm');
const [models, agent, prompts] = process.argv.slice(1);
const ctx = { window: {}, console };
ctx.window.window = ctx.window;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(models, 'utf8'), ctx);
ctx.Store = { get: (k, d) => d, set: () => true };
ctx.window.Store = ctx.Store;
vm.runInContext('var window = this.window; var Store = this.Store;' + fs.readFileSync(agent, 'utf8'), ctx);
const A = ctx.window.HubAgent, out = {};
for (const t of A.tiers) out[t] = JSON.parse(prompts).map(p => { const r = A.classify(t, p); return [r.label, r.confidence]; });
console.log(JSON.stringify(out));
"""
        res = subprocess.run(
            ["node", "-e", script, os.path.join(self.out, "models.js"),
             os.path.join(WWW, "js", "agent.js"), json.dumps(PROMPTS)],
            capture_output=True, text=True, check=True)
        js = json.loads(res.stdout)
        for t in TIER_ORDER:
            sc = train.Scorer(self.models[t])
            for prompt, (label, conf) in zip(PROMPTS, js[t]):
                py_label, py_conf = sc.predict(prompt)
                self.assertEqual(label, py_label, "%s: %r" % (t, prompt))
                self.assertAlmostEqual(conf, py_conf, places=9)


if __name__ == "__main__":
    unittest.main()
