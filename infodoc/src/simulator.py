#!/usr/bin/env python3
"""infodoc device simulator — the protocol without the hardware.

Speaks exactly what infodoc_mcu.ino speaks, over the same WebSocket the UNO Q
bridge serves, so the desktop app can be developed, demonstrated and tested with
no board attached. Point InfoDoc's network transport at ws://127.0.0.1:8787.

    python3 src/simulator.py
    python3 src/simulator.py --no-thermo            # pretend a node is missing
    python3 src/simulator.py --tremor-hz 6 --tremor-mg 30
    python3 src/simulator.py --skin 38.9            # a febrile patient

Two extra commands exist only here, for automated tests — the real firmware
answers ERR to both:

    SIMAIM <deg> [ms]   deflect the stick towards <deg> after <ms> (default 260)
    SIMCENTER           spring the stick back to the middle
"""

import argparse
import math
import os
import random
import selectors
import socket
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "firmware", "uno_q_bridge"))
from bridge import WSClient, log        # noqa: E402  (the websocket plumbing)

FW = "1.0.0-sim"
PROTO = 1


class Sim:
    def __init__(self, a):
        self.a = a
        self.t0 = time.monotonic()
        self.have = {"T": not a.no_thermo, "J": not a.no_joystick, "M": not a.no_movement}
        self.on = {"T": False, "J": False, "M": False}
        self.period = {"T": 0.2, "J": 0.01, "M": 0.01}
        self.next = {"T": 0.0, "J": 0.0, "M": 0.0}

        # thermo: an exponential settle from room temperature to skin temperature
        self.contact_at = a.contact_delay
        # joystick: target deflection, reached over a short ramp
        self.aim = None                  # (angle_deg, start_time)
        self.jx = 0.0
        self.jy = 0.0

    def ms(self):
        return int((time.monotonic() - self.t0) * 1000) & 0x7FFFFFFF

    # ── protocol ──────────────────────────────────────────
    def hello(self):
        caps = "".join(k for k in "TJM" if self.have[k]) or "-"
        return "HELLO infodoc %d %s %s" % (PROTO, FW, caps)

    def stat(self):
        return "STAT T=%d J=%d M=%d" % (self.have["T"], self.have["J"], self.have["M"])

    def command(self, line):
        out = []
        p = line.split()
        if not p:
            return out
        c = p[0]
        if c == "ID?":
            out += [self.hello(), self.stat()]
        elif c == "SCAN":
            out.append(self.stat())
        elif c == "PING":
            out.append("PONG %d" % self.ms())
        elif c in ("T1", "J1", "M1"):
            k = c[0]
            if not self.have[k]:
                out.append("ERR module %s not present" % k)
            else:
                self.on[k] = True
                self.next[k] = time.monotonic()
                if k == "T":
                    self.t0_thermo = time.monotonic()
        elif c in ("T0", "J0", "M0"):
            self.on[c[0]] = False
        elif c == "RATE" and len(p) >= 3:
            k = p[1]
            try:
                hz = max(1, min(200, int(p[2])))
            except ValueError:
                return ["ERR bad rate"]
            if k in self.period:
                self.period[k] = 1.0 / hz
                out.append("# rate %s %d" % (k, hz))
            else:
                out.append("ERR bad stream for RATE")
        elif c == "SIMAIM" and len(p) >= 2:
            delay = float(p[2]) / 1000.0 if len(p) >= 3 else 0.26
            self.aim = (float(p[1]), time.monotonic() + delay)
        elif c == "SIMCENTER":
            self.aim = None
        else:
            out.append("ERR unknown command %s" % line)
        return out

    # ── sample generators ─────────────────────────────────
    def thermo_line(self):
        el = time.monotonic() - getattr(self, "t0_thermo", self.t0)
        if el < self.contact_at:
            t = self.a.ambient + random.gauss(0, 0.02)
        else:
            k = 1.0 - math.exp(-(el - self.contact_at) / self.a.tau)
            t = self.a.ambient + (self.a.skin - self.a.ambient) * k + random.gauss(0, 0.012)
        return "T %d %.2f %.1f" % (self.ms(), t, self.a.humidity + random.gauss(0, 0.2))

    def joy_line(self):
        now = time.monotonic()
        tx = ty = 0.0
        if self.aim and now >= self.aim[1]:
            ramp = min(1.0, (now - self.aim[1]) / 0.09)   # the stick takes ~90 ms to travel
            r = 110.0 * ramp
            tx = r * math.cos(math.radians(self.aim[0]))
            ty = r * math.sin(math.radians(self.aim[0]))
        # a first-order approach, so the trace looks like a real thumb
        self.jx += (tx - self.jx) * 0.45
        self.jy += (ty - self.jy) * 0.45
        x = max(-127, min(127, int(round(self.jx + random.gauss(0, 0.6)))))
        y = max(-127, min(127, int(round(self.jy + random.gauss(0, 0.6)))))
        return "J %d %d %d 0" % (self.ms(), x, y)

    def move_line(self):
        t = time.monotonic() - self.t0
        amp = self.a.tremor_mg / 1000.0
        osc = amp * math.sin(2 * math.pi * self.a.tremor_hz * t)
        n = self.a.noise_mg / 1000.0
        ax = random.gauss(0, n)
        ay = random.gauss(0, n)
        az = 1.0 + osc + random.gauss(0, n)
        gx = random.gauss(0, self.a.gyro_dps)
        gy = random.gauss(0, self.a.gyro_dps)
        gz = random.gauss(0, self.a.gyro_dps)
        return "M %d %.4f %.4f %.4f %.2f %.2f %.2f" % (self.ms(), ax, ay, az, gx, gy, gz)

    def due(self):
        """Lines owed right now, in the same order the firmware would emit them."""
        now = time.monotonic()
        out = []
        for k, gen in (("J", self.joy_line), ("M", self.move_line), ("T", self.thermo_line)):
            if not self.on[k]:
                continue
            if now < self.next[k]:
                continue
            # keep the cadence but never emit a catch-up burst
            self.next[k] += self.period[k]
            if self.next[k] < now:
                self.next[k] = now + self.period[k]
            out.append(gen())
        return out


