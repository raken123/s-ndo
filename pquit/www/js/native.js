/**
 * Thin wrapper over the PQuitBlocker plugin.
 *
 * On a desktop browser (handy while working on the UI) the plugin is missing, so
 * everything falls back to a localStorage-backed fake. The fake pretends the lock
 * works; it obviously cannot close real apps.
 */
(function (global) {
    'use strict';

    var FAKE_KEY = 'pquit.fakeLock';

    function fakeState() {
        try {
            return JSON.parse(localStorage.getItem(FAKE_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function saveFake(s) {
        localStorage.setItem(FAKE_KEY, JSON.stringify(s));
    }

    var fake = {
        getStatus: function () {
            var s = fakeState();
            var remaining = Math.max(0, (s.endsAt || 0) - Date.now());
            return Promise.resolve({
                locked: remaining > 0,
                remainingMs: remaining,
                endsAt: s.endsAt || 0,
                durationMs: s.durationMs || 0,
                totalLocks: s.totalLocks || 0,
                strictMode: s.strictMode !== false,
                accessibilityEnabled: false,
                serviceConnected: false,
                usageAccess: false,
                simulated: true
            });
        },
        startLock: function (minutes) {
            var s = fakeState();
            var end = Date.now() + minutes * 60000;
            if (!(s.endsAt > end)) s.endsAt = end;
            s.durationMs = minutes * 60000;
            s.totalLocks = (s.totalLocks || 0) + 1;
            saveFake(s);
            return fake.getStatus();
        },
        setStrictMode: function (on) {
            var s = fakeState();
            s.strictMode = !!on;
            saveFake(s);
            return fake.getStatus();
        },
        getScreenTime: function () {
            return Promise.resolve({ usageAccess: false, apps: [], totalMs: 0, blockedMs: 0 });
        },
        openAccessibilitySettings: noop,
        openUsageAccessSettings: noop,
        openAppSettings: noop,
        openScreenTime: noop,
        requestNotifications: noop
    };

    function noop() { return Promise.resolve(); }

    var Native = {
        /** True once Cordova has fired deviceready with the real plugin present. */
        real: false,

        ready: function () {
            return new Promise(function (resolve) {
                if (!global.cordova) {          // plain browser
                    resolve(false);
                    return;
                }
                var done = false;
                function finish() {
                    if (done) return;
                    done = true;
                    Native.real = !!global.PQuitBlocker;
                    resolve(Native.real);
                }
                document.addEventListener('deviceready', finish, false);
                // Never leave the UI hanging if deviceready is missed.
                setTimeout(finish, 4000);
            });
        },

        plugin: function () {
            return (Native.real && global.PQuitBlocker) ? global.PQuitBlocker : fake;
        }
    };

    ['getStatus', 'startLock', 'setStrictMode', 'getScreenTime',
        'openAccessibilitySettings', 'openUsageAccessSettings', 'openAppSettings',
        'openScreenTime', 'requestNotifications'].forEach(function (name) {
        Native[name] = function () {
            var p = Native.plugin();
            try {
                return Promise.resolve(p[name].apply(p, arguments));
            } catch (e) {
                return Promise.reject(e);
            }
        };
    });

    global.Native = Native;
})(window);
