import crypto from 'node:crypto';

// SHA-256-fingeravtryck för "Apple Root CA - G3" (https://www.apple.com/certificateauthority/).
// Kan skrivas över med APPLE_ROOT_CA_G3_SHA256 om Apple byter rotcertifikat.
const APPLE_ROOT_G3_SHA256 = '63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179';

// Verifierar en StoreKit 2 "signedTransaction" (JWS) från iPhone-appen:
// certifikatkedjan i x5c måste gå upp till Apples rotcertifikat och signaturen måste stämma.
export function verifyAppleTransaction(jws, { rootFingerprint = APPLE_ROOT_G3_SHA256, now = Date.now() } = {}) {
  const parts = String(jws || '').split('.');
  if (parts.length !== 3) throw new Error('Ogiltig transaktion.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  if (header.alg !== 'ES256' || !Array.isArray(header.x5c) || header.x5c.length !== 3) {
    throw new Error('Ogiltig transaktion.');
  }
  const [leaf, intermediate, root] = header.x5c.map((c) => new crypto.X509Certificate(Buffer.from(c, 'base64')));
  const fp = root.fingerprint256.replace(/:/g, '').toUpperCase();
  if (fp !== rootFingerprint.replace(/:/g, '').toUpperCase()) throw new Error('Okänt rotcertifikat.');
  for (const c of [leaf, intermediate, root]) {
    if (Date.parse(c.validFrom) > now || Date.parse(c.validTo) < now) throw new Error('Certifikatet är inte giltigt.');
  }
  if (!intermediate.checkIssued(root) || !intermediate.verify(root.publicKey)) throw new Error('Ogiltig certifikatkedja.');
  if (!leaf.checkIssued(intermediate) || !leaf.verify(intermediate.publicKey)) throw new Error('Ogiltig certifikatkedja.');
  const ok = crypto.verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('Ogiltig signatur.');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}
