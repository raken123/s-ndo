/* store.js — records, settings and where they live.
 *
 * The desktop builds expose window.infodocNative from a preload script, which
 * reads and writes a JSON file in the OS application-data directory. Without it
 * (a browser opening the single-file build) the same document goes to
 * localStorage. Everything above this file only sees Store.
 */
(function (global) {
  'use strict';

  var DOC_VERSION = 1;
  var LS_KEY = 'infodoc.doc.v1';

  var DEFAULT_SETTINGS = {
    clinic: '',
    operator: '',
    // thermo
    contactMin: 30.0,      // °C below which we assume the node is not on skin
    coreOffset: 1.6,       // °C added to skin temp to estimate core temp
    slopeMax: 0.02,        // °C/s: below this the reading counts as settled
    thermoTimeout: 40,     // s
    // reflex
    rounds: 8,
    deadzone: 30,          // of 127
    commit: 70,            // of 127
    holdMs: 150,
    // steadiness
    tremorSecs: 10,
    bandLow: 3.0,
    bandHigh: 12.0,
    // device
    wsUrl: 'ws://arduino.local:8787'
  };

  function uid() {
    var s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    if (global.crypto && global.crypto.getRandomValues) {
      var b = new Uint8Array(16);
      global.crypto.getRandomValues(b);
      var i = 0;
      return s.replace(/[xy]/g, function (c) {
        var r = b[i++] & 15;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });
    }
    return s.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  }

  function emptyDoc() {
    return { version: DOC_VERSION, people: [], settings: clone(DEFAULT_SETTINGS) };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function newPerson(name) {
    var now = new Date().toISOString();
    return {
      id: uid(), created: now, updated: now,
      name: name || 'New person', chartId: '', dob: '', sex: '', pronouns: '',
      phone: '', email: '', address: '', kin: '', kinPhone: '',
      allergies: '', medication: '', conditions: '', notes: '',
      visits: []
    };
  }

  function newVisit(when, reason, clinician) {
    return {
      id: uid(),
      when: when || localIsoNow(),
      reason: reason || '', clinician: clinician || '', dept: '',
      status: 'Booked', notes: '',
      obs: { weight: '', height: '', bp: '', pulse: '', spo2: '', resp: '' },
      thermo: null, reflex: null, tremor: null
    };
  }

  /* datetime-local wants a local, not UTC, string */
  function localIsoNow(d) {
    d = d || new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
           'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ── migration ────────────────────────────────────────── */
  function migrate(doc) {
    if (!doc || typeof doc !== 'object') return emptyDoc();
    if (!Array.isArray(doc.people)) doc.people = [];
    var s = doc.settings && typeof doc.settings === 'object' ? doc.settings : {};
    doc.settings = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
      doc.settings[k] = (s[k] === undefined || s[k] === null || s[k] === '')
        ? DEFAULT_SETTINGS[k] : s[k];
    });
    doc.people.forEach(function (p) {
      var blank = newPerson();
      Object.keys(blank).forEach(function (k) {
        if (p[k] === undefined) p[k] = blank[k];
      });
      if (!Array.isArray(p.visits)) p.visits = [];
      p.visits.forEach(function (v) {
        var bv = newVisit();
        Object.keys(bv).forEach(function (k) { if (v[k] === undefined) v[k] = bv[k]; });
        if (!v.obs || typeof v.obs !== 'object') v.obs = bv.obs;
      });
    });
    doc.version = DOC_VERSION;
    return doc;
  }

  /* ── backends ─────────────────────────────────────────── */
  var native = global.infodocNative || null;

  var backend = native ? {
    name: 'native',
    read: function () { return native.read(); },
    write: function (text) { return native.write(text); },
    where: function () { return native.path ? native.path() : Promise.resolve('application data'); }
  } : {
    name: 'localStorage',
    read: function () {
      try { return Promise.resolve(global.localStorage.getItem(LS_KEY)); }
      catch (e) { return Promise.resolve(null); }
    },
    write: function (text) {
      try { global.localStorage.setItem(LS_KEY, text); return Promise.resolve(true); }
      catch (e) { return Promise.reject(e); }
    },
    where: function () {
      return Promise.resolve('this browser’s local storage (key ' + LS_KEY + ')');
    }
  };

  /* ── the store ────────────────────────────────────────── */
  var doc = emptyDoc();
  var listeners = [];
  var saveTimer = null;
  var savePending = false;
  var lastError = null;

  function emit(what) {
    listeners.forEach(function (fn) { try { fn(what); } catch (e) { console.error(e); } });
  }

  var Store = {
    backend: backend.name,

    load: function () {
      return backend.read().then(function (text) {
        if (text) {
          try { doc = migrate(JSON.parse(text)); }
          catch (e) { lastError = 'Saved records could not be parsed: ' + e.message; doc = emptyDoc(); }
        } else {
          doc = emptyDoc();
        }
        emit('load');
        return doc;
      });
    },

    where: function () { return backend.where(); },
    lastError: function () { return lastError; },
    doc: function () { return doc; },
    settings: function () { return doc.settings; },
    people: function () { return doc.people; },

    setSetting: function (k, v) {
      if (!(k in DEFAULT_SETTINGS)) return;
      doc.settings[k] = v;
      Store.save();
      emit('settings');
    },

    num: function (k) {
      var v = parseFloat(doc.settings[k]);
      return isFinite(v) ? v : DEFAULT_SETTINGS[k];
    },

    /* people */
    person: function (id) {
      for (var i = 0; i < doc.people.length; i++) if (doc.people[i].id === id) return doc.people[i];
      return null;
    },

    addPerson: function (name) {
      var p = newPerson(name);
      doc.people.push(p);
      Store.save();
      emit('people');
      return p;
    },

    removePerson: function (id) {
      doc.people = doc.people.filter(function (p) { return p.id !== id; });
      Store.save();
      emit('people');
    },

    touch: function (p) {
      p.updated = new Date().toISOString();
      Store.save();
      emit('person');
    },

    /* visits */
    addVisit: function (personId, when, reason, clinician) {
      var p = Store.person(personId);
      if (!p) return null;
      var v = newVisit(when, reason, clinician);
      p.visits.push(v);
      Store.sortVisits(p);
      Store.touch(p);
      return v;
    },

    removeVisit: function (personId, visitId) {
      var p = Store.person(personId);
      if (!p) return;
      p.visits = p.visits.filter(function (v) { return v.id !== visitId; });
      Store.touch(p);
    },

    visit: function (personId, visitId) {
      var p = Store.person(personId);
      if (!p) return null;
      for (var i = 0; i < p.visits.length; i++) if (p.visits[i].id === visitId) return p.visits[i];
      return null;
    },

    sortVisits: function (p) {
      p.visits.sort(function (a, b) { return String(b.when).localeCompare(String(a.when)); });
    },

    search: function (q) {
      q = (q || '').trim().toLowerCase();
      var out = doc.people.slice();
      if (q) {
        out = out.filter(function (p) {
          return [p.name, p.chartId, p.phone, p.email, p.dob]
            .join(' ').toLowerCase().indexOf(q) >= 0;
        });
      }
      out.sort(function (a, b) { return a.name.localeCompare(b.name); });
      return out;
    },

    /* persistence — coalesced, so typing does not hammer the disk */
    save: function () {
      savePending = true;
      if (saveTimer) return;
      saveTimer = setTimeout(function () {
        saveTimer = null;
        if (!savePending) return;
        savePending = false;
        var text;
        try { text = JSON.stringify(doc); }
        catch (e) { lastError = 'Could not serialise records: ' + e.message; emit('error'); return; }
        backend.write(text).then(function () {
          lastError = null;
          emit('saved');
        }, function (e) {
          lastError = 'Could not save records: ' + (e && e.message ? e.message : e);
          emit('error');
        });
      }, 400);
    },

    flush: function () {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      if (!savePending) return Promise.resolve();
      savePending = false;
      return backend.write(JSON.stringify(doc));
    },

    exportText: function () { return JSON.stringify(doc, null, 2); },

    importText: function (text, mode) {
      var incoming = migrate(JSON.parse(text));
      if (mode === 'replace') {
        doc = incoming;
      } else {
        var byId = {};
        doc.people.forEach(function (p) { byId[p.id] = p; });
        incoming.people.forEach(function (p) {
          if (byId[p.id]) {
            var mine = byId[p.id];
            if (String(p.updated) > String(mine.updated)) {
              doc.people[doc.people.indexOf(mine)] = p;
            }
          } else {
            doc.people.push(p);
          }
        });
      }
      Store.save();
      emit('load');
      return incoming.people.length;
    },

    wipe: function () {
      doc = emptyDoc();
      Store.save();
      emit('load');
    },

    on: function (fn) { listeners.push(fn); },

    /* helpers shared with the UI */
    uid: uid,
    localIso: localIsoNow,
    defaults: DEFAULT_SETTINGS,

    age: function (dob, at) {
      if (!dob) return null;
      var d = new Date(dob + 'T00:00:00');
      if (isNaN(d)) return null;
      var ref = at ? new Date(at) : new Date();
      if (isNaN(ref)) ref = new Date();
      var y = ref.getFullYear() - d.getFullYear();
      var m = ref.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) y--;
      return y >= 0 && y < 150 ? y : null;
    }
  };

  global.Store = Store;
})(window);
