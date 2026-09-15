/* link.js — the Arduino link.
 *
 * One newline-delimited ASCII protocol, two transports:
 *
 *   USB serial   navigator.serial, 115200 8N1. The board's sketch Serial is the
 *                USB CDC endpoint (UNO R4, Nano ESP32, MKR), or an UNO Q with a
 *                CDC gadget configured on the Linux side.
 *   WebSocket    the uno_q_bridge app on an UNO Q: the sketch runs on the STM32
 *                and Python on the Qualcomm side relays the same lines.
 *
 * Device -> host
 *   HELLO infodoc <proto> <fw> <caps>     caps: letters from TJM
 *   STAT T=0|1 J=0|1 M=0|1
 *   T <ms> <tempC> <rh>
 *   J <ms> <x> <y> <btn>                  x,y in -127..127, btn 0|1
 *   M <ms> <ax> <ay> <az> <gx> <gy> <gz>  accel g, gyro dps
 *   PONG <ms>
 *   ERR <text>
 *   # <text>                              log line, ignored
 *
 * Host -> device
 *   ID?  SCAN  PING  T1 T0  J1 J0  M1 M0  RATE <T|J|M> <hz>
 *
 * Sample timing uses the device clock. PING/PONG estimates the offset between
 * the device's millis() and the host's performance.now(), taking the sample with
 * the lowest round trip, so USB scheduling jitter stays out of reaction times.
 */
