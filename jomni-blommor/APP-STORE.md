# Ladda upp Jomni Blommor till Apple Developer Program / App Store

> **Viktigt:** Filen `JomniBlommor-unsigned.ipa` är **osignerad**. App Store Connect tar bara emot appar som är signerade med ditt eget distributionscertifikat. Den osignerade IPA:n går att installera på din egen iPhone via Sideloadly/AltStore (de signerar den med ditt Apple-ID), men för App Store och TestFlight följer du stegen nedan.

## 1. Gå med i Apple Developer Program

1. Gå till <https://developer.apple.com/programs/enroll/> och logga in med ditt Apple-ID (tvåstegsverifiering krävs).
2. Välj **Individual** (privatperson) eller **Organization** (företag – kräver D-U-N-S-nummer, gratis via Apple).
3. Betala avgiften (99 USD/år). Godkännandet tar oftast 1–2 dygn.
4. Notera ditt **Team ID** under *Membership details* – det är 10 tecken.

## 2. Registrera appen och dess funktioner

På <https://developer.apple.com/account> → **Certificates, Identifiers & Profiles**:

1. **Identifiers → + → Merchant IDs** → `merchant.se.jomni.blommor` (för Apple Pay).
2. **Identifiers → + → App IDs → App** → Bundle ID (Explicit) `se.jomni.blommor`. Kryssa i:
   - **Push Notifications**
   - **Time Sensitive Notifications** (tidskänsliga notiser – "du måste leverera")
   - **Apple Pay Payment Processing** → *Configure* → välj `merchant.se.jomni.blommor`
   - In-App Purchase är påslaget automatiskt (behövs för Jomni Plus).
3. **Apple Pay-certifikat via Stripe:** Stripe Dashboard → *Settings → Payment methods → Apple Pay → iOS certificate → Add new application*. Ladda ner CSR-filen från Stripe, ladda upp den hos Apple under merchant-ID:t (*Create Certificate*), och ladda upp den färdiga `.cer`-filen tillbaka till Stripe.
4. **Push-nyckel till servern:** **Keys → +** → kryssa *Apple Push Notifications service (APNs)* → ladda ner `AuthKey_XXXX.p8` (går bara en gång!). Lägg den på servern och fyll i `APNS_KEY_FILE`, `APNS_KEY_ID` och `APNS_TEAM_ID` i `server/.env`.

## 3. Skapa appen i App Store Connect

På <https://appstoreconnect.apple.com>:

1. **Avtal, skatt och bank** – signera *Paid Apps Agreement* och fyll i bank- och skatteuppgifter. Utan det går Jomni Plus inte att sälja.
2. **Appar → + → Ny app**: plattform iOS, namn **Jomni Blommor**, primärt språk **Svenska**, Bundle ID `se.jomni.blommor`, SKU `jomni-blommor`.
3. **Jomni Plus:** appen → *Monetarisering → Prenumerationer* → skapa gruppen **Jomni Plus** → ny prenumeration med produkt-ID **`se.jomni.blommor.plus.monthly`**, längd **1 månad**, pris **48 kr**. Lägg till svensk visningstext ("Dubbla mynt på varje köp") och en skärmdump.

## 4. Bygg och ladda upp

### Alternativ A – utan Mac (GitHub Actions)

1. App Store Connect → *Användare och åtkomst → Integrationer → App Store Connect API* → **Generera API-nyckel** med rollen **Admin**. Ladda ner `.p8`-filen och notera **Key ID** och **Issuer ID**.
2. GitHub → repot `s-ndo` → *Settings → Secrets and variables → Actions → New repository secret*. Skapa:
   | Namn | Värde |
   |---|---|
   | `APPLE_TEAM_ID` | ditt Team ID |
   | `ASC_KEY_ID` | Key ID |
   | `ASC_ISSUER_ID` | Issuer ID |
   | `ASC_KEY_P8` | hela texten i `.p8`-filen |
3. GitHub → *Actions* → **Jomni Blommor → App Store Connect** → *Run workflow*. Ange serverns adress (t.ex. `https://jomniblommor.se`) och versionsnummer.
4. Workflowet signerar appen automatiskt och laddar upp den. Efter 10–30 minuter syns bygget under **TestFlight**.

### Alternativ B – med Mac och Xcode

```bash
brew install xcodegen
cd jomni-blommor/ios
xcodegen generate
open JomniBlommor.xcodeproj
```

1. Ändra `JOMNI_API_BASE_URL` i `project.yml` till er serveradress (kör `xcodegen generate` igen efteråt).
2. Klicka på projektet → target **JomniBlommor** → **Signing & Capabilities** → välj ditt **Team** och låt *Automatically manage signing* vara ikryssat.
3. Välj **Any iOS Device (arm64)** som mål → **Product → Archive**.
4. I *Organizer*: **Distribute App → App Store Connect → Upload**.

## 5. Testa med TestFlight

1. App Store Connect → appen → **TestFlight**. Bygget visas när Apple har processat det.
2. Lägg till dig själv under *Interna testare*. Installera appen **TestFlight** på iPhone och öppna inbjudan.
3. Logga in som admin längst ner under **Konto → Admin**, tillåt notiser och slå på **Tidskänsliga notiser** när iPhone frågar. Gör en testbeställning – du ska få notisen "Ny beställning – du måste leverera".

## 6. Skicka in för granskning

Under appens version i App Store Connect:

- **Skärmdumpar**: iPhone 6,9" (1320 × 2868) räcker; ta dem i simulatorn eller med TestFlight-appen.
- **Integritetspolicy-URL** (krävs) och **Support-URL**.
- **Appintegritet**: appen samlar in namn, e-post, telefon, adress (för leverans) och köphistorik, kopplat till användaren, inte för spårning.
- **Kategori**: Shopping. **Åldersgräns**: fyll i formuläret (4+).
- **Prenumerationen** Jomni Plus: lägg till den under *In-app-köp och prenumerationer* i versionen.
- **Information till granskaren**: ge ett testkonto för kund, förklara att **Admin** längst ner under Konto är för butiksägaren, och att buketterna är fysiska varor som betalas med Apple Pay (tillåtet enligt riktlinje 3.1.3(e)) medan Jomni Plus är ett köp i appen (3.1.1).
- Klicka **Skicka in för granskning**. Svar kommer oftast inom 24–48 timmar.

Kunder kan radera sitt konto i appen (Konto → Radera konto), vilket Apple kräver (riktlinje 5.1.1(v)).
