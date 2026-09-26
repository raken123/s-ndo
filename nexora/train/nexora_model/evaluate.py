"""How good is the model on game ideas it has never trained on? Each held-out idea
gets one game, which is played in headless Chromium. The report (pass rate, errors)
goes to runs/<name>/eval.json so rounds and base models can be compared."""
import json
import time
from pathlib import Path

from .data import load_spec, split
from .tasks import extract_html, messages


def run(backend, out_file, temperature=0.4, log=print):
    from .selftest import GameTester
    _, held = split(load_spec())
    results = []
    with GameTester() as tester:
        for i, req in enumerate(held, 1):
            t0 = time.time()
            html = extract_html(backend.generate(messages(req), temperature=temperature) or "")
            res = tester.check(html) if html else {"ok": False, "errors": ["ingen HTML i svaret"], "animating": False, "colors": 0}
            results.append({"idea": req["idea"], "ok": res["ok"], "errors": res["errors"][:3], "colors": res["colors"], "chars": len(html or "")})
            log("  [%d/%d] %s %s (%.0f s)" % (i, len(held), "✓" if res["ok"] else "✗", req["idea"][:60], time.time() - t0))
    passed = sum(r["ok"] for r in results)
    report = {"model": backend.name, "held_out": len(results), "passed": passed, "pass_rate": round(passed / max(1, len(results)), 3),
              "results": results, "time": time.strftime("%Y-%m-%d %H:%M")}
    Path(out_file).parent.mkdir(parents=True, exist_ok=True)
    Path(out_file).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    log("Utvärdering: %d av %d nya spelidéer blev fungerande spel (%.0f %%)" % (passed, len(results), 100 * report["pass_rate"]))
    return report
