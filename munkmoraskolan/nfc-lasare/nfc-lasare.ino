/*
  Munkmoraskolan · NFC-nyckel för Arduino GIGA R1 + GIGA Display Shield

  Läser NFC-kort med texten  isperson[Namn]  via en PN532-läsare (I2C)
  och visar svaret direkt på GIGA-skärmen (grönt = upplåst, rött = nekad).
  Samma text skickas också över USB, så kille.html / tjej.html kan
  kopplas in med knappen "🔌 Arduino".

  Koppla PN532 (ställ omkopplarna på I2C):
    VCC → 3.3V   GND → GND   SDA → SDA (20)   SCL → SCL (21)

  Bibliotek:
    - Arduino_GigaDisplay_GFX  (Library Manager)
    - PN532 + NDEF från https://github.com/Seeed-Studio/PN532
      (ladda ner som zip och lägg mapparna PN532, PN532_I2C och NDEF i libraries)
*/

#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>
#include <NfcAdapter.h>
#include <Arduino_GigaDisplay_GFX.h>

/* ================= INSTÄLLNINGAR – ändra här ================= */

// Vad det här låset öppnar.
const char* PLATS = "Klassrum 4";

// Alla som finns i klassen.
const char* KLASSEN[] = {
  "Mattias", "Ellis", "Sandra", "Felicia", "Loke", "Adrian", "Benjamin", "Osariemen",
  "Matheus", "Malak", "Zindra", "Wille", "Iason", "Eskil", "Junior", "Janet",
  "Rut", "Raken", "Celine", "Emily", "Keyla", "Ossian", "Edith",
};

// Vilka som får öppna. Lämna tom ({}) så får alla i KLASSEN öppna.
// För lådan: const char* BEHORIGA[] = { "Raken" };
const char* BEHORIGA[] = {};

const unsigned long VISA_SVAR_MS = 3000;

/* ============================================================== */

const int ANTAL_KLASSEN = sizeof(KLASSEN) / sizeof(KLASSEN[0]);
const int ANTAL_BEHORIGA = sizeof(BEHORIGA) / sizeof(BEHORIGA[0]);

// Färger (RGB565)
const uint16_t SVART = 0x0000;
const uint16_t VIT   = 0xFFFF;
const uint16_t GRON  = 0x2E8A;
const uint16_t ROD   = 0xE8E4;
const uint16_t BLA   = 0x05FF;
const uint16_t MORK  = 0x0886;

PN532_I2C pn532_i2c(Wire);
NfcAdapter nfc = NfcAdapter(pn532_i2c);
GigaDisplay_GFX skarm;

// Standardtypsnittet kan inte UTF-8, så å/ä/ö byts till tecknen i CP437.
String svenska(const String& in) {
  String ut;
  for (unsigned int i = 0; i < in.length(); i++) {
    uint8_t c = in[i];
    if (c == 0xC3 && i + 1 < in.length()) {
      uint8_t n = in[++i];
      switch (n) {
        case 0xA5: ut += (char)0x86; break;  // å
        case 0xA4: ut += (char)0x84; break;  // ä
        case 0xB6: ut += (char)0x94; break;  // ö
        case 0x85: ut += (char)0x8F; break;  // Å
        case 0x84: ut += (char)0x8E; break;  // Ä
        case 0x96: ut += (char)0x99; break;  // Ö
        default:   ut += '?';
      }
    } else {
      ut += (char)c;
    }
  }
  return ut;
}

void skrivMitten(const String& text, int y, int storlek, uint16_t farg) {
  String t = svenska(text);
  skarm.setTextSize(storlek);
  skarm.setTextColor(farg);
  int bredd = t.length() * 6 * storlek;
  skarm.setCursor((skarm.width() - bredd) / 2, y);
  skarm.print(t);
}

