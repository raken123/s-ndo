// Phone screenshots for the five episodes (build/screens/<name>-create.png
// and <name>-result.png, plus rap-battle.png). Needs the app served at
// http://localhost:8765. The account is shown on Hub Plus; generation is
// stubbed with hubs from the app's own templates, so no models are needed.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const OUT = __dirname + '/build/screens/';

const CARD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Happy Birthday, Minnie!</title><style>body{margin:0;min-height:100vh;background:#1c1026;color:#fff;font:16px system-ui,sans-serif;text-align:center}
main{padding:40px 18px}.cake{font-size:96px}h1{font-size:34px;margin:6px 0}p{color:#ffc4dd;font-size:18px}.b{font-size:46px;letter-spacing:6px}
button{font:inherit;font-weight:700;background:#ff4f8b;color:#fff;border:0;border-radius:12px;padding:14px 20px;margin-top:16px}
footer{margin-top:30px;color:#9a8aa8;font-size:12px}</style></head><body><main><div class="b">🎈🎉🎈</div><div class="cake">🎂</div>
<h1>Happy Birthday, Minnie!</h1><p>From your best friend, Max 💛</p><button>Blow out the candles</button>
<footer>Made with Hub AI · Hub V1 Plus</footer></main></body></html>`;

function rhyme(bg, fg, accent) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rhyme Machine</title>
<style>body{margin:0;min-height:100vh;background:${bg};color:${fg};font:16px system-ui,sans-serif}main{padding:22px 16px}h1{font-size:28px;margin:0 0 14px}
input{width:100%;box-sizing:border-box;font:inherit;padding:12px;border-radius:10px;border:2px solid ${accent};background:transparent;color:${fg}}
button{width:100%;margin-top:10px;font:inherit;font-weight:800;padding:12px;border:0;border-radius:10px;background:${accent};color:#111}
li{padding:8px 0;font-size:18px;font-weight:600}</style></head><body><main><h1>🎤 Rhyme Machine</h1><input value="banana">
<button>Drop a rhyme</button><ul><li>Banana, cabana</li><li>Bandana, Montana</li><li>Savannah, piano-nah</li></ul></main></body></html>`;
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8765/index.html');
  const plus = async () => {
    await p.evaluate(() => {
      localStorage.clear();
      // An unreachable server keeps the cached Plus account on screen.
      localStorage['hubai.settings'] = JSON.stringify({ cloudUrl: 'http://127.0.0.1:1' });
      const cfg = window.HUB_CLOUD_CONFIG, plus = cfg.plans.find(x => x.id === 'plus');
      localStorage['hubai.cloud.config'] = JSON.stringify(cfg);
      localStorage['hubai.cloud.me'] = JSON.stringify({ account: 'acc_demo', plan: 'plus', credits: 975, rule: '1,000/month', limitsLeft: { max: 5, gpro: 3 }, features: plus.features, secretEngines: [] });
      localStorage['hubai.engine'] = 'standard';
    });
  };
  const shoot = async (name, prompt, draft) => {
    await plus();
    await p.reload(); await p.waitForTimeout(600);
    await p.fill('#prompt', prompt);
    await p.screenshot({ path: OUT + name + '-create.png' });
    await p.evaluate(d => { localStorage['hubai.draft'] = JSON.stringify(d); }, draft);
    await p.reload(); await p.waitForTimeout(900);
    await p.evaluate(() => document.getElementById('result').scrollIntoView());
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + name + '-result.png' });
  };
  const tpl = (type, o) => p.evaluate(([type, o]) => HubTemplates.render(type, Object.assign({ dark: true, persist: false, extras: true, n: null, topic: '', key: 'ep', engine: 'Hub V1 Standard' }, o)), [type, o]);
  const draft = (title, html, powerups) => ({ title, html, engine: 'standard', engineName: 'Hub V1 Standard', seconds: 3.4, prompt: title, at: Date.now(), powerups: powerups || [], versions: [] });

  await shoot('kitchen', 'A pizza timer, please!', draft('Pizza Timer', await tpl('timer', { title: 'Pizza Timer', accent: '#e07b2a', n: 12 })));
  await shoot('space', 'A moon landing countdown', draft('Moon Landing', await tpl('countdown', { title: 'Moon Landing', accent: '#7d55c7', n: 1, topic: 'Banana Moon' })));
  let magic = await tpl('picker', { title: 'Magic Card Trick', accent: '#7d55c7' });
  magic = magic.replace('Alex\nSam\nRiley\nJordan', 'Ace of Bananas\nKing of Cats\nQueen of Peels\nJoker Max');
  await shoot('magic', 'Make a card trick app', draft('Magic Card Trick', magic, ['confetti']));
  await shoot('birthday', 'A birthday card for Minnie', draft('Happy Birthday, Minnie!', CARD, ['confetti']));

  // Rap: the Hub Battle sheet with two agents' versions side by side.
  await plus();
  await p.reload(); await p.waitForTimeout(600);
  await p.evaluate(([a, b]) => {
    let n = 0;
    Cloud.generate = (engine) => new Promise(r => setTimeout(() => r({ html: n++ ? b : a, title: 'Rhyme Machine', engine, engineName: Plans.engine(engine).name, seconds: 3, me: Plans.me() }), 100));
  }, [rhyme('#1b1036', '#f3e8ff', '#c084fc'), rhyme('#fff4cc', '#1b1b1b', '#ffb800')]);
  await p.fill('#prompt', 'A rap rhyme machine');
  await p.click('[data-feat=battle]');
  await p.selectOption('#ba', 'standard'); await p.selectOption('#bb', 'plus');
  await p.click('#sheet [data-x=go]');
  await p.waitForSelector('[data-pick="1"]:not([disabled])');
  await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + 'rap-battle.png' });
  await b.close();
})();
