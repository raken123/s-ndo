"""Tests for the training pipeline: the datasets, and finetune.py against a
local stand-in for OpenAI's files and fine-tuning endpoints."""

import json
import os
import re
import shutil
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", "training"))

import build_dataset  # noqa: E402
import finetune  # noqa: E402
from hubcloud import agents, config  # noqa: E402

CALLS = []


class FakeOpenAI(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, obj):
        data = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        raw = self.rfile.read(int(self.headers["Content-Length"]))
        CALLS.append(("POST", self.path, self.headers.get("Content-Type"), raw))
        if self.path == "/v1/files":
            self._json({"id": "file-%d" % len(CALLS)})
        else:
            body = json.loads(raw)
            if body["model"] == "gpt-4.5-preview":
                self.send_response(400)
                msg = json.dumps({"error": {"message": "Model gpt-4.5-preview is not available for fine-tuning"}}).encode()
                self.send_header("Content-Length", str(len(msg)))
                self.end_headers()
                self.wfile.write(msg)
                return
            self._json({"id": "ftjob-" + body["suffix"], "status": "queued"})

    def do_GET(self):
        CALLS.append(("GET", self.path, None, b""))
        tier = self.path.rsplit("-", 1)[-1]
        self._json({"status": "succeeded", "fine_tuned_model": "ft:base:hub:%s" % tier})


class TrainingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        build_dataset.main(["--tier", "mini", "--tier", "lite", "--tier", "v2max"])
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), FakeOpenAI)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.tmp = tempfile.mkdtemp()
        cls.saved = {k: os.environ.get(k) for k in ("OPENAI_BASE_URL", "OPENAI_API_KEY")}
        os.environ["OPENAI_BASE_URL"] = "http://127.0.0.1:%d/v1" % cls.srv.server_address[1]
        os.environ["OPENAI_API_KEY"] = "sk-test"
        cls.agents_file = config.AGENTS_FILE
        config.AGENTS_FILE = os.path.join(cls.tmp, "agents.json")

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()
        config.AGENTS_FILE = cls.agents_file
        shutil.rmtree(cls.tmp)
        for k, v in cls.saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_dataset_rows(self):
        with open(os.path.join(build_dataset.OUT, "mini.train.jsonl"), encoding="utf-8") as f:
            rows = [json.loads(l) for l in f]
        self.assertEqual(len(rows), 48)
        types = set()
        for r in rows:
            sys_msg, user, answer = r["messages"]
            self.assertEqual(sys_msg["content"], agents.system_prompt("mini"))
            self.assertTrue(user["content"])
            self.assertTrue(answer["content"].startswith("<!doctype html>"))
            self.assertIn("Made with Hub AI · Hub V1 Mini", answer["content"])
            types.add(re.search(r"<title>([^<]*)</title>", answer["content"]).group(1))
        self.assertGreater(len(types), 15, "examples should cover most hub types")

    def test_finetune_records_models(self):
        CALLS.clear()
        code = finetune.main(["--tier", "mini", "--tier", "lite", "--tier", "v2max", "--poll", "0"])
        self.assertEqual(code, 1, "lite's base model is refused, so the run reports a failure")
        jobs = [json.loads(c[3]) for c in CALLS if c[1] == "/v1/fine_tuning/jobs"]
        self.assertEqual([j["model"] for j in jobs], ["gpt-4o-2024-08-06", "gpt-4.5-preview", "gpt-6-astra"])
        upload = next(c for c in CALLS if c[1] == "/v1/files")
        self.assertIn("multipart/form-data", upload[2])
        self.assertIn(b'name="purpose"\r\n\r\nfine-tune', upload[3])
        with open(config.AGENTS_FILE, encoding="utf-8") as f:
            rec = json.load(f)
        self.assertEqual(rec["mini"]["models"], ["ft:base:hub:mini"])
        self.assertNotIn("lite", rec)
        # V2 Max: the builder is fine-tuned, the reviewer stays GPT-6 Sol.
        self.assertEqual(rec["v2max"]["models"], ["ft:base:hub:v2max", "gpt-6-sol"])
        self.assertEqual(config.models_for("mini"), ["ft:base:hub:mini"])
        self.assertEqual(config.training_status("mini")["state"], "fine-tuned")
        self.assertEqual(config.training_status("lite")["state"], "prompted")


if __name__ == "__main__":
    unittest.main()
