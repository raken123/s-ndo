# Sändo Tavla — webbapp

Gränssnittet till klassrumstavlan. Rena HTML/CSS/JS-filer utan byggsteg och
utan beroenden — öppna `index.html` i en webbläsare för att köra den, eller
bygg Android-appen i [`../android`](../android) som paketerar samma filer som
assets.

```
index.html          skal: topbar, verktygsrutnät, verktygsvy
css/app.css         tema (ljust/mörkt), stora tryckytor för smartboard
js/core.js          verktygsregister, navigering, lagring, ljud, hjälpmedel
js/tools-board.js   whiteboard, lappar, storskärmstext, anteckningar
js/tools-time.js    schema, timer, stoppur, klocka, arbetspass
js/tools-random.js  grupper, slumpa elev, hjul, tärning, tal, mynt, placering, bingo
js/tools-class.js   ljuddetektor, trafikljus, arbetsläge, poäng, stjärnor,
                    omröstning, turordning, närvaro, räknare
js/tools-learn.js   miniräknare, mattetränare, glosförhör, andning, paus, fråga
js/settings.js      klasser, elevnamn, tema, ljud, export/import
js/main.js          start
```

## Lägga till ett verktyg

Ett verktyg är ett objekt som registreras i `App`. Det ritar upp sig själv i
den `root`-nod det får, och `App.layout()` ger den vanliga uppdelningen med
verktygsrad och innehållsyta:

```js
App.register({
  id: 'exempel', name: 'Exempel', icon: '🎈', cat: 'Klassrum',
  desc: 'Kort beskrivning som visas på kortet.',
  keys: 'sökord som matchar i sökrutan',
  mount: function (root) {
    var L = App.layout(root, { center: true });
    L.bar.appendChild(App.button('Gör något', 'sm', function () { App.beep(880, 200); }));
    L.body.appendChild(App.el('div', 'big-num', 'Hej!'));
  },
  unmount: function () { /* frivilligt: städa upp */ }
});
```

Kategorin i `cat` blir automatiskt ett filter på startsidan. Intervall som
startas med `App.every()` stoppas automatiskt när verktyget stängs.

## Data

Allt sparas i `localStorage` under prefixet `sandotavla.` via `App.Store`.
Inget lämnar enheten. Under ⚙️ Inställningar finns export och import av all
data som text, för att flytta klasslistor mellan enheter.
