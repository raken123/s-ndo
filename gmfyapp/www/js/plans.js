/* gmfy — plans, the games library, and Edu classes.
 *
 * SCOPE: everything here is device-local (localStorage), scoped per account.
 * Plans are not verified against a billing system and class codes do not travel
 * between devices — both need a backend to be real.
 */
(function (global) {
  'use strict';

  var PLANS = {
    free: { id:'free', name:'Free', price:'$0',     limit:2,        shares:1,        blurb:'2 games, 1 shared' },
    go:   { id:'go',   name:'Go',   price:'$2/mo',  limit:50,       shares:5,        blurb:'50 games, 5 shared' },
    pro:  { id:'pro',  name:'Pro',  price:'$20/mo', limit:1000,     shares:25,       blurb:'1000 games, 25 shared' },
    max:  { id:'max',  name:'Max',  price:'$390/mo',limit:Infinity, shares:Infinity, blurb:'unlimited, share freely' }
  };
  var ORDER = ['free', 'go', 'pro', 'max'];
  var INVITE_QUOTA = 10;                 // codes each account may mint
  var GIFT_DAYS = 90;                    // a redeemed code lasts 3 months

  var K_GAMES = 'gmfy.games.v2';
  var K_PLAN  = 'gmfy.plan.v2';
  var K_INVITES = 'gmfy.invites.v2';     // code -> {by, plan, at, usedBy, usedAt}
  var K_MINE  = 'gmfy.myinvites.v2';     // per-account: [codes I minted]
  var K_CLASS = 'gmfy.class.v2';
  var K_ROOMS = 'gmfy.rooms.v2';        // class code -> {name, owner, members[]}
  var K_SHARES = 'gmfy.shares.v2';      // share code -> {name, world, script, by, at}

  function scoped(k) {
    return global.GmfyAuth ? global.GmfyAuth.scope(k) : k;
  }
  function read(k, dflt) {
    try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : dflt; }
    catch (e) { return dflt; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  var Plans = {
    all: PLANS,
    order: ORDER,
    inviteQuota: INVITE_QUOTA,

    // stored plan is {id, until} — until is null for a bought plan, or a
    // timestamp for a gifted one. An expired gift silently reverts to free.
    current: function () {
      var rec = read(scoped(K_PLAN), null);
      if (typeof rec === 'string') rec = { id: rec, until: null };   // migrate old value
      if (!rec || !PLANS[rec.id]) return PLANS.free;
      if (rec.until && Date.now() > rec.until) { this.setPlan('free'); return PLANS.free; }
      return PLANS[rec.id];
    },
    // how long a gifted plan has left, in days, or null if not gifted
    giftDaysLeft: function () {
      var rec = read(scoped(K_PLAN), null);
      if (!rec || typeof rec === 'string' || !rec.until) return null;
      return Math.max(0, Math.ceil((rec.until - Date.now()) / 86400000));
    },
    setPlan: function (id, until) {
      if (!PLANS[id]) return false;
      write(scoped(K_PLAN), { id: id, until: until || null });
      return true;
    },

    /* ---------------- invite codes ---------------- */
    invites: function () { return read(K_INVITES, {}); },

    // codes this account has minted (up to INVITE_QUOTA)
    myInvites: function () {
      var mine = read(scoped(K_MINE), []);
      var all = this.invites();
      return (Array.isArray(mine) ? mine : []).map(function (code) {
        return { code: code, rec: all[code] || null };
      });
    },
    invitesLeft: function () {
      return Math.max(0, INVITE_QUOTA - this.myInvites().length);
    },

    // mint a new code carrying the current plan; a friend who redeems it gets
    // that plan for GIFT_DAYS. Free accounts have nothing to gift.
    mintInvite: function () {
      var plan = this.current().id;
      if (plan === 'free') return { ok:false, error:'free' };
      if (this.invitesLeft() <= 0) return { ok:false, error:'quota' };
      var u = global.GmfyAuth && global.GmfyAuth.current();
      var code = 'GMFY-' + Math.random().toString(36).slice(2, 6).toUpperCase()
               + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      var all = this.invites();
      all[code] = { by: u ? u.email : 'friend', plan: plan, at: Date.now(),
                    usedBy: null, usedAt: null };
      write(K_INVITES, all);
      var mine = read(scoped(K_MINE), []);
      if (!Array.isArray(mine)) mine = [];
      mine.push(code); write(scoped(K_MINE), mine);
      return { ok:true, code: code, plan: plan };
    },

    // redeem a friend's code: you get their plan for GIFT_DAYS. One use only.
    redeemInvite: function (code) {
      code = String(code || '').trim().toUpperCase();
      var all = this.invites();
      var rec = all[code];
      if (!rec) return { ok:false, error:'unknown' };
      if (rec.usedBy) return { ok:false, error:'used' };
      var u = global.GmfyAuth && global.GmfyAuth.current();
      var me = u ? u.email : 'me';
      if (rec.by === me) return { ok:false, error:'self' };
      var until = Date.now() + GIFT_DAYS * 86400000;
      this.setPlan(rec.plan, until);
      rec.usedBy = me; rec.usedAt = Date.now();
      write(K_INVITES, all);
      return { ok:true, plan: rec.plan, days: GIFT_DAYS };
    },

    /* ---------------- games library ---------------- */
    games: function () {
      var g = read(scoped(K_GAMES), []);
      return Array.isArray(g) ? g : [];
    },
    canCreate: function () {
      return this.games().length < this.current().limit;
    },
    remaining: function () {
      var l = this.current().limit;
      return l === Infinity ? Infinity : Math.max(0, l - this.games().length);
    },
    create: function (name, world) {
      if (!this.canCreate()) return { ok:false, error:'limit' };
      var list = this.games();
      var id = 'g' + Date.now().toString(36);
      list.push({ id:id, name:name || ('Game ' + (list.length + 1)),
                  saved:Date.now(), world:world || null, script:null });
      write(scoped(K_GAMES), list);
      return { ok:true, id:id };
    },
    save: function (id, world, script) {
      var list = this.games();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          list[i].world = world;
          list[i].script = script;
          list[i].saved = Date.now();
          var ok = write(scoped(K_GAMES), list);
          var code = this.shareOf(id);
          if (code) {
            var all = this.shares();
            all[code].world = world;
            all[code].script = script;
            all[code].name = list[i].name;
            write(K_SHARES, all);
          }
          return ok;
        }
      }
      return false;
    },
    get: function (id) {
      var list = this.games();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    rename: function (id, name) {
      var list = this.games();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) list[i].name = name;
      return write(scoped(K_GAMES), list);
    },
    remove: function (id) {
      var code = this.shareOf(id);
      if (code) this.unshare(code);
      var list = this.games().filter(function (g) { return g.id !== id; });
      return write(scoped(K_GAMES), list);
    },

    /* ---------------- sharing by code ---------------- */
    shares: function () { return read(K_SHARES, {}); },

    /* codes published by the signed-in account */
    myShares: function () {
      var all = this.shares(), me = this.who(), out = [];
      Object.keys(all).forEach(function (code) {
        if (all[code].by === me) out.push({ code: code, entry: all[code] });
      });
      return out;
    },

    who: function () {
      var u = global.GmfyAuth && global.GmfyAuth.current();
      return u ? u.email : 'guest';
    },

    shareLimit: function () { return this.current().shares; },

    sharesLeft: function () {
      var l = this.shareLimit();
      return l === Infinity ? Infinity : Math.max(0, l - this.myShares().length);
    },

    /* code already published for this game, or null */
    shareOf: function (gameId) {
      var all = this.shares(), me = this.who(), found = null;
      Object.keys(all).forEach(function (c) {
        if (all[c].game === gameId && all[c].by === me) found = c;
      });
      return found;
    },

    share: function (gameId) {
      var g = this.get(gameId);
      if (!g) return { ok:false, error:'That game is gone.' };
      var existing = this.shareOf(gameId);
      if (existing) return { ok:true, code:existing, already:true };
      if (this.sharesLeft() <= 0) {
        return { ok:false, limit:true,
                 error:'Your ' + this.current().name + ' plan shares ' +
                       this.shareLimit() + ' game' + (this.shareLimit() === 1 ? '' : 's') +
                       ' at a time. Unshare one, or upgrade.' };
      }
      var all = this.shares();
      var code = this.code(), guard = 0;
      while (all[code] && guard++ < 20) code = this.code();
      all[code] = { game:gameId, name:g.name, world:g.world, script:g.script,
                    by:this.who(), at:Date.now(), opens:0 };
      if (!write(K_SHARES, all)) return { ok:false, error:'Device storage is full.' };
      return { ok:true, code:code };
    },

    unshare: function (code) {
      var all = this.shares();
      if (!all[code]) return false;
      delete all[code];
      return write(K_SHARES, all);
    },

    /* import someone else's code as a new game in your library */
    importShare: function (code) {
      code = String(code || '').toUpperCase().replace(/\s/g, '');
      if (code.length === 6 && code.indexOf('-') === -1)
        code = code.slice(0, 3) + '-' + code.slice(3);
      var all = this.shares();
      var e = all[code];
      if (!e) return { ok:false, error:'No shared game with that code on this device.' };
      if (!this.canCreate()) {
        return { ok:false, error:'You are at your ' + this.current().name +
                 ' limit of ' + this.current().limit + ' games — upgrade or delete one first.' };
      }
      var res = this.create(e.name + ' (copy)', e.world);
      if (!res.ok) return { ok:false, error:'Could not add that game.' };
      this.save(res.id, e.world, e.script);
      e.opens = (e.opens || 0) + 1;
      write(K_SHARES, all);
      return { ok:true, id:res.id, name:e.name };
    },

    /* ---------------- Edu classes ---------------- */
    code: function () {
      var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
      for (var i = 0; i < 6; i++) s += A[(Math.random() * A.length) | 0];
      return s.slice(0, 3) + '-' + s.slice(3);
    },
    rooms: function () { return read(K_ROOMS, {}); },

    createClass: function (name) {
      var u = global.GmfyAuth && global.GmfyAuth.current();
      var rooms = this.rooms();
      var code = this.code();
      var guard = 0;
      while (rooms[code] && guard++ < 20) code = this.code();
      rooms[code] = { name: name || 'My class', owner: u ? u.email : 'teacher',
                      members: [], made: Date.now() };
      write(K_ROOMS, rooms);
      write(scoped(K_CLASS), { code: code, role: 'teacher' });
      return code;
    },

    joinClass: function (code) {
      code = String(code || '').toUpperCase().replace(/\s/g, '');
      if (code.length === 6 && code.indexOf('-') === -1)
        code = code.slice(0, 3) + '-' + code.slice(3);
      var rooms = this.rooms();
      if (!rooms[code]) return { ok:false, error:'No class with that code on this device.' };
      var u = global.GmfyAuth && global.GmfyAuth.current();
      var who = u ? u.email : 'student';
      if (rooms[code].members.indexOf(who) === -1) rooms[code].members.push(who);
      write(K_ROOMS, rooms);
      write(scoped(K_CLASS), { code: code, role: 'student' });
      return { ok:true, room: rooms[code], code: code };
    },

    myClass: function () {
      var c = read(scoped(K_CLASS), null);
      if (!c) return null;
      var r = this.rooms()[c.code];
      if (!r) return null;
      return { code: c.code, role: c.role, room: r };
    },

    leaveClass: function () {
      var c = read(scoped(K_CLASS), null);
      if (!c) return;
      var rooms = this.rooms(), u = global.GmfyAuth && global.GmfyAuth.current();
      var who = u ? u.email : 'student';
      if (rooms[c.code]) {
        rooms[c.code].members = rooms[c.code].members.filter(function (m) { return m !== who; });
        write(K_ROOMS, rooms);
      }
      try { localStorage.removeItem(scoped(K_CLASS)); } catch (e) {}
    }
  };

  global.GmfyPlans = Plans;
})(window);
