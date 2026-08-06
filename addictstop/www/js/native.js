/*
 * native.js -- one wrapper around the blocker plugin.
 *
 * In a desktop browser the plugin does not exist, so everything falls back to
 * an in-memory stub. The UI is then fully usable for development and demos;
 * it just cannot really hold other apps shut.
 */
(function (global) {
  'use strict';

  var listeners = [];

  var stub = {
    _state: {
      locked: false, armed: false, prayer: null, rakahs: 0, lockedSince: 0,
      accessibility: false, overlay: false, exactAlarms: true,
      notifications: true, batteryUnrestricted: false, sdk: 0
    },
    getStatus: function () { return Promise.resolve(copy(this._state)); },
    setArmed: function (a) { this._state.armed = !!a; if (!a) this._state.locked = false; return this.getStatus(); },
    schedule: function () { return Promise.resolve({ armed: 0 }); },
    lock: function (prayer, rakahs) {
      this._state.locked = true;
      this._state.prayer = prayer;
      this._state.rakahs = rakahs;
      this._state.lockedSince = Date.now();
      return this.getStatus();
    },
    unlock: function () { this._state.locked = false; this._state.prayer = null; return this.getStatus(); },
    consumeTrigger: function () { return Promise.resolve({ prayer: null }); },
    openAccessibilitySettings: function () { return this._grant('accessibility'); },
    openOverlaySettings: function () { return this._grant('overlay'); },
    openExactAlarmSettings: function () { return this._grant('exactAlarms'); },
    openBatterySettings: function () { return this._grant('batteryUnrestricted'); },
    openNotificationSettings: function () { return this._grant('notifications'); },
    _grant: function (key) {
      // Pretend the user came back from the settings screen having said yes.
      this._state[key] = true;
      return Promise.resolve();
    },
    watch: function () { }
  };

  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  var Native = {
    available: false,
    impl: stub,

    init: function () {
      if (global.AddictStopNative) {
        Native.impl = global.AddictStopNative;
        Native.available = true;
        global.AddictStopNative.watch(function (event) {
          listeners.forEach(function (fn) { fn(event); });
        });
      }
      return Native;
    },

    on: function (fn) { listeners.push(fn); },

    /* The stub path lets the browser build simulate a lock for development. */
    emit: function (type, payload) {
      listeners.forEach(function (fn) { fn({ type: type, payload: payload || {} }); });
    },

    getStatus: function () { return Native.impl.getStatus(); },
    setArmed: function (a) { return Native.impl.setArmed(a); },
    schedule: function (p) { return Native.impl.schedule(p); },
    lock: function (name, rakahs) { return Native.impl.lock(name, rakahs); },
    unlock: function () { return Native.impl.unlock(); },
    consumeTrigger: function () { return Native.impl.consumeTrigger(); },
    open: function (which) {
      var map = {
        accessibility: 'openAccessibilitySettings',
        overlay: 'openOverlaySettings',
        exactAlarms: 'openExactAlarmSettings',
        battery: 'openBatterySettings',
        notifications: 'openNotificationSettings'
      };
      var fn = Native.impl[map[which]];
      return fn ? fn.call(Native.impl) : Promise.resolve();
    }
  };

  global.Native = Native;
})(window);
