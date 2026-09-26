"""Writes nexora/colab/Nexora_Flash_1_Colab.ipynb.   python nexora/build/make_notebook.py"""
import json
cells = []
def md(s): cells.append({"cell_type": "markdown", "metadata": {}, "source": s.strip("\n").splitlines(True)})
def code(s): cells.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": s.strip("\n").splitlines(True)})

md("""
# Nexora Flash 1 – träna din egen spelmodell i Google Colab

Den här anteckningsboken finjusterar en öppen kodmodell (**Qwen2.5-Coder-Instruct**) med LoRA så att den skriver kompletta HTML5-spel i Nexoras format, provkör den och startar en **OpenAI-kompatibel server** som Nexora-appen kan använda.

**Så här gör du**
1. *Körning → Ändra körningstyp → GPU* (T4 räcker för 0.5B/1.5B, L4/A100 för 3B/7B).
2. Kör cellerna uppifrån och ned (*Körning → Kör alla*).
3. Sista cellen skriver ut en URL. I Nexora: **⚙️ Inställningar → Egen endpoint**, klistra in URL:en som *Bas-URL* och sätt modell-ID till `nexora-flash-1`.

**Data.** `DATASET` väljer vad modellen lär sig: `html` = 200 HTML5-spel (alla nio speltyper), `godot` = 120 Godot-byggskript i Python (samma format som Astryx 5 Pro kör), `both` = allt. Bättre resultat får du med dina egna spel: i appen, *Mina spel → 🧠 Träningsdata* (Enterprise) exporterar allt du skapat med Pro 1/Core 1 i samma format. Sätt `USE_OWN_DATA = True` så får du ladda upp filen.

> GPT-5 Fast, GPT-6 Astra, GPT Images 2.5 och Meshy 7 har inga öppna vikter, så de går inte att finjustera här. Har du API-åtkomst kan du i stället ange deras modell-ID under *Egen endpoint* i appen.
""")

code("""
#@title 1. Kontrollera GPU och installera paket
import subprocess, sys
print(subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], capture_output=True, text=True).stdout or 'Ingen GPU hittades – byt körningstyp till GPU.')
!pip -q install -U transformers peft accelerate datasets fastapi uvicorn
""")

code("""
#@title 2. Inställningar
BASE_MODEL = 'Qwen/Qwen2.5-Coder-1.5B-Instruct'  #@param ['Qwen/Qwen2.5-Coder-0.5B-Instruct', 'Qwen/Qwen2.5-Coder-1.5B-Instruct', 'Qwen/Qwen2.5-Coder-3B-Instruct', 'Qwen/Qwen2.5-Coder-7B-Instruct']
MODEL_ID = 'nexora-flash-1'  #@param {type:'string'}
EPOCHS = 2  #@param {type:'integer'}
MAX_LEN = 8192  #@param {type:'integer'}
LEARNING_RATE = 2e-4  #@param {type:'number'}
DATASET = 'both'  #@param ['html', 'godot', 'both']
USE_OWN_DATA = False  #@param {type:'boolean'}
RAW = 'https://raw.githubusercontent.com/raken123/s-ndo/main/nexora/'
SEED_URLS = {'html': [RAW + 'colab/nexora_seed.jsonl'], 'godot': [RAW + 'colab/nexora_godot_seed.jsonl']}
SEED_URLS['both'] = SEED_URLS['html'] + SEED_URLS['godot']
OUT_DIR = '/content/' + MODEL_ID
""")

code("""
#@title 3. Hämta träningsdata
import json, urllib.request
rows = []
for url in SEED_URLS[DATASET]:
    part = [json.loads(l) for l in urllib.request.urlopen(url).read().decode('utf-8').splitlines() if l.strip()]
    print(url.rsplit('/', 1)[1], '→', len(part), 'exempel')
    rows += part
if USE_OWN_DATA:
    from google.colab import files
    for name, data in files.upload().items():
        own = [json.loads(l) for l in data.decode('utf-8').splitlines() if l.strip()]
        print(name, '→', len(own), 'egna exempel')
        rows += own * 2  # egna spel väger dubbelt
print('Totalt:', len(rows))
""")

