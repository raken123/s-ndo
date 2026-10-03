// BFDI Talk accounts (Supabase): sign in, profile, credits, subscriptions, Dec 23 bonus.
// Uses the supabase-js UMD build in www/vendor/supabase.js (copied there by scripts/write-config.mjs).

const ENTITLED = new Set(['trialing', 'active', 'past_due']);
const SPEND_FLUSH_MS = 10000;

export class Account extends EventTarget {
  constructor() {
    super();
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

  /** Entitled plan: 'free' | 'lite' | 'pro'. */
  get plan() {
    const p = this.profile;
    return p && ENTITLED.has(p.plan_status) ? p.plan : 'free';
  }

  get isPro() { return this.plan === 'pro'; }
  get onTrial() { return this.profile?.plan_status === 'trialing'; }
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
    if (!this.user) return 0;
    const { data, error } = await this.client.rpc('claim_dec23_bonus');
    if (error || !data) return 0;
    await this.refresh();
    return Number(data);
  }

  // ----- server functions

  async call(name, body = {}) {
    const { data, error } = await this.client.functions.invoke(name, { body });
    if (error) {
      let msg = error.message;
      try {
        const body = await error.context.json();
        msg = body.error || body.message || msg;
      } catch { /* keep the generic message */ }
      if (error.context?.status === 404 && /not found/i.test(msg)) msg = 'This feature is not set up on the server yet.';
      throw new Error(msg);
    }
    return data;
  }

  /** { plan: 'pro' | 'lite' } or { pack: 'credits_5' | 'credits_10' | 'credits_20' } */
  async checkoutUrl(what) { return (await this.call('create-checkout', what)).url; }
  async portalUrl() { return (await this.call('billing-portal')).url; }
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
