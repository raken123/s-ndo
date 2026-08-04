/** Local, private, boring: streak + counters in localStorage. Nothing leaves the phone. */
(function (global) {
    'use strict';

    var KEY = 'pquit.state';
    var DAY = 86400000;

    var defaults = {
        startedAt: 0,       // ms - when the current streak began
        resisted: 0,        // urges ridden out (opened the games screen and stayed)
        best: 0,            // best streak in days
        durationMin: 60,    // cooldown length
        lastOpen: 0
    };

    function load() {
        var s;
        try {
            s = JSON.parse(localStorage.getItem(KEY)) || {};
        } catch (e) {
            s = {};
        }
        Object.keys(defaults).forEach(function (k) {
            if (typeof s[k] === 'undefined') s[k] = defaults[k];
        });
        if (!s.startedAt) s.startedAt = Date.now();
        return s;
    }

    var state = load();

    function save() {
        localStorage.setItem(KEY, JSON.stringify(state));
    }

    var Store = {
        get: function (k) { return state[k]; },

        set: function (k, v) { state[k] = v; save(); return v; },

        /** Whole days since the streak started. */
        days: function () {
            return Math.floor((Date.now() - state.startedAt) / DAY);
        },

        startedAt: function () { return state.startedAt; },

        resetStreak: function () {
            var d = Store.days();
            if (d > state.best) state.best = d;
            state.startedAt = Date.now();
            save();
        },

        countResisted: function () {
            state.resisted += 1;
            save();
        },

        /** Milestones the streak bar fills towards. */
        nextMilestone: function () {
            var marks = [1, 3, 7, 14, 30, 60, 90, 180, 365];
            var d = Store.days();
            for (var i = 0; i < marks.length; i++) {
                if (d < marks[i]) {
                    return { target: marks[i], prev: i ? marks[i - 1] : 0 };
                }
            }
            var years = Math.floor(d / 365) + 1;
            return { target: years * 365, prev: (years - 1) * 365 };
        }
    };

    global.Store = Store;
})(window);
