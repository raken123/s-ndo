"""Slår ihop ReeOS till en enda HTML-fil som går att öppna med dubbelklick.

Modulerna i js/ läggs i beroendeordning i ett gemensamt scope, CSS:en bäddas
in och ikonen blir en data-URI. Resultatet skrivs till reeos/ReeOS.html.

    python3 reeos/build-single-file.py
"""
import re, os, base64, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)))
ENTRY = 'js/main.js'
IMPORT_RE = re.compile(r"^import\s*\{[^}]*\}\s*from\s*'([^']+)';\s*$", re.M)

def resolve(base, rel):
    return os.path.normpath(os.path.join(os.path.dirname(base), rel)).replace('\\', '/')

order, seen, stack = [], set(), []

def visit(mod):
    if mod in seen:
        return
    if mod in stack:
        sys.exit(f'CYKEL: {" -> ".join(stack)} -> {mod}')
    stack.append(mod)
    src = open(os.path.join(ROOT, mod), encoding='utf-8').read()
    for rel in IMPORT_RE.findall(src):
        visit(resolve(mod, rel))
    stack.pop()
    seen.add(mod)
    order.append(mod)

visit(ENTRY)

chunks = []
for mod in order:
    src = open(os.path.join(ROOT, mod), encoding='utf-8').read()
    src = IMPORT_RE.sub('', src)                              # ett gemensamt scope
    src = re.sub(r'^export\s+(?=(async\s+)?(function|const|let|var|class)\b)', '', src, flags=re.M)
    chunks.append(f'/* ===== {mod} ===== */\n{src.strip()}\n')

js = '\n'.join(chunks)
if re.search(r'^\s*(export|import)\s', js, re.M):
    sys.exit('FEL: kvarvarande import/export i bunten')

css = open(os.path.join(ROOT, 'css/reeos.css'), encoding='utf-8').read()
svg = open(os.path.join(ROOT, 'icons/icon.svg'), encoding='utf-8').read()
favicon = 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode()).decode()

html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
html = html.replace('<link rel="icon" href="icons/icon.svg" type="image/svg+xml">',
                    f'<link rel="icon" href="{favicon}" type="image/svg+xml">')
html = html.replace('<link rel="apple-touch-icon" href="icons/icon-180.png">\n', '')
html = html.replace('<link rel="stylesheet" href="css/reeos.css">',
                    '<style>\n' + css + '\n</style>')
html = html.replace('<script type="module" src="js/main.js"></script>',
                    '<script type="module">\n' + js + '\n</script>')

banner = ('<!-- ReeOS — enfilsversion. Hela appen ligger i den här filen och kan\n'
          '     öppnas direkt i webbläsaren. Källkoden per modul finns i reeos/. -->\n')
html = banner + html

open(os.path.join(ROOT, 'ReeOS.html'), 'w', encoding='utf-8').write(html)
print(f'ReeOS.html: {len(order)} moduler, {len(html)/1024:.0f} KB')
print('ordning:', ' '.join(m.replace('js/', '') for m in order))
