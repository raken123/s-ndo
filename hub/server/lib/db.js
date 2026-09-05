'use strict';
// Tiny JSON document store: one file, debounced atomic writes.
const fs = require('fs');
const path = require('path');

function emptyDb() {
  return {
    version: 1,
    users: {},        // id -> user
    names: {},        // lower-case username -> id
    sessions: {},     // token -> { userId, created, last }
    games: {},        // id -> game definition
    items: {},        // shop catalog id -> item
    platform: { fees: 0, gemsSold: 0, passesSold: 0, roundsPlayed: 0 },
    seq: 1,
  };
}

class Db {
  constructor(file) {
    this.file = file;
    this.data = emptyDb();
    this.timer = null;
    this.dirty = false;
    if (file && fs.existsSync(file)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(file, 'utf8'));
        this.data = Object.assign(emptyDb(), loaded);
      } catch (e) {
        const bad = file + '.corrupt-' + Date.now();
        fs.renameSync(file, bad);
        console.error('[db] could not parse ' + file + ', moved to ' + bad + ': ' + e.message);
      }
    }
  }

  nextId(prefix) {
    const n = this.data.seq++;
    this.save();
    return prefix + n.toString(36);
  }

  save() {
    this.dirty = true;
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 400);
    this.timer.unref();
  }

  flush() {
    if (!this.file || !this.dirty) return;
    this.dirty = false;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }

  close() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.flush();
  }
}

module.exports = { Db };
