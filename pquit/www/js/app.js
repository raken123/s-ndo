/** PQuit - screens, the red button, the countdown, the setup page. */
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var views = {};
    var current = null;
    var status = { locked: false, remainingMs: 0 };
    var activeGame = null;
    var pollTimer = null;
    var gamesOpenedAt = 0;

    document.querySelectorAll('.view').forEach(function (v) {
        views[v.dataset.view] = v;
    });

    // ── navigation ────────────────────────────────────────────
    function go(name) {
        if (current === 'play' && name !== 'play') stopGame();
        Object.keys(views).forEach(function (k) {
            views[k].classList.toggle('active', k === name);
        });
        current = name;

        if (name === 'games') {
            // Opening this screen instead of caving is the thing worth counting.
            var now = Date.now();
            if (now - gamesOpenedAt > 10 * 60 * 1000) {
                gamesOpenedAt = now;
                Store.countResisted();
                paintHome();
            }
        }
        if (name === 'stats') loadUsage();
        if (name === 'setup') paintSetup();
    }

    document.addEventListener('click', function (e) {
        var t = e.target.closest('[data-go]');
        if (t) go(t.dataset.go);
    });

    document.addEventListener('backbutton', function () {
        if (current === 'play') { go('games'); return; }
        if (current !== 'home') { go('home'); return; }
        if (navigator.app) navigator.app.exitApp();
    }, false);

    // ── toast ─────────────────────────────────────────────────
    var toastTimer;
    function toast(text) {
        var el = $('toast');
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
    }

    // ── formatting ────────────────────────────────────────────
    function clock(ms) {
        var total = Math.ceil(ms / 1000);
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var s = total % 60;
        var pad = function (n) { return n < 10 ? '0' + n : String(n); };
        return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
    }

    function minutes(ms) {
        var m = Math.round(ms / 60000);
        if (m < 60) return m + 'm';
        return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
    }

    function dateLabel(ts) {
        return new Date(ts).toLocaleDateString(undefined,
            { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // ── home ──────────────────────────────────────────────────
    function paintHome() {
        var days = Store.days();
        $('streakDays').textContent = days;
        $('streakSince').textContent = 'since ' + dateLabel(Store.startedAt());
        $('streakSince2').textContent = 'Counting since ' + dateLabel(Store.startedAt()) + '.';

        var m = Store.nextMilestone();
        var span = m.target - m.prev;
        var pct = Math.max(4, Math.min(100, ((days - m.prev) / span) * 100));
        $('streakBar').style.width = pct + '%';
        $('streakNext').textContent = 'next milestone: ' + m.target + ' day' +
            (m.target === 1 ? '' : 's');

        $('statResisted').textContent = Store.get('resisted');
        $('statLocks').textContent = status.totalLocks || 0;
    }

    function paintLock() {
        var card = $('lockCard');
        if (status.locked) {
            card.classList.remove('hidden');
            $('lockTime').textContent = clock(status.remainingMs);
        } else {
            card.classList.add('hidden');
        }
    }

    // ── status polling ────────────────────────────────────────
    function refresh() {
        return Native.getStatus().then(function (s) {
            status = s || status;
            paintLock();
            paintHome();
            if (current === 'setup') paintSetup();
            return status;
        });
    }

    function startPolling() {
        clearInterval(pollTimer);
        pollTimer = setInterval(function () {
            if (!status.locked) return;
            status.remainingMs = Math.max(0, status.endsAt - Date.now());
            if (status.remainingMs <= 0) {
                refresh().then(function () {
                    if (!status.locked) toast('Cooldown finished. Your call now.');
                });
            } else {
                paintLock();
            }
        }, 1000);
    }

    // ── the red button ────────────────────────────────────────
    function durationMin() {
        return Store.get('durationMin') || 60;
    }

    function durationLabel() {
        var m = durationMin();
        return m === 60 ? '1 hour' : (m / 60) + ' hours';
    }

    $('panicBtn').addEventListener('click', function () {
        if (status.locked) {
            toast('Already running - ' + clock(status.remainingMs) + ' left.');
            return;
        }
        $('sheetDuration').textContent = durationLabel();
        $('panicSheet').classList.remove('hidden');
    });

    $('panicCancel').addEventListener('click', function () {
        $('panicSheet').classList.add('hidden');
    });

    $('panicConfirm').addEventListener('click', function () {
        $('panicSheet').classList.add('hidden');
        Native.startLock(durationMin()).then(function (s) {
            status = s;
            paintLock();
            paintHome();
            if (!s.accessibilityEnabled && Native.real) {
                toast('Timer started - switch on app blocking in Setup to make it bite.');
                go('setup');
            } else if (s.simulated) {
                toast('Timer started (browser preview - no apps are really blocked).');
            } else {
                toast('Locked for ' + durationLabel() + '. Go do something else.');
            }
        }).catch(function () {
            toast('Could not start the cooldown.');
        });
    });

    // ── games ─────────────────────────────────────────────────
    function paintGames() {
        var grid = $('gameGrid');
        grid.innerHTML = '';
        (window.Games || []).forEach(function (g) {
            var tile = document.createElement('button');
            tile.className = 'game-tile';
            tile.innerHTML =
                '<span class="game-emoji">' + g.emoji + '</span>' +
                '<span class="game-name"></span>' +
                '<span class="game-desc"></span>';
            tile.querySelector('.game-name').textContent = g.name;
            tile.querySelector('.game-desc').textContent = g.desc;
            tile.addEventListener('click', function () { play(g); });
            grid.appendChild(tile);
        });
    }

    function play(game) {
        stopGame();
        go('play');
        $('playTitle').textContent = game.name;
        $('playScore').textContent = '';
        // Let the view lay out before the canvas measures its parent.
        requestAnimationFrame(function () {
            activeGame = game.mount($('gameHost'), {
                setScore: function (s) { $('playScore').textContent = s; }
            });
        });
    }

    function stopGame() {
        if (typeof activeGame === 'function') {
            try { activeGame(); } catch (e) { /* teardown is best effort */ }
        }
        activeGame = null;
        $('gameHost').innerHTML = '';
    }

    // ── screen time ───────────────────────────────────────────
    function loadUsage() {
        Native.getScreenTime(24 * 60 * 60 * 1000).then(function (data) {
            var ok = data && data.usageAccess;
            $('usageDenied').classList.toggle('hidden', !!ok);
            $('usageBody').classList.toggle('hidden', !ok);
            if (!ok) return;

            $('usageTotal').textContent = minutes(data.totalMs);
            $('usageBlocked').textContent = minutes(data.blockedMs);

            var list = $('usageList');
            list.innerHTML = '';
            if (!data.apps.length) {
                var empty = document.createElement('div');
                empty.className = 'usage-row';
                empty.innerHTML = '<span class="n">Nothing recorded yet today</span>';
                list.appendChild(empty);
                return;
            }
            data.apps.forEach(function (a) {
                var row = document.createElement('div');
                row.className = 'usage-row' + (a.blocked ? ' blocked' : '');
                var n = document.createElement('span');
                n.className = 'n';
                n.textContent = a.label;
                var t = document.createElement('span');
                t.className = 't';
                t.textContent = minutes(a.ms);
                row.appendChild(n);
                row.appendChild(t);
                list.appendChild(row);
            });
        });
    }

    $('grantUsage').addEventListener('click', openUsage);
    $('grantUsage2').addEventListener('click', openUsage);
    function openUsage() {
        Native.openUsageAccessSettings();
        toast('Find PQuit in the list and allow usage access.');
    }

    $('openWellbeing').addEventListener('click', function () {
        Native.openScreenTime();
    });

    // ── setup ─────────────────────────────────────────────────
    function paintSetup() {
        var a = $('pillAccess');
        a.textContent = status.accessibilityEnabled ? 'on' : 'off';
        a.classList.toggle('on', !!status.accessibilityEnabled);

        var u = $('pillUsage');
        u.textContent = status.usageAccess ? 'on' : 'off';
        u.classList.toggle('on', !!status.usageAccess);

        $('strictToggle').checked = status.strictMode !== false;

        var min = durationMin();
        document.querySelectorAll('#durationChips .chip').forEach(function (c) {
            c.classList.toggle('on', Number(c.dataset.min) === min);
        });
    }

    $('grantAccess').addEventListener('click', function () {
        Native.openAccessibilitySettings();
        toast('Turn on "PQuit blocker" under Installed apps.');
    });

    $('strictToggle').addEventListener('change', function (e) {
        Native.setStrictMode(e.target.checked).then(function (s) {
            status = s;
            toast(e.target.checked
                ? 'Strict: only preinstalled apps stay open.'
                : 'Only Chrome, Edge, TikTok and YouTube get blocked.');
        });
    });

    $('durationChips').addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        Store.set('durationMin', Number(chip.dataset.min));
        paintSetup();
    });

    $('resetStreak').addEventListener('click', function () {
        if (!confirm('Reset the streak to day 0? Your counters stay.')) return;
        Store.resetStreak();
        paintHome();
        toast('Day 0. Tomorrow is day 1.');
    });

    // ── boot ──────────────────────────────────────────────────
    function boot() {
        paintGames();
        paintHome();
        go('home');
        refresh().then(function () {
            startPolling();
            Native.requestNotifications();
        });
        document.addEventListener('resume', refresh, false);
    }

    Native.ready().then(boot, boot);
})();
