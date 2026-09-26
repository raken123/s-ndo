# 🌸 Jomni Blommor

Webbutik + iPhone-app för Jomni Blommor.

| Del | Mapp | Vad |
|---|---|---|
| Server & API | `server/` | Node.js (inga beroenden). Beställningar, leverans, betalning, mynt/diamanter, Jomni Plus, admin, push |
| Webbsida | `web/` | Butiken (`index.html`) och adminsidan (`admin.html`). Serveras av servern |
| iPhone-app | `ios/` | SwiftUI-app. Byggs till `.ipa` av GitHub Actions (`.github/workflows/jomni-ios.yml`) |

## Funktioner

- **Alla buketter går att köpa** – varukorg, kassa, rabattkoder.
- **Riktig leverans** – postnummer avgör leveranssätt:
  - *Budleverans* samma dag i tidsfönster 09–12, 12–15, 15–18, 18–21 (minst 2 h förberedelse), 89 kr, fri över 799 kr.
  - *PostNord Hem* till hela Sverige, vardagar, tidigast om två dagar, 149 kr.
  - Mottagare, telefon, adress, kortmeddelande, instruktion till budet. Kunden följer beställningen live (Mottagen → Binds → Ute för leverans → Levererad).
  - Zoner, priser och tider ändras i `server/src/config.js` (`ZONES`, `SLOTS`).
- **Apple Pay och Google Pay** (och kort) via Stripe. I appen: Apple Pay.
- **Mynt & diamanter** – 150 kr = 0,3 mynt, 20 mynt = 0,12 diamanter. Diamanter löses in mot gratis leverans, rabatter eller gratis bukett.
- **Jomni Plus** – 48 kr/mån, dubbla mynt. Webben: Stripe-prenumeration. Appen: App Store-prenumeration (StoreKit 2).
- **Adminsida** – knappen ligger längst ner på sidan (och längst ner under *Konto* i appen). Se alla beställningar, ändra status, ring/karta.
- **Stjärnor → rabatter** – kunden ger 1–5 stjärnor efter leverans. Stjärnorna hamnar hos admin och används för att skapa rabattkoder (1 ⭐ per %, 1 ⭐ per 10 kr, gratis leverans 5 ⭐). Oanvända koder som tas bort ger tillbaka stjärnorna.
- **Tidskänsliga notiser i iPhone-appen** – "Ny beställning – du måste leverera" direkt när en beställning betalas, och "⏰ Dags att leverera" en timme före tidsfönstret. Notiserna bryter igenom Fokus-läge.

## Kom igång (lokalt, demoläge)

```bash
cd jomni-blommor/server
npm run demo          # http://localhost:8080  – demobetalningar, inga riktiga pengar
npm test              # API-tester
```

Admin: http://localhost:8080/admin (eller knappen längst ner). Lösenordet är det du valde; det lagras bara som scrypt-hash i `server/src/config.js`. Byt det genom att sätta `ADMIN_PASSWORD` i `.env`.

## Skarp drift

1. Kopiera `server/.env.example` till `server/.env` och fyll i.
2. **Stripe** (kort, Apple Pay, Google Pay): lägg in `STRIPE_SECRET_KEY` och `STRIPE_PUBLISHABLE_KEY`. Skapa en webhook till `https://<din-domän>/api/stripe/webhook` med händelserna `payment_intent.succeeded`, `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` och lägg hemligheten i `STRIPE_WEBHOOK_SECRET`.
3. **Apple Pay på webben**: registrera domänen i Stripe (Settings → Payment methods → Apple Pay). Filen Stripe ger dig läggs i `web/.well-known/apple-developer-merchantid-domain-association`.
4. **Google Pay** fungerar direkt via Stripe i Chrome.
5. Kör `npm start` bakom HTTPS (t.ex. Caddy/Nginx, Render, Railway, Fly.io). Data sparas i `server/data/db.json` – ta backup.

## iPhone-appen (.ipa)

Varje push som ändrar `jomni-blommor/ios/` bygger appen i GitHub Actions → fliken *Actions* → *Jomni Blommor iOS (IPA)* → artefakten **JomniBlommor-ipa**. Kör workflowet manuellt för att ange serverns adress.

IPA:n är osignerad. Installera den med ditt Apple-ID via t.ex. Sideloadly/AltStore, eller bygg själv på en Mac:

```bash
brew install xcodegen
cd jomni-blommor/ios && xcodegen generate && open JomniBlommor.xcodeproj
```

Välj ditt team under *Signing & Capabilities* och kör *Product → Archive* för TestFlight/App Store.

Inställningar i Apple Developer / App Store Connect:

- **Bundle ID** `se.jomni.blommor` med *Push Notifications*, *Time Sensitive Notifications* och *Apple Pay* (merchant `merchant.se.jomni.blommor`, kopplat till Stripe).
- **Push från servern**: skapa en APNs-nyckel (.p8) och sätt `APNS_KEY_FILE`, `APNS_KEY_ID`, `APNS_TEAM_ID`. Utan den påminner appen ändå lokalt när den har hämtat beställningarna.
- **Jomni Plus i appen**: skapa en automatiskt förnyad prenumeration med produkt-id `se.jomni.blommor.plus.monthly` (48 kr/mån).
- Serveradressen i appen styrs av `JOMNI_API_BASE_URL` i `ios/project.yml`.
