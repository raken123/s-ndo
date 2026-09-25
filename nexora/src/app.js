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
    ['hem', 'Hem'], ['studio', 'Studio'], ['verktyg', 'Verktyg'], ['spel', 'Mina spel'], ['team', 'Team'],
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
        h('div', { class: 'pill', style: 'margin-bottom:18px' }, '✨ Nytt: Nexora Core 1 tänker innan den bygger'),
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
      h('section', { class: 'wrap' }, h('h2', null, 'Fem modeller'), modelCards()),
      h('section', { class: 'wrap' }, h('h2', null, 'Priser'), planCards()));
  };

  function modelCards() {
    return h('div', { class: 'grid g5' }, Object.entries(AI.MODELS).map(([k, m]) =>
      h('div', { class: 'card' },
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', null, m.name), tier() < m.minTier ? h('span', { class: 'lock' }, '🔒 ' + PLANS[m.minTier].name) : null),
        h('div', { class: 'pill', style: 'margin-bottom:8px' }, m.tag),
        h('p', { class: 'muted small' }, m.desc))));
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
      h('p', { class: 'note', style: 'margin-top:20px' }, 'Den här versionen körs i demoläge: planer aktiveras lokalt utan betalning. Funktioner som kräver en server (molnlagring, teamsynk, dedikerade servrar, API) visas i planerna men är inte driftsatta än.')));
  };

  VIEWS.modeller = main => {
    const rows = Object.entries(AI.MODELS).map(([k, m]) => h('tr', null,
      h('td', null, h('b', null, m.name), h('div', { class: 'small muted' }, m.tag)),
      h('td', null, k === 'image' ? 'Procedurella pixel-sprites' : k === 'd3' ? 'Procedurella low-poly-modeller' : 'Mallbaserad spelgenerator (9 speltyper)'),
      h('td', null, h('code', null, AI.ANTHROPIC[k].model), AI.ANTHROPIC[k].thinking ? h('div', { class: 'small muted' }, 'adaptivt tänkande, synligt') : AI.ANTHROPIC[k].output_config ? h('div', { class: 'small muted' }, 'effort: ' + AI.ANTHROPIC[k].output_config.effort) : null,
        k === 'image' ? h('div', { class: 'small muted' }, 'ritar SVG') : k === 'd3' ? h('div', { class: 'small muted' }, 'skriver mesh-JSON') : null),
      h('td', null, h('code', null, S.settings.openaiModels[k]))));
    main.append(h('section', { class: 'wrap' },
      h('h1', null, 'Nexora-', h('span', { class: 'grad' }, 'modellerna')),
      modelCards(),
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
    }
    drawModels();

    const dimSeg = h('div', { class: 'seg' });
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
    const stage = h('div', { class: 'stage' }, bar, screen);

    function toolbar() {
      bar.innerHTML = ''; titleEl.textContent = current ? current.title : 'Förhandsvisning'; bar.append(titleEl);
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
      if (used() >= p.games) return upsell(null, 'Du har skapat ' + used() + ' av ' + p.games + ' spel den här månaden. Uppgradera för fler.', tier() + 1);
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
        let html, meta;
        if (S.settings.provider === 'local') {
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
        S.usage[month()] = used() + 1; store.set('usage', S.usage);
        const now = Date.now();
        current = { id: 'g' + now.toString(36), title: meta.title, prompt, html, model: st.model, engine: meta.engine, provider: S.settings.provider, dim: meta.dim, genre: meta.genre, created: now, updated: now, versions: [] };
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

    const variantBtn = h('button', { class: 'btn sm ghost', title: 'Samma idé, ny variant', onclick: () => { st.variant = String(Math.random()).slice(2, 8); saveStudio(); go(); } }, '🎲 Ny variant');
    main.append(h('div', { class: 'wrap studio' },
      h('div', { class: 'panel' },
        h('div', null, h('h2', { style: 'margin-bottom:4px' }, 'Studio'), h('div', { class: 'small muted' }, 'Leverantör: ', providerLabel(), ' · ', h('a', { href: '#', onclick: e => { e.preventDefault(); settingsModal(); } }, 'ändra'))),
        ta,
        h('div', { class: 'chips' }, EXAMPLES.map(x => h('span', { class: 'chip', onclick: () => { ta.value = x; st.prompt = x; saveStudio(); } }, x))),
        h('div', { class: 'col' }, h('b', { class: 'small' }, 'Modell'), modelsEl),
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

  // Runs the game hidden for a few seconds and collects runtime errors.
  function collectErrors(html, ms) {
    return new Promise(res => {
      const errs = [], tag = 'nx' + Math.random().toString(36).slice(2);
      const probe = '<script>(function(){function s(m){parent.postMessage({' + tag + ':String(m).slice(0,400)},"*")}' +
        'addEventListener("error",function(e){s((e.message||"Fel")+" (rad "+e.lineno+")")});' +
        'addEventListener("unhandledrejection",function(e){s("Promise: "+(e.reason&&e.reason.message||e.reason))});' +
        'var ce=console.error;console.error=function(){s("console.error: "+[].join.call(arguments," "));ce.apply(console,arguments)};' +
        'setTimeout(function(){try{["keydown","keyup"].forEach(function(t){dispatchEvent(new KeyboardEvent(t,{code:"Space",key:" "}))})}catch(e){s(e)}},600);})();</' + 'script>';
      const withProbe = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + probe) : probe + html;
      const f = h('iframe', { sandbox: 'allow-scripts', style: 'position:fixed;left:-9999px;width:800px;height:600px', srcdoc: withProbe });
      const on = e => { if (e.data && e.data[tag] && errs.length < 20) errs.push(e.data[tag]); };
      addEventListener('message', on); document.body.appendChild(f);
      setTimeout(() => { removeEventListener('message', on); f.remove(); res(errs); }, ms || 3500);
    });
  }
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
  window.Nexora = { S, PLANS, can, games, render, RT };
})();
