/*
 * Självtest för Sändo Tavla.
 *
 *   npm i -D playwright && node tools/selftest.js
 *
 * Kör appen i en riktig webbläsare med ett stubbat Gemini-API och kontrollerar
 * att alla metoder som resten av koden anropar faktiskt finns, att varje
 * komponent monterar, och att AI-vägarna (nyckeltest, fråga, uppladdning,
 * Live-anslutning) fungerar. Strukturkontrollen finns för att en tappad metod
 * annars bara märks som ett rött kryss ute på en platta.
 */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '../whiteboard/index.html'));
  await p.evaluate(() => localStorage.clear());
  await p.reload(); await p.waitForTimeout(400);

  // Stubbat Gemini: svarar som det riktiga API:t, utan nät
  await p.evaluate(() => {
    localStorage.setItem('sandotavla.gemini.key', JSON.stringify('AQ.TESTNYCKEL'));
    window.__calls = [];
    window.fetch = function (url, init) {
      window.__calls.push({ url: String(url), method: (init && init.method) || 'GET' });
      const u = String(url);
      let body;
      if (u.indexOf('/upload/') >= 0) {
        body = { file: { uri: 'https://x/files/abc', mimeType: 'application/pdf', expirationTime: new Date(Date.now() + 48*3600e3).toISOString() } };
      } else if (u.indexOf(':generateContent') >= 0) {
        body = { candidates: [{ content: { parts: [{ text: 'Ett svar från AI:n.\nRad två.' }] } }] };
      } else if (u.indexOf('access_token=') >= 0) {
        return Promise.resolve(new Response(JSON.stringify({ error: { message: 'unregistered callers' } }), { status: 403 }));
      } else if (init && init.headers && init.headers.Authorization) {
        return Promise.resolve(new Response(JSON.stringify({ error: { message: 'invalid credentials' } }), { status: 401 }));
      } else {
        body = { models: Array.from({length: 50}, (_, i) => ({ name: 'models/m' + i })).concat([{ name: 'models/gemini-3.1-flash-live-preview' }]) };
      }
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    };
  });
  await p.evaluate(() => localStorage.setItem('sandotavla.gemini.key', JSON.stringify('AQ.TESTNYCKEL')));

  // 0) Strukturkontroll: alla metoder som resten av appen räknar med
  const saknas = await p.evaluate(() => {
    const krav = {
      'App.Gemini': ['key','model','textModel','authMode','setAuthMode','wsParam','call','liveModels','uploadFile','generate','testKey'],
      'App.Gemini.docs': ['all','save','add','remove','parts','summary'],
      'App.Mic': ['start','release','hardRelease','subscribe','unsubscribe','feed','devices','test','diagnose','message','plan','webStart','attach','toPcm16','onNativeChunk','shutdown','lost','live','fileOrigin'],
      'App.Credits': ['balance','charge','canAfford','reset','fmt','log'],
      'App.Boards': ['all','persist','save','blank','blankPage','active','activePage','setActive','setActivePage','activeId','activeIndex' in App ? 'activePageIndex' : 'activePageIndex'],
      'App': ['register','byId','makeCtx','open','home','handleBack','layout','button','el','esc','toast','modal','beep','chime','speak','micDiagnosis','showCredits','renderCredits'],
      'Board': ['init','showBoard','showOverview','addWidget','mountWidget','removeWidget','loadPage','redraw','save','page','board','showPalette','exportPage']
    };
    const fel = [];
    Object.keys(krav).forEach(path => {
      const obj = path.split('.').reduce((o, k) => o && o[k], window);
      if (!obj) { fel.push(path + ' saknas helt'); return; }
      krav[path].forEach(m => { if (typeof obj[m] !== 'function') fel.push(path + '.' + m); });
    });
    return fel;
  });
  console.log('saknade metoder: ' + (saknas.length ? saknas.join(', ') : 'inga'));

  // 1) Nyckeltestet — det som gav rött kryss på plattan
  const key = await p.evaluate(() => new Promise(r => App.Gemini.testKey(r)));
  console.log('testKey: ok=' + key.ok + ' läge=' + key.mode);
  console.log('  ' + key.text.split('\n').join('\n  '));
  console.log('sparat authMode: ' + await p.evaluate(() => App.Gemini.authMode()));
  console.log('wsParam: ' + await p.evaluate(() => App.Gemini.wsParam().slice(0, 22)));

  // 2) Tramsdetektorns AI-anslutning (stubbad WebSocket)
  const conn = await p.evaluate(() => {
    const opened = [];
    window.WebSocket = function (url) { opened.push(url); this.readyState = 0; this.close = () => {}; this.send = () => {}; };
    Trams.mode = 'ai'; Trams.armed = true;
    Trams.connect();
    return { url: opened[0] ? opened[0].slice(0, 90) : null, state: Trams.wsState, status: Trams.status, mode: Trams.mode };
  });
  console.log('connect: ' + JSON.stringify(conn));

  // 3) AI-kort: fråga, svar, och "lägg på tavlan"
  await p.evaluate(() => { Trams.armed = false; Board.addWidget('aiord'); });
  await p.waitForTimeout(200);
  await p.evaluate(() => { document.querySelector('.widget input[type=text]').value = 'demokrati'; });
  await p.evaluate(() => Array.from(document.querySelectorAll('.widget .btn')).find(b => b.textContent.includes('Fråga AI:n')).click());
  await p.waitForTimeout(400);
  console.log('AI-kort svar: ' + JSON.stringify(await p.evaluate(() => ({
    text: document.querySelectorAll('.widget .card')[0].textContent.slice(0, 40),
    saldo: App.Credits.balance() }))));
  await p.evaluate(() => Array.from(document.querySelectorAll('.widget .btn')).find(b => b.textContent.includes('Lägg på tavlan')).click());
  await p.waitForTimeout(300);
  console.log('anteckning skapad: ' + await p.evaluate(() => Board.page().widgets.filter(w => w.tool === 'notes').length));

  // 4) PDF-uppladdning och AI-Lärarens låsning
  const up = await p.evaluate(() => new Promise(r => {
    const f = new File([new Blob(['%PDF-1.4 test'])], 'arbetsbok.pdf', { type: 'application/pdf' });
    App.Gemini.uploadFile(f, 'arbetsbok', (err, doc) => r({ err, namn: doc && doc.name, kind: doc && doc.kind }));
  }));
  console.log('upload: ' + JSON.stringify(up));
  await p.evaluate(() => Board.addWidget('ailarare'));
  await p.waitForTimeout(300);
  console.log('AI-Lärare upplåst efter PDF: ' + await p.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('.widget input[type=text]')).pop();
    return !inp.disabled;
  }));

  // 5) Alla komponenter monterar fortfarande
  const bad = await p.evaluate(async () => {
    const fel = [];
    for (const t of App.tools) {
      if (t.id === 'settings') continue;
      try { const d = document.createElement('div'); t.mount(d, App.makeCtx('probe-' + t.id)); } catch (e) { fel.push(t.id + ': ' + e.message); }
    }
    return fel;
  });
  console.log('komponenter som kraschar: ' + (bad.length ? bad.join(' | ') : 'inga'));

  console.log('\nfel: ' + errors.length); errors.slice(0, 10).forEach(e => console.log(' - ' + e));
  await b.close();
  process.exit(errors.length || saknas.length || bad.length ? 1 : 0);
})();
