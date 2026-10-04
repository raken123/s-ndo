# Hub AI Cloud

The server the Hub AI apps talk to. The Hub agents run here, as do Gemini
3.8 Flash and Pro. Plans, credits and daily caps are enforced here too.
It only needs Python 3.10+ (standard library only) and API keys.

## Agents

Each Hub agent starts from a base model, gets Hub's instructions (rules for
building a hub, plus a polish level per tier), and can be fine-tuned on Hub
examples (see [Training](#training)).

| Agent | Base model | Default API model id | Credits |
|---|---|---|---|
| Hub V1 Mini | GPT-4o | `gpt-4o` | 1 |
| Hub V1 Lite | GPT-4.5 | `gpt-4.5-preview` | 1 |
| Hub V1 Standard | GPT-5 | `gpt-5` | 2 |
| Hub V1 Plus | GPT-5.6 Sol | `gpt-5.6-sol` | 3 |
| Hub V1 Max | GPT-6 Astra | `gpt-6-astra` | 5 |
| Hub V2 Max | GPT-6 Astra + GPT-6 Sol | `gpt-6-astra`, then `gpt-6-sol` | 100 |
| Gemini 3.8 Flash | — | `gemini-3.8-flash` | 3 |
| Gemini 3.8 Pro | — | `gemini-3.8-pro` | 10 |

Hub V2 Max uses two models: GPT-6 Astra builds the hub, then GPT-6 Sol
reviews it and returns a fixed version.

**Check the model ids.** They follow the names Hub AI uses. `gpt-4o` and
`gpt-5` are real OpenAI ids, but `gpt-4.5-preview` has been retired by OpenAI.
`gpt-5.6-sol`, `gpt-6-astra`, `gpt-6-sol` and the Gemini 3.8 ids are
placeholders until those models exist under those names. Point an agent at
another model without code changes:

```sh
HUBAI_MODEL_LITE=gpt-4.1
HUBAI_MODEL_V2MAX=gpt-5,gpt-5-mini      # builder, reviewer
HUBAI_MODEL_FLASH=gemini-2.5-flash
```

If a model id doesn't exist, generating with that agent fails with the
API's error and the user's credits are refunded.

## Plans

| | Free | Go ($2/mo) | Plus ($12/mo) | Enterprise ($120,000/seat/yr) |
|---|---|---|---|---|
| Credits | 10/day, 200/year | 100/day | 1,000/month | 100,000/month |
| Agents | Mini | Mini, Lite, Standard, Gemini Flash | + Plus, Max (5/day), Gemini Pro (3/day) | Everything, incl. **Hub V2 Max** |

Payments are a demo: subscribing records the plan and a `DEMO-` receipt;
no card data reaches the server. Hub Enterprise can't be bought in the
app. It is for very large companies, and an operator moves their accounts
onto it:

```sh
python -m hubcloud.admin set-plan acc_1234abcd enterprise      # where the database lives
curl -X POST https://YOUR-SERVER/v1/admin/plan -H "X-Admin-Key: $HUBAI_ADMIN_KEY" \
     -H "Content-Type: application/json" -d '{"account": "acc_1234abcd", "plan": "enterprise"}'
```

Users find their account id in the app under Settings (and in the
Hub Enterprise sheet).

## Run it

```sh
export OPENAI_API_KEY=sk-...        # Hub agents
export GEMINI_API_KEY=...          # Gemini 3.8 Flash / Pro
export HUBAI_ADMIN_KEY=$(openssl rand -hex 24)   # optional, for /v1/admin/plan
python -m hubcloud --port 8787     # data in ./hubai.sqlite3 (or HUBAI_DB)
```

Try it without keys: `HUBAI_FAKE_MODELS=1 python -m hubcloud` returns small
placeholder hubs that name the model they would have used.

### Deploy

Any host that runs a Docker image or a Python process works. With Docker:

```sh
docker build -t hub-ai-cloud hub-ai/cloud
docker run -p 8787:8787 -v hubai-data:/data \
  -e OPENAI_API_KEY -e GEMINI_API_KEY -e HUBAI_ADMIN_KEY hub-ai-cloud
```

On Render, Railway, Fly.io and similar: create a web service from this
repository with **root directory `hub-ai/cloud`**, let it use the Dockerfile,
set the environment variables above, and attach a disk at `/data`. Without
one, accounts and plans reset on every deploy.

The apps need HTTPS (Android refuses plain HTTP), which those hosts provide.

### Connect the apps

- **In the app:** Settings → Hub AI Cloud → server address, e.g.
  `https://hub-ai-cloud.onrender.com`.
- **Built in:** set the repository variable `HUBAI_CLOUD_URL` (GitHub →
  Settings → Secrets and variables → Actions → Variables). CI writes it into
  `www/js/config.js`, so new APK, DMG, EXE and DEB builds connect without
  setup.

## API

| | |
|---|---|
| `GET /v1/health` | liveness |
| `GET /v1/config` | agents, base models, plans |
| `POST /v1/accounts` | new anonymous account → `{account, token}` |
| `GET /v1/me` | plan, credits, daily caps, receipts |
| `POST /v1/subscribe {"plan"}` | demo checkout (`free`, `go`, `plus`) |
| `POST /v1/cancel` | cancel at the end of the period |
| `POST /v1/generate {"engine", "prompt"}` | build a hub → `{html, title, base, me, …}` |
| `POST /v1/admin/plan {"account", "plan"}` | needs `X-Admin-Key` |

Calls other than health, config and accounts send `Authorization: Bearer <token>`.
Only a SHA-256 of each token is stored.

## Training

Fine-tuning teaches each agent Hub's format and its tier's level of polish,
using examples rendered from the app's hub templates.

```sh
cd hub-ai/cloud
python training/build_dataset.py       # -> training/out/<agent>.train.jsonl / .valid.jsonl
export OPENAI_API_KEY=sk-...
python training/finetune.py            # fine-tunes every agent, waits, writes agents.json
python training/finetune.py --tier mini --no-wait   # or submit now...
python training/finetune.py --collect               # ...and collect later
```

- `training/hubspec.py`: hub types, plus examples and template features per agent.
- `training/dataset.py`: request phrasings. Add your own to `training/data/extra.jsonl`.
- `agents.json`: the fine-tuned model per agent. The server reads it on
  every request, so commit it and redeploy (or copy it to the server).
- OpenAI only fine-tunes some models. When it refuses an agent's base
  model, the script says so and that agent keeps running as the base model
  with Hub's instructions. Fine-tuning is billed by OpenAI.

## Tests

```sh
python -m unittest discover -s tests -v
```

These cover the API, plans, credits, caps, refunds, the Enterprise lock, the
exact requests sent to OpenAI and Gemini (against a local stand-in), the
datasets, and `finetune.py`. They need Node.js for the dataset tests.
