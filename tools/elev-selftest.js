/*
 * Självtest för Sändo Elev.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/elev-selftest.js
 *
 * Kör appen i en riktig webbläsare med ett stubbat Gemini-API. Tyngdpunkten
 * ligger på den regel som är hela poängen med Monni: att svaret aldrig går
 * ut till eleven. Vakten testas med en tabell av svar som Monni skulle kunna
 * skriva — både sådana som ska stoppas och sådana som absolut inte ska
 * stoppas, för en vakt som tar allt är lika oanvändbar som ingen vakt.
 */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const fel = [];
  p.on('pageerror', e => fel.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') fel.push('CONSOLE: ' + m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '../elev/index.html'));
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(300);

  const problem = [];

  // 0) Strukturkontroll
  const saknas = await p.evaluate(() => {
    const krav = {
      'App': ['el', 'esc', 'button', 'toast', 'sheet', 'hideSheet', 'confirm', 'registrera',
              'open', 'renderCredits', 'setTema', 'init'],
      'App.Credits': ['balance', 'log', 'canAfford', 'charge', 'reset', 'fmt'],
      'App.Gemini': ['key', 'setKey', 'model', 'setModel', 'call', 'uploadFile', 'generate', 'testKey'],
      'App.Gemini.docs': ['all', 'save', 'add', 'remove', 'aktiv', 'setAktiv', 'parts'],
      'Monni': ['system', 'steg', 'setSteg', 'nyUppgift', 'tjat', 'berOmSvar', 'elevensTal',
                'vakt', 'historik', 'sparaTur', 'fraga'],
      'Canvas': ['plocka', 'validera', 'rita', 'beskrivning'],
      'Sagor': ['system', 'kortaForstaMeningen', 'fraga'],
      'Repet': ['system', 'validera', 'letaSvarsfalt', 'plockaJson', 'senaste', 'antalFragor', 'skapa']
    };
    const f = [];
    Object.keys(krav).forEach(sok => {
      const o = sok.split('.').reduce((a, k) => a && a[k], window);
      if (!o) { f.push(sok + ' saknas helt'); return; }
      krav[sok].forEach(m => { if (typeof o[m] !== 'function') f.push(sok + '.' + m); });
    });
    ['bok', 'monni', 'sagor', 'mer'].forEach(v => { if (!App.vyer[v]) f.push('vyn ' + v); });
    return f;
  });
  console.log('saknade metoder: ' + (saknas.length ? saknas.join(', ') : 'inga'));
  if (saknas.length) problem.push('saknade metoder');

  // 1) Startkrediter
  const kred = await p.evaluate(() => ({ saldo: App.Credits.balance(), start: App.Credits.START }));
  console.log('krediter: ' + JSON.stringify(kred));
  if (kred.saldo !== 5000000 || kred.start !== 5000000) problem.push('startkrediterna är inte 5 000 000');

  // 2) Svarsvakten — ska stoppa
  const stoppa = await p.evaluate(() => {
    const fall = [
      ['Svaret är 56, eftersom 8 gånger 7 är just det.', '8 × 7'],
      ['Rätt svar är 12. Förstår du varför?', 'Vad är 5 + 7'],
      ['Om du räknar ihop dem blir det 56.', '8*7'],
      ['Facit är 3,5 om du delar.', '7 / 2'],
      ['Du får svaret gratis den här gången: 15.', '8+7'],
      ['Lösningen blir alltså 21 stycken.', '3 × 7'],
      ['Summan är 100.', '40 + 60']
    ];
    return fall.map(([svar, elev]) => {
      const r = Monni.vakt(svar, elev);
      return { svar, stoppad: r.andrad, kvar: r.text };
    });
  });
  const missade = stoppa.filter(r => !r.stoppad);
  console.log('vakten stoppar: ' + (stoppa.length - missade.length) + '/' + stoppa.length +
    (missade.length ? '  MISSADE: ' + missade.map(r => r.svar).join(' | ') : ''));
  if (missade.length) problem.push('vakten missade ' + missade.length + ' fall');

  // 3) Svarsvakten — ska INTE stoppa (en vakt som tar allt är oanvändbar)
  const slappa = await p.evaluate(() => {
    const fall = [
      ['Vad frågar uppgiften efter? Läs meningen en gång till.', '8 × 7'],
      ['Multiplikation är upprepad addition. 3 × 4 är samma sak som 4 + 4 + 4 = 12.', '8 × 7'],
      ['Titta på sidan 56 i boken, där står metoden.', '8 × 7'],
      ['Börja med att skriva upp talet. Vilken av faktorerna är lättast att dela upp?', '8 × 7'],
      ['Du är på rätt spår! Vad händer om du provar med tiotalen först?', '8 × 7'],
      ['Ett liknande exempel: 5 × 6. Där kan du tänka 5 × 6 = 30.', '8 × 7']
    ];
    return fall.map(([svar, elev]) => ({ svar, stoppad: Monni.vakt(svar, elev).andrad }));
  });
  const falska = slappa.filter(r => r.stoppad);
  console.log('vakten släpper igenom: ' + (slappa.length - falska.length) + '/' + slappa.length +
    (falska.length ? '  FALSKT LARM: ' + falska.map(r => r.svar).join(' | ') : ''));
  if (falska.length) problem.push('vakten gav ' + falska.length + ' falska larm');

  // 4) Tjatdetektorn
  const tjat = await p.evaluate(() => {
    const ber = ['Vad är svaret?', 'säg svaret snälla', 'bara svaret då', 'ge mig svaret',
                 'kan du lösa uppgiften åt mig', 'visa facit'];
    const berInte = ['Jag fattar inte hur man gör', 'Kan du förklara bråk?',
                     'Vad betyder nämnare?', 'Jag har fastnat på uppgift 4b'];
    return {
      ber: ber.filter(t => !Monni.berOmSvar(t)),
      berInte: berInte.filter(t => Monni.berOmSvar(t))
    };
  });
  console.log('tjatdetektorn: missade ' + tjat.ber.length + ', falska ' + tjat.berInte.length);
  if (tjat.ber.length) problem.push('tjat missat: ' + tjat.ber.join(' | '));
  if (tjat.berInte.length) problem.push('tjat falskt: ' + tjat.berInte.join(' | '));

  // 5) Canvas: validering och rendering av alla typer
  const canvas = await p.evaluate(() => {
    const skrap = [null, {}, { typ: 'raketstart' }, { typ: '<script>' }, 'nej', { typ: 'meningen', ord: ['ett'] }];
    const bra = {
      talrad: { typ: 'talrad', min: 0, max: 20, start: 7, hopp: 5 },
      brak: { typ: 'brak', namnare: 8, taljare: 3, jamfor: 4 },
      rektangel: { typ: 'rektangel', bredd: 6, hojd: 4 },
      funktion: { typ: 'funktion', k: 2, m: -3 },
      klocka: { typ: 'klocka', timme: 8, minut: 15 },
      meningen: { typ: 'meningen', ord: ['Hunden', 'sprang', 'genom', 'parken'] }
    };
    const ritade = [], trasiga = [];
    Canvas.typer.forEach(t => {
      const d = document.createElement('div');
      try {
        const spec = Canvas.validera(bra[t]);
        if (!spec) { trasiga.push(t + ': validering nekade ett giltigt värde'); return; }
        Canvas.rita(spec, d);
        if (!d.querySelector('.canvasruta')) trasiga.push(t + ': ritade ingenting');
        else ritade.push(t);
      } catch (e) { trasiga.push(t + ': ' + e.message); }
    });
    // gränsvärden ska klippas, inte krascha
    const klippt = Canvas.validera({ typ: 'rektangel', bredd: 9999, hojd: -40 });
    // taggen ska gå att plocka ur ett svar
    const plockat = Canvas.plocka('Prova så här.\n[[canvas:{"typ":"klocka","timme":3,"minut":30}]]');
    return {
      antalTyper: Canvas.typer.length,
      skrapNekat: skrap.filter(x => Canvas.validera(x) === null).length,
      skrapTotalt: skrap.length,
      ritade, trasiga,
      klippt,
      plockatText: plockat.text,
      plockatTyp: plockat.canvas && plockat.canvas.typ
    };
  });
  console.log('canvas: ritade ' + canvas.ritade.length + '/' + canvas.antalTyper +
    ' typer, skräp nekat ' + canvas.skrapNekat + '/' + canvas.skrapTotalt +
    ', klippt ' + JSON.stringify(canvas.klippt) + ', plockad typ ' + canvas.plockatTyp);
  if (canvas.trasiga.length) problem.push('canvas trasig: ' + canvas.trasiga.join(' | '));
  if (canvas.skrapNekat !== canvas.skrapTotalt) problem.push('canvas släppte igenom skräp');
  if (canvas.klippt.bredd !== 20 || canvas.klippt.hojd !== 1) problem.push('canvas klipper inte gränsvärden');
  if (canvas.plockatTyp !== 'klocka' || canvas.plockatText.indexOf('[[') >= 0) problem.push('canvas-taggen plockas inte ur texten');

  // 6) Stubbat Gemini: uppladdning, en Monni-runda och en sagoidé
  await p.evaluate(() => {
    localStorage.setItem('sandoelev.gemini.key', JSON.stringify('AQ.TESTNYCKEL'));
    window.__skickat = [];
    window.__svar = 'Vad frågar uppgiften efter? Läs meningen en gång till.';
    window.fetch = function (url, init) {
      const u = String(url);
      window.__skickat.push({ url: u, body: init && init.body });
      let body;
      if (u.indexOf('/upload/') >= 0) {
        body = { file: { uri: 'https://x/files/bok', mimeType: 'application/pdf',
                         expirationTime: new Date(Date.now() + 48 * 3600e3).toISOString() } };
      } else if (u.indexOf(':generateContent') >= 0) {
        body = { candidates: [{ content: { parts: [{ text: window.__svar }] } }] };
      } else {
        body = { models: [{ name: 'models/gemini-3.5-flash' }] };
      }
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    };
  });

  const upp = await p.evaluate(() => new Promise(r => {
    const f = new File([new Blob(['%PDF-1.4 x'])], 'matte-5-arbetsbok.pdf', { type: 'application/pdf' });
    App.Gemini.uploadFile(f, (err, bok) => r({ err, namn: bok && bok.name, aktiv: App.Gemini.docs.aktiv() && App.Gemini.docs.aktiv().name }));
  }));
  console.log('uppladdning: ' + JSON.stringify(upp));
  if (upp.err || upp.aktiv !== 'matte-5-arbetsbok.pdf') problem.push('uppladdningen fungerade inte');

  // En Monni-runda där modellen försöker leverera svaret ändå
  const runda = await p.evaluate(() => new Promise(r => {
    window.__svar = 'Svaret är 56. Bra jobbat!\n[[canvas:{"typ":"talrad","min":0,"max":20,"start":4,"hopp":3}]]';
    Monni.fraga('Vad är 8 × 7?', (err, s) => r({
      err, text: s && s.text, vakt: s && s.vaktSlog, canvas: s && s.canvas && s.canvas.typ,
      skickat: JSON.parse(window.__skickat[window.__skickat.length - 1].body)
    }));
  }));
  console.log('monni-runda: vakt=' + runda.vakt + ' canvas=' + runda.canvas);
  console.log('  visat för eleven: ' + JSON.stringify(runda.text));
  if (!runda.vakt) problem.push('vakten slog inte till på ett levererat svar');
  if (/\b56\b/.test(runda.text || '')) problem.push('svaret 56 gick ut till eleven');
  if (runda.canvas !== 'talrad') problem.push('canvasen kom inte med');

  const cfg = runda.skickat.generationConfig;
  console.log('  generationConfig: ' + JSON.stringify(cfg));
  if (!cfg.thinkingConfig || cfg.thinkingConfig.thinkingBudget !== 0) {
    problem.push('tänkandet är inte avstängt — tanken äter svarets budget');
  }
  if (cfg.maxOutputTokens < 2000) problem.push('för snål maxOutputTokens (' + cfg.maxOutputTokens + ')');

  const sys = (runda.skickat.systemInstruction.parts[0].text || '');
  const doks = JSON.stringify(runda.skickat.contents);
  console.log('  systemprompt: ' + sys.length + ' tecken, boken med i frågan: ' + (doks.indexOf('files/bok') >= 0));
  if (sys.indexOf('aldrig svaret') < 0) problem.push('systemprompten saknar regeln');
  if (doks.indexOf('files/bok') < 0) problem.push('arbetsboken följde inte med frågan');
  if (JSON.stringify(runda.skickat.generationConfig.responseModalities) !== '["TEXT"]') {
    problem.push('Monni bad inte om enbart text');
  }

  // Hjälpstegen ska stanna vid fyra, och tjat ska inte flytta fram dem
  const stegen = await p.evaluate(() => new Promise(async r => {
    window.__svar = 'Titta på metoden i boken.';
    Monni.nyUppgift();
    const spar = [];
    function nasta(i) {
      if (i === 8) { r({ spar, tjat: Monni.tjat() }); return; }
      const text = i % 2 === 0 ? 'Hur menar du?' : 'Vad är svaret?';
      Monni.fraga(text, (e, s) => { spar.push({ text, steg: s && s.steg }); nasta(i + 1); });
    }
    nasta(0);
  }));
  console.log('hjälpsteg: ' + stegen.spar.map(s => s.steg).join(',') + '  tjat räknat: ' + stegen.tjat);
  if (Math.max(...stegen.spar.map(s => s.steg)) > 3) problem.push('hjälpen gick förbi steg 4');
  if (stegen.tjat !== 4) problem.push('tjatet räknades fel (' + stegen.tjat + ')');

  // Avhugget svar ska märkas, inte visas som ett helt
  const hugget = await p.evaluate(() => new Promise(r => {
    const orig = window.fetch;
    window.fetch = () => Promise.resolve(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Multiplikation handlar om att lägga ihop samma tal' }] },
                     finishReason: 'MAX_TOKENS' }]
    }), { status: 200 }));
    App.Gemini.generate({ prompt: 'x', useDocs: false }, (err, text) => {
      window.fetch = orig;
      r({ err, text });
    });
  }));
  console.log('avhugget svar: ' + JSON.stringify(hugget.text));
  if (!/tog utrymmet slut/.test(hugget.text || '')) problem.push('avhugget svar visas som helt');

  // LaTeX och markdown ska bort innan eleven ser texten
  const stadat = await p.evaluate(() => {
    const fall = [
      ['Räkna ut $8 \\times 7$ genom att dela upp.', '8 × 7'],
      ['Ta $\\frac{3}{4}$ av talet.', '3/4'],
      ['Det är **viktigt** att börja med tiotalen.', '**'],
      ['## Rubrik\nSedan kommer texten.', '#']
    ];
    return fall.map(([f, spar]) => ({ fore: f, efter: Monni.stada(f) }));
  });
  stadat.forEach(r => console.log('  städat: ' + JSON.stringify(r.fore) + ' → ' + JSON.stringify(r.efter)));
  if (stadat.some(r => /\$|\\times|\\frac|\*\*|^#/.test(r.efter))) problem.push('städningen lämnade kvar LaTeX/markdown');

  // Utan nyckel ska vyerna säga vad som saknas
  const utanNyckel = await p.evaluate(() => {
    const spar = App.Gemini.key();
    App.Gemini.setKey('');
    const har = ['bok', 'monni', 'sagor'].map(v => {
      App.open(v);
      return document.body.textContent.indexOf('Lägg in API-nyckeln först') >= 0;
    });
    App.Gemini.setKey(spar);
    return har;
  });
  console.log('nyckelrutan syns i bok/monni/sagor: ' + JSON.stringify(utanNyckel));
  if (utanNyckel.some(v => !v)) problem.push('nyckelrutan saknas i någon vy');

  const saga = await p.evaluate(() => new Promise(r => {
    window.__svar = 'IDÉ: En katt hittar en dörr.\nFÖRSTA MENINGEN: Det regnade. Sedan hände allt det andra, och katten sprang. Och sedan slutade det.\nVÄNDNING: Dörren låser sig.';
    Sagor.fraga('Genre: Spännande.', (err, text) => r({ err, text }));
  }));
  console.log('saga: ' + JSON.stringify(saga.text));
  if (/Sedan hände allt det andra/.test(saga.text || '')) problem.push('sagan fick en hel text som "första mening"');

  // Repet: formatet som CarPlay-appen läser får aldrig kunna bära ett facit
  const repet = await p.evaluate(() => new Promise(r => {
    const svar = {
      titel: 'Matte Direkt 5 — kapitel 4',
      underrubrik: 'Multiplikation',
      avsnitt: [
        { id: 'k4 tabeller!', titel: 'Tabellerna', sidor: '42-45',
          'frågor': ['Sex gånger sju', 'Åtta gånger fyra.', 'x', 'Sju gånger sju?'],
          svar: ['42', '32'], facit: 'ligger här' },
        { id: 'k4-ord', titel: 'Orden', sidor: '46-47',
          'frågor': ['Vad heter svaret på en multiplikation?', 'Vad heter talet man delar med?'] },
        { id: 'tom', titel: 'Tom', sidor: '48', 'frågor': ['bara en'] }
      ]
    };
    // det Monni faktiskt skickar: JSON i kodstaket
    window.__svar = '```json\n' + JSON.stringify(svar) + '\n```';
    Repet.skapa('kapitel 4', (err, rep) => r({
      err,
      rep,
      svarsfalt: rep ? Repet.letaSvarsfalt(rep) : null,
      sparad: !!App.Store.get('repet.senaste', null)
    }));
  }));
  console.log('repet: ' + (repet.err ? 'FEL ' + repet.err : JSON.stringify({
    avsnitt: repet.rep.avsnitt.length,
    frågor: repet.rep.avsnitt.map(a => a['frågor'].length),
    id: repet.rep.avsnitt.map(a => a.id),
    svarsfalt: repet.svarsfalt
  })));
  if (repet.err) problem.push('repet kunde inte skapas: ' + repet.err);
  else {
    const alla = JSON.stringify(repet.rep);
    if (repet.svarsfalt.length) problem.push('repet bar svarsfält: ' + repet.svarsfalt.join(', '));
    if (/facit|"svar"/.test(alla)) problem.push('facit följde med in i repetitionen');
    if (repet.rep.format !== 'sandoelev.repet/1') problem.push('fel formatversion');
    if (repet.rep.avsnitt.length !== 2) problem.push('avsnitt med för få frågor kastades inte');
    if (!repet.rep.avsnitt.every(a => a['frågor'].every(f => /[?.!]$/.test(f)))) {
      problem.push('en fråga saknar skiljetecken');
    }
    if (repet.rep.avsnitt.some(a => /[^\w-]/.test(a.id))) problem.push('id städades inte');
    if (!repet.sparad) problem.push('repetitionen sparades inte');
  }

  // Ett tomt eller trasigt svar ska ge ett besked, inte en trasig repetition
  const trasigt = await p.evaluate(() => new Promise(r => {
    window.__svar = 'Jag kan tyvärr inte göra det.';
    Repet.skapa('kapitel 4', err => r(err || 'inget fel alls'));
  }));
  console.log('repet på trasigt svar: ' + JSON.stringify(trasigt));
  if (!/JSON/.test(String(trasigt))) problem.push('trasigt svar gav inte ett vettigt besked');

  // 7) Alla vyer monterar
  const vyfel = await p.evaluate(() => {
    const f = [];
    ['bok', 'monni', 'sagor', 'mer'].forEach(v => {
      try { App.open(v); } catch (e) { f.push(v + ': ' + e.message); }
    });
    return f;
  });
  await p.waitForTimeout(200);
  console.log('vyer som kraschar: ' + (vyfel.length ? vyfel.join(' | ') : 'inga'));
  if (vyfel.length) problem.push('vyer kraschar');

  // 8) Mobilbredd: inget får sticka ut i sidled
  const bredd = await p.evaluate(() => {
    const ut = [];
    ['bok', 'monni', 'sagor', 'mer'].forEach(v => {
      App.open(v);
      if (document.documentElement.scrollWidth > window.innerWidth + 1) {
        ut.push(v + ' (' + document.documentElement.scrollWidth + 'px)');
      }
    });
    return ut;
  });
  console.log('vyer som spiller över i sidled: ' + (bredd.length ? bredd.join(', ') : 'inga'));
  if (bredd.length) problem.push('sidledsspill: ' + bredd.join(', '));

  console.log('\nkonsolfel: ' + fel.length);
  fel.slice(0, 8).forEach(e => console.log(' - ' + e));
  console.log('problem: ' + (problem.length ? '\n - ' + problem.join('\n - ') : 'inga'));
  await b.close();
  process.exit(fel.length || problem.length ? 1 : 0);
})();
