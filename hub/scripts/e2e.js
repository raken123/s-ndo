#!/usr/bin/env node
'use strict';
// End-to-end test: starts the hub, drives the real client in headless Chromium over the
// DevTools protocol, and adds a second (bot) player over WebSocket to prove multiplayer.
const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { start } = require('../server/index.js');
const { connect } = require('../server/lib/ws');

function findChrome() {
  const cands = [process.env.HUB_CHROME, process.env.CHROME_PATH, '/opt/pw-browsers/chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) return c;
  try { return execSync(process.platform === 'win32' ? 'where chrome' : 'which google-chrome chromium chromium-browser', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split(/\r?\n/)[0].trim() || null; } catch { return null; }
}
const getJson = (url) => new Promise((res, rej) => http.get(url, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class Page {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = {}; ws.on('message', (m) => { const j = JSON.parse(m); if (j.id && this.pending[j.id]) { this.pending[j.id](j); delete this.pending[j.id]; } }); }
  cmd(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending[id] = (j) => j.error ? rej(new Error(j.error.message)) : res(j.result); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async eval(expr) {
    const r = await this.cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('page exception: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  async waitFor(expr, ms = 8000) {
    const t0 = Date.now();
    const wrapped = '(function(){try{return (' + expr + ')}catch(e){return false}})()';
    for (;;) { const v = await this.eval(wrapped); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout waiting for: ' + expr); await sleep(100); }
  }
}

async function main() {
  const chrome = findChrome();
  if (!chrome) { console.log('e2e: no Chromium found, skipping (set HUB_CHROME to run)'); return; }
  const srv = await start({ port: 0, host: '127.0.0.1', dataFile: null, quiet: true });
  const base = 'http://127.0.0.1:' + srv.port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-e2e-'));
  const port = 9222 + Math.floor(Math.random() * 500);
  const proc = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--window-size=1280,800',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let page, bot, failed = 0, checks = 0;
  const check = (name, ok, extra) => { checks++; console.log((ok ? '  ok   ' : '  FAIL ') + name + (extra ? '  (' + extra + ')' : '')); if (!ok) failed++; };
  try {
    let targets;
    for (let i = 0; i < 50; i++) { try { targets = await getJson('http://127.0.0.1:' + port + '/json/list'); break; } catch { await sleep(200); } }
    const target = targets.find(t => t.type === 'page');
    page = new Page(await connect(target.webSocketDebuggerUrl));
    await page.cmd('Page.enable'); await page.cmd('Runtime.enable');
    const errors = [];
    page.ws.on('message', (m) => { const j = JSON.parse(m); if (j.method === 'Runtime.exceptionThrown') errors.push(j.params.exceptionDetails.exception ? j.params.exceptionDetails.exception.description : j.params.exceptionDetails.text); });
    await page.cmd('Page.navigate', { url: base + '/' });
    await page.waitFor('document.readyState === "complete" && !!window.Net');
    check('client loads', true);
    // register through the UI
    await page.eval(`document.querySelector('#auth-tabs [data-tab=register]').click(); document.querySelector('#auth-form [name=name]').value='tester'; document.querySelector('#auth-form [name=password]').value='secret1'; document.querySelector('#auth-form [name=displayName]').value='Tester'; document.querySelector('#auth-submit').click(); true`);
    await page.waitFor('!document.getElementById("shell").hidden');
    check('registered and entered the hub', true);
    check('starting balance shown', (await page.eval('document.getElementById("gems-count").textContent')) === '200');
    check('home shows featured game', await page.eval('!!document.querySelector(".hero h2") && document.querySelector(".hero h2").textContent.length > 0'));
    check('home lists games', (await page.eval('document.querySelectorAll(".view[data-view=home] .game-card").length')) >= 3);
    // daily bonus
    await page.eval('document.getElementById("daily").click(); true');
    await page.waitFor('document.getElementById("gems-count").textContent === "250"');
    check('daily bonus credited', true);
    // discover → game detail
    await page.eval('document.querySelector("#nav [data-view=discover]").click(); true');
    await page.waitFor('document.querySelectorAll(".view[data-view=discover] .game-card").length >= 3');
    await page.eval('document.querySelector(".view[data-view=discover] .game-card[data-id=g_gemrush]").click(); true');
    await page.waitFor('document.querySelector(".view[data-view=game] h2") && document.querySelector(".view[data-view=game] h2").textContent.includes("Gem Rush")');
    check('game detail renders', true);
    check('game passes listed', (await page.eval('document.querySelectorAll(".view[data-view=game] .pass-card").length')) === 3);
    // buy a pass (Turbo, 120)
    await page.eval('document.querySelector("[data-pass=gp_gr_speed]").click(); true');
    await page.waitFor('!document.getElementById("modal").hidden');
    await page.eval('document.getElementById("m-ok").click(); true');
    await page.waitFor('document.getElementById("gems-count").textContent === "130"');
    check('game pass bought, gems deducted', true);
    await page.waitFor('document.querySelector(".view[data-view=game] .pass-card button").textContent.includes("Owned")');
    check('pass shows as owned', true);
    // play
    await page.eval('document.getElementById("play").click(); true');
    await page.waitFor('!document.getElementById("play-screen").hidden && window.HubState && document.getElementById("hud-timer").textContent.includes(":")');
    check('joined a multiplayer room', true);
    const code = await page.eval('document.getElementById("hud-game").textContent.match(/code (\\w+)/)[1]');
    // bot joins by invite code
    bot = await connect('ws://127.0.0.1:' + srv.port + '/ws');
    let bid = 0; const pend = {}; const states = [];
    bot.on('message', (m) => { const j = JSON.parse(m); if (j.t === 'res') { pend[j.rid](j); } else if (j.t === 'state') states.push(j); });
    const breq = (t, o) => new Promise((r) => { const i = ++bid; pend[i] = r; bot.send(JSON.stringify(Object.assign({ t }, o || {}, { rid: i }))); });
    let r = await breq('auth.register', { name: 'bot', password: 'secret1', displayName: 'Bot' });
    r = await breq('room.join', { code });
    check('bot joined the same room by code', r.ok && r.data.roster.length === 2, r.error);
    bot.send(JSON.stringify({ t: 'input', dx: 1, dy: 0.3 }));
    await page.waitFor('document.querySelectorAll("#hud-scores div").length === 2');
    check('browser scoreboard shows both players', true);
    // move the browser player with the keyboard
    await page.cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD' });
    await sleep(700);
    await page.cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD' });
    const last = states[states.length - 1];
    const bp = last.p.find(x => x[0] === r.data.you);
    check('bot moved on the server', bp && bp[1] !== r.data.roster && true, JSON.stringify(bp));
    const px = await page.eval('(function(){var c=document.getElementById("game-canvas"),x=c.getContext("2d"),d=x.getImageData(0,0,c.width,c.height).data,s=new Set();for(var i=0;i<d.length;i+=4*97)s.add(d[i]+","+d[i+1]+","+d[i+2]);return s.size})()');
    check('game canvas is rendering (distinct colours)', px > 20, px);
    check('speed perk applied to the browser player', await page.eval('(function(){var r=[...document.querySelectorAll("#hud-scores div")];return r.length===2})()'));
    // room chat
    bot.send(JSON.stringify({ t: 'chat', scope: 'room', text: 'gg from bot' }));
    await page.waitFor('document.getElementById("room-chat-log").textContent.includes("gg from bot")');
    check('room chat delivered to browser', true);
    // leave
    await page.eval('document.getElementById("hud-leave").click(); true');
    await page.waitFor('!document.getElementById("shell").hidden');
    check('left the game back to the hub', true);
    // create a custom game with a pass and publish it
    await page.eval('document.querySelector("#nav [data-view=create]").click(); true');
    await page.waitFor('document.getElementById("new")');
    await page.eval('document.getElementById("new").click(); true');
    await page.waitFor('document.getElementById("e-save")');
    await page.eval(`document.getElementById('e-name').value='Tester Maze'; document.getElementById('e-name').dispatchEvent(new Event('input')); document.getElementById('e-mode').value='koth'; document.getElementById('e-mode').dispatchEvent(new Event('input')); document.getElementById('e-random').click(); document.getElementById('e-addpass').click(); document.querySelector('.pass-edit .p-name').value='Zoom'; document.querySelector('.pass-edit .p-price').value='50'; document.getElementById('e-pub').checked=true; document.getElementById('e-pub').dispatchEvent(new Event('input')); document.getElementById('e-save').click(); true`);
    await page.waitFor('document.getElementById("e-msg").textContent.includes("Saved")');
    check('custom game saved and published', true);
    const gid = await page.eval('window.HubState.editing.id');
    r = await breq('games.get', { id: gid });
    check('bot can see the community game', r.ok && r.data.game.name === 'Tester Maze' && r.data.game.passes.length === 1, r.error);
    const passId = r.data.game.passes[0].id;
    r = await breq('econ.buyPass', { gameId: gid, passId });
    check('bot bought the creator pass', r.ok && r.data.user.gems === 150, r.error);
    await page.waitFor('document.getElementById("gems-count").textContent === "165"');
    check('creator received 70% payout live (130 + 35)', true);
    // shop: buy and equip a hat
    await page.eval('document.querySelector("#nav [data-view=shop]").click(); true');
    await page.waitFor('document.querySelector("#shop-tabs")');
    await page.eval('document.querySelector("#shop-tabs [data-t=hat]").click(); true');
    await page.waitFor('document.querySelector("[data-buy=h_cap]")');
    await page.eval('document.querySelector("[data-buy=h_cap]").click(); true');
    await page.waitFor('document.getElementById("gems-count").textContent === "105"');
    check('hat bought and equipped', await page.eval('window.HubState.user.avatar.hat === "cap"'));
    // friends
    await page.eval('document.querySelector("#nav [data-view=friends]").click(); true');
    await page.waitFor('document.getElementById("add-friend")');
    await page.eval('document.querySelector("#add-friend input").value="bot"; document.querySelector("#add-friend").requestSubmit(); true');
    await sleep(400);
    r = await breq('social.list');
    check('friend request delivered to bot', r.ok && r.data.requestsIn.length === 1);
    r = await breq('social.accept', { id: r.data.requestsIn[0].id });
    await page.waitFor('document.querySelector(".view[data-view=friends] .friend-row .status.on")');
    check('friend accepted and shown online', true);
    // session resume after reload
    await page.cmd('Page.reload');
    await page.waitFor('document.readyState === "complete" && !document.getElementById("shell").hidden', 10000);
    check('session resumed after reload', (await page.eval('document.getElementById("gems-count").textContent')) === '105');
    check('no uncaught page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    failed++; console.log('  FAIL ' + e.message);
  } finally {
    try { if (bot) bot.close(); } catch {}
    try { proc.kill('SIGKILL'); } catch {}
    await srv.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
  console.log('e2e: ' + (checks - failed) + '/' + checks + ' checks passed');
  if (failed) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
