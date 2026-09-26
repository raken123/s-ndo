"""Self-play: the model writes its own training data, and only answers that pass real
checks are kept (rejection sampling). No teacher model and no API key are involved.

For every training request the current model writes a few answers:
- a game is played in headless Chromium (selftest.py); if every try fails, the errors
  are sent back with the app's own bug-fix request and the fixed game is tested again.
  A passing fix gives two rows: the idea -> the working game, and the bug-fix request ->
  the fix, so the model also learns the app's self-test repair step;
- a sprite, 3D model, piece of music, sound effect or text is checked against what the
  app can use (tasks.py).
Each round is saved to data/selfplay-<round>.jsonl and can be resumed."""
import time
from pathlib import Path

from . import DATA_DIR
from .data import append_jsonl, key, load_spec, read_jsonl, row, split
from .tasks import check_asset, extract_html, fix_request, game_answer, messages


def run(backend, round_no=1, samples=3, limit=None, kinds=None, temperature=0.8, data_dir=None, log=print):
    from .selftest import GameTester
    d = Path(data_dir or DATA_DIR)
    out = d / ("selfplay-%d.jsonl" % round_no)
    spec = load_spec()
    train, _ = split(spec)
    if kinds:
        train = [r for r in train if r["kind"] in kinds]
    done = {r.get("key") for r in read_jsonl(out)} | {r.get("key") for r in read_jsonl(d / ("selfplay-%d.skipped.jsonl" % round_no))}
    todo = [r for r in train if key(r) not in done][:limit]
    stats = {"kept": 0, "fixed": 0, "failed": 0}
    log("Självspel, varv %d: %d förfrågningar kvar (%s)" % (round_no, len(todo), backend.name))
    with GameTester() as tester:
        for i, req in enumerate(todo, 1):
            t0 = time.time()
            got = game(backend, tester, spec, req, samples, temperature) if req["kind"] == "game" else asset(backend, req, samples, temperature)
            for r in got:
                append_jsonl(out, dict(r, key=key(req), round=round_no))
            if not got:
                append_jsonl(d / ("selfplay-%d.skipped.jsonl" % round_no), {"key": key(req)})
                stats["failed"] += 1
            else:
                stats["kept"] += 1
                stats["fixed"] += any(r.get("source") == "fix" for r in got)
            log("  [%d/%d] %-5s %-50s %s  (%.0f s)" % (i, len(todo), req["kind"], req["idea"][:50], "✓" if got else "✗", time.time() - t0))
    log("Klart: %(kept)d godkända (%(fixed)d efter rättning), %(failed)d underkända" % stats)
    return stats


def game(backend, tester, spec, req, samples, temperature):
    msgs = messages(req)
    best, tries = None, []
    for _ in range(samples):
        html = extract_html(backend.generate(msgs, temperature=temperature) or "")
        if not html:
            continue
        res = tester.check(html)
        tries.append((html, res))
        if res["ok"] and (best is None or res["colors"] > best[1]["colors"]):
            best = (html, res)
    if best:
        return [row(msgs, game_answer(best[0]), kind="game", idea=req["idea"], source="selfplay", colors=best[1]["colors"])]
    # every try failed: repair the least broken one, the way the app's self-test does
    if not tries:
        return []
    html, res = min(tries, key=lambda t: (len(t[1]["errors"]), not t[1]["animating"]))
    fmsgs = fix_request(spec, html, tester.problems(res))
    fixed = extract_html(backend.generate(fmsgs, temperature=temperature * 0.75) or "")
    if not fixed:
        return []
    res2 = tester.check(fixed)
    if not res2["ok"]:
        return []
    return [row(msgs, game_answer(fixed), kind="game", idea=req["idea"], source="selfplay", colors=res2["colors"]),
            row(fmsgs, game_answer(fixed), kind="fix", idea=req["idea"], source="fix")]


def asset(backend, req, samples, temperature):
    msgs = messages(req)
    for _ in range(samples):
        ans = check_asset(req, backend.generate(msgs, max_new_tokens=6144, temperature=temperature))
        if ans:
            return [row(msgs, ans, kind=req["kind"], idea=req["idea"], source="selfplay")]
    return []