def run(a):
    sim = Sim(a)
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((a.host, a.listen))
    srv.listen(8)
    srv.setblocking(False)
    log("simulator on ws://%s:%d/  modules %s" %
        (a.host, a.listen, "".join(k for k in "TJM" if sim.have[k]) or "none"))
    if a.ready_file:
        with open(a.ready_file, "w") as f:
            f.write("ready\n")

    sel = selectors.DefaultSelector()
    sel.register(srv, selectors.EVENT_READ, "srv")
    clients = []

    def push(lines):
        for c in clients:
            if c.handshaken and not c.closed:
                for ln in lines:
                    c.send_text(ln + "\n")

    try:
        while True:
            for key, _ in sel.select(timeout=0.002):
                if key.data == "srv":
                    try:
                        sock, addr = srv.accept()
                    except OSError:
                        continue
                    c = WSClient(sock, addr)
                    clients.append(c)
                    sel.register(sock, selectors.EVENT_READ, c)
                else:
                    c = key.data
                    for msg in c.feed():
                        for one in msg.replace("\r", "\n").split("\n"):
                            one = one.strip()
                            if not one:
                                continue
                            if a.verbose:
                                log(">", one)
                            reply = sim.command(one)
                            for r in reply:
                                if a.verbose:
                                    log("<", r)
                                c.send_text(r + "\n")

            lines = sim.due()
            if lines:
                push(lines)

            for c in list(clients):
                c.flush()
                if c.closed:
                    try:
                        sel.unregister(c.sock)
                    except Exception:
                        pass
                    c.close()
                    clients.remove(c)
                    sim.on = {"T": False, "J": False, "M": False}
                    sim.aim = None
                else:
                    want = selectors.EVENT_READ | (selectors.EVENT_WRITE if c.wants_write() else 0)
                    try:
                        sel.modify(c.sock, want, c)
                    except Exception:
                        pass
    except KeyboardInterrupt:
        log("stopping")
    finally:
        for c in clients:
            c.close()
        sel.close()
        srv.close()
    return 0


def main():
    ap = argparse.ArgumentParser(description="Simulate the InfoDoc firmware over a WebSocket.")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--listen", type=int, default=8787)
    ap.add_argument("--no-thermo", action="store_true")
    ap.add_argument("--no-joystick", action="store_true")
    ap.add_argument("--no-movement", action="store_true")
    ap.add_argument("--ambient", type=float, default=22.0, help="room temperature, °C")
    ap.add_argument("--skin", type=float, default=34.8, help="forehead skin temperature, °C")
    ap.add_argument("--tau", type=float, default=1.0, help="contact settle time constant, s")
    ap.add_argument("--contact-delay", type=float, default=0.6, help="seconds before skin contact")
    ap.add_argument("--humidity", type=float, default=41.0)
    ap.add_argument("--tremor-hz", type=float, default=6.0)
    ap.add_argument("--tremor-mg", type=float, default=30.0, help="tremor amplitude (not RMS)")
    ap.add_argument("--noise-mg", type=float, default=4.0)
    ap.add_argument("--gyro-dps", type=float, default=0.8)
    ap.add_argument("--ready-file", help="write this file once listening (for test harnesses)")
    ap.add_argument("--verbose", "-v", action="store_true")
    return run(ap.parse_args())


if __name__ == "__main__":
    sys.exit(main())
