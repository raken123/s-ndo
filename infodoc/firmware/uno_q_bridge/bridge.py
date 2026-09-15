#!/usr/bin/env python3
"""infodoc bridge — relay the MCU's serial line protocol to a WebSocket.

Why this exists
---------------
On an UNO Q the sketch runs on the STM32 and the USB-C socket belongs to the
Qualcomm side, so the desktop app usually cannot open the sketch's Serial as a
host serial port. Run this on the board's Linux side instead: it opens the tty
the MCU is on and relays every line, unchanged, to any WebSocket client. Plugging
the board into a computer gives that computer an IP route to the board, so
InfoDoc connects to ws://<board>:8787 and sees exactly the protocol the sketch
speaks.

It is a dumb pipe on purpose. It parses nothing, so the protocol can change
without touching this file.

Also useful on a Raspberry Pi, or on any machine where you would rather not give
a browser direct serial access.

Usage
-----
    python3 bridge.py                        # autodetect the tty, listen on 8787
    python3 bridge.py --port /dev/ttyACM0
    python3 bridge.py --host 0.0.0.0 --listen 8787 --baud 115200
    python3 bridge.py --list                 # show candidate ttys and exit

Dependencies: none required. pyserial is used when installed; otherwise the port
is configured with stty(1) and opened as a plain file.
"""

import argparse
import base64
import errno
import glob
import hashlib
import os
import selectors
import socket
import struct
import subprocess
import sys
import time

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

# The MCU tty is named differently depending on the board and kernel; try the
# specific names before the generic ones so we do not grab a modem by accident.
CANDIDATE_GLOBS = [
    "/dev/ttyMCU*",
    "/dev/ttymxc*",
    "/dev/ttyRPMSG*",
    "/dev/ttyACM*",
    "/dev/ttyUSB*",
    "/dev/cu.usbmodem*",
    "/dev/tty.usbmodem*",
]


def log(*a):
    print(time.strftime("[%H:%M:%S]"), *a, flush=True)


def candidates():
    seen, out = set(), []
    for g in CANDIDATE_GLOBS:
        for p in sorted(glob.glob(g)):
            if p not in seen:
                seen.add(p)
                out.append(p)
    return out


