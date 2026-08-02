/* gmfy — free-tier watermark + rotating in-app ad banner.
 *
 * The Free plan shows a "made with gmfy" watermark over the viewport and a
 * banner that rotates through demo ads for made-up products. Any paid plan
 * removes both. The brands here are fictional placeholders — not real ads.
 */
(function (global) {
  'use strict';

  // demo ad creatives: brand, tagline, accent colour, and a category label
  var ADS = [
    { b: 'Tendar',       t: 'Try Tendar Today',              c: '#ff4d6d', k: 'dating' },
    { b: 'Blorbo',       t: 'Blorbo Energy — never sleep',   c: '#22d3ee', k: 'drink'  },
    { b: 'NimbusVPN',    t: 'Go invisible with NimbusVPN',   c: '#7c5cff', k: 'app'    },
    { b: 'SnackRocket',  t: 'Snacks in 8 minutes. Order now',c: '#f5c542', k: 'food'   },
    { b: 'Castle Clashers', t: 'Build. Battle. Play free',   c: '#3ddc84', k: 'game'   },
    { b: 'GlowUp',       t: 'Your GlowUp starts tonight',    c: '#ec4899', k: 'beauty' },
    { b: 'PigeonPay',    t: 'Send money by pigeon 🐦',        c: '#22d3ee', k: 'fintech'},
    { b: 'MegaMattress', t: 'Sleep like a rock — 60% off',   c: '#7c5cff', k: 'retail' },
    { b: 'TaxGremlin',   t: 'File your taxes in 3 taps',     c: '#3ddc84', k: 'app'    },
    { b: 'DoorDish',     t: 'DoorDish delivers dinner fast', c: '#ff7a3d', k: 'food'   },
    { b: 'Lingoo',       t: 'Speak 40 languages with Lingoo',c: '#f5c542', k: 'learn'  },
    { b: 'RiftRunner',   t: 'Download RiftRunner — free',    c: '#ec4899', k: 'game'   },
    { b: 'CloudCat',     t: 'Back up everything to CloudCat',c: '#7c5cff', k: 'app'    },
    { b: 'ZoomiScooters',t: 'Unlock a ride for $1',          c: '#22d3ee', k: 'travel' },
    { b: 'Munchr',       t: 'Swipe. Match. Eat. Munchr.',    c: '#ff4d6d', k: 'food'   },
    { b: 'HyperFit',     t: '30-day body with HyperFit',     c: '#3ddc84', k: 'health' }
  ];

  var idx = 0, timer = null;

  function isFree() {
    return !global.GmfyPlans || global.GmfyPlans.current().id === 'free';
  }

  // a rewarded-ad unlock (via GmfyFree) can hide these for the session
  function wmLocked() {
    return global.GmfyFree ? global.GmfyFree.locked('watermark') : isFree();
  }
  function bannerLocked() {
    return global.GmfyFree ? global.GmfyFree.locked('bannerads') : isFree();
  }

  function paint() {
    var bar = document.getElementById('adbar');
    var wm = document.getElementById('watermark');
    if (!bar) return;
    if (wm) wm.style.display = wmLocked() ? 'block' : 'none';
    if (!bannerLocked()) { bar.style.display = 'none'; stop(); return; }
    bar.style.display = 'flex';
    var a = ADS[idx % ADS.length];
    var dot = bar.querySelector('.ad-dot');
    if (dot) dot.style.background = a.c;
    var brand = bar.querySelector('.ad-brand');
    if (brand) { brand.textContent = a.b; brand.style.color = a.c; }
    var tag = bar.querySelector('.ad-tag');
    if (tag) tag.textContent = a.t;
  }

  function start() {
    idx = 0;
    paint();
    if (timer) clearInterval(timer);
    if (bannerLocked()) timer = setInterval(function () { idx++; paint(); }, 4500);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  global.GmfyPromos = { ADS: ADS, start: start, stop: stop, refresh: paint };
})(window);
