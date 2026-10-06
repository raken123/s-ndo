"""Accounts, plans, daily usage and MCP connections in SQLite.

The apps get an anonymous account on first launch. Only a SHA-256 of the
account token is stored.
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
    plan TEXT NOT NULL DEFAULT 'lite',
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
CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    account TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    token TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    tools TEXT NOT NULL DEFAULT '[]',
    created REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS mcp_by_account ON mcp_servers (account);
"""

PERIOD_DAYS = 30


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _today():
    return datetime.datetime.now(datetime.timezone.utc).date().isoformat()


class Store:
    def __init__(self, path):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.lock = threading.RLock()

    # --- accounts ---

    def create_account(self):
        token = "one_" + secrets.token_urlsafe(32)
        acc_id = "acc_" + secrets.token_hex(6)
        with self.lock, self.db:
            self.db.execute("INSERT INTO accounts (id, token_hash, plan, created) VALUES (?, ?, ?, ?)",
                            (acc_id, _hash(token), config.DEFAULT_PLAN, time.time()))
        return acc_id, token

    def account_by_token(self, token):
        row = self.db.execute("SELECT * FROM accounts WHERE token_hash = ?", (_hash(token),)).fetchone()
        return self._roll(dict(row)) if row else None

    def account(self, acc_id):
        row = self.db.execute("SELECT * FROM accounts WHERE id = ?", (acc_id,)).fetchone()
        return self._roll(dict(row)) if row else None

    def _roll(self, a):
        """Demo renewals: a cancelled plan ends with its period, otherwise it
        rolls over (no money moves). Unknown plans fall back to Lite."""
        if a["plan"] not in config.PLANS:
            a["plan"] = config.DEFAULT_PLAN
        if a["plan"] != config.DEFAULT_PLAN and a["renews"] and time.time() > a["renews"]:
            if a["cancelled"]:
                self.set_plan(a["id"], config.DEFAULT_PLAN)
                a.update(plan=config.DEFAULT_PLAN, renews=None, cancelled=0)
            else:
                r = a["renews"]
                while time.time() > r:
                    r += PERIOD_DAYS * 86400
                with self.lock, self.db:
                    self.db.execute("UPDATE accounts SET renews = ? WHERE id = ?", (r, a["id"]))
                a["renews"] = r
        return a

    def set_plan(self, acc_id, plan, renews=None):
        with self.lock, self.db:
            self.db.execute("UPDATE accounts SET plan = ?, renews = ?, cancelled = 0 WHERE id = ?", (plan, renews, acc_id))

    def subscribe(self, acc_id, plan):
        p = config.PLANS[plan]
        renews = time.time() + PERIOD_DAYS * 86400 if p["price"] else None
        self.set_plan(acc_id, plan, renews)
        if not p["price"]:
            return None
        ref = "DEMO-" + secrets.token_hex(4).upper()
        with self.lock, self.db:
            self.db.execute("INSERT INTO receipts VALUES (?, ?, ?, ?, ?)", (ref, acc_id, p["name"], p["price"], time.time()))
        return ref

    def cancel(self, acc_id):
        with self.lock, self.db:
            self.db.execute("UPDATE accounts SET cancelled = 1 WHERE id = ? AND plan != ?", (acc_id, config.DEFAULT_PLAN))

    def receipts(self, acc_id):
        rows = self.db.execute("SELECT * FROM receipts WHERE account = ? ORDER BY at DESC LIMIT 20", (acc_id,))
        return [{"ref": r["ref"], "plan": r["plan"], "amount": r["amount"], "at": int(r["at"] * 1000)} for r in rows]

    # --- usage ---

    def _usage(self, acc_id):
        row = self.db.execute("SELECT usage FROM accounts WHERE id = ?", (acc_id,)).fetchone()
        u = json.loads(row["usage"]) if row else {}
        if u.get("day") != _today():
            u = {"day": _today(), "units": 0, "agents": {}}
        return u

    def _save_usage(self, acc_id, u):
        with self.db:
            self.db.execute("UPDATE accounts SET usage = ? WHERE id = ?", (json.dumps(u), acc_id))

    def status(self, acc):
        """Plan and what is left today, as the apps show it."""
        p = config.PLANS[acc["plan"]]
        u = self._usage(acc["id"])
        return {
            "account": acc["id"], "plan": acc["plan"], "planName": p["name"],
            "units": None if p["units"] is None else max(0, p["units"] - u["units"]),
            "unitsPerDay": p["units"], "usedToday": u["units"],
            "agentsLeft": {a: max(0, n - u["agents"].get(a, 0)) for a, n in p["limits"].items()},
            "models": p["models"], "agents": p["agents"], "weak": p["weak"], "mcpLimit": p["mcp"],
            "renews": int(acc["renews"] * 1000) if acc["renews"] else None, "cancelled": bool(acc["cancelled"]),
        }

    def cost(self, model_id, agent_ids):
        return config.model(model_id)["cost"] + sum(config.agent(a)["cost"] for a in agent_ids)

    def reserve(self, acc, model_id, agent_ids):
        """Checks and takes the units in one step, so parallel requests can't
        overspend. Returns None, or (code, message) when refused."""
        p = config.PLANS[acc["plan"]]
        cost = self.cost(model_id, agent_ids)
        with self.lock:
            u = self._usage(acc["id"])
            for a in agent_ids:
                lim = p["limits"].get(a)
                if lim is not None and u["agents"].get(a, 0) >= lim:
                    return "limit", "Du har använt %s %d gånger i dag. Det fylls på i morgon." % (config.agent(a)["name"], lim)
            if p["units"] is not None and u["units"] + cost > p["units"]:
                return "units", ("Dagens enheter är slut (%d av %d). De fylls på i morgon, eller uppgradera din plan."
                                 % (u["units"], p["units"]))
            u["units"] += cost
            for a in agent_ids:
                u["agents"][a] = u["agents"].get(a, 0) + 1
            self._save_usage(acc["id"], u)
        return None

    def refund(self, acc_id, model_id, agent_ids, model_too=True):
        """Gives units back for agents (and the message) that failed."""
        cost = (config.model(model_id)["cost"] if model_too else 0) + sum(config.agent(a)["cost"] for a in agent_ids)
        with self.lock:
            u = self._usage(acc_id)
            u["units"] = max(0, u["units"] - cost)
            for a in agent_ids:
                u["agents"][a] = max(0, u["agents"].get(a, 0) - 1)
            self._save_usage(acc_id, u)

    # --- MCP connections ---

    def mcp_list(self, acc_id, with_tokens=False):
        rows = self.db.execute("SELECT * FROM mcp_servers WHERE account = ? ORDER BY created", (acc_id,)).fetchall()
        out = []
        for r in rows:
            d = {"id": r["id"], "name": r["name"], "url": r["url"], "enabled": bool(r["enabled"]),
                 "tools": json.loads(r["tools"]), "hasToken": bool(r["token"])}
            if with_tokens:
                d["token"] = r["token"]
            out.append(d)
        return out

    def mcp_add(self, acc_id, name, url, token, tools):
        sid = "mcp_" + secrets.token_hex(5)
        with self.lock, self.db:
            self.db.execute("INSERT INTO mcp_servers (id, account, name, url, token, tools, created) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            (sid, acc_id, name, url, token or None, json.dumps(tools), time.time()))
        return sid

    def mcp_update(self, acc_id, sid, enabled):
        with self.lock, self.db:
            cur = self.db.execute("UPDATE mcp_servers SET enabled = ? WHERE id = ? AND account = ?", (1 if enabled else 0, sid, acc_id))
        return cur.rowcount > 0

    def mcp_delete(self, acc_id, sid):
        with self.lock, self.db:
            cur = self.db.execute("DELETE FROM mcp_servers WHERE id = ? AND account = ?", (sid, acc_id))
        return cur.rowcount > 0
