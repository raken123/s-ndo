"""Drive the standalone HTML from file:// and prove the app actually works."""
import os, sys, glob
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = "file://" + os.path.join(HERE, "dist", "gmfy-3.4.0.html")
CHROME = (glob.glob("/opt/pw-browsers/chromium*/chrome-linux/chrome") +
          glob.glob("/opt/pw-browsers/chromium*/chrome-linux64/chrome"))[0]

fails = []


def check(name, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + (("  " + str(detail)) if detail else ""))
    if not ok:
        fails.append(name)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 480, "height": 900})
    errs, cons = [], []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: cons.append(m.type + ": " + m.text))
    pg.goto(PAGE)
    pg.wait_for_timeout(1200)

    # ---- homepage shows first, Start reveals sign-in ----
    check("homepage visible on load",
          pg.evaluate("document.querySelector('#home').classList.contains('on')"))
    pg.click("#home-start")
    pg.wait_for_timeout(300)
    check("Start dismisses homepage",
          not pg.evaluate("document.querySelector('#home').classList.contains('on')"))

    check("no page errors on load", not errs, errs[:2])
    check("globals present",
          pg.evaluate("!!(window.Gmfy && window.GmfyAuth && window.GmfyPlans "
                      "&& window.GmfyBlocks && window.GmfyFX && window.GmfyExport)"))
    check("runtime sources embedded",
          pg.evaluate("!!(window.GMFY_SRC && window.GMFY_SRC['js/engine.js'].length > 1000)"))

    # ---- sign up (exercises the file:// crypto fallback) ----
    pg.fill("#a-mail", "cinema@example.com")
    pg.fill("#a-pass", "hunter2xy")
    pg.click("#a-go")
    pg.wait_for_timeout(900)
    signed = pg.evaluate("!!(window.GmfyAuth && GmfyAuth.current && GmfyAuth.current())")
    check("sign up works on file://", signed,
          pg.evaluate("(document.querySelector('#a-err')||{}).textContent||''"))
    check("auth screen dismissed",
          pg.evaluate("getComputedStyle(document.querySelector('#auth')).display") == "none")

    # ---- free tier: watermark + ad banner are visible ----
    def disp(sel):
        return pg.evaluate("(s)=>{const e=document.querySelector(s);"
                           "return e?getComputedStyle(e).display:'MISSING';}", sel)
    check("free watermark visible", disp("#watermark") not in ("none", "MISSING"), disp("#watermark"))
    check("free ad banner visible", disp("#adbar") not in ("none", "MISSING"), disp("#adbar"))
    check("banner shows a demo ad brand",
          bool(pg.evaluate("(document.querySelector('.ad-brand')||{}).textContent")),
          pg.evaluate("(document.querySelector('.ad-brand')||{}).textContent"))
    check("many demo ads defined",
          pg.evaluate("window.GmfyPromos.ADS.length") >= 12,
          pg.evaluate("window.GmfyPromos.ADS.length"))

    # ---- editor starts in ultra-big mode; Tools toggles the sheet ----
    check("editor starts ultra-big",
          pg.evaluate("document.querySelector('#app').classList.contains('big')"))
    check("tool sheet hidden while big",
          pg.evaluate("getComputedStyle(document.querySelector('.sheet')).display") == "none")
    pg.click("#tools-toggle")
    pg.wait_for_timeout(200)
    check("Tools reveals the sheet",
          pg.evaluate("getComputedStyle(document.querySelector('.sheet')).display") != "none")
    pg.click("#tools-toggle")   # back to big for the render/tap checks
    pg.wait_for_timeout(200)

    # (third-person is exercised by "tap places an object" below: placement goes
    #  through pick()/eye(), so a correct tap proves the chase math is consistent)

    # ---- the 3D viewport must actually draw ----
    pg.wait_for_timeout(900)
    colours = pg.evaluate("""() => {
      const c = document.querySelector('#c');
      if (!c) return -1;
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const s = new Set();
      for (let i = 0; i < d.length; i += 4)
        s.add((d[i]>>3<<10) | (d[i+1]>>3<<5) | (d[i+2]>>3));
      return s.size;
    }""")
    check("viewport renders (distinct colours > 30)", colours > 30, colours)

    # ---- place an object by tapping the canvas ----
    box = pg.evaluate("""() => { const c=document.querySelector('#c');
        const r=c.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; }""")
    objs = "parseInt((document.querySelector('#h-objs')||{}).textContent||'-1',10)"
    before = pg.evaluate(objs)
    pg.mouse.click(box["x"] + box["w"] * 0.5, box["y"] + box["h"] * 0.72)
    pg.wait_for_timeout(500)
    after = pg.evaluate(objs)
    check("tap places an object", after > before, "%s -> %s" % (before, after))

    # tabs live in the tool sheet, which is folded away in big mode
    def show_tools():
        if pg.evaluate("getComputedStyle(document.querySelector('.sheet')).display") == "none":
            pg.click("#tools-toggle")
            pg.wait_for_timeout(200)

    # ---- persistence: Save/Load are explicit buttons in the World tab ----
    def world_tab():
        show_tools()
        pg.click('.tab[data-pane="world"]')
        pg.wait_for_timeout(350)

    def auth_hidden():
        return pg.evaluate(
            "getComputedStyle(document.querySelector('#auth')).display") == "none"

    def sign_in_again():
        # the session is kept in localStorage, so a reload usually comes back
        # already signed in and the auth screen is never shown
        if auth_hidden():
            return
        if "Create account" in (pg.text_content("#a-go") or ""):
            pg.click("#a-swap")
            pg.wait_for_timeout(250)
        pg.fill("#a-mail", "cinema@example.com")
        pg.fill("#a-pass", "hunter2xy")
        pg.click("#a-go")
        pg.wait_for_timeout(1300)

    world_tab()
    pg.click("#mk-save")
    pg.wait_for_timeout(500)
    check("save reports success",
          "saved" in (pg.text_content("#w-hint") or "").lower(),
          pg.text_content("#w-hint"))

    pg.reload()
    pg.wait_for_timeout(1600)
    sign_in_again()
    check("signed in after reload (session restored)", auth_hidden())
    world_tab()
    pg.click("#mk-load")
    pg.wait_for_timeout(700)
    kept = pg.evaluate(objs)
    check("saved world survives a restart", kept >= after, "%s vs %s" % (kept, after))

    # ---- checkout: paid plan opens a card sheet, validates format only ----
    show_tools()
    pg.click('.tab[data-pane="plan"]')
    pg.wait_for_timeout(300)
    pg.click('[data-plan="pro"]')
    pg.wait_for_timeout(300)
    check("paid plan opens checkout",
          pg.evaluate("document.querySelector('#pay').classList.contains('on')"))

    # a bad (non-Luhn) number is rejected and the plan does NOT change
    pg.fill("#pay-name", "Alex Rivera")
    pg.fill("#pay-num", "1234 5678 9012 3456")
    pg.fill("#pay-exp", "12/30")
    pg.fill("#pay-cvv", "123")
    pg.click("#pay-go")
    pg.wait_for_timeout(200)
    check("bad card rejected",
          "format check" in (pg.text_content("#pay-err") or ""),
          pg.text_content("#pay-err"))
    check("plan unchanged after bad card",
          pg.evaluate("window.GmfyPlans.current().id") == "free")

    # a Luhn-valid test card passes format and activates the plan
    pg.fill("#pay-num", "4242 4242 4242 4242")
    pg.click("#pay-go")
    pg.wait_for_timeout(300)
    check("valid card activates plan",
          pg.evaluate("window.GmfyPlans.current().id") == "pro")
    check("paid plan removes watermark", disp("#watermark") in ("none", "MISSING"), disp("#watermark"))
    check("paid plan removes ad banner", disp("#adbar") in ("none", "MISSING"), disp("#adbar"))
    check("success says not charged",
          "No charge" in (pg.text_content("#pay-done") or ""),
          (pg.text_content("#pay-done") or "")[:60])
    pg.click("#pay-close")
    pg.wait_for_timeout(200)

    # ---- new Go tier and prices ----
    check("Go tier priced $2/mo",
          pg.evaluate("window.GmfyPlans.all.go.price") == "$2/mo")
    check("Pro $20 / Max $390",
          pg.evaluate("window.GmfyPlans.all.pro.price") == "$20/mo"
          and pg.evaluate("window.GmfyPlans.all.max.price") == "$390/mo")

    # ---- invite codes: 10 quota, mint on a paid plan, redeem grants 3 months ----
    check("ten invite codes to start",
          pg.evaluate("window.GmfyPlans.invitesLeft()") == 10)
    pg.click("#inv-mint")
    pg.wait_for_timeout(200)
    check("minting uses one code",
          pg.evaluate("window.GmfyPlans.invitesLeft()") == 9)
    code = pg.evaluate("window.GmfyPlans.myInvites()[0].code")
    check("code has GMFY- prefix", isinstance(code, str) and code.startswith("GMFY-"), code)
    # redeeming grants the inviter's plan for ~90 days (Pro here)
    granted = pg.evaluate("""(c) => {
      const r = window.GmfyPlans.redeemInvite('NOPE-0000-0000');   // unknown → fails
      const before = window.GmfyPlans.giftDaysLeft();
      return {unknown: r.ok, before};
    }""", code)
    check("unknown code rejected", granted["unknown"] is False)
    # a *different* account is needed to redeem your own; emulate by clearing the
    # minter link so redeem is allowed, then check the gift window
    days = pg.evaluate("""(c) => {
      const all = window.GmfyPlans.invites(); all[c].by = 'someone-else';
      localStorage.setItem('gmfy.invites.v2', JSON.stringify(all));
      const r = window.GmfyPlans.redeemInvite(c);
      return r.ok ? window.GmfyPlans.giftDaysLeft() : -1;
    }""", code)
    check("redeem grants ~3 months", 80 <= (days or 0) <= 92, days)

    # ---- full-screen video ad interstitial (free tier only) ----
    pg.evaluate("window.GmfyPlans.setPlan('free'); window.GmfyPromos && GmfyPromos.refresh();")
    if pg.evaluate("!document.querySelector('#b-stop').hidden"):
        pg.click("#b-stop"); pg.wait_for_timeout(200)
    pg.click("#b-play")
    pg.wait_for_timeout(500)
    check("free: video ad shows before play", disp("#vad") not in ("none", "MISSING"), disp("#vad"))
    check("ad has a video source",
          bool(pg.evaluate("(document.querySelector('#vad-v')||{}).src")))
    pg.wait_for_timeout(5300)
    check("skip becomes available after 5s",
          pg.evaluate("document.querySelector('#vad-skip').classList.contains('ready')"))
    pg.click("#vad-skip"); pg.wait_for_timeout(300)
    check("skipping closes the ad", disp("#vad") == "none", disp("#vad"))

    # ---- paid plan: no video ad ----
    pg.evaluate("window.GmfyPlans.setPlan('pro');")
    if pg.evaluate("!document.querySelector('#b-stop').hidden"):
        pg.click("#b-stop"); pg.wait_for_timeout(200)
    pg.click("#b-play"); pg.wait_for_timeout(400)
    check("paid plan skips the video ad", disp("#vad") == "none", disp("#vad"))

    # ---- free-plan restrictions + rewarded ad unlock ----
    pg.evaluate("window.GmfyPlans.setPlan('free');")
    check("28 free restrictions defined",
          pg.evaluate("window.GmfyFree.LIMITS.length") == 28,
          pg.evaluate("window.GmfyFree.LIMITS.length"))
    check("free tier: watermark restriction active",
          pg.evaluate("window.GmfyFree.locked('watermark')"))
    check("rewardable count is high",
          pg.evaluate("window.GmfyFree.LIMITS.filter(l=>l.r).length") >= 20,
          pg.evaluate("window.GmfyFree.LIMITS.filter(l=>l.r).length"))
    # simulate earning a rewarded unlock (bypass the 25s watch in the test)
    pg.evaluate("window.GmfyFree.unlock('watermark'); window.GmfyPromos.refresh();")
    check("rewarded unlock lifts the restriction",
          not pg.evaluate("window.GmfyFree.locked('watermark')"))
    check("unlocked watermark is hidden",
          disp("#watermark") in ("none", "MISSING"), disp("#watermark"))
    check("paid plan clears all restrictions",
          pg.evaluate("(function(){window.GmfyPlans.setPlan('max');"
                      "return window.GmfyFree.stats().active;})()") == 0)
    check("rewarded() exists on video ads",
          pg.evaluate("typeof window.GmfyVideoAds.rewarded === 'function'"))
    pg.evaluate("window.GmfyPlans.setPlan('free');")

    # ---- ad-blocker / VPN ban feature ----
    pg.evaluate("window.GmfyGuard.clear();")  # clear any existing ban
    check("guard module exists",
          pg.evaluate("!!(window.GmfyGuard && window.GmfyGuard.check && window.GmfyGuard.wire)"))
    # simulate ad blocker detection
    pg.evaluate("window.__gmfyForceBlock = true;")
    is_banned = pg.evaluate("window.GmfyGuard.check()")
    check("ban triggered on forced block", is_banned)
    check("ban overlay shown",
          pg.evaluate("document.querySelector('#ban').classList.contains('on')"))
    check("ban shows reason",
          "ad blocker" in (pg.text_content("#ban-why") or ""),
          pg.text_content("#ban-why"))
    check("ban timer visible",
          pg.evaluate("(document.querySelector('#ban-timer')||{}).textContent").count(':') >= 1,
          pg.evaluate("(document.querySelector('#ban-timer')||{}).textContent"))
    # paid plan is exempt from ban
    pg.evaluate("window.GmfyGuard.clear(); window.GmfyPlans.setPlan('pro');")
    pg.evaluate("window.__gmfyForceBlock = true;")
    exempt = not pg.evaluate("window.GmfyGuard.check()")
    check("paid plan exempt from ban", exempt)
    check("ban hidden for paid plan",
          not pg.evaluate("document.querySelector('#ban').classList.contains('on')"))

    bad = [c for c in cons if c.startswith("error")]
    check("no console errors", not bad, bad[:2])
    b.close()

print("\n%d checks failed" % len(fails))
sys.exit(1 if fails else 0)
