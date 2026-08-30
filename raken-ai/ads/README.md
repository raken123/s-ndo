# RAKEN AI — portrait ads

Five 1080×1920 portrait ads (story / reel / TikTok format), built from the same
black-and-gold system as the app and the product renders in `../assets/`.

| File | Angle | Headline |
| --- | --- | --- |
| `raken-ai-ad-01-launch.png` | The product | The world's first **AI Parfum** |
| `raken-ai-ad-02-water.png` | Charging | **It runs on water** |
| `raken-ai-ad-03-compose.png` | The nose | **Describe a feeling** |
| `raken-ai-ad-04-light.png` | Subscription | **3× faster. Two more noses.** |
| `raken-ai-ad-05-safety.png` | Trust | **It knows what not to make** |

`ads.html` is the source — all five artboards on one page, no build step and no
network. Re-render after an edit with Playwright:

```js
const { chromium } = require('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1080,height:1920} });
await p.goto('file:///…/raken-ai/ads/ads.html');
await p.locator('#ad1').screenshot({ path:'raken-ai-ad-01-launch.png' });   // #ad1…#ad5
```

Type is set in Liberation Serif (headlines) and Liberation Sans (copy) so the
render is identical on any machine with the standard font set — no webfont fetch.

The claims on these ads describe the prototype's simulated behaviour. Nothing here
has shipped, so treat them as concept creative rather than published advertising.
