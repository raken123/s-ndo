// Serverns adress. Tom = samma domän. Fristående HTML-filer sätter <meta name="jomni-api">.
const API_BASE = (document.querySelector('meta[name="jomni-api"]')?.content || '').replace(/\/$/, '');
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (n) => `${Number(n).toLocaleString('sv-SE')} kr`;
const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (iso) => new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const store = {
  get(k) { try { return localStorage.getItem(`jomni.${k}`); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(`jomni.${k}`); else localStorage.setItem(`jomni.${k}`, v); } catch { /* privat läge */ } },
};

const state = { token: store.get('admin'), tab: 'orders', filter: 'active', unpaid: false, orders: [], seen: null, stats: null };
const root = $('#admin');

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/admin/login') { logout(); throw new Error('Logga in igen.'); }
  if (!res.ok) throw new Error(json.error || 'Något gick fel.');
  return json;
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}

function logout() {
  state.token = null;
  store.set('admin', null);
  clearInterval(state.timer);
  renderLogin();
}

function renderLogin() {
  root.innerHTML = `
    <div class="page narrow" style="max-width:420px">
      <h1>🔒 Admin</h1>
      <form class="card" id="login">
        <label><span>Lösenord</span><input type="password" name="password" autocomplete="current-password" required autofocus></label>
        <p class="error" id="login-err"></p>
        <button class="btn block">Logga in</button>
      </form>
    </div>`;
  $('#login').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { token } = await api('/admin/login', { method: 'POST', body: { password: e.target.password.value } });
      state.token = token;
      store.set('admin', token);
      start();
    } catch (err) { $('#login-err').textContent = err.message; }
  };
}

// ---------------------------------------------------------------- dashboard
function renderShell() {
  root.innerHTML = `
    <div class="admin-top">
      <h1>🌸 Jomni Admin</h1>
      <button class="btn ghost sm" id="notif">🔔 Aviseringar</button>
      <button class="btn ghost sm" id="logout">Logga ut</button>
    </div>
    <div class="stats" id="stats"></div>
    <div class="tabs">
      <button data-tab="orders" class="${state.tab === 'orders' ? 'active' : ''}">📦 Beställningar</button>
      <button data-tab="stars" class="${state.tab === 'stars' ? 'active' : ''}">⭐ Stjärnor & rabatter</button>
    </div>
    <div id="tab"></div>`;
  $('#logout').onclick = logout;
  $('#notif').onclick = async () => {
    if (!('Notification' in window)) { toast('Webbläsaren stöder inte aviseringar. Använd iPhone-appen.'); return; }
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Du får en avisering när en ny beställning kommer in.' : 'Aviseringar är avstängda.');
  };
  $$('[data-tab]').forEach((b) => { b.onclick = () => { state.tab = b.dataset.tab; renderShell(); renderStats(); renderTab(); }; });
}

function renderStats() {
  const s = state.stats;
  if (!s) return;
  $('#stats').innerHTML = `
    <div class="stat"><div class="small muted">Leverera idag</div><div class="big">${s.deliverToday}</div></div>
    <div class="stat"><div class="small muted">Att leverera totalt</div><div class="big">${s.toDeliver}</div></div>
    <div class="stat"><div class="small muted">Försäljning idag</div><div class="big">${kr(s.revenueToday)}</div><div class="small muted">${s.ordersToday} beställningar</div></div>
    <div class="stat"><div class="small muted">Stjärnor</div><div class="big">⭐ ${s.stars.balance}</div><div class="small muted">${s.stars.average ? `Snitt ${s.stars.average.toLocaleString('sv-SE')} av ${s.stars.ratings} betyg` : 'Inga betyg än'}</div></div>`;
}

function renderTab() {
  if (state.tab === 'orders') renderOrders();
  else renderStars();
}

function dueInfo(o) {
  const ms = Date.parse(o.deliverBy) - Date.now();
  if (['delivered', 'cancelled'].includes(o.status)) return { cls: '', text: '' };
  if (ms < 0) return { cls: 'late', text: 'Nu!' };
  if (ms < 3 * 3600e3) return { cls: 'soon', text: `om ${Math.max(1, Math.round(ms / 60000))} min` };
  return { cls: '', text: '' };
}

const NEXT = {
  paid: [['preparing', 'Börja binda 💐']],
  preparing: [['out_for_delivery', 'Ute för leverans 🚲']],
  out_for_delivery: [['delivered', 'Levererad ✅']],
};

