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

## Video

| File | |
| --- | --- |
| `raken-ai-reel.mp4` | All five ads plus a brand end card — **22.6 s, 1080×1920, H.264** |
| `raken-ai-ad-0*.mp4` | The same ads as standalone 4 s cuts, each fading up from black |

`reel.html` reuses the artboards from `ads.html` verbatim and adds the timeline:
each board fades up, its copy rises in staggered blocks, gold sweeps across the
headline, and the product shot pushes in. Silent — social autoplay is muted anyway.

Frames are not captured in real time. `render-reel.js` seeks every animation to an
exact timestamp (`seek(t)`) and screenshots it, so the render is deterministic and
cannot drop or duplicate frames. Encoding needs libx264, so the
**Render RAKEN AI reel** workflow does it on every push that touches this folder,
extracts frames back out of the finished file into `verify/` as proof it decodes,
and commits the MP4s to the branch.

To render locally you need Playwright plus a full ffmpeg on `PATH`:

```bash
node raken-ai/ads/render-reel.js raken-ai/ads
SAMPLE_FRAMES=12 node raken-ai/ads/render-reel.js /tmp   # spot-check the timeline
```

## Stills

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
