/* Raken AI — Work Agent, Code Agent, Documents */
(function () {
  const R = window.Raken; const S = R.settings; const $ = R.$;
  const agents = R.agents = {};

  // ---------- shared log ----------
  function logger(container) {
    container.innerHTML = ""; let liveText = null; let liveThink = null;
    const add = (cls, html) => { const d = document.createElement("div"); d.className = "step " + cls; d.innerHTML = html; container.appendChild(d); container.scrollTop = container.scrollHeight; return d; };
    return {
      status: (t) => { liveText = null; add("status", R.esc(t)); },
      error: (t) => add("error", R.esc(t)),
      onEvent(ev) {
        if (ev.kind === "text") { if (!liveText) liveText = add("result md", ""); liveText._t = (liveText._t || "") + ev.text; liveText.innerHTML = R.md(liveText._t); container.scrollTop = container.scrollHeight; }
        else if (ev.kind === "thinking" && S.showThinking) { if (!liveThink) liveThink = add("think", ""); liveThink.textContent += ev.text; }
        else if (ev.kind === "block_start") { if (ev.block.type !== "text") liveText = null; if (ev.block.type !== "thinking") liveThink = null; if (ev.block.type === "server_tool_use") add("tool", '<span class="name">🔎 ' + R.esc(ev.block.name) + "</span>"); }
        else if (ev.kind === "block_stop" && ev.block && ev.block.type === "server_tool_use") { const last = container.querySelector(".step.tool:last-of-type"); if (last) last.innerHTML += " <span class='muted'>" + R.esc(ev.block.input && (ev.block.input.query || ev.block.input.url) || "") + "</span>"; }
        else if (ev.kind === "tool_call") { liveText = null; add("tool", '<span class="name">🛠 ' + R.esc(ev.call.name) + "</span><pre>" + R.esc(summarize(ev.call.input)) + "</pre>"); }
        else if (ev.kind === "tool_result") { add("tool" + (ev.isError ? " error" : ""), "<pre>" + R.esc(String(ev.result).slice(0, 600)) + "</pre>"); }
        else if (ev.kind === "refusal") add("error", "The model declined this task" + (ev.details && ev.details.category ? " (" + ev.details.category + ")" : "") + ".");
        else if (ev.kind === "max_tokens") add("error", "Output limit reached.");
      }
    };
  }
  function summarize(input) { const o = {}; for (const k in input || {}) { const v = input[k]; o[k] = typeof v === "string" && v.length > 300 ? v.slice(0, 300) + "…(" + v.length + " chars)" : v; } return JSON.stringify(o, null, 1).slice(0, 800); }
  function calc(expr) {
    const e = String(expr || "");
    if (!/^[\d\s+\-*/().,%^eE]*(Math\.[a-zA-Z]+[\d\s+\-*/().,%^eE]*)*$/.test(e.replace(/Math\.[a-zA-Z]+/g, ""))) throw new Error("Only arithmetic and Math.* are allowed");
    if (/[a-df-zA-DF-Z_$]/.test(e.replace(/Math\.[a-zA-Z]+/g, ""))) throw new Error("Only arithmetic and Math.* are allowed");
    return String(Function("Math", '"use strict"; return (' + e.replace(/\^/g, "**") + ")")(Math));
  }

  // ---------- Work Agent ----------
  let workAbort = null;
  document.addEventListener("DOMContentLoaded", () => {
    R.$$("#work-presets .chip").forEach((c) => c.onclick = () => { $("#work-task").value = c.dataset.task; });
    $("#work-run").onclick = runWork;
    $("#work-stop").onclick = () => workAbort && workAbort.abort();
  });
  async function runWork() {
    const task = $("#work-task").value.trim(); if (!task) { $("#work-task").focus(); return; }
    if (!R.usage.check("agent")) return;
    const log = logger($("#work-log")); const btn = $("#work-run"); btn.disabled = true; $("#work-stop").hidden = false;
    workAbort = new AbortController(); const made = [];
    const tools = [
      { name: "create_document", description: "Create a new document in the user's Documents library. Use markdown for reports, memos, plans and emails; csv for tables/spreadsheets. Returns the document id.", input_schema: { type: "object", properties: { title: { type: "string" }, format: { type: "string", enum: ["markdown", "csv", "text"] }, content: { type: "string" } }, required: ["title", "format", "content"] }, run: async (i) => { const d = { id: R.uid(), title: i.title, format: i.format || "markdown", content: i.content, created: Date.now(), updated: Date.now() }; await R.db.put("docs", d); made.push(d); return "Created document " + d.id + " (" + d.title + ")"; } },
      { name: "update_document", description: "Replace the content of an existing document.", input_schema: { type: "object", properties: { id: { type: "string" }, content: { type: "string" }, title: { type: "string" } }, required: ["id", "content"] }, run: async (i) => { const d = await R.db.get("docs", i.id); if (!d) return "No document " + i.id; d.content = i.content; if (i.title) d.title = i.title; d.updated = Date.now(); await R.db.put("docs", d); return "Updated " + d.id; } },
      { name: "list_documents", description: "List the user's existing documents (id, title, format).", input_schema: { type: "object", properties: {} }, run: async () => (await R.db.all("docs")).map((d) => d.id + " | " + d.title + " | " + d.format).join("\n") || "(no documents)" },
      { name: "read_document", description: "Read a document's content by id.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }, run: async (i) => { const d = await R.db.get("docs", i.id); return d ? d.content : "No document " + i.id; } },
      { name: "calculate", description: "Evaluate an arithmetic expression precisely (supports + - * / % ^ and Math.* functions).", input_schema: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] }, run: (i) => calc(i.expression) },
      { name: "get_datetime", description: "Current local date and time.", input_schema: { type: "object", properties: {} }, run: () => new Date().toString() }
    ];
    const serverTools = ($("#work-web").checked && R.ai.supportsWeb()) ? [R.ai.webSearchTool(8), R.ai.webFetchTool(6)] : [];
    const system = R.ai.persona("You are the Raken AI Work Agent: a capable, autonomous professional. Plan briefly, then do the work using tools. " +
      "Put every deliverable (report, memo, email drafts, table, checklist, plan) into a document with create_document — markdown for prose, csv for spreadsheets — rather than only replying in chat. " +
      "Use web search when the task depends on facts you may not know and cite sources inside the document. When done, reply with a short summary of what you produced and any assumptions.");
    log.status("Working on: " + task);
    try {
      const out = await R.ai.runAgent({ system, messages: [{ role: "user", content: task }], tools, serverTools, onEvent: log.onEvent, signal: workAbort.signal, maxTurns: 40 });
      R.usage.bump("agent");
      if (made.length) { const d = document.createElement("div"); d.className = "step status"; d.innerHTML = "📄 Created " + made.length + " document" + (made.length > 1 ? "s" : "") + ": " + made.map((x) => '<a href="#" data-doc="' + x.id + '">' + R.esc(x.title) + "</a>").join(", "); $("#work-log").appendChild(d); d.querySelectorAll("[data-doc]").forEach((a) => a.onclick = (e) => { e.preventDefault(); R.go("docs"); agents.openDoc(a.dataset.doc); }); }
      if (!out.text && !made.length) log.status("Done.");
    } catch (e) { log.error(e.message || String(e)); }
    finally { btn.disabled = false; $("#work-stop").hidden = true; workAbort = null; }
  }

  // ---------- Documents ----------
  let docSel = null;
  document.addEventListener("raken:go", (e) => { if (e.detail === "docs") renderDocs(); });
  async function renderDocs() {
    const docs = await R.db.all("docs"); const list = $("#doc-list");
    list.innerHTML = docs.length ? docs.map((d) => '<div class="doc-item' + (docSel === d.id ? " active" : "") + '" data-id="' + d.id + '"><div class="t">' + R.esc(d.title) + "</div><small>" + d.format + " · " + R.fmtDate(d.updated) + "</small></div>").join("") : '<div class="empty-mini">No documents yet. Run the Work Agent.</div>';
    R.$$(".doc-item", list).forEach((el) => el.onclick = () => agents.openDoc(el.dataset.id));
    if (docSel) agents.openDoc(docSel);
  }
  agents.openDoc = async function (id) {
    const d = await R.db.get("docs", id); if (!d) { docSel = null; return; } docSel = id;
    R.$$(".doc-item").forEach((el) => el.classList.toggle("active", el.dataset.id === id));
    const v = $("#doc-view"); let body;
    if (d.format === "csv") body = csvTable(d.content); else if (d.format === "markdown") body = '<div class="md">' + R.md(d.content) + "</div>"; else body = "<pre style='white-space:pre-wrap'>" + R.esc(d.content) + "</pre>";
    v.innerHTML = '<div class="doc-head"><h3>' + R.esc(d.title) + '</h3><button class="btn small ghost" data-a="copy">Copy</button><button class="btn small ghost" data-a="dl">Download</button><button class="btn small ghost" data-a="chat">Discuss</button><button class="btn small danger" data-a="del">Delete</button></div>' + body;
    v.querySelectorAll("[data-a]").forEach((b) => b.onclick = async () => {
      const a = b.dataset.a;
      if (a === "copy") R.copy(d.content);
      else if (a === "dl") R.download(d.title.replace(/[^\w\- ]+/g, "").trim() + { csv: ".csv", markdown: ".md", text: ".txt" }[d.format], new Blob([d.content], { type: d.format === "csv" ? "text/csv" : "text/plain" }));
      else if (a === "chat") R.chat.sendPrompt("Here is a document titled \"" + d.title + "\":\n\n" + d.content + "\n\nLet's discuss it. Start by summarizing it in two sentences.");
      else if (a === "del") { if (confirm("Delete this document?")) { await R.db.del("docs", d.id); docSel = null; v.innerHTML = '<div class="empty-mini">Select a document.</div>'; renderDocs(); } }
    });
  };
  function csvTable(csv) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < csv.length; i++) { const c = csv[i]; if (q) { if (c === '"' && csv[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; } else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c; }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return "<p class='muted'>Empty table</p>";
    return '<div class="md"><table><thead><tr>' + rows[0].map((c) => "<th>" + R.esc(c) + "</th>").join("") + "</tr></thead><tbody>" + rows.slice(1).map((r) => "<tr>" + r.map((c) => "<td>" + R.esc(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  }

  // ---------- Code Agent ----------
  const code = { project: null, list: [], file: null, abort: null };
  document.addEventListener("DOMContentLoaded", () => {
    $("#code-new").onclick = () => newProject();
    $("#code-del").onclick = delProject;
    $("#code-zip").onclick = zipProject;
    $("#code-run").onclick = runCode;
    $("#code-stop").onclick = () => code.abort && code.abort.abort();
    $("#code-project").onchange = () => openProject($("#code-project").value);
    $("#file-add").onclick = () => { const n = prompt("File name", "notes.md"); if (n && code.project) { code.project.files[n] = ""; saveProject(); renderFiles(); openFile(n); } };
    $("#editor-save").onclick = () => { if (code.project && code.file) { code.project.files[code.file] = $("#editor").value; saveProject(); preview(); R.toast("Saved"); } };
    $("#editor").addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); $("#editor-save").click(); } if (e.key === "Tab") { e.preventDefault(); const t = e.target; const s = t.selectionStart; t.value = t.value.slice(0, s) + "  " + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = s + 2; } });
    $("#preview-refresh").onclick = preview;
    loadProjects();
  });
  async function loadProjects() { code.list = await R.db.all("projects"); renderProjectSelect(); if (code.list.length) openProject(code.list[0].id); else newProject("My first app"); }
  function renderProjectSelect() { const sel = $("#code-project"); sel.innerHTML = code.list.map((p) => '<option value="' + p.id + '">' + R.esc(p.name) + "</option>").join(""); if (code.project) sel.value = code.project.id; }
  function newProject(name) {
    name = name || prompt("Project name", "New project"); if (!name) return;
    code.project = { id: R.uid(), name, files: { "index.html": "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n<title>" + R.esc(name) + "</title>\n<link rel=\"stylesheet\" href=\"styles.css\">\n</head>\n<body>\n<h1>" + R.esc(name) + "</h1>\n<script src=\"app.js\"></script>\n</body>\n</html>\n", "styles.css": "body { font-family: system-ui, sans-serif; margin: 2rem; }\n", "app.js": "console.log('ready');\n" }, created: Date.now(), updated: Date.now() };
    code.list.unshift(code.project); saveProject(); renderProjectSelect(); renderFiles(); openFile("index.html"); preview();
  }
  function openProject(id) { const p = code.list.find((x) => x.id === id); if (!p) return; code.project = p; renderProjectSelect(); renderFiles(); openFile(Object.keys(p.files)[0]); preview(); }
  async function saveProject() { if (!code.project) return; code.project.updated = Date.now(); await R.db.put("projects", code.project); }
  async function delProject() { if (!code.project || !confirm("Delete project \"" + code.project.name + "\"?")) return; await R.db.del("projects", code.project.id); code.list = code.list.filter((p) => p.id !== code.project.id); code.project = null; if (code.list.length) openProject(code.list[0].id); else newProject("My first app"); }
  function zipProject() { if (!code.project) return; const files = Object.keys(code.project.files).map((n) => ({ name: n, data: code.project.files[n] })); R.download(code.project.name.replace(/[^\w\-]+/g, "-") + ".zip", R.zip(files)); }
  function renderFiles() {
    const list = $("#file-list"); if (!code.project) { list.innerHTML = ""; return; }
    list.innerHTML = Object.keys(code.project.files).sort().map((n) => '<button class="' + (n === code.file ? "active" : "") + '" data-f="' + R.esc(n) + '">' + R.esc(n) + "</button>").join("");
    list.querySelectorAll("button").forEach((b) => b.onclick = () => openFile(b.dataset.f));
  }
  function openFile(name) { if (!code.project || !(name in code.project.files)) { code.file = null; $("#editor-name").textContent = "No file open"; $("#editor").value = ""; $("#editor-save").hidden = true; return; } code.file = name; $("#editor-name").textContent = name; $("#editor").value = code.project.files[name]; $("#editor-save").hidden = false; renderFiles(); }
  function preview() {
    const f = code.project && code.project.files; const frame = $("#preview"); if (!f) { frame.srcdoc = ""; return; }
    let html = f["index.html"]; if (html == null) { const n = Object.keys(f).find((x) => /\.html?$/.test(x)); html = n ? f[n] : "<p style='font-family:sans-serif;color:#888'>No index.html in this project</p>"; }
    html = html.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi, (m, href) => f[href.replace(/^\.\//, "")] != null ? "<style>" + f[href.replace(/^\.\//, "")] + "</style>" : m);
    html = html.replace(/<script[^>]+src=["']([^"']+\.js)["'][^>]*>\s*<\/script>/gi, (m, src) => f[src.replace(/^\.\//, "")] != null ? "<script>" + f[src.replace(/^\.\//, "")].replace(/<\/script>/gi, "<\\/script>") + "</script>" : m);
    frame.srcdoc = html;
  }
  // Run JavaScript in a sandboxed iframe and capture console output.
  function runJS(src, timeoutMs) {
    return new Promise((resolve) => {
      const id = R.uid(); const frame = document.createElement("iframe"); frame.sandbox = "allow-scripts"; frame.style.display = "none";
      const done = (r) => { window.removeEventListener("message", onMsg); frame.remove(); resolve(r); };
      const onMsg = (e) => { if (e.data && e.data.rakenRun === id) done(e.data.out); };
      window.addEventListener("message", onMsg);
      const timer = setTimeout(() => done("Timed out after " + (timeoutMs || 8000) + " ms (possible infinite loop)"), timeoutMs || 8000);
      frame.srcdoc = "<script>(function(){var out=[];var f=function(k){return function(){out.push('['+k+'] '+Array.from(arguments).map(function(a){try{return typeof a==='string'?a:JSON.stringify(a)}catch(e){return String(a)}}).join(' '))}};console.log=f('log');console.error=f('error');console.warn=f('warn');console.info=f('info');window.onerror=function(m,s,l){out.push('[uncaught] '+m+' (line '+l+')')};" +
        "Promise.resolve().then(function(){try{var r=(0,eval)(" + JSON.stringify(src) + ");if(r!==undefined)out.push('[return] '+(typeof r==='string'?r:JSON.stringify(r)));}catch(e){out.push('[exception] '+(e&&e.stack||e))}}).then(function(){return new Promise(function(r){setTimeout(r,50)})}).then(function(){parent.postMessage({rakenRun:" + JSON.stringify(id) + ",out:out.join('\\n')||'(no output)'},'*')});})();<\/script>";
      document.body.appendChild(frame); frame._t = timer;
    });
  }
  agents.runJS = runJS;
  async function runCode() {
    const task = $("#code-task").value.trim(); if (!task || !code.project) { $("#code-task").focus(); return; }
    if (!R.usage.check("agent")) return;
    const log = logger($("#code-log")); const btn = $("#code-run"); btn.disabled = true; $("#code-stop").hidden = false; code.abort = new AbortController();
    const p = code.project;
    const tools = [
      { name: "list_files", description: "List all files in the project with their sizes.", input_schema: { type: "object", properties: {} }, run: () => Object.keys(p.files).map((n) => n + " (" + p.files[n].length + " chars)").join("\n") || "(empty project)" },
      { name: "read_file", description: "Read a file from the project.", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }, run: (i) => p.files[i.path] != null ? p.files[i.path] : "Error: no file " + i.path },
      { name: "write_file", description: "Create or overwrite a file in the project with the full content.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }, run: async (i) => { p.files[i.path] = i.content; await saveProject(); renderFiles(); if (code.file === i.path) $("#editor").value = i.content; preview(); return "Wrote " + i.path + " (" + i.content.length + " chars)"; } },
      { name: "edit_file", description: "Replace an exact substring in a file with new text (the old text must occur exactly once).", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] }, run: async (i) => { const s = p.files[i.path]; if (s == null) return "Error: no file " + i.path; const n = s.split(i.old_text).length - 1; if (n !== 1) return "Error: old_text occurs " + n + " times"; p.files[i.path] = s.replace(i.old_text, () => i.new_text); await saveProject(); if (code.file === i.path) $("#editor").value = p.files[i.path]; preview(); return "Edited " + i.path; } },
      { name: "delete_file", description: "Delete a file from the project.", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }, run: async (i) => { delete p.files[i.path]; await saveProject(); renderFiles(); if (code.file === i.path) openFile(Object.keys(p.files)[0]); preview(); return "Deleted " + i.path; } },
      { name: "run_js", description: "Run JavaScript in a sandboxed browser context (no DOM of the app, no network) and return console output, return value and errors. Use it to test logic from your files by pasting the relevant code plus assertions.", input_schema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] }, run: (i) => runJS(i.code) }
    ];
    const system = R.ai.persona("You are the Raken AI Code Agent working inside a small in-browser project (\"" + p.name + "\"). " +
      "The project is a static web app: index.html plus any .css/.js files it references with relative paths; the app previews index.html live and inlines those files. " +
      "Workflow: read the existing files first, then write complete files with write_file (or precise edits with edit_file). Prefer vanilla HTML/CSS/JS with no external CDNs so the project works offline. " +
      "Test pure logic with run_js where it makes sense. Finish with a short summary of what you built and how to use it.");
    log.status("Task: " + task);
    try {
      await R.ai.runAgent({ system, messages: [{ role: "user", content: task }], tools, onEvent: log.onEvent, signal: code.abort.signal, maxTurns: 50 });
      R.usage.bump("agent"); preview(); openFile(code.file || "index.html");
    } catch (e) { log.error(e.message || String(e)); }
    finally { btn.disabled = false; $("#code-stop").hidden = true; code.abort = null; }
  }
})();
