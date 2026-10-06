"""The One AI agents and the multi-agent orchestrator.

A chat request goes through three steps:

1. Routing: the user picked an agent, or in "Auto" the router decides which
   agents the request needs (none, one or several) and what each should do.
2. The agents run in parallel. Each one turns its task into real files: text
   and documents (Filegent), pictures (Imagent), video (Vidagent), apps
   (Appagent), decks (Presegent), forms (Formegent), web sites (Sitegent),
   e-mails (Inboxagent), music (Musigent), 3D models (Modelgent) and designs
   (Designgent).
3. The chosen One model writes the reply. Without agents it simply chats,
   calling MCP tools when the account has connected servers.

Every text-writing step runs on the One model the user picked; models with
`plan` plan first and models with `review` check and fix their own work.
"""

import base64
import json
import re
from concurrent.futures import ThreadPoolExecutor

from . import config, files as F, providers

MAX_TOOL_ROUNDS = 6
FILE_RE = re.compile(r'<<<FILE\s+name="([^"]+)"(?:\s+encoding="(base64)")?\s*>>>\n?(.*?)\n?<<<END>>>', re.S)


def identity(model_id):
    m = config.model(model_id)
    return ("You are One AI, running the model %s, made by One AI. Never say which company or underlying model "
            "powers you; if asked, you are %s by One AI. Answer in the user's language (Swedish if unsure). "
            "Keep the interface plain: no emojis unless the user uses them." % (m["name"], m["name"]))


FILE_RULES = """
Files you make go in blocks exactly like this (one block per file, nothing else on the marker lines):
<<<FILE name="path/name.ext">>>
...complete file content...
<<<END>>>
- Always write complete files, never "..." or placeholders.
- For .pdf and .docx write the document as Markdown (# headings, lists, **bold**, tables); it is converted.
- For .xlsx write the sheet as CSV with a header row; it is converted.
- For .pptx write Markdown with one "# Slide title" per slide followed by bullet points; it is converted.
- Any text format works directly: code in any language, .txt, .md, .csv, .json, .xml, .yaml, .html, .svg, .ics, .sql...
- Tiny binary files (under 20 KB) may use <<<FILE name="x.bin" encoding="base64">>>.
Outside the blocks, write a short, plain explanation."""

SYSTEMS = {
    "chat": "You are a helpful, precise assistant. Use Markdown when it helps. If the user wants a file, make it." + FILE_RULES,
    "filegent": "You are Filegent, One AI's file agent. Make exactly the files the task asks for, complete and correct." + FILE_RULES,
    "appagent": ("You are Appagent, One AI's app builder. Build a complete, working app or game as ONE self-contained "
                 "index.html: inline CSS and JavaScript, no external requests, no frameworks from CDNs, works offline, "
                 "responsive for phone and desktop, keyboard and touch input, data kept in localStorage when useful, a clean "
                 "ordinary look, real functionality rather than mock-ups. Double-check the JavaScript for errors." + FILE_RULES),
    "sitegent": ("You are Sitegent, One AI's web site builder. Build a complete multi-page web site: index.html plus the other "
                 "pages it needs (2-6 pages). Every page is self-contained (its own inline <style>, same design on every "
                 "page) and links to the others with relative links like about.html. Real, specific content, responsive, "
                 "accessible, no external requests." + FILE_RULES),
    "formegent": ("You are Formegent, One AI's form builder. Make ONE self-contained index.html with the form or survey: "
                  "proper labels, validation, a thank-you state, responses saved in localStorage, a responses view with "
                  "an 'Export CSV' button, and a 'Clear' button. No external requests." + FILE_RULES),
    "designgent": ("You are Designgent, One AI's designer. Make the design as SVG files (logos, icons, posters, banners, "
                   "UI mock-ups): valid standalone SVG with xmlns and viewBox, fonts as generic families, no external "
                   "references. Make 1 file unless the task asks for variants (max 4)." + FILE_RULES),
    "presegent": ('You are Presegent, One AI\'s presentation maker. Answer with JSON only: {"title": str, "theme": '
                  '{"background": "#hex", "text": "#hex", "accent": "#hex"}, "slides": [{"title": str, "subtitle": str '
                  '(only on the first slide), "bullets": [str]}]}. The first slide is a title slide without bullets. '
                  "6-12 slides unless asked otherwise, 3-6 short bullets each, real content, readable colours."),
    "inboxagent": ('You are Inboxagent, One AI\'s e-mail agent. Answer with JSON only: {"emails": [{"to": str, "cc": str, '
                   '"subject": str, "body": str}], "summary": str}. Write ready-to-send e-mails in the user\'s language '
                   "with a greeting and sign-off; leave \"to\" empty when unknown."),
    "musigent": ('You are Musigent, One AI\'s composer. Answer with JSON only: {"title": str, "tempo": int, "tracks": '
                 '[{"instrument": "piano|bass|lead|pad|strings|pluck|drums", "volume": 0-1, "notes": [[pitch, '
                 'start_beat, length_beats, velocity 0-1]]}]}. Pitches are names like "C4" or "F#3"; drum pitches are '
                 '"kick", "snare", "hat", "clap", "tom" or "crash". 16-64 beats, a real melody, chords and rhythm.'),
    "modelgent": ('You are Modelgent, One AI\'s 3D modeller. Answer with JSON only: {"title": str, "parts": [{"name": str, '
                  '"shape": "box|sphere|cylinder|cone|torus|plane", "position": [x,y,z], "rotation": [x,y,z] degrees, '
                  '"scale": [x,y,z], "color": "#hex", "metallic": 0-1}]}. Unit shapes are 1 unit wide and centred; '
                  "y is up and the model stands on y=0. Use 8-120 parts to make a recognisable, well-proportioned model."),
}

