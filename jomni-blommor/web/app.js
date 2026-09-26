import { bouquetSVG } from './bouquet.js';

// ---------------------------------------------------------------- utils
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (n) => `${Number(n).toLocaleString('sv-SE')} kr`;
const num = (n, d = 3) => Number(n).toLocaleString('sv-SE', { maximumFractionDigits: d });
const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (iso) => new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const store = {
  get(k, d = null) { try { const v = localStorage.getItem(`jomni.${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(`jomni.${k}`); else localStorage.setItem(`jomni.${k}`, JSON.stringify(v)); } catch { /* privat läge */ } },
};

const state = {
  config: null,
  products: [],
  cart: store.get('cart', []),
  token: store.get('token'),
  user: null,
  filter: 'Alla',
  checkout: { postcode: '', quote: null, zoneId: null, date: null, slot: null, discountCode: '', pricing: null },
};

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token && path.startsWith('/me')) setSession(null);
  if (!res.ok) throw new Error(json.error || 'Något gick fel.');
  return json;
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 3200);
}

const productById = (id) => state.products.find((p) => p.id === id);
const coinsFor = (kronor) => (Math.floor(kronor) * state.config.loyalty.milliCoinsPerKrona
  * (state.user?.plus.active ? state.config.loyalty.plusMultiplier : 1)) / 1000;

// ---------------------------------------------------------------- session & cart
function setSession(token, user = null) {
  state.token = token;
  state.user = user;
  store.set('token', token);
  renderHeader();
}

async function refreshUser() {
  if (!state.token) return;
  try { state.user = (await api('/me')).user; } catch { /* utloggad */ }
  renderHeader();
}

function saveCart() {
  store.set('cart', state.cart);
  renderHeader();
}

function addToCart(id, qty = 1) {
  const line = state.cart.find((l) => l.productId === id);
  if (line) line.qty = Math.min(20, line.qty + qty);
  else state.cart.push({ productId: id, qty });
  saveCart();
  openCart();
}

function cartSubtotal() {
  return state.cart.reduce((s, l) => s + (productById(l.productId)?.price || 0) * l.qty, 0);
}

function renderHeader() {
  $('#cart-count').textContent = state.cart.reduce((s, l) => s + l.qty, 0);
  $('#wallet-pill').innerHTML = state.user
    ? `<span title="Mynt">🪙 ${num(state.user.coins)}</span><span title="Diamanter">💎 ${num(state.user.diamonds, 4)}</span>${state.user.plus.active ? '<span>✨ Plus</span>' : ''}`
    : '';
}

function openCart() {
  const root = $('#drawer-root');
  const lines = state.cart.filter((l) => productById(l.productId));
  root.innerHTML = `
    <div class="drawer-bg" data-close></div>
    <aside class="drawer" role="dialog" aria-label="Varukorg">
      <header><h3 style="margin:0">Din varukorg</h3><button class="icon-btn" data-close aria-label="Stäng">✕</button></header>
      <div class="items">
        ${lines.length ? lines.map((l) => {
          const p = productById(l.productId);
          return `<div class="line">
            <div class="thumb">${bouquetSVG(p)}</div>
            <div><strong>${esc(p.name)}</strong><div class="muted small">${kr(p.price)}</div>
              <div class="qty" style="margin-top:6px"><button data-dec="${p.id}" aria-label="Minska">−</button><span>${l.qty}</span><button data-inc="${p.id}" aria-label="Öka">+</button></div>
            </div>
            <strong>${kr(p.price * l.qty)}</strong>
          </div>`;
        }).join('') : '<p class="muted" style="padding:30px 0;text-align:center">Varukorgen är tom. 🌷</p>'}
      </div>
      ${lines.length ? `<footer>
        <div class="sum-row"><span>Summa</span><strong>${kr(cartSubtotal())}</strong></div>
        <p class="coin-hint">Du får ${num(coinsFor(cartSubtotal()))} 🪙 mynt på köpet${state.user ? '' : ' (logga in)'}</p>
        <a class="btn block" href="#/kassa" data-close>Till kassan</a>
      </footer>` : ''}
    </aside>`;
  root.onclick = (e) => {
    const t = e.target.closest('[data-close],[data-inc],[data-dec]');
    if (!t) return;
    if (t.dataset.close !== undefined) { root.innerHTML = ''; return; }
    const id = t.dataset.inc || t.dataset.dec;
    const line = state.cart.find((l) => l.productId === id);
    line.qty += t.dataset.inc ? 1 : -1;
    line.qty = Math.min(20, line.qty);
    state.cart = state.cart.filter((l) => l.qty > 0);
    saveCart();
    openCart();
  };
}

// ---------------------------------------------------------------- views
const view = () => $('#view');

function viewShop() {
  const cats = ['Alla', ...new Set(state.products.map((p) => p.category))];
  const list = state.products.filter((p) => state.filter === 'Alla' || p.category === state.filter);
  const hero = state.products.find((p) => p.id === 'rosa-drommar') || state.products[0];
  view().innerHTML = `
    <section class="hero">
      <div>
        <h1>Handbundna buketter,<br>levererade samma dag.</h1>
        <p>Beställ senast två timmar före valt tidsfönster så kör vi ut inom valt tidsfönster. Betala smidigt med Apple Pay eller Google Pay – och samla mynt på varje köp.</p>
        <a class="btn" href="#buketter">Se alla buketter</a>
        <div class="perks">
          <span class="chip rose">🚲 Budleverans samma dag</span>
          <span class="chip sage">📦 PostNord i hela Sverige</span>
          <span class="chip">🪙 Mynt → 💎 Diamanter</span>
        </div>
      </div>
      <div class="hero-art">${bouquetSVG(hero)}</div>
    </section>
    <h2 id="buketter">Alla buketter</h2>
    <div class="filters">${cats.map((c) => `<button data-cat="${esc(c)}" class="${c === state.filter ? 'active' : ''}">${esc(c)}</button>`).join('')}</div>
    <div class="grid">${list.map((p) => `
      <article class="product">
        <div class="art" data-open="${p.id}">${bouquetSVG(p)}</div>
        <div class="body">
          <span class="chip">${esc(p.category)}</span>
          <h3>${esc(p.name)}</h3>
          <div class="desc">${esc(p.description)}</div>
          <div class="coin-hint">+${num(coinsFor(p.price))} 🪙</div>
          <div class="buy"><span class="price">${kr(p.price)}</span><button class="btn sm" data-add="${p.id}">Köp</button></div>
        </div>
      </article>`).join('')}
    </div>`;
  view().onclick = (e) => {
    const t = e.target.closest('[data-cat],[data-add],[data-open]');
    if (!t) return;
    if (t.dataset.cat) { state.filter = t.dataset.cat; viewShop(); }
    if (t.dataset.add) addToCart(t.dataset.add);
    if (t.dataset.open) location.hash = `#/bukett/${t.dataset.open}`;
  };
}

function viewProduct(id) {
  const p = productById(id);
  if (!p) { location.hash = '#/'; return; }
  let qty = 1;
  view().innerHTML = `
    <div class="detail">
      <div class="art">${bouquetSVG(p)}</div>
      <div>
        <a href="#/" class="small">← Alla buketter</a>
        <h1 style="margin-top:10px">${esc(p.name)}</h1>
        <p class="price" style="font-size:1.5rem">${kr(p.price)}</p>
        <p>${esc(p.description)}</p>
        <p class="coin-hint">Du får ${num(coinsFor(p.price))} 🪙 mynt${state.user?.plus.active ? ' (dubbla med Plus ✨)' : ''}</p>
        <div style="display:flex;gap:12px;align-items:center;margin:18px 0">
          <div class="qty"><button id="dec">−</button><span id="q">1</span><button id="inc">+</button></div>
          <button class="btn" id="add">Lägg i varukorgen</button>
        </div>
        <div class="card small">
          <strong>Leverans</strong><br>
          🚲 Budleverans samma dag i Stockholmsområdet i valt tidsfönster (09–21).<br>
          📦 PostNord Hem till hela Sverige inom 1–2 vardagar.<br>
          💌 Skriv ett personligt kort i kassan – det följer med buketten.
        </div>
      </div>
    </div>`;
  $('#dec').onclick = () => { qty = Math.max(1, qty - 1); $('#q').textContent = qty; };
  $('#inc').onclick = () => { qty = Math.min(20, qty + 1); $('#q').textContent = qty; };
  $('#add').onclick = () => addToCart(p.id, qty);
}

// ---------------------------------------------------------------- checkout
let stripe = null;
let elements = null;

async function waitForStripe() {
  for (let i = 0; i < 50 && !window.Stripe; i += 1) await new Promise((r) => setTimeout(r, 200));
  return window.Stripe;
}

function viewCheckout() {
  const lines = state.cart.filter((l) => productById(l.productId));
  if (!lines.length) {
    view().innerHTML = '<div class="page narrow"><h2>Kassan</h2><p>Din varukorg är tom.</p><a class="btn" href="#/">Välj bukett</a></div>';
    return;
  }
  const u = state.user;
  const saved = store.get('checkout-contact', {});
  const mode = state.config.payments.mode;
  const co = state.checkout;
  view().innerHTML = `
    <div class="checkout">
      <form id="co-form" novalidate>
        <h2>Kassan</h2>
        <section class="card">
          <div class="step"><b>1</b><h3 style="margin:0">Vart ska buketten?</h3></div>
          <div class="row">
            <label><span>Postnummer</span><input name="postcode" inputmode="numeric" autocomplete="postal-code" placeholder="123 45" value="${esc(co.postcode)}" required></label>
            <label><span>&nbsp;</span><button type="button" class="btn ghost block" id="quote-btn">Visa leveransalternativ</button></label>
          </div>
          <div id="delivery-options"></div>
          <div class="row">
            <label><span>Mottagarens namn</span><input name="recipient" autocomplete="off" required value="${esc(saved.recipient || '')}"></label>
            <label><span>Mottagarens telefon</span><input name="recipientPhone" type="tel" autocomplete="off" required value="${esc(saved.recipientPhone || '')}"></label>
          </div>
          <label><span>Gatuadress (inkl. portkod/lägenhet)</span><input name="address" autocomplete="street-address" required></label>
          <label><span>Ort</span><input name="city" autocomplete="address-level2" required></label>
          <label><span>Hälsning på kortet (valfritt)</span><textarea name="message" maxlength="300" placeholder="Grattis på födelsedagen! Kram"></textarea></label>
          <label><span>Leveransinstruktion till budet (valfritt)</span><input name="instructions" maxlength="300" placeholder="Lämna hos grannen om ingen öppnar"></label>
        </section>
        <section class="card">
          <div class="step"><b>2</b><h3 style="margin:0">Dina uppgifter</h3></div>
          <label><span>Ditt namn</span><input name="name" autocomplete="name" required value="${esc(u?.name || saved.name || '')}"></label>
          <div class="row">
            <label><span>E-post (för kvitto)</span><input name="email" type="email" autocomplete="email" required value="${esc(u?.email || saved.email || '')}"></label>
            <label><span>Telefon</span><input name="phone" type="tel" autocomplete="tel" required value="${esc(saved.phone || '')}"></label>
          </div>
          ${u ? `<p class="coin-hint">Inloggad som ${esc(u.name)} – mynten hamnar på ditt konto.</p>` : '<p class="small muted"><a href="#/konto">Logga in</a> för att samla mynt på köpet.</p>'}
        </section>
        <section class="card">
          <div class="step"><b>3</b><h3 style="margin:0">Betala</h3></div>
          <p class="error" id="co-error" role="alert"></p>
          ${mode === 'demo' ? `
            <div class="demo-note">🧪 <strong>Demoläge:</strong> inga riktiga pengar dras. Lägg in Stripe-nycklar på servern för skarpa betalningar.</div>
            <div class="pay-buttons">
              <button type="button" class="pay-apple" data-demo="apple_pay">Betala med Apple Pay</button>
              <button type="button" class="pay-google" data-demo="google_pay">Betala med <span class="g">G</span> Pay</button>
              <div class="divider">eller</div>
              <button type="button" class="btn dark block" data-demo="card">Betala med kort</button>
            </div>` : mode === 'stripe' ? `
            <div id="express"></div>
            <div class="divider">eller betala med kort</div>
            <div id="card-element" style="margin-bottom:12px"></div>
            <button type="button" class="btn dark block" id="card-pay">Betala med kort</button>
            <p class="small muted" style="margin-top:10px">🔒 Betalningen hanteras säkert av Stripe. Apple Pay visas i Safari, Google Pay i Chrome.</p>` : `
            <p class="error">Betalning är inte aktiverad i butiken ännu.</p>`}
        </section>
      </form>
      <aside class="card summary" id="summary"></aside>
    </div>`;

  const form = $('#co-form');
  form.addEventListener('input', (e) => {
    if (['name', 'email', 'phone', 'recipient', 'recipientPhone'].includes(e.target.name)) {
      const f = Object.fromEntries(new FormData(form));
      store.set('checkout-contact', { name: f.name, email: f.email, phone: f.phone, recipient: f.recipient, recipientPhone: f.recipientPhone });
    }
  });
  const pc = form.postcode;
  $('#quote-btn').onclick = () => loadQuote(pc.value);
  pc.addEventListener('input', () => { if (pc.value.replace(/\s/g, '').length === 5) loadQuote(pc.value); });
  pc.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadQuote(pc.value); } });
  if (co.postcode && co.quote) renderDeliveryOptions();
  $$('[data-demo]').forEach((b) => { b.onclick = () => payDemo(b.dataset.demo); });
  updatePricing();
  if (mode === 'stripe') setupStripe();
}

