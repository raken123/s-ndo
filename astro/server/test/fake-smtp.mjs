// Låtsas-SMTP-server för tester: tar emot ett mejl och skriver det till en fil.
import net from 'node:net';
import fs from 'node:fs';

export function startFakeSmtp(port, outFile, { user = 'astro@tekniskamuseet.se', pass = 'hemligt' } = {}) {
  const log = [];
  const server = net.createServer((sock) => {
    sock.setEncoding('utf8');
    let buf = '', inData = false, data = '', authed = false, from = '', to = [];
    const say = (l) => sock.write(l + '\r\n');
    say('220 fake.smtp ESMTP');
    sock.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            fs.writeFileSync(outFile, JSON.stringify({ from, to, authed, data }));
            say('250 OK queued');
          } else data += (line.startsWith('..') ? line.slice(1) : line) + '\r\n';
          continue;
        }
        log.push(line);
        const up = line.toUpperCase();
        if (up.startsWith('EHLO')) { sock.write('250-fake.smtp\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 100000000\r\n'); }
        else if (up.startsWith('AUTH PLAIN ')) {
          const [, u, p] = Buffer.from(line.slice(11), 'base64').toString().split('\0');
          authed = u === user && p === pass;
          say(authed ? '235 OK' : '535 bad');
        } else if (up.startsWith('MAIL FROM:')) { from = line.slice(10); say('250 OK'); }
        else if (up.startsWith('RCPT TO:')) { to.push(line.slice(8)); say('250 OK'); }
        else if (up === 'DATA') { inData = true; say('354 go'); }
        else if (up === 'QUIT') { say('221 bye'); sock.end(); }
        else say('502 ?');
      }
    });
  });
  return new Promise((r) => server.listen(port, () => r({ server, log })));
}
