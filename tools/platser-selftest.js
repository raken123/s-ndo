#!/usr/bin/env node
/* Självtest för Matteplatser.
 *
 * Två egenskaper går inte att se genom att titta på skärmen, och det är de
 * två som hela funktionen vilar på:
 *
 *   Platserna ligger still. Samma position ska ge samma platser i dag, i
 *   morgon och på en annan telefon. Går det inte att lita på är det ingen
 *   plats man går till — det är en slumpknapp.
 *
 *   Frågorna går att svara på. En tidtagen fråga får inte ha ett svar som
 *   inte är ett heltal, och inte ett tal som inte hinns med på tjugo
 *   sekunder.
 *
 * Körs med: node tools/platser-selftest.js
 */
'use strict';

const path = require('path');
const Platser = require(path.join(__dirname, '..', 'elev', 'js', 'platser.js'));

let fel = 0;
function kolla(namn, villkor, extra) {
  if (villkor) { console.log('  ✓ ' + namn); return; }
  fel++;
  console.log('  ✗ ' + namn + (extra ? '\n      ' + extra : ''));
}

/* Sundsvall, ungefär. Vilken punkt som helst duger — poängen är att den är
   densamma i varje körning. */
const LAT = 62.3908, LON = 17.3069;

console.log('\nRutor och platser');

const a = Platser.naraMig(LAT, LON);
const b = Platser.naraMig(LAT, LON);
kolla('samma position ger exakt samma platser',
  JSON.stringify(a) === JSON.stringify(b));

kolla('det finns platser att gå till', a.length > 0, a.length + ' hittade');

kolla('ingen plats ligger längre bort än ' + Platser.RADIE + ' m',
  a.every(p => p.meter <= Platser.RADIE),
  'längst bort: ' + Math.max(...a.map(p => p.meter)) + ' m');

kolla('listan är sorterad närmast först',
  a.every((p, i) => i === 0 || a[i - 1].meter <= p.meter));

kolla('varje plats har ett eget id',
  new Set(a.map(p => p.id)).size === a.length);

kolla('nivåerna ligger inom 1–3',
  a.every(p => p.niva >= 1 && p.niva <= 3));

/* Går man tio meter norrut ska platserna vara desamma — bara avstånden ändras.
   Det är skillnaden mot att slumpa fram dem vid varje uppslag. */
const flyttad = Platser.naraMig(LAT + 0.00009, LON);
const idFore = a.map(p => p.id).sort().join(',');
const idEfter = flyttad.map(p => p.id).sort().join(',');
kolla('tio meter norrut ger samma platser', idFore === idEfter,
  idFore.slice(0, 60) + '\n      ' + idEfter.slice(0, 60));

/* Avstånden ska följa med när man går. */
const nara = a.find(p => flyttad.some(q => q.id === p.id));
const naraEfter = flyttad.find(q => q.id === nara.id);
kolla('avståndet räknas om när man rör sig',
  Math.abs(naraEfter.meter - nara.meter) <= 12 && naraEfter.meter !== undefined,
  nara.meter + ' m → ' + naraEfter.meter + ' m');

/* En helt annan del av världen ska ge andra platser. */
const langtBort = Platser.naraMig(55.6050, 13.0038);   /* Malmö */
kolla('en annan stad ger andra platser',
  langtBort.length === 0 || langtBort.every(p => !a.some(q => q.id === p.id)));

/* Nära ekvatorn och långt norrut: longitudrutan skalas, så platserna ska
   fortfarande hamna inom radien i stället för att dras ut på bredden. */
console.log('\nBreddgrader');
for (const [namn, lat] of [['ekvatorn', 0.5], ['Stockholm', 59.33],
                           ['Kiruna', 67.86], ['Longyearbyen', 78.22]]) {
  const p = Platser.naraMig(lat, 15.0);
  kolla(namn + ': allt inom radien',
    p.length > 0 && p.every(q => q.meter <= Platser.RADIE),
    p.length + ' platser, längst ' + (p.length ? Math.max(...p.map(q => q.meter)) : '-') + ' m');
}

