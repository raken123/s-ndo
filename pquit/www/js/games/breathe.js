/** Box breathing: 4 in, 4 hold, 6 out. Not a game, but it works faster than one. */
(function () {
    'use strict';

    var PHASES = [
        { label: 'Breathe in', ms: 4000, scale: 1 },
        { label: 'Hold', ms: 4000, scale: 1 },
        { label: 'Breathe out', ms: 6000, scale: 0.55 },
        { label: 'Hold', ms: 2000, scale: 0.55 }
    ];

    GameUtil.register({
        id: 'breathe',
        name: 'Breathe',
        emoji: '🫁',
        desc: 'Four in, four hold, six out. Drops the spike fast.',
        mount: mount
    });

    function mount(host, api) {
        host.innerHTML = '';
        var wrap = document.createElement('div');
        wrap.className = 'breathe-wrap';
        var ball = document.createElement('div');
        ball.className = 'breathe-ball';
        ball.textContent = 'Ready';
        var count = document.createElement('div');
        count.className = 'breathe-count';
        count.textContent = 'Follow the circle for a few rounds';
        wrap.appendChild(ball);
        wrap.appendChild(count);
        host.appendChild(wrap);

        var phase = -1, rounds = 0, timer;

        function next() {
            phase = (phase + 1) % PHASES.length;
            if (phase === 0) {
                rounds += 1;
                api.setScore(rounds + ' round' + (rounds === 1 ? '' : 's'));
            }
            var p = PHASES[phase];
            ball.textContent = p.label;
            ball.style.transitionDuration = p.ms + 'ms';
            ball.style.transform = 'scale(' + p.scale + ')';
            count.textContent = rounds >= 4
                ? 'That is usually enough. Notice it dropping?'
                : 'Round ' + rounds;
            timer = setTimeout(next, p.ms);
        }

        api.setScore('');
        timer = setTimeout(next, 600);

        return function destroy() { clearTimeout(timer); };
    }
})();
