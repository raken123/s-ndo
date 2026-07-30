"""Drive the standalone HTML from file:// and prove the app actually works."""
import os, sys, glob
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = "file://" + os.path.join(HERE, "dist", "gmfy-3.3.0.html")
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

    # ---- persistence: Save/Load are explicit buttons in the World tab ----
    def world_tab():
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

    bad = [c for c in cons if c.startswith("error")]
    check("no console errors", not bad, bad[:2])
    b.close()

print("\n%d checks failed" % len(fails))
sys.exit(1 if fails else 0)
