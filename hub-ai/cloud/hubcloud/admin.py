"""Move an account to another plan, e.g. onto Hub Enterprise:

    python -m hubcloud.admin set-plan acc_1234abcd enterprise [--db hubai.sqlite3]

Run it where the server's database lives. (Remotely, use POST /v1/admin/plan
with the X-Admin-Key header set to HUBAI_ADMIN_KEY.)
"""

import argparse
import os

from . import config
from .store import Store


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sp = sub.add_parser("set-plan")
    sp.add_argument("account")
    sp.add_argument("plan", choices=list(config.PLANS))
    ap.add_argument("--db", default=os.environ.get("HUBAI_DB", "hubai.sqlite3"))
    a = ap.parse_args()
    st = Store(a.db)
    if not st.account(a.account):
        raise SystemExit("No account " + a.account)
    st.set_plan(a.account, a.plan)
    print(a.account, "is now on", config.PLANS[a.plan]["name"])


if __name__ == "__main__":
    main()