(function (global) {
  'use strict';

  var PROTO = 1;

  var handlers = {};           // event -> [fn]
  var refs = { T: 0, J: 0, M: 0 };   // how many tests want each stream
  var transport = null;        // { send, close, kind, label }
  var buf = '';
  var state = 'idle';          // idle | opening | open | closing
  var modules = { T: false, J: false, M: false };
  var info = { fw: '', proto: 0, caps: '' };
  var clock = { offset: 0, rtt: Infinity, samples: 0 };
  var pingTimer = null;

  function on(ev, fn) { (handlers[ev] || (handlers[ev] = [])).push(fn); }
  function off(ev, fn) {
    var l = handlers[ev];
    if (!l) return;
    var i = l.indexOf(fn);
    if (i >= 0) l.splice(i, 1);
  }
  function emit(ev) {
    var l = handlers[ev];
    if (!l) return;
    var args = Array.prototype.slice.call(arguments, 1);
    // copy first: a handler may unsubscribe itself while we are iterating
    l = l.slice();
    for (var i = 0; i < l.length; i++) {
      try { l[i].apply(null, args); } catch (e) { console.error(e); }
    }
  }

  function now() { return global.performance ? performance.now() : Date.now(); }

  /* ── line handling ────────────────────────────────────── */
  function feed(text) {
    buf += text;
    var i;
    while ((i = buf.indexOf('\n')) >= 0) {
      var line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line) handleLine(line);
    }
    if (buf.length > 4096) buf = '';   // a device spewing binary must not grow this forever
  }

  function num(s) { var v = parseFloat(s); return isFinite(v) ? v : 0; }

  function handleLine(line) {
    var p = line.split(/\s+/);
    var tag = p[0];

    switch (tag) {
      case 'T':
        if (p.length >= 4) {
          emit('raw', line, true);
          emit('thermo', { t: num(p[1]), tempC: num(p[2]), rh: num(p[3]) });
        }
        return;

      case 'J':
        if (p.length >= 5) {
          emit('raw', line, true);
          emit('joy', { t: num(p[1]), x: num(p[2]), y: num(p[3]), btn: p[4] === '1' });
        }
        return;

      case 'M':
        if (p.length >= 8) {
          emit('raw', line, true);
          emit('move', {
            t: num(p[1]),
            ax: num(p[2]), ay: num(p[3]), az: num(p[4]),
            gx: num(p[5]), gy: num(p[6]), gz: num(p[7])
          });
        }
        return;

      case 'HELLO':
        emit('raw', line);
        info.proto = num(p[2]);
        info.fw = p[3] || '';
        info.caps = p[4] || '';
        if (info.proto !== PROTO) {
          emit('warn', 'Device speaks protocol ' + info.proto + ', this app speaks ' + PROTO + '.');
        }
        emit('hello', info);
        return;

      case 'STAT':
        emit('raw', line);
        modules.T = /T=1/.test(line);
        modules.J = /J=1/.test(line);
        modules.M = /M=1/.test(line);
        emit('modules', modules);
        return;

      case 'PONG':
        onPong(num(p[1]));
        return;

      case 'ERR':
        emit('raw', line, false, true);
        emit('deverror', line.slice(4).trim());
        return;

      case '#':
        emit('raw', line);
        return;

      default:
        emit('raw', line);
    }
  }

  /* ── clock sync ───────────────────────────────────────── */
  var pending = null;

  function ping() {
    if (state !== 'open') return;
    pending = now();
    send('PING');
  }

  function onPong(deviceMs) {
    if (pending === null) return;
    var t1 = now();
    var rtt = t1 - pending;
    pending = null;
    // device time ≈ host time + offset, measured at the midpoint of the round trip
    var offset = deviceMs - (t1 - rtt / 2);
    clock.samples++;
    if (rtt < clock.rtt) { clock.rtt = rtt; clock.offset = offset; }
    emit('clock', clock);
  }

  function syncClock(n) {
    clock.rtt = Infinity; clock.offset = 0; clock.samples = 0;
    var left = n || 12;
    (function step() {
      if (state !== 'open' || left-- <= 0) return;
      ping();
      setTimeout(step, 60);
    })();
  }

  /* ── send ─────────────────────────────────────────────── */
  function send(line) {
    if (!transport || state !== 'open') return false;
    try {
      transport.send(line + '\n');
      if (line !== 'PING') emit('raw', line, false, false, true);
      return true;
    } catch (e) {
      emit('warn', 'Send failed: ' + e.message);
      return false;
    }
  }

  function setState(s, label) {
    state = s;
    emit('state', { state: s, label: label || (transport && transport.label) || '', kind: transport && transport.kind });
  }

  function afterOpen() {
    setState('open');
    buf = '';
    send('ID?');
    send('SCAN');
    syncClock();
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(ping, 5000);   // keeps the offset fresh over long clinics
  }

  function teardown(why) {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    transport = null;
    // the streams died with the link; a reconnect must be able to ask again
    refs = { T: 0, J: 0, M: 0 };
    modules = { T: false, J: false, M: false };
    emit('modules', modules);
    setState('idle', '');
    if (why) emit('warn', why);
  }

  /* ── serial transport ─────────────────────────────────── */
  function serialSupported() {
    return !!(global.navigator && navigator.serial);
  }

  function connectSerial() {
    if (!serialSupported()) return Promise.reject(new Error('This build has no Web Serial API.'));
    if (state !== 'idle') return Promise.reject(new Error('Already connected.'));
    setState('opening', 'serial');

    var port, reader, writer, encoder = new TextEncoder();

    return navigator.serial.requestPort()
      .then(function (p) {
        port = p;
        return port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', bufferSize: 4096 });
      })
      .then(function () {
        var i = port.getInfo ? port.getInfo() : {};
        var label = 'serial';
        if (i && i.usbVendorId !== undefined && i.usbVendorId !== null) {
          label = 'USB ' + hex4(i.usbVendorId) + ':' + hex4(i.usbProductId);
        }
        writer = port.writable.getWriter();
        transport = {
          kind: 'serial',
          label: label,
          send: function (s) { writer.write(encoder.encode(s)); },
          close: function () {
            var chain = Promise.resolve();
            if (reader) { try { reader.cancel(); } catch (e) {} }
            if (writer) { try { writer.releaseLock(); } catch (e) {} }
            return chain.then(function () { return port.close(); }).catch(function () {});
          }
        };
        afterOpen();
        pump();
      })
      .catch(function (e) {
        setState('idle', '');
        transport = null;
        throw e;
      });

    function pump() {
      var decoder = new TextDecoder();
      reader = port.readable.getReader();
      (function read() {
        reader.read().then(function (r) {
          if (r.value) feed(decoder.decode(r.value, { stream: true }));
          if (r.done) {
            try { reader.releaseLock(); } catch (e) {}
            if (state === 'open') teardown('The serial port closed.');
            return;
          }
          read();
        }, function (e) {
          try { reader.releaseLock(); } catch (x) {}
          if (state === 'open') teardown('Serial read failed: ' + e.message);
        });
      })();
    }
  }

  function hex4(n) { return (n | 0).toString(16).padStart(4, '0'); }

  /* ── websocket transport ──────────────────────────────── */
  function connectWs(url) {
    if (state !== 'idle') return Promise.reject(new Error('Already connected.'));
    if (!/^wss?:\/\//.test(url)) url = 'ws://' + url;
    setState('opening', url);

    return new Promise(function (resolve, reject) {
      var ws;
      try { ws = new WebSocket(url); }
      catch (e) { setState('idle', ''); reject(e); return; }

      var settled = false;
      var giveUp = setTimeout(function () {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch (e) {}
        setState('idle', '');
        reject(new Error('No answer from ' + url + ' after 8 s.'));
      }, 8000);

      ws.onopen = function () {
        if (settled) return;
        settled = true;
        clearTimeout(giveUp);
        transport = {
          kind: 'ws',
          label: url,
          send: function (s) { ws.send(s); },
          close: function () { try { ws.close(); } catch (e) {} return Promise.resolve(); }
        };
        afterOpen();
        resolve();
      };

      ws.onmessage = function (ev) {
        if (typeof ev.data === 'string') feed(ev.data);
        else if (ev.data instanceof Blob) ev.data.text().then(feed);
        else feed(new TextDecoder().decode(ev.data));
      };

      ws.onclose = function () {
        clearTimeout(giveUp);
        if (!settled) {
          settled = true;
          setState('idle', '');
          reject(new Error('Could not reach ' + url + '.'));
          return;
        }
        if (state === 'open' || state === 'closing') teardown(state === 'open' ? 'The bridge closed the connection.' : null);
      };

      ws.onerror = function () { /* onclose carries the outcome */ };
    });
  }

  function disconnect() {
    if (!transport) { teardown(); return Promise.resolve(); }
    setState('closing');
    var t = transport;
    return Promise.resolve(t.close()).then(function () { teardown(); }, function () { teardown(); });
  }

  /* ── stream control, reference counted ────────────────── */
  function claim(which) {
    if (refs[which] === 0) send(which + '1');
    refs[which]++;
    var released = false;
    return function release() {
      if (released) return;
      released = true;
      refs[which] = Math.max(0, refs[which] - 1);
      if (refs[which] === 0) send(which + '0');
    };
  }

  global.Link = {
    PROTO: PROTO,
    on: on,
    off: off,
    send: send,
    connectSerial: connectSerial,
    connectWs: connectWs,
    disconnect: disconnect,
    serialSupported: serialSupported,
    syncClock: syncClock,
    rescan: function () { send('SCAN'); },
    claim: claim,
    isOpen: function () { return state === 'open'; },
    state: function () { return state; },
    modules: function () { return modules; },
    info: function () { return info; },
    clock: function () { return clock; },
    /* host performance.now() -> device millis() */
    toDevice: function (hostMs) { return hostMs + clock.offset; },
    toHost: function (deviceMs) { return deviceMs - clock.offset; },
    now: now
  };
})(window);
