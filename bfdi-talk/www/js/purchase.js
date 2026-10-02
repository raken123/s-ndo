// Usage Credits: the user pays on itch.io, then uploads a screenshot of the payment.
// Gemini 3.8 Flash reads the screenshot and reports what it shows; we accept it when it is an
// itch.io payment for BFDI Talk of at least $5. $1 = 60 Usage Credits (1 minute of Flash Live).

import { USAGE } from './usage.js';

export const STORE_URL = 'https://jooykoll.itch.io/bfdi-talk-ai';
// Tried in order; later ones are only used when an earlier one is overloaded.
const VISION_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

const PROMPT = `You are checking a screenshot that a customer says proves they paid for "BFDI Talk AI"
(itch.io page https://jooykoll.itch.io/bfdi-talk-ai, creator "jooykoll").

Look only at what is visibly in the image. Report:
- is_payment_confirmation: true only if it shows a completed payment / purchase receipt / "thanks for your purchase"
  / PayPal or card payment confirmation / itch.io purchase email or download-page receipt.
- is_itch_io: true if the payment is clearly through itch.io (itch.io branding, itch.io email, or PayPal/Stripe receipt naming itch.io).
- product_matches: true if "BFDI Talk" (any casing, e.g. "BFDI Talk AI") appears as the item bought.
- seller_matches: true if "jooykoll" appears as the seller/creator.
- amount_paid: the amount the customer actually paid, as a number (0 if none is shown).
- currency: ISO code of that amount (USD if shown with "$" and nothing else suggests another dollar).
- order_id: any order / transaction / purchase id shown, else "".
- looks_edited: true if text looks pasted, misaligned, mismatched fonts, or the image looks like a mock-up rather than a real screenshot.
- reason: one short sentence explaining your decision.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_payment_confirmation: { type: 'BOOLEAN' },
    is_itch_io: { type: 'BOOLEAN' },
    product_matches: { type: 'BOOLEAN' },
    seller_matches: { type: 'BOOLEAN' },
    amount_paid: { type: 'NUMBER' },
    currency: { type: 'STRING' },
    order_id: { type: 'STRING' },
    looks_edited: { type: 'BOOLEAN' },
    reason: { type: 'STRING' },
  },
  required: ['is_payment_confirmation', 'is_itch_io', 'product_matches', 'seller_matches', 'amount_paid', 'currency', 'order_id', 'looks_edited', 'reason'],
};

async function fileToBase64(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { b64: btoa(bin), buf };
}

async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Guest purchases (no account). Returns { ok: true, usd, credits, ids, report } or { ok: false, message, report }.
 * Does not add credits itself — the caller does that via Usage.addLocalCredits.
 */
export async function verifyScreenshot(file, apiKey, usage) {
  if (!file || !/^image\//.test(file.type)) return { ok: false, message: 'Please choose an image (PNG or JPG screenshot).' };
  if (file.size > 15 * 1024 * 1024) return { ok: false, message: 'That image is too big (max 15 MB).' };

  const { b64, buf } = await fileToBase64(file);
  const hash = 'img:' + await sha256(buf);
  if (usage.hasReceipt(hash)) return { ok: false, message: 'This screenshot was already used to add credits.' };

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: file.type, data: b64 } }, { text: PROMPT }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
  });
  let res, errMsg = '';
  for (const model of VISION_MODELS) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body,
    });
    if (res.ok) break;
    errMsg = (await res.json().catch(() => ({}))).error?.message || String(res.status);
    if (![429, 500, 503].includes(res.status)) break;
  }
  if (!res.ok) return { ok: false, message: `Could not check the screenshot (${errMsg}). Try again in a minute.` };
  const data = await res.json();
  let report;
  try {
    report = JSON.parse(data.candidates[0].content.parts.map(p => p.text || '').join(''));
  } catch {
    return { ok: false, message: 'Could not read the screenshot. Try a clearer, uncropped one.' };
  }

  const usd = String(report.currency).toUpperCase() === 'USD' ? Number(report.amount_paid) || 0 : 0;
  const orderId = report.order_id ? 'order:' + String(report.order_id).trim().toLowerCase() : '';
  if (!report.is_payment_confirmation) return { ok: false, report, message: `That doesn't look like a payment confirmation. ${report.reason}` };
  if (!report.is_itch_io || !(report.product_matches || report.seller_matches)) {
    return { ok: false, report, message: `That payment isn't for BFDI Talk on itch.io. ${report.reason}` };
  }
  if (report.looks_edited) return { ok: false, report, message: `That screenshot looks edited, so it can't be accepted. ${report.reason}` };
  if (!usd) return { ok: false, report, message: 'Could not find a USD amount on the receipt. Make sure the price paid is visible.' };
  if (usd < USAGE.MIN_PURCHASE_USD) return { ok: false, report, message: `The receipt shows $${usd.toFixed(2)}. The minimum is $${USAGE.MIN_PURCHASE_USD}.` };
  if (orderId && usage.hasReceipt(orderId)) return { ok: false, report, message: 'This order was already used to add credits.' };

  const rounded = Math.round(usd * 100) / 100;
  return { ok: true, usd: rounded, credits: Math.round(rounded * USAGE.CREDITS_PER_USD), ids: [hash, orderId], report };
}
