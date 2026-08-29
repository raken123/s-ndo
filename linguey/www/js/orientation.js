/* ==========================================================================
   Linguey — porträttspärr för bonuslektioner
   Bonuslektioner MÅSTE spelas i porträttläge. Vi låser orienteringen via
   cordova-plugin-screen-orientation när det finns, och visar dessutom alltid
   en spärr som pausar 3D-spelet om enheten ändå hamnar i liggande läge
   (t.ex. på enheter/emulatorer där låsning inte går igenom).
   ========================================================================== */
window.LINGUEY_ORIENTATION = (function () {
  'use strict';

  var inBonus = false;

  function so() {
    return (window.screen && window.screen.orientation) ? window.screen.orientation : null;
  }

  function lockPortrait() {
    var o = so();
    if (o && typeof o.lock === 'function') {
      try {
        var p = o.lock('portrait');
        if (p && typeof p.catch === 'function') p.catch(function () { /* spärren tar över */ });
      } catch (e) { /* spärren tar över */ }
    }
  }

  function unlockOrientation() {
    var o = so();
    if (o && typeof o.unlock === 'function') {
      try { o.unlock(); } catch (e) {}
    }
  }

  function isLandscape() {
    /* Fönstrets form är den mest tillförlitliga signalen: den följer det
       användaren faktiskt ser (och funkar även i delad skärm). Orienterings-
       API:et används bara när formatet är nästan kvadratiskt. */
    var w = window.innerWidth, h = window.innerHeight;
    if (w > h * 1.05) return true;
    if (h > w * 1.05) return false;

    var o = so();
    if (o && typeof o.type === 'string') return o.type.indexOf('landscape') === 0;
    if (typeof window.orientation === 'number') return Math.abs(window.orientation) === 90;
    return w > h;
  }

  function evaluate() {
    var gate = document.getElementById('rotate-gate');
    if (!gate) return;
    var bad = inBonus && isLandscape();
    gate.classList.toggle('show', bad);
    if (window.LINGUEY_3D) window.LINGUEY_3D.setPaused(bad);
  }

  function enterBonus() {
    inBonus = true;
    lockPortrait();
    evaluate();
  }

  function exitBonus() {
    inBonus = false;
    unlockOrientation();
    var gate = document.getElementById('rotate-gate');
    if (gate) gate.classList.remove('show');
  }

  window.addEventListener('resize', evaluate, false);
  window.addEventListener('orientationchange', function () { setTimeout(evaluate, 120); }, false);
  if (so() && so().addEventListener) {
    so().addEventListener('change', function () { setTimeout(evaluate, 120); }, false);
  }

  return {
    enterBonus: enterBonus,
    exitBonus: exitBonus,
    isLandscape: isLandscape,
    evaluate: evaluate,
    inBonus: function () { return inBonus; }
  };
})();
