// Plans + Google Pay checkout test. Drives dist/chatgpt-agents.html in headless Chromium.
// pay.google.com is replaced by a stand-in with the same API surface as Google Pay's TEST
// environment (PaymentsClient, isReadyToPay, createButton, loadPaymentData), and the OpenAI
// and local-server endpoints are mocked, so this runs offline.
// Usage: node test/plans.js [outdir-for-screenshots]
const path = require("path");
const { chromium } = require(process.env.PW || "/opt/node22/lib/node_modules/playwright");
const FILE = "file://" + path.resolve(__dirname, "../dist/chatgpt-agents.html");
const OUT = process.argv[2] || path.resolve(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });

const PAYJS = `
window.__gp = { created: [], requests: [] };
window.google = { payments: { api: { PaymentsClient: function (opts) {
  __gp.created.push(opts);
  this.isReadyToPay = req => { __gp.ready = req; return Promise.resolve({ result: true }); };
  this.createButton = o => { __gp.button = o; const b = document.createElement("button"); b.id = "gpay-test-btn"; b.textContent = "Subscribe with Google Pay"; b.onclick = o.onClick; return b; };
  this.loadPaymentData = req => { __gp.requests.push(req);
    if (window.__gpCancel) return Promise.reject({ statusCode: "CANCELED" });
    return Promise.resolve({ apiVersion: 2, apiVersionMinor: 0, paymentMethodData: { type: "CARD", description: "Visa •••• 1111",
      info: { cardNetwork: "VISA", cardDetails: "1111" }, tokenizationData: { type: "PAYMENT_GATEWAY", token: '{"id":"examplePaymentMethodToken"}' } } }); };
} } } };`;
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const sse = chunks => chunks.map(c => "data: " + JSON.stringify(c) + "\n\n").join("") + "data: [DONE]\n\n";
const say = t => sse([{ choices: [{ delta: { content: t } }] }]);
const UI = 'Pick one:\n\n```ui\n{"type":"choices","question":"Which plan sounds best?","options":["Option A","Option B","Option C"]}\n```';

const seen = [];
async function chat(route) {
  const req = route.request(), body = JSON.parse(req.postData());
  seen.push({ url: req.url(), auth: req.headers()["authorization"], body });
  const last = body.messages[body.messages.length - 1];
  let out;
  if (last.role === "tool") out = say("Here is your image.");
  else if (/draw/i.test(last.content)) out = sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: "i1", type: "function", function: { name: "generate_image", arguments: JSON.stringify({ prompt: "a red fox" }) } }] } }] }]);
  else if (/interactive/i.test(last.content)) out = say(UI);
  else out = say(`OK from ${body.model}`);
  await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: out });
}

