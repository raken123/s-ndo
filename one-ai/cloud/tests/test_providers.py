"""The real provider path, against a stand-in model API (GEMINI_BASE_URL)."""

import base64
import json
import os
import tempfile
import threading
import unittest
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from onecloud import server

SEEN = []
PNG = base64.b64encode(b"\x89PNG\r\n\x1a\nfake").decode()


def answer(path, body):
    """What the stand-in model API answers."""
    if path.endswith(":predictLongRunning"):
        return {"name": "operations/v1", "done": False}
    if path.endswith("/operations/v1"):
        return {"name": "operations/v1", "done": True, "response": {"generateVideoResponse": {
            "generatedSamples": [{"video": {"bytesBase64Encoded": base64.b64encode(b"MP4DATA").decode()}}]}}}
    if path.endswith("/interactions"):
        return {"steps": [{"model_output": [{"content": [{"type": "text", "text": "Vers 1"},
                                                          {"type": "audio", "mime_type": "audio/mpeg",
                                                           "data": base64.b64encode(b"ID3song").decode()}]}]}]}
    if (body.get("generationConfig") or {}).get("responseModalities"):
        return {"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "image/png", "data": PNG}}]}}]}
    system = ((body.get("systemInstruction") or {}).get("parts") or [{}])[0].get("text", "")
    last = body["contents"][-1]["parts"]
    if "You route requests" in system:
        text = body["contents"][-1]["parts"][0]["text"]
        tasks = [{"agent": "presegent", "task": "Presentation om hav"}] if "presentation" in text else []
        return {"candidates": [{"content": {"parts": [{"text": json.dumps({"tasks": tasks})}]}}]}
    if "Presegent" in system:
        deck = {"title": "Hav", "slides": [{"title": "Hav"}, {"title": "Fakta", "bullets": ["Salt", "Djupt"]}]}
        return {"candidates": [{"content": {"parts": [{"text": "```json\n%s\n```" % json.dumps(deck)}]}}]}
    if "Appagent" in system:
        draft = "reviewing a draft" in system
        html = "<!doctype html><html><head><title>%s</title></head><body></body></html>" % ("Fixad" if draft else "Utkast")
        return {"candidates": [{"content": {"parts": [{"text": "<<<FILE name=\"index.html\">>>\n%s\n<<<END>>>" % html}]}}]}
    if body.get("tools") and not any("functionResponse" in p for p in last):
        return {"candidates": [{"content": {"parts": [
            {"functionCall": {"name": body["tools"][0]["functionDeclarations"][0]["name"], "args": {"text": "x"}},
             "thoughtSignature": "sig1"}]}}]}
    if any("functionResponse" in p for p in last):
        prev = body["contents"][-2]["parts"][0]
        return {"candidates": [{"content": {"parts": [{"text": "Svar med signatur %s" % prev.get("thoughtSignature")}]}}]}
    return {"candidates": [{"content": {"parts": [{"text": "Hej från modellen", "thought": False}]}}]}


class FakeApi(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _reply(self, body):
        SEEN.append((self.path, body, self.headers.get("x-goog-api-key")))
        out = json.dumps(answer(self.path.split("?")[0], body)).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def do_POST(self):
        self._reply(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))

    def do_GET(self):
        self._reply({})


class ProviderPathTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["ONEAI_FAKE_MODELS"] = "0"
        os.environ["ONEAI_QUIET"] = "1"
        cls.api = ThreadingHTTPServer(("127.0.0.1", 0), FakeApi)
        threading.Thread(target=cls.api.serve_forever, daemon=True).start()
        os.environ["GEMINI_BASE_URL"] = "http://127.0.0.1:%d/v1beta" % cls.api.server_address[1]
        os.environ["GEMINI_API_KEY"] = "test-key"
        cls.tmp = tempfile.TemporaryDirectory()
        cls.srv = server.serve_in_thread(host="127.0.0.1", port=0, db_path=os.path.join(cls.tmp.name, "p.sqlite3"))
        cls.base = "http://127.0.0.1:%d" % cls.srv.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.api.shutdown()
        cls.tmp.cleanup()
        for k in ("GEMINI_BASE_URL", "GEMINI_API_KEY"):
            os.environ.pop(k, None)
        os.environ["ONEAI_FAKE_MODELS"] = "1"

    def post(self, path, body, token=None):
        req = urllib.request.Request(self.base + path, data=json.dumps(body).encode(), method="POST",
                                     headers=dict({"Content-Type": "application/json"},
                                                  **({"Authorization": "Bearer " + token} if token else {})))
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())

    def account(self, plan):
        t = self.post("/v1/accounts", {})["token"]
        self.post("/v1/subscribe", {"plan": plan}, t)
        return t

    def chat(self, t, text, **kw):
        return self.post("/v1/chat", dict({"messages": [{"role": "user", "text": text}]}, **kw), t)

    def test_chat_routes_and_names_models(self):
        SEEN.clear()
        out = self.chat(self.account("lite"), "Hej")
        self.assertEqual(out["reply"], "Hej från modellen")
        paths = [p for p, _, _ in SEEN]
        self.assertTrue(paths[0].endswith("/models/gemini-3.1-flash-lite:generateContent"))  # router
        self.assertTrue(paths[1].endswith("/models/gemini-3.5-flash:generateContent"))       # One 1 Standard
        self.assertEqual(SEEN[1][2], "test-key")
        self.assertIn("One 1 Standard", SEEN[1][1]["systemInstruction"]["parts"][0]["text"])

    def test_router_to_presegent(self):
        out = self.chat(self.account("plus"), "Gör en presentation om havet", model="one-1-max")
        self.assertEqual(sorted(f["name"] for f in out["files"]), ["hav.html", "hav.pptx"])

    def test_ultra_reviews_its_work(self):
        out = self.chat(self.account("enterprise"), "En app", model="one-1-ultra", agent="appagent")
        self.assertEqual(out["files"][0]["name"], "fixad.html")

    def test_media_agents(self):
        t = self.account("plus")
        SEEN.clear()
        out = self.chat(t, "En katt", agent="imagent")
        self.assertEqual(base64.b64decode(out["files"][0]["data"]), base64.b64decode(PNG))
        self.assertIn("/models/gemini-3-pro-image:generateContent", SEEN[0][0])
        out = self.chat(t, "En vertikal video om hav", agent="vidagent")
        self.assertEqual(base64.b64decode(out["files"][0]["data"]), b"MP4DATA")
        self.assertEqual(next(b for p, b, _ in SEEN if "predictLongRunning" in p)["parameters"]["aspectRatio"], "9:16")
        out = self.chat(t, "En sommarlåt", agent="musigent")
        self.assertEqual(out["files"][0]["mime"], "audio/mpeg")
        go = self.account("go")
        SEEN.clear()
        self.chat(go, "En hund", agent="imagent")
        self.assertIn("/models/gemini-3.1-flash-lite-image:generateContent", SEEN[0][0])

    def test_tool_loop_keeps_thought_signatures(self):
        from onecloud import agents
        job = agents.Job("lite", "one-1-mini", [{"role": "user", "text": "kör"}])

        class Tools:
            def declarations(self):
                return [{"name": "srv__echo", "description": "", "parametersJsonSchema": {"type": "object"}}]

            def call(self, name, args):
                return {"result": "ok"}, "srv · echo"
        job.mcp_tools = Tools()
        text, files, calls = agents.chat(job)
        self.assertEqual((text, calls), ("Svar med signatur sig1", ["srv · echo"]))


if __name__ == "__main__":
    unittest.main()
