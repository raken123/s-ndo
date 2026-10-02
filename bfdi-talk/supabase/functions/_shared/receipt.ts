// Usage Credits receipts: Gemini reads the itch.io payment screenshot, we decide what it's worth.
import { CREDITS_PER_USD, MIN_PURCHASE_USD } from './plans.ts';

export const RECEIPT_PROMPT = `You are checking a screenshot that a customer says proves they paid for "BFDI Talk AI"
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

export const RECEIPT_SCHEMA = {
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

export type Report = {
  is_payment_confirmation: boolean; is_itch_io: boolean; product_matches: boolean; seller_matches: boolean;
  amount_paid: number; currency: string; order_id: string; looks_edited: boolean; reason: string;
};

export type Verdict =
  | { ok: true; usd: number; credits: number; orderRef: string | null }
  | { ok: false; message: string };

/** Turns Gemini's report into accept/reject. */
export function judge(r: Report): Verdict {
  const usd = String(r.currency).toUpperCase() === 'USD' ? Number(r.amount_paid) || 0 : 0;
  if (!r.is_payment_confirmation) return { ok: false, message: `That doesn't look like a payment confirmation. ${r.reason}` };
  if (!r.is_itch_io || !(r.product_matches || r.seller_matches)) {
    return { ok: false, message: `That payment isn't for BFDI Talk on itch.io. ${r.reason}` };
  }
  if (r.looks_edited) return { ok: false, message: `That screenshot looks edited, so it can't be accepted. ${r.reason}` };
  if (!usd) return { ok: false, message: 'Could not find a USD amount on the receipt. Make sure the price paid is visible.' };
  if (usd < MIN_PURCHASE_USD) return { ok: false, message: `The receipt shows $${usd.toFixed(2)}. The minimum is $${MIN_PURCHASE_USD}.` };
  const rounded = Math.round(usd * 100) / 100;
  const order = String(r.order_id || '').trim().toLowerCase();
  return { ok: true, usd: rounded, credits: Math.round(rounded * CREDITS_PER_USD), orderRef: order ? `order:${order}` : null };
}

const VISION_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

export async function readReceipt(imageB64: string, mimeType: string, apiKey: string): Promise<Report> {
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: imageB64 } }, { text: RECEIPT_PROMPT }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RECEIPT_SCHEMA },
  });
  let lastError = '';
  for (const model of VISION_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey }, body,
    });
    if (res.ok) {
      const data = await res.json();
      return JSON.parse(data.candidates[0].content.parts.map((p: { text?: string }) => p.text || '').join(''));
    }
    lastError = (await res.json().catch(() => ({})))?.error?.message || String(res.status);
    if (![429, 500, 503].includes(res.status)) break;
  }
  throw new Error(`Could not check the screenshot (${lastError}). Try again in a minute.`);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
