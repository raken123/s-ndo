var exec = require('cordova/exec');

var SERVICE = 'PQuitBlocker';

function call(action, args) {
    return new Promise(function (resolve, reject) {
        exec(resolve, reject, SERVICE, action, args || []);
    });
}

module.exports = {
    /** {locked, remainingMs, endsAt, durationMs, totalLocks, strictMode,
     *   accessibilityEnabled, serviceConnected, usageAccess} */
    getStatus: function () { return call('getStatus'); },

    /** Starts (or extends) the cooldown. Never shortens a running one. */
    startLock: function (minutes) { return call('startLock', [minutes || 60]); },

    /** Strict mode blocks every app that did not ship with the phone. */
    setStrictMode: function (on) { return call('setStrictMode', [!!on]); },

    getScreenTime: function (windowMs) {
        return call('getScreenTime', [windowMs || 24 * 60 * 60 * 1000]);
    },

    openAccessibilitySettings: function () { return call('openAccessibilitySettings'); },
    openUsageAccessSettings: function () { return call('openUsageAccessSettings'); },
    openAppSettings: function () { return call('openAppSettings'); },
    openScreenTime: function () { return call('openScreenTime'); },
    requestNotifications: function () { return call('requestNotifications'); }
};
