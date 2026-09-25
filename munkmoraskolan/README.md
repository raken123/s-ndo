# Munkmoraskolan · NFC-nyckel

Lås som öppnas med NFC-kort. På kortet står det vem man är:

```
isperson[Raken]
```

Om namnet finns i klassen och personen har nyckel till platsen låser det upp.

| Fil | Vad |
|-----|-----|
| `kille.html` | Skärm 800 × 480, blå – ”Kille-skanner” |
| `tjej.html` | Skärm 800 × 480, rosa/lila – ”Tjej-skanner” |
| `nfc-lasare/nfc-lasare.ino` | Arduino-kod för GIGA R1 + GIGA Display + PN532-läsare |

## Göra kort

1. Köp NFC-kort eller NFC-klistermärken (NTAG213/215 funkar bra).
2. Ladda ner en app som **NFC Tools** på mobilen.
3. Välj *Skriv* → *Lägg till post* → *Text* och skriv till exempel `isperson[Raken]`.
4. Håll kortet mot mobilen så sparas texten.

Stora och små bokstäver spelar ingen roll: `isperson[raken]` funkar också.

## Skärmen (HTML)

Välj plats uppe till höger: **Klassrum 4**, **Klubben** eller **Rakens låda**.
Till höger ser du vilka som har nyckel till platsen (grön ✓).

- Grönt = upplåst („Välkommen, Raken!”)
- Rött = ogiltigt kort, namnet finns inte i klassen, eller personen har inte nyckel till platsen

Skärmen kan läsa kort på tre sätt:

1. **📶 NFC i en Android-mobil eller surfplatta.** Det fungerar i Chrome. Tryck på *Starta NFC* om knappen syns.
2. **USB-kortläsare som skriver som ett tangentbord.** Läsaren ”skriver” `isperson[Raken]` och trycker Enter.
   Samma sak går att testa utan kort: skriv texten och tryck Enter.
3. **🔌 Arduino via USB-kabel.** Det fungerar i Chrome eller Edge på datorn. Tryck på knappen och välj din GIGA.

### Ändra inställningar

Överst i `<script>` i `kille.html` / `tjej.html`:

- `GRUPP` – vilka som hör till skärmen, t.ex. `["Raken", "Loke"]`. Tom lista = hela klassen.
- `PLATSER` – vem som får öppna vad. Lådan är satt till `["Raken"]`.
- `KLASSEN` – alla namn. Mattias och Janet är lärare och får öppna klassrum och klubben.

## Arduino GIGA

`nfc-lasare.ino` gör att GIGA:n själv läser korten och visar svaret på GIGA-skärmen.
Då behövs ingen webbsida. Den lyser också grönt eller rött med lampan på kortet och skickar
kortets text över USB, så att HTML-skärmen kan kopplas in med 🔌.

Koppla PN532-läsaren (ställ den på I2C): VCC → 3.3V, GND → GND, SDA → 20, SCL → 21.

Bibliotek:
- `Arduino_GigaDisplay_GFX` (finns i Library Manager)
- PN532 och NDEF från <https://github.com/Seeed-Studio/PN532>. Ladda ner zip-filen och lägg mapparna
  `PN532`, `PN532_I2C` och `NDEF` i din `libraries`-mapp.

Överst i filen ställer du in `PLATS` och `BEHORIGA`. För lådan: `{ "Raken" }`.

## Bra att veta

Vem som helst med en mobil kan skriva `isperson[Raken]` på ett eget NFC-klistermärke.
Därför är det här ett kul skolprojekt och inget riktigt lås. Använd det inte för saker som måste vara säkra.
