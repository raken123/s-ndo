// WebSocket request/response layer with server-push events.
window.Net = (function () {
  const listeners = {};
  let ws = null, id = 0, pending = {}, url = null, connected = false;
  function on(t, fn) { (listeners[t] = listeners[t] || []).push(fn); }
  function emit(t, d) { (listeners[t] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } }); }
  function connect(u) {
    return new Promise((res, rej) => {
      url = u;
      if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} }
      try { ws = new WebSocket(u); } catch (e) { return rej(new Error('Bad server URL')); }
      const timer = setTimeout(() => { if (!connected) { try { ws.close(); } catch (e) {} rej(new Error('Could not reach ' + u)); } }, 8000);
      ws.onopen = () => { connected = true; clearTimeout(timer); emit('open'); res(); };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'res') {
          const p = pending[m.rid]; delete pending[m.rid];
          if (p) m.ok ? p.res(m.data) : p.rej(Object.assign(new Error(m.error), { code: m.code }));
        } else emit(m.t, m);
      };
      ws.onclose = () => {
        const was = connected; connected = false; clearTimeout(timer);
        for (const k in pending) pending[k].rej(new Error('Disconnected'));
        pending = {};
        if (was) emit('close'); else rej(new Error('Could not connect to ' + u));
      };
      ws.onerror = () => {};
    });
  }
  function req(t, data) {
    return new Promise((res, rej) => {
      if (!connected) return rej(new Error('Not connected'));
      const i = ++id; pending[i] = { res, rej };
      ws.send(JSON.stringify(Object.assign({ t }, data || {}, { rid: i })));
    });
  }
  function send(t, data) { if (connected) ws.send(JSON.stringify(Object.assign({ t }, data || {}))); }
  return { on, connect, req, send, get connected() { return connected; }, get url() { return url; }, close() { if (ws) ws.close(); } };
})();