ROUTER = """You route requests to One AI's agents. Agents:
%s
Answer with JSON only: {"tasks": [{"agent": id, "task": "a complete, self-contained instruction for that agent"}]}.
Use no agent ([]) for questions, conversation, explanations, short texts and code shown in the chat.
Use filegent when the user wants a downloadable file (document, PDF, Word, Excel, code file...).
Use several agents only when the request clearly asks for several different things (max 3)."""

REVIEW = ("\n\nYou are now reviewing a draft made for this request. Find and fix every bug, missing feature and "
          "rough edge. Return the complete corrected result in the same format as the draft.")

KEYWORDS = [
    ("vidagent", r"video|film|klipp|movie|animerad film"),
    ("imagent", r"bild(?!spel)|foto|fotografi|illustration|rita |måla|tavla|picture|image|photo|drawing"),
    ("musigent", r"musik|låt(?!a)|sång|melodi|beat|music|song|jingel|jingle"),
    ("modelgent", r"3d|glb|tredimensionell"),
    ("presegent", r"presentation|bildspel|powerpoint|pptx|slides|slideshow"),
    ("formegent", r"formulär|enkät|form\b|survey|anmälan"),
    ("sitegent", r"webbplats|hemsida|sajt|website|landningssida|landing page|webbsida"),
    ("inboxagent", r"mejl|e-post|epost|e-mail|email|mail|nyhetsbrev|newsletter"),
    ("designgent", r"logo|logga|logotyp|ikon|icon|affisch|poster|banner|design|svg"),
    ("appagent", r"\bapp|spel|game|kalkylator|calculator|todo|att göra-lista|timer"),
    ("filegent", r"\bfil\b|filen|dokument|pdf|word|docx|excel|xlsx|csv|kalkylark|rapport|\.\w{2,4}\b|script|skript"),
]


# --- helpers -------------------------------------------------------------------

def slug(text, default="one"):
    s = re.sub(r"[^\wåäöÅÄÖ]+", "-", text.lower(), flags=re.UNICODE).strip("-")
    return (s[:40].strip("-") or default)


def parse_json(text):
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1)
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0] or [0])
    try:
        return json.loads(text[start:])
    except ValueError:
        end = text.rfind("}")
        try:
            return json.loads(text[start:end + 1])
        except ValueError:
            raise ValueError("The model did not answer with valid JSON.")


def parse_files(text):
    """(text outside file blocks, [(name, bytes)])."""
    out = []
    for name, enc, body in FILE_RE.findall(text):
        if enc == "base64":
            try:
                data = base64.b64decode(re.sub(r"\s+", "", body), validate=True)
            except ValueError:
                continue
        else:
            body = re.sub(r"^```[\w-]*\n(.*)\n```\s*$", r"\1", body, flags=re.S)
            data = body.encode("utf-8")
        out.append((F.safe_path(name), data))
    return FILE_RE.sub("", text).strip(), out


