/** Dashcam med rullande minne.
 *  Kameran spelar in hela tiden men behåller bara den senaste minuten — tills
 *  något händer. Då sparas klippet, antingen automatiskt vid en kraftig
 *  inbromsning eller när du trycker på knappen. */
import { el, icon, toast, fmtDateTime, downloadFile, confirmBig, buzz, setKids } from '../core/ui.js';
import { on, emit } from '../core/bus.js';
import { state, push, remove, uid } from '../core/store.js';
import { sensors, here } from '../core/sensors.js';
import { say } from '../core/speech.js';

const BUFFER_SECONDS = 60;
const CHUNK_MS = 1000;
const IMPACT_G = 2.6;             // ca 25 m/s² utöver tyngdkraften

const cam = {
  stream: null,
  recorder: null,
  header: null,                   // första biten bär webm-huvudet
  chunks: [],                     // { blob, at }
  running: false,
  startedAt: 0,
  mime: '',
  lastAutoSave: 0,
};

/* ---------- Klipplagring (IndexedDB — blobbar får inte plats i localStorage) ---------- */
const DB_NAME = 'reeos-clips';
let dbPromise = null;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('clips');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function putClip(id, blob) {
  const store = (await db()).transaction('clips', 'readwrite').objectStore('clips');
  return new Promise((resolve, reject) => {
    const request = store.put(blob, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getClip(id) {
  const store = (await db()).transaction('clips', 'readonly').objectStore('clips');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteClip(id) {
  const store = (await db()).transaction('clips', 'readwrite').objectStore('clips');
  store.delete(id);
}

/* ---------- Inspelning ---------- */
function pickMime() {
  const candidates = [
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus',
    'video/webm', 'video/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? '';
}

export async function startCam({ audio = false } = {}) {
  if (cam.running) return cam.stream;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kameran är inte tillgänglig här.');
  if (!window.MediaRecorder) throw new Error('Den här webbläsaren kan inte spela in video.');

  cam.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    audio,
  });

  cam.mime = pickMime();
  cam.recorder = new MediaRecorder(cam.stream, cam.mime ? { mimeType: cam.mime, videoBitsPerSecond: 2_500_000 } : undefined);
  cam.header = null;
  cam.chunks = [];

  cam.recorder.ondataavailable = (event) => {
    if (!event.data?.size) return;
    // Första biten innehåller strömhuvudet och måste följa med varje sparat klipp.
    if (!cam.header) { cam.header = event.data; return; }
    cam.chunks.push({ blob: event.data, at: Date.now() });
    while (cam.chunks.length > BUFFER_SECONDS) cam.chunks.shift();
  };

  cam.recorder.start(CHUNK_MS);
  cam.running = true;
  cam.startedAt = Date.now();
  emit('dashcam:state', true);
  return cam.stream;
}

export function stopCam() {
  try { cam.recorder?.stop(); } catch { /* redan stoppad */ }
  cam.stream?.getTracks().forEach((track) => track.stop());
  cam.stream = null;
  cam.recorder = null;
  cam.header = null;
  cam.chunks = [];
  cam.running = false;
  emit('dashcam:state', false);
}

export const camRunning = () => cam.running;

/** Fryser bufferten till ett klipp. */
export async function saveEvent(reason = 'manuell') {
  if (!cam.running || !cam.header || !cam.chunks.length) {
    toast('Inget i bufferten att spara ännu.', 'warn');
    return null;
  }
  const parts = [cam.header, ...cam.chunks.map((c) => c.blob)];
  const blob = new Blob(parts, { type: cam.mime || 'video/webm' });
  const id = uid();
  const pos = here();

  try { await putClip(id, blob); }
  catch { toast('Kunde inte spara klippet — minnet är fullt.', 'err'); return null; }

  const meta = {
    id, at: Date.now(), reason,
    seconds: cam.chunks.length,
    size: blob.size,
    speedKmh: Math.round(sensors.speedKmh),
    lat: pos?.lat ?? null, lon: pos?.lon ?? null,
    ext: (cam.mime || 'video/webm').includes('mp4') ? 'mp4' : 'webm',
  };
  push('clips', meta);
  buzz([40, 60, 40]);
  toast(`Klipp sparat (${meta.seconds} s).`, 'ok');
  return meta;
}

/* ---------- Händelsedetektering ---------- */
export function initIncidentWatch() {
  let lastSpeed = 0;
  let lastAt = Date.now();

  // Kraftig retardation enligt GPS — fungerar även utan rörelsesensor.
  on('sensors:fix', () => {
    const now = Date.now();
    const dt = (now - lastAt) / 1000;
    lastAt = now;
    if (dt > 0.3 && dt < 6) {
      const decel = (lastSpeed - sensors.speed) / dt;   // m/s²
      if (decel > 6 && lastSpeed > 8) autoSave('kraftig inbromsning');
    }
    lastSpeed = sensors.speed;
  });

  if (window.DeviceMotionEvent) {
    window.addEventListener('devicemotion', (event) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null) return;
      const g = Math.hypot(acc.x ?? 0, acc.y ?? 0, acc.z ?? 0) / 9.81;
      if (g > IMPACT_G) autoSave('kraftig rörelse');
    });
  }
}

function autoSave(reason) {
  if (!cam.running) return;
  if (Date.now() - cam.lastAutoSave < 20000) return;   // en händelse, inte tio
  cam.lastAutoSave = Date.now();
  say('Händelse sparad.', { force: true });
  saveEvent(reason);
}

export const dashcamApp = {
  id: 'dashcam',
  name: 'Dashcam',
  icon: 'cam',
  flush: true,

  mount(root) {
    const video = el('video', { autoplay: true, muted: true, playsinline: true });
    const status = el('div', { class: 'cam-bar' });
    const actions = el('div', { class: 'cam-actions' });
    const stage = el('div', { class: 'cam-stage' }, video);
    const library = el('div', { class: 'screen', style: 'background:var(--r-bg);z-index:5', hidden: true });

    root.append(stage, el('div', { class: 'cam-hud' }, status, el('div'), actions), library);

    function renderStatus() {
      setKids(status, 
        cam.running ? el('span', { class: 'rec-dot' }) : null,
        el('span', { text: cam.running ? `Buffert ${cam.chunks.length}/${BUFFER_SECONDS} s` : 'Kameran är av' }),
        cam.running ? el('span', { style: 'opacity:.7', text: `· ${Math.round(sensors.speedKmh)} km/h` }) : null,
      );
    }

    function renderActions() {
      setKids(actions, 
        cam.running
          ? el('button', { class: 'btn danger', onClick: () => { stopCam(); renderAll(); } }, icon('x'), 'Stäng av')
          : el('button', {
              class: 'btn primary',
              onClick: async () => {
                try { await startCam(); video.srcObject = cam.stream; renderAll(); }
                catch (err) { toast(err.message, 'err', 5000); }
              },
            }, icon('cam'), 'Starta kameran'),
        el('button', { class: 'btn', onClick: () => saveEvent('manuell').then(renderAll) }, icon('check'), 'Spara händelse'),
        el('button', { class: 'btn', onClick: () => { renderLibrary(); library.hidden = false; } },
          icon('book'), `Klipp (${state.clips.length})`),
      );
    }

    function renderLibrary() {
      const list = el('div', { class: 'list' },
        ...[...state.clips].sort((a, b) => b.at - a.at).map((clip) => el('div', { class: 'list-item' },
          el('span', { class: 'avatar' }, icon('cam')),
          el('div', { class: 'li-main' },
            el('b', { text: `${clip.seconds} s · ${clip.reason}` }),
            el('small', { text: `${fmtDateTime(clip.at)} · ${clip.speedKmh} km/h · ${(clip.size / 1048576).toFixed(1)} MB` }),
          ),
          el('button', {
            class: 'btn small',
            onClick: async () => {
              const blob = await getClip(clip.id);
              if (!blob) { toast('Klippet saknas i minnet.', 'err'); return; }
              downloadFile(`reeos-${new Date(clip.at).toISOString().replace(/[:.]/g, '-')}.${clip.ext}`, blob);
            },
          }, icon('download')),
          el('button', {
            class: 'btn small ghost',
            onClick: async () => { await deleteClip(clip.id); remove('clips', clip.id); renderLibrary(); renderActions(); },
          }, icon('trash')),
        )),
        state.clips.length ? null : el('div', { class: 'empty' },
          el('b', { text: 'Inga sparade klipp' }),
          el('span', { class: 'hint', text: 'Bufferten skrivs över hela tiden. Bara det du sparar blir kvar.' })),
      );

      setKids(library, 
        el('div', { class: 'spread' },
          el('h3', { style: 'font-size:20px;font-weight:800', text: 'Sparade klipp' }),
          el('button', { class: 'btn small', onClick: () => { library.hidden = true; } }, icon('x'), 'Stäng'),
        ),
        el('div', { style: 'height:12px' }),
        list,
        el('div', { style: 'height:12px' }),
        state.clips.length ? el('button', {
          class: 'btn block ghost',
          onClick: async () => {
            if (!await confirmBig('Radera alla klipp?', 'Videofilerna tas bort från telefonen.', 'Radera')) return;
            for (const clip of state.clips) await deleteClip(clip.id);
            state.clips.length = 0;
            renderLibrary();
            renderActions();
          },
        }, icon('trash'), 'Radera alla') : null,
        el('p', { class: 'hint', style: 'margin-top:12px', text: 'Klippen ligger i telefonens webbläsarlagring. Ladda ner det du vill spara på riktigt — lagringen kan rensas av systemet.' }),
      );
    }

    const renderAll = () => { renderStatus(); renderActions(); };
    renderAll();
    if (cam.running) video.srcObject = cam.stream;

    const timer = setInterval(renderStatus, 1000);
    const unbind = on('dashcam:state', renderAll);
    // Kameran fortsätter medvetet i bakgrunden — poängen är att den rullar.
    return () => { clearInterval(timer); unbind(); };
  },
};
