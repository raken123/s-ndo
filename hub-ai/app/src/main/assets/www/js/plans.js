/* Plans, engines and credits.
 *
 * Payments are a demo: choosing a plan never charges anything, it only
 * changes what this device unlocks.
 */
(function () {
  'use strict';

  var ENGINES = [
    { id: 'mini', name: 'Hub v1 Mini', kind: 'agent', cost: 1 },
    { id: 'lite', name: 'Hub v1 Lite', kind: 'agent', cost: 1 },
    { id: 'standard', name: 'Hub V1 Standard', kind: 'agent', cost: 2 },
    { id: 'pro', name: 'Hub V1 Pro', kind: 'agent', cost: 3 },
    { id: 'max', name: 'Hub V1 Max', kind: 'agent', cost: 5 },
    { id: 'flash', name: 'Gemini 3.8 Flash', kind: 'gemini', cost: 3 },
    { id: 'gpro', name: 'Gemini 3.8 Pro', kind: 'gemini', cost: 10 }
  ];

  // limits: engine id -> uses per day ("barely" access).
  var PLANS = {
    free: {
      id: 'free', name: 'Hub Free', price: 0, period: '',
      credits: { perDay: 10, perYear: 200 },
      engines: ['mini'], limits: {},
      saveHubs: false, exports: [], publish: false,
      perks: ['10 credits per day, up to 200 per year', 'Hub v1 Mini only', 'Preview hubs (no saving or exports)', 'Browse and share FunHub']
    },
    go: {
      id: 'go', name: 'Hub Go', price: 2, period: 'month',
      credits: { perDay: 100 },
      engines: ['mini', 'lite', 'standard', 'flash'], limits: {},
      saveHubs: true, exports: ['html'], publish: true,
      perks: ['100 credits per day', 'Hub V1 Standard (plus Mini and Lite)', 'Gemini 3.8 Flash', 'Save hubs, HTML export only', 'Publish to FunHub']
    },
    plus: {
      id: 'plus', name: 'Hub Plus', price: 12, period: 'month',
      credits: { perMonth: 1000 },
      engines: ['mini', 'lite', 'standard', 'pro', 'max', 'flash', 'gpro'], limits: { max: 5, gpro: 3 },
      saveHubs: true, exports: ['html', 'zip'], publish: true,
      perks: ['1000 credits per month', 'Hub V1 Pro', 'A little Hub V1 Max (5 per day)', 'A little Gemini 3.8 Pro (3 per day)', 'Everything in Go', 'HTML and ZIP export']
    }
  };

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function usage() {
    var u = Store.get('usage', {}), d = today(), changed = false;
    if (u.day !== d) { u.day = d; u.dayUsed = 0; u.engineDay = {}; changed = true; }
    if (u.month !== d.slice(0, 7)) { u.month = d.slice(0, 7); u.monthUsed = 0; changed = true; }
    if (u.year !== d.slice(0, 4)) { u.year = d.slice(0, 4); u.yearUsed = 0; changed = true; }
    if (changed) Store.set('usage', u);
    return u;
  }

  function sub() {
    var s = Store.get('subscription', null);
    if (!s || !PLANS[s.plan]) s = { plan: 'free' };
    // Demo renewals: a cancelled plan falls back to Free at the end of the
    // period, otherwise it rolls over (no money moves).
    if (s.plan !== 'free' && s.renews && Date.now() > s.renews) {
      if (s.cancelled) s = { plan: 'free' };
      else while (Date.now() > s.renews) { var r = new Date(s.renews); r.setMonth(r.getMonth() + 1); s.renews = r.getTime(); }
      Store.set('subscription', s);
    }
    return s;
  }
  function plan() { return PLANS[sub().plan]; }

  // Credits left right now, and the text that explains the limit.
  function credits() {
    var p = plan(), u = usage(), c = p.credits, left = Infinity, label = [];
    if (c.perDay) { left = Math.min(left, c.perDay - u.dayUsed); label.push(c.perDay + '/day'); }
    if (c.perYear) { left = Math.min(left, c.perYear - u.yearUsed); label.push((c.perYear - u.yearUsed) + ' left this year'); }
    if (c.perMonth) { left = Math.min(left, c.perMonth - u.monthUsed); label.push(c.perMonth + '/month'); }
    return { left: Math.max(0, left), rule: label.join(' · ') };
  }

  function engine(id) {
    for (var i = 0; i < ENGINES.length; i++) if (ENGINES[i].id === id) return ENGINES[i];
    return null;
  }

  // Why an engine can't be used right now, or null if it can.
  function blocked(id) {
    var p = plan(), e = engine(id), u = usage();
    if (p.engines.indexOf(id) < 0) {
      var need = PLANS.go.engines.indexOf(id) >= 0 ? 'Hub Go' : 'Hub Plus';
      return { reason: 'plan', text: e.name + ' needs ' + need + '.' };
    }
    var lim = p.limits[id];
    if (lim && (u.engineDay[id] || 0) >= lim) {
      return { reason: 'limit', text: 'You have used ' + e.name + ' ' + lim + ' times today. It comes back tomorrow.' };
    }
    if (credits().left < e.cost) {
      return { reason: 'credits', text: 'Not enough credits. ' + e.name + ' costs ' + e.cost + '.' };
    }
    return null;
  }

  function spend(id) {
    var e = engine(id), u = usage();
    u.dayUsed += e.cost; u.monthUsed += e.cost; u.yearUsed += e.cost;
    u.engineDay[id] = (u.engineDay[id] || 0) + 1;
    Store.set('usage', u);
  }

  function limitLeft(id) {
    var lim = plan().limits[id];
    return lim ? Math.max(0, lim - (usage().engineDay[id] || 0)) : null;
  }

  function subscribe(id) {
    var next = new Date(); next.setMonth(next.getMonth() + 1);
    var s = id === 'free' ? { plan: 'free' } : { plan: id, since: Date.now(), renews: next.getTime(), demo: true };
    Store.set('subscription', s);
    if (id !== 'free') {
      // A new paid period starts with its full allowance. The yearly Free
      // cap keeps counting.
      var u = usage();
      u.dayUsed = 0; u.monthUsed = 0; u.engineDay = {};
      Store.set('usage', u);
    }
    var receipts = Store.get('receipts', []);
    if (id !== 'free') {
      receipts.unshift({ plan: PLANS[id].name, amount: PLANS[id].price, at: Date.now(), ref: 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase() });
      Store.set('receipts', receipts.slice(0, 20));
    }
    return s;
  }

  function cancel() {
    var s = sub();
    if (s.plan === 'free') return s;
    s.cancelled = true;
    Store.set('subscription', s);
    return s;
  }

  function can(feature) {
    var p = plan();
    if (feature === 'save') return p.saveHubs;
    if (feature === 'publish') return p.publish;
    if (feature === 'export:html') return p.exports.indexOf('html') >= 0;
    if (feature === 'export:zip') return p.exports.indexOf('zip') >= 0;
    return false;
  }

  window.Plans = {
    ENGINES: ENGINES, PLANS: PLANS, plan: plan, sub: sub, credits: credits, engine: engine,
    blocked: blocked, spend: spend, limitLeft: limitLeft, subscribe: subscribe, cancel: cancel, can: can
  };
})();
