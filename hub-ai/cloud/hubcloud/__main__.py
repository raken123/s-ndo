"""python -m hubcloud [--host 0.0.0.0] [--port 8787] [--db hubai.sqlite3]"""

import argparse
import os

from .server import make_server


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
