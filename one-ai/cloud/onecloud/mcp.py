"""MCP (Model Context Protocol), both ways.

Client: accounts connect remote MCP servers (Streamable HTTP). In chat the
One model sees their tools and can call them.

Server: One AI Cloud answers MCP at /mcp, so other MCP clients (Claude,
editors, agents) can use the One models and agents with the account token.
"""

import ipaddress
import json
import os
import re
import socket
import urllib.error
import urllib.parse
import urllib.request

PROTOCOL = "2025-06-18"
TIMEOUT = int(os.environ.get("ONEAI_MCP_TIMEOUT", "60"))
MAX_RESULT = 60_000


class McpError(Exception):
    pass


def check_url(url):
    """Only public https servers, so accounts can't make the server reach
    its own network. ONEAI_MCP_ALLOW_PRIVATE=1 lifts this (tests, self-hosting)."""
    u = urllib.parse.urlparse(url)
    if u.scheme not in ("https", "http") or not u.hostname:
        raise McpError("Ange en adress som börjar med https://")
    if os.environ.get("ONEAI_MCP_ALLOW_PRIVATE") == "1":
        return
    if u.scheme != "https":
        raise McpError("MCP-servern måste använda https://")
    try:
        infos = socket.getaddrinfo(u.hostname, u.port or 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise McpError("Hittar inte servern %s." % u.hostname)
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise McpError("Den adressen är inte tillåten.")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Redirects could lead past check_url, so they are errors."""

    def redirect_request(self, *args, **kwargs):
        return None


_opener = urllib.request.build_opener(_NoRedirect)


class Client:
    """A minimal Streamable HTTP MCP client: initialize, tools/list, tools/call."""

    def __init__(self, url, token=None):
        self.url, self.token, self.session, self.next_id = url, token, None, 1

    def _post(self, payload):
        check_url(self.url)
        headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream",
                   "MCP-Protocol-Version": PROTOCOL}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        if self.session:
            headers["Mcp-Session-Id"] = self.session
        req = urllib.request.Request(self.url, data=json.dumps(payload).encode(), headers=headers, method="POST")
        try:
            with _opener.open(req, timeout=TIMEOUT) as r:
                self.session = r.headers.get("Mcp-Session-Id") or self.session
                body = r.read(4_000_000).decode("utf-8", "replace")
                kind = r.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            raise McpError("MCP-servern svarade %d." % e.code)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise McpError("Kunde inte nå MCP-servern (%s)." % getattr(e, "reason", e))
        if "id" not in payload:
            return None
        messages = []
        if "text/event-stream" in kind:
            for block in re.split(r"\r?\n\r?\n", body):
                data = "\n".join(line[5:].lstrip() for line in block.splitlines() if line.startswith("data:"))
                if data:
                    try:
                        messages.append(json.loads(data))
                    except ValueError:
                        pass
        elif body.strip():
            try:
                parsed = json.loads(body)
            except ValueError:
                raise McpError("MCP-servern svarade inte med JSON.")
            messages = parsed if isinstance(parsed, list) else [parsed]
        for m in messages:
            if isinstance(m, dict) and m.get("id") == payload["id"]:
                if m.get("error"):
                    raise McpError("MCP-fel: %s" % (m["error"].get("message") or m["error"]))
                return m.get("result") or {}
        raise McpError("MCP-servern gav inget svar.")

    def rpc(self, method, params=None):
        self.next_id += 1
        return self._post({"jsonrpc": "2.0", "id": self.next_id, "method": method, "params": params or {}})

    def initialize(self):
        info = self.rpc("initialize", {"protocolVersion": PROTOCOL, "capabilities": {},
                                       "clientInfo": {"name": "One AI", "version": "1.0.0"}})
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})
        return info

    def tools(self):
        out, cursor = [], None
        for _ in range(10):
            r = self.rpc("tools/list", {"cursor": cursor} if cursor else {})
            out += r.get("tools") or []
            cursor = r.get("nextCursor")
            if not cursor:
                break
        return out

    def call(self, name, args):
        return self.rpc("tools/call", {"name": name, "arguments": args})


def _fn_name(server, tool):
    n = re.sub(r"[^A-Za-z0-9_]", "_", "%s__%s" % (server, tool))
    return ("t_" + n if not re.match(r"[A-Za-z_]", n) else n)[:64]


def _clean_schema(s):
    """JSON schema for the model: drop keys model APIs reject."""
    if isinstance(s, dict):
        return {k: _clean_schema(v) for k, v in s.items() if k not in ("$schema", "$id", "additionalProperties", "$comment")}
    if isinstance(s, list):
        return [_clean_schema(x) for x in s]
    return s


def result_text(result):
    """An MCP tool result as plain data for the model."""
    texts = []
    for c in result.get("content") or []:
        if c.get("type") == "text":
            texts.append(c.get("text", ""))
        elif c.get("type") == "resource":
            texts.append((c.get("resource") or {}).get("text") or "[resurs %s]" % (c.get("resource") or {}).get("uri"))
        else:
            texts.append("[%s]" % c.get("type"))
    if result.get("structuredContent") is not None and not texts:
        texts.append(json.dumps(result["structuredContent"], ensure_ascii=False))
    out = "\n".join(texts)[:MAX_RESULT]
    return {"error": out or "Verktyget misslyckades."} if result.get("isError") else {"result": out}


class Toolset:
    """The tools of an account's connected servers, as model function
    declarations, and the dispatcher for the model's calls."""

    def __init__(self, servers, log=None):
        self.decls, self.route, self.errors = [], {}, []
        for s in servers:
            try:
                c = Client(s["url"], s.get("token"))
                c.initialize()
                for t in c.tools()[:64]:
                    fn = _fn_name(s["name"], t.get("name", "tool"))
                    self.route[fn] = (c, t.get("name"), s["name"])
                    self.decls.append({"name": fn, "description": ("[%s] %s" % (s["name"], t.get("description") or ""))[:1000],
                                       "parametersJsonSchema": _clean_schema(t.get("inputSchema") or {"type": "object"})})
            except McpError as e:
                self.errors.append("%s: %s" % (s["name"], e))
                if log:
                    log("mcp %s: %s" % (s["url"], e))

    def declarations(self):
        return self.decls

    def call(self, fn, args):
        if fn not in self.route:
            return {"error": "Okänt verktyg."}, fn
        client, tool, server = self.route[fn]
        label = "%s · %s" % (server, tool)
        try:
            return result_text(client.call(tool, args)), label
        except McpError as e:
            return {"error": str(e)}, label


def probe(url, token=None):
    """Connects once and returns the tool names (for the 'Add connection' form)."""
    c = Client(url, token)
    info = c.initialize()
    return {"server": (info.get("serverInfo") or {}).get("name") or urllib.parse.urlparse(url).hostname,
            "tools": [t.get("name") for t in c.tools()]}


# --- One AI as an MCP server -----------------------------------------------------

SERVER_TOOLS = [
    {"name": "one_chat", "title": "Fråga One",
     "description": "Ask a One AI model. Returns its answer (and any files it made).",
     "inputSchema": {"type": "object", "properties": {
         "prompt": {"type": "string", "description": "The question or request."},
         "model": {"type": "string", "description": "One model id, e.g. one-1-standard, one-1-max. Defaults to the account's best."}},
         "required": ["prompt"]}},
    {"name": "one_create", "title": "Skapa med en One-agent",
     "description": "Have a One AI agent make files: filegent (documents, code, PDF, Word, Excel), imagent (images), "
                    "vidagent (video), appagent (apps), presegent (PowerPoint), formegent (forms), sitegent (web sites), "
                    "inboxagent (e-mails), musigent (music), modelgent (3D models), designgent (SVG designs).",
     "inputSchema": {"type": "object", "properties": {
         "agent": {"type": "string", "description": "Agent id, e.g. appagent."},
         "prompt": {"type": "string", "description": "What to make."},
         "model": {"type": "string", "description": "One model id (optional)."}},
         "required": ["agent", "prompt"]}},
    {"name": "one_account", "title": "Mitt One-konto",
     "description": "The account's plan, models, agents and units left today.",
     "inputSchema": {"type": "object", "properties": {}}},
]


def tool_content(reply, files):
    """A One answer as MCP content: text, pictures, and files as resources."""
    import base64
    content = [{"type": "text", "text": reply or "Klart."}]
    for f in files:
        b64 = base64.b64encode(f["data"]).decode()
        if f["mime"].startswith("image/") and f["mime"] != "image/svg+xml":
            content.append({"type": "image", "data": b64, "mimeType": f["mime"]})
        elif f["mime"].startswith("audio/") and f["mime"] in ("audio/wav", "audio/mpeg"):
            content.append({"type": "audio", "data": b64, "mimeType": f["mime"]})
        elif f["mime"].startswith("text/") or f["mime"] in ("image/svg+xml", "application/json", "application/xml"):
            content.append({"type": "resource", "resource": {"uri": "one://files/" + f["name"], "mimeType": f["mime"],
                                                             "text": f["data"].decode("utf-8", "replace")}})
        else:
            content.append({"type": "resource", "resource": {"uri": "one://files/" + f["name"], "mimeType": f["mime"], "blob": b64}})
    return content
