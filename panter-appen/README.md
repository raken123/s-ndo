# Panter-appen 🐆

En Android-app där en panter coachar dig till ett bättre liv. Varje dag får du
**tre uppdrag i verkligheten** – svåra, men alltid 0 % farliga.

- **Klarar du uppdraget** (du skriver en kort ärlig rapport) får du XP, pantern
  blir starkare och du klättrar i rang: Kattunge → Ungpanter → Jägare →
  Skuggpanter → Alfapanter → Legendarisk panter.
- **Ger du upp eller missar** blir det sämre: pantern tappar livskraft, du får
  ett (ofarligt men tråkigt) straffuppdrag, streaken bryts och appen blir
  gråare. Når livskraften 0 kollapsar pantern och du tappar 20 % av din XP.
- **Coachen** anpassar svårigheten efter hur det går, väljer uppdrag utifrån
  dina fokusområden och tränar det du ofta ger upp i. I chatten kan du fråga om
  motivation, sömn, stress, mål, träning, plugg, mobilen och pengar. Skriver du
  något som tyder på att du mår riktigt dåligt hänvisar den till 112, Mind
  Självmordslinjen (90101), 1177 och BRIS.

Allt körs lokalt på telefonen – ingen internetanslutning, inget konto, ingen
data skickas iväg.

## Ladda ner

GitHub Actions bygger APK:n automatiskt vid varje ändring i `panter-appen/`.
Hämta den senaste `Panter-appen.apk` under **Releases** i repot (eller som
artefakt i Actions-körningen), öppna den på telefonen och tillåt installation
från okända källor.

## Struktur

| Fil | Innehåll |
| --- | --- |
| `app/src/main/assets/index.html` | Hela appen: uppdrag, coach-logik, straffsystem och gränssnitt |
| `app/src/main/java/se/panter/appen/MainActivity.java` | Android-skal (WebView) |
| `app/panter.keystore` | Signeringsnyckel så att nya versioner kan installeras ovanpå gamla |

Bygga lokalt (kräver Android SDK och JDK 17):

```sh
cd panter-appen
gradle assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

Appens gränssnitt går också att testa direkt i en webbläsare genom att öppna
`app/src/main/assets/index.html`.
