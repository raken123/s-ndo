"""Hub AI Cloud: the HTTP API the apps talk to.

    GET  /v1/health
    GET  /v1/config                 agents, engines and plans
    POST /v1/accounts               new anonymous account -> {"token"}
    GET  /v1/me                     plan, credits, daily caps, receipts
    POST /v1/subscribe {"plan"}     demo checkout: no payment is taken
    POST /v1/cancel
    POST /v1/generate {"engine", "prompt"}
    POST /v1/admin/plan {"account", "plan"}   needs X-Admin-Key

Authenticated calls send "Authorization: Bearer <token>".
"""

import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import agents, config, providers
from .store import Store

MAX_PROMPT = 4000
MAX_BODY = 64 * 1024


class ApiError(Exception):
    def __init__(self, status, message, code=None):
        super().__init__(message)
        self.status, self.message, self.code = status, message, code


class Handler(BaseHTTPRequestHandler):
    server_version = "HubAICloud/1.0"
    store = None  # set by make_server

    # --- plumbing ---

    def _send(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        # The apps load their UI from file:// (origin "null"), so allow any
        # origin. Accounts are bearer tokens, not cookies.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Max-Age", "86400")

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ApiError(413, "Request too large.")
        if not n:
            return {}
        try:
            data = json.loads(self.rfile.read(n).decode())
        except ValueError:
            raise ApiError(400, "Body must be JSON.")
        if not isinstance(data, dict):
            raise ApiError(400, "Body must be a JSON object.")
        return data

    def _account(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            raise ApiError(401, "Sign-in token missing.")
        acc = self.store.account_by_token(auth[7:].strip())
        if not acc:
            raise ApiError(401, "Unknown sign-in token.")
        return acc

    def log_message(self, fmt, *args):
        if os.environ.get("HUBAI_QUIET") != "1":
            super().log_message(fmt, *args)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def _route(self, method):
        path = self.path.split("?", 1)[0].rstrip("/")
        fn = ROUTES.get((method, path))
        try:
            if not fn:
                raise ApiError(404, "Not found.")
            self._send(200, fn(self))
        except ApiError as e:
            self._send(e.status, {"error": e.message, "code": e.code})
        except Exception as e:  # noqa: BLE001 - never leak a stack trace
            self.log_error("internal error: %r", e)
            self._send(500, {"error": "Internal server error."})

    # --- endpoints ---

    def health(self):
        return {"ok": True, "fake_models": providers.fake()}

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
        p = config.PLANS.get(plan)
        if not p:
            raise ApiError(400, "Unknown plan.")
        if not p["buyable"]:
            raise ApiError(403, "%s is only for very large companies. Talk to Hub AI sales." % p["name"], "contact_sales")
        if acc["plan"] == "enterprise":
            raise ApiError(403, "This account is managed by your company.", "managed")
        ref = self.store.subscribe(acc["id"], plan)
        st = self.store.status(self.store.account(acc["id"]))
        st["receipt"] = ref
        return st

    def cancel(self):
        acc = self._account()
        self.store.cancel(acc["id"])
        return self.store.status(self.store.account(acc["id"]))

    def generate(self):
        acc = self._account()
        body = self._body()
        engine_id = body.get("engine")
        prompt = str(body.get("prompt") or "").strip()
        if not config.engine(engine_id):
            raise ApiError(400, "Unknown engine.")
        if not prompt:
            raise ApiError(400, "Describe the hub you want.")
        if len(prompt) > MAX_PROMPT:
            raise ApiError(400, "Keep the request under %d characters." % MAX_PROMPT)
        refused = self.store.reserve(acc, engine_id)
        if refused:
            raise ApiError(402 if refused[0] in ("credits", "plan") else 429, refused[1], refused[0])
        started = time.time()
        try:
            out = agents.generate(engine_id, prompt)
        except providers.ProviderError as e:
            self.store.refund(acc["id"], engine_id)
            raise ApiError(502, str(e), "model")
        except Exception:
            self.store.refund(acc["id"], engine_id)
            raise
        e = config.engine(engine_id)
        out.update(engine=engine_id, engineName=e["name"], base=e["base"], seconds=round(time.time() - started, 1),
                   me=self.store.status(self.store.account(acc["id"])))
        return out

    def admin_plan(self):
        key = os.environ.get("HUBAI_ADMIN_KEY")
        if not key or self.headers.get("X-Admin-Key") != key:
            raise ApiError(403, "Admin key required.")
        body = self._body()
        if body.get("plan") not in config.PLANS or not self.store.account(body.get("account", "")):
            raise ApiError(400, "Need a known account and plan.")
        self.store.set_plan(body["account"], body["plan"])
        return self.store.status(self.store.account(body["account"]))


ROUTES = {
    ("GET", "/v1/health"): Handler.health,
    ("GET", "/v1/config"): Handler.get_config,
    ("POST", "/v1/accounts"): Handler.create_account,
    ("GET", "/v1/me"): Handler.me,
    ("POST", "/v1/subscribe"): Handler.subscribe,
    ("POST", "/v1/cancel"): Handler.cancel,
    ("POST", "/v1/generate"): Handler.generate,
    ("POST", "/v1/admin/plan"): Handler.admin_plan,
}


def make_server(host="0.0.0.0", port=8787, db_path=None):
    store = Store(db_path or os.environ.get("HUBAI_DB", "hubai.sqlite3"))
    handler = type("BoundHandler", (Handler,), {"store": store})
    srv = ThreadingHTTPServer((host, port), handler)
    srv.daemon_threads = True
    return srv


def serve_in_thread(**kw):
    srv = make_server(**kw)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv
