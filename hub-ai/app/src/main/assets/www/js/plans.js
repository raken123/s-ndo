/* Plans, engines and credits as the apps show them. The server decides;
 * this reads its last answers (cloud.config / cloud.me) and falls back to
 * the copy shipped in cloud-config.js before the first connection.
 *
 * Payments are a demo: choosing a plan never charges anything.
 */
(function () {
  'use strict';

  function cfg() { return Store.get('cloud.config', null) || window.HUB_CLOUD_CONFIG; }
  function me() { return Store.get('cloud.me', null); }

  function engines() { return cfg().engines; }
  function plans() {
    var out = {};
    cfg().plans.forEach(function (p) { out[p.id] = p; });
    return out;
  }
  function engine(id) { return engines().filter(function (e) { return e.id === id; })[0] || null; }
  function plan() { var m = me(); return plans()[(m && m.plan) || 'free'] || plans().free; }

  // { left: number|null (null = unknown, not connected yet), rule }
  function credits() {
    var m = me();
    return m ? { left: m.credits, rule: m.rule } : { left: null, rule: '' };
  }

  function limitLeft(id) {
    var m = me(), lim = plan().limits[id];
    if (lim === undefined) return null;
    return m && m.limitsLeft && id in m.limitsLeft ? m.limitsLeft[id] : lim;
  }

  // Why an engine can't be used right now, or null. A hint only: the
  // server checks again.
  function blocked(id) {
    var p = plan(), e = engine(id), all = plans();
    if (p.engines.indexOf(id) < 0) {
      if (id === 'v2max') return { reason: 'plan', text: e.name + ' is only for Hub Enterprise customers.' };
      var need = all.go.engines.indexOf(id) >= 0 ? 'Hub Go' : 'Hub Plus';
      return { reason: 'plan', text: e.name + ' needs ' + need + '.' };
    }
    var lim = limitLeft(id);
    if (lim === 0) return { reason: 'limit', text: 'You have used ' + e.name + ' ' + p.limits[id] + ' times today. It comes back tomorrow.' };
    var c = credits();
    if (c.left !== null && c.left < e.cost) return { reason: 'credits', text: 'Not enough credits. ' + e.name + ' costs ' + e.cost + '.' };
    return null;
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
    engines: engines, plans: plans, engine: engine, plan: plan, me: me,
    credits: credits, limitLeft: limitLeft, blocked: blocked, can: can
  };
})();