void visa(uint16_t bakgrund, const String& rubrik, const String& text) {
  skarm.fillScreen(bakgrund);
  skrivMitten("Munkmoraskolan", 40, 3, VIT);
  skrivMitten(rubrik, 190, 6, VIT);
  skrivMitten(text, 290, 3, VIT);
}

void visaVila() {
  skarm.fillScreen(MORK);
  skrivMitten("Munkmoraskolan", 40, 3, VIT);
  skarm.drawRoundRect(300, 130, 200, 130, 16, BLA);
  skarm.drawRoundRect(301, 131, 198, 128, 15, BLA);
  skrivMitten("NFC", 180, 5, BLA);
  skrivMitten("Håll kortet mot läsaren", 310, 3, VIT);
  skrivMitten(String(PLATS) + " är låst", 360, 2, BLA);
}

// Returnerar namnet som det står i KLASSEN, eller "" om det inte finns.
String hittaPerson(const String& skrivet) {
  for (int i = 0; i < ANTAL_KLASSEN; i++) {
    if (skrivet.equalsIgnoreCase(KLASSEN[i])) return KLASSEN[i];
  }
  return "";
}

bool harBehorighet(const String& namn) {
  if (ANTAL_BEHORIGA == 0) return true;
  for (int i = 0; i < ANTAL_BEHORIGA; i++) {
    if (namn == BEHORIGA[i]) return true;
  }
  return false;
}

void lampa(bool ok) {
  // GIGA-lampan är tänd när pinnen är LOW.
  digitalWrite(ok ? LEDG : LEDR, LOW);
  delay(VISA_SVAR_MS);
  digitalWrite(LEDG, HIGH);
  digitalWrite(LEDR, HIGH);
}

void kortLast(const String& text) {
  Serial.println(text);  // till webbsidan (knappen "🔌 Arduino")

  String t = text;
  t.trim();
  if (!t.startsWith("isperson[") || !t.endsWith("]")) {
    visa(ROD, "Ogiltigt kort", "Kortet är ingen nyckel");
    lampa(false);
    return;
  }
  String skrivet = t.substring(9, t.length() - 1);
  skrivet.trim();
  String namn = hittaPerson(skrivet);

  if (namn == "") {
    visa(ROD, "Okänt namn", skrivet + " finns inte i klassen");
    lampa(false);
  } else if (harBehorighet(namn)) {
    visa(GRON, "Välkommen, " + namn + "!", String(PLATS) + " är upplåst");
    lampa(true);
  } else {
    visa(ROD, "Hej " + namn + "!", String("Du har inte nyckel till ") + PLATS);
    lampa(false);
  }
}

// Plockar ut texten ur en NDEF-textpost.
// Posten börjar med en byte som säger hur lång språkkoden är (t.ex. "sv").
String lasText(NdefRecord& post) {
  int langd = post.getPayloadLength();
  if (langd < 1) return "";
  byte data[langd];
  post.getPayload(data);
  int start = 1 + (data[0] & 0x3F);
  String text;
  for (int i = start; i < langd; i++) text += (char)data[i];
  return text;
}

void setup() {
  Serial.begin(115200);
  pinMode(LEDG, OUTPUT);
  pinMode(LEDR, OUTPUT);
  digitalWrite(LEDG, HIGH);
  digitalWrite(LEDR, HIGH);

  skarm.begin();
  skarm.setRotation(1);  // liggande 800 × 480
  skarm.cp437(true);
  nfc.begin();
  visaVila();
}

void loop() {
  if (nfc.tagPresent()) {
    NfcTag kort = nfc.read();
    String text;
    if (kort.hasNdefMessage()) {
      NdefMessage meddelande = kort.getNdefMessage();
      for (unsigned int i = 0; i < meddelande.getRecordCount(); i++) {
        NdefRecord post = meddelande.getRecord(i);
        if (post.getTypeLength() == 1) {
          byte typ[1];
          post.getType(typ);
          if (typ[0] == 'T') { text = lasText(post); break; }
        }
      }
    }
    kortLast(text);
    visaVila();
  }
  delay(100);
}
