/* The Agenter mascot, inline so it also renders from file:// in the desktop
 * builds where fetching an external SVG is blocked. Gradient and filter ids are
 * suffixed per instance — several copies share one document. */
window.AGENTER = window.AGENTER || {};

(function () {
  'use strict';
  var n = 0;

  AGENTER.robotSVG = function (opts) {
    opts = opts || {};
    var u = 'r' + (++n);
    var id = function (s) { return s + u; };

    return '' +
'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Agenter">' +
  '<defs>' +
    '<linearGradient id="' + id('bg') + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#6366f1"/><stop offset=".55" stop-color="#4f46e5"/>' +
      '<stop offset="1" stop-color="#06b6d4"/></linearGradient>' +
    '<linearGradient id="' + id('shell') + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6ebff"/></linearGradient>' +
    '<radialGradient id="' + id('bulb') + '" cx=".4" cy=".35" r=".75">' +
      '<stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#fbbf24"/></radialGradient>' +
    '<filter id="' + id('glow') + '" x="-60%" y="-60%" width="220%" height="220%">' +
      '<feGaussianBlur stdDeviation="12" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
  '</defs>' +
  (opts.bare ? '' : '<rect width="512" height="512" rx="112" fill="url(#' + id('bg') + ')"/>') +
  '<g filter="url(#' + id('glow') + ')"><circle cx="256" cy="76" r="22" fill="url(#' + id('bulb') + ')"/></g>' +
  '<rect x="248" y="92" width="16" height="54" rx="8" fill="#c7d2fe"/>' +
  '<rect x="58" y="232" width="36" height="92" rx="18" fill="#c7d2fe"/>' +
  '<rect x="418" y="232" width="36" height="92" rx="18" fill="#c7d2fe"/>' +
  '<rect x="88" y="138" width="336" height="276" rx="74" fill="url(#' + id('shell') + ')"/>' +
  '<rect x="130" y="184" width="252" height="150" rx="58" fill="#1b2136"/>' +
  '<g filter="url(#' + id('glow') + ')">' +
    '<circle cx="212" cy="259" r="33" fill="#22d3ee"/>' +
    '<circle cx="300" cy="259" r="33" fill="#22d3ee"/></g>' +
  '<circle cx="201" cy="247" r="11" fill="#fff" opacity=".95"/>' +
  '<circle cx="289" cy="247" r="11" fill="#fff" opacity=".95"/>' +
  '<ellipse cx="146" cy="364" rx="25" ry="14" fill="#fca5a5" opacity=".8"/>' +
  '<ellipse cx="366" cy="364" rx="25" ry="14" fill="#fca5a5" opacity=".8"/>' +
  '<path d="M212 366 Q256 396 300 366" stroke="#8b93ad" stroke-width="13" ' +
        'stroke-linecap="round" fill="none"/>' +
'</svg>';
  };

  AGENTER.paintRobot = function (el, opts) {
    if (el) el.innerHTML = AGENTER.robotSVG(opts);
  };
})();
