/* Motey – state, demo meetings and persistence (localStorage). */
(function () {
  'use strict';
  const KEY = 'motey.v1';
  const DAY = 864e5;

  function at(daysFromToday, hh, mm) {
    const d = new Date();
    d.setHours(hh, mm || 0, 0, 0);
    return new Date(d.getTime() + daysFromToday * DAY).toISOString();
  }
  function lines(txt) {
    return txt.trim().split('\n').map(l => {
      const i = l.indexOf(':');
      return { who: l.slice(0, i).trim(), text: l.slice(i + 1).trim() };
    });
  }

  const DEMO_IDS = ['nova-1', 'nova-2', 'fin-1', 'boss-1'];
  function demoMeetings(user, boss) {
    const lastWeekday = -6;
    return [
      {
        id: 'nova-1', demo: true, title: 'Veckomöte – Projekt Nova', series: 'nova', start: at(lastWeekday, 9), durationMin: 45,
        attendees: [boss, 'Ali', 'Sara', user], boss, attended: false,
        transcript: lines(`
${boss}: Godmorgon allihop. ${user} är inte här idag, så vi tar det kort.
Ali: Designen för appen är klar och testgruppen gillade den.
${boss}: Bra. Då är designen godkänd. Vi bestämde att lanseringen flyttas till den 14 november.
Sara: Kunderna i Göteborg vill ha en demo innan dess, helst vecka 44.
${boss}: Sara ansvarar för demon i Göteborg. Budgeten för marknadsföring ligger på 120 000 kr.
Ali: Vi har använt ungefär 45 procent av budgeten hittills.
${boss}: ${user} ska skicka Kundrapport_Q3.pdf och Budget_Nova.xlsx till mig senast fredag.
Sara: Vi behöver också uppdatera supportsidan innan lanseringen.
${boss}: Viktigt: alla ska testa betalflödet på sina egna telefoner till nästa möte.
Ali: Jag tar fram en checklista för testningen.
${boss}: Toppen. Nästa möte är samma tid nästa vecka. Tack allihop!`),
        files: [
          { name: 'Kundrapport_Q3.pdf', status: 'missing', owner: user },
          { name: 'Budget_Nova.xlsx', status: 'missing', owner: user }
        ]
      },
      {
        id: 'nova-2', demo: true, title: 'Veckomöte – Projekt Nova', series: 'nova', start: at(0, new Date().getHours() + 1), durationMin: 45,
        attendees: [boss, 'Ali', 'Sara', user], boss, attended: null, transcript: [], files: []
      },
      {
        id: 'fin-1', demo: true, title: 'Finansmöte – F-skatt, moms & budget', series: 'fin', start: at(-1, 13), durationMin: 60,
        attendees: ['Lena (ekonomi)', boss, user], boss, attended: true,
        transcript: lines(`
Lena (ekonomi): Välkomna! Idag går vi igenom skatterna inför nästa kvartal.
Lena (ekonomi): Först F-skatt. Konsulterna vi anlitar måste ha F-skatt, annars måste vi dra skatt och betala arbetsgivaravgifter åt dem.
${boss}: Kolla alltid att leverantören har F-skatt innan vi betalar en faktura.
Lena (ekonomi): Sen momsen. Vi lägger 25 procent moms på våra tjänster och momsdeklarationen ska in den 12:e varje månad.
${user}: Kan vi dra av momsen på det nya kontorsmaterialet?
Lena (ekonomi): Ja, ingående moms på inköp i verksamheten får vi dra av.
Lena (ekonomi): Arbetsgivaravgifterna är ungefär 31 procent ovanpå bruttolönen, så en lön på 40 000 kr kostar runt 52 600 kr.
${boss}: Budgeten för nästa kvartal är 2,4 miljoner kr och vi får inte gå över den.
Lena (ekonomi): Likviditeten är okej, men kassaflödet blir tajt i december när bonusarna betalas ut.
${boss}: Beslut: vi skickar alla fakturor inom 5 dagar efter leverans för att förbättra kassaflödet.
Lena (ekonomi): Bokslutet görs i januari, så alla kvitton måste vara inne senast 15 januari.
${boss}: ${user}, du ska gå igenom leverantörslistan och kontrollera F-skatt för alla konsulter.`),
        files: [{ name: 'Leverantörslista.xlsx', status: 'missing', owner: user }]
      },
      {
        id: 'boss-1', demo: true, title: 'Kvartalsgenomgång med Gunnar', series: 'gunnar', start: at(-3, 15), durationMin: 30,
        attendees: ['Gunnar (chef)', user], boss: 'Gunnar (chef)', attended: true,
        transcript: lines(`
Gunnar (chef): Det här är helt oacceptabelt! Försäljningen ligger 12 procent under målet.
Gunnar (chef): Jag vill ha en ny plan på mitt bord i morgon bitti, inga ursäkter.
${user}: Vi har haft problem med leveranserna från lagret.
Gunnar (chef): Det är inte mitt problem. Ni måste lösa det själva, omedelbart!
Gunnar (chef): Och varför har ingen svarat på mitt mejl från i måndags?
Gunnar (chef): Från och med nu vill jag ha en statusrapport varje fredag klockan 15.
Gunnar (chef): Om siffrorna inte är bättre nästa månad blir det en allvarlig diskussion.
Gunnar (chef): Skärpning nu. Mötet är slut.`),
        files: []
      }
    ];
  }

  const defaults = () => ({
    version: 1,
    onboarded: false,
    settings: {
      name: 'Ronny', bossName: 'Birgitta', bossEmail: '',
      autoSend: true, sendMethod: 'email', webhookUrl: '',
      apiKey: '', model: 'claude-opus-5-5',
      voice: true, liveStyle: 'snall', theme: 'auto',
      demo: true, showDemo: false, color: '#6C4CF5', relays: '', turnUrl: '', turnUser: '', turnPass: ''
    },
    meetings: [],
    rooms: [],
    outbox: [],
    stats: { wallsBroken: 0, videos: 0, restyled: 0 }
  });

  let state;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = Object.assign(defaults(), JSON.parse(raw));
    } catch (e) { /* storage blocked – start fresh */ }
    if (!state) state = defaults();
    state.settings = Object.assign(defaults().settings, state.settings);
    state.meetings.forEach(m => { if (DEMO_IDS.includes(m.id)) m.demo = true; });
    if (!state.meetings.some(m => m.demo)) state.meetings = state.meetings.concat(demoMeetings(state.settings.name, state.settings.bossName));
    return state;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota or blocked */ }
  }
  function reset() {
    const real = state ? state.meetings.filter(m => m.room) : [];
    const keep = state ? { settings: state.settings, rooms: state.rooms, outbox: state.outbox, onboarded: state.onboarded } : {};
    state = Object.assign(defaults(), keep);
    state.meetings = real.concat(demoMeetings(state.settings.name, state.settings.bossName));
    save();
  }
  // Meetings the user sees: real ones always, demo ones only while exploring.
  function visible() {
    return state.meetings.filter(m => !m.demo || state.settings.demo || state.settings.showDemo);
  }

  const byStart = (a, b) => new Date(a.start) - new Date(b.start);
  function meeting(id) { return state.meetings.find(m => m.id === id); }
  function sorted() { return visible().slice().sort(byStart); }
  function isPast(m) { return new Date(m.start).getTime() + (m.durationMin || 30) * 6e4 < Date.now(); }
  function previousInSeries(m) {
    if (!m.series) return null;
    return sorted().filter(x => x.series === m.series && new Date(x.start) < new Date(m.start)).pop() || null;
  }
  // The next upcoming meeting whose previous session in the series was missed.
  function pendingCatchUp() {
    const upcoming = sorted().filter(m => !isPast(m));
    for (const m of upcoming) {
      const prev = previousInSeries(m);
      if (prev && prev.attended === false && !prev.caughtUp) return { next: m, prev };
    }
    return null;
  }
  function addMeeting(m) {
    m.id = m.id || 'm' + Date.now().toString(36);
    state.meetings.push(m);
    save();
    return m;
  }
  function removeMeeting(id) {
    state.meetings = state.meetings.filter(m => m.id !== id);
    save();
  }

  /* Transcript import: plain "Namn: text", WebVTT (Teams/Zoom/Meet) and SRT. */
  function parseTranscript(raw) {
    const out = [];
    const txt = String(raw || '').replace(/\r/g, '');
    const blocks = txt.split(/\n\s*\n/);
    const isCaption = /^WEBVTT/.test(txt) || /-->/.test(txt);
    if (isCaption) {
      for (const b of blocks) {
        const ls = b.split('\n').filter(l => l.trim() && !/-->/.test(l) && !/^\d+$/.test(l.trim()) && !/^WEBVTT/.test(l) && !/^NOTE/.test(l));
        if (!ls.length) continue;
        let text = ls.join(' ');
        let who = 'Talare';
        const v = text.match(/<v\s+([^>]+)>/);
        if (v) { who = v[1].trim(); text = text.replace(/<[^>]+>/g, ''); }
        else {
          const c = text.match(/^([^:]{2,40}):\s*(.+)$/);
          if (c) { who = c[1].trim(); text = c[2]; }
        }
        text = text.replace(/<[^>]+>/g, '').trim();
        const last = out[out.length - 1];
        if (last && last.who === who) last.text += ' ' + text; else out.push({ who, text });
      }
      return out;
    }
    for (const l of txt.split('\n')) {
      if (!l.trim()) continue;
      const c = l.match(/^\s*([^:]{1,40}):\s*(.+)$/);
      if (c) out.push({ who: c[1].trim(), text: c[2].trim() });
      else if (out.length) out[out.length - 1].text += ' ' + l.trim();
      else out.push({ who: 'Talare', text: l.trim() });
    }
    return out;
  }

  window.Store = {
    load, save, reset, visible, meeting, sorted, isPast, previousInSeries, pendingCatchUp,
    addMeeting, removeMeeting, parseTranscript, demoMeetings,
    get state() { return state; },
    get settings() { return state.settings; }
  };
})();
