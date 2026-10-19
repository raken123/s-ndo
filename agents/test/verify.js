// Drives dist/chatgpt-agents.html in headless Chromium against a mocked OpenAI API.
// Usage: node test/verify.js [outdir-for-screenshots]
const path = require("path");
const { chromium } = require(process.env.PW || "/opt/node22/lib/node_modules/playwright");
const FILE = "file://" + path.resolve(__dirname, "../dist/chatgpt-agents.html");
const OUT = process.argv[2] || path.resolve(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });

const sse = chunks => chunks.map(c => "data: " + JSON.stringify(c) + "\n\n").join("") + "data: [DONE]\n\n";
const textChunks = t => t.match(/.{1,6}/gs).map(p => ({ choices: [{ delta: { content: p } }] }));
const PAGE = "<!doctype html><html><body style='font-family:sans-serif;background:#0b1020;color:#fff;display:grid;place-items:center;height:100vh;margin:0'><div><h1 id=h>Hello from Coder's computer</h1><button onclick=\"h.textContent='Clicked!'\">Click me</button></div></body></html>";
const seen = [];
async function mock(route) {
  const body = JSON.parse(route.request().postData());
  body._auth = route.request().headers()["authorization"];
  seen.push(body);
  const sys = body.messages[0].content, last = body.messages[body.messages.length - 1];
  const name = (sys.match(/You are "([^"]+)"/) || [])[1];
  let chunks;
  if (name === "Coder" && last.role === "user" && /build/i.test(last.content)) {
    chunks = [
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", type: "function", function: { name: "write_file", arguments: "" } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: JSON.stringify({ path: "index.html", content: PAGE }) } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 1, id: "c2", type: "function", function: { name: "run_javascript", arguments: JSON.stringify({ code: "console.log(fs.list()); 6*7" }) } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 2, id: "c3", type: "function", function: { name: "show_on_screen", arguments: JSON.stringify({ path: "index.html" }) } }] } }] },
    ];
  } else if (last.role === "tool") {
    const results = body.messages.filter(m => m.role === "tool").map(m => m.content).join(" | ");
    chunks = textChunks("Done! I built **index.html** and it's on my screen. Tool results: `" + results.replace(/`/g, "") + "`");
  } else {
    chunks = textChunks(`Hi, I'm **${name}** using \`${body.model}\`.\n\n- point one\n- point two\n\n\`\`\`js\nconsole.log("${name}");\n\`\`\``);
  }
  await new Promise(r => setTimeout(r, 300));
  await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: sse(chunks) });
}

