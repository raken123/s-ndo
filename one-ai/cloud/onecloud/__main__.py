"""python -m onecloud [--host 0.0.0.0] [--port 8788] [--db oneai.sqlite3]

Settings come from the environment. A `.env` file in one-ai/cloud/ (one
KEY=value per line) fills in any that aren't set; it is git-ignored so keys
never reach the repository.

    python -m onecloud set-plan acc_1234abcd enterprise    # move an account (where the database lives)
"""

import argparse
import os
import sys

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

from . import config  # noqa: E402
from .server import make_server  # noqa: E402
from .store import Store  # noqa: E402


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "set-plan":
        if len(sys.argv) != 4 or sys.argv[3] not in config.PLANS:
            sys.exit("usage: python -m onecloud set-plan ACCOUNT %s" % "|".join(config.PLANS))
        store = Store(os.environ.get("ONEAI_DB", "oneai.sqlite3"))
        if not store.account(sys.argv[2]):
            sys.exit("unknown account")
        store.set_plan(sys.argv[2], sys.argv[3])
        print(store.status(store.account(sys.argv[2])))
        return
    ap = argparse.ArgumentParser(description="One AI Cloud server")
    ap.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8788")))
    ap.add_argument("--db", default=os.environ.get("ONEAI_DB", "oneai.sqlite3"))
    a = ap.parse_args()
    srv = make_server(a.host, a.port, a.db)
    print("One AI Cloud on http://%s:%d" % (a.host, a.port), flush=True)
    srv.serve_forever()


main()
