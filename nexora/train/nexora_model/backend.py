"""Running the model: load it with PyTorch + transformers (optionally with a trained LoRA
adapter on top) and generate answers, streamed piece by piece.

PyTorch is imported only here and in train.py, so the data tools, the tests and
`serve --dummy` work without it."""
import threading


def pick_device():
    import torch
    if torch.cuda.is_available():
        return "cuda", (torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16)
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps", torch.float16
    return "cpu", torch.float32


def load(base, adapter=None, four_bit=False, trainable=False):
    """(model, tokenizer, device). `base` is a Hugging Face id or a local folder."""
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    device, dtype = pick_device()
    if trainable and device == "mps":
        dtype = torch.float32  # half-precision training is unstable on Apple GPUs
    tok = AutoTokenizer.from_pretrained(base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    kw = {"torch_dtype": dtype}  # (called `dtype` in the newest transformers; both work)
    if four_bit:
        from transformers import BitsAndBytesConfig
        kw["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=dtype, bnb_4bit_use_double_quant=True)
        kw["device_map"] = {"": 0}
    model = AutoModelForCausalLM.from_pretrained(base, **kw)
    if not four_bit:
        model.to(device)
    if adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, adapter, is_trainable=trainable)
    if not trainable:
        model.eval()
    torch.manual_seed(0)
    return model, tok, device


class HFBackend:
    """The real model."""

    def __init__(self, base, adapter=None, four_bit=False):
        self.model, self.tok, self.device = load(base, adapter, four_bit)
        self.name = base + (" + " + str(adapter) if adapter else "")
        self._lock = threading.Lock()

    def _inputs(self, msgs):
        text = self.tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        return self.tok(text, return_tensors="pt", add_special_tokens=False).input_ids.to(self.model.device)

    def _kwargs(self, max_new_tokens, temperature):
        kw = {"max_new_tokens": max_new_tokens, "pad_token_id": self.tok.pad_token_id}
        if temperature and temperature > 0:
            kw.update(do_sample=True, temperature=temperature, top_p=0.95)
        else:
            kw["do_sample"] = False
        return kw

    def generate(self, msgs, max_new_tokens=8192, temperature=0.7):
        import torch
        x = self._inputs(msgs)
        with self._lock, torch.no_grad():
            y = self.model.generate(x, **self._kwargs(max_new_tokens, temperature))
        return self.tok.decode(y[0, x.shape[1]:], skip_special_tokens=True)

    def stream(self, msgs, max_new_tokens=8192, temperature=0.7):
        """Yields text pieces as they are generated (one request at a time)."""
        import torch
        from transformers import TextIteratorStreamer
        x = self._inputs(msgs)
        streamer = TextIteratorStreamer(self.tok, skip_prompt=True, skip_special_tokens=True)
        self._lock.acquire()

        def work():
            try:
                with torch.no_grad():
                    self.model.generate(x, streamer=streamer, **self._kwargs(max_new_tokens, temperature))
            finally:
                self._lock.release()
        threading.Thread(target=work, daemon=True).start()
        for piece in streamer:
            if piece:
                yield piece


class DummyBackend:
    """Not a model: fixed answers of the right shape, so the server and the app's
    connection can be tested before any training (serve --dummy)."""
    name = "dummy (testsvar, ingen modell)"
    GAME = ("<!doctype html><html><head><meta charset='utf-8'><title>Testspelet</title></head><body style='margin:0;background:#111'>"
            "<canvas id='c'></canvas><script>const c=document.getElementById('c'),x=c.getContext('2d');let t=0;"
            "function fit(){c.width=innerWidth;c.height=innerHeight}addEventListener('resize',fit);fit();"
            "(function f(){t+=3;x.fillStyle='hsl('+t%360+',60%,35%)';x.fillRect(0,0,c.width,c.height);x.fillStyle='#fff';"
            "x.fillRect(t%c.width,c.height/2-10,20,20);x.font='20px sans-serif';x.fillText('Din egen modell svarar',20,40);"
            "requestAnimationFrame(f)})()</script></body></html>")

    def answer(self, msgs):
        sys_, user = msgs[0]["content"], msgs[-1]["content"]
        if "game studio" in sys_:
            return "Här är spelet:\n```html\n" + self.GAME + "\n```"
        if "Image" in sys_:
            return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'><circle cx='128' cy='128' r='90' fill='#22d3ee'/><circle cx='100' cy='110' r='12' fill='#111'/><circle cx='156' cy='110' r='12' fill='#111'/></svg>"
        if "3D" in sys_:
            return ('{"name":"Test","vertices":[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[0,2,0]],'
                    '"faces":[[0,1,2,3],[0,4,1],[1,4,2],[2,4,3],[3,4,0]],"colors":["#555555","#ff4d6d","#ffd23f","#3ddc97","#4cc9f0"]}')
        if "composer" in sys_:
            return '{"title":"Test","bpm":120,"bars":2,"tracks":[{"name":"melodi","wave":"square","volume":0.5,"notes":[[0,72,1],[1,76,1],[2,79,1],[3,84,1],[4,72,1],[5,76,1],[6,79,1],[7,84,1]]}],"drums":[[0,"kick"],[1,"snare"]]}'
        if "sound designer" in sys_:
            return '{"name":"Test","layers":[{"wave":"square","start":0,"duration":0.3,"freq":[440,880],"volume":0.5}]}'
        return "Din egen modell svarar. (Testsvar på: " + user[:60] + ")"

    def generate(self, msgs, max_new_tokens=8192, temperature=0.7):
        return self.answer(msgs)

    def stream(self, msgs, max_new_tokens=8192, temperature=0.7):
        a = self.answer(msgs)
        for i in range(0, len(a), 40):
            yield a[i:i + 40]
