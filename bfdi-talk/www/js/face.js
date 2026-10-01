// Expressions: which eye set and which mouths (by loudness) each emotion uses.
// Sprite numbers refer to www/assets/eyes/eyes_NN.png and www/assets/mouths/mouth_NN.png
// (see tools/slice_assets.py for how they are cut from the sheets).
//
// mouths: [closed, small, medium, wide]  — picked from the live voice volume.
// round:  optional "oo" mouth used for dark/round vowel sounds.

export const EXPRESSIONS = {
  neutral:    { eyes: 15, mouths: [0, 18, 15, 17], round: 24 },
  happy:      { eyes: 2,  mouths: [1, 7, 4, 5],    round: 24 },
  excited:    { eyes: 2,  mouths: [29, 7, 6, 30] },
  laughing:   { eyes: 16, mouths: [8, 4, 9, 30], alt: 21 },
  sad:        { eyes: 14, mouths: [11, 27, 24, 23] },
  angry:      { eyes: 8,  mouths: [25, 26, 21, 23] },
  furious:    { eyes: 10, mouths: [26, 25, 21, 23] },
  surprised:  { eyes: 0,  mouths: [24, 27, 24, 23] },
  scared:     { eyes: 17, mouths: [20, 28, 20, 22] },
  nervous:    { eyes: 12, mouths: [10, 28, 20, 22] },
  thinking:   { eyes: 7,  mouths: [13, 27, 15, 16], round: 24 },
  confused:   { eyes: 6,  mouths: [13, 27, 24, 16] },
  smug:       { eyes: 3,  mouths: [13, 19, 18, 3] },
  annoyed:    { eyes: 4,  mouths: [14, 19, 18, 16] },
  bored:      { eyes: 1,  mouths: [0, 27, 15, 15],  round: 24 },
  determined: { eyes: 9,  mouths: [3, 19, 16, 17] },
  shy:        { eyes: 5,  mouths: [1, 28, 19, 7] },
  content:    { eyes: 11, mouths: [1, 7, 4, 5] },
  dizzy:      { eyes: 20, mouths: [12, 27, 24, 23] },
  // special states (not offered to the AI)
  knockedOut: { eyes: 13, mouths: [12, 12, 12, 12] },
  sleepy:     { eyes: 19, mouths: [0, 27, 24, 24] },
};

export const AI_EMOTIONS = Object.keys(EXPRESSIONS).filter(k => !['knockedOut', 'sleepy'].includes(k));

const BLINK_EYES = 18;
// Eye sets that are already closed / special and should not blink.
const NO_BLINK = new Set([11, 13, 16, 18, 19, 20, 21]);

const EYE_COUNT = 23;
const MOUTH_COUNT = 31;
const SPRITE_SCALE = 3; // sprites were exported at 3x sheet size

const pad = n => String(n).padStart(2, '0');
export const eyeSrc = i => `assets/eyes/eyes_${pad(i)}.png`;
export const mouthSrc = i => `assets/mouths/mouth_${pad(i)}.png`;

/** Loads every sprite once so swaps never flicker, and records natural sizes. */
export async function preloadSprites() {
  const load = src => new Promise(res => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth / SPRITE_SCALE, h: img.naturalHeight / SPRITE_SCALE, img });
    img.onerror = () => res({ w: 100, h: 60, img });
    img.src = src;
  });
  const [eyes, mouths] = await Promise.all([
    Promise.all(Array.from({ length: EYE_COUNT }, (_, i) => load(eyeSrc(i)))),
    Promise.all(Array.from({ length: MOUTH_COUNT }, (_, i) => load(mouthSrc(i)))),
  ]);
  return { eyes, mouths };
}

/**
 * Drives the <image> elements of the face: emotion, blinking and lip-sync.
 * `level` (0..1 loudness) and `round` (true for "oo"-like sounds) come from the audio analyser.
 */
export class Face {
  constructor({ eyesEl, mouthEl, sprites, eyeAnchor, mouthAnchor, eyeScale = 1.9, mouthScale = 0.95 }) {
    Object.assign(this, { eyesEl, mouthEl, sprites, eyeAnchor, mouthAnchor, eyeScale, mouthScale });
    this.emotion = 'neutral';
    this.slot = 0;            // 0 closed, 1 small, 2 medium, 3 wide, 'round'
    this.slotSince = 0;
    this.blinkUntil = 0;
    this.nextBlink = performance.now() + 2500;
    this.altEyes = false;
    this.lastEye = -1;
    this.lastMouth = -1;
    this.render(performance.now());
  }

  setEmotion(name) {
    if (!EXPRESSIONS[name]) return;
    this.emotion = name;
    this.altEyes = false;
  }

  /** Called every animation frame. */
  update(now, level, round) {
    const expr = EXPRESSIONS[this.emotion];
    // Lip-sync: pick a mouth slot from loudness with a little hysteresis + min hold so it doesn't flicker.
    let target;
    if (level < 0.12) target = 0;
    else if (level < 0.32) target = 1;
    else if (level < 0.6) target = 2;
    else target = 3;
    if (round && target >= 2 && expr.round != null) target = 'round';
    const held = now - this.slotSince;
    if (target !== this.slot && (held > 70 || target === 0 && held > 40)) {
      this.slot = target;
      this.slotSince = now;
      if (expr.alt != null && target === 3) this.altEyes = !this.altEyes;
    }

    // Blinking.
    if (now > this.nextBlink) {
      this.blinkUntil = now + 130;
      this.nextBlink = now + 2200 + Math.random() * 3800;
    }
    this.render(now);
  }

  render(now) {
    const expr = EXPRESSIONS[this.emotion];
    let eye = this.altEyes && expr.alt != null ? expr.alt : expr.eyes;
    if (now < this.blinkUntil && !NO_BLINK.has(eye)) eye = BLINK_EYES;
    const mouth = this.slot === 'round' ? expr.round : expr.mouths[this.slot];

    if (eye !== this.lastEye) {
      this.lastEye = eye;
      this.place(this.eyesEl, eyeSrc(eye), this.sprites.eyes[eye], this.eyeAnchor, this.eyeScale, 'eyes');
    }
    if (mouth !== this.lastMouth) {
      this.lastMouth = mouth;
      this.place(this.mouthEl, mouthSrc(mouth), this.sprites.mouths[mouth], this.mouthAnchor, this.mouthScale, 'mouth');
    }
  }

  place(el, src, size, anchor, scale, kind) {
    const w = size.w * scale, h = size.h * scale;
    el.setAttribute('href', src);
    el.setAttribute('width', w);
    el.setAttribute('height', h);
    el.setAttribute('x', anchor.x - w / 2);
    // Eye sets share one canvas, so top-align them; mouths are centred on their anchor.
    el.setAttribute('y', kind === 'eyes' ? anchor.y - h * (92 / 110) : anchor.y - h / 2);
  }
}
