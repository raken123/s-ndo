// Raken AI — deployment configuration. Edit this file before shipping.
window.RAKEN_CONFIG = {
  version: "1.0.0",
  appName: "Raken AI",

  // Pro pricing shown in the app (USD).
  proMonthly: 24,
  founderDiscount: 0.98,      // 98% off
  founderSpots: 10,           // "First 10 people"
  founderMonths: 12,          // how long the founder price lasts

  // Where "Get Pro" / "Claim my spot" sends people. A Stripe Payment Link,
  // Lemon Squeezy checkout, Gumroad page… anything. Leave empty to show the
  // built-in claim form instead.
  checkoutUrl: "",
  founderCheckoutUrl: "",

  // Optional JSON endpoint returning {"claimed": <number>} so the founder
  // counter is live across devices. Leave empty for a static counter.
  founderStatusUrl: "",

  // Optional: support contact shown on the Pro page.
  supportUrl: "",

  // Public key (JWK, ECDSA P-256) used to verify license keys made with
  // tools/genkey.mjs. null = development mode: keys are only format-checked.
  licensePublicKey: null,

  // Free plan daily limits (per device). Pro is unlimited.
  freeLimits: { chat: 30, image: 15, video: 1, agent: 5 },

  // Model catalogue. "pro" models are only selectable on Pro.
  models: [
    { id: "claude-opus-5",    name: "Raken Ultra (Claude Opus 5)",     pro: false },
    { id: "claude-sonnet-5",  name: "Raken Fast (Claude Sonnet 5)",    pro: false },
    { id: "claude-fable-5-1", name: "Raken Fable (Claude Fable 5.1)",  pro: true  }
  ],
  defaultModel: "claude-opus-5"
};
