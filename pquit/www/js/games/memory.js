/** Memory pairs. Eight pairs, tap two cards. */
(function () {
    'use strict';

    var FACES = ['🌊', '🏔', '🌵', '🔥', '🍋', '⚡', '🎧', '🚲'];

    GameUtil.register({
        id: 'memory',
        name: 'Memory',
        emoji: '🃏',
        desc: 'Find the pairs. Quietly absorbing.',
        mount: mount
    });

    function mount(host, api) {
        host.innerHTML = '';
        var board = document.createElement('div');
        board.className = 'memory';
        host.appendChild(board);
        var msg = GameUtil.msg(host, 'Tap two cards');

        var moves, matched, first, second, busy, timer;

        function reset() {
            board.innerHTML = '';
            moves = 0;
            matched = 0;
            first = second = null;
            busy = false;
            api.setScore('0 moves');
            msg.textContent = 'Tap two cards';

            var deck = FACES.concat(FACES).sort(function () { return Math.random() - 0.5; });
            deck.forEach(function (face) {
                var card = document.createElement('button');
                card.className = 'mcard down';
                card.textContent = face;
                card.dataset.face = face;
                card.addEventListener('click', function () { flip(card); });
                board.appendChild(card);
            });
        }

        function flip(card) {
            if (busy || !card.classList.contains('down') || card.classList.contains('done')) return;
            card.classList.remove('down');

            if (!first) { first = card; return; }
            second = card;
            moves += 1;
            api.setScore(moves + ' move' + (moves === 1 ? '' : 's'));

            if (first.dataset.face === second.dataset.face) {
                first.classList.add('done');
                second.classList.add('done');
                first = second = null;
                matched += 1;
                if (matched === FACES.length) {
                    msg.textContent = 'All pairs in ' + moves + ' moves. Again?';
                }
                return;
            }

            busy = true;
            timer = setTimeout(function () {
                first.classList.add('down');
                second.classList.add('down');
                first = second = null;
                busy = false;
            }, 700);
        }

        GameUtil.bar(host, [{ label: 'Shuffle', onClick: reset }]);
        reset();

        return function destroy() { clearTimeout(timer); };
    }
})();
