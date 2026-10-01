// Minimal SMTP-klient utan beroenden: TLS (port 465) eller STARTTLS (port 587),
// AUTH PLAIN/LOGIN, och ett MIME-meddelande med text- och HTML-del.
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
import os from 'node:os';

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n');
const encHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

export function buildMessage({ from, fromName, to, subject, text, html, replyTo }) {
  for (const v of [from, to, replyTo || '']) {
    if (/[\r\n]/.test(v)) throw new Error('Ogiltig adress');
  }
  const boundary = 'astro-' + crypto.randomBytes(12).toString('hex');
  const domain = from.split('@')[1] || 'localhost';
  const headers = [
    `From: ${fromName ? `${encHeader(fromName)} ` : ''}<${from}>`,
    `To: <${to}>`,
    `Subject: ${encHeader(subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-generated',
    ...(replyTo ? [`Reply-To: <${replyTo}>`] : []),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const part = (type, body) => [
    `--${boundary}`,
    `Content-Type: ${type}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(body)),
  ].join('\r\n');
  return `${headers.join('\r\n')}\r\n\r\n${part('text/plain', text)}\r\n${part('text/html', html)}\r\n--${boundary}--\r\n`;
}

class Conn {
  constructor(socket) { this.attach(socket); }

  attach(socket) {
    this.socket = socket;
    this.buf = '';
    this.waiters = [];
    this.lines = [];
    socket.setEncoding('utf8');
    socket.on('data', (d) => { this.buf += d; this.pump(); });
    socket.on('error', (e) => this.fail(e));
    socket.on('close', () => this.fail(new Error('SMTP-anslutningen stängdes')));
  }

  detach() { this.socket.removeAllListeners('data'); this.socket.removeAllListeners('error'); this.socket.removeAllListeners('close'); }

  pump() {
    let i;
    while ((i = this.buf.indexOf('\r\n')) >= 0) {
      const line = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + 2);
      this.lines.push(line);
      if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) {
        const reply = { code: +line.slice(0, 3), lines: this.lines.map((l) => l.slice(4)) };
        this.lines = [];
        this.waiters.shift()?.resolve(reply);
      }
    }
  }

  fail(e) { while (this.waiters.length) this.waiters.shift().reject(e); }

  read() { return new Promise((resolve, reject) => { this.waiters.push({ resolve, reject }); this.pump(); }); }

  async cmd(line, expect, secret = false) {
    if (line !== null) this.socket.write(line + '\r\n');
    const r = await this.read();
    const ok = Array.isArray(expect) ? expect.includes(r.code) : r.code === expect;
    if (!ok) {
      const shown = secret ? '(inloggning)' : line;
      throw new Error(`SMTP ${shown ?? 'hälsning'} → ${r.code} ${r.lines.join(' ')}`);
    }
    return r;
  }
}

function connect(opts) {
  return new Promise((resolve, reject) => {
    const base = { host: opts.host, port: opts.port, timeout: 30000 };
    const s = opts.secure
      ? tls.connect({ ...base, servername: opts.host, rejectUnauthorized: opts.rejectUnauthorized !== false })
      : net.connect(base);
    s.once(opts.secure ? 'secureConnect' : 'connect', () => resolve(s));
    s.once('error', reject);
    s.once('timeout', () => { s.destroy(); reject(new Error('SMTP-timeout')); });
  });
}

export async function sendMail(opts, msg) {
  const socket = await connect(opts);
  let c = new Conn(socket);
  try {
    await c.cmd(null, 220);
    const helo = opts.heloName || os.hostname() || 'localhost';
    let ehlo = await c.cmd(`EHLO ${helo}`, 250);
    const has = (cap) => ehlo.lines.some((l) => l.toUpperCase().startsWith(cap));
    if (!opts.secure && has('STARTTLS')) {
      await c.cmd('STARTTLS', 220);
      c.detach();
      const secured = await new Promise((resolve, reject) => {
        const t = tls.connect({ socket, servername: opts.host, rejectUnauthorized: opts.rejectUnauthorized !== false }, () => resolve(t));
        t.once('error', reject);
      });
      c = new Conn(secured);
      ehlo = await c.cmd(`EHLO ${helo}`, 250);
    } else if (!opts.secure && opts.requireTLS) {
      throw new Error('SMTP-servern erbjuder inte STARTTLS');
    }
    if (opts.user) {
      const authLine = ehlo.lines.find((l) => l.toUpperCase().startsWith('AUTH')) || '';
      if (/PLAIN/i.test(authLine) || !/LOGIN/i.test(authLine)) {
        await c.cmd(`AUTH PLAIN ${b64(`\0${opts.user}\0${opts.pass}`)}`, 235, true);
      } else {
        await c.cmd('AUTH LOGIN', 334);
        await c.cmd(b64(opts.user), 334, true);
        await c.cmd(b64(opts.pass), 235, true);
      }
    }
    await c.cmd(`MAIL FROM:<${msg.from}>`, 250);
    await c.cmd(`RCPT TO:<${msg.to}>`, [250, 251]);
    await c.cmd('DATA', 354);
    const data = buildMessage(msg).replace(/^\./gm, '..');
    c.socket.write(data);
    await c.cmd('.', 250);
    await c.cmd('QUIT', [221, 250]).catch(() => {});
  } finally {
    c.socket.end();
  }
}
