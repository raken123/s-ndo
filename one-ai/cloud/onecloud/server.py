"""One AI Cloud: the HTTP API the apps talk to, an MCP server, and the web app.

    GET  /v1/health
    GET  /v1/config                       models, agents and plans
    POST /v1/accounts                     new anonymous account -> {"account", "token"}
    GET  /v1/me                           plan, units left, receipts
    POST /v1/subscribe {"plan"}           demo checkout: no payment is taken
    POST /v1/cancel
    POST /v1/chat {"model", "agent", "messages", "contextFiles"?}
         messages: [{"role": "user"|"assistant", "text", "attachments"?: [{"name", "mime", "data" (base64)}]}]
         agent: "auto" or an agent id
    GET  /v1/mcp/servers                  the account's MCP connections
    POST /v1/mcp/servers {"name", "url", "token"?}
    POST /v1/mcp/servers/update {"id", "enabled"}
    POST /v1/mcp/servers/delete {"id"}
    POST /mcp                             One AI as an MCP server (Streamable HTTP, JSON responses)
    POST /v1/admin/plan {"account", "plan"}   needs X-Admin-Key
    GET  /                                the web app (ONEAI_WEB_DIR)

Authenticated calls send "Authorization: Bearer <token>".
"""

import base64
import json
import mimetypes
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import agents, config, mcp, providers
from .store import Store

