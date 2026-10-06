"""End-to-end tests of One AI Cloud with fake models: python -m unittest discover -s tests"""

import base64
import io
import json
import os
import re
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import wave
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

os.environ["ONEAI_FAKE_MODELS"] = "1"
os.environ["ONEAI_QUIET"] = "1"
os.environ["ONEAI_ADMIN_KEY"] = "test-admin"

from onecloud import config, server  # noqa: E402

PROVIDER = re.compile(r"gemini|\bveo\b|lyria|google|\bimagen\b", re.I)


class FakeMcp(BaseHTTPRequestHandler):
    """A tiny MCP server with one 'echo' tool, answering as an SSE stream."""

    def log_message(self, *a):
        pass

    def do_POST(self):
        msg = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if "id" not in msg:
            self.send_response(202)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if msg["method"] == "initialize":
            result = {"protocolVersion": "2025-06-18", "capabilities": {"tools": {}}, "serverInfo": {"name": "Echo"}}
        elif msg["method"] == "tools/list":
            assert self.headers.get("Mcp-Session-Id") == "s1"
            result = {"tools": [{"name": "echo", "description": "Echoes text",
                                 "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}},
                                                 "additionalProperties": False}}]}
        else:
            result = {"content": [{"type": "text", "text": "ECHO:" + msg["params"]["arguments"].get("text", "")}]}
        body = ("event: message\ndata: %s\n\n" % json.dumps({"jsonrpc": "2.0", "id": msg["id"], "result": result})).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Mcp-Session-Id", "s1")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class OneCloudTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.srv = server.serve_in_thread(host="127.0.0.1", port=0, db_path=os.path.join(cls.tmp.name, "t.sqlite3"))
        cls.base = "http://127.0.0.1:%d" % cls.srv.server_address[1]
        cls.mcp = ThreadingHTTPServer(("127.0.0.1", 0), FakeMcp)
        threading.Thread(target=cls.mcp.serve_forever, daemon=True).start()
        cls.mcp_url = "http://127.0.0.1:%d/mcp" % cls.mcp.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.mcp.shutdown()
        cls.tmp.cleanup()

    def call(self, method, path, body=None, token=None, headers=None, raw=False):
        h = dict(headers or {})
        if body is not None:
            h["Content-Type"] = "application/json"
        if token:
            h["Authorization"] = "Bearer " + token
        req = urllib.request.Request(self.base + path, data=json.dumps(body).encode() if body is not None else None,
                                     method=method, headers=h)
        try:
            with urllib.request.urlopen(req) as r:
                data = r.read()
                return r.status, (data if raw else (json.loads(data) if data else None))
        except urllib.error.HTTPError as e:
            data = e.read()
            return e.code, (data if raw else (json.loads(data) if data else None))

    def account(self, plan=None):
        _, acc = self.call("POST", "/v1/accounts")
        if plan:
            st, _ = self.call("POST", "/v1/subscribe", {"plan": plan}, acc["token"])
            self.assertEqual(st, 200)
        return acc["token"]

    def chat(self, token, text, model="one-1-standard", agent="auto", **extra):
        return self.call("POST", "/v1/chat", dict({"model": model, "agent": agent,
                                                   "messages": [{"role": "user", "text": text}]}, **extra), token)

    def files(self, out):
        return {f["name"]: base64.b64decode(f["data"]) for f in out["files"]}

    # --- catalog and plans ---

    def test_config_has_no_provider_details(self):
        st, cfg = self.call("GET", "/v1/config")
        self.assertEqual(st, 200)
        self.assertEqual([m["name"] for m in cfg["models"]][:6],
                         ["One 1 Mini", "One 1 Standard", "One 1 Plus", "One 1 Max", "One 1 Max Fast", "One 1 Ultra"])
        self.assertEqual([p["price"] for p in cfg["plans"]], [0, 60, 129, 1299, 4999, 13499])
        self.assertIsNone(PROVIDER.search(json.dumps(cfg)))

    def test_plan_contents(self):
        P = config.PLANS
        self.assertEqual(P["lite"]["agents"], ["filegent"])
        self.assertEqual(P["go"]["models"], P["lite"]["models"])
        self.assertIn("imagent", P["go"]["weak"])
        for a in ("vidagent", "appagent", "imagent", "presegent", "formegent", "sitegent", "inboxagent"):
            self.assertIn(a, P["plus"]["agents"])
        self.assertEqual(P["pro"]["units"], P["plus"]["units"] * 500)
        for pid in ("lite", "go", "plus", "pro"):
            self.assertNotIn("one-1-ultra", P[pid]["models"])
        self.assertEqual(set(P["enterprise_lite"]["models"]) - set(P["pro"]["models"]), {"one-1-ultra", "one-2-standard"})
        self.assertIsNone(P["enterprise"]["units"])
        self.assertTrue(all(m in P["enterprise"]["models"] for m in config.ONE_2))

    def test_lite_chat_and_limits(self):
        t = self.account()
        st, out = self.chat(t, "Hej, vad kan du göra?")
        self.assertEqual(st, 200, out)
        self.assertIn("Svar på", out["reply"])
        self.assertEqual(out["files"], [])
        self.assertEqual(out["me"]["usedToday"], 1)
        st, out = self.chat(t, "hej", model="one-1-max")
        self.assertEqual((st, out["code"]), (402, "plan"))
        self.assertIn("One Plus", out["error"])
        st, out = self.chat(t, "hej", model="one-1-ultra")
        self.assertIn("Enterprise", out["error"])
        st, out = self.chat(t, "en katt", agent="imagent")
        self.assertEqual(st, 402)
        self.assertIn("One Go", out["error"])

    def test_auto_routing_respects_plan(self):
        t = self.account()
        st, out = self.chat(t, "Gör en bild på en katt")
        self.assertEqual(st, 200)
        self.assertEqual(out["files"], [])
        self.assertEqual(out["upgrade"][0]["plan"], "go")
        self.assertIn("Imagent ingår i One Go", out["reply"])

    def test_units_run_out(self):
        t = self.account()
        for _ in range(25):
            self.assertEqual(self.chat(t, "hej", model="one-1-plus")[0], 200)  # 2 units each
        st, out = self.chat(t, "hej")
        self.assertEqual((st, out["code"]), (402, "units"))

    def test_go_weak_imagent_daily_limit(self):
        t = self.account("go")
        for _ in range(3):
            st, out = self.chat(t, "en katt i rymden", agent="imagent")
            self.assertEqual(st, 200, out)
            self.assertTrue(out["files"][0]["name"].endswith(".png"))
            self.assertEqual(out["files"][0]["preview"], "image")
        st, out = self.chat(t, "en till", agent="imagent")
        self.assertEqual((st, out["code"]), (429, "limit"))

    # --- agents ---

    def test_filegent_documents(self):
        t = self.account()
        for name, magic in (("rapport.pdf", b"%PDF"), ("brev.docx", b"PK"), ("budget.xlsx", b"PK"),
                            ("deck.pptx", b"PK"), ("main.py", b"# main.py")):
            st, out = self.chat(t, "Skapa filen %s" % name)
            self.assertEqual(st, 200, out)
            data = self.files(out)[name]
            self.assertTrue(data.startswith(magic), name)
            if magic == b"PK":
                zipfile.ZipFile(io.BytesIO(data)).testzip()

    def test_plus_agents_make_real_files(self):
        t = self.account("plus")
        cases = {
            "appagent": lambda f: any(n.endswith("-webbapp.zip") for n in f) and any(n.endswith(".html") for n in f),
            "presegent": lambda f: any(n.endswith(".pptx") for n in f) and any(n.endswith(".html") for n in f),
            "formegent": lambda f: any(n.endswith(".html") for n in f),
            "sitegent": lambda f: "index.html" in f and any(n.endswith(".zip") for n in f),
            "inboxagent": lambda f: any(n.endswith(".eml") and b"X-Unsent: 1" in d for n, d in f.items()),
            "musigent": lambda f: any(n.endswith(".wav") and d[:4] == b"RIFF" for n, d in f.items())
            and any(d[:4] == b"MThd" for d in f.values()),
            "modelgent": lambda f: any(n.endswith(".glb") and d[:4] == b"glTF" for n, d in f.items()),
            "designgent": lambda f: any(n.endswith(".svg") for n in f),
            "imagent": lambda f: any(n.endswith(".png") for n in f),
            "vidagent": lambda f: any(n.endswith(".mp4") for n in f),
        }
        for agent, check in cases.items():
            st, out = self.chat(t, "Skapa något fint: en logga, ett formulär, index.html", agent=agent)
            self.assertEqual(st, 200, (agent, out))
            self.assertTrue(check(self.files(out)), (agent, [f["name"] for f in out["files"]]))
            self.assertEqual(out["agents"][0]["id"], agent)
        wav = next(d for n, d in self.files(self.chat(t, "en låt", agent="musigent")[1]).items() if n.endswith(".wav"))
        self.assertGreater(wave.open(io.BytesIO(wav)).getnframes(), 22050)

    def test_auto_multi_agent(self):
        t = self.account("plus")
        st, out = self.chat(t, "Gör en presentation om rymden")
        self.assertEqual(st, 200)
        self.assertEqual(out["agents"][0]["id"], "presegent")
        self.assertIn("Klart", out["reply"])

    def test_enterprise_models(self):
        t = self.account("enterprise")
        for m in config.ONE_1 + config.ONE_2:
            st, out = self.chat(t, "hej", model=m)
            self.assertEqual(st, 200, (m, out))
            self.assertIn(config.model(m)["name"], [out["modelName"]])
        st, me = self.call("GET", "/v1/me", token=t)
        self.assertIsNone(me["units"])
        st, out = self.chat(t, "Skapa filen app.html", model="one-2-ultra", agent="appagent")
        self.assertEqual(st, 200, out)
        t2 = self.account("enterprise_lite")
        self.assertEqual(self.chat(t2, "hej", model="one-1-ultra")[0], 200)
        self.assertEqual(self.chat(t2, "hej", model="one-2-standard")[0], 200)
        self.assertEqual(self.chat(t2, "hej", model="one-2-max")[0], 402)

    def test_attachments_and_context(self):
        t = self.account()
        att = {"name": "a.txt", "mime": "text/plain", "data": base64.b64encode("hemlig text".encode()).decode()}
        st, out = self.call("POST", "/v1/chat", {"model": "one-1-mini", "messages": [
            {"role": "user", "text": "hej"}, {"role": "assistant", "text": "hej!"},
            {"role": "user", "text": "läs filen", "attachments": [att]}],
            "contextFiles": [{"name": "x.md", "text": "# x"}]}, t)
        self.assertEqual(st, 200, out)
        st, out = self.call("POST", "/v1/chat", {"messages": [{"role": "assistant", "text": "x"}]}, t)
        self.assertEqual(st, 400)

    def test_errors_never_name_the_provider(self):
        t = self.account()
        os.environ["ONEAI_FAKE_MODELS"] = "0"
        old = os.environ.pop("GEMINI_API_KEY", None)
        try:
            st, out = self.chat(t, "hej")
        finally:
            os.environ["ONEAI_FAKE_MODELS"] = "1"
            if old:
                os.environ["GEMINI_API_KEY"] = old
        self.assertEqual(st, 502)
        self.assertIsNone(PROVIDER.search(out["error"]))
        st, me = self.call("GET", "/v1/me", token=t)
        self.assertEqual(me["usedToday"], 0)  # refunded

    # --- billing ---

    def test_subscribe_cancel_receipts(self):
        t = self.account()
        st, out = self.call("POST", "/v1/subscribe", {"plan": "pro"}, t)
        self.assertEqual((out["plan"], out["receipt"][:5]), ("pro", "DEMO-"))
        st, out = self.call("POST", "/v1/cancel", {}, t)
        self.assertTrue(out["cancelled"])
        st, me = self.call("GET", "/v1/me", token=t)
        self.assertEqual(me["receipts"][0]["amount"], 1299)
        self.assertEqual(self.call("POST", "/v1/subscribe", {"plan": "gratis"}, t)[0], 400)
        self.assertEqual(self.call("GET", "/v1/me")[0], 401)

    def test_admin_plan(self):
        _, acc = self.call("POST", "/v1/accounts")
        st, _ = self.call("POST", "/v1/admin/plan", {"account": acc["account"], "plan": "enterprise"})
        self.assertEqual(st, 403)
        st, out = self.call("POST", "/v1/admin/plan", {"account": acc["account"], "plan": "enterprise"},
                            headers={"X-Admin-Key": "test-admin"})
        self.assertEqual(out["plan"], "enterprise")

    # --- MCP ---

    def test_mcp_client(self):
        t = self.account()
        os.environ.pop("ONEAI_MCP_ALLOW_PRIVATE", None)
        st, out = self.call("POST", "/v1/mcp/servers", {"url": self.mcp_url}, t)
        self.assertEqual(st, 400)  # private addresses are refused by default
        os.environ["ONEAI_MCP_ALLOW_PRIVATE"] = "1"
        try:
            st, out = self.call("POST", "/v1/mcp/servers", {"name": "Echo", "url": self.mcp_url}, t)
            self.assertEqual(st, 200, out)
            self.assertEqual(out["servers"][0]["tools"], ["echo"])
            st, out = self.call("POST", "/v1/mcp/servers", {"name": "Två", "url": self.mcp_url}, t)
            self.assertEqual((st, out["code"]), (402, "plan"))  # Lite has 1 connection
            st, out = self.chat(t, "använd verktyget #tool")
            self.assertEqual(st, 200, out)
            self.assertIn("ECHO:hej", out["reply"])
            self.assertEqual(out["tools"], ["Echo · echo"])
            sid = self.call("GET", "/v1/mcp/servers", token=t)[1]["servers"][0]["id"]
            st, out = self.call("POST", "/v1/mcp/servers/update", {"id": sid, "enabled": False}, t)
            self.assertFalse(out["servers"][0]["enabled"])
            st, out = self.chat(t, "använd verktyget #tool")
            self.assertEqual(out["tools"], [])
            st, out = self.call("POST", "/v1/mcp/servers/delete", {"id": sid}, t)
            self.assertEqual(out["servers"], [])
        finally:
            os.environ.pop("ONEAI_MCP_ALLOW_PRIVATE", None)

    def test_mcp_server(self):
        t = self.account("plus")
        rpc = lambda m, p=None, i=1: self.call("POST", "/mcp", {"jsonrpc": "2.0", "id": i, "method": m, "params": p or {}}, t)  # noqa: E731
        st, out = rpc("initialize", {"protocolVersion": "2025-06-18"})
        self.assertEqual(out["result"]["serverInfo"]["name"], "One AI")
        st, _ = self.call("POST", "/mcp", {"jsonrpc": "2.0", "method": "notifications/initialized"}, t)
        self.assertEqual(st, 202)
        st, out = rpc("tools/list")
        self.assertEqual([x["name"] for x in out["result"]["tools"]], ["one_chat", "one_create", "one_account"])
        st, out = rpc("tools/call", {"name": "one_create", "arguments": {"agent": "modelgent", "prompt": "en raket"}})
        content = out["result"]["content"]
        self.assertEqual(content[1]["resource"]["mimeType"], "model/gltf-binary")
        st, out = rpc("tools/call", {"name": "one_chat", "arguments": {"prompt": "hej", "model": "one-1-ultra"}})
        self.assertTrue(out["result"]["isError"])
        self.assertEqual(self.call("POST", "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "ping"})[0], 401)

    # --- web app ---

    def test_static_web_app(self):
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "index.html"), "w") as f:
                f.write("<!doctype html><title>One AI</title>")
            old, server.WEB_DIR = server.WEB_DIR, d
            try:
                st, body = self.call("GET", "/", raw=True)
                self.assertEqual((st, body[:15]), (200, b"<!doctype html>"))
                self.assertEqual(self.call("GET", "/../../etc/passwd", raw=True)[0], 404)
                self.assertEqual(self.call("GET", "/nope.js", raw=True)[0], 404)
            finally:
                server.WEB_DIR = old


if __name__ == "__main__":
    unittest.main()
