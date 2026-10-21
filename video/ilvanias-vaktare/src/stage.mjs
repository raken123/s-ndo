// Kamera, lager och typsnitt som scenerna delar.
import { GlobalFonts } from '@napi-rs/canvas';
import { createRequire } from 'node:module';
import path from 'node:path';
import { W, H, canvas } from './lib.mjs';

const require = createRequire(import.meta.url);
const font = (pkg, file, name) => {
  const dir = path.dirname(require.resolve(`${pkg}/package.json`));
  GlobalFonts.registerFromPath(path.join(dir, 'files', file), name);
  return `"${name}"`;
};
export const FONT = {
  cinzel: font('@fontsource/cinzel', 'cinzel-latin-700-normal.woff2', 'Cinzel Bold'),
  cormorant: font('@fontsource/cormorant-garamond', 'cormorant-garamond-latin-600-normal.woff2', 'Cormorant SemiBold'),
  cormorantItalic: font('@fontsource/cormorant-garamond', 'cormorant-garamond-latin-500-italic.woff2', 'Cormorant Italic'),
};

// Långsam kameraåkning: zoom z kring bildens mitt, förskjutning x/y i pixlar.
export function camera(ctx, { z = 1, x = 0, y = 0 }) {
  ctx.translate(W / 2 + x, H / 2 + y);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
}

// Ritar draw() i ett eget lager (samma kamera) och lägger det ovanpå,
// eventuellt suddigt eller halvgenomskinligt.
const pool = [];
let depth = 0;
export function layer(ctx, draw, { blur = 0, alpha = 1, composite = 'source-over' } = {}) {
  if (!pool[depth]) pool[depth] = canvas(W, H);
  const c = pool[depth++];
  const lc = c.getContext('2d');
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.clearRect(0, 0, W, H);
  lc.setTransform(ctx.getTransform());
  lc.save();
  draw(lc);
  lc.restore();
  depth--;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = composite;
  if (blur > 0.5) {
    // skala upp lite så att de suddiga kanterna hamnar utanför bilden
    const m = 1 + blur / 400;
    ctx.filter = `blur(${blur.toFixed(1)}px)`;
    ctx.drawImage(c, -W * (m - 1) / 2, -H * (m - 1) / 2, W * m, H * m);
  } else {
    ctx.drawImage(c, 0, 0);
  }
  ctx.restore();
}

// Ritar draw() och behåller bara det som syns genom masken mask(ctx).
export function masked(ctx, draw, mask, { composite = 'source-over', alpha = 1 } = {}) {
  if (!pool[depth]) pool[depth] = canvas(W, H);
  const c = pool[depth++];
  const lc = c.getContext('2d');
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.clearRect(0, 0, W, H);
  lc.setTransform(ctx.getTransform());
  lc.save();
  draw(lc);
  lc.restore();
  lc.save();
  lc.globalCompositeOperation = 'destination-in';
  mask(lc);
  lc.restore();
  depth--;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = composite;
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}
