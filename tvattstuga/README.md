# Tvätt-OS — tvättstugans launcher

En fil: `index.html`. Öppna den i en webbläsare (eller via GitHub Pages på `/tvattstuga/`).

- **Pixelstil och långsam text** – CRT-skanlinjer, pixelikoner, skrivmaskinstext med pip. Klicka på en text för att hoppa över. Hastighet och ljud ställs in under Inställningar.
- **NFC-inloggning** – skanna kortet, launchern visar vems kort det är och frågar "Är det du?". Valfri PIN som extra skydd. Riktig NFC kräver Chrome på Android och https (Web NFC). Andra webbläsare får virtuella kort.
- **Minnen** – skriv in hur din vardag ser ut ("varannan vecka jobbar jag helg…"). AI:n använder minnena överallt.
- **AI-funktioner (Gemini)** – AI-planeraren väljer tider åt dig, Tvättbot (chatt som kan föreslå tider), dagens tips, AI-intervju som fyller på minnena, fläckhjälp, programförslag, tolkning av tvättsymboler från foto, bytelapp till grannar, plus gåtor och sagor för barnen.
- **Spel för barn** – Strump-memory, Fånga tvätten, AI-gåta och AI-saga, med rekord per barn.
- **Övrigt** – max 2 bokningar per hushåll, kalenderfil (.ics) med påminnelse, automatisk utloggning efter 5 minuter.

## Gemini-nyckel

Lägg in nyckeln under **Inställningar → AI-kärna**. Den sparas bara i webbläsarens
localStorage och skickas direkt till Google. Lägg aldrig in den i koden, eftersom repot är
publikt via GitHub Pages. Nycklar som börjar på `AQ.` går först till Vertex AI express
(`aiplatform.googleapis.com`), andra till AI Studio (`generativelanguage.googleapis.com`).
Om det misslyckas provas den andra endpointen och några reservmodeller automatiskt.

Utan nyckel fungerar allt utom AI-delarna. Planeraren, fläckhjälpen och gåtorna har
enkla offlinesvar som reserv.

Alla data (konton, minnen, bokningar) sparas lokalt på enheten. Grannarnas bokningar i
schemat är simulerade.
