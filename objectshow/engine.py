"""The show engine: timing lookups, camera, and the frame pipe into ffmpeg.

An episode is a `Show`: a list of beats plus a scene-key -> draw-function map.
Everything episode-specific lives in the `epNN` modules.
"""

import math
import subprocess

import cairo

import audio
import cues as cuemod
import stage
import timeline
from cast import CAST
from draw import H, W, clamp, rand01

FPS = 24


class Show:
    def __init__(self, key, title, beats, total, scene_fn, no_fade=("title",)):
        self.key, self.title, self.total = key, title, total
        self.fn, self.no_fade = scene_fn, set(no_fade)
        self.scenes, self.total = timeline.build_timeline(beats, total)
        self.cues = cuemod.build_cues(self.scenes)
        self.by_key = {s["key"]: s for s in self.scenes}
        self.acts = {s["key"]: self._acts(s) for s in self.scenes}
        self.mouths = self._mouths()
        self.cue_at = {}
        for c in self.cues:
            self.cue_at.setdefault(c["kind"], []).append(c["t"])

    @staticmethod
    def _acts(sc):
        """Merge consecutive beats sharing an act into (t0, t1, act) spans."""
        spans = []
        for b in sc["beats"]:
            a = b.get("act")
            if spans and spans[-1][2] == a:
                spans[-1][1] = b["t1"]
            else:
                spans.append([b["t0"], b["t1"], a])
        return [tuple(s) for s in spans]

    def _mouths(self):
        """Blip windows per spoken line, so mouths match the voice track."""
        out, idx = {}, 0
        for sc in self.scenes:
            for b in sc["beats"]:
                if b["kind"] != "say":
                    continue
                ch = CAST[b["who"]]
                blips = audio.voice_blips(b["text"], b["speak"], ch.voice,
                                          "%s%d" % (b["who"], idx))
                out[id(b)] = [b["t0"] + o for o, _f, _l in blips]
                idx += 1
        return out

    def act_span(self, sc, T):
        for t0, t1, a in self.acts[sc["key"]]:
            if t0 <= T < t1:
                return t0, t1, a
        t0, t1, a = self.acts[sc["key"]][-1]
        return t0, t1, a

    def act_start(self, sc, name, default=None):
        for t0, t1, a in self.acts[sc["key"]]:
            if a == name:
                return t0
        return default

    def act_end(self, sc, name, default=None):
        last = default
        for t0, t1, a in self.acts[sc["key"]]:
            if a == name:
                last = t1
        return last

    def locate(self, T):
        sc = self.scenes[-1]
        for s in self.scenes:
            if T < s["t1"]:
                sc = s
                break
        beat = sc["beats"][-1]
        for b in sc["beats"]:
            if T < b["t1"]:
                beat = b
                break
        return sc, beat

    def mouth(self, beat, T):
        if beat["kind"] != "say":
            return 0.0
        m = 0.0
        for bt in self.mouths.get(id(beat), ()):
            d = T - bt
            if -0.02 < d < 0.075:
                m = max(m, 1.0 - abs(d - 0.03) / 0.055)
        return clamp(m)

    def since(self, kind, T, window=1e9):
        """Seconds since the most recent cue of *kind*, or None."""
        best = None
        for t in self.cue_at.get(kind, ()):
            if t <= T and T - t < window:
                best = T - t if best is None else min(best, T - t)
        return best


# --------------------------------------------------------------- helpers ---

def talker(beat, name):
    return beat["kind"] == "say" and beat["who"] == name


def facial(beat, name, default="happy"):
    return beat["expr"] if talker(beat, name) else default


def idle(name, T, y=None, x=0.0, s=1.0, **kw):
    from cast import pose
    from draw import GROUND
    y = GROUND if y is None else y
    return pose(x, y + math.sin(T * 2.0 + rand01(name) * 6) * 2.0, s=s, **kw)


def look_at(px, tx):
    return (clamp((tx - px) / 380.0, -1, 1), 0.0)


