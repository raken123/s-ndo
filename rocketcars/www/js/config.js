/* Rocket Cars - tunable constants */
window.RC = window.RC || {};

RC.CFG = {
  // Arena (x = width, y = up, z = length/goal-to-goal)
  FIELD: { W: 110, L: 160, H: 36 },
  GOAL:  { W: 28, H: 12, D: 11 },
  CHAMFER: 24,            // rounded corners of the arena

  // Ball
  BALL: { R: 3.0, REST: 0.62, FRIC: 0.42, DRAG: 0.012, MAXV: 92 },

  // Car body (box used for physics + rendering)
  CAR: { L: 4.9, W: 2.7, H: 1.6, RIDE: 1.05 },

  G: 14.5,                // gravity

  // Driving
  DRIVE_ACC: 30,
  MAX_DRIVE: 34,
  MAX_BOOST_SPEED: 52,
  MAX_SPEED: 58,
  BRAKE: 46,
  COAST: 9,
  STEER: 2.5,             // rad/s of yaw at low speed
  LAT_FRIC: 13,           // sideways grip
  DRIFT_FRIC: 2.4,        // grip while powersliding
  WALL_STICK_MIN: 13,     // min speed to keep driving on walls/ceiling

  // Boost
  BOOST_ACC: 28,
  BOOST_USE: 30,          // per second
  BOOST_START: 34,
  PAD_SMALL: 12,
  PAD_BIG: 100,
  PAD_SMALL_T: 4,         // respawn seconds
  PAD_BIG_T: 10,

  // Jump / double jump / flips
  JUMP_V: 7.5,
  JUMP_HOLD_ACC: 30,
  JUMP_HOLD_T: 0.2,
  JUMP2_V: 7.0,           // double jump
  FLIP_WINDOW: 1.3,       // seconds after first jump you may flip
  FLIP_T: 0.55,           // flip rotation duration (one full turn)
  FLIP_SPEED: 17,         // velocity impulse of a dodge
  FLIP_OMEGA: 11.4,       // flip spin rate (rad/s)

  // Air control (angular acceleration, rad/s^2)
  AIR_PITCH: 13, AIR_YAW: 10, AIR_ROLL: 16,
  OMEGA_MAX: 5.6,
  AIR_DAMP: 5.0,

  // Ball <-> car
  HIT_REST: 0.45,         // bounciness of a car touch
  HIT_MASS: 0.78,         // effective car/ball mass ratio
  HIT_POP: 3.5,           // base extra impulse on any touch
  HIT_SCALE: 0.25,        // extra impulse proportional to closing speed
  FLICK_BONUS: 1.45,      // multiplier while flipping (front flick!)

  MATCH_TIME: 180,
  RESPAWN_DELAY: 3.0
};

// Boost pad placement
RC.PADS = (function () {
  var F = RC.CFG.FIELD, big = [], small = [];
  var bx = F.W / 2 - 7, bz = F.L / 2 - 14;
  big.push([-bx, -bz], [bx, -bz], [-bx, bz], [bx, bz], [-bx, 0], [bx, 0]);

  var sx = [-F.W * 0.30, -F.W * 0.13, 0, F.W * 0.13, F.W * 0.30];
  var sz = [-F.L * 0.36, -F.L * 0.17, 0, F.L * 0.17, F.L * 0.36];
  for (var i = 0; i < sx.length; i++) {
    for (var j = 0; j < sz.length; j++) {
      if (i % 2 === 1 && j % 2 === 1) continue;
      small.push([sx[i], sz[j]]);
    }
  }
  // a few in front of each goal
  small.push([-14, -F.L * 0.46], [14, -F.L * 0.46], [-14, F.L * 0.46], [14, F.L * 0.46]);
  return { big: big, small: small };
})();
