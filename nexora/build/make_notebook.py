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

**Data – skapad av AI.** Nexora har inga mallar, så träningsdatan skrivs av en AI-lärarmodell: steg 3 skickar upp till 93 vitt skilda spelidéer (matlagning, fotboll, rytmspel, skräck, pussel, simulatorer …) till Claude med Nexoras egen systemprompt och sparar de färdiga spelen. Du behöver en Anthropic API-nyckel i Colabs *Secrets* (🔑 i vänsterkanten) med namnet `ANTHROPIC_API_KEY`. Spelen du själv skapat i appen kan läggas till: *Mina spel → 🧠 Träningsdata* (Enterprise) och `USE_OWN_DATA = True`.

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
TEACHER = 'claude-opus-5'  #@param ['claude-opus-5', 'claude-haiku-4-5']
N_EXAMPLES = 93  #@param {type:'integer'}
USE_OWN_DATA = False  #@param {type:'boolean'}
RAW = 'https://raw.githubusercontent.com/raken123/s-ndo/main/nexora/'
OUT_DIR = '/content/' + MODEL_ID
""")

code("""
#@title 3. Skapa träningsdata med AI (lärarmodellen skriver spelen)
import json, re, urllib.request, concurrent.futures, os
from google.colab import userdata
KEY = userdata.get('ANTHROPIC_API_KEY')
spec = json.loads(urllib.request.urlopen(RAW + 'colab/nexora_prompts.json').read().decode('utf-8'))
SYSTEM = spec['system']
CACHE = '/content/nexora_ai_games.jsonl'
done = {}
if os.path.exists(CACHE):
    for l in open(CACHE, encoding='utf-8'):
        r = json.loads(l); done[r['messages'][1]['content']] = r

def teach(req):
    # A compact game fits the student model's context (MAX_LEN tokens).
    body = {'model': TEACHER, 'max_tokens': 12000, 'system': SYSTEM,
            'messages': [{'role': 'user', 'content': req['user'] + '\\nKeep the whole file under about 20 kB.'}]}
    if TEACHER.startswith('claude-opus'):
        body['output_config'] = {'effort': 'high'}
    http = urllib.request.Request('https://api.anthropic.com/v1/messages', data=json.dumps(body).encode(), method='POST',
        headers={'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
    r = json.loads(urllib.request.urlopen(http, timeout=600).read())
    text = ''.join(b.get('text', '') for b in r['content'] if b['type'] == 'text')
    m = re.search(r'```html\\s*([\\s\\S]*?)```', text)
    if not m:
        return None
    return {'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': req['user']},
                         {'role': 'assistant', 'content': '```html\\n' + m.group(1).strip() + '\\n```'}]}

todo = [q for q in spec['requests'][:N_EXAMPLES] if q['user'] not in done]
print(len(done), 'spel finns redan,', len(todo), 'kvar att skapa med', TEACHER)
with concurrent.futures.ThreadPoolExecutor(4) as pool, open(CACHE, 'a', encoding='utf-8') as f:
    for q, fut in [(q, pool.submit(teach, q)) for q in todo]:
        try:
            ex = fut.result()
        except Exception as e:
            print('✗', q['idea'], '–', e); continue
        if ex:
            f.write(json.dumps(ex, ensure_ascii=False) + '\\n'); f.flush(); done[q['user']] = ex
            print('✓', q['idea'])
rows = list(done.values())
if USE_OWN_DATA:
    from google.colab import files
    for name, data in files.upload().items():
        own = [json.loads(l) for l in data.decode('utf-8').splitlines() if l.strip()]
        print(name, '→', len(own), 'egna spel')
        rows += own * 2  # egna spel väger dubbelt
print('Totalt:', len(rows), 'spel att träna på (sparade i', CACHE + ')')
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
PROMPT = 'En pingvin som driver ett glasskafé på ett isflak'  #@param {type:'string'}
import re, html as _html
from IPython.display import HTML, display

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