# ───────────────────────────── serial ─────────────────────────────
class Serial:
    """The tty, via pyserial when it is installed and stty when it is not."""

    def __init__(self, path, baud):
        self.path = path
        self.baud = baud
        self._ser = None
        self._fd = None
        try:
            import serial  # noqa: F401
            self._open_pyserial()
        except ImportError:
            self._open_raw()

    def _open_pyserial(self):
        import serial
        self._ser = serial.Serial(self.path, self.baud, timeout=0,
                                  write_timeout=1, rtscts=False, dsrdtr=False)
        self._fd = self._ser.fileno()
        log("opened %s at %d via pyserial" % (self.path, self.baud))

    def _open_raw(self):
        # raw 8N1, no flow control, no echo, and no hangup on close so the MCU
        # is not reset every time this process restarts
        subprocess.run(
            ["stty", "-F", self.path, str(self.baud), "raw", "-echo", "-echoe",
             "-echok", "-crtscts", "-hupcl", "cs8", "-cstopb", "-parenb",
             "min", "0", "time", "0"],
            check=True)
        self._fd = os.open(self.path, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
        log("opened %s at %d via stty (pyserial not installed)" % (self.path, self.baud))

    def fileno(self):
        return self._fd

    def read(self):
        try:
            if self._ser is not None:
                n = self._ser.in_waiting
                return self._ser.read(n if n else 1)
            return os.read(self._fd, 4096)
        except (OSError, IOError) as e:
            if getattr(e, "errno", None) in (errno.EAGAIN, errno.EWOULDBLOCK):
                return b""
            raise

    def write(self, data):
        if self._ser is not None:
            self._ser.write(data)
        else:
            os.write(self._fd, data)

    def close(self):
        try:
            if self._ser is not None:
                self._ser.close()
            elif self._fd is not None:
                os.close(self._fd)
        except Exception:
            pass


# ─────────────────────────── websocket ────────────────────────────
class WSClient:
    """One connected browser. Enough of RFC 6455 for text frames."""

    def __init__(self, sock, addr):
        self.sock = sock
        self.addr = addr
        self.inbuf = b""
        self.outbuf = b""
        self.handshaken = False
        self.closed = False
        self.frag = b""
        sock.setblocking(False)
        try:
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except OSError:
            pass

    # --- outgoing -------------------------------------------------
    def send_text(self, text):
        self.outbuf += self._frame(1, text.encode("utf-8", "replace"))

    def _frame(self, opcode, payload):
        head = bytes([0x80 | opcode])
        n = len(payload)
        if n < 126:
            head += bytes([n])
        elif n < 65536:
            head += b"\x7e" + struct.pack(">H", n)
        else:
            head += b"\x7f" + struct.pack(">Q", n)
        return head + payload

    def flush(self):
        while self.outbuf:
            try:
                sent = self.sock.send(self.outbuf)
            except (BlockingIOError, InterruptedError):
                return
            except OSError:
                self.closed = True
                return
            if sent <= 0:
                return
            self.outbuf = self.outbuf[sent:]
        # a client that stops reading must not blow up memory
        if len(self.outbuf) > 4 << 20:
            log("client %s is not keeping up; dropping it" % (self.addr,))
            self.closed = True

    def wants_write(self):
        return bool(self.outbuf)

    # --- incoming -------------------------------------------------
    def feed(self):
        """Returns a list of complete text messages from the client."""
        try:
            data = self.sock.recv(65536)
        except (BlockingIOError, InterruptedError):
            return []
        except OSError:
            self.closed = True
            return []
        if not data:
            self.closed = True
            return []
        self.inbuf += data
        return self._handshake() if not self.handshaken else self._frames()

    def _handshake(self):
        if b"\r\n\r\n" not in self.inbuf:
            if len(self.inbuf) > 16384:
                self.closed = True
            return []
        head, self.inbuf = self.inbuf.split(b"\r\n\r\n", 1)
        lines = head.decode("latin-1").split("\r\n")
        key = None
        for ln in lines[1:]:
            if ":" in ln:
                k, v = ln.split(":", 1)
                if k.strip().lower() == "sec-websocket-key":
                    key = v.strip()
        if not key:
            self.sock.sendall(b"HTTP/1.1 400 Bad Request\r\n"
                              b"Content-Length: 0\r\nConnection: close\r\n\r\n")
            self.closed = True
            return []
        accept = base64.b64encode(
            hashlib.sha1((key + GUID).encode("latin-1")).digest()).decode()
        self.outbuf += ("HTTP/1.1 101 Switching Protocols\r\n"
                        "Upgrade: websocket\r\n"
                        "Connection: Upgrade\r\n"
                        "Sec-WebSocket-Accept: %s\r\n\r\n" % accept).encode()
        self.handshaken = True
        log("websocket client %s:%d connected" % self.addr[:2])
        return self._frames()

    def _frames(self):
        out = []
        while True:
            if len(self.inbuf) < 2:
                return out
            b0, b1 = self.inbuf[0], self.inbuf[1]
            fin = b0 & 0x80
            opcode = b0 & 0x0F
            masked = b1 & 0x80
            n = b1 & 0x7F
            off = 2
            if n == 126:
                if len(self.inbuf) < off + 2:
                    return out
                n = struct.unpack(">H", self.inbuf[off:off + 2])[0]
                off += 2
            elif n == 127:
                if len(self.inbuf) < off + 8:
                    return out
                n = struct.unpack(">Q", self.inbuf[off:off + 8])[0]
                off += 8
            if n > (8 << 20):          # nothing legitimate is this big
                self.closed = True
                return out
            if masked:
                if len(self.inbuf) < off + 4:
                    return out
                mask = self.inbuf[off:off + 4]
                off += 4
            if len(self.inbuf) < off + n:
                return out
            payload = bytearray(self.inbuf[off:off + n])
            self.inbuf = self.inbuf[off + n:]
            if masked:
                for i in range(n):
                    payload[i] ^= mask[i & 3]

            if opcode == 0x8:                       # close
                self.outbuf += self._frame(0x8, bytes(payload[:2]))
                self.closed = True
                return out
            if opcode == 0x9:                       # ping
                self.outbuf += self._frame(0xA, bytes(payload))
                continue
            if opcode == 0xA:                       # pong
                continue
            if opcode == 0x0:                       # continuation
                self.frag += bytes(payload)
            elif opcode == 0x1:
                self.frag = bytes(payload)
            else:                                   # binary or reserved
                self.frag = b""
                continue
            if fin:
                out.append(self.frag.decode("utf-8", "replace"))
                self.frag = b""

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass


# ───────────────────────────── main ───────────────────────────────
def run(args):
    path = args.port
    if not path:
        found = candidates()
        if not found:
            log("no candidate tty found. Plug the board in, or pass --port.")
            log("looked for: " + ", ".join(CANDIDATE_GLOBS))
            return 2
        path = found[0]
        if len(found) > 1:
            log("several candidates (%s); using %s" % (", ".join(found), path))

    try:
        ser = Serial(path, args.baud)
    except Exception as e:
        log("could not open %s: %s" % (path, e))
        return 2

    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        srv.bind((args.host, args.listen))
    except OSError as e:
        log("cannot bind %s:%d — %s" % (args.host, args.listen, e))
        ser.close()
        return 2
    srv.listen(8)
    srv.setblocking(False)
    log("listening on ws://%s:%d/  (relaying %s)" % (args.host, args.listen, path))

    sel = selectors.DefaultSelector()
    sel.register(srv, selectors.EVENT_READ, "srv")
    sel.register(ser.fileno(), selectors.EVENT_READ, "ser")
    clients = []
    line = b""

    def broadcast(text):
        for c in clients:
            if c.handshaken and not c.closed:
                c.send_text(text)

    try:
        while True:
            for key, _ in sel.select(timeout=1.0):
                tag = key.data

                if tag == "srv":
                    while True:
                        try:
                            sock, addr = srv.accept()
                        except (BlockingIOError, InterruptedError):
                            break
                        except OSError:
                            break
                        c = WSClient(sock, addr)
                        clients.append(c)
                        sel.register(sock, selectors.EVENT_READ, c)

                elif tag == "ser":
                    try:
                        chunk = ser.read()
                    except OSError as e:
                        log("serial read failed: %s" % e)
                        return 1
                    if not chunk:
                        continue
                    line += chunk
                    while b"\n" in line:
                        one, line = line.split(b"\n", 1)
                        text = one.rstrip(b"\r").decode("utf-8", "replace")
                        if text:
                            if args.verbose:
                                log("<", text)
                            broadcast(text + "\n")
                    if len(line) > 8192:
                        line = b""          # not line protocol; resynchronise

                else:
                    c = tag
                    for msg in c.feed():
                        for one in msg.replace("\r", "\n").split("\n"):
                            one = one.strip()
                            if not one:
                                continue
                            if args.verbose:
                                log(">", one)
                            try:
                                ser.write((one + "\n").encode())
                            except OSError as e:
                                log("serial write failed: %s" % e)

            for c in list(clients):
                c.flush()
                if c.closed:
                    try:
                        sel.unregister(c.sock)
                    except Exception:
                        pass
                    c.close()
                    clients.remove(c)
                    log("client %s:%d gone" % c.addr[:2])
                else:
                    # re-arm write interest only while there is something to send
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
        ser.close()
    return 0


def main():
    ap = argparse.ArgumentParser(description="Relay the InfoDoc serial protocol to a WebSocket.")
    ap.add_argument("--port", help="tty the MCU is on (default: autodetect)")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--host", default="0.0.0.0", help="address to listen on (default: all)")
    ap.add_argument("--listen", type=int, default=8787, help="TCP port (default: 8787)")
    ap.add_argument("--verbose", "-v", action="store_true", help="log every line")
    ap.add_argument("--list", action="store_true", help="list candidate ttys and exit")
    args = ap.parse_args()

    if args.list:
        found = candidates()
        print("\n".join(found) if found else "(no candidate tty found)")
        return 0
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