PREVIEW = {"html": "html", "htm": "html", "svg": "svg", "png": "image", "jpg": "image", "jpeg": "image", "webp": "image",
           "gif": "image", "mp4": "video", "mp3": "audio", "wav": "audio", "glb": "model3d", "pdf": "pdf"}


def make_file(name, data, agent):
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    textual = F.mime_for(name).startswith("text/") or ext in ("json", "xml", "svg", "eml", "yaml", "yml", "js", "csv")
    return {"name": name, "mime": F.mime_for(name), "data": data, "agent": agent,
            "preview": PREVIEW.get(ext) or ("text" if textual else None)}


def convert(name, data, agent):
    """Text the model wrote for a binary document format becomes that format."""
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return make_file(name, data, agent)
    if ext == "pdf" and not text.startswith("%PDF"):
        data = F.pdf_from_markdown(text, name.rsplit(".", 1)[0])
    elif ext == "docx" and not text.startswith("PK"):
        data = F.docx_from_markdown(text)
    elif ext == "xlsx" and not text.startswith("PK"):
        data = F.xlsx_from_csv(text, name.rsplit(".", 1)[0])
    elif ext == "pptx" and not text.startswith("PK"):
        data = F.pptx_from_slides(F.slides_from_markdown(text))
    return make_file(name, data, agent)


def attachment_parts(attachments):
    """Attachments as model input: pictures, PDFs and audio inline, text as text."""
    parts = []
    for a in attachments or []:
        mime = a.get("mime") or ""
        if mime.startswith(("image/", "audio/", "video/")) or mime == "application/pdf":
            parts.append({"inlineData": {"mimeType": mime, "data": a["data"]}})
        else:
            try:
                text = base64.b64decode(a["data"]).decode("utf-8")
            except (ValueError, UnicodeDecodeError):
                continue
            parts.append({"text": "Attached file %s:\n%s" % (a.get("name", "fil"), text[:200_000])})
    return parts


def first_image(attachments):
    for a in attachments or []:
        if (a.get("mime") or "") in ("image/png", "image/jpeg", "image/webp"):
            return a["mime"], a["data"]
    return None


# --- the job -------------------------------------------------------------------

class Job:
    """One chat request: who asks, with which model, and the conversation."""

    def __init__(self, plan_id, model_id, messages, context_files=None, mcp_tools=None):
        self.plan_id = plan_id
        self.plan = config.PLANS[plan_id]
        self.model_id = model_id
        self.model = config.model(model_id)
        self.run = config.provider_model(model_id)
        self.messages = messages
        last = messages[-1]
        self.prompt = last.get("text", "")
        self.attachments = last.get("attachments") or []
        self.context_files = context_files or []
        self.mcp_tools = mcp_tools  # mcp.Toolset or None

    def history(self, n=8):
        """The conversation before this message, as text for an agent."""
        lines = []
        for m in self.messages[-n - 1:-1]:
            who = "User" if m.get("role") == "user" else "One"
            lines.append("%s: %s" % (who, (m.get("text") or "")[:3000]))
        return "\n".join(lines)

    def context(self, task):
        """A task with the conversation and earlier files around it, so
        follow-ups like 'make it blue' work."""
        out = []
        if self.history():
            out.append("Conversation so far:\n" + self.history())
        for f in self.context_files[:8]:
            out.append('Earlier file "%s" (change it if the request is about it):\n%s' % (f["name"], f["text"][:120_000]))
        out.append("Task:\n" + task)
        return "\n\n".join(out)

    def write(self, agent_id, task, json_mode=False):
        """A text step on the user's model, with planning and review when the
        model has them."""
        system = identity(self.model_id) + "\n\n" + SYSTEMS[agent_id]
        prompt = self.context(task)
        atts = attachment_parts(self.attachments)
        if self.model.get("plan"):
            plan = providers.ask(self.run, system.split(FILE_RULES)[0],
                                 prompt + "\n\nBefore doing anything, write a short numbered plan for the best possible "
                                 "result. Only the plan.", attachments=atts)
            prompt += "\n\nFollow this plan:\n" + plan
        out = providers.ask(self.run, system, prompt, json_mode=json_mode, attachments=atts)
        if self.model.get("review") and not providers.fake():
            fixed = providers.ask(self.run, system + REVIEW, prompt + "\n\nDraft:\n" + out, json_mode=json_mode)
            if (json_mode and fixed.strip()) or (not json_mode and (FILE_RE.search(fixed) or not FILE_RE.search(out))):
                out = fixed
        return out


