# Sändo Tavla — webbappen

Appen *är* en whiteboard. Du kan skapa hur många tavlor du vill, varje tavla har
sidor, och allt annat i appen är komponenter som placeras ut på sidorna.
Rena HTML/CSS/JS-filer utan byggsteg och utan beroenden — öppna `index.html` i en
webbläsare, eller bygg Android-appen i [`../android`](../android) som paketerar
samma filer som assets.

```
index.html          skal: tavelväljare, sidflikar, pennrad, rityta
css/app.css         tema (ljust/mörkt), komponentrutor, palett, tramsdetektor
js/core.js          tavelmodell, widgetkontext, krediter, lagring, ljud, hjälpmedel
js/board.js         whiteboarden: sidor, ritlager, komponentrutor, översikt
js/tools-board.js   lappar, storskärmstext, anteckningar
js/tools-time.js    schema, timer, stoppur, klocka, arbetspass
js/tools-random.js  grupper, slumpa elev, hjul, tärning, tal, mynt, placering, bingo
js/tools-class.js   ljuddetektor, trafikljus, arbetsläge, poäng, stjärnor,
                    omröstning, turordning, närvaro, räknare
js/tools-learn.js   miniräknare, mattetränare, glosförhör, andning, paus, fråga
js/tools-trams.js   tramsdetektorn (Gemini Live + lokalt läge)
js/settings.js      klasser, elevnamn, API-nyckel, krediter, tema, export/import
js/main.js          start
```

## Tavlor, sidor och komponenter

* **Tavla** — `App.Boards.all()` ger listan. Tavlorna hålls som ett levande objekt
  i minnet; allt som ändras sparas med `App.Boards.persist()` (via `Board.save()`).
* **Sida** — varje sida har `bg`, `strokes` (penndrag som vektorer) och `widgets`.
* **Komponent** — en widget är `{id, tool, x, y, w, h}`. Den ritas i en ruta som
  går att flytta, ändra storlek på och maximera.

## Lägga till en komponent

Andra parametern till `mount` är komponentens egen kontext. Kalla den `App` så
får varje ruta automatiskt egen lagring (`App.Store`) och egna intervall
(`App.every`), som städas när rutan tas bort:

```js
App.register({
  id: 'exempel', name: 'Exempel', icon: '🎈', cat: 'Klassrum',
  desc: 'Kort beskrivning som visas i paletten.',
  keys: 'sökord',
  mount: function (root, App) {          // App = kontext för just den här rutan
    var L = App.layout(root, { center: true });
    L.bar.appendChild(App.button('Räkna', 'sm', function () {
      App.Store.set('n', (App.Store.get('n', 0)) + 1);   // sparas per ruta
    }));
    App.every(1000, function () { /* stoppas när rutan tas bort */ });
  }
});
```

Kategorin i `cat` blir en rubrik i komponentpaletten. Lägg gärna in en
standardstorlek i `SIZES` i `board.js`.

## Data

Allt sparas i `localStorage` under `sandotavla.` — tavlor, sidor, penndrag,
klasslistor, krediter och API-nyckel. Komponentdata ligger under
`sandotavla.w.<widgetId>.`. Inget lämnar enheten utom tramsdetektorns ljud i
AI-läge. Under ⚙️ Inställningar finns export och import av all data som text.

## Självtest

```sh
npm i -D playwright && node tools/selftest.js
```

Kör appen i en webbläsare med ett stubbat Gemini-API och kontrollerar att alla
metoder som koden anropar finns, att varje komponent monterar, och att
AI-vägarna fungerar. Strukturkontrollen är till för att en tappad metod annars
bara märks som ett rött kryss ute på en platta.
