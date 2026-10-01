// Texter för mejlet och filmsidan (svenska och engelska).
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const T = {
  sv: {
    hi: 'Hej rymdfarare!',
    intro: 'Här är inspelningen av din resa i Astro på Tekniska museet.',
    visited: (n, list) => (n ? `Du besökte ${n} ${n === 1 ? 'himlakropp' : 'himlakroppar'}: ${list}.` : 'Du startade din resa från jorden.'),
    stars: (s) => `Du samlade ${s} stjärnor${''}.`,
    watch: 'Titta på din rymdresa',
    valid: (d) => `Länken fungerar i ${d} dagar. Sedan raderas filmen automatiskt.`,
    why: 'Du får det här mejlet för att din e-postadress skrevs in i spelet Astro på Tekniska museet. Vi sparar inte din adress och skickar inga fler mejl.',
    noreply: 'Det här mejlet går inte att svara på.',
    title: 'Din rymdresa – Astro',
    download: 'Ladda ner filmen',
    preparing: 'Tips: om filmen inte spelas på din telefon, prova igen om några minuter – vi gör en version som fungerar överallt.',
    gone: 'Filmen finns inte längre. Filmer sparas bara en begränsad tid.',
    thanks: 'Tack för att du reste med Astro på Tekniska museet!',
  },
  en: {
    hi: 'Hello space traveller!',
    intro: 'Here is the recording of your journey in Astro at Tekniska museet.',
    visited: (n, list) => (n ? `You visited ${n} ${n === 1 ? 'world' : 'worlds'}: ${list}.` : 'You started your journey from Earth.'),
    stars: (s) => `You collected ${s} stars.`,
    watch: 'Watch your space journey',
    valid: (d) => `The link works for ${d} days. After that the video is deleted automatically.`,
    why: 'You are receiving this email because your address was entered in the game Astro at Tekniska museet. We do not store your address and will not send any more emails.',
    noreply: 'Please do not reply to this email.',
    title: 'Your space journey – Astro',
    download: 'Download the video',
    preparing: 'Tip: if the video does not play on your phone, try again in a few minutes – we are making a version that works everywhere.',
    gone: 'This video is no longer available. Videos are only kept for a limited time.',
    thanks: 'Thank you for travelling with Astro at Tekniska museet!',
  },
};

export function emailText(lang, s, link, days) {
  const L = T[lang] || T.sv;
  return [
    L.hi, '', L.intro,
    L.visited(s.visited.length, s.visited.join(', ')),
    L.stars(s.stars), '',
    `${L.watch}: ${link}`, '',
    L.valid(days), '', '—',
    L.why, L.noreply, '', 'Astro – Tekniska museet',
  ].join('\n');
}

export function emailHtml(lang, s, link, days) {
  const L = T[lang] || T.sv;
  return `<!DOCTYPE html><html lang="${lang}"><body style="margin:0;background:#050b18;font-family:Arial,Helvetica,sans-serif;color:#e6f2ff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050b18"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#0b1a33;border:1px solid #2a4f80;border-radius:16px">
<tr><td style="padding:28px 28px 8px;font-size:40px;font-weight:900;letter-spacing:6px;color:#9fd8ff">ASTRO</td></tr>
<tr><td style="padding:0 28px;font-size:20px;font-weight:bold;color:#ffffff">${esc(L.hi)}</td></tr>
<tr><td style="padding:10px 28px 0;font-size:16px;line-height:1.5">${esc(L.intro)}<br>${esc(L.visited(s.visited.length, s.visited.join(', ')))}<br>${esc(L.stars(s.stars))}</td></tr>
<tr><td style="padding:24px 28px" align="left"><a href="${esc(link)}" style="display:inline-block;background:#ff7a1a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:18px;padding:14px 26px;border-radius:999px">${esc(L.watch)} ▶</a></td></tr>
<tr><td style="padding:0 28px 8px;font-size:13px;color:#9fb7d3">${esc(L.valid(days))}<br><a href="${esc(link)}" style="color:#7fe0ff">${esc(link)}</a></td></tr>
<tr><td style="padding:16px 28px 26px;font-size:12px;color:#7d93ad;border-top:1px solid #1d3558">${esc(L.why)} ${esc(L.noreply)}<br><br>Astro – Tekniska museet</td></tr>
</table></td></tr></table></body></html>`;
}

export function videoPage(lang, meta, days) {
  const L = T[lang] || T.sv;
  const s = meta.summary || { visited: [], stars: 0 };
  const src = meta.mp4 || meta.original;
  const type = src.endsWith('.mp4') ? 'video/mp4' : 'video/webm';
  const until = new Date(meta.created + days * 86400_000).toLocaleDateString(lang === 'en' ? 'en-GB' : 'sv-SE');
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(L.title)}</title>
<style>
body{margin:0;background:radial-gradient(ellipse at top,#0c2248,#050b18 70%);color:#e6f2ff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;min-height:100vh}
main{max-width:960px;margin:0 auto;padding:28px 16px 48px}
h1{margin:0;font-size:56px;letter-spacing:.14em;background:linear-gradient(180deg,#fff,#9fd8ff 55%,#2fa8ff);-webkit-background-clip:text;background-clip:text;color:transparent}
p{line-height:1.5;color:#cfe3f7}
video{width:100%;border-radius:14px;background:#000;border:1px solid #2a4f80;margin:16px 0}
a.btn{display:inline-block;background:#ff7a1a;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px}
small{color:#7d93ad}
</style></head><body><main>
<h1>ASTRO</h1>
<p><strong>${esc(L.thanks)}</strong><br>${esc(L.visited((s.visited || []).length, (s.visited || []).join(', ')))} ${esc(L.stars(s.stars || 0))}</p>
<video controls playsinline preload="metadata"><source src="/files/${esc(src)}" type="${type}"></video>
<p><a class="btn" href="/files/${esc(src)}?download">${esc(L.download)} ⬇</a></p>
${meta.mp4 ? '' : `<p><small>${esc(L.preparing)}</small></p>`}
<p><small>${esc(L.valid(days))} (${esc(until)})</small></p>
</main></body></html>`;
}

export function notFoundPage(lang) {
  const L = T[lang] || T.sv;
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Astro</title></head>
<body style="background:#050b18;color:#e6f2ff;font-family:system-ui,sans-serif;text-align:center;padding:60px 16px"><h1 style="letter-spacing:.14em">ASTRO</h1><p>${esc(L.gone)}</p></body></html>`;
}
