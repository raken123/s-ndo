"""Fine-tuning with PyTorch: LoRA adapters on an open code model, trained with a plain
PyTorch loop (AdamW, warm-up + cosine schedule, gradient accumulation, gradient
clipping, mixed precision and gradient checkpointing).

Only the assistant's answer counts in the loss; the system prompt and the request are
masked out. A slice of the data is held back to measure the validation loss after each
epoch, and the adapter with the lowest validation loss is the one that is kept."""
import contextlib
import json
import math
import random
import time
from pathlib import Path


def encode(tok, rows, max_len):
    """Token ids with the prompt masked to -100. Rows longer than max_len are skipped."""
    out, skipped = [], 0
    for r in rows:
        msgs = r["messages"]
        prompt = tok.apply_chat_template(msgs[:-1], tokenize=False, add_generation_prompt=True)
        full = tok.apply_chat_template(msgs, tokenize=False)
        p_ids = tok(prompt, add_special_tokens=False)["input_ids"]
        ids = tok(full, add_special_tokens=False)["input_ids"]
        if len(ids) > max_len or ids[:len(p_ids)] != p_ids:
            skipped += 1
            continue
        out.append({"input_ids": ids, "labels": [-100] * len(p_ids) + ids[len(p_ids):], "kind": r.get("kind", "game")})
    return out, skipped


def batches(items, batch_size, pad_id, shuffle, rng):
    import torch
    order = list(range(len(items)))
    if shuffle:
        rng.shuffle(order)
        # similar lengths together wastes less padding; shuffle the chunks, not just the rows
        chunks = [sorted(order[i:i + batch_size * 16], key=lambda k: len(items[k]["input_ids"])) for i in range(0, len(order), batch_size * 16)]
        order = [k for c in chunks for k in c]
    for i in range(0, len(order), batch_size):
        group = [items[k] for k in order[i:i + batch_size]]
        n = max(len(g["input_ids"]) for g in group)
        ids = torch.full((len(group), n), pad_id)
        lab = torch.full((len(group), n), -100)
        att = torch.zeros((len(group), n), dtype=torch.long)
        for j, g in enumerate(group):
            k = len(g["input_ids"])
            ids[j, :k] = torch.tensor(g["input_ids"])
            lab[j, :k] = torch.tensor(g["labels"])
            att[j, :k] = 1
        yield {"input_ids": ids, "labels": lab, "attention_mask": att}


