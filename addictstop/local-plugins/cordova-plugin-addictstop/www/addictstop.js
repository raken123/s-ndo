/* global cordova */
var exec = require('cordova/exec');

var SERVICE = 'AddictStop';

function call(action, args) {
  return new Promise(function (resolve, reject) {
    exec(resolve, reject, SERVICE, action, args || []);
  });
}

module.exports = {
  /** Permission + lock snapshot. */
  getStatus: function () { return call('getStatus'); },

  /** Turn protection on or off. Off cancels every alarm and drops the lock. */
  setArmed: function (armed) { return call('setArmed', [!!armed]); },

  /**
   * Hand down the upcoming prayers as [{key, name, rakahs, at}], `at` being
   * epoch milliseconds. Replaces any previously armed alarms.
   */
  schedule: function (prayers) { return call('schedule', [prayers]); },

  lock: function (prayer, rakahs) { return call('lock', [prayer, rakahs]); },
  unlock: function () { return call('unlock'); },

  /** The prayer whose alarm brought us here, consumed once. */
  consumeTrigger: function () { return call('consumeTrigger'); },

  openAccessibilitySettings: function () { return call('openAccessibilitySettings'); },
  openOverlaySettings: function () { return call('openOverlaySettings'); },
  openExactAlarmSettings: function () { return call('openExactAlarmSettings'); },
  openBatterySettings: function () { return call('openBatterySettings'); },
  openNotificationSettings: function () { return call('openNotificationSettings'); },

  /** Stream of {type, payload}: 'adhan', 'blocked', 'resume'. */
  watch: function (onEvent) {
    exec(onEvent, function () { }, SERVICE, 'watch', []);
  }
};
