# AI-komponenterna

Femton av tavlans komponenter använder Gemini. Alla delar samma API-nyckel,
samma kreditsaldo och samma dokumentbibliotek, och alla ligger under
kategorin **AI** i komponentpaletten.

| Komponent | Vad den gör |
|---|---|
| 🤖 Tramsdetektor | Lyssnar, mäter cringe-nivån löpande och säger till när någon tramsar |
| 👩‍🏫 AI-Lärare | Samtal om allt i kursen, grundat i arbetsbok och lärarhandledning |
| 📝 Provgenerator | Prov eller quiz med facit, utifrån kapitel eller ämne |
| 💡 Förklara enklare | Förklarar ett begrepp på rätt nivå, med kontrollfråga |
| ✅ Rättningshjälp | Formativ återkoppling på ett elevsvar i tre delar |
| 🗂️ Lektionsplanerare | Lektion med tider, moment, material och exit ticket |
| 🔤 Glosgenerator | Ordlista som skickas rakt in i Glosförhöret med ett tryck |
| 📚 Sammanfattare | Kapitel ur materialet till punkter för tavlan |
| 🧮 Räkneexempel | Uträkningar steg för steg att gå igenom tillsammans |
| 🙋 Fråga AI:n | Elevernas frågor, med svar som håller sig till lektionen |
| 🔍 Ordförklararen | Samma ord förklarat på tre nivåer |
| ✍️ Skrivstartare | Skrivuppgifter med meningsstartare och ord att få med |
| 💬 Diskussionsledare | Diskussionsfrågor med följdfrågor |
| 🎫 Exit ticket | Tre frågor att avsluta lektionen med, med facit |
| 🌍 Översättare | Tavlans text till ett annat språk plus enkel svenska |

Varje kort har **📝 Lägg på tavlan**, som lägger svaret som en anteckning på
sidan. Glosgeneratorn har dessutom **📖 Skapa glosförhör**, som gör om
ordlistan till en färdig glosförhörskomponent.

## AI-Läraren och materialet

AI-Läraren kräver att man först lägger till minst en PDF — elevernas arbetsbok
och gärna lärarhandledningen. Innan dess är frågerutan låst. PDF:erna laddas
upp till Gemini, ligger kvar där i 48 timmar och skickas med i varje fråga, så
att svaren följer just den bok klassen jobbar i. AI-Läraren hänvisar till
kapitel och uppgiftsnummer, säger ifrån när något inte står i materialet, och
ger inte färdiga svar utan att också förklara vägen dit.

Dokumenten hanteras på två ställen: i AI-Lärarens egen ruta och under
⚙️ **Inställningar → Material till AI-Läraren**, där man ser vad som är
uppladdat och hur länge det ligger kvar. Ladda inte upp material med elevers
personuppgifter — filerna lämnar enheten.

## Modeller och krediter

* Tramsdetektorn använder en Live-modell (standard `gemini-3.1-flash-live-preview`).
* Övriga komponenter använder en textmodell (standard `gemini-3.5-flash`).
* Båda går att ändra under ⚙️ Inställningar.

Varje fråga kostar 80 kr (input) och varje svar 300 kr (output) ur
kreditsaldot. En PDF-uppladdning räknas som en input. Cringe-mätningen och
tramsdetektorns lokala läge kostar ingenting.

Alla anrop har en tidsgräns — hänger nätet får man ett besked i stället för ett
kort som står och tänker för alltid.
