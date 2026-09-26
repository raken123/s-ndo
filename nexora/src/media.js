/* Nexora media: turns what the AI models return into files and sound.
 * The AI decides the content – the mesh, the melody, the sound design – and
 * this file only checks it and renders it: .glb/.obj for 3D models, WAV for
 * music and sound effects. */
(function () {
  'use strict';

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);
  function hex(c) {
    let s = String(c || '').trim().replace('#', '').toLowerCase();
    if (s.length === 3) s = s.split('').map(x => x + x).join('');
    return /^[0-9a-f]{6}$/.test(s) ? '#' + s : '#9aa4ff';
  }

  // ---------- 3D: validate the model JSON from Nexora 3D 1.5 ----------
  function cleanMesh(m) {
    if (!m || !Array.isArray(m.vertices) || !Array.isArray(m.faces)) throw new Error('Ogiltig 3D-modell i svaret.');
    const vertices = m.vertices.filter(v => Array.isArray(v) && v.length >= 3).map(v => [num(+v[0], 0), num(+v[1], 0), num(+v[2], 0)]);
    const faces = [], colors = [];
    m.faces.forEach((f, i) => {
      if (!Array.isArray(f) || f.length < 3 || f.some(k => !Number.isInteger(k) || k < 0 || k >= vertices.length)) return;
      faces.push(f); colors.push(hex(m.colors && m.colors[i]));
    });
    if (!faces.length) throw new Error('3D-modellen saknar giltiga ytor. Försök igen.');
    return { name: String(m.name || 'Modell').slice(0, 60), vertices, faces, colors };
  }

  function toGlb(m) {
    const lin = v => Math.pow(v / 255, 2.2), groups = new Map();
    m.faces.forEach((f, fi) => {
      let hex = ((m.colors && m.colors[fi]) || '#9aa4ff').replace('#', '').toLowerCase();
      if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
      if (!/^[0-9a-f]{6}$/.test(hex)) hex = '9aa4ff';
      if (!groups.has(hex)) groups.set(hex, { P: [], N: [] });
      const g = groups.get(hex), v = f.map(i => m.vertices[i]).filter(Boolean);
      for (let k = 1; k + 1 < v.length; k++) {
        const a = v[0], b = v[k], c = v[k + 1];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        const l = Math.hypot(nn[0], nn[1], nn[2]) || 1; nn = nn.map(x => x / l);
        [a, b, c].forEach(p => { g.P.push(p[0], p[1], p[2]); g.N.push(nn[0], nn[1], nn[2]); });
      }
    });
    const json = { asset: { version: '2.0', generator: 'Nexora 3D 1.5' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: m.name || 'Nexora' }],
      meshes: [{ name: m.name || 'Nexora', primitives: [] }], materials: [], buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [] };
    const chunks = [];
    let off = 0;
    for (const [hex, g] of groups) {
      if (!g.P.length) continue;
      const n = parseInt(hex, 16), pos = new Float32Array(g.P), nor = new Float32Array(g.N), count = g.P.length / 3;
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pos[i * 3 + k]); max[k] = Math.max(max[k], pos[i * 3 + k]); }
      const mat = json.materials.length;
      json.materials.push({ name: '#' + hex, pbrMetallicRoughness: { baseColorFactor: [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255), 1], metallicFactor: 0, roughnessFactor: 0.75 }, doubleSided: true });
      for (const arr of [pos, nor]) {
        json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: arr.byteLength, target: 34962 });
        chunks.push(new Uint8Array(arr.buffer)); off += arr.byteLength;
      }
      const a0 = json.accessors.length;
      json.accessors.push({ bufferView: a0, componentType: 5126, count, type: 'VEC3', min, max }, { bufferView: a0 + 1, componentType: 5126, count, type: 'VEC3' });
      json.meshes[0].primitives.push({ attributes: { POSITION: a0, NORMAL: a0 + 1 }, material: mat, mode: 4 });
    }
    json.buffers[0].byteLength = off;
    const js = new TextEncoder().encode(JSON.stringify(json)), jpad = (4 - js.length % 4) % 4;
    const total = 12 + 8 + js.length + jpad + 8 + off, out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, js.length + jpad, true); dv.setUint32(16, 0x4e4f534a, true);
    out.set(js, 20); for (let i = 0; i < jpad; i++) out[20 + js.length + i] = 0x20;
    const b0 = 20 + js.length + jpad;
    dv.setUint32(b0, off, true); dv.setUint32(b0 + 4, 0x004e4942, true);
    let o = b0 + 8; for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  function toObj(m) {
    let s = '# Nexora 3D 1.5 – ' + (m.name || 'modell') + '\n';
    m.vertices.forEach(v => { s += 'v ' + v.join(' ') + '\n'; });
    m.faces.forEach(f => { s += 'f ' + f.map(i => i + 1).join(' ') + '\n'; });
    return s;
  }
  function wav(buffer) {
    const ch = buffer.numberOfChannels, sr = buffer.sampleRate, n = buffer.length;
    const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
    out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Blob([out], { type: 'audio/wav' });
  }

  // ---------- music: plays the score the AI composed ----------
  // score = { title, bpm, bars, tracks: [{ wave, volume, notes: [[beat, midi, beats, velocity?]] }], drums: [[beat, 'kick'|'snare'|'hat']] }
  const WAVES = ['sine', 'square', 'triangle', 'sawtooth'];
  const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);
  function note(ctx, dest, f, t, dur, type, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(0.03, dur));
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(ctx, dest, t, kind, vol) {
    if (kind === 'kick') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.9 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.32); return; }
    const len = kind === 'snare' ? 0.18 : 0.05, b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(), g = ctx.createGain(), hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = kind === 'snare' ? 1200 : 7000; g.gain.value = (kind === 'snare' ? 0.35 : 0.15) * vol;
    s.buffer = b; s.connect(hp); hp.connect(g); g.connect(dest); s.start(t);
  }
  async function renderMusic(score, minSeconds) {
    if (!score || !Array.isArray(score.tracks)) throw new Error('Ogiltigt musikstycke i svaret.');
    const bpm = clamp(num(score.bpm, 120), 50, 220), beat = 60 / bpm;
    let beats = clamp(Math.round(num(score.bars, 8)) * 4, 4, 256);
    score.tracks.forEach(t => (t.notes || []).forEach(n => { beats = Math.max(beats, Math.ceil(num(n[0], 0) + num(n[2], 0))); }));
    beats = Math.min(beats, 256);
    const loop = beats * beat, reps = Math.max(1, Math.ceil((minSeconds || 0) / loop)), len = Math.min(90, loop * reps);
    const sr = 44100, ctx = new OfflineAudioContext(2, Math.ceil(sr * len), sr);
    const master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    for (let r = 0; r < reps; r++) {
      const t0 = r * loop;
      for (const t of score.tracks.slice(0, 8)) {
        const wave = WAVES.includes(t.wave) ? t.wave : 'triangle', vol = clamp(num(t.volume, 0.5), 0, 1) * 0.25;
        for (const n of (t.notes || []).slice(0, 2000)) {
          if (!Array.isArray(n)) continue;
          const at = t0 + num(n[0], 0) * beat, pitch = clamp(num(n[1], 60), 20, 110);
          if (at >= len) continue;
          note(ctx, master, midiHz(pitch), at, clamp(num(n[2], 0.5), 0.05, 16) * beat, wave, vol * clamp(num(n[3], 1), 0, 1));
        }
      }
      for (const d of (score.drums || []).slice(0, 2000)) {
        if (!Array.isArray(d) || !['kick', 'snare', 'hat'].includes(d[1])) continue;
        const at = t0 + num(d[0], 0) * beat;
        if (at < len) drum(ctx, master, at, d[1], clamp(num(d[2], 1), 0, 1));
      }
    }
    return { blob: wav(await ctx.startRendering()), bpm, seconds: Math.round(len), title: String(score.title || '') };
  }

  // ---------- sound effects: renders the sound design the AI wrote ----------
  // spec = { name, layers: [{ wave: sine|square|triangle|sawtooth|noise, start, duration, freq: [from, to] | steps: [hz...],
  //          volume, attack, filter: { type, freq: [from, to] } }] }
  async function renderSfx(spec) {
    if (!spec || !Array.isArray(spec.layers) || !spec.layers.length) throw new Error('Ogiltig ljudeffekt i svaret.');
    const layers = spec.layers.slice(0, 8);
    const len = clamp(Math.max.apply(null, layers.map(l => num(l.start, 0) + num(l.duration, 0.3))) + 0.05, 0.05, 3);
    const sr = 44100, ctx = new OfflineAudioContext(1, Math.ceil(sr * len), sr);
    const out = ctx.createGain(); out.gain.value = 0.8; out.connect(ctx.destination);
    for (const l of layers) {
      const t = clamp(num(l.start, 0), 0, 2.9), dur = clamp(num(l.duration, 0.3), 0.02, 3 - t), vol = clamp(num(l.volume, 0.6), 0, 1);
      const env = ctx.createGain(), att = clamp(num(l.attack, 0.005), 0.001, dur / 2);
      env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vol, t + att); env.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      let node = env;
      if (l.filter && ['lowpass', 'highpass', 'bandpass'].includes(l.filter.type)) {
        const f = ctx.createBiquadFilter(), fr = Array.isArray(l.filter.freq) ? l.filter.freq : [l.filter.freq, l.filter.freq];
        f.type = l.filter.type; f.frequency.setValueAtTime(clamp(num(fr[0], 2000), 30, 18000), t); f.frequency.exponentialRampToValueAtTime(clamp(num(fr[1], fr[0] || 2000), 30, 18000), t + dur);
        env.connect(f); node = f;
      }
      node.connect(out);
      if (l.wave === 'noise') {
        const b = ctx.createBuffer(1, Math.ceil(sr * dur), sr), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const s = ctx.createBufferSource(); s.buffer = b; s.connect(env); s.start(t);
        continue;
      }
      const o = ctx.createOscillator();
      o.type = WAVES.includes(l.wave) ? l.wave : 'square';
      if (Array.isArray(l.steps) && l.steps.length) {
        const st = dur / l.steps.length;
        l.steps.slice(0, 32).forEach((hz, i) => o.frequency.setValueAtTime(clamp(num(hz, 440), 20, 16000), t + i * st));
      } else {
        const fr = Array.isArray(l.freq) ? l.freq : [l.freq, l.freq];
        o.frequency.setValueAtTime(clamp(num(fr[0], 440), 20, 16000), t);
        o.frequency.exponentialRampToValueAtTime(clamp(num(fr[1], fr[0] || 440), 20, 16000), t + dur);
      }
      o.connect(env); o.start(t); o.stop(t + dur + 0.02);
    }
    return wav(await ctx.startRendering());
  }

  window.NexoraMedia = { cleanMesh, toGlb, toObj, wav, renderMusic, renderSfx };
})();
