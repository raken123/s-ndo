/*
 * Kalibrering av bildgranskningen i App.Verify.inspect.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/verifiering-kalibrering.js
 *
 * Ritar ett syntetiskt id-kort i olika skick — skarpt, mjukt, suddigt, brusigt,
 * i mörkt rum, överexponerat och helt tomt — och skriver ut vad granskningen
 * säger om vart och ett. Gränserna i inspect() är satta efter den här tabellen:
 * ett mjukt men läsbart kort ska släppas igenom, ett suddigt eller tomt inte.
 */
const { chromium } = require('playwright');
/* Runnern har en förinstallerad Chromium som inte matchar playwrights egen
   revision, och den går inte att ladda ner härifrån. Finns den, används den. */
const BROWSER = require('fs').existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } : {};
(async () => {
  const b = await chromium.launch(BROWSER);
  const p = await b.newPage();
  await p.goto('file://' + require('path').resolve(__dirname, '../whiteboard/index.html'));
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    function kort(blur, brus, ljus) {
      const c = document.createElement('canvas'); c.width = 320; c.height = 200;
      const g = c.getContext('2d');
      g.filter = 'blur(' + blur + 'px) brightness(' + ljus + ')';
      g.fillStyle = '#111'; g.fillRect(0, 0, 320, 200);
      g.fillStyle = '#f2f2f0'; g.fillRect(22, 20, 276, 160);
      g.fillStyle = '#1a1a1a';
      for (let i = 0; i < 7; i++) g.fillRect(40, 44 + i * 19, 150 + (i % 3) * 60, 9);
      g.fillStyle = '#7a8'; g.fillRect(215, 44, 66, 74);
      g.filter = 'none';
      if (brus) {
        const d = g.getImageData(0, 0, 320, 200);
        for (let i = 0; i < d.data.length; i += 4) {
          const n = (Math.random() - 0.5) * brus;
          d.data[i] += n; d.data[i+1] += n; d.data[i+2] += n;
        }
        g.putImageData(d, 0, 0);
      }
      return c;
    }
    const rader = [];
    [['skarpt', 0, 0, 1], ['lite mjukt', 1.5, 0, 1], ['mjukt', 3, 0, 1], ['suddigt', 6, 0, 1],
     ['mycket suddigt', 10, 0, 1], ['kamerabrus', 1, 26, 1], ['morkt rum', 1, 10, 0.35],
     ['mycket morkt', 1, 10, 0.12], ['overexponerat', 1, 6, 2.6]].forEach(([namn, bl, br, lj]) => {
      const res = App.Verify.inspect(kort(bl, br, lj));
      rader.push([namn, res.ok, res.skarpa, res.kontrast, res.fyllnad, res.medel, res.fel.join(' ')]);
    });
    // helt tomma bilder
    ['#000', '#888', '#fff'].forEach(f => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 200;
      const g = c.getContext('2d'); g.fillStyle = f; g.fillRect(0,0,320,200);
      const res = App.Verify.inspect(c);
      rader.push(['tomt ' + f, res.ok, res.skarpa, res.kontrast, res.fyllnad, res.medel, res.fel.join(' ')]);
    });
    return rader;
  });
  r.forEach(x => console.log(
    x[0].padEnd(16) + (x[1] ? 'GODKÄND' : 'nekad ').padEnd(9) +
    ' skärpa ' + String(x[2]).padStart(6) + '  kontrast ' + String(x[3]).padStart(4) +
    '  fyllnad ' + String(x[4]).padStart(3) + '%  ljus ' + String(x[5]).padStart(3) + '   ' + x[6]));
  await b.close();
})();