async function loadQuote(postcode, date) {
  const co = state.checkout;
  co.postcode = postcode;
  const box = $('#delivery-options');
  try {
    co.quote = await api('/delivery/quote', { method: 'POST', body: { postcode, date } });
    if (!co.quote.options.some((o) => o.id === co.zoneId)) { co.zoneId = co.quote.options[0].id; co.slot = null; }
    const opt = co.quote.options.find((o) => o.id === co.zoneId);
    if (!date || date !== opt.date) co.date = opt.date;
    if (!opt.slots.some((s) => s.id === co.slot)) co.slot = opt.slots[0]?.id || null;
    renderDeliveryOptions();
    updatePricing();
  } catch (e) {
    co.quote = null;
    box.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    updatePricing();
  }
}

function renderDeliveryOptions() {
  const co = state.checkout;
  const opt = co.quote.options.find((o) => o.id === co.zoneId);
  const sub = cartSubtotal();
  $('#delivery-options').innerHTML = `
    <div class="options">${co.quote.options.map((o) => {
      const fee = o.freeOver != null && sub >= o.freeOver ? 0 : o.fee;
      return `<label class="option ${o.id === co.zoneId ? 'selected' : ''}">
        <input type="radio" name="zone" value="${o.id}" ${o.id === co.zoneId ? 'checked' : ''}>
        <div><strong>${esc(o.name)} · ${fee ? kr(fee) : 'Gratis'}</strong><div class="small muted">${esc(o.description)}${o.freeOver ? ` Fri frakt över ${kr(o.freeOver)}.` : ''}</div>
        <div class="small">Tidigast ${fmtDate(o.earliestDate)}</div></div>
      </label>`;
    }).join('')}</div>
    <label><span>Leveransdag</span><input type="date" name="date" value="${co.date}" min="${opt.earliestDate}" max="${opt.maxDate}" required></label>
    ${opt.hasSlots ? `<span class="small" style="font-weight:500">Tidsfönster</span>
      <div class="slots">${opt.slots.length ? opt.slots.map((s) => `<button type="button" data-slot="${s.id}" class="${s.id === co.slot ? 'active' : ''}">${esc(s.label)}</button>`).join('')
        : '<span class="error">Inga lediga tider den dagen – välj en annan dag.</span>'}</div>` : '<p class="small muted">PostNord delar ut under dagen. Leverans måndag–fredag.</p>'}`;
  $$('input[name="zone"]').forEach((r) => { r.onchange = () => { co.zoneId = r.value; co.slot = null; loadQuote(co.postcode, co.date); }; });
  $('input[name="date"]').onchange = (e) => loadQuote(co.postcode, e.target.value);
  $$('[data-slot]').forEach((b) => { b.onclick = () => { co.slot = b.dataset.slot; renderDeliveryOptions(); }; });
}

