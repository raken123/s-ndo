// POST { image: base64, mimeType } -> checks an itch.io payment screenshot and adds Usage Credits.
import { cors, Db, env, json } from '../_shared/http.ts';
import { judge, readReceipt, sha256Hex } from '../_shared/receipt.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const db = new Db();
    const user = await db.user(req);
    if (!user) return json({ ok: false, message: 'Sign in first.' }, 401);
    const { image, mimeType } = await req.json().catch(() => ({}));
    if (typeof image !== 'string' || !/^image\//.test(mimeType || '')) {
      return json({ ok: false, message: 'Please choose an image (PNG or JPG screenshot).' }, 400);
    }
    const bytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
    if (bytes.length > 15 * 1024 * 1024) return json({ ok: false, message: 'That image is too big (max 15 MB).' }, 400);

    const imageRef = `receipt:${await sha256Hex(bytes)}`;
    const used = async (ref: string) => !!(await db.one('credit_ledger', { ref: `eq.${ref}` }, 'id'));
    if (await used(imageRef)) return json({ ok: false, message: 'This screenshot was already used to add credits.' });

    const verdict = judge(await readReceipt(image, mimeType, env('GEMINI_API_KEY')));
    if (!verdict.ok) return json(verdict);
    if (verdict.orderRef && await used(verdict.orderRef)) {
      return json({ ok: false, message: 'This order was already used to add credits.' });
    }
    const balance = await db.rpc('grant_credits', {
      p_user: user.id, p_delta: verdict.credits, p_reason: 'itch_purchase', p_ref: imageRef,
    });
    if (balance === null) return json({ ok: false, message: 'This screenshot was already used to add credits.' });
    if (verdict.orderRef) {
      await db.rpc('grant_credits', { p_user: user.id, p_delta: 0, p_reason: 'itch_order', p_ref: verdict.orderRef });
    }
    return json({ ok: true, usd: verdict.usd, credits: verdict.credits, balance });
  } catch (e) {
    return json({ ok: false, message: (e as Error).message }, 500);
  }
});
