// Chess rules and a small chess AI for the Schack blocks.
// Board: 64 squares, a1 = 0 … h1 = 7 … a8 = 56 … h8 = 63.
// Pieces: 'PNBRQK' white, 'pnbrqk' black, '' empty.
(function (root) {
'use strict';

const FILES = 'abcdefgh';
const sqName = i => FILES[i & 7] + ((i >> 3) + 1);
function sqIndex(name) {
  const m = /^\s*([a-h])\s*([1-8])\s*$/i.exec(String(name));
  return m ? (+m[2] - 1) * 8 + FILES.indexOf(m[1].toLowerCase()) : -1;
}
const isWhite = p => p !== '' && p === p.toUpperCase();
const colorOf = p => p === '' ? '' : (isWhite(p) ? 'w' : 'b');
const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// piece-square tables from white's point of view, index a8..h1 (as written)
const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const pst = (p, sq) => {
  const t = PST[p.toLowerCase()]; const r = sq >> 3, f = sq & 7;
  return isWhite(p) ? t[(7 - r) * 8 + f] : t[r * 8 + f];
};

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const at = (f, r) => (f < 0 || f > 7 || r < 0 || r > 7) ? -1 : r * 8 + f;

class Chess {
  constructor() { this.reset(); }
  reset() {
    const back = 'RNBQKBNR';
    this.b = new Array(64).fill('');
    for (let f = 0; f < 8; f++) {
      this.b[f] = back[f]; this.b[8 + f] = 'P';
      this.b[48 + f] = 'p'; this.b[56 + f] = back[f].toLowerCase();
    }
    this.turn = 'w'; this.castle = 'KQkq'; this.ep = -1; this.half = 0; this.full = 1;
    this.hist = []; this.seen = {}; this.lastMove = null;
    this.seen[this.key()] = 1;
  }
  loadFen(fen) {
    const [place, turn, castle, ep, half, full] = fen.trim().split(/\s+/);
    this.b = new Array(64).fill('');
    place.split('/').forEach((row, i) => {
      let f = 0; const r = 7 - i;
      for (const ch of row) { if (/\d/.test(ch)) f += +ch; else this.b[r * 8 + f++] = ch; }
    });
    this.turn = turn || 'w'; this.castle = castle && castle !== '-' ? castle : '';
    this.ep = ep && ep !== '-' ? sqIndex(ep) : -1; this.half = +half || 0; this.full = +full || 1;
    this.hist = []; this.seen = {}; this.lastMove = null; this.seen[this.key()] = 1;
  }
  key() { return this.b.map(p => p || '.').join('') + this.turn + this.castle + this.ep; }
  kingSq(c) { const k = c === 'w' ? 'K' : 'k'; return this.b.indexOf(k); }
  attacked(sq, by) {
    const b = this.b, f = sq & 7, r = sq >> 3, W = by === 'w';
    const pr = W ? r - 1 : r + 1, pawn = W ? 'P' : 'p';
    for (const df of [-1, 1]) { const s = at(f + df, pr); if (s >= 0 && b[s] === pawn) return true; }
    for (const [df, dr] of KNIGHT) { const s = at(f + df, r + dr); if (s >= 0 && b[s] === (W ? 'N' : 'n')) return true; }
    for (const [df, dr] of KING) { const s = at(f + df, r + dr); if (s >= 0 && b[s] === (W ? 'K' : 'k')) return true; }
    for (const [dirs, a, c] of [[ROOK, 'R', 'Q'], [BISHOP, 'B', 'Q']]) {
      const A = W ? a : a.toLowerCase(), Cq = W ? c : c.toLowerCase();
      for (const [df, dr] of dirs) {
        let ff = f + df, rr = r + dr;
        while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
          const p = b[rr * 8 + ff];
          if (p) { if (p === A || p === Cq) return true; break; }
          ff += df; rr += dr;
        }
      }
    }
    return false;
  }
  inCheck(c = this.turn) { const k = this.kingSq(c); return k >= 0 && this.attacked(k, c === 'w' ? 'b' : 'w'); }
  pseudo() {
    const b = this.b, me = this.turn, out = [];
    const add = (from, to, extra) => {
      const piece = b[from], cap = b[to];
      if ((piece === 'P' && to >= 56) || (piece === 'p' && to < 8)) {
        for (const pr of 'qrbn') out.push({ from, to, piece, cap, promo: me === 'w' ? pr.toUpperCase() : pr });
      } else out.push(Object.assign({ from, to, piece, cap }, extra));
    };
    for (let s = 0; s < 64; s++) {
      const p = b[s]; if (!p || colorOf(p) !== me) continue;
      const f = s & 7, r = s >> 3, t = p.toLowerCase();
      if (t === 'p') {
        const dir = me === 'w' ? 1 : -1, start = me === 'w' ? 1 : 6;
        const one = at(f, r + dir);
        if (one >= 0 && !b[one]) {
          add(s, one);
          const two = at(f, r + 2 * dir);
          if (r === start && !b[two]) add(s, two, { dbl: true });
        }
        for (const df of [-1, 1]) {
          const c = at(f + df, r + dir); if (c < 0) continue;
          if (b[c] && colorOf(b[c]) !== me) add(s, c);
          else if (c === this.ep) out.push({ from: s, to: c, piece: p, cap: me === 'w' ? 'p' : 'P', epCap: c - 8 * dir });
        }
      } else if (t === 'n' || t === 'k') {
        for (const [df, dr] of (t === 'n' ? KNIGHT : KING)) {
          const c = at(f + df, r + dr); if (c < 0) continue;
          if (!b[c] || colorOf(b[c]) !== me) add(s, c);
        }
        if (t === 'k') {
          const opp = me === 'w' ? 'b' : 'w', home = me === 'w' ? 4 : 60;
          if (s === home && !this.attacked(s, opp)) {
            const K = me === 'w' ? 'K' : 'k', Q = me === 'w' ? 'Q' : 'q', R = me === 'w' ? 'R' : 'r';
            if (this.castle.includes(K) && !b[s + 1] && !b[s + 2] && b[s + 3] === R && !this.attacked(s + 1, opp) && !this.attacked(s + 2, opp))
              out.push({ from: s, to: s + 2, piece: p, cap: '', castle: 'k' });
            if (this.castle.includes(Q) && !b[s - 1] && !b[s - 2] && !b[s - 3] && b[s - 4] === R && !this.attacked(s - 1, opp) && !this.attacked(s - 2, opp))
              out.push({ from: s, to: s - 2, piece: p, cap: '', castle: 'q' });
          }
        }
      } else {
        const dirs = t === 'r' ? ROOK : t === 'b' ? BISHOP : ROOK.concat(BISHOP);
        for (const [df, dr] of dirs) {
          let ff = f + df, rr = r + dr;
          while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
            const c = rr * 8 + ff;
            if (!b[c]) add(s, c);
            else { if (colorOf(b[c]) !== me) add(s, c); break; }
            ff += df; rr += dr;
          }
        }
      }
    }
    return out;
  }
  make(m) {
    const b = this.b;
    const u = { m, castle: this.castle, ep: this.ep, half: this.half, full: this.full, last: this.lastMove };
    b[m.to] = m.promo || m.piece; b[m.from] = '';
    if (m.epCap != null) b[m.epCap] = '';
    if (m.castle === 'k') { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = ''; }
    if (m.castle === 'q') { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = ''; }
    const kill = s => { const n = { 0: 'Q', 7: 'K', 56: 'q', 63: 'k' }[s]; if (n) this.castle = this.castle.replace(n, ''); };
    if (m.piece === 'K') this.castle = this.castle.replace(/[KQ]/g, '');
    if (m.piece === 'k') this.castle = this.castle.replace(/[kq]/g, '');
    kill(m.from); kill(m.to);
    this.ep = m.dbl ? (m.from + m.to) >> 1 : -1;
    this.half = (m.piece.toLowerCase() === 'p' || m.cap) ? 0 : this.half + 1;
    if (this.turn === 'b') this.full++;
    this.turn = this.turn === 'w' ? 'b' : 'w';
    this.lastMove = m;
    return u;
  }
  unmake(u) {
    const b = this.b, m = u.m;
    this.turn = this.turn === 'w' ? 'b' : 'w';
    b[m.from] = m.piece; b[m.to] = m.epCap != null ? '' : m.cap;
    if (m.epCap != null) b[m.epCap] = m.cap;
    if (m.castle === 'k') { b[m.from + 3] = b[m.from + 1]; b[m.from + 1] = ''; }
    if (m.castle === 'q') { b[m.from - 4] = b[m.from - 1]; b[m.from - 1] = ''; }
    this.castle = u.castle; this.ep = u.ep; this.half = u.half; this.full = u.full; this.lastMove = u.last;
  }
  legal() {
    const me = this.turn, out = [];
    for (const m of this.pseudo()) { const u = this.make(m); if (!this.inCheck(me)) out.push(m); this.unmake(u); }
    return out;
  }
  // ---- public, square names ----
  pieceAt(name) { const i = sqIndex(name); return i < 0 ? '' : this.b[i]; }
  movesFrom(name) { const i = sqIndex(name); return this.legal().filter(m => m.from === i).map(m => sqName(m.to)).filter((v, k, a) => a.indexOf(v) === k); }
  isLegal(from, to) { const f = sqIndex(from), t = sqIndex(to); return this.legal().some(m => m.from === f && m.to === t); }
  move(from, to, promo) {
    const f = sqIndex(from), t = sqIndex(to);
    const cands = this.legal().filter(m => m.from === f && m.to === t);
    if (!cands.length) return null;
    const want = (promo || 'q').toLowerCase();
    return this.play(cands.find(m => !m.promo || m.promo.toLowerCase() === want) || cands[0]);
  }
  play(m) {
    const u = this.make(m); this.hist.push(u);
    const k = this.key(); this.seen[k] = (this.seen[k] || 0) + 1;
    return m;
  }
  undo() {
    const u = this.hist.pop(); if (!u) return false;
    const k = this.key(); if (this.seen[k]) this.seen[k]--;
    this.unmake(u); return true;
  }
  insufficient() {
    const rest = this.b.filter(p => p && p.toLowerCase() !== 'k');
    return rest.length === 0 || (rest.length === 1 && 'nbNB'.includes(rest[0]));
  }
  status() {
    const moves = this.legal(), check = this.inCheck();
    if (!moves.length) return check ? { over: true, mate: true, check, winner: this.turn === 'w' ? 'b' : 'w' } : { over: true, stalemate: true, winner: null };
    if (this.half >= 100 || this.insufficient() || (this.seen[this.key()] || 0) >= 3) return { over: true, draw: true, winner: null };
    return { over: false, check, winner: null };
  }
  moveText(m) { return m ? sqName(m.from) + ' ' + sqName(m.to) : ''; }

  // ---- AI ----
  evaluate() { // from the side to move
    let s = 0;
    for (let i = 0; i < 64; i++) { const p = this.b[i]; if (!p) continue; const v = VALUE[p.toLowerCase()] + pst(p, i); s += isWhite(p) ? v : -v; }
    return this.turn === 'w' ? s : -s;
  }
  order(moves) {
    return moves.map(m => [m, (m.cap ? 10 * VALUE[m.cap.toLowerCase()] - VALUE[m.piece.toLowerCase()] / 10 + 1000 : 0) + (m.promo ? 800 : 0)])
      .sort((a, b) => b[1] - a[1]).map(x => x[0]);
  }
  quiesce(alpha, beta, depth) {
    this.nodes++;
    const stand = this.evaluate();
    if (depth === 0 || stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const me = this.turn;
    for (const m of this.order(this.pseudo().filter(m => m.cap || m.promo))) {
      const u = this.make(m);
      if (!this.inCheck(me)) { const v = -this.quiesce(-beta, -alpha, depth - 1); this.unmake(u); if (v >= beta) return v; if (v > alpha) alpha = v; }
      else this.unmake(u);
    }
    return alpha;
  }
  search(depth, alpha, beta, ply) {
    this.nodes++;
    if (depth === 0) return this.quiesce(alpha, beta, 4);
    const me = this.turn; let any = false;
    for (const m of this.order(this.pseudo())) {
      const u = this.make(m);
      if (this.inCheck(me)) { this.unmake(u); continue; }
      any = true;
      const v = -this.search(depth - 1, -beta, -alpha, ply + 1);
      this.unmake(u);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
      if (this.nodes > this.maxNodes) break;
    }
    if (!any) return this.inCheck(me) ? -30000 + ply : 0;
    return alpha;
  }
  // memory: {key: score} learned from earlier games; returns chosen move
  best(depth, memory) {
    depth = Math.max(1, Math.min(4, Math.round(depth) || 2));
    this.nodes = 0; this.maxNodes = 400000;
    const scored = [];
    for (const m of this.order(this.legal())) {
      const u = this.make(m);
      const rep = (this.seen[this.key()] || 0) >= 2;
      const v = rep ? 0 : -this.search(depth - 1, -40000, 40000, 1);
      this.unmake(u);
      scored.push({ m, v });
    }
    if (!scored.length) return null;
    const top = Math.max(...scored.map(s => s.v));
    const pos = this.key();
    // among moves that are about as good, prefer what worked in earlier games
    const near = scored.filter(s => s.v >= top - 25).map(s => {
      const learned = memory ? (memory[pos + '|' + this.moveText(s.m)] || 0) : 0;
      return { m: s.m, w: s.v + 40 * learned + Math.random() * 8 };
    });
    near.sort((a, b) => b.w - a.w);
    return near[0].m;
  }
}

Chess.sqName = sqName; Chess.sqIndex = sqIndex;
root.RakenChess = Chess;
if (typeof module !== 'undefined') module.exports = Chess;
})(typeof window !== 'undefined' ? window : globalThis);
