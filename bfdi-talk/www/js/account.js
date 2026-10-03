// BFDI Talk accounts (Supabase): sign in, profile, credits, plans, Dec 23 bonus.
// Uses the supabase-js UMD build in www/vendor/supabase.js (copied there by scripts/write-config.mjs).
//
// Plans are free to switch. Signed in, the plan lives on the server; as a guest (or when accounts
// aren't switched on) it is kept on this device and its credits go to the device's wallet.

import { PLANS, DEC23, monthlyTopUp } from './plans.js';

const SPEND_FLUSH_MS = 10000;
const LOCAL_KEY = 'bfdi.plan.v1';

export class Account extends EventTarget {
  constructor(storage = globalThis.localStorage) {
    super();
    this.storage = storage;
    this.local = this.loadLocal();
    this.client = null;
    this.user = null;
    this.profile = null;
    this.pendingSpend = 0; // spent locally, not sent yet
    this.inFlight = 0;     // sent, waiting for the server
    this.flushTimer = null;
  }

  emit() { this.dispatchEvent(new Event('change')); }

  get enabled() { return !!this.client; }
  get signedIn() { return !!this.user; }

  /** Current plan: 'free' | 'lite' | 'pro'. */
  get plan() {
    if (this.user) {
      const p = this.profile;
      return p && p.plan_status === 'active' ? p.plan : 'free';
    }
    return this.local.plan;
  }

  get isPro() { return this.plan === 'pro'; }
  get credits() { return Math.max(0, (this.profile?.credits || 0) - this.pendingSpend - this.inFlight); }
  get displayName() { return this.profile?.username || this.user?.email?.split('@')[0] || 'Player'; }

  async init({ url, key }) {
    if (!url || !key || !window.supabase?.createClient) return false;
    this.client = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    this.client.auth.onAuthStateChange((_event, session) => {
      const was = this.user?.id;
      this.user = session?.user || null;
      if (this.user && this.user.id !== was) this.refresh();
      if (!this.user) { this.profile = null; this.pendingSpend = this.inFlight = 0; }
      this.dispatchEvent(new Event('auth'));
      this.emit();
    });
    const { data } = await this.client.auth.getSession();
    this.user = data.session?.user || null;
    if (this.user) await this.refresh();
    window.addEventListener('beforeunload', () => this.flush());
    return true;
  }

  async refresh() {
    if (!this.user) return;
    const { data, error } = await this.client.from('profiles').select('*').eq('id', this.user.id).maybeSingle();
    if (!error && data) {
      this.profile = data;
      this.emit();
    }
  }

  // ----- auth

  async signUp(email, password, username) {
    username = username.trim();
    if (!/^[A-Za-z0-9_ .-]{2,24}$/.test(username)) throw new Error('Pick a username with 2–24 letters, numbers, spaces, _ . or -');
    const { data: free } = await this.client.rpc('username_available', { p_name: username });
    if (free === false) throw new Error('That username is taken. Try another one!');
    const { data, error } = await this.client.auth.signUp({ email, password, options: { data: { username } } });
    if (error) throw new Error(friendlyAuthError(error));
    return { needsConfirm: !data.session };
  }

  async signIn(email, password) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendlyAuthError(error));
  }

  async signOut() {
    await this.flush();
    await this.client.auth.signOut();
  }

  async resetPassword(email) {
    const { error } = await this.client.auth.resetPasswordForEmail(email);
    if (error) throw new Error(friendlyAuthError(error));
  }

  async setUsername(name) {
    name = name.trim();
    if (!/^[A-Za-z0-9_ .-]{2,24}$/.test(name)) throw new Error('Usernames are 2–24 letters, numbers, spaces, _ . or -');
    const { error } = await this.client.rpc('set_username', { p_name: name });
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'That username is taken.' : error.message);
    await this.refresh();
  }

  // ----- credits

  /** Called by the usage meter; sent to the server in batches. */
  spend(n) {
    this.pendingSpend += n;
    if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), SPEND_FLUSH_MS);
    this.emit();
  }

  async flush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
    while (this.pendingSpend > 0 && this.user) {
      const n = Math.min(this.pendingSpend, 9000);
      this.pendingSpend -= n;
      this.inFlight += n;
      const { data, error } = await this.client.rpc('spend_credits', { p_amount: n });
      this.inFlight -= n;
      if (error) { this.pendingSpend += n; break; }
      if (this.profile) this.profile.credits = data;
    }
    this.emit();
  }

  async claimDec23Bonus() {
    if (!this.user) {
      const l = this.local;
      const amount = PLANS[l.plan]?.dec23Credits || 0;
      if (Date.now() < DEC23 || l.dec23Claimed || !amount || !l.since || l.since >= DEC23) return 0;
      l.dec23Claimed = true;
      this.saveLocal();
      return amount;
    }
    const { data, error } = await this.client.rpc('claim_dec23_bonus');
    if (error || !data) return 0;
    await this.refresh();
    return Number(data);
  }

  // ----- plans (free to switch)

  loadLocal() {
    try {
      const s = JSON.parse(this.storage?.getItem(LOCAL_KEY));
      if (s && PLANS[s.plan]) return s;
    } catch { /* fresh start */ }
    return { plan: 'free', since: 0, periodStart: 0, granted: 0, dec23Claimed: false };
  }

  saveLocal() {
    try { this.storage?.setItem(LOCAL_KEY, JSON.stringify(this.local)); } catch { /* storage blocked */ }
  }

  /** Where new credits from a plan land: 'account' (signed in) or 'device' (the caller adds them). */
  get creditsGoTo() { return this.user ? 'account' : 'device'; }

  /** Switches plan right away. Returns the monthly credits that came with it. */
  async switchPlan(plan) {
    if (!PLANS[plan]) throw new Error('Unknown plan');
    if (this.user) {
      const { data, error } = await this.client.rpc('switch_plan', { p_plan: plan });
      if (error) throw new Error(error.message);
      await this.refresh();
      return Number(data) || 0;
    }
    const was = this.local.plan;
    this.local.plan = plan;
    this.local.since = plan === 'free' ? 0 : (was === 'free' || !this.local.since ? Date.now() : this.local.since);
    const owed = this.topUpLocal();
    this.emit();
    return owed;
  }

  /** This period's monthly credits that haven't been given yet (call on start-up). */
  async claimMonthly() {
    if (this.user) {
      const { data, error } = await this.client.rpc('claim_monthly_credits');
      if (error || !data) return 0;
      await this.refresh();
      return Number(data);
    }
    return this.topUpLocal();
  }

  topUpLocal() {
    const { state, owed } = monthlyTopUp(this.local, this.local.plan);
    this.local = state;
    this.saveLocal();
    return owed;
  }
}

function friendlyAuthError(error) {
  const m = error.message || '';
  if (/invalid login/i.test(m)) return 'Wrong email or password.';
  if (/already registered|already exists/i.test(m)) return 'That email already has an account — sign in instead.';
  if (/password should be|weak/i.test(m)) return 'Use a longer password (at least 8 characters).';
  if (/email not confirmed/i.test(m)) return 'Check your email and tap the confirmation link first.';
  if (/rate limit/i.test(m)) return 'Too many tries — wait a minute and try again.';
  return m;
}
