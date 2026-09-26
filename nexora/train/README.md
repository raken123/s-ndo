# Din egen Nexora-modell: träna med PyTorch

Det här paketet tränar en egen AI-modell för Nexora med **PyTorch**, och **ingen API-nyckel
behövs**. Modellen svarar på allt appen frågar efter:

- spel i vilken genre som helst
- buggfixar
- SVG-sprites
- 3D-modeller
- musik
- ljudeffekter
- text

I appen väljer du **⚙️ Inställningar → Din egen modell**.

## Så fungerar det

1. **Basmodell.** Utgångspunkten är en öppen kodmodell. Standard är
   `Qwen/Qwen2.5-Coder-1.5B-Instruct` (Apache 2.0), och den laddas ner från Hugging Face
   utan nyckel.
2. **Självspel.** Modellen svarar på förfrågningarna i `colab/nexora_prompts.json`: 85
   spelidéer att träna på, 20 sprites, 20 3D-modeller, 12 musikstycken, 16 ljudeffekter och
   10 texter. Förfrågningarna byggs med appens egna promptfunktioner (`PROMPTS` i
   `src/ai.js`), så modellen tränas på exakt det den sedan får frågor om.
   - **Spel** spelas i headless Chromium på samma sätt som appens självtest: klick,
     mellanslag, piltangenter och WASD, sedan en kontroll av fel, färger och om bilden rör sig.
   - Om alla försök misslyckas skickas felen tillbaka med appens buggfix-förfrågan. Då
     lär sig modellen också att rätta sina egna spel.
   - **Övriga svar** kontrolleras mot det appen kan använda: välformad SVG med viewBox och
     inga externa länkar, giltiga mesh-index, noter i rätt format, syntlager och så vidare.

   Bara godkända svar sparas som träningsdata.
3. **Träning.** LoRA-adaptrar tränas med en ren PyTorch-loop:
   - AdamW med uppvärmning och cosinus-schema
   - gradientackumulering och gradientklippning
   - blandad precision (bf16/fp16) och gradient checkpointing

   Bara modellens svar räknas i förlusten. En del av datan hålls utanför för
   valideringsloss, och adaptern med lägst valideringsloss sparas.
4. **Nya varv.** Den tränade modellen gör nästa varv självspel och blir bättre på det den
   klarar, och sedan tränas den igen.
5. **Utvärdering.** Åtta spelidéer som modellen aldrig har tränat på testas före och efter
   träningen i `runs/nexora-egen/eval-*.json`.

Startdatan är exemplen i `marketing/examples/` (sex spel och fyra 3D-modeller). Du kan
lägga till dina egna spel från appen: *Mina spel → 🧠 Träningsdata*, sedan `--own fil.jsonl`.

## Kom igång

Installera PyTorch för din dator från pytorch.org (CUDA, Apple Silicon eller CPU) och sedan:

```sh
cd nexora/train
pip install -r requirements.txt
python -m playwright install chromium

python -m nexora_model all          # data → (självspel → träning) × 2 → utvärdering
python -m nexora_model serve        # http://127.0.0.1:8000/v1 → välj "Din egen modell" i appen
```

Du kan också köra stegen ett i taget:

| Kommando | Vad det gör |
|---|---|
| `data [--own export.jsonl]` | bygger startdatan och utvärderingsidéerna, utan PyTorch |
| `selfplay [--round N] [--samples 3] [--limit N] [--kinds game,svg]` | modellen skriver svar, och bara godkända sparas i `data/selfplay-N.jsonl`; kan återupptas |
| `train [--epochs 2] [--lr 2e-4] [--max-len 6144] [--lora-r 16] [--continue]` | PyTorch + LoRA på allt som samlats |
| `eval` | spelar ett spel per okänd idé och rapporterar hur många som fungerar |
| `serve [--port 8000] [--dummy]` | kör modellen för appen (OpenAI-kompatibelt API). `--dummy` ger testsvar utan modell, för att prova anslutningen |
| `merge` | bakar in adaptern i basmodellen i `runs/nexora-egen/merged`, som sedan kan startas med `serve --model <mappen>` |

`--base` väljer basmodell (0.5B, 1.5B, 3B eller 7B, eller en lokal mapp). `--4bit` kör
QLoRA, så att 7B ryms på 16 GB GPU, och kräver `bitsandbytes`.

## Hårdvara och tid

| Basmodell | Rimlig hårdvara | Ett varv (163 förfrågningar × 3 försök) |
|---|---|---|
| 0.5B | valfri GPU, Apple M1+ eller CPU (långsamt) | ungefär 1 h på en T4 |
| 1.5B (standard) | GPU med 8 GB+, eller Apple M-serien med 16 GB | ungefär 2–3 h på en T4 |
| 7B | GPU med 24 GB, eller 16 GB med `--4bit` | ungefär 6–8 h på en A100 |

Tiderna är uppskattningar och har inte mätts, eftersom paketet inte har kunnat köras med en
GPU ännu. Använd `--limit 10` för en snabb provkörning. Samma kedja finns som
Colab-anteckningsbok (`colab/Nexora_Flash_1_Colab.ipynb`) på Colabs gratis-GPU, med en
publik adress till appen.

## Vad man kan förvänta sig

En liten modell som tränas så här blir bättre på Nexoras format och på att skriva spel som
startar och fungerar. Andelen godkända spel på okända idéer visas efter varje körning. Den
blir inte lika bra som stora modeller som Claude: fler varv, en större basmodell och dina
egna spel från appen är det som höjer kvaliteten. Godot-läget i Astryx använder verktyg och
skärmbilder, som bara Claude stöder. Med din egen modell bygger Astryx HTML5-spel.

## Tester

```sh
cd nexora/train && python -m unittest discover -s tests -v
```

Testerna täcker kontrollerna av svaren, datauppdelningen, startdatan, buggfix-förfrågan,
servern (vanlig och strömmande, CORS och felaktiga förfrågningar) och kommandoraden. De
kräver inte PyTorch. Appens egna tester (`build/verify.js`) startar dessutom den riktiga
servern (`serve --dummy`) och genererar ett spel, en 3D-modell och en bild genom den.