# --- routing -------------------------------------------------------------------

def guess_agents(text):
    """Keyword routing, used in fake mode and when the router fails."""
    t = text.lower()
    for agent_id, pattern in KEYWORDS:
        if re.search(pattern, t):
            return [{"agent": agent_id, "task": text}]
    return []


def route(job):
    """[{"agent", "task"}] for the request (may be empty)."""
    if providers.fake():
        return guess_agents(job.prompt)
    listing = "\n".join("- %s: %s" % (a["id"], a["about"]) for a in config.AGENTS)
    try:
        out = parse_json(providers.ask(config.provider_model("one-1-mini"), ROUTER % listing,
                                       job.context(job.prompt), json_mode=True))
        tasks = out.get("tasks") if isinstance(out, dict) else out
        tasks = [t for t in tasks or [] if isinstance(t, dict) and config.agent(t.get("agent"))][:3]
        for t in tasks:
            t["task"] = str(t.get("task") or job.prompt)[:6000]
        return tasks
    except (providers.ProviderError, ValueError, AttributeError):
        return guess_agents(job.prompt)


# --- agents ----------------------------------------------------------------------

def files_from_text(job, agent_id, task, default_name):
    text, raw = parse_files(job.write(agent_id, task))
    if not raw and agent_id != "filegent" and "<" in text:
        # A model that forgot the markers but wrote the document anyway.
        m = re.search(r"(<!doctype html.*</html>|<svg.*</svg>)", text, re.S | re.I)
        if m:
            raw = [(default_name, m.group(1).encode())]
    return text, raw


def run_filegent(job, task):
    text, raw = files_from_text(job, "filegent", task, "fil.txt")
    if not raw:
        raise ValueError("Filegent made no file.")
    return text, [convert(n, d, "filegent") for n, d in raw[:20]]


def run_appagent(job, task):
    text, raw = files_from_text(job, "appagent", task, "index.html")
    page = next((d for n, d in raw if n.lower().endswith((".html", ".htm"))), None)
    if not page:
        raise ValueError("Appagent made no app.")
    title = re.search(rb"<title[^>]*>([^<]{1,80})</title>", page, re.I)
    name = title.group(1).decode("utf-8", "replace").strip() if title else "App"
    base = slug(name, "app")
    return text, [make_file(base + ".html", page, "appagent"),
                  make_file(base + "-webbapp.zip", F.pwa_zip(page.decode("utf-8", "replace"), name), "appagent")]


def run_sitegent(job, task):
    text, raw = files_from_text(job, "sitegent", task, "index.html")
    if not any(n.lower().endswith(".html") for n, _ in raw):
        raise ValueError("Sitegent made no pages.")
    if not any(n.lower() == "index.html" for n, _ in raw):
        n0 = next(n for n, _ in raw if n.lower().endswith(".html"))
        raw = [("index.html" if n == n0 else n, d) for n, d in raw]
    index = next(d for n, d in raw if n.lower() == "index.html")
    title = re.search(rb"<title[^>]*>([^<]{1,80})</title>", index, re.I)
    base = slug(title.group(1).decode("utf-8", "replace") if title else "webbplats", "webbplats")
    return text, [make_file(base + ".zip", F.zip_files(raw), "sitegent"), make_file("index.html", index, "sitegent")]


def run_formegent(job, task):
    text, raw = files_from_text(job, "formegent", task, "index.html")
    page = next((d for n, d in raw if n.lower().endswith(".html")), None)
    if not page:
        raise ValueError("Formegent made no form.")
    title = re.search(rb"<title[^>]*>([^<]{1,80})</title>", page, re.I)
    return text, [make_file(slug(title.group(1).decode("utf-8", "replace") if title else "formular", "formular") + ".html",
                            page, "formegent")]


def run_designgent(job, task):
    text, raw = files_from_text(job, "designgent", task, "design.svg")
    svgs = [(n if n.lower().endswith(".svg") else n + ".svg", d) for n, d in raw if b"<svg" in d[:2000]]
    if not svgs:
        raise ValueError("Designgent made no design.")
    return text, [make_file(n, d, "designgent") for n, d in svgs[:4]]


