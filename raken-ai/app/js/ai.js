/* Raken AI — Claude Messages API client (raw HTTP, streaming) and the agent loop */
(function () {
  const R = window.Raken; const S = R.settings;
  const API = "https://api.anthropic.com/v1/messages";
  const ai = R.ai = {};

  ai.hasKey = () => !!(S.anthropicKey || S.gateway);
  ai.endpoint = () => S.gateway ? S.gateway.replace(/\/+$/, "") + "/v1/messages" : API;
  ai.model = () => {
    const m = R.config.models.find((x) => x.id === S.model);
    return (m && (!m.pro || R.isPro())) ? m.id : R.config.defaultModel;
  };
  ai.effort = () => (!R.isPro() && (S.effort === "xhigh" || S.effort === "max")) ? "high" : (S.effort || "high");
  ai.headers = function () {
    const h = {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
      "anthropic-dangerous-direct-browser-access": "true"
    };
    if (S.gateway) { h["x-raken-license"] = S.license || ""; if (S.anthropicKey) h["x-api-key"] = S.anthropicKey; }
    else h["x-api-key"] = S.anthropicKey;
    return h;
  };
  ai.webSearchTool = (maxUses) => ({ type: "web_search_20260209", name: "web_search", max_uses: maxUses || 5 });
  ai.webFetchTool = (maxUses) => ({ type: "web_fetch_20260209", name: "web_fetch", max_uses: maxUses || 5 });
  ai.supportsWeb = (model) => !/fable|mythos/.test(model || ai.model());

  ai.persona = function (extra) {
    const who = S.name ? " The user's name is " + S.name + "." : "";
    return "You are Raken AI, a friendly, sharp assistant inside the Raken AI app (" + R.platformLabel + ")." + who +
      " Today is " + new Date().toDateString() + ". Use Markdown. Be concise unless the task needs depth. " + (extra || "");
  };

  // Clean assistant content before echoing it back into the conversation.
  ai.cleanContent = (content) => (content || []).filter((b) => !(b.type === "text" && !(b.text || "").trim()));

  // Parse one SSE chunk stream into content blocks. Returns a parser with .feed(text) and .message.
  function sseParser(onEvent) {
    let buf = ""; const msg = { content: [], stop_reason: null, stop_details: null, model: null, usage: null, id: null };
    const partial = {};
    function handle(ev) {
      const t = ev.type;
      if (t === "message_start") { Object.assign(msg, { id: ev.message.id, model: ev.message.model, usage: ev.message.usage }); }
      else if (t === "content_block_start") {
        const b = Object.assign({}, ev.content_block); msg.content[ev.index] = b;
        if (b.type === "tool_use" || b.type === "server_tool_use") { partial[ev.index] = ""; b.input = b.input || {}; }
        if (b.type === "text" && b.text == null) b.text = "";
        if (b.type === "thinking" && b.thinking == null) b.thinking = "";
        onEvent && onEvent({ kind: "block_start", index: ev.index, block: b });
      } else if (t === "content_block_delta") {
        const b = msg.content[ev.index]; const d = ev.delta; if (!b) return;
        if (d.type === "text_delta") { b.text += d.text; onEvent && onEvent({ kind: "text", index: ev.index, text: d.text }); }
        else if (d.type === "thinking_delta") { b.thinking += d.thinking; onEvent && onEvent({ kind: "thinking", index: ev.index, text: d.thinking }); }
        else if (d.type === "input_json_delta") { partial[ev.index] += d.partial_json; }
        else if (d.type === "signature_delta") { b.signature = d.signature; }
        else if (d.type === "citations_delta") { (b.citations = b.citations || []).push(d.citation); }
      } else if (t === "content_block_stop") {
        const b = msg.content[ev.index];
        if (b && partial[ev.index] != null) { try { b.input = partial[ev.index] ? JSON.parse(partial[ev.index]) : {}; } catch (e) { b.input = {}; } delete partial[ev.index]; }
        onEvent && onEvent({ kind: "block_stop", index: ev.index, block: b });
      } else if (t === "message_delta") {
        if (ev.delta) { if (ev.delta.stop_reason) msg.stop_reason = ev.delta.stop_reason; if (ev.delta.stop_details) msg.stop_details = ev.delta.stop_details; }
        if (ev.usage) msg.usage = Object.assign(msg.usage || {}, ev.usage);
      } else if (t === "error") { throw new Error(ev.error && ev.error.message || "Stream error"); }
    }
    return {
      message: msg,
      feed(text) {
        buf += text; let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, idx); buf = buf.slice(idx + 2);
          const data = raw.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
          if (!data) continue;
          let ev; try { ev = JSON.parse(data); } catch (e) { continue; }
          handle(ev);
        }
      }
    };
  }

  // ai.messages({system, messages, tools, model, effort, maxTokens, onEvent, signal}) -> message
  ai.messages = async function (o) {
    if (!ai.hasKey()) return ai.demo(o);
    const model = o.model || ai.model();
    const body = {
      model, max_tokens: o.maxTokens || 32000, stream: true, messages: o.messages,
      thinking: S.showThinking ? { type: "adaptive", display: "summarized" } : { type: "adaptive" },
      output_config: { effort: o.effort || ai.effort() }
    };
    if (!S.gateway) body.fallbacks = "default";
    if (o.system) body.system = o.system;
    if (o.tools && o.tools.length) body.tools = o.tools;
    const parser = sseParser(o.onEvent);
    const res = await R.net.request(ai.endpoint(), { method: "POST", headers: ai.headers(), body: JSON.stringify(body), signal: o.signal, onChunk: (t) => parser.feed(t) });
    if (!res.ok) {
      let msg = "Request failed (" + res.status + ")";
      try { const j = JSON.parse(res.text); msg = (j.error && j.error.message) || msg; } catch (e) { if (res.text) msg += ": " + res.text.slice(0, 200); }
      if (res.status === 401) msg = "Invalid API key. Check Settings.";
      throw new Error(msg);
    }
    const m = parser.message; m.content = m.content.filter(Boolean);
    return m;
  };

  ai.text = (message) => (message.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");

  // Offline demo answer when no key is configured.
  ai.demo = async function (o) {
    const last = o.messages[o.messages.length - 1]; const q = typeof last.content === "string" ? last.content : (last.content.find((b) => b.type === "text") || {}).text || "";
    const text = "**Demo mode** — Raken AI isn't connected to a model yet.\n\n" +
      "Add your Anthropic API key in **Settings → Assistant** (or a Raken Cloud gateway) and I'll answer for real. " +
      "Images already work without a key via the free Pollinations provider.\n\n" +
      (q ? "You asked: _" + q.slice(0, 200).replace(/\n/g, " ") + "_" : "");
    const m = { content: [{ type: "text", text: "" }], stop_reason: "end_turn", model: "demo" };
    for (const ch of text.match(/.{1,12}/gs)) { m.content[0].text += ch; o.onEvent && o.onEvent({ kind: "text", index: 0, text: ch }); await R.sleep(12); }
    return m;
  };

  // Agent loop: runs client tools until the model stops.
  // ai.runAgent({system, messages, tools:[{name, description, input_schema, run(input)}], serverTools:[], onEvent, signal, maxTurns, model, effort})
  ai.runAgent = async function (o) {
    const clientTools = o.tools || []; const byName = {}; clientTools.forEach((t) => byName[t.name] = t);
    const toolDefs = clientTools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })).concat(o.serverTools || []);
    const messages = o.messages.slice(); const maxTurns = o.maxTurns || 30; let finalText = "";
    for (let turn = 0; turn < maxTurns; turn++) {
      if (o.signal && o.signal.aborted) throw new Error("Stopped");
      const msg = await ai.messages({ system: o.system, messages, tools: toolDefs, model: o.model, effort: o.effort, onEvent: o.onEvent, signal: o.signal });
      const content = ai.cleanContent(msg.content);
      messages.push({ role: "assistant", content });
      finalText = ai.text(msg);
      o.onEvent && o.onEvent({ kind: "turn", message: msg, turn });
      if (msg.stop_reason === "refusal") { o.onEvent && o.onEvent({ kind: "refusal", details: msg.stop_details }); break; }
      if (msg.stop_reason === "max_tokens") { o.onEvent && o.onEvent({ kind: "max_tokens" }); break; }
      if (msg.stop_reason === "pause_turn") continue;
      if (msg.stop_reason !== "tool_use") break;
      const calls = content.filter((b) => b.type === "tool_use");
      if (!calls.length) break;
      const results = [];
      for (const call of calls) {
        const tool = byName[call.name]; let out, isError = false;
        o.onEvent && o.onEvent({ kind: "tool_call", call });
        try { out = tool ? await tool.run(call.input || {}, call) : "Unknown tool: " + call.name; if (!tool) isError = true; }
        catch (e) { out = "Error: " + (e.message || e); isError = true; }
        if (out == null) out = "(no output)";
        if (typeof out !== "string") out = JSON.stringify(out);
        if (out.length > 60000) out = out.slice(0, 60000) + "\n…(truncated)";
        o.onEvent && o.onEvent({ kind: "tool_result", call, result: out, isError });
        results.push({ type: "tool_result", tool_use_id: call.id, content: out, is_error: isError || undefined });
      }
      messages.push({ role: "user", content: results });
    }
    return { text: finalText, messages };
  };

  // Quick connectivity check used by Settings.
  ai.test = async function () {
    const m = await ai.messages({ messages: [{ role: "user", content: "Reply with the single word OK." }], maxTokens: 64, effort: "low" });
    return ai.text(m).trim();
  };
})();
