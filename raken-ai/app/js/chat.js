/* Raken AI — Chat view */
(function () {
  const R = window.Raken; const S = R.settings; const $ = R.$;
  const chat = R.chat = { current: null, list: [], busy: false, attachments: [], web: true, abort: null };

  const els = {};
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    ["chat-list-items", "chat-new", "chat-title", "chat-model", "chat-delete", "messages", "chat-empty", "attachments", "attach-btn", "attach-input", "composer-input", "mic-btn", "send-btn", "usage-hint", "chat-toggle-list", "chat-list"].forEach((id) => els[id] = $("#" + id));
    fillModels();
    els["chat-new"].onclick = () => newChat();
    els["chat-delete"].onclick = deleteChat;
    els["send-btn"].onclick = send;
    els["composer-input"].addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    els["composer-input"].addEventListener("input", autosize);
    els["attach-btn"].onclick = () => els["attach-input"].click();
    els["attach-input"].onchange = (e) => addFiles(e.target.files);
    els["mic-btn"].onclick = mic;
    els["chat-toggle-list"].onclick = () => els["chat-list"].classList.toggle("open");
    els["chat-list-items"].onclick = () => els["chat-list"].classList.remove("open");
    els["chat-model"].onchange = () => { if (chat.current) { chat.current.model = els["chat-model"].value; save(); } };
    R.$$("#chat-empty .chip").forEach((c) => c.onclick = () => { els["composer-input"].value = c.dataset.prompt; send(); });
    els["messages"].addEventListener("dragover", (e) => { e.preventDefault(); });
    els["messages"].addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
    document.addEventListener("paste", (e) => { if (document.activeElement === els["composer-input"] && e.clipboardData.files.length) addFiles(e.clipboardData.files); });
    // web toggle
    const web = document.createElement("button"); web.className = "icon-btn"; web.id = "chat-web"; web.title = "Web search"; web.textContent = "🌐";
    els["chat-model"].before(web); web.onclick = () => { chat.web = !chat.web; web.style.opacity = chat.web ? 1 : .4; R.toast("Web search " + (chat.web ? "on" : "off")); };
    document.addEventListener("raken:settings", fillModels);
    document.addEventListener("raken:usage", usageHint);
    document.addEventListener("raken:go", (e) => { if (e.detail === "chat") usageHint(); });
    usageHint();
    load();
  }

  function fillModels() {
    const sel = els["chat-model"]; const cur = sel.value || S.model;
    sel.innerHTML = R.config.models.map((m) => '<option value="' + m.id + '"' + (m.pro && !R.isPro() ? " disabled" : "") + ">" + R.esc(m.name) + (m.pro && !R.isPro() ? " · Pro" : "") + "</option>").join("");
    sel.value = R.config.models.some((m) => m.id === cur && (!m.pro || R.isPro())) ? cur : R.config.defaultModel;
  }
  function usageHint() {
    const rem = R.usage.remaining("chat");
    els["usage-hint"].textContent = R.isPro() ? "Pro · unlimited" : rem + " free messages left today";
  }
  function autosize() { const t = els["composer-input"]; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 200) + "px"; }

  async function load() {
    chat.list = await R.db.all("chats");
    renderList();
    if (chat.list.length) open(chat.list[0].id); else newChat();
  }
  function renderList() {
    els["chat-list-items"].innerHTML = chat.list.map((c) => '<div class="chat-item' + (chat.current && c.id === chat.current.id ? " active" : "") + '" data-id="' + c.id + '">' + R.esc(c.title || "New chat") + "<small>" + R.fmtDate(c.updated || c.created) + "</small></div>").join("");
    R.$$(".chat-item", els["chat-list-items"]).forEach((el) => el.onclick = () => open(el.dataset.id));
  }
  function newChat() {
    if (chat.current && !chat.current.messages.length) { els["composer-input"].focus(); return; }
    chat.current = { id: R.uid(), title: "New chat", created: Date.now(), updated: Date.now(), model: els["chat-model"].value || S.model, messages: [] };
    chat.list.unshift(chat.current); renderList(); renderAll(); els["composer-input"].focus();
  }
  async function open(id) {
    const c = chat.list.find((x) => x.id === id); if (!c) return;
    chat.current = c; if (c.model) { els["chat-model"].value = c.model; if (!els["chat-model"].value) els["chat-model"].value = R.config.defaultModel; }
    renderList(); renderAll();
  }
  async function save() {
    const c = chat.current; if (!c) return; c.updated = Date.now();
    if (c.messages.length) await R.db.put("chats", c);
    renderList();
  }
  async function deleteChat() {
    const c = chat.current; if (!c) return;
    if (c.messages.length && !confirm("Delete this chat?")) return;
    await R.db.del("chats", c.id); chat.list = chat.list.filter((x) => x.id !== c.id); chat.current = null;
    if (chat.list.length) open(chat.list[0].id); else newChat();
  }

  // ---------- attachments ----------
  async function addFiles(files) {
    for (const f of Array.from(files || [])) {
      if (f.size > 20 * 1024 * 1024) { R.toast(f.name + " is over 20 MB", "err"); continue; }
      if (f.type.startsWith("image/")) chat.attachments.push({ kind: "image", name: f.name, mime: f.type, data: (await R.fileToDataURL(f)).split(",")[1] });
      else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) chat.attachments.push({ kind: "pdf", name: f.name, data: await R.blobToBase64(f) });
      else chat.attachments.push({ kind: "text", name: f.name, text: await R.fileToText(f) });
    }
    renderAttachments(); els["attach-input"].value = "";
  }
  function renderAttachments() {
    els["attachments"].innerHTML = chat.attachments.map((a, i) => '<div class="att">' + (a.kind === "image" ? '<img src="data:' + a.mime + ";base64," + a.data + '">' : (a.kind === "pdf" ? "📄 " : "📝 ")) + R.esc(a.name) + '<button data-i="' + i + '">✕</button></div>').join("");
    R.$$(".att button", els["attachments"]).forEach((b) => b.onclick = () => { chat.attachments.splice(+b.dataset.i, 1); renderAttachments(); });
  }

  // ---------- rendering ----------
  function renderAll() {
    const c = chat.current; els["chat-title"].textContent = c.title || "New chat";
    els["messages"].innerHTML = ""; if (!c.messages.length) { els["messages"].appendChild(els["chat-empty"]); return; }
    c.messages.forEach((m, i) => els["messages"].appendChild(bubble(m, i)));
    scroll();
  }
  function scroll() { els["messages"].scrollTop = els["messages"].scrollHeight; }
  function bubble(m, i) {
    const el = document.createElement("div"); el.className = "msg " + m.role;
    const who = m.role === "user" ? (S.name || "You") : "Raken AI";
    let body = "";
    if (m.role === "user") {
      const imgs = m.content.filter((b) => b.type === "image"); const docs = m.content.filter((b) => b.type === "document");
      if (imgs.length) body += '<div class="attach-imgs">' + imgs.map((b) => '<img src="data:' + b.source.media_type + ";base64," + b.source.data + '">').join("") + "</div>";
      docs.forEach((d) => body += '<span class="attach-file">📄 ' + R.esc(d.title || "document.pdf") + "</span>");
      (m.files || []).forEach((f) => body += '<span class="attach-file">📝 ' + R.esc(f) + "</span>");
      body += '<div class="content">' + R.esc(m.text || textOf(m.content)) + "</div>";
    } else {
      body += renderAssistant(m.content);
    }
    const actions = m.role === "assistant" ? '<div class="actions"><button data-act="copy">Copy</button><button data-act="speak">🔊</button>' + (i === chat.current.messages.length - 1 ? '<button data-act="regen">Regenerate</button>' : "") + "</div>" : '<div class="actions"><button data-act="copy">Copy</button></div>';
    el.innerHTML = '<div class="avatar">' + (m.role === "user" ? "🙂" : "R") + '</div><div class="body"><div class="who">' + who + (m.model && m.role === "assistant" ? " · " + R.esc(shortModel(m.model)) : "") + "</div>" + body + actions + "</div>";
    el.querySelectorAll("[data-act]").forEach((b) => b.onclick = () => {
      const t = m.role === "user" ? (m.text || textOf(m.content)) : textOf(m.content);
      if (b.dataset.act === "copy") R.copy(t); else if (b.dataset.act === "speak") R.speak(t); else if (b.dataset.act === "regen") regenerate();
    });
    return el;
  }
  function shortModel(id) { const m = R.config.models.find((x) => x.id === id); return m ? m.name.replace(/\s*\(.*\)/, "") : id; }
  function textOf(content) { return (content || []).filter((b) => b.type === "text").map((b) => b.text).join(""); }
  function renderAssistant(content) {
    let h = "";
    for (const b of content || []) {
      if (b.type === "thinking" && b.thinking && S.showThinking) h += '<details class="thinking"><summary>Thinking</summary>' + R.esc(b.thinking) + "</details>";
      else if (b.type === "server_tool_use") h += '<div class="tool-line">' + (b.name === "web_search" ? "🔎 Searched the web: " : "🌐 Fetched: ") + R.esc(b.input && (b.input.query || b.input.url) || "") + "</div>";
      else if (b.type === "text") h += '<div class="content md">' + R.md(b.text) + "</div>";
      else if (b.type === "fallback") h += '<div class="tool-line">↪ Answered by a fallback model</div>';
    }
    return h || '<div class="content md"></div>';
  }

  // ---------- sending ----------
  function apiMessages(msgs) {
    return msgs.map((m) => ({ role: m.role, content: m.role === "assistant" ? R.ai.cleanContent(m.content) : m.content }));
  }
  async function send() {
    const text = els["composer-input"].value.trim();
    if ((!text && !chat.attachments.length) || chat.busy) return;
    if (!R.usage.check("chat")) return;
    const c = chat.current;
    const content = []; const files = [];
    for (const a of chat.attachments) {
      if (a.kind === "image") content.push({ type: "image", source: { type: "base64", media_type: a.mime, data: a.data } });
      else if (a.kind === "pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data }, title: a.name });
      else { content.push({ type: "text", text: "File `" + a.name + "`:\n\n" + a.text }); files.push(a.name); }
    }
    content.push({ type: "text", text: text || "Please look at the attached file(s)." });
    c.messages.push({ role: "user", content, text, files, ts: Date.now() });
    if (c.title === "New chat") c.title = (text || files[0] || "Attachment").slice(0, 48);
    chat.attachments = []; renderAttachments();
    els["composer-input"].value = ""; autosize();
    renderAll(); await save();
    await respond();
  }
  async function regenerate() {
    const c = chat.current; if (chat.busy || !c.messages.length) return;
    if (c.messages[c.messages.length - 1].role === "assistant") c.messages.pop();
    renderAll(); await respond();
  }
  async function respond() {
    const c = chat.current; chat.busy = true; els["send-btn"].textContent = "■"; els["send-btn"].onclick = () => chat.abort && chat.abort.abort();
    const model = els["chat-model"].value || R.ai.model();
    const m = { role: "assistant", content: [], model, ts: Date.now() };
    const el = document.createElement("div"); el.className = "msg assistant"; el.innerHTML = '<div class="avatar">R</div><div class="body"><div class="who">Raken AI</div><div class="live"><span class="typing"></span></div></div>';
    els["messages"].appendChild(el); scroll();
    const live = el.querySelector(".live"); let lastRender = 0; let text = "";
    const render = (force) => { const now = Date.now(); if (!force && now - lastRender < 90) return; lastRender = now; live.innerHTML = renderAssistant(m.content) + '<span class="typing"></span>'; scroll(); };
    chat.abort = new AbortController();
    try {
      const tools = chat.web && R.ai.supportsWeb(model) ? [R.ai.webSearchTool(5)] : [];
      const msg = await R.ai.messages({
        model, system: R.ai.persona(), messages: apiMessages(c.messages), tools, signal: chat.abort.signal,
        onEvent: (ev) => {
          if (ev.kind === "block_start") { m.content[ev.index] = ev.block; render(true); }
          else if (ev.kind === "text") { text += ev.text; render(); }
          else if (ev.kind === "thinking") render();
          else if (ev.kind === "block_stop") render(true);
        }
      });
      m.content = R.ai.cleanContent(msg.content); m.model = msg.model || model; m.usage = msg.usage;
      if (msg.stop_reason === "refusal") m.content.push({ type: "text", text: "_Raken AI declined to answer this one" + (msg.stop_details && msg.stop_details.category ? " (" + msg.stop_details.category + ")" : "") + "._" });
      if (msg.stop_reason === "max_tokens") m.content.push({ type: "text", text: "\n\n_(Reply was cut off at the length limit.)_" });
      if (!m.content.length) m.content.push({ type: "text", text: "_(empty reply)_" });
      c.messages.push(m); R.usage.bump("chat");
      if (S.tts) R.speak(textOf(m.content));
    } catch (e) {
      if (e.name === "AbortError" || /Stopped|aborted/i.test(e.message)) { if (text.trim()) { m.content = [{ type: "text", text }]; c.messages.push(m); } }
      else { m.content = [{ type: "text", text: "⚠️ " + R.esc(e.message || String(e)) }]; c.messages.push(m); R.toast(e.message || "Request failed", "err"); }
    } finally {
      chat.busy = false; chat.abort = null; els["send-btn"].textContent = "➤"; els["send-btn"].onclick = send;
      await save(); renderAll();
    }
  }

  // ---------- microphone ----------
  let rec = null;
  function mic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { R.toast("Dictation isn't available in this browser", "err"); return; }
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.interimResults = true; rec.continuous = false; els["mic-btn"].classList.add("mic-on");
    const base = els["composer-input"].value;
    rec.onresult = (e) => { let t = ""; for (const r of e.results) t += r[0].transcript; els["composer-input"].value = (base ? base + " " : "") + t; autosize(); };
    rec.onend = () => { rec = null; els["mic-btn"].classList.remove("mic-on"); };
    rec.onerror = rec.onend;
    rec.start();
  }

  chat.sendPrompt = (text) => { R.go("chat"); els["composer-input"].value = text; send(); };
  chat.attachImage = (blob, name) => R.fileToDataURL(blob).then((d) => { chat.attachments.push({ kind: "image", name: name || "image.png", mime: blob.type || "image/png", data: d.split(",")[1] }); renderAttachments(); R.go("chat"); });
})();
