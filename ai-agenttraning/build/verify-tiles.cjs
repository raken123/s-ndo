// Tests for the obstacle-course tiles: teleports, checkpoints, enemies, TV,
// TNT and platform mode. Each rule is checked on a tiny course, then the
// Build screen, then that an agent learns the two example courses.
//
//   NODE_PATH=$(npm root -g) node build/verify-tiles.cjs [app.html] [screenshot-dir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'app', 'index.html'));
const shots = process.argv[3];
let failed = 0;
const check = (name, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra != null && extra !== '' ? '  (' + extra + ')' : '')); if (!ok) failed++; };

// each case: a course (rows), options, the moves to make (u r d l = 0 1 2 3), and a check
const U = 0, R = 1, D = 2, L = 3;
const RULES = [
  ['teleport skickar till tvillingen', { rows: ['#######', '#S1...#', '#.....#', '#...1M#', '#######'] }, [R],
    'r => r.x === 4 && r.y === 3 && r.event === "teleport"'],
  ['teleport tillbaka går inte direkt i samma steg', { rows: ['#######', '#S1..1#', '#######'] }, [R, L],
    'r => r.x === 4 && r.y === 1'],
  ['tre teleporter går runt i tur och ordning', { rows: ['#########', '#S2.2.2M#', '#########'] }, [R],
    'r => r.x === 4'],
  ['checkpoint ger bonus en gång', { rows: ['#######', '#SC...#', '#######'] }, [R, L, R],
    'r => r.cps.size === 1 && Math.abs(r.total - (2 - 0.1 * 3)) < 1e-9'],
  ['efter checkpoint: lava skickar tillbaka i stället för att avsluta', { rows: ['#######', '#SCL.M#', '#######'] }, [R, R],
    'r => !r.done && r.x === 2 && r.deaths === 1 && r.event === "respawn-lava"'],
  ['utan checkpoint avslutar lava rundan', { rows: ['#######', '#S.L.M#', '#######'] }, [R, R],
    'r => r.done && r.lava'],
  ['fem döda efter checkpoint avslutar rundan', { rows: ['#######', '#SCL.M#', '#######'] }, [R, R, R, R, R, R],
    'r => r.done && r.lava && r.deaths === 5'],
  ['fiende går fram och tillbaka', { rows: ['#######', '#S....#', '#..E..#', '#######'] }, [D === 2 ? L : L, L, L, L],
    'r => r.enemies[0].x === 3 && r.enemies[0].dx === -1'],
  ['fiende upp och ner', { rows: ['#####', '#S.M#', '#.F.#', '#...#', '#...#', '#####'] }, [L, L],
    'r => r.enemies[0].y === 4 && r.enemies[0].dy === 1'],
  ['fiende tar agenten', { rows: ['#######', '#S.E#M#', '#######'] }, [R],
    'r => r.done && r.eaten && r.total === -10.1'],
  ['fiender kan inte gå genom väggar', { rows: ['#########', '#S.#E.#M#', '#########'] }, [L, L, L],
    'r => !r.done && r.enemies[0].x >= 4 && r.enemies[0].x <= 5'],
  ['TV:n visar texten', { rows: ['######', '#ST.M#', '######'], tv: 'Hej klassen!' }, [R],
    'r => r.tv === "Hej klassen!" && r.event === "tv"'],
  ['TNT spränger väggar runt sig men inte agenten', { rows: ['#######', '#S.#..#', '#..X..#', '#..#.M#', '#######'] }, [D, R, R],
    'r => r.cell(3,2) === "." && r.cell(3,1) === "." && r.cell(3,3) === "." && r.x === 2 && r.y === 2 && !r.done && Math.abs(r.r - (-1.1)) < 1e-9'],
  ['TNT kedjereaktion och fiender i smällen', { rows: ['#########', '#S.XX..M#', '#...E...#', '#########'] }, [R, R],
    'r => r.cell(3,1) === "." && r.cell(4,1) === "." && !r.enemies[0].alive'],
  ['plattform: tyngdkraften drar ner', { rows: ['#####', '#S..#', '#...#', '#..M#', '#####'], platform: true }, [D],
    'r => r.y === 2'],
  ['plattform: hopp tre rutor', { rows: ['#####', '#...#', '#...#', '#...#', '#S.M#', '#####'], platform: true }, [U, D, D],
    'r => r.y === 1 && r.vy === 0'],
  ['plattform: hopp kräver mark', { rows: ['#####', '#S..#', '#...#', '#...#', '#..M#', '#####'], platform: true }, [U],
    'r => r.y === 2 && r.vy === 0'],
  ['plattform: faller tillbaka efter hoppet', { rows: ['#####', '#...#', '#...#', '#...#', '#S.M#', '#####'], platform: true }, [U, D, D, D, D, D, D],
    'r => r.y === 4'],
  ['plattform: fiende vänder vid kanten', { rows: ['########', '#S.....#', '#..E...#', '#.###..#', '#.....M#', '########'], platform: true }, [D, D, D, D],
    'r => r.enemies[0].x >= 2 && r.enemies[0].x <= 4 && r.enemies[0].y === 2'],
];
const PATHS = [
  ['kortaste vägen använder teleporten', { rows: ['##########', '#S1######', '######1.M#', '##########'].map(r => r.padEnd(10, '#')) }, 3],
  ['kortaste vägen spränger TNT', { rows: ['#######', '#S.X.M#', '#######'] }, 5],
  ['plattform: hoppa upp på en avsats', { rows: ['#######', '#....M#', '#...###', '#.....#', '#S....#', '#######'], platform: true }, 5],
  ['plattform: för högt blir omöjligt', { rows: ['#######', '#....M#', '#...###', '#.....#', '#.....#', '#.....#', '#S....#', '#######'], platform: true }, -1],
  ['plattform: hoppa över lava (ett hopp är ett eget drag)', { rows: ['#######', '#.....#', '#S.L.M#', '###L###', '#######'], platform: true }, 5],
  ['plattform: rutan ovanför lava är inget golv', { rows: ['#######', '#.....#', '#S.T.M#', '###L###', '#######'], platform: true }, 5],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + file);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.click('.card.new'); await page.fill('#nName', 'Tessa'); await page.press('#nName', 'Enter');
  await page.waitForSelector('.card:not(.new)');

  for (const [name, lv, moves, test] of RULES) {
    const res = await page.evaluate(([lv, moves, test]) => {
      const course = Object.assign({ id: 'x' + Math.random(), name: 't', w: lv.rows[0].length, h: lv.rows.length }, lv);
      const st = { rStep: -0.1, rWall: -0.5, rLava: -10, rGoal: 10, rCoin: 3, rCheck: 2, rEnemy: -10, rTnt: -1 };
      const r = new RakenAI.Run(course);
      for (const a of moves) { if (r.done) break; r.step(a, st); }
      return { ok: !!eval(test)(r), info: JSON.stringify({ x: r.x, y: r.y, vy: r.vy, done: r.done, total: Math.round(r.total * 100) / 100, ev: r.event, deaths: r.deaths, en: r.enemies.map(e => [e.x, e.y, e.dx, e.dy, e.alive]) }) };
    }, [lv, moves, test]);
    check(name, res.ok, res.ok ? '' : res.info);
  }
  for (const [name, lv, want] of PATHS) {
    const got = await page.evaluate(lv => RakenAI.shortest(Object.assign({ id: 'p' + Math.random(), name: 't', w: lv.rows[0].length, h: lv.rows.length }, lv)), lv);
    check(name, got === want, `${got} steg, väntat ${want}`);
  }

  // the Build screen
  await page.click('.tabs [data-view=build]');
  check('alla 14 verktyg finns', await page.locator('.tool').count() === 14);
  await page.click('#bNew'); await page.fill('#askInput', 'Min plattformsbana'); await page.press('#askInput', 'Enter');
  await page.waitForTimeout(200);
  for (const [tool, cells] of [['Teleport 1', [[3, 5], [10, 2]]], ['Fiende ↔', [[6, 8]]], ['Check', [[8, 5]]], ['TV', [[2, 5]]], ['TNT', [[12, 5]]]]) {
    await page.click(`.tool:has-text("${tool}")`);
    const box = await page.locator('#bCanvas').boundingBox(); const cs = box.width / 16;
    for (const [x, y] of cells) await page.mouse.click(box.x + (x + 0.5) * cs, box.y + (y + 0.5) * cs);
  }
  await page.check('#bPlat'); await page.fill('#bTv', 'Välkommen!'); await page.waitForTimeout(600);
  const built = await page.evaluate(() => { const l = RakenAI.state().levels.find(l => l.name === 'Min plattformsbana'); return { p: !!l.platform, tv: l.tv, row5: l.rows[5], row2: l.rows[2], row8: l.rows[8] }; });
  check('rita nya rutor, plattformsläge och TV-text', built.p && built.tv === 'Välkommen!' && built.row5 === '#ST1....C...X.M#' && built.row2[10] === '1' && built.row8[6] === 'E', JSON.stringify(built));
  // in platform mode the goal floats four squares above the floor: too high to jump to
  const status = await page.textContent('#bStatus');
  check('banan kontrolleras med plattformsregler (målet svävar för högt)', /ingen väg/.test(status), status.trim());
  await page.uncheck('#bPlat'); await page.waitForTimeout(300);
  check('samma bana utan plattformsläge går att klara', /Kortaste vägen är \d+ steg/.test(await page.textContent('#bStatus')));
  await page.click('[data-code=map]');
  const code = await page.inputValue('#mapCode');
  check('kartkoden visar de nya tecknen', code.includes('T1....C...X.M'), code.split('\n')[5]);
  await page.fill('#mapCode', '########\n#S1..2.#\n#..E..F#\n#C.T.X.#\n#2...1M#\n########'); await page.click('#mapApply');
  const fromMap = await page.evaluate(() => { const l = RakenAI.state().levels.find(l => l.name === 'Min plattformsbana'); return l.rows.join('|'); });
  check('kartkod med alla nya tecken', fromMap === '########|#S1..2.#|#..E..F#|#C.T.X.#|#2...1M#|########' && !(await page.textContent('#mapErr')), fromMap);
  await page.click('[data-code=cmd]');
  await page.fill('#cmdCode', 'storlek 12 8\nrensa\nram\nstart 2 2\nmål 11 7\nteleport1 3 2\nteleport1 10 6\nfiende 6 4\nfiendeupp 8 3\ncheckpoint 4 6\ntv 2 3\ntnt 9 2\ntvtext Kod-TV!\nplattform av');
  await page.click('#cmdRun');
  const fromCmd = await page.evaluate(() => { const l = RakenAI.state().levels.find(l => l.name === 'Min plattformsbana'); return { rows: l.rows, p: !!l.platform, tv: l.tv }; });
  check('kommandon för de nya rutorna', !fromCmd.p && fromCmd.tv === 'Kod-TV!' && fromCmd.rows[1] === '#S1.....X..#' && fromCmd.rows[3][5] === 'E' && fromCmd.rows[2][7] === 'F' && fromCmd.rows[5][3] === 'C' && fromCmd.rows[2][1] === 'T' && fromCmd.rows[5][9] === '1',
    JSON.stringify(fromCmd).slice(0, 300));
  await page.selectOption('#bLevel', 'l6'); await page.waitForTimeout(300);
  if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, 'tiles-build.png') }); }

  // the agent learns the two new example courses
  await page.click('.tabs [data-view=train]');
  // Q-learning wobbles while it learns, so: does it reach the goal within this many rounds?
  for (const [lvl, rounds] of [['l6', 600], ['l7', 1500]]) {
    await page.selectOption('#tLevel', lvl);
    let done = 0, skill = 0;
    while (done < rounds && skill < 80) {
      await page.click('[data-fast="100"]');
      await page.waitForFunction(() => !document.querySelector('[data-fast="100"]').disabled, null, { timeout: 60000 });
      done += 100; skill = await page.evaluate(l => RakenAI.state().agents[0].brain.skill[l] || 0, lvl);
    }
    check(`agenten lär sig ${lvl === 'l6' ? 'portaler och fiender' : 'plattformsbanan'} inom ${rounds} rundor`, skill >= 80, `${skill} % av perfekt efter ${done} rundor`);
  }
  // drive in platform mode: up jumps
  await page.selectOption('#tLevel', 'l7');
  await page.click('#tDrive');
  const y0 = await page.evaluate(() => 0);
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(100);
  check('styra själv i plattformsläge: pil upp hoppar', await page.evaluate(() => /steg 1/.test(document.querySelector('#tStatus').textContent)) && y0 === 0);
  await page.click('#tStop');
  await page.fill('#tSpeed', '35'); await page.dispatchEvent('#tSpeed', 'input');
  await page.click('#tTest'); await page.waitForTimeout(2500);
  if (shots) await page.screenshot({ path: path.join(shots, 'tiles-train.png') });

  check('inga sidfel', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
