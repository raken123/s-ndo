"""Fine-tunes each Hub agent from its base model with OpenAI's fine-tuning
API, then records the tuned model in agents.json, which the server reads.

    export OPENAI_API_KEY=sk-...
    python training/build_dataset.py
    python training/finetune.py                  # all agents, waits for the jobs
    python training/finetune.py --tier mini      # one agent
    python training/finetune.py --no-wait        # submit, then later:
    python training/finetune.py --collect        # pick up finished jobs

Not every base model can be fine-tuned. When OpenAI refuses one, that agent
is reported and keeps running as its base model with Hub's instructions.
Fine-tuning is billed by OpenAI per training token.
"""

import argparse
import datetime
import json
import os
import sys
import time
import uuid
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))

from hubspec import TIER_ORDER  # noqa: E402
from hubcloud import config  # noqa: E402

OUT = os.path.join(HERE, "out")
JOBS = os.path.join(OUT, "jobs.json")

# Fine-tuning needs a dated snapshot for some models; the rest use the
# agent's model id. Override with --base agent=model.
FT_BASE = {"mini": "gpt-4o-2024-08-06"}


def api_base():
    return os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")


def _request(method, path, body=None, data=None, ctype=None):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise SystemExit("Set OPENAI_API_KEY first.")
    headers = {"Authorization": "Bearer " + key}
    if body is not None:
        data, ctype = json.dumps(body).encode(), "application/json"
    if ctype:
        headers["Content-Type"] = ctype
    req = urllib.request.Request(api_base() + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read()).get("error", {}).get("message")
        except ValueError:
            msg = None
        raise RuntimeError("%s (HTTP %d)" % (msg or e.reason, e.code))


def upload(path):
    boundary = uuid.uuid4().hex
    with open(path, "rb") as f:
        content = f.read()
    body = (("--%s\r\nContent-Disposition: form-data; name=\"purpose\"\r\n\r\nfine-tune\r\n"
             "--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"%s\"\r\n"
             "Content-Type: application/jsonl\r\n\r\n") % (boundary, boundary, os.path.basename(path))).encode()
    body += content + ("\r\n--%s--\r\n" % boundary).encode()
    return _request("POST", "/files", data=body, ctype="multipart/form-data; boundary=" + boundary)["id"]


def submit(tier, base):
    train = os.path.join(OUT, tier + ".train.jsonl")
    valid = os.path.join(OUT, tier + ".valid.jsonl")
    if not os.path.exists(train):
        raise RuntimeError("No dataset for %s. Run training/build_dataset.py first." % tier)
    job = _request("POST", "/fine_tuning/jobs", {
        "model": base,
        "training_file": upload(train),
        "validation_file": upload(valid),
        "suffix": "hub-" + tier,
    })
    return {"tier": tier, "base": base, "job": job["id"], "status": job.get("status")}


def wait(job_id, poll):
    while True:
        j = _request("GET", "/fine_tuning/jobs/" + job_id)
        if j["status"] in ("succeeded", "failed", "cancelled"):
            return j
        print("  %s: %s" % (job_id, j["status"]), flush=True)
        time.sleep(poll)


def record(tier, model):
    """Points the agent at its fine-tuned model in agents.json."""
    try:
        with open(config.AGENTS_FILE, encoding="utf-8") as f:
            agents = json.load(f)
    except (OSError, ValueError):
        agents = {}
    models = [model] + config.engine(tier)["models"][1:]  # V2 Max keeps its reviewer
    agents[tier] = {"models": models, "at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")}
    with open(config.AGENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(agents, f, indent=2, sort_keys=True)
        f.write("\n")


def _load_jobs():
    try:
        with open(JOBS, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def _finish(jobs, poll):
    failed = 0
    for j in jobs:
        res = wait(j["job"], poll)
        if res["status"] == "succeeded":
            record(j["tier"], res["fine_tuned_model"])
            print("%-9s fine-tuned -> %s" % (j["tier"], res["fine_tuned_model"]))
        else:
            failed += 1
            err = (res.get("error") or {}).get("message", "")
            print("%-9s job %s %s %s" % (j["tier"], j["job"], res["status"], err))
    return failed


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tier", choices=TIER_ORDER, action="append")
    ap.add_argument("--base", action="append", default=[], metavar="AGENT=MODEL",
                    help="base model to fine-tune for an agent")
    ap.add_argument("--no-wait", action="store_true", help="submit jobs and exit")
    ap.add_argument("--collect", action="store_true", help="wait for jobs submitted with --no-wait")
    ap.add_argument("--poll", type=float, default=30)
    a = ap.parse_args(argv)

    if a.collect:
        return 1 if _finish(_load_jobs(), a.poll) else 0

    bases = dict(FT_BASE)
    for b in a.base:
        k, _, v = b.partition("=")
        bases[k] = v
    jobs, refused = [], 0
    for tier in a.tier or TIER_ORDER:
        base = bases.get(tier) or config.models_for(tier)[0]
        try:
            j = submit(tier, base)
            jobs.append(j)
            print("%-9s submitted %s from %s" % (tier, j["job"], base))
        except RuntimeError as e:
            refused += 1
            print("%-9s not fine-tuned (%s); it runs as %s with Hub's instructions" % (tier, e, base))
    os.makedirs(OUT, exist_ok=True)
    with open(JOBS, "w", encoding="utf-8") as f:
        json.dump(jobs, f, indent=2)
    if a.no_wait:
        print("Run `python training/finetune.py --collect` when the jobs are done.")
        return 0
    return 1 if (_finish(jobs, a.poll) or refused) else 0


if __name__ == "__main__":
    sys.exit(main())
