// Drives the "Koda med block" screen like a pupil would: examples (chess
// against the agent, the learning tic-tac-toe, talking), making variables and
// blocks through the real dialogs, uploads, the library, painting, monitors,
// and saving.
//
//   NODE_PATH=$(npm root -g) node build/verify-editor.cjs [app.html] [screenshot-dir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'app', 'index.html'));
const shots = process.argv[3];
let failed = 0;
const check = (name, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra != null && extra !== '' ? '  (' + extra + ')' : '')); if (!ok) failed++; };

// a small PNG and WAV to upload
function png() {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKklEQVR42mNk+M9Qz0AEYBxVSF+FQA0IwMQwqnBUIX0VAhAAq1YCEXz6FaoAAAAASUVORK5CYII=', 'base64');
}
function wav() {
  const n = 2205, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(22050, 24); b.writeUInt32LE(44100, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 10) * 8000), 44 + i * 2);
  return b;
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raken-'));
  fs.writeFileSync(path.join(tmp, 'gubbe.png'), png()); fs.writeFileSync(path.join(tmp, 'ljud.wav'), wav());
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('requestfailed', r => errors.push('saknas: ' + r.url().slice(0, 120)));
  const shot = async n => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, n + '.png') }); } };
  const S = expr => page.evaluate(expr);
  await page.goto('file://' + file);
  await page.evaluate(() => new Promise(r => { localStorage.clear(); const q = indexedDB.deleteDatabase('raken-ai-agenttraning'); q.onsuccess = q.onerror = q.onblocked = () => r(); })); await page.reload();
  await page.click('.card.new'); await page.fill('#nName', 'Robban'); await page.press('#nName', 'Enter');

  // agent picture
  await page.waitForSelector('.card button[title^="Ge agenten"]');
  await page.evaluate(() => { document.querySelector('.card button[title^="Ge agenten"]').click(); });
  await page.setInputFiles('#agentImgIn', path.join(tmp, 'gubbe.png'));
  await page.waitForTimeout(400);
  check('agenten kan få en egen bild', await S(() => !!RakenAI.agent().image));

  await page.click('.tabs [data-view=code]');
  await page.waitForFunction(() => window.RB && RB.E && RB.E.project, null, { timeout: 20000 });
  const cats = await S(() => [...document.querySelectorAll('.scratchCategoryMenuItemLabel')].map(e => e.textContent));
  check('alla kategorier finns', cats.join(',') === 'Rörelse,Utseende,Ljud,Händelser,Kontroll,Känna av,Operatorer,Variabler,Mina block,AI-agent,Schack,Penna,Musik,Text till tal', cats.join(','));
  check('första projektet öppnas', await S(() => RB.E.project.name === 'Min första sprajt' && RB.E.ws.getAllBlocks().length > 10));
  check('agentens egen bild blir kostym', await S(() => RB.E.project.targets[1].costumes[0].url.startsWith('data:image/png')));

  // run the first example and see the sprite move
  await page.click('#goFlag'); await page.waitForTimeout(600);
  const moved = await S(() => { const t = RB.E.vm.targets.find(t => !t.isStage); return t.x; });
  check('gröna flaggan startar skripten', moved > 20, moved);
  check('skripten som körs lyser', await S(() => RB.E.glow.size >= 1));
  await page.click('#goStop'); await page.waitForTimeout(100);
  check('stopp stoppar', await S(() => RB.E.vm.threads.length === 0));

  // clicking a block in the editor runs it
  await S(() => {
    const b = RB.E.ws.getAllBlocks().find(b => b.type === 'motion_movesteps');
    Blockly.Events.fire(new Blockly.Events.Ui(b, 'stackclick', undefined, undefined));
  });
  await page.waitForTimeout(300);
  check('klick på ett skript kör det', await S(() => RB.E.vm.threads.length > 0 || RB.E.vm.targets[1].x !== 0));
  await page.click('#goStop');

  // make a variable with the real dialog, only for this sprite
  await S(() => Blockly.Variables.createVariable(RB.E.ws, null, ''));
  await page.fill('#blkInput', 'poäng'); await page.check('#blkScopeOne'); await page.click('#dlgBlk button[value=ok]');
  await page.waitForTimeout(200);
  const pv = await S(() => { const v = Object.values(RB.E.project.variables).find(v => v.name === 'poäng'); return v && { owner: v.owner, sprite: RB.E.project.targets[1].id }; });
  check('ny variabel via dialogen, bara för sprajten', pv && pv.owner === pv.sprite, JSON.stringify(pv));
  await S(() => Blockly.Variables.createVariable(RB.E.ws, null, 'list'));
  await page.fill('#blkInput', 'saker'); await page.click('#dlgBlk button[value=ok]'); await page.waitForTimeout(200);
  check('ny lista för alla sprajtar', await S(() => { const v = Object.values(RB.E.project.variables).find(v => v.name === 'saker'); return v && v.type === 'list' && v.owner === 'stage'; }));
  // monitor via the checkbox event
  await S(() => { const id = Object.keys(RB.E.project.variables).find(k => RB.E.project.variables[k].name === 'poäng'); Blockly.Events.fire(new Blockly.Events.Change({ id, workspace: RB.E.ws, type: 'data_variable', isShadow: () => false, getParent: () => null }, 'checkbox', null, false, true)); });
  await page.waitForTimeout(300);
  check('kryssruta visar variabeln på scenen', await S(() => document.querySelectorAll('#monitors .mon').length === 1 && document.querySelector('#monitors .mon').textContent.includes('poäng')));

  // make a block with the real dialog
  await S(() => Blockly.Procedures.createProcedureDefCallback_(RB.E.ws));
  await page.waitForTimeout(400);
  await page.click('#procText'); await page.waitForTimeout(200);
  await page.click('#procWarp'); await page.click('#dlgProc button[value=ok]'); await page.waitForTimeout(400);
  const def = await S(() => { const b = RB.E.ws.getAllBlocks().find(b => b.type === 'procedures_prototype'); return b && b.mutationToDom().outerHTML; });
  check('"Skapa ett block" skapar ett eget block', !!def && /warp="true"/.test(def) && /argumentids="\[&quot;/.test(def), def && def.slice(0, 160));

  // costumes: upload, library, paint
  await page.click('[data-pane=costumes]');
  await page.click('#costUpload'); await page.setInputFiles('#blkFile', path.join(tmp, 'gubbe.png')); await page.waitForTimeout(500);
  await page.click('#costLib'); await page.click('.lib-item:has-text("Stjärna")'); await page.waitForTimeout(400);
  const cn = await S(() => RB.E.project.targets[1].costumes.map(c => c.name));
  check('kostym från uppladdning och bibliotek', cn.includes('gubbe') && cn.includes('Stjärna'), cn.join(','));
  await page.click('#costPaint'); await page.waitForTimeout(200);
  const pc = await page.locator('#paintCv').boundingBox();
  await page.mouse.move(pc.x + 100, pc.y + 100); await page.mouse.down(); await page.mouse.move(pc.x + 200, pc.y + 150, { steps: 5 }); await page.mouse.up();
  await page.click('#dlgPaint button[value=ok]'); await page.waitForTimeout(500);
  check('rita en egen kostym', await S(() => RB.E.project.targets[1].costumes.some(c => c.name.startsWith('målning'))));
  await shot('e1-costumes');
  // sounds
  await page.click('[data-pane=sounds]');
  await page.click('#sndUpload'); await page.setInputFiles('#blkFile', path.join(tmp, 'ljud.wav')); await page.waitForTimeout(400);
  await page.click('#sndLib'); await page.click('.lib-item:has-text("Vinst") button.primary'); await page.waitForTimeout(300);
  const sn = await S(() => RB.E.project.targets[1].sounds.map(s => s.name));
  check('ljud från uppladdning och bibliotek', sn.includes('ljud') && sn.includes('Vinst'), sn.join(','));
  await page.click('[data-pane=blocks]');
  // the costume menu in blocks knows the new costumes
  check('kostymmenyn listar nya kostymer', await S(() => {
    const b = RB.E.ws.getFlyout().getWorkspace().getAllBlocks().find(b => b.type === 'looks_costume');
    return b && b.getField('COSTUME').getOptions().some(o => o[0] === 'Stjärna');
  }));

  // sprites: library, backdrop from a course, delete
  await page.click('#addLib'); await page.click('.lib-item:has-text("Boll")'); await page.waitForTimeout(600);
  check('ny sprajt från biblioteket', await S(() => RB.E.project.targets.some(t => t.name === 'Boll') && RB.E.targetId === RB.E.project.targets.find(t => t.name === 'Boll').id));
  await page.click('#stageTile'); await page.waitForTimeout(300);
  check('scenens palett saknar rörelseblock', await S(() => RB.E.ws.getFlyout().getWorkspace().getAllBlocks().every(b => !b.type.startsWith('motion_'))));
  await page.click('[data-pane=costumes]'); await page.click('#costLib'); await page.click('.lib-item:has-text("Bana: 4. Labyrinten")'); await page.waitForTimeout(500);
  check('en hinderbana blir bakgrund', await S(() => RB.E.project.targets[0].costumes.some(c => c.name === '4. Labyrinten')));
  await page.click('[data-pane=blocks]');
  await S(() => RB.selectTarget(RB.E.project.targets.find(t => t.name === 'Boll').id));
  await page.click('#spriteDel'); await page.click('#dlgBlk button[value=ok]'); await page.waitForTimeout(500);
  check('ta bort sprajt', await S(() => !RB.E.project.targets.some(t => t.name === 'Boll')));

  // drag a sprite on the stage
  await S(() => { const t = RB.E.vm.targets.find(t => !t.isStage); t.costumeBy('Stjärna'); });
  const sb = await page.locator('#stage').boundingBox();
  const sp = await S(() => { const t = RB.E.vm.targets.find(t => !t.isStage); return [t.x, t.y]; });
  const px = sb.x + (sp[0] + 240) / 480 * sb.width, py = sb.y + (180 - sp[1]) / 360 * sb.height;
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 60, py + 30, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(200);
  const dragged = await S(() => { const t = RB.E.vm.targets.find(t => !t.isStage); return [Math.round(t.x), Math.round(t.y)]; });
  check('dra sprajten på scenen', dragged[0] > sp[0] + 20 && dragged[1] < sp[1] - 10, JSON.stringify([sp, dragged]));

  // everything is saved: reload and come back
  await page.waitForTimeout(1200);
  await page.reload();
  await page.click('.tabs [data-view=code]');
  await page.waitForFunction(() => window.RB && RB.E && RB.E.project, null, { timeout: 20000 });
  const back = await S(() => ({ n: RB.E.project.name, cost: RB.E.project.targets[1].costumes.length, vars: Object.values(RB.E.project.variables).map(v => v.name).sort().join(','), proc: /procedures_definition/.test(RB.E.project.targets[1].blocks) }));
  check('projektet finns kvar efter omstart', back.n === 'Min första sprajt' && back.cost >= 4 && back.vars.includes('poäng') && back.proc, JSON.stringify(back));

  // export and import
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pExport')]);
  const pf = path.join(tmp, 'p.rakenprojekt.json'); await dl.saveAs(pf);
  await page.click('#pImport'); await page.setInputFiles('#blkFile', pf); await page.waitForTimeout(1200);
  check('projektfil sparas och öppnas', await S(async () => (await RB.store.get('projects')).length === 2));

  // ---- example: tic-tac-toe that learns ----
  await page.click('#pExamples'); await page.click('.ex-item:has-text("Luffarschack")');
  await page.waitForFunction(() => RB.E.project && RB.E.project.name === 'Luffarschack som lär sig', null, { timeout: 20000 });
  await page.click('#goFlag'); await page.waitForTimeout(600);
  const cellAt = async n => { const b2 = await page.locator('#stage').boundingBox(); const c = (n - 1) % 3, r = Math.floor((n - 1) / 3); const sx = c * 100 - 100, sy = 100 - r * 100; return [b2.x + (sx + 240) / 480 * b2.width, b2.y + (180 - sy) / 360 * b2.height]; };
  const [cx, cy] = await cellAt(5); await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(100); await page.mouse.up();
  await page.waitForTimeout(1500);
  const board = await S(() => [...RB.E.vm.stage.vars.values()].find(v => v.name === 'bräde').value);
  check('luffarschack: du lägger X, agenten svarar med O', /^....X....$/.test(board.replace(/O/, '.')) && (board.match(/O/g) || []).length === 1, board);
  const t0 = Date.now();
  await page.evaluate(() => RB.E.vm.keyDown('t'));
  await page.waitForFunction(() => { const r = RB.E.vm.targets.find(t => t.bubble && /Klart/.test(t.bubble.text)); return !!r; }, null, { timeout: 60000 });
  const learned = await S(() => { const m = RakenAI.agent().play; return Object.keys(Object.values(m)[0] || {}).length; });
  check('luffarschack: agenten tränar 300 omgångar', learned > 30, `${learned} lägen på ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.evaluate(() => RB.E.vm.keyUp('t'));
  await shot('e2-luffarschack');

  // ---- example: chess against the agent ----
  await page.click('#pExamples'); await page.click('.ex-item:has-text("Schack")');
  await page.waitForFunction(() => RB.E.project && RB.E.project.name === 'Schack mot agenten', null, { timeout: 20000 });
  await page.click('#goFlag'); await page.waitForTimeout(1200);
  check('schack: 32 pjäser ritas med kloner', await S(() => RB.E.vm.targets.filter(t => t.isClone).length === 32));
  const sq = async name => { const b2 = await page.locator('#stage').boundingBox(); const f = 'abcdefgh'.indexOf(name[0]), r = +name[1] - 1; const sx = f * 40 - 140, sy = r * 40 - 140; return [b2.x + (sx + 240) / 480 * b2.width, b2.y + (180 - sy) / 360 * b2.height]; };
  const tap = async name => { const [x, y] = await sq(name); await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(200); };
  await tap('d2'); await tap('d4');
  await page.waitForFunction(() => RB.E.vm.chess && RB.E.vm.chess.c.turn === 'w' && RB.E.vm.chess.c.hist.length === 2, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  const cs = await S(() => ({ clones: RB.E.vm.targets.filter(t => t.isClone).length, d4: RB.E.vm.chess.c.pieceAt('d4'), last: RB.E.vm.chess.c.moveText(RB.E.vm.chess.c.lastMove), say: (RB.E.vm.targets.find(t => t.bubble) || {}).bubble }));
  check('schack: ditt drag och agentens svar', cs.d4 === 'P' && /^[a-h][78] [a-h][56]$/.test(cs.last) && cs.clones === 32, JSON.stringify(cs));
  // an illegal move is ignored
  await tap('e2'); await tap('e5'); await page.waitForTimeout(400);
  check('schack: otillåtet drag görs inte', await S(() => RB.E.vm.chess.c.pieceAt('e2') === 'P' && RB.E.vm.chess.c.hist.length === 2));
  await shot('e3-schack');
  // the agent remembers a finished game
  await S(() => { const G = RB.E.vm.chess; G.c.loadFen('7k/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'); G.agentSide = 'b'; G.agentMoves = ['x|h8 g8']; G.done = false; });
  await tap('a1'); await tap('a8'); await page.waitForTimeout(800);
  check('schack: agenten minns ett förlorat parti', await S(() => RB.E.vm.chess.c.status().mate && RakenAI.agent().chessGames === 1 && RakenAI.agent().chess['x|h8 g8'] === -1));

  // ---- example: talk ----
  await page.click('#pExamples'); await page.click('.ex-item:has-text("Prata")');
  await page.waitForFunction(() => RB.E.project && RB.E.project.name === 'Prata med agenten', null, { timeout: 20000 });
  await page.click('#goFlag'); await page.waitForTimeout(300);
  await S(() => RB.E.vm.keyDown('l')); await page.waitForSelector('#askBox:not([hidden])');
  await page.fill('#stageAsk', 'vad gillar du'); await page.press('#stageAsk', 'Enter'); await page.waitForTimeout(300);
  await page.fill('#stageAsk', 'Block och robotar!'); await page.press('#stageAsk', 'Enter'); await page.waitForTimeout(400);
  await S(() => RB.E.vm.keyUp('l'));
  await S(() => RB.E.vm.click(RB.E.vm.targets.find(t => !t.isStage)));
  await page.waitForSelector('#askBox:not([hidden])');
  await page.fill('#stageAsk', 'Vad gillar du?'); await page.press('#stageAsk', 'Enter'); await page.waitForTimeout(500);
  const said = await S(() => (RB.E.vm.targets.find(t => t.bubble) || {}).bubble);
  check('prata: agenten lär sig och svarar i ett block-program', said && said.text === 'Block och robotar!', JSON.stringify(said));

  // ---- example: pen ----
  await page.click('#pExamples'); await page.click('.ex-item:has-text("pennan")');
  await page.waitForFunction(() => RB.E.project && RB.E.project.name === 'Rita med pennan', null, { timeout: 20000 });
  await page.click('#goFlag'); await page.waitForTimeout(2500);
  check('penna: spiralen ritas', await S(() => { const d = RB.E.vm.pg.getImageData(0, 0, 960, 720).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n > 20000; }));
  await page.click('#goFull'); await page.waitForTimeout(300);
  await shot('e4-penna-helskarm');
  await page.click('#goFull');

  // the backup includes block projects
  await page.click('.tabs [data-view=agents]');
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('#btnBackup')]);
  const bf = path.join(tmp, 'allt.json'); await bk.saveAs(bf);
  const backup = JSON.parse(fs.readFileSync(bf, 'utf8'));
  check('"Spara allt" tar med blockprojekten', backup.projects && backup.projects.length >= 5, backup.projects && backup.projects.length);

  // phone width
  await page.setViewportSize({ width: 390, height: 800 });
  await page.click('.tabs [data-view=code]'); await page.waitForTimeout(400);
  const over = await S(() => document.documentElement.scrollWidth - window.innerWidth);
  check('ingen sidledsscroll på mobil', over <= 0, over);
  await shot('e5-mobil');

  check('inga sidfel', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
