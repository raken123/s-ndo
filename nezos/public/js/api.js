// Shared client helpers for every Nezos page.
export async function api(path, { method = 'GET', body, raw, headers = {} } = {}) {
  const opts = { method, headers: { 'x-nezos': '1', ...headers }, credentials: 'same-origin' };
  if (raw) {
    opts.body = raw;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.upgrade = data?.upgrade;
    throw err;
  }
  return data;
}

export async function me() {
  try { return await api('/api/me'); } catch { return { user: null }; }
}

export async function requireLogin() {
  const m = await me();
  if (!m.user) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    throw new Error('redirecting');
  }
  return m;
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = '/';
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

let toastHost;
export function toast(message, kind = 'info', ms = 3500) {
  if (!toastHost) {
    toastHost = h('<div class="toasts"></div>');
    document.body.appendChild(toastHost);
  }
  const el = h(`<div class="toast toast-${kind}">${esc(message)}</div>`);
  toastHost.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}

export const fmtCredits = (n) => Number(n || 0).toLocaleString('en-US');

export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const LOGO = `<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><defs><linearGradient id="nzg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9b7bff"/><stop offset="1" stop-color="#3ad1ff"/></linearGradient></defs><path d="M16 2 29 9.5v13L16 30 3 22.5v-13z" fill="url(#nzg)"/><path d="M10.5 21V11l11 10V11" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Tiny, safe markdown: headings, bold, italics, inline code, code blocks, lists, paragraphs. */
export function markdown(src = '') {
  const blocks = String(src).split(/```/);
  let out = '';
  blocks.forEach((b, i) => {
    if (i % 2) {
      out += `<pre><code>${esc(b.replace(/^\w*\n/, ''))}</code></pre>`;
      return;
    }
    const lines = esc(b).split('\n');
    let list = null;
    for (let line of lines) {
      line = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
      const li = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
      if (li) {
        if (!list) { out += '<ul>'; list = true; }
        out += `<li>${li[1]}</li>`;
        continue;
      }
      if (list) { out += '</ul>'; list = null; }
      const hd = line.match(/^(#{1,4})\s+(.*)/);
      if (hd) out += `<h${hd[1].length + 2}>${hd[2]}</h${hd[1].length + 2}>`;
      else if (line.trim()) out += `<p>${line}</p>`;
    }
    if (list) out += '</ul>';
  });
  return out;
}
