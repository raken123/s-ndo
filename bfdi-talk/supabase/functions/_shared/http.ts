// Request helpers + a tiny Supabase REST client (no imports, so functions boot instantly).

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing secret ${name}`);
  return v;
}

// deno-lint-ignore no-explicit-any
export type Row = Record<string, any>;

/** Service-role access to PostgREST (bypasses row-level security — server use only). */
export class Db {
  constructor(private url = env('SUPABASE_URL'), private key = env('SUPABASE_SERVICE_ROLE_KEY')) {}

  private async call(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.key, authorization: `Bearer ${this.key}`, 'content-type': 'application/json',
        prefer: 'return=representation', ...(init.headers || {}),
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Database error ${res.status}: ${text}`);
    return text ? JSON.parse(text) : null;
  }

  /** First row matching e.g. { id: 'eq.123' }, or null. */
  async one(table: string, filter: Record<string, string>, select = '*'): Promise<Row | null> {
    const q = new URLSearchParams({ ...filter, select, limit: '1' });
    const rows = await this.call(`${table}?${q}`) as Row[];
    return rows[0] ?? null;
  }

  async update(table: string, filter: Record<string, string>, patch: Row): Promise<void> {
    await this.call(`${table}?${new URLSearchParams(filter)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  rpc(fn: string, args: Row): Promise<unknown> {
    return this.call(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  }

  /** The signed-in user behind a request's Authorization header, or null. */
  async user(req: Request): Promise<{ id: string; email?: string } | null> {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const res = await fetch(`${this.url}/auth/v1/user`, { headers: { apikey: this.key, authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return u?.id ? { id: u.id, email: u.email } : null;
  }
}
