"""End-to-end tests of the cloud API with fake models.

    cd hub-ai/cloud && python -m unittest discover -s tests -v
"""

import json
import os
import sys
import tempfile
import unittest
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
os.environ["HUBAI_FAKE_MODELS"] = "1"
os.environ["HUBAI_QUIET"] = "1"
os.environ["HUBAI_ADMIN_KEY"] = "test-admin"
os.environ["HUBAI_AGENTS_FILE"] = os.path.join(tempfile.gettempdir(), "hubai-no-agents.json")

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

    def test_config_and_base_models(self):
        s, d = Api(self.base).call("GET", "/v1/config")
        self.assertEqual(s, 200)
        base = {e["id"]: e["base"] for e in d["engines"]}
        self.assertEqual(base["mini"], ["GPT-4o"])
        self.assertEqual(base["lite"], ["GPT-4.5"])
        self.assertEqual(base["standard"], ["GPT-5"])
        self.assertEqual(base["plus"], ["GPT-5.6 Sol"])
        self.assertEqual(base["max"], ["GPT-6 Astra"])
        self.assertEqual(base["v2max"], ["GPT-6 Astra", "GPT-6 Sol"])

    def test_needs_token(self):
        s, d = Api(self.base).call("POST", "/v1/generate", {"engine": "mini", "prompt": "x"})
        self.assertEqual(s, 401)

    def test_free_plan(self):
        a = self.api()
        s, me = a.call("GET", "/v1/me")
        self.assertEqual((me["plan"], me["credits"]), ("free", 10))
        s, d = a.call("POST", "/v1/generate", {"engine": "mini", "prompt": "a todo list"})
        self.assertEqual(s, 200, d)
        self.assertIn("<!doctype html>", d["html"])
        self.assertIn('data-model="gpt-4o"', d["html"])
        self.assertEqual(d["me"]["credits"], 9)
        s, d = a.call("POST", "/v1/generate", {"engine": "standard", "prompt": "x"})
        self.assertEqual((s, d["code"]), (402, "plan"))
        for _ in range(9):
            a.call("POST", "/v1/generate", {"engine": "mini", "prompt": "x"})
        s, d = a.call("POST", "/v1/generate", {"engine": "mini", "prompt": "x"})
        self.assertEqual((s, d["code"]), (402, "credits"))

    def test_go_and_plus(self):
        a = self.api()
        s, d = a.call("POST", "/v1/subscribe", {"plan": "go"})
        self.assertEqual((s, d["plan"], d["credits"]), (200, "go", 100))
        self.assertTrue(d["receipt"].startswith("DEMO-"))
        s, d = a.call("POST", "/v1/generate", {"engine": "standard", "prompt": "quiz"})
        self.assertIn('data-model="gpt-5"', d["html"])
        s, d = a.call("POST", "/v1/generate", {"engine": "plus", "prompt": "x"})
        self.assertEqual(d["code"], "plan")
        a.call("POST", "/v1/subscribe", {"plan": "plus"})
        s, d = a.call("POST", "/v1/generate", {"engine": "plus", "prompt": "x"})
        self.assertIn('data-model="gpt-5.6-sol"', d["html"])
        for i in range(5):
            s, d = a.call("POST", "/v1/generate", {"engine": "max", "prompt": "x"})
            self.assertEqual(s, 200, d)
        self.assertIn('data-model="gpt-6-astra"', d["html"])
        s, d = a.call("POST", "/v1/generate", {"engine": "max", "prompt": "x"})
        self.assertEqual((s, d["code"]), (429, "limit"))
        s, d = a.call("POST", "/v1/generate", {"engine": "v2max", "prompt": "x"})
        self.assertEqual((s, d["code"]), (402, "plan"))

    def test_enterprise_is_not_for_sale(self):
        a = self.api()
        s, d = a.call("POST", "/v1/subscribe", {"plan": "enterprise"})
        self.assertEqual((s, d["code"]), (403, "contact_sales"))
        s, d = a.call("POST", "/v1/admin/plan", {"account": a.account, "plan": "enterprise"}, {"X-Admin-Key": "wrong"})
        self.assertEqual(s, 403)
        s, d = a.call("POST", "/v1/admin/plan", {"account": a.account, "plan": "enterprise"}, {"X-Admin-Key": "test-admin"})
        self.assertEqual((s, d["plan"]), (200, "enterprise"))
        s, d = a.call("POST", "/v1/generate", {"engine": "v2max", "prompt": "a crm"})
        self.assertEqual(s, 200, d)
        # Astra builds it, then Sol reviews it: the final hub comes from Sol.
        self.assertEqual(d["base"], ["GPT-6 Astra", "GPT-6 Sol"])
        self.assertIn('data-model="gpt-6-sol"', d["html"])
        self.assertEqual(d["me"]["credits"], 100000 - 100)

    def test_failed_generation_is_refunded(self):
        a = self.api()
        os.environ["HUBAI_FAKE_MODELS"] = "0"
        old = os.environ.pop("OPENAI_API_KEY", None)
        try:
            s, d = a.call("POST", "/v1/generate", {"engine": "mini", "prompt": "x"})
        finally:
            os.environ["HUBAI_FAKE_MODELS"] = "1"
            if old:
                os.environ["OPENAI_API_KEY"] = old
        self.assertEqual((s, d["code"]), (502, "model"))
        self.assertEqual(a.call("GET", "/v1/me")[1]["credits"], 10)

    def test_bad_input(self):
        a = self.api()
        self.assertEqual(a.call("POST", "/v1/generate", {"engine": "nope", "prompt": "x"})[0], 400)
        self.assertEqual(a.call("POST", "/v1/generate", {"engine": "mini", "prompt": ""})[0], 400)
        self.assertEqual(a.call("POST", "/v1/generate", {"engine": "mini", "prompt": "x" * 5000})[0], 400)
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
        os.environ["HUBAI_MODEL_LITE"] = "gpt-4.1"
        try:
            self.assertEqual(config.models_for("lite"), ["gpt-4.1"])
        finally:
            del os.environ["HUBAI_MODEL_LITE"]


if __name__ == "__main__":
    unittest.main()
