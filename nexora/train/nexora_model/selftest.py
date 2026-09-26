"""Plays a generated game in headless Chromium, the same way the app's self-test does
(nexora/src/app.js, testGame): collect errors, start the game with a click, Space and
Enter, play with the arrow keys and WASD, then check that the canvas shows several
colours and is still changing. A game is kept for training only when it passes."""

PROBE = """
() => {
  let best = null, area = 0;
  for (const c of document.querySelectorAll('canvas')) if (c.width * c.height > area) { area = c.width * c.height; best = c; }
  if (!best) return null;
  const w = Math.min(480, best.width), h = Math.max(1, Math.round(best.height * w / best.width));
  const o = document.createElement('canvas'); o.width = w; o.height = h;
  try {
    const x = o.getContext('2d'); x.drawImage(best, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, seen = new Set(); let sum = 0;
    for (let i = 0; i < d.length; i += 4 * 37) {
      seen.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
      sum = (Math.imul(sum, 31) + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0;
    }
    return { colors: seen.size, hash: sum };
  } catch (e) { return { colors: 0, hash: 0 }; }
}
"""
KEYS = ["ArrowRight", "ArrowUp", "KeyD", "Space", "ArrowLeft", "ArrowDown", "KeyW", "ArrowRight"]


class GameTester:
    """with GameTester() as t: t.check(html) -> {"ok", "errors", "animating", "colors"}"""

    def __enter__(self):
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            raise SystemExit("Spelen testas i en riktig webbläsare. Installera: pip install playwright && python -m playwright install chromium")
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch()
        return self

    def __exit__(self, *exc):
        self._browser.close()
        self._pw.stop()

    def check(self, html, seconds=4.2):
        page = self._browser.new_page(viewport={"width": 800, "height": 500})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:400]))
        page.on("console", lambda m: m.type == "error" and errors.append("console.error: " + m.text[:400]))
        # the game must not reach the network (the app forbids it too)
        page.route("**/*", lambda route: route.abort() if route.request.url.startswith("http") else route.continue_())
        try:
            page.set_content(html, wait_until="load", timeout=10000)
            page.wait_for_timeout(700)
            page.mouse.click(400, 250)
            for k in ("Space", "Enter"):
                page.keyboard.press(k)
            for k in KEYS:
                page.keyboard.down(k)
                page.wait_for_timeout(260)
                page.keyboard.up(k)
            page.wait_for_timeout(max(0, int(seconds * 1000) - 700 - 260 * len(KEYS) - 400))
            a = page.evaluate(PROBE)
            page.wait_for_timeout(400)
            b = page.evaluate(PROBE)
        except Exception as e:  # a game that hangs or crashes the page fails the test
            errors.append("test: " + str(e).splitlines()[0][:300])
            a = b = None
        finally:
            page.close()
        animating = bool(a and b and a["hash"] != b["hash"])
        colors = b["colors"] if b else 0
        return {"ok": not errors and animating and colors > 3, "errors": errors[:20], "animating": animating, "colors": colors}

    def problems(self, result):
        """The errors to send back in a fix request, like the app does."""
        if result["errors"]:
            return result["errors"]
        if not result["animating"]:
            return ["The canvas did not change after pressing Space and the arrow keys: the game may not start, render or loop."]
        return ["The game shows almost nothing on screen (%d colours): draw a real scene." % result["colors"]]