code("""
#@title 4. Ladda basmodellen och lägg på LoRA
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import LoraConfig, get_peft_model

bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
dtype = torch.bfloat16 if bf16 else torch.float16
tok = AutoTokenizer.from_pretrained(BASE_MODEL)
if tok.pad_token is None:
    tok.pad_token = tok.eos_token
model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, dtype=dtype, device_map='auto')
model.gradient_checkpointing_enable()
model.enable_input_require_grads()
model.config.use_cache = False
model = get_peft_model(model, LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, task_type='CAUSAL_LM',
    target_modules=['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']))
# LoRA-vikterna tränas i float32 (fp16-träning kräver det)
for p in model.parameters():
    if p.requires_grad:
        p.data = p.data.float()
model.print_trainable_parameters()
""")

code("""
#@title 5. Tokenisera (bara svaret räknas i förlusten)
def encode(ex):
    msgs = ex['messages']
    prompt = tok.apply_chat_template(msgs[:-1], tokenize=False, add_generation_prompt=True)
    full = tok.apply_chat_template(msgs, tokenize=False)
    p_ids = tok(prompt, add_special_tokens=False)['input_ids']
    ids = tok(full, add_special_tokens=False)['input_ids']
    if len(ids) > MAX_LEN or ids[:len(p_ids)] != p_ids:
        return None
    return {'input_ids': ids, 'labels': [-100] * len(p_ids) + ids[len(p_ids):]}

data = [e for e in map(encode, rows) if e]
lens = sorted(len(e['input_ids']) for e in data)
print(f'{len(data)} av {len(rows)} exempel ryms i {MAX_LEN} tokens (median {lens[len(lens)//2]}, max {lens[-1]})')

def collate(batch):
    n = max(len(b['input_ids']) for b in batch)
    ids = torch.full((len(batch), n), tok.pad_token_id)
    lab = torch.full((len(batch), n), -100)
    att = torch.zeros((len(batch), n), dtype=torch.long)
    for i, b in enumerate(batch):
        k = len(b['input_ids'])
        ids[i, :k] = torch.tensor(b['input_ids']); lab[i, :k] = torch.tensor(b['labels']); att[i, :k] = 1
    return {'input_ids': ids, 'labels': lab, 'attention_mask': att}
""")

code("""
#@title 6. Träna
from transformers import Trainer, TrainingArguments
args = TrainingArguments(
    output_dir='/content/checkpoints', num_train_epochs=EPOCHS, per_device_train_batch_size=1,
    gradient_accumulation_steps=8, learning_rate=LEARNING_RATE, lr_scheduler_type='cosine', warmup_ratio=0.05,
    logging_steps=5, save_strategy='no', report_to='none', bf16=bf16, fp16=not bf16,
    gradient_checkpointing=True, remove_unused_columns=False)
Trainer(model=model, args=args, train_dataset=data, data_collator=collate).train()
""")

code("""
#@title 7. Slå ihop LoRA med basmodellen och spara
model = model.merge_and_unload()
model.config.use_cache = True
model.save_pretrained(OUT_DIR)
tok.save_pretrained(OUT_DIR)
print('Sparad i', OUT_DIR)
""")

code("""
#@title 8. Provkör: skapa ett spel
PROMPT = 'Ett plattformsspel i en isvärld där en pingvin samlar fisk'  #@param {type:'string'}
import re, html as _html
from IPython.display import HTML, display
SYSTEM = rows[0]['messages'][0]['content']

def generate(prompt, max_new_tokens=9000, temperature=0.7):
    msgs = [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': 'Game idea: ' + prompt + '\\n\\nDimension: 2D.'}]
    x = tok(tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True), return_tensors='pt', add_special_tokens=False).input_ids.to(model.device)
    with torch.no_grad():
        y = model.generate(x, max_new_tokens=max_new_tokens, do_sample=True, temperature=temperature, top_p=0.95)
    return tok.decode(y[0, x.shape[1]:], skip_special_tokens=True)

out = generate(PROMPT)
m = re.search(r'```html\\s*([\\s\\S]*?)```', out)
game = m.group(1) if m else out
print(len(game), 'tecken HTML')
display(HTML('<iframe style="width:100%;height:520px;border:0;border-radius:12px" sandbox="allow-scripts" srcdoc="' + _html.escape(game) + '"></iframe>'))
""")

