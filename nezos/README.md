# Nezos: build 3D games with AI

Nezos is a web app for building 3D games. The studio has a Figma-style editor (layers, canvas, inspector, toolbar) with an AI chat bar next to it. You describe what you want, and the AI generates the game: 3D models, AI images, scenes, gameplay code, architecture plans and automated playtests.

## Features

| Toolbar | What it does |
|---|---|
| **3D Model** | Add primitives, or generate a low-poly model from text (built from up to 60 parts) |
| **Image** | AI textures, skyboxes, sprites and in-world images (GPT Image 1 mini / 1 / 1.5 / 2 / 2.5) |
| **Scene** | Generate a world or a whole game. Edit sky, fog, gravity and the play camera |
| **Light / Text** | Sun, point, spot and hemisphere lights; 3D text signs |
| **Audio** | AI voice lines and narration (OpenAI TTS); scripts play them with `game.sound.play()` |
| **Video** | Sora 2 / Sora 2 Pro clips shown on in-game screens |
| **Code** | Script editor for the global game script or a per-object script |
| **More** | Architect a plan, AI playtest, export a single-file HTML game, share a playable link |

**Chat modes:** Auto, Game, Scene, 3D Model, Code, Architect, Playtest. The AI answers with structured scene operations (`add`, `update`, `remove`, `settings`, `script`, `replaceScene`). The studio applies them as one undoable step, and each reply has an **Undo this change** link. In Playtest mode, a bot plays the game for 12 seconds and collects errors, fps, player trajectory and a screenshot; the AI then diagnoses problems and fixes them.

**Other features:** gizmos (move, rotate, scale, snap), undo/redo, autosave with thumbnails, voice prompts (speech to text), keyboard shortcuts.

## Accounts, credits and plans

- Sign up with email and password. **Every new account gets 100 credits.**
- Each AI request costs credits based on the model tier. A failed request is refunded automatically.

| Plan | Price | Credits / month | Projects | Unlocks |
|---|---|---|---|---|
| **Free** | $0 | (100 on sign-up) | 3 | Nano text models (GPT-5.4 nano, GPT-5 nano, GPT-4.1 nano, GPT-4o mini), GPT Image 1 mini |
| **Mini** | $5 | 500 | 10 | + Mini models (GPT-5.4 mini, GPT-5 mini, o4-mini, o3-mini…), AI playtesting, AI voice |
| **Starter** | $15 | 1,500 | 25 | + GPT-5 / 5.1 / 5.2, GPT-4.1, GPT-4o, Codex, GPT Image 1 / 1.5, voice prompts |
| **Pro** | $40 | 5,000 | 100 | + GPT-5.5, GPT-5.4, o3, o1, Codex Max, GPT Image 2, Sora 2 |
| **Elite** | $100 | 20,000 | Unlimited | Everything: GPT-6.x, GPT-5.6, every *-pro model, GPT Image 2.5, Sora 2 Pro, new models as they ship |

Credit cost per request: nano 1 · mini 2 · standard 5 · advanced 10 · frontier 25 (Pro models 40–60) · images 3–15 · TTS 2–3 · transcription 1–2 · Sora 60 / 150 per 4 s. "Think" and "Think hard" multiply the cost of reasoning models by 1.5× and 2.5×.

**All OpenAI models.** At startup, the server reads `GET /v1/models` and merges the result into the catalog in `src/models.js`. Dated snapshots inherit their family's tier. Any model OpenAI adds later is detected automatically and unlocked on Elite. Models that don't fit the studio (embeddings, realtime, search, deep-research, legacy completions) are listed on `/models` as API-only.

## Running it

```bash
cd nezos
cp .env.example .env      # then put your OpenAI key in .env
npm install
npm start                 # http://localhost:3000
npm test
```

Requires Node 20+. Data (users, projects, generated assets) lives in `nezos/data/`, which is git-ignored.

## Before going live

- **Billing:** `BILLING_MODE=demo` lets users switch plans for free. Connect a payment provider (for example Stripe Checkout plus webhooks that call `changePlan()` in `src/auth.js`), then set `BILLING_MODE=live`.
- **Storage:** `src/db.js` is a single-process JSON store. Move to Postgres or SQLite and object storage for assets before scaling out.
- Set `NODE_ENV=production` (Secure cookies) and `TRUST_PROXY=1` behind a proxy. Serve over HTTPS.
- Email verification and password reset aren't implemented yet.

## Security notes

- The OpenAI key stays on the server. The browser only talks to `/api/*`.
- AI- and user-written game code never runs on the app's origin. Play mode runs inside an `<iframe sandbox="allow-scripts">` (opaque origin, no cookies or API access), and `/play.html` and `/g/:id` are also served with a `CSP: sandbox` header.
- Passwords are hashed with scrypt; sessions are random tokens stored as SHA-256 hashes in HttpOnly SameSite=Lax cookies. Every state-changing API call requires an `x-nezos` header (CSRF guard). Auth and AI endpoints are rate-limited.
- Image, voice and video prompts pass through OpenAI moderation first.

## Layout

```
server.js               Express app: auth, billing, projects, AI endpoints, export/share
src/plans.js            Free / Mini / Starter / Pro / Elite
src/models.js           OpenAI model catalog, tiers, live discovery
src/openai.js           REST wrapper (Responses API, Chat Completions fallback, images, TTS, STT, Sora, moderation)
src/prompts.js          AI system prompts and the engine contract the model writes against
src/auth.js             Users, sessions, credits
public/js/engine/       Game engine (scene builder, runtime, physics, HUD, sound, playtest bot)
public/js/studio/       Studio: viewport, layers, inspector, chat, tools, play mode
```