MAX_BODY = 30 * 1024 * 1024
MAX_TEXT = 20_000
MAX_MESSAGES = 60
MAX_ATTACH = 16 * 1024 * 1024   # base64, all attachments of a message
MAX_CONTEXT = 400 * 1024
WEB_DIR = os.environ.get("ONEAI_WEB_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "web")


class ApiError(Exception):
    def __init__(self, status, message, code=None):
        super().__init__(message)
        self.status, self.message, self.code = status, message, code


def plan_name(pid):
    return config.PLANS[pid]["name"] if pid else "One Enterprise"


def respond(store, acc, body, log=lambda *a: None):
    """One chat turn: routing, agents, reply. Shared by /v1/chat and MCP."""
    model_id = body.get("model") or config.DEFAULT_MODEL
    m = config.model(model_id)
    plan = config.PLANS[acc["plan"]]
    if not m:
        raise ApiError(400, "Okänd modell.")
    if model_id not in plan["models"]:
        need = config.cheapest_plan("models", model_id)
        raise ApiError(402, "%s ingår i %s." % (m["name"], plan_name(need)), "plan")
    agent_choice = body.get("agent") or "auto"
    if agent_choice != "auto":
        a = config.agent(agent_choice)
        if not a:
            raise ApiError(400, "Okänd agent.")
        if agent_choice not in plan["agents"]:
            raise ApiError(402, "%s ingår i %s och uppåt." % (a["name"], plan_name(config.cheapest_plan("agents", agent_choice))), "plan")

    messages = body.get("messages")
    if not isinstance(messages, list) or not messages or not isinstance(messages[-1], dict) or messages[-1].get("role") != "user":
        raise ApiError(400, "Skicka konversationen med ditt meddelande sist.")
    clean = []
    for msg in messages[-MAX_MESSAGES:]:
        if not isinstance(msg, dict):
            continue
        text = str(msg.get("text") or "")
        if len(text) > MAX_TEXT:
            raise ApiError(400, "Meddelanden kan vara högst %d tecken." % MAX_TEXT)
        clean.append({"role": "user" if msg.get("role") == "user" else "assistant", "text": text})
    atts = messages[-1].get("attachments") or []
    if not isinstance(atts, list) or len(atts) > 8:
        raise ApiError(400, "Högst 8 bilagor per meddelande.")
    atts = [{"name": str(a.get("name") or "fil")[:120], "mime": str(a.get("mime") or "application/octet-stream")[:100],
             "data": str(a.get("data") or "")} for a in atts if isinstance(a, dict)]
    if sum(len(a["data"]) for a in atts) > MAX_ATTACH:
        raise ApiError(413, "Bilagorna är för stora (högst cirka 12 MB).")
    clean[-1]["attachments"] = atts
    if not clean[-1]["text"].strip() and not atts:
        raise ApiError(400, "Skriv något först.")
    ctx = [{"name": str(f.get("name"))[:120], "text": str(f.get("text") or "")}
           for f in (body.get("contextFiles") or [])[:8] if isinstance(f, dict)]
    if sum(len(f["text"]) for f in ctx) > MAX_CONTEXT:
        ctx = []

    st = store.status(acc)
    if st["units"] is not None and st["units"] < m["cost"]:
        raise ApiError(402, "Dagens enheter är slut. De fylls på i morgon, eller uppgradera din plan.", "units")

    servers = [s for s in store.mcp_list(acc["id"], with_tokens=True) if s["enabled"]]
    toolset = None
    job = agents.Job(acc["plan"], model_id, clean, ctx)
    started = time.time()

    tasks = [{"agent": agent_choice, "task": job.prompt or "Se bilagan."}] if agent_choice != "auto" else agents.route(job)
    allowed = [t for t in tasks if t["agent"] in plan["agents"]]
    blocked = [t["agent"] for t in tasks if t["agent"] not in plan["agents"]]
    agent_ids = [t["agent"] for t in allowed]
    refused = store.reserve(acc, model_id, agent_ids)
    if refused:
        raise ApiError(402 if refused[0] == "units" else 429, refused[1], refused[0])

    files, tool_calls, statuses = [], [], []
    try:
        if allowed:
            results = agents.run_agents(job, allowed, log)
            failed = [r["agent"] for r in results if not r["ok"]]
            if failed:
                store.refund(acc["id"], model_id, failed, model_too=len(failed) == len(results))
            if len(failed) == len(results):
                names = ", ".join(config.agent(a)["name"] for a in failed)
                raise ApiError(502, "%s kunde inte göra klart den här gången. Försök igen eller välj en annan modell." % names, "model")
            for r in results:
                files += r["files"]
                statuses.append({"id": r["agent"], "name": config.agent(r["agent"])["name"], "ok": r["ok"]})
            try:
                reply = agents.summarize(job, results)
            except providers.ProviderError as e:
                log("summary failed: %s" % e)
                reply = "Klart! Här är det du bad om."
        else:
            if servers:
                toolset = mcp.Toolset(servers, log)
                job.mcp_tools = toolset
            reply, files, tool_calls = agents.chat(job, log)
            if files:
                statuses.append({"id": "filegent", "name": "Filegent", "ok": True})
    except providers.ProviderError as e:
        store.refund(acc["id"], model_id, agent_ids)
        log("model failed (%s): %s" % (model_id, e))
        raise ApiError(502, "%s kunde inte svara just nu. Försök igen, eller välj en annan modell." % m["name"], "model")
    except ApiError:
        raise
    except Exception:
        store.refund(acc["id"], model_id, agent_ids)
        raise

    upgrade = []
    for a in dict.fromkeys(blocked):
        need = config.cheapest_plan("agents", a)
        upgrade.append({"agent": a, "agentName": config.agent(a)["name"], "plan": need, "planName": plan_name(need)})
    if upgrade:
        reply = (reply + "\n\n" if reply else "") + " ".join(
            "%s ingår i %s och uppåt." % (u["agentName"], u["planName"]) for u in upgrade)
    return {
        "reply": reply, "files": files, "agents": statuses, "tools": tool_calls,
        "mcpErrors": toolset.errors if toolset else [], "upgrade": upgrade,
        "model": model_id, "modelName": m["name"], "units": store.cost(model_id, agent_ids),
        "seconds": round(time.time() - started, 1), "me": store.status(store.account(acc["id"])),
    }


def encode_files(files):
    return [{"name": f["name"], "mime": f["mime"], "size": len(f["data"]), "agent": f["agent"], "preview": f["preview"],
             "data": base64.b64encode(f["data"]).decode()} for f in files]


class Handler(BaseHTTPRequestHandler):
    server_version = "OneAICloud/1.0"
    protocol_version = "HTTP/1.1"
    store = None  # set by make_server

    # --- plumbing ---

    def _send(self, status, payload, extra_headers=None):
        body = b"" if payload is None else json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        if payload is not None:
            self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra_headers or {}).items():
            self.send_header(k, v)
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        # The apps load their UI from file:// (origin "null") or the web, so
        # any origin may call. Accounts are bearer tokens, not cookies.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Expose-Headers", "Mcp-Session-Id")
        self.send_header("Access-Control-Max-Age", "86400")

    def _raw_body(self):
        # Read once and always (see _route): with keep-alive, an unread body
        # would become the start of the next request.
        if getattr(self, "_raw", None) is None:
            n = int(self.headers.get("Content-Length") or 0)
            if n > MAX_BODY:
                self.close_connection = True
                raise ApiError(413, "För stor förfrågan.")
            self._raw = self.rfile.read(n) if n else b""
        return self._raw

    def _body(self):
        raw = self._raw_body()
        if not raw:
            return {}
        try:
            data = json.loads(raw.decode())
        except ValueError:
            raise ApiError(400, "Förfrågan måste vara JSON.")
        if not isinstance(data, dict):
            raise ApiError(400, "Förfrågan måste vara ett JSON-objekt.")
        return data

    def _account(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            raise ApiError(401, "Inloggningsnyckel saknas.")
        acc = self.store.account_by_token(auth[7:].strip())
        if not acc:
            raise ApiError(401, "Okänd inloggningsnyckel.")
        return acc

    def log_message(self, fmt, *args):
        if os.environ.get("ONEAI_QUIET") != "1":
            super().log_message(fmt, *args)

    def _log(self, msg):
        self.log_error("%s", msg)

    def do_OPTIONS(self):
        self._send(204, None)

    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def _route(self, method):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        self._raw = None
        try:
            self._raw_body()
            if path == "/mcp":
                return self.mcp_endpoint(method)
            fn = ROUTES.get((method, path))
            if not fn:
                if method == "GET" and not path.startswith("/v1/"):
                    return self.static(path)
                raise ApiError(404, "Hittades inte.")
            self._send(200, fn(self))
        except ApiError as e:
            self._send(e.status, {"error": e.message, "code": e.code})
        except Exception as e:  # noqa: BLE001 - never leak a stack trace
            self.log_error("internal error: %r", e)
            self._send(500, {"error": "Internt serverfel."})

    def static(self, path):
        root = os.path.realpath(WEB_DIR)
        rel = "index.html" if path == "/" else path.lstrip("/")
        full = os.path.realpath(os.path.join(root, rel))
        if not full.startswith(root + os.sep) or not os.path.isfile(full):
            raise ApiError(404, "Hittades inte.")
        with open(full, "rb") as f:
            data = f.read()
        kind = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if kind.startswith("text/") or kind in ("application/javascript", "application/json", "image/svg+xml"):
            kind += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    # --- endpoints ---

    def health(self):
        return {"ok": True, "fakeModels": providers.fake()}

    def get_config(self):
        return config.public_config()

    def create_account(self):
        acc_id, token = self.store.create_account()
        return {"account": acc_id, "token": token}

    def me(self):
        acc = self._account()
        st = self.store.status(acc)
        st["receipts"] = self.store.receipts(acc["id"])
        return st

    def subscribe(self):
        acc = self._account()
        plan = self._body().get("plan")
        if plan not in config.PLANS:
            raise ApiError(400, "Okänd plan.")
        ref = self.store.subscribe(acc["id"], plan)
        st = self.store.status(self.store.account(acc["id"]))
        st["receipt"] = ref
        return st

    def cancel(self):
        acc = self._account()
        self.store.cancel(acc["id"])
        return self.store.status(self.store.account(acc["id"]))

    def chat(self):
        acc = self._account()
        out = respond(self.store, acc, self._body(), self._log)
        out["files"] = encode_files(out["files"])
        return out

    def mcp_servers(self):
        return {"servers": self.store.mcp_list(self._account()["id"])}

    def mcp_add(self):
        acc = self._account()
        body = self._body()
        url, name, token = str(body.get("url") or "").strip(), str(body.get("name") or "").strip()[:40], body.get("token")
        limit = config.PLANS[acc["plan"]]["mcp"]
        if limit is not None and len(self.store.mcp_list(acc["id"])) >= limit:
            raise ApiError(402, "%s har plats för %d MCP-koppling%s. Uppgradera för fler." % (
                config.PLANS[acc["plan"]]["name"], limit, "" if limit == 1 else "ar"), "plan")
        if len(url) > 500:
            raise ApiError(400, "Adressen är för lång.")
        try:
            info = mcp.probe(url, str(token) if token else None)
        except mcp.McpError as e:
            raise ApiError(400, str(e))
        sid = self.store.mcp_add(acc["id"], name or info["server"][:40], url, str(token)[:2000] if token else None, info["tools"])
        return {"id": sid, "servers": self.store.mcp_list(acc["id"])}

    def mcp_update(self):
        acc = self._account()
        body = self._body()
        if not self.store.mcp_update(acc["id"], str(body.get("id")), bool(body.get("enabled"))):
            raise ApiError(404, "Kopplingen finns inte.")
        return {"servers": self.store.mcp_list(acc["id"])}

    def mcp_delete(self):
        acc = self._account()
        if not self.store.mcp_delete(acc["id"], str(self._body().get("id"))):
            raise ApiError(404, "Kopplingen finns inte.")
        return {"servers": self.store.mcp_list(acc["id"])}

    def admin_plan(self):
        key = os.environ.get("ONEAI_ADMIN_KEY")
        if not key or self.headers.get("X-Admin-Key") != key:
            raise ApiError(403, "Admin-nyckel krävs.")
        body = self._body()
        if body.get("plan") not in config.PLANS or not self.store.account(str(body.get("account", ""))):
            raise ApiError(400, "Ange ett känt konto och en plan.")
        self.store.set_plan(body["account"], body["plan"])
        return self.store.status(self.store.account(body["account"]))

    # --- One AI as an MCP server ---

    def mcp_endpoint(self, method):
        if method != "POST":
            self._send(405, {"error": "Använd POST."}, {"Allow": "POST, OPTIONS"})
            return
        try:
            acc = self._account()
        except ApiError as e:
            self._send(401, {"error": e.message}, {"WWW-Authenticate": 'Bearer realm="One AI"'})
            return
        try:
            msg = json.loads(self._raw_body().decode() or "null")
        except ValueError:
            self._send(400, {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
            return
        batch = isinstance(msg, list)
        replies = [r for r in (self._mcp_one(acc, m) for m in (msg if batch else [msg])) if r is not None]
        if not replies:
            self._send(202, None)
        else:
            self._send(200, replies if batch else replies[0])

    def _mcp_one(self, acc, m):
        if not isinstance(m, dict) or m.get("jsonrpc") != "2.0" or "method" not in m:
            return {"jsonrpc": "2.0", "id": m.get("id") if isinstance(m, dict) else None,
                    "error": {"code": -32600, "message": "Invalid request"}}
        if "id" not in m:
            return None  # a notification
        mid, method, params = m["id"], m["method"], m.get("params") or {}

        def ok(result):
            return {"jsonrpc": "2.0", "id": mid, "result": result}
        if method == "initialize":
            return ok({"protocolVersion": params.get("protocolVersion") or mcp.PROTOCOL,
                       "capabilities": {"tools": {"listChanged": False}},
                       "serverInfo": {"name": "One AI", "version": "1.0.0"},
                       "instructions": "One AI: ask the One models (one_chat) or have One agents make files (one_create)."})
        if method == "ping":
            return ok({})
        if method == "tools/list":
            return ok({"tools": mcp.SERVER_TOOLS})
        if method != "tools/call":
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "Method not found"}}
        name, args = params.get("name"), params.get("arguments") or {}
        try:
            if name == "one_account":
                return ok({"content": [{"type": "text", "text": json.dumps(self.store.status(self.store.account(acc["id"])),
                                                                              ensure_ascii=False)}]})
            if name not in ("one_chat", "one_create"):
                return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32602, "message": "Unknown tool"}}
            body = {"model": args.get("model") or config.DEFAULT_MODEL,
                    "agent": args.get("agent") if name == "one_create" else "auto",
                    "messages": [{"role": "user", "text": str(args.get("prompt") or "")}]}
            out = respond(self.store, self.store.account(acc["id"]), body, self._log)
            return ok({"content": mcp.tool_content(out["reply"], out["files"])})
        except ApiError as e:
            return ok({"content": [{"type": "text", "text": e.message}], "isError": True})


ROUTES = {
    ("GET", "/v1/health"): Handler.health,
    ("GET", "/v1/config"): Handler.get_config,
    ("POST", "/v1/accounts"): Handler.create_account,
    ("GET", "/v1/me"): Handler.me,
    ("POST", "/v1/subscribe"): Handler.subscribe,
    ("POST", "/v1/cancel"): Handler.cancel,
    ("POST", "/v1/chat"): Handler.chat,
    ("GET", "/v1/mcp/servers"): Handler.mcp_servers,
    ("POST", "/v1/mcp/servers"): Handler.mcp_add,
    ("POST", "/v1/mcp/servers/update"): Handler.mcp_update,
    ("POST", "/v1/mcp/servers/delete"): Handler.mcp_delete,
    ("POST", "/v1/admin/plan"): Handler.admin_plan,
}


def make_server(host="0.0.0.0", port=8788, db_path=None):
    store = Store(db_path or os.environ.get("ONEAI_DB", "oneai.sqlite3"))
    handler = type("BoundHandler", (Handler,), {"store": store})
    srv = ThreadingHTTPServer((host, port), handler)
    srv.daemon_threads = True
    return srv


def serve_in_thread(**kw):
    srv = make_server(**kw)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv
