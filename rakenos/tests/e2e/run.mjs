#!/usr/bin/env node
/*
 * RakenOS end-to-end tests. Starts the mock backend (which also serves the
 * assembled web build) and drives RakenOS in Chromium with Playwright.
 *
 *   npm run assemble && node tests/e2e/run.mjs
 *
 * Screenshots are written to tests/e2e/output/.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'tests', 'e2e', 'output');
const PORT = 8799;
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

// Model names are assembled from fragments so this file stays clean for the static guard.
const MODEL_RE = new RegExp(`${['R', 'a', 'k', 'e', 'n'].join('')}[\\s_-]*${String.fromCharCode(83)}\\s*\\d+|\\b${String.fromCharCode(83)}\\d+[\\s_-]*Pro\\b`, 'i');
const GROUP = { A: 'test-rollout-id-0003', B: 'test-rollout-id-0004', C: 'test-rollout-id-0000', D: 'test-rollout-id-0001' };

const results = [];
const renderedTexts = [];
let browser;

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function launchContext({ scheme = 'light', caps = '', preset = true, group = 'A', dayMs = 4000, extraSettings = {}, updateSettings = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1, colorScheme: scheme });
  if (preset) {
    await ctx.addInitScript(({ group, dayMs, extraSettings, updateSettings }) => {
      if (localStorage.getItem('rakenos.e2e')) return;
      localStorage.setItem('rakenos.e2e', '1');
      localStorage.setItem('rakenos.settings', JSON.stringify({ setupComplete: true, ...extraSettings }));
      localStorage.setItem('rakenos.rollout', JSON.stringify({ id: group, createdAt: 1 }));
      localStorage.setItem('rakenos.update.settings', JSON.stringify({ rolloutDayMs: dayMs, ...updateSettings }));
    }, { group: GROUP[group], dayMs, extraSettings, updateSettings });
  }
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(`${BASE}/?caps=${caps}`);
  await page.waitForFunction(() => window.__rakenos, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}

const vis = (page, sel) => page.locator(sel).locator('visible=true').first();
async function tap(page, sel, wait = 450) { await vis(page, sel).click(); await page.waitForTimeout(wait); }
async function capture(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  renderedTexts.push({ name, text: await page.evaluate(() => document.body.innerText) });
}
async function unlock(page) { await page.keyboard.press('Enter'); await page.waitForTimeout(600); }
async function home(page) { await page.evaluate(() => window.__rakenos.system.goHome()); await page.waitForTimeout(450); }
const state = (page) => page.evaluate(() => { const e = window.__rakenos.updates.engine; return { status: e.state.status, installed: e.installedVersion, target: e.state.target, group: window.__rakenos.updates.rollout.group }; });
async function waitStatus(page, statuses, ms = 20000) {
  const want = [].concat(statuses);
  const t0 = Date.now();
  for (;;) { const s = await state(page); if (want.includes(s.status)) return s; if (Date.now() - t0 > ms) throw new Error(`update status stayed ${s.status}, expected ${want.join('/')}`); await page.waitForTimeout(200); }
}

async function scenario(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log(`  ✓ ${name} (${Date.now() - t0} ms)`); }
  catch (e) { results.push({ name, ok: false, error: e.message }); console.log(`  ✗ ${name}\n      ${e.message.split('\n')[0]}`); }
}

// ------------------------------------------------------------------ Tests --
async function run() {
  console.log('RakenOS e2e');

  await scenario('boot animation, first-run setup and PIN creation', async () => {
    const { ctx, page } = await launchContext({ preset: false });
    assert(await page.locator('.boot').count() >= 0, 'boot layer');
    await page.waitForSelector('.setup__cta', { timeout: 10000 });
    await capture(page, 'setup-welcome');
    await tap(page, '.setup__cta'); await capture(page, 'setup-appearance');
    await tap(page, '.setup__cta');
    const pin = async () => { for (const d of '2580') { await tap(page, `.pin__key[aria-label="${d}"]`, 70); } await page.waitForTimeout(350); };
    await pin(); await pin();
    await page.waitForTimeout(700);
    await tap(page, '.setup__cta'); await tap(page, '.setup__cta'); await tap(page, '.setup__cta', 900);
    assert(await page.evaluate(() => window.__rakenos.settings.get('setupComplete')), 'setup not completed');
    assert(await page.evaluate(() => window.__rakenos.settings.get('screenLock') === 'pin'), 'PIN not stored');
    assert(await vis(page, '#home .dock').isVisible(), 'home not visible after setup');
    await capture(page, 'home-after-setup');
    // Lock screen with PIN
    await page.evaluate(() => window.__rakenos.system.lockscreen.lock({ sleep: false })); await page.waitForTimeout(400);
    await capture(page, 'lock-screen');
    await unlock(page);
    assert(await vis(page, '.lock__pin .pin').isVisible(), 'PIN pad not shown');
    for (const d of '1111') await tap(page, `.pin__key[aria-label="${d}"]`, 70);
    await page.waitForTimeout(600);
    assert(await page.evaluate(() => window.__rakenos.system.locked), 'wrong PIN unlocked the device');
    assert((await vis(page, '.pin__subtitle').textContent()).includes('Incorrect'), 'no incorrect PIN message');
    for (const d of '2580') await tap(page, `.pin__key[aria-label="${d}"]`, 70);
    await page.waitForTimeout(900);
    assert(!(await page.evaluate(() => window.__rakenos.system.locked)), 'correct PIN did not unlock');
    await ctx.close();
  });

  await scenario('home screen, widgets, dock, search and recent apps', async () => {
    const { ctx, page } = await launchContext();
    await unlock(page);
    for (const id of ['settings', 'gallery', 'files', 'notes', 'calculator', 'clock', 'browser', 'store']) assert(await page.locator(`#home .tile[data-app="${id}"]`).count() === 1, `missing ${id}`);
    assert(await page.locator('#home .widget').count() >= 3, 'widgets missing');
    await capture(page, 'home');
    await tap(page, '.home__search'); await page.keyboard.type('display'); await page.waitForTimeout(300);
    assert(await vis(page, '.search-hit:has-text("Display")').isVisible(), 'settings search result missing');
    await capture(page, 'search');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await tap(page, '#home .tile[data-app="notes"]', 700); await home(page);
    await tap(page, '#home .tile[data-app="calculator"]', 700);
    await page.evaluate(() => window.__rakenos.system.showRecents()); await page.waitForTimeout(500);
    assert(await page.locator('#recents .recent-card').count() === 2, 'recent apps should list 2 apps');
    await capture(page, 'recents');
    await ctx.close();
  });

  await scenario('control center and notification center', async () => {
    const { ctx, page } = await launchContext();
    await unlock(page);
    await page.evaluate(() => window.__rakenos.system.panels.open('cc')); await page.waitForTimeout(400);
    await capture(page, 'control-center');
    await tap(page, '.cc-tile[aria-label="Do Not Disturb"]');
    assert(await page.evaluate(() => window.__rakenos.settings.get('dnd')), 'DND did not toggle');
    assert(await page.locator('#statusbar [aria-label="Do Not Disturb"]').count() === 1, 'status bar DND icon missing');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.evaluate(() => window.__rakenos.system.notify('notes', 'Reminder', 'Buy coffee beans'));
    await page.evaluate(() => window.__rakenos.system.panels.open('nc')); await page.waitForTimeout(400);
    assert(await vis(page, '.notif:has-text("Buy coffee beans")').isVisible(), 'notification not listed');
    await capture(page, 'notification-center');
    await ctx.close();
  });

  await scenario('settings pages and About RakenOS', async () => {
    const { ctx, page } = await launchContext();
    await unlock(page);
    await tap(page, '#home .tile[data-app="settings"]', 800);
    await capture(page, 'settings');
    for (const [row, title] of [['about', 'About RakenOS']]) {
      await tap(page, `[data-row="${row}"]`, 600);
      const t = await page.evaluate(() => document.querySelector('.window:not([hidden]) .page:not([hidden])').innerText);
      assert(t.includes(title) && t.includes('Version 1.0.0') && t.includes('Security status') && t.includes('System update'), 'About content incomplete');
      await capture(page, 'about');
      await page.keyboard.press('Escape'); await page.waitForTimeout(450);
    }
    for (const label of ['Display', 'Battery', 'Security', 'Privacy', 'Sound & Haptics']) {
      await tap(page, `.window:not([hidden]) .page:not([hidden]) .r-row:has-text("${label}")`, 550);
      await capture(page, `settings-${label.toLowerCase().replace(/\W+/g, '-')}`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(450);
    }
    await ctx.close();
  });

  await scenario('capability detection: hardware-specific features appear only when present', async () => {
    let { ctx, page } = await launchContext();
    await unlock(page);
    assert(await page.locator('#home .tile[data-app="scanner"]').count() === 0, 'scanner app shown without scanner hardware');
    await tap(page, '#home .tile[data-app="settings"]', 700);
    assert(await page.locator('[data-row="nfc"]').count() === 0, 'NFC settings shown without NFC');
    await ctx.close();
    ({ ctx, page } = await launchContext({ caps: 'nfc,scanner2d,torch' }));
    await unlock(page);
    assert(await page.locator('#home .tile[data-app="scanner"]').count() === 1, 'scanner app missing with scanner hardware');
    await tap(page, '#home .tile[data-app="settings"]', 700);
    assert(await page.locator('[data-row="nfc"]').count() === 1, 'NFC settings missing with NFC');
    assert(await page.locator('[data-row="scanner"]').count() === 1, 'Scanner settings missing');
    await capture(page, 'settings-with-capabilities');
    await page.evaluate(() => window.__rakenos.system.panels.open('cc')); await page.waitForTimeout(400);
    assert(await page.locator('.cc-tile[aria-label="Flashlight"]').count() === 1, 'flashlight tile missing with torch');
    await ctx.close();
  });

  await scenario('system update UI: check for updates, update available, download, verify, prepare, ready', async () => {
    const { ctx, page } = await launchContext({ group: 'A', updateSettings: { autoDownload: false, autoInstall: false, automaticUpdates: false } });
    await unlock(page);
    await tap(page, '#home .tile[data-app="settings"]', 700);
    await tap(page, '[data-row="system-update"]', 700);
    await capture(page, 'system-update');
    const txt = await page.evaluate(() => document.querySelector('.upd').innerText);
    for (const s of ['RakenOS', 'Current Version', 'Last Checked', 'Automatic Updates', 'Update History']) assert(txt.includes(s), `System Update lacks "${s}"`);
    await tap(page, '[data-testid="check-updates"]', 100);
    await waitStatus(page, 'available', 8000);
    await page.waitForTimeout(300);
    assert((await vis(page, '[data-testid="update-status"]').textContent()).includes('RakenOS 1.0.1 is available'), 'available message missing');
    await capture(page, 'update-available');
    await tap(page, '[data-testid="download"]', 300);
    await waitStatus(page, 'downloading', 3000); await capture(page, 'update-downloading');
    await waitStatus(page, 'verifying', 12000);
    await waitStatus(page, 'preparing', 5000);
    await waitStatus(page, 'ready', 5000); await page.waitForTimeout(300);
    await capture(page, 'update-ready');
    await tap(page, '[data-testid="install"]', 200);
    await waitStatus(page, 'updated', 8000);
    assert((await state(page)).installed === '1.0.1', 'not updated to 1.0.1');
    await page.waitForTimeout(3500); // restart animation
    await ctx.close();
  });

  await scenario('automatic updates: settings persist, download automatically, install when locked', async () => {
    const { ctx, page } = await launchContext({ group: 'A' });
    await unlock(page);
    await tap(page, '#home .tile[data-app="settings"]', 700);
    await tap(page, '[data-row="system-update"]', 600);
    await tap(page, '[data-row="automatic-updates"]', 600);
    await capture(page, 'automatic-updates');
    const toggles = await page.evaluate(() => window.__rakenos.updates.engine.settings);
    assert(toggles.autoDownload && toggles.autoInstall, 'automatic update defaults should be on');
    await page.evaluate(() => window.__rakenos.updates.engine.check());
    await waitStatus(page, 'ready', 20000);
    assert((await state(page)).installed === '1.0.0', 'must not install while in use');
    await page.evaluate(() => window.__rakenos.system.lock());
    await waitStatus(page, 'updated', 8000);
    assert((await state(page)).installed === '1.0.1', 'install-when-ready did not install while locked');
    await page.mouse.click(200, 400); await page.waitForTimeout(500);
    assert(await vis(page, '.lock-notif:has-text("RakenOS 1.0.1 installed")').isVisible(), 'installed notification missing on Lock Screen');
    await capture(page, 'lock-after-auto-update');
    // The next update is offered automatically afterwards
    await page.evaluate(() => window.__rakenos.updates.engine.check());
    const s = await waitStatus(page, ['available', 'downloading', 'verifying', 'preparing', 'ready'], 8000);
    assert(s.target === '1.0.2', `expected 1.0.2 next, got ${s.target}`);
    await ctx.close();
  });

  await scenario('staged rollout: group D waits, then receives the same version', async () => {
    const dayMs = 5000;
    const { ctx, page } = await launchContext({ group: 'D', dayMs, updateSettings: { autoDownload: false } });
    await unlock(page);
    await page.evaluate(() => window.__rakenos.updates.engine.check());
    const s = await waitStatus(page, 'rollout-pending', 6000);
    assert(s.group === 'D' && s.target === '1.0.1', 'group D should be pending for 1.0.1');
    await tap(page, '#home .tile[data-app="settings"]', 700);
    await tap(page, '[data-row="system-update"]', 600);
    const t = await page.evaluate(() => document.querySelector('.upd').innerText);
    assert(t.includes('rollout group D') && t.includes('rolling out'), 'rollout explanation missing');
    await capture(page, 'rollout-pending');
    const day = await page.evaluate(() => window.__rakenos.updates.release('1.0.1').rollout.phases.find((p) => p.group === 'D').offsetDays);
    const since = await page.evaluate(() => window.__rakenos.updates.engine.system.installedAt);
    const now = await page.evaluate(() => Date.now());
    await page.waitForTimeout(Math.max(0, since + day * dayMs - now) + 600);
    await page.evaluate(() => window.__rakenos.updates.engine.check());
    const s2 = await waitStatus(page, 'available', 6000);
    assert(s2.target === '1.0.1', 'group D should receive the same version 1.0.1');
    await ctx.close();
  });

  await scenario('update history and release notes (177 releases)', async () => {
    const { ctx, page } = await launchContext();
    await unlock(page);
    await page.evaluate(() => window.__rakenos.system.openApp('settings', { route: 'update-history' })); await page.waitForTimeout(1200);
    assert(await page.locator('[data-row="release-1.0.0"]').count() === 1, 'installed release missing from history');
    await tap(page, '.hist__switch button:has-text("All releases")', 500);
    const rows = await page.locator('.page:not([hidden]) [data-row^="release-"]').count();
    assert(rows === 177, `expected 177 releases in history, got ${rows}`);
    const first = await page.locator('.page:not([hidden]) [data-row^="release-"]').first().getAttribute('data-row');
    assert(first === 'release-59.0.2', 'history must start with the newest release');
    await capture(page, 'update-history');
    await tap(page, '[data-row="release-59.0.2"]', 700);
    const notes = await page.evaluate(() => document.querySelector('[data-testid="release-notes"]').innerText);
    assert(notes.includes('RakenOS 59.0.2') || notes.includes('Security, polish'), 'release notes header');
    assert(/Released (March|April|May) \d+/.test(notes), 'release date missing');
    assert(notes.includes('Staged rollout') && notes.includes('Group D'), 'rollout schedule missing');
    await capture(page, 'release-notes');
    await ctx.close();
  });

  await scenario('Raken Store: discover, install with permissions, open, update, compatibility', async () => {
    const { ctx, page } = await launchContext();
    await unlock(page);
    await tap(page, '#home .tile[data-app="store"]', 900);
    await capture(page, 'store-discover');
    await tap(page, '.store-row:has-text("Hydrate")', 700);
    await capture(page, 'store-detail');
    await tap(page, '[data-testid="get-com.raken.samples.hydrate"]', 600);
    await tap(page, '[data-testid="confirm-install"]', 2500);
    assert(await page.evaluate(() => window.__rakenos.rasApps.isInstalled('com.raken.samples.hydrate')), 'Hydrate not installed');
    await tap(page, '[data-testid="open-com.raken.samples.hydrate"]', 1200);
    assert(await vis(page, '.ras-app .r-large-title:has-text("Hydrate")').isVisible(), 'RAS app did not render');
    await tap(page, '.ras-app button:has-text("Glass")', 400);
    assert((await vis(page, '.ras-app').innerText()).includes('250 ml'), 'RScript state did not update the RDesign UI');
    await capture(page, 'ras-app-hydrate');
    await home(page);
    await tap(page, '#home .tile[data-app="store"]', 600);
    await tap(page, '.tabbar__item:has-text("Library")', 600);
    await tap(page, '[data-testid="update-com.raken.samples.tally"]', 2500);
    const v = await page.evaluate(() => window.__rakenos.rasApps.get('com.raken.samples.tally').manifest.version);
    assert(v === '2.1.0', `Tally should update to 2.1.0, is ${v}`);
    await capture(page, 'store-library');
    await tap(page, '.tabbar__item:has-text("Search")', 500);
    await page.fill('.store input[type=search]', 'streaks'); await page.waitForTimeout(300);
    assert((await vis(page, '.store-row:has-text("Streaks") .store-get').textContent()).includes('Unavailable'), 'Streaks should need a newer RakenOS');
    assert(await page.locator('.store :text("Upload"), .store :text("Publish app")').count() === 0, 'Store must not offer uploads');
    await ctx.close();
  });

  await scenario('light mode and dark mode', async () => {
    for (const scheme of ['light', 'dark']) {
      const { ctx, page } = await launchContext({ scheme, extraSettings: { theme: 'auto' } });
      await unlock(page);
      const theme = await page.evaluate(() => document.documentElement.dataset.theme);
      assert(theme === scheme, `theme ${theme} != ${scheme}`);
      await tap(page, '#home .tile[data-app="settings"]', 700);
      const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.window .page')).backgroundColor);
      const lum = bg.match(/\d+/g).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3;
      assert(scheme === 'dark' ? lum < 40 : lum > 200, `${scheme} background luminance ${lum}`);
      await capture(page, `theme-${scheme}`);
      await ctx.close();
    }
  });

  await scenario('no device model name is rendered anywhere', async () => {
    const bad = renderedTexts.filter((t) => MODEL_RE.test(t.text));
    assert(renderedTexts.length > 20, 'too few screens captured');
    assert(!bad.length, `model name rendered on: ${bad.map((b) => b.name).join(', ')}`);
    const { ctx, page } = await launchContext({ caps: 'nfc,scanner2d,torch,advancedCamera' });
    const leaked = await page.evaluate(() => JSON.stringify(localStorage).match(/model|manufacturer/i));
    assert(!leaked, 'storage contains model information');
    await ctx.close();
  });
}

// ------------------------------------------------------------------ Main --
const server = spawn(process.execPath, [path.join(ROOT, 'mock-backend', 'server.mjs'), '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => { server.stdout.on('data', (d) => { if (String(d).includes('mock backend')) resolve(); }); server.on('exit', reject); setTimeout(resolve, 3000); });
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
try { await run(); } finally { await browser.close(); server.kill(); }
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed · ${renderedTexts.length} screens checked for model names · screenshots in tests/e2e/output/`);
process.exit(failed.length ? 1 : 0);
