/* gmfy — full-screen video ad interstitial for the free tier.
 *
 * Free users see a 30-second video spot (fictional brands) before their game
 * plays, with a "Skip in Ns" countdown that becomes a skip button, and a
 * "Remove ads" shortcut to the Plan tab. Paid plans never see it.
 *
 * Sources: the app bundles the clips at ad/<id>.mp4. The single-file HTML build
 * has no files, so it injects window.GMFY_VIDEO = {id: "data:video/mp4;..."} and
 * we prefer that when present — same trick export.js uses for its runtime.
 */
(function (global) {
  'use strict';

  var CLIPS = ['tendar', 'snackrocket', 'riftrunner', 'nimbusfit',
               'bloomly', 'vaultly', 'pixelpaws', 'zenote'];
  var SKIP_AFTER = 5;      // seconds before Skip is allowed
  // start somewhere random so a session doesn't always open on the same spot,
  // then rotate so you never get the same clip twice in a row
  var idx = Math.floor(Math.random() * CLIPS.length);

  function isFree() {
    return !global.GmfyPlans || global.GmfyPlans.current().id === 'free';
  }

  function srcFor(id) {
    var pre = global.GMFY_VIDEO;
    if (pre && pre[id]) return pre[id];      // data URI in the standalone build
    return 'ad/' + id + '.mp4';              // bundled file in the APK
  }

  // Play an ad, then call done(). Free tier only; otherwise done() immediately.
  function beforePlay(done) {
    if (!isFree()) { done(); return; }
    var ov = document.getElementById('vad');
    var v = document.getElementById('vad-v');
    var skip = document.getElementById('vad-skip');
    if (!ov || !v) { done(); return; }

    var id = CLIPS[idx % CLIPS.length]; idx++;
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      try { v.pause(); } catch (e) {}
      ov.classList.remove('on');
      done();
    }

    v.src = srcFor(id);
    v.currentTime = 0;
    v.muted = true;                          // autoplay needs muted
    ov.classList.add('on');
    var p = v.play();
    if (p && p.catch) p.catch(function () {});

    // skip countdown
    var left = SKIP_AFTER;
    skip.textContent = 'Skip in ' + left;
    skip.classList.remove('ready');
    var timer = setInterval(function () {
      left--;
      if (left > 0) { skip.textContent = 'Skip in ' + left; }
      else {
        clearInterval(timer);
        skip.textContent = 'Skip ✕';
        skip.classList.add('ready');
      }
    }, 1000);

    skip.onclick = function () {
      if (!skip.classList.contains('ready')) return;
      clearInterval(timer); finish();
    };
    v.onended = function () { clearInterval(timer); finish(); };
  }

  // Rewarded ad: must watch to the end (skip only after 25s) to earn the unlock.
  // reward(id) is called only if the clip completes; onClose always runs after.
  function rewarded(unlockId, reward, onClose) {
    var ov = document.getElementById('vad');
    var v = document.getElementById('vad-v');
    var skip = document.getElementById('vad-skip');
    if (!ov || !v) { if (reward) reward(); if (onClose) onClose(); return; }

    var id = CLIPS[idx % CLIPS.length]; idx++;
    var earned = false, closed = false;
    function close(gotReward) {
      if (closed) return; closed = true;
      try { v.pause(); } catch (e) {}
      ov.classList.remove('on');
      if (gotReward && reward) reward();
      if (onClose) onClose();
    }

    v.src = srcFor(id); v.currentTime = 0; v.muted = true;
    ov.classList.add('on');
    var p = v.play(); if (p && p.catch) p.catch(function () {});

    var left = 25;                      // rewarded: long gate, meant to be watched
    skip.textContent = 'Reward in ' + left;
    skip.classList.remove('ready');
    var timer = setInterval(function () {
      left--;
      if (left > 0) skip.textContent = 'Reward in ' + left;
      else { clearInterval(timer); skip.textContent = 'Close ✕'; skip.classList.add('ready'); }
    }, 1000);

    skip.onclick = function () {
      if (!skip.classList.contains('ready')) return;
      clearInterval(timer); close(earned);
    };
    v.onended = function () {
      earned = true; clearInterval(timer);
      skip.textContent = 'Claim reward ✓'; skip.classList.add('ready');
    };
  }

  function wire() {
    var rm = document.getElementById('vad-remove');
    if (rm) rm.onclick = function () {
      var v = document.getElementById('vad-v');
      if (v) { try { v.pause(); } catch (e) {} }
      document.getElementById('vad').classList.remove('on');
      if (document.getElementById('app').classList.contains('big'))
        document.getElementById('tools-toggle').click();
      var plan = document.querySelector('.tab[data-pane="plan"]');
      if (plan) plan.click();
    };
  }

  global.GmfyVideoAds = { beforePlay: beforePlay, rewarded: rewarded,
                          wire: wire, clips: CLIPS };
})(window);
