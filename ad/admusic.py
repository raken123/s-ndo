"""Procedural music bed for the ad clips.

Lifted out of render.py so the video-ad pipeline (vidads.py +
render_vidads.py) does not have to import the walkthrough scene graph, and
its ~700 lines of unrelated scene code, just to get a soundtrack.
"""
import numpy as np

DUR, SR, BPM = 4.0, 44100, 100.0


def music(idx, dur=DUR, impact=False):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n, dtype=np.float32)
    beat = 60.0 / BPM
    roots = [55.0, 55.0, 61.7, 65.4, 61.7, 69.3, 73.4, 82.4, 87.3, 65.4]
    r = roots[idx % len(roots)]
    for mult, amp in ((1, .12), (1.5, .07), (2, .06), (3, .035)):
        out += (amp * np.sin(2 * np.pi * r * mult * t + .4 * np.sin(2 * np.pi * .22 * t))).astype(np.float32)
    out *= (.75 + .25 * np.sin(2 * np.pi * t / max(dur, .001)))

    k = 0
    while k * beat < dur:
        s = int(k * beat * SR); ln = min(int(.26 * SR), n - s)
        if ln > 0:
            tt = np.arange(ln) / SR
            out[s:s + ln] += (.52 * np.sin(2 * np.pi * (105 * np.exp(-tt * 26) + 44) * tt)
                              * np.exp(-tt * 9)).astype(np.float32)
        k += 1

    rng = np.random.default_rng(idx * 7 + 3)
    k = 0
    while k * beat / 2 < dur:
        s = int(k * beat / 2 * SR)
        if k % 2 == 1:
            ln = min(int(.05 * SR), n - s)
            if ln > 0:
                tt = np.arange(ln) / SR
                out[s:s + ln] += (.11 * rng.normal(0, 1, ln) * np.exp(-tt * 90)).astype(np.float32)
        ln2 = min(int(.22 * SR), n - s)
        if ln2 > 0:
            tt = np.arange(ln2) / SR
            out[s:s + ln2] += (.20 * np.sin(2 * np.pi * (r / 2) * tt) * np.exp(-tt * 7)).astype(np.float32)
        k += 1

    ln = int(.55 * SR); tt = np.arange(ln) / SR
    out[:ln] += (.16 * rng.normal(0, 1, ln) * np.exp(-((tt - .42) ** 2) / .02)).astype(np.float32)
    if impact:
        s = int(.05 * SR); ln = min(int(1.1 * SR), n - s); tt = np.arange(ln) / SR
        out[s:s + ln] += (.42 * np.sin(2 * np.pi * 48 * tt) * np.exp(-tt * 4)).astype(np.float32)

    env = np.ones(n, dtype=np.float32)
    env[:int(.02 * SR)] = np.linspace(0, 1, int(.02 * SR))
    env[-int(.18 * SR):] *= np.linspace(1, 0, int(.18 * SR))
    out *= env
    out = out / (float(np.max(np.abs(out))) or 1.0) * .82
    return (np.stack([out, out], 1) * 32767).astype(np.int16)
