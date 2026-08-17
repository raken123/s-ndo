/* game.js — the hall, the queue, the trial, and the shot.

   Phases:
     menu → queue → trial → deliberation → verdict → shot → aftermath
   with a side road at `morph`, where a VIP spends one of the day's ten drum
   morphs, becomes the drum robot, and hands down the verdict personally. */
(function (global) {
  'use strict';

  const S = global.AJScene;
  const A = global.AJAudio;

  const QUEUE_BOTS = 9;
  const SPARKS = 64;
  const TRIAL_SECONDS = 45;

  /* Six stances a VR player can pick without a keyboard. */
  const STANCES = [
    'I was here first, and I can prove it.',
    'We agreed on this in front of witnesses, and I expect that to hold.',
    'I have done the work every day for years. That has to count for something.',
    'I offered to split it fairly. That offer was refused.',
    'Their claim rests on a technicality. Mine rests on what actually happened.',
    'I asked twice, politely, and received nothing at all.'
  ];

  /* ---------------- panel painting ---------------- */

  const PARCH = '#f3e7cd', INK = '#2a1d12', BRASS = '#b8892a', FELT = '#7c2b2b';

  function frame(ctx, w, h, bg) {
    ctx.fillStyle = bg || PARCH;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = BRASS; ctx.lineWidth = Math.max(4, w * 0.014);
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    ctx.strokeStyle = 'rgba(42,29,18,.28)'; ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.035, h * 0.05, w * 0.93, h * 0.9);
  }

  function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
    const words = String(text || '').split(/\s+/);
    let line = '', n = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y + n * lineH);
        n++; line = words[i];
        if (maxLines && n >= maxLines - 1) {
          let rest = words.slice(i).join(' ');
          while (ctx.measureText(rest + '…').width > maxW && rest.length > 1) {
            rest = rest.slice(0, -1);
          }
          ctx.fillText(rest + (i < words.length - 1 ? '…' : ''), x, y + n * lineH);
          return n + 1;
        }
      } else line = test;
    }
    if (line) { ctx.fillText(line, x, y + n * lineH); n++; }
    return n;
  }

  /* ---------------- world ---------------- */

  function buildWorld(renderer) {
    const gl = renderer.gl;
    const root = new S.Node(null);

    const hall = renderer.upload(S.buildHall());
    root.add(new S.Node(hall));

    const robotMeshes = S.buildRobot().meshes;
    const gpu = {};
    for (const k in robotMeshes) gpu[k] = renderer.upload(robotMeshes[k]);
    const robot = S.assembleRobot(gpu);
    robot.root.pos = S.LAYOUT.robot.slice();
    robot.root.scl = [1.16, 1.16, 1.16];
    root.add(robot.root);

    const avatarMesh = renderer.upload(S.buildAvatar());
    const shadowMesh = renderer.upload(S.buildShadow());
    const sparkMesh = renderer.upload(S.buildSpark());

    function makeFigure(tint) {
      const g = new S.Node(null);
      const body = g.add(new S.Node(avatarMesh));
      body.tint = tint;
      const sh = g.add(new S.Node(shadowMesh));
      sh.pos = [0, 0.02, 0];
      sh.alpha = 0.4;
      sh.emissive = 1;
      const tag = g.add(new S.Node(null));
      tag.pos = [0, 2.12, 0];
      tag.scl = [1.15, 0.30, 1];
      tag.panel = renderer.makePanel(256, 64, (c, w, h) => {
        c.clearRect(0, 0, w, h);
        c.fillStyle = 'rgba(28,18,10,.72)';
        c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 14); c.fill();
        c.strokeStyle = BRASS; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#f3e7cd'; c.font = '600 30px system-ui, sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('—', w / 2, h / 2);
      });
      g.visible = false;
      root.add(g);
      return { group: g, body, shadow: sh, tag, knock: 0 };
    }

    const self = makeFigure([1.0, 0.92, 0.86]);
    const foe = makeFigure([0.72, 0.82, 1.0]);
    const bots = [];
    for (let k = 0; k < QUEUE_BOTS; k++) {
      const tone = 0.7 + ((k * 37) % 9) * 0.045;
      bots.push(makeFigure([tone, 0.78 + ((k * 17) % 5) * 0.05, 1.06 - tone * 0.25]));
    }

    /* the case board hung above the bench */
    const caseCard = new S.Node(null);
    caseCard.pos = [0, 4.15, -5.9];
    caseCard.scl = [6.4, 2.4, 1];
    caseCard.panel = renderer.makePanel(1024, 384, (c, w, h) => {
      frame(c, w, h);
      c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'top';
      c.font = '700 54px Georgia, serif';
      c.fillText('AI JUDGE', w / 2, 46);
      c.font = 'italic 30px Georgia, serif';
      c.fillStyle = '#6a533a';
      c.fillText('the bench is not yet sitting', w / 2, 130);
    });
    root.add(caseCard);

    /* the verdict board, lowered in front of the bench when a ruling lands */
    const verdictBoard = new S.Node(null);
    verdictBoard.pos = [0, 1.02, -2.92];
    verdictBoard.scl = [5.6, 1.55, 1];
    verdictBoard.visible = false;
    verdictBoard.panel = renderer.makePanel(1024, 284, (c, w, h) => frame(c, w, h));
    root.add(verdictBoard);

    /* queue sign beside the runner */
    const queueSign = new S.Node(null);
    queueSign.pos = [2.55, 1.9, 0.6];
    queueSign.rot = [0, -0.5, 0];
    queueSign.scl = [1.9, 1.15, 1];
    queueSign.visible = false;
    queueSign.panel = renderer.makePanel(384, 232, (c, w, h) => frame(c, w, h));
    root.add(queueSign);

    /* VR-only argument cards, arranged in an arc in front of the player */
    const stanceCards = [];
    for (let k = 0; k < STANCES.length; k++) {
      const n = new S.Node(null);
      n.scl = [1.5, 0.62, 1];
      n.visible = false;
      const text = STANCES[k];
      n.panel = renderer.makePanel(512, 212, (c, w, h) => {
        frame(c, w, h);
        c.fillStyle = INK; c.font = '30px Georgia, serif';
        c.textAlign = 'left'; c.textBaseline = 'top';
        wrap(c, text, 34, 44, w - 68, 40, 4);
      });
      n.userText = text;
      n.kind = 'stance';
      root.add(n);
      stanceCards.push(n);
    }

    /* morph choice cards — used when the player is the drum */
    const morphCards = [];
    for (let k = 0; k < 2; k++) {
      const n = new S.Node(null);
      n.scl = [3.0, 1.9, 1];
      n.visible = false;
      n.panel = renderer.makePanel(640, 400, (c, w, h) => frame(c, w, h));
      n.kind = 'morph';
      n.side = k === 0 ? 'A' : 'B';
      root.add(n);
      morphCards.push(n);
    }

    /* muzzle flashes */
    const flashMesh = renderer.upload((() => {
      const b = new global.AJMesh.Builder();
      b.sc(0.5, 0.5, 0.5); b.sphere([1, 0.92, 0.7], 12); b.pop();
      return b.build();
    })());
    const flashes = [];
    for (let k = 0; k < 2; k++) {
      const f = new S.Node(flashMesh);
      f.emissive = 1; f.visible = false; f.alpha = 1;
      root.add(f);
      flashes.push(f);
    }

    /* spark pool for the shot */
    const sparks = [];
    for (let k = 0; k < SPARKS; k++) {
      const n = new S.Node(sparkMesh);
      n.emissive = 1; n.visible = false;
      n.v = [0, 0, 0]; n.life = 0; n.spin = 0;
      root.add(n);
      sparks.push(n);
    }

    /* XR controller beams */
    const beamMesh = renderer.upload((() => {
      const b = new global.AJMesh.Builder();
      b.at(0, 0, -1.2).sc(0.012, 0.012, 2.4); b.box([1, 0.85, 0.5]); b.pop().pop();
      b.sc(0.045, 0.045, 0.045); b.sphere([0.95, 0.8, 0.45], 10); b.pop();
      return b.build();
    })());
    const beams = [];
    for (let k = 0; k < 2; k++) {
      const n = new S.Node(beamMesh);
      n.emissive = 0.7; n.visible = false;
      root.add(n);
      beams.push(n);
    }

    void gl;
    return {
      root, robot, self, foe, bots, sparks, flashes, beams,
      caseCard, verdictBoard, queueSign, stanceCards, morphCards,
      pickables: stanceCards.concat(morphCards)
    };
  }

  /* ---------------- game ---------------- */

  function Game(canvas, ui) {
    this.renderer = new global.AJRender.Renderer(canvas);
    this.ui = ui;
    this.world = buildWorld(this.renderer);
    this.xr = new global.AJXR.XRManager(this.renderer, this.world);
    this.xr.onSelect = (node) => this.onPick(node);
    this.xr.onFrame = (dt) => this.update(dt);
    this.xr.onEnd = () => this.ui.setVR(false);

    this.t = 0;
    this.phase = 'menu';
    this.phaseT = 0;
    this.net = null;
    this.match = null;
    this.verdict = null;
    this.submitted = false;
    this.morphing = false;
    this.morphPending = null;
    this.timeLeft = 0;
    this.queuePos = -1;
    this.stopRoll = null;
    this.shake = 0;
    this.camEye = [0, 3.0, 9.0];
    this.camTarget = [0, 1.8, -4.0];
    this.orbit = 0;

    this.account = global.AJAccount.get();

    /* aim angles from the bench to each podium, computed once */
    const rp = S.LAYOUT.robot;
    const ang = (p) => Math.atan2(p[0] - rp[0], p[2] - rp[2]);
    this.aimSelf = ang(S.LAYOUT.standSelf);
    this.aimFoe = ang(S.LAYOUT.standFoe);

    this.xr.check().then(ok => this.ui.setVRAvailable(ok));

    const loop = (ms) => {
      this._raf = requestAnimationFrame(loop);
      if (this.xr.session) return;          // XR drives its own loop
      const dt = this._last ? Math.min(0.05, (ms - this._last) / 1000) : 0.016;
      this._last = ms;
      this.update(dt);
      this.renderer.render(this.world.root);
    };
    this._raf = requestAnimationFrame(loop);
  }

  Game.prototype.setPhase = function (p) {
    this.phase = p;
    this.phaseT = 0;
    this.ui.setPhase(p, this);
  };

  /* ---------------- networking ---------------- */

  Game.prototype.connect = function () {
    if (this.net) this.net.close();
    const acct = global.AJAccount.get();
    const profile = {
      name: acct.name, id: acct.id, vip: acct.vip, rank: global.AJAccount.rank(),
      server: acct.server
    };
    this.net = acct.server
      ? new global.AJNet.OnlineNet(acct.server, profile)
      : new global.AJNet.LocalNet(profile);
    this.wireNet();
    this.net.connect();
    return this.net;
  };

  Game.prototype.wireNet = function () {
    const net = this.net;
    net.on('status', s => this.ui.setStatus(Object.assign({ online: net.online }, s)));
    net.on('online', n => this.ui.setStatus({ connected: net.connected, mode: net.mode, online: n }));
    net.on('error', msg => this.ui.toast(msg));
    net.on('retry', r => this.ui.toast('Reconnecting in ' + Math.round(r.in / 1000) + 's…'));

    net.on('queue', m => this.onQueue(m));
    net.on('match', m => this.onMatch(m));
    net.on('opponentSubmitted', () => this.ui.toast('Your opponent has finished speaking.'));
    net.on('submitted', () => { /* echo of our own submission */ });
    net.on('verdict', m => this.onVerdict(m));
    net.on('awaitMorphVerdict', m => this.onAwaitMorph(m));
    net.on('opponentLeft', () => {
      this.ui.toast('Your opponent left the hall. The case is dismissed.');
      this.finishCase(null);
    });
  };

  Game.prototype.play = function () {
    A.unlock();
    if (!this.net) this.connect();
    this.queuePos = -1;
    this.world.queueSign.visible = true;
    this.world.verdictBoard.visible = false;
    this.setPhase('queue');
    this.net.joinQueue();
    this.paintCase(null);
  };

  Game.prototype.leave = function () {
    if (this.net) this.net.leaveQueue();
    this.match = null;
    this.hideFigures();
    this.world.queueSign.visible = false;
    this.world.verdictBoard.visible = false;
    this.setPhase('menu');
  };

  Game.prototype.onQueue = function (m) {
    this.queuePos = m.pos;
    this.queueLine = m.line || [];
    this.ui.setQueue({ pos: m.pos, total: m.total, online: this.net.online, mode: this.net.mode });
    if (this.phase !== 'queue') this.setPhase('queue');
    this.paintQueueSign();
    A.hat();
  };

  Game.prototype.onMatch = function (m) {
    this.match = m;
    this.submitted = false;
    this.verdict = null;
    this.timeLeft = m.seconds || TRIAL_SECONDS;
    this.world.queueSign.visible = false;
    this.world.verdictBoard.visible = false;
    this.world.self.knock = 0;
    this.world.foe.knock = 0;
    this.paintCase(m);
    this.setPhase('trial');
    this.ui.setCase(m, this);
    A.fanfare();
  };

  Game.prototype.submit = function (text) {
    if (!this.match || this.submitted) return;
    const t = (text || '').trim().slice(0, 600);
    this.submitted = true;
    this.myText = t;
    this.net.submit(t);
    this.ui.setSubmitted(true);
    A.kick();
    if (this.phase === 'trial') this.setPhase('deliberation');
    this.stopRoll = A.roll(20);
  };

  Game.prototype.onVerdict = function (m) {
    if (this.stopRoll) { this.stopRoll(); this.stopRoll = null; }
    this.verdict = m;
    const side = (this.match && this.match.side) || 'A';
    this.iWon = m.verdict.winner === side;
    this.paintVerdict(m);
    this.setPhase('verdict');
    this.ui.setVerdict(m, this.iWon, this);
    A.gavel();
  };

  /* ---------------- drum morph ---------------- */

  Game.prototype.morph = function () {
    if (this.morphing) return false;
    if (!global.AJAccount.get().vip) { this.ui.toast('Drum morphs are a VIP privilege.'); return false; }
    if (!global.AJAccount.useMorph()) { this.ui.toast('No drum morphs left today. They reset at midnight.'); return false; }
    this.morphing = true;
    this.net.morph();
    this.ui.setMorphs(global.AJAccount.morphsLeft());
    this.ui.toast('You are the drum. You will hand down this verdict yourself.');
    A.crash();
    return true;
  };

  Game.prototype.onAwaitMorph = function (m) {
    this.morphPending = m;
    this.paintMorphCards(m);
    this.setPhase('morph');
    this.ui.setMorphChoice(m, this);
  };

  Game.prototype.chooseWinner = function (side, ruling) {
    if (!this.morphPending) return;
    const m = this.morphPending;
    this.morphPending = null;
    this.morphing = false;
    for (const c of this.world.morphCards) c.visible = false;
    this.net.morphVerdict(side, ruling ||
      'The drum has heard both of you, and the drum finds for ' +
      (side === 'A' ? m.nameA : m.nameB) + '.');
    A.gavel();
  };

  /* ---------------- the shot ---------------- */

  Game.prototype.beginShot = function () {
    if (!this.verdict) { this.finishCase(null); return; }
    this.setPhase('shot');
    this.shotFired = false;
    A.crash();
  };

  Game.prototype.fireAt = function (loserIsSelf) {
    const w = this.world;
    /* the arm on the loser's side is the one that fires */
    const muzzle = loserIsSelf ? w.robot.parts.muzzleL : w.robot.parts.muzzleR;
    const mw = muzzle.world;
    const from = [mw[12], mw[13], mw[14]];
    const target = loserIsSelf ? S.LAYOUT.standSelf : S.LAYOUT.standFoe;
    const dir = [target[0] - from[0], (target[1] + 1.2) - from[1], target[2] - from[2]];
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    dir[0] /= len; dir[1] /= len; dir[2] /= len;

    const flash = w.flashes[loserIsSelf ? 0 : 1];
    flash.visible = true;
    flash.pos = from.slice();
    flash.scl = [0.9, 0.9, 0.9];
    flash.alpha = 1;
    flash.life = 0.24;

    this.emitSparks(from, dir, 34);
    this.renderer.flash = 0.34;
    this.shake = loserIsSelf ? 1.0 : 0.35;
    A.shot();

    const loser = loserIsSelf ? w.self : w.foe;
    loser.knockTarget = 1;
    setTimeout(() => this.emitSparks(
      [target[0], target[1] + 1.3, target[2]], [0, 1, 0.2], 26, true), 90);
  };

  Game.prototype.emitSparks = function (origin, dir, count, burst) {
    const pool = this.world.sparks;
    let placed = 0;
    for (let k = 0; k < pool.length && placed < count; k++) {
      const s = pool[k];
      if (s.visible) continue;
      s.visible = true;
      s.life = 0.5 + Math.random() * 0.7;
      s.maxLife = s.life;
      s.pos = [origin[0], origin[1], origin[2]];
      const spread = burst ? 1.5 : 0.55;
      const speed = burst ? 2.4 + Math.random() * 3.0 : 5.5 + Math.random() * 6.0;
      s.v = [
        (dir[0] + (Math.random() - 0.5) * spread) * speed,
        (dir[1] + (Math.random() - 0.5) * spread) * speed + (burst ? 2.4 : 0.8),
        (dir[2] + (Math.random() - 0.5) * spread) * speed
      ];
      s.spin = (Math.random() - 0.5) * 22;
      s.rot = [Math.random() * 6, Math.random() * 6, Math.random() * 6];
      const warm = Math.random();
      s.tint = warm < 0.45 ? [1.0, 0.82, 0.35]
             : warm < 0.8 ? [0.95, 0.55, 0.25]
             : [0.85, 0.24, 0.22];
      s.scl = [1, 1, 1];
      placed++;
    }
  };

  Game.prototype.finishCase = function (iWon) {
    if (iWon !== null && iWon !== undefined) global.AJAccount.recordResult(iWon);
    this.match = null;
    this.submitted = false;
    this.morphing = false;
    this.setPhase('aftermath');
    this.ui.setAftermath(this.verdict, iWon, this);
    if (iWon !== null) A.chime(iWon);
  };

  Game.prototype.again = function () {
    this.world.verdictBoard.visible = false;
    this.world.self.knock = 0; this.world.self.knockTarget = 0;
    this.world.foe.knock = 0; this.world.foe.knockTarget = 0;
    this.play();
  };

  /* ---------------- panel content ---------------- */

  Game.prototype.paintCase = function (m) {
    const scene = m && m.scene;
    const side = m && m.side;
    this.world.caseCard.panel.update((c, w, h) => {
      frame(c, w, h);
      c.textAlign = 'center'; c.textBaseline = 'top';
      if (!scene) {
        c.fillStyle = INK; c.font = '700 60px Georgia, serif';
        c.fillText('AI JUDGE', w / 2, 60);
        c.fillStyle = '#6a533a'; c.font = 'italic 30px Georgia, serif';
        c.fillText('join the line and wait to be called', w / 2, 150);
        c.font = '26px Georgia, serif';
        c.fillText('the bench does not hurry', w / 2, 210);
        return;
      }
      c.fillStyle = FELT; c.font = '600 26px Georgia, serif';
      c.fillText('THE CASE BEFORE THE BENCH', w / 2, 34);
      c.fillStyle = INK; c.font = '700 48px Georgia, serif';
      c.fillText(scene.t.toUpperCase(), w / 2, 80);
      c.fillStyle = '#4a382a'; c.font = '28px Georgia, serif';
      c.textAlign = 'left';
      const used = wrap(c, scene.s, 60, 150, w - 120, 38, 2);
      c.fillStyle = FELT; c.font = '600 26px Georgia, serif';
      c.fillText('YOUR POSITION', 60, 160 + used * 38);
      c.fillStyle = INK; c.font = 'italic 28px Georgia, serif';
      wrap(c, side === 'A' ? scene.a : scene.b, 60, 196 + used * 38, w - 120, 36, 2);
    });
  };

  Game.prototype.paintQueueSign = function () {
    const pos = this.queuePos;
    const online = this.net ? this.net.online : 0;
    const offline = this.net && this.net.mode === 'offline';
    this.world.queueSign.panel.update((c, w, h) => {
      frame(c, w, h);
      c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillStyle = FELT; c.font = '600 22px Georgia, serif';
      c.fillText('NOW WAITING', w / 2, 26);
      c.fillStyle = INK; c.font = '700 78px Georgia, serif';
      c.fillText(pos <= 0 ? 'NEXT' : '#' + (pos + 1), w / 2, 58);
      c.fillStyle = '#5c4630'; c.font = '20px Georgia, serif';
      c.fillText(pos <= 0 ? 'step up to the drum' : 'ahead of you: ' + pos, w / 2, 150);
      c.fillText(offline ? 'practice hall' : online + ' in the hall', w / 2, 178);
    });
  };

  Game.prototype.paintVerdict = function (m) {
    const v = m.verdict;
    const side = (this.match && this.match.side) || 'A';
    const won = v.winner === side;
    const wName = v.winner === 'A' ? m.nameA : m.nameB;
    this.world.verdictBoard.visible = true;
    this.world.verdictBoard.panel.update((c, w, h) => {
      frame(c, w, h, won ? '#f0ecd6' : '#f2ddd6');
      c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillStyle = FELT; c.font = '600 24px Georgia, serif';
      c.fillText('THE VERDICT', w / 2, 26);
      c.fillStyle = INK; c.font = '700 54px Georgia, serif';
      c.fillText('FOR ' + wName.toUpperCase(), w / 2, 60);
      c.font = 'italic 27px Georgia, serif'; c.fillStyle = '#3d2c1c';
      c.textAlign = 'left';
      const n = wrap(c, '“' + v.ruling + '”', 56, 134, w - 112, 36, 3);
      c.textAlign = 'center';
      c.font = '600 26px Georgia, serif'; c.fillStyle = '#6a533a';
      c.fillText(m.nameA + '  ' + v.scoreA + '   ·   ' + m.nameB + '  ' + v.scoreB,
        w / 2, 150 + n * 36);
      c.font = '19px Georgia, serif'; c.fillStyle = '#8a7358';
      c.fillText('judged by ' + v.model, w / 2, 186 + n * 36);
    });
  };

  Game.prototype.paintMorphCards = function (m) {
    const cards = this.world.morphCards;
    const data = [
      { name: m.nameA, arg: m.argA, pos: m.scene.a, side: 'A' },
      { name: m.nameB, arg: m.argB, pos: m.scene.b, side: 'B' }
    ];
    for (let k = 0; k < 2; k++) {
      const d = data[k];
      const card = cards[k];
      card.visible = true;
      card.pos = [k === 0 ? -2.3 : 2.3, 2.1, -2.2];
      card.rot = [0, k === 0 ? 0.34 : -0.34, 0];
      card.panel.update((c, w, h) => {
        frame(c, w, h);
        c.textAlign = 'center'; c.textBaseline = 'top';
        c.fillStyle = FELT; c.font = '600 22px Georgia, serif';
        c.fillText('SIDE ' + d.side, w / 2, 22);
        c.fillStyle = INK; c.font = '700 40px Georgia, serif';
        c.fillText(d.name, w / 2, 50);
        c.textAlign = 'left';
        c.fillStyle = '#6a533a'; c.font = 'italic 21px Georgia, serif';
        const n = wrap(c, d.pos, 34, 108, w - 68, 28, 2);
        c.fillStyle = INK; c.font = '24px Georgia, serif';
        wrap(c, '“' + (d.arg || '(said nothing)') + '”', 34, 122 + n * 28, w - 68, 32, 5);
        c.textAlign = 'center';
        c.fillStyle = BRASS; c.font = '600 22px Georgia, serif';
        c.fillText('▸ point and press to rule for ' + d.name, w / 2, h - 44);
      });
    }
  };

  Game.prototype.showStanceCards = function (show) {
    const cards = this.world.stanceCards;
    for (let k = 0; k < cards.length; k++) {
      const n = cards[k];
      n.visible = !!show;
      if (!show) continue;
      const col = k % 2, row = Math.floor(k / 2);
      const base = S.LAYOUT.standSelf;
      n.pos = [base[0] + (col === 0 ? -0.85 : 0.85), 1.72 - row * 0.7, base[2] - 1.25];
      n.rot = [0, col === 0 ? 0.26 : -0.26, 0];
    }
  };

  Game.prototype.onPick = function (node) {
    if (!node) return;
    if (node.kind === 'stance') {
      this.showStanceCards(false);
      this.submit(node.userText);
    } else if (node.kind === 'morph') {
      this.chooseWinner(node.side);
    }
  };

  /* ---------------- per-frame ---------------- */

  Game.prototype.hideFigures = function () {
    this.world.self.group.visible = false;
    this.world.foe.group.visible = false;
    for (const b of this.world.bots) b.group.visible = false;
  };

  function setTag(fig, text, sub) {
    fig.tag.panel.update((c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = 'rgba(28,18,10,.75)';
      c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 14); c.fill();
      c.strokeStyle = BRASS; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#f3e7cd';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '600 27px system-ui, sans-serif';
      c.fillText(String(text).slice(0, 18), w / 2, sub ? h / 2 - 9 : h / 2);
      if (sub) {
        c.font = '18px system-ui, sans-serif';
        c.fillStyle = '#d9b871';
        c.fillText(sub, w / 2, h / 2 + 16);
      }
    });
  }

  Game.prototype.placeFigures = function () {
    const w = this.world;
    const L = S.LAYOUT;

    if (this.phase === 'queue') {
      const acct = global.AJAccount.get();
      const pos = Math.max(0, this.queuePos);
      w.self.group.visible = true;
      const slot = L.queueSlot(pos);
      w.self.group.pos = [slot[0], 0, slot[2]];
      w.self.group.rot = [0, Math.PI, 0];
      if (w.self.tagText !== acct.name) {
        setTag(w.self, acct.name, acct.vip ? 'VIP' : global.AJAccount.rank());
        w.self.tagText = acct.name;
      }
      const line = this.queueLine || [];
      for (let k = 0; k < w.bots.length; k++) {
        const b = w.bots[k];
        const p = line[k];
        b.group.visible = !!p;
        if (!p) continue;
        const s = L.queueSlot(k);
        b.group.pos = [s[0], 0, s[2]];
        b.group.rot = [0, Math.PI + Math.sin(this.t * 0.7 + k) * 0.14, 0];
        if (b.tagText !== p.name) { setTag(b, p.name, p.vip ? 'VIP' : ''); b.tagText = p.name; }
      }
      w.foe.group.visible = false;
      return;
    }

    if (this.phase === 'menu') { this.hideFigures(); return; }

    /* trial and everything after: both litigants at their podiums */
    for (const b of w.bots) b.group.visible = false;
    const acct = global.AJAccount.get();
    const foeName = (this.match && this.match.opponent && this.match.opponent.name) ||
      (this.verdict ? (this.match && this.match.side === 'A' ? this.verdict.nameB : this.verdict.nameA) : 'Opponent');

    /* During the trial the camera sits in your own eyes, so your figure is
       hidden; it reappears for the wide shot when the guns come up. */
    const firstPerson = this.phase === 'trial' || this.phase === 'deliberation';
    w.self.group.visible = !this.morphing && !firstPerson;
    w.self.group.pos = L.standSelf.slice();
    w.self.group.rot = [0, Math.PI, 0];
    w.foe.group.visible = true;
    w.foe.group.pos = L.standFoe.slice();
    w.foe.group.rot = [0, Math.PI, 0];
    if (w.self.tagText !== acct.name) { setTag(w.self, acct.name, acct.vip ? 'VIP' : global.AJAccount.rank()); w.self.tagText = acct.name; }
    if (w.foe.tagText !== foeName) { setTag(w.foe, foeName, this.match && this.match.opponent && this.match.opponent.vip ? 'VIP' : ''); w.foe.tagText = foeName; }
  };

  Game.prototype.update = function (dt) {
    this.t += dt;
    this.phaseT += dt;
    const w = this.world, p = w.robot.parts;

    this.placeFigures();

    /* ---- robot idle: a slow breath through the shell, eyes on the room ---- */
    const breath = 1 + Math.sin(this.t * 1.35) * 0.012;
    p.torso.scl = [breath, breath, 1];
    p.hips.pos[1] = 1.42 + Math.sin(this.t * 1.35) * 0.022;
    const eyePulse = 0.75 + Math.sin(this.t * 2.4) * 0.25;
    p.eyeL.tint = p.eyeR.tint = [1, 0.72 + eyePulse * 0.2, 0.30 + eyePulse * 0.24];
    p.cymL.rot[2] = 0.3 + Math.sin(this.t * 1.9) * 0.05;
    p.cymR.rot[2] = -0.3 - Math.sin(this.t * 1.9 + 1) * 0.05;

    /* where the robot looks, and what its arms are doing */
    let headYaw = 0, headPitch = 0;
    let armLx = 0.15, armLz = 0.22, armRx = 0.15, armRz = -0.22;
    let foreX = -0.5;

    if (this.phase === 'queue') {
      headYaw = Math.sin(this.t * 0.5) * 0.32;
      headPitch = 0.06;
    } else if (this.phase === 'trial') {
      headYaw = Math.sin(this.t * 0.9) * 0.22;
      headPitch = 0.1;
      /* an impatient finger-tap on the drum head */
      foreX = -0.5 + Math.max(0, Math.sin(this.t * 6.0)) * 0.22;
    } else if (this.phase === 'deliberation') {
      /* the drum roll: both forearms working the head, head bowed */
      headPitch = 0.3;
      headYaw = Math.sin(this.t * 3.1) * 0.05;
      const rollA = Math.sin(this.t * 26) * 0.34;
      const rollB = Math.sin(this.t * 26 + Math.PI) * 0.34;
      armLx = -0.5; armRx = -0.5;
      armLz = 0.42; armRz = -0.42;
      foreX = -1.1;
      p.foreL.rot = [-1.1 + rollA, 0, 0];
      p.foreR.rot = [-1.1 + rollB, 0, 0];
    } else if (this.phase === 'verdict' || this.phase === 'shot') {
      /* both guns up, one trained on each podium */
      const raise = Math.min(1, this.phaseT / 0.55);
      const ease = raise * raise * (3 - 2 * raise);
      armLx = 0.15 + (-1.5708 + 0.1 - 0.15) * ease;
      armRx = 0.15 + (-1.5708 + 0.1 - 0.15) * ease;
      armLz = 0.22 + (this.aimSelf - 0.22) * ease;
      armRz = -0.22 + (this.aimFoe + 0.22) * ease;
      foreX = -0.5 + 0.42 * ease;
      headPitch = -0.06;
      headYaw = 0;
    } else if (this.phase === 'morph') {
      headPitch = 0.18;
      headYaw = Math.sin(this.t * 0.8) * 0.14;
    }

    if (this.phase !== 'deliberation') {
      p.foreL.rot[0] += (foreX - p.foreL.rot[0]) * Math.min(1, dt * 9);
      p.foreR.rot[0] += (foreX - p.foreR.rot[0]) * Math.min(1, dt * 9);
    }
    const k = Math.min(1, dt * 7);
    p.armL.rot[0] += (armLx - p.armL.rot[0]) * k;
    p.armR.rot[0] += (armRx - p.armR.rot[0]) * k;
    p.armL.rot[2] += (armLz - p.armL.rot[2]) * k;
    p.armR.rot[2] += (armRz - p.armR.rot[2]) * k;
    p.head.rot[1] += (headYaw - p.head.rot[1]) * Math.min(1, dt * 4);
    p.head.rot[0] += (headPitch - p.head.rot[0]) * Math.min(1, dt * 4);

    /* ---- trial clock ---- */
    if (this.phase === 'trial' && !this.submitted) {
      const before = Math.ceil(this.timeLeft);
      this.timeLeft -= dt;
      const after = Math.ceil(this.timeLeft);
      if (after !== before && after <= 10 && after >= 0) A.tick();
      this.ui.setTimer(Math.max(0, this.timeLeft));
      if (this.timeLeft <= 0) this.submit(this.ui.getDraft());
    }

    /* ---- verdict beat, then the shot ---- */
    if (this.phase === 'verdict' && this.phaseT > 2.6) this.beginShot();
    if (this.phase === 'shot') {
      if (!this.shotFired && this.phaseT > 0.75) {
        this.shotFired = true;
        this.fireAt(!this.iWon);
      }
      if (this.shotFired && this.phaseT > 3.1) this.finishCase(!!this.iWon);
    }

    /* ---- knockdown ---- */
    for (const fig of [w.self, w.foe]) {
      const want = fig.knockTarget || 0;
      fig.knock += (want - fig.knock) * Math.min(1, dt * 6);
      if (fig.knock > 0.001) {
        fig.body.rot = [-fig.knock * 1.5, fig.body.rot[1] || 0, fig.knock * 0.25];
        fig.body.pos = [0, -fig.knock * 0.25, fig.knock * 0.8];
        fig.tag.alpha = 1 - fig.knock * 0.75;
      } else {
        fig.body.rot = [0, 0, 0];
        fig.body.pos = [0, 0, 0];
        fig.tag.alpha = 1;
      }
    }

    /* ---- sparks and flashes ---- */
    for (const s of w.sparks) {
      if (!s.visible) continue;
      s.life -= dt;
      if (s.life <= 0) { s.visible = false; continue; }
      s.v[1] -= 9.2 * dt;
      s.pos[0] += s.v[0] * dt;
      s.pos[1] += s.v[1] * dt;
      s.pos[2] += s.v[2] * dt;
      if (s.pos[1] < 0.05) { s.pos[1] = 0.05; s.v[1] *= -0.32; s.v[0] *= 0.7; s.v[2] *= 0.7; }
      s.rot[0] += s.spin * dt;
      s.rot[2] += s.spin * 0.6 * dt;
      s.alpha = Math.min(1, s.life / (s.maxLife * 0.55));
    }
    for (const f of w.flashes) {
      if (!f.visible) continue;
      f.life -= dt;
      if (f.life <= 0) { f.visible = false; continue; }
      const g = f.life / 0.24;
      f.scl = [0.35 + g * 1.5, 0.35 + g * 1.5, 0.35 + g * 1.5];
      f.alpha = g;
    }
    this.renderer.flash = Math.max(0, this.renderer.flash - dt * 1.9);
    this.shake *= Math.pow(0.06, dt);

    /* ---- billboards ---- */
    const cam = this.camEye;
    for (const fig of [w.self, w.foe].concat(w.bots)) {
      if (!fig.group.visible) continue;
      const face = Math.atan2(cam[0] - fig.group.pos[0], cam[2] - fig.group.pos[2]);
      fig.tag.rot[1] = face - (fig.group.rot[1] || 0);
    }

    this.updateCamera(dt);
    w.root.updateWorld(null);
  };

  Game.prototype.updateCamera = function (dt) {
    const L = S.LAYOUT;
    let eye, target;

    switch (this.phase) {
      case 'queue': {
        /* over your own shoulder, looking up the line at the drum */
        const slot = L.queueSlot(Math.max(0, this.queuePos));
        eye = [slot[0] - 0.35, 2.35, slot[2] + 2.5];
        target = [0, 2.35, -4.3];
        break;
      }
      case 'trial':
      case 'deliberation': {
        /* your own eyes, at your podium */
        const s = L.standSelf;
        eye = [s[0] + 0.05, 1.62, s[2] + 0.2];
        target = [L.robot[0] - 0.1, 2.45, L.robot[2]];
        break;
      }
      case 'morph': {
        /* you are the drum: the hall seen from the bench */
        const r = L.robot;
        eye = [r[0], r[1] + 2.6, r[2] + 0.7];
        target = [0, 1.35, 0.2];
        break;
      }
      case 'verdict':
      case 'shot':
      case 'aftermath':
        /* wide, high enough that both podiums and the whole robot are in frame */
        eye = [0.15, 2.95, 3.0];
        target = [0, 2.35, -4.2];
        break;
      default: {
        this.orbit += dt * 0.11;
        eye = [Math.sin(this.orbit) * 8.2, 3.6 + Math.sin(this.orbit * 0.7) * 0.6,
               -0.6 + Math.cos(this.orbit) * 8.2];
        target = [0, 2.4, -4.4];
      }
    }

    const rate = Math.min(1, dt * (this.phase === 'menu' ? 6 : 3.2));
    for (let i = 0; i < 3; i++) {
      this.camEye[i] += (eye[i] - this.camEye[i]) * rate;
      this.camTarget[i] += (target[i] - this.camTarget[i]) * rate;
    }

    const sh = this.shake;
    this.renderer.eye = [
      this.camEye[0] + (Math.random() - 0.5) * sh * 0.22,
      this.camEye[1] + (Math.random() - 0.5) * sh * 0.22,
      this.camEye[2] + (Math.random() - 0.5) * sh * 0.12
    ];
    this.renderer.target = this.camTarget;
  };

  Game.prototype.enterVR = function () {
    A.unlock();
    return this.xr.enter().then(() => this.ui.setVR(true));
  };

  global.AJGame = { Game, STANCES };
})(typeof window !== 'undefined' ? window : globalThis);
