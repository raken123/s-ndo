"""Tests for the parts of the training kit that run without PyTorch.
    cd nexora/train && python -m unittest discover -s tests -v"""
import json
import sys
import tempfile
import threading
import unittest
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from nexora_model import data, tasks  # noqa: E402
from nexora_model.backend import DummyBackend  # noqa: E402
from nexora_model.serve import make_handler  # noqa: E402


class Checks(unittest.TestCase):
    def test_extract_html(self):
        self.assertEqual(tasks.extract_html("Här:\n```html\n<!doctype html><p>x</p>\n```"), "<!doctype html><p>x</p>")
        self.assertEqual(tasks.extract_html("text <!doctype html><html></html>"), "<!doctype html><html></html>")
        self.assertIsNone(tasks.extract_html("inget spel"))

    def test_svg(self):
        ok = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'><g><rect width='9' height='9'/></g></svg>"
        self.assertEqual(tasks.check_svg("Här: " + ok), ok)
        self.assertIsNone(tasks.check_svg(ok.replace(" viewBox='0 0 256 256'", "")), "needs a viewBox")
        self.assertIsNone(tasks.check_svg(ok.replace("<g>", "<g><image href='https://x.se/a.png'/>")), "no external references")
        self.assertIsNone(tasks.check_svg("<svg viewBox='0 0 256 256'><rect></svg>"), "must be well-formed")
        self.assertIsNone(tasks.check_svg(ok, frames=4), "a 4-frame sheet is 1024 wide")
        self.assertIsNotNone(tasks.check_svg(ok.replace("0 0 256 256", "0 0 1024 256"), frames=4))

    def test_json_kinds(self):
        mesh = {"vertices": [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], "faces": [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]]}
        self.assertIsNotNone(tasks.check_mesh(json.dumps(mesh)))
        self.assertIsNone(tasks.check_mesh(json.dumps(dict(mesh, faces=[[0, 1, 9]] * 4))), "index out of range")
        music = {"bpm": 120, "tracks": [{"wave": "square", "notes": [[i, 60 + i, 1] for i in range(8)]}], "drums": [[0, "kick"]]}
        self.assertIsNotNone(tasks.check_music("```json\n" + json.dumps(music) + "\n```"))
        self.assertIsNone(tasks.check_music(json.dumps(dict(music, bpm=900))))
        sfx = {"layers": [{"wave": "noise", "duration": 0.3}, {"wave": "square", "duration": 0.2, "steps": [440, 880]}]}
        self.assertIsNotNone(tasks.check_sfx(json.dumps(sfx)))
        self.assertIsNone(tasks.check_sfx(json.dumps({"layers": [{"wave": "violin", "duration": 1}]})))
        self.assertEqual(tasks.check_asset({"kind": "sfx"}, json.dumps(sfx)), json.dumps(sfx, separators=(",", ":")))


class Data(unittest.TestCase):
    def setUp(self):
        self.spec = data.load_spec()

    def test_spec_matches_the_app(self):
        kinds = {r["kind"] for r in self.spec["requests"]}
        self.assertEqual(kinds, {"game", "svg", "mesh", "music", "sfx", "text"})
        g = next(r for r in self.spec["requests"] if r["kind"] == "game")
        self.assertIn("any genre, mechanic, setting or mix of them", g["system"])
        self.assertTrue(g["user"].startswith("Game idea: "))

    def test_split_keeps_ideas_out_of_training(self):
        train, held = data.split(self.spec)
        self.assertGreaterEqual(len(held), 8)
        self.assertFalse({r["idea"] for r in held} & {r["idea"] for r in train})
        self.assertFalse(set(self.spec["examples"].values()) & {r["idea"] for r in held})

    def test_seed_rows(self):
        rows = data.seed_rows(self.spec)
        self.assertEqual(sum(r["kind"] == "game" for r in rows), 6)
        self.assertEqual(sum(r["kind"] == "mesh" for r in rows), 4)
        for r in rows:
            self.assertEqual([m["role"] for m in r["messages"]], ["system", "user", "assistant"])
        self.assertTrue(rows[0]["messages"][2]["content"].startswith("```html\n<!doctype html>"))

    def test_fix_request_is_the_apps(self):
        m = tasks.fix_request(self.spec, "<html>X</html>", ["ReferenceError: foo"])
        self.assertIn("You are now fixing bugs", m[0]["content"])
        self.assertEqual(m[1]["content"], "These errors were captured while running the game:\nReferenceError: foo\n\nThe game:\n```html\n<html>X</html>\n```")

    def test_build_and_own_rows(self):
        with tempfile.TemporaryDirectory() as d:
            own = Path(d) / "own.jsonl"
            own.write_text(json.dumps({"messages": [{"role": "system", "content": "s"}, {"role": "user", "content": "u"}, {"role": "assistant", "content": "a"}]}) + "\n")
            summary = data.build(own=str(own), data_dir=d)
            self.assertEqual(summary["seed_rows"], 11)
            self.assertEqual(len(data.training_rows(d)), 11)
            (Path(d) / "selfplay-1.jsonl").write_text(json.dumps({"messages": [], "kind": "game"}) + "\n")
            self.assertEqual(len(data.training_rows(d)), 12)


class Server(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from http.server import ThreadingHTTPServer
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(DummyBackend()))
        cls.base = "http://127.0.0.1:%d" % cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def post(self, body):
        req = urllib.request.Request(self.base + "/v1/chat/completions", data=json.dumps(body).encode(), headers={"content-type": "application/json"})
        return urllib.request.urlopen(req, timeout=10)

    def test_models(self):
        r = urllib.request.urlopen(self.base + "/v1/models", timeout=10)
        self.assertEqual(r.headers["Access-Control-Allow-Origin"], "*")
        self.assertEqual(json.loads(r.read())["data"][0]["id"], "nexora-egen")

    def test_preflight(self):
        r = urllib.request.urlopen(urllib.request.Request(self.base + "/v1/chat/completions", method="OPTIONS"), timeout=10)
        self.assertEqual(r.status, 204)
        self.assertIn("content-type", r.headers["Access-Control-Allow-Headers"])

    def test_chat_and_stream(self):
        game = [{"role": "system", "content": "You are Nexora, an AI game studio."}, {"role": "user", "content": "Game idea: x"}]
        full = json.loads(self.post({"model": "nexora-egen", "messages": game}).read())["choices"][0]["message"]["content"]
        self.assertIsNotNone(tasks.extract_html(full))
        text = ""
        for line in self.post({"model": "nexora-egen", "messages": game, "stream": True}).read().decode().split("\n\n"):
            if line.startswith("data: ") and line[6:] != "[DONE]":
                text += json.loads(line[6:])["choices"][0]["delta"].get("content", "")
        self.assertEqual(text, full)
        svg = json.loads(self.post({"messages": [{"role": "system", "content": "You are Nexora Image 1.5"}, {"role": "user", "content": "x"}]}).read())
        self.assertIsNotNone(tasks.check_svg(svg["choices"][0]["message"]["content"]))

    def test_bad_request(self):
        with self.assertRaises(urllib.error.HTTPError) as e:
            self.post({"nope": 1})
        self.assertEqual(e.exception.code, 400)


class Cli(unittest.TestCase):
    def test_help_without_pytorch(self):
        from nexora_model.__main__ import main
        with self.assertRaises(SystemExit) as e:
            main(["--help"])
        self.assertEqual(e.exception.code, 0)


if __name__ == "__main__":
    unittest.main()