code("""
#@title 8b. Provkör Godot-läget: modellen skriver ett byggskript, Godot testkör projektet
GODOT_PROMPT = 'Ett utforskningsspel i en skog med kristaller'  #@param {type:'string'}
import os, pathlib, shutil, zipfile
GODOT_SYSTEM = next((r['messages'][0]['content'] for r in rows if 'Godot mode' in r['messages'][0]['content']), None)
if GODOT_SYSTEM is None:
    print('Välj DATASET = "godot" eller "both" för att träna Godot-läget.')
else:
    msgs = [{'role': 'system', 'content': GODOT_SYSTEM}, {'role': 'user', 'content': 'Game idea: ' + GODOT_PROMPT + '\\n\\nEngine: Godot 4.7 (GDScript). Write one Python script that creates the whole project in the current folder.'}]
    x = tok(tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True), return_tensors='pt', add_special_tokens=False).input_ids.to(model.device)
    with torch.no_grad():
        y = model.generate(x, max_new_tokens=9000, do_sample=True, temperature=0.6, top_p=0.95)
    text = tok.decode(y[0, x.shape[1]:], skip_special_tokens=True)
    code = (re.search(r'```python\\s*([\\s\\S]*?)```', text) or [None, text])[1]
    proj = pathlib.Path('/content/godot_test'); shutil.rmtree(proj, ignore_errors=True); (proj / '_nexora').mkdir(parents=True)
    (proj / 'build.py').write_text(code)
    print(subprocess.run([sys.executable, 'build.py'], cwd=proj, capture_output=True, text=True).stdout)
    # Godot 4.7 headless + Nexora's test probe
    if not os.path.exists('/content/godot/godot'):
        urllib.request.urlretrieve('https://github.com/godotengine/godot/releases/download/4.7.2-stable/Godot_v4.7.2-stable_linux.x86_64.zip', '/content/godot.zip')
        zipfile.ZipFile('/content/godot.zip').extractall('/content/godot')
        os.rename('/content/godot/Godot_v4.7.2-stable_linux.x86_64', '/content/godot/godot'); os.chmod('/content/godot/godot', 0o755)
    for f in ['probe.gd', 'probe_driver.gd', 'probe.tscn']:
        urllib.request.urlretrieve(RAW + 'desktop/godot/' + f, proj / '_nexora' / f)
    subprocess.run(['/content/godot/godot', '--headless', '--path', str(proj), '--import'], capture_output=True, timeout=300)
    r = subprocess.run(['/content/godot/godot', '--headless', '--path', str(proj), '--fixed-fps', '30', 'res://_nexora/probe.tscn'], capture_output=True, text=True, timeout=300)
    out = r.stdout + r.stderr
    errors = [l for l in out.splitlines() if 'SCRIPT ERROR' in l or 'Parse Error' in l]
    print('Spelet körde klart:', 'NEXORA_PROBE_DONE' in out, '| skriptfel:', len(errors))
    print('\\n'.join(errors[:10]))
    shutil.make_archive('/content/godot_test', 'zip', proj)
    print('Projektet: /content/godot_test.zip (öppna i Godot 4.7)')
""")

