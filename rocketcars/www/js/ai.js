/* Opponent bot */
(function () {
  var CFG = RC.CFG, F = CFG.FIELD, T = THREE;
  var _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3();

  RC.DIFF = [
    { name: 'Rookie',  react: 0.28, noise: 0.35, boostSkill: 0.25, aerial: 0.0,  lead: 0.10, throttle: 0.80 },
    { name: 'Pro',     react: 0.14, noise: 0.16, boostSkill: 0.6,  aerial: 0.45, lead: 0.28, throttle: 1.0 },
    { name: 'All-Star',react: 0.05, noise: 0.05, boostSkill: 0.95, aerial: 0.9,  lead: 0.45, throttle: 1.0 }
  ];

  RC.makeAI = function (car, sign, level) {
    return {
      car: car, sign: sign, level: level | 0, t: 0,
      inp: { steer: 0, pitch: 0, gas: 0, rev: 0, boost: false, roll: false, jumpPressed: false, jumpHeld: false },
      target: new T.Vector3(), jumpCd: 0, wobble: 0
    };
  };

  RC.stepAI = function (ai, ball, pads, dt) {
    var c = ai.car, d = RC.DIFF[ai.level] || RC.DIFF[1];
    var inp = ai.inp;
    inp.jumpPressed = false;
    ai.jumpCd -= dt;
    ai.t += dt;

    var ownGoalZ = ai.sign * F.L / 2;
    var oppGoalZ = -ai.sign * F.L / 2;

    // where the ball will be shortly
    var lead = _a.copy(ball.pos).addScaledVector(ball.vel, d.lead);
    lead.y = Math.max(lead.y, 0);

    // aim: line from the ball to the opponent goal, approach from behind
    var aim = _b.set(0 - lead.x * 0.35, 0, oppGoalZ - lead.z);
    aim.y = 0;
    if (aim.lengthSq() < 1e-4) aim.set(0, 0, -ai.sign);
    aim.normalize();

    var tgt = ai.target;
    tgt.copy(lead).addScaledVector(aim, -(CFG.BALL.R + CFG.CAR.L * 0.45));
    tgt.y = 0;

    // defend if the ball is behind us and heading at our net
    var ballToOwn = Math.abs(lead.z - ownGoalZ);
    var meToOwn = Math.abs(c.pos.z - ownGoalZ);
    var defending = ballToOwn < meToOwn - 4 && ballToOwn < F.L * 0.42;
    if (defending) {
      tgt.set(lead.x * 0.55, 0, ownGoalZ - ai.sign * 12);
    }

    // grab boost when low and it is roughly on the way
    if (c.boost < 24 && !defending && Math.random() < 1) {
      var bestPad = null, bestScore = 1e9;
      for (var i = 0; i < pads.length; i++) {
        var p = pads[i];
        if (p.t > 0) continue;
        var dx = p.x - c.pos.x, dz = p.z - c.pos.z;
        var dist = Math.sqrt(dx * dx + dz * dz);
        var detour = dist + Math.hypot(p.x - tgt.x, p.z - tgt.z) - Math.hypot(tgt.x - c.pos.x, tgt.z - c.pos.z);
        var score = detour - (p.big ? 22 : 6) * d.boostSkill;
        if (dist < 55 && score < bestScore) { bestScore = score; bestPad = p; }
      }
      if (bestPad && bestScore < 16) tgt.set(bestPad.x, 0, bestPad.z);
    }

    // steer toward the target
    var to = _c.copy(tgt).sub(c.pos); to.y = 0;
    var dist2 = to.length();
    if (dist2 > 1e-4) to.multiplyScalar(1 / dist2);

    ai.wobble += dt * 3.1;
    var noise = Math.sin(ai.wobble * 1.7) * d.noise * 0.35;

    var fwd = _a.copy(c.fwd); fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, ai.sign); else fwd.normalize();
    var ang = Math.atan2(fwd.x * to.z - fwd.z * to.x, fwd.x * to.x + fwd.z * to.z);
    ang = -ang;

    var steer = RC.clamp(ang * 2.2 + noise, -1, 1);
    var back = Math.abs(ang) > 2.15 && dist2 < 26;
    inp.steer = back ? -steer : steer;
    inp.gas = back ? 0 : d.throttle;
    inp.rev = back ? 1 : 0;
    inp.roll = Math.abs(ang) > 1.0 && c.grounded && c.vel.length() > 22;

    // boost when lined up
    var wantBoost = !back && Math.abs(ang) < 0.30 && c.boost > 6 &&
      (dist2 > 16 || (defending && dist2 > 8)) && Math.random() < d.boostSkill + 0.05;
    inp.boost = wantBoost;

    // ball chasing / jumping
    var toBall = _b.copy(ball.pos).sub(c.pos);
    var bd = toBall.length();
    var alignedBall = fwd.dot(_c.set(toBall.x, 0, toBall.z).normalize()) > 0.75;

    if (c.grounded && ai.jumpCd <= 0 && alignedBall) {
      // pop up to meet a bouncing ball, or flick when it's on the nose
      if (ball.pos.y > 5.5 && bd < 16 && Math.random() < d.aerial) {
        inp.jumpPressed = true; inp.jumpHeld = true;
        ai.jumpCd = 1.4; ai.aerialUntil = ai.t + 0.9;
      } else if (ball.pos.y < 5 && bd < CFG.BALL.R + CFG.CAR.L * 0.62 && c.vel.length() > 14 && Math.random() < 0.35 + d.aerial * 0.5) {
        inp.jumpPressed = true; inp.jumpHeld = true;
        ai.flickAt = ai.t + 0.10; ai.jumpCd = 1.6;
      }
    } else {
      inp.jumpHeld = false;
    }

    // second input of the dodge / aerial
    if (!c.grounded) {
      if (ai.flickAt && ai.t >= ai.flickAt && ai.t < ai.flickAt + 0.2 && c.flipAvail) {
        inp.pitch = 1; inp.steer = 0;      // stick up == front flip == flick
        inp.jumpPressed = true;
        ai.flickAt = 0;
      } else if (ai.aerialUntil && ai.t < ai.aerialUntil) {
        // point the nose at the ball and boost up to it
        var want = _c.copy(ball.pos).sub(c.pos).normalize();
        var pitchErr = want.y - c.fwd.y;
        inp.pitch = RC.clamp(-pitchErr * 2.5, -1, 1) * (RC.invertPitch ? -1 : 1);
        var lat = c.right.dot(want);
        inp.steer = RC.clamp(lat * 2.0, -1, 1);
        inp.boost = c.boost > 2 && c.fwd.dot(want) > 0.6;
      } else {
        // recover: get the wheels back under us
        inp.pitch = RC.clamp(c.fwd.y * 2.0, -1, 1) * (RC.invertPitch ? -1 : 1);
        inp.roll = true;
        inp.steer = RC.clamp(-c.right.y * 2.0, -1, 1);
      }
    }
    return inp;
  };
})();