/* Haversine mot ett känt avstånd. En grad latitud är 111,19 km. */
console.log('\nAvståndsräkning');
const enGrad = Platser._meterMellan({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
kolla('en grad latitud ≈ 111 195 m', Math.abs(enGrad - 111195) < 60, enGrad + ' m');
const vidPol = Platser._meterMellan({ lat: 70, lon: 0 }, { lat: 70, lon: 1 });
kolla('en grad longitud på 70° ≈ 38 100 m', Math.abs(vidPol - 38107) < 120, vidPol + ' m');
kolla('samma punkt är noll meter bort',
  Platser._meterMellan({ lat: LAT, lon: LON }, { lat: LAT, lon: LON }) === 0);

/* Frågorna. */
console.log('\nFrågor');
const plats = a[0];
const f1 = Platser.fragor(plats);
const f2 = Platser.fragor(plats);
kolla('samma plats ger samma frågor hela dagen',
  JSON.stringify(f1) === JSON.stringify(f2));
kolla('det är ' + Platser.FRAGOR + ' frågor', f1.length === Platser.FRAGOR);

/* Alla nivåer, många dragningar: svaren måste vara heltal och rimligt stora. */
let prov = 0, trasiga = [];
for (let niva = 1; niva <= 3; niva++) {
  const r = Platser._slump(niva * 7919 + 13);
  for (let i = 0; i < 4000; i++) {
    const f = Platser._enFraga(niva, r);
    prov++;
    if (!Number.isInteger(f.svar)) trasiga.push('inte heltal: ' + f.text + ' = ' + f.svar);
    else if (f.svar < 0) trasiga.push('negativt: ' + f.text + ' = ' + f.svar);
    else if (f.svar > 1000) trasiga.push('för stort: ' + f.text + ' = ' + f.svar);
    else if (!/^[0-9]/.test(f.text)) trasiga.push('konstig text: ' + f.text);
  }
}
kolla(prov + ' frågor: alla svar är heltal mellan 0 och 1000',
  trasiga.length === 0, trasiga.slice(0, 3).join('\n      '));

/* Räkna efter på riktigt — att svaret är ett heltal säger inget om att det är
   rätt heltal. Texten tolkas om till ett uttryck och räknas ut på nytt. */
function racka(text) {
  let m;
  if ((m = text.match(/^(\d+) \+ (\d+)$/))) return +m[1] + +m[2];
  if ((m = text.match(/^(\d+) − (\d+)$/))) return +m[1] - +m[2];
  if ((m = text.match(/^(\d+) × (\d+) \+ (\d+)$/))) return +m[1] * +m[2] + +m[3];
  if ((m = text.match(/^(\d+) × (\d+)$/))) return +m[1] * +m[2];
  if ((m = text.match(/^(\d+) ÷ (\d+)$/))) return +m[1] / +m[2];
  if ((m = text.match(/^(\d+) % av (\d+)$/))) return +m[1] * +m[2] / 100;
  if ((m = text.match(/^(\d+)\/(\d+) av (\d+)$/))) return +m[3] * +m[1] / +m[2];
  return null;
}
let otolkade = 0, felraknade = [];
for (let niva = 1; niva <= 3; niva++) {
  const r = Platser._slump(niva * 104729 + 5);
  for (let i = 0; i < 4000; i++) {
    const f = Platser._enFraga(niva, r);
    const facit = racka(f.text);
    if (facit === null) { otolkade++; continue; }
    if (facit !== f.svar) felraknade.push(f.text + ' → appen säger ' + f.svar + ', är ' + facit);
  }
}
kolla('varje fråga går att tolka', otolkade === 0, otolkade + ' otolkade');
kolla('varje svar stämmer med uträkningen', felraknade.length === 0,
  felraknade.slice(0, 3).join('\n      '));

/* Nivåerna ska faktiskt skilja sig åt, annars är trappan en bluff.
   Måttet är vad frågan begär, inte hur stort svaret blir: 96 ÷ 8 har ett
   litet svar och är ändå svårare än 74 + 39. Första försöket här mätte
   svarens storlek och underkände nivå 3 — det var testet som hade fel. */
const former = n => {
  const r = Platser._slump(n * 31 + 1);
  const sett = new Set();
  for (let i = 0; i < 3000; i++) {
    const t = Platser._enFraga(n, r).text;
    sett.add(/ \+ /.test(t) && / × /.test(t) ? 'två steg'
      : / % av /.test(t) ? 'procent'
      : /\/\d+ av /.test(t) ? 'bråkdel'
      : / × /.test(t) ? 'multiplikation'
      : / ÷ /.test(t) ? 'division'
      : / \+ /.test(t) ? 'addition'
      : / − /.test(t) ? 'subtraktion' : 'okänd');
  }
  return sett;
};
const n1 = former(1), n2 = former(2), n3 = former(3);
const lika = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

kolla('nivå 1 är addition och subtraktion',
  lika(n1, new Set(['addition', 'subtraktion'])), [...n1].join(', '));
kolla('nivå 2 är multiplikation och division',
  lika(n2, new Set(['multiplikation', 'division'])), [...n2].join(', '));
kolla('nivå 3 är två steg, procent och bråkdel',
  lika(n3, new Set(['två steg', 'procent', 'bråkdel'])), [...n3].join(', '));
kolla('nivåerna delar inte frågeform med varandra',
  [...n1].every(x => !n2.has(x) && !n3.has(x)) && [...n2].every(x => !n3.has(x)));

/* Tjugo sekunder är kort. Ingen nivå får ge tal med fler än två siffror i
   någon operand — då är det inte längre huvudräkning. */
let forStora = [];
for (let niva = 1; niva <= 3; niva++) {
  const r = Platser._slump(niva * 2003 + 17);
  for (let i = 0; i < 3000; i++) {
    const t = Platser._enFraga(niva, r).text;
    for (const tal of t.match(/\d+/g) || []) {
      if (+tal > 240) forStora.push('nivå ' + niva + ': ' + t);
    }
  }
}
kolla('inget tal i någon fråga är större än 240', forStora.length === 0,
  forStora.slice(0, 3).join('\n      '));

/* Belöningen ska stämma med den bilskärmen skriver ut. */
console.log('\nKrediter');
kolla('trappan är 400 / 900 / 1600',
  Platser.belon(1) === 400 && Platser.belon(2) === 900 && Platser.belon(3) === 1600);

console.log('\n' + (fel ? '❌ ' + fel + ' fel' : '✅ allt gick igenom') + '\n');
process.exit(fel ? 1 : 0);
