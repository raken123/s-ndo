"""Serves the model to the Nexora app over an OpenAI-compatible HTTP API:

    GET  /v1/models             -> the model id (nexora-egen)
    POST /v1/chat/completions   -> an answer, streamed as server-sent events when asked

The app's "Din egen modell" setting talks to http://127.0.0.1:8000/v1 by default.
Only the Python standard library is used here; the model itself is in backend.py."""
import json
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import MODEL_ID


def make_handler(backend, model_id=MODEL_ID, max_tokens=12000):
    class Handler(BaseHTTPRequestHandler):
        server_version = "NexoraModel/1.0"

        def log_message(self, fmt, *args):  # one short line per request
            print("%s %s" % (time.strftime("%H:%M:%S"), fmt % args))

        def _cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "content-type, authorization")
            # lets pages served over https (like the web app) reach this computer in Chrome
            self.send_header("Access-Control-Allow-Private-Network", "true")

        def _json(self, code, obj):
            body = json.dumps(obj, ensure_ascii=False).encode()
            self.send_response(code)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            if self.path.rstrip("/") in ("/v1/models", "/models"):
                return self._json(200, {"object": "list", "data": [{"id": model_id, "object": "model", "owned_by": "du", "description": backend.name}]})
            if self.path in ("/", "/health"):
                return self._json(200, {"ok": True, "model": model_id, "backend": backend.name})
            self._json(404, {"error": {"message": "okänd adress " + self.path}})

        def do_POST(self):
            if self.path.rstrip("/") not in ("/v1/chat/completions", "/chat/completions"):
                return self._json(404, {"error": {"message": "okänd adress " + self.path}})
            try:
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
                msgs = body["messages"]
                assert isinstance(msgs, list) and msgs and all(isinstance(m, dict) and "content" in m for m in msgs)
            except (ValueError, KeyError, AssertionError):
                return self._json(400, {"error": {"message": "förväntade JSON med messages: [{role, content}, …]"}})
            msgs = [{"role": m.get("role", "user"), "content": m["content"] if isinstance(m["content"], str) else
                     "".join(p.get("text", "") for p in m["content"] if isinstance(p, dict))} for m in msgs]
            n = min(int(body.get("max_tokens") or max_tokens), max_tokens)
            temp = float(body.get("temperature") if body.get("temperature") is not None else 0.7)
            cid = "chatcmpl-" + uuid.uuid4().hex[:12]
            if not body.get("stream"):
                text = backend.generate(msgs, max_new_tokens=n, temperature=temp)
                return self._json(200, {"id": cid, "object": "chat.completion", "created": int(time.time()), "model": model_id,
                                        "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}]})
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            def send(delta, finish=None):
                chunk = {"id": cid, "object": "chat.completion.chunk", "created": int(time.time()), "model": model_id,
                         "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}
                self.wfile.write(("data: " + json.dumps(chunk, ensure_ascii=False) + "\n\n").encode())
                self.wfile.flush()
            try:
                send({"role": "assistant"})
                for piece in backend.stream(msgs, max_new_tokens=n, temperature=temp):
                    send({"content": piece})
                send({}, "stop")
                self.wfile.write(b"data: [DONE]\n\n")
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass  # the app cancelled
    return Handler


def serve(backend, host="127.0.0.1", port=8000, model_id=MODEL_ID):
    httpd = ThreadingHTTPServer((host, port), make_handler(backend, model_id))
    url = "http://%s:%d/v1" % ("127.0.0.1" if host in ("0.0.0.0", "") else host, httpd.server_address[1])
    print("Nexora-modellen körs: %s  (%s)" % (url, backend.name))
    print("I appen: ⚙️ Inställningar → Din egen modell → adress %s" % url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return httpd
