/* ================= Växtdetektor — applogik ================= */

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('vaxt:' + k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem('vaxt:' + k, JSON.stringify(v)); }
};
let scans = store.get('scans', []);
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toLocaleDateString('sv-SE');

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ================= Navigering ================= */
function go(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'history') renderHistory();
  if (view === 'library') renderLibrary();
  if (view === 'guide') renderGuide();
}
document.querySelectorAll('#tabbar button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));

/* ================= Bildval: kamera & galleri ================= */
const fileInput = document.getElementById('fileInput');
const cameraInput = document.getElementById('cameraInput');
document.getElementById('galleryBtn').addEventListener('click', () => fileInput.click());
document.getElementById('cameraBtn').addEventListener('click', () => {
  // Cordova-kameran om pluginet finns, annars <input capture>
  if (navigator.camera && window.Camera) {
    navigator.camera.getPicture(
      uri => loadImage(uri),
      () => {},
      { quality: 80, destinationType: Camera.DestinationType.FILE_URI,
        sourceType: Camera.PictureSourceType.CAMERA, correctOrientation: true }
    );
  } else {
    cameraInput.click();
  }
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadImage(URL.createObjectURL(fileInput.files[0])); fileInput.value = ''; });
cameraInput.addEventListener('change', () => { if (cameraInput.files[0]) loadImage(URL.createObjectURL(cameraInput.files[0])); cameraInput.value = ''; });

function loadImage(src) {
  const img = document.getElementById('previewImg');
  document.getElementById('previewCard').hidden = false;
  document.getElementById('resultCard').hidden = true;
  document.getElementById('scanOverlay').hidden = false;
  img.onload = () => setTimeout(() => runAnalysis(img), 500);
  img.onerror = () => { document.getElementById('scanOverlay').hidden = true; toast('Kunde inte läsa bilden. Prova en annan.'); };
  img.src = src;
}

/* ================= Analys & resultat ================= */
function runAnalysis(img) {
  let res;
  try { res = analyzeImage(img); }
  catch { document.getElementById('scanOverlay').hidden = true; toast('Analysen misslyckades. Prova en annan bild.'); return; }
  document.getElementById('scanOverlay').hidden = true;
  renderResult(res);
  saveScan(res);
}

function healthColor(h) { return h >= 70 ? 'var(--brand)' : h >= 40 ? '#d97706' : 'var(--danger)'; }
function healthLabel(h) { return h >= 85 ? 'Utmärkt' : h >= 70 ? 'Bra' : h >= 40 ? 'Behöver omsorg' : 'Kritiskt'; }

function renderResult(res) {
  const el = document.getElementById('resultCard');
  el.hidden = false;

  if (!res.isPlant) {
    el.innerHTML = `
      <div class="verdict">
        <div class="v-emoji">🤔</div>
        <div>
          <h3>Hittar ingen växt i bilden</h3>
          <p>Andelen grönska är för låg (växt-sannolikhet ${Math.round(res.plantScore * 100)} %). Prova en närbild av bladen i bra ljus.</p>
        </div>
      </div>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  el.innerHTML = `
    <div class="verdict">
      <div class="v-emoji">${res.health >= 70 ? '🌿' : res.health >= 40 ? '🥀' : '🍂'}</div>
      <div>
        <h3>Växt identifierad! (${Math.round(res.plantScore * 100)} % säkerhet)</h3>
        <p>Analys av färg och bladverk klar — se hälsostatus nedan.</p>
      </div>
    </div>
    <div class="health-wrap">
      <div class="health-head">
        <span>Hälsopoäng — ${healthLabel(res.health)}</span>
        <span class="health-num">${res.health}<small style="font-size:14px;color:var(--muted)">/100</small></span>
      </div>
      <div class="health-bar"><div style="width:${res.health}%;background:${healthColor(res.health)}"></div></div>
    </div>
    <div class="tag-row">${res.tags.map(t => `<span class="p-tag ${t.cls}">${esc(t.t)}</span>`).join('')}</div>
    <div class="result-section">Diagnos & råd</div>
    ${res.diagnoses.map(d => `
      <div class="diagnosis">
        <div class="d-ico">${d.ico}</div>
        <div><b>${esc(d.title)}</b><p>${esc(d.text)}</p></div>
      </div>`).join('')}
    <div class="btn-row" style="justify-content:flex-start">
      <button class="btn small ghost" onclick="go('guide')">🔬 Öppna sjukdomsguiden</button>
    </div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ================= Historik ================= */
function saveScan(res) {
  scans.unshift({
    id: uid(), date: today(), thumb: res.thumb, isPlant: res.isPlant,
    health: res.health, plantScore: Math.round(res.plantScore * 100),
    issues: res.diagnoses.map(d => d.title)
  });
  scans = scans.slice(0, 30);
  store.set('scans', scans);
}
function renderHistory() {
  const el = document.getElementById('historyList');
  if (!scans.length) { el.innerHTML = '<div class="empty">Inga analyser ännu — börja med att fota en växt! 🌱</div>'; return; }
  el.innerHTML = scans.map(s => `
    <div class="scan-row">
      <img src="${s.thumb}" alt="Analyserad bild">
      <div class="scan-meta">
        <div class="name">${s.isPlant ? `Hälsa ${s.health}/100 — ${healthLabel(s.health)}` : 'Ingen växt hittad'}</div>
        <div class="sub">${s.date} · ${s.isPlant ? esc(s.issues.join(' · ')) : `växt-sannolikhet ${s.plantScore} %`}</div>
      </div>
      <button class="btn small danger" onclick="delScan('${s.id}')">✕</button>
    </div>`).join('');
}
function delScan(id) {
  scans = scans.filter(s => s.id !== id);
  store.set('scans', scans); renderHistory();
}

/* ================= Bibliotek ================= */
function renderLibrary() {
  const q = document.getElementById('plantSearch').value.trim().toLowerCase();
  const list = PLANTS.filter(p => !q || p.name.toLowerCase().includes(q) || p.latin.toLowerCase().includes(q));
  document.getElementById('libraryList').innerHTML = list.length ? list.map(p => `
    <div class="card plant-card">
      <div class="p-emoji">${p.emoji}</div>
      <div>
        <h4>${esc(p.name)}</h4>
        <div class="latin">${esc(p.latin)}</div>
        <dl>
          <dt>☀️ Ljus</dt><dd>${esc(p.light)}</dd>
          <dt>💧 Vatten</dt><dd>${esc(p.water)}</dd>
          <dt>🎯 Nivå</dt><dd>${esc(p.difficulty)}</dd>
        </dl>
        <div class="problems">⚠️ ${esc(p.problems)}</div>
      </div>
    </div>`).join('') : '<div class="empty">Ingen växt matchade sökningen.</div>';
}
document.getElementById('plantSearch').addEventListener('input', renderLibrary);

/* ================= Sjukdomsguide ================= */
function renderGuide() {
  document.getElementById('guideList').innerHTML = DISEASES.map(d => `
    <details class="guide-item">
      <summary><span>${d.emoji}</span>${esc(d.name)}</summary>
      <div class="g-body">
        <b>Symptom:</b> ${esc(d.symptom)}<br>
        <b>Orsak:</b> ${esc(d.cause)}<br>
        <b>Åtgärd:</b> ${esc(d.action)}
      </div>
    </details>`).join('');
}

/* ================= Init ================= */
document.addEventListener('deviceready', () => {}, false);
renderLibrary(); renderGuide();
