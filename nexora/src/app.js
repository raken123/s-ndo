/* Nexora app: routing, plans and limits, Studio, tools, library, export. */
(function () {
  'use strict';
  const L = window.NexoraLocal, AI = window.NexoraAI, BUILD = window.NEXORA_BUILD || {};
  const VERSION = BUILD.version || '1.0.0';
  const REPO = 'https://github.com/raken123/s-ndo';

  // ---------------------------------------------------------------- plans
  const PLANS = [
    { id: 'free', emoji: '🆓', name: 'Free', price: 0, games: 10, storage: 10,
      features: ['10 spel/månad', '2D-spel', 'Grundläggande AI', 'Community-support'] },
    { id: 'creator', emoji: '🚀', name: 'Creator', price: 199, games: 100, storage: 100, hot: true,
      features: ['100 spel/månad', '2D & 3D-spel', 'AI-kodgenerator', 'AI-grafikgenerator', 'AI-storygenerator', 'AI-dialoggenerator', 'Export till PC & mobil', 'Egna assets'] },
    { id: 'pro', emoji: '💎', name: 'Pro', price: 499, games: Infinity, storage: Infinity,
      features: ['Obegränsade spel', 'Open-world-generator', 'AI-NPC-generator', 'AI-questgenerator', 'AI-musikgenerator', 'AI-ljudeffekter', 'AI-röstgenerator', 'Multiplayer', 'Steam-export', 'Buggfix-AI', 'Obegränsad lagring', 'Prioriterad support'] },
    { id: 'studio', emoji: '🏢', name: 'Studio', price: 999, games: Infinity, storage: Infinity,
      features: ['Allt i Pro', 'Teamarbete', 'Delade projekt', 'Versionshantering', 'Privat molnlagring', 'Dedicated servrar', 'API-åtkomst', 'Xbox-export', 'PlayStation-export', 'Nintendo-export', 'Prioriterad rendering', 'Tidig tillgång till nya funktioner'] },
    { id: 'enterprise', emoji: '👑', name: 'Enterprise', price: 2999, games: Infinity, storage: Infinity,
      features: ['Allt i Studio', 'Obegränsade teammedlemmar', 'White Label', 'Egen AI-modell', 'Företagssupport dygnet runt', 'Anpassade integrationer', 'Företagssäkerhet', 'Avancerad analys', 'Egen domän', 'Personlig account manager'] },
  ];
  const FEAT = {
    threeD: [1, '3D-spel'], code: [1, 'AI-kodgenerator'], gfx: [1, 'AI-grafikgenerator'], story: [1, 'AI-storygenerator'],
    dialog: [1, 'AI-dialoggenerator'], exportPc: [1, 'Export till PC'], exportMobile: [1, 'Export till mobil'], assets: [1, 'Egna assets'], mesh: [1, '3D-generator'],
    openworld: [2, 'Open-world-generator'], npc: [2, 'AI-NPC-generator'], quest: [2, 'AI-questgenerator'], music: [2, 'AI-musikgenerator'],
    sfx: [2, 'AI-ljudeffekter'], voice: [2, 'AI-röstgenerator'], multiplayer: [2, 'Multiplayer'], steam: [2, 'Steam-export'], bugfix: [2, 'Buggfix-AI'],
    team: [3, 'Teamarbete'], shared: [3, 'Delade projekt'], versions: [3, 'Versionshantering'], xbox: [3, 'Xbox-export'], ps: [3, 'PlayStation-export'], nintendo: [3, 'Nintendo-export'],
    whitelabel: [4, 'White Label'], customModel: [4, 'Egen AI-modell'],
  };
  const fmtKr = n => (n === 0 ? '0 kr' : n.toLocaleString('sv-SE') + ' kr');

  // ---------------------------------------------------------------- storage
  const store = {
    get(k, d) { try { const v = localStorage.getItem('nexora.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('nexora.' + k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
  };
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open('nexora', 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('games', { keyPath: 'id' }); d.createObjectStore('assets', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function idb(storeName, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(storeName, mode), s = tx.objectStore(storeName), out = fn(s);
      tx.oncomplete = () => res(out && 'result' in out ? out.result : undefined); tx.onerror = () => rej(tx.error);
    });
  }
  const games = {
    all: () => idb('games', 'readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => y.updated - x.updated)),
    put: g => idb('games', 'readwrite', s => s.put(g)),
    del: id => idb('games', 'readwrite', s => s.delete(id)),
    get: id => idb('games', 'readonly', s => s.get(id)),
  };
  const assets = {
    all: () => idb('assets', 'readonly', s => s.getAll()).then(a => a || []),
    put: a => idb('assets', 'readwrite', s => s.put(a)),
    del: id => idb('assets', 'readwrite', s => s.delete(id)),
  };

  const S = {
    plan: store.get('plan', 'free'),
    settings: Object.assign({}, AI.DEFAULT_SETTINGS, store.get('settings', {})),
    usage: store.get('usage', {}),
    team: store.get('team', []),
    studio: store.get('studio', { model: 'flash', dim: '2d', opts: { sfx: true } }),
  };
  S.settings.openaiModels = Object.assign({}, AI.DEFAULT_SETTINGS.openaiModels, S.settings.openaiModels || {});
  const tier = () => Math.max(0, PLANS.findIndex(p => p.id === S.plan));
  const plan = () => PLANS[tier()];
  const can = f => tier() >= FEAT[f][0];
  const month = () => new Date().toISOString().slice(0, 7);
  const used = () => S.usage[month()] || 0;
  // Local calendar date as YYYY-MM-DD; NEXORA_TODAY overrides it in tests.
  const today = () => window.NEXORA_TODAY || new Date().toLocaleDateString('sv-SE');
  const releaseDate = (k, t) => (AI.ROLLOUT[k] ? AI.ROLLOUT[k][t == null ? tier() : t] : null);
  const released = (k, t) => !AI.ROLLOUT[k] || today() >= releaseDate(k, t);
  const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });
  const ROLLOUT_GROUPS = [[[3, 4], 'Studio och Enterprise'], [[2], 'Pro'], [[0, 1], 'Creator och Free']];
  const rolloutRows = () => ROLLOUT_GROUPS.map(([ts, label]) => {
    const d = releaseDate('astryx', ts[0]), out = today() >= d;
    return { label, date: d, out, text: out ? 'Tillgänglig nu' : 'Från ' + fmtDate(d) };
  });

  // Credits: one-off packs that pay for games once the monthly quota is used up.
  const CREDIT_PACKS = [
    { id: 'c25', credits: 25, price: 49 },
    { id: 'c100', credits: 100, price: 149, hot: true },
    { id: 'c500', credits: 500, price: 499 },
  ];
  const COST = { game: 1, astryx: 3, hyper: 10 };
  S.credits = store.get('credits', 0);
  S.creditLog = store.get('creditLog', []);
  function addCredits(n, note) {
    S.credits += n;
    S.creditLog = [{ t: Date.now(), n, note }].concat(S.creditLog).slice(0, 50);
    store.set('credits', S.credits); store.set('creditLog', S.creditLog);
  }
  const RT = {
    core: [nxRng, nxNoise, nxShade, Nx3D, NexoraRuntime].map(f => f.toString()).join('\n\n'),
    templates: { gamePlatformer, gameShooter, gameSnake, gameBreakout, gameDodger, gameCollector, gameOpenWorld, gameRunner3D, gameArena3D },
  };

  // ---------------------------------------------------------------- dom helpers
  const $ = (s, el) => (el || document).querySelector(s);
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.style.cssText = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(x => add(el, x));
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  function toast(msg, ms) {
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.appendChild(t); setTimeout(() => t.remove(), ms || 2800);
  }
  function modal(content, wide) {
    const m = h('div', { class: 'modal', onclick: e => { if (e.target === m) close(); } }, h('div', { class: 'card' + (wide ? ' wide' : '') }, content));
    function close() { m.remove(); removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    addEventListener('keydown', esc);
    document.body.appendChild(m);
    return close;
  }
  function download(name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain' });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const slug = s => (s || 'spel').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'spel';
  const logoSvg = () => h('span', { html: '<svg viewBox="0 0 64 64"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#lg)"/><path d="M18 46V18h6l16 18V18h6v28h-6L24 28v18z" fill="#0b0b20"/></svg>' });

  // ---------------------------------------------------------------- upsell
  function lockLabel(f) { return '🔒 ' + PLANS[FEAT[f][0]].name; }
  function upsell(f, why, tierIdx) {
    const need = PLANS[Math.min(PLANS.length - 1, tierIdx != null ? tierIdx : FEAT[f] ? FEAT[f][0] : 1)];
    const close = modal([
      h('h2', null, need.emoji + ' Uppgradera till ', h('span', { class: 'grad' }, need.name)),
      h('p', null, why || ((FEAT[f] ? FEAT[f][1] : 'Den här funktionen') + ' ingår från ' + need.name + ' (' + fmtKr(need.price) + '/mån).')),
      h('ul', { class: 'small muted' }, need.features.slice(0, 6).map(x => h('li', null, x))),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { close(); checkout(need); } }, 'Välj ' + need.name), h('button', { class: 'btn ghost', onclick: () => close() }, 'Inte nu')),
    ]);
  }
  function need(f) { if (can(f)) return true; upsell(f); return false; }
  function checkout(p) {
    const close = modal([
      h('h2', null, p.emoji + ' Nexora ' + p.name),
      h('div', { class: 'price' }, fmtKr(p.price), h('small', null, ' /mån')),
      h('p', { class: 'note' }, 'Demoläge: ingen betalning dras. Betalningar (t.ex. Stripe eller Klarna) behöver en server och är inte inkopplade i den här versionen. Planen aktiveras direkt på den här enheten.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => { S.plan = p.id; store.set('plan', p.id); close(); toast(p.emoji + ' ' + p.name + ' är aktiverad'); render(); } }, p.price ? 'Aktivera (demo)' : 'Byt till Free'),
        h('button', { class: 'btn ghost', onclick: () => close() }, 'Avbryt')),
    ]);
  }

  // ---------------------------------------------------------------- layout
  const ROUTES = [
    ['hem', 'Hem'], ['studio', 'Studio'], ['astryx', '🤖 Astryx'], ['verktyg', 'Verktyg'], ['spel', 'Mina spel'], ['team', 'Team'],
    ['modeller', 'Modeller'], ['priser', 'Priser'], ['ladda-ner', 'Ladda ner'],
  ];
  const route = () => (location.hash.slice(1) || 'hem').split('/')[0];
  function topbar() {
    const p = plan(), lim = p.games === Infinity ? '∞' : p.games;
    return h('header', { class: 'top' }, h('div', { class: 'wrap' },
      h('div', { class: 'logo', onclick: () => { location.hash = 'hem'; } }, logoSvg(), 'Nexora'),
      h('nav', { class: 'tabs', 'aria-label': 'Huvudmeny' }, ROUTES.map(([id, label]) => h('a', { href: '#' + id, class: route() === id ? 'on' : '' }, label))),
      h('div', { class: 'who' },
        h('span', { class: 'pill usage', title: 'Spel skapade den här månaden' }, '🎮 ' + used() + '/' + lim),
        JOBS.some(j => j.status === 'running') ? h('a', { class: 'pill working', href: '#astryx', title: 'Astryx arbetar i bakgrunden' }, '🤖 Astryx arbetar') : null,
        h('span', { class: 'pill credits', title: 'Krediter – klicka för att köpa fler', onclick: () => creditsModal() }, '🪙 ' + S.credits),
        h('span', { class: 'pill plan', title: 'Din plan', onclick: () => { location.hash = 'priser'; } }, p.emoji + ' ' + p.name),
        h('button', { class: 'iconbtn', title: 'Inställningar', 'aria-label': 'Inställningar', onclick: settingsModal }, '⚙️'))));
  }
  function footer() {
    return h('footer', null, h('div', { class: 'wrap row', style: 'justify-content:space-between' },
      h('span', null, '© ' + new Date().getFullYear() + ' Nexora · version ' + VERSION),
      h('span', null, 'AI-leverantör: ', providerLabel(), ' · ', h('a', { href: '#modeller' }, 'Om modellerna'))));
  }
  function providerLabel() {
    return { local: 'Nexora Local (offline)', anthropic: 'Anthropic (Claude)', openai: 'Egen endpoint' }[S.settings.provider];
  }

  let mounted = null;
  function render() {
    if (mounted && mounted.unmount) mounted.unmount();
    const app = $('#app'); app.innerHTML = '';
    const r = route(), view = VIEWS[r] || VIEWS.hem;
    const main = h('main');
    app.append(topbar(), main, footer());
    mounted = view(main) || null;
    document.title = (r === 'hem' ? 'Nexora – skapa spel med AI' : (ROUTES.find(x => x[0] === r) || ['', 'Nexora'])[1] + ' · Nexora');
  }
  addEventListener('hashchange', () => { render(); scrollTo(0, 0); });

  // ---------------------------------------------------------------- views
  const VIEWS = {};

  VIEWS.hem = main => {
    main.append(
      h('section', { class: 'hero wrap' },
        h('a', { class: 'pill', href: '#modeller', style: 'margin-bottom:18px;text-decoration:none;color:inherit' }, '🤖 Nytt: Nexora Astryx 5 Pro – vår första AI-agent →'),
        h('h1', null, 'Beskriv ett spel.', h('br'), h('span', { class: 'grad' }, 'Spela det direkt.')),
        h('p', { class: 'lead' }, 'Nexora gör spelbara 2D- och 3D-spel av en mening – med grafik, ljud, story och export till webb, PC och mobil.'),
        h('div', { class: 'row', style: 'justify-content:center' },
          h('a', { class: 'btn primary big', href: '#studio' }, '🎮 Öppna Studio'),
          h('a', { class: 'btn big', href: '#ladda-ner' }, '⬇️ Ladda ner appen'))),
      h('section', { class: 'wrap' }, h('div', { class: 'grid g3' }, [
        ['⚡', 'Från idé till spel på sekunder', 'Skriv "ett rymdspel med lava-tema" och spela det i förhandsvisningen direkt.'],
        ['🧊', '2D och 3D', 'Plattformsspel, skjutare, open world, 3D-löpare och 3D-arenor.'],
        ['🎨', 'Grafik, 3D-modeller, musik', 'Sprites med Image 1, low-poly-modeller med 3D 1, musik och ljudeffekter.'],
        ['🧙', 'Story, NPC:er och uppdrag', 'Generera en värld med personer som ger dig uppdrag och pratar med dig.'],
        ['📦', 'Export överallt', 'HTML för webb och mobil, PC-projekt, Steam-paket och portningspaket för konsol.'],
        ['🔌', 'Fungerar offline', 'Nexora Local bygger spel utan internet. Koppla in Claude eller din egen modell för mer.'],
      ].map(([ic, t, d]) => h('div', { class: 'card feat' }, h('div', { class: 'ic' }, ic), h('h3', null, t), h('p', { class: 'muted' }, d))))),
      h('section', { class: 'wrap' }, astryxHero()),
      h('section', { class: 'wrap' }, h('h2', null, 'Sex modeller'), modelCards()),
      h('section', { class: 'wrap' }, h('h2', null, 'Priser'), planCards(), creditsSection()));
  };

  function astryxHero() {
    const steps = [['🧠', 'Planerar'], ['🐍', 'Skriver Godot-projektet med Python'], ['▶️', 'Testkör i Godot'], ['👀', 'Tittar på skärmbilder'], ['🔧', 'Rättar buggar'], ['📸', 'Hyperrealistiskt läge'], ['⏱', 'Upp till 2 timmar per spel']];
    return h('div', { class: 'card astryx col' },
      h('div', { class: 'pill', style: 'align-self:flex-start' }, '🤖 AI-agent'),
      h('h2', null, 'Nexora ', h('span', { class: 'grad' }, 'Astryx 5 Pro')),
      h('p', { class: 'lead', style: 'margin:0' }, AI.MODELS.astryx.desc),
      h('div', { class: 'row' }, steps.map(([i, t]) => h('span', { class: 'chip' }, i + ' ' + t))),
      rolloutList(),
      h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#studio', onclick: () => { if (released('astryx')) { S.studio.model = 'astryx'; store.set('studio', S.studio); } } }, released('astryx') ? '🤖 Prova Astryx 5 Pro' : '🎮 Öppna Studio'),
        !released('astryx') ? h('span', { class: 'small muted' }, 'Din plan (' + plan().name + ') får Astryx ' + fmtDate(releaseDate('astryx')) + '.') : null));
  }
  function rolloutList() {
    return h('div', { class: 'rollout' }, rolloutRows().map(r => h('div', { class: 'rstep' + (r.out ? ' out' : '') },
      h('b', null, r.label), h('span', null, r.out ? '✓ ' + r.text : '📅 ' + r.text))));
  }
  function astryxLocked() {
    const close = modal([
      h('h2', null, '🤖 Nexora ', h('span', { class: 'grad' }, 'Astryx 5 Pro')),
      h('p', null, AI.MODELS.astryx.desc),
      rolloutList(),
      h('p', { class: 'muted' }, 'Din plan (' + plan().name + ') får Astryx 5 Pro ' + fmtDate(releaseDate('astryx')) + '. Vill du ha den nu ingår den i Studio och Enterprise.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { close(); checkout(PLANS[3]); } }, 'Välj Studio – få Astryx nu'),
        h('button', { class: 'btn ghost', onclick: () => close() }, 'Jag väntar'))]);
  }

  function creditsSection() {
    return h('div', { class: 'col', style: 'margin-top:32px' },
      h('h2', null, '🪙 Krediter'),
      h('p', { class: 'muted', style: 'margin:0' }, 'Slut på månadens spel men vill inte betala mer varje månad? Köp krediter en gång – de går aldrig ut. 1 kredit = 1 spel, en körning med Astryx 5 Pro = 3 krediter, hyperrealistiskt läge = ' + COST.hyper + ' krediter.'),
      creditPacks(),
      h('p', { class: 'small muted' }, 'Krediter används när planens spel för månaden är slut – och alltid för hyperrealistiskt läge. De låser inte upp funktioner från dyrare planer. Ditt saldo: ', h('b', null, S.credits + ' krediter'), '.'));
  }
  function creditPacks(after) {
    return h('div', { class: 'grid g3' }, CREDIT_PACKS.map(k => h('div', { class: 'card col' + (k.hot ? ' hot' : ''), style: k.hot ? 'border-color:var(--a1)' : '' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', { style: 'margin:0' }, '🪙 ' + k.credits + ' krediter'), k.hot ? h('span', { class: 'pill' }, 'Bäst värde') : null),
      h('div', { class: 'price' }, fmtKr(k.price)),
      h('div', { class: 'small muted' }, (k.price / k.credits).toFixed(2).replace('.', ',') + ' kr per spel · engångsköp'),
      h('button', { class: 'btn' + (k.hot ? ' primary' : ''), onclick: () => buyCredits(k, after) }, 'Köp'))));
  }
  function buyCredits(k, after) {
    const close = modal([
      h('h2', null, '🪙 ' + k.credits + ' krediter'),
      h('div', { class: 'price' }, fmtKr(k.price), h('small', null, ' engångsköp')),
      h('p', { class: 'note' }, 'Demoläge: ingen betalning dras. Krediterna läggs till direkt på den här enheten.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => { addCredits(k.credits, 'Köpte ' + k.credits + ' krediter (' + fmtKr(k.price) + ')'); close(); toast('🪙 +' + k.credits + ' krediter – saldo ' + S.credits); render.topOnly(); if (after) after(); else render(); } }, 'Betala ' + fmtKr(k.price) + ' (demo)'),
        h('button', { class: 'btn ghost', onclick: () => close() }, 'Avbryt'))]);
  }
  function creditsModal(reason, after) {
    const close = modal([
      h('h2', null, '🪙 Krediter'),
      reason ? h('p', null, reason) : null,
      h('p', { class: 'muted' }, 'Saldo: ', h('b', null, S.credits + ' krediter'), ' · 1 kredit = 1 spel · Astryx 5 Pro = 3 krediter · 📸 hyperrealistiskt = ' + COST.hyper + ' krediter'),
      creditPacks(() => { close(); if (after) after(); }),
      S.creditLog.length ? h('details', null, h('summary', { class: 'small muted' }, 'Historik'),
        h('table', { class: 't' }, S.creditLog.slice(0, 12).map(x => h('tr', null, h('td', null, new Date(x.t).toLocaleString('sv-SE')), h('td', null, x.note), h('td', { style: 'text-align:right;color:' + (x.n > 0 ? 'var(--ok)' : 'var(--muted)') }, (x.n > 0 ? '+' : '') + x.n))))) : null,
      h('div', { class: 'row', style: 'margin-top:16px' },
        tier() < PLANS.length - 1 ? h('button', { class: 'btn', onclick: () => { close(); location.hash = 'priser'; } }, 'Jämför planer') : null,
        h('button', { class: 'btn ghost', onclick: () => close() }, 'Stäng'))], true);
  }

  function modelCards() {
    return h('div', { class: 'grid g5' }, Object.entries(AI.MODELS).map(([k, m]) => {
      const lock = m.agent ? (released(k) ? null : '🔒 ' + fmtDate(releaseDate(k))) : tier() < m.minTier ? '🔒 ' + PLANS[m.minTier].name : null;
      return h('div', { class: 'card' + (m.agent ? ' astryx' : '') },
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', null, m.name), lock ? h('span', { class: 'lock' }, lock) : m.agent ? h('span', { class: 'lock new' }, 'NY') : null),
        h('div', { class: 'pill', style: 'margin-bottom:8px' }, m.tag),
        h('p', { class: 'muted small' }, m.desc),
        m.agent ? h('div', { class: 'small' }, rolloutRows().map(r => h('div', null, (r.out ? '✓ ' : '📅 ') + r.label + ': ' + r.text.toLowerCase()))) : null);
    }));
  }

  function planCards() {
    return h('div', { class: 'plans' }, PLANS.map((p, i) => h('div', { class: 'card plancard' + (p.hot ? ' hot' : '') + (i === tier() ? ' cur' : '') },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', null, p.emoji + ' ' + p.name), p.hot ? h('span', { class: 'pill' }, 'Populärast') : null),
      h('div', { class: 'price' }, fmtKr(p.price), h('small', null, '/mån')),
      h('ul', null, p.features.map(f => h('li', null, f))),
      i === tier() ? h('button', { class: 'btn', disabled: true }, 'Din plan') : h('button', { class: 'btn ' + (p.hot ? 'primary' : ''), onclick: () => checkout(p) }, i < tier() ? 'Byt till ' + p.name : 'Välj ' + p.name))));
  }

  VIEWS.priser = main => {
    main.append(h('section', { class: 'wrap' },
      h('h1', null, 'Välj din ', h('span', { class: 'grad' }, 'plan')),
      h('p', { class: 'muted' }, 'Alla priser per månad inklusive moms. Byt eller avsluta när du vill.'),
      planCards(),
      creditsSection(),
      h('p', { class: 'note', style: 'margin-top:20px' }, 'Den här versionen körs i demoläge: planer och krediter aktiveras lokalt utan betalning. Funktioner som kräver en server (molnlagring, teamsynk, dedikerade servrar, API) visas i planerna men är inte driftsatta än.')));
  };

  VIEWS.modeller = main => {
    const rows = Object.entries(AI.MODELS).map(([k, m]) => h('tr', null,
      h('td', null, h('b', null, m.name), h('div', { class: 'small muted' }, m.tag)),
      h('td', null, k === 'image' ? 'Procedurella pixel-sprites' : k === 'd3' ? 'Procedurella low-poly-modeller' : k === 'astryx' ? 'Agentloop: bygger, testkör i dold webbläsare, gör om vid fel' : 'Mallbaserad spelgenerator (9 speltyper)'),
      h('td', null, h('code', null, AI.ANTHROPIC[k].model), AI.ANTHROPIC[k].thinking ? h('div', { class: 'small muted' }, 'adaptivt tänkande, synligt') : AI.ANTHROPIC[k].output_config ? h('div', { class: 'small muted' }, 'effort: ' + AI.ANTHROPIC[k].output_config.effort) : null,
        k === 'image' ? h('div', { class: 'small muted' }, 'ritar SVG') : k === 'd3' ? h('div', { class: 'small muted' }, 'skriver mesh-JSON') : k === 'astryx' ? h('div', { class: 'small muted' }, 'agent med verktygen write_game, edit_game, run_game (med skärmbild) och finish') : null),
      h('td', null, h('code', null, S.settings.openaiModels[k]), k === 'astryx' ? h('div', { class: 'small muted' }, 'skriv → testa → rätta, upp till 3 varv') : null)));
    main.append(h('section', { class: 'wrap' },
      h('h1', null, 'Nexora-', h('span', { class: 'grad' }, 'modellerna')),
      modelCards(),
      h('h2', { style: 'margin-top:40px' }, 'Lansering av Astryx 5 Pro'),
      rolloutList(),
      h('h2', { style: 'margin-top:40px' }, 'Vad körs under huven?'),
      h('p', { class: 'muted' }, 'Varje Nexora-modell är ett lager med egen prompt och egna inställningar ovanpå en basmodell. Du väljer leverantör under Inställningar. Nuvarande: ', h('b', null, providerLabel()), '.'),
      h('div', { class: 'card', style: 'overflow-x:auto' }, h('table', { class: 't' },
        h('tr', null, h('th', null, 'Modell'), h('th', null, 'Nexora Local (offline)'), h('th', null, 'Anthropic'), h('th', null, 'Egen endpoint')), rows)),
      h('h2', { style: 'margin-top:40px' }, 'Träna en egen modell i Google Colab'),
      h('div', { class: 'card col' },
        h('p', null, 'Anteckningsboken ', h('code', null, 'Nexora_Flash_1_Colab.ipynb'), ' finjusterar en öppen kodmodell (Qwen2.5-Coder) med LoRA på Nexoras spelexempel, provkör den och startar en OpenAI-kompatibel server. Peka sedan ', h('b', null, 'Egen endpoint'), ' i Inställningar mot den.'),
        h('p', { class: 'small muted' }, 'GPT-5 Fast, GPT-6 Astra, GPT Images 2.5 och Meshy 7 har inga öppna vikter och kan inte finjusteras i Colab. Har du API-åtkomst till dem kan du ändå använda dem via Egen endpoint genom att ange deras modell-ID.'),
        h('div', { class: 'row' },
          h('a', { class: 'btn primary', href: 'https://colab.research.google.com/github/raken123/s-ndo/blob/main/nexora/colab/Nexora_Flash_1_Colab.ipynb', target: '_blank', rel: 'noopener' }, 'Öppna i Colab'),
          h('a', { class: 'btn', href: REPO + '/blob/main/nexora/colab/Nexora_Flash_1_Colab.ipynb', target: '_blank', rel: 'noopener' }, 'Visa på GitHub'),
          can('customModel') ? null : h('span', { class: 'lock' }, '🔒 Egen AI-modell i drift ingår i Enterprise')))));
  };

  // ---------------------------------------------------------------- studio
  const EXAMPLES = [
    'Ett plattformsspel i en lavavärld där man hoppar på drakar',
    'Rymdskjutare med neon-tema och bossar',
    'Open world-äventyr i en skog med uppdrag och NPC:er',
    'En 3D-löpare på en isväg',
    'Samla diamanter i en godisvärld, två spelare',
    'Orm-spel under vattnet, svårt',
    'Blockkross med spöken',
    'Undvik bilar på en ökenväg',
  ];
  const OPTS = [
    ['story', 'Story'], ['dialog', 'Dialog'], ['openworld', 'Open world'], ['npc', 'NPC:er'], ['quest', 'Uppdrag'],
    ['music', 'Musik'], ['sfx', 'Ljudeffekter'], ['multiplayer', 'Multiplayer'], ['assets', 'Mina assets'],
  ];
  let current = null; // the game shown in Studio
  let busy = null; // AbortController while generating

  VIEWS.studio = main => {
    const st = S.studio;
    const saveStudio = () => store.set('studio', st);
    const ta = h('textarea', { id: 'prompt', placeholder: 'Beskriv ditt spel… t.ex. "Ett plattformsspel i en isvärld där en pingvin samlar fisk"', 'aria-label': 'Spelbeskrivning' });
    ta.value = st.prompt || '';
    ta.addEventListener('input', () => { st.prompt = ta.value; saveStudio(); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) go(); });

    const modelsEl = h('div', { class: 'models', role: 'radiogroup', 'aria-label': 'Modell' });
    function drawModels() {
      modelsEl.innerHTML = '';
      ['flash', 'pro', 'core'].forEach(k => {
        const m = AI.MODELS[k], locked = tier() < m.minTier;
        modelsEl.append(h('div', { class: 'model' + (st.model === k ? ' on' : ''), role: 'radio', tabindex: 0, 'aria-checked': st.model === k ? 'true' : 'false',
          onclick: () => { if (locked) return upsell(null, m.name + ' ingår från ' + PLANS[m.minTier].name + '.', m.minTier); st.model = k; saveStudio(); drawModels(); } },
        locked ? h('span', { class: 'lock' }, '🔒') : null, h('b', null, m.short), h('span', null, m.tag)));
      });
      const A = AI.MODELS.astryx, open = released('astryx');
      modelsEl.append(h('div', { class: 'model agent' + (st.model === 'astryx' ? ' on' : ''), role: 'radio', tabindex: 0, 'aria-checked': st.model === 'astryx' ? 'true' : 'false',
        onclick: () => { if (!open) return astryxLocked(); st.model = 'astryx'; saveStudio(); drawModels(); } },
      h('span', { class: 'lock' + (open ? ' new' : '') }, open ? 'NY' : '🔒 ' + fmtDate(releaseDate('astryx'))),
      h('b', null, '🤖 ' + A.short), h('span', null, 'AI-agent · bygger, testkör och rättar själv · ' + COST.astryx + ' krediter utöver planen')));
      drawAstryx();
    }
    // Astryx options: engine (HTML5 or Godot + Python), working time, hyperrealistic mode.
    st.astryx = Object.assign({ engine: 'html', minutes: 120, hyperreal: false }, st.astryx || {});
    const astryxBox = h('div', { class: 'card col astryxbox', style: 'padding:14px;display:none' });
    function drawAstryx() {
      astryxBox.style.display = st.model === 'astryx' ? '' : 'none';
      astryxBox.innerHTML = '';
      const A = st.astryx, eng = h('div', { class: 'seg' });
      [['html', '⚡ HTML5'], ['godot', '🎮 Godot + Python']].forEach(([k, l]) => eng.append(h('button', { class: A.engine === k ? 'on' : '', onclick: () => { A.engine = k; saveStudio(); drawAstryx(); } }, l)));
      astryxBox.append(h('b', { class: 'small' }, '🤖 Astryx-motor'), eng);
      if (A.engine !== 'godot') { astryxBox.append(h('p', { class: 'small muted', style: 'margin:0' }, 'Snabbt: ett HTML5-spel som testkörs och rättas i webbläsaren.')); return; }
      if (!DESK) astryxBox.append(h('p', { class: 'note small', style: 'margin:0' }, 'Godot-läget körs i Nexora för dator (Windows, macOS, Linux), som har Python och Godot. ', h('a', { href: '#ladda-ner' }, 'Ladda ner appen')));
      const mins = h('select', { 'aria-label': 'Arbetstid' }, [[15, '15 minuter'], [30, '30 minuter'], [60, '1 timme'], [120, 'Upp till 2 timmar']].map(([v, l]) => h('option', { value: v, selected: A.minutes === v }, l)));
      mins.addEventListener('change', () => { A.minutes = +mins.value; saveStudio(); });
      const hyper = h('input', { type: 'checkbox', checked: !!A.hyperreal });
      hyper.addEventListener('change', () => { A.hyperreal = hyper.checked; saveStudio(); });
      astryxBox.append(
        h('label', { class: 'f small' }, 'Arbetstid', mins),
        h('p', { class: 'small muted', style: 'margin:0' }, 'Astryx planerar, skriver Godot-projektet med Python, testkör det i Godot, tittar på skärmbilder och förbättrar spelet tills det är klart – upp till vald tid. Den fortsätter i bakgrunden medan du gör annat.'),
        h('label', { class: 'opt' }, hyper, h('span', null, h('b', null, '📸 Hyperrealistiskt läge'), h('br'), h('span', { class: 'small muted' }, 'Söker fotorealistiska 3D-modeller, HDRI-himlar och PBR-texturer (Poly Haven, CC0) och bygger världen av dem.')), h('span', { class: 'lock', style: 'margin-left:auto;white-space:nowrap' }, '🪙 ' + COST.hyper)));
    }
    drawModels();

    const dimSeg = h('div', { class: 'seg', 'aria-label': 'Dimension' });
    function drawDim() {
      dimSeg.innerHTML = '';
      [['2d', '2D'], ['3d', '3D']].forEach(([k, l]) => dimSeg.append(h('button', { class: st.dim === k ? 'on' : '', onclick: () => {
        if (k === '3d' && !need('threeD')) return; st.dim = k; saveStudio(); drawDim(); } }, l, k === '3d' && !can('threeD') ? ' 🔒' : '')));
    }
    drawDim();

    const optsEl = h('div', { class: 'opts' });
    OPTS.forEach(([k, l]) => {
      const locked = !can(k === 'sfx' ? 'sfx' : k);
      const cb = h('input', { type: 'checkbox', checked: !locked && !!st.opts[k] });
      cb.addEventListener('change', () => { if (locked) { cb.checked = false; upsell(k); return; } st.opts[k] = cb.checked; saveStudio(); });
      optsEl.append(h('label', { class: 'opt' + (locked ? ' locked' : '') }, cb, l, locked ? h('span', { class: 'lock', style: 'margin-left:auto' }, lockLabel(k)) : null));
    });

    const goBtn = h('button', { class: 'btn primary big', onclick: () => go() }, '✨ Skapa spel');
    const screen = h('div', { class: 'screen' }, h('div', { class: 'empty' }, h('div', null, h('div', { style: 'font-size:3rem' }, '🎮'), h('h3', null, 'Ditt spel visas här'), h('p', null, 'Skriv en idé och tryck på Skapa spel. Ctrl/⌘+Enter fungerar också.'))));
    const titleEl = h('span', { class: 'title' }, current ? current.title : 'Förhandsvisning');
    const bar = h('div', { class: 'bar' }, titleEl);
    const summaryEl = h('div', { class: 'note small', style: 'display:none' });
    const stage = h('div', { class: 'stage' }, bar, summaryEl, screen);

    function toolbar() {
      bar.innerHTML = ''; titleEl.textContent = current ? current.title : 'Förhandsvisning'; bar.append(titleEl);
      summaryEl.style.display = current && current.summary ? '' : 'none';
      summaryEl.textContent = current && current.summary ? '🤖 ' + current.summary : '';
      if (!current) return;
      bar.append(
        h('button', { class: 'btn sm', onclick: () => play(current.html) }, '↻ Starta om'),
        h('button', { class: 'btn sm', onclick: () => { const f = $('iframe', screen); if (f && f.requestFullscreen) f.requestFullscreen(); } }, '⛶ Helskärm'),
        h('button', { class: 'btn sm', onclick: () => { if (need('code')) codeModal(current, g => { current = g; play(g.html); toolbar(); }); } }, '</> Kod', can('code') ? '' : ' 🔒'),
        h('button', { class: 'btn sm', onclick: () => { if (need('bugfix')) bugfix(current, g => { current = g; play(g.html); toolbar(); }); } }, '🐞 Buggfix', can('bugfix') ? '' : ' 🔒'),
        h('button', { class: 'btn sm', onclick: () => exportModal(current) }, '📦 Exportera'));
    }
    function play(html) {
      screen.innerHTML = '';
      screen.append(h('iframe', { title: 'Spel', sandbox: 'allow-scripts allow-pointer-lock', allow: 'fullscreen; autoplay', srcdoc: html }));
      setTimeout(() => { const f = $('iframe', screen); if (f) f.focus(); }, 200);
    }

    async function go() {
      if (busy) { busy.abort(); return; }
      const prompt = ta.value.trim();
      if (prompt.length < 4) { toast('Beskriv spelet med några ord först.'); ta.focus(); return; }
      const p = plan();
      if (st.model === 'astryx' && !released('astryx')) return astryxLocked();
      if (st.model === 'astryx' && st.astryx.engine === 'godot') return goGodot(prompt, OPTS.map(o => o[0]).filter(k => st.opts[k] && can(k)));
      const cost = st.model === 'astryx' ? COST.astryx : COST.game;
      let payWith = 'plan';
      if (used() >= p.games) {
        if (S.credits >= cost) payWith = 'credits';
        else return creditsModal('Du har använt alla ' + p.games + ' spel i ' + p.name + ' den här månaden. Köp krediter och fortsätt direkt – ingen prenumeration – eller uppgradera din plan.' + (S.credits ? ' Du har ' + S.credits + ' krediter, det här kostar ' + cost + '.' : ''), () => go());
      }
      const m = AI.MODELS[st.model];
      if (tier() < m.minTier) { st.model = 'flash'; drawModels(); }
      const features = OPTS.map(o => o[0]).filter(k => st.opts[k] && can(k));
      if (st.dim === '3d') { if (!need('threeD')) return; features.push('threeD'); }

      const log = h('div', { class: 'log' }), stepEl = h('div', { style: 'font-weight:700' }, 'Förbereder…');
      screen.innerHTML = '';
      screen.append(h('div', { class: 'progress' }, h('div', { class: 'spinner' }), stepEl, log, h('button', { class: 'btn sm', onclick: () => busy && busy.abort() }, 'Avbryt')));
      goBtn.textContent = '⏹ Avbryt';
      busy = new AbortController();
      try {
        let html, meta, summary = null;
        if (st.model === 'astryx') {
          stepEl.textContent = 'Astryx 5 Pro planerar…';
          const r = await runAstryx(prompt, features, stepEl, log);
          html = r.html; summary = r.summary;
          meta = { title: r.title || prompt.slice(0, 40), genre: r.genre || 'AI-spel (agent)', dim: r.dim || st.dim, engine: 'Astryx 5 Pro · ' + r.model };
        } else if (S.settings.provider === 'local') {
          const steps = ['Tolkar idén', 'Väljer speltyp och tema', 'Bygger nivåer', 'Lägger till ljud och kontroller', 'Testar spelet'];
          const cfg = L.config(prompt, { dim: st.dim, music: features.includes('music'), sfx: true, multiplayer: features.includes('multiplayer'), quests: features.includes('quest'), allowOpenWorld: can('openworld') && (st.dim === '2d'), variant: st.variant || '' });
          for (const s of steps) {
            if (busy.signal.aborted) throw new DOMException('Avbruten', 'AbortError');
            stepEl.textContent = s + '…'; log.textContent += '› ' + s + '\n';
            await new Promise(r => setTimeout(r, 180 + Math.random() * 180));
          }
          log.textContent += '  speltyp: ' + cfg.genreLabel + '\n  tema: ' + cfg.tagline.split('· ')[1] + '\n';
          html = L.buildHtml(cfg, RT);
          meta = { title: cfg.title, genre: cfg.genreLabel, dim: cfg.dim, engine: 'Nexora Local' };
        } else {
          stepEl.textContent = m.name + (st.model === 'core' ? ' tänker…' : ' skriver spelet…');
          let thinkingShown = false, chars = 0;
          const assetsList = features.includes('assets') ? (await assets.all()).filter(a => a.svg) : [];
          const res = await AI.generateGame(S.settings, st.model, prompt, { dim: st.dim, features, assets: assetsList }, {
            thinking: t => {
              if (!thinkingShown) { log.append(h('div', { class: 'think' }, '💭 ')); thinkingShown = true; }
              log.lastChild.textContent += t; log.scrollTop = log.scrollHeight;
            },
            text: (d, all) => {
              if (chars === 0) { stepEl.textContent = m.name + ' skriver koden…'; log.append(h('div', null, '')); }
              chars = all.length; log.lastChild.textContent = all.slice(-1600); log.scrollTop = log.scrollHeight;
              stepEl.textContent = m.name + ' skriver koden… ' + Math.round(chars / 1000) + ' kB';
            },
          }, busy.signal);
          html = res.html;
          const t = html.match(/<title>([^<]{1,80})<\/title>/i);
          meta = { title: t ? t[1].trim() : prompt.slice(0, 40), genre: 'AI-spel', dim: st.dim, engine: res.model };
        }
        if (payWith === 'credits') { addCredits(-cost, 'Spel: ' + meta.title + (st.model === 'astryx' ? ' (Astryx)' : '')); toast('🪙 Använde ' + cost + ' kredit' + (cost > 1 ? 'er' : '') + ' – ' + S.credits + ' kvar'); }
        else { S.usage[month()] = used() + 1; store.set('usage', S.usage); }
        const now = Date.now();
        current = { id: 'g' + now.toString(36), title: meta.title, prompt, html, summary, model: st.model, engine: meta.engine, provider: S.settings.provider, dim: meta.dim, genre: meta.genre, created: now, updated: now, versions: [] };
        play(html); toolbar();
        const all = await games.all().catch(() => []);
        if (all.length >= plan().storage) toast('Lagringen är full (' + plan().storage + ' spel i ' + plan().name + '). Spelet sparades inte – ta bort ett spel eller uppgradera.', 5000);
        else { await games.put(current).catch(() => toast('Kunde inte spara spelet i webbläsaren.')); }
        render.topOnly();
      } catch (e) {
        if (e.name === 'AbortError') { screen.innerHTML = ''; screen.append(h('div', { class: 'empty' }, h('p', null, 'Avbrutet.'))); }
        else {
          screen.innerHTML = '';
          screen.append(h('div', { class: 'empty' }, h('div', null, h('div', { style: 'font-size:2.4rem' }, '⚠️'), h('h3', null, 'Det gick inte att skapa spelet'), h('p', null, e.message || String(e)),
            S.settings.provider !== 'local' ? h('button', { class: 'btn', onclick: () => { S.settings.provider = 'local'; store.set('settings', S.settings); toast('Bytte till Nexora Local'); render(); } }, 'Använd Nexora Local (offline) istället') : null)));
        }
      } finally {
        busy = null; goBtn.textContent = '✨ Skapa spel';
      }
    }

    const pause = ms => new Promise((r, j) => { const t = setTimeout(r, ms); busy && busy.signal.addEventListener('abort', () => { clearTimeout(t); j(new DOMException('Avbruten', 'AbortError')); }, { once: true }); });

    async function runAstryx(prompt, features, stepEl, log) {
      const LABEL = { write_game: 'Skriver spelet', edit_game: 'Rättar koden', run_game: 'Testkör', finish: 'Avslutar' };
      const line = text => { const d = h('div', null, text); log.append(d); log.scrollTop = log.scrollHeight; return d; };
      let cur = null, thinkEl = null;
      const hooks = {
        runGame: async html => {
          const t = await testGame(html);
          if (t.image) { log.append(h('img', { src: 'data:image/jpeg;base64,' + t.image, alt: 'Astryx skärmbild', style: 'max-width:220px;border-radius:8px;display:block;margin:4px 0' })); log.scrollTop = log.scrollHeight; }
          return t;
        },
        step: (kind, detail) => {
          thinkEl = null;
          if (kind === 'tool_start') {
            stepEl.textContent = 'Astryx: ' + (LABEL[detail] || detail) + '…';
            if (detail === 'write_game' || detail === 'edit_game') cur = line('✍️ ' + LABEL[detail] + '…');
          } else if (kind === 'write') { (cur || line('')).textContent = '✍️ Skrev spelet (' + detail + ')'; cur = null; }
          else if (kind === 'edit') { (cur || line('')).textContent = '🔧 Rättade: ' + detail; cur = null; }
          else if (kind === 'run') cur = line('▶️ Testkör spelet i en dold webbläsare…');
          else if (kind === 'ran') { (cur || line('')).textContent = '▶️ Testkörning: ' + detail; cur = null; }
        },
        thinking: t => { if (!thinkEl) { thinkEl = h('div', { class: 'think' }, '💭 '); log.append(thinkEl); } thinkEl.textContent += t; log.scrollTop = log.scrollHeight; },
        progress: (tool, n) => { if (cur && LABEL[tool]) cur.textContent = '✍️ ' + LABEL[tool] + '… ' + Math.round(n / 1000) + ' kB'; },
      };
      let r;
      if (S.settings.provider === 'local') r = await localAgent(prompt, features, hooks);
      else {
        const assetsList = features.includes('assets') ? (await assets.all()).filter(a => a.svg) : [];
        r = await AI.agent(S.settings, prompt, { dim: st.dim, features, assets: assetsList }, hooks, busy.signal);
      }
      stepEl.textContent = 'Astryx är klar'; line('✅ Klart – ' + r.runs + ' testkörning' + (r.runs === 1 ? '' : 'ar'));
      await pause(1200);
      return r;
    }

    // Astryx on Nexora Local: the same build → test → fix loop, with the offline generator doing the writing.
    async function localAgent(prompt, features, hooks) {
      const opts = { dim: st.dim, music: features.includes('music'), sfx: true, multiplayer: features.includes('multiplayer'), quests: true, allowOpenWorld: can('openworld') && st.dim === '2d' };
      let cfg = L.config(prompt, Object.assign({ variant: st.variant || '' }, opts));
      hooks.thinking('Det här låter som ett ' + cfg.genreLabel.toLowerCase() + ' med ' + cfg.tagline.split('· ')[1].toLowerCase() + '. Jag bygger det, testkör det och justerar tills det fungerar.');
      await pause(500);
      let html, t, runs = 0, fixes = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        hooks.step('tool_start', 'write_game'); await pause(350);
        html = L.buildHtml(cfg, RT); hooks.step('write', Math.round(html.length / 1000) + ' kB');
        hooks.step('tool_start', 'run_game'); hooks.step('run');
        t = await hooks.runGame(html); runs++;
        hooks.step('ran', (t.errors.length ? t.errors.length + ' fel' : 'inga fel') + (t.animating ? ', spelet rör sig' : ', spelet står still'));
        if (!t.errors.length && t.animating) break;
        if (attempt === 2) break;
        fixes++;
        hooks.step('tool_start', 'edit_game');
        hooks.step('edit', t.errors.length ? t.errors[0].slice(0, 80) : 'spelet stod still – bygger en ny variant');
        cfg = L.config(prompt, Object.assign({ variant: 'fix' + attempt + Date.now() }, opts));
      }
      const premise = (L.story(prompt).match(/\*\*Premiss\.\*\* ([^\n]+)/) || [])[1];
      return {
        html, title: cfg.title, genre: cfg.genreLabel, dim: cfg.dim, model: 'Nexora Local', runs,
        summary: 'Astryx byggde "' + cfg.title + '" (' + cfg.genreLabel.toLowerCase() + '), testkörde det ' + runs + ' gång' + (runs > 1 ? 'er' : '') + (fixes ? ' och rättade ' + fixes + ' problem' : ' utan fel') + '.' + (premise ? ' ' + premise : ''),
      };
    }

    async function goGodot(prompt, features) {
      if (!DESK) {
        const close = modal([h('h2', null, '🎮 Godot-läget kräver Nexora för dator'),
          h('p', null, 'Astryx bygger Godot-spel med Python och testkör dem i Godot-motorn på din dator. Det går inte i en webbläsare.'),
          h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#ladda-ner', onclick: () => close() }, 'Ladda ner Nexora'), h('button', { class: 'btn ghost', onclick: () => close() }, 'Stäng'))]);
        return;
      }
      const A = st.astryx, p = plan();
      let charge;
      if (A.hyperreal) {
        if (S.credits < COST.hyper) return creditsModal('Hyperrealistiskt läge kostar ' + COST.hyper + ' krediter per spel. Du har ' + S.credits + '.', () => go());
        charge = { credits: COST.hyper };
      } else if (used() >= p.games) {
        if (S.credits < COST.astryx) return creditsModal('Du har använt alla ' + p.games + ' spel i ' + p.name + ' den här månaden. En Astryx-körning kostar ' + COST.astryx + ' krediter.', () => go());
        charge = { credits: COST.astryx };
      } else charge = { quota: 1 };
      startGodotJob({ prompt, minutes: A.minutes, hyperreal: !!A.hyperreal, features, charge });
    }

    const variantBtn = h('button', { class: 'btn sm ghost', title: 'Samma idé, ny variant', onclick: () => { st.variant = String(Math.random()).slice(2, 8); saveStudio(); go(); } }, '🎲 Ny variant');
    main.append(h('div', { class: 'wrap studio' },
      h('div', { class: 'panel' },
        h('div', null, h('h2', { style: 'margin-bottom:4px' }, 'Studio'), h('div', { class: 'small muted' }, 'Leverantör: ', providerLabel(), ' · ', h('a', { href: '#', onclick: e => { e.preventDefault(); settingsModal(); } }, 'ändra'))),
        ta,
        h('div', { class: 'chips' }, EXAMPLES.map(x => h('span', { class: 'chip', onclick: () => { ta.value = x; st.prompt = x; saveStudio(); } }, x))),
        h('div', { class: 'col' }, h('b', { class: 'small' }, 'Modell'), modelsEl, astryxBox),
        h('div', { class: 'row' }, h('b', { class: 'small' }, 'Dimension'), dimSeg),
        h('div', { class: 'col' }, h('b', { class: 'small' }, 'Innehåll'), optsEl),
        h('div', { class: 'row' }, goBtn, variantBtn),
        S.settings.provider === 'local' ? h('p', { class: 'small muted' }, 'Nexora Local bygger spelet på enheten från 9 speltyper. För helt nya spelidéer: koppla in Claude eller en egen modell under Inställningar.') : null),
      stage));
    if (current) { play(current.html); toolbar(); }
    return { unmount() { if (busy) busy.abort(); } };
  };
  render.topOnly = () => { const t = $('header.top'); if (t) t.replaceWith(topbar()); };

  // ---------------------------------------------------------------- code, bugfix, versions
  function codeModal(g, onSave) {
    const ta = h('textarea', { class: 'code', spellcheck: 'false' }); ta.value = g.html;
    const close = modal([
      h('div', { class: 'bar' }, h('span', { class: 'title' }, '</> ' + g.title),
        h('button', { class: 'btn sm', onclick: () => download(slug(g.title) + '.html', ta.value, 'text/html') }, 'Ladda ner'),
        h('button', { class: 'btn sm primary', onclick: async () => { await saveVersion(g, 'Före kodändring'); g.html = ta.value; g.updated = Date.now(); await games.put(g).catch(() => {}); onSave(g); close(); toast('Sparat'); } }, 'Spara och kör')),
      h('p', { class: 'small muted' }, 'Hela spelet är en HTML-fil. Ändra fritt – tidigare version sparas' + (can('versions') ? ' i versionshistoriken.' : ' (versionshistorik ingår i Studio).')),
      ta], true);
  }
  async function saveVersion(g, note) {
    if (!can('versions')) return;
    g.versions = (g.versions || []).concat([{ t: Date.now(), note, html: g.html }]).slice(-30);
  }
  function versionsModal(g, onRestore) {
    const list = (g.versions || []).slice().reverse();
    const close = modal([
      h('h2', null, '🕘 Versioner – ' + g.title),
      list.length ? h('table', { class: 't' }, list.map(v => h('tr', null, h('td', null, new Date(v.t).toLocaleString('sv-SE')), h('td', null, v.note || ''), h('td', null,
        h('button', { class: 'btn sm', onclick: async () => { await saveVersion(g, 'Före återställning'); g.html = v.html; g.updated = Date.now(); await games.put(g); onRestore && onRestore(g); close(); toast('Version återställd'); } }, 'Återställ'))))) : h('p', { class: 'muted' }, 'Inga sparade versioner än. Versioner sparas när du ändrar koden, kör buggfix eller trycker "Spara version".'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { await saveVersion(g, 'Manuell version'); await games.put(g); close(); toast('Version sparad'); } }, 'Spara version nu'), h('button', { class: 'btn ghost', onclick: () => close() }, 'Stäng'))]);
  }

  // Runs inside the test iframe (serialized with toString): records errors and frames,
  // starts the game with Space/Enter/click, plays with arrows and WASD, then reports
  // how many colours the canvas shows, whether it still changes, and a JPEG screenshot.
  function gameProbe(tag, ms) {
    var frames = 0;
    function send(o) { o[tag] = 1; parent.postMessage(o, '*'); }
    function err(m) { send({ err: String(m).slice(0, 400) }); }
    addEventListener('error', function (e) { err((e.message || 'Fel') + ' (rad ' + e.lineno + ')'); });
    addEventListener('unhandledrejection', function (e) { err('Promise: ' + (e.reason && e.reason.message || e.reason)); });
    var ce = console.error;
    console.error = function () { err('console.error: ' + [].join.call(arguments, ' ')); ce.apply(console, arguments); };
    var raf = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) { return raf.call(window, function (t) { frames++; cb(t); }); };
    var KEYS = { Space: [' ', 32], Enter: ['Enter', 13], ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39], ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], KeyW: ['w', 87], KeyA: ['a', 65], KeyS: ['s', 83], KeyD: ['d', 68] };
    function key(type, code) {
      var k = KEYS[code], ev = new KeyboardEvent(type, { code: code, key: k[0], bubbles: true, cancelable: true });
      try { Object.defineProperty(ev, 'keyCode', { get: function () { return k[1]; } }); Object.defineProperty(ev, 'which', { get: function () { return k[1]; } }); } catch (x) { /* read-only */ }
      (document.body || document).dispatchEvent(ev);
    }
    function tap(code, hold) { key('keydown', code); setTimeout(function () { key('keyup', code); }, hold || 120); }
    function click() {
      var c = document.querySelector('canvas') || document.body;
      if (!c) return;
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
        try { c.dispatchEvent(new MouseEvent(t, { bubbles: true, clientX: innerWidth / 2, clientY: innerHeight / 2 })); } catch (x) { /* ignore */ }
      });
    }
    function snap() {
      var best = null, area = 0;
      [].forEach.call(document.querySelectorAll('canvas'), function (c) { if (c.width * c.height > area) { area = c.width * c.height; best = c; } });
      if (!best) return null;
      var w = Math.min(480, best.width), h = Math.max(1, Math.round(best.height * w / best.width)), o = document.createElement('canvas');
      o.width = w; o.height = h;
      try {
        var x = o.getContext('2d'); x.drawImage(best, 0, 0, w, h);
        var d = x.getImageData(0, 0, w, h).data, seen = {}, n = 0, sum = 0;
        for (var i = 0; i < d.length; i += 4 * 37) {
          var k = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4);
          if (!seen[k]) { seen[k] = 1; n++; }
          sum = (Math.imul(sum, 31) + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0;
        }
        return { colors: n, hash: sum, image: o.toDataURL('image/jpeg', 0.7).split(',')[1] };
      } catch (x) { return { colors: 0, hash: 0, image: null }; }
    }
    setTimeout(function () { click(); tap('Space', 150); tap('Enter', 150); }, 700);
    ['ArrowRight', 'ArrowUp', 'KeyD', 'Space', 'ArrowLeft', 'ArrowDown', 'KeyW', 'ArrowRight'].forEach(function (c, i) {
      setTimeout(function () { tap(c, 260); }, 1100 + i * 300);
    });
    setTimeout(function () {
      var a = snap();
      setTimeout(function () {
        var b = snap();
        send({ report: 1, frames: frames, colors: b ? b.colors : 0, animating: !!(a && b && a.hash !== b.hash), image: b && b.image });
      }, 400);
    }, ms - 700);
  }

  // Runs a game in a hidden iframe: {errors, frames, colors, animating, image}.
  function testGame(html, ms) {
    ms = ms || 4200;
    return new Promise(res => {
      const errs = [], tag = 'nx' + Math.random().toString(36).slice(2);
      const probe = '<script>(' + gameProbe.toString() + ')(' + JSON.stringify(tag) + ',' + ms + ');</' + 'script>';
      const withProbe = /<head(\s[^>]*)?>/i.test(html) ? html.replace(/<head(\s[^>]*)?>/i, m => m + probe) : probe + html;
      // Kept on screen (but invisible) so the browser does not throttle its animation frames.
      const f = h('iframe', { sandbox: 'allow-scripts', 'aria-hidden': 'true', tabindex: -1, style: 'position:fixed;left:0;top:0;width:800px;height:500px;opacity:0.001;pointer-events:none;border:0;z-index:-1', srcdoc: withProbe });
      let report = null;
      const on = e => {
        const d = e.data;
        if (!d || !d[tag]) return;
        if (d.err && errs.length < 20) errs.push(d.err);
        if (d.report) { report = d; finish(); }
      };
      const timer = setTimeout(() => finish(), ms + 2500);
      function finish() {
        clearTimeout(timer); removeEventListener('message', on); f.remove();
        res({ errors: errs, frames: report ? report.frames : 0, colors: report ? report.colors : 0, animating: report ? report.animating : false, image: report ? report.image : null });
      }
      addEventListener('message', on); document.body.appendChild(f);
    });
  }
  const collectErrors = html => testGame(html).then(r => r.errors);
  function bugfix(g, onDone) {
    const out = h('div', { class: 'log', style: 'max-height:260px;width:100%' }, 'Kör spelet och letar efter fel…\n');
    const close = modal([h('h2', null, '🐞 Buggfix-AI'), out, h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => close() }, 'Stäng'))]);
    (async () => {
      const errs = await collectErrors(g.html);
      out.textContent += errs.length ? 'Hittade ' + errs.length + ' fel:\n' + errs.map(e => '  • ' + e).join('\n') + '\n' : 'Inga körfel hittades.\n';
      if (S.settings.provider === 'local') {
        out.textContent += errs.length ? '\nKoppla in Claude eller en egen modell under Inställningar för att låta AI:n rätta felen automatiskt.' : '\nSpelet ser friskt ut.';
        return;
      }
      out.textContent += '\nBer ' + AI.MODELS[g.model === 'flash' ? 'flash' : 'pro'].name + ' att rätta spelet…\n';
      try {
        let n = 0;
        const fixed = await AI.fixGame(S.settings, g.model === 'core' ? 'core' : 'pro', g.html, errs, { text: (d, all) => { if (++n % 40 === 0) out.textContent = out.textContent.replace(/\n· \d+ kB$/, '') + '\n· ' + Math.round(all.length / 1000) + ' kB'; } });
        const after = await collectErrors(fixed);
        await saveVersion(g, 'Före buggfix'); g.html = fixed; g.updated = Date.now(); await games.put(g).catch(() => {});
        out.textContent += '\nKlart. Fel efter fix: ' + after.length + (after.length ? '\n' + after.join('\n') : '') + '\n';
        onDone(g);
      } catch (e) { out.textContent += '\nFel: ' + e.message; }
    })();
  }

  // ---------------------------------------------------------------- export
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  // Minimal store-only ZIP writer (no compression) – enough for small project exports.
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    for (const [name, content] of Object.entries(files)) {
      const nb = enc.encode(name), data = typeof content === 'string' ? enc.encode(content) : content, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nb.length, true);
      parts.push(new Uint8Array(lh.buffer), nb, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nb);
      off += 30 + nb.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0), n = Object.keys(files).length;
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, n, true); end.setUint16(10, n, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }
  function electronFiles(g, extra) {
    const name = slug(g.title);
    return Object.assign({
      'package.json': JSON.stringify({ name, productName: g.title, version: '1.0.0', main: 'main.js', scripts: { start: 'electron .', dist: 'electron-builder' }, devDependencies: { electron: '^43.0.0', 'electron-builder': '^26.0.0' }, build: { appId: 'app.nexora.' + name.replace(/-/g, ''), productName: g.title, files: ['main.js', 'index.html'], win: { target: 'nsis' }, mac: { target: 'dmg' }, linux: { target: ['deb', 'AppImage'] } } }, null, 2),
      'main.js': "const { app, BrowserWindow } = require('electron');\nconst path = require('path');\napp.whenReady().then(() => {\n  const w = new BrowserWindow({ width: 1280, height: 800, autoHideMenuBar: true, backgroundColor: '#000000', title: " + JSON.stringify(g.title) + " });\n  w.loadFile(path.join(__dirname, 'index.html'));\n});\napp.on('window-all-closed', () => app.quit());\n",
      'index.html': g.html,
      'README.md': '# ' + g.title + '\n\nSkapat med Nexora.\n\n```sh\nnpm install\nnpm start        # kör spelet\nnpm run dist     # bygger installationsfil (.exe / .dmg / .deb) för din plattform\n```\n',
    }, extra || {});
  }
  function exportModal(g) {
    const name = slug(g.title);
    const items = [
      ['web', '🌐 Webb (HTML)', 'En fil som fungerar i alla webbläsare och kan läggas på valfri webbhotell.', null, () => download(name + '.html', g.html, 'text/html')],
      ['mobile', '📱 Mobil (PWA)', 'Installerbar webbapp för iOS och Android: index.html, manifest och service worker.', 'exportMobile', () => download(name + '-mobil.zip', zip({
        'index.html': g.html.replace(/<head([^>]*)>/i, '<head$1><link rel="manifest" href="manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes"><script>if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js")</' + 'script>'),
        'manifest.webmanifest': JSON.stringify({ name: g.title, short_name: g.title.slice(0, 12), start_url: '.', display: 'fullscreen', orientation: 'any', background_color: '#000000', theme_color: '#7c5cff', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }] }, null, 2),
        'sw.js': "const C='" + name + "-v1';self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.webmanifest','icon.svg']))));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));",
        'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#7c5cff"/><text x="32" y="42" font-size="30" text-anchor="middle" fill="#fff" font-family="sans-serif">' + (g.title[0] || 'N').replace(/[<&]/g, '') + '</text></svg>',
        'README.md': '# ' + g.title + ' – mobil\n\nLägg mappen på en HTTPS-server och öppna den i mobilen → "Lägg till på hemskärmen".\nFör App Store/Google Play: slå in mappen med Capacitor (`npx cap init`, `npx cap add ios|android`).\n',
      }))],
      ['pc', '🖥️ PC (Windows, macOS, Linux)', 'Electron-projekt. Kör "npm install && npm run dist" för att bygga .exe, .dmg och .deb.', 'exportPc', () => download(name + '-pc.zip', zip(electronFiles(g)))],
      ['steam', '🎮 Steam', 'PC-projektet plus Steamworks-byggskript (app_build.vdf, depot_build.vdf). Kräver ett Steamworks-konto och App ID.', 'steam', () => download(name + '-steam.zip', zip(electronFiles(g, {
        'steam_appid.txt': '480\n',
        'steam/app_build.vdf': '"AppBuild"\n{\n  "AppID" "480"  // byt till ditt App ID\n  "Desc" "' + g.title.replace(/"/g, '') + ' via Nexora"\n  "ContentRoot" "../dist/"\n  "BuildOutput" "./output/"\n  "Depots"\n  {\n    "481" "depot_build.vdf"\n  }\n}\n',
        'steam/depot_build.vdf': '"DepotBuild"\n{\n  "DepotID" "481"  // byt till ditt depå-ID\n  "FileMapping"\n  {\n    "LocalPath" "*"\n    "DepotPath" "."\n    "Recursive" "1"\n  }\n}\n',
        'STEAM.md': '# Publicera på Steam\n\n1. `npm install && npm run dist` bygger spelet till `dist/`.\n2. Byt App ID/depå-ID i `steam/*.vdf` och `steam_appid.txt` (480 är Valves testapp Spacewar).\n3. Ladda upp med SteamCMD: `steamcmd +login <konto> +run_app_build ../steam/app_build.vdf +quit`.\n',
      })))],
      ['xbox', '🟩 Xbox', 'Portningspaket: spelet, manifest och instruktioner för Microsoft GDK. Själva konsolbygget kräver ID@Xbox-avtal och devkit.', 'xbox', () => consoleKit(g, 'Xbox', 'Microsoft GDK (ID@Xbox)', 'Använd GDK:s WebView2-mall eller en Win32/UWP-wrapper och paketera som MSIXVC.')],
      ['ps', '🟦 PlayStation', 'Portningspaket för PlayStation. Konsolbygget kräver PlayStation Partners-avtal och devkit.', 'ps', () => consoleKit(g, 'PlayStation', 'PlayStation Partners SDK', 'Spelet måste köras i en inbyggd motor – porta logiken eller använd en WebView-lösning som Sony godkänt.')],
      ['nintendo', '🟥 Nintendo Switch', 'Portningspaket för Nintendo. Konsolbygget kräver Nintendo Developer Portal-avtal och devkit.', 'nintendo', () => consoleKit(g, 'Nintendo Switch', 'Nintendo Developer Portal / NintendoSDK', 'Porta till en motor som stöds (t.ex. Unity eller Godot med licensierad konsolexport).')],
      ['project', '🗂️ Nexora-projekt', 'Hela projektet med versioner som .nexora.json – dela med teamet och importera under Mina spel.', 'shared', () => download(name + '.nexora.json', JSON.stringify(Object.assign({ nexora: 1 }, g), null, 1), 'application/json')],
    ];
    const close = modal([
      h('h2', null, '📦 Exportera ' + g.title),
      h('div', { class: 'col' }, items.map(([id, t, d, f, run]) => h('div', { class: 'card', style: 'padding:14px' },
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, t), f && !can(f) ? h('span', { class: 'lock' }, lockLabel(f)) : null),
        h('p', { class: 'small muted', style: 'margin:6px 0 10px' }, d),
        h('button', { class: 'btn sm' + (f && !can(f) ? '' : ' primary'), onclick: () => { if (f && !need(f)) return; run(); toast('Export klar'); } }, 'Exportera')))),
      h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn ghost', onclick: () => close() }, 'Stäng'))], false);
  }
  function consoleKit(g, platform, sdk, how) {
    download(slug(g.title) + '-' + slug(platform) + '-portning.zip', zip({
      'game/index.html': g.html,
      'nexora-manifest.json': JSON.stringify({ title: g.title, platform, engine: 'HTML5 canvas (Nexora)', controls: 'tangentbord + touch; mappa till handkontroll', prompt: g.prompt, created: new Date(g.created).toISOString() }, null, 2),
      'PORTING.md': '# ' + g.title + ' → ' + platform + '\n\nDet här är ett **portningspaket**, inte ett färdigt konsolbygge. Konsoltillverkare kräver att utvecklare har avtal och devkit, och deras SDK:er får inte distribueras av tredje part.\n\n1. Ansök om utvecklaråtkomst: ' + sdk + '.\n2. ' + how + '\n3. Mappa tangentbordskontrollerna i `game/index.html` till handkontroll (Gamepad API: `navigator.getGamepads()`).\n4. Klara plattformens certifieringskrav (TRC/XR/Lotcheck) innan inskickning.\n',
    }));
  }

  // ---------------------------------------------------------------- library
  // ---------------------------------------------------------------- Astryx 5 Pro in Godot mode (desktop)
  const DESK = window.nexoraDesktop || null;
  const JOBS = store.get('jobs', []).map(j => (j.status === 'running' ? Object.assign(j, { status: 'interrupted', ended: j.ended || Date.now() }) : j));
  const jobListeners = new Set(), liveCtl = {}, deskListeners = new Set();
  let jobSavedAt = 0;
  if (DESK) DESK.on(ev => deskListeners.forEach(f => f(ev)));
  function saveJobs() { store.set('jobs', JOBS.slice(0, 30).map(j => Object.assign({}, j, { log: j.log.slice(-250) }))); }
  function jobChanged(j) {
    jobListeners.forEach(f => f(j));
    if (Date.now() - jobSavedAt > 3000 || j.status !== 'running') { jobSavedAt = Date.now(); saveJobs(); }
  }
  function jobLog(j, text, kind) { j.log.push({ t: Date.now(), text, kind: kind || '' }); jobChanged(j); }
  const fmtDur = ms => { const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ':' + String(s).padStart(2, '0'); };
  const lastLine = s => String(s || '').trim().split('\n').slice(-1)[0].slice(0, 200);

  // Lessons: what Astryx learned in earlier runs, fed back into its instructions.
  let lessonsCache = null;
  async function getLessons() {
    if (!lessonsCache) lessonsCache = DESK ? await DESK.call('lessons').catch(() => []) : store.get('lessons', []);
    return lessonsCache;
  }
  async function addLesson(text) {
    const ls = await getLessons();
    if (ls.some(l => l.text === text)) return;
    ls.push({ text, t: Date.now() });
    if (DESK) await DESK.call('saveLessons', { lessons: ls }).catch(() => {}); else store.set('lessons', ls);
  }

  // Poly Haven search terms per theme, for Nexora Local's hyperrealistic builds.
  const THEME_ASSETS = {
    Skog: { models: ['tree', 'fern', 'rock', 'log', 'stump'], hdri: 'forest', tex: 'forest ground' },
    Öken: { models: ['rock', 'cactus', 'barrel', 'crate'], hdri: 'desert', tex: 'sand' },
    Is: { models: ['pine', 'rock', 'boulder'], hdri: 'snow', tex: 'snow' },
    Hav: { models: ['rock', 'boat', 'barrel', 'crate'], hdri: 'sea', tex: 'sand' },
    Lava: { models: ['rock', 'boulder', 'stone'], hdri: 'sunset', tex: 'rock' },
    Skräck: { models: ['dead tree', 'lantern', 'gravestone', 'rock'], hdri: 'night', tex: 'forest ground' },
    Neon: { models: ['barrel', 'crate', 'bench', 'lamp'], hdri: 'night city', tex: 'asphalt' },
    Godis: { models: ['flower', 'tree', 'rock'], hdri: 'sunny', tex: 'grass' },
    Rymd: { models: ['rock', 'boulder', 'stone'], hdri: 'night', tex: 'rock' },
    Nexora: { models: ['tree', 'rock', 'barrel', 'crate'], hdri: 'sky', tex: 'grass' },
  };
  // Training set: varied briefs that exercise different Godot skills.
  const BENCH = [
    'Ett 3D-plattformsspel på flytande öar med rörliga plattformar och checkpoints',
    'Ett top-down 2D-skjutspel i en rymdstation med vågor av fiender och uppgraderingar',
    'Ett racingspel i 3D på en ökenbana med varvtider och en AI-motståndare',
    'Ett pusselspel i 2D där man leder ljusstrålar med speglar genom 10 nivåer',
    'Ett tredjepersons utforskningsspel i en skog med dag/natt-cykel och samlarobjekt',
    'Ett tower defense-spel i 3D med tre torntyper och fem vågor',
    'Ett 2D-plattformsspel med dubbelhopp, väggsprång och en boss',
    'Ett överlevnadsspel i snö där man samlar ved för att hålla elden vid liv',
  ];

  async function ensureDesktopReady(j) {
    const info = await DESK.call('info');
    if (!info.python) throw new Error('Python 3 hittades inte på datorn. Installera det från python.org (kryssa i "Add to PATH" på Windows) och starta om Nexora.');
    if (!store.get('godotConsent', false)) {
      const ok = await DESK.call('confirm', { title: 'Astryx 5 Pro', ok: 'Godkänn', message: 'Låt Astryx köra kod på den här datorn?',
        detail: 'I Godot-läget skriver Astryx Python-skript och kör dem, och startar Godot för att testa spelet. Koden körs i projektmappen (' + info.projects + ') och spärras från nätverk, andra program och filer utanför projektet.' });
      if (!ok.ok) throw new Error('Du godkände inte att Astryx kör kod på datorn.');
      store.set('godotConsent', true);
    }
    if (!info.godot.path) {
      jobLog(j, '⬇️ Laddar ner Godot ' + info.godot.version + ' (engångsnedladdning, ~80–170 MB)…');
      const off = watchDownloads(j);
      try { await DESK.call('installGodot'); } finally { off(); }
      jobLog(j, '✅ Godot installerat', 'ok');
    }
    return info;
  }
  function watchDownloads(j) {
    let last = 0;
    const f = ev => {
      if (ev.type === 'download' && (ev.done || Date.now() - last > 1500)) {
        last = Date.now();
        j.phase = '⬇️ ' + ev.what + ' ' + (ev.total ? Math.round(ev.got / ev.total * 100) + ' %' : Math.round(ev.got / 1e6) + ' MB');
        jobChanged(j);
      } else if (ev.type === 'status') { j.phase = ev.text; jobChanged(j); }
    };
    deskListeners.add(f);
    return () => deskListeners.delete(f);
  }

  // Runs one Astryx tool on the desktop; returns tool_result content for the agent.
  async function execTool(j, name, input) {
    const P = j.project;
    if (name === 'run_python') {
      jobLog(j, '🐍 ' + (input.purpose || 'Kör Python'));
      const r = await DESK.call('runPython', { project: P, code: input.code, timeout: 240 });
      if (r.exit !== 0) jobLog(j, '⚠️ Python: ' + lastLine(r.stderr || r.stdout), 'warn');
      return { content: JSON.stringify({ exit: r.exit, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut }), is_error: r.exit !== 0 };
    }
    if (name === 'write_file') {
      const w = await DESK.call('writeFile', { project: P, file: input.path, content: input.content });
      jobLog(j, '📝 ' + input.path + ' (' + Math.round(w.bytes / 100) / 10 + ' kB)');
      return { content: 'Wrote ' + w.bytes + ' bytes to ' + input.path };
    }
    if (name === 'read_file') { const r = await DESK.call('readFile', { project: P, file: input.path }); return { content: r.content != null ? r.content : r.error, is_error: r.content == null }; }
    if (name === 'list_files') return { content: JSON.stringify((await DESK.call('listFiles', { project: P })).files) };
    if (name === 'godot_run') {
      jobLog(j, '▶️ Importerar och testkör i Godot…');
      j.phase = '▶️ Testkör i Godot';
      const g = await DESK.call('godotRun', { project: P });
      j.runs = (j.runs || 0) + 1;
      if (g.shots.length) j.shots = g.shots.slice(-3).map(x => x.jpeg);
      jobLog(j, g.ok ? '✅ Testkörning ' + j.runs + ': inga fel' : '🐞 Testkörning ' + j.runs + ': ' + g.errors.length + ' fel', g.ok ? 'ok' : 'warn');
      g.errors.slice(0, 3).forEach(e => jobLog(j, '   ' + e.slice(0, 200), 'err'));
      const text = JSON.stringify({ ok: g.ok, completed: g.frames > 0, frames: g.frames, errors: g.errors, screenshots: g.shots.length, windowed: g.windowed, log_tail: (g.log || '').slice(-2500) });
      return { content: [{ type: 'text', text }].concat(g.shots.map(x => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: x.jpeg } }))) };
    }
    if (name === 'search_assets') {
      jobLog(j, '🔎 Söker ' + ({ models: 'modeller', hdris: 'HDRI-himlar', textures: 'texturer' }[input.type] || input.type) + ': "' + input.query + '"');
      const r = await DESK.call('searchAssets', { query: input.query, type: input.type, limit: 10 });
      return { content: JSON.stringify(r) };
    }
    if (name === 'download_asset') {
      jobLog(j, '⬇️ Laddar ner ' + input.id + ' (' + (input.resolution || '2k') + ')');
      const off = watchDownloads(j);
      try {
        const d = await DESK.call('downloadAsset', { project: P, id: input.id, type: input.type, resolution: input.resolution || '2k' });
        (j.assets = j.assets || []).push(input.id);
        return { content: JSON.stringify(d) };
      } finally { off(); }
    }
    throw new Error('okänt verktyg ' + name);
  }

  // Astryx on Nexora Local: plan → (assets) → Python writes the project → Godot test → fix.
  async function localGodotAgent(j) {
    const a = L.config(j.prompt, { dim: '3d', variant: String(j.started) });
    const themeName = a.tagline.split('· ')[1].replace('-tema', '');
    const cfg = { title: a.title, tagline: a.genreLabel.replace('3D-', '') + ' · ' + themeName, seed: a.seed % 2147483647, difficulty: a.difficulty, palette: a.palette, hyperreal: j.hyperreal, models: [], hdri: '', ground_maps: {} };
    jobLog(j, '🧠 Plan: tredjepersonsspel i 3D, ' + themeName.toLowerCase() + '-tema, samla kulor och undvik jägare' + (j.hyperreal ? ', fotorealistisk värld' : ''), 'think');
    if (j.hyperreal) {
      const T = THEME_ASSETS[themeName] || THEME_ASSETS.Nexora, taken = new Set();
      const find = async (query, type) => {
        const r = JSON.parse((await execTool(j, 'search_assets', { query, type })).content).results;
        return r.find(x => !taken.has(x.id));
      };
      try {
        for (const q of T.models) {
          if (cfg.models.length >= 4) break;
          const hit = await find(q, 'models');
          if (!hit) continue;
          taken.add(hit.id);
          cfg.models.push(JSON.parse((await execTool(j, 'download_asset', { id: hit.id, type: 'models', resolution: '2k' })).content).path);
        }
        const sky = await find(T.hdri, 'hdris');
        if (sky) cfg.hdri = JSON.parse((await execTool(j, 'download_asset', { id: sky.id, type: 'hdris', resolution: '2k' })).content).path;
        const tex = await find(T.tex, 'textures');
        if (tex) cfg.ground_maps = JSON.parse((await execTool(j, 'download_asset', { id: tex.id, type: 'textures', resolution: '2k' })).content).maps;
      } catch (e) {
        jobLog(j, '⚠️ Kunde inte hämta alla assets (' + e.message + ') – bygger med det som finns', 'warn');
      }
    }
    const build = async () => {
      await execTool(j, 'write_file', { path: 'nexora_build.json', content: JSON.stringify(cfg, null, 1) });
      const r = await execTool(j, 'run_python', { purpose: 'Skriver Godot-projektet (project.godot, main.tscn, main.gd)', code: "import runpy, sys\nsys.argv = ['nexora_godot_local.py', 'nexora_build.json']\nrunpy.run_path('_nexora/nexora_godot_local.py', run_name='__main__')\n" });
      if (r.is_error) throw new Error('Python-steget misslyckades: ' + lastLine(JSON.parse(r.content).stderr));
      return JSON.parse((await execTool(j, 'godot_run', {})).content[0].text);
    };
    let t = await build();
    if (!t.ok && cfg.models.length) {
      jobLog(j, '🔧 Fel vid testkörning – bygger om utan de nedladdade modellerna');
      cfg.models = [];
      t = await build();
    }
    if (!t.ok) throw new Error('Godot-projektet fick fel vid testkörning: ' + (t.errors[0] || 'okänt'));
    return { title: cfg.title, summary: 'Astryx byggde "' + cfg.title + '" i Godot 4.7 (' + (j.hyperreal ? 'fotorealistisk värld med ' + cfg.models.length + ' Poly Haven-modeller' + (cfg.hdri ? ', HDRI-himmel' : '') + (cfg.ground_maps.albedo ? ' och PBR-mark' : '') : 'stiliserad 3D') + ') och testkörde det ' + j.runs + ' gång' + (j.runs > 1 ? 'er' : '') + ' utan fel. Samla alla kulor innan tiden tar slut.' };
  }

  function refund(j) {
    if (!j.charge) return;
    if (j.charge.credits) addCredits(j.charge.credits, 'Återbetalning: ' + j.title);
    else if (j.charge.quota) { S.usage[month()] = Math.max(0, used() - 1); store.set('usage', S.usage); }
    j.charge = null;
  }

  function startGodotJob(o) {
    const j = { id: 'j' + Date.now().toString(36), title: o.prompt.slice(0, 70), prompt: o.prompt, status: 'running', started: Date.now(), minutes: o.minutes || 120,
      hyperreal: !!o.hyperreal, training: !!o.training, features: o.features || [], log: [], shots: [], runs: 0, provider: S.settings.provider, charge: o.charge || null, phase: 'Startar…' };
    if (j.charge && j.charge.credits) addCredits(-j.charge.credits, (j.hyperreal ? 'Astryx hyperrealistiskt: ' : 'Astryx Godot: ') + j.title);
    if (j.charge && j.charge.quota) { S.usage[month()] = used() + 1; store.set('usage', S.usage); }
    JOBS.unshift(j);
    jobLog(j, '🤖 Astryx 5 Pro startar' + (j.provider === 'anthropic' ? ' (Claude, upp till ' + j.minutes + ' min)' : ' (Nexora Local)') + (j.hyperreal ? ' · 📸 hyperrealistiskt' : ''));
    if (!o.quiet) { render.topOnly(); if (location.hash !== '#astryx') location.hash = 'astryx'; }
    const ctl = new AbortController();
    liveCtl[j.id] = ctl;
    const run = (async () => {
      try {
        await ensureDesktopReady(j);
        const proj = await DESK.call('createProject', { name: o.prompt.slice(0, 30) });
        j.project = proj.id; j.dir = proj.dir;
        jobLog(j, '📁 Projekt: ' + proj.dir);
        let r;
        if (j.provider === 'anthropic') {
          const thinkLine = { cur: null };
          const hooks = {
            exec: (name, input) => execTool(j, name, input),
            step: (kind, detail) => { thinkLine.cur = null; if (kind === 'tool_start') { j.phase = ({ run_python: '🐍 Skriver Python', write_file: '📝 Skriver fil', godot_run: '▶️ Testkör i Godot', search_assets: '🔎 Söker assets', download_asset: '⬇️ Laddar ner', finish: '✅ Avslutar', save_lesson: '🎓 Sparar lärdom' }[detail] || detail) + '…'; jobChanged(j); } },
            thinking: t => { if (!thinkLine.cur) { thinkLine.cur = { t: Date.now(), text: '💭 ', kind: 'think' }; j.log.push(thinkLine.cur); } thinkLine.cur.text += t; jobChanged(j); },
            progress: (tool, n) => { j.phase = (tool === 'run_python' ? '🐍 Skriver Python… ' : '📝 Skriver fil… ') + Math.round(n / 1000) + ' kB'; jobChanged(j); },
            lesson: l => { addLesson(l); jobLog(j, '🎓 Lärdom sparad: ' + l, 'ok'); },
          };
          r = await AI.agentGodot(S.settings, o.prompt, { maxMinutes: j.minutes, hyperreal: j.hyperreal, features: j.features, lessons: (await getLessons()).map(l => l.text) }, hooks, ctl.signal);
          try { const pg = await DESK.call('readFile', { project: j.project, file: 'project.godot' }); const m = /config\/name="([^"]+)"/.exec(pg.content || ''); if (m) r.title = m[1]; } catch (e) { /* keep prompt title */ }
        } else {
          r = await localGodotAgent(j);
        }
        j.status = 'done'; j.summary = r.summary; j.title = r.title || j.title; j.phase = '✅ Klar';
        jobLog(j, '✅ Klart efter ' + fmtDur(Date.now() - j.started) + ' och ' + j.runs + ' testkörning' + (j.runs === 1 ? '' : 'ar'), 'ok');
        const now = Date.now();
        await games.put({ id: 'g' + now.toString(36), type: 'godot', project: j.project, dir: j.dir, title: j.title, prompt: o.prompt, summary: j.summary, thumb: j.shots[j.shots.length - 1] || null,
          model: 'astryx', engine: 'Godot 4.7 · ' + (j.provider === 'anthropic' ? 'Claude' : 'Nexora Local'), hyperreal: j.hyperreal, dim: '3d', genre: j.hyperreal ? 'Godot · hyperrealistiskt' : 'Godot-spel', created: now, updated: now, versions: [] });
        DESK.call('notify', { title: '🤖 Astryx är klar', body: j.title }).catch(() => {});
      } catch (e) {
        const aborted = e.name === 'AbortError' || ctl.signal.aborted;
        j.status = aborted ? 'cancelled' : 'failed'; j.error = e.message; j.phase = aborted ? 'Avbruten' : 'Misslyckades';
        jobLog(j, (aborted ? '⏹ Avbruten' : '❌ ' + e.message), 'err');
        const paid = !!j.charge;
        refund(j);
        if (paid) jobLog(j, '↩️ Kostnaden återbetalades', 'ok');
      } finally {
        j.ended = Date.now(); delete liveCtl[j.id]; jobChanged(j); render.topOnly();
      }
    })();
    j._promise = run;
    return j;
  }

  async function runTraining(n) {
    if (S.settings.provider !== 'anthropic') return toast('Träning kräver Claude (Anthropic-nyckel) – Nexora Local lär sig inte.', 5000);
    const picks = BENCH.slice().sort(() => Math.random() - 0.5).slice(0, n);
    toast('Träningspass startat: ' + n + ' spel à 20 min');
    for (const p of picks) {
      const j = startGodotJob({ prompt: p, minutes: 20, training: true, quiet: true });
      await j._promise;
      if (j.status === 'cancelled') break;
    }
    toast('Träningspasset är klart');
  }

  function godotCard(g, redraw) {
    return h('div', { class: 'card gcard' },
      g.thumb ? h('img', { class: 'thumb', src: 'data:image/jpeg;base64,' + g.thumb, alt: g.title, style: 'object-fit:cover;width:100%;padding:0' }) : h('div', { class: 'thumb', style: 'background:linear-gradient(135deg,#243b55,#141e30)' }, '🎮 ' + g.title),
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, g.title), h('span', { class: 'pill' }, g.hyperreal ? '📸 GODOT' : 'GODOT')),
      h('div', { class: 'small muted' }, g.engine + ' · ' + new Date(g.updated).toLocaleDateString('sv-SE')),
      g.summary ? h('div', { class: 'small' }, g.summary) : null,
      DESK ? h('div', { class: 'row' },
        h('button', { class: 'btn sm primary', onclick: () => DESK.call('godotPlay', { project: g.project }).catch(e => toast(e.message)) }, '▶ Spela'),
        h('button', { class: 'btn sm', onclick: () => godotExportModal(g) }, 'Exportera'),
        h('button', { class: 'btn sm', onclick: () => DESK.call('godotEditor', { project: g.project }).catch(e => toast(e.message)) }, 'Öppna i Godot'),
        h('button', { class: 'btn sm ghost', onclick: () => DESK.call('reveal', { project: g.project }) }, 'Visa mapp'),
        h('button', { class: 'btn sm ghost danger', onclick: async () => { if (confirm('Ta bort "' + g.title + '" från biblioteket? Projektmappen finns kvar på datorn.')) { await games.del(g.id); redraw(); } } }, 'Ta bort'))
        : h('p', { class: 'small muted' }, 'Godot-projekt öppnas i Nexora för dator.'));
  }

  function godotExportModal(g) {
    const out = h('div', { class: 'small muted' });
    const off = DESK.on(ev => { if (ev.type === 'download') out.textContent = '⬇️ ' + ev.what + ' ' + (ev.total ? Math.round(ev.got / ev.total * 100) + ' %' : ''); if (ev.type === 'status') out.textContent = ev.text; });
    const doExport = async (target, label) => {
      try {
        const info = await DESK.call('info');
        if (!info.godot.templates) {
          const ok = await DESK.call('confirm', { title: 'Exportmallar', ok: 'Ladda ner', message: 'Godots exportmallar behövs (engångsnedladdning, ca 1,3 GB).', detail: 'De används för att bygga .exe, macOS-appar, Linux-program och webbversioner av dina Godot-spel.' });
          if (!ok.ok) return;
          out.textContent = 'Laddar ner exportmallar…';
          await DESK.call('installTemplates');
        }
        out.textContent = 'Exporterar ' + label + '…';
        const r = await DESK.call('godotExport', { project: g.project, target });
        if (!r.ok) { out.textContent = '❌ ' + (r.errors || []).join(' · ').slice(0, 400); return; }
        out.textContent = '✅ ' + label + ' klar (' + (r.size / 1e6).toFixed(1) + ' MB): ' + r.files.join(', ');
        DESK.call('reveal', { file: r.path });
      } catch (e) { out.textContent = '❌ ' + e.message; }
    };
    const close = modal([
      h('h2', null, '📦 Exportera ' + g.title),
      h('div', { class: 'col' }, [['windows', '🪟 Windows (.exe)'], ['macos', '🍎 macOS (.app i .zip)'], ['linux', '🐧 Linux'], ['web', '🌐 Webb (HTML5)']].map(([t, l]) =>
        h('button', { class: 'btn', onclick: () => doExport(t, l) }, l))),
      h('button', { class: 'btn', style: 'margin-top:8px', onclick: async () => { const r = await DESK.call('zipProject', { project: g.project, name: slug(g.title) }); out.textContent = '✅ ' + r.files + ' filer i ' + r.path; DESK.call('reveal', { file: r.path }); } }, '🗂️ Godot-projekt (.zip)'),
      out,
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => { off(); close(); } }, 'Stäng'))]);
  }

  VIEWS.astryx = main => {
    const box = h('div', { class: 'col' });
    const status = h('div', { class: 'card col' });
    const lessonsEl = h('div', { class: 'col' });
    async function drawStatus() {
      status.innerHTML = '';
      if (!DESK) {
        status.append(h('h3', null, '💻 Godot-läget körs på datorn'), h('p', { class: 'muted', style: 'margin:0' }, 'I webbläsaren bygger Astryx HTML5-spel. För Godot-spel med Python, långa arbetspass och hyperrealistiskt läge behövs Nexora för dator.'), h('a', { class: 'btn primary', href: '#ladda-ner', style: 'align-self:flex-start' }, 'Ladda ner Nexora'));
        return;
      }
      const i = await DESK.call('info');
      status.append(h('h3', null, '💻 Din dator'), h('table', { class: 't' },
        h('tr', null, h('td', null, 'Python'), h('td', null, i.python ? '✅ ' + i.python.version : '❌ Saknas – installera Python 3 från python.org')),
        h('tr', null, h('td', null, 'Godot ' + i.godot.version), h('td', null, i.godot.path ? '✅ Installerat' : h('button', { class: 'btn sm', onclick: async e => { e.target.disabled = true; e.target.textContent = 'Laddar ner…'; try { await DESK.call('installGodot'); } catch (x) { toast(x.message); } drawStatus(); } }, 'Installera (~80–170 MB)'))),
        h('tr', null, h('td', null, 'Exportmallar'), h('td', null, i.godot.templates ? '✅ Installerade' : h('span', { class: 'muted' }, 'Hämtas vid första export (~1,3 GB)'))),
        h('tr', null, h('td', null, 'AI'), h('td', null, S.settings.provider === 'anthropic' ? '✅ Claude – Astryx planerar, skriver och testar själv' : 'Nexora Local – snabb offlinebyggare. Lägg in en Anthropic-nyckel under ⚙️ för full agent.'))));
    }
    function jobCard(j) {
      const running = j.status === 'running', el = h('div', { class: 'card col jobcard' + (running ? ' running' : '') });
      const elapsed = (j.ended || Date.now()) - j.started, pct = Math.min(100, elapsed / (j.minutes * 60000) * 100);
      add(el, [
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', { style: 'margin:0' }, (j.training ? '🎓 ' : '🤖 ') + j.title),
          h('span', { class: 'pill' }, { running: '⏳ arbetar', done: '✅ klar', failed: '❌ misslyckades', cancelled: '⏹ avbruten', interrupted: '⚠️ avbröts' }[j.status] || j.status)),
        h('div', { class: 'small muted' }, (j.hyperreal ? '📸 Hyperrealistiskt · ' : '') + (j.provider === 'anthropic' ? 'Claude' : 'Nexora Local') + ' · ' + fmtDur(elapsed) + (running && j.provider === 'anthropic' ? ' av max ' + fmtDur(j.minutes * 60000) : '') + ' · ' + (j.runs || 0) + ' testkörningar' + (j.assets ? ' · ' + j.assets.length + ' assets' : '')),
        running ? h('div', { class: 'meter' }, h('i', { style: 'width:' + (j.provider === 'anthropic' ? pct : 50) + '%' })) : null,
        running ? h('div', { class: 'small', style: 'font-weight:700' }, j.phase || '') : null,
        j.shots && j.shots.length ? h('div', { class: 'shots' }, j.shots.map(b => h('img', { src: 'data:image/jpeg;base64,' + b, alt: 'Skärmbild från testkörning' }))) : null,
        j.summary ? h('p', { class: 'note small', style: 'margin:0' }, '🤖 ' + j.summary) : null,
        j.error ? h('p', { class: 'small', style: 'color:#ff8aa8;margin:0' }, j.error) : null]);
      const log = h('div', { class: 'log', style: 'max-height:' + (running ? 260 : 140) + 'px;width:100%' });
      j.log.slice(-80).forEach(l => log.append(h('div', { class: l.kind === 'think' ? 'think' : l.kind === 'err' ? 'err' : l.kind === 'ok' ? 'okline' : '' }, l.text.length > 600 ? l.text.slice(0, 600) + '…' : l.text)));
      el.append(h('details', running ? { open: true } : null, h('summary', { class: 'small muted' }, 'Arbetslogg (' + j.log.length + ' rader)'), log));
      setTimeout(() => { log.scrollTop = log.scrollHeight; }, 0);
      const row = h('div', { class: 'row' });
      if (running) row.append(h('button', { class: 'btn sm danger', onclick: () => { if (confirm('Avbryt Astryx? Kostnaden återbetalas.')) liveCtl[j.id] && liveCtl[j.id].abort(); } }, '⏹ Avbryt'));
      if (j.status === 'done' && DESK) row.append(
        h('button', { class: 'btn sm primary', onclick: () => DESK.call('godotPlay', { project: j.project }).catch(e => toast(e.message)) }, '▶ Spela'),
        h('button', { class: 'btn sm', onclick: () => godotExportModal({ project: j.project, title: j.title }) }, '📦 Exportera'),
        h('button', { class: 'btn sm', onclick: () => DESK.call('godotEditor', { project: j.project }).catch(e => toast(e.message)) }, 'Öppna i Godot'),
        h('button', { class: 'btn sm ghost', onclick: () => DESK.call('reveal', { project: j.project }) }, 'Visa mapp'));
      if (!running) row.append(h('button', { class: 'btn sm ghost', onclick: () => { JOBS.splice(JOBS.indexOf(j), 1); saveJobs(); draw(); } }, 'Dölj'));
      el.append(row);
      return el;
    }
    let pending = false;
    function draw() {
      box.innerHTML = '';
      if (!JOBS.length) box.append(h('div', { class: 'card' }, h('h3', null, 'Inga körningar än'), h('p', { class: 'muted' }, 'Välj Astryx 5 Pro i Studio, ställ motorn på Godot och tryck Skapa spel.'), h('a', { class: 'btn primary', href: '#studio' }, 'Till Studio')));
      JOBS.forEach(j => box.append(jobCard(j)));
    }
    const onJob = () => { if (pending) return; pending = true; setTimeout(() => { pending = false; draw(); }, 400); };
    jobListeners.add(onJob);
    const tick = setInterval(() => { if (JOBS.some(j => j.status === 'running')) onJob(); }, 1000);
    async function drawLessons() {
      const ls = await getLessons();
      lessonsEl.innerHTML = '';
      add(lessonsEl, [h('p', { class: 'muted', style: 'margin:0' }, 'Astryx sparar en lärdom varje gång den hittar en fallgrop i Godot, och läser alla lärdomar innan nästa spel. Ju mer den används – och tränas – desto färre misstag gör den.'),
        h('div', { class: 'row' }, h('b', null, ls.length + ' lärdomar'),
          [3, 5, 8].map(n => h('button', { class: 'btn sm', onclick: () => runTraining(n) }, '🎓 Träna ' + n + ' spel'))),
        ls.length ? h('details', null, h('summary', { class: 'small muted' }, 'Visa lärdomar'), h('ul', { class: 'small' }, ls.slice().reverse().slice(0, 60).map(l => h('li', null, l.text)))) : null,
        h('p', { class: 'small muted', style: 'margin:0' }, 'Ett träningspass bygger spel från en varierad testsvit (plattform, racing, pussel, tower defense …) med 20 minuter per spel. Det kostar API-avgifter hos Anthropic men inga krediter.')]);
    }
    main.append(h('section', { class: 'wrap col' },
      h('h1', null, '🤖 Astryx ', h('span', { class: 'grad' }, '5 Pro')),
      h('p', { class: 'muted', style: 'margin:0' }, 'AI-agenten som bygger riktiga Godot-spel med Python – i upp till två timmar per spel, med testkörningar, skärmbilder och rättningar. Hyperrealistiskt läge (🪙 ' + COST.hyper + ') bygger världen av fotoskannade modeller.'),
      h('div', { class: 'grid g2' }, status, h('div', { class: 'card col' }, h('h3', null, '🎓 Träning'), lessonsEl)),
      h('h2', { style: 'margin-top:12px' }, 'Körningar'), box));
    drawStatus(); drawLessons(); draw();
    return { unmount() { jobListeners.delete(onJob); clearInterval(tick); } };
  };

  VIEWS.spel = main => {
    const grid = h('div', { class: 'grid g3' }, h('p', { class: 'muted' }, 'Laddar…'));
    const fileIn = h('input', { type: 'file', accept: '.json,.nexora.json', style: 'display:none' });
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0]; if (!f) return;
      try {
        const g = JSON.parse(await f.text());
        if (!g.html || !g.title) throw new Error('Inte ett Nexora-projekt');
        g.id = 'g' + Date.now().toString(36); g.updated = Date.now(); g.created = g.created || Date.now(); delete g.nexora;
        await games.put(g); toast('Importerade ' + g.title); draw();
      } catch (e) { toast('Kunde inte importera: ' + e.message); }
    });
    async function draw() {
      const all = await games.all().catch(() => []);
      grid.innerHTML = '';
      if (!all.length) { grid.append(h('div', { class: 'card' }, h('h3', null, 'Inga spel än'), h('p', { class: 'muted' }, 'Spel du skapar i Studio sparas här på enheten.'), h('a', { class: 'btn primary', href: '#studio' }, 'Skapa ditt första spel'))); return; }
      all.forEach(g => {
        if (g.type === 'godot') { grid.append(godotCard(g, draw)); return; }
        const pal = (g.html.match(/"palette":\{"bg1":"(#[0-9a-f]{6})","bg2":"(#[0-9a-f]{6})"/i) || [0, '#4b2a8a', '#1b1740']);
        grid.append(h('div', { class: 'card gcard' },
          h('div', { class: 'thumb', style: 'background:linear-gradient(135deg,' + pal[1] + ',' + pal[2] + ')' }, g.title),
          h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, g.title), h('span', { class: 'pill' }, (g.dim || '2d').toUpperCase())),
          h('div', { class: 'small muted' }, g.genre + ' · ' + (AI.MODELS[g.model] ? AI.MODELS[g.model].short : '') + ' · ' + new Date(g.updated).toLocaleDateString('sv-SE')),
          h('div', { class: 'row' },
            h('button', { class: 'btn sm primary', onclick: () => { current = g; location.hash = 'studio'; } }, '▶ Spela'),
            h('button', { class: 'btn sm', onclick: () => exportModal(g) }, 'Exportera'),
            h('button', { class: 'btn sm', onclick: () => { if (need('versions')) versionsModal(g, draw); } }, 'Versioner', can('versions') ? '' : ' 🔒'),
            h('button', { class: 'btn sm ghost danger', onclick: async () => { if (confirm('Ta bort "' + g.title + '"?')) { await games.del(g.id); if (current && current.id === g.id) current = null; draw(); } } }, 'Ta bort'))));
      });
    }
    const p = plan();
    main.append(h('section', { class: 'wrap' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('h1', null, 'Mina spel'),
        h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'Lagring: ' + (p.storage === Infinity ? 'obegränsad' : 'max ' + p.storage + ' spel')),
          h('button', { class: 'btn', onclick: () => { if (need('shared')) fileIn.click(); } }, '📥 Importera projekt', can('shared') ? '' : ' 🔒'), fileIn,
          h('button', { class: 'btn', title: 'Dina spel som träningsdata för Colab-anteckningsboken', onclick: async () => {
            if (!need('customModel')) return;
            const all = await games.all().catch(() => []);
            if (!all.length) return toast('Skapa några spel först.');
            const rows = all.map(g => JSON.stringify({ messages: [
              { role: 'system', content: AI.GAME_SYSTEM },
              { role: 'user', content: AI.gamePrompt(g.prompt, { dim: g.dim, features: [] }) },
              { role: 'assistant', content: '```html\n' + g.html + '\n```' }] }));
            download('nexora-traningsdata.jsonl', rows.join('\n') + '\n', 'application/jsonl');
            toast(all.length + ' spel exporterade som träningsdata');
          } }, '🧠 Träningsdata', can('customModel') ? '' : ' 🔒'))),
      grid));
    draw();
  };

  // ---------------------------------------------------------------- tools
  function toolCard(icon, title, feat, body) {
    const locked = feat && !can(feat);
    return h('div', { class: 'card tool col' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', null, icon + ' ' + title), locked ? h('span', { class: 'lock' }, lockLabel(feat)) : null),
      body);
  }
  function runBtn(label, feat, fn) {
    const b = h('button', { class: 'btn primary sm' }, label);
    b.addEventListener('click', async () => {
      if (feat && !need(feat)) return;
      const old = b.textContent; b.disabled = true; b.textContent = 'Genererar…';
      try { await fn(); } catch (e) { toast(e.message || String(e), 5000); } finally { b.disabled = false; b.textContent = old; }
    });
    return b;
  }
  const useAI = () => S.settings.provider !== 'local';

  VIEWS.verktyg = main => {
    const idea = h('input', { type: 'text', placeholder: 'Spelets idé, t.ex. "ett vikingaäventyr i en frusen skog"' });
    idea.value = S.studio.prompt || '';
    const txt = (task, feat, localFn) => {
      const out = h('div', { class: 'out muted' }, 'Resultatet visas här.');
      return [out, h('div', { class: 'row' }, runBtn('Generera', feat, async () => {
        const p = idea.value.trim() || 'ett äventyrsspel';
        out.classList.remove('muted');
        if (useAI()) { out.textContent = ''; await AI.text(S.settings, 'flash', task, p, { text: (d, all) => { out.textContent = all; } }); }
        else out.textContent = localFn(p);
      }), h('button', { class: 'btn sm ghost', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(out.textContent); toast('Kopierat'); } }, 'Kopiera'))];
    };
    // image
    const art = h('div', { class: 'art' }, h('span', { class: 'muted' }, 'Ingen bild än'));
    const imgIn = h('input', { type: 'text', placeholder: 'T.ex. "en söt drake i pixelstil"' });
    let lastArt = null;
    const imageBody = [imgIn, art, h('div', { class: 'row' },
      runBtn('Generera', 'gfx', async () => {
        const p = imgIn.value.trim() || idea.value.trim() || 'en hjälte';
        const r = useAI() ? await AI.image(S.settings, p) : { svg: L.sprite(p + ' ' + Math.random()) };
        lastArt = Object.assign({ name: p.slice(0, 40) }, r);
        art.innerHTML = '';
        if (r.svg) art.innerHTML = r.svg; else art.append(h('img', { src: r.url, alt: p }));
      }),
      h('button', { class: 'btn sm', onclick: () => { if (!lastArt) return toast('Generera en bild först'); if (!need('assets')) return; assets.put({ id: 'a' + Date.now().toString(36), name: lastArt.name, svg: lastArt.svg || null, url: lastArt.url || null, t: Date.now() }).then(() => { toast('Sparad i Mina assets'); drawAssets(); }); } }, 'Spara som asset'),
      h('button', { class: 'btn sm ghost', onclick: () => { if (!lastArt) return; if (lastArt.svg) download(slug(lastArt.name) + '.svg', lastArt.svg, 'image/svg+xml'); else window.open(lastArt.url, '_blank'); } }, 'Ladda ner'))];
    // 3d
    const cv = h('canvas', { class: 'viewer', width: 600, height: 260 });
    const meshIn = h('input', { type: 'text', placeholder: 'T.ex. "ett torn", "ett träd", "ett rymdskepp"' });
    let curMesh = L.mesh('kristall'), rot = 0, raf = 0;
    const g3 = Nx3D(cv.getContext('2d'));
    function spin() {
      const c = cv.getContext('2d'), w = cv.clientWidth || 600, hh = cv.clientHeight || 260, d = Math.min(devicePixelRatio || 1, 2);
      if (cv.width !== w * d) { cv.width = w * d; cv.height = hh * d; }
      c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#0b0b20'; c.fillRect(0, 0, w, hh);
      const vs = curMesh.vertices, ys = vs.map(v => v[1]), top = Math.max.apply(null, ys.concat([1])), span = Math.max(1, top - Math.min.apply(null, ys));
      rot += 0.012; g3.cam.yaw = rot; g3.cam.pitch = 0.35;
      const dist = span * 1.8 + 1.4; g3.cam.x = -Math.sin(rot) * dist; g3.cam.z = -Math.cos(rot) * dist; g3.cam.y = top * 0.5 + dist * 0.36; g3.cam.far = 200; g3.cam.fov = 1.1;
      g3.begin(w, hh);
      for (let i = -3; i < 3; i++) for (let j = -3; j < 3; j++) g3.poly([[i, 0, j], [i + 1, 0, j], [i + 1, 0, j + 1], [i, 0, j + 1]], (i + j) % 2 ? '#1c1c3a' : '#24244a', [0, 1, 0]);
      g3.mesh(curMesh, 0, 0.001, 0, 1, 0);
      g3.flush();
      raf = requestAnimationFrame(spin);
    }
    raf = requestAnimationFrame(spin);
    const meshInfo = h('div', { class: 'small muted' }, curMesh.name + ' · ' + curMesh.faces.length + ' ytor');
    const meshBody = [meshIn, cv, meshInfo, h('div', { class: 'row' },
      runBtn('Generera', 'mesh', async () => {
        const p = meshIn.value.trim() || 'en kristall';
        curMesh = useAI() ? await AI.mesh(S.settings, p) : L.mesh(p);
        meshInfo.textContent = (curMesh.name || p) + ' · ' + curMesh.faces.length + ' ytor · ' + curMesh.vertices.length + ' hörn';
      }),
      h('button', { class: 'btn sm', onclick: () => download(slug(curMesh.name) + '.obj', L.toObj(curMesh)) }, '.obj'),
      h('button', { class: 'btn sm ghost', onclick: () => download(slug(curMesh.name) + '.json', JSON.stringify(curMesh)) }, '.json'))];
    // music
    const musIn = h('input', { type: 'text', placeholder: 'Stämning, t.ex. "snabb boss-musik", "lugn skogsmeny"' });
    const player = h('div');
    const musicBody = [musIn, player, h('div', { class: 'row' }, runBtn('Komponera', 'music', async () => {
      const r = await L.music((musIn.value.trim() || idea.value.trim() || 'äventyr') + ' ' + Date.now(), 24);
      const url = URL.createObjectURL(r.blob);
      player.innerHTML = '';
      player.append(h('div', { class: 'small muted' }, r.bpm + ' BPM · ' + r.mood + ' · ' + r.seconds + ' s loop'), h('audio', { controls: true, src: url, style: 'width:100%', loop: true }),
        h('button', { class: 'btn sm', onclick: () => download('nexora-musik.wav', r.blob) }, 'Ladda ner WAV'));
      $('audio', player).play().catch(() => {});
    }))];
    // sfx
    const sfxBody = [h('p', { class: 'small muted' }, 'Klicka för att generera och spela. Varje klick ger en ny variant.'), h('div', { class: 'row' },
      ['hopp', 'mynt', 'laser', 'explosion', 'powerup', 'träff'].map(k => runBtn(k, 'sfx', async () => {
        const blob = await L.sfx(k, Date.now()), url = URL.createObjectURL(blob), a = new Audio(url); a.play().catch(() => {});
        sfxLast = { k, blob };
      }))), h('button', { class: 'btn sm ghost', onclick: () => sfxLast ? download('nexora-' + sfxLast.k + '.wav', sfxLast.blob) : toast('Generera ett ljud först') }, 'Ladda ner senaste')];
    let sfxLast = null;
    // voice
    const vText = h('textarea', { style: 'min-height:70px' }); vText.value = 'Välkommen, äventyrare. Kungariket behöver din hjälp.';
    const vSel = h('select');
    const fillVoices = () => {
      const vs = (window.speechSynthesis ? speechSynthesis.getVoices() : []);
      vSel.innerHTML = '';
      const sorted = vs.slice().sort((a, b) => (b.lang.startsWith('sv') ? 1 : 0) - (a.lang.startsWith('sv') ? 1 : 0));
      sorted.forEach((v, i) => vSel.append(h('option', { value: i }, v.name + ' (' + v.lang + ')')));
      vSel._voices = sorted;
      if (!vs.length) vSel.append(h('option', null, 'Inga röster hittades i systemet'));
    };
    if (window.speechSynthesis) { fillVoices(); speechSynthesis.onvoiceschanged = fillVoices; }
    const pitch = h('input', { type: 'range', min: 0.5, max: 2, step: 0.1, value: 1 }), rate = h('input', { type: 'range', min: 0.5, max: 1.6, step: 0.1, value: 1 });
    const voiceBody = [vText, vSel, h('label', { class: 'row small' }, h('span', { style: 'width:70px' }, 'Tonhöjd'), pitch), h('label', { class: 'row small' }, h('span', { style: 'width:70px' }, 'Tempo'), rate), h('div', { class: 'row' }, runBtn('Läs upp', 'voice', async () => {
      if (!window.speechSynthesis) throw new Error('Den här webbläsaren saknar talsyntes.');
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(vText.value); const v = vSel._voices && vSel._voices[+vSel.value];
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'sv-SE';
      u.pitch = +pitch.value; u.rate = +rate.value; speechSynthesis.speak(u);
    })), h('p', { class: 'small muted' }, 'Rösten spelas upp med operativsystemets talsyntes.')];
    // assets
    const assetGrid = h('div', { class: 'row' });
    async function drawAssets() {
      const list = await assets.all().catch(() => []);
      assetGrid.innerHTML = '';
      if (!list.length) assetGrid.append(h('span', { class: 'muted small' }, 'Inga assets än. Spara bilder från Image 1 eller ladda upp egna.'));
      list.forEach(a => {
        const t = h('div', { class: 'art', style: 'width:92px;height:92px;min-height:0;position:relative', title: a.name });
        if (a.svg) t.innerHTML = a.svg; else t.append(h('img', { src: a.url, alt: a.name }));
        const svg = $('svg', t); if (svg) { svg.setAttribute('width', 80); svg.setAttribute('height', 80); }
        t.append(h('button', { class: 'btn sm ghost', style: 'position:absolute;top:0;right:0;padding:2px 6px', title: 'Ta bort', onclick: () => assets.del(a.id).then(drawAssets) }, '×'));
        assetGrid.append(t);
      });
    }
    const up = h('input', { type: 'file', accept: 'image/svg+xml,image/png,image/jpeg,image/webp', multiple: true, style: 'display:none' });
    up.addEventListener('change', async () => {
      for (const f of up.files) {
        if (f.size > 2e6) { toast(f.name + ' är större än 2 MB'); continue; }
        const isSvg = f.type === 'image/svg+xml';
        const data = isSvg ? await f.text() : await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
        await assets.put({ id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: f.name, svg: isSvg ? data : null, url: isSvg ? null : data, t: Date.now() });
      }
      drawAssets(); toast('Uppladdat');
    });

    main.append(h('section', { class: 'wrap' },
      h('h1', null, 'AI-', h('span', { class: 'grad' }, 'verktyg')),
      h('p', { class: 'muted' }, 'Leverantör: ', providerLabel(), useAI() ? ' – text, bilder och 3D skapas av AI.' : ' – allt genereras på enheten, även offline.'),
      h('label', { class: 'f', style: 'margin:18px 0' }, 'Spelets idé (används av text-verktygen)', idea),
      h('div', { class: 'grid g2' },
        toolCard('📖', 'Story', 'story', txt('story', 'story', L.story)),
        toolCard('💬', 'Dialog', 'dialog', txt('dialog', 'dialog', L.dialog)),
        toolCard('🧑‍🌾', 'NPC:er', 'npc', txt('npc', 'npc', p => L.npcs(p, 4).map(n => '• ' + n.name + ', ' + n.role + ' – ' + n.trait + ', ' + n.want + '.\n  ' + n.line).join('\n\n'))),
        toolCard('🗺️', 'Uppdrag', 'quest', txt('quest', 'quest', p => L.quests(p, 3).map(q => '■ ' + q.title + '\n  Givare: ' + q.giver + '\n  Mål: ' + q.goal + '\n  Steg: ' + q.steps.join(' → ') + '\n  Belöning: ' + q.reward).join('\n\n'))),
        toolCard('🎨', 'Grafik – Nexora Image 1', 'gfx', imageBody),
        toolCard('🧊', '3D – Nexora 3D 1', 'mesh', meshBody),
        toolCard('🎵', 'Musik', 'music', musicBody),
        toolCard('🔊', 'Ljudeffekter', 'sfx', sfxBody),
        toolCard('🗣️', 'Röst', 'voice', voiceBody),
        toolCard('🗃️', 'Mina assets', 'assets', [assetGrid, h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { if (need('assets')) up.click(); } }, 'Ladda upp bilder'), up),
          h('p', { class: 'small muted' }, 'SVG-assets skickas med till AI:n när du kryssar i "Mina assets" i Studio.')]))));
    drawAssets();
    return { unmount() { cancelAnimationFrame(raf); if (window.speechSynthesis) speechSynthesis.cancel(); } };
  };

  // ---------------------------------------------------------------- team
  VIEWS.team = main => {
    if (!can('team')) {
      main.append(h('section', { class: 'wrap' }, h('h1', null, 'Team'), h('div', { class: 'card col' },
        h('p', null, 'Teamarbete, delade projekt och versionshantering ingår i ', h('b', null, '🏢 Studio'), ' och ', h('b', null, '👑 Enterprise'), '.'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => checkout(PLANS[3]) }, 'Välj Studio – 999 kr/mån')))));
      return;
    }
    const maxMembers = tier() >= 4 ? Infinity : 10;
    const nameIn = h('input', { type: 'text', placeholder: 'Namn eller e-post' }), roleSel = h('select', null, ['Utvecklare', 'Grafiker', 'Ljud', 'Designer', 'Admin'].map(r => h('option', null, r)));
    const list = h('div', { class: 'col' });
    function draw() {
      list.innerHTML = '';
      if (!S.team.length) list.append(h('p', { class: 'muted small' }, 'Inga medlemmar än.'));
      S.team.forEach((m, i) => list.append(h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', null, '👤 ' + m.name + ' · ', h('span', { class: 'muted' }, m.role)), h('button', { class: 'btn sm ghost danger', onclick: () => { S.team.splice(i, 1); store.set('team', S.team); draw(); } }, 'Ta bort'))));
    }
    draw();
    const cloud = [['Privat molnlagring', 'Kräver Nexora Cloud'], ['Dedicated servrar', 'Kräver Nexora Cloud'], ['API-åtkomst', 'Kräver Nexora Cloud'], ['Realtidssynk i teamet', 'Kräver Nexora Cloud'], ['Delade projekt', 'Fungerar via projektfiler (.nexora.json)'], ['Versionshantering', 'Fungerar – upp till 30 versioner per spel']];
    if (tier() >= 4) cloud.push(['White Label', 'Byt namn/logga i byggkonfigurationen (nexora/build/build.py)'], ['Egen AI-modell', 'Träna i Colab och koppla in som Egen endpoint']);
    main.append(h('section', { class: 'wrap' }, h('h1', null, 'Team'),
      h('div', { class: 'grid g2' },
        h('div', { class: 'card col' }, h('h3', null, 'Medlemmar ' + (maxMembers === Infinity ? '(obegränsat)' : '(max ' + maxMembers + ')')), list,
          h('div', { class: 'row' }, nameIn, roleSel, h('button', { class: 'btn primary sm', onclick: () => {
            const n = nameIn.value.trim(); if (!n) return;
            if (S.team.length >= maxMembers) return upsell(null, 'Obegränsade teammedlemmar ingår i Enterprise.', 4);
            S.team.push({ name: n, role: roleSel.value }); store.set('team', S.team); nameIn.value = ''; draw();
          } }, 'Bjud in'))),
        h('div', { class: 'card col' }, h('h3', null, 'Status'), h('table', { class: 't' }, cloud.map(([a, b]) => h('tr', null, h('td', null, a), h('td', { class: /Kräver/.test(b) ? 'muted' : '' }, b)))),
          h('p', { class: 'note' }, 'Molnfunktionerna behöver en backend som inte är driftsatt i den här versionen. Teamlistan sparas lokalt; dela projekt genom att exportera "Nexora-projekt" och importera under Mina spel.')))));
  };

  // ---------------------------------------------------------------- downloads
  VIEWS['ladda-ner'] = main => {
    const base = REPO + '/raw/main/nexora/dist/';
    const dl = BUILD.downloads || [];
    const byId = id => dl.find(d => d.id === id);
    const card = (icon, title, sub, id, how) => {
      const d = byId(id);
      return h('div', { class: 'card col' }, h('div', { style: 'font-size:2rem' }, icon), h('h3', null, title), h('p', { class: 'muted small' }, sub),
        d ? h('a', { class: 'btn primary', href: base + d.file, download: d.file }, '⬇️ ' + d.file)
          : id === 'html' ? h('a', { class: 'btn primary', href: base + 'nexora-' + VERSION + '.html', download: 'nexora-' + VERSION + '.html' }, '⬇️ nexora-' + VERSION + '.html')
          : h('span', { class: 'muted small' }, 'Bygget finns inte i den här versionen.'),
        d && d.size ? h('div', { class: 'small muted' }, (d.size / 1e6).toFixed(1) + ' MB · SHA-256 ' + d.sha256.slice(0, 16) + '…') : null,
        h('div', { class: 'small' }, how));
    };
    main.append(h('section', { class: 'wrap' },
      h('h1', null, 'Ladda ner ', h('span', { class: 'grad' }, 'Nexora')),
      h('p', { class: 'muted' }, 'Version ' + VERSION + '. Samma app överallt – den fungerar offline och sparar dina spel på datorn.'),
      h('div', { class: 'grid g2' },
        card('🪟', 'Windows', 'Windows 10/11, 64-bit. Installerar Nexora för din användare (inga administratörsrättigheter behövs) med genväg på skrivbordet och i Start-menyn.', 'exe', h('span', null, 'Om SmartScreen varnar: ', h('b', null, 'Mer info → Kör ändå'), ' (appen är inte kodsignerad).')),
        card('🍎', 'macOS', 'macOS 12+ på Apple Silicon (M1–M4). Öppna DMG-filen och dra Nexora till Program.', 'dmg', h('span', null, 'Första gången: högerklicka på Nexora → ', h('b', null, 'Öppna'), ' (appen är inte notariserad).')),
        card('🐧', 'Linux', 'Debian, Ubuntu, Mint, Pop!_OS (x86-64).', 'deb', h('code', null, 'sudo apt install ./' + ((byId('deb') || {}).file || 'nexora.deb'))),
        card('🌐', 'Webb', 'Kör direkt i webbläsaren utan installation – det är den här sidan.', 'html', h('span', null, 'Kan även sparas som en fil och öppnas offline.')))));
  };

  // ---------------------------------------------------------------- settings
  function settingsModal() {
    const s = JSON.parse(JSON.stringify(S.settings));
    const prov = h('select', null, [['local', 'Nexora Local – offline, gratis'], ['anthropic', 'Anthropic (Claude) – egen API-nyckel'], ['openai', 'Egen endpoint (OpenAI-kompatibel) – t.ex. din Colab-modell']].map(([v, l]) => h('option', { value: v, selected: s.provider === v }, l)));
    const aKey = h('input', { type: 'password', placeholder: 'sk-ant-…', value: s.anthropicKey, autocomplete: 'off' });
    const oBase = h('input', { type: 'url', value: s.openaiBase }), oKey = h('input', { type: 'password', value: s.openaiKey, placeholder: 'valfri', autocomplete: 'off' });
    const oModels = Object.keys(AI.MODELS).map(k => { const i = h('input', { type: 'text', value: s.openaiModels[k] }); i.dataset.k = k; return i; });
    const oImg = h('input', { type: 'checkbox', checked: s.openaiImageApi });
    const aBox = h('div', { class: 'col' }, h('label', { class: 'f' }, 'Anthropic API-nyckel', aKey),
      h('p', { class: 'small muted' }, 'Skapa en nyckel på console.anthropic.com. Nyckeln sparas bara på den här enheten och skickas endast till api.anthropic.com.'));
    const oBox = h('div', { class: 'col' }, h('label', { class: 'f' }, 'Bas-URL', oBase), h('label', { class: 'f' }, 'API-nyckel', oKey),
      h('div', { class: 'grid', style: 'grid-template-columns:1fr 1fr;gap:8px' }, oModels.map(i => h('label', { class: 'f small' }, AI.MODELS[i.dataset.k].name, i))),
      h('label', { class: 'opt' }, oImg, 'Image 1 använder /images/generations'),
      h('p', { class: 'small muted' }, 'Fungerar med OpenAI, vLLM, Ollama (http://localhost:11434/v1), LM Studio och modellen från Colab-anteckningsboken.'));
    const sync = () => { aBox.style.display = prov.value === 'anthropic' ? '' : 'none'; oBox.style.display = prov.value === 'openai' ? '' : 'none'; };
    prov.addEventListener('change', sync); sync();
    const close = modal([
      h('h2', null, '⚙️ Inställningar'),
      h('label', { class: 'f' }, 'AI-leverantör', prov), aBox, oBox,
      h('div', { class: 'row', style: 'margin-top:14px' },
        h('button', { class: 'btn primary', onclick: () => {
          s.provider = prov.value; s.anthropicKey = aKey.value.trim(); s.openaiBase = oBase.value.trim() || AI.DEFAULT_SETTINGS.openaiBase; s.openaiKey = oKey.value.trim(); s.openaiImageApi = oImg.checked;
          oModels.forEach(i => { s.openaiModels[i.dataset.k] = i.value.trim() || AI.DEFAULT_SETTINGS.openaiModels[i.dataset.k]; });
          if (s.provider === 'anthropic' && !s.anthropicKey) { toast('Fyll i API-nyckeln'); return; }
          S.settings = s; store.set('settings', s); close(); toast('Sparat'); render();
        } }, 'Spara'),
        h('button', { class: 'btn ghost', onclick: () => close() }, 'Avbryt'),
        h('button', { class: 'btn ghost danger', style: 'margin-left:auto', onclick: async () => {
          if (!confirm('Radera alla spel, assets och inställningar på den här enheten?')) return;
          try { localStorage.clear(); } catch (e) { /* ignore */ }
          try { (await db()).close(); indexedDB.deleteDatabase('nexora'); } catch (e) { /* ignore */ }
          location.reload();
        } }, 'Radera all data'))]);
  }

  render();
  window.Nexora = { S, PLANS, can, games, render, RT, testGame, released, COST, JOBS, startGodotJob, getLessons };
})();
