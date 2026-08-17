/* gl.js — minimal WebGL2 layer: 4x4 matrix maths, shader program, mesh upload.
   No external dependencies; everything the renderer needs lives here. */
(function (global) {
  'use strict';

  /* ---------------- mat4 (column-major, same layout as GLSL) ---------------- */
  const M4 = {
    create() {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },
    identity(o) {
      o.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); return o;
    },
    multiply(o, a, b) {
      const a00=a[0],a01=a[1],a02=a[2],a03=a[3], a10=a[4],a11=a[5],a12=a[6],a13=a[7],
            a20=a[8],a21=a[9],a22=a[10],a23=a[11], a30=a[12],a31=a[13],a32=a[14],a33=a[15];
      for (let i = 0; i < 4; i++) {
        const b0=b[i*4], b1=b[i*4+1], b2=b[i*4+2], b3=b[i*4+3];
        o[i*4]   = b0*a00 + b1*a10 + b2*a20 + b3*a30;
        o[i*4+1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
        o[i*4+2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
        o[i*4+3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
      }
      return o;
    },

    perspective(o, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      o.set([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
      return o;
    },

    lookAt(o, eye, target, up) {
      let z0=eye[0]-target[0], z1=eye[1]-target[1], z2=eye[2]-target[2];
      let l = Math.hypot(z0,z1,z2) || 1; z0/=l; z1/=l; z2/=l;
      let x0=up[1]*z2-up[2]*z1, x1=up[2]*z0-up[0]*z2, x2=up[0]*z1-up[1]*z0;
      l = Math.hypot(x0,x1,x2) || 1; x0/=l; x1/=l; x2/=l;
      const y0=z1*x2-z2*x1, y1=z2*x0-z0*x2, y2=z0*x1-z1*x0;
      o.set([x0,y0,z0,0, x1,y1,z1,0, x2,y2,z2,0,
             -(x0*eye[0]+x1*eye[1]+x2*eye[2]),
             -(y0*eye[0]+y1*eye[1]+y2*eye[2]),
             -(z0*eye[0]+z1*eye[1]+z2*eye[2]), 1]);
      return o;
    },

    translate(o, x, y, z) {
      M4.identity(o); o[12]=x; o[13]=y; o[14]=z; return o;
    },
    scale(o, x, y, z) {
      M4.identity(o); o[0]=x; o[5]=y; o[10]=z; return o;
    },
    rotY(o, r) {
      const c=Math.cos(r), s=Math.sin(r);
      o.set([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); return o;
    },
    rotX(o, r) {
      const c=Math.cos(r), s=Math.sin(r);
      o.set([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); return o;
    },
    rotZ(o, r) {
      const c=Math.cos(r), s=Math.sin(r);
      o.set([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); return o;
    },

    /* Full inverse — needed to turn an XR view transform into a view matrix. */
    invert(o, m) {
      const a00=m[0],a01=m[1],a02=m[2],a03=m[3], a10=m[4],a11=m[5],a12=m[6],a13=m[7],
            a20=m[8],a21=m[9],a22=m[10],a23=m[11], a30=m[12],a31=m[13],a32=m[14],a33=m[15];
      const b00=a00*a11-a01*a10, b01=a00*a12-a02*a10, b02=a00*a13-a03*a10,
            b03=a01*a12-a02*a11, b04=a01*a13-a03*a11, b05=a02*a13-a03*a12,
            b06=a20*a31-a21*a30, b07=a20*a32-a22*a30, b08=a20*a33-a23*a30,
            b09=a21*a32-a22*a31, b10=a21*a33-a23*a31, b11=a22*a33-a23*a32;
      let det = b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
      if (!det) return M4.identity(o);
      det = 1 / det;
      o[0]=(a11*b11-a12*b10+a13*b09)*det;  o[1]=(a02*b10-a01*b11-a03*b09)*det;
      o[2]=(a31*b05-a32*b04+a33*b03)*det;  o[3]=(a22*b04-a21*b05-a23*b03)*det;
      o[4]=(a12*b08-a10*b11-a13*b07)*det;  o[5]=(a00*b11-a02*b08+a03*b07)*det;
      o[6]=(a32*b02-a30*b05-a33*b01)*det;  o[7]=(a20*b05-a22*b02+a23*b01)*det;
      o[8]=(a10*b10-a11*b08+a13*b06)*det;  o[9]=(a01*b08-a00*b10-a03*b06)*det;
      o[10]=(a30*b04-a31*b02+a33*b00)*det; o[11]=(a21*b02-a20*b04-a23*b00)*det;
      o[12]=(a11*b07-a10*b09-a12*b06)*det; o[13]=(a00*b09-a01*b07+a02*b06)*det;
      o[14]=(a31*b01-a30*b03-a32*b00)*det; o[15]=(a20*b03-a21*b01+a22*b00)*det;
      return o;
    },

    /* Upper-left 3x3 inverse-transpose, for correct normals under scaling. */
    normalMat(o3, m) {
      const i = M4.create();
      M4.invert(i, m);
      /* transpose of the inverse's upper-left 3x3 */
      o3[0]=i[0]; o3[1]=i[4]; o3[2]=i[8];
      o3[3]=i[1]; o3[4]=i[5]; o3[5]=i[9];
      o3[6]=i[2]; o3[7]=i[6]; o3[8]=i[10];
      return o3;
    }
  };

  /* ---------------- shader ---------------- */

  const VERT = `#version 300 es
  precision highp float;
  in vec3 aPos;
  in vec3 aNormal;
  in vec3 aColor;
  uniform mat4 uProj;
  uniform mat4 uView;
  uniform mat4 uModel;
  uniform mat3 uNormalMat;
  out vec3 vNormal;
  out vec3 vColor;
  out vec3 vWorld;
  void main() {
    vec4 world = uModel * vec4(aPos, 1.0);
    vWorld  = world.xyz;
    vNormal = normalize(uNormalMat * aNormal);
    vColor  = aColor;
    gl_Position = uProj * uView * world;
  }`;

  /* Two warm lamps plus a soft bounce off the parquet. Deliberately warm and
     woody — no cool key light anywhere in the hall. */
  const FRAG = `#version 300 es
  precision highp float;
  in vec3 vNormal;
  in vec3 vColor;
  in vec3 vWorld;
  uniform vec3 uEye;
  uniform vec3 uTint;      // multiplied over the vertex colour
  uniform float uEmissive; // 0 = fully lit, 1 = ignore lighting
  uniform float uAlpha;
  uniform float uFlash;    // whole-scene hit flash
  out vec4 fragColor;

  const vec3 LAMP_A_POS = vec3(-4.2, 5.6, -2.0);
  const vec3 LAMP_B_POS = vec3( 4.2, 5.6, -2.0);
  const vec3 LAMP_COL   = vec3(1.00, 0.86, 0.62);
  const vec3 AMBIENT    = vec3(0.26, 0.22, 0.19);
  const vec3 BOUNCE     = vec3(0.34, 0.24, 0.15);

  float lampFalloff(vec3 p, vec3 lampPos) {
    float d = length(lampPos - p);
    return 1.0 / (1.0 + 0.085 * d * d);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 base = vColor * uTint;

    vec3 la = normalize(LAMP_A_POS - vWorld);
    vec3 lb = normalize(LAMP_B_POS - vWorld);
    float da = max(dot(n, la), 0.0) * lampFalloff(vWorld, LAMP_A_POS) * 7.5;
    float db = max(dot(n, lb), 0.0) * lampFalloff(vWorld, LAMP_B_POS) * 7.5;

    // bounce light from the floor, strongest on downward-facing surfaces
    float up = max(-n.y, 0.0);

    vec3 lit = base * (AMBIENT + LAMP_COL * (da + db) + BOUNCE * up);

    // brass and lacquer get a tight warm highlight
    vec3 v = normalize(uEye - vWorld);
    vec3 h = normalize(v + la);
    float spec = pow(max(dot(n, h), 0.0), 42.0) * 0.35;
    lit += LAMP_COL * spec;

    vec3 col = mix(lit, base, uEmissive);
    col += vec3(1.00, 0.86, 0.58) * uFlash;   // additive: bright things blow out, the hall does not fog

    // gentle filmic curve so the lamps roll off instead of clipping
    col = col / (col + vec3(0.62)) * 1.30;
    fragColor = vec4(col, uAlpha);
  }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('shader: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  function createProgram(gl) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.bindAttribLocation(p, 1, 'aNormal');
    gl.bindAttribLocation(p, 2, 'aColor');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('link: ' + gl.getProgramInfoLog(p));
    }
    return {
      program: p,
      u: {
        proj: gl.getUniformLocation(p, 'uProj'),
        view: gl.getUniformLocation(p, 'uView'),
        model: gl.getUniformLocation(p, 'uModel'),
        normalMat: gl.getUniformLocation(p, 'uNormalMat'),
        eye: gl.getUniformLocation(p, 'uEye'),
        tint: gl.getUniformLocation(p, 'uTint'),
        emissive: gl.getUniformLocation(p, 'uEmissive'),
        alpha: gl.getUniformLocation(p, 'uAlpha'),
        flash: gl.getUniformLocation(p, 'uFlash')
      }
    };
  }

  /* ---------------- mesh ---------------- */

  /* Uploads a Builder's interleaved arrays into one VAO. */
  function uploadMesh(gl, data) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);

    const stride = 9 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 6 * 4);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    /* The index type follows the array the Builder actually produced — deriving
       it from the index count instead would break any mesh where the two
       disagree. */
    return {
      vao,
      count: data.indices.length,
      type: (data.indices instanceof Uint32Array) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
    };
  }

  global.AJGL = { M4, createProgram, uploadMesh };
})(typeof window !== 'undefined' ? window : globalThis);
