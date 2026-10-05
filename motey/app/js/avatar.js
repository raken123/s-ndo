/* Motey Pro – 3D face scan and the talking 3D head used by Live Replace.
 *
 * Scan: the camera takes 8 photos by itself (it waits until you hold still in
 * each pose). Gemini 3.8 Flash looks at the front photo and returns where the
 * eyes and mouth are, so the photos line up on the head.
 * Head: a WebGL head mesh. Each photo is projected onto the mesh from the
 * angle it was taken at and the views are blended by surface direction, so
 * the head looks right when it turns. The jaw opens with the voice level and
 * the open-mouth photo is blended in while talking. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const KEY = 'motey.face';
  const POSES = [
    ['front', 'Titta rakt in i kameran 🙂'], ['left', 'Vrid huvudet lite åt vänster ⬅️'], ['right', 'Vrid huvudet lite åt höger ➡️'],
    ['up', 'Titta lite uppåt ⬆️'], ['down', 'Titta lite nedåt ⬇️'], ['smile', 'Le stort! 😁'], ['open', 'Säg ”aaa” – öppna munnen 😮'], ['front2', 'Rakt fram igen – sista bilden!']
  ];

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save(f) { try { localStorage.setItem(KEY, JSON.stringify(f)); return true; } catch (e) { return false; } }
  const hasFace = () => !!(load() || {}).photos;

  /* ---------------- scan ---------------- */
  function renderScan(v, ui) {
    const S = Store.settings;
    if (!S.demo && !Plans.can('replace')) {
      v.innerHTML = `<h1>🏖️ Live Replace</h1><div class="card empty">${Mascot.svg({ size: 110, mood: 'wink' })}
        <p><b>Live Replace finns i Motey Pro.</b></p><p class="muted">Skanna ditt ansikte en gång. Sedan kan en 3D-version av dig prata i mötet – med Gemini 3.8 Flash Live – medan du ligger på stranden.</p>
        <div class="row" style="justify-content:center"><button class="btn coral" id="up">Skaffa Pro – 310 kr/mån</button><a class="btn ghost" href="#/plans">Jämför planer</a></div></div>`;
      $('#up', v).addEventListener('click', () => Plans.buy('pro'));
      return;
    }
    const face = load();
    v.innerHTML = `<h1>🏖️ Ditt 3D-ansikte</h1>
      <p class="muted">Kameran tar ${POSES.length} bilder automatiskt – håll bara still i varje läge. Bilderna stannar på den här enheten${S.demo ? '' : ' (framsidan skickas till Gemini en gång för att hitta ögon och mun)'}.</p>
      <div class="scan-wrap">
        <div class="scan-cam" id="cam"><video autoplay playsinline muted></video><div class="oval"></div><div class="flash"></div><div class="scan-tip" id="tip">Tryck Starta</div></div>
        <div class="scan-side"><div class="thumbs" id="thumbs">${POSES.map(([id]) => `<div class="thumb" data-p="${id}"></div>`).join('')}</div>
          <div class="row"><button class="btn" id="go">${face ? '🔁 Skanna igen' : '📸 Starta skanning'}</button></div>
          ${face ? '<h3 style="margin-top:16px">Så här ser 3D-du ut</h3><div class="avatar-preview"><canvas id="prev" width="480" height="360"></canvas></div><div class="row"><button class="btn ghost sm" id="talk">🗣️ Låt 3D-du säga hej</button><button class="btn ghost sm" id="del">Radera mitt ansikte</button></div>' : ''}
        </div></div>
      <div class="card"><h3>Det här ska 3D-du veta</h3><p class="small muted">Live Replace pratar som du. Skriv vad den får säga – vad du jobbar med, vad som är klart, vad du vill ha sagt.</p>
        <textarea id="notes" placeholder="T.ex. Jag är klar med rapporten och skickar den på fredag. Säg nej till nya uppgifter den här veckan.">${ui.esc(S.replaceNotes || '')}</textarea>
        <label class="field" style="margin-top:10px"><span>3D-dus röst</span><select id="voice">${Gemini.VOICES.map(([id, n]) => `<option value="${id}" ${id === (S.replaceVoice || 'Charon') ? 'selected' : ''}>${n} (${id})</option>`).join('')}</select></label></div>`;
    $('#notes', v).addEventListener('change', e => { S.replaceNotes = e.target.value.trim(); Store.save(); });
    $('#voice', v).addEventListener('change', e => { S.replaceVoice = e.target.value; Store.save(); });
    if (face) {
      face.photos && Object.entries(face.photos).forEach(([k, src]) => { const t = v.querySelector(`.thumb[data-p="${k}"]`); if (t) t.style.backgroundImage = `url(${src})`; });
      const head = createHead(face, { width: 480, height: 360, background: true });
      head.ready.then(() => { const c = $('#prev', v); if (!c) return; const ctx = c.getContext('2d'); const loop = () => { if (!document.body.contains(c)) return head.destroy(); head.frame(); ctx.drawImage(head.canvas, 0, 0); requestAnimationFrame(loop); }; loop(); });
      $('#talk', v).addEventListener('click', () => sayHello(head, ui));
      $('#del', v).addEventListener('click', () => { if (confirm('Radera ditt 3D-ansikte från den här enheten?')) { localStorage.removeItem(KEY); renderScan(v, ui); } });
    }
    $('#go', v).addEventListener('click', () => scan(v, ui));
  }

  async function sayHello(head, ui) {
    const name = AI.firstName(Store.settings.name);
    const text = `Hej allihop! Det är jag, ${name}. Eller ja – min 3D-tvilling. Jag tar mötet idag!`;
    if (AI.hasKey() && !Store.settings.demo) {
      if (!Plans.allow('replace_min')) return;
      const player = Gemini.pcmPlayer();
      head.setLevel(() => player.level());
      const live = new Gemini.Live({ system: `Du är ${name}s 3D-tvilling. Läs upp exakt den text du får, på svenska, glatt.`, voice: Store.settings.replaceVoice || 'Charon', action: 'replace',
        onAudio: (d, m) => player.play(d, m), onTurn: () => setTimeout(() => { live.close(); }, 4000) });
      try { await live.open(); Plans.charge('replace_min'); live.text(text); } catch (e) { ui.toast('Gemini Live: ' + e.message); }
      return;
    }
    let on = true; head.setLevel(() => on ? 0.35 + 0.35 * Math.abs(Math.sin(performance.now() / 90)) : 0);
    Platform.speak(text, { onend: () => { on = false; } });
  }

  async function scan(v, ui) {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false }); }
    catch (e) { return ui.toast('Kameran gick inte att starta'); }
    const video = $('#cam video', v); video.srcObject = stream; await video.play().catch(() => {});
    $('#go', v).disabled = true;
    const photos = {};
    const tiny = document.createElement('canvas'); tiny.width = 32; tiny.height = 24;
    const tctx = tiny.getContext('2d', { willReadFrequently: true });
    let prev = null;
    const motion = () => {
      tctx.drawImage(video, 0, 0, 32, 24);
      const d = tctx.getImageData(0, 0, 32, 24).data;
      let diff = 0;
      if (prev) for (let i = 0; i < d.length; i += 4) diff += Math.abs(d[i] - prev[i]);
      prev = d.slice();
      return diff / (32 * 24);
    };
    for (const [id, tip] of POSES) {
      if (!document.body.contains(video)) break;
      $('#tip', v).textContent = tip;
      Platform.speak(tip);
      const t0 = performance.now();
      let still = 0;
      // wait until the picture has been steady for a moment (or 5 s at most)
      await new Promise(res => {
        const iv = setInterval(() => {
          const m = motion();
          still = m < 6 ? still + 1 : 0;
          const el = performance.now() - t0;
          $('#tip', v).textContent = tip + (el > 1300 ? ' · håll still…' : '');
          if ((el > 1500 && still >= 6) || el > 5000) { clearInterval(iv); res(); }
        }, 100);
      });
      photos[id] = grab(video);
      const fl = $('#cam .flash', v); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
      const th = v.querySelector(`.thumb[data-p="${id}"]`); if (th) th.style.backgroundImage = `url(${photos[id]})`;
    }
    stream.getTracks().forEach(t => t.stop());
    $('#tip', v).textContent = 'Bygger 3D-du…';
    const face = { photos, made: Date.now(), marks: { eyeY: 0.42, mouthY: 0.72, eyeDist: 0.30, cx: 0.5 } };
    if (AI.hasKey() && !Store.settings.demo && Plans.allow('scan')) {
      try {
        const g = Gemini.schema;
        const r = await Gemini.generate({
          action: 'scan', temperature: 0,
          system: 'Du hittar ansiktsdrag i bilder. Svara med koordinater som andelar 0–1 av bildens bredd och höjd.',
          parts: [{ text: 'Var i bilden är ögonens mitt (vänster och höger öga), munnens mitt och hakan? Beskriv också hårfärgen kort på svenska.' },
                  { inlineData: { mimeType: 'image/jpeg', data: photos.front.split(',')[1] } }],
          schema: g.obj({ leftEyeX: { type: 'NUMBER' }, leftEyeY: { type: 'NUMBER' }, rightEyeX: { type: 'NUMBER' }, rightEyeY: { type: 'NUMBER' }, mouthX: { type: 'NUMBER' }, mouthY: { type: 'NUMBER' }, chinY: { type: 'NUMBER' }, hair: g.str })
        });
        if (r.leftEyeY > 0.1 && r.mouthY > r.leftEyeY) {
          face.marks = { eyeY: (r.leftEyeY + r.rightEyeY) / 2, mouthY: r.mouthY, eyeDist: Math.abs(r.rightEyeX - r.leftEyeX), cx: (r.leftEyeX + r.rightEyeX) / 2, chinY: r.chinY };
          face.hair = r.hair;
        }
        Plans.charge('scan');
      } catch (e) { console.warn('ansiktsanalys', e.message); }
    }
    if (!save(face)) return ui.toast('Kunde inte spara bilderna på enheten');
    Store.state.stats.scans = (Store.state.stats.scans || 0) + 1; Store.save();
    ui.toast('🎉 3D-du är klar!');
    renderScan(v, ui);
  }
  // square crop around the face guide, 384 px
  function grab(video) {
    const c = document.createElement('canvas'); c.width = 384; c.height = 384;
    const vw = video.videoWidth, vh = video.videoHeight, side = Math.min(vw, vh) * 0.9;
    c.getContext('2d').drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, 384, 384);
    return c.toDataURL('image/jpeg', 0.85);
  }

  /* ---------------- the 3D head ---------------- */
  const VS = `
attribute vec3 aPos; attribute vec3 aRest; attribute vec3 aNrm;
uniform mat4 uMVP; uniform mat3 uRot;
varying vec3 vRest; varying vec3 vN; varying float vJaw;
void main(){ vRest = aRest; vN = normalize(uRot * aNrm); vJaw = aPos.y - aRest.y; gl_Position = uMVP * vec4(aPos, 1.0); }`;
  const FS = `
precision mediump float;
uniform sampler2D tF; uniform sampler2D tL; uniform sampler2D tR; uniform sampler2D tO;
uniform vec4 uMark; uniform float uOpen; uniform vec3 uHair; uniform float uBody;
varying vec3 vRest; varying vec3 vN; varying float vJaw;
vec2 proj(vec3 p, float yaw){
  // where a point of the head lands in a photo taken with the head turned by yaw
  float c = cos(yaw), s = sin(yaw);
  vec3 q = vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
  float k = uMark.z / 0.48;            // model eyes sit at x = +-0.24, y = 0.2
  return vec2(uMark.w + q.x * k, uMark.x + (0.2 - q.y) * k);
}
void main(){
  if (uBody > 0.5) { float l = 0.55 + 0.45*max(0.0, dot(vN, normalize(vec3(0.3,0.5,1.0)))); gl_FragColor = vec4(vec3(0.42,0.30,0.96)*l, 1.0); return; }
  vec3 n = normalize(vRest);
  float wf = pow(max(0.0, n.z), 3.0);
  float wl = pow(max(0.0, dot(n, normalize(vec3(-0.6,0.0,0.8)))), 3.0) * 0.8;
  float wr = pow(max(0.0, dot(n, normalize(vec3(0.6,0.0,0.8)))), 3.0) * 0.8;
  float wb = pow(max(0.0, -n.z + 0.15), 1.5) + max(0.0, n.y - 0.55) * 2.0;
  vec4 cf = mix(texture2D(tF, proj(vRest, 0.0)), texture2D(tO, proj(vRest, 0.0)), uOpen);
  vec4 cl = texture2D(tL, proj(vRest, 0.5));
  vec4 cr = texture2D(tR, proj(vRest, -0.5));
  vec3 col = (cf.rgb*wf + cl.rgb*wl + cr.rgb*wr + uHair*wb) / (wf + wl + wr + wb + 0.0001);
  if (vJaw < -0.004 && abs(vRest.x) < 0.2 && vRest.z > 0.5) col *= 0.85;
  float light = 0.72 + 0.28 * max(0.0, dot(vN, normalize(vec3(0.25, 0.45, 1.0))));
  float rim = pow(1.0 - max(0.0, vN.z), 3.0) * 0.25;
  gl_FragColor = vec4(col * light + rim, 1.0);
}`;

  function headMesh(mouthY) {
    const pos = [], nrm = [], idx = [];
    const LAT = 44, LON = 56;
    for (let i = 0; i <= LAT; i++) {
      const la = -Math.PI / 2 + Math.PI * i / LAT;
      for (let j = 0; j <= LON; j++) {
        const lo = -Math.PI + 2 * Math.PI * j / LON;
        let x = 0.78 * Math.cos(la) * Math.sin(lo), y = 1.0 * Math.sin(la), z = 0.88 * Math.cos(la) * Math.cos(lo);
        if (y < -0.35) { const k = 1 - 0.45 * Math.min(1, (-0.35 - y) / 0.65); x *= k; z = z > 0 ? z * (0.9 + 0.1 * k) : z * k; }
        if (z > 0) z += 0.16 * Math.exp(-((x / 0.11) ** 2) - (((y + 0.02) / 0.2) ** 2)); // nose
        if (z > 0) z -= 0.05 * Math.exp(-(((Math.abs(x) - 0.24) / 0.12) ** 2) - (((y - 0.2) / 0.1) ** 2)); // eye sockets
        pos.push(x, y, z);
        const n = [x / 0.6, y / 1.0, z / 0.77]; const l = Math.hypot(...n); nrm.push(n[0] / l, n[1] / l, n[2] / l);
      }
    }
    for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) {
      const a = i * (LON + 1) + j, b = a + LON + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
  }
  function bodyMesh() {
    const pos = [], nrm = [], idx = [];
    const R = 24, H = 6;
    for (let i = 0; i <= H; i++) {
      const t = i / H, y = -1.05 - t * 1.0, r = 0.28 + 0.9 * Math.pow(t, 0.55);
      for (let j = 0; j <= R; j++) {
        const a = Math.PI * (j / R) - Math.PI / 2 + Math.PI / 2;
        const x = r * Math.cos(Math.PI - a) * 1.25, z = r * Math.sin(a) * 0.55;
        pos.push(x, y, z - 0.15); nrm.push(Math.cos(Math.PI - a), 0.2, Math.sin(a));
      }
    }
    for (let i = 0; i < H; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
  }
  const mat = {
    persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]; },
    mul(a, b) { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; },
    rot(yaw, pitch, roll) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      const Ry = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1];
      const Rx = [1, 0, 0, 0, 0, cp, sp, 0, 0, -sp, cp, 0, 0, 0, 0, 1];
      const Rz = [cr, sr, 0, 0, -sr, cr, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      return mat.mul(Rz, mat.mul(Ry, Rx));
    },
    trans(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
  };

  function createHead(face, opts) {
    opts = opts || {};
    const W = opts.width || 640, H = opts.height || 360;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const octx = out.getContext('2d');
    const glc = document.createElement('canvas'); glc.width = W; glc.height = H;
    const gl = glc.getContext('webgl', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: true });
    let levelFn = () => 0, open = 0, destroyed = false;
    const imgs = {};
    const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const ready = (async () => {
      for (const k of ['front', 'left', 'right', 'open', 'smile']) imgs[k] = face.photos[k] ? await loadImg(face.photos[k]) : null;
      imgs.open = imgs.open || imgs.front; imgs.left = imgs.left || imgs.front; imgs.right = imgs.right || imgs.front;
    })();
    // hair colour: average of the top strip of the front photo
    let hair = [0.25, 0.18, 0.12];
    ready.then(() => {
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      const x = c.getContext('2d'); x.drawImage(imgs.front, 120, 0, 144, 40, 0, 0, 16, 16);
      const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4; hair = [r / n / 255, g / n / 255, b / n / 255];
    });

    let prog, head, body, tex = {};
    if (gl) {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      const buf = (data, target) => { const b = gl.createBuffer(); gl.bindBuffer(target || gl.ARRAY_BUFFER, b); gl.bufferData(target || gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); return b; };
      const m = headMesh(face.marks.mouthY);
      head = { m, live: new Float32Array(m.pos), bPos: buf(m.pos), bRest: buf(m.pos), bN: buf(m.nrm), bI: buf(m.idx, gl.ELEMENT_ARRAY_BUFFER), n: m.idx.length };
      const bm = bodyMesh();
      body = { bPos: buf(bm.pos), bRest: buf(bm.pos), bN: buf(bm.nrm), bI: buf(bm.idx, gl.ELEMENT_ARRAY_BUFFER), n: bm.idx.length };
      ready.then(() => {
        for (const [unit, k] of [[0, 'front'], [1, 'left'], [2, 'right'], [3, 'open']]) {
          const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgs[k]);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); tex[k] = t;
        }
      });
    }
    const mk = face.marks;
    function drawBg(t) {
      const g = octx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#DCE7FF'); g.addColorStop(1, '#F6F1FF');
      octx.fillStyle = g; octx.fillRect(0, 0, W, H);
      octx.fillStyle = '#BFD4FF'; octx.fillRect(W * 0.62, H * 0.1, W * 0.28, H * 0.42);
      octx.strokeStyle = '#fff'; octx.lineWidth = 6; octx.strokeRect(W * 0.62, H * 0.1, W * 0.28, H * 0.42);
      octx.beginPath(); octx.moveTo(W * 0.76, H * 0.1); octx.lineTo(W * 0.76, H * 0.52); octx.stroke();
      octx.fillStyle = '#19C79A'; octx.beginPath(); octx.ellipse(W * 0.12, H * 0.62, 26, 50, 0, 0, 7); octx.fill();
    }
    function frame() {
      if (destroyed) return;
      const t = performance.now() / 1000;
      const lvl = Math.min(1, levelFn() * 2.2);
      open += ((lvl > 0.05 ? lvl : 0) - open) * 0.45;
      if (opts.background !== false) drawBg(t);
      if (!gl || !tex.front) {
        // 2D fallback: photo with a gentle sway
        if (imgs.front) { octx.save(); octx.translate(W / 2, H / 2 + Math.sin(t * 2) * 3); octx.rotate(Math.sin(t * 0.7) * 0.03); const s = H * 0.95; octx.globalAlpha = 1; octx.drawImage(open > 0.3 && imgs.open ? imgs.open : imgs.front, -s / 2, -s / 2, s, s); octx.restore(); }
      } else {
        // jaw: move vertices below the mouth line down as the voice gets louder
        const P = head.m.pos, L = head.live, my = 0.2 - (mk.mouthY - mk.eyeY) / (mk.eyeDist / 0.48);
        for (let i = 0; i < P.length; i += 3) {
          const x = P[i], y = P[i + 1], z = P[i + 2];
          const below = y < my ? Math.min(1, (my - y) / 0.25) : 0;
          const front = Math.max(0, z / 0.9);
          L[i + 1] = y - open * 0.11 * below * front * Math.exp(-((x / 0.45) ** 2));
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, head.bPos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, L);
        gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST); gl.useProgram(prog);
        const yaw = 0.16 * Math.sin(t * 0.45) + 0.05 * Math.sin(t * 1.3), pitch = 0.06 * Math.sin(t * 0.7) - open * 0.05, roll = 0.03 * Math.sin(t * 0.5);
        const R = mat.rot(yaw, pitch, roll);
        const MVP = mat.mul(mat.persp(0.62, W / H, 0.1, 20), mat.mul(mat.trans(0, -0.08 + 0.02 * Math.sin(t * 2), -4.1), R));
        const rot3 = [R[0], R[1], R[2], R[4], R[5], R[6], R[8], R[9], R[10]];
        const U = n => gl.getUniformLocation(prog, n);
        gl.uniformMatrix4fv(U('uMVP'), false, new Float32Array(MVP)); gl.uniformMatrix3fv(U('uRot'), false, new Float32Array(rot3));
        gl.uniform4f(U('uMark'), mk.eyeY, mk.mouthY, mk.eyeDist, mk.cx);
        gl.uniform1f(U('uOpen'), Math.min(1, open * 1.6)); gl.uniform3f(U('uHair'), hair[0], hair[1], hair[2]);
        ['tF', 'tL', 'tR', 'tO'].forEach((n, i) => gl.uniform1i(U(n), i));
        const draw = (o, isBody) => {
          gl.uniform1f(U('uBody'), isBody ? 1 : 0);
          for (const [name, b] of [['aPos', o.bPos], ['aRest', o.bRest], ['aNrm', o.bN]]) { const a = gl.getAttribLocation(prog, name); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0); }
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.bI); gl.drawElements(gl.TRIANGLES, o.n, gl.UNSIGNED_SHORT, 0);
        };
        draw(body, true); draw(head, false);
        octx.drawImage(glc, 0, 0);
      }
      // be open about it: everyone in the meeting can see this is an AI twin
      octx.fillStyle = 'rgba(30,27,58,.78)'; octx.beginPath(); octx.roundRect ? octx.roundRect(22, 18, 178, 30, 15) : octx.rect(22, 18, 178, 30); octx.fill();
      octx.fillStyle = '#fff'; octx.font = '800 15px system-ui, sans-serif'; octx.textAlign = 'left'; octx.fillText('🤖 AI-tvilling · Motey', 34, 38);
    }
    return { canvas: out, ready, frame, setLevel(f) { levelFn = f || (() => 0); }, destroy() { destroyed = true; }, webgl: !!gl };
  }

  window.Avatar = { renderScan, createHead, hasFace, load, POSES };
})();
