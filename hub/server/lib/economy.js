'use strict';
const C = require('./catalog');
const { err } = require('./auth');

class Economy {
  constructor(db, payments) {
    this.db = db;
    this.payments = payments || new SandboxPayments();
    // seed the catalog (idempotent so a newer server can add items)
    for (const it of C.ITEMS) db.data.items[it.id] = it;
  }

  publicUser(u) {
    return {
      id: u.id, name: u.name, displayName: u.displayName, gems: u.gems,
      avatar: this.avatarOf(u), owned: u.owned, stats: u.stats, created: u.created,
      lastDaily: u.lastDaily, likes: u.likes || [],
    };
  }
  avatarOf(u) {
    const it = this.db.data.items;
    return {
      color: (it[u.avatar.color] || it.c_blue).value,
      hat: (it[u.avatar.hat] || it.h_none).value,
      trail: (it[u.avatar.trail] || it.t_none).value,
      colorId: u.avatar.color, hatId: u.avatar.hat, trailId: u.avatar.trail,
    };
  }

  ledger(u, type, amount, note) {
    u.ledger.push({ ts: Date.now(), type, amount, note });
    if (u.ledger.length > 200) u.ledger.splice(0, u.ledger.length - 200);
  }

  credit(u, amount, type, note) {
    amount = Math.floor(amount);
    if (amount <= 0) return;
    u.gems += amount;
    if (type !== 'purchase') u.stats.earned += amount;
    this.ledger(u, type, amount, note);
    this.db.save();
  }

  debit(u, amount, type, note) {
    amount = Math.floor(amount);
    if (u.gems < amount) throw err('Not enough Gems', 'insufficient');
    u.gems -= amount;
    this.ledger(u, type, -amount, note);
    this.db.save();
  }

  claimDaily(u) {
    const day = 24 * 3600 * 1000;
    if (Date.now() - u.lastDaily < day) {
      const hours = Math.ceil((day - (Date.now() - u.lastDaily)) / 3600000);
      throw err('Daily bonus already claimed. Come back in ' + hours + 'h', 'too_soon');
    }
    u.lastDaily = Date.now();
    this.credit(u, C.DAILY_BONUS, 'daily', 'Daily bonus');
    return C.DAILY_BONUS;
  }

  buyItem(u, itemId) {
    const it = this.db.data.items[itemId];
    if (!it) throw err('No such item');
    if (u.owned.items.includes(itemId)) throw err('You already own that');
    this.debit(u, it.price, 'shop', 'Bought ' + it.name);
    u.owned.items.push(itemId);
    this.db.save();
    return it;
  }

  equip(u, itemId) {
    const it = this.db.data.items[itemId];
    if (!it) throw err('No such item');
    if (!u.owned.items.includes(itemId)) throw err('You do not own that item');
    u.avatar[it.kind] = itemId;
    this.db.save();
    return this.avatarOf(u);
  }

  /**
   * Gem packs. Real-money checkout is delegated to a payment adapter; the
   * bundled one is a sandbox that fulfils immediately. Swap in a Stripe /
   * Play Billing / StoreKit bridge for production.
   */
  buyGems(u, packId, receipt) {
    const pack = C.GEM_PACKS.find(p => p.id === packId);
    if (!pack) throw err('No such pack');
    const ok = this.payments.charge(u, pack, receipt);
    if (!ok) throw err('Payment was not approved', 'payment');
    u.gems += pack.gems;
    this.ledger(u, 'purchase', pack.gems, 'Gem pack: ' + pack.label + (this.payments.sandbox ? ' (sandbox)' : ''));
    this.db.data.platform.gemsSold += pack.gems;
    this.db.save();
    return pack;
  }

  buyPass(u, game, passId) {
    const pass = (game.passes || []).find(p => p.id === passId);
    if (!pass) throw err('No such game pass');
    if (u.owned.passes.includes(passId)) throw err('You already own this pass');
    if (game.creator === u.id) throw err('You own this game; its passes are already yours');
    this.debit(u, pass.price, 'pass', 'Game pass: ' + pass.name + ' (' + game.name + ')');
    u.owned.passes.push(passId);
    const fee = Math.floor(pass.price * C.PLATFORM_FEE);
    const payout = pass.price - fee;
    this.db.data.platform.fees += fee;
    this.db.data.platform.passesSold += 1;
    const creator = this.db.data.users[game.creator];
    if (creator && payout > 0) {
      this.credit(creator, payout, 'sale', u.displayName + ' bought ' + pass.name + ' in ' + game.name);
      creator.stats.passesSold += 1;
    }
    game.stats.passSales = (game.stats.passSales || 0) + 1;
    game.stats.revenue = (game.stats.revenue || 0) + payout;
    this.db.save();
    return pass;
  }

  perksFor(u, game) {
    const perks = new Set();
    for (const p of game.passes || []) {
      if (game.creator === u.id || u.owned.passes.includes(p.id)) perks.add(p.perk);
    }
    return [...perks];
  }
}

class SandboxPayments {
  constructor() { this.sandbox = true; }
  charge(user, pack, receipt) {
    // Accepts anything. A production adapter verifies `receipt` with the store.
    return true;
  }
}

module.exports = { Economy, SandboxPayments };
