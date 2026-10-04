"""Checks the requests sent to OpenAI and Gemini, against a local stand-in
for both APIs (OPENAI_BASE_URL / GEMINI_BASE_URL point at it)."""

import json
import os
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

SEEN = []
HUB = "<!doctype html><html><head><title>%s</title></head><body>ok</body></html>"


class FakeApis(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        SEEN.append((self.path, {k.lower(): v for k, v in self.headers.items()}, body))
        if self.path == "/v1/chat/completions":
            out = {"choices": [{"message": {"content": "```html\n" + HUB % body["model"] + "\n```"}}]}
        else:
            out = {"candidates": [{"content": {"parts": [{"text": HUB % self.path.split("/")[-1]}]}}]}
        data = json.dumps(out).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class ProviderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), FakeApis)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        base = "http://127.0.0.1:%d" % cls.srv.server_address[1]
        env = dict(OPENAI_BASE_URL=base + "/v1", GEMINI_BASE_URL=base + "/v1beta",
                   OPENAI_API_KEY="sk-test", GEMINI_API_KEY="g-test", HUBAI_FAKE_MODELS="0",
                   HUBAI_AGENTS_FILE="/nonexistent/agents.json")
        cls.saved = {k: os.environ.get(k) for k in env}
        os.environ.update(env)
        from hubcloud import agents
        cls.agents = agents

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()
        for k, v in cls.saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def setUp(self):
        SEEN.clear()

    def test_openai_agent(self):
        out = self.agents.generate("standard", "habit tracker")
        path, headers, body = SEEN[0]
        self.assertEqual(path, "/v1/chat/completions")
        self.assertEqual(headers["authorization"], "Bearer sk-test")
        self.assertEqual(body["model"], "gpt-5")
        self.assertEqual(body["messages"][0]["role"], "system")
        self.assertIn("Hub V1 Standard", body["messages"][0]["content"])
        self.assertEqual(body["messages"][1], {"role": "user", "content": "habit tracker"})
        self.assertEqual(out["title"], "gpt-5")
        self.assertTrue(out["html"].startswith("<!doctype html>"))

    def test_v2max_builds_then_reviews(self):
        out = self.agents.generate("v2max", "crm")
        self.assertEqual([b["model"] for _, _, b in SEEN], ["gpt-6-astra", "gpt-6-sol"])
        review = SEEN[1][2]["messages"][1]["content"]
        self.assertIn("Request:\ncrm", review)
        self.assertIn("<title>gpt-6-astra</title>", review)
        self.assertEqual(out["title"], "gpt-6-sol")

    def test_translate_sends_the_hub(self):
        self.agents.generate("standard", "", "translate", "<html><body>Hello {x}</body></html>", lang="Swedish")
        msg = SEEN[0][2]["messages"][1]["content"]
        self.assertIn("<html><body>Hello {x}</body></html>", msg)
        self.assertIn("into Swedish", msg)

    def test_gemini(self):
        out = self.agents.generate("flash", "timer")
        path, headers, body = SEEN[0]
        self.assertEqual(path, "/v1beta/models/gemini-3.8-flash:generateContent")
        self.assertEqual(headers["x-goog-api-key"], "g-test")
        self.assertEqual(body["contents"][0]["parts"][0]["text"], "timer")
        self.assertEqual(out["title"], "gemini-3.8-flash:generateContent")


if __name__ == "__main__":
    unittest.main()
