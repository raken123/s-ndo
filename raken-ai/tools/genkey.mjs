#!/usr/bin/env node
// Raken AI license keys (ECDSA P-256, verified in the app with WebCrypto).
//
//   node genkey.mjs keygen
//       Prints a public JWK (paste into app/config.js as licensePublicKey) and a
//       private JWK (keep secret; put it in RAKEN_LICENSE_PRIVATE_KEY).
//
//   RAKEN_LICENSE_PRIVATE_KEY='{...}' node genkey.mjs issue --email someone@example.com [--months 12]
//       Prints a license key: RAKEN.<payload>.<signature>
//
//   node genkey.mjs verify <key> --public '{...jwk...}'
import { generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, def) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : def; };
const b64u = (buf) => Buffer.from(buf).toString("base64url");

if (cmd === "keygen") {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  console.log("# Public key — paste into app/config.js:\n  licensePublicKey: " + JSON.stringify(publicKey.export({ format: "jwk" })) + ",\n");
  console.log("# Private key — KEEP SECRET, export as RAKEN_LICENSE_PRIVATE_KEY:\n" + JSON.stringify(privateKey.export({ format: "jwk" })));
} else if (cmd === "issue") {
  const jwk = process.env.RAKEN_LICENSE_PRIVATE_KEY; if (!jwk) { console.error("Set RAKEN_LICENSE_PRIVATE_KEY (see: genkey.mjs keygen)"); process.exit(1); }
  const email = opt("email"); if (!email) { console.error("--email is required"); process.exit(1); }
  const months = +opt("months", 0);
  const exp = months ? new Date(Date.now() + months * 30.44 * 86400e3).toISOString().slice(0, 10) : 0;
  const payload = b64u(JSON.stringify({ e: email, p: "pro", x: exp, i: new Date().toISOString().slice(0, 10) }));
  const key = createPrivateKey({ key: JSON.parse(jwk), format: "jwk" });
  const sig = sign("sha256", Buffer.from(payload), { key, dsaEncoding: "ieee-p1363" });
  console.log("RAKEN." + payload + "." + b64u(sig));
} else if (cmd === "verify") {
  const [, payload, sig] = /^RAKEN\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(args[1]) || [];
  if (!payload) { console.error("Not a Raken key"); process.exit(1); }
  const pub = createPublicKey({ key: JSON.parse(opt("public")), format: "jwk" });
  const ok = verify("sha256", Buffer.from(payload), { key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url"));
  console.log(ok ? "VALID " + Buffer.from(payload, "base64url").toString() : "INVALID");
  process.exit(ok ? 0 : 1);
} else {
  console.log("Usage: genkey.mjs keygen | issue --email <email> [--months N] | verify <key> --public <jwk>");
}
