"""Draws the app icon (a happy ball character using the face sprites) -> build/icon.png + www/assets/icon.png."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 1024


def icon(size=S, background=True):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if background:
        bg = Image.new('RGBA', (S, S))
        bd = ImageDraw.Draw(bg)
        for y in range(S):  # dark blue -> light blue
            t = y / S
            bd.line([(0, y), (S, y)], fill=(int(8 + t * 135), int(24 + t * 192), int(70 + t * 185), 255))
        mask = Image.new('L', (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=220, fill=255)
        im.paste(bg, (0, 0), mask)
    cx, cy, r = S // 2, S // 2 + 20, 360
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 217, 61, 255), outline=(17, 17, 17, 255), width=26)
    d.ellipse([cx - 230, cy - 290, cx - 70, cy - 200], fill=(255, 255, 255, 110))
    eyes = Image.open(os.path.join(ROOT, 'www/assets/eyes/eyes_02.png'))
    mouth = Image.open(os.path.join(ROOT, 'www/assets/mouths/mouth_04.png'))
    ew = 640
    eyes = eyes.resize((ew, int(eyes.height * ew / eyes.width)), Image.LANCZOS)
    im.alpha_composite(eyes, (cx - ew // 2, cy - 330))
    mw = 360
    mouth = mouth.resize((mw, int(mouth.height * mw / mouth.width)), Image.LANCZOS)
    im.alpha_composite(mouth, (cx - mw // 2, cy + 30))
    return im.resize((size, size), Image.LANCZOS)


def android():
    """Launcher icons + splash screens for the Capacitor Android project."""
    res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    if not os.path.isdir(res):
        return
    full, fg = icon(), icon(background=False)
    for dpi, scale in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
        d = os.path.join(res, f'mipmap-{dpi}')
        n = int(48 * scale)
        full.resize((n, n), Image.LANCZOS).save(os.path.join(d, 'ic_launcher.png'))
        rnd = full.resize((n, n), Image.LANCZOS)
        mask = Image.new('L', (n, n), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, n - 1, n - 1], fill=255)
        rnd.putalpha(mask)
        rnd.save(os.path.join(d, 'ic_launcher_round.png'))
        # adaptive foreground: 108dp canvas, art inside the 66dp safe zone
        m = int(108 * scale)
        canvas = Image.new('RGBA', (m, m), (0, 0, 0, 0))
        art = fg.resize((int(m * 0.7), int(m * 0.7)), Image.LANCZOS)
        canvas.alpha_composite(art, ((m - art.width) // 2, (m - art.height) // 2))
        canvas.save(os.path.join(d, 'ic_launcher_foreground.png'))
    for folder in os.listdir(res):
        path = os.path.join(res, folder, 'splash.png')
        if folder.startswith('drawable') and os.path.exists(path):
            w, h = Image.open(path).size
            sp = Image.new('RGBA', (w, h))
            sd = ImageDraw.Draw(sp)
            for y in range(h):
                t = y / h
                sd.line([(0, y), (w, y)], fill=(int(8 + t * 135), int(24 + t * 192), int(70 + t * 185), 255))
            n = int(min(w, h) * 0.45)
            art = fg.resize((n, n), Image.LANCZOS)
            sp.alpha_composite(art, ((w - n) // 2, (h - n) // 2))
            sp.convert('RGB').save(path)


if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
    icon().save(os.path.join(ROOT, 'build', 'icon.png'))
    icon(256).save(os.path.join(ROOT, 'www', 'assets', 'icon.png'))
    icon(432, background=False).save(os.path.join(ROOT, 'build', 'icon-foreground.png'))
    android()
    print('icons written')
