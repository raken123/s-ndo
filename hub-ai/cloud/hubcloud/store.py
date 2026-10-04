"""Accounts, plans and credit usage in SQLite.

Apps get an anonymous account token on first launch. Only a SHA-256 of the
token is stored.
"""

import datetime
import hashlib
import json
import secrets
import sqlite3
import threading
import time

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    token_hash TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    renews REAL,
    cancelled INTEGER NOT NULL DEFAULT 0,
    usage TEXT NOT NULL DEFAULT '{}',
    created REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS receipts (
    ref TEXT PRIMARY KEY,
    account TEXT NOT NULL,
    plan TEXT NOT NULL,
    amount REAL NOT NULL,
    at REAL NOT NULL
);
"""


# Billing period of each paid plan, in days (demo renewals).
PERIOD_DAYS = {"go": 30, "plus": 30, "enterprise": 365}


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _today(now=None):
    return datetime.datetime.fromtimestamp(now or time.time(), datetime.timezone.utc).date()


class Store:
    def __init__(self, path):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.lock = threading.Lock()

    # --- accounts ---

    def create_account(self):
        token = secrets.token_urlsafe(32)
        acc_id = "acc_" + secrets.token_hex(6)
        with self.lock, self.db:
            self.db.execute("INSERT INTO accounts (id, token_hash, created) VALUES (?, ?, ?)",
                            (acc_id, _hash(token), time.time()))
        return acc_id, token

    def account_by_token(self, token):
        row = self.db.execute("SELECT * FROM accounts WHERE token_hash = ?", (_hash(token),)).fetchone()
        return self._roll(dict(row)) if row else None

    def account(self, acc_id):
        row = self.db.execute("SELECT * FROM accounts WHERE id = ?", (acc_id,)).fetchone()
        return self._roll(dict(row)) if row else None

    def _roll(self, a):
        """Demo renewals: a cancelled plan ends at the end of its period,
        otherwise it rolls over (no money moves)."""
        if a["plan"] in PERIOD_DAYS and a["renews"] and time.time() > a["renews"]:
            if a["cancelled"]:
                self.set_plan(a["id"], "free")
                a.update(plan="free", renews=None, cancelled=0)
            else:
                r = a["renews"]
                while time.time() > r:
                    r += PERIOD_DAYS[a["plan"]] * 86400
                with self.lock, self.db:
                    self.db.execute("UPDATE accounts SET renews = ? WHERE id = ?", (r, a["id"]))
                a["renews"] = r
        return a

    def set_plan(self, acc_id, plan, renews=None):
        with self.lock, self.db:
            self.db.execute("UPDATE accounts SET plan = ?, renews = ?, cancelled = 0 WHERE id = ?",
                            (plan, renews, acc_id))

    def subscribe(self, acc_id, plan):
        p = config.PLANS[plan]
        renews = time.time() + PERIOD_DAYS[plan] * 86400 if plan in PERIOD_DAYS else None
        self.set_plan(acc_id, plan, renews)
        if plan != "free":
            # A new paid period starts with its full allowance; the yearly
            # Free cap keeps counting.
            with self.lock:
                u = self._usage(acc_id)
                u.update(dayUsed=0, monthUsed=0, engineDay={})
                self._save_usage(acc_id, u)
        ref = None
        if p["price"]:
            ref = "DEMO-" + secrets.token_hex(3).upper()
            with self.lock, self.db:
                self.db.execute("INSERT INTO receipts VALUES (?, ?, ?, ?, ?)", (ref, acc_id, p["name"], p["price"], time.time()))
        return ref

    def cancel(self, acc_id):
        with self.lock, self.db:
            self.db.execute("UPDATE accounts SET cancelled = 1 WHERE id = ? AND plan != 'free'", (acc_id,))

    def receipts(self, acc_id):
        rows = self.db.execute("SELECT * FROM receipts WHERE account = ? ORDER BY at DESC LIMIT 20", (acc_id,))
        return [{"ref": r["ref"], "plan": r["plan"], "amount": r["amount"], "at": int(r["at"] * 1000)} for r in rows]

    # --- credits ---

    def _usage(self, acc_id):
        row = self.db.execute("SELECT usage FROM accounts WHERE id = ?", (acc_id,)).fetchone()
        u = json.loads(row["usage"]) if row else {}
        d = _today()
        day, month, year = d.isoformat(), d.isoformat()[:7], d.isoformat()[:4]
        if u.get("day") != day:
            u.update(day=day, dayUsed=0, engineDay={})
        if u.get("month") != month:
            u.update(month=month, monthUsed=0)
        if u.get("year") != year:
            u.update(year=year, yearUsed=0)
        return u

    def _save_usage(self, acc_id, u):
        with self.db:
            self.db.execute("UPDATE accounts SET usage = ? WHERE id = ?", (json.dumps(u), acc_id))

    def status(self, acc):
        """Plan, credits left and per-engine daily caps, as the apps show them."""
        p = config.PLANS[acc["plan"]]
        u = self._usage(acc["id"])
        c = p["credits"]
        left, rule = None, []
        def cap(v):
            nonlocal left
            left = v if left is None else min(left, v)
        if c.get("perDay"):
            cap(c["perDay"] - u["dayUsed"]); rule.append("%d/day" % c["perDay"])
        if c.get("perYear"):
            cap(c["perYear"] - u["yearUsed"]); rule.append("%d left this year" % (c["perYear"] - u["yearUsed"]))
        if c.get("perMonth"):
            cap(c["perMonth"] - u["monthUsed"]); rule.append("{:,}/month".format(c["perMonth"]))
        limits = {e: max(0, n - u["engineDay"].get(e, 0)) for e, n in p["limits"].items()}
        return {
            "account": acc["id"], "plan": acc["plan"], "credits": max(0, left or 0), "rule": " · ".join(rule),
            "limitsLeft": limits, "renews": int(acc["renews"] * 1000) if acc["renews"] else None,
            "cancelled": bool(acc["cancelled"]),
            "features": p["features"],
            "secretEngines": config.secret_engines(acc["plan"]),
        }

    def check(self, acc, engine_id):
        """None if the account may run the engine now, else (code, message)."""
        p = config.PLANS[acc["plan"]]
        e = config.engine(engine_id)
        if engine_id not in p["engines"]:
            need = "Hub Go" if engine_id in config.PLANS["go"]["engines"] else "Hub Plus"
            return "plan", "%s needs %s." % (e["name"], need)
        st = self.status(acc)
        lim = p["limits"].get(engine_id)
        if lim is not None and st["limitsLeft"].get(engine_id, 0) <= 0:
            return "limit", "You have used %s %d times today. It comes back tomorrow." % (e["name"], lim)
        if st["credits"] < e["cost"]:
            return "credits", "Not enough credits. %s costs %d." % (e["name"], e["cost"])
        return None

    def reserve(self, acc, engine_id):
        """Checks and takes the credits in one step, so parallel requests
        can't overspend. Returns None, or (code, message) when refused."""
        with self.lock:
            refused = self.check(acc, engine_id)
            if refused:
                return refused
            self._add(acc["id"], engine_id, +1)
        return None

    def refund(self, acc_id, engine_id):
        """Gives the credits back when generation fails."""
        with self.lock:
            self._add(acc_id, engine_id, -1)

    def _add(self, acc_id, engine_id, sign):
        cost = config.engine(engine_id)["cost"] * sign
        u = self._usage(acc_id)
        for k in ("dayUsed", "monthUsed", "yearUsed"):
            u[k] = max(0, u[k] + cost)
        u["engineDay"][engine_id] = max(0, u["engineDay"].get(engine_id, 0) + sign)
        self._save_usage(acc_id, u)
