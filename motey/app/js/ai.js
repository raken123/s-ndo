/* Motey – the AI engine.
 * Every function works offline with a built-in Swedish engine. When the user
 * adds a Claude API key in Inställningar, the same functions call Claude
 * (Messages API) instead and fall back to the offline engine on any error. */
(function () {
  'use strict';

  const STOP = new Set(('och i att det som en på är av för med till den har de inte om ett han men vi så kan man ' +
    'från ska sig eller nu var du jag ni hon dem det här där när vad alla bara också efter mot vill hur blir ' +
    'innan sen sedan då mer mycket under alltså får måste ha här kommer vara varit ut upp in över nästa ' +
    'samma tar idag hittills ungefär helst runt gå går vår våra vårt deras min mitt mina din ditt dina sina ' +
    'sitt egna egen alla allihop tack bra toppen okej ja nej först också annars åt dra inom senast vid ' +
    'möte mötet godmorgon välkomna inför helt ligger kort igenom först annars procent kvartal dag vecka veckan tid gång heller ingen inga något några alltid aldrig blev blir bli ser gör göra gjort').split(' '));

  /* ---------- glossary used by the game and TikTok images ---------- */
  const GLOSSARY = {
    'f-skatt': {
      term: 'F-skatt', icon: '🧾', wiki: 'F-skatt',
      explain: 'F-skatt är ett godkännande från Skatteverket som visar att du driver företag. Den som har F-skatt betalar själv sin preliminärskatt och sina egenavgifter, så kunden som köper tjänsten behöver inte dra skatt eller betala arbetsgivaravgifter.',
      howTo: 'Kolla att leverantören har F-skatt innan ni betalar fakturan – det går att kontrollera hos Skatteverket. Har du eget företag ansöker du om F-skatt via verksamt.se.',
      q: 'Ni köper en tjänst av en konsult som har F-skatt. Vem betalar konsultens skatt?',
      opts: ['Ni drar skatten från fakturan', 'Konsulten betalar själv sin skatt och sina egenavgifter', 'Ingen behöver betala skatt'], a: 1
    },
    'moms': {
      term: 'Moms', icon: '💶', wiki: 'Mervärdesskatt',
      explain: 'Moms (mervärdesskatt) är en skatt på försäljning. I Sverige är normalskattesatsen 25 %, och vissa varor och tjänster har lägre moms. Företaget lägger på moms när det säljer och får dra av momsen på sina egna inköp.',
      howTo: 'Lägg på rätt moms på fakturan, spara kvittona för inköpen och lämna momsdeklarationen i tid.',
      q: 'Vad är normalskattesatsen för moms i Sverige?',
      opts: ['12 %', '25 %', '6 %'], a: 1
    },
    'ingående moms': {
      term: 'Ingående moms', icon: '🛒', wiki: 'Mervärdesskatt',
      explain: 'Ingående moms är momsen du betalar när företaget köper något till verksamheten. Den får dras av mot den utgående momsen du tar ut av kunderna.',
      howTo: 'Spara kvittot, bokför inköpet och dra av momsen i momsdeklarationen.',
      q: 'Vad gör företaget med ingående moms på inköp till verksamheten?',
      opts: ['Drar av den i momsdeklarationen', 'Betalar den två gånger', 'Skickar den till kunden'], a: 0
    },
    'arbetsgivaravgift': {
      term: 'Arbetsgivaravgifter', icon: '👷', wiki: 'Arbetsgivaravgift',
      explain: 'Arbetsgivaravgifter är en avgift som arbetsgivaren betalar ovanpå lönen – för de flesta anställda omkring 31 % av bruttolönen. De finansierar bland annat pension och sjukförsäkring.',
      howTo: 'Räkna alltid med lön + arbetsgivaravgifter när ni budgeterar för en ny anställd.',
      q: 'En lön är 40 000 kr. Ungefär vad kostar den för företaget med arbetsgivaravgifter?',
      opts: ['40 000 kr', 'Cirka 52 600 kr', 'Cirka 80 000 kr'], a: 1
    },
    'budget': {
      term: 'Budget', icon: '📊', wiki: 'Budget',
      explain: 'En budget är en plan för hur mycket pengar som ska komma in och gå ut under en period. Den hjälper företaget att prioritera och att inte spendera mer än det har råd med.',
      howTo: 'Följ upp utfallet mot budgeten varje månad och säg till i tid om något drar iväg.',
      q: 'Vad är en budget?',
      opts: ['En plan för intäkter och kostnader under en period', 'Ett kvitto från Skatteverket', 'En typ av lån'], a: 0
    },
    'likviditet': {
      term: 'Likviditet', icon: '💧', wiki: 'Likviditet',
      explain: 'Likviditet betyder hur lätt företaget kan betala sina räkningar när de ska betalas – alltså hur mycket pengar som finns tillgängligt just nu.',
      howTo: 'Fakturera snabbt, ha koll på förfallodagar och spara en buffert.',
      q: 'Vad betyder god likviditet?',
      opts: ['Att företaget kan betala sina räkningar i tid', 'Att företaget har många anställda', 'Att momsen är låg'], a: 0
    },
    'kassaflöde': {
      term: 'Kassaflöde', icon: '🌊', wiki: 'Kassaflöde',
      explain: 'Kassaflöde är pengarna som faktiskt flyter in och ut ur företaget under en period. Ett företag kan gå med vinst men ändå få slut på pengar om kunderna betalar sent.',
      howTo: 'Skicka fakturor direkt efter leverans och följ upp sena betalningar.',
      q: 'Hur förbättrar man kassaflödet enligt mötet?',
      opts: ['Skicka fakturor inom 5 dagar efter leverans', 'Vänta med att fakturera till bokslutet', 'Höja momsen'], a: 0
    },
    'faktura': {
      term: 'Faktura', icon: '📨', wiki: 'Faktura',
      explain: 'En faktura är en betalningsbegäran till kunden. Den ska bland annat innehålla datum, fakturanummer, vad som sålts, belopp, moms och företagets momsregistreringsnummer.',
      howTo: 'Fyll i alla obligatoriska uppgifter, skicka den i tid och följ upp förfallodagen.',
      q: 'Vad måste finnas med på en faktura?',
      opts: ['Bara kundens namn', 'Bland annat belopp, moms och fakturanummer', 'Ett foto på varan'], a: 1
    },
    'bokslut': {
      term: 'Bokslut', icon: '📚', wiki: 'Bokslut',
      explain: 'Bokslut är när räkenskapsåret avslutas och företaget sammanställer resultat och ställning. Alla verifikationer och kvitton behöver vara bokförda.',
      howTo: 'Lämna in alla kvitton i tid och stäm av konton innan bokslutet.',
      q: 'Vad behöver vara inne inför bokslutet?',
      opts: ['Alla kvitton och verifikationer', 'Bara julklapparna', 'Ingenting'], a: 0
    },
    'momsdeklaration': {
      term: 'Momsdeklaration', icon: '🗓️', wiki: 'Mervärdesskatt',
      explain: 'I momsdeklarationen redovisar företaget utgående och ingående moms till Skatteverket. Den lämnas månads-, kvartals- eller årsvis beroende på omsättning.',
      howTo: 'Sätt en påminnelse före deadline och stäm av momskontona först.',
      q: 'När ska momsdeklarationen in enligt mötet?',
      opts: ['Den 12:e varje månad', 'En gång vart tionde år', 'När chefen ber om det'], a: 0
    },
    'preliminärskatt': {
      term: 'Preliminärskatt', icon: '⏳', wiki: 'Preliminärskatt',
      explain: 'Preliminärskatt är skatt som betalas in löpande under året. Den slutliga skatten räknas ut efter deklarationen.',
      howTo: 'Gör en realistisk prognos av vinsten så att du inte får restskatt.',
      q: 'När räknas den slutliga skatten ut?',
      opts: ['Efter deklarationen', 'Innan året börjar', 'Aldrig'], a: 0
    },
    'vinst': {
      term: 'Vinst', icon: '🏆', wiki: 'Vinst',
      explain: 'Vinst är det som blir kvar när kostnaderna har dragits från intäkterna.',
      howTo: 'Öka intäkterna eller minska kostnaderna – helst både och.',
      q: 'Hur räknar man ut vinst?',
      opts: ['Intäkter minus kostnader', 'Kostnader plus moms', 'Antal anställda gånger två'], a: 0
    }
  };
  const ALIASES = {
    'f-skatt': ['f-skatt', 'fskatt', 'f skatt'], 'moms': ['moms', 'mervärdesskatt'], 'ingående moms': ['ingående moms', 'dra av momsen'],
    'arbetsgivaravgift': ['arbetsgivaravgift'], 'budget': ['budget'], 'likviditet': ['likviditet'], 'kassaflöde': ['kassaflöde'],
    'faktura': ['faktura', 'fakturor'], 'bokslut': ['bokslut'], 'momsdeklaration': ['momsdeklaration'], 'preliminärskatt': ['preliminärskatt'],
    'vinst': ['vinst']
  };

  /* ---------- helpers ---------- */
  const words = t => (t.toLowerCase().match(/[a-zåäöé0-9-]{3,}/g) || []).filter(w => !STOP.has(w) && !/^\d+$/.test(w));
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const firstName = s => String(s || '').split(/[ (]/)[0];
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function keywords(meeting, n) {
    const f = {};
    const people = new Set((meeting.attendees || []).concat((meeting.transcript || []).map(l => l.who)).map(p => firstName(p).toLowerCase()));
    for (const l of meeting.transcript || []) for (const w of words(l.text)) if (!people.has(w)) f[w] = (f[w] || 0) + 1;
    const out = [];
    for (const [w] of Object.entries(f).sort((a, b) => b[1] - a[1])) {
      if (out.some(o => w.startsWith(o.slice(0, 4)) && o.length > 4)) continue; // moms/momsen, budget/budgeten
      out.push(w);
      if (out.length >= (n || 8)) break;
    }
    return out;
  }
  function concepts(meeting) {
    const all = (meeting.transcript || []).map(l => l.text.toLowerCase()).join(' \n ');
    const found = [];
    for (const [k, al] of Object.entries(ALIASES)) {
      const idx = Math.min(...al.map(a => { const i = all.indexOf(a); return i < 0 ? Infinity : i; }));
      if (idx < Infinity) found.push({ k, idx });
    }
    return found.sort((a, b) => a.idx - b.idx).map(f => f.k);
  }
  const FILE_RX = /[\wåäöÅÄÖ.-]+\.(pdf|xlsx?|docx?|pptx?|csv|txt|key|numbers|zip)\b/gi;

  /* ---------- offline engine ---------- */
  function localSummary(meeting) {
    const t = meeting.transcript || [];
    if (!t.length) return { summary: 'Det finns inget transkript för det här mötet ännu.', points: [], decisions: [], actions: [], files: [], keywords: [] };
    const kw = keywords(meeting, 12);
    const weight = {}; kw.forEach((w, i) => { weight[w] = 12 - i; });
    const cue = /(beslut|bestämde|godkänd|viktigt|flyttas|ska|måste|ansvarar|senast|budget|deadline|nästa möte)/i;
    const scored = t.map((l, i) => ({ l, i, s: words(l.text).reduce((s, w) => s + (weight[w] || 0), 0) / Math.sqrt(words(l.text).length + 1) + (cue.test(l.text) ? 4 : 0) - (/^(godmorgon|välkomna|tack|hej|toppen)/i.test(l.text) ? 50 : 0) }));
    const points = scored.slice().sort((a, b) => b.s - a.s).slice(0, Math.min(5, t.length)).sort((a, b) => a.i - b.i)
      .map(x => clean(x.l));
    const decisions = t.filter(l => /(beslut|bestämde|bestämt|godkänd|vi kör på|flyttas)/i.test(l.text)).map(clean);
    const actions = [];
    const people = [...new Set((meeting.attendees || []).concat(t.map(l => l.who)).map(firstName).filter(Boolean))];
    for (const l of t) {
      const tx = l.text;
      let who = people.find(p => new RegExp('\\b' + p + '\\b,?\\s+(du\\s+)?(ska|ansvarar|tar|fixar|behöver)\\b', 'i').test(tx));
      if (!who && /^jag (ska|tar|fixar|kollar|skickar|ordnar)\b/i.test(tx)) who = firstName(l.who);
      if (!who && /\balla (ska|måste|behöver)\b/i.test(tx)) who = 'Alla';
      if (!who) continue;
      actions.push({ who, from: firstName(l.who), what: tx.replace(/^(Viktigt|Beslut):\s*/i, '') });
    }
    const files = [];
    for (const l of t) { const m = l.text.match(FILE_RX); if (m) m.forEach(f => files.includes(f) || files.push(f)); }
    (meeting.files || []).forEach(f => files.includes(f.name) || files.push(f.name));
    const speakers = [...new Set(t.map(l => firstName(l.who)))];
    const topics = kw.slice(0, 4).join(', ');
    const summary = `${speakers.join(', ')} pratade om ${topics || 'flera saker'}. ` +
      (decisions.length ? `Det togs ${decisions.length === 1 ? 'ett beslut' : decisions.length + ' beslut'}` : 'Inga tydliga beslut togs') +
      (actions.length ? ` och ${actions.length === 1 ? 'en sak' : actions.length + ' saker'} ska göras till nästa gång.` : '.');
    return { summary, points, decisions, actions, files, keywords: kw.slice(0, 8) };
  }
  function clean(l) { return `${firstName(l.who)}: ${l.text}`.replace(/\s+/g, ' '); }

  /* Same sentence, different style. Step 1 softens harsh phrasing, step 2 dresses it up. */
  const SOFTEN = [
    [/det här är helt oacceptabelt/gi, 'det här är inte riktigt där vi vill vara än'],
    [/helt oacceptabelt/gi, 'inte riktigt bra nog än'], [/oacceptabelt/gi, 'inte okej än'],
    [/inga ursäkter/gi, 'jag vet att ni fixar det'], [/skärpning( nu)?/gi, 'nu växlar vi upp lite'],
    [/det är inte mitt problem/gi, 'jag förstår att det är svårt'],
    [/ni måste lösa det själva/gi, 'jag litar på att ni hittar en lösning'],
    [/(ni|du) måste/gi, (m, p) => `det vore jättebra om ${p.toLowerCase()} kunde`],
    [/omedelbart|genast|direkt nu/gi, 'så snart det går'],
    [/varför har ingen/gi, 'kan någon hjälpa mig förstå varför ingen har'],
    [/jag vill ha/gi, 'jag skulle gärna vilja ha'], [/jag kräver/gi, 'jag skulle uppskatta'],
    [/blir det en allvarlig diskussion/gi, 'tar vi ett lugnt snack om hur vi går vidare'],
    [/mötet är slut/gi, 'tack för idag'], [/katastrof(alt)?/gi, 'en utmaning'], [/värdelös\w*/gi, 'inte klar än'],
    [/dåligt/gi, 'inte riktigt bra än'], [/\bidiot\w*/gi, 'kollega'], [/\bslarv\w*/gi, 'lite stressigt'],
    [/!+/g, '.']
  ];
  const STYLES = {
    snall: { name: 'Snäll & peppig', icon: '🥰', pre: ['Hej allihop! ', 'Tack för att ni är här! ', 'Fint jobbat hittills! '], post: [' Ni är grymma! 😊', ' Jag tror på er! 💜', ' 😊'] },
    coach: { name: 'Lugn coach', icon: '🧘', pre: ['Okej team, andas in. ', 'Ingen stress. ', 'Vi tar det steg för steg. '], post: [' Vi fixar det här tillsammans. 💪', ' Ett steg i taget. 🌿'] },
    pirat: { name: 'Pirat', icon: '🏴‍☠️', pre: ['Ahoj, besättning! ', 'Hör upp, landkrabbor! '], post: [' Arrr! 🏴‍☠️', ' Hissa seglen! ⚓'],
      swap: [[/\brapporten\b/gi, 'skattkartan'], [/\bbudgeten\b/gi, 'skattkistan'], [/\bkr\b|kronor/gi, 'dubloner'], [/\bmötet\b/gi, 'rådslaget på däck'], [/\bkontoret\b/gi, 'skeppet'], [/\bmejl\b/gi, 'flaskpost']] },
    saga: { name: 'Godnattsaga', icon: '🧚', wrap: t => `Det var en gång ett team. Och chefen sa vänligt: ”${t}” Och så levde de produktivt i alla sina dagar. ✨` },
    sport: { name: 'Sportkommentator', icon: '⚽', wrap: t => `OCH HÄR KOMMER DET! Chefen tar bollen: ${t} VILKET DRAG, mina damer och herrar! ⚽🔥` },
    poet: { name: 'Poet', icon: '🌹', wrap: t => `Hör mig, kära kollegor, i kvartalets ljus: ${t} Så viskar vinden genom kontorets hus. 🌹` },
    robot: { name: 'Robot', icon: '🤖', wrap: t => `BIP BOP. MEDDELANDE MOTTAGET. ${t.toUpperCase()} SLUT PÅ ÖVERFÖRING. 🤖` },
    genz: { name: 'Gen Z', icon: '💅', lower: true, pre: ['okej så ', 'lowkey ', 'no cap, '], post: [' fr fr 💅', ' slay 💯', ' periodt ✨'], swap: [[/\bbra\b/gi, 'helt goated'], [/\bviktigt\b/gi, 'main character-viktigt']] }
  };
  function localRestyle(text, style) {
    let t = String(text);
    for (const [rx, rep] of SOFTEN) t = t.replace(rx, rep);
    t = t.replace(/\b([A-ZÅÄÖ]{4,})\b/g, w => w.toLowerCase());
    t = t.replace(/\.\s*\./g, '.').trim();
    const st = STYLES[style] || STYLES.snall;
    (st.swap || []).forEach(([rx, rep]) => { t = t.replace(rx, rep); });
    if (st.lower) t = t.toLowerCase().replace(/\.$/, '');
    const sentences = x => x.replace(/([.!?]\s+)([a-zåäö])/g, (m, a, b) => a + b.toUpperCase());
    if (st.wrap) return st.wrap(sentences(cap(t)));
    if (st.lower) return pick(st.pre) + t + pick(st.post);
    return sentences(cap(pick(st.pre || ['']) + cap(t) + pick(st.post || [''])));
  }

  function localVideoScript(meeting, sum) {
    const scenes = [];
    const cs = concepts(meeting);
    const kws = sum.keywords || [];
    scenes.push({ caption: `POV: du missade "${meeting.title}" 😅 Här är allt på 30 sekunder`, narration: `Du missade ${meeting.title}? Ingen fara, här är allt på trettio sekunder!`, query: cs[0] ? GLOSSARY[cs[0]].wiki : kws[0], emoji: '⏱️' });
    const pts = sum.points.slice(0, 4);
    pts.forEach((p, i) => {
      const txt = p.replace(/^[^:]+:\s*/, '');
      const c = cs.find(k => ALIASES[k].some(a => txt.toLowerCase().includes(a)));
      const kw = c ? GLOSSARY[c].wiki : (words(txt).find(w => kws.includes(w)) || kws[i] || 'kontor');
      scenes.push({ caption: shorten(txt, 90), narration: txt, query: kw, emoji: c ? GLOSSARY[c].icon : ['💡', '📌', '🚀', '🎯'][i % 4] });
    });
    if (sum.actions.length) {
      const a = sum.actions.slice(0, 2).map(x => `${x.who}: ${shorten(x.what, 50)}`).join(' · ');
      scenes.push({ caption: 'Att göra ✅ ' + a, narration: 'Att göra: ' + sum.actions.slice(0, 2).map(x => x.who + ' ' + x.what).join('. '), query: 'Checklista', emoji: '✅' });
    }
    scenes.push({ caption: 'Följ för fler möten du slipper sitta i 😎', narration: 'Följ Motey för fler möten du slipper sitta i!', query: null, emoji: '💜' });
    return scenes;
  }
  const shorten = (s, n) => s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s;

  function localLevel(meeting) {
    let cs = concepts(meeting).map(k => Object.assign({ key: k }, GLOSSARY[k]));
    const t = meeting.transcript || [];
    // Meetings without finance words: build walls from the meeting's own keywords.
    if (cs.length < 3) {
      const kws = keywords(meeting, 10).filter(w => w.length > 4);
      for (const w of kws) {
        if (cs.length >= 4) break;
        const line = t.find(l => l.text.toLowerCase().includes(w));
        if (!line) continue;
        const others = t.filter(l => l !== line && l.text.length > 20).map(l => shorten(l.text, 80));
        const right = shorten(line.text, 80);
        const opts = [right, pick(others) || 'Det pratade ingen om', 'Att mötet skulle ställas in'].filter((v, i, a) => a.indexOf(v) === i);
        while (opts.length < 3) opts.push('Ingenting alls');
        const order = opts.map((o, i) => ({ o, r: Math.random() + (i === 0 ? 0 : 0) })).sort((a, b) => a.r - b.r).map(x => x.o);
        cs.push({ key: w, term: cap(w), icon: '🧱', wiki: w, explain: `På mötet sa ${firstName(line.who)}: ”${line.text}”`, howTo: 'Kom ihåg vad som sades – svara rätt så krossar du väggen!', q: `Vad sades om ”${w}” på mötet?`, opts: order, a: order.indexOf(right) });
      }
    }
    const facts = localSummary(meeting).points.slice(0, 6).map(p => p.replace(/^[^:]+:\s*/, ''));
    return { title: meeting.title, walls: cs.slice(0, 6), facts };
  }

  function localAnswer(question, meeting) {
    const q = question.toLowerCase();
    for (const [k, al] of Object.entries(ALIASES)) if (al.some(a => q.includes(a)) || q.includes(k)) {
      const g = GLOSSARY[k];
      return `${g.term}: ${g.explain} ${g.howTo}`;
    }
    const qs = words(q);
    let best = null, bs = 0;
    for (const l of meeting ? meeting.transcript || [] : []) {
      const s = words(l.text).filter(w => qs.includes(w)).length;
      if (s > bs) { bs = s; best = l; }
    }
    if (best) return `På mötet sa ${firstName(best.who)}: ”${best.text}”`;
    return 'Det vet jag inte riktigt än! Lägg till en Claude-nyckel i Inställningar så kan jag svara på allt. 😊';
  }

  /* ---------- Claude (Messages API, raw fetch from the webview) ---------- */
  const hasKey = () => !!(window.Store && Store.settings.apiKey);
  async function claude({ system, prompt, schema, effort, maxTokens }) {
    const s = Store.settings;
    const body = {
      model: s.model || 'claude-opus-5-5',
      max_tokens: maxTokens || 16000,
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort: effort || 'low' },
      // On a safety-classifier decline, let the API retry on its recommended fallback model.
      fallbacks: 'default'
    };
    if (schema) body.output_config.format = { type: 'json_schema', schema };
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': s.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + res.status));
    if (data.stop_reason === 'refusal') throw new Error('refusal');
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    if (!text) throw new Error('empty');
    return schema ? JSON.parse(text) : text.trim();
  }
  const SYS = 'Du är Motey, en glad AI-mötesassistent formad som en pratbubbla. Du svarar alltid på svenska, kort och tydligt.';
  const transcriptText = m => (m.transcript || []).map(l => `${l.who}: ${l.text}`).join('\n');
  const obj = (props, req) => ({ type: 'object', properties: props, required: req || Object.keys(props), additionalProperties: false });
  const str = { type: 'string' };
  const arr = items => ({ type: 'array', items });

  async function withFallback(fnClaude, fnLocal) {
    if (!hasKey()) return { source: 'local', value: fnLocal() };
    try { return { source: 'claude', value: await fnClaude() }; }
    catch (e) { console.warn('Claude misslyckades, använder offline-motorn:', e.message); return { source: 'local', value: fnLocal(), error: e.message }; }
  }

  /* ---------- public API ---------- */
  const cache = {};
  async function summarize(meeting) {
    const key = meeting.id + ':' + (meeting.transcript || []).length + ':' + hasKey();
    if (cache[key]) return cache[key];
    const r = await withFallback(async () => {
      const v = await claude({
        system: SYS, effort: 'medium',
        prompt: `Sammanfatta mötet "${meeting.title}". Ge en kort sammanfattning (2–3 meningar), de viktigaste punkterna, beslut, att göra-punkter med ansvarig person, alla filer/dokument som nämns och 6–8 nyckelord.\n\nTranskript:\n${transcriptText(meeting)}`,
        schema: obj({ summary: str, points: arr(str), decisions: arr(str), actions: arr(obj({ who: str, what: str })), files: arr(str), keywords: arr(str) })
      });
      (meeting.files || []).forEach(f => v.files.includes(f.name) || v.files.push(f.name));
      return v;
    }, () => localSummary(meeting));
    if (!(meeting.transcript || []).length) r.value = localSummary(meeting);
    cache[key] = r;
    return r;
  }

  async function catchUp(prev, user) {
    const sum = (await summarize(prev)).value;
    const day = new Date(prev.start).toLocaleDateString('sv-SE', { weekday: 'long' }) + 's';
    const mine = sum.actions.filter(a => firstName(a.who).toLowerCase() === firstName(user).toLowerCase() || a.who === 'Alla');
    const r = await withFallback(
      () => claude({
        system: SYS, effort: 'low',
        prompt: `${user} missade mötet "${prev.title}" i ${day}. Skriv en kort, varm och lite rolig uppdatering (max 70 ord) direkt till ${user}: vad som hände, vilka beslut som togs och vad ${user} själv ska göra. Ingen rubrik.\n\nTranskript:\n${transcriptText(prev)}`
      }),
      () => `Hej ${user}! Du missade "${prev.title}" i ${day}. ${sum.summary}` +
        (sum.decisions.length ? ` Det viktigaste beslutet: ${sum.decisions[0].replace(/^[^:]+:\s*/, '').replace(/^((bra|toppen|okej|tack|beslut)[.!:,]?\s*)+/i, '')}` : '') +
        (mine.length ? ` Och du ska: ${mine.map(a => a.what.replace(new RegExp('^' + firstName(user) + ',?\\s+(du\\s+)?ska\\s+', 'i'), '').replace(/^alla ska\s+/i, 'precis som alla andra ').replace(/\bsina\b/g, 'dina').replace(/\bsitt\b/g, 'ditt').replace(/\bsin\b/g, 'din').replace(/\btill mig\b/i, 'till ' + (a.from || 'chefen')).replace(/\.$/, '')).join(', och ')}.` : '')
    );
    return { text: r.value, source: r.source, sum, mine };
  }

  async function restyle(text, style) {
    const st = STYLES[style] || STYLES.snall;
    return withFallback(
      () => claude({
        system: SYS + ' Du ersätter en talare i ett möte i realtid.',
        effort: 'low', maxTokens: 1024,
        prompt: `Skriv om repliken i stilen "${st.name}". Behåll exakt samma budskap, fakta, siffror, datum och uppgifter – bara tonen ändras, och den ska vara vänlig. Svara endast med den nya repliken.\n\nReplik: ${text}`
      }),
      () => localRestyle(text, style)
    );
  }

  async function videoScript(meeting) {
    const sum = (await summarize(meeting)).value;
    return withFallback(
      () => claude({
        system: SYS + ' Du gör korta, roliga vertikala videor (TikTok-stil) om möten.',
        effort: 'low',
        prompt: `Gör ett manus för en 30–40 sekunders TikTok-video om mötet "${meeting.title}". 5–7 scener. Varje scen: caption (max 90 tecken, gärna med emoji), narration (det som sägs, max 25 ord), query (ett sökord för en passande Wikipedia-bild, helst ett substantiv på svenska, eller tom sträng), emoji (en emoji). Första scenen är en hook, sista en uppmaning.\n\nTranskript:\n${transcriptText(meeting)}`,
        schema: obj({ scenes: arr(obj({ caption: str, narration: str, query: str, emoji: str })) })
      }).then(v => v.scenes),
      () => localVideoScript(meeting, sum)
    );
  }

  async function gameLevel(meeting) {
    return withFallback(
      () => claude({
        system: SYS + ' Du bygger banor i ett pedagogiskt spel där varje vägg är ett begrepp från mötet.',
        effort: 'medium',
        prompt: `Gör 3–6 väggar till en spelbana om mötet "${meeting.title}". Varje vägg är ett viktigt begrepp från mötet (t.ex. F-skatt, moms). För varje: term, icon (en emoji), explain (förklara begreppet enkelt och korrekt, 2–3 meningar), howTo (så "förstör" man väggen = vad man konkret gör i verkligheten, 1–2 meningar), q (en kontrollfråga), opts (exakt 3 svarsalternativ), a (index 0–2 för rätt svar). Lägg också till 3–6 korta facts från mötet.\n\nTranskript:\n${transcriptText(meeting)}`,
        schema: obj({ walls: arr(obj({ term: str, icon: str, explain: str, howTo: str, q: str, opts: arr(str), a: { type: 'integer' } })), facts: arr(str) })
      }).then(v => ({ title: meeting.title, walls: v.walls.filter(w => w.opts.length >= 2 && w.a >= 0 && w.a < w.opts.length).slice(0, 6), facts: v.facts })),
      () => localLevel(meeting)
    );
  }

  async function ask(question, meeting) {
    return withFallback(
      () => claude({
        system: SYS + ' Du är spelkompis i Motey-spelläget och förklarar saker enkelt.',
        effort: 'low', maxTokens: 1024,
        prompt: `Fråga: ${question}\n\nSvara kort (max 60 ord).` + (meeting ? `\n\nMötets transkript:\n${transcriptText(meeting)}` : '')
      }),
      () => localAnswer(question, meeting)
    );
  }

  async function testKey() {
    return claude({ system: SYS, prompt: 'Säg hej i max fem ord.', effort: 'low', maxTokens: 256 });
  }

  window.AI = { summarize, catchUp, restyle, videoScript, gameLevel, ask, testKey, hasKey, STYLES, GLOSSARY, keywords, concepts, localRestyle, localSummary, firstName };
})();
