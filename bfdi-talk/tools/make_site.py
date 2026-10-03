"""Builds the BFDI Talk website (site/index.html) from site/page.template.html.

The face sprites are embedded (small, palette PNGs) so the page is one self-contained file.
  python3 tools/make_site.py [--fragment out.html]   (fragment = without <html>/<head>/<body>)
"""
import base64, io, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EYES = [0, 2, 8, 13, 14, 16, 18]
MOUTHS = [1, 4, 5, 7, 8, 9, 11, 12, 21, 23, 24, 25, 26, 27, 30]


def sprites():
    out = {}
    for kind, ids, name in (('eyes', EYES, 'eyes'), ('mouths', MOUTHS, 'mouth')):
        for i in ids:
            im = Image.open(os.path.join(ROOT, 'www', 'assets', kind, f'{name}_{i:02d}.png')).convert('RGBA')
            w, h = im.size
            small = im.resize((w // 2, h // 2), Image.LANCZOS).quantize(colors=48, method=Image.Quantize.FASTOCTREE)
            buf = io.BytesIO()
            small.save(buf, 'PNG', optimize=True)
            out[f'{kind[0]}{i}'] = {'src': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(),
                                    'w': round(w / 3, 1), 'h': round(h / 3, 1)}
    return out


def build():
    page = open(os.path.join(ROOT, 'site', 'page.template.html'), encoding='utf-8').read()
    return page.replace('/*SPRITES*/{}', json.dumps(sprites(), separators=(',', ':')))


if __name__ == '__main__':
    body = build()
    title_end = body.index('</style>') + len('</style>')
    head, rest = body[:title_end], body[title_end:]
    full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="description" content="Talk out loud with your own object-show character. Lip-sync, 19 moods, Playshow Mode, Agent Mode. Windows, Mac and Android.">\n'
            '<link rel="icon" href="../www/assets/icon.png">\n'
            f'{head}\n</head>\n<body>\n{rest}\n</body>\n</html>\n')
    open(os.path.join(ROOT, 'site', 'index.html'), 'w', encoding='utf-8').write(full)
    print('site/index.html', len(full) // 1024, 'KB')
    if '--fragment' in sys.argv:
        out = sys.argv[sys.argv.index('--fragment') + 1]
        open(out, 'w', encoding='utf-8').write(body)
        print(out, len(body) // 1024, 'KB')