async function updatePricing() {
  const co = state.checkout;
  const box = $('#summary');
  if (!box) return;
  try {
    co.pricing = await api('/cart/price', { method: 'POST', body: { items: state.cart, discountCode: co.discountCode, zoneId: co.quote ? co.zoneId : null } });
  } catch (e) {
    box.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    return;
  }
  const p = co.pricing;
  box.innerHTML = `
    <h3>Din beställning</h3>
    ${p.lines.map((l) => `<div class="sum-row"><span>${l.qty} × ${esc(l.name)}</span><span>${kr(l.total)}</span></div>`).join('')}
    <div class="sum-row"><span>Leverans</span><span>${co.quote ? (p.deliveryFee ? kr(p.deliveryFee) : 'Gratis') : '–'}</span></div>
    ${p.discount ? `<div class="sum-row ok"><span>${esc(p.discount.label)} (${esc(p.discount.code)})</span><span>−${kr(p.discount.amount)}</span></div>` : ''}
    <div class="sum-row total"><span>Att betala</span><span>${kr(p.total)}</span></div>
    <p class="coin-hint">+${num(coinsFor(p.productTotal))} 🪙 mynt${state.user?.plus.active ? ' · dubbla med Plus ✨' : ''}</p>
    <div class="discount-row" style="margin-top:12px">
      <input id="discount" placeholder="Rabattkod" value="${esc(co.discountCode)}" aria-label="Rabattkod">
      <button type="button" class="btn ghost sm" id="apply-discount">Använd</button>
    </div>
    ${p.discountError ? `<p class="error small" style="margin-top:6px">${esc(p.discountError)}</p>` : ''}`;
  $('#apply-discount').onclick = () => { co.discountCode = $('#discount').value.trim(); updatePricing(); };
  if (elements && p.total >= 3) elements.update({ amount: p.total * 100 });
}

