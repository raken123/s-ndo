import crypto from 'node:crypto';
import http2 from 'node:http2';

// Push till iPhone-appen via Apple Push Notification service (token-baserad auth).
// Kräver APNS_KEY (innehållet i .p8-filen), APNS_KEY_ID, APNS_TEAM_ID och APNS_BUNDLE_ID.
export function createApns({ key, keyId, teamId, bundleId, log = console }) {
  if (!key || !keyId || !teamId || !bundleId) return null;
  const privateKey = crypto.createPrivateKey(key.replace(/\\n/g, '\n'));
  let jwt = null;
  let jwtAt = 0;

  function token() {
    const now = Math.floor(Date.now() / 1000);
    if (jwt && now - jwtAt < 50 * 60) return jwt; // Apple kräver nytt token minst varje timme
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${enc({ alg: 'ES256', kid: keyId })}.${enc({ iss: teamId, iat: now })}`;
    const sig = crypto.sign('sha256', Buffer.from(unsigned), { key: privateKey, dsaEncoding: 'ieee-p1363' });
    jwt = `${unsigned}.${sig.toString('base64url')}`;
    jwtAt = now;
    return jwt;
  }

  function sendOne(device, payload, collapseId) {
    const host = device.env === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
    return new Promise((resolve) => {
      const client = http2.connect(host);
      client.on('error', (e) => { log.warn('APNs:', e.message); resolve({ ok: false }); });
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${device.token}`,
        authorization: `bearer ${token()}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
        ...(collapseId ? { 'apns-collapse-id': collapseId } : {}),
      });
      let status = 0;
      let body = '';
      req.on('response', (h) => { status = h[':status']; });
      req.on('data', (c) => { body += c; });
      req.on('end', () => { client.close(); resolve({ ok: status === 200, status, body }); });
      req.on('error', (e) => { client.close(); log.warn('APNs:', e.message); resolve({ ok: false }); });
      req.end(JSON.stringify(payload));
    });
  }

  return {
    // Tidskänslig notis: bryter igenom Fokus-lägen på iPhone. collapseId = samma id som appens
    // lokala notiser, så att samma påminnelse inte visas två gånger.
    async sendTimeSensitive(devices, { title, body, orderId, collapseId, threadId = 'orders' }) {
      const payload = {
        aps: {
          alert: { title, body },
          sound: 'default',
          'interruption-level': 'time-sensitive',
          'relevance-score': 1,
          'thread-id': threadId,
        },
        orderId,
      };
      const results = await Promise.all(devices.map((d) => sendOne(d, payload, collapseId)));
      // Returnera tokens som Apple säger är ogiltiga så att de kan tas bort.
      return devices.filter((d, i) => results[i].status === 410 || /BadDeviceToken|Unregistered/.test(results[i].body || ''))
        .map((d) => d.token);
    },
  };
}