const checks = [];
const ok = (name, cond, extra) => { checks.push([name, !!cond]); console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.route("https://api.openai.com/v1/chat/completions", mock);
  await page.goto(FILE);
  await page.screenshot({ path: OUT + "/01-home.png" });
  ok("home shows ChatGPT-style greeting", await page.textContent("#emptyTitle") === "What can I help with?");
  ok("three starter agents in sidebar", await page.locator("#sbAgentList [data-agent]").count() === 3);
  ok("agent icons have two white eyes", await page.locator("#sbAgentList svg").first().locator("ellipse[fill='#fff']").count() === 2);

  // without a key, sending opens settings
  await page.fill("#input", "hello");
  await page.click("#sendBtn");
  ok("no key -> settings opens", await page.locator(".modal h2", { hasText: "Settings" }).count() === 1);
  await page.fill("#sKey", "sk-test-123");
  await page.click("#sSave");

  // 1:1 chat
  await page.click("#sendBtn");
  await page.waitForSelector(".msg.bot .md");
  await page.waitForFunction(() => !document.querySelector("#sendBtn.stop"));
  ok("1:1 reply streamed and rendered markdown", await page.locator(".msg.bot .md li").count() === 2);
  ok("code block rendered", await page.locator(".msg.bot .codeblock").count() === 1);
  ok("auth header carries key", seen[0] && seen[0]._auth === "Bearer sk-test-123");
  await page.screenshot({ path: OUT + "/02-chat.png" });

  // create a new agent
  await page.click("#sbNewAgent");
  await page.fill("#agName", "Designer");
  await page.click("[data-shape=hexagon]");
  await page.click("[data-color='#ec4899']");
  await page.screenshot({ path: OUT + "/03-create-agent.png" });
  await page.click("#agSave");
  ok("new agent created", await page.locator("#sbAgentList [data-agent]").count() === 4);

  // group chat with all four, parallel
  await page.click("#sbGroup");
  await page.locator("#gList input").nth(3).check();
  await page.fill("#gName", "Launch team");
  await page.click("#gGo");
  await page.fill("#input", "Team, build a landing page");
  const t0 = Date.now();
  await page.click("#sendBtn");
  await page.waitForFunction(() => document.querySelectorAll(".msg.bot").length === 4 && !document.querySelector("#sendBtn.stop"), null, { timeout: 15000 });
  const dt = Date.now() - t0;
  ok("group chat: 4 agents replied", await page.locator(".msg.bot").count() === 4);
  ok("parallel mode faster than sequential", dt < 4 * 300 + 1500, dt + "ms");
  const coder = page.locator(".msg.bot", { hasText: "Coder" });
  ok("Coder used its computer (3 actions)", (await coder.textContent()).includes("Used computer · 3 actions"));
  ok("run_javascript result came back", (await coder.textContent()).includes("42"));
  ok("computer panel opened by show_on_screen", await page.evaluate(() => document.body.classList.contains("pc-open")));
  const frame = page.frameLocator("#screenBox iframe");
  ok("agent's screen renders its HTML", (await frame.locator("#h").textContent()) === "Hello from Coder's computer");
  await frame.locator("button").click();
  ok("screen is interactive", (await frame.locator("#h").textContent()) === "Clicked!");
  await page.screenshot({ path: OUT + "/04-group-computer.png" });

  // other agents saw others? (parallel: no) - check group system prompt
  const grpReq = seen.find(b => /group chat/.test(b.messages[0].content));
  ok("group system prompt lists other agents", grpReq && /Designer/.test(grpReq.messages[0].content));

  // separate computers: Designer has no files
  await page.click("[data-pc]:has-text('Designer')");
  ok("each agent has its own computer", (await page.textContent("#pcBody")).includes("Files · 0"));
  await page.fill("#termInput", "fs.write('a.txt','hi'); fs.list().length");
  await page.press("#termInput", "Enter");
  await page.waitForFunction(() => document.querySelector("#pcBody .term").textContent.includes("→ 1"));
  ok("terminal runs code on agent's computer", true);

  // @mention only one agent
  const before = seen.length;
  await page.fill("#input", "@Researcher what do you think?");
  await page.click("#sendBtn");
  await page.waitForFunction(() => !document.querySelector("#sendBtn.stop"));
  ok("@mention -> only that agent answers", seen.length - before === 1 && /Researcher/.test(seen[seen.length - 1].messages[0].content));
  ok("other agents' messages passed as [Name]:", seen[seen.length - 1].messages.some(m => /^\[Coder\]:/.test(m.content || "")));

  // build plan image
  await page.click("#pcClose");
  await page.click("#sbPlan");
  const nat = await page.locator(".plan-img").evaluate(i => i.complete && i.naturalWidth);
  ok("build plan screenshot is in the app", nat === 1200, "width " + nat);
  await page.screenshot({ path: OUT + "/05-plan.png" });
  await page.keyboard.press("Escape");
  ok("Escape closes dialogs", await page.locator(".modal-bg").count() === 0);

  // persistence
  await page.reload();
  ok("chats + agents persist after reload", await page.locator("#sbChatList [data-chat]").count() === 2 && await page.locator("#sbAgentList [data-agent]").count() === 4);

  // model picker includes GPT-6 Astra
  await page.click("#modelBtn");
  ok("model picker offers GPT-6 Astra", await page.locator(".menu .mi", { hasText: "GPT-6 Astra" }).count() === 1);
  await page.screenshot({ path: OUT + "/06-models.png" });
  await page.keyboard.press("Escape"); await page.mouse.click(700, 500);

  // mobile
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  m.on("pageerror", e => errors.push("mobile: " + e.message));
  await m.goto(FILE);
  await m.screenshot({ path: OUT + "/07-mobile.png" });
  ok("mobile: no horizontal scroll", await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await m.click("#openSidebar");
  await m.screenshot({ path: OUT + "/08-mobile-sidebar.png" });

  ok("no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = checks.filter(c => !c[1]).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
