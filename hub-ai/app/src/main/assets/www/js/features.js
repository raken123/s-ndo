/* The 20 tools. The catalog (names, which plan unlocks what) comes from
 * Hub AI Cloud; this file holds the parts that run in the app. The cloud
 * ones (Edit with AI, AI Bug Fix, Translate, Data Import) go through
 * /v1/generate.
 */
(function () {
  'use strict';

  function catalog() {
    var c = Store.get('cloud.config', null);
    return (c && c.features) || window.HUB_CLOUD_CONFIG.features;
  }
  function info(id) { return catalog().filter(function (f) { return f.id === id; })[0]; }
  function has(id) {
    var me = Plans.me();
    var list = (me && me.features) || Plans.plan().features || [];
    return list.indexOf(id) >= 0;
  }
  function needs(id) {
    var f = info(id), p = Plans.plans()[f.plan];
    return f.emoji + ' ' + f.name + ' needs ' + p.name + '.';
  }
  function parse(html) { return new DOMParser().parseFromString(html, 'text/html'); }
  function attr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function css(doc) { return Array.prototype.map.call(doc.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n').replace(/\/\*[\s\S]*?\*\//g, ''); }
  function scripts(doc) { return Array.prototype.map.call(doc.querySelectorAll('script:not([src])'), function (s) { return s.textContent; }).join('\n'); }

  // ---------- 📋 Prompt Templates ----------

  var STARTERS = [
    { name: 'Contact form', prompt: 'A contact form with name, email, phone (optional) and message. Validate every field with clear error messages next to it, show a confirmation screen after sending, keep all submissions on this device and let me export them as CSV.' },
    { name: 'Invoice generator', prompt: 'An invoice generator: my company details, customer details, invoice number and date, line items (description, quantity, unit price), VAT rate, subtotal, VAT and total calculated automatically. A clean print layout and a "Print / Save as PDF" button. Remember my company details.' },
    { name: 'Expense tracker', prompt: 'An expense tracker: add expenses with date, amount, category and note; monthly totals per category with a bar chart; filter by month; edit and delete entries; export to CSV. Save everything on the device.' },
    { name: 'Loan calculator', prompt: 'A loan and mortgage calculator: amount, interest rate, term in years and start date. Show the monthly payment, total interest and a full amortization table by month, with a chart of principal vs interest.' },
    { name: 'Inventory list', prompt: 'An inventory manager: items with name, SKU, quantity, location and minimum stock level. Search and sort, quick +/- buttons for quantity, highlight items below minimum, import and export CSV.' },
    { name: 'Appointment booking', prompt: 'An appointment booking page: a week view with 30-minute slots from 9:00 to 17:00, book a slot with name and phone, prevent double booking, list upcoming appointments, cancel a booking. Save on the device.' },
    { name: 'Task board', prompt: 'A project task board with To do, In progress and Done columns. Add tasks with title, owner, due date and priority; move tasks between columns (buttons and drag and drop); highlight overdue tasks; filter by owner. Save on the device.' },
    { name: 'KPI dashboard', prompt: 'A KPI dashboard for a small business: cards for revenue, new customers, average order value and conversion rate with change vs last month, a line chart for revenue over 12 months and a table of top products. Let me edit the numbers and save them.' },
    { name: 'Training quiz', prompt: 'A training quiz for employees: 10 multiple-choice questions, one at a time, with explanations after each answer, a final score with pass/fail at 80%, and a review of wrong answers. Make the questions easy to edit in the code.' },
    { name: 'Time tracker', prompt: 'A time tracker: start and stop timers for projects, manual entries, a daily and weekly summary per project, and CSV export. Save on the device.' },
    { name: 'Customer survey', prompt: 'A customer feedback survey: a 0–10 "How likely are you to recommend us" question, what we do well, what to improve, and optional email. Show the NPS score and all responses in an admin view, export to CSV.' },
    { name: 'Event landing page', prompt: 'A landing page for an event: name, date, time and venue, a countdown, the agenda, speakers with short bios, FAQ in an accordion, and a registration form that saves sign-ups and can export them as CSV.' }
  ];

  // ---------- Export options (per hub) ----------
  // 🏷️ White-label removes the footer; 🛡️ Lockdown adds a
  // Content-Security-Policy that blocks every network request.

  var OPTION_LIST = ['nowatermark', 'security'];
  var OPTION_LABEL = { nowatermark: 'No Hub AI footer', security: 'Block network access' };

  function stripWatermark(html) {
    return html
      .replace(/<footer[^>]*>\s*Made with Hub AI[\s\S]*?<\/footer>/gi, '')
      .replace(/Made with Hub AI(\s*·\s*[^<]*)?/g, '');
  }

  function csp(self) {
    var s = self ? "'self' " : '';
    return "default-src 'none'; script-src " + s + "'unsafe-inline'; style-src 'unsafe-inline'; img-src " + s + 'data: blob:; ' +
      'font-src data:; media-src data: blob:; connect-src ' + (self ? "'self'" : "'none'") + "; form-action 'none'; frame-src 'none'; base-uri 'none'" +
      (self ? "; manifest-src 'self'; worker-src 'self'" : '');
  }

  function withHead(html, tags) {
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, function (h) { return h + tags; });
    if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, function (h) { return h + '<head>' + tags + '</head>'; });
    return tags + html;
  }

  function lockdown(html, self) {
    var clean = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');
    return withHead(clean, '<meta http-equiv="Content-Security-Policy" content="' + csp(self) + '">');
  }

  // The hub as previewed and exported, with the options the plan allows.
  // ctx.pwa: the hub is served as an installable app (needs 'self').
  function apply(html, options, ctx) {
    var out = html;
    (options || []).forEach(function (p) {
      if (!has(p)) return;
      if (p === 'nowatermark') out = stripWatermark(out);
      if (p === 'security') out = lockdown(out, ctx && ctx.pwa);
    });
    return out;
  }

  // ---------- ♿ Accessibility Check ----------

  var NAMED = { white: [255, 255, 255], black: [0, 0, 0], red: [255, 0, 0], gray: [128, 128, 128], grey: [128, 128, 128], silver: [192, 192, 192] };
  function rgb(v) {
    v = String(v || '').trim().toLowerCase();
    var m;
    if ((m = v.match(/^#([0-9a-f]{3})$/))) return m[1].split('').map(function (c) { return parseInt(c + c, 16); });
    if ((m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/))) return [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); });
    if ((m = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?))?\)$/))) {
      if (m[4] !== undefined && parseFloat(m[4]) < (m[4].indexOf('%') > 0 ? 100 : 1)) return null;   // translucent: unknown
      return [+m[1], +m[2], +m[3]];
    }
    return NAMED[v] || null;
  }
  function lum(c) {
    var a = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  // The colour/background pairs the CSS declares, with var(--x) resolved.
  function colorPairs(doc) {
    var text = css(doc), vars = {}, rules = [], m, re = /([^{}]+)\{([^{}]*)\}/g;
    while ((m = re.exec(text))) rules.push({ sel: m[1].trim(), body: m[2] });
    rules.forEach(function (r) { var v, vr = /(--[\w-]+)\s*:\s*([^;]+)/g; while ((v = vr.exec(r.body))) vars[v[1]] = v[2].trim(); });
    function val(body, prop) {
      var mm = body.match(new RegExp('(?:^|[;\\s])' + prop + '\\s*:\\s*([^;]+)', 'i'));
      if (!mm) return null;
      var s = mm[1].replace(/!important/, '').trim();
      for (var i = 0; i < 5 && /var\(/.test(s); i++) s = s.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, function (_, n, d) { return vars[n] || d || ''; });
      var c = s.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black|red|gray|grey|silver)\b/i);
      return c ? rgb(c[0]) : null;
    }
    var page = null;
    rules.forEach(function (r) { if (/(^|,)\s*(html|body|:root)\s*($|,)/.test(r.sel)) page = val(r.body, 'background(?:-color)?') || page; });
    var pairs = [];
    rules.forEach(function (r) {
      var fg = val(r.body, 'color'), bg = val(r.body, 'background(?:-color)?') || page;
      if (fg && bg) pairs.push({ sel: r.sel.replace(/\s+/g, ' ').slice(0, 40), ratio: ratio(fg, bg) });
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[style]'), function (e) {
      var s = e.getAttribute('style'), fg = val(s, 'color'), bg = val(s, 'background(?:-color)?');
      if (fg && bg) pairs.push({ sel: '<' + e.tagName.toLowerCase() + ' style>', ratio: ratio(fg, bg) });
    });
    return pairs;
  }

  function name(e) {
    return (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || e.textContent ||
      Array.prototype.map.call(e.querySelectorAll('img[alt]'), function (i) { return i.alt; }).join('')).trim();
  }

  // Returns [{level: 'error'|'warning', msg, n, how}], errors first.
  function a11y(html) {
    var doc = parse(html), out = [], style = css(doc);
    function add(level, n, msg, how) { if (n) out.push({ level: level, n: n, msg: msg, how: how }); }
    add('error', doc.documentElement.getAttribute('lang') ? 0 : 1, 'The page language is not set.', 'Add lang="en" (or the right language) to the <html> tag so screen readers pronounce it correctly.');
    var vp = doc.querySelector('meta[name=viewport]');
    add('error', vp ? 0 : 1, 'There is no viewport meta tag, so the page will not fit phone screens.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
    add('error', vp && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0*)?(\s|,|$)/i.test(vp.content) ? 1 : 0, 'Zooming is blocked.', 'Remove user-scalable=no and maximum-scale=1 from the viewport tag.');
    add('error', (doc.title || '').trim() ? 0 : 1, 'The page has no title.', 'Add a short, descriptive <title>.');
    add('error', doc.querySelectorAll('img:not([alt]), input[type=image]:not([alt]), area:not([alt])').length, 'Images without a text alternative (alt).', 'Describe each image in alt="…", or use alt="" for decorative ones.');
    var unlabeled = 0, placeholderOnly = 0;
    Array.prototype.forEach.call(doc.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea'), function (e) {
      var ok = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || e.closest('label') ||
        (e.id && doc.querySelector('label[for="' + e.id.replace(/"/g, '\\"') + '"]'));
      if (!ok) { unlabeled++; if (e.getAttribute('placeholder')) placeholderOnly++; }
    });
    add('error', unlabeled, 'Form fields without a label' + (placeholderOnly ? ' (' + placeholderOnly + ' only have a placeholder, which is not a label)' : '') + '.', 'Give every field a <label for="…">, or an aria-label.');
    add('error', Array.prototype.filter.call(doc.querySelectorAll('button, [role=button], a[href]'), function (e) { return !name(e); }).length,
      'Buttons or links without a name.', 'Put text inside, or add aria-label="…" for icon-only buttons.');
    var low = colorPairs(doc).filter(function (p) { return p.ratio < 4.5; });
    add('error', low.length, 'Text with too little contrast against its background: ' + low.slice(0, 3).map(function (p) {
      return p.sel + ' (' + p.ratio.toFixed(1) + ':1)'; }).join(', ') + (low.length > 3 ? ', …' : '') + '.', 'Normal text needs a contrast ratio of at least 4.5:1.');
    var ids = {}, dup = 0;
    Array.prototype.forEach.call(doc.querySelectorAll('[id]'), function (e) { if (ids[e.id]) dup++; ids[e.id] = 1; });
    add('error', dup, 'Duplicate id attributes.', 'Every id must be unique; labels and scripts can point at the wrong element.');
    add('warning', /outline\s*:\s*(none|0)\b/i.test(style) && !/:focus(-visible)?[^{]*\{[^}]*(outline|box-shadow|border)/i.test(style) ? 1 : 0,
      'The focus outline is removed and nothing replaces it.', 'Keyboard users need to see focus. Add a :focus-visible style.');
    add('warning', doc.querySelector('h1') ? 0 : 1, 'There is no main heading (h1).', 'Start the page with one <h1> naming it.');
    var last = 0, skips = 0;
    Array.prototype.forEach.call(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'), function (h) { var l = +h.tagName[1]; if (last && l > last + 1) skips++; last = l; });
    add('warning', skips, 'Heading levels are skipped (for example h1 then h3).', 'Use heading levels in order so the outline makes sense.');
    add('warning', doc.querySelectorAll('[onclick]:not(button):not(a):not(input):not([role]):not([tabindex])').length, 'Clickable elements that a keyboard cannot reach.', 'Use <button> for actions, or add role="button" and tabindex="0".');
    add('warning', doc.querySelectorAll('video[autoplay]:not([muted]), audio[autoplay]').length, 'Media that plays sound automatically.', 'Let the user start audio themselves.');
    add('warning', doc.querySelectorAll('[tabindex]').length && Array.prototype.filter.call(doc.querySelectorAll('[tabindex]'), function (e) { return +e.getAttribute('tabindex') > 0; }).length,
      'Positive tabindex values change the keyboard order.', 'Use tabindex="0" or "-1" only.');
    return out.sort(function (a, b) { return a.level === b.level ? 0 : a.level === 'error' ? -1 : 1; });
  }

  // ---------- 📊 Performance Report ----------

  function external(doc, html) {
    var list = [];
    Array.prototype.forEach.call(doc.querySelectorAll('script[src], link[href], img[src], iframe[src], audio[src], video[src], source[src], embed[src], object[data]'), function (e) {
      var u = e.getAttribute('src') || e.getAttribute('href') || e.getAttribute('data');
      if (e.tagName === 'LINK' && !/stylesheet|icon|preload|manifest/i.test(e.getAttribute('rel') || '')) return;
      if (/^(https?:)?\/\//i.test(u)) list.push(e.tagName.toLowerCase() + ': ' + u);
    });
    var m, re = /url\(\s*["']?((?:https?:)?\/\/[^"')\s]+)|@import\s+["']((?:https?:)?\/\/[^"']+)/gi;
    while ((m = re.exec(css(doc)))) list.push('css: ' + (m[1] || m[2]));
    void html;
    return list;
  }

  function report(html) {
    var doc = parse(html), js = scripts(doc), st = css(doc), bytes = new Blob([html]).size;
    var depth = 0;
    (function walk(e, d) { if (d > depth) depth = d; for (var c = e.firstElementChild; c; c = c.nextElementSibling) walk(c, d + 1); })(doc.documentElement, 1);
    var dataUris = html.match(/data:[^"')\s]{200,}/g) || [];
    var dataBytes = dataUris.reduce(function (a, s) { return a + s.length; }, 0);
    var ext = external(doc, html);
    var timers = [], m, tr = /setInterval\s*\([\s\S]{0,400}?,\s*(\d+)\s*\)/g;
    while ((m = tr.exec(js))) timers.push(+m[1]);
    var r = {
      title: (doc.title || '').trim(), kb: Math.round(bytes / 102.4) / 10, lines: html.split('\n').length,
      elements: doc.querySelectorAll('*').length, depth: depth, jsKb: Math.round(new Blob([js]).size / 102.4) / 10,
      cssKb: Math.round(new Blob([st]).size / 102.4) / 10, mediaKb: Math.round(dataBytes / 102.4) / 10,
      external: ext, network: /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/.test(js),
      storage: /localStorage|indexedDB|sessionStorage/.test(js), handlers: (html.match(/\son[a-z]+\s*=/gi) || []).length
    };
    var w = [];
    if (r.kb > 500) w.push('The file is ' + r.kb + ' KB. Over 500 KB loads slowly on mobile data.');
    if (r.mediaKb > 200) w.push(r.mediaKb + ' KB of embedded images or media. Compress them or use SVG.');
    if (ext.length) w.push(ext.length + ' external request' + (ext.length > 1 ? 's' : '') + ': the hub needs a connection and will not work offline.');
    if (r.network) w.push('The code calls the network (fetch, XMLHttpRequest or WebSocket).');
    if (r.elements > 1500) w.push(r.elements + ' elements. Over 1,500 makes layout and scrolling slow.');
    if (depth > 32) w.push('Elements are nested ' + depth + ' levels deep. Deep nesting slows down rendering.');
    if (timers.some(function (x) { return x < 100; })) w.push('A timer runs faster than every 100 ms, which drains the battery. Use requestAnimationFrame for animation.');
    if (/document\.write\s*\(/.test(js)) w.push('document.write is used; it blocks rendering.');
    if (/@import/i.test(st)) w.push('CSS @import delays the first paint.');
    r.warnings = w;
    return r;
  }

  // ---------- 🛡️ Security Scan ----------

  function scan(html) {
    var doc = parse(html), js = scripts(doc) + '\n' + Array.prototype.map.call(doc.querySelectorAll('*'), function (e) {
      return Array.prototype.filter.call(e.attributes, function (a) { return /^on/i.test(a.name); }).map(function (a) { return a.value; }).join('\n');
    }).join('\n'), out = [];
    function add(level, n, msg) { if (n) out.push({ level: level, n: n, msg: msg }); }
    var count = function (re) { return (js.match(re) || []).length; };
    add('high', doc.querySelectorAll('script[src]').length, 'Loads scripts from other servers. They can change at any time and read everything on the page.');
    add('high', count(/\bfetch\s*\(|new\s+XMLHttpRequest|new\s+WebSocket|new\s+EventSource|sendBeacon\s*\(/g), 'Sends or receives data over the network.');
    add('high', Array.prototype.filter.call(doc.querySelectorAll('form[action]'), function (f) { return /^(https?:)?\/\//i.test(f.getAttribute('action')); }).length, 'Forms that submit to another website.');
    var ext = external(doc, html).filter(function (u) { return u.indexOf('script:') !== 0; });
    add('medium', ext.length, 'Loads styles, fonts, images or frames from other servers (they see who opens the hub).');
    add('medium', count(/\beval\s*\(|new\s+Function\s*\(|set(?:Timeout|Interval)\s*\(\s*["'`]/g), 'Runs code from strings (eval, new Function).');
    add('medium', count(/document\.cookie/g), 'Reads or writes cookies.');
    add('medium', (html.match(/["'(]http:\/\/[^"')\s]+/gi) || []).length, 'Uses insecure http:// addresses.');
    add('low', count(/\.innerHTML\s*\+?=|insertAdjacentHTML\s*\(/g), 'Inserts HTML from code. Make sure user input is never inserted this way (use textContent).');
    add('low', doc.querySelectorAll('a[target=_blank]:not([rel~=noopener]):not([rel~=noreferrer])').length, 'Links open new tabs without rel="noopener".');
    add('low', count(/postMessage\s*\([^)]*["']\*["']/g), 'Sends messages to any window (postMessage with "*").');
    var order = { high: 0, medium: 1, low: 2 };
    return out.sort(function (a, b) { return order[a.level] - order[b.level]; });
  }

  // ---------- 🔎 SEO & Share Tags ----------

  function seoRead(html) {
    var doc = parse(html), meta = function (sel) { var e = doc.querySelector(sel); return e ? e.getAttribute('content') || '' : ''; };
    return { title: (doc.title || '').trim(), description: meta('meta[name=description]'), color: meta('meta[name=theme-color]') || '#0d0d0d' };
  }

  function seoApply(html, s) {
    var t = attr(s.title), d = attr(s.description);
    var out = html.replace(/<meta[^>]+(name|property)=["']?(description|og:[\w:]+|twitter:[\w:]+|theme-color)["']?[^>]*>\s*/gi, '');
    if (/<title[^>]*>[\s\S]*?<\/title>/i.test(out)) out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, '<title>' + t + '</title>');
    else out = withHead(out, '<title>' + t + '</title>');
    var tags = '<meta name="description" content="' + d + '"><meta property="og:type" content="website">' +
      '<meta property="og:title" content="' + t + '"><meta property="og:description" content="' + d + '">' +
      '<meta name="twitter:card" content="summary"><meta name="twitter:title" content="' + t + '"><meta name="twitter:description" content="' + d + '">' +
      (/^#[0-9a-f]{3,8}$/i.test(s.color || '') ? '<meta name="theme-color" content="' + s.color + '">' : '');
    return out.replace(/<\/title>/i, '</title>' + tags);
  }

  // ---------- 📎 Data Import ----------

  var MAX_DATA = 100 * 1024;
  function readData(file) {
    return new Promise(function (resolve, reject) {
      if (!/\.(csv|tsv|json|txt)$/i.test(file.name)) return reject(new Error('Use a CSV, TSV, JSON or TXT file.'));
      if (file.size > MAX_DATA) return reject(new Error('Data files can be up to 100 KB (this one is ' + Math.ceil(file.size / 1024) + ' KB).'));
      var r = new FileReader();
      r.onload = function () {
        var text = String(r.result);
        if (/\.json$/i.test(file.name)) { try { JSON.parse(text); } catch (e) { return reject(new Error('That JSON file is not valid: ' + e.message)); } }
        var rows = text.split(/\r?\n/).filter(function (l) { return l.trim(); }).length;
        resolve({ name: file.name, text: text, kb: Math.ceil(file.size / 1024), rows: rows });
      };
      r.onerror = function () { reject(new Error('Could not read the file.')); };
      r.readAsText(file);
    });
  }

  // ---------- 🧩 Embed Code ----------

  function embed(html, title) {
    return '<iframe title="' + attr(title) + '" style="width:100%;height:640px;border:0;border-radius:12px" ' +
      'sandbox="allow-scripts allow-forms allow-modals" srcdoc="' + html.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></iframe>';
  }

  // ---------- 🔐 Password Protection ----------
  // A self-contained SHA-256 (it must also run inside the exported file, where
  // crypto.subtle may be missing), used to stretch the password and as a
  // counter-mode keystream. The loader carries the same code.

  var SHA = 'function sha256(m){var K=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],' +
    'H=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],l=m.length,n=((l+9+63)>>6)<<6,b=new Uint8Array(n),w=new Uint32Array(64),i,j;b.set(m);b[l]=128;var bl=l*8;' +
    'b[n-4]=bl>>>24;b[n-3]=bl>>>16&255;b[n-2]=bl>>>8&255;b[n-1]=bl&255;b[n-5]=(l/536870912)>>>0;for(i=0;i<n;i+=64){for(j=0;j<16;j++)w[j]=b[i+4*j]<<24|b[i+4*j+1]<<16|b[i+4*j+2]<<8|b[i+4*j+3];' +
    'for(j=16;j<64;j++){var x=w[j-15],y=w[j-2];w[j]=(((x>>>7|x<<25)^(x>>>18|x<<14)^x>>>3)+w[j-7]+((y>>>17|y<<15)^(y>>>19|y<<13)^y>>>10)+w[j-16])|0}' +
    'var a=H[0],c=H[1],d=H[2],e=H[3],f=H[4],g=H[5],h=H[6],k=H[7];for(j=0;j<64;j++){var t1=(k+((f>>>6|f<<26)^(f>>>11|f<<21)^(f>>>25|f<<7))+(f&g^~f&h)+K[j]+w[j])|0,' +
    't2=(((a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10))+(a&c^a&d^c&d))|0;k=h;h=g;g=f;f=(e+t1)|0;e=d;d=c;c=a;a=(t1+t2)|0}' +
    'H[0]=H[0]+a|0;H[1]=H[1]+c|0;H[2]=H[2]+d|0;H[3]=H[3]+e|0;H[4]=H[4]+f|0;H[5]=H[5]+g|0;H[6]=H[6]+h|0;H[7]=H[7]+k|0}' +
    'var o=new Uint8Array(32);for(i=0;i<8;i++){o[4*i]=H[i]>>>24;o[4*i+1]=H[i]>>>16&255;o[4*i+2]=H[i]>>>8&255;o[4*i+3]=H[i]&255}return o}' +
    'function cat(a,b){var o=new Uint8Array(a.length+b.length);o.set(a);o.set(b,a.length);return o}' +
    'function stretch(pw,salt,n){var k=sha256(cat(salt,new TextEncoder().encode(pw)));for(var i=0;i<n;i++)k=sha256(cat(k,salt));return k}' +
    'function xor(key,data){var o=new Uint8Array(data.length),c=new Uint8Array(4);for(var i=0;i<data.length;i+=32){var n=i/32;c[0]=n>>>24;c[1]=n>>>16&255;c[2]=n>>>8&255;c[3]=n&255;' +
    'var s=sha256(cat(key,c));for(var j=0;j<32&&i+j<data.length;j++)o[i+j]=data[i+j]^s[j]}return o}';
  // eslint-disable-next-line no-new-func
  var lib = new Function(SHA + 'return {sha256:sha256,cat:cat,stretch:stretch,xor:xor};')();
  var ROUNDS = 40000;

  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function hex(u8) { return Array.prototype.map.call(u8, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }

  function lock(html, password, title) {
    var salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    var key = lib.stretch(password, salt, ROUNDS);
    var check = hex(lib.sha256(lib.cat(key, new TextEncoder().encode('hub-ai-check'))));
    var data = b64(lib.xor(key, new TextEncoder().encode(html)));
    var t = String(title || 'Protected hub').replace(/[<&"]/g, '');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>🔐 ' + t + '</title>' +
      '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0d0d;color:#ececec;font:16px system-ui,sans-serif}' +
      'form{width:min(320px,90vw);text-align:center}input,button{font:inherit;width:100%;box-sizing:border-box;padding:12px;border-radius:10px;margin-top:10px}' +
      'input{background:#161616;color:#ececec;border:1px solid #2b2b2b}button{background:#ececec;color:#0d0d0d;border:0;font-weight:600}p{color:#8d8d8d;min-height:20px}</style></head>' +
      '<body><form id="f"><h1 style="font-size:20px">🔐 ' + t + '</h1><label for="p" style="display:block;text-align:left;margin-top:10px">Password</label>' +
      '<input id="p" type="password" autocomplete="current-password" autofocus><button>Open</button><p id="m" role="status"></p></form>' +
      '<script>' + SHA + 'var SALT="' + b64(salt) + '",CHECK="' + check + '",N=' + ROUNDS + ',DATA="' + data + '";' +
      'function un(s){var b=atob(s),o=new Uint8Array(b.length);for(var i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}' +
      'function hx(u){return Array.prototype.map.call(u,function(x){return("0"+x.toString(16)).slice(-2)}).join("")}' +
      'document.getElementById("f").onsubmit=function(e){e.preventDefault();var m=document.getElementById("m");m.textContent="Unlocking…";setTimeout(function(){' +
      'var k=stretch(document.getElementById("p").value,un(SALT),N);if(hx(sha256(cat(k,new TextEncoder().encode("hub-ai-check"))))!==CHECK){m.textContent="Wrong password.";return}' +
      'var h=new TextDecoder().decode(xor(k,un(DATA)));document.open();document.write(h);document.close()},30)};</script></body></html>';
  }

  // ---------- 📲 Installable App ----------

  function inject(html, snippet) {
    var i = html.search(/<\/body>/i);
    return i < 0 ? html + snippet : html.slice(0, i) + snippet + html.slice(i);
  }

  function pwaFiles(html, title, color) {
    var name = String(title || 'Hub').slice(0, 40);
    var accent = color || '#3b74d9';
    var page = withHead(html, '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#0d0d0d">' +
      '<link rel="icon" href="icon.svg"><link rel="apple-touch-icon" href="icon.svg"><meta name="apple-mobile-web-app-capable" content="yes">');
    page = inject(page, '<script>if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(function(){});</script>');
    var letter = (name.match(/[A-Za-z0-9]/) || ['H'])[0].toUpperCase();
    return [
      { name: 'index.html', data: page },
      { name: 'manifest.webmanifest', data: JSON.stringify({
        name: name, short_name: name.slice(0, 12), start_url: './', display: 'standalone',
        background_color: '#0d0d0d', theme_color: '#0d0d0d',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      }, null, 2) },
      { name: 'sw.js', data: 'var C="hub-v1",F=["./","index.html","manifest.webmanifest","icon.svg"];' +
        'self.addEventListener("install",function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(F)}))});' +
        'self.addEventListener("fetch",function(e){e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request)}))});' },
      { name: 'icon.svg', data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#0d0d0d"/>' +
        '<text x="256" y="340" font-size="260" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" fill="' + accent + '">' + letter + '</text></svg>' },
      { name: 'README.txt', data: name + ' — an installable app made with Hub AI.\n\nPut these files on any HTTPS web host (GitHub Pages, Netlify, ...).\n' +
        'Open the page on a phone and choose "Add to Home Screen" / "Install app". It then works offline.\n' }
    ];
  }

  // ---------- 🎨 Brand Kit ----------

  function brand() { return Store.get('brandkit', { on: false, name: '', color: '#3b74d9' }); }
  function brandPrompt(prompt) {
    var b = brand();
    if (!b.on || !b.name || !has('brandkit')) return prompt;
    return prompt + '\n\nBrand kit: this hub is for ' + b.name + '. Use ' + b.color + ' as the main accent colour and show "' + b.name + '" in the header.';
  }

  window.Features = {
    catalog: catalog, info: info, has: has, needs: needs,
    STARTERS: STARTERS, OPTION_LIST: OPTION_LIST, OPTION_LABEL: OPTION_LABEL, apply: apply, stripWatermark: stripWatermark,
    a11y: a11y, report: report, scan: scan, csp: csp, lockdown: lockdown, seoRead: seoRead, seoApply: seoApply,
    readData: readData, MAX_DATA: MAX_DATA, embed: embed, lock: lock, pwaFiles: pwaFiles, brand: brand, brandPrompt: brandPrompt,
    LANGUAGES: ['English', 'Swedish', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Japanese', 'Korean', 'Chinese', 'Arabic', 'Hindi', 'Turkish', 'Polish', 'Dutch', 'Finnish'],
    _lib: lib
  };
})();
