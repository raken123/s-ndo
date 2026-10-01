# Astro-servern – skicka rymdresan på mejl

När tiden (20 minuter) är slut kan besökaren skriva in sin e-postadress i spelet.
Inspelningen av resan laddas upp hit, och servern mejlar en länk till filmen från
**astro@tekniskamuseet.se**. En 20-minutersfilm är för stor för en bilaga
(ca 100–150 MB), därför skickas en länk till en sida där filmen kan ses och laddas ner.

```
Spelet (kiosk) ──POST /api/recordings──▶ Astro-servern ──SMTP──▶ besökarens inkorg
                                              │                     (länk)
                                              └── /v/<id> ◀──────── besökaren hemma
```

* Ingen npm-installation behövs – bara Node.js 20 eller senare (och gärna ffmpeg).
* Inspelningen innehåller **bara spelets bild och ljud**, aldrig kamerabilden.
* **E-postadresser sparas aldrig.** De används bara för att skicka mejlet. Loggen visar en maskerad adress (`b***@gmail.com`).
* Filmerna raderas automatiskt efter `RETENTION_DAYS` dagar (standard 30). Länkarna innehåller ett slumpat id som är svårt att gissa, och sidorna är märkta `noindex`.
* Max 5 mejl per adress och timme, och uppladdning kräver API-nyckeln.

## Installera

1. Kopiera `.env.example` till `.env` och fyll i:
   * `PUBLIC_URL` – en adress som nås från internet, t.ex. `https://astro.tekniskamuseet.se`
   * `API_KEY` – en lång slumpad nyckel (samma värde skrivs in i spelet)
   * `SMTP_*` – kontot för astro@tekniskamuseet.se. För Microsoft 365: `smtp.office365.com`,
     port 587, och SMTP AUTH måste vara påslaget för kontot.
2. Starta: `node server.mjs`, eller med Docker:
   ```sh
   docker build -t astro-server .
   docker run -d --restart=always -p 8787:8787 --env-file .env -v astro-data:/data astro-server
   ```
3. Lägg en https-proxy framför (nginx, Caddy, IIS …) som pekar på port 8787.
   Spelet på Android kräver https.
4. Kontrollera: `https://astro.tekniskamuseet.se/health` ska svara `{"ok":true,…}`.

Utan `SMTP_HOST` skickas inga mejl. De sparas i stället som `.eml`-filer i
`data/outbox`, vilket är bra för att testa.

Mejlet hamnar mer sällan i skräpposten om domänen har SPF/DKIM för den server som
skickar. Ett Microsoft 365-konto för astro@tekniskamuseet.se har det redan.

## Koppla spelet till servern

Öppna administratörspanelen i spelet (**Ctrl + Shift + A**, eller tryck 5 gånger
i övre vänstra hörnet). Fyll i:

* **Astro-server för e-post:** `https://astro.tekniskamuseet.se`
* **API-nyckel:** samma som `API_KEY`
* **Filmer sparas (dagar):** samma som `RETENTION_DAYS` – visas för besökaren

Tryck *Spara*. Från nästa resa visas en röd **● REC** i hörnet, och på startskärmen
står det att resan spelas in. Är servern inte ifylld spelas ingenting in och
e-postknappen visas inte.

Det går också med URL-parametrar i webbversionen:
`?mailServer=https://astro.tekniskamuseet.se&mailKey=…`

> I VR (Meta Quest) går det inte att spela in skärmen, så där erbjuds inte e-post.

## Test

```sh
FFMPEG=ffmpeg node test/run-tests.mjs
```

Testerna startar en låtsas-SMTP-server och kontrollerar uppladdning, mejl (avsändare,
länk, svenska tecken), filmsidan, Range-uppspelning, att ingen adress sparas på disk,
spärrar och MP4-konvertering.