function collectOrder(wallet) {
  const co = state.checkout;
  const form = $('#co-form');
  const f = Object.fromEntries(new FormData(form));
  const err = (m) => { $('#co-error').textContent = m; return null; };
  $('#co-error').textContent = '';
  if (!co.quote) return err('Ange postnummer och välj leveranssätt.');
  const opt = co.quote.options.find((o) => o.id === co.zoneId);
  if (opt.hasSlots && !co.slot) return err('Välj ett tidsfönster för leveransen.');
  for (const el of $$('input[required]', form)) {
    if (!el.value.trim()) { el.focus(); return err('Fyll i alla obligatoriska fält.'); }
  }
  if (!form.email.checkValidity()) { form.email.focus(); return err('Ange en giltig e-postadress.'); }
  if (co.pricing?.discountError) return err('Ta bort eller ändra rabattkoden.');
  return {
    items: state.cart,
    discountCode: co.discountCode,
    wallet,
    customer: { name: f.name, email: f.email, phone: f.phone },
    delivery: {
      recipient: f.recipient, recipientPhone: f.recipientPhone, address: f.address, postcode: co.postcode, city: f.city,
      message: f.message, instructions: f.instructions, zoneId: co.zoneId, date: co.date, slot: opt.hasSlots ? co.slot : null,
    },
  };
}

function rememberOrder(res) {
  const list = store.get('orders', []);
  list.unshift({ id: res.order.id, t: res.trackingToken, number: res.order.number, date: res.order.delivery.date });
  store.set('orders', list.slice(0, 20));
}

function orderPlaced(res) {
  state.cart = [];
  saveCart();
  state.checkout = { ...state.checkout, discountCode: '', pricing: null };
  location.hash = `#/order/${res.order.id}?t=${encodeURIComponent(res.trackingToken)}`;
  refreshUser();
}

