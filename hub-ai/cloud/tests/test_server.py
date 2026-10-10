"""End-to-end tests of the cloud API with fake models.

    cd hub-ai/cloud && python -m unittest discover -s tests -v
"""

import json
import os
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
os.environ["HUBAI_FAKE_MODELS"] = "1"
os.environ["HUBAI_QUIET"] = "1"
os.environ["HUBAI_ADMIN_KEY"] = "test-admin"

from hubcloud import config, export_config  # noqa: E402
from hubcloud.server import serve_in_thread  # noqa: E402


class Api:
    def __init__(self, base):
        self.base, self.token = base, None

    def call(self, method, path, body=None, headers=None):
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = "Bearer " + self.token
        h.update(headers or {})
        req = urllib.request.Request(self.base + path, method=method, headers=h,
                                     data=json.dumps(body).encode() if body is not None else None)
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def signup(self):
        s, d = self.call("POST", "/v1/accounts")
        assert s == 200, d
        self.token, self.account = d["token"], d["account"]
        return self


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.srv = serve_in_thread(host="127.0.0.1", port=0, db_path=os.path.join(cls.tmp, "t.db"))
        cls.base = "http://127.0.0.1:%d" % cls.srv.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def api(self):
        return Api(self.base).signup()

    def test_config_hides_models_and_the_secret_agent(self):
        s, d = Api(self.base).call("GET", "/v1/config")
        self.assertEqual(s, 200)
        text = json.dumps(d).lower()
        for leak in ("gemini", "google", "gpt", "openai", "provider", "\"models\"", "flash-lite", "v2 max", "v2max"):
            self.assertNotIn(leak, text)
        self.assertEqual([e["id"] for e in d["engines"]], ["spark", "flux", "volt", "prism", "titan", "pixel"])
        self.assertTrue(all(e["name"].startswith("Hub V1 ") for e in d["engines"]))
        self.assertEqual(len(d["kinds"]), 13)
        self.assertEqual(len(d["features"]), 20)
        per_plan = {p["id"]: len(p["features"]) for p in d["plans"]}
        self.assertEqual(per_plan, {"free": 5, "go": 10, "plus": 15, "enterprise": 20})

    def test_each_agent_runs_its_model(self):
        a = self.api()
        a.call("POST", "/v1/subscribe", {"plan": "plus"})
        for engine, model in (("spark", "gpt-5.6-luna"), ("flux", "gpt-5.6-luna"), ("volt", "gpt-5.6-terra"),
                              ("prism", "gpt-5.6-sol"), ("titan", "gpt-5.6-sol")):
            s, d = a.call("POST", "/v1/generate", {"engine": engine, "prompt": "x"})
            self.assertEqual(s, 200, d)
            self.assertIn('data-model="%s"' % model, d["html"])
            self.assertNotIn("models", d)

    def test_needs_token(self):
        s, d = Api(self.base).call("POST", "/v1/generate", {"engine": "spark", "prompt": "x"})
        self.assertEqual(s, 401)

    def test_free_plan(self):
        a = self.api()
        s, me = a.call("GET", "/v1/me")
        self.assertEqual((me["plan"], me["credits"]), ("free", 10))
        s, d = a.call("POST", "/v1/generate", {"engine": "flux", "prompt": "a todo list"})
        self.assertEqual(s, 200, d)
        self.assertIn("<!doctype html>", d["html"])
        self.assertEqual((d["engineName"], d["kind"], d["me"]["credits"]), ("Hub V1 Flux", "app", 9))
        s, d = a.call("POST", "/v1/generate", {"engine": "volt", "prompt": "x"})
        self.assertEqual((s, d["code"], d["error"]), (402, "plan", "Hub V1 Volt needs Hub Go."))
        for _ in range(9):
            a.call("POST", "/v1/generate", {"engine": "spark", "prompt": "x"})
        s, d = a.call("POST", "/v1/generate", {"engine": "spark", "prompt": "x"})
        self.assertEqual((s, d["code"]), (402, "credits"))

    def test_go_and_plus(self):
        a = self.api()
        s, d = a.call("POST", "/v1/subscribe", {"plan": "go"})
        self.assertEqual((s, d["plan"], d["credits"]), (200, "go", 100))
        self.assertTrue(d["receipt"].startswith("DEMO-"))
        s, d = a.call("POST", "/v1/generate", {"engine": "volt", "prompt": "quiz"})
        self.assertEqual(s, 200, d)
        s, d = a.call("POST", "/v1/generate", {"engine": "prism", "prompt": "x"})
        self.assertEqual((d["code"], d["error"]), ("plan", "Hub V1 Prism needs Hub Plus."))
        a.call("POST", "/v1/subscribe", {"plan": "plus"})
        s, d = a.call("POST", "/v1/generate", {"engine": "prism", "prompt": "x"})
        self.assertEqual(s, 200, d)
        for i in range(5):
            s, d = a.call("POST", "/v1/generate", {"engine": "titan", "prompt": "x"})
            self.assertEqual(s, 200, d)
        s, d = a.call("POST", "/v1/generate", {"engine": "titan", "prompt": "x"})
        self.assertEqual((s, d["code"]), (429, "limit"))
        s, d = a.call("POST", "/v1/generate", {"engine": "v2max", "prompt": "x"})
        self.assertEqual((s, d["error"]), (400, "Unknown engine."))

    def test_secret_agent_and_enterprise(self):
        a = self.api()
        s, me = a.call("GET", "/v1/me")
        self.assertEqual(me["secretEngines"], [])
        # For everyone else the secret agent doesn't exist.
        s, d = a.call("POST", "/v1/generate", {"engine": "v2max", "prompt": "x"})
        self.assertEqual((s, d["error"]), (400, "Unknown engine."))
        s, d = a.call("POST", "/v1/subscribe", {"plan": "enterprise"})
        self.assertEqual((s, d["plan"]), (200, "enterprise"), d)
        self.assertEqual([e["id"] for e in d["secretEngines"]], ["v2max"])
        self.assertNotIn("gpt", json.dumps(d).lower())
        self.assertEqual(len(d["features"]), 20)
        self.assertGreater(d["renews"], (time.time() + 300 * 86400) * 1000, "Enterprise renews yearly")
        s, d = a.call("POST", "/v1/generate", {"engine": "v2max", "prompt": "a crm"})
        self.assertEqual(s, 200, d)
        self.assertEqual(d["me"]["credits"], 100000 - 100)
        s, d = a.call("GET", "/v1/me")
        self.assertEqual(d["receipts"][0]["amount"], 120000)

    def test_creation_kinds(self):
        a = self.api()
        a.call("POST", "/v1/subscribe", {"plan": "go"})
        for kind in ("animation", "slides", "card", "ui", "game", "website", "infographic", "logo", "diagram", "doc"):
            s, d = a.call("POST", "/v1/generate", {"engine": "spark", "prompt": "x", "kind": kind})
            self.assertEqual((s, d.get("kind")), (200, kind), d)
        s, d = a.call("POST", "/v1/generate", {"engine": "spark", "prompt": "x", "kind": "hologram"})
        self.assertEqual(s, 400)

    def test_3d_model(self):
        a = self.api()
        s, d = a.call("POST", "/v1/generate", {"engine": "flux", "prompt": "a rocket", "kind": "model3d"})
        self.assertEqual(s, 200, d)
        self.assertEqual(d["title"], "Rocket")
        self.assertIn('<script type="application/json" id="model">', d["html"])
        self.assertIn("Download GLB", d["html"])
        self.assertIn("Made with Hub AI · Hub V1 Flux", d["html"])
        self.assertNotIn("gpt", d["html"].lower())
        s, d2 = a.call("POST", "/v1/generate", {"engine": "flux", "prompt": "make it blue", "kind": "model3d", "mode": "refine", "html": d["html"]})
        self.assertEqual(s, 200, d2)
        s, d2 = a.call("POST", "/v1/generate", {"engine": "flux", "prompt": "x", "kind": "model3d", "mode": "refine", "html": "<html></html>"})
        self.assertEqual((s, d2["error"]), (400, "That is not a Hub AI 3D model."))
        self.assertEqual(a.call("GET", "/v1/me")[1]["credits"], 8, "the failed edit is refunded")

    def test_images_and_photo_edits(self):
        import base64
        a = self.api()
        s, d = a.call("POST", "/v1/generate", {"engine": "flux", "prompt": "a cabin", "kind": "image"})
        self.assertEqual((s, d["error"]), (400, "Pictures are made by Hub V1 Pixel."))
        s, d = a.call("POST", "/v1/generate", {"engine": "pixel", "prompt": "a cabin"})
        self.assertEqual((s, d["error"]), (400, "Hub V1 Pixel only makes pictures."))
        s, d = a.call("POST", "/v1/generate", {"engine": "pixel", "prompt": "a cabin in the snow", "kind": "image"})
        self.assertEqual(s, 200, d)
        self.assertTrue(d["image"].startswith("data:image/png;base64,"))
        self.assertEqual(base64.b64decode(d["image"].split(",")[1])[:4], b"\x89PNG")
        self.assertIn('<img id="art"', d["html"])
        self.assertEqual(d["me"]["credits"], 6)
        photo = d["image"]
        s, d = a.call("POST", "/v1/generate", {"engine": "pixel", "prompt": "make it night", "kind": "image", "image": photo})
        self.assertEqual((s, d["image"]), (200, photo))
        s, d = a.call("POST", "/v1/generate", {"engine": "pixel", "prompt": "x", "kind": "image", "image": "data:text/plain;base64,aGk="})
        self.assertEqual(s, 400)
        s, d = a.call("POST", "/v1/generate", {"engine": "pixel", "prompt": "x", "kind": "image", "mode": "fix", "html": "<html></html>"})
        self.assertEqual(s, 400)

    def test_admin_plan(self):
        a = self.api()
        s, d = a.call("POST", "/v1/admin/plan", {"account": a.account, "plan": "plus"}, {"X-Admin-Key": "wrong"})
        self.assertEqual(s, 403)
        s, d = a.call("POST", "/v1/admin/plan", {"account": a.account, "plan": "plus"}, {"X-Admin-Key": "test-admin"})
        self.assertEqual((s, d["plan"]), (200, "plus"))

    def test_feature_modes(self):
        a = self.api()
        hub = "<!doctype html><html><head><title>T</title><style>a{color:red}</style></head><body>Hi</body></html>"
        # Edit with AI is on every plan; it needs the hub and the change.
        s, d = a.call("POST", "/v1/generate", {"engine": "spark", "prompt": "Make the button blue", "mode": "refine", "html": hub})
        self.assertEqual((s, d["mode"]), (200, "refine"), d)
        s, d = a.call("POST", "/v1/generate", {"engine": "spark", "prompt": "", "mode": "refine", "html": hub})
        self.assertEqual(s, 400)
        s, d = a.call("POST", "/v1/generate", {"engine": "spark", "prompt": "x", "mode": "refine"})
        self.assertEqual(s, 400)
        # AI Bug Fix, Translate and Data Import start with Hub Plus.
        s, d = a.call("POST", "/v1/generate", {"engine": "spark", "prompt": "", "mode": "fix", "html": hub})
        self.assertEqual((s, d["code"], d["error"]), (402, "plan", "AI Bug Fix needs Hub Plus."))
        s, d = a.call("POST", "/v1/generate", {"engine": "spark", "prompt": "A chart", "data": "a,b\n1,2", "dataName": "x.csv"})
        self.assertEqual((s, d["error"]), (402, "Data Import needs Hub Plus."))
        a.call("POST", "/v1/subscribe", {"plan": "plus"})
        s, d = a.call("POST", "/v1/generate", {"engine": "volt", "prompt": "", "mode": "fix", "html": hub})
        self.assertEqual((s, d["mode"]), (200, "fix"), d)
        s, d = a.call("POST", "/v1/generate", {"engine": "volt", "mode": "translate", "html": hub, "lang": "Klingon"})
        self.assertEqual(s, 400)
        s, d = a.call("POST", "/v1/generate", {"engine": "volt", "mode": "translate", "html": hub, "lang": "Swedish"})
        self.assertEqual(s, 200, d)
        s, d = a.call("POST", "/v1/generate", {"engine": "volt", "prompt": "A chart", "data": "a,b\n1,2", "dataName": "x.csv"})
        self.assertEqual(s, 200, d)
        s, d = a.call("POST", "/v1/generate", {"engine": "volt", "prompt": "A chart", "data": "x" * (101 * 1024)})
        self.assertEqual(s, 413)
        s, d = a.call("POST", "/v1/generate", {"engine": "volt", "mode": "fix"})
        self.assertEqual(s, 400)
        for gone in ("crazier", "mashup", "nope"):
            s, d = a.call("POST", "/v1/generate", {"engine": "volt", "mode": gone, "html": hub})
            self.assertEqual(s, 400, gone)

    def test_failed_generation_is_refunded_and_says_nothing_about_the_model(self):
        a = self.api()
        os.environ["HUBAI_FAKE_MODELS"] = "0"
        old = os.environ.pop("OPENAI_API_KEY", None)
        try:
            s, d = a.call("POST", "/v1/generate", {"engine": "spark", "prompt": "x"})
        finally:
            os.environ["HUBAI_FAKE_MODELS"] = "1"
            if old:
                os.environ["OPENAI_API_KEY"] = old
        self.assertEqual((s, d["code"]), (502, "model"))
        self.assertEqual(d["error"], "Hub V1 Spark couldn't finish this one. Try again, or pick another agent.")
        self.assertEqual(a.call("GET", "/v1/me")[1]["credits"], 10)

    def test_bad_input(self):
        a = self.api()
        self.assertEqual(a.call("POST", "/v1/generate", {"engine": "nope", "prompt": "x"})[0], 400)
        self.assertEqual(a.call("POST", "/v1/generate", {"engine": "spark", "prompt": ""})[0], 400)
        self.assertEqual(a.call("POST", "/v1/generate", {"engine": "spark", "prompt": "x" * 5000})[0], 400)
        self.assertEqual(a.call("GET", "/v1/nothing")[0], 404)

    def test_cors_preflight(self):
        req = urllib.request.Request(self.base + "/v1/generate", method="OPTIONS")
        with urllib.request.urlopen(req) as r:
            self.assertEqual(r.status, 204)
            self.assertEqual(r.headers["Access-Control-Allow-Origin"], "*")
            self.assertIn("Authorization", r.headers["Access-Control-Allow-Headers"])

    def test_app_copy_of_config_is_current(self):
        with open(export_config.OUT, encoding="utf-8") as f:
            self.assertEqual(f.read(), export_config.render(),
                             "Run `python -m hubcloud.export_config` after changing hubcloud/config.py")

    def test_model_override_from_env(self):
        os.environ["HUBAI_MODEL_PRISM"] = "gpt-5.5"
        try:
            self.assertEqual(config.models_for("prism"), ["gpt-5.5"])
        finally:
            del os.environ["HUBAI_MODEL_PRISM"]


if __name__ == "__main__":
    unittest.main()
