"""Bright sky-and-grass 3D world, mirroring what the app renders."""
import math, random
from PIL import Image, ImageDraw
from gfx import W, H, SKY_TOP, SKY_BOT, GRASS, TREE, clamp

N, SPAN = 15, 34


def heightfield(seed=3, relief=1.0):
    r = random.Random(seed)
    a1, a2, a3 = r.random() * 6.28, r.random() * 6.28, r.random() * 6.28
    h = []
    for i in range(N):
        row = []
        for j in range(N):
            u, v = i / (N - 1) - .5, j / (N - 1) - .5
            row.append((math.sin(u * 7 + a1) * .9 + math.cos(v * 6 + a2) * .8
                        + math.sin((u + v) * 5 + a3) * .55) * relief)
        h.append(row)
    return h


def height_at(h, x, z):
    fi = (x / SPAN + .5) * (N - 1)
    fj = (z / SPAN + .5) * (N - 1)
    i = max(0, min(N - 2, int(fi)))
    j = max(0, min(N - 2, int(fj)))
    tx, tz = clamp(fi - i), clamp(fj - j)
    return (h[i][j] * (1 - tx) * (1 - tz) + h[i + 1][j] * tx * (1 - tz)
            + h[i][j + 1] * (1 - tx) * tz + h[i + 1][j + 1] * tx * tz)


def trees(seed=7, n=16, h=None):
    r = random.Random(seed)
    out = []
    for _ in range(n):
        x = (r.random() - .5) * SPAN * .82
        z = (r.random() - .5) * SPAN * .82
        if abs(x) < 3 and abs(z) < 3:
            continue
        out.append({"kind": "tree", "x": x, "z": z, "h": 2.2 + r.random() * 3.4,
                    "w": .7 + r.random() * .5,
                    "col": (47 + int(r.random() * 40), 143 + int(r.random() * 40), 69)})
    return out


class Cam:
    def __init__(self, x=0, z=-9, yaw=0.0, pitch=0.26, height=3.4):
        self.x, self.z, self.yaw, self.pitch, self.height = x, z, yaw, pitch, height


