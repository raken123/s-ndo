# Hub AI Cloud

The server the Hub AI apps talk to. The Hub agents run here; plans, credits
and daily caps are enforced here too. It only needs Python 3.10+ (standard
library only) and a Gemini API key.

## Agents

Every Hub agent is a Gemini model plus Hub's instructions for each creation
type (app, animation, slides, card, 3D model, UI design, picture, game,
website, infographic, logo, diagram, document) and a polish level per agent.
**The apps never learn this**: `/v1/config`, `/v1/me` and `/v1/generate` only
carry Hub V1 names and credit costs, the agents are told to present
themselves only by their Hub V1 name, and model errors reach the apps as
"Hub V1 … couldn't finish this one" (the details go to the server log).
Keep it that way when you change things: `tests/test_server.py` checks that
no API answer mentions the provider.

| Agent | Default model id | Makes | Credits |
|---|---|---|---|
| Hub V1 Spark | `gemini-3.1-flash-lite` | everything but pictures | 1 |
| Hub V1 Flux | `gemini-2.5-flash` | everything but pictures | 1 |
| Hub V1 Volt | `gemini-3-flash-preview` | everything but pictures | 2 |
| Hub V1 Prism | `gemini-2.5-pro` | everything but pictures | 3 |
| Hub V1 Titan | `gemini-3.1-pro-preview` | everything but pictures | 6 |
| Hub V1 Pixel | `gemini-2.5-flash-image` | pictures and photo edits | 4 |
| Hub V2 Max 🤫 | `gemini-3.1-pro-preview`, twice | everything but pictures | 100 |

Hub V2 Max is secret: `/v1/config` never lists it, and for accounts outside
Hub Enterprise it answers "Unknown engine". Enterprise accounts get it in
`/v1/me` (`secretEngines`). It runs two passes: one builds the hub, the
second reviews it and returns a fixed version.

3D models are asked for as JSON (unit shapes, scaled, rotated and coloured);
`hubcloud/viewer3d.py` checks the scene and wraps it in a self-contained
WebGL viewer that exports GLB and OBJ.

**Check the model ids before you deploy.** Gemini models are renamed and
retired often: `gemini-2.5-pro` is scheduled to shut down on the Gemini
API on 16 October 2026, `gemini-3-flash-preview` is deprecated, and the
`-preview` ids change when models go stable. Point an agent at another model
without code changes:

```sh
HUBAI_MODEL_PRISM=gemini-3.5-flash
HUBAI_MODEL_V2MAX=gemini-3.1-pro-preview,gemini-3.1-pro-preview   # builder, reviewer
```

If a model id doesn't exist, generating with that agent fails and the
user's credits are refunded.

## Plans

| | Free | Go ($2/mo) | Plus ($12/mo) | Enterprise ($120,000/seat/yr) |
|---|---|---|---|---|
| Credits | 10/day, 200/year | 100/day | 1,000/month | 100,000/month |
| Agents | Spark, Flux, Pixel | + Volt | + Prism, Titan (5/day) | Everything, incl. **Hub V2 Max** |
| Tools | 5 | 10 | 15 | 20 |

Payments are a demo: subscribing records the plan and a `DEMO-` receipt;
no card data reaches the server. All four plans can be bought in the app
(Enterprise renews yearly). An operator can also move an account directly:

```sh
python -m hubcloud.admin set-plan acc_1234abcd enterprise      # where the database lives
curl -X POST https://YOUR-SERVER/v1/admin/plan -H "X-Admin-Key: $HUBAI_ADMIN_KEY" \
     -H "Content-Type: application/json" -d '{"account": "acc_1234abcd", "plan": "enterprise"}'
```

Users find their account id in the app under Settings.

## Run it

```sh
export GEMINI_API_KEY=...          # every Hub agent
export HUBAI_ADMIN_KEY=$(openssl rand -hex 24)   # optional, for /v1/admin/plan
python -m hubcloud --port 8787     # data in ./hubai.sqlite3 (or HUBAI_DB)
```

Or put the settings in `hub-ai/cloud/.env` (one `KEY=value` per line, e.g.
`GEMINI_API_KEY=...`). The server reads it at start-up for anything not set
in the environment. It is git-ignored and kept out of the Docker image,
because this repository is public: a key committed here can be used by
anyone and is disabled by Google once it is found.

Try it without keys: `HUBAI_FAKE_MODELS=1 python -m hubcloud` returns small
placeholder results (a small page, a 3D rocket, a gradient picture) that
name the model they would have used.

### Deploy

Any host that runs a Docker image or a Python process works. With Docker:

```sh
docker build -t hub-ai-cloud hub-ai/cloud
docker run -p 8787:8787 -v hubai-data:/data \
  -e GEMINI_API_KEY -e HUBAI_ADMIN_KEY hub-ai-cloud
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
| `GET /v1/config` | agents (names and costs only), creation types, plans, tools |
| `POST /v1/accounts` | new anonymous account → `{account, token}` |
| `GET /v1/me` | plan, credits, daily caps, receipts |
| `POST /v1/subscribe {"plan"}` | demo checkout (`free`, `go`, `plus`, `enterprise`) |
| `POST /v1/cancel` | cancel at the end of the period |
| `POST /v1/generate {"engine", "prompt", "kind"?, "mode"?, "html"?, "lang"?, "data"?, "dataName"?, "image"?}` | make something → `{html, title, kind, me, …}` (+ `image` for pictures). `kind`: one of the creation types (default `app`); `image` needs Hub V1 Pixel. `mode`: `create` (default), `refine` (every plan), `fix` and `translate` (Plus; not for pictures or 3D). `data`: an attached file, up to 100 KB (Plus). `image`: a PNG/JPEG/WebP data URL to edit, up to about 6 MB |
| `POST /v1/admin/plan {"account", "plan"}` | needs `X-Admin-Key` |

Calls other than health, config and accounts send `Authorization: Bearer <token>`.
Only a SHA-256 of each token is stored.

## Tests

```sh
python -m unittest discover -s tests -v
```

These cover the API, plans, credits, caps, refunds, the Enterprise lock, every
creation type, 3D scenes and photo edits, that nothing the apps receive names
the provider, and the exact requests sent to the model API (against a local
stand-in).
