/* What's new: the first thing the app shows after an update. The five Max &
 * Minnie videos about it, in a swipeable full-screen feed. Shown once per
 * update (and any time from Settings).
 */
(function () {
  'use strict';

  var VERSION = 'v2';
  var ITEMS = [
    ['agents', 'Meet the new Hub V1 agents', 'Spark and Flux are fast, Volt and Prism are smart, Titan is a genius, and Pixel makes pictures.'],
    ['studio', 'Animations', 'Describe it and it moves. Export it as a video for your feed.'],
    ['pitch', 'Slides and HTML cards', 'Pitch decks with charts, plus invitations, greetings and business cards.'],
    ['lab', '3D models and UI designs', 'Spin and zoom a 3D model, download it as GLB or OBJ, and get the app screens too.'],
    ['photo', 'Photo edits and much more', 'Edit a photo by describing it. Games, websites, logos, diagrams, documents: 13 things to make.']
  ];

  var root = null, io = null, onClose = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function open(done) {
    if (root) return;
    onClose = done || null;
    root = document.createElement('div');
    root.className = 'wn';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'What\'s new in Hub AI');
    root.innerHTML = '<div class="wn-top"><b>What\'s new</b><span class="grow"></span>' +
      '<button class="wn-btn" id="wnSound" aria-pressed="false">🔇 Sound</button><button class="wn-btn" id="wnSkip">Skip</button></div>' +
      '<div class="wn-feed" id="wnFeed">' + ITEMS.map(function (it, i) {
        return '<section class="wn-item" data-i="' + i + '"><video src="media/whatsnew/' + it[0] + '.mp4" poster="media/whatsnew/' + it[0] + '.jpg" ' +
          'playsinline loop muted preload="metadata" aria-label="' + esc(it[1]) + ' video"></video>' +
          '<div class="wn-info"><div class="wn-count">' + (i + 1) + ' / ' + ITEMS.length + '</div><h2>' + esc(it[1]) + '</h2><p>' + esc(it[2]) + '</p>' +
          (i === ITEMS.length - 1 ? '<button class="btn primary block" id="wnGo">Start creating</button>' : '<div class="wn-next">Swipe up for more ↑</div>') +
          '</div></section>';
      }).join('') + '</div>';
    document.body.appendChild(root);
    var vids = Array.prototype.slice.call(root.querySelectorAll('video')), sound = false;
    function playOnly(v) {
      vids.forEach(function (x) { if (x !== v) x.pause(); });
      if (!v) return;
      v.muted = !sound;
      var p = v.play();
      if (p && p.catch) p.catch(function () { v.muted = true; sound = false; mark(); v.play().catch(function () {}); });
    }
    function visible() {
      var feed = root.querySelector('#wnFeed'), i = Math.round(feed.scrollTop / Math.max(1, feed.clientHeight));
      return vids[Math.max(0, Math.min(vids.length - 1, i))];
    }
    function mark() {
      var b = root.querySelector('#wnSound');
      b.textContent = sound ? '🔊 Sound' : '🔇 Sound';
      b.setAttribute('aria-pressed', String(sound));
    }
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) playOnly(e.target.querySelector('video')); });
      }, { root: root.querySelector('#wnFeed'), threshold: 0.6 });
      Array.prototype.forEach.call(root.querySelectorAll('.wn-item'), function (s) { io.observe(s); });
    } else playOnly(vids[0]);
    root.querySelector('#wnSound').onclick = function () { sound = !sound; mark(); playOnly(visible()); };
    vids.forEach(function (v) { v.onclick = function () { if (v.paused) playOnly(v); else v.pause(); }; });
    root.querySelector('#wnSkip').onclick = close;
    root.querySelector('#wnGo').onclick = close;
  }

  function close() {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('video'), function (v) { v.pause(); v.removeAttribute('src'); v.load(); });
    if (io) io.disconnect();
    root.remove();
    root = null; io = null;
    Store.set('whatsnew', VERSION);
    if (onClose) onClose();
  }

  window.WhatsNew = {
    open: open,
    close: close,
    isOpen: function () { return !!root; },
    // The first thing after the update; not again once seen.
    maybeOpen: function (done) { if (Store.get('whatsnew', null) !== VERSION) open(done); }
  };
})();
