/*
 * salah.js -- the follow-the-stickman engine.
 *
 * The stickman leads: he moves into a pose and waits there. You copy him by
 * holding the matching pose button, and only time spent holding the *right*
 * pose counts down the step. He never runs ahead of you, and you cannot skip
 * ahead of him either -- which is the whole point of the lock.
 */
(function (global) {
  'use strict';

  var DHIKR = {
    takbir: 'Allāhu akbar',
    qiyam: 'al-Fātiḥa, then a sūrah',
    ruku: 'Subḥāna rabbiya-l-ʿaẓīm  ×3',
    itidal: 'Samiʿa-llāhu liman ḥamidah · Rabbanā laka-l-ḥamd',
    sujud: 'Subḥāna rabbiya-l-aʿlā  ×3',
    jalsa: 'Rabbi-ghfir lī',
    tashahhud: 'At-taḥiyyātu lillāhi wa-ṣ-ṣalawātu wa-ṭ-ṭayyibāt…',
    salamRight: 'As-salāmu ʿalaykum wa raḥmatu-llāh',
    salamLeft: 'As-salāmu ʿalaykum wa raḥmatu-llāh'
  };

  /* Seconds you must stay in each pose at pace 1.0. */
  var HOLD = {
    takbir: 2.5,
    qiyam: 7,
    ruku: 4,
    itidal: 3,
    sujud: 4,
    jalsa: 2.5,
    tashahhud: 6.5,
    salamRight: 2,
    salamLeft: 2
  };

  /*
   * The fard rak'ahs of one prayer. Two prostrations per rak'ah, a sitting
   * tashahhud after every second rak'ah, and the salam closing the last one.
   */
  function buildSequence(rakahs, pace) {
    pace = pace || 1;
    var steps = [];
    function push(pose, rakah, note) {
      steps.push({
        pose: pose,
        rakah: rakah,
        seconds: Math.max(1, HOLD[pose] * pace),
        dhikr: DHIKR[pose],
        note: note || null
      });
    }

    for (var r = 1; r <= rakahs; r++) {
      if (r === 1) push('takbir', r, 'Takbīrat al-iḥrām — the prayer begins');
      push('qiyam', r);
      push('ruku', r);
      push('itidal', r);
      push('sujud', r, 'First prostration');
      push('jalsa', r);
      push('sujud', r, 'Second prostration');

      var lastRakah = r === rakahs;
      if (lastRakah) {
        push('tashahhud', r, 'Final tashahhud');
        push('salamRight', r);
        push('salamLeft', r);
      } else if (r % 2 === 0) {
        push('tashahhud', r, 'First tashahhud');
      }
    }
    return steps;
  }

  function Session(prayer, opts) {
    opts = opts || {};
    this.prayer = prayer;
    this.steps = buildSequence(prayer.rakahs, opts.pace);
    this.index = 0;
    this.progress = 0;   // seconds banked in the current step
    this.held = null;    // pose group the user is holding right now
    this.wrongFor = 0;   // seconds spent holding the wrong pose
    this.startedAt = Date.now();
    this.done = false;
  }

  Session.prototype.step = function () { return this.steps[this.index]; };

  Session.prototype.group = function () {
    var s = this.step();
    return s ? global.Stickman.POSES[s.pose].group : null;
  };

  Session.prototype.setHeld = function (group) {
    if (this.held !== group) this.wrongFor = 0;
    this.held = group;
  };

  /*
   * Advance by dt seconds. Returns true when the step changed, so the caller
   * can move the stickman and buzz the phone.
   */
  Session.prototype.tick = function (dt) {
    if (this.done) return false;
    var step = this.step();
    var want = this.group();

    if (this.held === want) {
      this.progress += dt;
      this.wrongFor = 0;
    } else if (this.held) {
      this.wrongFor += dt;
      this.progress = Math.max(0, this.progress - dt * 0.5);
    } else {
      // Let go and the pose slowly drains -- pausing mid-sujud is not a pause.
      this.progress = Math.max(0, this.progress - dt * 0.35);
    }

    if (this.progress >= step.seconds) {
      this.index++;
      this.progress = 0;
      this.wrongFor = 0;
      if (this.index >= this.steps.length) {
        this.done = true;
        this.index = this.steps.length - 1;
      }
      return true;
    }
    return false;
  };

  Session.prototype.fraction = function () {
    var step = this.step();
    return step ? Math.min(1, this.progress / step.seconds) : 1;
  };

  /* Overall completion across the whole prayer, for the top progress bar. */
  Session.prototype.overall = function () {
    if (this.done) return 1;
    var total = 0, doneSecs = 0;
    for (var i = 0; i < this.steps.length; i++) {
      total += this.steps[i].seconds;
      if (i < this.index) doneSecs += this.steps[i].seconds;
    }
    return (doneSecs + this.progress) / total;
  };

  Session.prototype.rakahLabel = function () {
    var step = this.step();
    return step ? step.rakah + ' / ' + this.prayer.rakahs : '';
  };

  global.Salah = {
    Session: Session,
    buildSequence: buildSequence,
    HOLD: HOLD,
    DHIKR: DHIKR
  };
})(window);
