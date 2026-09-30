// Samlar tangentbord, pekskärm, handkontroll och VR-kontroller till ett gemensamt tillstånd.
export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { x: 0, y: 0, thrust: false, brake: false };
    this.state = { steerX: 0, steerY: 0, roll: 0, thrust: 0, brake: 0 };
    this.actions = new Set();
    this.lastActivity = performance.now();
    this.prevPad = {};
    this.xrSession = null;

    const actionKeys = {
      KeyP: 'autopilot', KeyF: 'warp', KeyM: 'map', KeyC: 'view', Enter: 'confirm', NumpadEnter: 'confirm',
      Escape: 'back', ArrowUp: 'navUp', ArrowDown: 'navDown', ArrowLeft: 'navLeft', ArrowRight: 'navRight', Tab: 'navNext',
    };
    window.addEventListener('keydown', (e) => {
      this.activity();
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
      if (!e.repeat && actionKeys[e.code]) this.actions.add(actionKeys[e.code]);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart']) {
      window.addEventListener(ev, () => this.activity(), { passive: true });
    }
  }

  activity() { this.lastActivity = performance.now(); }

  take(action) {
    if (this.actions.has(action)) { this.actions.delete(action); return true; }
    return false;
  }

  clearActions() { this.actions.clear(); }

  update() {
    const k = (c) => this.keys.has(c);
    let sx = 0, sy = 0, roll = 0, thrust = 0, brake = 0;
    if (k('ArrowLeft') || k('KeyA')) sx -= 1;
    if (k('ArrowRight') || k('KeyD')) sx += 1;
    if (k('ArrowUp') || k('KeyW')) sy += 1;
    if (k('ArrowDown') || k('KeyS')) sy -= 1;
    if (k('KeyQ')) roll -= 1;
    if (k('KeyE')) roll += 1;
    if (k('Space')) thrust = 1;
    if (k('KeyB') || k('ShiftLeft') || k('ShiftRight') || k('ControlLeft')) brake = 1;

    // Pekskärm
    sx += this.touch.x; sy += this.touch.y;
    if (this.touch.thrust) thrust = 1;
    if (this.touch.brake) brake = 1;

    // Handkontroller (standardmappning)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected || p.mapping !== 'standard') continue;
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      sx += dz(p.axes[0]); sy -= dz(p.axes[1]);
      thrust = Math.max(thrust, p.buttons[7]?.value || 0);
      brake = Math.max(brake, p.buttons[6]?.value || 0);
      if (p.buttons[4]?.pressed) roll -= 1;
      if (p.buttons[5]?.pressed) roll += 1;
      this.edge(p.index, p.buttons, {
        0: 'confirm', 1: 'back', 2: 'warp', 3: 'map', 8: 'view', 9: 'autopilot', 12: 'navUp', 13: 'navDown', 14: 'navLeft', 15: 'navRight',
      });
      // A-knappen är också autopilot när ingen dialog är öppen – hanteras i main via 'confirm'.
      if (p.buttons.some((b) => b.pressed) || Math.abs(p.axes[0]) > 0.3 || Math.abs(p.axes[1]) > 0.3) this.activity();
    }

    // VR-kontroller
    if (this.xrSession) {
      for (const src of this.xrSession.inputSources) {
        const g = src.gamepad;
        if (!g) continue;
        const hand = src.handedness;
        const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
        if (hand === 'left') {
          sx += dz(g.axes[2] || 0); sy -= dz(g.axes[3] || 0);
          brake = Math.max(brake, g.buttons[0]?.value || 0);
          this.edge('xr-left', g.buttons, { 4: 'view', 5: 'map' });
        } else if (hand === 'right') {
          thrust = Math.max(thrust, g.buttons[0]?.value || 0);
          brake = Math.max(brake, g.buttons[1]?.value || 0);
          roll += dz(g.axes[2] || 0);
          this.edge('xr-right', g.buttons, { 4: 'autopilot', 5: 'warp' });
        }
        if (g.buttons.some((b) => b.pressed) || g.axes.some((a) => Math.abs(a) > 0.3)) this.activity();
      }
    }

    const c = (v) => Math.max(-1, Math.min(1, v));
    this.state.steerX = c(sx); this.state.steerY = c(sy); this.state.roll = c(roll);
    this.state.thrust = Math.min(1, thrust); this.state.brake = Math.min(1, brake);
    if (thrust || brake || sx || sy) this.activity();
    return this.state;
  }

  edge(id, buttons, map) {
    const prev = this.prevPad[id] || [];
    const now = buttons.map((b) => b.pressed);
    for (const [i, a] of Object.entries(map)) if (now[i] && !prev[i]) this.actions.add(a);
    this.prevPad[id] = now;
  }
}
