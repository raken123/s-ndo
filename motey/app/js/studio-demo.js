/* Motey Studio – the built-in example: Karl's team wants to build a transformer AI.
 * Everything here is real: the code runs (PyTorch / NumPy / Hugging Face), the
 * designs render, the tutorial works. Prices are rough and marked as such. */
(function () {
  'use strict';

  const GPT = `# mini_gpt.py – en liten transformer (GPT) som lär sig skriva som er text
# Kör:  pip install torch   och sedan   python mini_gpt.py
import torch, torch.nn as nn, torch.nn.functional as F

block, batch, d, heads, layers, steps = 128, 32, 192, 6, 4, 3000
text = open('data.txt', encoding='utf-8').read()          # valfri text, gärna > 1 MB
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
data = torch.tensor([stoi[c] for c in text])
n = int(0.9 * len(data)); train, val = data[:n], data[n:]
dev = 'cuda' if torch.cuda.is_available() else 'cpu'

def get_batch(split):
    src = train if split == 'train' else val
    ix = torch.randint(len(src) - block - 1, (batch,))
    x = torch.stack([src[i:i + block] for i in ix])
    y = torch.stack([src[i + 1:i + block + 1] for i in ix])
    return x.to(dev), y.to(dev)

class Block(nn.Module):
    """Ett transformer-block: självuppmärksamhet + framåtnät, med residualer."""
    def __init__(self):
        super().__init__()
        self.ln1 = nn.LayerNorm(d)
        self.attn = nn.MultiheadAttention(d, heads, dropout=0.1, batch_first=True)
        self.ln2 = nn.LayerNorm(d)
        self.ff = nn.Sequential(nn.Linear(d, 4 * d), nn.GELU(), nn.Linear(4 * d, d), nn.Dropout(0.1))

    def forward(self, x):
        T = x.size(1)
        future = torch.triu(torch.ones(T, T, dtype=torch.bool, device=x.device), 1)  # får inte titta framåt
        h = self.ln1(x)
        x = x + self.attn(h, h, h, attn_mask=future, need_weights=False)[0]
        return x + self.ff(self.ln2(x))

class GPT(nn.Module):
    def __init__(self, vocab):
        super().__init__()
        self.tok = nn.Embedding(vocab, d)
        self.pos = nn.Embedding(block, d)
        self.blocks = nn.Sequential(*[Block() for _ in range(layers)])
        self.ln = nn.LayerNorm(d)
        self.head = nn.Linear(d, vocab)

    def forward(self, idx, targets=None):
        T = idx.size(1)
        x = self.tok(idx) + self.pos(torch.arange(T, device=idx.device))
        logits = self.head(self.ln(self.blocks(x)))
        loss = None if targets is None else F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1))
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, n, temp=0.8):
        for _ in range(n):
            logits, _ = self(idx[:, -block:])
            p = F.softmax(logits[:, -1] / temp, dim=-1)
            idx = torch.cat([idx, torch.multinomial(p, 1)], dim=1)
        return idx

model = GPT(len(chars)).to(dev)
opt = torch.optim.AdamW(model.parameters(), lr=3e-4)
print(f'{sum(p.numel() for p in model.parameters()) / 1e6:.1f} M parametrar på {dev}')

for step in range(steps):
    x, y = get_batch('train')
    _, loss = model(x, y)
    opt.zero_grad(); loss.backward(); opt.step()
    if step % 300 == 0:
        model.eval()
        with torch.no_grad():
            vl = model(*get_batch('val'))[1].item()
        model.train()
        print(f'steg {step:5d}  träning {loss.item():.3f}  validering {vl:.3f}')

model.eval()
start = torch.tensor([[stoi[text[0]]]], device=dev)
print(''.join(itos[i] for i in model.generate(start, 500)[0].tolist()))
torch.save(model.state_dict(), 'mini_gpt.pt')
`;

  const NUMPY = `# attention.py – hjärtat i en transformer, bara med NumPy (ingen GPU behövs)
# Kör:  pip install numpy   och sedan   python attention.py
import numpy as np
np.random.seed(0)

def softmax(x):
    e = np.exp(x - x.max(-1, keepdims=True))
    return e / e.sum(-1, keepdims=True)

def attention(Q, K, V, mask=None):
    scores = Q @ K.T / np.sqrt(Q.shape[-1])     # hur mycket varje ord "tittar" på de andra
    if mask is not None:
        scores = np.where(mask, -1e9, scores)    # dölj framtida ord
    w = softmax(scores)
    return w @ V, w

words = ['Karl', 'bygger', 'en', 'AI']
d = 8
X = np.random.randn(len(words), d)              # låtsas-embeddingar
Wq, Wk, Wv = (np.random.randn(d, d) / np.sqrt(d) for _ in range(3))
mask = np.triu(np.ones((len(words), len(words)), dtype=bool), 1)

out, w = attention(X @ Wq, X @ Wk, X @ Wv, mask)
print('Vem tittar på vem (raderna summerar till 1):')
print(' ' * 8 + ' '.join(f'{x:>6}' for x in words))
for i, word in enumerate(words):
    print(f'{word:<8}' + ' '.join(f'{v:6.2f}' for v in w[i]))
print('Utdata per ord:', out.shape)
`;

  const HF = `# finjustera.py – utgå från en färdig språkmodell och träna den på er text
# Kör:  pip install transformers datasets accelerate torch   och sedan   python finjustera.py
from datasets import load_dataset
from transformers import (AutoModelForCausalLM, AutoTokenizer, DataCollatorForLanguageModeling,
                          Trainer, TrainingArguments)

name = 'gpt2'   # svensk modell: 'AI-Sweden-Models/gpt-sw3-126m' (godkänn licensen på Hugging Face först)
tok = AutoTokenizer.from_pretrained(name)
tok.pad_token = tok.eos_token
model = AutoModelForCausalLM.from_pretrained(name)

ds = load_dataset('text', data_files={'train': 'data.txt'})
ds = ds.map(lambda b: tok(b['text'], truncation=True, max_length=256), batched=True, remove_columns=['text'])

args = TrainingArguments('ut', per_device_train_batch_size=8, num_train_epochs=1,
                         learning_rate=5e-5, logging_steps=50, save_steps=500)
Trainer(model=model, args=args, train_dataset=ds['train'],
        data_collator=DataCollatorForLanguageModeling(tok, mlm=False)).train()

model.save_pretrained('min-modell'); tok.save_pretrained('min-modell')
prompt = tok('Hej! Idag ska vi', return_tensors='pt')
print(tok.decode(model.generate(**prompt, max_new_tokens=40, do_sample=True, top_p=0.9)[0]))
`;

  const DIAGRAM = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#F6F4FF;font-family:system-ui,sans-serif">
<svg viewBox="0 0 420 560" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#1E1B3A"/></marker></defs>
<text x="210" y="34" text-anchor="middle" font-size="20" font-weight="800" fill="#1E1B3A">Så funkar en transformer</text>
<g font-size="13" font-weight="700" text-anchor="middle">
<rect x="110" y="490" width="200" height="40" rx="12" fill="#FFE6DC"/><text x="210" y="515">Text in → tokens</text>
<rect x="110" y="420" width="200" height="40" rx="12" fill="#FFF4D6"/><text x="210" y="445">Embedding + position</text>
<rect x="70" y="150" width="280" height="240" rx="20" fill="none" stroke="#6C4CF5" stroke-width="3" stroke-dasharray="8 6"/>
<text x="340" y="170" text-anchor="end" font-size="12" fill="#6C4CF5">× N block</text>
<rect x="110" y="320" width="200" height="44" rx="12" fill="#EDE7FF"/><text x="210" y="347">Självuppmärksamhet</text>
<rect x="110" y="250" width="200" height="44" rx="12" fill="#DDFBEF"/><text x="210" y="277">Framåtnät (MLP)</text>
<rect x="110" y="180" width="200" height="44" rx="12" fill="#E3ECFF"/><text x="210" y="207">LayerNorm + residual</text>
<rect x="110" y="80" width="200" height="40" rx="12" fill="#1E1B3A"/><text x="210" y="105" fill="#fff">Nästa ord (sannolikheter)</text>
</g>
<g stroke="#1E1B3A" stroke-width="2.5" marker-end="url(#a)"><line x1="210" y1="490" x2="210" y2="464"/><line x1="210" y1="420" x2="210" y2="368"/><line x1="210" y1="320" x2="210" y2="298"/><line x1="210" y1="250" x2="210" y2="228"/><line x1="210" y1="180" x2="210" y2="124"/></g>
</svg></body>`;

  const LANDING = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
body{margin:0;font-family:system-ui,sans-serif;background:#0E0B22;color:#fff}
.hero{padding:48px 28px;background:radial-gradient(circle at 80% 0,#6C4CF5,transparent 60%),radial-gradient(circle at 0 100%,#FF5C8A55,transparent 50%)}
h1{font-size:40px;margin:0 0 10px;letter-spacing:-.02em}.tag{opacity:.8;font-size:18px;max-width:30em}
.btn{display:inline-block;margin-top:22px;background:#fff;color:#0E0B22;padding:12px 22px;border-radius:999px;font-weight:800;text-decoration:none}
.chat{margin:28px;background:#1C1838;border-radius:20px;padding:18px;max-width:520px}.m{padding:10px 14px;border-radius:16px;margin:8px 0;max-width:80%}
.u{background:#6C4CF5;margin-left:auto}.b{background:#2A2450}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;padding:0 28px 40px}
.card{background:#1C1838;border-radius:16px;padding:16px}.card b{display:block;margin-bottom:6px}</style>
<div class="hero"><h1>Transformia</h1><div class="tag">Vår egen transformer-AI som skriver svenska – tränad på vår text, på vår dator.</div><a class="btn" href="#">Prova demon</a></div>
<div class="chat"><div class="m u">Skriv en hälsning till kunderna</div><div class="m b">Hej allihop! Vi är superglada att få visa det vi har byggt …</div></div>
<div class="grid"><div class="card"><b>🧠 Egen modell</b>4 lager, 6 huvuden, 2 M parametrar.</div><div class="card"><b>🔒 Lokal</b>Data lämnar aldrig datorn.</div><div class="card"><b>⚡ Snabb</b>Tränar på en kväll på ett vanligt grafikkort.</div></div>`;

  const LOGO = `<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;height:100vh;background:#fff">
<svg viewBox="0 0 400 200" width="90%" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#6C4CF5"/><stop offset="1" stop-color="#FF5C8A"/></linearGradient></defs>
<g transform="translate(40 40)"><circle cx="20" cy="20" r="12" fill="url(#g)"/><circle cx="20" cy="100" r="12" fill="url(#g)"/><circle cx="100" cy="60" r="16" fill="#1E1B3A"/>
<g stroke="url(#g)" stroke-width="6" stroke-linecap="round"><line x1="30" y1="26" x2="86" y2="54"/><line x1="30" y1="94" x2="86" y2="66"/></g>
<circle cx="20" cy="60" r="9" fill="#1E1B3A" opacity=".35"/><line x1="29" y1="60" x2="84" y2="60" stroke="#1E1B3A" stroke-width="4" opacity=".35"/></g>
<text x="170" y="112" font-family="system-ui,sans-serif" font-size="34" font-weight="900" fill="#1E1B3A">Transformia</text>
<text x="171" y="138" font-family="system-ui,sans-serif" font-size="13" fill="#5B5878">uppmärksamhet är allt</text></svg></body>`;

  window.StudioDemo = {
    id: 'demo-transformer', demo: true, title: 'Transformer-AI för Karls team',
    prompt: 'Vi ska bygga en egen transformer-AI som kan skriva svensk text. Vi kan inte designa, inte koda och vet inte hur man sätter ihop grejerna.',
    team: ['Karl', 'Amina', 'Leo'], images: [], created: Date.now() - 3 * 864e5,
    sections: {
      plan: { source: 'demo', variants: [{
        name: 'Så hänger det ihop',
        summary: 'En transformer är en AI som läser text i småbitar (tokens) och för varje bit räknar ut vilka andra bitar som är viktiga – det kallas uppmärksamhet. Den gissar sedan nästa ord, om och om igen. Ni behöver: text att träna på, en kort Python-fil, en dator med grafikkort (eller gratis Google Colab) och en kväll.',
        parts: [
          { name: 'Data', what: 'En stor textfil (data.txt), t.ex. era dokument, böcker utan upphovsrätt eller Wikipedia.', why: 'AI:n lär sig bara det den har läst.' },
          { name: 'Tokenisering', what: 'Texten görs om till siffror – i början en siffra per bokstav.', why: 'Datorer räknar med siffror, inte bokstäver.' },
          { name: 'Embedding', what: 'Varje siffra blir en lista med decimaltal som lärs in.', why: 'Liknande tecken och ord hamnar nära varandra.' },
          { name: 'Uppmärksamhet', what: 'Varje position tittar på de tidigare och väger hur viktiga de är.', why: 'Så förstår modellen sammanhang.' },
          { name: 'Träning', what: 'Modellen gissar nästa tecken, ser hur fel den hade och justerar sig.', why: 'Tusentals små justeringar = en modell som kan skriva.' },
          { name: 'Generering', what: 'Ge en början och låt den fortsätta tecken för tecken.', why: 'Det är här ni ser resultatet.' }
        ],
        steps: [
          { title: 'Installera Python och PyTorch', detail: 'Python 3.11+, sedan pip install torch. Ingen GPU? Kör i Google Colab.' },
          { title: 'Samla text', detail: 'Lägg minst 1 MB text i data.txt. Mer text = bättre modell.' },
          { title: 'Kör mini_gpt.py', detail: 'Se förlusten (loss) sjunka. Under 1,5 är bra för tecken-modeller.' },
          { title: 'Generera', detail: 'Läs vad den skriver, ändra temperaturen och testa igen.' },
          { title: 'Väx', detail: 'Fler lager, större block, mer data – eller finjustera en färdig modell.' }
        ],
        glossary: [{ term: 'Token', explain: 'En bit text – en bokstav, ett ordled eller ett ord.' }, { term: 'Loss', explain: 'Hur fel modellen gissar. Ska bli mindre.' }, { term: 'Parameter', explain: 'Ett tal i modellen som justeras under träningen.' }]
      }] },
      code: { source: 'demo', variants: [
        { name: 'Mini-GPT i PyTorch', description: 'En riktig liten transformer som ni tränar själva. Bäst för att förstå och äga allt.', language: 'python', run: 'pip install torch && python mini_gpt.py', files: [{ path: 'mini_gpt.py', content: GPT }, { path: 'data.txt', content: 'Klistra in er träningstext här – gärna minst en miljon tecken.\n' }] },
        { name: 'Bara uppmärksamhet (NumPy)', description: 'Den enklaste varianten: visar exakt hur uppmärksamhet räknas. Körs på vilken dator som helst.', language: 'python', run: 'pip install numpy && python attention.py', files: [{ path: 'attention.py', content: NUMPY }] },
        { name: 'Finjustera en färdig modell', description: 'Snabbast till bra resultat: utgå från GPT-2 eller svenska GPT-SW3 och träna vidare på er text.', language: 'python', run: 'pip install transformers datasets accelerate torch && python finjustera.py', files: [{ path: 'finjustera.py', content: HF }] }
      ] },
      design: { source: 'demo', variants: [
        { name: 'Arkitekturdiagram', idea: 'Hur bitarna sitter ihop – perfekt i presentationen.', kind: 'diagram', html: DIAGRAM },
        { name: 'Startsida för produkten', idea: 'Mörk, modern sida med chattdemo.', kind: 'ui', html: LANDING },
        { name: 'Logga', idea: 'Tre noder som "tittar" på en fjärde – uppmärksamhet som symbol.', kind: 'logo', html: LOGO }
      ] },
      tutorial: { source: 'demo', variants: [{
        name: 'Från noll till egen AI på en kväll', level: 'Nybörjare',
        chapters: [
          { title: '1. Förbered datorn', text: 'Installera Python från python.org. Öppna en terminal och skriv kommandot nedan. Har ni inget grafikkort går det också – bara långsammare. Eller öppna colab.research.google.com och välj GPU under Körning → Ändra körtyp.', code: 'pip install torch numpy', check: 'Kommandot slutar utan röd text.' },
          { title: '2. Förstå uppmärksamhet', text: 'Kör attention.py. Tabellen visar hur mycket varje ord tittar på de tidigare orden. Lägg märke till att ingen tittar framåt – det är masken.', code: 'python attention.py', check: 'Ni ser en tabell med siffror mellan 0 och 1.' },
          { title: '3. Samla text', text: 'Spara er text i data.txt bredvid koden. Ju mer desto bättre. Ta bort konstiga tecken ni inte vill att AI:n ska lära sig.', code: '', check: 'data.txt är större än 1 MB.' },
          { title: '4. Träna', text: 'Kör mini_gpt.py. Varje 300:e steg skrivs förlusten ut. Den ska sjunka. Tar det för lång tid? Minska steps till 1000.', code: 'python mini_gpt.py', check: 'Validering under ungefär 1,6.' },
          { title: '5. Låt den skriva', text: 'När träningen är klar skriver programmet 500 tecken. Ändra temp=0.8 till 0.5 för säkrare text eller 1.2 för galnare.', code: '', check: 'Texten liknar er data.' },
          { title: '6. Nästa nivå', text: 'Prova finjustera.py med en färdig svensk modell. Den kan redan språket och lär sig snabbt er stil.', code: 'python finjustera.py', check: 'Modellen skriver hela meningar.' }
        ]
      }] },
      buy: { source: 'demo', variants: [{ name: 'Tre budgetnivåer', note: 'Ungefärliga priser i kronor (2026) – kolla aktuella priser innan ni köper.', lists: [
        { tier: 'Gratis', items: [{ name: 'Google Colab (gratis GPU)', why: 'Räcker för mini-GPT och finjustering av små modeller.', priceSek: 0, where: 'colab.research.google.com' }, { name: 'Datorn ni redan har', why: 'NumPy-varianten och kod-skrivande.', priceSek: 0, where: '–' }] },
        { tier: 'Mellan', items: [{ name: 'Grafikkort med 16–24 GB minne', why: 'Tränar mini-GPT på minuter och finjusterar modeller upp till ~1 miljard parametrar.', priceSek: 9000, where: 'Komplett, Inet, begagnat på Blocket' }, { name: '32 GB RAM', why: 'Stora datamängder i minnet.', priceSek: 1000, where: 'Komplett, Inet' }, { name: '2 TB NVMe SSD', why: 'Data och modeller tar plats.', priceSek: 1200, where: 'Komplett, Inet' }] },
        { tier: 'Pro', items: [{ name: 'Moln-GPU (t.ex. H100) per timme', why: 'Betala bara när ni tränar stort.', priceSek: 35, where: 'RunPod, Lambda, Google Cloud' }, { name: 'Arbetsstation med toppgrafikkort', why: 'Egen kraftfull maskin för teamet.', priceSek: 45000, where: 'Specialbyggd hos Inet/Komplett' }] }
      ] }] },
      names: { source: 'demo', variants: [{ name: 'Namnförslag', names: [
        { name: 'Transformia', slogan: 'Uppmärksamhet är allt.', why: 'Låter som transformer + magi.', domain: 'transformia.se' },
        { name: 'Ordflöde', slogan: 'Svensk AI som skriver som ni.', why: 'Svenskt, enkelt att säga.', domain: 'ordflode.se' },
        { name: 'Kalle-GPT', slogan: 'Karls team bygger framtiden.', why: 'Personligt och roligt – bra för en intern demo.', domain: 'kallegpt.se' },
        { name: 'Nästa Ord', slogan: 'Vi gissar rätt.', why: 'Beskriver exakt vad modellen gör.', domain: 'nastaord.se' },
        { name: 'Fokus AI', slogan: 'Den tittar på det viktiga.', why: 'Leker med uppmärksamhet.', domain: 'fokusai.se' }
      ] }] }
    }
  };
})();
