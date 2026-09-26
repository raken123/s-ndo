// Scanner — available on devices with a built-in 2D scanner (capability scanner2d).
// Hardware scanners deliver codes as fast keyboard input ending with Enter; RakenOS
// turns that input into scan events while Scanner is open.
import { h, ic } from '../core/dom.js';
import { settings, storage } from '../core/store.js';
import { platform } from '../core/platform.js';
import { section, row, emptyState } from '../ui/components.js';
import { toast } from '../ui/overlays.js';
import { system } from '../shell/system.js';

function beep() {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); const g = a.createGain(); o.frequency.value = 1760; g.gain.value = 0.05; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.08); setTimeout(() => a.close(), 200); } catch {}
}

export default {
  mount(container) {
    let scans = storage.get('rakenos.scanner.history') || [];
    let buf = ''; let last = 0; let armed = false;
    const status = h('div', { class: 'scan__status', role: 'status' });
    const list = h('div');
    const trigger = h('button', { class: 'r-btn r-btn--primary r-btn--block scan__trigger', onpointerdown: () => arm(true), onpointerup: () => arm(false), onpointerleave: () => arm(false) }, ic('scanner'), 'Hold to scan');
    const root = h('div', { class: 'scan' },
      h('h1', { class: 'r-large-title' }, 'Scanner'),
      h('div', { class: 'scan__view' }, h('div', { class: 'scan__frame' }, h('span'), h('span'), h('span'), h('span'), h('div', { class: 'scan__beam' })), status),
      h('div', { class: 'scan__pad' }, settings.get('scannerTrigger') === 'screen' ? trigger : h('p', { class: 'r-footnote r-secondary scan__hint' }, 'Press the scan trigger on the device. Scanned codes appear below and are entered into the focused field in other apps.')),
      list);
    container.appendChild(root);

    function arm(on) { armed = on; root.classList.toggle('is-armed', on); render(); }
    function feedback() {
      const f = settings.get('scannerFeedback');
      if (f !== 'silent') platform.vibrate(30);
      if (f === 'beep-vibrate') beep();
    }
    function add(code, source) {
      scans = [{ code, source, time: Date.now() }, ...scans].slice(0, 50);
      storage.set('rakenos.scanner.history', scans);
      feedback(); render();
    }
    function render() {
      status.textContent = !settings.get('scannerEnabled') ? 'Scanner is turned off in Settings' : armed ? 'Scanning…' : 'Ready to scan';
      list.replaceChildren(scans.length
        ? section({ header: 'Recent scans', footer: 'Scan history stays on this device.' }, ...scans.slice(0, 20).map((s) => row({ icon: 'qr', color: '#14a38b', title: s.code, subtitle: new Date(s.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }), onClick: () => { try { navigator.clipboard.writeText(s.code); toast('Copied'); } catch { toast(s.code); } } })))
        : emptyState('scanner', 'No scans yet', 'Codes you scan appear here.'));
    }
    // Only while Scanner is in the foreground: elsewhere the scanner types into the focused field.
    const onKey = (e) => {
      if (!settings.get('scannerEnabled') || system.foreground !== 'scanner') return;
      if (e.target && e.target.matches && e.target.matches('input, textarea')) return;
      const now = Date.now();
      if (now - last > 60) buf = '';
      last = now;
      if (e.key === 'Enter') { if (buf.length >= 3) { add(buf, 'scanner'); e.preventDefault(); } buf = ''; return; }
      if (e.key.length === 1) buf += e.key;
    };
    document.addEventListener('keydown', onKey, true);
    render();
    return { unmount: () => document.removeEventListener('keydown', onKey, true), resume: render };
  },
};
