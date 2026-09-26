"""Writes nexora/colab/Nexora_Flash_1_Colab.ipynb.   python nexora/build/make_notebook.py"""
import json
import os

cells = []
def md(s): cells.append({"cell_type": "markdown", "metadata": {}, "source": s.strip("\n").splitlines(True)})
def code(s): cells.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": s.strip("\n").splitlines(True)})

md("""
# Din egen Nexora-modell – träna med PyTorch i Google Colab

Den här anteckningsboken tränar **din egen AI-modell** för Nexora med **PyTorch**. Ingen API-nyckel behövs.

**Så fungerar det:**
1. En öppen kodmodell (**Qwen2.5-Coder**, Apache 2.0) laddas ner.
2. **Självspel:** modellen skriver svar på alla sorters förfrågningar som appen ställer: spel i vilken genre som helst, buggfixar, sprites, 3D-modeller, musik, ljudeffekter och text.
   - Varje spel **spelas i en riktig webbläsare**. Bara spel som startar, rör sig och inte kraschar sparas.
   - Misslyckade spel skickas tillbaka med felen, precis som appens självtest.
3. **Träning:** PyTorch finjusterar modellen med LoRA på allt som godkändes. Sedan börjar ett nytt varv med den bättre modellen.
4. **Utvärdering:** modellen testas på spelidéer den aldrig har tränat på, före och efter träningen.
5. **Servern** startas med en publik adress. I Nexora väljer du **⚙️ Inställningar → Din egen modell** och klistrar in adressen.

**Gör så här:** *Körning → Ändra körningstyp → GPU* (T4 räcker för 0.5B och 1.5B, L4/A100 för 3B och 7B). Kör sedan cellerna uppifrån och ned.

Samma kod finns i `nexora/train` och körs likadant på din egen dator: `python -m nexora_model all`.
""")

code("""
#@title 1. Hämta Nexora och installera paketen (PyTorch finns redan i Colab)
import os, subprocess, sys
print(subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], capture_output=True, text=True).stdout or 'Ingen GPU – byt körningstyp till GPU.')
BRANCH = 'main'  #@param {type:'string'}
if not os.path.exists('/content/s-ndo'):
    !git clone -q --depth 1 -b {BRANCH} https://github.com/raken123/s-ndo /content/s-ndo
if not os.path.exists('/content/s-ndo/nexora/train'):  # the kit may not be merged into main yet
    !cd /content/s-ndo && git fetch -q --depth 1 origin claude/busy-euler-zyz8lg && git checkout -q FETCH_HEAD
%cd /content/s-ndo/nexora/train
!pip -q install -r requirements.txt
!python -m playwright install --with-deps chromium > /dev/null
import torch; print('PyTorch', torch.__version__, '· CUDA', torch.cuda.is_available())
""")

code("""
#@title 2. Inställningar
BASE_MODEL = 'Qwen/Qwen2.5-Coder-1.5B-Instruct'  #@param ['Qwen/Qwen2.5-Coder-0.5B-Instruct', 'Qwen/Qwen2.5-Coder-1.5B-Instruct', 'Qwen/Qwen2.5-Coder-3B-Instruct', 'Qwen/Qwen2.5-Coder-7B-Instruct']
ROUNDS = 2  #@param {type:'integer'}
SAMPLES = 3  #@param {type:'integer'}
EPOCHS = 2  #@param {type:'integer'}
LIMIT = 0  #@param {type:'integer'}
FOUR_BIT = False  #@param {type:'boolean'}
USE_OWN_DATA = False  #@param {type:'boolean'}
# LIMIT > 0 kör bara så många förfrågningar per varv – bra för en snabb provkörning.
# FOUR_BIT = 4-bitars QLoRA, så att 7B ryms på en T4 (kräver: pip install bitsandbytes).
OUT = '/content/s-ndo/nexora/train/runs/nexora-egen'
""")