def speaks(show, beat, name, T):
    """Mouth openness for *name* -- zero unless they are the one talking."""
    return show.mouth(beat, T) if talker(beat, name) else 0.0


def camera(cr, zoom=1.0, cx=W / 2, cy=H / 2, shake=0.0, T=0.0):
    # keep the viewport inside the drawn world, or the edges show through
    # black -- at zoom 1.0 this pins the camera to the centre, which is the
    # only position where the whole world covers the whole frame
    z = max(zoom, 1.0)
    cx = min(max(cx, W / (2 * z)), W - W / (2 * z))
    cy = min(max(cy, H / (2 * z)), H - H / (2 * z))
    cr.translate(W / 2, H / 2)
    if shake:
        cr.translate(math.sin(T * 47) * shake, math.cos(T * 39) * shake)
    cr.scale(zoom, zoom)
    cr.translate(-cx, -cy)


# ----------------------------------------------------------------- frame ---

def draw_frame(cr, show, T):
    sc, beat = show.locate(T)
    cr.save()
    show.fn[sc["key"]](cr, show, sc, beat, T)
    cr.restore()

    if beat["kind"] == "say":
        k = clamp((T - beat["t0"]) / 0.12) * clamp((beat["t1"] - T) / 0.14)
        stage.subtitle(cr, beat["who"], beat["text"], CAST[beat["who"]].tag, k)

    # hard cut protection: dip to black across scene boundaries
    fade = 0.0
    if sc["key"] not in show.no_fade:
        fade = max(clamp(1 - (T - sc["t0"]) / 0.22),
                   clamp(1 - (sc["t1"] - T) / 0.22))
    if T < 0.8:
        fade = max(fade, clamp(1 - T / 0.8))
    if T > show.total - 1.2:
        fade = max(fade, clamp(1 - (show.total - T) / 1.2))
    if fade > 0:
        stage.flash(cr, fade, (0, 0, 0))


def new_surface():
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    cr = cairo.Context(surf)
    cr.set_antialias(cairo.ANTIALIAS_GOOD)
    return surf, cr


def render(show, out, t_from=0.0, t_to=None, with_audio=True, tmp="/tmp"):
    import os
    import time

    t_to = show.total if t_to is None else t_to
    wav = os.path.join(tmp, "%s.wav" % show.key)
    if with_audio:
        buf = audio.build_audio(show.scenes, show.cues, show.total)
        buf = buf[int(t_from * audio.SR):int(t_to * audio.SR)]
        audio.write_wav(wav, buf)

    ff = __import__("imageio_ffmpeg").get_ffmpeg_exe()
    cmd = [ff, "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s",
           "%dx%d" % (W, H), "-r", str(FPS), "-i", "-"]
    if with_audio:
        cmd += ["-i", wav, "-c:a", "aac", "-b:a", "160k", "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.PIPE)

    n0, n1 = int(t_from * FPS), int(t_to * FPS)
    surf, cr = new_surface()
    start = time.time()
    for n in range(n0, n1):
        cr.save()
        cr.set_operator(cairo.OPERATOR_SOURCE)
        cr.set_source_rgb(0, 0, 0)
        cr.paint()
        cr.restore()
        draw_frame(cr, show, n / FPS)
        surf.flush()
        proc.stdin.write(bytes(surf.get_data()))
        if (n - n0) % (FPS * 20) == 0:
            done = max(1, n - n0)
            el = time.time() - start
            print("  %6.1fs / %.0fs  (%.1f fps, eta %.0fs)" %
                  (n / FPS, t_to, done / max(el, 0.01),
                   (n1 - n) / max(done / max(el, 0.01), 0.01)), flush=True)
    proc.stdin.close()
    err = proc.stderr.read().decode()[-1500:]
    if proc.wait() != 0:
        raise SystemExit("ffmpeg failed:\n" + err)
    print("wrote", out, "in %.0fs" % (time.time() - start))
