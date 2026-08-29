# Monni — hjälpen som aldrig säger svaret

Monni är AI:n i **Sändo Elev**. Hon hjälper en elev som fastnat på en uppgift
i sin egen arbetsbok, och hon säger aldrig svaret. Inte om man ber snällt,
inte om man ber tio gånger, inte om man påstår att läraren har tillåtit det.

Det är lätt att skriva den regeln i en systemprompt. Det är inte lika lätt att
få den att hålla, för en systemprompt är en önskan och inte en spärr. I Sändo
Elev hålls regeln på tre ställen, och varje ställe fångar det de andra släpper
igenom.

## 1. Systemprompten — vad Monni ska göra i stället

Prompten säger inte bara *säg inte svaret*, för då hade Monni bara tystnat.
Den räknar upp vad hon gör i stället: förklarar begreppet, visar ett liknande
exempel med **andra siffror**, ställer en fråga som tar eleven ett steg
längre, och hänvisar till rätt sida i boken.

Den räknar också upp de vanliga vägarna runt regeln, en och en, så att de inte
kommer som en överraskning: eleven ber snällt, ber många gånger, blir arg,
säger att läraren tillåter det, säger att hen redan har svarat och bara vill
jämföra, säger att det är sista frågan. Svaret är detsamma varje gång.

Vill eleven bli rättad ber Monni om elevens eget svar och hur hen tänkte. Hon
säger om **metoden** håller och var det är värt att titta en gång till — men
aldrig vad det rätta svaret är. Annars vore rättningen bara ett facit i
förklädnad: räkna, gissa, fråga, upprepa.

## 2. Hjälpstegen — hjälpen växer, men tar aldrig sista steget

Hjälpen kommer i fyra steg, och eleven ser vilket steg hon är på:

| Steg | Vad Monni gör |
|---|---|
| 1 · Förstå frågan | Ställer en fråga tillbaka. Räknar ingenting. |
| 2 · Välj metod | Pekar ut vilken sorts uppgift det är, visar ett liknande exempel med andra siffror. |
| 3 · Första steget | Visar hur man börjar. Bara början. |
| 4 · Nästan hela vägen | Går igenom alla steg utom det sista, och säger rakt ut att sista steget är elevens. |

Det finns inget steg 5. På steg 4 säger Monni att mer hjälp än så inte finns.

Stegen flyttas fram av **riktiga frågor**, inte av tjat. Ber eleven om svaret
står steget still — annars hade fyra "säg svaret" räckt för att pressa fram
den största hjälpen appen har. Tjatet räknas i stället, och siffran följer med
i prompten så att Monni kan hålla linjen utan att upprepa samma mening.

## 3. Svarsvakten — en kontroll av det Monni faktiskt skrev

Innan svaret når skärmen läses det av `Monni.vakt()`. Två kontroller:

**Levererande fraser.** Meningar som innehåller *svaret är*, *rätt svar är*,
*facit är*, *lösningen blir*, *resultatet blir* byts mot en knuff. Hela
meningen försvinner, inte bara frasen — annars står talet kvar utan sin
inledning.

**Ekot.** Vakten letar efter ett räknetal i elevens egen fråga (`8 × 7`,
`40 + 60`, `7 / 2`), räknar ut det, och söker efter resultatet i Monnis svar.
Men bara där det står som ett levererat svar: efter ett likhetstecken, eller
efter *blir*, *är*, *summan*, *produkten*, *kvoten*, *differensen* — med
högst ett par småord emellan, så att *"blir det 56"* fastnar lika bra som
*"= 56"*.

Slår vakten till får eleven se en rad om det:

> 🔒 Svarsvakten tog bort ett färdigt svar ur Monnis text.

### Vakten får inte ta allt

En vakt som stoppar varje siffra är lika oanvändbar som ingen vakt: då kan
Monni inte förklara att 3 × 4 = 12 heller, och hela poängen med ett liknande
exempel faller. Därför är ekot bundet till **elevens eget tal**, och därför
testas vakten åt båda hållen. `tools/elev-selftest.js` kör två tabeller:

* sju svar som ska stoppas — *"Svaret är 56"*, *"Om du räknar ihop dem blir det 56"*, *"Summan är 100"*, *"Facit är 3,5"* …
* sex svar som absolut inte får stoppas — *"Titta på sidan 56 i boken"*, *"Multiplikation är upprepad addition. 3 × 4 = 12"*, *"Vad frågar uppgiften efter?"* …

