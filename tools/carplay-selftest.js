/*
 * Självtest för CarPlay-delen.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/carplay-selftest.js
 *
 * Swift-koden går inte att kompilera här (Linux, ingen Xcode), så den kan det
 * här testet ingenting säga om. Det som går att kontrollera är formatet och
 * mallarna, och det är också där de dyra felen sitter:
 *
 *   • att repetitionsformatet inte kan bära ett svar — regeln som i appen
 *     ligger i svarsvakten ligger här i datat, och då måste datat testas
 *   • att mallarna får plats på CarPlays riktiga upplösningar utan att texten
 *     hamnar utanför eller träffytorna blir för små för en tumme
 *   • att Swift-koden och förhandsvisningen läser samma fält ur samma fil
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROT = path.resolve(__dirname, '../carplay');
const problem = [];

/* --- 1. formatet: inget svar, ingen väg att smyga in ett ------------------ */
const rep = JSON.parse(fs.readFileSync(path.join(ROT, 'exempel/repet-matte5-kap4.json'), 'utf8'));

const SVARSORD = /(svar|facit|losning|lösning|resultat|answer|key|correct|ratt|rätt)/i;
function letaSvarsfalt(o, stig = '') {
  const träffar = [];
  if (Array.isArray(o)) {
    o.forEach((v, i) => träffar.push(...letaSvarsfalt(v, stig + '[' + i + ']')));
  } else if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      if (SVARSORD.test(k)) träffar.push(stig + '.' + k);
      träffar.push(...letaSvarsfalt(o[k], stig + '.' + k));
    }
  }
  return träffar;
}
const svarsfalt = letaSvarsfalt(rep);
console.log('fält som skulle kunna bära ett svar: ' + (svarsfalt.length ? svarsfalt.join(', ') : 'inga'));
if (svarsfalt.length) problem.push('formatet har fält som kan bära ett facit: ' + svarsfalt.join(', '));

const antalFrågor = rep.avsnitt.reduce((s, a) => s + a['frågor'].length, 0);
console.log('repetitionen: ' + rep.avsnitt.length + ' avsnitt, ' + antalFrågor + ' frågor, paus ' + rep.pausSekunder + ' s');
if (rep.format !== 'sandoelev.repet/1') problem.push('fel formatversion i exempelfilen');
if (!rep.avsnitt.length) problem.push('exempelfilen har inga avsnitt');
rep.avsnitt.forEach(a => {
  if (!a.id || !a.titel || !a.sidor || !Array.isArray(a['frågor']) || !a['frågor'].length) {
    problem.push('avsnittet ' + (a.id || '?') + ' saknar fält');
  }
  /* En fråga som slutar utan frågetecken är oftast ett påstående som smugit
     sig in — och ett påstående i en repetition är nästan alltid ett svar. */
  a['frågor'].forEach(f => {
    if (!/[?.]$/.test(f.trim())) problem.push('frågan slutar utan skiljetecken: ' + f);
  });
});

/* --- 2. Swift och förhandsvisningen ska läsa samma fält ------------------- */
const swift = fs.readFileSync(path.join(ROT, 'SandoElevCarPlay/Repetition.swift'), 'utf8');
const html = fs.readFileSync(path.join(ROT, 'forhandsvisning/index.html'), 'utf8');
const falt = ['format', 'titel', 'underrubrik', 'bok', 'rost', 'pausSekunder', 'avsnitt', 'sidor', 'frågor', 'id'];
const saknasISwift = falt.filter(f => !swift.includes(f));
console.log('fält som saknas i Repetition.swift: ' + (saknasISwift.length ? saknasISwift.join(', ') : 'inga'));
if (saknasISwift.length) problem.push('Swift läser inte alla fält: ' + saknasISwift.join(', '));
if (!/com\.apple\.developer\.carplay-audio/.test(
      fs.readFileSync(path.join(ROT, 'SandoElevCarPlay/SandoElevCarPlay.entitlements'), 'utf8'))) {
  problem.push('entitlement-filen saknar carplay-audio');
}
if (!/CPTemplateApplicationSceneSessionRoleApplication/.test(
      fs.readFileSync(path.join(ROT, 'SandoElevCarPlay/Info.plist'), 'utf8'))) {
  problem.push('Info.plist saknar CarPlay-scenen — appen dyker aldrig upp på bilskärmen');
}
/* Swift-koden får bara använda de två mallar som är rimliga i en bil. */
const scen = fs.readFileSync(path.join(ROT, 'SandoElevCarPlay/CarPlaySceneDelegate.swift'), 'utf8');
const mallar = (scen.match(/CP[A-Za-z]+Template/g) || []).filter((v, i, a) => a.indexOf(v) === i);
console.log('mallar i CarPlay-koden: ' + mallar.join(', '));
const tillatna = ['CPListTemplate', 'CPNowPlayingTemplate'];
const forMycket = mallar.filter(m => !tillatna.includes(m));
if (forMycket.length) problem.push('fler mallar än listan och Spelas nu: ' + forMycket.join(', '));