async function payDemo(wallet) {
  const body = collectOrder(wallet);
  if (!body) return;
  $$('[data-demo]').forEach((b) => { b.disabled = true; });
  try {
    const res = await api('/orders', { method: 'POST', body });
    rememberOrder(res);
    if (res.payment.mode === 'demo') await api(`/orders/${res.order.id}/demo-pay`, { method: 'POST', body: { t: res.trackingToken, wallet } });
    orderPlaced(res);
  } catch (e) {
    $('#co-error').textContent = e.message;
    $$('[data-demo]').forEach((b) => { b.disabled = false; });
  }
}

async function setupStripe() {
  const Stripe = await waitForStripe();
  const cfg = state.config.payments;
  if (!Stripe || !cfg.stripePublishableKey) { $('#co-error').textContent = 'Kunde inte ladda betalningen.'; return; }
  stripe = stripe || Stripe(cfg.stripePublishableKey, { locale: 'sv' });
  const amount = Math.max(300, (state.checkout.pricing?.total || cartSubtotal()) * 100);
  elements = stripe.elements({
    mode: 'payment', amount, currency: 'sek',
    appearance: { theme: 'stripe', variables: { colorPrimary: '#b8475f', borderRadius: '12px', fontFamily: 'Inter, system-ui, sans-serif' } },
  });
  const express = elements.create('expressCheckout', {
    paymentMethods: { applePay: 'always', googlePay: 'always', link: 'never', amazonPay: 'never', paypal: 'never' },
    buttonType: { applePay: 'buy', googlePay: 'buy' },
    buttonHeight: 50,
  });
  express.mount('#express');
  express.on('click', (ev) => { if (collectOrder(ev.expressPaymentType)) ev.resolve(); });
  express.on('confirm', (ev) => payStripe(ev.expressPaymentType, ev));
  const card = elements.create('payment', { wallets: { applePay: 'never', googlePay: 'never' }, layout: 'tabs' });
  card.mount('#card-element');
  $('#card-pay').onclick = () => payStripe('card');
}

