/* Device control. Uses Cordova plugins when the app is running as the APK and
 * falls back to the equivalent web APIs on desktop, so the same panel works in
 * all four builds. Pro only. */
window.AGENTER = window.AGENTER || {};

(function () {
  'use strict';

  function onCordova() {
    return !!(window.cordova && window.device);
  }

  function battery() {
    if (window.navigator.getBattery) {
      return navigator.getBattery().then(function (b) {
        return { level: Math.round(b.level * 100), charging: b.charging };
      });
    }
    if (AGENTER._batteryEvent) return Promise.resolve(AGENTER._batteryEvent);
    return Promise.resolve(null);
  }

  // cordova-plugin-battery-status pushes status rather than exposing a getter.
  window.addEventListener('batterystatus', function (e) {
    AGENTER._batteryEvent = { level: e.level, charging: !!e.isPlugged };
  }, false);

  var Device = {
    available: function () {
      return {
        info:      true,
        battery:   !!(navigator.getBattery || onCordova()),
        vibration: !!(navigator.vibrate || (navigator.notification && navigator.notification.vibrate)),
        clipboard: !!(navigator.clipboard && navigator.clipboard.writeText),
        screen:    true,
        network:   !!(navigator.connection || navigator.onLine !== undefined)
      };
    },

    platform: function () {
      if (onCordova()) return window.device.platform + ' ' + window.device.version;
      if (window.process && window.process.versions && window.process.versions.electron) {
        return 'Electron ' + window.process.versions.electron;
      }
      return navigator.platform || 'browser';
    },

    vibrate: function (ms) {
      ms = ms || 240;
      if (navigator.notification && navigator.notification.vibrate) {
        navigator.notification.vibrate(ms); return true;
      }
      if (navigator.vibrate) return navigator.vibrate(ms);
      return false;
    },

    copy: function (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return Promise.reject(new Error('no clipboard'));
    },

    /* A readable report of what this build can actually reach. */
    report: function () {
      return battery().then(function (b) {
        var caps = Device.available();
        var lines = [];
        lines.push('**Platform** — ' + Device.platform());
        lines.push('**Screen** — ' + screen.width + '×' + screen.height +
                   ' @ ' + (window.devicePixelRatio || 1) + 'x, window ' +
                   window.innerWidth + '×' + window.innerHeight);
        lines.push('**Battery** — ' + (b ? b.level + '%' + (b.charging ? ', charging' : ', on battery')
                                         : 'not exposed on this platform'));
        lines.push('**Network** — ' + (navigator.onLine ? 'online' : 'offline') +
                   (navigator.connection && navigator.connection.effectiveType
                      ? ' (' + navigator.connection.effectiveType + ')' : ''));
        lines.push('**Language** — ' + (navigator.language || 'unknown') +
                   ', ' + (navigator.hardwareConcurrency || '?') + ' logical cores');
        lines.push('');
        lines.push('Controls I can drive from here: ' +
          Object.keys(caps).filter(function (k) { return caps[k]; }).join(', ') + '.');
        return lines.join('\n');
      });
    }
  };

  AGENTER.Device = Device;
})();
