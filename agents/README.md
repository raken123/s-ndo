# ChatGPT Agents

A ChatGPT-style chat app built around **agents**. Create as many agents as you
like, each with its own instructions, model and computer, and talk to them one
at a time or together in group chats.

Independent app, not affiliated with OpenAI. It talks to the OpenAI API using
your own key.

![Build plan](plan/plan.png)

## Features

- **ChatGPT-style interface**: dark sidebar with chat history and search, the
  "What can I help with?" start screen, the rounded composer, a model picker in
  the header, streaming Markdown replies with code blocks, and copy/regenerate.
  Works on phone screens too.
- **Agents**: name, instructions, model, and an icon made of a shape (blob,
  circle, square, triangle, star, hexagon, diamond, cloud) in one of ten colours
  with two white eyes. You can create, edit, duplicate and delete agents.
- **Group chats**: put any agents in a chat.
  - *Parallel* (default): every agent answers at the same time, which is the
    fast mode.
  - *Round-table*: agents answer one after another, and each one reads the
    replies before it.
  - Type `@Name` to ask just one agent.
- **A computer for every agent**: each agent gets its own sandboxed JavaScript
  runtime (a separate Web Worker) and its own file system, saved on the
  device. Agents have these tools: `run_javascript`, `write_file`, `read_file`,
  `list_files`, `delete_file`, `show_on_screen` (renders an HTML file the agent
  built, live and clickable) and `fetch_url`. Open **Computers** in the header
  to see each agent's screen, files and terminal, or to type code into the
  terminal yourself. In a parallel group chat the computers all run at once.
- **Models**: GPT-4o, GPT-4o mini, GPT-4.1, GPT-4.1 mini, o3, o4-mini, GPT-5,
  GPT-5 mini, GPT-5 nano and **GPT-6 Astra**. *Settings → Load my models*
  adds every chat model your key can actually use, and you can type in any
  custom model ID. A model your key doesn't have returns a clear error in the
  chat.
- **Build plan**: the plan screenshot is built into the app (sidebar →
  *Build plan*).
- **Privacy**: the API key, chats, agents and files live in the device's local
  storage. *Export all* writes a JSON backup without the key.

## Plans (Google Pay, TEST environment)

| | Free | Plus | Ultra |
|---|---|---|---|
| Price | $0 | $35 / month | $795 / month |
| Models | GPT-5 nano and GPT-4o mini | All, up to GPT-6 Astra | All |
| Credits | 60 every day you open the app | 1,500 per month | Unlimited |
| Intelligent UI | – | Yes | Yes |
| Images (GPT Image 2.5 Sunburst) | – | 3 a day | Unlimited |
| Local Mode | – | – | Yes |

- **Credits:** one agent reply costs 1 credit, so a reply from 4 agents in a group chat
  costs 4. A reply that fails with an error is refunded. Free credits don't carry over:
  you get a fresh 60 on the first open of each day.
- **Intelligent UI:** agents can put buttons, checklists, forms and sliders into a reply
  (a fenced `ui` block of JSON). Tapping a button or sending a form goes back to the agent
  as your reply.
- **Images:** the `generate_image` tool calls `/v1/images/generations` with the model ID
  `gpt-image-2.5-sunburst`. That only works if your API key has access to a model with
  that ID, the same as GPT-6 Astra. You can enter another image model ID in Settings.
  Images are stored in the device's IndexedDB.
- **Local Mode:** agents talk to an OpenAI-compatible server on your computer (Ollama at
  `http://localhost:11434/v1` by default, or LM Studio), with no API key. Start Ollama with
  `OLLAMA_ORIGINS=*` so the app is allowed to connect.

### Checkout

*Upgrade plan* (in the sidebar or Settings) opens the plans screen. *Get Plus* or *Get
Ultra* shows the order and a Google Pay **Subscribe** button. The Google Pay client
runs with `environment: "TEST"`, so Google shows test cards, returns a dummy token and
never charges anything. The app then switches the plan on locally. Settings shows the plan,
the renewal date and the test card, and lets you cancel.

