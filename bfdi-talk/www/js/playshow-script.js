// Playshow Mode, part 1: writing the episode.
// A Gemini text model writes a structured script (scenes -> lines with speaker, emotion, action);
// sanitizeEpisode() then repairs or drops anything that doesn't fit the cast and plan.

export const PS_EMOTIONS = [
  'neutral', 'happy', 'excited', 'laughing', 'sad', 'angry', 'furious', 'surprised', 'scared', 'nervous',
  'thinking', 'confused', 'smug', 'annoyed', 'bored', 'determined', 'shy', 'content', 'dizzy',
];
export const PS_ACTIONS = ['none', 'jump', 'shake', 'spin', 'faint', 'cheer', 'eliminated'];

// What each plan can do in Playshow. Free "barely works": short skits with 3 objects.
export const PS_LIMITS = {
  free: { label: 'Free', cast: 3, lines: 10, scenes: 2, eliminations: false, seasons: false, thinking: 'low', saved: 3 },
  lite: { label: 'Lite', cast: 5, lines: 24, scenes: 3, eliminations: true, seasons: true, thinking: 'low', saved: 10 },
  pro: { label: 'Pro', cast: 8, lines: 40, scenes: 5, eliminations: true, seasons: true, thinking: 'high', saved: 30 },
};

// Tried in order; later ones only when an earlier one is overloaded.
const SCRIPT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

export function episodeSchema(names) {
  return {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      summary: { type: 'STRING' },
      eliminated: { type: 'STRING' },
      scenes: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            card: { type: 'STRING' },
            setting: { type: 'STRING' },
            lines: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  speaker: { type: 'STRING', enum: names },
                  text: { type: 'STRING' },
                  emotion: { type: 'STRING', enum: PS_EMOTIONS },
                  action: { type: 'STRING', enum: PS_ACTIONS },
                },
                required: ['speaker', 'text', 'emotion', 'action'],
              },
            },
          },
          required: ['card', 'setting', 'lines'],
        },
      },
    },
    required: ['title', 'summary', 'eliminated', 'scenes'],
  };
}

/** Cast members still in the show this season. */
export function activeCast(cast, season) {
  const out = new Set((season?.eliminated || []).map(n => n.toLowerCase()));
  return cast.filter(c => c.host || !out.has(c.name.toLowerCase()));
}

export function canEliminate(cast, limits) {
  return limits.eliminations && cast.filter(c => !c.host).length >= 3;
}

export function buildPrompt({ showName, cast, premise, limits, season, shapeLabel = b => b }) {
  const number = (season?.episodes?.length || 0) + 1;
  const elim = canEliminate(cast, limits);
  const who = cast.map(c => `- ${c.name}: a ${shapeLabel(c.body)}${c.host ? ' (the HOST, never eliminated)' : ''}. Personality: ${c.persona}`).join('\n');
  const parts = [
    `Write episode ${number} of "${showName}", a funny, kid-friendly cartoon object show in the style of Battle for Dream Island (BFDI): talking objects with big personalities compete in silly challenges.`,
    `\nCast (use these exact names as speakers, nobody else talks):\n${who}`,
  ];
  if (season?.eliminated?.length) parts.push(`\nAlready eliminated earlier this season (they do NOT appear): ${season.eliminated.join(', ')}.`);
  if (limits.seasons && season?.episodes?.length) {
    parts.push(`\nPreviously on ${showName}:\n${season.episodes.slice(-3).map((e, i, a) => `- Episode ${number - a.length + i}: ${e.summary}`).join('\n')}\nKeep continuity with these events.`);
  }
  if (premise?.trim()) parts.push(`\nThe fan's idea for this episode (follow it): "${premise.trim().slice(0, 500)}"`);
  parts.push(`\nFormat rules:
- At most ${limits.scenes} scenes and at most ${limits.lines} lines in total.
- Each scene has a short title-card text in "card" (like "The Challenge!", "Later...", "Elimination Time!") and a short "setting" (where it happens).
- Lines are spoken dialogue only: max 25 words, no stage directions, no narrator, no sound effects in the text.
- Every line has the speaker's emotion and a stage action (jump, shake, spin, faint, cheer). Most lines use "none".
- Give every cast member at least one line. Keep personalities consistent; use running gags, puns and quick back-and-forth jokes.`);
  if (elim) {
    parts.push(`- Structure: a challenge is announced, the contestants try it, the results are revealed, then an elimination.
- At the very end exactly ONE contestant (never the host) is eliminated. Their goodbye line uses the action "eliminated" and their name goes in "eliminated".${cast.some(c => c.host) ? '' : ' With no host, the contestants vote someone off.'}`);
  } else {
    parts.push('- Make it a short, funny skit with a clear beginning, middle and punchline. Nobody is eliminated: set "eliminated" to "".');
  }
  parts.push('- "summary": one or two sentences about what happened, for the next episode\'s recap.');
  return parts.join('\n');
}

