/* Arena collision planes, car physics (drive / air / jump / flip), ball physics */
(function () {
  var CFG = RC.CFG, F = CFG.FIELD, G = CFG.GOAL, T = THREE;
  var SQ = Math.SQRT2;

  var _v1 = new T.Vector3(), _v2 = new T.Vector3(), _v3 = new T.Vector3(),
      _v4 = new T.Vector3(), _q1 = new T.Quaternion(), _q2 = new T.Quaternion();

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  RC.clamp = clamp;

  // ---------------------------------------------------------------- planes
  // plane: { n: normal pointing into the playable volume, o: dot(n, p) = o }
  var planePool = [];
  for (var i = 0; i < 12; i++) planePool.push({ n: new T.Vector3(), o: 0, floor: false });

  function P(list, x, y, z, o, isFloor) {
    var p = planePool[list.length];
    p.n.set(x, y, z); p.o = o; p.floor = !!isFloor;
    list.push(p);
    return p;
  }

  var _planes = [];
  // Returns the set of collision planes relevant at position p (handles goal mouths)
  function activePlanes(p, r) {
    _planes.length = 0;
    var inMouthX = Math.abs(p.x) < G.W / 2 - r * 0.15;
    var inMouthY = p.y < G.H - r * 0.15;
    var behind = Math.abs(p.z) > F.L / 2;

    P(_planes, 0, 1, 0, 0, true);                                   // floor

    if (behind) {
      var s = p.z > 0 ? 1 : -1;
      P(_planes, 0, -1, 0, -G.H);                                   // goal ceiling
      P(_planes, 1, 0, 0, -G.W / 2);                                // goal side walls
      P(_planes, -1, 0, 0, -G.W / 2);
      P(_planes, 0, 0, -s, -(F.L / 2 + G.D));                       // back of the net
      return _planes;
    }

    P(_planes, 0, -1, 0, -F.H);                                     // ceiling
    P(_planes, 1, 0, 0, -F.W / 2);                                  // -x wall
    P(_planes, -1, 0, 0, -F.W / 2);                                 // +x wall
    if (!(inMouthX && inMouthY)) {
      P(_planes, 0, 0, 1, -F.L / 2);                                // -z wall
      P(_planes, 0, 0, -1, -F.L / 2);                               // +z wall
    }
    var CH = CFG.CHAMFER, co = (-(F.W / 2 - CH) - F.L / 2) / SQ;
    P(_planes, 1 / SQ, 0, 1 / SQ, co);                              // corner chamfers
    P(_planes, -1 / SQ, 0, 1 / SQ, co);
    P(_planes, 1 / SQ, 0, -1 / SQ, co);
    P(_planes, -1 / SQ, 0, -1 / SQ, co);
    return _planes;
  }
  RC.activePlanes = activePlanes;

  // ---------------------------------------------------------------- car
  RC.makeCar = function (team, isAI) {
    return {
      team: team, isAI: !!isAI,
      pos: new T.Vector3(), vel: new T.Vector3(),
      quat: new T.Quaternion(), omega: new T.Vector3(),
      fwd: new T.Vector3(0, 0, 1), up: new T.Vector3(0, 1, 0), right: new T.Vector3(1, 0, 0),
      boost: CFG.BOOST_START,
      grounded: false, groundN: new T.Vector3(0, 1, 0), onFloor: true,
      climbN: new T.Vector3(0, 1, 0), climbT: 0,
      jumpAvail: true, flipAvail: false, flipTimer: 0,
      jumping: false, jumpHold: 0,
      flipping: 0, flipAxis: new T.Vector3(), dodge: new T.Vector2(),
      boosting: false, wheelSpin: 0, airTime: 0,
      dead: 0
    };
  };

  function updateBasis(c) {
    c.fwd.set(0, 0, 1).applyQuaternion(c.quat);
    c.up.set(0, 1, 0).applyQuaternion(c.quat);
    c.right.set(1, 0, 0).applyQuaternion(c.quat);
  }
  RC.updateBasis = updateBasis;

  function integrateQuat(c, dt) {
    var w = c.omega;
    if (w.lengthSq() < 1e-9) return;
    var ang = w.length() * dt;
    _v1.copy(w).normalize();
    _q1.setFromAxisAngle(_v1, ang);
    c.quat.premultiply(_q1).normalize();
  }

  RC.stepCar = function (c, inp, dt, game) {
    var CARR = Math.max(CFG.CAR.W, CFG.CAR.L) * 0.42;
    updateBasis(c);

    // ---- surface contact -------------------------------------------------
    var planes = activePlanes(c.pos, CARR);
    var best = null, bestD = 1e9;
    if (c.climbT > 0) c.climbT -= dt;
    for (var i = 0; i < planes.length; i++) {
      var pl = planes[i];
      // mid-transition onto a wall: ignore every surface but the one being climbed
      if (c.climbT > 0 && pl.n.dot(c.climbN) < 0.9) continue;
      var d = c.pos.dot(pl.n) - pl.o;
      if (d < CFG.CAR.RIDE + 0.9 && c.up.dot(pl.n) > 0.35) {
        // leaving the surface (jumping) must not be re-captured by the snap
        if (c.vel.dot(pl.n) > 1.2) continue;
        var speed = c.vel.length();
        if (!pl.floor && speed < CFG.WALL_STICK_MIN && c.airTime > 0.15) continue;
        if (d < bestD) { bestD = d; best = pl; }
      }
    }

    var wasAir = !c.grounded;
    c.grounded = !!best;

    if (c.grounded) {
      var n = c.groundN.copy(best.n);
      c.onFloor = best.floor;
      c.airTime = 0;
      // suspension: never penetrate, settle down onto the surface smoothly
      var corr = CFG.CAR.RIDE - bestD;
      c.pos.addScaledVector(n, corr > 0 ? corr : corr * (1 - Math.exp(-18 * dt)));
      var vn = c.vel.dot(n);
      if (vn < 0) c.vel.addScaledVector(n, -vn);
      // land: reset jumps
      c.jumpAvail = true; c.flipAvail = false; c.flipTimer = 0;
      if (c.flipping > 0) { c.flipping = 0; c.omega.set(0, 0, 0); }
      if (wasAir && game && game.onLand) game.onLand(c);

      // align the car to the surface
      _q1.setFromUnitVectors(c.up, n);
      _q2.copy(c.quat).premultiply(_q1);
      c.quat.slerp(_q2, 1 - Math.exp(-16 * dt));
      updateBasis(c);

      // flat basis on the driving surface
      var fwdF = _v1.copy(c.fwd).addScaledVector(n, -c.fwd.dot(n));
      if (fwdF.lengthSq() < 1e-6) fwdF.copy(c.right).cross(n);
      fwdF.normalize();
      var rgtF = _v2.copy(fwdF).cross(n).multiplyScalar(-1).normalize();

      var vF = c.vel.dot(fwdF), vR = c.vel.dot(rgtF);
      var throttle = inp.gas - inp.rev;

      if (throttle > 0) {
        if (vF < CFG.MAX_DRIVE) c.vel.addScaledVector(fwdF, CFG.DRIVE_ACC * throttle * dt);
      } else if (throttle < 0) {
        if (vF > 0.6) c.vel.addScaledVector(fwdF, -CFG.BRAKE * dt);
        else if (vF > -CFG.MAX_DRIVE * 0.55) c.vel.addScaledVector(fwdF, -CFG.DRIVE_ACC * 0.75 * dt);
      } else {
        var dec = Math.min(Math.abs(vF), CFG.COAST * dt);
        c.vel.addScaledVector(fwdF, -Math.sign(vF) * dec);
      }

      // sideways grip / powerslide
      var fr = inp.roll ? CFG.DRIFT_FRIC : CFG.LAT_FRIC;
      c.vel.addScaledVector(rgtF, -vR * (1 - Math.exp(-fr * dt)));

      // steering
      var sp = Math.abs(vF);
      var rate = CFG.STEER * (1 - 0.55 * clamp(sp / CFG.MAX_BOOST_SPEED, 0, 1));
      rate *= 0.3 + 0.7 * clamp(sp / 7, 0, 1);
      if (inp.roll) rate *= 1.45;
      var dir = vF < -0.5 ? -1 : 1;
      if (Math.abs(inp.steer) > 0.02) {
        _q1.setFromAxisAngle(n, inp.steer * rate * dir * dt);
        c.quat.premultiply(_q1).normalize();
        updateBasis(c);
      }
      c.omega.set(0, 0, 0);
      c.wheelSpin += vF * dt * 1.6;

      // gravity pulls the car against the surface (keeps it planted)
      c.vel.addScaledVector(n, -CFG.G * 0.25 * dt);
      if (!best.floor) {
        // on a wall or the ceiling gravity still drags you along the surface
        _v3.set(0, -CFG.G * 0.7, 0);
        _v3.addScaledVector(n, -_v3.dot(n));
        c.vel.addScaledVector(_v3, dt);
      }
    } else {
      // ---- airborne ------------------------------------------------------
      c.onFloor = false;
      c.airTime += dt;
      c.vel.y -= CFG.G * dt;

      if (c.flipping > 0) {
        c.flipping -= dt;
        c.omega.copy(c.flipAxis).multiplyScalar(CFG.FLIP_OMEGA);
        // flip cancel: yank the stick the other way mid-flip
        if (Math.abs(inp.pitch) > 0.65 && Math.abs(c.dodge.y) > 0.4 &&
            Math.sign(inp.pitch) === -Math.sign(c.dodge.y)) {
          c.flipping = 0; c.omega.multiplyScalar(0.10);
        } else if (c.flipping <= 0) {
          c.flipping = 0; c.omega.set(0, 0, 0);
        }
      } else {
        var torque = _v3.set(0, 0, 0);
        if (Math.abs(inp.pitch) > 0.03)
          torque.addScaledVector(c.right, inp.pitch * CFG.AIR_PITCH * (RC.invertPitch ? -1 : 1));
        if (Math.abs(inp.steer) > 0.03) {
          if (inp.roll) torque.addScaledVector(c.fwd, -inp.steer * CFG.AIR_ROLL);
          else torque.addScaledVector(c.up, inp.steer * CFG.AIR_YAW);
        }
        c.omega.addScaledVector(torque, dt);
        var damp = (torque.lengthSq() < 1e-6) ? CFG.AIR_DAMP : 1.0;
        c.omega.multiplyScalar(Math.exp(-damp * dt));
        if (c.omega.length() > CFG.OMEGA_MAX) c.omega.setLength(CFG.OMEGA_MAX);
      }
      integrateQuat(c, dt);
      updateBasis(c);
    }

    // ---- jump / double jump / flip --------------------------------------
    if (c.flipTimer > 0) {
      c.flipTimer -= dt;
      if (c.flipTimer <= 0) c.flipAvail = false;
    }

    if (inp.jumpPressed) {
      if (c.grounded && c.jumpAvail) {
        c.vel.addScaledVector(c.up, CFG.JUMP_V);
        c.pos.addScaledVector(c.up, 0.12);
        c.grounded = false; c.jumpAvail = false;
        c.flipAvail = true; c.flipTimer = CFG.FLIP_WINDOW;
        c.jumping = true; c.jumpHold = 0;
        if (game && game.onJump) game.onJump(c, false);
      } else if (!c.grounded && c.flipAvail && c.flipping <= 0) {
        // stick "up" = nose down = front flip = forward dodge (the front flick)
        var dx = inp.steer, dy = inp.pitch * (RC.invertPitch ? -1 : 1);
        var mag = Math.sqrt(dx * dx + dy * dy);
        if (mag < 0.25) {
          // ---- double jump
          c.vel.addScaledVector(c.up, CFG.JUMP2_V);
          c.flipAvail = false;
          c.jumping = true; c.jumpHold = 0;
          if (game && game.onJump) game.onJump(c, false);
        } else {
          // ---- dodge / flip (forward = front flick)
          dx /= mag; dy /= mag;
          c.dodge.set(dx, dy);
          var fh = _v1.copy(c.fwd); fh.y = 0;
          if (fh.lengthSq() < 1e-4) fh.set(0, 0, 1); else fh.normalize();
          var rh = _v2.set(fh.z, 0, -fh.x);
          var dirW = _v4.copy(fh).multiplyScalar(dy).addScaledVector(rh, dx).normalize();

          var hv = _v3.set(c.vel.x, 0, c.vel.z);
          var newH = hv.addScaledVector(dirW, CFG.FLIP_SPEED);
          if (newH.length() > CFG.MAX_BOOST_SPEED * 1.05) newH.setLength(CFG.MAX_BOOST_SPEED * 1.05);
          c.vel.x = newH.x; c.vel.z = newH.z;
          if (dy > 0.35 && c.vel.y < 0) c.vel.y *= 0.55;   // forward flick keeps you low

          c.flipAxis.copy(c.right).multiplyScalar(dy).addScaledVector(c.fwd, -dx).normalize();
          c.omega.copy(c.flipAxis).multiplyScalar(CFG.FLIP_OMEGA);
          c.flipping = CFG.FLIP_T;
          c.flipAvail = false;
          if (game && game.onJump) game.onJump(c, true);
        }
      }
    }

    if (c.jumping) {
      c.jumpHold += dt;
      if (inp.jumpHeld && c.jumpHold < CFG.JUMP_HOLD_T && !c.grounded)
        c.vel.addScaledVector(c.up, CFG.JUMP_HOLD_ACC * dt);
      else if (!inp.jumpHeld || c.jumpHold >= CFG.JUMP_HOLD_T) c.jumping = false;
    }

    // ---- boost -----------------------------------------------------------
    c.boosting = false;
    if (inp.boost && c.boost > 0) {
      c.boost = Math.max(0, c.boost - CFG.BOOST_USE * dt);
      c.vel.addScaledVector(c.fwd, CFG.BOOST_ACC * dt);
      c.boosting = true;
      var s = c.vel.length();
      if (s > CFG.MAX_BOOST_SPEED) c.vel.multiplyScalar(CFG.MAX_BOOST_SPEED / s);
    }
    var sp2 = c.vel.length();
    if (sp2 > CFG.MAX_SPEED) c.vel.multiplyScalar(CFG.MAX_SPEED / sp2);

    // ---- integrate + wall response --------------------------------------
    c.pos.addScaledVector(c.vel, dt);

    planes = activePlanes(c.pos, CARR);
    for (var k = 0; k < planes.length; k++) {
      var pk = planes[k];
      var dk = c.pos.dot(pk.n) - pk.o;
      var aligned = c.up.dot(pk.n) > 0.35;
      var pen = aligned ? CFG.CAR.RIDE : CARR * 0.75;

      // carry enough speed into a wall/ceiling and the car rolls onto it
      if (!aligned && dk < pen + 0.5 && pk.n.y < 0.5 &&
          c.vel.length() > CFG.WALL_STICK_MIN && c.fwd.dot(pk.n) < -0.12 &&
          c.up.dot(pk.n) > -0.5) {
        c.climbN.copy(pk.n); c.climbT = 0.4;
        _q1.setFromUnitVectors(c.up, pk.n);
        _q2.identity().slerp(_q1, 1 - Math.exp(-26 * dt));
        c.quat.premultiply(_q2).normalize();
        // the speed is redirected up the surface, not thrown away
        var spd = c.vel.length();
        c.vel.applyQuaternion(_q2);
        c.vel.addScaledVector(pk.n, -c.vel.dot(pk.n));   // strictly along the surface
        if (spd > 1 && c.vel.lengthSq() > 1e-6) c.vel.setLength(spd);
        updateBasis(c);
        if (dk < pen) c.pos.addScaledVector(pk.n, pen - dk);
        continue;
      }

      if (dk < pen) {
        c.pos.addScaledVector(pk.n, pen - dk);
        var vv = c.vel.dot(pk.n);
        if (vv < 0) c.vel.addScaledVector(pk.n, -vv * 1.15);
      }
    }
  };

  // ---------------------------------------------------------------- ball
  RC.makeBall = function () {
    return {
      pos: new T.Vector3(0, CFG.BALL.R + 6, 0),
      vel: new T.Vector3(),
      spin: new T.Vector3(),
      quat: new T.Quaternion()
    };
  };

  RC.stepBall = function (b, dt, game) {
    var R = CFG.BALL.R;
    b.vel.y -= CFG.G * dt;
    b.vel.multiplyScalar(Math.exp(-CFG.BALL.DRAG * dt));
    b.pos.addScaledVector(b.vel, dt);

    var planes = activePlanes(b.pos, R);
    for (var i = 0; i < planes.length; i++) {
      var pl = planes[i];
      var d = b.pos.dot(pl.n) - pl.o;
      if (d < R) {
        b.pos.addScaledVector(pl.n, R - d);
        var vn = b.vel.dot(pl.n);
        if (vn < 0) {
          b.vel.addScaledVector(pl.n, -vn * (1 + CFG.BALL.REST));
          // tangential friction
          _v1.copy(b.vel).addScaledVector(pl.n, -b.vel.dot(pl.n));
          b.vel.addScaledVector(_v1, -(1 - Math.exp(-CFG.BALL.FRIC * dt * 26)) * 0.35);
          if (game && game.onBallWall) game.onBallWall(b, -vn, pl);
        }
      }
    }

    var s = b.vel.length();
    if (s > CFG.BALL.MAXV) b.vel.multiplyScalar(CFG.BALL.MAXV / s);

    // rolling visual
    _v1.set(0, 1, 0);
    _v2.copy(b.vel).multiplyScalar(1 / R);
    _v3.crossVectors(_v1, _v2);
    b.spin.lerp(_v3, 0.25);
    var ang = b.spin.length() * dt;
    if (ang > 1e-5) {
      _v4.copy(b.spin).normalize();
      _q1.setFromAxisAngle(_v4, -ang);
      b.quat.premultiply(_q1).normalize();
    }
  };

  // ------------------------------------------------------- car <-> ball
  RC.carBall = function (c, b, game) {
    var hw = CFG.CAR.W / 2 + 0.15, hh = CFG.CAR.H / 2 + 0.15, hl = CFG.CAR.L / 2 + 0.2;
    _q1.copy(c.quat).invert();
    var lp = _v1.copy(b.pos).sub(c.pos).applyQuaternion(_q1);
    var cl = _v2.set(clamp(lp.x, -hw, hw), clamp(lp.y, -hh, hh), clamp(lp.z, -hl, hl));
    var wp = _v3.copy(cl).applyQuaternion(c.quat).add(c.pos);   // closest point, world
    var n = _v4.copy(b.pos).sub(wp);
    var d = n.length();
    if (d > CFG.BALL.R || d < 1e-6) return 0;
    n.multiplyScalar(1 / d);

    b.pos.addScaledVector(n, CFG.BALL.R - d + 0.02);

    // contact point velocity of the car (includes spin -> this is what flicks)
    var r = new THREE.Vector3().copy(wp).sub(c.pos);
    var cpv = new THREE.Vector3().crossVectors(c.omega, r).add(c.vel);
    var rel = new THREE.Vector3().copy(b.vel).sub(cpv);
    var vn = rel.dot(n);
    if (vn > 0.5) return 0;

    var j = -(1 + CFG.HIT_REST) * vn * CFG.HIT_MASS;
    j += CFG.HIT_POP + CFG.HIT_SCALE * Math.max(0, -vn);
    if (c.flipping > 0) j *= CFG.FLICK_BONUS;
    if (c.boosting) j *= 1.10;

    b.vel.addScaledVector(n, j);
    // a touch of the car's own motion so dribbles carry
    _v1.copy(cpv).addScaledVector(n, -cpv.dot(n));
    b.vel.addScaledVector(_v1, 0.10);

    c.vel.addScaledVector(n, -j * 0.11);

    var s = b.vel.length();
    if (s > CFG.BALL.MAXV) b.vel.multiplyScalar(CFG.BALL.MAXV / s);
    if (game && game.onHit) game.onHit(c, b, wp, j);
    return j;
  };

  // ------------------------------------------------------- car <-> car
  RC.carCar = function (a, b) {
    var _d = new THREE.Vector3().copy(b.pos).sub(a.pos);
    var dist = _d.length();
    var R = CFG.CAR.L * 0.5;
    if (dist > R * 2 || dist < 1e-5) return;
    _d.multiplyScalar(1 / dist);
    var pen = R * 2 - dist;
    a.pos.addScaledVector(_d, -pen * 0.5);
    b.pos.addScaledVector(_d, pen * 0.5);
    var va = a.vel.dot(_d), vb = b.vel.dot(_d);
    if (va - vb > 0) {
      a.vel.addScaledVector(_d, -(va - vb) * 0.55);
      b.vel.addScaledVector(_d, (va - vb) * 0.55);
    }
  };
})();