def run_presegent(job, task):
    if providers.fake():
        deck = {"title": task[:60], "theme": {"background": "#ffffff", "text": "#1f1f1f", "accent": "#10a37f"},
                "slides": [{"title": task[:60], "subtitle": "One AI"}, {"title": "Agenda", "bullets": ["Bakgrund", "Förslag", "Nästa steg"]}]}
    else:
        deck = parse_json(job.write("presegent", task, json_mode=True))
    if not isinstance(deck, dict) or not deck.get("slides"):
        raise ValueError("Presegent made no slides.")
    base = slug(str(deck.get("title") or "presentation"), "presentation")
    return "", [make_file(base + ".pptx", F.pptx_from_slides(deck), "presegent"),
                make_file(base + ".html", F.html_deck(deck).encode(), "presegent")]


def run_inboxagent(job, task):
    if providers.fake():
        out = {"emails": [{"to": "", "subject": "Hej", "body": "Hej!\n\n%s\n\nVänliga hälsningar" % task[:200]}], "summary": ""}
    else:
        out = parse_json(job.write("inboxagent", task, json_mode=True))
    mails = [m for m in (out.get("emails") if isinstance(out, dict) else None) or [] if isinstance(m, dict)][:10]
    if not mails:
        raise ValueError("Inboxagent wrote no e-mail.")
    result = []
    for i, m in enumerate(mails, 1):
        name = "%s.eml" % slug(str(m.get("subject") or "mejl-%d" % i), "mejl")
        result.append(make_file(name, F.eml(m.get("to"), m.get("subject"), m.get("body"), m.get("cc")), "inboxagent"))
    return str(out.get("summary") or ""), result


FAKE_SCORE = {"title": "Exempel", "tempo": 112, "tracks": [
    {"instrument": "piano", "notes": [[n, i, 1, .7] for i, n in enumerate(["C4", "E4", "G4", "E4", "F4", "A4", "G4", "E4"])]},
    {"instrument": "bass", "notes": [["C2", 0, 4, .8], ["F2", 4, 4, .8]]},
    {"instrument": "drums", "notes": [["kick", b, .5, .9] for b in range(8)] + [["snare", b + 1, .5, .7] for b in range(0, 8, 2)]}]}


def run_musigent(job, task):
    media = config.media_model("musigent")
    try:
        mime, data, lyrics = providers.music(media, task)
        ext = "wav" if "wav" in mime else "mp3"
        return lyrics[:2000], [make_file("%s.%s" % (slug(task, "lat"), ext), data, "musigent")]
    except providers.ProviderError:
        pass  # compose and synthesize it ourselves
    score = FAKE_SCORE if providers.fake() else parse_json(job.write("musigent", task, json_mode=True))
    if not isinstance(score, dict) or not score.get("tracks"):
        raise ValueError("Musigent wrote no music.")
    base = slug(str(score.get("title") or task), "lat")
    return "", [make_file(base + ".wav", F.wav_from_score(score), "musigent"),
                make_file(base + ".mid", F.midi_from_score(score), "musigent")]


FAKE_SCENE = {"title": "Raket", "parts": [
    {"shape": "cylinder", "scale": [1, 2.2, 1], "position": [0, 1.6, 0], "color": "#eeeeee"},
    {"shape": "cone", "scale": [1, 1, 1], "position": [0, 3.2, 0], "color": "#e5484d"},
    {"shape": "box", "scale": [.12, .8, .7], "position": [.55, .6, 0], "rotation": [0, 0, -15], "color": "#e5484d"},
    {"shape": "box", "scale": [.12, .8, .7], "position": [-.55, .6, 0], "rotation": [0, 0, 15], "color": "#e5484d"},
    {"shape": "torus", "scale": [1.05, 1.05, 1.05], "position": [0, 1.1, 0], "color": "#ffd23a"}]}


def run_modelgent(job, task):
    scene = FAKE_SCENE if providers.fake() else parse_json(job.write("modelgent", task, json_mode=True))
    if not isinstance(scene, dict):
        raise ValueError("Modelgent made no model.")
    return "", [make_file(slug(str(scene.get("title") or task), "modell") + ".glb", F.glb_from_scene(scene), "modelgent")]


def run_imagent(job, task):
    weak = "imagent" in job.plan["weak"]
    mime, data = providers.image(config.media_model("imagent", weak), task, first_image(job.attachments))
    ext = {"image/jpeg": "jpg", "image/webp": "webp"}.get(mime, "png")
    return "", [make_file("%s.%s" % (slug(task, "bild"), ext), base64.b64decode(data), "imagent")]


