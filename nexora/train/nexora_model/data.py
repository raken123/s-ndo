"""Training data: the request list, the held-out evaluation split and the seed examples.

Everything here is plain JSON and runs without PyTorch. Rows are chat conversations
({"messages": [system, user, assistant]}) in the same format the app's
"Mina spel → 🧠 Träningsdata" export writes, so your own games can be mixed in."""
import json
from pathlib import Path

from . import DATA_DIR, EXAMPLES_DIR, PROMPTS_FILE
from .tasks import check_mesh, game_answer, messages


def load_spec(path=None):
    p = Path(path or PROMPTS_FILE)
    if not p.exists():
        raise SystemExit("Hittar inte %s. Kör: node nexora/build/prompts.js" % p)
    spec = json.loads(p.read_text(encoding="utf-8"))
    if spec.get("version", 1) < 2:
        raise SystemExit("%s är gammal. Kör: node nexora/build/prompts.js" % p)
    return spec


def key(req):
    return req["kind"] + ":" + req["idea"] + ":" + req.get("task", "") + ":" + req.get("style", "")


def split(spec, every=10):
    """(train, held_out): every `every`-th game idea is kept out of training and used to
    measure how well the model does on ideas it has never seen. The ideas behind the
    example games always stay in training."""
    examples = set(spec.get("examples", {}).values())
    train, held = [], []
    games = 0
    for r in spec["requests"]:
        if r["kind"] == "game" and r["idea"] not in examples:
            games += 1
            if games % every == 0:
                held.append(r)
                continue
        train.append(r)
    return train, held


def row(msgs, answer, **meta):
    return dict({"messages": msgs + [{"role": "assistant", "content": answer}]}, **meta)


def seed_rows(spec):
    """The hand-checked examples in marketing/examples: six games and four 3D models."""
    by_idea = {(r["kind"], r["idea"]): r for r in spec["requests"]}
    rows = []
    for gid, idea in spec.get("examples", {}).items():
        f = EXAMPLES_DIR / "games" / (gid + ".html")
        req = by_idea.get(("game", idea))
        if f.exists() and req:
            rows.append(row(messages(req), game_answer(f.read_text(encoding="utf-8")), kind="game", idea=idea, source="example"))
    meshes = EXAMPLES_DIR / "meshes.json"
    if meshes.exists():
        for m, idea in zip(json.loads(meshes.read_text(encoding="utf-8")), ["ett svärd", "en skattkista", "en svamp", "en planet med ring"]):
            req = by_idea.get(("mesh", idea))
            if req and check_mesh(json.dumps(m)):
                rows.append(row(messages(req), json.dumps(m, ensure_ascii=False, separators=(",", ":")), kind="mesh", idea=idea, source="example"))
    return rows


def own_rows(path):
    """Rows exported from the app (Mina spel → 🧠 Träningsdata)."""
    out = []
    for n, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        r = json.loads(line)
        roles = [m.get("role") for m in r.get("messages", [])]
        if roles[-1:] != ["assistant"] or "user" not in roles:
            raise SystemExit("%s rad %d: inte en chattkonversation som slutar med assistentens svar" % (path, n))
        out.append(dict(r, kind=r.get("kind", "game"), source="own"))
    return out


def read_jsonl(path):
    p = Path(path)
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()] if p.exists() else []


def write_jsonl(path, rows):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")


def append_jsonl(path, r):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")


def build(own=None, data_dir=None):
    """Writes data/seed.jsonl (+ your own rows) and data/heldout.json. Returns a summary."""
    d = Path(data_dir or DATA_DIR)
    spec = load_spec()
    train, held = split(spec)
    rows = seed_rows(spec) + (own_rows(own) if own else [])
    write_jsonl(d / "seed.jsonl", rows)
    (d / "heldout.json").write_text(json.dumps([r["idea"] for r in held], ensure_ascii=False, indent=1), encoding="utf-8")
    kinds = {}
    for r in train:
        kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
    return {"requests": len(train), "by_kind": kinds, "held_out_games": len(held), "seed_rows": len(rows)}


def training_rows(data_dir=None):
    """Everything to train on: the seeds plus every self-play round so far."""
    d = Path(data_dir or DATA_DIR)
    rows = read_jsonl(d / "seed.jsonl")
    for f in sorted(d.glob("selfplay-*.jsonl")):
        rows += read_jsonl(f)
    return rows