const checks = [];
const ok = (name, cond, extra) => { checks.push([name, !!cond]); console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("https://pay.google.com/gp/p/js/pay.js", r => r.fulfill({ status: 200, contentType: "application/javascript", body: PAYJS }));
  await page.route("https://api.openai.com/v1/chat/completions", chat);
  await page.route("http://localhost:11434/v1/chat/completions", chat);
  let imageReqs = 0;
  await page.route("https://api.openai.com/v1/images/generations", r => { imageReqs++; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ b64_json: PNG }] }) }); });
  await page.goto(FILE);
  await page.evaluate(() => { S.settings.apiKey = "sk-test"; save(true); render(); });
  const state = () => page.evaluate(() => ({ plan: S.billing.plan, credits: S.billing.credits, images: S.billing.images.used, renewsAt: S.billing.renewsAt, key: document.querySelector("#keyState").textContent }));
  const sendAndWait = async text => { await page.fill("#input", text); await page.click("#sendBtn"); await page.waitForFunction(() => !document.querySelector("#sendBtn.stop")); await page.waitForTimeout(150); };
  const lastBot = () => page.locator(".msg.bot").last();

  // ---------- Free ----------
  let s = await state();
  ok("starts on Free with 60 credits today", s.plan === "free" && s.credits === 60 && s.key.includes("Free · 60 credits today"), s.key);
  await sendAndWait("hello");
  s = await state();
  ok("a reply costs 1 credit", s.credits === 59);
  const freeReq = seen[seen.length - 1].body;
  ok("Free uses a free model", freeReq.model === "gpt-4o-mini", freeReq.model);
  ok("Free: no Intelligent UI prompt, no image tool", !/Intelligent UI/.test(freeReq.messages[0].content) && !(freeReq.tools || []).some(t => t.function.name === "generate_image"));

  await page.evaluate(() => { S.agents[0].model = "gpt-5"; save(true); });
  let before = seen.length;
  await sendAndWait("hi");
  ok("Free: GPT-5 is blocked with an upgrade button", (await lastBot().textContent()).includes("part of Plus and Ultra") && await lastBot().locator("[data-upgrade]").count() === 1);
  ok("blocked reply makes no API call and costs nothing", seen.length === before && (await state()).credits === 59);
  await page.evaluate(() => { S.agents[0].model = ""; save(true); });

  await page.click("#modelBtn");
  ok("model picker locks paid models", await page.locator(".menu .mi", { hasText: "GPT-5 mini" }).first().textContent().then(t => t.includes("🔒")));
  await page.keyboard.press("Escape");

  await page.evaluate(() => { S.billing.credits = 0; save(true); render(); });
  const msgsBefore = await page.locator(".msg").count();
  await page.fill("#input", "one more"); await page.click("#sendBtn");
  ok("out of credits opens the plans", await page.locator(".modal h2", { hasText: "Upgrade your plan" }).count() === 1 && (await page.textContent(".modal-b")).includes("used all your credits"));
  ok("…and nothing is sent", await page.locator(".msg").count() === msgsBefore);

  // ---------- plans screen ----------
  const plansText = await page.textContent(".modal-b");
  ok("three plans with the right prices", await page.locator(".plan").count() === 3 && /\$0/.test(plansText) && /\$35/.test(plansText) && /\$795/.test(plansText));
  ok("plan features listed", ["60 credits every day you log in", "1,500 credits per month", "Intelligent UI", "3 images a day with GPT Image 2.5 Sunburst", "Local Mode", "Unlimited access to everything"].every(f => plansText.includes(f)));
  ok("TEST mode banner shown", plansText.includes("TEST MODE"));
  await page.screenshot({ path: OUT + "/plans-1-upgrade.png" });

  // ---------- Google Pay checkout: Plus ----------
  await page.click("[data-buy=plus]");
  await page.waitForSelector("#gpay-test-btn");
  ok("checkout shows the total", (await page.textContent(".modal-b")).includes("$35.00 USD"));
  await page.screenshot({ path: OUT + "/plans-2-checkout.png" });
  await page.click("#gpay-test-btn");
  await page.waitForSelector(".modal h2:has-text('Welcome to Plus')");
  const gp = await page.evaluate(() => window.__gp);
  ok("Google Pay client runs in TEST", gp.created[0].environment === "TEST");
  ok("isReadyToPay asked for cards", gp.ready.allowedPaymentMethods[0].type === "CARD");
  const rq = gp.requests[0];
  ok("payment request: $35.00 USD, final price", rq.transactionInfo.totalPrice === "35.00" && rq.transactionInfo.currencyCode === "USD" && rq.transactionInfo.totalPriceStatus === "FINAL");
  ok("payment request uses the test gateway", rq.allowedPaymentMethods[0].tokenizationSpecification.parameters.gateway === "example");
  ok("Subscribe button type", gp.button.buttonType === "subscribe");
  ok("welcome shows the test card", (await page.textContent(".modal-b")).includes("Test payment approved with Visa •••• 1111"));
  await page.screenshot({ path: OUT + "/plans-3-welcome.png" });
  await page.click("[data-go-chat]");
  s = await state();
  ok("Plus active with 1,500 credits", s.plan === "plus" && s.credits === 1500 && s.key.includes("Plus · 1,500 credits"), s.key);
  ok("renews in about a month", s.renewsAt - Date.now() > 27 * 864e5 && s.renewsAt - Date.now() < 32 * 864e5);

  // ---------- Plus features ----------
  await page.evaluate(() => { S.agents[0].model = "gpt-5"; save(true); });
  await sendAndWait("hello again");
  const plusReq = seen[seen.length - 1].body;
  ok("Plus can use GPT-5", plusReq.model === "gpt-5" && (await lastBot().textContent()).includes("OK from gpt-5"));
  ok("Plus: Intelligent UI prompt and image tool", /Intelligent UI/.test(plusReq.messages[0].content) && plusReq.tools.some(t => t.function.name === "generate_image"));
  ok("Plus: credit spent", (await state()).credits === 1499);

  await sendAndWait("make it interactive");
  ok("Intelligent UI renders buttons", await lastBot().locator(".ui-opt").count() === 3);
  before = seen.length;
  await page.locator(".ui-opt", { hasText: "Option B" }).click();
  await page.waitForFunction(() => !document.querySelector("#sendBtn.stop")); await page.waitForTimeout(150);
  const lastUser = seen[seen.length - 1].body.messages.filter(m => m.role === "user").pop().content;
  ok("tapping a button sends it as your reply", seen.length === before + 1 && lastUser === "Option B");
  ok("chosen button stays highlighted", await page.locator(".ui-opt.on", { hasText: "Option B" }).count() === 1 && await page.locator(".ui-opt", { hasText: "Option A" }).first().isDisabled());
  await page.screenshot({ path: OUT + "/plans-4-intelligent-ui.png" });

  await sendAndWait("draw a fox");
  await page.waitForFunction(() => { const i = [...document.querySelectorAll("img.gen-img")].pop(); return i && i.src.startsWith("data:image/png"); });
  ok("image created and shown in chat", imageReqs === 1 && (await state()).images === 1);
  const imgBody = await page.evaluate(() => S.settings.imageModel);
  ok("image model is GPT Image 2.5 Sunburst", imgBody === "gpt-image-2.5-sunburst");
  const limit = await page.evaluate(async () => { const id = S.agents[0].id, r = []; for (let i = 0; i < 3; i++) r.push(await execTool(id, "generate_image", { prompt: "x" }, null)); return r; });
  ok("3 images a day, then the limit", imageReqs === 3 && /limit reached/.test(limit[2]), limit[2].slice(0, 60));

  // ---------- Ultra + Local Mode ----------
  await page.click("#sbUpgrade");
  await page.click("[data-buy=ultra]");
  await page.waitForSelector("#gpay-test-btn");
  await page.click("#gpay-test-btn");
  await page.waitForSelector(".modal h2:has-text('Welcome to Ultra')");
  await page.click("[data-go-chat]");
  const ultraReq = (await page.evaluate(() => window.__gp.requests)).pop();
  s = await state();
  ok("Ultra charged $795.00 in TEST", ultraReq.transactionInfo.totalPrice === "795.00");
  ok("Ultra is unlimited", s.plan === "ultra" && s.key.includes("Ultra · Unlimited") && await page.locator("#sbUpgrade").isHidden());
  const limitU = await page.evaluate(async () => { S.billing.images.used = 50; return execTool(S.agents[0].id, "generate_image", { prompt: "x" }, null); });
  ok("Ultra has no image limit", !/limit/.test(limitU));

  await page.click("#sbSettings");
  ok("Local Mode is unlocked on Ultra", !(await page.locator("#sLocal").isDisabled()));
  await page.check("#sLocal");
  await page.screenshot({ path: OUT + "/plans-5-settings.png" });
  await page.click("#sSave");
  await sendAndWait("hello local");
  const loc = seen[seen.length - 1];
  ok("Local Mode talks to the local server", loc.url === "http://localhost:11434/v1/chat/completions" && loc.body.model === "llama3.2");
  ok("Local Mode sends no API key", !loc.auth);
  ok("header shows Local", (await page.textContent("#modelSub")).startsWith("Local ·"));

  // ---------- cancel, a cancelled payment, renewals ----------
  page.once("dialog", d => d.accept());
  await page.click("#sbSettings"); await page.click("#sCancel");
  s = await state();
  ok("cancel returns to Free", s.plan === "free" && s.credits === 60);
  ok("Local Mode is off on Free", await page.evaluate(() => !localOn()));
  await page.evaluate(() => { window.__gpCancel = true; });
  await page.click("#sbUpgrade"); await page.click("[data-buy=plus]");
  await page.waitForSelector("#gpay-test-btn"); await page.click("#gpay-test-btn"); await page.waitForTimeout(300);
  ok("closing the Google Pay sheet changes nothing", (await state()).plan === "free" && (await page.textContent("#payMsg")) === "");
  await page.keyboard.press("Escape");

  await page.evaluate(() => { S.billing.day = "2000-01-01"; S.billing.credits = 5; save(true); });
  await page.reload();
  ok("Free: a new day tops up to 60", (await state()).credits === 60);
  await page.evaluate(() => { Object.assign(S.billing, { plan: "plus", renewsAt: Date.now() - 1000, credits: 3 }); save(true); });
  await page.reload();
  s = await state();
  ok("Plus: a new billing month refills 1,500", s.credits === 1500 && s.renewsAt > Date.now());

  // ---------- phone layout ----------
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.route("https://pay.google.com/gp/p/js/pay.js", r => r.fulfill({ status: 200, contentType: "application/javascript", body: PAYJS }));
  await m.goto(FILE);
  await m.click("#openSidebar"); await m.click("#sbUpgrade");
  await m.screenshot({ path: OUT + "/plans-6-mobile.png" });
  ok("phone: plans fit the screen", await m.evaluate(() => document.querySelector(".modal").getBoundingClientRect().width <= innerWidth));

  ok("no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = checks.filter(c => !c[1]).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
