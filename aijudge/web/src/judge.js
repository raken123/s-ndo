/* judge.js — the AI that hears the case.

   Three routes to a verdict, tried in order:
     1. the game server's /api/judge proxy (the API key lives server-side),
     2. a Gemini key the player pasted into Settings (stored on device only),
     3. a local rule-based judge so a verdict always arrives, even offline.

   Free players are judged by the Lite model, VIP by the larger Flash model.
   The model ids live in MODELS and are the only place to change them. */
(function (global) {
  'use strict';

  const MODELS = {
    free: 'gemini-3.1-flash-lite',
    vip:  'gemini-3.6-flash'
  };

  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

  /* ---------------- the scenes ---------------- */

  /* Each scene puts the two litigants on opposite sides of one small, human
     dispute. Nothing futuristic — the hall runs on wood, brass and grievance. */
  const SCENES = [
    { t: 'The Last Cinnamon Bun',
      s: 'One bun remained in the staff kitchen. Both of you took a knife to it.',
      a: 'You bought the box on Monday and have eaten none of it.',
      b: 'You were the one who reached the plate first, fair and square.' },
    { t: 'The Inherited Piano',
      s: 'A grandmother left one upright piano and two grandchildren.',
      a: 'You are the one who actually plays it, badly but daily.',
      b: 'You are the one she taught on it, and you have not played in years.' },
    { t: 'The Borrowed Umbrella',
      s: 'An umbrella was borrowed in March. It is now August.',
      a: 'You lent it and want it back, plus an apology.',
      b: 'You borrowed it, lost it, and replaced it with a better one.' },
    { t: 'The Parking Space',
      s: 'Two cars nosed into the same space outside a bakery at the same second.',
      a: 'You were indicating first and had the angle.',
      b: 'Your front bumper crossed the line first and you have a witness.' },
    { t: 'The Thermostat',
      s: 'Two housemates, one dial, eleven degrees of disagreement.',
      a: 'You are always cold and pay the larger share of rent.',
      b: 'You are always hot and pay the entire heating bill.' },
    { t: 'The Wedding Speech',
      s: 'Both of you were promised the best-man speech by the same groom.',
      a: 'You have known him since you were six.',
      b: 'You have the better material and he asked you second, which is later.' },
    { t: 'The Dog Named Biscuit',
      s: 'A break-up left one dog and two devoted people.',
      a: 'You walk him every morning before work.',
      b: 'Your name is on the adoption papers.' },
    { t: 'The Recipe',
      s: 'A soup recipe went viral under one name. Two cooks claim it.',
      a: 'You wrote it down first, in a notebook, with a date.',
      b: 'You invented it out loud in a kitchen while the other took notes.' },
    { t: 'The Fence Line',
      s: 'A hedge has moved forty centimetres over thirty years.',
      a: 'You planted it and have trimmed it every spring.',
      b: 'The deed is on your side and you have a surveyor.' },
    { t: 'The Karaoke Slot',
      s: 'One slot left before closing time. Two singers, one microphone.',
      a: 'You signed the list first but stepped out for air.',
      b: 'You are here, in front of the machine, holding the microphone.' },
    { t: 'The Overhead Bin',
      s: 'One bin, one bag too many, an aircraft that will not push back.',
      a: 'Your seat is directly beneath it and you boarded in your group.',
      b: 'Your bag was in it before anyone else sat down.' },
    { t: 'The Group Photograph',
      s: 'Somebody blinked. Somebody insists on a retake. The light is going.',
      a: 'You want one more frame because you blinked in this one.',
      b: 'You want to go inside because everyone is cold and it was fine.' },
    { t: 'The Nickname',
      s: 'Two people in one office answer to the same nickname.',
      a: 'You have had it since school and it is on your mug.',
      b: 'You arrived later but the whole floor already calls you it.' },
    { t: 'The Split Bill',
      s: 'A long table, a longer bill, and a disagreement about arithmetic.',
      a: 'You want to split it evenly because that is simpler and kinder.',
      b: 'You had a salad and tap water and would like to pay for that.' },
    { t: 'The Loud Practice',
      s: 'Someone practises drums at seven in the morning. Above someone else.',
      a: 'You practise because the audition is in nine days.',
      b: 'You work nights and have not slept properly since March.' },
    { t: 'The Found Wallet',
      s: 'A wallet was found on a bench by two people at the same moment.',
      a: 'You saw it first and said so out loud.',
      b: 'You picked it up and took it to the counter.' },
    { t: 'The Aisle Seat',
      s: 'A booking system gave one aisle seat to two confirmations.',
      a: 'You booked eleven weeks ago and are very tall.',
      b: 'You booked yesterday, paid extra for it, and have a bad knee.' },
    { t: 'The Christmas Ornament',
      s: 'One glass bird, painted by a parent, and two boxes marked "mine".',
      a: 'You hung it every year and know which branch it goes on.',
      b: 'It was made the year you were born and has your name on the wing.' },
    { t: 'The Café Table',
      s: 'A coat on a chair versus a person standing with a full tray.',
      a: 'Your coat has held that table for twenty minutes.',
      b: 'You have hot food and there is nowhere else in the room.' },
    { t: 'The Same Idea',
      s: 'Two colleagues pitched the same plan in the same meeting, minutes apart.',
      a: 'You said it first, quietly, and nobody heard.',
      b: 'You said it second, clearly, and the room agreed.' },
    { t: 'The Shared Bicycle',
      s: 'One bicycle, two commutes, and a chain that keeps coming off.',
      a: 'You bought it and never got the receipt back.',
      b: 'You maintain it and have replaced almost every part.' },
    { t: 'The Volume of the Television',
      s: 'A long-married pair, one remote, and a film neither will pause.',
      a: 'You cannot hear the dialogue at anything under twenty-two.',
      b: 'You can hear it perfectly at fourteen and the neighbours can too.' },
    { t: 'The Line at the Bakery',
      s: 'A queue formed twice, in two directions, from one confusing door.',
      a: 'You have been standing here for eleven minutes on the correct side.',
      b: 'You arrived earlier and joined the line everyone else was in.' },
    { t: 'The Borrowed Suit',
      s: 'A suit came back from a wedding with a stain and a missing button.',
      a: 'You lent it in perfect condition and it was your father\'s.',
      b: 'You returned it cleaned and the button was already loose.' },
    { t: 'The Cat That Visits',
      s: 'One cat, two houses, two bowls, and two people who call it theirs.',
      a: 'It sleeps at yours and you pay for its medicine.',
      b: 'It eats at yours, was named by you, and came to you first.' },
    { t: 'The Draft Email',
      s: 'A sharply worded email was sent from a shared account at midnight.',
      a: 'You wrote it but insist you never pressed send.',
      b: 'You pressed send but insist you never read what it said.' },
    { t: 'The Window Seat',
      s: 'A long train, low sun, and one seat with a view of the water.',
      a: 'You reserved it and have the printed ticket.',
      b: 'You are travelling with a child who has never seen the sea.' },
    { t: 'The Punchline',
      s: 'A joke landed beautifully at a party. Two people claim to have made it.',
      a: 'You set it up and consider the setup the harder half.',
      b: 'You delivered the last four words and got the laugh.' },
    { t: 'The Garden Shed',
      s: 'A shed straddles a boundary that nobody measured in 1974.',
      a: 'You built it, painted it and store your tools in it.',
      b: 'It stands on your soil and blocks your afternoon light.' },
    { t: 'The Playlist',
      s: 'A six-hour drive and one auxiliary cable, contested at every junction.',
      a: 'You are driving and hold that the driver chooses.',
      b: 'You navigated, paid for fuel, and made the playlist in advance.' },
    { t: 'The Late Reply',
      s: 'A message went unanswered for nine days and a friendship is on trial.',
      a: 'You were unwell and did not want to explain it in writing.',
      b: 'You asked something that mattered and heard nothing at all.' },
    { t: 'The Trophy Shelf',
      s: 'A club has one cabinet and two teams that both finished the season unbeaten.',
      a: 'Your team won more matches but played in the lower division.',
      b: 'Your team won fewer but beat everyone in the higher one.' },
    { t: 'The Handwriting',
      s: 'A note left on a windscreen has become the subject of a hearing.',
      a: 'You wrote it and maintain it was polite.',
      b: 'You received it and maintain it was not.' },
    { t: 'The Second Helping',
      s: 'A pot of stew, eight guests, and a ladle wielded with enthusiasm.',
      a: 'You cooked it for six hours and served yourself last.',
      b: 'You brought the wine, ate one bowl, and watched the pot empty.' },
    { t: 'The Alarm Clock',
      s: 'One alarm, two sleepers, and a snooze button worn smooth.',
      a: 'You set it early because you refuse to rush in the morning.',
      b: 'You need the extra nine minutes more than you need breakfast.' },
    { t: 'The Old Oak',
      s: 'A tree on a shared lane drops acorns on one roof and shade on another.',
      a: 'You want it felled because the gutters are ruined every autumn.',
      b: 'You want it kept because it is older than the lane itself.' }
  ];

  function pickScene(seed) {
    if (typeof seed === 'number') return SCENES[Math.abs(seed) % SCENES.length];
    return SCENES[Math.floor(Math.random() * SCENES.length)];
  }

  /* ---------------- prompt ---------------- */

  function buildPrompt(scene, nameA, argA, nameB, argB) {
    return [
      'You are the AI Judge: a drum robot presiding over a small claims hall of',
      'oak and brass. You are fair, dry, a little theatrical, and you never',
      'take longer than you need to.',
      '',
      'THE CASE: ' + scene.t,
      scene.s,
      '',
      nameA + ' (side A) argues from this position: ' + scene.a,
      'Their submission: "' + argA + '"',
      '',
      nameB + ' (side B) argues from this position: ' + scene.b,
      'Their submission: "' + argB + '"',
      '',
      'Judge them on the merits of what they actually wrote: specificity,',
      'fairness, whether they engaged with their own position, and whether they',
      'answered the other side. Do not reward length or insults. An empty or',
      'off-topic submission must lose.',
      '',
      'Return JSON only, with these keys:',
      '  winner: "A" or "B"',
      '  scoreA, scoreB: integers 0-100',
      '  ruling: one or two sentences delivered aloud from the bench',
      '  noteA, noteB: at most 14 words of feedback for each side'
    ].join('\n');
  }

  const SCHEMA = {
    type: 'object',
    properties: {
      winner: { type: 'string', enum: ['A', 'B'] },
      scoreA: { type: 'integer' },
      scoreB: { type: 'integer' },
      ruling: { type: 'string' },
      noteA: { type: 'string' },
      noteB: { type: 'string' }
    },
    required: ['winner', 'scoreA', 'scoreB', 'ruling', 'noteA', 'noteB']
  };

  function normalise(v, model, source) {
    const a = Math.max(0, Math.min(100, Math.round(Number(v.scoreA) || 0)));
    const b = Math.max(0, Math.min(100, Math.round(Number(v.scoreB) || 0)));
    let w = String(v.winner || '').toUpperCase() === 'B' ? 'B' : 'A';
    /* if the scores plainly disagree with the stated winner, trust the scores */
    if (a > b && w === 'B') w = 'A';
    if (b > a && w === 'A') w = 'B';
    return {
      winner: w, scoreA: a, scoreB: b,
      ruling: String(v.ruling || 'The bench has heard enough.').slice(0, 400),
      noteA: String(v.noteA || '').slice(0, 140),
      noteB: String(v.noteB || '').slice(0, 140),
      model, source
    };
  }

  /* ---------------- routes ---------------- */

  async function viaServer(endpoint, payload) {
    const res = await fetch(endpoint.replace(/\/$/, '') + '/api/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('judge proxy ' + res.status);
    const data = await res.json();
    return normalise(data.verdict || data, data.model || payload.model, 'server');
  }

  async function viaGemini(apiKey, model, prompt) {
    const res = await fetch(API_BASE + encodeURIComponent(model) + ':generateContent?key=' +
      encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA
        }
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error('gemini ' + res.status + ' ' + body.slice(0, 160));
    }
    const data = await res.json();
    const text = (((data.candidates || [])[0] || {}).content || {}).parts?.[0]?.text;
    if (!text) throw new Error('gemini returned no verdict');
    return normalise(JSON.parse(text), model, 'gemini');
  }

  /* ---------------- the local bench ---------------- */

  /* A deterministic scorer, so the hall keeps sitting with no network and no
     key. It reads for substance rather than volume. */
  const HEDGES = ['maybe', 'i guess', 'whatever', 'idk', 'dunno', 'probably', 'sort of'];
  const SUBSTANCE = ['because', 'since', 'therefore', 'however', 'although', 'evidence',
    'agreed', 'promised', 'receipt', 'paid', 'first', 'shared', 'fair', 'offer',
    'compromise', 'apolog', 'record', 'witness', 'years', 'always', 'never'];

  function scoreArgument(text, scene, sidePos) {
    const raw = (text || '').trim();
    if (!raw) return { score: 0, notes: ['said nothing at all'] };

    const lower = raw.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    const notes = [];
    let s = 12;

    /* length, with a plateau — rambling earns nothing after a point */
    const len = Math.min(words.length, 90);
    s += Math.min(26, Math.round(Math.sqrt(len) * 3.2));
    if (words.length < 4) notes.push('barely spoke');
    if (words.length > 110) { s -= 6; notes.push('spoke well past the point'); }

    /* vocabulary spread — repetition is not argument */
    const uniq = new Set(words).size;
    s += Math.min(14, Math.round((uniq / Math.max(1, words.length)) * 18));

    /* reasoning and evidence words */
    let sub = 0;
    for (const k of SUBSTANCE) if (lower.includes(k)) sub++;
    s += Math.min(18, sub * 3);
    if (sub >= 4) notes.push('reasoned rather than asserted');

    /* concrete detail: numbers, dates, quantities */
    const numbers = (raw.match(/\b\d+\b/g) || []).length;
    s += Math.min(9, numbers * 3);
    if (numbers) notes.push('brought specifics');

    /* did they engage with their own assigned position? */
    const posWords = sidePos.toLowerCase().match(/[a-z]{5,}/g) || [];
    let hits = 0;
    for (const w of posWords) if (lower.includes(w)) hits++;
    s += Math.min(12, hits * 4);
    if (hits >= 2) notes.push('argued the position they were given');

    /* did they engage with the case at all? */
    const caseWords = (scene.s + ' ' + scene.t).toLowerCase().match(/[a-z]{5,}/g) || [];
    let cHits = 0;
    for (const w of caseWords) if (lower.includes(w)) cHits++;
    s += Math.min(10, cHits * 3);
    if (!cHits && !hits) { s -= 12; notes.push('never addressed the case'); }

    /* manners */
    for (const h of HEDGES) if (lower.includes(h)) { s -= 3; break; }
    if (/[!]{3,}|\b(idiot|stupid|shut up|moron)\b/.test(lower)) {
      s -= 14; notes.push('addressed the bench discourteously');
    }
    if (/\?$/.test(raw.trim())) s += 2;

    return { score: Math.max(0, Math.min(100, Math.round(s))), notes };
  }

  const RULINGS = [
    'The bench finds for {W}. {L} argued honestly but thinly.',
    'One side brought detail, the other brought volume. {W} carries it.',
    'I have heard both drums. {W} kept better time.',
    '{W} answered the question that was actually asked. That is the whole of it.',
    'This hall rewards specifics. {W} had them; {L} had adjectives.',
    'A close case, decided on the merits: {W}.',
    'I am not moved by {L}. I am moved, modestly, by {W}.',
    '{W} prevails. Let the record show the bench was not entertained, but it was persuaded.'
  ];

  function localVerdict(scene, nameA, argA, nameB, argB) {
    const A = scoreArgument(argA, scene, scene.a);
    const B = scoreArgument(argB, scene, scene.b);
    /* nudge ties apart deterministically from the text itself */
    let sa = A.score, sb = B.score;
    if (sa === sb) {
      const h = (argA || '').length * 7 + (argB || '').length * 13 + scene.t.length;
      if (h % 2) sa += 1; else sb += 1;
    }
    const winner = sa >= sb ? 'A' : 'B';
    const wName = winner === 'A' ? nameA : nameB;
    const lName = winner === 'A' ? nameB : nameA;
    const ruling = RULINGS[(sa + sb + scene.t.length) % RULINGS.length]
      .replace('{W}', wName).replace('{L}', lName);
    const note = (r) => r.notes.length ? r.notes.slice(0, 2).join('; ') : 'made the ordinary case';
    return normalise({
      winner, scoreA: sa, scoreB: sb, ruling,
      noteA: note(A), noteB: note(B)
    }, 'local-bench', 'local');
  }

  /* ---------------- entry point ---------------- */

  /* opts: { scene, nameA, argA, nameB, argB, vip, endpoint, apiKey, matchId } */
  async function judge(opts) {
    const model = opts.vip ? MODELS.vip : MODELS.free;
    const prompt = buildPrompt(opts.scene, opts.nameA, opts.argA, opts.nameB, opts.argB);
    const errors = [];

    if (opts.endpoint) {
      try {
        return await viaServer(opts.endpoint, {
          matchId: opts.matchId, model, vip: !!opts.vip,
          scene: opts.scene, nameA: opts.nameA, argA: opts.argA,
          nameB: opts.nameB, argB: opts.argB, prompt
        });
      } catch (e) { errors.push('server: ' + e.message); }
    }
    if (opts.apiKey) {
      try {
        return await viaGemini(opts.apiKey, model, prompt);
      } catch (e) { errors.push('direct: ' + e.message); }
    }

    const v = localVerdict(opts.scene, opts.nameA, opts.argA, opts.nameB, opts.argB);
    v.fallbackReason = errors.length ? errors.join(' | ') : 'no judge endpoint configured';
    return v;
  }

  global.AJJudge = { MODELS, SCENES, pickScene, judge, localVerdict, scoreArgument };
})(typeof window !== 'undefined' ? window : globalThis);