def run_vidagent(job, task):
    t = task.lower()
    aspect = "9:16" if re.search(r"9:16|vertikal|stående|portrait|tiktok|reels|shorts", t) else "16:9"
    data = providers.video(config.media_model("vidagent"), task, aspect, first_image(job.attachments))
    return "", [make_file(slug(task, "video") + ".mp4", data, "vidagent")]


RUNNERS = {"filegent": run_filegent, "imagent": run_imagent, "vidagent": run_vidagent, "appagent": run_appagent,
           "presegent": run_presegent, "formegent": run_formegent, "sitegent": run_sitegent,
           "inboxagent": run_inboxagent, "musigent": run_musigent, "modelgent": run_modelgent,
           "designgent": run_designgent}


def run_agents(job, tasks, log=None):
    """Runs the tasks in parallel. Returns [{"agent", "ok", "text", "files",
    "error"}] in task order."""
    def one(t):
        try:
            text, made = RUNNERS[t["agent"]](job, t["task"])
            return {"agent": t["agent"], "ok": True, "text": text, "files": made}
        except (providers.ProviderError, ValueError) as e:
            if log:
                log("agent %s failed: %s" % (t["agent"], e))
            return {"agent": t["agent"], "ok": False, "text": "", "files": [], "error": str(e)}
    if len(tasks) == 1:
        return [one(tasks[0])]
    with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
        return list(pool.map(one, tasks))


# --- chat ------------------------------------------------------------------------

def contents_for(job):
    """The conversation as model input; attachments go with the last message."""
    contents = []
    for m in job.messages[-24:]:
        role = "user" if m.get("role") == "user" else "model"
        parts = [{"text": m.get("text") or " "}]
        if contents and contents[-1]["role"] == role:
            contents[-1]["parts"] += parts
        else:
            contents.append({"role": role, "parts": parts})
    if contents and contents[0]["role"] != "user":
        contents.insert(0, {"role": "user", "parts": [{"text": "(tidigare konversation)"}]})
    contents[-1]["parts"] += attachment_parts(job.attachments)
    for f in job.context_files[:8]:
        contents[-1]["parts"].append({"text": 'Earlier file "%s":\n%s' % (f["name"], f["text"][:120_000])})
    return contents


def chat(job, log=None):
    """A normal chat answer, with MCP tool calls when tools are connected.
    Returns (text, files, tool_calls)."""
    system = identity(job.model_id) + "\n\n" + SYSTEMS["chat"]
    contents = contents_for(job)
    decls = job.mcp_tools.declarations() if job.mcp_tools else None
    calls = []
    for _ in range(MAX_TOOL_ROUNDS):
        parts = providers.generate(job.run, system, contents, tools=decls or None)
        fcalls = [p["functionCall"] for p in parts if "functionCall" in p]
        if not fcalls:
            break
        contents.append({"role": "model", "parts": parts})
        responses = []
        for fc in fcalls:
            result, label = job.mcp_tools.call(fc.get("name"), fc.get("args") or {})
            calls.append(label)
            responses.append({"functionResponse": {"name": fc.get("name"), "response": result}})
        contents.append({"role": "user", "parts": responses})
    else:
        parts = providers.generate(job.run, system, contents)
    text, raw = parse_files(providers.text_of(parts))
    return text, [convert(n, d, "filegent") for n, d in raw[:20]], calls


def summarize(job, results):
    """The reply after agents ran: short, in the user's language."""
    made = []
    for r in results:
        name = config.agent(r["agent"])["name"]
        if r["ok"]:
            made.append("%s made: %s. %s" % (name, ", ".join(f["name"] for f in r["files"]), r["text"][:1500]))
        else:
            made.append("%s failed." % name)
    if providers.fake():
        return "%s Klart. %s" % (providers.FAKE_MARK, " ".join(made))
    prompt = ("The user asked:\n%s\n\nOne AI's agents did this:\n%s\n\nWrite the reply to the user: 2-5 sentences presenting "
              "what was made and how to use it (the files are attached below your reply, so don't paste their content or "
              "links). If something failed, say so plainly." % (job.prompt, "\n".join(made)))
    return providers.ask(job.run, identity(job.model_id), prompt)
