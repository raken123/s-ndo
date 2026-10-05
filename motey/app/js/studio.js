/* Motey Studio – Motey designs, codes and writes tutorials for your project.
 *
 * Describe what you want to build (and add pictures from your computer or the
 * internet). Motey explains how it fits together, then makes several variants
 * of: code, designs (rendered live), tutorials, what to buy, names, and more
 * (time plan, roles, risks, pitch …). Gemini 3.8 Flash does the work; without
 * Gemini an offline template engine fills in. Every generation is metered. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SECTIONS = [
    { k: 'plan', icon: '🧭', name: 'Plan', cost: 'studio_plan', what: 'Hur allt hänger ihop' },
    { k: 'code', icon: '💻', name: 'Kod', cost: 'studio_code', what: 'Flera kodvarianter' },
    { k: 'design', icon: '🎨', name: 'Design', cost: 'studio_design', what: 'Skisser, sidor, loggor, diagram' },
    { k: 'tutorial', icon: '📚', name: 'Tutorial', cost: 'studio_tutorial', what: 'Steg för steg' },
    { k: 'buy', icon: '🛒', name: 'Inköp', cost: 'studio_buy', what: 'Vad ni ska köpa' },
    { k: 'names', icon: '🏷️', name: 'Namn', cost: 'studio_names', what: 'Namn, slogan, domän' },
    { k: 'more', icon: '✨', name: 'Mer', cost: 'studio_more', what: 'Tidsplan, roller, risker, pitch …' }
  ];
  const MORE = ['Tidsplan', 'Roller i teamet', 'Risker', 'Pitch', 'Testplan', 'Budget', 'README', 'FAQ', 'Marknadsföring', 'Licenser & juridik', 'Mötesagenda', 'Presentation'];
  const S = () => Store.settings;
  const projects = () => Store.state.studio || (Store.state.studio = []);
  const variantsWanted = () => S().demo ? 3 : ({ lite: 2, plus: 3, pro: 5 }[Plans.plan().id] || 2);

  /* ---------------- images (IndexedDB) ---------------- */
  const Img = (() => {
    let dbp;
    const db = () => dbp || (dbp = new Promise((res, rej) => { const q = indexedDB.open('motey-studio', 1); q.onupgradeneeded = () => q.result.createObjectStore('img'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
    const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('img', mode); const r = fn(t.objectStore('img')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
    return { put: (id, v) => tx('readwrite', s => s.put(v, id)), get: id => tx('readonly', s => s.get(id)), del: id => tx('readwrite', s => s.delete(id)) };
  })();
  function shrink(src, max, q) {
    return new Promise((res, rej) => {
      const i = new Image(); i.crossOrigin = 'anonymous';
      i.onload = () => {
        const k = Math.min(1, max / Math.max(i.width, i.height));
        const c = document.createElement('canvas'); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
        c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
        try { res(c.toDataURL('image/jpeg', q || 0.85)); } catch (e) { rej(e); }
      };
      i.onerror = () => rej(new Error('bilden gick inte att läsa'));
      i.src = src;
    });
  }
  async function addImage(p, src, name) {
    const full = await shrink(src, 1024), thumb = await shrink(full, 160, 0.7);
    const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await Img.put(id, full);
    p.images.push({ id, name: name || 'bild', thumb });
    Store.save();
  }
  async function fromUrl(url) {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const b = await r.blob();
    if (!/^image\//.test(b.type)) throw new Error('inte en bild');
    return new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); });
  }
  async function commonsSearch(q) {
    const u = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=16&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap');
    const d = await (await fetch(u)).json();
    return Object.values((d.query && d.query.pages) || {}).map(p => ({ title: p.title.replace(/^File:/, ''), thumb: p.imageinfo && p.imageinfo[0].thumburl, page: p.imageinfo && p.imageinfo[0].descriptionurl })).filter(x => x.thumb);
  }

  /* ---------------- tiny markdown ---------------- */
  function md(text) {
    const lines = esc(text || '').split('\n');
    let out = '', list = null, code = false, buf = [];
    const inline = s => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const close = () => { if (list) { out += `</${list}>`; list = null; } };
    for (const l of lines) {
      if (/^```/.test(l)) { if (code) { out += `<pre><code>${buf.join('\n')}</code></pre>`; buf = []; code = false; } else { close(); code = true; } continue; }
      if (code) { buf.push(l); continue; }
      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)/))) { close(); out += `<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`; }
      else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += `<li>${inline(m[1])}</li>`; }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
      else if (/^\|.*\|$/.test(l.trim())) { close(); if (!/^\|[\s:|-]+\|$/.test(l.trim())) out += '<div class="mdrow">' + l.trim().slice(1, -1).split('|').map(c => `<span>${inline(c.trim())}</span>`).join('') + '</div>'; }
      else if (!l.trim()) close();
      else { close(); out += `<p>${inline(l)}</p>`; }
    }
    if (code) out += `<pre><code>${buf.join('\n')}</code></pre>`;
    close();
    return out;
  }

  /* ---------------- generation ---------------- */
  const g = () => Gemini.schema;
  const N = () => ({ type: 'NUMBER' });
  const SCHEMA = {
    plan: () => g().obj({ variants: g().arr(g().obj({ name: g().str, summary: g().str, parts: g().arr(g().obj({ name: g().str, what: g().str, why: g().str })), steps: g().arr(g().obj({ title: g().str, detail: g().str })), glossary: g().arr(g().obj({ term: g().str, explain: g().str })) })) }),
    code: () => g().obj({ variants: g().arr(g().obj({ name: g().str, description: g().str, language: g().str, run: g().str, files: g().arr(g().obj({ path: g().str, content: g().str })) })) }),
    design: () => g().obj({ variants: g().arr(g().obj({ name: g().str, idea: g().str, kind: g().str, html: g().str })) }),
    tutorial: () => g().obj({ variants: g().arr(g().obj({ name: g().str, level: g().str, chapters: g().arr(g().obj({ title: g().str, text: g().str, code: g().str, check: g().str })) })) }),
    buy: () => g().obj({ variants: g().arr(g().obj({ name: g().str, note: g().str, lists: g().arr(g().obj({ tier: g().str, items: g().arr(g().obj({ name: g().str, why: g().str, priceSek: g().int, where: g().str })) })) })) }),
    names: () => g().obj({ variants: g().arr(g().obj({ name: g().str, names: g().arr(g().obj({ name: g().str, slogan: g().str, why: g().str, domain: g().str })) })) }),
    more: () => g().obj({ variants: g().arr(g().obj({ name: g().str, markdown: g().str })) })
  };
  const ASK = {
    plan: n => `Förklara för teamet, enkelt och korrekt, hur projektet fungerar och hänger ihop. Ge ${n} olika angreppssätt (varianter). För varje: ett namn, en sammanfattning (3–5 meningar), delarna som behövs (vad och varför), steg i ordning, och en ordlista med svåra ord.`,
    code: n => `Skriv ${n} olika, kompletta och körbara kodvarianter för projektet (t.ex. enkel, snabb, avancerad, olika språk/ramverk). Varje variant: namn, beskrivning, språk, kommando för att köra, och alla filer med full innehåll (inga "..." eller platshållare). Kommentarer på svenska. Om något kan visas i webbläsaren, lägg med en index.html.`,
    design: n => `Gör ${n} olika designförslag (t.ex. logga, startsida/app-skärm, arkitekturdiagram, affisch). Varje design är ett komplett, fristående HTML-dokument med inbäddad CSS och/eller SVG som fyller sidan snyggt – inga externa filer, typsnitt eller bilder från internet. Svensk text. Bifogade bilder kan användas med src="{{IMG1}}", "{{IMG2}}" osv. kind är en av: logo, ui, diagram, poster, annat.`,
    tutorial: n => `Skriv ${n} tutorials på olika nivåer (t.ex. nybörjare, mellan, avancerad) som lär teamet att bygga projektet själva. Varje tutorial: namn, nivå och 4–8 kapitel med text, eventuell kod och en kontroll ("så vet du att det funkar").`,
    buy: n => `Gör ${n} inköpslistor (t.ex. olika budgetar eller upplägg) med allt teamet behöver köpa eller skaffa (hårdvara, tjänster, licenser, material). Dela in i nivåer. Priser i svenska kronor som heltal, ungefärliga, och var man köper. note förklarar att priserna är ungefärliga.`,
    names: n => `Föreslå namn för projektet: ${n} olika namnlistor med olika stil (t.ex. seriöst, lekfullt, svenskt, internationellt). Varje namn: namn, slogan, varför, och ett möjligt domännamn.`,
    more: (n, topic) => `Skriv om "${topic}" för projektet, konkret och användbart, i Markdown (rubriker, listor, tabeller med |). Ge ${Math.min(n, 2)} varianter med olika upplägg.`
  };
  function context(p) {
    const plan = p.sections.plan && p.sections.plan.variants[0];
    return `Projekt: ${p.title}\nBeskrivning: ${p.prompt}\nTeam: ${(p.team || []).join(', ') || 'okänt'}` +
      (plan ? `\nPlan hittills: ${plan.summary}` : '') +
      (p.images.length ? `\nTeamet har bifogat ${p.images.length} bild(er) som referens (${p.images.map((x, i) => `IMG${i + 1}: ${x.name}`).join(', ')}).` : '');
  }

  async function generate(p, k, opts) {
    opts = opts || {};
    const sec = SECTIONS.find(s => s.k === k);
    if (!Plans.allow(sec.cost)) return false;
    const n = variantsWanted();
    let res, source;
    if (AI.hasKey() && !S().demo) {
      const parts = [{ text: `${context(p)}\n\n${ASK[k](n, opts.topic)}${opts.change ? `\n\nTeamet vill ändra så här: ${opts.change}` : ''}\n\nSvara på svenska.` }];
      for (const im of p.images.slice(0, 6)) { const data = await Img.get(im.id); if (data) parts.push({ inlineData: { mimeType: 'image/jpeg', data: data.split(',')[1] } }); }
      try {
        res = await Gemini.generate({ system: 'Du är Motey Studio: en kunnig, pedagogisk designer, utvecklare och lärare. Du hjälper team som inte kan designa eller koda. Var konkret och korrekt.', parts, schema: SCHEMA[k](), action: sec.cost, temperature: opts.change ? 0.7 : 0.9 });
        source = 'gemini';
      } catch (e) {
        if (e.kind === 'quota' || e.status === 402) { Plans.refresh(); Plans.upgradeSheet(new Plans.QuotaError('quota', sec.cost)); return false; }
        App.toast('Gemini: ' + e.message + ' – använder offline-mallar', 5000);
      }
    }
    if (!res) { res = Offline[k](p, n, opts); source = 'offline'; }
    Plans.charge(sec.cost);
    const s = p.sections[k] || (p.sections[k] = { variants: [] });
    s.source = source;
    s.variants = (res.variants || []).concat(opts.replace ? [] : s.variants).slice(0, 15);
    if (opts.topic) s.variants.forEach(v => { v.topic = v.topic || opts.topic; });
    Store.save();
    return true;
  }

  /* ---------------- offline templates ---------------- */
  const words = t => (String(t).toLowerCase().match(/[a-zåäö0-9]{4,}/g) || []).filter(w => !/^(vill|ska|bygga|kunna|inte|eller|till|från|med|som|vara|göra|team|teamet|vårt|våra|ett|och)$/.test(w));
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const palette = [['#6C4CF5', '#FF5C8A'], ['#0EA5E9', '#22C55E'], ['#F97316', '#FACC15'], ['#111827', '#6366F1'], ['#DB2777', '#7C3AED']];
  const Offline = {
    plan(p) {
      return { variants: [{ name: 'Grundplan (offline-mall)', summary: `${p.title}: börja litet, få något att fungera, visa det för någon och bygg vidare. Koppla Gemini (Mer → AI) så förklarar Motey just ert projekt på riktigt.`,
        parts: [{ name: 'Mål', what: 'Vad ska vara klart och för vem?', why: 'Alla i teamet drar åt samma håll.' }, { name: 'Prototyp', what: 'Den minsta versionen som går att visa.', why: 'Ni lär er mest av att testa.' }, { name: 'Verktyg', what: 'Program, språk och tjänster ni behöver.', why: 'Rätt verktyg sparar veckor.' }, { name: 'Test', what: 'Låt riktiga användare prova.', why: 'Hitta felen innan lansering.' }],
        steps: [{ title: 'Skriv målet i en mening', detail: 'Tänk: vem, vad, varför.' }, { title: 'Dela upp i små delar', detail: 'Varje del ska gå att göra på en dag.' }, { title: 'Bygg prototypen', detail: 'Se Kod- och Design-flikarna.' }, { title: 'Testa och förbättra', detail: 'Fråga minst fem personer.' }],
        glossary: [{ term: 'Prototyp', explain: 'En första, enkel version.' }, { term: 'MVP', explain: 'Minsta produkten som ger värde.' }] }] };
    },
    code(p, n) {
      const t = esc(p.title);
      const html = `<!doctype html>\n<html lang="sv">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${t}</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <main>\n    <h1>${t}</h1>\n    <p>${esc(p.prompt)}</p>\n    <button id="go">Testa</button>\n    <p id="out"></p>\n  </main>\n  <script src="app.js"></script>\n</body>\n</html>\n`;
      return { variants: [
        { name: 'Webbsida (HTML/CSS/JS)', description: 'En startsida ni kan öppna direkt i webbläsaren och bygga vidare på.', language: 'html', run: 'Öppna index.html i webbläsaren', files: [{ path: 'index.html', content: html }, { path: 'style.css', content: 'body{font-family:system-ui,sans-serif;margin:0;background:#F6F4FF;color:#1E1B3A}\nmain{max-width:640px;margin:10vh auto;padding:24px}\nh1{font-size:2.4rem}\nbutton{background:#6C4CF5;color:#fff;border:0;padding:12px 20px;border-radius:999px;font-weight:800;cursor:pointer}\n' }, { path: 'app.js', content: "// Här lägger ni logiken.\ndocument.getElementById('go').addEventListener('click', () => {\n  document.getElementById('out').textContent = 'Det fungerar! Nästa steg: bygg första funktionen.';\n});\n" }] },
        { name: 'Python-skelett', description: 'En ren start för ett Python-projekt med tester.', language: 'python', run: 'python main.py', files: [{ path: 'main.py', content: `"""${p.title}"""\n\n\ndef main():\n    print("Hej från ${p.title.replace(/"/g, '')}!")\n\n\nif __name__ == "__main__":\n    main()\n` }, { path: 'test_main.py', content: 'from main import main\n\n\ndef test_main(capsys):\n    main()\n    assert "Hej" in capsys.readouterr().out\n' }, { path: 'README.md', content: `# ${p.title}\n\n${p.prompt}\n\n## Kör\n\n    python main.py\n    pip install pytest && pytest\n` }] },
        { name: 'Node.js-server', description: 'En liten webbserver utan beroenden.', language: 'javascript', run: 'node server.js', files: [{ path: 'server.js', content: `const http = require('http');\nhttp.createServer((req, res) => {\n  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });\n  res.end('<h1>${p.title.replace(/'/g, '')}</h1><p>Servern fungerar.</p>');\n}).listen(3000, () => console.log('http://localhost:3000'));\n` }] }
      ].slice(0, Math.max(2, n)) };
    },
    design(p, n) {
      const ini = (p.title.match(/\b\w/g) || ['M']).slice(0, 2).join('').toUpperCase();
      const v = [];
      for (let i = 0; i < Math.max(3, n); i++) {
        const [a, b] = palette[i % palette.length];
        if (i % 3 === 0) v.push({ name: `Logga ${i / 3 + 1}`, idea: 'Initialer i en mjuk form med gradient.', kind: 'logo', html: `<!doctype html><body style="margin:0;display:grid;place-items:center;height:100vh;background:#fff;font-family:system-ui"><svg viewBox="0 0 300 160" width="90%"><defs><linearGradient id="g"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect x="10" y="30" width="100" height="100" rx="${28 + i * 4}" fill="url(#g)"/><text x="60" y="96" text-anchor="middle" font-size="44" font-weight="900" fill="#fff">${esc(ini)}</text><text x="128" y="92" font-size="26" font-weight="900" fill="#1E1B3A">${esc(p.title.slice(0, 16))}</text></svg></body>` });
        else if (i % 3 === 1) v.push({ name: `Startsida ${Math.ceil(i / 3)}`, idea: 'Stor rubrik, kort text och en tydlig knapp.', kind: 'ui', html: `<!doctype html><body style="margin:0;font-family:system-ui;background:linear-gradient(135deg,${a},${b});color:#fff;min-height:100vh;display:grid;place-items:center;text-align:center"><div style="padding:30px"><h1 style="font-size:42px;margin:0 0 12px">${esc(p.title)}</h1><p style="opacity:.9;max-width:28em;margin:0 auto 22px">${esc(p.prompt.slice(0, 140))}</p><a style="background:#fff;color:${a};padding:12px 24px;border-radius:999px;font-weight:800;text-decoration:none">Kom igång</a></div></body>` });
        else v.push({ name: `Flödesschema ${Math.ceil(i / 3)}`, idea: 'Från idé till lansering i fyra steg.', kind: 'diagram', html: `<!doctype html><body style="margin:0;font-family:system-ui;background:#fff"><svg viewBox="0 0 400 260" width="100%" height="100%">${['Idé', 'Prototyp', 'Test', 'Lansering'].map((s, j) => `<rect x="${12 + j * 98}" y="100" width="84" height="56" rx="14" fill="${j % 2 ? b : a}"/><text x="${54 + j * 98}" y="133" text-anchor="middle" fill="#fff" font-weight="800" font-size="14">${s}</text>${j < 3 ? `<path d="M${98 + j * 98} 128h10" stroke="#1E1B3A" stroke-width="3"/>` : ''}`).join('')}<text x="200" y="60" text-anchor="middle" font-weight="900" font-size="20" fill="#1E1B3A">${esc(p.title.slice(0, 30))}</text></svg></body>` });
      }
      return { variants: v.slice(0, Math.max(3, n)) };
    },
    tutorial(p) {
      return { variants: [{ name: `Kom igång med ${p.title}`, level: 'Nybörjare', chapters: [
        { title: '1. Bestäm vad som ska byggas', text: 'Skriv målet i en mening och välj den minsta versionen som går att visa.', code: '', check: 'Alla i teamet kan säga målet.' },
        { title: '2. Starta koden', text: 'Ladda ner en kodvariant från Kod-fliken och öppna den.', code: 'Öppna index.html i webbläsaren', check: 'Sidan visas.' },
        { title: '3. Gör en ändring', text: 'Byt rubriken och färgen. Ladda om sidan.', code: '', check: 'Ändringen syns.' },
        { title: '4. Visa någon', text: 'Låt en kompis testa och skriv ner vad som var svårt.', code: '', check: 'Ni har tre saker att förbättra.' }
      ] }] };
    },
    buy() {
      return { variants: [{ name: 'Grundlista (offline-mall)', note: 'Ungefärliga priser – koppla Gemini för en lista anpassad efter ert projekt.', lists: [
        { tier: 'Gratis', items: [{ name: 'VS Code', why: 'Kodredigerare.', priceSek: 0, where: 'code.visualstudio.com' }, { name: 'GitHub', why: 'Spara och dela koden.', priceSek: 0, where: 'github.com' }] },
        { tier: 'Liten budget', items: [{ name: 'Domännamn (.se)', why: 'Egen adress.', priceSek: 150, where: 'Loopia, One.com' }, { name: 'Webbhotell / molnserver', why: 'Lägga ut tjänsten.', priceSek: 60, where: 'per månad' }] }
      ] }] };
    },
    names(p, n) {
      const w = words(p.title + ' ' + p.prompt).slice(0, 4).map(cap);
      const base = w[0] || 'Projekt';
      const ends = ['ify', 'ly', 'io', 'hub', 'lab', 'flow', 'verket', 'kraft', 'motor', 'nest'];
      const names = [];
      for (let i = 0; i < 8; i++) { const nm = (i % 2 ? (w[i % w.length] || base) : base) + ends[i]; names.push({ name: nm, slogan: ['Enkelt. Smart. Ert.', 'Byggt av oss, för er.', 'Nästa steg börjar här.', 'Mindre krångel, mer gjort.'][i % 4], why: 'Kort och lätt att säga.', domain: nm.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o') + '.se' }); }
      return { variants: [{ name: 'Namnförslag (offline-mall)', names }] };
    },
    more(p, n, o) {
      const t = (o && o.topic) || 'Tidsplan';
      const body = {
        'Tidsplan': '| Vecka | Mål |\n|---|---|\n| 1 | Mål och plan klara |\n| 2 | Första prototypen |\n| 3 | Test med användare |\n| 4 | Förbättra och visa |',
        'Roller i teamet': (p.team || ['Person 1', 'Person 2', 'Person 3']).map((m, i) => `- **${m}**: ${['projektledare och kontakt', 'kod och teknik', 'design och test'][i % 3]}`).join('\n'),
        'Risker': '- **Tiden räcker inte** – gör prototypen mindre.\n- **Något är svårare än trott** – fråga Motey eller sök hjälp tidigt.\n- **Ingen vill använda det** – testa med riktiga personer tidigt.'
      }[t] || `- Skriv ner vad ${t.toLowerCase()} betyder för just er.\n- Koppla Gemini så skriver Motey ett riktigt förslag.`;
      return { variants: [{ name: t, topic: t, markdown: `## ${t} för ${p.title}\n\n${body}` }] };
    }
  };

  /* ---------------- export & share ---------------- */
  const slug = s => String(s).toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projekt';
  function planMd(v) { return `# ${v.name}\n\n${v.summary}\n\n## Delar\n${v.parts.map(x => `- **${x.name}**: ${x.what} (${x.why})`).join('\n')}\n\n## Steg\n${v.steps.map((x, i) => `${i + 1}. **${x.title}** – ${x.detail}`).join('\n')}\n\n## Ordlista\n${(v.glossary || []).map(x => `- **${x.term}**: ${x.explain}`).join('\n')}\n`; }
  function tutMd(v) { return `# ${v.name} (${v.level})\n\n` + v.chapters.map(c => `## ${c.title}\n\n${c.text}\n\n${c.code ? '```\n' + c.code + '\n```\n\n' : ''}✅ ${c.check}\n`).join('\n'); }
  function buyMd(v) { return `# ${v.name}\n\n${v.note || ''}\n\n` + v.lists.map(l => `## ${l.tier} (ca ${l.items.reduce((a, x) => a + (x.priceSek || 0), 0).toLocaleString('sv-SE')} kr)\n` + l.items.map(x => `- **${x.name}** – ${x.why} · ca ${(x.priceSek || 0).toLocaleString('sv-SE')} kr · ${x.where}`).join('\n')).join('\n\n') + '\n'; }
  function namesMd(v) { return `# ${v.name}\n\n` + v.names.map(x => `- **${x.name}** – ”${x.slogan}” · ${x.why} · ${x.domain}`).join('\n') + '\n'; }
  async function exportZip(p) {
    const files = [], sec = p.sections, base = slug(p.title) + '/';
    files.push({ name: base + 'LÄS-MIG.md', data: `# ${p.title}\n\n${p.prompt}\n\nSkapat med Motey Studio.\n` });
    (sec.plan && sec.plan.variants || []).forEach((v, i) => files.push({ name: `${base}plan/${i + 1}-${slug(v.name)}.md`, data: planMd(v) }));
    (sec.code && sec.code.variants || []).forEach((v, i) => v.files.forEach(f => files.push({ name: `${base}kod/${i + 1}-${slug(v.name)}/${f.path.replace(/^\/+|\.\.\//g, '')}`, data: f.content })));
    (sec.design && sec.design.variants || []).forEach((v, i) => files.push({ name: `${base}design/${i + 1}-${slug(v.name)}.html`, data: v.html }));
    (sec.tutorial && sec.tutorial.variants || []).forEach((v, i) => files.push({ name: `${base}tutorial/${i + 1}-${slug(v.name)}.md`, data: tutMd(v) }));
    (sec.buy && sec.buy.variants || []).forEach((v, i) => files.push({ name: `${base}inkop/${i + 1}-${slug(v.name)}.md`, data: buyMd(v) }));
    (sec.names && sec.names.variants || []).forEach((v, i) => files.push({ name: `${base}namn/${i + 1}-${slug(v.name)}.md`, data: namesMd(v) }));
    (sec.more && sec.more.variants || []).forEach((v, i) => files.push({ name: `${base}mer/${i + 1}-${slug(v.name)}.md`, data: v.markdown }));
    for (const [i, im] of p.images.entries()) { const d = await Img.get(im.id); if (d) files.push({ name: `${base}bilder/${i + 1}.jpg`, data: Nostr.unb64(d.split(',')[1]) }); }
    return Docs.zip(files);
  }
  function inlineWeb(files) {
    const html = files.find(f => /(^|\/)index\.html?$/i.test(f.path)) || files.find(f => /\.html?$/i.test(f.path));
    if (!html) return null;
    const by = p => files.find(f => f.path.replace(/^\.?\//, '') === p.replace(/^\.?\//, ''));
    return html.content
      .replace(/<link[^>]+href="([^"]+\.css)"[^>]*>/gi, (m, h) => by(h) ? `<style>${by(h).content}</style>` : m)
      .replace(/<script([^>]*)\ssrc="([^"]+\.js)"[^>]*><\/script>/gi, (m, a, s) => by(s) ? `<script${a}>${by(s).content.replace(/<\/script/gi, '<\\/script')}</script>` : m);
  }
  async function withImages(p, html) {
    let out = html;
    for (let i = 0; i < p.images.length; i++) if (out.includes(`{{IMG${i + 1}}}`)) out = out.split(`{{IMG${i + 1}}}`).join(await Img.get(p.images[i].id) || '');
    return out;
  }

  /* ---------------- views ---------------- */
  function renderList(v) {
    const list = projects().slice().sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
    v.innerHTML = `<div class="studio-hero card hero">${Mascot.svg({ size: 90, mood: 'happy' })}<div style="flex:1"><h1 style="margin:0">🛠️ Motey Studio</h1>
      <p class="muted" style="margin:.3em 0 0">Kan ni inte designa, koda eller veta hur grejerna sitter ihop? Berätta vad ni vill bygga – Motey förklarar, kodar, designar, skriver tutorials och gör flera varianter av allt.</p></div></div>
      <div class="card"><h2>Vad vill ni bygga?</h2>
        <label class="field"><span>Projekt</span><input type="text" id="st-title" placeholder="t.ex. En egen transformer-AI"></label>
        <label class="field"><span>Beskriv det med egna ord</span><textarea id="st-prompt" placeholder="Vi är tre personer som vill … men vi kan inte …"></textarea></label>
        <label class="field"><span>Teamet (valfritt, kommaseparerat)</span><input type="text" id="st-team" placeholder="Karl, Amina, Leo"></label>
        <button class="btn block" id="st-go">✨ Motey, sätt igång!</button>
        <p class="small muted" style="margin-top:8px">Bilder från datorn eller internet lägger ni till i projektet.</p></div>
      <h2>Projekt</h2>
      ${list.map(p => `<div class="meeting" data-id="${p.id}" role="button" tabindex="0"><div class="date" style="font-size:1.5rem">🛠️</div><div class="info"><div class="t">${esc(p.title)}</div>
        <div class="small muted">${SECTIONS.filter(s => p.sections[s.k] && p.sections[s.k].variants.length).map(s => s.icon).join(' ') || 'Inget skapat än'}${p.demo ? ' · <span class="badge">Exempel</span>' : ''}</div></div><div>›</div></div>`).join('')}`;
    $$('.meeting', v).forEach(el => el.addEventListener('click', () => App.go('#/studio/' + el.dataset.id)));
    $('#st-go', v).addEventListener('click', async () => {
      const title = $('#st-title', v).value.trim(), prompt = $('#st-prompt', v).value.trim();
      if (!title && !prompt) return App.toast('Skriv vad ni vill bygga först');
      const p = { id: 'p' + Date.now().toString(36), title: title || prompt.slice(0, 40), prompt: prompt || title, team: $('#st-team', v).value.split(',').map(x => x.trim()).filter(Boolean), images: [], sections: {}, created: Date.now() };
      projects().push(p); Store.save();
      App.go('#/studio/' + p.id + '/plan');
      setTimeout(() => run(p, 'plan'), 200);
    });
  }

  let current = null;
  function render(v, id, sec, ui) {
    if (!projects().some(p => p.id === StudioDemo.id)) { projects().push(JSON.parse(JSON.stringify(StudioDemo))); Store.save(); }
    if (!id) return renderList(v);
    const p = projects().find(x => x.id === id);
    if (!p) return App.go('#/studio');
    const k = SECTIONS.some(s => s.k === sec) ? sec : 'plan';
    current = { p, k, v };
    const plan = p.sections.plan && p.sections.plan.variants[0];
    v.innerHTML = `<div class="row between"><a class="btn sm ghost" href="#/studio">‹ Projekt</a>
        <div class="row"><button class="btn sm ghost" id="st-zip">⬇ Exportera allt</button><button class="btn sm ghost" id="st-share">📤 Dela med teamet</button><button class="icon-btn" id="st-del" title="Ta bort">🗑️</button></div></div>
      <h1 style="margin-top:12px">${esc(p.title)}</h1>
      <div class="motey-stage" style="margin-bottom:12px">${Mascot.svg({ size: 70 })}<div class="speech">${esc(plan ? plan.summary : 'Jag börjar med att förklara hur ert projekt hänger ihop – tryck på Plan.')}</div></div>
      <div class="st-images" id="st-imgs"></div>
      <div class="tabs st-tabs">${SECTIONS.map(s => `<button data-k="${s.k}" class="${s.k === k ? 'on' : ''}">${s.icon} ${s.name}${p.sections[s.k] && p.sections[s.k].variants.length ? ` <span class="cnt">${p.sections[s.k].variants.length}</span>` : ''}</button>`).join('')}</div>
      <div id="st-body"></div>`;
    $$('.st-tabs button', v).forEach(b => b.addEventListener('click', () => { history.replaceState(null, '', `#/studio/${p.id}/${b.dataset.k}`); render(v, p.id, b.dataset.k, ui); }));
    $('#st-del', v).addEventListener('click', async () => { if (!confirm('Ta bort projektet från den här enheten?')) return; for (const im of p.images) Img.del(im.id); Store.state.studio = projects().filter(x => x !== p); Store.save(); App.go('#/studio'); });
    $('#st-zip', v).addEventListener('click', async () => App.toast(await Platform.saveFile(slug(p.title) + '.zip', await exportZip(p))));
    $('#st-share', v).addEventListener('click', () => share(p));
    $('.motey-stage .speech', v).addEventListener('click', () => plan && Platform.speak(plan.summary));
    drawImages(p);
    drawSection(p, k);
  }

  function drawImages(p) {
    const box = $('#st-imgs'); if (!box) return;
    box.innerHTML = p.images.map((im, i) => `<div class="st-img" style="background-image:url(${im.thumb})" title="IMG${i + 1}: ${esc(im.name)}"><span>${i + 1}</span><button data-i="${i}" aria-label="Ta bort">✕</button></div>`).join('') +
      `<label class="st-add">🖼️ Från datorn<input type="file" accept="image/*" multiple hidden id="st-file"></label><button class="st-add" id="st-web">🌐 Från internet</button>`;
    $$('.st-img button', box).forEach(b => b.addEventListener('click', () => { const im = p.images.splice(+b.dataset.i, 1)[0]; Img.del(im.id); Store.save(); drawImages(p); }));
    $('#st-file', box).addEventListener('change', async e => {
      for (const f of e.target.files) { try { await addImage(p, URL.createObjectURL(f), f.name); } catch (err) { App.toast(f.name + ': ' + err.message); } }
      drawImages(p); App.toast('🖼️ Bilderna är med – Motey använder dem i design och kod');
    });
    $('#st-web', box).addEventListener('click', () => webSheet(p));
  }

  function webSheet(p) {
    const sh = App.sheet(`<h2>🌐 Bilder från internet</h2><p class="small muted">Sök bland fria bilder på Wikimedia Commons, eller klistra in en bildlänk. Kolla licensen innan ni använder en bild i något ni publicerar.</p>
      <div class="row"><input type="text" id="ws-q" placeholder="t.ex. neural network, robot, logga" style="flex:1"><button class="btn" id="ws-go">Sök</button></div>
      <div class="ws-grid" id="ws-res"></div>
      <div class="row" style="margin-top:12px"><input type="url" id="ws-url" placeholder="https://… (direktlänk till en bild)" style="flex:1"><button class="btn ghost" id="ws-add">Lägg till</button></div>`);
    const res = $('#ws-res', sh.el);
    const search = async () => {
      const q = $('#ws-q', sh.el).value.trim(); if (!q) return;
      res.innerHTML = '<p class="muted">Söker…</p>';
      try {
        const hits = await commonsSearch(q);
        res.innerHTML = hits.map((h, i) => `<button class="ws-hit" data-i="${i}" style="background-image:url('${esc(h.thumb)}')" title="${esc(h.title)}"></button>`).join('') || '<p class="muted">Inga bilder hittades.</p>';
        $$('.ws-hit', res).forEach(b => b.addEventListener('click', async () => {
          b.classList.add('busy');
          try { await addImage(p, await fromUrl(hits[+b.dataset.i].thumb), hits[+b.dataset.i].title); b.classList.add('picked'); drawImages(p); }
          catch (e) { App.toast('Kunde inte hämta bilden: ' + e.message); }
          b.classList.remove('busy');
        }));
      } catch (e) { res.innerHTML = `<p class="muted">Kunde inte söka (${esc(e.message)}). Är ni uppkopplade?</p>`; }
    };
    $('#ws-go', sh.el).addEventListener('click', search);
    $('#ws-q', sh.el).addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
    $('#ws-add', sh.el).addEventListener('click', async () => {
      const u = $('#ws-url', sh.el).value.trim(); if (!u) return;
      try { await addImage(p, await fromUrl(u), u.split('/').pop().slice(0, 60)); drawImages(p); App.toast('🖼️ Tillagd'); $('#ws-url', sh.el).value = ''; }
      catch (e) { App.toast('Gick inte: ' + e.message + ' (sidan kanske inte tillåter det – spara bilden och lägg till den från datorn)', 6000); }
    });
  }

  async function run(p, k, opts) {
    const body = $('#st-body');
    const sec = SECTIONS.find(s => s.k === k);
    if (body) body.insertAdjacentHTML('afterbegin', `<div class="card st-working"><div class="motey-stage">${Mascot.svg({ size: 60, talking: true })}<div class="speech typing">Motey ${{ plan: 'tänker ut hur allt hänger ihop', code: 'kodar', design: 'designar', tutorial: 'skriver tutorials', buy: 'gör inköpslistor', names: 'hittar på namn', more: 'skriver' }[k]} – ${variantsWanted()} varianter</div></div></div>`);
    const ok = await generate(p, k, opts);
    p.updated = Date.now(); Store.save();
    if (current && current.p === p && location.hash.startsWith('#/studio/' + p.id)) render(current.v, p.id, k);
    if (ok) App.toast(`${sec.icon} Klart!`);
  }

  function toolbar(p, k, extra) {
    return `<div class="st-tools"><button class="btn sm" data-act="more">🔁 Fler varianter</button>
      <div class="row" style="flex:1;min-width:220px"><input type="text" class="st-change" placeholder="✏️ Ändra: ”gör den mörkare”, ”använd TensorFlow” …" style="flex:1"><button class="btn sm ghost" data-act="change">Ändra</button></div>${extra || ''}</div>`;
  }
  function bindToolbar(box, p, k, topic) {
    $$('[data-act="more"]', box).forEach(b => b.addEventListener('click', () => run(p, k, { topic })));
    $$('[data-act="change"]', box).forEach(b => b.addEventListener('click', () => {
      const c = $('.st-change', box).value.trim(); if (!c) return App.toast('Skriv vad som ska ändras');
      run(p, k, { change: c, topic });
    }));
  }

  function drawSection(p, k) {
    const box = $('#st-body');
    const s = p.sections[k];
    const sec = SECTIONS.find(x => x.k === k);
    if (k === 'more') return drawMore(p, box);
    if (!s || !s.variants.length) {
      box.innerHTML = `<div class="card empty">${Mascot.svg({ size: 90 })}<p><b>${sec.icon} ${sec.name}: ${sec.what}</b></p><p class="small muted">Motey gör ${variantsWanted()} varianter${p.images.length ? ` och använder era ${p.images.length} bilder` : ''}.</p><button class="btn" id="st-gen">✨ Skapa</button></div>`;
      $('#st-gen', box).addEventListener('click', () => run(p, k));
      return;
    }
    const tag = s.source === 'gemini' ? '<span class="ai-tag gemini">Gemini 3.8 Flash</span>' : s.source === 'demo' ? '<span class="ai-tag">Exempel</span>' : '<span class="ai-tag">Offline-mall</span>';
    const pick = (+(box.dataset.v || 0)) < s.variants.length ? +(box.dataset.v || 0) : 0;
    const vtabs = `<div class="row between"><div class="tabs vtabs">${s.variants.map((v, i) => `<button data-v="${i}" class="${i === pick ? 'on' : ''}">${i + 1}. ${esc(v.name)}</button>`).join('')}</div>${tag}</div>`;
    const v = s.variants[pick];
    let html = '';
    if (k === 'plan') html = `<div class="card"><h2>${esc(v.name)}</h2><p>${esc(v.summary)}</p><button class="btn sm ghost" id="say">🔊 Läs upp</button></div>
      <div class="grid three">${v.parts.map(x => `<div class="card" style="margin:0"><h3>${esc(x.name)}</h3><p class="small">${esc(x.what)}</p><p class="small muted">Varför: ${esc(x.why)}</p></div>`).join('')}</div>
      <div class="card" style="margin-top:14px"><h3>Steg för steg</h3><ol class="st-steps">${v.steps.map(x => `<li><b>${esc(x.title)}</b><div class="small muted">${esc(x.detail)}</div></li>`).join('')}</ol></div>
      ${(v.glossary || []).length ? `<div class="card"><h3>Ordlista</h3>${v.glossary.map(x => `<p class="small"><b>${esc(x.term)}</b> – ${esc(x.explain)}</p>`).join('')}</div>` : ''}`;
    if (k === 'code') {
      const web = inlineWeb(v.files);
      html = `<div class="card"><h2>${esc(v.name)} <span class="badge">${esc(v.language)}</span></h2><p>${esc(v.description)}</p>
        ${v.run ? `<div class="st-run"><code>${esc(v.run)}</code><button class="btn sm ghost" data-copy="${esc(v.run)}">📋</button></div>` : ''}
        <div class="row" style="margin:10px 0">${web ? '<button class="btn sm mint" id="run-web">▶ Kör i webbläsaren</button>' : ''}<button class="btn sm ghost" id="dl-var">⬇ Ladda ner varianten (.zip)</button></div>
        <div class="tabs ftabs">${v.files.map((f, i) => `<button data-f="${i}" class="${i ? '' : 'on'}">${esc(f.path)}</button>`).join('')}</div>
        <div class="st-code"><button class="btn sm ghost st-copy" id="cp-file">📋 Kopiera</button><pre><code id="code-view"></code></pre></div>
        <div id="web-out"></div></div>`;
    }
    if (k === 'design') html = `<div class="st-designs">${s.variants.map((d, i) => `<div class="st-design ${i === pick ? 'on' : ''}"><iframe sandbox="allow-scripts" data-i="${i}" title="${esc(d.name)}" loading="lazy"></iframe>
        <div class="st-dmeta"><b>${i + 1}. ${esc(d.name)}</b> <span class="badge">${esc(d.kind)}</span><div class="small muted">${esc(d.idea)}</div>
        <div class="row" style="margin-top:6px"><button class="btn sm ghost" data-big="${i}">🔍 Stor</button><button class="btn sm ghost" data-dl="${i}">⬇ HTML</button><button class="btn sm ghost" data-png="${i}">📋 Kod</button></div></div></div>`).join('')}</div>`;
    if (k === 'tutorial') {
      const done = (p.done || (p.done = {}));
      html = `<div class="card"><h2>${esc(v.name)} <span class="badge">${esc(v.level)}</span></h2>
        <div class="progress"><i style="width:${Math.round(100 * v.chapters.filter((c, i) => done[v.name + i]).length / v.chapters.length)}%"></i></div>
        <div class="row" style="margin-top:8px"><button class="btn sm ghost" id="tut-pdf">⬇ PDF</button><button class="btn sm ghost" id="tut-md">⬇ Markdown</button></div></div>
        ${v.chapters.map((c, i) => `<div class="card st-chapter ${done[v.name + i] ? 'done' : ''}"><div class="row between"><h3 style="margin:0">${esc(c.title)}</h3><button class="icon-btn" data-say="${i}" title="Läs upp">🔊</button></div>
          <p>${esc(c.text)}</p>${c.code ? `<div class="st-code"><button class="btn sm ghost st-copy" data-copy="${esc(c.code)}">📋</button><pre><code>${esc(c.code)}</code></pre></div>` : ''}
          ${c.check ? `<label class="switch small" style="margin-top:8px"><input type="checkbox" data-done="${i}" ${done[v.name + i] ? 'checked' : ''}> ✅ ${esc(c.check)}</label>` : ''}</div>`).join('')}`;
    }
    if (k === 'buy') html = `<p class="small muted">${esc(v.note || '')}</p><div class="st-buy">${v.lists.map(l => `<div class="card" style="margin:0"><h3>${esc(l.tier)}</h3><div class="st-total">ca ${l.items.reduce((a, x) => a + (x.priceSek || 0), 0).toLocaleString('sv-SE')} kr</div>
        ${l.items.map(x => `<div class="st-item"><b>${esc(x.name)}</b><span>ca ${(x.priceSek || 0).toLocaleString('sv-SE')} kr</span><div class="small muted">${esc(x.why)}</div><div class="small">📍 ${esc(x.where)}</div></div>`).join('')}</div>`).join('')}</div>
        <button class="btn sm ghost" id="buy-copy" style="margin-top:12px">📋 Kopiera listan</button>`;
    if (k === 'names') html = `<div class="st-names">${v.names.map(x => `<div class="card st-name" style="margin:0"><div class="nm">${esc(x.name)}</div><div class="sl">”${esc(x.slogan)}”</div><p class="small muted">${esc(x.why)}</p><code>${esc(x.domain)}</code></div>`).join('')}</div>`;
    box.innerHTML = vtabs + toolbar(p, k) + html;
    box.dataset.v = pick;
    bindToolbar(box, p, k);
    $$('.vtabs button', box).forEach(b => b.addEventListener('click', () => { box.dataset.v = b.dataset.v; drawSection(p, k); }));
    $$('[data-copy]', box).forEach(b => b.addEventListener('click', async () => App.toast(await Platform.copy(b.dataset.copy) ? 'Kopierat 📋' : 'Markera och kopiera')));
    if (k === 'plan') $('#say', box).addEventListener('click', () => Platform.speak(v.summary));
    if (k === 'code') {
      let fi = 0;
      const show = () => { $('#code-view', box).textContent = v.files[fi].content; $$('.ftabs button', box).forEach((x, i) => x.classList.toggle('on', i === fi)); };
      show();
      $$('.ftabs button', box).forEach(b => b.addEventListener('click', () => { fi = +b.dataset.f; show(); }));
      $('#cp-file', box).addEventListener('click', async () => App.toast(await Platform.copy(v.files[fi].content) ? 'Kopierat 📋' : 'Markera och kopiera'));
      $('#dl-var', box).addEventListener('click', async () => App.toast(await Platform.saveFile(slug(v.name) + '.zip', Docs.zip(v.files.map(f => ({ name: slug(v.name) + '/' + f.path.replace(/^\/+|\.\.\//g, ''), data: f.content }))))));
      const rw = $('#run-web', box);
      if (rw) rw.addEventListener('click', async () => { $('#web-out', box).innerHTML = '<iframe class="st-run-frame" sandbox="allow-scripts allow-forms allow-modals" title="Förhandsvisning"></iframe>'; $('#web-out iframe', box).srcdoc = await withImages(p, inlineWeb(v.files)); });
    }
    if (k === 'design') {
      $$('iframe', box).forEach(async f => { f.srcdoc = await withImages(p, s.variants[+f.dataset.i].html); });
      $$('[data-big]', box).forEach(b => b.addEventListener('click', async () => { const d = s.variants[+b.dataset.big]; const sh = App.sheet(`<h2>${esc(d.name)}</h2><iframe class="st-big" sandbox="allow-scripts" title="${esc(d.name)}"></iframe>`); $('iframe', sh.el).srcdoc = await withImages(p, d.html); sh.el.style.maxWidth = '980px'; }));
      $$('[data-dl]', box).forEach(b => b.addEventListener('click', async () => { const d = s.variants[+b.dataset.dl]; App.toast(await Platform.saveFile(slug(d.name) + '.html', new Blob([await withImages(p, d.html)], { type: 'text/html' }))); }));
      $$('[data-png]', box).forEach(b => b.addEventListener('click', async () => App.toast(await Platform.copy(s.variants[+b.dataset.png].html) ? 'HTML-koden kopierad 📋' : 'Kunde inte kopiera')));
    }
    if (k === 'tutorial') {
      $$('[data-done]', box).forEach(c => c.addEventListener('change', () => { p.done[v.name + c.dataset.done] = c.checked; Store.save(); drawSection(p, k); }));
      $$('[data-say]', box).forEach(b => b.addEventListener('click', () => { const c = v.chapters[+b.dataset.say]; Platform.speak(c.title + '. ' + c.text); }));
      $('#tut-md', box).addEventListener('click', async () => App.toast(await Platform.saveFile(slug(v.name) + '.md', new Blob([tutMd(v)], { type: 'text/markdown' }))));
      $('#tut-pdf', box).addEventListener('click', async () => {
        const blocks = [{ h1: v.name }, { small: `${p.title} · ${v.level} · Motey Studio` }];
        v.chapters.forEach(c => { blocks.push({ h2: c.title }, { p: c.text }); if (c.code) blocks.push({ p: c.code }); if (c.check) blocks.push({ li: 'Klart när: ' + c.check }); });
        App.toast(await Platform.saveFile(slug(v.name) + '.pdf', Docs.pdf(blocks)));
      });
    }
    if (k === 'buy') $('#buy-copy', box).addEventListener('click', async () => App.toast(await Platform.copy(buyMd(v)) ? 'Listan kopierad 📋' : 'Kunde inte kopiera'));
  }

  function drawMore(p, box) {
    const s = p.sections.more || { variants: [] };
    box.innerHTML = `<div class="card"><h3>✨ Vad mer ska Motey göra?</h3><div class="row">${MORE.map(t => `<button class="chip" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <div class="row" style="margin-top:10px"><input type="text" id="mo-own" placeholder="…eller något eget: ”kalkyl för mjukvarulicenser”" style="flex:1"><button class="btn sm" id="mo-go">Skapa</button></div></div>
      ${s.variants.map((v, i) => `<div class="card st-md"><div class="row between"><h3 style="margin:0">${esc(v.name)}</h3><div class="row"><button class="btn sm ghost" data-again="${esc(v.topic || v.name)}">🔁</button><button class="btn sm ghost" data-mdl="${i}">⬇</button></div></div>${md(v.markdown)}</div>`).join('') ||
        '<p class="muted">Välj ett ämne ovan – tidsplan, roller, risker, pitch och mycket mer.</p>'}`;
    $$('[data-t]', box).forEach(b => b.addEventListener('click', () => run(p, 'more', { topic: b.dataset.t })));
    $('#mo-go', box).addEventListener('click', () => { const t = $('#mo-own', box).value.trim(); if (t) run(p, 'more', { topic: t }); });
    $$('[data-again]', box).forEach(b => b.addEventListener('click', () => run(p, 'more', { topic: b.dataset.again })));
    $$('[data-mdl]', box).forEach(b => b.addEventListener('click', async () => { const v = s.variants[+b.dataset.mdl]; App.toast(await Platform.saveFile(slug(v.name) + '.md', new Blob([v.markdown], { type: 'text/markdown' }))); }));
  }

  async function share(p) {
    const rooms = Store.settings.demo ? [] : MoteyNet.rooms();
    if (!rooms.length) {
      App.toast(Store.settings.demo ? 'I demon laddas projektet ner i stället' : 'Skapa en chatt med teamet först – laddar ner projektet');
      return App.toast(await Platform.saveFile(slug(p.title) + '.zip', await exportZip(p)));
    }
    const sh = App.sheet(`<h2>📤 Dela med teamet</h2><p class="small muted">Hela projektet (plan, kod, design, tutorials, listor) skickas som en zip-fil till chatten.</p>
      ${rooms.map(r => `<button class="quiz-opt" data-r="${r.id}">${r.kind === 'meeting' ? '📅' : '💬'} ${esc(r.name)}</button>`).join('')}`);
    $$('[data-r]', sh.el).forEach(b => b.addEventListener('click', async () => {
      sh.close();
      const zip = await exportZip(p);
      try {
        App.toast('Skickar projektet…');
        await MoteyNet.sendFile(b.dataset.r, zip, slug(p.title) + '.zip');
        await MoteyNet.sendText(b.dataset.r, `🛠️ ${p.title} från Motey Studio – öppna zip-filen för plan, kod, design och tutorials.`);
        App.toast('📤 Delat med teamet');
      } catch (e) { App.toast(e.message + ' – laddar ner i stället', 5000); App.toast(await Platform.saveFile(slug(p.title) + '.zip', zip)); }
    }));
  }

  window.StudioMode = { render(v, id, sec, ui) { return render(v, id, sec, ui); }, destroy() { current = null; }, md, Offline, generate, exportZip };
})();