/** Repairs the model's output so the player can trust it. Throws if nothing usable is left. */
export function sanitizeEpisode(raw, cast, limits) {
  const byName = new Map(cast.map(c => [c.name.toLowerCase(), c]));
  const elimAllowed = canEliminate(cast, limits);
  let total = 0;
  let eliminated = '';
  const scenes = [];
  for (const sc of Array.isArray(raw?.scenes) ? raw.scenes.slice(0, limits.scenes) : []) {
    const lines = [];
    for (const l of Array.isArray(sc?.lines) ? sc.lines : []) {
      if (total >= limits.lines) break;
      const c = byName.get(String(l?.speaker || '').trim().toLowerCase());
      const text = String(l?.text || '').replace(/\s+/g, ' ').replace(/^\(.*?\)\s*/, '').trim().slice(0, 240);
      if (!c || !text) continue;
      let action = PS_ACTIONS.includes(l.action) ? l.action : 'none';
      if (action === 'eliminated' && (!elimAllowed || c.host || eliminated)) action = 'none';
      if (action === 'eliminated') eliminated = c.name;
      lines.push({ speaker: c.name, text, emotion: PS_EMOTIONS.includes(l.emotion) ? l.emotion : 'neutral', action });
      total++;
    }
    if (lines.length) scenes.push({ card: String(sc.card || '').trim().slice(0, 60), setting: String(sc.setting || '').trim().slice(0, 80), lines });
  }
  if (!total) throw new Error('The episode came out empty. Try again!');
  // Named in "eliminated" but nobody got the goodbye action: give it to their last line.
  const named = byName.get(String(raw?.eliminated || '').trim().toLowerCase());
  if (!eliminated && elimAllowed && named && !named.host) {
    for (let s = scenes.length - 1; s >= 0 && !eliminated; s--) {
      for (let i = scenes[s].lines.length - 1; i >= 0; i--) {
        if (scenes[s].lines[i].speaker === named.name) { scenes[s].lines[i].action = 'eliminated'; eliminated = named.name; break; }
      }
    }
  }
  return {
    title: String(raw?.title || 'Untitled Episode').trim().slice(0, 80),
    summary: String(raw?.summary || '').trim().slice(0, 400),
    eliminated,
    scenes,
  };
}

/** Writes an episode with Gemini (with model fallbacks). */
export async function writeEpisode(opts, apiKey, fetchImpl = fetch) {
  const { cast, limits } = opts;
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: buildPrompt(opts) }] }],
    generationConfig: {
      temperature: 1.1,
      responseMimeType: 'application/json',
      responseSchema: episodeSchema(cast.map(c => c.name)),
      thinkingConfig: { thinkingLevel: limits.thinking },
    },
  });
  let lastError = '';
  for (const model of SCRIPT_MODELS) {
    let res;
    try {
      res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey }, body,
      });
    } catch (err) {
      lastError = err.message;
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      try {
        return sanitizeEpisode(JSON.parse(text), cast, limits);
      } catch (err) {
        lastError = err.message;
        continue;
      }
    }
    lastError = (await res.json().catch(() => ({})))?.error?.message || String(res.status);
    if (![429, 500, 503].includes(res.status)) break;
  }
  throw new Error(`Couldn't write the episode (${lastError}). Try again in a minute.`);
}
