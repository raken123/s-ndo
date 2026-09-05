/* Raken AI — Images, Videos and Gallery */
(function () {
  const R = window.Raken; const S = R.settings; const $ = R.$;
  const media = R.media = {};
  const urls = new Map(); // id -> object URL
  media.url = (item) => { if (!urls.has(item.id)) urls.set(item.id, URL.createObjectURL(item.blob)); return urls.get(item.id); };

  document.addEventListener("DOMContentLoaded", () => {
    // Images
    $("#img-provider").value = S.imageProvider || "pollinations";
    $("#img-provider").onchange = () => R.saveSettings({ imageProvider: $("#img-provider").value });
    R.$$("#img-styles .chip").forEach((c) => c.onclick = () => c.classList.toggle("on"));
    $("#img-generate").onclick = generateImages;
    $("#img-prompt").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generateImages(); });
    // Videos
    $("#vid-model").value = S.videoModel || "fal-ai/ltx-video";
    $("#vid-model").onchange = () => R.saveSettings({ videoModel: $("#vid-model").value });
    $("#vid-generate").onclick = generateVideo;
    document.addEventListener("raken:go", (e) => { if (e.detail === "gallery") renderGallery(); if (e.detail === "videos") fillStartImages(); });
    document.addEventListener("raken:settings", () => { $("#vid-note").hidden = !!S.falKey; });
    $("#vid-note").hidden = !!S.falKey;
  });

  // ---------- providers ----------
  async function fetchBlob(url, headers) {
    const r = await R.net.request(url, { responseType: "blob", headers: headers || {} });
    if (!r.ok) throw new Error("Download failed (" + r.status + ")");
    return r.blob;
  }
  const providers = {
    async pollinations(prompt, w, h, seed) {
      const url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=" + w + "&height=" + h + "&seed=" + seed + "&nologo=true&model=flux";
      const blob = await fetchBlob(url);
      if (!/^image\//.test(blob.type)) throw new Error("Pollinations did not return an image");
      return blob;
    },
    async fal(prompt, w, h, seed) {
      if (!S.falKey) throw new Error("Add a fal.ai key in Settings");
      const r = await R.net.request("https://fal.run/fal-ai/flux/schnell", { method: "POST", responseType: "json", headers: { "content-type": "application/json", authorization: "Key " + S.falKey }, body: JSON.stringify({ prompt, image_size: { width: w, height: h }, num_images: 1, seed, enable_safety_checker: true }) });
      if (!r.ok) throw new Error(falError(r));
      const img = r.json && r.json.images && r.json.images[0]; if (!img) throw new Error("fal returned no image");
      return fetchBlob(img.url);
    },
    async openai(prompt, w, h) {
      if (!S.openaiKey) throw new Error("Add an OpenAI-compatible key in Settings");
      const model = S.openaiImageModel || "gpt-image-1";
      const size = /gpt-image/.test(model) ? (w > h ? "1536x1024" : w < h ? "1024x1536" : "1024x1024") : (w > h ? "1792x1024" : w < h ? "1024x1792" : "1024x1024");
      const body = { model, prompt, n: 1, size }; if (/dall-e/.test(model)) body.response_format = "b64_json";
      const r = await R.net.request((S.openaiBase || "https://api.openai.com").replace(/\/+$/, "") + "/v1/images/generations", { method: "POST", responseType: "json", headers: { "content-type": "application/json", authorization: "Bearer " + S.openaiKey }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((r.json && r.json.error && r.json.error.message) || "Image request failed (" + r.status + ")");
      const d = r.json.data && r.json.data[0]; if (!d) throw new Error("No image returned");
      if (d.b64_json) return R.b64ToBlob(d.b64_json, "image/png");
      return fetchBlob(d.url);
    }
  };
  function falError(r) { try { const j = r.json || JSON.parse(r.text); if (j.detail) return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail); } catch (e) { } return "fal.ai request failed (" + r.status + ")"; }

  // ---------- images ----------
  async function generateImages() {
    let prompt = $("#img-prompt").value.trim(); if (!prompt) { $("#img-prompt").focus(); return; }
    const styles = R.$$("#img-styles .chip.on").map((c) => c.dataset.style); if (styles.length) prompt += ", " + styles.join(", ");
    const [w, h] = $("#img-aspect").value.split("x").map(Number); const count = +$("#img-count").value; const provider = $("#img-provider").value;
    if (!R.isPro() && R.usage.remaining("image") < count) { R.toast("Not enough free image credits left today (" + R.usage.remaining("image") + "). Upgrade to Pro.", "err"); R.go("pro"); return; }
    const results = $("#img-results"); if (results.querySelector(".empty-mini")) results.innerHTML = "";
    const btn = $("#img-generate"); btn.disabled = true; $("#img-status").textContent = "Generating…";
    const jobs = [];
    for (let i = 0; i < count; i++) {
      const card = document.createElement("div"); card.className = "media-card loading"; card.innerHTML = '<div class="thumb"><div class="spinner"></div></div><div class="meta"><span>' + R.esc(prompt) + "</span></div>";
      results.prepend(card);
      const seed = Math.floor(Math.random() * 1e9);
      jobs.push((async () => {
        try {
          const blob = await providers[provider](prompt, w, h, seed);
          const item = { id: R.uid(), kind: "image", blob, prompt, provider, w, h, created: Date.now() };
          await R.db.put("media", item); R.usage.bump("image");
          card.replaceWith(mediaCard(item));
        } catch (e) { card.className = "media-card"; card.innerHTML = '<div class="thumb" style="aspect-ratio:2"></div><div class="meta"><span style="color:#fca5a5">' + R.esc(e.message || e) + "</span></div>"; R.toast(e.message || "Image failed", "err"); }
      })());
    }
    await Promise.all(jobs); btn.disabled = false; $("#img-status").textContent = "";
  }

  function mediaCard(item, inGallery) {
    const card = document.createElement("div"); card.className = "media-card"; const url = media.url(item);
    card.innerHTML = (item.kind === "video" ? '<video class="thumb" src="' + url + '" controls loop playsinline></video>' : '<img class="thumb" src="' + url + '" alt="">') +
      '<div class="meta"><span title="' + R.esc(item.prompt) + '">' + R.esc(item.prompt) + "</span>" +
      '<button data-a="dl" title="Download">⬇</button>' + (item.kind === "image" ? '<button data-a="chat" title="Ask about this image">💬</button><button data-a="anim" title="Animate">🎬</button>' : "") + '<button data-a="del" title="Delete">🗑</button></div>';
    if (item.kind === "image") card.querySelector(".thumb").onclick = () => lightbox('<img src="' + url + '">');
    card.querySelectorAll("[data-a]").forEach((b) => b.onclick = async () => {
      const a = b.dataset.a;
      if (a === "dl") R.download("raken-" + item.id + (item.kind === "video" ? ".mp4" : ".png"), item.blob);
      else if (a === "chat") R.chat.attachImage(item.blob, "raken-" + item.id + ".png");
      else if (a === "anim") { R.go("videos"); await fillStartImages(); $("#vid-image").value = item.id; $("#vid-prompt").value = item.prompt; }
      else if (a === "del") { await R.db.del("media", item.id); card.remove(); }
    });
    return card;
  }
  function lightbox(html) { const lb = $("#lightbox"); $("#lightbox-inner").innerHTML = html; lb.hidden = false; lb.onclick = () => { lb.hidden = true; $("#lightbox-inner").innerHTML = ""; }; }

  // ---------- gallery ----------
  async function renderGallery() {
    const items = await R.db.all("media"); const g = $("#gallery"); g.innerHTML = "";
    if (!items.length) { g.innerHTML = '<div class="empty-mini">Nothing here yet. Make an image or a video.</div>'; return; }
    items.forEach((it) => g.appendChild(mediaCard(it, true)));
  }
  media.renderGallery = renderGallery;

  // ---------- videos ----------
  async function fillStartImages() {
    const items = (await R.db.all("media")).filter((x) => x.kind === "image"); const sel = $("#vid-image"); const cur = sel.value;
    sel.innerHTML = '<option value="">None (text to video)</option>' + items.map((x) => '<option value="' + x.id + '">' + R.esc(x.prompt.slice(0, 60)) + "</option>").join("");
    sel.value = cur; if (!sel.value) sel.value = "";
  }
  const I2V = { "fal-ai/ltx-video": "fal-ai/ltx-video/image-to-video", "fal-ai/minimax/video-01": "fal-ai/minimax/video-01/image-to-video", "fal-ai/kling-video/v2.1/standard/text-to-video": "fal-ai/kling-video/v2.1/standard/image-to-video", "fal-ai/veo3": "fal-ai/veo3/image-to-video" };
  async function generateVideo() {
    const prompt = $("#vid-prompt").value.trim(); if (!prompt) { $("#vid-prompt").focus(); return; }
    if (!S.falKey) { R.toast("Video needs a fal.ai key — add one in Settings", "err"); R.go("settings"); return; }
    if (!R.usage.check("video")) return;
    let model = $("#vid-model").value; const aspect = $("#vid-aspect").value; const startId = $("#vid-image").value;
    const body = { prompt };
    if (/kling|veo/.test(model)) body.aspect_ratio = aspect;
    if (startId) { const img = await R.db.get("media", startId); if (img) { model = I2V[model] || model; body.image_url = await R.fileToDataURL(img.blob); } }
    const results = $("#vid-results"); if (results.querySelector(".empty-mini")) results.innerHTML = "";
    const card = document.createElement("div"); card.className = "media-card loading"; card.innerHTML = '<div class="thumb" style="aspect-ratio:16/9"><div class="spinner"></div></div><div class="meta"><span>' + R.esc(prompt) + "</span></div>";
    results.prepend(card); const btn = $("#vid-generate"); btn.disabled = true; const status = $("#vid-status");
    const H = { "content-type": "application/json", authorization: "Key " + S.falKey };
    try {
      status.textContent = "Submitting…";
      const sub = await R.net.request("https://queue.fal.run/" + model, { method: "POST", responseType: "json", headers: H, body: JSON.stringify(body) });
      if (!sub.ok) throw new Error(falError(sub));
      const statusUrl = sub.json.status_url; const responseUrl = sub.json.response_url; const t0 = Date.now();
      while (true) {
        await R.sleep(4000);
        const st = await R.net.request(statusUrl, { responseType: "json", headers: H });
        const s = st.json && st.json.status;
        status.textContent = (s === "IN_QUEUE" ? "Queued" : "Rendering") + " · " + Math.round((Date.now() - t0) / 1000) + "s";
        if (s === "COMPLETED") break;
        if (st.status >= 400) throw new Error(falError(st));
        if (Date.now() - t0 > 15 * 60 * 1000) throw new Error("Timed out waiting for the video");
      }
      const out = await R.net.request(responseUrl, { responseType: "json", headers: H });
      if (!out.ok) throw new Error(falError(out));
      const v = out.json.video || (out.json.videos && out.json.videos[0]); if (!v || !v.url) throw new Error("No video in response");
      status.textContent = "Downloading…";
      const blob = await fetchBlob(v.url);
      const item = { id: R.uid(), kind: "video", blob: blob.type ? blob : new Blob([blob], { type: "video/mp4" }), prompt, provider: model, created: Date.now() };
      await R.db.put("media", item); R.usage.bump("video");
      card.replaceWith(mediaCard(item)); status.textContent = "";
    } catch (e) {
      card.className = "media-card"; card.innerHTML = '<div class="meta"><span style="color:#fca5a5">' + R.esc(e.message || e) + "</span></div>"; status.textContent = ""; R.toast(e.message || "Video failed", "err");
    } finally { btn.disabled = false; }
  }
})();
