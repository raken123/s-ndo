// Build every Nezos package and the downloads page.
//
//   node build.mjs [outDir]              (default: ../downloads)
//   NEZOS_OPENAI_KEY=sk-... node build.mjs out-private
//
// Produces .exe, .dmg, .deb (Neutralino), .apk and .aab (Android SDK) and
// nezos.html. The .ipa needs macOS and is built by
// .github/workflows/nezos-ios.yml; an .ipa already in outDir is kept and listed.
// With NEZOS_OPENAI_KEY set, the key is written into every build, so don't
// publish those files.
import fs from 'node:fs';
import path from 'node:path';
import { PKG, VERSION, appHtml, log } from './lib.mjs';
import { buildDesktop } from './desktop.mjs';
import { buildAndroid } from './android.mjs';
import { writeSite } from './site.mjs';

const out = path.resolve(process.argv[2] || path.join(PKG, '..', 'downloads'));
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (!f.endsWith('.ipa')) fs.rmSync(path.join(out, f), { recursive: true, force: true });

const html = appHtml();
fs.writeFileSync(path.join(out, 'nezos.html'), html);
log(`Nezos ${VERSION}${process.env.NEZOS_OPENAI_KEY ? ' (with embedded OpenAI key)' : ''} -> ${out}`);
await buildDesktop(html, out);
await buildAndroid(html, out);
const builds = writeSite(out);
for (const b of builds) console.log(`  ${b.os.padEnd(13)} ${b.file ? `${b.file} (${b.size})` : 'missing'}`);
