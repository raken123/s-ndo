/*
 * stickman.js -- the imam you have to follow.
 *
 * A side-view stick figure facing left (towards the qibla). Each pose is a set
 * of normalised joint positions; moving between poses is a plain eased lerp of
 * every joint, which is enough to read as salah at a glance.
 *
 * Coordinate space is 0..1 in both axes, y pointing down, floor at y = 0.90.
 */
(function (global) {
  'use strict';

  var FLOOR = 0.90;

  /* joint order: head, neck, hip, kneeN, footN, kneeF, footF,
   *              elbowN, handN, elbowF, handF   (N = near side, F = far side) */
  var POSES = {
    qiyam: {
      label: 'Qiyam', arabic: 'قيام', hint: 'Stand. Hands folded, reciting al-Fatiha.',
      group: 'stand', headR: 0.062, face: -1,
      j: {
        head: [0.500, 0.140], neck: [0.500, 0.235], hip: [0.500, 0.500],
        kneeN: [0.483, 0.700], footN: [0.472, FLOOR],
        kneeF: [0.517, 0.700], footF: [0.528, FLOOR],
        elbowN: [0.430, 0.400], handN: [0.505, 0.425],
        elbowF: [0.570, 0.400], handF: [0.500, 0.450]
      }
    },
    takbir: {
      label: 'Takbir', arabic: 'تكبير', hint: 'Hands up to the ears: Allahu akbar.',
      group: 'stand', headR: 0.062, face: -1,
      j: {
        head: [0.500, 0.140], neck: [0.500, 0.235], hip: [0.500, 0.500],
        kneeN: [0.483, 0.700], footN: [0.472, FLOOR],
        kneeF: [0.517, 0.700], footF: [0.528, FLOOR],
        elbowN: [0.398, 0.305], handN: [0.432, 0.163],
        elbowF: [0.602, 0.305], handF: [0.568, 0.163]
      }
    },
    itidal: {
      label: "I'tidal", arabic: 'اعتدال', hint: 'Stand up straight again, arms at your sides.',
      group: 'stand', headR: 0.062, face: -1,
      j: {
        head: [0.500, 0.140], neck: [0.500, 0.235], hip: [0.500, 0.500],
        kneeN: [0.483, 0.700], footN: [0.472, FLOOR],
        kneeF: [0.517, 0.700], footF: [0.528, FLOOR],
        elbowN: [0.452, 0.395], handN: [0.446, 0.530],
        elbowF: [0.548, 0.395], handF: [0.554, 0.530]
      }
    },
    ruku: {
      label: "Ruku'", arabic: 'ركوع', hint: 'Bow with a flat back, hands on your knees.',
      group: 'bow', headR: 0.062, face: -1,
      j: {
        head: [0.283, 0.455], neck: [0.362, 0.437], hip: [0.600, 0.470],
        kneeN: [0.583, 0.700], footN: [0.572, FLOOR],
        kneeF: [0.617, 0.700], footF: [0.628, FLOOR],
        elbowN: [0.462, 0.565], handN: [0.560, 0.688],
        elbowF: [0.482, 0.575], handF: [0.588, 0.694]
      }
    },
    sujud: {
      label: 'Sujud', arabic: 'سجود', hint: 'Prostrate: forehead, nose, hands, knees, toes down.',
      group: 'down', headR: 0.062, face: -1,
      j: {
        head: [0.288, FLOOR - 0.062], neck: [0.428, 0.744], hip: [0.600, 0.600],
        kneeN: [0.632, FLOOR], footN: [0.752, FLOOR - 0.014],
        kneeF: [0.664, FLOOR], footF: [0.784, FLOOR - 0.014],
        elbowN: [0.372, 0.828], handN: [0.246, FLOOR - 0.010],
        elbowF: [0.392, 0.838], handF: [0.270, FLOOR - 0.010]
      }
    },
    jalsa: {
      label: 'Jalsa', arabic: 'جلسة', hint: 'Sit back on your heels between the two prostrations.',
      group: 'sit', headR: 0.062, face: -1,
      j: {
        head: [0.514, 0.468], neck: [0.536, 0.560], hip: [0.566, 0.798],
        kneeN: [0.398, 0.892], footN: [0.590, 0.890],
        kneeF: [0.430, 0.898], footF: [0.622, 0.896],
        elbowN: [0.478, 0.672], handN: [0.442, 0.800],
        elbowF: [0.508, 0.682], handF: [0.474, 0.812]
      }
    },
    tashahhud: {
      label: 'Tashahhud', arabic: 'تشهد', hint: 'Sit and recite the tashahhud, right index finger raised.',
      group: 'sit', headR: 0.062, face: -1, finger: true,
      j: {
        head: [0.514, 0.468], neck: [0.536, 0.560], hip: [0.566, 0.798],
        kneeN: [0.398, 0.892], footN: [0.590, 0.890],
        kneeF: [0.430, 0.898], footF: [0.622, 0.896],
        elbowN: [0.478, 0.672], handN: [0.442, 0.788],
        elbowF: [0.508, 0.682], handF: [0.474, 0.812]
      }
    },
    salamRight: {
      label: 'Salam (right)', arabic: 'سلام', hint: 'Turn your head right: as-salamu alaykum wa rahmatullah.',
      group: 'sit', headR: 0.062, face: 1, finger: false,
      j: {
        head: [0.578, 0.478], neck: [0.536, 0.560], hip: [0.566, 0.798],
        kneeN: [0.398, 0.892], footN: [0.590, 0.890],
        kneeF: [0.430, 0.898], footF: [0.622, 0.896],
        elbowN: [0.478, 0.672], handN: [0.442, 0.800],
        elbowF: [0.508, 0.682], handF: [0.474, 0.812]
      }
    },
    salamLeft: {
      label: 'Salam (left)', arabic: 'سلام', hint: 'Turn your head left: as-salamu alaykum wa rahmatullah.',
      group: 'sit', headR: 0.062, face: -1, finger: false,
      j: {
        head: [0.448, 0.470], neck: [0.536, 0.560], hip: [0.566, 0.798],
        kneeN: [0.398, 0.892], footN: [0.590, 0.890],
        kneeF: [0.430, 0.898], footF: [0.622, 0.896],
        elbowN: [0.478, 0.672], handN: [0.442, 0.800],
        elbowF: [0.508, 0.682], handF: [0.474, 0.812]
      }
    }
  };

  var JOINTS = Object.keys(POSES.qiyam.j);

  /* Which on-screen button counts as "following" for each pose. */
  var GROUPS = {
    stand: { label: 'Stand', icon: 'stand' },
    bow: { label: 'Bow', icon: 'bow' },
    down: { label: 'Prostrate', icon: 'down' },
    sit: { label: 'Sit', icon: 'sit' }
  };

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function Stickman(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.from = POSES.qiyam;
    this.to = POSES.qiyam;
    this.t = 1;
    this.transition = 700;
    this.startedAt = 0;
    this.breath = 0;
  }

  Stickman.prototype.setPose = function (name, immediate) {
    var pose = POSES[name];
    if (!pose || pose === this.to) return;
    this.from = this.current();
    this.to = pose;
    this.t = immediate ? 1 : 0;
    this.startedAt = performance.now();
  };

  /* Snapshot of the pose being displayed right now, so an interrupted
   * transition starts from where the figure actually is. */
  Stickman.prototype.current = function () {
    if (this.t >= 1) return this.to;
    var e = easeInOut(this.t);
    var j = {};
    var self = this;
    JOINTS.forEach(function (key) {
      var a = self.from.j[key], b = self.to.j[key];
      j[key] = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
    });
    return {
      j: j,
      headR: this.from.headR + (this.to.headR - this.from.headR) * e,
      face: e < 0.5 ? this.from.face : this.to.face,
      finger: e < 0.5 ? this.from.finger : this.to.finger
    };
  };

  Stickman.prototype.poseName = function () {
    return Object.keys(POSES).filter(function (k) { return POSES[k] === this.to; }, this)[0];
  };

  Stickman.prototype.draw = function (now, opts) {
    opts = opts || {};
    var ctx = this.ctx;
    var canvas = this.canvas;
    var dpr = global.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (this.t < 1) {
      this.t = Math.min(1, (now - this.startedAt) / this.transition);
    }
    this.breath = Math.sin(now / 1400) * 0.0025;

    // Fit the 0..1 figure box into the canvas, keeping it square. It may run a
    // little wider than the canvas -- only the mat reaches the box edges -- and
    // sits below centre so the mat lands near the caption instead of floating.
    var size = Math.min(w * 1.12, h * 0.96);
    var ox = (w - size) / 2;
    var oy = (h - size) * 0.62;
    var X = function (x) { return ox + x * size; };
    var Y = function (y) { return oy + y * size; };
    var S = function (v) { return v * size; };

    var pose = this.current();
    var j = pose.j;
    var breath = this.breath;

    // --- prayer mat ---
    var matGrad = ctx.createLinearGradient(0, Y(FLOOR), 0, Y(FLOOR) + S(0.06));
    matGrad.addColorStop(0, opts.matTop || '#e9b25c');
    matGrad.addColorStop(1, opts.matBottom || '#c78a37');
    ctx.fillStyle = matGrad;
    roundRect(ctx, X(0.10), Y(FLOOR) + S(0.012), S(0.80), S(0.045), S(0.014));
    ctx.fill();

    // mihrab arch woven into the mat, pointing the way the figure faces
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = Math.max(1, S(0.006));
    ctx.beginPath();
    ctx.moveTo(X(0.16), Y(FLOOR) + S(0.046));
    ctx.lineTo(X(0.16), Y(FLOOR) + S(0.030));
    ctx.quadraticCurveTo(X(0.20), Y(FLOOR) + S(0.016), X(0.24), Y(FLOOR) + S(0.030));
    ctx.lineTo(X(0.24), Y(FLOOR) + S(0.046));
    ctx.stroke();

    var stroke = opts.color || '#ffffff';
    var far = opts.farColor || 'rgba(255,255,255,.42)';
    var limb = Math.max(2, S(0.030));

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function bone(a, b, color, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(X(a[0]), Y(a[1] + breath));
      ctx.lineTo(X(b[0]), Y(b[1] + breath));
      ctx.stroke();
    }

    // far side first, dimmed, so the figure reads as 3D
    bone(j.hip, j.kneeF, far, limb);
    bone(j.kneeF, j.footF, far, limb);
    bone(j.neck, j.elbowF, far, limb * 0.86);
    bone(j.elbowF, j.handF, far, limb * 0.86);

    // torso
    bone(j.hip, j.neck, stroke, limb * 1.22);

    // near side
    bone(j.hip, j.kneeN, stroke, limb);
    bone(j.kneeN, j.footN, stroke, limb);
    bone(j.neck, j.elbowN, stroke, limb * 0.9);
    bone(j.elbowN, j.handN, stroke, limb * 0.9);

    // neck stub into the head
    var head = j.head;
    bone(j.neck, [head[0] + (j.neck[0] - head[0]) * 0.35, head[1] + (j.neck[1] - head[1]) * 0.35], stroke, limb * 0.9);

    // head
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(X(head[0]), Y(head[1] + breath), S(pose.headR), 0, Math.PI * 2);
    ctx.fill();

    // raised index finger during tashahhud
    if (pose.finger) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = limb * 0.5;
      ctx.beginPath();
      ctx.moveTo(X(j.handN[0]), Y(j.handN[1] + breath));
      ctx.lineTo(X(j.handN[0] - 0.005), Y(j.handN[1] - 0.055 + breath));
      ctx.stroke();
    }

    // a nose-dot marking which way he is looking
    ctx.fillStyle = opts.bg || '#0b1f1a';
    ctx.beginPath();
    ctx.arc(X(head[0] + pose.face * pose.headR * 0.55), Y(head[1] - pose.headR * 0.12 + breath), S(pose.headR * 0.20), 0, Math.PI * 2);
    ctx.fill();
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  global.Stickman = Stickman;
  global.Stickman.POSES = POSES;
  global.Stickman.GROUPS = GROUPS;
})(window);