code("""
#@title 3. (Valfritt) Ladda upp dina egna spel från appen
OWN = ''
if USE_OWN_DATA:
    from google.colab import files
    up = files.upload()  # Mina spel → 🧠 Träningsdata i appen
    OWN = '/content/own.jsonl'
    open(OWN, 'wb').write(b''.join(up.values()))
    print('Laddade upp', sum(1 for l in open(OWN) if l.strip()), 'egna spel')
""")

code("""
#@title 4. Träna: självspel → PyTorch-träning, varv efter varv, och utvärdering
args = ['--base', BASE_MODEL, '--rounds', str(ROUNDS), '--samples', str(SAMPLES), '--epochs', str(EPOCHS), '--out', OUT]
if LIMIT: args += ['--limit', str(LIMIT)]
if FOUR_BIT: args += ['--4bit']
if OWN: args += ['--own', OWN]
!python -m nexora_model all {' '.join(args)}
""")

code("""
#@title 5. Provkör: ett spel som modellen aldrig har tränat på
PROMPT = 'En pingvin som driver ett glasskafé på ett isflak'  #@param {type:'string'}
import sys, html as _html
sys.path.insert(0, '/content/s-ndo/nexora/train')
from IPython.display import HTML, display
from nexora_model.backend import HFBackend
from nexora_model.data import load_spec
from nexora_model.tasks import extract_html
backend = HFBackend(BASE_MODEL, adapter=OUT + '/adapter', four_bit=FOUR_BIT)
spec = load_spec()
out = backend.generate([{'role': 'system', 'content': spec['system']}, {'role': 'user', 'content': 'Game idea: ' + PROMPT + '\\n\\nDimension: 2D.'}])
game = extract_html(out) or out
print(len(game), 'tecken HTML')
display(HTML('<iframe style="width:100%;height:520px;border:0;border-radius:12px" sandbox="allow-scripts" srcdoc="' + _html.escape(game) + '"></iframe>'))
""")

code("""
#@title 6. Starta modellen för appen (publik adress, ingen nyckel)
import threading, time, re, urllib.request
from nexora_model.serve import serve
threading.Thread(target=serve, args=(backend, '0.0.0.0', 8000), daemon=True).start()
time.sleep(2)
if not os.path.exists('/content/cloudflared'):
    urllib.request.urlretrieve('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64', '/content/cloudflared')
    os.chmod('/content/cloudflared', 0o755)
tunnel = subprocess.Popen(['/content/cloudflared', 'tunnel', '--url', 'http://localhost:8000', '--no-autoupdate'], stderr=subprocess.PIPE, text=True)
url = None
for line in tunnel.stderr:
    m = re.search(r'https://[a-z0-9-]+\\.trycloudflare\\.com', line)
    if m:
        url = m.group(0); break
print('Din modell körs. I Nexora → ⚙️ Inställningar → Din egen modell → adress:')
print('   ', url + '/v1')
print('Låt fliken vara öppen medan du använder modellen.')
""")

code("""
#@title 7. (Valfritt) Spara modellen: ladda ner adaptern eller lägg den på Hugging Face
import shutil
shutil.make_archive('/content/nexora-egen-adapter', 'zip', OUT + '/adapter')
print('Adaptern: /content/nexora-egen-adapter.zip  (på datorn: python -m nexora_model serve --adapter <mappen>)')
HF_REPO = ''  #@param {type:'string'}
if HF_REPO:
    from huggingface_hub import notebook_login
    notebook_login()
    backend.model.push_to_hub(HF_REPO, private=True)
    backend.tok.push_to_hub(HF_REPO, private=True)
    print('Uppladdad till https://huggingface.co/' + HF_REPO)
""")

nb = {"cells": cells, "metadata": {"accelerator": "GPU", "colab": {"provenance": [], "gpuType": "T4", "name": "Nexora_Flash_1_Colab.ipynb"},
      "kernelspec": {"display_name": "Python 3", "name": "python3"}, "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 0}
json.dump(nb, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'colab', 'Nexora_Flash_1_Colab.ipynb'), 'w'), ensure_ascii=False, indent=1)
print('ok', len(cells), 'cells')