function renderOrders() {
  const active = ['paid', 'preparing', 'out_for_delivery'];
  let list = state.orders;
  if (state.filter === 'active') list = list.filter((o) => active.includes(o.status)).sort((a, b) => a.deliverBy.localeCompare(b.deliverBy));
  else if (state.filter !== 'all') list = list.filter((o) => o.status === state.filter);
  $('#tab').innerHTML = `
    <div class="toolbar">
      <select id="filter" aria-label="Filter">
        <option value="active">Att leverera (efter leveranstid)</option>
        <option value="all">Alla</option>
        <option value="delivered">Levererade</option>
        <option value="cancelled">Avbrutna</option>
      </select>
      <label><input type="checkbox" id="unpaid" ${state.unpaid ? 'checked' : ''}> Visa obetalda</label>
      <span class="small muted">${list.length} st · uppdateras automatiskt</span>
    </div>
    <div class="orders">${list.length ? list.map(orderCard).join('') : '<div class="card muted">Inga beställningar här just nu. 🌿</div>'}</div>`;
  $('#filter').value = state.filter;
  $('#filter').onchange = (e) => { state.filter = e.target.value; renderOrders(); };
  $('#unpaid').onchange = (e) => { state.unpaid = e.target.checked; refresh(); };
  $('#tab').onclick = async (e) => {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    if (b.dataset.status === 'cancelled' && !confirm('Avbryta beställningen? Glöm inte att återbetala i Stripe.')) return;
    b.disabled = true;
    try {
      const { order } = await api(`/admin/orders/${b.dataset.id}`, { method: 'PATCH', body: { status: b.dataset.status } });
      state.orders = state.orders.map((o) => (o.id === order.id ? order : o));
      renderOrders();
      refreshStats();
    } catch (err) { toast(err.message); b.disabled = false; }
  };
}

function orderCard(o) {
  const d = o.delivery;
  const due = dueInfo(o);
  const addr = `${d.address}, ${d.postcode} ${d.city}`;
  const pay = { apple_pay: 'Apple Pay', google_pay: 'Google Pay', card: 'Kort', free: 'Gratis' }[o.payment.method] || o.payment.method || '–';
  return `<article class="order st-${o.status}">
    <div class="order-head">
      <div><strong style="font-size:1.1rem">#${o.number}</strong> <span class="chip">${esc(o.statusLabel)}</span></div>
      <div class="due ${due.cls}">🕑 ${esc(fmtDate(d.date))}${d.slotLabel ? ` kl ${esc(d.slotLabel)}` : ' · PostNord'} ${due.text ? `· ${due.text}` : ''}</div>
    </div>
    <div class="order-grid">
      <div><h4>Bukett</h4>${o.lines.map((l) => `${l.qty} × ${esc(l.name)}`).join('<br>')}
        <div class="small muted" style="margin-top:4px">${kr(o.total)} · ${esc(pay)}${o.discount ? ` · kod ${esc(o.discount.code)}` : ''}</div></div>
      <div><h4>Leverera till</h4><strong>${esc(d.recipient)}</strong> · <a href="tel:${esc(d.recipientPhone)}">${esc(d.recipientPhone)}</a><br>
        <a href="https://maps.google.com/?q=${encodeURIComponent(addr)}" target="_blank" rel="noopener">${esc(addr)}</a>
        ${d.instructions ? `<div class="small">📝 ${esc(d.instructions)}</div>` : ''}</div>
      <div><h4>Beställare</h4>${esc(o.customer.name)}<br><a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a><br>
        <a href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a>
        <div class="small muted">Beställd ${fmtTime(o.createdAt)}</div></div>
    </div>
    ${d.message ? `<p class="small">💌 Kort: <em>”${esc(d.message)}”</em></p>` : ''}
    ${o.rating ? `<p class="small">${'⭐'.repeat(o.rating.stars)} ${esc(o.rating.comment)}</p>` : ''}
    <div class="actions">
      ${(NEXT[o.status] || []).map(([s, label]) => `<button class="btn sm" data-id="${o.id}" data-status="${s}">${label}</button>`).join('')}
      ${['paid', 'preparing'].includes(o.status) ? `<button class="btn ghost sm" data-id="${o.id}" data-status="cancelled">Avbryt</button>` : ''}
    </div>
  </article>`;
}

