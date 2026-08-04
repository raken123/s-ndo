/** 2048. Swipe to slide the tiles. */
(function () {
    'use strict';

    var N = 4;

    GameUtil.register({
        id: '2048',
        name: '2048',
        emoji: '🔢',
        desc: 'Slide, merge, lose track of time. Exactly the point.',
        mount: mount
    });

    function mount(host, api) {
        host.innerHTML = '';
        var board = document.createElement('div');
        board.className = 'g2048';
        host.appendChild(board);
        var msg = GameUtil.msg(host, 'Swipe to slide');

        var cells = [];
        for (var i = 0; i < N * N; i++) {
            var t = document.createElement('div');
            t.className = 't';
            board.appendChild(t);
            cells.push(t);
        }

        var grid, score, over;

        function reset() {
            grid = [];
            for (var i = 0; i < N * N; i++) grid.push(0);
            score = 0;
            over = false;
            spawn();
            spawn();
            render();
            msg.textContent = 'Swipe to slide';
        }

        function spawn() {
            var free = [];
            grid.forEach(function (v, i) { if (!v) free.push(i); });
            if (!free.length) return;
            var at = free[Math.floor(Math.random() * free.length)];
            grid[at] = Math.random() < 0.9 ? 2 : 4;
            cells[at].classList.add('pop');
            setTimeout(function () { cells[at].classList.remove('pop'); }, 110);
        }

        function render() {
            grid.forEach(function (v, i) {
                cells[i].textContent = v ? v : '';
                cells[i].setAttribute('data-v', v || '');
            });
            api.setScore(String(score));
        }

        /** Collapses one line towards index 0. */
        function slide(line) {
            var vals = line.filter(function (v) { return v; });
            var out = [];
            for (var i = 0; i < vals.length; i++) {
                if (vals[i] === vals[i + 1]) {
                    out.push(vals[i] * 2);
                    score += vals[i] * 2;
                    i++;
                } else {
                    out.push(vals[i]);
                }
            }
            while (out.length < N) out.push(0);
            return out;
        }

        function lineIndexes(dir, k) {
            var idx = [];
            for (var i = 0; i < N; i++) {
                if (dir === 'left') idx.push(k * N + i);
                if (dir === 'right') idx.push(k * N + (N - 1 - i));
                if (dir === 'up') idx.push(i * N + k);
                if (dir === 'down') idx.push((N - 1 - i) * N + k);
            }
            return idx;
        }

        function move(dir) {
            if (over) { reset(); return; }
            var changed = false;
            for (var k = 0; k < N; k++) {
                var idx = lineIndexes(dir, k);
                var line = idx.map(function (i) { return grid[i]; });
                var next = slide(line);
                next.forEach(function (v, i) {
                    if (grid[idx[i]] !== v) changed = true;
                    grid[idx[i]] = v;
                });
            }
            if (changed) spawn();
            render();
            if (!movesLeft()) {
                over = true;
                msg.textContent = 'No moves left - swipe to start again. Score ' + score;
            }
        }

        function movesLeft() {
            for (var i = 0; i < N * N; i++) {
                if (!grid[i]) return true;
                var x = i % N, y = (i - x) / N;
                if (x < N - 1 && grid[i] === grid[i + 1]) return true;
                if (y < N - 1 && grid[i] === grid[i + N]) return true;
            }
            return false;
        }

        var offSwipe = GameUtil.onSwipe(board, function (d) {
            if (d === 'tap') { if (over) reset(); return; }
            move(d);
        });

        GameUtil.bar(host, [{ label: 'New board', onClick: reset }]);

        reset();

        return function destroy() { offSwipe(); };
    }
})();