Båda tabellerna ska gå igenom. Går den ena men inte den andra är vakten
trasig, även om den ser ut att fungera.

### Vad vakten inte är

Vakten är ett skyddsnät, inte ett bevis. Den fångar de vanliga sätten att råka
leverera ett facit. En modell som skriver *"om du tar 8 femmor och lägger till
8 tvåor landar du på fem tior och sex ettor"* går igenom, och det ska den
göra — det är en förklaring, inte ett svar. Gränsen mellan de två är inte en
regel utan en bedömning, och den bedömningen gör systemprompten. Vakten tar
bara det som är otvetydigt.

Ekot slår också till om elevens svar råkar vara samma tal som något Monni
använder i ett exempel. Det är ett medvetet val: hellre en knuff för mycket än
ett facit för lite.

## Sagorna följer samma princip

Under ✏️ Sagor ger Monni uppslag: en idé, två personer, en miljö, **en** första
mening, en vändning och tre frågor eleven måste bestämma själv. Hon skriver
inte sagan. En färdigskriven berättelse vore lika mycket ett facit som ett
färdigt svar på ett matematiktal.

Också här finns en lokal kontroll: `Sagor.kortaForstaMeningen()` klipper
rubriken *FÖRSTA MENINGEN* efter den första punkten. Får Monni för sig att
skriva ett helt stycke där blir det en mening igen innan eleven ser det.

## Canvas — exempel att dra i, inte facit

Monni kan avsluta ett svar med en rad:

```
[[canvas:{"typ":"talrad","min":0,"max":20,"start":7,"hopp":5}]]
```

Då ritas ett interaktivt exempel i chatten. Modellen kör ingen kod — den väljer
en typ ur en fast lista och sätter siffror. Allt som inte finns i listan, och
alla värden utanför sina gränser, kastas av `Canvas.validera()`. Det är därför
canvasen är trygg att lita på: den är inte kod, den är parametrar.

| Typ | Vad eleven gör |
|---|---|
| `talrad` | Drar en kula längs talraden, bågen visar hoppet |
| `brak` | Färglägger delar, jämför två bråk |
| `rektangel` | Drar hörnet, area och omkrets räknas om |
| `funktion` | Drar i k och m, linjen ritas om |
| `klocka` | Drar visaren, tiden skrivs i ord |
| `meningen` | Trycker orden i ordning |

Canvasen ska vara ett **exempel med andra siffror** än elevens uppgift. En
canvas byggd på elevens eget tal vore ett facit man kan dra i.

## Att en modell tänker syns inte i svaret

Textmodellen tänker innan den svarar, och tanken ryms i samma `maxOutputTokens`
som svaret. Det märks ingenstans i det man får tillbaka utom i
`usageMetadata.thoughtsTokenCount` — och i att svaret plötsligt är avhugget.
I Sändo Elev 1.0.0 åt tanken 862 av 900 tokens och lämnade 34 till Monni, som
därmed svarade en halv mening. Appen såg trasig ut fast anropet gick igenom
med HTTP 200.

Monni skickar `thinkingConfig: { thinkingBudget: 0 }`. En knuff behöver ingen
tankekedja, och det eleven betalar för ska vara det eleven ser.

## Krediter

Eleven börjar med **5 000 000 krediter**. En fråga kostar 80, ett svar 300, och
en uppladdad arbetsbok 80. Canvasen kostar ingenting extra — den ritas lokalt.

Siffrorna är inga pengar som byter ägare. De gör kostnaden för varje fråga
synlig, vilket är hela poängen: det ska märkas att man frågar.

Sedan **Matteplatser** kom till går de också åt andra hållet: 400, 900 eller
1600 per rätt svar, beroende på platsens nivå. En budget som bara krymper
slutar med att eleven slutar fråga, och det är fel sak att lära ut.

De frågorna kommer inte från Monni, och det är inget undantag från regeln
ovan — det är samma regel. En matteplatsfråga är ett prov med tjugo sekunders
klocka, och den som ställer frågan måste veta svaret. Monni gör aldrig det:
Monni ställer frågor tillbaka. Platsfrågorna räknas därför fram lokalt av en
slumpgenerator som varken har någon systemprompt eller något att säga.
