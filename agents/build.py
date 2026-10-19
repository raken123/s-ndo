"""Build dist/chatgpt-agents.html: src/index.html with the plan screenshot inlined."""
import base64, os

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "src", "index.html"), encoding="utf-8").read()
png = base64.b64encode(open(os.path.join(HERE, "plan", "plan.png"), "rb").read()).decode()
needle = 'const PLAN_SRC = "../plan/plan.png";'
assert needle in src, "plan placeholder missing"
out = src.replace(needle, 'const PLAN_SRC = "data:image/png;base64,%s";' % png)
os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
dst = os.path.join(HERE, "dist", "chatgpt-agents.html")
open(dst, "w", encoding="utf-8").write(out)
print("wrote", dst, len(out), "bytes")