code("""
#@title 9. Starta en OpenAI-kompatibel server och en publik tunnel
import threading, time, uuid, os, re, subprocess
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from transformers import TextIteratorStreamer

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])
lock = threading.Lock()

@app.get('/v1/models')
def models():
    return {'object': 'list', 'data': [{'id': MODEL_ID, 'object': 'model', 'owned_by': 'you'}]}

@app.post('/v1/chat/completions')
async def chat(req: Request):
    body = await req.json()
    x = tok(tok.apply_chat_template(body['messages'], tokenize=False, add_generation_prompt=True), return_tensors='pt', add_special_tokens=False).input_ids.to(model.device)
    kw = dict(max_new_tokens=min(int(body.get('max_tokens') or 9000), 12000), do_sample=True,
              temperature=float(body.get('temperature') or 0.7), top_p=0.95)
    cid = 'chatcmpl-' + uuid.uuid4().hex[:12]
    if not body.get('stream'):
        with lock, torch.no_grad():
            y = model.generate(x, **kw)
        text = tok.decode(y[0, x.shape[1]:], skip_special_tokens=True)
        return JSONResponse({'id': cid, 'object': 'chat.completion', 'model': MODEL_ID,
            'choices': [{'index': 0, 'message': {'role': 'assistant', 'content': text}, 'finish_reason': 'stop'}]})
    streamer = TextIteratorStreamer(tok, skip_prompt=True, skip_special_tokens=True)
    def work():
        with lock, torch.no_grad():
            model.generate(x, streamer=streamer, **kw)
    threading.Thread(target=work, daemon=True).start()
    def events():
        for piece in streamer:
            if piece:
                yield 'data: ' + json.dumps({'id': cid, 'object': 'chat.completion.chunk', 'model': MODEL_ID,
                    'choices': [{'index': 0, 'delta': {'content': piece}, 'finish_reason': None}]}) + '\\n\\n'
        yield 'data: ' + json.dumps({'id': cid, 'object': 'chat.completion.chunk', 'model': MODEL_ID,
            'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]}) + '\\n\\n'
        yield 'data: [DONE]\\n\\n'
    return StreamingResponse(events(), media_type='text/event-stream')

server = uvicorn.Server(uvicorn.Config(app, host='0.0.0.0', port=8000, log_level='warning'))
threading.Thread(target=server.run, daemon=True).start()
time.sleep(2)

if not os.path.exists('/content/cloudflared'):
    urllib.request.urlretrieve('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64', '/content/cloudflared')
    os.chmod('/content/cloudflared', 0o755)
tunnel = subprocess.Popen(['/content/cloudflared', 'tunnel', '--url', 'http://localhost:8000', '--no-autoupdate'],
                          stderr=subprocess.PIPE, text=True)
url = None
for line in tunnel.stderr:
    m = re.search(r'https://[a-z0-9-]+\\.trycloudflare\\.com', line)
    if m:
        url = m.group(0); break
print('Servern kör. I Nexora → ⚙️ Inställningar → Egen endpoint:')
print('  Bas-URL:  ', url + '/v1')
print('  Modell-ID:', MODEL_ID, '(sätt det för Flash 1, och gärna Pro 1/Core 1)')
print('Låt den här fliken vara öppen medan du använder modellen.')
""")

code("""
#@title 10. (Valfritt) Spara modellen på Hugging Face
HF_REPO = ''  #@param {type:'string'}
if HF_REPO:
    from huggingface_hub import notebook_login
    notebook_login()
    model.push_to_hub(HF_REPO, private=True)
    tok.push_to_hub(HF_REPO, private=True)
    print('Uppladdad till https://huggingface.co/' + HF_REPO)
else:
    print('Hoppar över – fyll i HF_REPO, t.ex. "ditt-namn/nexora-flash-1".')
""")

nb = {"cells": cells, "metadata": {"accelerator": "GPU", "colab": {"provenance": [], "gpuType": "T4", "name": "Nexora_Flash_1_Colab.ipynb"},
      "kernelspec": {"display_name": "Python 3", "name": "python3"}, "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 0}
import os
json.dump(nb, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'colab', 'Nexora_Flash_1_Colab.ipynb'), 'w'), ensure_ascii=False, indent=1)
print('ok', len(cells), 'cells')
