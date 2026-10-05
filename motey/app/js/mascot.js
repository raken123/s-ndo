/* Motey – the speech-bubble mascot.
 * One SVG, drawn as a real illustration of the hand-drawn sketch:
 * a chat bubble with a tail, two big oval eyes and a small smile.
 * CSS classes drive blinking, floating and talking (see motey.css). */
(function () {
  'use strict';
  let uid = 0;

  // Bubble body with the tail at the lower left, like the sketch.
  const BODY = 'M100 20C152 20 184 50 184 88C184 127 151 153 104 155' +
    'C92 155 81 153 71 150L45 178C40 183 33 179 35 173L45 142' +
    'C27 130 16 111 16 88C16 50 48 20 100 20Z';

  function svg(opts) {
    opts = opts || {};
    const id = 'mt' + (++uid);
    const mood = opts.mood || 'happy';         // happy | wow | worried | wink
    const cls = ['motey-svg'];
    if (opts.animate !== false) cls.push('is-alive');
    if (opts.talking) cls.push('is-talking');
    if (opts.className) cls.push(opts.className);
    const size = opts.size || 120;
    const brow = mood === 'worried'
      ? '<path class="mt-brow" d="M60 58l26-9M140 58l-26-9" stroke="#1E1B3A" stroke-width="6" stroke-linecap="round" fill="none"/>' : '';
    const leftEye = mood === 'wink'
      ? '<path d="M62 86q16-14 32 0" class="mt-wink" stroke="#1E1B3A" stroke-width="7" stroke-linecap="round" fill="none"/>'
      : `<g class="mt-eye"><ellipse cx="78" cy="82" rx="15.5" ry="${mood === 'wow' ? 26 : 23}" fill="#1E1B3A"/>` +
        '<circle cx="72.5" cy="71" r="5.5" fill="#fff"/><circle cx="82" cy="92" r="2.6" fill="#fff" opacity=".85"/></g>';
    const rightEye = `<g class="mt-eye"><ellipse cx="122" cy="82" rx="15.5" ry="${mood === 'wow' ? 26 : 23}" fill="#1E1B3A"/>` +
      '<circle cx="116.5" cy="71" r="5.5" fill="#fff"/><circle cx="126" cy="92" r="2.6" fill="#fff" opacity=".85"/></g>';
    const mouth = mood === 'wow'
      ? '<ellipse class="mt-mouth-o" cx="100" cy="121" rx="7" ry="8" fill="#1E1B3A"/>'
      : '<path class="mt-smile" d="M89 118q11 10 22 0" stroke="#1E1B3A" stroke-width="5.5" stroke-linecap="round" fill="none"/>' +
        '<ellipse class="mt-talk" cx="100" cy="122" rx="9" ry="7" fill="#1E1B3A" opacity="0"/>';
    return `<svg class="${cls.join(' ')}" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="Motey">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E9E4FF"/>
    </linearGradient>
    <radialGradient id="${id}s" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#1E1B3A" stop-opacity=".22"/><stop offset="1" stop-color="#1E1B3A" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse class="mt-shadow" cx="104" cy="190" rx="54" ry="7" fill="url(#${id}s)"/>
  <g class="mt-body">
    <path d="${BODY}" fill="url(#${id}g)" stroke="#1E1B3A" stroke-width="7" stroke-linejoin="round"/>
    <path d="M44 62C52 44 70 34 92 32" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".9"/>
    ${brow}
    <g class="mt-eyes">${leftEye}${rightEye}</g>
    <ellipse cx="58" cy="110" rx="11" ry="6" fill="#FF8FB1" opacity=".55"/>
    <ellipse cx="142" cy="110" rx="11" ry="6" fill="#FF8FB1" opacity=".55"/>
    ${mouth}
  </g>
</svg>`;
  }

  function logo(opts) {
    opts = opts || {};
    return `<span class="motey-logo">${svg({ size: opts.size || 34, animate: opts.animate })}` +
      `<span class="motey-word">Motey</span></span>`;
  }

  window.Mascot = { svg, logo, BODY };
})();
