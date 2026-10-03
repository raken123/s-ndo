// Agent Mode: the character leaves the window and helps with tasks.
// Tools the AI can call during a Live session, plus the to-do list / notes / timers they act on.
// Web lookups use Wikipedia and the BFDI wiki (free APIs that allow app access) because the
// free Gemini key has no Google Search grounding.

const KEY = 'bfdi.agent.v1';
const uid = () => Math.random().toString(36).slice(2, 9);

export const AGENT_TOOLS = [
  {
    name: 'look_up',
    description: 'Look something up and get a short factual summary. Use source "bfdi_wiki" for anything about Battle for Dream Island / object shows (characters, episodes, eliminations, voting) and "wikipedia" for everything else.',
    parameters: { type: 'OBJECT', properties: {
      query: { type: 'STRING', description: 'What to look up, e.g. "Firey" or "Eiffel Tower".' },
      source: { type: 'STRING', enum: ['wikipedia', 'bfdi_wiki'] },
    }, required: ['query', 'source'] },
  },
  {
    name: 'search_in_browser',
    description: 'Open a Google search in the user\'s web browser (for things look_up can\'t answer, like shopping, news or videos).',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] },
  },
  {
    name: 'open_website',
    description: 'Open a website in the user\'s browser. Only when the user asks for a site.',
    parameters: { type: 'OBJECT', properties: { url: { type: 'STRING', description: 'Full https:// address.' } }, required: ['url'] },
  },
  {
    name: 'set_timer',
    description: 'Start a countdown timer. You will be told when it finishes.',
    parameters: { type: 'OBJECT', properties: {
      seconds: { type: 'NUMBER', description: 'Length in seconds (max 24 hours).' },
      label: { type: 'STRING', description: 'What it is for, e.g. "pizza".' },
    }, required: ['seconds', 'label'] },
  },
  { name: 'cancel_timer', description: 'Cancel a running timer by its label.', parameters: { type: 'OBJECT', properties: { label: { type: 'STRING' } }, required: ['label'] } },
  { name: 'add_task', description: 'Add an item to the user\'s to-do list.', parameters: { type: 'OBJECT', properties: { text: { type: 'STRING' } }, required: ['text'] } },
  { name: 'complete_task', description: 'Tick off a to-do item (match by its text).', parameters: { type: 'OBJECT', properties: { text: { type: 'STRING' } }, required: ['text'] } },
  { name: 'remove_task', description: 'Delete a to-do item (match by its text).', parameters: { type: 'OBJECT', properties: { text: { type: 'STRING' } }, required: ['text'] } },
  { name: 'list_tasks', description: 'Get the to-do list and running timers.', parameters: { type: 'OBJECT', properties: {} } },
  {
    name: 'write_note',
    description: 'Save a note (a list, a draft, an idea, homework notes...) and copy it to the clipboard.',
    parameters: { type: 'OBJECT', properties: { title: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['title', 'text'] },
  },
  { name: 'copy_to_clipboard', description: 'Copy text to the user\'s clipboard.', parameters: { type: 'OBJECT', properties: { text: { type: 'STRING' } }, required: ['text'] } },
  { name: 'get_date_time', description: 'Get the current local date and time.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'look_at_screen', description: 'Start seeing the user\'s screen (1 picture per second) so you can help with what is on it. Pro feature.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'stop_looking_at_screen', description: 'Stop seeing the user\'s screen.', parameters: { type: 'OBJECT', properties: {} } },
];

export function agentPrompt(name) {
  return `AGENT MODE: You (${name}) have walked out of the BFDI Talk window onto the user's screen to be their helper buddy. Help with real tasks using your tools: timers, a to-do list, notes, copying text, opening websites or a browser search, looking things up (Wikipedia or the BFDI wiki), the date/time, and (Pro) looking at their screen. Use a tool whenever it helps instead of guessing, then say in one short, cheerful sentence what you did. Facts from look_up beat your memory. Stay in character, keep it short, and be careful: only open websites the user asked for.`;
}