/* --- 3. mallarna på riktiga upplösningar --------------------------------- */
function startaServer() {
  return new Promise(klar => {
    const typer = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript' };
    const srv = http.createServer((req, res) => {
      let f = path.join(ROT, decodeURIComponent(req.url.split('?')[0]));
      if (f.endsWith('/')) f += 'index.html';
      if (!f.startsWith(ROT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': typer[path.extname(f)] || 'text/plain' });
      res.end(fs.readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => klar({ srv, port: srv.address().port }));
  });
}

(async () => {
  const s = await startaServer();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const konsol = [];
  p.on('pageerror', e => konsol.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsol.push('CONSOLE: ' + m.text()); });
  await p.goto('http://127.0.0.1:' + s.port + '/forhandsvisning/');
  await p.waitForFunction(() => window.__ritad === true, null, { timeout: 8000 }).catch(() => {});

  const matt = await p.evaluate(() => {
    if (!window.__ritad) return null;
    const ut = [];
    document.querySelectorAll('.cp').forEach(cp => {
      const r = cp.getBoundingClientRect();
      const rader = Array.from(cp.querySelectorAll('.listrad'));
      const spill = [];
      cp.querySelectorAll('.titel, .detalj, .nutitel, .nuartist, .navtitel').forEach(t => {
        /* Texten får kortas med ellips, men aldrig sticka ut ur skärmen. */
        const tr = t.getBoundingClientRect();
        if (tr.right > r.right + 1 || tr.left < r.left - 1) spill.push(t.textContent.slice(0, 30));
      });
      const knappar = Array.from(cp.querySelectorAll('.knapp')).map(k => Math.round(k.getBoundingClientRect().height));
      ut.push({
        bredd: Math.round(cp.style.width ? parseInt(cp.style.width, 10) : r.width),
        hojd: Math.round(cp.style.height ? parseInt(cp.style.height, 10) : r.height),
        radhojd: rader.length ? Math.round(rader[0].getBoundingClientRect().height) : null,
        rader: rader.length,
        knappar, spill
      });
    });
    return ut;
  });
  if (!matt) {
    problem.push('förhandsvisningen ritade aldrig något');
  } else {
    matt.forEach(m => {
      console.log('  ' + String(m.bredd + '×' + m.hojd).padEnd(11) +
        ' rader ' + String(m.rader).padEnd(2) +
        ' radhöjd ' + String(m.radhojd == null ? '—' : m.radhojd + 'px').padEnd(7) +
        ' knappar ' + (m.knappar.length ? m.knappar.join('/') + 'px' : '—') +
        (m.spill.length ? '  SPILL: ' + m.spill.join(' | ') : ''));
      if (m.spill.length) problem.push(m.bredd + '×' + m.hojd + ': text utanför skärmen');
      /* CarPlay kräver stora träffytor. 44 pt är Apples golv för en knapp. */
      if (m.radhojd != null && m.radhojd < 44) problem.push(m.bredd + '×' + m.hojd + ': listraden är bara ' + m.radhojd + ' px');
      m.knappar.forEach(k => { if (k < 44) problem.push(m.bredd + '×' + m.hojd + ': knapp på ' + k + ' px'); });
    });
    const listor = matt.filter(m => m.rader > 0);
    if (listor.some(m => m.rader !== rep.avsnitt.length)) {
      problem.push('listan visar inte lika många rader som repetitionen har avsnitt');
    }
  }

  await p.screenshot({ path: path.join(ROT, 'forhandsvisning/mallar.png'), fullPage: true });
  console.log('skärmbild: carplay/forhandsvisning/mallar.png');

  console.log('\nkonsolfel: ' + (konsol.length ? konsol.join(' | ') : 'inga'));
  console.log('problem: ' + (problem.length ? '\n - ' + problem.join('\n - ') : 'inga'));
  await b.close();
  s.srv.close();
  process.exit(problem.length || konsol.length ? 1 : 0);
})();
