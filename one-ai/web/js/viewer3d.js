/* A small WebGL viewer for GLB files: positions, normals and material base
 * colours (what Modelgent writes, and most simple models). Drag to turn,
 * scroll or pinch to zoom. */
(function () {
  'use strict';

  var VS = 'attribute vec3 p;attribute vec3 n;uniform mat4 mvp;uniform mat4 model;varying vec3 vn;' +
    'void main(){vn=mat3(model)*n;gl_Position=mvp*vec4(p,1.0);}';
  var FS = 'precision mediump float;uniform vec4 color;varying vec3 vn;void main(){vec3 l=normalize(vec3(.4,.8,.6));' +
    'float d=max(dot(normalize(vn),l),0.0);float b=max(dot(normalize(vn),-l),0.0)*.25;' +
    'gl_FragColor=vec4(color.rgb*(.35+.65*d+b),color.a);}';

  function parse(buf) {
    var dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Inte en GLB-fil');
    var jsonLen = dv.getUint32(12, true);
    var gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
    var binStart = 20 + jsonLen + 8;
    function acc(i) {
      var a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView];
      var off = binStart + (v.byteOffset || 0) + (a.byteOffset || 0);
      if (a.componentType !== 5126 || (v.byteStride && v.byteStride !== 12)) return null;
      return new Float32Array(buf.slice(off, off + a.count * 12));
    }
    var parts = [];
    (gltf.meshes || []).forEach(function (mesh) {
      mesh.primitives.forEach(function (pr) {
        if (pr.attributes.POSITION == null || (pr.mode != null && pr.mode !== 4)) return;
        var pos = acc(pr.attributes.POSITION), nor = pr.attributes.NORMAL != null ? acc(pr.attributes.NORMAL) : null;
        if (!pos) return;
        var idx = null;
        if (pr.indices != null) {
          var a = gltf.accessors[pr.indices], v = gltf.bufferViews[a.bufferView];
          var off = binStart + (v.byteOffset || 0) + (a.byteOffset || 0);
          idx = a.componentType === 5125 ? new Uint32Array(buf.slice(off, off + a.count * 4)) :
            a.componentType === 5123 ? new Uint16Array(buf.slice(off, off + a.count * 2)) : new Uint8Array(buf.slice(off, off + a.count));
        }
        var mat = pr.material != null ? gltf.materials[pr.material] : null;
        var col = mat && mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorFactor || [0.75, 0.75, 0.75, 1];
        parts.push({ pos: pos, nor: nor || flatNormals(pos, idx), idx: idx, color: col });
      });
    });
    return parts;
  }

  function flatNormals(pos, idx) {
    var n = new Float32Array(pos.length), count = idx ? idx.length : pos.length / 3;
    for (var t = 0; t < count; t += 3) {
      var ia = idx ? idx[t] : t, ib = idx ? idx[t + 1] : t + 1, ic = idx ? idx[t + 2] : t + 2;
      var ax = pos[ib * 3] - pos[ia * 3], ay = pos[ib * 3 + 1] - pos[ia * 3 + 1], az = pos[ib * 3 + 2] - pos[ia * 3 + 2];
      var bx = pos[ic * 3] - pos[ia * 3], by = pos[ic * 3 + 1] - pos[ia * 3 + 1], bz = pos[ic * 3 + 2] - pos[ia * 3 + 2];
      var cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      [ia, ib, ic].forEach(function (k) { n[k * 3] += cx; n[k * 3 + 1] += cy; n[k * 3 + 2] += cz; });
    }
    return n;
  }

  function mul(a, b) {
    var o = new Float32Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
      var s = 0;
      for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
    return o;
  }
  function perspective(fov, aspect, near, far) {
    var f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function rotation(yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return new Float32Array([cy, sp * sy, -cp * sy, 0, 0, cp, sp, 0, sy, -sp * cy, cp * cy, 0, 0, 0, 0, 1]);
  }

  function show(container, buffer) {
    var parts = parse(buffer);
    var canvas = document.createElement('canvas');
    container.appendChild(canvas);
    var gl = canvas.getContext('webgl', { antialias: true });
    if (!gl) throw new Error('WebGL saknas');
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    var uint32 = gl.getExtension('OES_element_index_uint');
    var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    parts.forEach(function (p) {
      for (var i = 0; i < p.pos.length; i += 3) for (var k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p.pos[i + k]); max[k] = Math.max(max[k], p.pos[i + k]);
      }
      p.pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, p.pb); gl.bufferData(gl.ARRAY_BUFFER, p.pos, gl.STATIC_DRAW);
      p.nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, p.nb); gl.bufferData(gl.ARRAY_BUFFER, p.nor, gl.STATIC_DRAW);
      if (p.idx) {
        if (p.idx instanceof Uint32Array && !uint32) p.idx = new Uint16Array(p.idx);
        p.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, p.idx, gl.STATIC_DRAW);
      }
    });
    var center = [0, 1, 2].map(function (k) { return (min[k] + max[k]) / 2; });
    var radius = Math.max(0.001, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
    var loc = { p: gl.getAttribLocation(prog, 'p'), n: gl.getAttribLocation(prog, 'n'), mvp: gl.getUniformLocation(prog, 'mvp'),
      model: gl.getUniformLocation(prog, 'model'), color: gl.getUniformLocation(prog, 'color') };
    var yaw = 0.6, pitch = 0.35, dist = 2.6, alive = true;

    function draw() {
      if (!alive) return;
      var w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      var s = 1 / radius;
      var model = mul(rotation(yaw, pitch), new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -center[0] * s, -center[1] * s, -center[2] * s, 1]));
      var view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -dist, 1]);
      var mvp = mul(perspective(0.8, w / Math.max(1, h), 0.05, 100), mul(view, model));
      gl.uniformMatrix4fv(loc.mvp, false, mvp);
      gl.uniformMatrix4fv(loc.model, false, model);
      parts.forEach(function (p) {
        gl.bindBuffer(gl.ARRAY_BUFFER, p.pb); gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, p.nb); gl.enableVertexAttribArray(loc.n); gl.vertexAttribPointer(loc.n, 3, gl.FLOAT, false, 0, 0);
        gl.uniform4fv(loc.color, p.color);
        if (p.ib) {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.ib);
          gl.drawElements(gl.TRIANGLES, p.idx.length, p.idx instanceof Uint32Array ? gl.UNSIGNED_INT : p.idx instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE, 0);
        } else gl.drawArrays(gl.TRIANGLES, 0, p.pos.length / 3);
      });
    }

    var drag = null, pinch = null;
    canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag || pinch) return;
      yaw += (e.clientX - drag.x) * 0.01;
      pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - drag.y) * 0.01));
      drag = { x: e.clientX, y: e.clientY };
      requestAnimationFrame(draw);
    });
    canvas.addEventListener('pointerup', function () { drag = null; });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      dist = Math.max(1.2, Math.min(10, dist * (e.deltaY > 0 ? 1.1 : 0.9)));
      requestAnimationFrame(draw);
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 2) return;
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (pinch) { dist = Math.max(1.2, Math.min(10, dist * pinch / d)); requestAnimationFrame(draw); }
      pinch = d;
    }, { passive: true });
    canvas.addEventListener('touchend', function () { pinch = null; });
    var ro = window.ResizeObserver ? new ResizeObserver(function () { requestAnimationFrame(draw); }) : null;
    if (ro) ro.observe(canvas);
    requestAnimationFrame(draw);
    return { destroy: function () { alive = false; if (ro) ro.disconnect(); } };
  }

  window.Viewer3D = { show: show };
})();
