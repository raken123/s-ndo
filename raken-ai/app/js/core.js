/* Raken AI — core: platform, settings, storage, network bridge, markdown, zip, helpers */
(function () {
  const C = window.RAKEN_CONFIG;
  const R = window.Raken = { config: C, version: C.version };

  // ---------- platform ----------
  R.platform = (function () {
    if (window.raken && window.raken.platform === "desktop") return "desktop";
    if (window.RakenAndroid) return "android";
    return "web";
  })();
  R.platformLabel = { desktop: "Desktop", android: "Android", web: "Web" }[R.platform];
  if (R.platform === "desktop" && window.raken.os) {
    R.platformLabel = { win32: "Windows", darwin: "macOS", linux: "Linux" }[window.raken.os] || "Desktop";
  }

  // ---------- helpers ----------
  R.$ = (sel, root) => (root || document).querySelector(sel);
  R.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  R.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  R.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  R.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  R.fmtDate = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  R.today = () => new Date().toISOString().slice(0, 10);
  R.toast = function (msg, kind) {
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    R.$("#toasts").appendChild(el);
    setTimeout(() => el.remove(), kind === "err" ? 6000 : 3200);
  };
  R.fileToDataURL = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
  R.fileToText = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsText(file); });
  R.blobToBase64 = async (blob) => (await R.fileToDataURL(blob)).split(",")[1];
  R.b64ToBlob = function (b64, mime) {
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime || "application/octet-stream" });
  };
  R.copy = async function (text) {
    try { await navigator.clipboard.writeText(text); R.toast("Copied"); }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); R.toast("Copied"); }
  };

  // Save a Blob to the user's device on every platform.
  R.download = async function (name, blob) {
    if (typeof blob === "string") blob = new Blob([blob], { type: "text/plain" });
    if (R.platform === "android" && window.RakenAndroid.saveFile) {
      const ok = window.RakenAndroid.saveFile(name, await R.blobToBase64(blob), blob.type || "application/octet-stream");
      R.toast(ok ? "Saved to Downloads / Raken AI: " + name : "Could not save " + name, ok ? "ok" : "err");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  // ---------- settings ----------
  const DEFAULTS = {
    name: "", anthropicKey: "", gateway: "", model: C.defaultModel, effort: "high", showThinking: false, tts: false,
    falKey: "", openaiBase: "https://api.openai.com", openaiKey: "", openaiImageModel: "gpt-image-1",
    imageProvider: "pollinations", videoModel: "fal-ai/ltx-video", theme: "dark", onboarded: false,
    pro: false, license: "", licenseEmail: "", founderClaim: null
  };
  let settings;
  try { settings = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem("raken.settings") || "{}")); } catch (e) { settings = Object.assign({}, DEFAULTS); }
  R.settings = settings;
  R.saveSettings = function (patch) {
    if (patch) Object.assign(settings, patch);
    try { localStorage.setItem("raken.settings", JSON.stringify(settings)); } catch (e) { }
    document.dispatchEvent(new CustomEvent("raken:settings"));
  };
  R.isPro = () => !!settings.pro;
  R.applyTheme = function () {
    const t = settings.theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : settings.theme;
    document.documentElement.setAttribute("data-theme", t);
  };
  R.applyTheme();

  // ---------- usage limits ----------
  R.usage = {
    _load() { try { const u = JSON.parse(localStorage.getItem("raken.usage") || "{}"); if (u.day !== R.today()) return { day: R.today() }; return u; } catch (e) { return { day: R.today() }; } },
    count(kind) { return this._load()[kind] || 0; },
    limit(kind) { return R.isPro() ? Infinity : (C.freeLimits[kind] || 0); },
    remaining(kind) { return Math.max(0, this.limit(kind) - this.count(kind)); },
    check(kind) {
      if (R.isPro()) return true;
      if (this.count(kind) >= this.limit(kind)) {
        R.toast("Daily free limit reached for " + kind + ". Upgrade to Pro for more.", "err");
        R.go("pro");
        return false;
      }
      return true;
    },
    bump(kind, n) { const u = this._load(); u[kind] = (u[kind] || 0) + (n || 1); try { localStorage.setItem("raken.usage", JSON.stringify(u)); } catch (e) { } document.dispatchEvent(new CustomEvent("raken:usage")); }
  };

  // ---------- IndexedDB ----------
  const STORES = ["chats", "media", "docs", "projects"];
  let dbp = null;
  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const req = indexedDB.open("raken-ai", 1);
      req.onupgradeneeded = () => { const d = req.result; STORES.forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" }); }); };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return openDB().then((d) => new Promise((res, rej) => {
      const t = d.transaction(store, mode); const s = t.objectStore(store); const r = fn(s);
      t.oncomplete = () => res(r && r.result !== undefined ? r.result : r);
      t.onerror = () => rej(t.error);
    }));
  }
  R.db = {
    put: (store, obj) => tx(store, "readwrite", (s) => s.put(obj)).then(() => obj),
    get: (store, id) => tx(store, "readonly", (s) => s.get(id)),
    del: (store, id) => tx(store, "readwrite", (s) => s.delete(id)),
    clear: (store) => tx(store, "readwrite", (s) => s.clear()),
    all: (store) => tx(store, "readonly", (s) => s.getAll()).then((r) => (r || []).sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0)))
  };

  // ---------- network bridge ----------
  // R.net.request(url, {method, headers, body, responseType:'text'|'json'|'blob', onChunk(text), signal})
  // Desktop routes through the Electron main process (no CORS); web/android use fetch.
  R.net = {};
  R.net.request = async function (url, opt) {
    opt = opt || {};
    if (R.platform === "desktop" && window.raken.request) {
      const r = await window.raken.request({ url, method: opt.method || "GET", headers: opt.headers || {}, body: opt.body || null, binary: opt.responseType === "blob" }, opt.onChunk, opt.signal);
      if (opt.responseType === "blob") return { status: r.status, ok: r.status < 400, headers: r.headers, blob: R.b64ToBlob(r.body, r.headers["content-type"]) };
      let json = null; if (opt.responseType === "json") { try { json = JSON.parse(r.body); } catch (e) { } }
      return { status: r.status, ok: r.status < 400, headers: r.headers, text: r.body, json };
    }
    const res = await fetch(url, { method: opt.method || "GET", headers: opt.headers || {}, body: opt.body || undefined, signal: opt.signal });
    const headers = {}; res.headers.forEach((v, k) => headers[k] = v);
    if (opt.responseType === "blob") return { status: res.status, ok: res.ok, headers, blob: await res.blob() };
    if (opt.onChunk && res.ok && res.body) {
      const reader = res.body.getReader(); const dec = new TextDecoder(); let all = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; const t = dec.decode(value, { stream: true }); all += t; opt.onChunk(t); }
      return { status: res.status, ok: res.ok, headers, text: all };
    }
    const text = await res.text(); let json = null;
    if (opt.responseType === "json") { try { json = JSON.parse(text); } catch (e) { } }
    return { status: res.status, ok: res.ok, headers, text, json };
  };

  // ---------- markdown ----------
  R.md = function (src) {
    if (!src) return "";
    src = String(src).replace(/\r\n?/g, "\n");
    const blocks = [];
    // fenced code
    src = src.replace(/```([\w-]*)\n([\s\S]*?)```/g, (m, lang, code) => {
      blocks.push('<pre><button class="copy" data-copy>Copy</button><code class="lang-' + R.esc(lang) + '">' + R.esc(code.replace(/\n$/, "")) + "</code></pre>");
      return " " + (blocks.length - 1) + " ";
    });
    // unterminated fence while streaming
    src = src.replace(/```([\w-]*)\n([\s\S]*)$/g, (m, lang, code) => { blocks.push("<pre><code>" + R.esc(code) + "</code></pre>"); return " " + (blocks.length - 1) + " "; });
    const inline = (t) => {
      t = R.esc(t);
      t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
      t = t.replace(/!\[([^\]]*)\]\((https?:[^)\s]+|data:image[^)\s]+)\)/g, '<img src="$2" alt="$1">');
      t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/__([^_]+)__/g, "<b>$1</b>");
      t = t.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<i>$2</i>").replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<i>$2</i>");
      t = t.replace(/~~([^~]+)~~/g, "<s>$1</s>");
      t = t.replace(/(^|\s)(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
      return t;
    };
    const lines = src.split("\n"); const out = []; let i = 0;
    const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const isList = (l) => /^\s*([-*+]|\d+[.)])\s+/.test(l);
    const isBlock = (l) => /^ \d+ $/.test(l);
    while (i < lines.length) {
      let l = lines[i];
      if (/^\s*$/.test(l)) { i++; continue; }
      let m;
      if ((m = l.match(/^ (\d+) $/))) { out.push(blocks[+m[1]]); i++; continue; }
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">"); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
      if (isTableRow(l) && i + 1 < lines.length && /^\s*\|?\s*:?-+/.test(lines[i + 1])) {
        const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
        let h = "<table><thead><tr>" + cells(l).map((c) => "<th>" + c + "</th>").join("") + "</tr></thead><tbody>"; i += 2;
        while (i < lines.length && isTableRow(lines[i])) { h += "<tr>" + cells(lines[i]).map((c) => "<td>" + c + "</td>").join("") + "</tr>"; i++; }
        out.push(h + "</tbody></table>"); continue;
      }
      if (/^\s*>/.test(l)) { const q = []; while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, "")); i++; } out.push("<blockquote>" + R.md(q.join("\n")) + "</blockquote>"); continue; }
      if (isList(l)) {
        const ordered = /^\s*\d/.test(l); const tag = ordered ? "ol" : "ul"; let h = "<" + tag + ">";
        while (i < lines.length && isList(lines[i])) {
          let item = lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ""); i++;
          const sub = [];
          while (i < lines.length && /^\s{2,}\S/.test(lines[i])) { sub.push(lines[i].replace(/^\s{2}/, "")); i++; }
          item = item.replace(/^\[([ xX])\]\s+/, (mm, c) => '<input type="checkbox" disabled' + (c !== " " ? " checked" : "") + "> ");
          h += "<li>" + inline(item) + (sub.length ? R.md(sub.join("\n")) : "") + "</li>";
        }
        out.push(h + "</" + tag + ">"); continue;
      }
      const p = []; while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlock(lines[i]) && !/^(#{1,4})\s/.test(lines[i]) && !isList(lines[i]) && !/^\s*>/.test(lines[i])) { p.push(lines[i]); i++; }
      out.push("<p>" + inline(p.join("\n")).replace(/\n/g, "<br>") + "</p>");
    }
    return out.join("\n");
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]"); if (!b) return;
    R.copy(b.parentElement.querySelector("code").textContent);
  });

  // ---------- zip (store-only) ----------
  const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  R.zip = function (files) { // files: [{name, data: string|Uint8Array}]
    const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
    const le16 = (n) => [n & 255, (n >> 8) & 255]; const le32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
    for (const f of files) {
      const name = enc.encode(f.name); const data = typeof f.data === "string" ? enc.encode(f.data) : f.data; const crc = crc32(data);
      const head = new Uint8Array([0x50, 0x4b, 3, 4, ...le16(20), ...le16(0x800), ...le16(0), ...le16(0), ...le16(0), ...le32(crc), ...le32(data.length), ...le32(data.length), ...le16(name.length), ...le16(0)]);
      parts.push(head, name, data);
      central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...le16(20), ...le16(20), ...le16(0x800), ...le16(0), ...le16(0), ...le16(0), ...le32(crc), ...le32(data.length), ...le32(data.length), ...le16(name.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(offset)]), name);
      offset += head.length + name.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new Uint8Array([0x50, 0x4b, 5, 6, ...le16(0), ...le16(0), ...le16(files.length), ...le16(files.length), ...le32(cdSize), ...le32(offset), ...le16(0)]);
    return new Blob([...parts, ...central, end], { type: "application/zip" });
  };

  // ---------- navigation (handled by app.js) ----------
  R.go = (view) => document.dispatchEvent(new CustomEvent("raken:go", { detail: view }));

  // ---------- speech ----------
  R.speak = function (text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_`#>]/g, "").slice(0, 4000));
    speechSynthesis.speak(u);
  };
})();
