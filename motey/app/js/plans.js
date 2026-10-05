/* Motey prenumerationer – Lite, Plus, Pro.
 * Usage is counted in "Plus units": a Plus month is 100 units = 100 %.
 * Lite gets a quarter of that (25 units), so 25 % in Plus is 100 % in Lite.
 * With Motey-servern the server counts and enforces; without it the count
 * lives on this device (fine for testing, not for selling). */
(function () {
  'use strict';
  const PLANS = {
    lite: { id: 'lite', name: 'Motey Lite', price: 0, quota: 25, live: false, replace: false,
      blurb: 'Gratis. Gräns på allting – varje liten sak räknas, även spel och TikTok. Ingen AI-Live.' },
    plus: { id: 'plus', name: 'Motey Plus', price: 12, quota: 100, live: true, replace: false,
      blurb: 'Mer användning och AI-Live. AI-Live tar 5 % per minut – passar dig som har online-möten ungefär 4 gånger i månaden.' },
    pro: { id: 'pro', name: 'Motey Pro', price: 310, quota: 2000, live: true, replace: true,
      blurb: 'Mycket mer användning och Live Replace: en 3D-version av dig pratar i mötet medan du är på stranden.' }
  };
  // cost of each thing, in Plus units (Plus month = 100)
  const COST = {
    summary: 1, catchup: 1, ask: 0.5, fix: 1, tiktok: 4, game: 3, scan: 2,
    live_min: 5,     // AI-Live (style swap with Motey's voice), per started minute
    replace_min: 5   // Live Replace (Pro), per started minute
  };
  const LABEL = { summary: 'Sammanfattning', catchup: 'Vad hände förra gången', ask: 'Fråga Motey', fix: 'Motey fixar en fil', tiktok: 'TikTok-video', game: 'Spelbana', scan: '3D-skanning', live_min: 'AI-Live, per minut', replace_min: 'Live Replace, per minut' };

  const S = () => Store.settings;
  const server = () => (S().serverUrl || '').replace(/\/+$/, '');
  const period = () => new Date().toISOString().slice(0, 7);

  function token() {
    let t = null;
    try { t = localStorage.getItem('motey.token'); } catch (e) { /* blocked */ }
    if (!t) { t = Nostr.hex(Nostr.rand(24)); try { localStorage.setItem('motey.token', t); } catch (e) { /* blocked */ } }
    return t;
  }
  function state() {
    const st = Store.state;
    if (!st.plan) st.plan = { id: 'lite', used: 0, period: period() };
    if (st.plan.period !== period()) { st.plan.used = 0; st.plan.period = period(); }
    return st.plan;
  }
  const plan = () => PLANS[state().id] || PLANS.lite;
  const pct = () => Math.min(100, Math.round(100 * state().used / plan().quota));
  const can = f => !!plan()[f];
  // Demo mode is for looking around: nothing is counted there.
  const metered = () => !S().demo;

  class QuotaError extends Error { constructor(kind, action) { super(kind === 'feature' ? 'Kräver en högre plan' : 'Kvoten är slut'); this.kind = kind; this.action = action; } }

  // Check before doing something; count it afterwards with charge().
  function check(action) {
    if (!metered()) return true;
    if ((action === 'live_min') && !can('live')) throw new QuotaError('feature', action);
    if ((action === 'replace_min' || action === 'scan') && !can('replace')) throw new QuotaError('feature', action);
    if (state().used + (COST[action] || 0) > plan().quota + 1e-9) throw new QuotaError('quota', action);
    return true;
  }
  function charge(action, n) {
    if (!metered()) return;
    if (server()) return; // the server counts; numbers come back via serverUsage()
    state().used = Math.round((state().used + (COST[action] || 0) * (n || 1)) * 100) / 100;
    Store.save();
    paintPill();
  }
  function serverUsage(u) {
    const s = state();
    if (u.plan && PLANS[u.plan]) s.id = u.plan;
    if (typeof u.used === 'number') s.used = u.used;
    if (u.period) s.period = u.period;
    Store.save(); paintPill();
  }
  async function refresh() {
    if (!server()) return state();
    try {
      const r = await fetch(server() + '/v1/me', { headers: { authorization: 'Bearer ' + token() } });
      if (r.ok) serverUsage(await r.json());
    } catch (e) { /* offline – keep last known */ }
    return state();
  }
  // Guard used by every AI feature: shows the upgrade sheet and returns false when blocked.
  function allow(action) {
    try { check(action); return true; }
    catch (e) { if (e instanceof QuotaError) { upgradeSheet(e); return false; } throw e; }
  }

  /* ---------------- buying ---------------- */
  async function buy(id) {
    if (id === 'lite') return manage();
    if (server()) {
      try {
        const r = await fetch(server() + '/v1/checkout', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token() }, body: JSON.stringify({ plan: id }) });
        const d = await r.json();
        if (!r.ok || !d.url) throw new Error(d.error || 'HTTP ' + r.status);
        App.toast('Öppnar betalningen… kom tillbaka hit när du är klar 💜', 5000);
        await Platform.openUrl(d.url);
        pollAfterBuy();
      } catch (e) { App.toast('Kunde inte starta betalningen: ' + e.message, 6000); }
      return;
    }
    if (S().testPlans) { state().id = id; Store.save(); paintPill(); App.toast(`TESTLÄGE: ${PLANS[id].name} aktiverad (ingen betalning)`); App.go('#/plans'); return; }
    App.sheet(`<div class="motey-stage">${Mascot.svg({ size: 80, mood: 'worried' })}<div class="speech">Betalningen är inte kopplad än. Den som driver Motey behöver starta Motey-servern med Stripe – se README. Utan server går det att prova planerna i testläge under Mer.</div></div>`);
  }
  async function manage() {
    if (!server()) { if (S().testPlans) { state().id = 'lite'; Store.save(); paintPill(); App.go('#/plans'); } return; }
    try {
      const r = await fetch(server() + '/v1/portal', { method: 'POST', headers: { authorization: 'Bearer ' + token() } });
      const d = await r.json();
      if (d.url) Platform.openUrl(d.url); else App.toast(d.error || 'Ingen prenumeration att hantera');
    } catch (e) { App.toast('Kunde inte nå servern'); }
  }
  let polls = 0;
  function pollAfterBuy() {
    polls = 0;
    const was = state().id;
    const t = setInterval(async () => {
      await refresh();
      if (state().id !== was || ++polls > 60) { clearInterval(t); if (state().id !== was) { App.toast(`🎉 Välkommen till ${plan().name}!`, 5000); App.go('#/plans'); } }
    }, 5000);
    window.addEventListener('focus', () => refresh(), { once: true });
  }

  /* ---------------- UI ---------------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function meter(big) {
    const p = pct();
    const color = p >= 90 ? 'var(--danger)' : p >= 70 ? 'var(--coral)' : 'var(--mint)';
    return `<div class="meter ${big ? 'big' : ''}"><div class="row between"><b>${esc(plan().name)}</b><span>${S().demo ? 'Demo – räknas inte' : p + ' % använt'}</span></div>
      <div class="progress"><i style="width:${S().demo ? 0 : p}%;background:${color}"></i></div>
      ${big && !S().demo ? `<div class="small muted">Nollställs den 1:a varje månad.${server() ? '' : ' Räknas på den här enheten.'}</div>` : ''}</div>`;
  }
  function paintPill() {
    const el = document.getElementById('planpill');
    if (!el) return;
    el.textContent = S().demo ? 'Demo' : `${plan().name.replace('Motey ', '')} · ${pct()} %`;
    el.className = 'planpill ' + plan().id;
  }
  function upgradeSheet(err) {
    const feature = err.kind === 'feature';
    const need = err.action === 'replace_min' || err.action === 'scan' ? 'pro' : 'plus';
    const text = feature
      ? (need === 'pro' ? 'Live Replace finns i Motey Pro. Då pratar en 3D-version av dig i mötet medan du är någon helt annanstans. 🏖️' : 'AI-Live finns inte i Lite. Med Motey Plus byter jag stil på chefen i realtid – med min egen röst!')
      : `Månadens ${plan().name}-kvot är slut (${LABEL[err.action] || 'det här'} behöver lite mer). Uppgradera så fortsätter jag direkt – eller vänta till den 1:a.`;
    const sh = App.sheet(`<div class="motey-stage">${Mascot.svg({ size: 84, mood: 'worried' })}<div class="speech">${esc(text)}</div></div>
      <div style="margin-top:14px">${meter(true)}</div>
      <div class="row" style="margin-top:14px">${['plus', 'pro'].filter(id => PLANS[id].quota > plan().quota || (feature && PLANS[id][need === 'pro' ? 'replace' : 'live'])).map(id => `<button class="btn ${id === need ? '' : 'ghost'}" data-buy="${id}">${PLANS[id].name} – ${PLANS[id].price} kr/mån</button>`).join('')}
      <a class="btn ghost" href="#/plans">Jämför planer</a></div>`);
    sh.el.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => { sh.close(); buy(b.dataset.buy); }));
    sh.el.querySelector('a').addEventListener('click', () => sh.close());
  }
  function render(v) {
    refresh().then(() => { if (location.hash === '#/plans') { const m = v.querySelector('#meterbox'); if (m) m.innerHTML = meter(true); } });
    const cur = plan().id;
    const feats = {
      lite: ['Möten, samtal och chattar', 'Sammanfattningar, spel och TikTok – med gräns', 'Offline-AI när kvoten räcker', '✗ Ingen AI-Live', '✗ Ingen Live Replace'],
      plus: ['Allt i Lite', '4× så mycket användning', 'AI-Live med Gemini 3.8 Flash Live (5 % per minut)', 'TikTok och spel med Gemini 3.8 Flash', '✗ Ingen Live Replace'],
      pro: ['Allt i Plus', '20× så mycket som Plus', '🏖️ Live Replace – 3D-du pratar i mötet', 'Skanna ditt 3D-ansikte', 'Live-minuter för hela månaden']
    };
    v.innerHTML = `<h1>Prenumeration</h1>
      ${S().demo ? '<div class="demo-banner">👀 I demon räknas ingenting. Börja på riktigt för att använda din plan.</div>' : ''}
      <div class="card" id="meterbox">${meter(true)}</div>
      <div class="plans">${Object.values(PLANS).map(p => `<div class="plan ${p.id} ${p.id === cur ? 'on' : ''}">
        <div class="pname">${p.name}${p.id === 'pro' ? ' <span class="badge brand">3D</span>' : ''}</div>
        <div class="pprice">${p.price ? p.price + ' kr<small>/mån</small>' : 'Gratis'}</div>
        <p class="small muted">${esc(p.blurb)}</p>
        <ul class="clean">${feats[p.id].map(f => `<li data-ico="${f.startsWith('✗') ? '' : '✓'}">${esc(f.replace(/^✗ /, '✗ '))}</li>`).join('')}</ul>
        ${p.id === cur ? '<button class="btn ghost block" disabled>Din plan</button>' : `<button class="btn block ${p.id === 'pro' ? 'coral' : ''}" data-buy="${p.id}">${p.price ? (PLANS[cur].price > p.price ? 'Byt till ' : 'Uppgradera till ') + p.name.replace('Motey ', '') : 'Byt till Lite'}</button>`}
      </div>`).join('')}</div>
      <div class="card"><h3>Vad saker kostar</h3><p class="small muted">I procent av månadens kvot för varje plan.</p>
        <table class="cost"><tr><th></th><th>Lite</th><th>Plus</th><th>Pro</th></tr>
        ${Object.keys(COST).map(k => `<tr><td>${LABEL[k]}</td>${['lite', 'plus', 'pro'].map(id => {
          const P = PLANS[id];
          const ok = !(k === 'live_min' && !P.live) && !((k === 'replace_min' || k === 'scan') && !P.replace);
          const v = 100 * COST[k] / P.quota;
          return `<td>${ok ? (v < 0.1 ? '<0,1' : String(Math.round(v * 10) / 10).replace('.', ',')) + ' %' : '–'}</td>`;
        }).join('')}</tr>`).join('')}</table></div>
      ${server() ? '<button class="btn ghost" id="manage">Hantera prenumeration</button>' : ''}`;
    v.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => buy(b.dataset.buy)));
    const mg = v.querySelector('#manage'); if (mg) mg.addEventListener('click', manage);
  }

  window.Plans = { PLANS, COST, LABEL, plan, pct, can, check, charge, allow, refresh, serverUsage, token, buy, manage, render, meter, paintPill, upgradeSheet, QuotaError, state };
})();
