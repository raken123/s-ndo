"""python -m hubcloud [--host 0.0.0.0] [--port 8787] [--db hubai.sqlite3]

Settings come from the environment. A `.env` file next to this package
(hub-ai/cloud/.env, KEY=value per line) fills in any that aren't set; it is
git-ignored so keys never reach the repository.
"""

import argparse
import os

ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")


def load_env_file(path=ENV_FILE):
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    except OSError:
        pass


load_env_file()

from .server import make_server  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description="Hub AI Cloud server")
    ap.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8787")))
    ap.add_argument("--db", default=os.environ.get("HUBAI_DB", "hubai.sqlite3"))
    a = ap.parse_args()
    srv = make_server(a.host, a.port, a.db)
    print("Hub AI Cloud on http://%s:%d" % (a.host, a.port), flush=True)
    srv.serve_forever()


main()
