/* account.js — who the player is, whether they hold VIP, and how many drum
   morphs they have left today.

   VIP is $59 and grants two things: the larger Gemini model on the bench, and
   10 drum morphs per day. A drum morph lets a player *become* the drum robot
   for one case and hand down the verdict themselves.

   Entitlement is a signed grant from the game server when one is reachable. On
   a device with no server it falls back to a locally recorded grant, which is
   fine for solo play but is NOT payment processing — see aijudge/README.md. */
(function (global) {
  'use strict';

  const KEY = 'aijudge.account.v1';
  const PRICE_USD = 59;
  const MORPHS_PER_DAY = 10;

  const ADJ = ['Brass', 'Oak', 'Quiet', 'Patient', 'Stubborn', 'Cheerful', 'Solemn',
    'Restless', 'Honest', 'Reluctant', 'Fond', 'Careful', 'Loud', 'Modest'];
  const NOUN = ['Kettle', 'Cymbal', 'Sparrow', 'Lantern', 'Ledger', 'Anchor', 'Thimble',
    'Marmalade', 'Compass', 'Walnut', 'Beacon', 'Gable', 'Plover', 'Hatpin'];

  function randomName() {
    return ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' +
           NOUN[Math.floor(Math.random() * NOUN.length)];
  }

  function dayKey(d) {
    const t = d || new Date();
    return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
  }

  function blank() {
    return {
      name: randomName(),
      id: 'p_' + Math.random().toString(36).slice(2, 10),
      vip: false,
      vipSince: null,
      wins: 0, losses: 0, cases: 0,
      streak: 0, bestStreak: 0,
      morphDay: dayKey(),
      morphsUsed: 0,
      server: ''
    };
  }

  let state = null;

  function load() {
    if (state) return state;
    let saved = null;
    try { saved = JSON.parse(global.localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
    state = Object.assign(blank(), saved || {});
    rollDay();
    return state;
  }

  function save() {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
    return state;
  }

  /* Quota resets at local midnight. */
  function rollDay() {
    const today = dayKey();
    if (state.morphDay !== today) {
      state.morphDay = today;
      state.morphsUsed = 0;
    }
  }

  function morphsLeft() {
    load(); rollDay();
    if (!state.vip) return 0;
    return Math.max(0, MORPHS_PER_DAY - state.morphsUsed);
  }

  /* Spends one morph. Returns false when the player has none left. */
  function useMorph() {
    if (morphsLeft() <= 0) return false;
    state.morphsUsed++;
    save();
    return true;
  }

  function setName(n) {
    load();
    state.name = (n || '').trim().slice(0, 24) || randomName();
    save();
    return state.name;
  }

  function set(patch) { load(); Object.assign(state, patch); return save(); }

  /* Records the outcome of a case. */
  function recordResult(won) {
    load();
    state.cases++;
    if (won) {
      state.wins++;
      state.streak++;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    } else {
      state.losses++;
      state.streak = 0;
    }
    return save();
  }

  /* Rank is cosmetic and derived, never stored. */
  const RANKS = [
    [0, 'Bystander'], [3, 'Complainant'], [8, 'Litigant'],
    [16, 'Advocate'], [28, 'Counsel'], [45, 'Silk'], [70, 'Bench Favourite']
  ];
  function rank() {
    load();
    let r = RANKS[0][1];
    for (const [need, name] of RANKS) if (state.wins >= need) r = name;
    return r;
  }

  /* Grants VIP. With a server, `code` is verified there first; the local branch
     is for offline and development use only. */
  async function redeem(code) {
    load();
    const c = (code || '').trim();
    if (!c) throw new Error('Enter the code from your receipt.');

    if (state.server) {
      const res = await fetch(state.server.replace(/\/$/, '') + '/api/vip/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c, playerId: state.id })
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t.slice(0, 120) || ('server refused the code (' + res.status + ')'));
      }
      const data = await res.json();
      if (!data.vip) throw new Error(data.error || 'That code is not valid.');
      state.vip = true;
      state.vipSince = data.since || new Date().toISOString();
      save();
      return state;
    }

    /* Offline grant: any non-empty code works, and it is only trusted on this
       device. Nothing here is a payment check. */
    state.vip = true;
    state.vipSince = new Date().toISOString();
    state.vipLocalOnly = true;
    save();
    return state;
  }

  function revoke() { load(); state.vip = false; state.vipSince = null; delete state.vipLocalOnly; return save(); }

  global.AJAccount = {
    PRICE_USD, MORPHS_PER_DAY,
    get: load, save, set, setName, randomName,
    morphsLeft, useMorph, recordResult, rank, redeem, revoke
  };
})(typeof window !== 'undefined' ? window : globalThis);
