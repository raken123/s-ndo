/* Raken AI — Settings view */
(function () {
  const R = window.Raken; const S = R.settings; const $ = R.$;
  const FIELDS = { "set-name": "name", "set-anthropic-key": "anthropicKey", "set-gateway": "gateway", "set-model": "model", "set-effort": "effort", "set-thinking": "showThinking", "set-tts": "tts", "set-fal-key": "falKey", "set-openai-base": "openaiBase", "set-openai-key": "openaiKey", "set-openai-model": "openaiImageModel", "set-theme": "theme" };

  document.addEventListener("DOMContentLoaded", () => {
    fillModels(); load();
    for (const id in FIELDS) {
      const el = $("#" + id);
      el.addEventListener("change", () => { const v = el.type === "checkbox" ? el.checked : el.value.trim(); R.saveSettings({ [FIELDS[id]]: v }); if (id === "set-theme") R.applyTheme(); });
    }
    $("#set-test").onclick = async () => {
      const st = $("#set-test-status"); st.textContent = "Testing…";
      try { const t = await R.ai.test(); st.textContent = "✅ Connected — model replied: " + t.slice(0, 40); } catch (e) { st.textContent = "❌ " + e.message; }
    };
    $("#data-export").onclick = exportData;
    $("#data-import").onclick = () => $("#data-import-input").click();
    $("#data-import-input").onchange = (e) => importData(e.target.files[0]);
    $("#data-clear").onclick = async () => {
      if (!confirm("Delete all chats, media, documents, projects and settings on this device?")) return;
      for (const s of ["chats", "media", "docs", "projects"]) await R.db.clear(s);
      localStorage.removeItem("raken.settings"); localStorage.removeItem("raken.usage"); location.reload();
    };
    $("#about").innerHTML = "Raken AI " + R.version + " · " + R.platformLabel + " · " + '<a href="https://github.com/raken123/s-ndo/tree/main/raken-ai" target="_blank" rel="noopener">Source & downloads</a>';
    document.addEventListener("raken:settings", () => { fillModels(); load(); });
  });
  function fillModels() {
    const sel = $("#set-model");
    sel.innerHTML = R.config.models.map((m) => '<option value="' + m.id + '"' + (m.pro && !R.isPro() ? " disabled" : "") + ">" + R.esc(m.name) + (m.pro && !R.isPro() ? " · Pro" : "") + "</option>").join("");
    sel.value = S.model; if (!sel.value) sel.value = R.config.defaultModel;
    R.$$("#set-effort option").forEach((o) => { if (o.value === "xhigh" || o.value === "max") o.disabled = !R.isPro(); });
  }
  function load() { for (const id in FIELDS) { const el = $("#" + id); if (el.type === "checkbox") el.checked = !!S[FIELDS[id]]; else el.value = S[FIELDS[id]] == null ? "" : S[FIELDS[id]]; } }

  async function exportData() {
    const out = { version: R.version, exported: new Date().toISOString(), settings: Object.assign({}, S, { anthropicKey: "", falKey: "", openaiKey: "" }), chats: await R.db.all("chats"), docs: await R.db.all("docs"), projects: await R.db.all("projects") };
    const media = await R.db.all("media"); out.media = [];
    for (const m of media) out.media.push(Object.assign({}, m, { blob: undefined, data: await R.fileToDataURL(m.blob) }));
    R.download("raken-ai-export.json", new Blob([JSON.stringify(out)], { type: "application/json" }));
  }
  async function importData(file) {
    if (!file) return;
    try {
      const j = JSON.parse(await R.fileToText(file));
      for (const c of j.chats || []) await R.db.put("chats", c);
      for (const d of j.docs || []) await R.db.put("docs", d);
      for (const p of j.projects || []) await R.db.put("projects", p);
      for (const m of j.media || []) { const [meta, b64] = m.data.split(","); const mime = /data:([^;]+)/.exec(meta)[1]; await R.db.put("media", Object.assign({}, m, { data: undefined, blob: R.b64ToBlob(b64, mime) })); }
      R.toast("Imported. Reloading…", "ok"); setTimeout(() => location.reload(), 800);
    } catch (e) { R.toast("Import failed: " + e.message, "err"); }
  }
})();
