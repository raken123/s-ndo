/* Hub v1 agents: on-device inference for the models trained by
 * training/train.py (window.HUB_MODELS, from models/models.js).
 *
 * features() and the scoring arithmetic mirror train.py exactly, so a model
 * answers the same in Python and in the app. "Teach" adds labelled examples
 * on the device; they are replayed on top of the Python-trained counts.
 */
(function () {
  'use strict';

  var TOKEN = /[a-z0-9]+/g;
  var cache = {};

  function features(text, model) {
    var stop = model._stop;
    var words = (String(text).toLowerCase().match(TOKEN) || []).filter(function (w) { return !stop[w]; });
    var f = words.slice();
    if (model.ngram >= 2) for (var i = 0; i + 1 < words.length; i++) f.push(words[i] + '_' + words[i + 1]);
    return f;
  }

  function taught(tier) { return Store.get('teach.' + tier, []); }

  function build(tier) {
    var src = (window.HUB_MODELS || {})[tier];
    if (!src) throw new Error('Model ' + tier + ' is missing');
    var m = {
      tier: tier, label: src.label, ngram: src.ngram, alpha: src.alpha, features: src.features,
      labels: src.labels.slice(), names: src.label_names, metrics: src.metrics, version: src.version,
      vocab: src.vocab.slice(), docs: src.docs.slice(), _stop: {}, index: {}, counts: []
    };
    src.stopwords.forEach(function (w) { m._stop[w] = 1; });
    m.vocab.forEach(function (f, i) { m.index[f] = i; });
    m.counts = src.counts.map(function (c) {
      var o = {}; for (var k in c) o[+k] = c[k]; return o;
    });
    var extra = taught(tier);
    extra.forEach(function (ex) { add(m, ex.text, ex.label); });
    m.taught = extra.length;
    finish(m);
    return m;
  }

  function add(m, text, label) {
    var li = m.labels.indexOf(label);
    if (li < 0) return;
    m.docs[li]++;
    features(text, m).forEach(function (f) {
      if (!(f in m.index)) { m.index[f] = m.vocab.length; m.vocab.push(f); }
      var i = m.index[f];
      m.counts[li][i] = (m.counts[li][i] || 0) + 1;
    });
  }

  function finish(m) {
    var v = m.vocab.length, a = m.alpha, n = 0, k = m.labels.length;
    m.docs.forEach(function (d) { n += d; });
    m.prior = m.docs.map(function (d) { return Math.log((d + 1) / (n + k)); });
    m.denom = m.counts.map(function (c) {
      var t = 0; for (var i in c) t += c[i];
      return Math.log(t + a * v);
    });
  }

  function model(tier) {
    if (!cache[tier]) cache[tier] = build(tier);
    return cache[tier];
  }

  function classify(tier, text) {
    var m = model(tier);
    var ids = features(text, m).filter(function (f) { return f in m.index; }).map(function (f) { return m.index[f]; });
    var s = m.labels.map(function (_, li) {
      var x = m.prior[li], c = m.counts[li];
      for (var j = 0; j < ids.length; j++) x += Math.log((c[ids[j]] || 0) + m.alpha) - m.denom[li];
      return x;
    });
    var top = Math.max.apply(null, s), z = 0;
    s.forEach(function (x) { z += Math.exp(x - top); });
    var ranked = m.labels.map(function (l, i) { return { label: l, p: Math.exp(s[i] - top) / z }; })
      .sort(function (a, b) { return b.p - a.p; });
    return { label: ranked[0].label, confidence: ranked[0].p, ranked: ranked.slice(0, 3), known: ids.length };
  }

  var COLORS = {
    red: '#d94848', orange: '#e07b2a', yellow: '#c9a227', gold: '#c9a227', green: '#2f9e5b',
    teal: '#1f9c94', cyan: '#1a9fbf', blue: '#3b74d9', navy: '#2c4a8a', purple: '#7d55c7',
    violet: '#7d55c7', pink: '#d2558f', brown: '#8a5a3c', gray: '#6f7782', grey: '#6f7782'
  };
  var DEFAULT_ACCENT = '#3b74d9';

  function titleCase(s) {
    return s.replace(/\s+/g, ' ').trim().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  // Reads what it can from the request. The tier decides what is used.
  function extract(text) {
    var t = String(text), lower = t.toLowerCase(), out = {};
    var m = t.match(/\b(?:called|named|titled)\s+["“']?([^"”'.,!?\n]{2,40})/i) || t.match(/["“]([^"”]{2,40})["”]/);
    if (m) out.title = m[1].trim();
    for (var c in COLORS) if (new RegExp('\\b' + c + '\\b').test(lower)) { out.accent = COLORS[c]; break; }
    var hex = t.match(/#[0-9a-f]{6}\b/i);
    if (hex) out.accent = hex[0];
    if (/\b(light|white|bright)\s*(mode|theme|background)?\b/.test(lower) && !/\bdark\b/.test(lower)) out.dark = false;
    var d = lower.match(/\bd(4|6|8|10|12|20|100)\b/);
    var n = lower.match(/\b(\d{1,4})\b/);
    if (d) out.n = +d[1]; else if (n) out.n = +n[1];
    var tp = lower.match(/\b(?:about|on|until|till|to|for)\s+(?:the\s+|my\s+|our\s+|a\s+)?([a-z][a-z' ]{2,30}?)(?=\s+(?:with|in|that|called|named|titled|for|and)\b|[.,!?]|$)/);
    if (tp && !/^(me|kids|work|school|my phone|the gym|my family|you)$/.test(tp[1])) out.topic = titleCase(tp[1]);
    return out;
  }

  function generate(tier, text, opts) {
    opts = opts || {};
    var m = model(tier), has = {};
    m.features.forEach(function (f) { has[f] = true; });
    var cls = classify(tier, text), got = extract(text), name = m.names[cls.label];
    var notes = [];
    var title = has.title && got.title ? got.title
      : got.topic && (cls.label === 'quiz' || cls.label === 'flashcards') ? got.topic + ' ' + name
      : cls.label === 'landing' && got.topic ? got.topic : name;
    var p = {
      title: title,
      accent: has.accent && got.accent ? got.accent : DEFAULT_ACCENT,
      dark: has.theme && got.dark === false ? false : true,
      persist: !!has.persist,
      extras: !!has.extras,
      n: has.numbers && got.n ? got.n : null,
      topic: got.topic || '',
      key: 'hub-' + (opts.id || Date.now().toString(36)),
      engine: m.label
    };
    if (cls.confidence < 0.5 || cls.known === 0) {
      notes.push(m.label + ' was not sure what you meant and built a ' + name.toLowerCase() + '. It knows ' +
        m.labels.length + ' hub types; higher tiers know more.');
    }
    if (got.title && !has.title) notes.push(m.label + ' ignores custom titles. Standard and up use them.');
    if (got.accent && !has.accent) notes.push(m.label + ' ignores colours. Lite and up use them.');
    return {
      type: cls.label, typeName: name, title: title, confidence: cls.confidence,
      html: HubTemplates.render(cls.label, p), notes: notes, engine: m.label
    };
  }

  function teach(tier, text, label) {
    var list = taught(tier);
    list.push({ text: String(text).slice(0, 300), label: label, at: Date.now() });
    Store.set('teach.' + tier, list);
    delete cache[tier];
    return model(tier);
  }

  function forget(tier) {
    Store.set('teach.' + tier, []);
    delete cache[tier];
  }

  window.HubAgent = {
    tiers: ['mini', 'lite', 'standard', 'pro', 'max'],
    model: model, classify: classify, extract: extract, generate: generate,
    teach: teach, forget: forget, taught: taught, features: function (tier, t) { return features(t, model(tier)); }
  };
})();
