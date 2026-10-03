# BFDI Talk

Talk out loud with your own object-show character. It answers in a real voice, its mouth
lip-syncs to the speech, and its eyes and mouth change with its mood. It runs on
**Gemini 3.8 Flash Live** (`gemini-3.8-live`) or **Gemini 3.8 Live Extended Thinking**
(`gemini-3.8-live-extended-thinking`).

Builds: **Windows `.exe`**, **macOS `.dmg`**, **Android `.apk`** and **one `.html` file** (the website
with the whole app inside). All of them use the same web app in `www/`. Electron wraps it for desktop,
Capacitor for Android, and `tools/make_site.mjs` packs it into a single HTML file.

## Features

- **Live voice chat.** Talk hands-free, or turn on push-to-talk (hold the button or Space).
  You can also type.
- **Lip-sync.** The character's own speech audio picks one of four mouth shapes for each emotion
  (closed / small / medium / wide), plus an "oo" mouth for round vowels.
- **Emotions.** The AI calls a `set_expression` tool before each reply. The app has 19 emotions,
  each with its own eye set and mouths from your sprite sheets. If the AI skips the call, the app
  guesses an emotion from the words.
- **Characters.** 7 body shapes, 10 colours, a name, and personality presets or your own text.
- **30 Gemini voices** to choose from.
- **Usage meter (free).** One pool shared by both models:
  - 100% lasts about 20 minutes on Flash Live and about 8 minutes on Extended Thinking
    (2.5× cost).
  - At **0%** the meter refills to 100% after **1 hour** (**30 minutes on Pro**). If you have
    Usage Credits you keep talking on credits meanwhile. If not, the character is knocked out
    (XX eyes) and a countdown shows.
  - After 75 quiet seconds the call hangs up so nothing drains (not while video/screen is on).
- **Usage Credits.** A wallet separate from the meter, with no upper limit.
  **1 credit = 1 second of Flash Live** (Extended Thinking spends 2.5 per second). Credits
  are only used while the meter is empty, and they never expire.
  - Credits come with the plans (below) and the December 23 drop. There is nothing to buy right
    now.
- **Accounts** (Supabase). Email + password sign-up with a username. Credits and plan
  follow you to every device.
- **Plans: free to switch, no payment.** Tap a plan in the app and you're on it straight away.
  Stripe is gone; nothing ever asks for a card.

  | Plan | Every month | Extras |
  |---|---|---|
  | **Lite** | 1,500 credits | bigger Playshow episodes, eliminations, seasons |
  | **Pro** | 5,000 credits | 📷 video live, 🖥️ screen live, meter refills in 30 min, 👑 PRO crown |

  - Monthly credits arrive the moment you switch, then every 30 days (claimed when the app
    opens). Switching up mid-month tops up the difference; switching back and forth never pays a
    month twice. Credits stay when you go back to Free.
  - Signed in, the plan is saved on the server (`switch_plan` / `claim_monthly_credits`). Guests
    can switch too; their plan and credits are kept on the device.
- **🎁 December 23 offer.** Be on Lite or Pro before **23 December 2026 (00:00 UTC)**. On or
  after that day, the app claims a one-time drop: **Pro 500,000,000 credits**, **Lite 100,000
  credits**.
- **🎬 Playshow Mode.** Make your own object show and watch it like a real episode:
  - Build a cast (shape, colour, voice, personality, optional host) and name your show.
  - Type an idea (optional) and press *Make episode*. A Gemini text model writes the script as
    scenes and lines, each with a speaker, emotion and stage action. It falls back to other
    models when one is busy, and `playshow-script.js` repairs or drops anything that doesn't fit.
  - Every line is performed by **Gemini Live acting as a voice actor**, in that character's voice,
    and generated a few lines ahead. (The free key only allows 3 text-to-speech requests a
    minute, while Live has no per-request limit.) Up to 3 voice connections are open at once
    and idle ones are recycled.
  - The stage has title cards, subtitles, lip-sync for the speaker, emotions, and actions (jump,
    shake, spin, cheer, faint). An eliminated contestant gets flung off-screen.
  - Episodes cost usage like talking: 1 second of episode audio = 1 second of the meter (or 1
    credit).

  | | Free | Lite | Pro |
  |---|---|---|---|
  | Objects in the cast | 3 | 5 | 8 |
  | Episode length | ~10 lines, 2 scenes (short skits) | ~24 lines, 3 scenes | ~40 lines, 5 scenes |
  | Eliminations & voting | — | ✓ | ✓ |
  | Seasons (recaps, eliminated objects stay out) | — | ✓ | ✓ |
  | Script writer | standard | standard | extended thinking |
  | Saved episodes | 3 | 10 | 30 |
  - **🎤 Host it yourself (optional).** Turn on *I'm the host* and the episode goes live: hold the
    mic button (or Space), say something, and the cast answers you in character. Gemini hears the
    recording and writes the next 1–4 lines (and, on Lite/Pro, may eliminate someone once).
    Press *End episode* to save it. Without the toggle, episodes are written and hosted for you.