// ---------------------------------------------------------------- stjärnor & rabatter
async function renderStars() {
  const s = state.stats;
  $('#tab').innerHTML = `
    <div class="two">
      <div class="card">
        <h3>Dina stjärnor</h3>
        <div class="star-balance">⭐ ${s.stars.balance}</div>
        <p class="muted small">Kunderna ger 1–5 stjärnor efter leverans. Totalt ${s.stars.received} ⭐ intjänade, ${s.stars.spent} ⭐ använda.</p>
        <h4>Senaste betygen</h4>
        ${s.recentRatings.length ? s.recentRatings.map((r) => `<div class="list-item"><div>${'⭐'.repeat(r.stars)} <span class="small muted">#${r.number} · ${esc(r.name)}</span>${r.comment ? `<div class="small">”${esc(r.comment)}”</div>` : ''}</div></div>`).join('') : '<p class="muted small">Inga betyg ännu.</p>'}
      </div>
      <form class="card" id="new-discount">
        <h3>Skapa rabatt med stjärnor</h3>
        <label><span>Typ</span><select name="type">
          <option value="percent">Procent rabatt (1 ⭐ per %)</option>
          <option value="amount">Kronor rabatt (1 ⭐ per 10 kr)</option>
          <option value="free_delivery">Gratis leverans (5 ⭐)</option>
          <option value="free_bouquet">Gratis bukett upp till X kr (1 ⭐ per 10 kr)</option>
        </select></label>
        <label id="value-row"><span>Värde</span><input name="value" type="number" min="1" value="10"></label>
        <div class="row">
          <label><span>Kod (valfri)</span><input name="code" placeholder="SOMMAR10" style="text-transform:uppercase"></label>
          <label><span>Max antal användningar</span><input name="maxUses" type="number" min="1" placeholder="Obegränsat"></label>
        </div>
        <label><span>Giltig till och med (valfritt)</span><input name="expiresAt" type="date"></label>
        <p><strong id="cost">Kostar 10 ⭐</strong></p>
        <p class="error" id="disc-err"></p>
        <button class="btn block">Skapa rabattkod</button>
      </form>
    </div>
    <div class="card" style="margin-top:16px"><h3>Rabattkoder</h3><div id="codes" class="muted">Laddar …</div></div>`;

  const form = $('#new-discount');
  const updCost = async () => {
    $('#value-row').classList.toggle('hidden', form.type.value === 'free_delivery');
    try {
      const { cost } = await api('/admin/discounts/cost', { method: 'POST', body: { type: form.type.value, value: Number(form.value.value) } });
      $('#cost').textContent = `Kostar ${cost} ⭐ (du har ${state.stats.stars.balance} ⭐)`;
      $('#cost').style.color = cost > state.stats.stars.balance ? 'var(--danger)' : '';
    } catch { /* ignorera */ }
  };
  form.type.onchange = updCost;
  form.value.oninput = updCost;
  updCost();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    try {
      const { discount } = await api('/admin/discounts', { method: 'POST', body: f });
      toast(`Rabattkoden ${discount.code} är skapad!`);
      await refreshStats();
      renderStars();
    } catch (err) { $('#disc-err').textContent = err.message; }
  };
  loadCodes();
}

async function loadCodes() {
  const { discounts } = await api('/admin/discounts');
  const box = $('#codes');
  if (!box) return;
  box.classList.remove('muted');
  box.innerHTML = discounts.length ? discounts.map((d) => `
    <div class="list-item">
      <div><span class="code">${esc(d.code)}</span> ${esc(d.label)}
        <div class="small muted">Använd ${d.uses}${d.maxUses ? ` av ${d.maxUses}` : ''} gånger · ${d.starCost} ⭐${d.expiresAt ? ` · t.o.m. ${new Date(d.expiresAt).toLocaleDateString('sv-SE')}` : ''}${d.disabled ? ' · <strong>inaktiverad</strong>' : ''}</div></div>
      ${d.disabled ? '' : `<button class="btn ghost sm" data-del="${esc(d.code)}">Ta bort</button>`}
    </div>`).join('') : '<p class="muted">Inga rabattkoder ännu.</p>';
  box.onclick = async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b || !confirm(`Ta bort ${b.dataset.del}? Oanvända koder ger tillbaka stjärnorna.`)) return;
    const { refunded } = await api(`/admin/discounts/${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE' });
    toast(refunded ? `Koden togs bort och ${refunded} ⭐ kom tillbaka.` : 'Koden togs bort.');
    await refreshStats();
    renderStars();
  };
}

// ---------------------------------------------------------------- data
async function refreshStats() {
  state.stats = await api('/admin/stats');
  renderStats();
}

async function refresh() {
  try {
    const { orders } = await api(`/admin/orders${state.unpaid ? '?include_unpaid=1' : ''}`);
    const ids = new Set(orders.map((o) => o.id));
    if (state.seen) {
      const fresh = orders.filter((o) => !state.seen.has(o.id) && o.status === 'paid');
      for (const o of fresh) {
        const d = o.delivery;
        const body = `${d.date}${d.slotLabel ? ` kl ${d.slotLabel}` : ''} · ${d.address}, ${d.city}`;
        toast(`Ny beställning #${o.number}!`);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Ny beställning #${o.number} – du måste leverera`, { body, tag: o.id, requireInteraction: true });
        }
      }
    }
    state.seen = ids;
    state.orders = orders;
    await refreshStats();
    if (state.tab === 'orders' && !document.activeElement?.closest?.('#tab select')) renderOrders();
  } catch (e) { if (state.token) toast(e.message); }
}

async function start() {
  renderShell();
  await refresh();
  renderTab();
  clearInterval(state.timer);
  state.timer = setInterval(refresh, 20000);
}

if (state.token) start(); else renderLogin();
