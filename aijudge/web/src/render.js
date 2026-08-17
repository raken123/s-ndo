/* render.js — draw loop, camera, in-world text panels, and WebXR presentation.

   Text has to be readable in VR, where a DOM overlay does not exist, so every
   in-world label is drawn to a 2D canvas and pasted onto a quad. */
(function (global) {
  'use strict';

  const M4 = global.AJGL.M4;

  const PANEL_VERT = `#version 300 es
  precision highp float;
  in vec3 aPos;
  in vec2 aUV;
  uniform mat4 uProj, uView, uModel;
  out vec2 vUV;
  void main() { vUV = aUV; gl_Position = uProj * uView * uModel * vec4(aPos, 1.0); }`;

  const PANEL_FRAG = `#version 300 es
  precision highp float;
  in vec2 vUV;
  uniform sampler2D uTex;
  uniform float uAlpha;
  out vec4 fragColor;
  void main() {
    vec4 t = texture(uTex, vUV);
    if (t.a < 0.01) discard;
    fragColor = vec4(t.rgb, t.a * uAlpha);
  }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('panel shader: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  function Renderer(canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: true, alpha: false, xrCompatible: true,
      powerPreference: 'high-performance'
    });
    if (!gl) throw new Error('WebGL2 is required to hold court.');

    this.canvas = canvas;
    this.gl = gl;
    this.prog = global.AJGL.createProgram(gl);
    this.flash = 0;

    /* panel program + unit quad */
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, PANEL_VERT));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, PANEL_FRAG));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.bindAttribLocation(p, 1, 'aUV');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('panel link: ' + gl.getProgramInfoLog(p));
    }
    this.panelProg = {
      program: p,
      u: {
        proj: gl.getUniformLocation(p, 'uProj'),
        view: gl.getUniformLocation(p, 'uView'),
        model: gl.getUniformLocation(p, 'uModel'),
        tex: gl.getUniformLocation(p, 'uTex'),
        alpha: gl.getUniformLocation(p, 'uAlpha')
      }
    };

    const quadVao = gl.createVertexArray();
    gl.bindVertexArray(quadVao);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5, 0, 0, 1,   0.5, -0.5, 0, 1, 1,
       0.5,  0.5, 0, 1, 0,  -0.5,  0.5, 0, 0, 0
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    const qi = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, qi);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.quad = quadVao;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.09, 0.06, 0.04, 1);

    this.proj = M4.create();
    this.view = M4.create();
    this.eye = [0, 1.7, 4];
    this.target = [0, 1.7, -4];
    this._nm = new Float32Array(9);
  }

  Renderer.prototype.upload = function (data) {
    return global.AJGL.uploadMesh(this.gl, data);
  };

  /* Creates a panel texture from a draw callback; call update() to redraw. */
  Renderer.prototype.makePanel = function (w, h, draw) {
    const gl = this.gl;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const tex = gl.createTexture();
    const panel = {
      canvas: cv, ctx, tex, draw,
      update(fn) {
        ctx.clearRect(0, 0, w, h);
        (fn || panel.draw)(ctx, w, h);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
        gl.generateMipmap(gl.TEXTURE_2D);
      }
    };
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    panel.update();
    return panel;
  };

  Renderer.prototype.resize = function () {
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.canvas.width = w; this.canvas.height = h;
    }
  };

  /* Collects visible nodes into solid and panel lists. */
  function collect(node, solids, panels) {
    if (!node.visible) return;
    if (node.mesh) solids.push(node);
    if (node.panel) panels.push(node);
    for (let k = 0; k < node.children.length; k++) collect(node.children[k], solids, panels);
  }

  Renderer.prototype.drawScene = function (root, proj, view, eye, viewport) {
    const gl = this.gl;
    if (viewport) gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

    const solids = [], panels = [];
    collect(root, solids, panels);

    gl.useProgram(this.prog.program);
    gl.uniformMatrix4fv(this.prog.u.proj, false, proj);
    gl.uniformMatrix4fv(this.prog.u.view, false, view);
    gl.uniform3fv(this.prog.u.eye, eye);
    gl.uniform1f(this.prog.u.flash, this.flash);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);

    /* opaque first, then anything translucent */
    solids.sort((a, b) => (a.alpha < 1 ? 1 : 0) - (b.alpha < 1 ? 1 : 0));
    let blending = false;
    for (const n of solids) {
      if (n.alpha < 1 && !blending) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        blending = true;
      }
      M4.normalMat(this._nm, n.world);
      gl.uniformMatrix4fv(this.prog.u.model, false, n.world);
      gl.uniformMatrix3fv(this.prog.u.normalMat, false, this._nm);
      gl.uniform3fv(this.prog.u.tint, n.tint);
      gl.uniform1f(this.prog.u.emissive, n.emissive);
      gl.uniform1f(this.prog.u.alpha, n.alpha);
      gl.bindVertexArray(n.mesh.vao);
      gl.drawElements(gl.TRIANGLES, n.mesh.count, n.mesh.type, 0);
    }
    if (blending) { gl.disable(gl.BLEND); gl.depthMask(true); }

    if (panels.length) {
      gl.useProgram(this.panelProg.program);
      gl.uniformMatrix4fv(this.panelProg.u.proj, false, proj);
      gl.uniformMatrix4fv(this.panelProg.u.view, false, view);
      gl.uniform1i(this.panelProg.u.tex, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(this.quad);
      gl.activeTexture(gl.TEXTURE0);
      for (const n of panels) {
        gl.uniformMatrix4fv(this.panelProg.u.model, false, n.world);
        gl.uniform1f(this.panelProg.u.alpha, n.alpha);
        gl.bindTexture(gl.TEXTURE_2D, n.panel.tex);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      }
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
    }
    gl.bindVertexArray(null);
  };

  /* Flat-screen frame. */
  Renderer.prototype.render = function (root) {
    const gl = this.gl;
    this.resize();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    M4.perspective(this.proj, 1.05, aspect, 0.05, 120);
    M4.lookAt(this.view, this.eye, this.target, [0, 1, 0]);
    this.drawScene(root, this.proj, this.view, this.eye);
  };

  /* One XR frame: draw the scene once per eye into the XR framebuffer. */
  Renderer.prototype.renderXR = function (root, pose, layer) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const view4 = M4.create();
    for (const view of pose.views) {
      const vp = layer.getViewport(view);
      M4.invert(view4, view.transform.matrix);
      const pos = view.transform.position;
      this.drawScene(root, view.projectionMatrix, view4, [pos.x, pos.y, pos.z], vp);
    }
  };

  global.AJRender = { Renderer };
})(typeof window !== 'undefined' ? window : globalThis);