- **🚶 Agent Mode.** Press *Agent* and your character walks out of the window and helps with tasks:
  - **Windows/macOS:** a see-through, always-on-top buddy window walks to the corner of the screen.
    Clicks pass through everywhere except the character and its little toolbar. Drag it around,
    send it for a stroll, or press *Back* and it walks home into the app.
  - **Android / browser:** the same helper runs inside the app.
  - Tools it can use: timers (with a chime + notification), a task list, notes, look things up on
    Wikipedia or the BFDI wiki, open a search or website in your browser, copy text, tell the time,
    and (Pro) look at your screen. Tasks, notes and timers are saved on the device.
  - It uses the same meter/credits as talking.
- **🌐 The one-file web version** (`npm run site` → `site/index.html`). It's the BFDI Talk website
  with the whole app inside. *Play it right here* opens the app; 🏠 goes back to the site.
  - Opened in a browser (or uploaded to itch.io as an HTML5 game), it's the normal Gemini Live app.
  - Published on claude.ai as an artifact, it can't reach Gemini or the microphone, so it switches
    to the **web lite** engine (`www/js/web-engine.js`). You type, Claude writes the replies (with
    emotion tags), and the browser's own voices read them out while the mouth moves. Playshow scripts
    are written by Claude too. Agent Mode keeps timers, tasks and notes.
- **Video & screen live (Pro).** The camera or a shared screen is sent to Gemini Live at
  1 frame per second, and the character reacts to what it sees. A preview shows in the corner.
  Screen sharing works on Windows/macOS. Android web views can't share the screen, so that
  button is hidden there.

## Build

### Option A: GitHub Actions (recommended)

`.github/workflows/bfdi-talk.yml` builds all three files on GitHub's Windows, macOS and Linux
machines:

1. In the repo, go to **Settings → Secrets and variables → Actions → New repository secret** and
   add:
   - `GEMINI_API_KEY`: your Gemini key
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY`: from your Supabase project (see *Switch on
     accounts* below). Without them the app runs in guest mode: no accounts, everything else
     (plans included) works.
2. Push to `main` (or run the workflow by hand from the **Actions** tab). Download
   `BFDI-Talk-Windows`, `BFDI-Talk-macOS`, `BFDI-Talk-Android` and `BFDI-Talk-Web` from the run's
   **Artifacts**.
3. To make a public download page, push a tag such as `bfdi-talk-v2.0.0`. The workflow then
   attaches all three files to a GitHub Release.

### Option B: locally

```bash
cd bfdi-talk
npm install
printf 'GEMINI_API_KEY=your-key\nSUPABASE_URL=https://xxxx.supabase.co\nSUPABASE_ANON_KEY=your-anon-key\n' > .env   # never committed

npm start              # run the desktop app
npm run serve          # or try it in a browser at http://localhost:5173
npm run dist:win       # .exe  (on Windows)
npm run dist:mac       # .dmg  (on a Mac)
npm run android:apk    # .apk  (needs Android Studio / SDK + JDK 21)
npm test               # meter/plans, Playshow, Agent and web-engine unit tests
npm run site           # site/index.html: the website with the whole app inside (no key built in)
```

## Switch on accounts

Accounts live on **Supabase** (the free tier is enough). There are no payments, so there is
nothing else to set up.

1. **Create a Supabase project** at supabase.com. Under *Project Settings → API*, copy the
   **Project URL** and the **anon / publishable key**.
2. **Upload the database** (from `bfdi-talk/`):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push                 # tables, rules, plan + credit functions
   ```
   If you deployed the old Stripe functions before, remove them:
   `npx supabase functions delete stripe-webhook create-checkout billing-portal verify-receipt`.