async function payStripe(wallet, expressEvent) {
  const body = collectOrder(wallet);
  if (!body) { expressEvent?.paymentFailed({ reason: 'invalid_shipping_address' }); return; }
  const btn = $('#card-pay');
  btn.disabled = true;
  try {
    const { error: submitError } = await elements.submit();
    if (submitError) throw new Error(submitError.message);
    const res = await api('/orders', { method: 'POST', body });
    rememberOrder(res);
    if (res.payment.mode === 'stripe') {
      const returnUrl = `${location.origin}/#/order/${res.order.id}?t=${encodeURIComponent(res.trackingToken)}`;
      const { error } = await stripe.confirmPayment({
        elements, clientSecret: res.payment.clientSecret, confirmParams: { return_url: returnUrl }, redirect: 'if_required',
      });
      if (error) throw new Error(error.message);
      await api(`/orders/${res.order.id}/confirm`, { method: 'POST', body: { t: res.trackingToken } });
    }
    orderPlaced(res);
  } catch (e) {
    $('#co-error').textContent = e.message;
    expressEvent?.paymentFailed?.();
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------- tracking
let pollTimer = null;
const FLOW = ['paid', 'preparing', 'out_for_delivery', 'delivered'];

async function viewOrder(id, t) {
  clearTimeout(pollTimer);
  let o;
  try {
    ({ order: o } = await api(`/orders/${id}?t=${encodeURIComponent(t || '')}`));
    if (o.status === 'awaiting_payment' && state.config.payments.mode === 'stripe') {
      ({ order: o } = await api(`/orders/${id}/confirm`, { method: 'POST', body: { t } }));
    }
  } catch (e) {
    view().innerHTML = `<div class="page narrow"><h2>Beställningen hittades inte</h2><p>${esc(e.message)}</p></div>`;
    return;
  }
  const reached = (s) => o.history.find((h) => h.status === s);
  const d = o.delivery;
  view().innerHTML = `
    <div class="page narrow">
      ${o.status === 'paid' ? '<p class="chip sage">Tack för din beställning! 💐</p>' : ''}
      <h1>Beställning #${o.number}</h1>
      <p class="muted">Status: <strong>${esc(o.statusLabel)}</strong></p>
      <div class="card">
        ${o.status === 'cancelled' ? '<p class="error">Beställningen är avbruten. Kontakta oss om du har frågor.</p>'
          : o.status === 'awaiting_payment' ? '<p>Vi väntar på bekräftelse av betalningen …</p>'
          : `<ul class="timeline">${FLOW.map((s) => {
            const h = reached(s);
            const label = { paid: 'Beställning mottagen', preparing: 'Buketten binds', out_for_delivery: d.slotLabel ? 'Budet är på väg' : 'Skickad med PostNord', delivered: 'Levererad' }[s];
            return `<li class="${h ? 'done' : ''}">${label}${h ? ` <span class="small muted">· ${fmtTime(h.at)}</span>` : ''}</li>`;
          }).join('')}</ul>`}
        <div class="sum-row"><span>Leverans</span><strong>${esc(fmtDate(d.date))}${d.slotLabel ? ` kl ${esc(d.slotLabel)}` : ''}</strong></div>
        <div class="sum-row"><span>Till</span><span>${esc(d.recipient)}, ${esc(d.address)}, ${esc(d.postcode)} ${esc(d.city)}</span></div>
        <div class="sum-row"><span>Sätt</span><span>${esc(d.zoneName)}</span></div>
        ${d.message ? `<div class="sum-row"><span>Kort</span><em>”${esc(d.message)}”</em></div>` : ''}
        <hr style="border:0;border-top:1px solid var(--line);margin:12px 0">
        ${o.lines.map((l) => `<div class="sum-row"><span>${l.qty} × ${esc(l.name)}</span><span>${kr(l.total)}</span></div>`).join('')}
        <div class="sum-row"><span>Leverans</span><span>${o.deliveryFee ? kr(o.deliveryFee) : 'Gratis'}</span></div>
        ${o.discount ? `<div class="sum-row ok"><span>${esc(o.discount.label)}</span><span>−${kr(o.discount.amount)}</span></div>` : ''}
        <div class="sum-row total"><span>Betalt</span><span>${kr(o.total)}</span></div>
        ${o.coinsEarned ? `<p class="coin-hint">Du fick ${num(o.coinsEarned)} 🪙 mynt${o.plusBonus ? ' (dubbla med Plus ✨)' : ''}</p>` : ''}
      </div>
      <div id="rate"></div>
    </div>`;
  if (o.canRate) {
    let stars = 0;
    $('#rate').innerHTML = `<div class="card" style="margin-top:16px">
      <h3>Hur blev det?</h3><p class="muted">Ge Jomni Blommor ett betyg.</p>
      <div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" aria-label="${n} stjärnor">★</button>`).join('')}</div>
      <label style="margin-top:10px"><span>Kommentar (valfritt)</span><textarea id="rate-comment" maxlength="500"></textarea></label>
      <button class="btn" id="rate-send" disabled>Skicka betyg</button> <span class="error" id="rate-err"></span></div>`;
    $$('[data-star]').forEach((b) => {
      b.onclick = () => {
        stars = Number(b.dataset.star);
        $$('[data-star]').forEach((x) => x.classList.toggle('on', Number(x.dataset.star) <= stars));
        $('#rate-send').disabled = false;
      };
    });
    $('#rate-send').onclick = async () => {
      try {
        await api(`/orders/${id}/rate`, { method: 'POST', body: { t, stars, comment: $('#rate-comment').value } });
        toast('Tack för ditt betyg! ⭐');
        viewOrder(id, t);
      } catch (e) { $('#rate-err').textContent = e.message; }
    };
  } else if (o.rating) {
    $('#rate').innerHTML = `<p style="margin-top:16px">Ditt betyg: ${'⭐'.repeat(o.rating.stars)}</p>`;
  }
  if (!['delivered', 'cancelled'].includes(o.status)) {
    pollTimer = setTimeout(() => { if (location.hash.includes(id)) viewOrder(id, t); }, o.status === 'awaiting_payment' ? 4000 : 30000);
  }
}

// ---------------------------------------------------------------- konto
function authForm() {
  let tab = 'login';
  const draw = () => {
    view().innerHTML = `
      <div class="page narrow">
        <h2>Ditt konto</h2>
        <p class="muted">Logga in för att samla 🪙 mynt, växla till 💎 diamanter och se dina beställningar.</p>
        <div class="tabs"><button data-tab="login" class="${tab === 'login' ? 'active' : ''}">Logga in</button><button data-tab="register" class="${tab === 'register' ? 'active' : ''}">Skapa konto</button></div>
        <form class="card" id="auth">
          ${tab === 'register' ? '<label><span>Namn</span><input name="name" autocomplete="name" required></label>' : ''}
          <label><span>E-post</span><input name="email" type="email" autocomplete="email" required></label>
          <label><span>Lösenord</span><input name="password" type="password" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}" minlength="8" required></label>
          <p class="error" id="auth-err"></p>
          <button class="btn block">${tab === 'login' ? 'Logga in' : 'Skapa konto'}</button>
        </form>
        ${guestOrders()}
      </div>`;
    $$('[data-tab]').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; draw(); }; });
    $('#auth').onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try {
        const res = await api(`/auth/${tab}`, { method: 'POST', body: f });
        setSession(res.token, res.user);
        toast(tab === 'login' ? `Välkommen tillbaka, ${res.user.name}!` : 'Välkommen till Jomni Blommor! 🌸');
        route();
      } catch (err) { $('#auth-err').textContent = err.message; }
    };
  };
  draw();
}

function guestOrders() {
  const list = store.get('orders', []);
  if (!list.length) return '';
  return `<div class="card" style="margin-top:16px"><h3>Beställningar från den här enheten</h3>
    ${list.map((o) => `<div class="list-item"><span>#${o.number} · ${esc(o.date)}</span><a href="#/order/${esc(o.id)}?t=${encodeURIComponent(o.t)}">Följ</a></div>`).join('')}</div>`;
}

function balancesHTML(u) {
  return `<div class="balances">
    <div class="balance coin"><div class="small">Mynt</div><div class="big">🪙 ${num(u.coins)}</div><div class="small">150 kr = ${num(state.config.loyalty.coinsPer150Kr)} mynt</div></div>
    <div class="balance diamond"><div class="small">Diamanter</div><div class="big">💎 ${num(u.diamonds, 4)}</div><div class="small">20 mynt = ${num(state.config.loyalty.diamondsPer20Coins)} 💎</div></div>
    <div class="balance plus"><div class="small">Jomni Plus</div><div class="big">${u.plus.active ? '✨ Aktiv' : 'Inte aktiv'}</div><div class="small">${u.plus.active ? `${u.plus.cancelAtPeriodEnd ? 'Avslutas' : 'Förnyas'} ${new Date(u.plus.until).toLocaleDateString('sv-SE')}` : `${state.config.plus.priceKr} kr/mån · dubbla mynt`}</div></div>
  </div>`;
}

async function viewAccount() {
  if (!state.token) { authForm(); return; }
  await refreshUser();
  const u = state.user;
  if (!u) { authForm(); return; }
  view().innerHTML = `
    <div class="page">
      <h2>Hej ${esc(u.name)}! 🌷</h2>
      ${balancesHTML(u)}
      <div class="card"><h3>Mina beställningar</h3><div id="my-orders" class="muted">Laddar …</div></div>
      ${u.rewards.length ? `<div class="card" style="margin-top:16px"><h3>Mina belöningskoder</h3>
        ${u.rewards.map((r) => `<div class="list-item"><span>${esc(r.label)}</span><span class="code" style="${r.used ? 'text-decoration:line-through;opacity:.5' : ''}">${esc(r.code)}</span></div>`).join('')}</div>` : ''}
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <a class="btn" href="#/beloningar">Växla mynt & belöningar</a>
        <button class="btn ghost" id="logout">Logga ut</button>
        <button class="btn ghost" id="delete-account" style="color:var(--danger)">Radera konto</button>
      </div>
    </div>`;
  $('#logout').onclick = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setSession(null); route(); };
  $('#delete-account').onclick = async () => {
    const password = prompt('Radera ditt konto för alltid? Mynt, diamanter och belöningskoder försvinner. Skriv ditt lösenord för att bekräfta:');
    if (!password) return;
    try {
      await api('/me', { method: 'DELETE', body: { password } });
      setSession(null);
      toast('Ditt konto är raderat.');
      route();
    } catch (e) { toast(e.message); }
  };
  try {
    const { orders } = await api('/me/orders');
    $('#my-orders').innerHTML = orders.length ? orders.map((o) => `
      <div class="list-item"><div><strong>#${o.number}</strong> · ${o.lines.map((l) => `${l.qty}× ${esc(l.name)}`).join(', ')}<div class="small muted">${esc(fmtDate(o.delivery.date))} · ${esc(o.statusLabel)}</div></div>
      <a class="btn ghost sm" href="#/order/${o.id}?t=${encodeURIComponent(o.trackingToken)}">${o.canRate ? 'Betygsätt' : 'Följ'}</a></div>`).join('')
      : '<p>Inga beställningar ännu.</p>';
  } catch (e) { $('#my-orders').textContent = e.message; }
}

async function viewRewards() {
  await refreshUser();
  const u = state.user;
  const cfg = state.config;
  view().innerHTML = `
    <div class="page">
      <h1>Mynt, diamanter & belöningar</h1>
      <p class="muted">Varje köp ger mynt. Växla mynt till diamanter och lös in dem mot gratis buketter och rabatter.</p>
      <div class="rates">
        <span>🛍️ 150 kr = ${num(cfg.loyalty.coinsPer150Kr)} 🪙</span>
        <span>🪙 20 mynt = ${num(cfg.loyalty.diamondsPer20Coins)} 💎</span>
        <span>✨ Plus = ${cfg.loyalty.plusMultiplier}× mynt</span>
      </div>
      ${u ? balancesHTML(u) : '<div class="card" style="margin:18px 0"><a href="#/konto">Logga in eller skapa konto</a> för att börja samla mynt.</div>'}
      ${u ? `<div class="card" style="margin-bottom:18px">
        <h3>Växla mynt till diamanter</h3>
        <div class="row">
          <label><span>Antal mynt</span><input id="conv-coins" type="number" min="0.001" step="0.001" max="${u.coins}" value="${u.coins}"></label>
          <label><span>Du får</span><input id="conv-preview" disabled></label>
        </div>
        <button class="btn" id="convert" ${u.coins > 0 ? '' : 'disabled'}>Växla</button> <span class="error" id="conv-err"></span>
      </div>` : ''}
      <h2>Belöningar</h2>
      <div class="rewards">${cfg.rewards.map((r) => `
        <div class="card reward">
          <h3 style="margin:0">${esc(r.name)}</h3>
          <div class="chip" style="align-self:flex-start;background:var(--diamond-soft);color:#0f5568">💎 ${num(r.cost, 4)}</div>
          <button class="btn sm" data-redeem="${r.id}" ${u && u.microDiamonds >= r.microCost ? '' : 'disabled'}>Lös in</button>
        </div>`).join('')}
      </div>
      <p class="error" id="redeem-err"></p>
      <div class="card plus-card" style="margin-top:22px">
        <h2>✨ ${esc(cfg.plus.name)}</h2>
        <p class="muted">Dubbla mynt på varje köp. ${cfg.plus.priceKr} kr/mån, avsluta när du vill.</p>
        ${u?.plus.active ? `<p><strong>Du är Plus-medlem!</strong> ${u.plus.cancelAtPeriodEnd ? 'Avslutas' : 'Förnyas'} ${new Date(u.plus.until).toLocaleDateString('sv-SE')}.</p>
          ${u.plus.cancelAtPeriodEnd ? '' : '<button class="btn ghost" id="plus-cancel" style="color:#fff;border-color:#fff6">Avsluta prenumeration</button>'}`
          : `<button class="btn" id="plus-buy" style="background:#fff;color:#7b3148">Prenumerera – ${cfg.plus.priceKr} kr/mån</button>`}
        <p class="error" id="plus-err" style="color:#ffd3dc"></p>
      </div>
    </div>`;
  if (u) {
    const upd = () => { $('#conv-preview').value = `${num((Math.round(Number($('#conv-coins').value) * 1000) * cfg.loyalty.microDiamondsPerMilliCoin) / 1e6, 6)} 💎`; };
    $('#conv-coins').oninput = upd;
    upd();
    $('#convert').onclick = async () => {
      try {
        const coins = Number($('#conv-coins').value);
        const res = await api('/loyalty/convert', coins >= u.coins ? { method: 'POST', body: { all: true } } : { method: 'POST', body: { coins } });
        state.user = res.user;
        toast(`Växlade ${num(res.converted)} mynt till diamanter 💎`);
        viewRewards();
      } catch (e) { $('#conv-err').textContent = e.message; }
    };
  }
  $$('[data-redeem]').forEach((b) => {
    b.onclick = async () => {
      try {
        const res = await api('/loyalty/redeem', { method: 'POST', body: { rewardId: b.dataset.redeem } });
        state.user = res.user;
        state.checkout.discountCode = res.code;
        toast(`${res.label}! Din kod ${res.code} används automatiskt i kassan.`);
        viewRewards();
      } catch (e) { $('#redeem-err').textContent = e.message; }
    };
  });
  const buy = $('#plus-buy');
  if (buy) {
    buy.onclick = async () => {
      if (!u) { location.hash = '#/konto'; return; }
      try {
        const res = await api('/plus/subscribe', { method: 'POST' });
        if (res.checkoutUrl) { location.href = res.checkoutUrl; return; }
        state.user = res.user;
        toast('Välkommen till Jomni Plus! ✨');
        viewRewards();
      } catch (e) { $('#plus-err').textContent = e.message; }
    };
  }
  const cancel = $('#plus-cancel');
  if (cancel) {
    cancel.onclick = async () => {
      if (!confirm('Avsluta Jomni Plus vid periodens slut?')) return;
      try { state.user = (await api('/plus/cancel', { method: 'POST' })).user; viewRewards(); } catch (e) { $('#plus-err').textContent = e.message; }
    };
  }
}

// ---------------------------------------------------------------- router
function route() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const parts = path.split('/').filter(Boolean);
  const q = new URLSearchParams(qs || '');
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', (a.dataset.nav === 'shop' && !parts.length) || a.dataset.nav === parts[0]));
  if (parts[0] !== 'kassa') elements = null;
  window.scrollTo(0, 0);
  switch (parts[0]) {
    case undefined: case 'buketter': return viewShop();
    case 'bukett': return viewProduct(parts[1]);
    case 'kassa': return viewCheckout();
    case 'order': return viewOrder(parts[1], q.get('t'));
    case 'konto': return viewAccount();
    case 'beloningar': return viewRewards();
    default: return viewShop();
  }
}

async function init() {
  $('#cart-btn').onclick = openCart;
  try {
    const [config, { products }] = await Promise.all([api('/config'), api('/products')]);
    state.config = config;
    state.products = products;
  } catch {
    view().innerHTML = '<div class="page"><h2>Butiken är inte nåbar just nu</h2><p>Försök igen om en stund.</p></div>';
    return;
  }
  await refreshUser();
  const params = new URLSearchParams(location.search);
  if (params.get('plus') === 'success' && params.get('session_id') && state.token) {
    try {
      state.user = (await api('/plus/confirm', { method: 'POST', body: { sessionId: params.get('session_id') } })).user;
      toast('Välkommen till Jomni Plus! ✨ Nu får du dubbla mynt.');
    } catch (e) { toast(e.message); }
    history.replaceState(null, '', `/${location.hash}`);
  }
  renderHeader();
  window.addEventListener('hashchange', route);
  route();
}

init();
