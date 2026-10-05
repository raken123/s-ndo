import math, random, struct, wave, sys
SR, DUR = 44100, 25.5
N = int(SR * DUR)
buf = [0.0] * N
random.seed(7)
def add(start, samples, gain=1.0):
    i0 = int(start * SR)
    for i, v in enumerate(samples):
        j = i0 + i
        if 0 <= j < N: buf[j] += v * gain
def env(n, a, d):
    return [min(1, i / max(1, a)) * math.exp(-i / max(1, d)) for i in range(n)]
def kick():
    n = int(0.3 * SR); out = []; ph = 0
    for i in range(n):
        f = 50 + 110 * math.exp(-i / 1600); ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-i / 5500))
    return out
def hat(v=0.25):
    n = int(0.05 * SR); return [(random.random() * 2 - 1) * math.exp(-i / 500) * v for i in range(n)]
def tone(f, d, vol, wave_='sine', a=200, dec=None):
    n = int(d * SR); e = env(n, a, dec or n / 3); out = []
    for i in range(n):
        ph = 2 * math.pi * f * i / SR
        s = math.sin(ph) if wave_ == 'sine' else (2 * ((f * i / SR) % 1) - 1) if wave_ == 'saw' else (1 if math.sin(ph) > 0 else -1) * 0.6
        out.append(s * e[i] * vol)
    return out
def whoosh():
    n = int(0.45 * SR); out = []; lp = 0
    for i in range(n):
        k = i / n; a = 0.02 + 0.5 * k
        lp += a * ((random.random() * 2 - 1) - lp)
        out.append(lp * math.sin(math.pi * k) * 0.9)
    return out
midi = lambda m: 440 * 2 ** ((m - 69) / 12)
BPM = 120; beat = 60 / BPM
chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
K, Hh = kick(), None
step, t = 0, 2.2
# hook: three big hits, then the groove from 2.2 s
for at in (0.1, 0.5, 0.9): add(at, kick(), 0.9); add(at, tone(midi(45), 0.5, 0.25, 'saw', 50, 6000), 1)
add(1.25, tone(midi(81), 0.25, 0.25, 'sine', 30, 3000))
while t < DUR - 0.5:
    bar = int((t - 2.2) / (beat * 4)) % 4
    s8 = step % 8
    if s8 in (0, 4) or (s8 == 6 and bar % 2): add(t, K, 0.8)
    add(t, hat(0.18 if s8 % 2 else 0.1), 1)
    if s8 in (2, 6): add(t, [(random.random() * 2 - 1) * math.exp(-i / 2500) * 0.28 for i in range(int(0.15 * SR))])  # clap-ish
    if s8 % 2 == 0: add(t, tone(midi(chords[bar][0] - 24), beat * 0.9, 0.22, 'saw', 60, 7000))
    if s8 == 0:
        for m in chords[bar]: add(t, tone(midi(m), beat * 3.8, 0.06, 'sine', 3000, 40000))
    t += beat / 2; step += 1
for at in (2.2, 7.0, 11.8, 16.4, 21.0): add(at - 0.15, whoosh(), 0.7)
for at in (3.0, 7.4, 8.2, 12.5, 13.0, 17.0, 17.35, 17.7, 18.05):  # pops when things appear
    add(at, tone(midi(84), 0.09, 0.25, 'sine', 20, 900))
for at, m in ((14.5, 88), (19.0, 88), (22.2, 84), (22.35, 88), (22.5, 91)):  # success dings
    add(at, tone(midi(m), 0.6, 0.22, 'sine', 30, 9000)); add(at, tone(midi(m + 12), 0.4, 0.08, 'sine', 30, 6000))
# fade out and normalise
for i in range(int(1.2 * SR)): buf[N - 1 - i] *= i / (1.2 * SR)
peak = max(abs(v) for v in buf) or 1
w = wave.open(sys.argv[1], 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v / peak * 0.89)) * 32767)) for v in buf)); w.close()
print('audio ok', DUR, 's')
