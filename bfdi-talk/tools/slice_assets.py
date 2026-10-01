"""Cut the two sprite sheets in assets-src/ into individual transparent PNGs.

  mouths-sheet.png -> www/assets/mouths/mouth_00.png ... mouth_30.png
  eyes-sheet.png   -> www/assets/eyes/eyes_00.png ... eyes_22.png

Mouths are found by connected components (reading order, row by row).
Eye sets sit on a 4x6 grid; every set is pasted onto the same canvas size with
the bottom of the eyes on the same line so swapping sets never makes the face jump.
Needs: pip install pillow numpy scipy
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src')
OUT = os.path.join(ROOT, 'www', 'assets')
SCALE = 3  # upscale + re-sharpen so sprites stay crisp on the big face


def sharpen_up(rgba, scale=SCALE):
    """Upscale and re-threshold the alpha edge so lines stay crisp instead of blurry."""
    im = Image.fromarray(rgba).resize((rgba.shape[1] * scale, rgba.shape[0] * scale), Image.LANCZOS)
    a = np.array(im).astype(float)
    alpha = a[..., 3] / 255.0
    alpha = np.clip((alpha - 0.5) * 2.2 + 0.5, 0, 1)
    a[..., 3] = alpha * 255
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def drop_specks(rgba, frac=0.04):
    """Remove stray pixels / sheet-border slivers that are tiny next to the main shape."""
    solid = rgba[..., 3] > 40
    lab, n = nd.label(solid, structure=np.ones((3, 3)))
    if n <= 1:
        return rgba
    sizes = nd.sum(solid, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * frac])
    near = nd.binary_dilation(keep, iterations=2)
    rgba[..., 3] = np.where(near, rgba[..., 3], 0)
    return rgba


def slice_mouths():
    im = np.array(Image.open(os.path.join(SRC, 'mouths-sheet.png')).convert('RGBA'))
    ink = (im[..., 3] > 0) & (im[..., :3].min(axis=2) < 200)
    ink[:, :7] = False      # light grey frame on the sheet edges
    ink[:, 1072:] = False
    lab, _ = nd.label(nd.binary_dilation(ink, iterations=2))
    boxes = [(s[0].start, s[1].start, s[0].stop, s[1].stop) for s in nd.find_objects(lab)]
    boxes = [b for b in boxes if (b[2] - b[0]) * (b[3] - b[1]) > 150]
    boxes.sort(key=lambda b: (b[0] + b[2]) / 2)
    rows = []
    for b in boxes:
        c = (b[0] + b[2]) / 2
        if rows and abs(c - rows[-1][0]) < 45:
            rows[-1][1].append(b)
        else:
            rows.append([c, [b]])
    ordered = [b for _, r in rows for b in sorted(r, key=lambda b: b[1])]
    os.makedirs(os.path.join(OUT, 'mouths'), exist_ok=True)
    pad = 6
    for i, (y0, x0, y1, x1) in enumerate(ordered):
        c = im[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad].copy()
        # flood-fill the white paper from the crop border; enclosed white (teeth) stays
        light = (c[..., :3].min(axis=2) > 225) | (c[..., 3] == 0)
        lab2, _ = nd.label(light)
        edge = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]]))) - {0}
        c[..., 3] = np.where(np.isin(lab2, list(edge)), 0, c[..., 3])
        c = drop_specks(c)
        sharpen_up(c).save(os.path.join(OUT, 'mouths', f'mouth_{i:02d}.png'), optimize=True)
    return len(ordered)


EYE_COLS = [(0, 80), (80, 230), (230, 335), (335, 433)]
EYE_ROWS = [(65, 150), (150, 240), (240, 316), (316, 415), (415, 465), (465, 510)]
SKIP = {(5, 3)}  # bottom-right set is covered by the artist watermark


def slice_eyes():
    im = np.array(Image.open(os.path.join(SRC, 'eyes-sheet.png')).convert('RGBA'))
    W, H, BASE = 150, 110, 92  # canvas (sheet px) and the line the eyes' bottom sits on
    os.makedirs(os.path.join(OUT, 'eyes'), exist_ok=True)
    i = 0
    for r, (y0, y1) in enumerate(EYE_ROWS):
        for c, (x0, x1) in enumerate(EYE_COLS):
            if (r, c) in SKIP:
                continue
            cell = im[y0:y1, x0:x1].copy()
            ink = (cell[..., 3] > 30) & (cell[..., :3].min(axis=2) < 160)
            ys, xs = np.nonzero(ink)
            cy0, cy1, cx0, cx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            crop = cell[cy0:cy1, cx0:cx1].copy()
            crop[..., :3] = 0  # pure black ink
            canvas = np.zeros((H, W, 4), np.uint8)
            ox = (W - crop.shape[1]) // 2
            oy = BASE - crop.shape[0]
            canvas[oy:oy + crop.shape[0], ox:ox + crop.shape[1]] = crop
            sharpen_up(canvas).save(os.path.join(OUT, 'eyes', f'eyes_{i:02d}.png'), optimize=True)
            i += 1
    return i


if __name__ == '__main__':
    print('mouths:', slice_mouths())
    print('eyes:', slice_eyes())
