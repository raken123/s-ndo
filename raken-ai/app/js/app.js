/* Raken AI — app shell: navigation, onboarding, PWA */
(function () {
  const R = window.Raken; const S = R.settings; const $ = R.$;
  const VIEWS = ["chat", "images", "videos", "work", "code", "gallery", "docs", "pro", "settings"];

  function show(view) {
    if (!VIEWS.includes(view)) view = "chat";
    R.$$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    R.$$("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $("#main").scrollTop = 0;
    if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
    $("#more-sheet").hidden = true;
    document.dispatchEvent(new CustomEvent("raken:go", { detail: view }));
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#platform-badge").textContent = R.platformLabel + " · v" + R.version;
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-view],[data-goto]"); if (!b) return;
      const v = b.dataset.view || b.dataset.goto;
      if (v === "more") { $("#more-sheet").hidden = false; return; }
      show(v);
    });
    $("#more-close").onclick = () => { $("#more-sheet").hidden = true; };
    $("#more-sheet").onclick = (e) => { if (e.target === $("#more-sheet")) $("#more-sheet").hidden = true; };
    document.addEventListener("raken:go", (e) => { if (e.detail !== currentView()) show(e.detail); });
    window.addEventListener("hashchange", () => show(location.hash.slice(1)));
    show(location.hash.slice(1) || "chat");

    // onboarding
    if (!S.onboarded) {
      const ob = $("#onboarding"); ob.hidden = false;
      const finish = (goPro) => { R.saveSettings({ onboarded: true, name: $("#onb-name").value.trim() || S.name, anthropicKey: $("#onb-key").value.trim() || S.anthropicKey }); ob.hidden = true; if (goPro) show("pro"); };
      $("#onb-start").onclick = () => finish(false);
      $("#onb-pro").onclick = () => finish(true);
    }

    // theme follows system if requested
    matchMedia("(prefers-color-scheme: light)").addEventListener("change", R.applyTheme);

    // open external links outside the app on Android / desktop
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href^='http']"); if (!a) return;
      if (R.platform === "android" && window.RakenAndroid.openExternal) { e.preventDefault(); window.RakenAndroid.openExternal(a.href); }
    });

    // keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); show("chat"); $("#composer-input").focus(); }
      if (e.key === "Escape") { $("#lightbox").hidden = true; $("#more-sheet").hidden = true; }
    });

    // service worker (web only, secure contexts)
    if ("serviceWorker" in navigator && R.platform === "web" && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register("sw.js").catch(() => { });
    }
  });
  function currentView() { const v = R.$(".view.active"); return v ? v.id.replace("view-", "") : ""; }
})();