To try it, open the app over **https or localhost** in Chrome, signed in to a Google
account (for example `npx serve dist` and then `http://localhost:3000/chatgpt-agents`).
Google Pay may refuse pages opened straight from a `file://` path. Inside the desktop
and phone apps it hasn't been tried yet; the desktop app lets Google's payment window
open, but Android's WebView may need extra setup for Google Pay.

### Going live

These settings live in `PAY` at the top of the plans code in `src/index.html`.

1. Sign up in the Google Pay & Wallet Console, get your `merchantId`, and pass Google's
   integration review.
2. Pick a payment gateway that supports Google Pay and recurring billing (Stripe,
   Adyen, Braintree…). Put its name and your gateway merchant ID in `PAY.gateway`.
3. Run a small server at `PAY.serverUrl`. It takes the token, charges it through the
   gateway, creates the monthly subscription, and tells the app which plan is active.
4. Set `environment: "PRODUCTION"`.

Two more things matter before real money is involved:

- **Plans can't be enforced inside the app.** Plans and credits are checked in the app,
  and its data sits in the user's own browser storage, so a technical user can edit it.
  As long as people chat using their own API key, that is the most the app can do. To
  really enforce plans, model calls have to go through your server with your key, and
  the server keeps the credit count.
- **Play Store policy.** If you publish the Android app on Google Play, Google requires
  Google Play Billing for digital subscriptions instead of Google Pay. Google Pay is
  fine for the web version and for builds distributed outside the Play Store.

## API key

The key is **not** built into any of the apps or into this repository. If it
were, anyone who downloaded the app could pull it out and spend your credit.
Paste it in **Settings** on first launch.

## Builds

| Build | Made by | Output |
|---|---|---|
| HTML | `python3 build.py` | `dist/chatgpt-agents.html` (one self-contained file) |
| EXE | Electron + NSIS (`electron/`) | `ChatGPT-Agents-Setup-1.0.0.exe` |
| DMG | Electron (`electron/`), ad-hoc signed | `ChatGPT-Agents-1.0.0-arm64.dmg`, `-x64.dmg` |
| APK | Capacitor (`mobile/`) | `ChatGPT-Agents-1.0.0.apk` |
| IPA | Capacitor (`mobile/`), unsigned | `ChatGPT-Agents-1.0.0.ipa` |

`.github/workflows/agents-build.yml` builds all five on GitHub's Windows,
macOS and Linux runners whenever `agents/` changes, and publishes them as the
`agents-v1.0.0` release. Run it by hand from the Actions tab with
*Run workflow*.

Signing: the EXE and DMGs aren't signed with a paid certificate, so Windows
SmartScreen and macOS Gatekeeper will ask you to confirm the first time. The
IPA is unsigned because Apple only lets signed apps onto an iPhone. AltStore
or Sideloadly can sign it with a free Apple ID, or you can use a developer
certificate.

## Layout

```
agents/
  src/index.html      the whole app (HTML + CSS + JS, no dependencies)
  plan/plan.html      the build plan; plan.png is its screenshot
  build.py            inlines plan.png -> dist/chatgpt-agents.html
  assets/             app icon (png, ico) and logo for mobile icons
  electron/           desktop shell + electron-builder config
  mobile/             Capacitor config for Android / iOS
  test/verify.js      browser test against a mocked OpenAI API
  test/plans.js       plans + Google Pay (TEST) checkout test
```

## Testing

`node test/plans.js` checks the plans and the checkout (44 checks). Google's `pay.js` is
replaced by a stand-in with the same API as the TEST environment. It covers:

- credits and daily or monthly top-ups
- model locks
- the plans screen
- the Plus and Ultra checkouts, and the exact payment request sent to Google Pay
- a closed payment sheet
- Intelligent UI buttons
- the image limit
- Local Mode
- cancelling a plan
- phone layout

`node test/verify.js` drives the built HTML in headless Chromium against a
mocked OpenAI API. It runs 26 checks, covering:

- streaming and Markdown rendering
- the key prompt
- creating an agent
- a four-agent parallel group chat
- tool calls on an agent's computer, and the screen rendering and responding
  to clicks
- separate computers per agent
- the terminal
- `@mention` routing
- the built-in plan image
- persistence across reload
- the GPT-6 Astra entry
- phone layout
- no page errors
