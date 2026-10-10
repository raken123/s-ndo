"""Checks the requests sent to the model API, against a local stand-in for
it (OPENAI_BASE_URL points at it)."""

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
        raw = self.rfile.read(int(self.headers["Content-Length"]))
        headers = {k.lower(): v for k, v in self.headers.items()}
        body = json.loads(raw) if headers["content-type"] == "application/json" else raw
        SEEN.append((self.path, headers, body))
        if self.path.startswith("/v1/images/"):
            out = {"data": [{"b64_json": "iVBORw0KGgo="}], "output_format": "png"}
        elif body.get("response_format", {}).get("type") == "json_object":
            out = {"choices": [{"message": {"content": json.dumps(SCENE)}, "finish_reason": "stop"}]}
        else:
            out = {"choices": [{"message": {"content": "```html\n" + HUB % body["model"] + "\n```"}, "finish_reason": "stop"}]}
        data = json.dumps(out).encode()
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
        env = dict(OPENAI_BASE_URL=base + "/v1", OPENAI_API_KEY="sk-test", HUBAI_FAKE_MODELS="0")
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
        self.assertEqual(path, "/v1/chat/completions")
        self.assertEqual(headers["authorization"], "Bearer sk-test")
        self.assertEqual((body["model"], body["reasoning_effort"]), ("gpt-5.6-terra", "medium"))
        system = body["messages"][0]
        self.assertEqual(system["role"], "system")
        self.assertIn("You are Hub V1 Volt", system["content"])
        self.assertIn("Never name or hint at any other company", system["content"])
        self.assertEqual(body["messages"][1], {"role": "user", "content": "habit tracker"})
        self.assertEqual(out["title"], "gpt-5.6-terra")
        self.assertTrue(out["html"].startswith("<!doctype html>"))

    def test_effort_per_agent_and_override(self):
        self.agents.generate("spark", "x")
        self.agents.generate("titan", "x")
        self.assertEqual([(b["model"], b["reasoning_effort"]) for _, _, b in SEEN],
                         [("gpt-5.6-luna", "low"), ("gpt-5.6-sol", "high")])
        os.environ["HUBAI_EFFORT_SPARK"] = "none"
        try:
            self.agents.generate("spark", "x")
        finally:
            del os.environ["HUBAI_EFFORT_SPARK"]
        self.assertNotIn("reasoning_effort", SEEN[2][2])

    def test_kind_instructions(self):
        self.agents.generate("spark", "rocket", kind="animation")
        self.assertIn('<canvas id="stage">', SEEN[0][2]["messages"][0]["content"])
        self.agents.generate("spark", "pitch", kind="slides")
        self.assertIn('<section class="slide">', SEEN[1][2]["messages"][0]["content"])

    def test_v2max_builds_then_reviews(self):
        self.agents.generate("v2max", "crm")
        self.assertEqual([b["model"] for _, _, b in SEEN], ["gpt-5.6-sol", "gpt-5.6-sol"])
        review = SEEN[1][2]["messages"][1]["content"]
        self.assertIn("Request:\ncrm", review)
        self.assertIn("<title>gpt-5.6-sol</title>", review)

    def test_translate_sends_the_hub(self):
        self.agents.generate("volt", "", "translate", "<html><body>Hello {x}</body></html>", lang="Swedish")
        msg = SEEN[0][2]["messages"][1]["content"]
        self.assertIn("<html><body>Hello {x}</body></html>", msg)
        self.assertIn("into Swedish", msg)

    def test_data_import_sends_the_file(self):
        self.agents.generate("volt", "A sales chart", data="month,sales\n{Jan},10", data_name="sales.csv")
        msg = SEEN[0][2]["messages"][1]["content"]
        self.assertTrue(msg.startswith("A sales chart"))
        self.assertIn("--- sales.csv ---\nmonth,sales\n{Jan},10\n--- end of sales.csv ---", msg)

    def test_refine_sends_the_hub_and_the_change(self):
        self.agents.generate("volt", "Add a reset button", "refine", "<html><body>Count</body></html>")
        msg = SEEN[0][2]["messages"][1]["content"]
        self.assertIn("<html><body>Count</body></html>", msg)
        self.assertIn("Change it as follows: Add a reset button", msg)

    def test_3d_scene_is_cleaned_and_wrapped(self):
        out = self.agents.generate("flux", "a cube", kind="model3d")
        body = SEEN[0][2]
        self.assertEqual(body["response_format"], {"type": "json_object"})
        self.assertIn("JSON", body["messages"][0]["content"], "JSON mode needs the word JSON in the prompt")
        self.assertEqual(out["title"], "Cube")
        scene = self.agents.viewer3d.scene_of(out["html"])
        self.assertEqual([p["shape"] for p in scene["parts"]], ["box"], "unknown shapes are dropped")

    def test_new_picture(self):
        out = self.agents.generate("pixel", "a cabin", kind="image")
        path, _, body = SEEN[0]
        self.assertEqual(path, "/v1/images/generations")
        self.assertEqual(body["model"], "gpt-image-2")
        self.assertIn("a cabin", body["prompt"])
        self.assertEqual(out["image"], "data:image/png;base64,iVBORw0KGgo=")

    def test_photo_edit_is_multipart(self):
        self.agents.generate("pixel", "make it blue", kind="image", image=("image/jpeg", "/9j/4AAQ"))
        path, headers, body = SEEN[0]
        self.assertEqual(path, "/v1/images/edits")
        self.assertTrue(headers["content-type"].startswith("multipart/form-data; boundary="))
        self.assertIn(b'name="model"\r\n\r\ngpt-image-2\r\n', body)
        self.assertIn(b"make it blue", body)
        self.assertIn(b'name="image"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n\xff\xd8\xff\xe0\x00\x10', body)


if __name__ == "__main__":
    unittest.main()
