# BFDI Talk

Talk out loud with your own object-show character. It answers in a real voice, its mouth
lip-syncs to the speech, and its eyes and mouth change with its mood. It runs on
**Gemini 3.8 Flash Live** (`gemini-3.8-live`) or **Gemini 3.8 Live Extended Thinking**
(`gemini-3.8-live-extended-thinking`).

Builds: **Windows `.exe`**, **macOS `.dmg`** and **Android `.apk`**. All three use the same web
app in `www/`. Electron wraps it for desktop and Capacitor wraps it for Android.

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
  - *Buy Credits* opens https://jooykoll.itch.io/bfdi-talk-ai. After paying, the user uploads a
    screenshot of the payment. **$1 = 60 credits**, minimum $5. Gemini checks it's an itch.io
    payment for BFDI Talk, and each screenshot or order number only works once.
  - Signed in: the screenshot is checked on the server and credits go to the account.
    Guests: checked in the app and kept on the device.
- **Accounts** (Supabase). Email + password sign-up with a username. Credits, plan and
  subscription follow you to every device.
- **Subscriptions** (Stripe), managed from the app:

  | Plan | Price | Every month | Extras |
  |---|---|---|---|
  | **Lite** | **$1/month for 5 months**, then $6/month | 1,500 credits | |
  | **Pro** | **$10/month**, **7-day free trial** | 5,000 credits | 📷 video live, 🖥️ screen live, meter refills in 30 min, 👑 PRO crown |

  - The trial and the Lite intro price are once per account.
  - Monthly credits arrive with each *paid* invoice, so a free trial gives Pro features but no
    credits until the first payment.
  - Cancel, switch plan, update card and see invoices in **Account → Manage subscription**
    (Stripe's customer portal). Credits stay after cancelling.
- **🎁 December 23 offer.** Subscribe before **23 December 2026 (00:00 UTC)**. On or after
  that day, the app claims a one-time drop: **Pro 500,000,000 credits**, **Lite 100,000
  credits**. The subscription must have started before the cutoff and be paid
  (`active`). Trial-only accounts get it once their first payment goes through.
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
     accounts & subscriptions* below). Without them the app runs in guest mode: no accounts or
     subscriptions, everything else works.
2. Push to `main` (or run the workflow by hand from the **Actions** tab). Download
   `BFDI-Talk-Windows`, `BFDI-Talk-macOS` and `BFDI-Talk-Android` from the run's **Artifacts**.
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
npm test               # meter/credits + billing unit tests
```

## Switch on accounts & subscriptions

Accounts live on **Supabase** (free tier is enough) and payments go through **Stripe**.
Stripe needs an adult (18+) with a bank account to open the account. Do everything in **test
mode** first (`sk_test_...` keys and Stripe's test card `4242 4242 4242 4242`), then repeat with
live keys.

1. **Create a Supabase project** at supabase.com. Under *Project Settings → API*, copy the
   **Project URL** and the **anon / publishable key**.
2. **Upload the database and server code** (from `bfdi-talk/`):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push                 # tables, rules, credit functions
   npx supabase functions deploy        # create-checkout, billing-portal, stripe-webhook, verify-receipt
   ```
3. **Set up Stripe** (makes the Pro/Lite prices, the $1-for-5-months coupon, the customer portal
   and the webhook):
   ```bash
   STRIPE_SECRET_KEY=sk_test_... SUPABASE_URL=https://<ref>.supabase.co node scripts/stripe-setup.mjs
   ```
   It prints a webhook signing secret (`whsec_...`). Save it for the next step.
4. **Give the server its secrets:**
   ```bash
   npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... GEMINI_API_KEY=...
   ```
5. **Sign-up emails.** By default Supabase asks new users to confirm their email. Either keep
   that (the app tells people to check their inbox), or turn it off under *Authentication →
   Sign In / Providers → Email → Confirm email*.
6. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as GitHub secrets (see *Build*) and rebuild.

### Testing the backend locally

```bash
npx supabase start                       # needs Docker
npx supabase functions serve --env-file <file with STRIPE_WEBHOOK_SECRET=whsec_test_local123>
SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:backend
```
`tests/db.test.mjs` checks the security rules (users can't give themselves credits or Pro) and
the December 23 rules. `tests/webhook.test.mjs` sends signed fake Stripe events: trial, paid
months, the Lite intro, retries, out-of-order events and cancelling.

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
- **Credits, plans and subscriptions are server-side.** Users can't give themselves credits or
  Pro (row-level security, tested). Credit *spending* is reported by the app, so a modified app
  could skip reporting it. The free meter is stored on the device.
- Screenshot checking is a light check, and a skilled fake could get past it. For airtight
  one-time credits, check purchases on a server with the itch.io API (`/purchases` endpoint).

## Project layout

```
www/                 the app (HTML/CSS/JS, no bundler)
  js/app.js          UI, session flow, account/plans/purchase wiring
  js/live.js         Gemini Live WebSocket client, mic capture, playback, lip-sync analyser
  js/face.js         emotion → eyes/mouth table, blinking, mouth picking
  js/character.js    SVG bodies
  js/usage.js        free meter, refill timer, credits wallet
  js/account.js      Supabase accounts, credits sync, subscriptions, Dec 23 claim
  js/plans.js        plan prices/perks shown in the app
  js/media.js        Pro video & screen live (1 fps JPEG frames)
  js/purchase.js     guest screenshot verification with Gemini
  assets/            sliced sprites (generated)
electron/            desktop shell (serves www/ from app://bfdi; mic/camera/screen permissions)
supabase/migrations/ database: profiles, credit ledger, credit/bonus functions, security rules
supabase/functions/  create-checkout, billing-portal, stripe-webhook, verify-receipt
scripts/             write-config, stripe-setup, serve
tests/               unit + local-backend tests
android/             Capacitor Android project
assets-src/          the original mouth + eye sprite sheets
tools/               slice_assets.py (cut sprites), make_icon.py (icons/splash)
```

To re-cut the sprites after editing the sheets, run `pip install pillow numpy scipy`, then
`npm run assets`.

The eye sheet's bottom-right set was removed together with the artist watermark that covered it.
The UI font is Fredoka (SIL Open Font License, `www/fonts/OFL.txt`).
BFDI is a show by jacknjellify, and this is an unofficial fan app.
