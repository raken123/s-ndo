/* Nexora 3D viewer: a small flat-shaded 3D renderer on a 2D canvas (painter's
 * algorithm). It shows the models Nexora 3D 1.5 generates. It has no outside
 * dependencies, so the ad renderer can also serialize it with toString(). */

function nxShade(hex, k, fog, fogK) {
  let s = String(hex || '').replace('#', '');
  if (s.length === 3) s = s.split('').map(x => x + x).join('');
  const n = /^[0-9a-f]{6}$/i.test(s) ? parseInt(s, 16) : 0x9aa4ff;
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r *= k; g *= k; b *= k;
  if (fog) {
    const f = parseInt(fog.slice(1), 16);
    r += (((f >> 16) & 255) - r) * fogK; g += (((f >> 8) & 255) - g) * fogK; b += ((f & 255) - b) * fogK;
  }
  return 'rgb(' + (r < 0 ? 0 : r > 255 ? 255 : r | 0) + ',' + (g < 0 ? 0 : g > 255 ? 255 : g | 0) + ',' + (b < 0 ? 0 : b > 255 ? 255 : b | 0) + ')';
}

function Nx3D(ctx) {
  const faces = [];
  const cam = { x: 0, y: 3, z: -8, yaw: 0, pitch: 0.3, fov: 0.9, near: 0.3, far: 70, fog: null };
  let L = [0.45, 0.8, -0.4];
  const l0 = Math.hypot(L[0], L[1], L[2]); L = [L[0] / l0, L[1] / l0, L[2] / l0];
  let W = 1, H = 1, cy = 1, sy = 0, cp = 1, sp = 0;

  function begin(w, h) {
    W = w; H = h; faces.length = 0;
    cy = Math.cos(cam.yaw); sy = Math.sin(cam.yaw); cp = Math.cos(cam.pitch); sp = Math.sin(cam.pitch);
  }
  function toCam(p) {
    const x = p[0] - cam.x, y = p[1] - cam.y, z = p[2] - cam.z;
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    return [x1, y * cp + z1 * sp, -y * sp + z1 * cp];
  }
  function project(p) {
    const c = toCam(p);
    if (c[2] < cam.near) return null;
    const f = H * cam.fov;
    return [W / 2 + c[0] / c[2] * f, H / 2 - c[1] / c[2] * f, c[2]];
  }
  // pts: world-space polygon; normal optional (computed and oriented to the camera if missing)
  function poly(pts, color, normal, alpha) {
    let n = normal;
    if (!n) {
      const a = pts[0], b = pts[1], c = pts[2];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const ln = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / ln, n[1] / ln, n[2] / ln];
      const d = n[0] * (a[0] - cam.x) + n[1] * (a[1] - cam.y) + n[2] * (a[2] - cam.z);
      if (d > 0) n = [-n[0], -n[1], -n[2]];
    } else {
      const a = pts[0];
      if (n[0] * (a[0] - cam.x) + n[1] * (a[1] - cam.y) + n[2] * (a[2] - cam.z) >= 0) return;
    }
    const scr = []; let depth = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = project(pts[i]);
      if (!p) return;
      scr.push(p); depth += p[2];
    }
    depth /= pts.length;
    if (depth > cam.far) return;
    const lit = 0.42 + 0.58 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const fogK = cam.fog ? Math.min(1, Math.max(0, (depth - cam.far * 0.35) / (cam.far * 0.65))) : 0;
    faces.push({ scr, depth, fill: nxShade(color, lit, cam.fog, fogK), alpha: alpha == null ? 1 : alpha });
  }
  function box(x, y, z, sx, sy2, sz, color) {
    const x0 = x - sx / 2, x1 = x + sx / 2, y0 = y, y1 = y + sy2, z0 = z - sz / 2, z1 = z + sz / 2;
    poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], color, [0, 1, 0]);
    poly([[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], color, [0, -1, 0]);
    poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], color, [0, 0, -1]);
    poly([[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], color, [0, 0, 1]);
    poly([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], color, [-1, 0, 0]);
    poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], color, [1, 0, 0]);
  }
  // mesh: {vertices:[[x,y,z]], faces:[[i,j,k,...]], colors:[hex per face]}
  function mesh(m, px, py, pz, scale, rotY, fallback) {
    const c = Math.cos(rotY || 0), s = Math.sin(rotY || 0), k = scale || 1;
    const vs = m.vertices.map(v => [px + (v[0] * c + v[2] * s) * k, py + v[1] * k, pz + (-v[0] * s + v[2] * c) * k]);
    for (let i = 0; i < m.faces.length; i++) {
      const f = m.faces[i];
      if (f.length < 3) continue;
      const pts = [];
      for (let j = 0; j < f.length; j++) { const v = vs[f[j]]; if (!v) { pts.length = 0; break; } pts.push(v); }
      if (pts.length >= 3) poly(pts, (m.colors && m.colors[i]) || fallback || '#9aa4ff');
    }
  }
  function flush() {
    faces.sort((a, b) => b.depth - a.depth);
    for (const f of faces) {
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.moveTo(f.scr[0][0], f.scr[0][1]);
      for (let i = 1; i < f.scr.length; i++) ctx.lineTo(f.scr[i][0], f.scr[i][1]);
      ctx.closePath();
      ctx.fillStyle = f.fill; ctx.fill();
      ctx.strokeStyle = f.fill; ctx.lineWidth = 0.6; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    faces.length = 0;
  }
  return { cam, begin, project, poly, box, mesh, flush };
}