function cleanHtml(html) {
  return html
    .replace(/<(table|aside|figure|style|script|sup)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

/** Short summary from Wikipedia or the BFDI wiki. */
export async function lookUp(query, source, fetchImpl = fetch) {
  const base = source === 'bfdi_wiki' ? 'https://battlefordreamisland.fandom.com/api.php' : 'https://en.wikipedia.org/w/api.php';
  const q = new URLSearchParams({ action: 'query', list: 'search', srsearch: query, srlimit: '3', format: 'json', origin: '*' });
  const found = await (await fetchImpl(`${base}?${q}`)).json();
  const hits = found?.query?.search || [];
  if (!hits.length) return { found: false, message: `Nothing found for "${query}".` };
  const title = hits[0].title;
  let summary = '';
  if (source === 'bfdi_wiki') {
    const p = new URLSearchParams({ action: 'parse', page: title, prop: 'text', section: '0', format: 'json', origin: '*', disabletoc: '1' });
    const page = await (await fetchImpl(`${base}?${p}`)).json();
    summary = cleanHtml(page?.parse?.text?.['*'] || '');
  } else {
    const page = await (await fetchImpl(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)).json();
    summary = page?.extract || '';
  }
  return {
    found: true,
    title,
    source: source === 'bfdi_wiki' ? 'BFDI Wiki' : 'Wikipedia',
    summary: summary.slice(0, 1800),
    other_matches: hits.slice(1).map(h => h.title),
  };
}

const fmtSecs = s => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

/**
 * Agent state + tool runner. ctx: { openExternal, copy(text), startScreen() -> Promise<string>,
 * stopScreen(), isPro() }. Events: change, timerDone {label}.
 */
export class AgentKit extends EventTarget {
  constructor(ctx, storage = globalThis.localStorage, fetchImpl = (...a) => fetch(...a)) {
    super();
    this.ctx = ctx;
    this.storage = storage;
    this.fetch = fetchImpl;
    this.state = this.load();
    this.tick = setInterval(() => this.checkTimers(), 1000);
  }

  load() {
    try {
      const s = JSON.parse(this.storage.getItem(KEY));
      if (s && Array.isArray(s.tasks)) return { tasks: s.tasks, notes: s.notes || [], timers: s.timers || [] };
    } catch { /* fresh */ }
    return { tasks: [], notes: [], timers: [] };
  }

  save() {
    try { this.storage.setItem(KEY, JSON.stringify(this.state)); } catch { /* full */ }
    this.dispatchEvent(new Event('change'));
  }

  checkTimers(now = Date.now()) {
    if (this.paused) return; // another window (the desktop buddy) owns the timers right now
    const done = this.state.timers.filter(t => t.endsAt <= now);
    if (!done.length) return;
    this.state.timers = this.state.timers.filter(t => t.endsAt > now);
    this.save();
    for (const t of done) this.dispatchEvent(Object.assign(new Event('timerDone'), { detail: { label: t.label } }));
  }

  findTask(text) {
    const t = String(text || '').toLowerCase().trim();
    return this.state.tasks.find(x => x.text.toLowerCase() === t)
      || this.state.tasks.find(x => x.text.toLowerCase().includes(t) || t.includes(x.text.toLowerCase()));
  }

  summary() {
    const now = Date.now();
    return {
      tasks: this.state.tasks.map(t => `${t.done ? '[x]' : '[ ]'} ${t.text}`),
      timers: this.state.timers.map(t => `${t.label}: ${fmtSecs(Math.max(0, Math.round((t.endsAt - now) / 1000)))} left`),
    };
  }

  /** Runs one tool call from the AI. Returns a JSON-able result for the model. */
  async run(name, args) {
    switch (name) {
      case 'look_up':
        return lookUp(String(args.query || ''), args.source === 'bfdi_wiki' ? 'bfdi_wiki' : 'wikipedia', this.fetch);
      case 'search_in_browser': {
        const q = String(args.query || '').trim();
        if (!q) return { error: 'Empty search.' };
        this.ctx.openExternal(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
        return { opened: `Google search for "${q}"` };
      }
      case 'open_website': {
        let url = String(args.url || '').trim();
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
        try { url = new URL(url).toString(); } catch { return { error: 'That is not a valid web address.' }; }
        this.ctx.openExternal(url);
        return { opened: url };
      }
      case 'set_timer': {
        const secs = Math.round(Number(args.seconds));
        if (!(secs > 0) || secs > 86400) return { error: 'Timers can be 1 second to 24 hours.' };
        const label = String(args.label || 'timer').slice(0, 40);
        this.state.timers.push({ id: uid(), label, endsAt: Date.now() + secs * 1000 });
        this.save();
        return { started: label, duration: fmtSecs(secs) };
      }
      case 'cancel_timer': {
        const l = String(args.label || '').toLowerCase();
        const before = this.state.timers.length;
        this.state.timers = this.state.timers.filter(t => !t.label.toLowerCase().includes(l));
        this.save();
        return before > this.state.timers.length ? { cancelled: args.label } : { error: `No timer called "${args.label}".` };
      }
      case 'add_task': {
        const text = String(args.text || '').trim().slice(0, 140);
        if (!text) return { error: 'Empty task.' };
        this.state.tasks.push({ id: uid(), text, done: false });
        this.save();
        return { added: text, open_tasks: this.state.tasks.filter(t => !t.done).length };
      }
      case 'complete_task': {
        const t = this.findTask(args.text);
        if (!t) return { error: `No task like "${args.text}".`, tasks: this.summary().tasks };
        t.done = true;
        this.save();
        return { completed: t.text };
      }
      case 'remove_task': {
        const t = this.findTask(args.text);
        if (!t) return { error: `No task like "${args.text}".`, tasks: this.summary().tasks };
        this.state.tasks = this.state.tasks.filter(x => x !== t);
        this.save();
        return { removed: t.text };
      }
      case 'list_tasks':
        return this.summary();
      case 'write_note': {
        const note = { id: uid(), title: String(args.title || 'Note').slice(0, 60), text: String(args.text || '').slice(0, 4000), at: Date.now() };
        this.state.notes.unshift(note);
        this.state.notes = this.state.notes.slice(0, 30);
        this.save();
        const copied = await this.ctx.copy(`${note.title}\n\n${note.text}`).then(() => true, () => false);
        return { saved: note.title, copied_to_clipboard: copied };
      }
      case 'copy_to_clipboard': {
        const ok = await this.ctx.copy(String(args.text || '')).then(() => true, () => false);
        return ok ? { copied: true } : { error: 'Could not reach the clipboard.' };
      }
      case 'get_date_time': {
        const d = new Date();
        return { local: d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      }
      case 'look_at_screen':
        if (!this.ctx.isPro()) return { error: 'Seeing the screen is a Pro feature. Tell the user they can try Pro free for 7 days.' };
        return { result: await this.ctx.startScreen() };
      case 'stop_looking_at_screen':
        this.ctx.stopScreen();
        return { result: 'stopped' };
      default:
        return { error: `Unknown tool ${name}` };
    }
  }

  // ---- panel actions (buttons)
  toggleTask(id) { const t = this.state.tasks.find(x => x.id === id); if (t) { t.done = !t.done; this.save(); } }
  deleteTask(id) { this.state.tasks = this.state.tasks.filter(x => x.id !== id); this.save(); }
  deleteNote(id) { this.state.notes = this.state.notes.filter(x => x.id !== id); this.save(); }
  cancelTimer(id) { this.state.timers = this.state.timers.filter(x => x.id !== id); this.save(); }
  clearDone() { this.state.tasks = this.state.tasks.filter(x => !x.done); this.save(); }
}

export { fmtSecs };
