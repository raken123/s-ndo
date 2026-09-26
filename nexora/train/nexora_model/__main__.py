"""python -m nexora_model <command>

  data       builds the seed data and the held-out evaluation ideas (no PyTorch needed)
  selfplay   the model writes answers; only the ones that pass real checks are kept
  train      fine-tunes the model with PyTorch + LoRA on everything collected so far
  eval       plays one game per held-out idea and reports the pass rate
  serve      serves the model to the app (Din egen modell), OpenAI-compatible
  merge      bakes the adapter into the base model (one folder, loads without peft)
  all        data → (selfplay → train) × rounds → eval, in one go
"""
import argparse
import json
import sys
from pathlib import Path

from . import DATA_DIR, DEFAULT_BASE, MODEL_ID, RUNS_DIR


def backend_from(a):
    if getattr(a, "dummy", False):
        from .backend import DummyBackend
        return DummyBackend()
    from .backend import HFBackend
    return HFBackend(a.model or a.base, adapter=None if a.model else a.adapter, four_bit=a.four_bit)


def default_adapter(a):
    """--adapter defaults to the trained adapter in --out, when it exists."""
    if getattr(a, "adapter", None) == "auto":
        p = Path(a.out) / "adapter"
        a.adapter = str(p) if (p / "adapter_config.json").exists() else None
    return a


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python -m nexora_model", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def model_args(p, adapter_default="auto"):
        p.add_argument("--base", default=DEFAULT_BASE, help="öppen basmodell (Hugging Face-id eller mapp), standard %(default)s")
        p.add_argument("--adapter", default=adapter_default, help="LoRA-adapter att använda (standard: den tränade i --out om den finns)")
        p.add_argument("--model", help="en sammanslagen modellmapp (från merge) i stället för --base + --adapter")
        p.add_argument("--out", default=str(RUNS_DIR / MODEL_ID), help="körningens mapp, standard %(default)s")
        p.add_argument("--4bit", dest="four_bit", action="store_true", help="4-bitars QLoRA (kräver CUDA och bitsandbytes)")

    p = sub.add_parser("data", help="bygg startdata och utvärderingsidéer")
    p.add_argument("--own", help="dina spel exporterade från appen (Mina spel → 🧠 Träningsdata), .jsonl")

    p = sub.add_parser("selfplay", help="modellen skriver svar, bara godkända sparas")
    model_args(p)
    p.add_argument("--round", type=int, default=1)
    p.add_argument("--samples", type=int, default=3, help="försök per förfrågan (standard 3)")
    p.add_argument("--limit", type=int, help="bara de N första förfrågningarna (för en snabb provkörning)")
    p.add_argument("--kinds", help="bara vissa sorter, t.ex. game,svg,mesh,music,sfx,text")

    p = sub.add_parser("train", help="finjustera med PyTorch + LoRA")
    model_args(p, adapter_default=None)
    p.add_argument("--epochs", type=int, default=2)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--max-len", type=int, default=6144, help="längsta exempel i tokens")
    p.add_argument("--batch-size", type=int, default=1)
    p.add_argument("--grad-accum", type=int, default=8)
    p.add_argument("--lora-r", type=int, default=16)
    p.add_argument("--continue", dest="cont", action="store_true", help="fortsätt träna adaptern i --out")

    p = sub.add_parser("eval", help="testa modellen på spelidéer den aldrig tränat på")
    model_args(p)

    p = sub.add_parser("serve", help="kör modellen för appen")
    model_args(p)
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--dummy", action="store_true", help="ingen modell, bara testsvar – för att prova anslutningen")

    p = sub.add_parser("merge", help="baka in adaptern i basmodellen")
    model_args(p)

    p = sub.add_parser("all", help="hela kedjan")
    model_args(p, adapter_default=None)
    p.add_argument("--rounds", type=int, default=2, help="varv av självspel + träning (standard 2)")
    p.add_argument("--samples", type=int, default=3)
    p.add_argument("--epochs", type=int, default=2)
    p.add_argument("--limit", type=int)
    p.add_argument("--own")

    a = ap.parse_args(argv)
    if a.cmd == "data":
        from .data import build
        print(json.dumps(build(own=a.own), ensure_ascii=False, indent=1))
        return
    if a.cmd == "serve":
        from .serve import serve
        if not a.dummy:
            default_adapter(a)
        serve(backend_from(a), a.host, a.port)
        return
    if a.cmd == "selfplay":
        from .selfplay import run
        default_adapter(a)
        run(backend_from(a), a.round, a.samples, a.limit, a.kinds.split(",") if a.kinds else None)
        return
    if a.cmd == "train":
        from .data import training_rows
        from .train import train
        adapter = str(Path(a.out) / "adapter") if a.cont else a.adapter
        train(training_rows(), a.base, a.out, adapter=adapter, epochs=a.epochs, lr=a.lr, max_len=a.max_len,
              batch_size=a.batch_size, grad_accum=a.grad_accum, lora_r=a.lora_r, four_bit=a.four_bit)
        return
    if a.cmd == "eval":
        from .evaluate import run
        default_adapter(a)
        b = backend_from(a)
        run(b, Path(a.out) / ("eval-%s.json" % ("tranad" if a.adapter or a.model else "bas")))
        return
    if a.cmd == "merge":
        from .train import merge
        default_adapter(a)
        if not a.adapter:
            sys.exit("Ingen tränad adapter i %s. Kör train först." % a.out)
        merge(a.base, a.adapter, Path(a.out) / "merged")
        return
    if a.cmd == "all":
        run_all(a)


def run_all(a):
    """data → for each round: self-play with the current model, then train on everything
    collected so far → eval of the base model and of the trained model."""
    import gc
    from . import evaluate, selfplay
    from .backend import HFBackend
    from .data import build, training_rows
    from .train import train
    print(json.dumps(build(own=a.own), ensure_ascii=False))
    out, adapter = Path(a.out), None
    b = HFBackend(a.base, four_bit=a.four_bit)
    base_eval = evaluate.run(b, out / "eval-bas.json")
    del b
    gc.collect()
    _free()
    for r in range(1, a.rounds + 1):
        print("\n=== Varv %d av %d ===" % (r, a.rounds))
        b = HFBackend(a.base, adapter=adapter, four_bit=a.four_bit)
        selfplay.run(b, r, a.samples, a.limit)
        del b
        gc.collect()
        _free()
        train(training_rows(), a.base, out, adapter=adapter, epochs=a.epochs, four_bit=a.four_bit)
        adapter = str(out / "adapter")
        _free()
    final = evaluate.run(HFBackend(a.base, adapter=adapter, four_bit=a.four_bit), out / "eval-tranad.json")
    print("\nFöre träning: %d/%d nya spelidéer fungerade. Efter: %d/%d." % (base_eval["passed"], base_eval["held_out"], final["passed"], final["held_out"]))
    print("Starta modellen för appen:  python -m nexora_model serve")


def _free():
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except ImportError:
        pass


if __name__ == "__main__":
    main()
