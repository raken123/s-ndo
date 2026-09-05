/* Raken AI — Pro plan, founder offer, license keys */
(function () {
  const R = window.Raken; const S = R.settings; const C = R.config; const $ = R.$;
  const pro = R.pro = {};
  const money = (n) => "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");
  pro.founderPrice = () => C.proMonthly * (1 - C.founderDiscount);

  document.addEventListener("DOMContentLoaded", () => {
    render();
    $("#founder-claim").onclick = claim;
    $("#pro-buy").onclick = () => buy(false);
    $("#license-apply").onclick = () => activate($("#license-input").value.trim());
    document.addEventListener("raken:settings", render);
    document.addEventListener("raken:go", (e) => { if (e.detail === "pro") { render(); refreshCounter(); } });
  });

  function render() {
    const free = C.freeLimits;
    $("#plan-free-list").innerHTML = [free.chat + " chat messages per day", free.image + " images per day", free.video + " video per day", free.agent + " agent runs per day", "Raken Ultra & Fast models", "Attach images, PDFs and files", "All data stays on your device"].map((x) => "<li>" + x + "</li>").join("");
    $("#plan-pro-list").innerHTML = ["Unlimited chat, images and agents", "Unlimited video generation", "Raken Fable (Claude Fable 5.1) — the most capable model", "Extra-high and Max effort modes", "Priority access to new features", "Early access to Raken Cloud (no API keys needed)", "Support the project ❤"].map((x) => "<li>" + x + "</li>").join("");
    $("#pro-price").innerHTML = money(C.proMonthly) + "<span>/month</span><small>or " + money(pro.founderPrice()) + "/month with the founder offer</small>";
    $("#founder-was").textContent = money(C.proMonthly) + "/month";
    $("#founder-now").innerHTML = money(pro.founderPrice()) + "<span>/month for " + C.founderMonths + " months</span>";
    const chip = $("#plan-chip");
    if (R.isPro()) {
      chip.classList.add("pro"); chip.querySelector(".plan-chip-title").textContent = "Pro plan ⭐"; $("#plan-chip-sub").textContent = S.licenseEmail ? "Licensed to " + S.licenseEmail : "Unlimited usage unlocked";
      chip.querySelector("button").textContent = "Manage"; $("#pro-buy").textContent = "You're on Pro"; $("#pro-buy").disabled = true; $("#founder-claim").textContent = "You're in 🎉"; $("#founder-claim").disabled = true;
      $("#license-status").innerHTML = "✅ Pro active" + (S.licenseEmail ? " for " + R.esc(S.licenseEmail) : "") + ' · <a href="#" id="license-remove">deactivate</a>';
      $("#license-remove").onclick = (e) => { e.preventDefault(); R.saveSettings({ pro: false, license: "", licenseEmail: "" }); R.toast("Pro deactivated on this device"); };
    } else {
      chip.classList.remove("pro"); chip.querySelector(".plan-chip-title").textContent = "Free plan"; $("#plan-chip-sub").innerHTML = "First 10 people get <b>98% off Pro</b>"; chip.querySelector("button").textContent = "Claim founder spot";
      $("#pro-buy").textContent = "Get Pro"; $("#pro-buy").disabled = false; $("#founder-claim").disabled = false;
      $("#founder-claim").textContent = S.founderClaim ? "Spot reserved · " + S.founderClaim.code : "Claim my spot";
      if (!$("#license-status").textContent.startsWith("❌")) $("#license-status").textContent = "";
    }
    $("#founder-sub").textContent = "That's " + money(pro.founderPrice()) + " instead of " + money(C.proMonthly) + " a month, locked for " + C.founderMonths + " months. " + spotsText(pro.claimed);
  }
  pro.claimed = null;
  function spotsText(claimed) {
    if (claimed == null) return C.founderSpots + " spots in total.";
    const left = Math.max(0, C.founderSpots - claimed); return left ? left + " of " + C.founderSpots + " spots left." : "All " + C.founderSpots + " spots are taken.";
  }
  async function refreshCounter() {
    if (!C.founderStatusUrl) return;
    try { const r = await R.net.request(C.founderStatusUrl, { responseType: "json" }); if (r.ok && r.json && typeof r.json.claimed === "number") { pro.claimed = r.json.claimed; render(); } } catch (e) { }
  }

  function buy(founder) {
    const url = founder ? (C.founderCheckoutUrl || C.checkoutUrl) : C.checkoutUrl;
    if (url) { const u = new URL(url); if (S.founderClaim) u.searchParams.set("code", S.founderClaim.code); window.open(u.toString(), "_blank", "noopener"); return true; }
    return false;
  }
  function claim() {
    if (S.founderClaim) { if (!buy(true)) R.toast("Your spot is reserved with code " + S.founderClaim.code + ". Checkout opens soon — keep this code.", "ok"); return; }
    const email = prompt("Your email, so we can attach the founder discount to you:", S.licenseEmail || "");
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if (email !== null) R.toast("That doesn't look like an email", "err"); return; }
    const code = "RKF-" + R.uid().toUpperCase().slice(-6);
    R.saveSettings({ founderClaim: { email, code, ts: Date.now() } });
    if (!buy(true)) R.toast("Spot reserved 🎉 Your founder code is " + code + ". It's saved in this app; you'll use it at checkout.", "ok");
    render();
  }

  // ---------- license keys ----------
  // Format: RAKEN.<base64url(JSON payload)>.<base64url(ECDSA P-256 signature)>
  const b64u = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const b64uBytes = (s) => Uint8Array.from(b64u(s), (c) => c.charCodeAt(0));
  async function verify(key) {
    const m = /^RAKEN\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(key); if (!m) throw new Error("That isn't a Raken license key");
    let payload; try { payload = JSON.parse(b64u(m[1])); } catch (e) { throw new Error("Malformed license key"); }
    if (payload.p !== "pro") throw new Error("This key isn't for Pro");
    if (payload.x && Date.now() > new Date(payload.x).getTime()) throw new Error("This key expired on " + new Date(payload.x).toLocaleDateString());
    if (C.licensePublicKey) {
      if (!window.crypto || !crypto.subtle) throw new Error("This platform can't verify keys (no secure context)");
      const pub = await crypto.subtle.importKey("jwk", C.licensePublicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64uBytes(m[2]), new TextEncoder().encode(m[1]));
      if (!ok) throw new Error("Invalid signature");
    } else if (m[2].length < 8) throw new Error("Invalid signature");
    return payload;
  }
  async function activate(key) {
    const st = $("#license-status");
    try {
      const p = await verify(key);
      R.saveSettings({ pro: true, license: key, licenseEmail: p.e || "" }); $("#license-input").value = "";
      R.toast("Welcome to Raken AI Pro 🎉", "ok"); render();
    } catch (e) { st.textContent = "❌ " + e.message; }
  }
  pro.activate = activate;
})();