def train(rows, base, out_dir, adapter=None, epochs=2, lr=2e-4, max_len=6144, batch_size=1, grad_accum=8,
          lora_r=16, lora_alpha=32, lora_dropout=0.05, warmup=0.05, val_fraction=0.08, four_bit=False, seed=0, log=print):
    import torch
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from .backend import load

    if not rows:
        raise SystemExit("Ingen träningsdata. Kör först: python -m nexora_model data && python -m nexora_model selfplay")
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    torch.manual_seed(seed)
    rng = random.Random(seed)

    model, tok, device = load(base, adapter=adapter, four_bit=four_bit, trainable=True)
    if four_bit:
        model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
    if not adapter:  # a new adapter; with --adapter the previous round's adapter keeps training
        model = get_peft_model(model, LoraConfig(r=lora_r, lora_alpha=lora_alpha, lora_dropout=lora_dropout, task_type="CAUSAL_LM",
                                                 target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]))
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()
    model.config.use_cache = False
    for p in model.parameters():  # LoRA weights train in float32 for stability
        if p.requires_grad:
            p.data = p.data.float()
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    log("Modell: %s på %s · tränbara parametrar %.1f M av %.0f M (%.2f %%)" % (base, device, trainable / 1e6, total / 1e6, 100 * trainable / total))

    data, skipped = encode(tok, rows, max_len)
    rng.shuffle(data)
    n_val = max(1, int(len(data) * val_fraction)) if len(data) >= 10 else 0
    val, data = data[:n_val], data[n_val:]
    log("Data: %d exempel för träning, %d för validering, %d för långa för %d tokens" % (len(data), len(val), skipped, max_len))
    if not data:
        raise SystemExit("Alla exempel är längre än --max-len %d. Höj den eller använd en större GPU." % max_len)

    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=lr, weight_decay=0.0, betas=(0.9, 0.999))
    steps = max(1, math.ceil(len(data) / batch_size / grad_accum) * epochs)
    warm = max(1, int(steps * warmup))
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: (s + 1) / warm if s < warm else 0.5 * (1 + math.cos(math.pi * (s - warm) / max(1, steps - warm))))
    amp_dtype = torch.bfloat16 if device == "cuda" and torch.cuda.is_bf16_supported() else torch.float16 if device == "cuda" else None
    use_scaler = amp_dtype == torch.float16
    scaler = (torch.amp.GradScaler("cuda") if hasattr(torch, "amp") and hasattr(torch.amp, "GradScaler") else torch.cuda.amp.GradScaler()) if use_scaler else None
    target = model.device

    def run_batch(b):
        b = {k: v.to(target) for k, v in b.items()}
        ctx = torch.autocast(device_type="cuda", dtype=amp_dtype) if amp_dtype is not None else contextlib.nullcontext()
        with ctx:
            return model(**b).loss

    def validate():
        if not val:
            return None
        model.eval()
        tot, n = 0.0, 0
        with torch.no_grad():
            for b in batches(val, batch_size, tok.pad_token_id, False, rng):
                tot += run_batch(b).item()
                n += 1
        model.train()
        return tot / max(1, n)

    logf = (out / "train_log.jsonl").open("a", encoding="utf-8")
    best = float("inf")
    step, t0 = 0, time.time()
    model.train()
    for ep in range(1, epochs + 1):
        running, count = 0.0, 0
        for i, b in enumerate(batches(data, batch_size, tok.pad_token_id, True, rng), 1):
            loss = run_batch(b) / grad_accum
            (scaler.scale(loss) if scaler else loss).backward()
            running += loss.item() * grad_accum
            count += 1
            if i % grad_accum == 0 or i * batch_size >= len(data):
                if scaler:
                    scaler.unscale_(opt)
                torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad], 1.0)
                if scaler:
                    scaler.step(opt)
                    scaler.update()
                else:
                    opt.step()
                opt.zero_grad(set_to_none=True)
                sched.step()
                step += 1
                if step % 5 == 0 or step == steps:
                    rec = {"step": step, "of": steps, "epoch": ep, "loss": round(running / count, 4), "lr": sched.get_last_lr()[0], "sek": round(time.time() - t0)}
                    logf.write(json.dumps(rec) + "\n"); logf.flush()
                    log("  steg %d/%d · epok %d · loss %.4f · lr %.2e" % (step, steps, ep, rec["loss"], rec["lr"]))
                    running, count = 0.0, 0
        v = validate()
        log("Epok %d klar%s" % (ep, "" if v is None else " · valideringsloss %.4f" % v))
        logf.write(json.dumps({"epoch": ep, "val_loss": v}) + "\n"); logf.flush()
        if v is None or v < best:
            best = v if v is not None else best
            model.save_pretrained(out / "adapter")
            tok.save_pretrained(out / "adapter")
            log("  sparade adaptern i %s" % (out / "adapter"))
    logf.close()
    meta = {"base": base, "adapter": str(out / "adapter"), "examples": len(data), "val_loss": None if best == float("inf") else best,
            "epochs": epochs, "lr": lr, "lora_r": lora_r, "max_len": max_len, "finished": time.strftime("%Y-%m-%d %H:%M")}
    (out / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    return meta


def merge(base, adapter, out_dir, log=print):
    """Bakes the adapter into the base model: one folder that loads without peft."""
    from .backend import load
    model, tok, _ = load(base, adapter=adapter)
    model = model.merge_and_unload()
    model.save_pretrained(out_dir)
    tok.save_pretrained(out_dir)
    log("Sammanslagen modell sparad i %s" % out_dir)
