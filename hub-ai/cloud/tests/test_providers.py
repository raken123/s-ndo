"""Checks the requests sent to the model API, against a local stand-in for
it (GEMINI_BASE_URL points at it)."""

import json
import os
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

SEEN = []
HUB = "<!doctype html><html><head><title>%s</title></head><body>ok</body></html>"
SCENE = {"title": "Cube", "parts": [{"shape": "box", "scale": [1, 1, 1], "position": [0, 0.5, 0], "color": "#ff0000"},
                                    {"shape": "teapot"}]}


class FakeApi(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        SEEN.append((self.path, {k.lower(): v for k, v in self.headers.items()}, body))
        model = self.path.split("/")[-1].split(":")[0]
        if "image" in model:
            parts = [{"text": "Here you go."}, {"inlineData": {"mimeType": "image/png", "data": "iVBORw0KGgo="}}]
        elif body.get("generationConfig", {}).get("responseMimeType") == "application/json":
            parts = [{"text": json.dumps(SCENE)}]
        else:
            parts = [{"text": "thinking...", "thought": True}, {"text": "```html\n" + HUB % model + "\n```"}]
        data = json.dumps({"candidates": [{"content": {"parts": parts}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class ProviderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), FakeApi)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        base = "http://127.0.0.1:%d" % cls.srv.server_address[1]
        env = dict(GEMINI_BASE_URL=base + "/v1beta", GEMINI_API_KEY="g-test", HUBAI_FAKE_MODELS="0")
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

    def test_agent(self):
        out = self.agents.generate("volt", "habit tracker")
        path, headers, body = SEEN[0]
        self.assertEqual(path, "/v1beta/models/gemini-3-flash-preview:generateContent")
        self.assertEqual(headers["x-goog-api-key"], "g-test")
        system = body["systemInstruction"]["parts"][0]["text"]
        self.assertIn("You are Hub V1 Volt", system)
        self.assertIn("Never name or hint at any other company", system)
        self.assertEqual(body["contents"][0]["parts"][0]["text"], "habit tracker")
        self.assertEqual(out["title"], "gemini-3-flash-preview")
        self.assertTrue(out["html"].startswith("<!doctype html>"), "thought parts are dropped")

    def test_kind_instructions(self):
        self.agents.generate("spark", "rocket", kind="animation")
        self.assertIn('<canvas id="stage">', SEEN[0][2]["systemInstruction"]["parts"][0]["text"])
        self.agents.generate("spark", "pitch", kind="slides")
        self.assertIn('<section class="slide">', SEEN[1][2]["systemInstruction"]["parts"][0]["text"])

    def test_v2max_builds_then_reviews(self):
        self.agents.generate("v2max", "crm")
        self.assertEqual([p for p, _, _ in SEEN], ["/v1beta/models/gemini-3.1-pro-preview:generateContent"] * 2)
        review = SEEN[1][2]["contents"][0]["parts"][0]["text"]
        self.assertIn("Request:\ncrm", review)
        self.assertIn("<title>gemini-3.1-pro-preview</title>", review)

    def test_translate_sends_the_hub(self):
        self.agents.generate("volt", "", "translate", "<html><body>Hello {x}</body></html>", lang="Swedish")
        msg = SEEN[0][2]["contents"][0]["parts"][0]["text"]
        self.assertIn("<html><body>Hello {x}</body></html>", msg)
        self.assertIn("into Swedish", msg)

    def test_data_import_sends_the_file(self):
        self.agents.generate("volt", "A sales chart", data="month,sales\n{Jan},10", data_name="sales.csv")
        msg = SEEN[0][2]["contents"][0]["parts"][0]["text"]
        self.assertTrue(msg.startswith("A sales chart"))
        self.assertIn("--- sales.csv ---\nmonth,sales\n{Jan},10\n--- end of sales.csv ---", msg)

    def test_refine_sends_the_hub_and_the_change(self):
        self.agents.generate("volt", "Add a reset button", "refine", "<html><body>Count</body></html>")
        msg = SEEN[0][2]["contents"][0]["parts"][0]["text"]
        self.assertIn("<html><body>Count</body></html>", msg)
        self.assertIn("Change it as follows: Add a reset button", msg)

    def test_3d_scene_is_cleaned_and_wrapped(self):
        out = self.agents.generate("flux", "a cube", kind="model3d")
        body = SEEN[0][2]
        self.assertEqual(body["generationConfig"]["responseMimeType"], "application/json")
        self.assertEqual(out["title"], "Cube")
        scene = self.agents.viewer3d.scene_of(out["html"])
        self.assertEqual([p["shape"] for p in scene["parts"]], ["box"], "unknown shapes are dropped")
        self.assertEqual(scene["parts"][0]["rotation"], [0, 0, 0])

    def test_image_edit(self):
        out = self.agents.generate("pixel", "make it blue", kind="image", image=("image/jpeg", "/9j/4AAQ"))
        path, _, body = SEEN[0]
        self.assertEqual(path, "/v1beta/models/gemini-2.5-flash-image:generateContent")
        parts = body["contents"][0]["parts"]
        self.assertIn("make it blue", parts[0]["text"])
        self.assertEqual(parts[1], {"inlineData": {"mimeType": "image/jpeg", "data": "/9j/4AAQ"}})
        self.assertEqual(out["image"], "data:image/png;base64,iVBORw0KGgo=")


if __name__ == "__main__":
    unittest.main()