def render_world(box, hf, props, cam, t=0.0, grow=1.0, bounce=0.0):
    """box=(x,y,w,h) viewport rect. Returns an RGB image of that size."""
    bx, by, bw, bh = box
    img = Image.new("RGB", (bw, bh))
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(bh):
        f = i / max(1, bh - 1)
        c = tuple(int(SKY_TOP[k] * (1 - f) + SKY_BOT[k] * f) for k in range(3))
        d.line([(0, i), (bw, i)], fill=c)

    foc = bw * 0.9
    eye = height_at(hf, cam.x, cam.z) - cam.height
    cp, sp = math.cos(cam.pitch), math.sin(cam.pitch)
    cyw, syw = math.cos(cam.yaw), math.sin(cam.yaw)

    def proj(x, y, z):
        dx, dz = x - cam.x, z - cam.z
        rx = dx * cyw - dz * syw
        rz = dx * syw + dz * cyw
        ry = y - eye
        ry2 = ry * cp - rz * sp
        rz2 = ry * sp + rz * cp
        if rz2 < .35:
            return None
        return (bw / 2 + foc * rx / rz2, bh / 2 + foc * ry2 / rz2, rz2)

    faces = []
    for i in range(N - 1):
        for j in range(N - 1):
            x0 = (i / (N - 1) - .5) * SPAN; x1 = ((i + 1) / (N - 1) - .5) * SPAN
            z0 = (j / (N - 1) - .5) * SPAN; z1 = ((j + 1) / (N - 1) - .5) * SPAN
            p = [proj(x0, hf[i][j], z0), proj(x1, hf[i + 1][j], z0),
                 proj(x1, hf[i + 1][j + 1], z1), proj(x0, hf[i][j + 1], z1)]
            if any(q is None for q in p):
                continue
            dep = sum(q[2] for q in p) / 4
            slope = (hf[i + 1][j] - hf[i][j]) + (hf[i][j + 1] - hf[i][j])
            k = 1 + slope * .16
            col = tuple(min(255, max(0, int(GRASS[m] * k))) for m in range(3))
            faces.append((dep, [(q[0], q[1]) for q in p], col, (240, 250, 235)))

    for pr in props:
        if pr.get("taken"):
            continue
        kind = pr.get("kind", "tree")
        base = height_at(hf, pr["x"], pr["z"])
        bob = abs(math.sin(t * 2.2 + pr["x"] * .35)) * bounce
        top = base - pr["h"] * grow - bob
        s = pr["w"] * (0.6 + 0.4 * grow)
        col = pr["col"]

        if kind in ("lava", "water"):
            pulse = .86 + .14 * math.sin(t * 3 + pr["x"]) if kind == "lava" else 1.0
            q = []
            ok = True
            for cx, cz in ((-1,-1),(1,-1),(1,1),(-1,1)):
                px, pz = pr["x"] + cx * s * 2.1, pr["z"] + cz * s * 2.1
                pp = proj(px, height_at(hf, px, pz) - .06, pz)
                if pp is None: ok = False; break
                q.append(pp)
            if not ok: continue
            dep = sum(p[2] for p in q) / 4
            c = tuple(min(255, int(col[m] * pulse)) for m in range(3))
            faces.append((dep, [(p[0], p[1]) for p in q], c, None))
            continue

        if kind in ("coin", "star", "key"):
            spin = abs(math.cos(t * 2.4 + pr["x"]))
            c0 = proj(pr["x"], base - pr["h"] * .55 * grow - bob, pr["z"])
            if c0 is None: continue
            rr = (foc * s * .55) / c0[2]
            sides = 10 if kind == "star" else 8
            ring = []
            for m in range(sides):
                ang = m / sides * math.tau
                rad = rr * (.45 if (kind == "star" and m % 2) else 1.0)
                ring.append((c0[0] + math.cos(ang) * rad * (.25 + .75 * spin),
                             c0[1] + math.sin(ang) * rad))
            faces.append((c0[2], ring, col, None))
            continue

        if kind in ("finish", "checkpoint"):
            pb, ptp = proj(pr["x"], base, pr["z"]), proj(pr["x"], top, pr["z"])
            if pb is None or ptp is None: continue
            wd = max(2, (foc * .10) / pb[2])
            faces.append((pb[2] + .02,
                          [(pb[0]-wd, pb[1]), (pb[0]+wd, pb[1]),
                           (ptp[0]+wd, ptp[1]), (ptp[0]-wd, ptp[1])],
                          (233, 236, 245), None))
            fl = (foc * s * 1.5) / ptp[2]
            wv = math.sin(t * 3 + pr["x"]) * fl * .18
            faces.append((ptp[2], [(ptp[0], ptp[1]), (ptp[0]+fl, ptp[1]+fl*.28+wv),
                                   (ptp[0], ptp[1]+fl*.62)], col, None))
            continue

        # default: cone
        apex = proj(pr["x"], top, pr["z"])
        cs = [proj(pr["x"] + dx, base, pr["z"] + dz)
              for dx, dz in ((-s, -s), (s, -s), (s, s), (-s, s))]
        if apex is None or any(c is None for c in cs):
            continue
        for q2 in range(4):
            a, b = cs[q2], cs[(q2 + 1) % 4]
            dep = (a[2] + b[2] + apex[2]) / 3
            k = .62 + q2 * .13
            c = tuple(min(255, max(0, int(col[m] * k))) for m in range(3))
            faces.append((dep, [(a[0], a[1]), (b[0], b[1]), (apex[0], apex[1])], c, None))

    faces.sort(key=lambda f: -f[0])
    for dep, pts, col, line in faces:
        alpha = int(255 * clamp(1.6 - dep / 42))
        if alpha <= 4:
            continue
        d.polygon(pts, fill=col + (alpha,))
        if line:
            d.line(pts + [pts[0]], fill=line + (int(alpha * .5),), width=1)

    # haze at the horizon — soft in and out so there is no seam
    band = int(bh * .46)
    top = int(bh * .14)
    for i in range(band):
        f = i / max(1, band - 1)
        a = int(110 * math.sin(math.pi * f) ** 1.2)
        if a <= 0:
            continue
        d.line([(0, top + i), (bw, top + i)], fill=SKY_BOT + (a,))
    return img


def paste_world(canvas, box, img, radius=34):
    bx, by, bw, bh = box
    mask = Image.new("L", (bw, bh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=radius, fill=255)
    canvas.paste(img, (bx, by), mask)
