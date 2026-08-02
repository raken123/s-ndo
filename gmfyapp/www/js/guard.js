/* gmfy — free-tier ad-integrity guard.
 *
 * The free plan is ad-supported, so blocking the ads breaks the deal. If an ad
 * blocker (or a flagged VPN) is detected, free access is paused for one hour.
 * Paid plans are exempt — they have no ads to block.
 *
 * Honesty notes:
 *   - Ad-block detection is a real client-side check: a bait element with
 *     ad-ish classes is hidden/removed by blocker filter lists, so if it ends
 *     up zero-height we treat that as "blocker present".
 *   - VPN detection is NOT reliable in a browser; it truly needs a server that
 *     sees the connecting IP. We expose the hook and the ban, but only trip it
 *     on an explicit signal (window.__gmfyVPN or localStorage gmfy.simVPN),
 *     rather than guessing from the timezone and banning real users by mistake.
 */
(function (global) {
  'use strict';

  var BAN_MS = 60 * 60 * 1000;         // one hour
  var K_BAN = 'gmfy.ban.v1';

  function isFree() {
    return !global.GmfyPlans || global.GmfyPlans.current().id === 'free';
  }

  // ---- ad-block detection via a bait element ----
  function adblocked() {
    var bait = document.getElementById('ad-slot');
    if (!bait) {
      bait = document.createElement('div');
      bait.id = 'ad-slot';
      bait.className = 'adsbox ad-banner ads ad sponsored pub_300x250';
      bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;' +
                           'width:300px;height:120px;pointer-events:none';
      bait.innerHTML = '&nbsp;';
      document.body.appendChild(bait);
    }
    // a blocker sets display:none / removes it / collapses its box
    var s = getComputedStyle(bait);
    return !bait.offsetParent && bait.offsetHeight === 0 ||
           s.display === 'none' || s.visibility === 'hidden' || bait.clientHeight === 0;
  }

  // ---- VPN: only via an explicit signal (see note above) ----
  function vpnFlagged() {
    if (global.__gmfyVPN) return true;
    try { return localStorage.getItem('gmfy.simVPN') === '1'; } catch (e) { return false; }
  }

  function banUntil() {
    try { return parseInt(localStorage.getItem(K_BAN) || '0', 10) || 0; }
    catch (e) { return 0; }
  }

  function ban(reason) {
    var until = Date.now() + BAN_MS;
    try { localStorage.setItem(K_BAN, String(until)); } catch (e) {}
    try { localStorage.setItem(K_BAN + '.why', reason); } catch (e) {}
    show();
  }

  function reason() {
    try { return localStorage.getItem(K_BAN + '.why') || 'ad blocker'; }
    catch (e) { return 'ad blocker'; }
  }

  var ticker = null;
  function show() {
    var ov = document.getElementById('ban');
    if (!ov) return;
    ov.classList.add('on');
    var why = document.getElementById('ban-why');
    if (why) why.textContent = 'We detected a ' + reason() + '.';
    tick();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, 1000);
  }

  function hide() {
    var ov = document.getElementById('ban');
    if (ov) ov.classList.remove('on');
    if (ticker) { clearInterval(ticker); ticker = null; }
  }

  function tick() {
    var left = banUntil() - Date.now();
    if (left <= 0) { clear(); hide(); return; }
    var el = document.getElementById('ban-timer');
    if (el) {
      var m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    }
  }

  function clear() {
    try { localStorage.removeItem(K_BAN); localStorage.removeItem(K_BAN + '.why'); }
    catch (e) {}
  }

  // Returns true if currently banned (and shows the wall).
  function check() {
    if (!isFree()) { hide(); return false; }       // paid = exempt
    if (banUntil() > Date.now()) { show(); return true; }
    var why = null;
    if (global.__gmfyForceBlock || adblocked()) why = 'ad blocker';
    else if (vpnFlagged()) why = 'VPN';
    if (why) { ban(why); return true; }
    return false;
  }

  function wire() {
    var rc = document.getElementById('ban-recheck');
    if (rc) rc.onclick = function () {
      // let them turn the blocker off and re-check; if the hour isn't up the
      // ban still stands (that's the point), but an expired ban clears here.
      if (banUntil() <= Date.now()) { clear(); hide(); }
      else tick();
    };
  }

  global.GmfyGuard = { check: check, wire: wire, ban: ban, clear: clear,
                       banUntil: banUntil, adblocked: adblocked };
})(window);