3. **Sign-up emails.** By default Supabase asks new users to confirm their email. Either keep
   that (the app tells people to check their inbox), or turn it off under *Authentication →
   Sign In / Providers → Email → Confirm email*.
4. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as GitHub secrets (see *Build*) and rebuild.

### Testing the backend locally

```bash
npx supabase start                       # needs Docker
SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:backend
```
`tests/db.test.mjs` checks the security rules (users can't edit their credits directly), free
plan switching with monthly credits once per period, and the December 23 rules.

## Install notes

- **Windows.** The installer isn't code-signed, so SmartScreen may warn. Click
  *More info → Run anyway*.
- **macOS.** The app is ad-hoc signed but not notarized. The first time, right-click the app,
  choose *Open*, and confirm. On newer macOS versions, use *System Settings → Privacy & Security →
  Open Anyway* instead. Allow the microphone when asked.
- **Android.** The APK is a debug-signed build for sideloading. Allow "install unknown apps".
  To publish on Google Play, set up a release keystore and run `./gradlew bundleRelease`.

## About the API key and limits

- The key is **never committed**. `scripts/write-config.mjs` writes it into `www/js/config.js`
  (git-ignored) at build time.
- Anything shipped inside an app can be pulled back out of it. Anyone who downloads the
  EXE/DMG/APK could extract the Gemini key and use your quota. A sturdier setup would have a
  Supabase function hand out short-lived Gemini Live *ephemeral tokens* instead.
- **Credits are server-side for accounts.** Users can't edit their credits directly
  (row-level security, tested); they only change through the plan, monthly and December 23
  functions. Credit *spending* is reported by the app, so a modified app could skip reporting it.
  The free meter and guest plans are stored on the device.
- The one-file web build made with `--with-key` contains the key like the other builds. The
  version published on claude.ai is built without it.

## Project layout

```
www/                 the app (HTML/CSS/JS, no bundler)
  js/app.js          UI, session flow, account/plans wiring
  js/live.js         Gemini Live WebSocket client, mic capture, playback, lip-sync analyser
  js/face.js         emotion → eyes/mouth table, blinking, mouth picking
  js/character.js    SVG bodies
  js/usage.js        free meter, refill timer, credits wallet
  js/account.js      Supabase accounts, credits sync, plans (account or device), Dec 23 claim
  js/plans.js        plan perks, monthly credit rules
  js/media.js        Pro video & screen live (1 fps JPEG frames)
  js/playshow-script.js  Playshow: plan limits, episode prompt + schema, script repair
  js/playshow.js     Playshow: voice-actor pool (Gemini Live) + episode player
  js/playshow-ui.js  Playshow: studio, cast editor, seasons, theater, live hosting
  js/agent.js        Agent Mode: tools, tasks/timers/notes, Wikipedia + BFDI wiki look-up
  js/web-engine.js   web lite engine (Claude replies, browser voices) for the claude.ai page
  assets/            sliced sprites (generated)
electron/            desktop shell (app://bfdi, permissions, Agent Mode buddy window)
supabase/migrations/ database: profiles, credit ledger, plan/credit/bonus functions, security rules
scripts/             write-config, serve
tests/               unit + local-backend tests
android/             Capacitor Android project
assets-src/          the original mouth + eye sprite sheets
site/                website (page.template.html; index.html is generated with the app inside)
tools/               slice_assets.py (cut sprites), make_icon.py (icons/splash), make_site.mjs (one-file build)
```

To re-cut the sprites after editing the sheets, run `pip install pillow numpy scipy`, then
`npm run assets`.

The eye sheet's bottom-right set was removed together with the artist watermark that covered it.
The UI font is Fredoka (SIL Open Font License, `www/fonts/OFL.txt`).
BFDI is a show by jacknjellify, and this is an unofficial fan app.
