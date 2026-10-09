import { api, esc, toast } from './api.js';

export async function renderPricing(el, meInfo, { onChange } = {}) {
  const { plans, billingMode } = await api('/api/plans');
  const current = meInfo?.user?.plan;
  el.innerHTML = plans.map((p) => `
    <div class="plan ${p.id === 'pro' ? 'hot' : ''} ${p.id === current ? 'current' : ''}">
      ${p.id === 'pro' ? '<div class="ribbon">Most popular</div>' : ''}
      <h3>${esc(p.name)}</h3>
      <div class="tag">${esc(p.tagline)}</div>
      <div class="price">$${p.price}<small>/mo</small></div>
      <ul>${p.highlights.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${planButton(p, current)}
    </div>`).join('');

  el.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', async () => {
    if (!meInfo?.user) { location.href = '/signup'; return; }
    b.disabled = true;
    try {
      const r = await api('/api/billing/plan', { method: 'POST', body: { plan: b.dataset.plan } });
      toast(r.granted ? `Switched to ${r.plan.name}. +${r.granted} credits` : `Switched to ${r.plan.name}`, 'ok');
      meInfo.user = r.user;
      meInfo.plan = r.plan;
      await renderPricing(el, meInfo, { onChange });
      onChange?.(r);
    } catch (err) {
      toast(err.message, 'error');
      b.disabled = false;
    }
  }));
  if (billingMode === 'demo' && meInfo?.user && !el.nextElementSibling?.classList?.contains('demo-note')) {
    el.insertAdjacentHTML('afterend', '<p class="sub demo-note" style="font-size:12px;margin-top:14px">Demo billing: plan changes apply instantly with no payment. Connect a payment provider before launch.</p>');
  }
}

function planButton(p, current) {
  if (!current) return `<a class="btn ${p.id === 'pro' ? 'btn-primary' : ''}" href="/signup">${p.price ? 'Choose ' + esc(p.name) : 'Start free'}</a>`;
  if (p.id === current) return '<button class="btn" disabled>Current plan</button>';
  return `<button class="btn ${p.id === 'pro' ? 'btn-primary' : ''}" data-plan="${p.id}">Switch to ${esc(p.name)}</button>`;
}
